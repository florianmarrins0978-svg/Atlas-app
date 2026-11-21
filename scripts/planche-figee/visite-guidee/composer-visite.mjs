// Assemble la visite guidée à partir des écrans VRAIS figés par les segments
// s1…s11 (`fige.mjs`). Chaque étape = un écran figé, un geste à toucher (le
// doigt), une phrase. La fin laisse les Réglages libres.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const TRAVAIL = process.env.VISITE_TRAVAIL ?? "/tmp/visite-guidee";

const DOSSIER = process.env.ETATS ?? `${TRAVAIL}/etats`;
const SORTIE = process.argv[2] ?? `${TRAVAIL}/visite.html`;
const SERVEUR = "http://localhost:3001";

const etats = {};
for (const f of readdirSync(DOSSIER).filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(readFileSync(`${DOSSIER}/${f}`, "utf8"));
  etats[d.nom] = d;
}

// Les feuilles de style : l'union de celles de tous les écrans, sans doublon.
const vues = new Set();
let css = "";
for (const e of Object.values(etats)) for (const f of e.feuilles) if (f && !vues.has(f)) { vues.add(f); css += f + "\n"; }
// Polices et images citées par les feuilles : mises en ligne.
const urls = [...new Set([...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]))].filter((u) => !u.startsWith("data:") && !u.startsWith("#"));
for (const u of urls) {
  try {
    const r = await fetch(new URL(u, SERVEUR));
    if (!r.ok) continue;
    const type = r.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    const d = `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
    css = css.split(u).join(d);
  } catch {}
}

/**
 * Le parcours. `cible` : le sélecteur que le doigt montre et qu'il faut
 * toucher ; sans cible, seul « Suivant » avance. `etat` peut revenir (l'accueil
 * sert deux fois). Les phrases : courtes, sans tiret ni point médian (CLAUDE.md §3).
 */
const ETAPES = [
  { etat: "01-accueil", titre: "L'accueil", dit: "Vos chantiers en cours, et ce qui attend votre réponse.", cible: 'a[href="/clients"]', geste: "Touchez Vos clients." },
  { etat: "02-clients", titre: "Vos clients", dit: "Tous vos clients, rangés par lettre, et ce qu'ils vous doivent.", cible: 'a:has-text("Costa"), button:has-text("Costa")', geste: "Touchez Mme Costa." },
  { etat: "02b-client-devis", titre: "La fiche du client", dit: "Ses coordonnées, ses devis, ses factures. Tout se télécharge d'un coup.", cible: '[data-atlas="registre"]:has-text("Factures")', geste: "Touchez Factures." },
  { etat: "02c-client-factures", titre: "Ses factures", dit: "Chacune, avec ce que le client en a fait : ouverte, payée ou due.", cible: 'button:has-text("Dernier devis")', geste: "Touchez Dernier devis." },
  { etat: "02d-dernier-devis", titre: "Le dernier devis, repris", dit: "Le même travail l'an prochain ? Le devis repart, ligne par ligne.", cible: 'button:has-text("+ 10 %")', geste: "Touchez + 10 %." },
  { etat: "02e-dernier-devis-hausse", titre: "Les prix montent", dit: "Chaque ligne prend 10 %. Il ne reste qu'à choisir la date." },
  { etat: "01-accueil", titre: "Un nouveau devis", dit: "Partons d'un nouveau client.", cible: '[data-atlas="nouveau-chantier"]', geste: "Touchez Créer un devis." },
  { etat: "03-nouveau-mr", titre: "La fiche du client", dit: "Un particulier, une entreprise ou une mairie : la fiche s'adapte.", cible: '[data-atlas="civilite-entreprise"]', geste: "Touchez Entreprise." },
  { etat: "04-nouveau-entreprise", titre: "Une entreprise", dit: "Le SIRET et le numéro de TVA apparaissent.", cible: '[data-atlas="civilite-public"]', geste: "Touchez Public." },
  { etat: "05-nouveau-public", titre: "Une mairie", dit: "Pour un service public : le SIRET et le code service.", cible: '[data-atlas="civilite-mr"]', geste: "Revenez à Mr." },
  { etat: "06-nouveau-rempli", titre: "Un particulier", dit: "Le nom, le téléphone, l'adresse du chantier.", taper: true, cible: '[data-atlas="anneau-note-vocale"] .atlas-micro, [data-atlas="anneau-note-vocale"] button', geste: "Touchez le micro et décrivez le chantier." },
  { etat: "07-dictee-ecoute", titre: "Vous dictez", dit: "« Taille de la haie de thuyas, ramassage des déchets verts, élagage du tilleul. »", cible: '[data-atlas="dictee-envoyer"]', geste: "Touchez Envoyer." },
  { etat: "08-avant-de-chiffrer", titre: "Avant de chiffrer", dit: "Cause demande ce qui manque pour faire le prix.", cible: '[data-atlas="question-chiffrage"] input', geste: "Touchez la case." },
  { etat: "09-avant-de-chiffrer-rempli", titre: "25 mètres", dit: "La longueur de la haie est notée.", cible: 'button:has-text("Continuer")', geste: "Touchez Continuer." },
  { etat: "10-devis", titre: "Le devis est rédigé", dit: "Votre entreprise, le client, les prestations et vos prix. Une correction ? Pas besoin d'écrire.", cible: 'button[aria-label="Dicter dans le devis"]', geste: "Touchez le micro, en haut à droite." },
  { etat: "10b-devis-micro", titre: "Corriger à la voix", dit: "« Ajoute le désherbage de l'allée. » Cause l'écrit dans le devis, sans rien taper." },
  { etat: "11-devis-totaux", titre: "À vous d'essayer", dit: "Remise, Main d'œuvre, Acompte, Ajouter une TVA, Ajouter une ligne : touchez, essayez.", essais: "devis" },
  { etat: "11-devis-totaux", titre: "L'aperçu", dit: "Voyons ce que reçoit votre client.", cible: '[data-atlas="apercu-pdf"]', geste: "Touchez Aperçu du PDF." },
  { etat: "12-apercu-pdf", titre: "Le PDF", dit: "Le devis tel que votre client le recevra.", cible: 'a[aria-label="Retour"]', geste: "Revenez au devis." },
  { etat: "11-devis-totaux", titre: "Le devis est prêt", dit: "Il ne reste qu'à proposer une date.", cible: 'button:has-text("Choisir la date")', geste: "Touchez Choisir la date." },
  { etat: "13-choisir-date", titre: "Vos dates", dit: "Votre planning sous les yeux : proposez une ou deux dates.", cible: 'button[aria-label^="25 novembre"]', geste: "Touchez le 25." },
  { etat: "14-date-choisie", titre: "Deux dates proposées", dit: "Le 23 et le 25. Le client choisira.", cible: 'button:has-text("Envoyer le devis")', geste: "Touchez Envoyer le devis." },
  { etat: "15-devis-envoye", titre: "Le devis est parti", dit: "Par SMS. Cause vous prévient dès qu'il répond." },
  { etat: "16-client-devis", titre: "Chez votre client", dit: "Voici ce qu'il reçoit sur son téléphone. Il choisit sa date.", chez: "client", cible: 'input[name="choixDate"][value*="25"], label:has(input[name="choixDate"]):nth-of-type(2)', geste: "Touchez Mercredi 25." },
  { etat: "17-client-date", titre: "Il accepte", dit: "Un geste suffit, sans compte ni mot de passe.", chez: "client", cible: 'button:has-text("J\'accepte ce devis")', geste: "Touchez J'accepte ce devis." },
  { etat: "18-client-signe", titre: "Il signe au doigt", dit: "Sa signature est horodatée et gardée avec le devis.", chez: "client", cible: '[data-atlas="signature-devis"] button:has-text("J\'accepte")', geste: "Touchez J'accepte ce devis." },
  { etat: "19-client-accepte", titre: "C'est signé", dit: "Le client a fini. Revenons chez vous.", chez: "client" },
  { etat: "19b-accueil-accepte", titre: "Vous êtes prévenu", dit: "Sur l'accueil : le devis est accepté, et la date retenue. Le chantier s'est posé tout seul.", cible: 'nav a[href="/planning"]', geste: "Touchez Planning." },
  { etat: "20-planning", titre: "Le planning", dit: "Le chantier est posé le 25. Un trait plein : la journée est complète.", cible: 'button[aria-label^="25 novembre"]', geste: "Touchez le 25." },
  { etat: "21-planning-jour", titre: "La journée", dit: "Le client, le lieu, le matin et l'après-midi.", cible: '[data-atlas="equipe"]', geste: "Touchez + Salarié." },
  { etat: "22-planning-choisir", titre: "Qui part ?", dit: "Vos salariés, d'un geste.", cible: '[data-atlas="choisir"] button', geste: "Touchez Paul." },
  { etat: "23-planning-salaries", titre: "L'équipe est faite", dit: "Paul et Kévin partent le matin et l'après-midi." },
  { etat: "24-planning-fiche", titre: "La fiche d'intervention", dit: "L'itinéraire, l'appel au client, votre note.", cible: '[data-atlas="ouvrir-fiche-de-securite"]', geste: "Touchez Fiche de sécurité." },
  { etat: "24b-fiche-securite", titre: "La fiche de sécurité", dit: "Un élagage est prévu : la fiche est obligatoire avant d'y aller.", cible: '[data-atlas="remplir-la-fiche"]', geste: "Touchez Remplir la fiche." },
  { etat: "24c-fiche-decret", titre: "Le décret 2021-1833", dit: "Tout ce que la loi demande avant un élagage ou un abattage. Cause vous guide, case par case, et vous signez sur le téléphone." },
  { etat: "24-planning-fiche", titre: "Les travaux à faire", dit: "Ceux du devis, pour l'équipe.", cible: '[data-atlas="ouvrir-travaux"]', geste: "Touchez Travaux à faire." },
  { etat: "24d-travaux", titre: "Les travaux du jour", dit: "L'équipe les coche sur place. Le soir, le retour vous arrive.", cible: 'a[href="/termines"]', geste: "Touchez Terminés." },
  { etat: "25-termines", titre: "Terminés", dit: "Les chantiers passés, et les retours de vos équipes.", cible: '[data-atlas="onglet-retours"]', geste: "Touchez Retours d'intervention." },
  { etat: "25b-retours", titre: "Retours d'intervention", dit: "Chaque soir, l'équipe dit ce qui a été fait. Rangé client par client.", cible: '[data-atlas="carte-de-retour"]', geste: "Touchez le retour." },
  { etat: "25c-retour", titre: "Le retour du jour", dit: "Les travaux faits, et ce qu'il faut savoir." },
  { etat: "25-termines", titre: "Le chantier est passé", dit: "Celui de M. Lefèvre attend sa facture.", cible: '[data-atlas="ligne-terminee"]:has-text("Lef")', geste: "Touchez le chantier." },
  { etat: "27-facture", titre: "La facture", dit: "Elle reprend le devis, ligne par ligne. À vous d'essayer : Voir le PDF, Travaux en plus, Facture acquittée.", essais: "facture" },
  { etat: "28-facture-envoi", titre: "L'envoi", dit: "Par SMS ou par e-mail.", cible: '[data-atlas="envoyer-la-facture"]', geste: "Touchez Envoyer la facture." },
  { etat: "29-facture-envoyee", titre: "Elle est partie", dit: "Arrêtée et numérotée. Une correction passerait par un avoir. Voyons ce que reçoit votre client : sa facture, l'IBAN et le numéro à écrire sur son virement." },
  { etat: "30-client-facture", titre: "Chez votre client", dit: "Sa facture, l'IBAN et le numéro à écrire sur son virement.", chez: "client", cible: 'button:has-text("J\'ai bien reçu")', geste: "Touchez J'ai bien reçu cette facture.", sansBulle: true },
  { etat: "31-client-facture-recue", titre: "Il a reçu", dit: "Vous le savez. Puis il paie par virement.", chez: "client", bulleEnHaut: true },
  { etat: "32-accueil-virement", titre: "Le virement arrive", dit: "Votre banque est reliée : Cause reconnaît le numéro de la facture.", cible: '[data-atlas="carte-virement"] button', geste: "Touchez Oui." },
  { etat: "33-accueil-virement-oui", titre: "Payée", dit: "La facture est réglée. Elle entre dans votre TVA." },
  { etat: "34-tva", titre: "Ma TVA", dit: "La TVA collectée, la déductible, et ce qu'il reste à payer.", cible: 'button:has-text("Écrire à la main")', geste: "Touchez Écrire à la main." },
  { etat: "35-tva-a-la-main", titre: "Un achat", dit: "Des végétaux à la pépinière : la TVA se calcule toute seule.", cible: '[data-atlas="ajouter-aux-achats"]', geste: "Touchez Ajouter aux achats." },
  { etat: "36-tva-achat-ajoute", titre: "Ajouté", dit: "31 € de TVA récupérée.", cible: 'button:has-text("Scanner un ticket")', geste: "Touchez Scanner un ticket." },
  { etat: "37-tva-ticket-lu", titre: "Le ticket est lu", dit: "Une photo du ticket de carburant : Cause remplit tout.", photo: true, cible: '[data-atlas="ajouter-aux-achats"]', geste: "Touchez Ajouter aux achats." },
  { etat: "38-tva-ticket-ajoute", titre: "Votre TVA à jour", dit: "Le reste à payer suit chaque achat.", cible: '[data-atlas="montant-collectee-ouvrir"]', geste: "Touchez TVA collectée." },
  { etat: "39-tva-collectee", titre: "La TVA collectée", dit: "Chaque facture payée, et chaque taux." },
  { etat: "40-tva-deductible", titre: "La TVA déductible", dit: "Chaque achat, et chaque taux. Les chiffres se copient pour votre déclaration." },
  { etat: "45-ma-banque", titre: "Votre banque", dit: "Reliée en lecture seule. Cause lit vos lignes, rien ne sort." },
  { etat: "41-comptable", titre: "Pour mon comptable", dit: "Chaque ligne de banque, et ce qui la justifie.", cible: '[data-atlas="check-up"]', geste: "Touchez Check up." },
  { etat: "42-checkup", titre: "Le check up", dit: "Les tickets et les factures sont rapprochés tout seuls. Il reste trois lignes." },
  { etat: "43-comptable-justifie", titre: "Tout est justifié", dit: "Un ticket perdu, un fournisseur : un geste par ligne.", cible: '[data-atlas="periode"]', geste: "Touchez Novembre 2026." },
  { etat: "44-releve-du-mois", titre: "Le relevé du mois", dit: "Les entrées, les sorties, et la pièce de chacune." },
  { etat: "46-arreter", titre: "Arrêter le dossier", dit: "Du 1er janvier à aujourd'hui.", cible: '[data-atlas="arreter-et-ranger"]', geste: "Touchez Arrêter et ranger." },
  { etat: "47-dossier-range", titre: "Le dossier est rangé", dit: "Gardé dix ans.", cible: '[data-atlas="ouvrir-dossier"]', geste: "Touchez le PDF." },
  { etat: "49-dossier-pdf", titre: "Le document comptable", dit: "Ce que reçoit votre comptable. Un bouton l'envoie." },
  { etat: "50-reglages", titre: "À vous", dit: "Touchez chaque rubrique des Réglages. Et dites-nous ce qui vous manque.", libre: true, cible: '[data-atlas="porte-idee"]', geste: "Une idée pour l'appli : on lit tout." },
];

// Les boutons du devis, à essayer librement : chacun ouvre sa vraie feuille, et
// son bouton pose sur le devis ce que l'appli y pose (figés par s3.mjs).
const ESSAIS_DU_DEVIS = [
  { ouvre: '[data-atlas="poser-prix-accorde"]', feuille: "11-remise-feuille", pose: "11-remise-pose", applique: 'button:has-text("Appliquer la remise")', titre: "Une remise", geste: "Touchez Appliquer la remise.", fait: "La remise est posée, le total suit." },
  { ouvre: '[data-atlas="poser-main-doeuvre"]', feuille: "11-main-doeuvre-feuille", pose: "11-main-doeuvre-pose", applique: 'button:has-text("Ajouter la main")', titre: "La main d'œuvre", geste: "Touchez Ajouter la main d'œuvre.", fait: "Les hommes, les jours, votre tarif : la ligne est posée." },
  { ouvre: '[data-atlas="ajouter-acompte"]', feuille: "11-acompte-feuille", pose: "11-acompte-pose", applique: 'button:has-text("Ajouter l’acompte")', titre: "Un acompte", geste: "Touchez Ajouter l'acompte.", fait: "Versé à la signature, le reste après les travaux." },
  { ouvre: 'button:has-text("+ Ajouter une TVA")', feuille: "11-tva-feuille", pose: "11-tva-pose", applique: 'button:has-text("Ajouter la TVA")', titre: "Un autre taux", geste: "Touchez Ajouter la TVA.", fait: "Deux taux sur le même devis : chaque ligne prend le sien." },
  { ouvre: 'button:has-text("+ Ajouter une ligne")', pose: "11-ligne-pose", titre: "Une ligne", fait: "Une ligne vide, à remplir ou à dicter." },
];

// Sur la facture, tout s'essaie sauf l'envoi (sa demande du 20 novembre).
const ESSAIS_DE_LA_FACTURE = [
  { ouvre: '[data-atlas="voir-facture"]', pose: "27-facture-pdf", titre: "La facture en PDF", fait: "Telle que votre client la recevra, l'attestation d'assurance jointe." },
  { ouvre: '[data-atlas="ajouter-travaux-supplementaires"]', pose: "27-travaux-en-plus", titre: "Des travaux en plus", fait: "Ce qui s'est ajouté sur place : un travail, de la main d'œuvre, un autre taux." },
  { ouvre: '[data-atlas="facture-acquittee"]', pose: "27-facture-acquittee", titre: "Facture acquittée", fait: "Payée sur place ? Un geste, et elle part acquittée." },
];
const ESSAIS = { devis: ESSAIS_DU_DEVIS, facture: ESSAIS_DE_LA_FACTURE };

// Les rubriques des Réglages, ouvertes librement à la fin.
const RUBRIQUES = Object.keys(etats).filter((n) => n.startsWith("r-"));

const besoin = new Set([...ETAPES.map((e) => e.etat), ...RUBRIQUES, ...Object.values(ESSAIS).flat().flatMap((x) => [x.feuille, x.pose].filter(Boolean))]);
const manquent = [...besoin].filter((n) => !etats[n]);
if (manquent.length) { console.error("écrans manquants :", manquent); process.exit(1); }

// Les retouches : ce que CE poste montre et que son appli, clés branchées, ne montre pas.
const RETOUCHES = {
  // Sans clé d'IA ici, la lecture du ticket refuse ; chez lui, elle lit. Le refus part.
  // Chez lui les clés sont posées (CLAUDE.md §1 ter) : Cause IA dit « Oui », en vert, comme son écran.
  "r-ia": (h) => h
    .replaceAll('style="background-color:color-mix(in srgb, var(--atlas-or, #B98B47) 12%, transparent);color:var(--atlas-or, #B98B47)"', 'style="background-color:var(--atlas-carteVertFond, #e1e8da);color:var(--atlas-carteVertTexte, #506f44)"')
    .replaceAll('style="background-color:color-mix(in srgb, var(--atlas-ink, #1c1c1a) 6%, transparent);color:var(--atlas-inkSoft, #4a4a44)"><span aria-hidden="true" class="h-[7px] w-[7px] flex-none rounded-full" style="background-color:currentColor"></span>Pas encore', 'style="background-color:var(--atlas-carteVertFond, #e1e8da);color:var(--atlas-carteVertTexte, #506f44)"><span aria-hidden="true" class="h-[7px] w-[7px] flex-none rounded-full" style="background-color:currentColor"></span>Oui')
    .replace(/<div class="mx-\[22px\] mt-2"><div class="rounded-\[6px\][^>]*>Rien à faire de votre côté[^<]*<\/div><\/div>/, ""),
  "37-tva-ticket-lu": (h) => h.replace(/<p[^>]*>[^<]*La lecture automatique n[’']est pas disponible ici[^<]*<\/p>/, ""),
};
for (const e of Object.values(etats)) e.corps.html = e.corps.html.replaceAll("06 12 34 56 78", "06 39 98 00 00").replaceAll("bernard@exemple.fr", "bernard@example.com");
for (const [n, f] of Object.entries(RETOUCHES)) if (etats[n]) {
  const avant = etats[n].corps.html; etats[n].corps.html = f(avant);
  if (avant === etats[n].corps.html) { console.error("retouche sans effet :", n); process.exit(1); }
}
const premier = etats[ETAPES[0].etat].corps;
const blocs = [...besoin]
  .map((n) => `<div class="visite-ecran" data-ecran="${n}" data-defile="${etats[n].defile}" hidden>${etats[n].corps.html}</div>`)
  .join("\n");

const ticket = `data:image/jpeg;base64,${readFileSync(`${TRAVAIL}/ticket-carburant.jpg`).toString("base64")}`;

const STYLE = `
html,body{overflow-x:clip}
.visite-ecran[hidden]{display:none!important}
:root{--v-encre:#1c1c1a;--v-creme:#f5f3ee;--v-or:#B98B47}
.v-calque{position:fixed;inset:0;z-index:200;overflow:hidden;pointer-events:none}
.v-doigt{position:absolute;pointer-events:none;border-radius:999px;box-shadow:0 0 0 3px var(--v-or),0 0 0 9999px rgba(28,28,26,.18);transition:opacity 200ms}
.v-doigt::after{content:"";position:absolute;inset:-6px;border-radius:inherit;border:2px solid var(--v-or);animation:v-pouls 1.6s cubic-bezier(.16,1,.3,1) infinite}
@keyframes v-pouls{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(1.35)}}
.v-guide{position:fixed;left:12px;right:12px;z-index:210;max-width:420px;margin:0 auto;padding:16px 18px 14px;border-radius:20px;background:var(--v-encre);color:var(--v-creme);box-shadow:0 12px 40px rgba(0,0,0,.28);font-family:var(--font-body),system-ui,sans-serif;transition:top 300ms cubic-bezier(.16,1,.3,1),bottom 300ms cubic-bezier(.16,1,.3,1),opacity 200ms}
.v-guide.en-bas{bottom:calc(84px + env(safe-area-inset-bottom))}
.v-guide.en-haut{top:12px}
.v-guide .v-chez{display:inline-block;margin-bottom:6px;padding:3px 9px;border-radius:999px;background:var(--v-or);color:var(--v-encre);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.v-guide h2{margin:0 0 4px;font-family:var(--font-display),Georgia,serif;font-size:22px;font-weight:400;line-height:1.15}
.v-guide p{margin:0;font-size:15px;line-height:1.4;color:rgba(245,243,238,.86)}
.v-guide .v-geste{margin-top:8px;color:var(--v-or);font-weight:600}
.v-pied{display:flex;align-items:center;gap:10px;margin-top:12px}
.v-barre{flex:1;height:3px;border-radius:3px;background:rgba(245,243,238,.18);overflow:hidden}
.v-barre i{display:block;height:100%;background:var(--v-or);transition:width 300ms}
.v-pied button{min-height:40px;padding:0 16px;border:0;border-radius:999px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.v-retour{background:transparent;color:rgba(245,243,238,.7)}
.v-suivant{background:var(--v-creme);color:var(--v-encre)}
.v-guide.en-retrait{opacity:0;pointer-events:none}
.v-guide.secoue{animation:v-secoue 380ms}
@keyframes v-secoue{20%{transform:translateX(-6px)}50%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
.v-ouverture{position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;justify-content:center;background:rgba(28,28,26,.5)}
.v-ouverture>div{width:100%;max-width:440px;margin:0 12px 24px;padding:26px 22px 20px;border-radius:24px;background:var(--v-creme);color:var(--v-encre)}
.v-ouverture small{font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--v-or)}
.v-ouverture h1{margin:6px 0 10px;font-family:var(--font-display),Georgia,serif;font-size:32px;font-weight:400;line-height:1.05}
.v-ouverture p{margin:0 0 18px;font-size:16px;line-height:1.45;color:#4a4a44}
.v-ouverture button{width:100%;min-height:52px;border:0;border-radius:999px;background:var(--atlas-plein,#7d9a6d);color:#faf9f5;font:inherit;font-size:17px;font-weight:600;cursor:pointer}
.v-photo{position:fixed;inset:0;z-index:250;display:flex;align-items:center;justify-content:center;background:rgba(28,28,26,.82);opacity:0;pointer-events:none;transition:opacity 260ms}
.v-photo.visible{opacity:1}
.v-photo img{width:min(72vw,300px);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.5);transform:rotate(-2deg)}
@media (min-width:1024px){.v-guide,.v-guide.en-haut,.v-guide.en-bas{left:16px;right:auto;top:auto;bottom:24px;width:300px;margin:0}}
@media (prefers-reduced-motion: reduce){.v-doigt::after{animation:none}.v-doigt,.v-guide{transition:none}}
`;

const config = { etapes: ETAPES, rubriques: RUBRIQUES, essais: ESSAIS };

const SCRIPT = `
(() => {
  const C = ${JSON.stringify(config)};
  const ecrans = new Map([...document.querySelectorAll(".visite-ecran")].map((e) => [e.dataset.ecran, e]));
  const guide = document.querySelector(".v-guide"), doigt = document.querySelector(".v-doigt");
  const photo = document.querySelector(".v-photo");
  let rang = 0, libre = false, courant = null, minuteur = null;
  // Un essai en cours, sur l'étape qui en propose : { x, phase: "feuille" | "pose" }.
  let essai = null;

  // Un écran figé est inerte : aucun formulaire ne part, aucun lien ne quitte la visite.
  document.addEventListener("submit", (e) => e.preventDefault(), true);

  const montrer = (nom, defile) => {
    ecrans.forEach((e, n) => (e.hidden = n !== nom));
    courant = ecrans.get(nom);
    window.scrollTo(0, defile ?? Number(courant.dataset.defile || 0));
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cibleDe = (sel) => {
    if (!sel || !courant) return null;
    for (const s of sel.split(/,(?![^(]*\\))/)) {
      let liste = [];
      const m = s.match(/^(.*):has-text\\("(.*)"\\)$/);
      try {
        liste = m ? [...courant.querySelectorAll(m[1] || "*")].filter((e) => e.textContent.replace(/\\s+/g, " ").includes(m[2].replace(/\\\\'/g, "'")))
                  : [...courant.querySelectorAll(s.trim())];
      } catch { liste = []; }
      const v = liste.find(visible);
      if (v) return v.closest("label") || v;
    }
    return null;
  };
  const estRond = (el) => { const r = el.getBoundingClientRect(); const b = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; return r.width > 0 && Math.abs(r.width - r.height) < 6 && b >= r.width / 2 - 2; };
  const formeDe = (c) => {
    if (estRond(c)) return c;
    const a = c.getBoundingClientRect().width * c.getBoundingClientRect().height;
    const ronds = [...c.querySelectorAll("*")].filter((x) => estRond(x) && x.getBoundingClientRect().width * x.getBoundingClientRect().height > a * 0.4);
    return ronds.sort((x, y) => y.getBoundingClientRect().width - x.getBoundingClientRect().width)[0] || c;
  };
  const cibleCourante = () => libre ? C.etapes.at(-1).cible : essai ? (essai.phase === "feuille" ? essai.x.applique : null) : C.etapes[rang].cible;
  const poserDoigt = () => {
    const c = cibleDe(cibleCourante());
    // Sans cible, la bulle se pose en bas, sauf quand l'étape dit ce qu'elle couvrirait.
    if (!c) { doigt.style.opacity = 0; guide.className = "v-guide " + (C.etapes[rang].bulleEnHaut && !essai ? "en-haut" : "en-bas") + (guide.classList.contains("en-retrait") ? " en-retrait" : ""); return null; }
    const r = c.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 220) c.scrollIntoView({ block: "center", behavior: "instant" });
    // Le doigt épouse la FORME du geste : un bouton qui porte un rond (la note
    // vocale) se cerne d'un rond, pas du carré de son libellé (sa capture du 20 novembre).
    const forme = formeDe(c);
    const q = forme.getBoundingClientRect();
    doigt.style.opacity = 1;
    const gauche = Math.max(2, q.left - 4), droite = Math.min(document.documentElement.clientWidth - 2, q.right + 4);
    doigt.style.left = gauche + "px"; doigt.style.top = q.top - 4 + "px";
    doigt.style.width = droite - gauche + "px"; doigt.style.height = q.height + 8 + "px";
    doigt.style.borderRadius = estRond(forme) ? "999px" : Math.min(999, Math.max(12, parseFloat(getComputedStyle(forme).borderRadius) || 12)) + "px";
    // Le guide ne cache jamais ce qu'il montre : on calcule où il tomberait en haut et en bas.
    const h = guide.offsetHeight, basHaut = 12 + h, hautBas = innerHeight - 84 - h;
    const couvreHaut = q.top < basHaut, couvreBas = q.bottom > hautBas;
    const enHaut = couvreBas && !couvreHaut ? true : couvreHaut && !couvreBas ? false : q.top + q.height / 2 > innerHeight * 0.52;
    const retrait = guide.classList.contains("en-retrait");
    guide.className = "v-guide " + (enHaut && innerWidth < 1024 ? "en-haut" : "en-bas") + (retrait ? " en-retrait" : "");
    return c;
  };
  const ecrire = (fini) => {
    const champs = [...courant.querySelectorAll("input")].filter((i) => i.value && i.type !== "hidden" && visible(i));
    const valeurs = champs.map((i) => i.value);
    champs.forEach((i) => (i.value = ""));
    let k = 0, j = 0;
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      if (k >= champs.length) { clearInterval(minuteur); fini(); return; }
      j++; champs[k].value = valeurs[k].slice(0, j);
      if (j >= valeurs[k].length) { k++; j = 0; }
    }, 38);
  };
  const dire = () => {
    const e = libre ? C.etapes.at(-1) : C.etapes[rang];
    guide.querySelector(".v-chez").hidden = e.chez !== "client";
    guide.querySelector("h2").textContent = e.titre;
    guide.querySelector(".v-dit").textContent = e.dit;
    const g = guide.querySelector(".v-geste"); g.textContent = e.geste || ""; g.hidden = !e.geste;
    guide.querySelector(".v-barre i").style.width = ((rang + 1) / C.etapes.length) * 100 + "%";
    guide.querySelector(".v-retour").hidden = rang === 0 && !libre;
    const s = guide.querySelector(".v-suivant");
    s.textContent = libre || rang === C.etapes.length - 1 ? "Recommencer" : e.cible ? "Passer" : "Suivant";
  };
  const aller = (n) => {
    essai = null; libre = false; rang = Math.max(0, Math.min(C.etapes.length - 1, n));
    const e = C.etapes[rang];
    montrer(e.etat);
    // Pendant que les champs s'écrivent, le guide se retire : il cachait ce qu'il
    // fallait regarder (sa capture du 20 novembre). Il revient une fois tout écrit.
    if (e.taper) {
      guide.classList.add("en-retrait"); doigt.style.opacity = 0;
      window.scrollTo(0, 0);
      ecrire(() => setTimeout(() => { guide.classList.remove("en-retrait"); poserDoigt(); }, 500));
    } else if (e.sansBulle) guide.classList.add("en-retrait");
    else guide.classList.remove("en-retrait");
    if (e.photo) { photo.classList.add("visible"); setTimeout(() => photo.classList.remove("visible"), 1300); }
    libre = !!e.libre;
    dire();
    if (!e.taper) requestAnimationFrame(() => requestAnimationFrame(poserDoigt));
  };
  const rubrique = (href) => {
    const nom = "r-" + href.replace(/^\\/reglages\\//, "").replace(/\\//g, "-");
    if (!ecrans.has(nom)) return false;
    montrer(nom, 0); doigt.style.opacity = 0;
    guide.className = "v-guide en-bas";
    guide.querySelector("h2").textContent = courant.querySelector("h1")?.textContent || "Réglages";
    guide.querySelector(".v-dit").textContent = nom === "r-idee" ? "Dictez ou écrivez votre idée : elle arrive chez nous, avec votre nom." : "Revenez aux Réglages avec la flèche, et ouvrez la rubrique suivante.";
    guide.querySelector(".v-geste").hidden = true;
    return true;
  };
  const parler = (titre, dit, geste) => {
    guide.querySelector("h2").textContent = titre;
    guide.querySelector(".v-dit").textContent = dit;
    const g = guide.querySelector(".v-geste"); g.textContent = geste || ""; g.hidden = !geste;
    guide.querySelector(".v-retour").hidden = false;
    guide.querySelector(".v-suivant").textContent = "Suivant";
  };
  const essayer = (x, phase) => {
    essai = { x, phase };
    montrer(phase === "feuille" ? x.feuille : x.pose);
    if (phase === "feuille") parler(x.titre, "Sa vraie feuille, telle que l'appli l'ouvre.", x.geste);
    else parler(x.titre, x.fait, "Retour pour essayer un autre bouton.");
    requestAnimationFrame(() => requestAnimationFrame(poserDoigt));
  };
  const finirEssai = () => { const r = rang; aller(r); };
  const secouer = () => { guide.classList.remove("secoue"); void guide.offsetWidth; guide.classList.add("secoue"); poserDoigt(); };

  document.addEventListener("click", (ev) => {
    if (ev.target.closest(".v-ouverture")) { document.querySelector(".v-ouverture").remove(); aller(0); return; }
    if (ev.target.closest(".v-suivant")) { if (libre || rang === C.etapes.length - 1) aller(0); else aller(rang + 1); return; }
    if (ev.target.closest(".v-retour")) { if (essai) finirEssai(); else if (courant?.dataset.ecran.startsWith("r-")) aller(C.etapes.length - 1); else aller(rang - 1); return; }
    if (ev.target.closest(".v-guide")) return;
    const el = ev.target.closest("a, button, label, input, [role=button], [data-atlas]");
    const lien = ev.target.closest("a");
    if (lien) ev.preventDefault();
    // Les Réglages, à la fin : chaque rubrique s'ouvre, la flèche ramène au sommaire.
    if (libre || courant?.dataset.ecran.startsWith("r-")) {
      const h = lien?.getAttribute("href") || "";
      if (h.startsWith("/reglages/") && rubrique(h)) return;
      if (courant?.dataset.ecran === "r-idee" && el?.textContent.includes("J'écris")) { montrer("r-idee-ecrite", 0); return; }
      if (h === "/reglages" || lien?.getAttribute("aria-label")?.startsWith("Retour")) { aller(C.etapes.length - 1); return; }
      if (el) secouer();
      return;
    }
    // Les boutons du devis : chacun s'essaie, sa feuille puis ce qu'il pose.
    const touche = (sel) => { const t = cibleDe(sel); return t && el && (t === el || t.contains(el) || el.contains(t)); };
    if (essai?.phase === "feuille") {
      ev.preventDefault();
      if (touche(essai.x.applique)) { essayer(essai.x, "pose"); return; }
      if (el && /Annuler/.test(el.textContent || "")) { finirEssai(); return; }
      if (el) { parler(essai.x.titre, "Dans l'appli, ce choix change le montant. Ici, touchez le bouton du bas.", essai.x.geste); poserDoigt(); }
      return;
    }
    if (essai?.phase === "pose") { if (el) { ev.preventDefault(); secouer(); } return; }
    if (C.etapes[rang].essais && el) {
      const x = C.essais[C.etapes[rang].essais].find((x) => touche(x.ouvre));
      if (x) { ev.preventDefault(); essayer(x, x.feuille ? "feuille" : "pose"); return; }
    }
    const c = cibleDe(C.etapes[rang].cible);
    if (c && el && (c === el || c.contains(el) || el.contains(c))) { ev.preventDefault(); aller(rang + 1); return; }
    if (el) { ev.preventDefault(); secouer(); }
  }, true);
  addEventListener("resize", () => poserDoigt());
  // Le doigt suit sa cible à chaque image : la page défile, mais aussi une feuille
  // dans la page (le calendrier de la date), et le défilement de la page seule
  // laissait le doigt en l'air au-dessus du bon jour (sa capture du 20 novembre).
  const suivre = () => {
    if (doigt.style.opacity === "1") {
      const c = cibleDe(cibleCourante());
      if (c) {
        const q = formeDe(c).getBoundingClientRect();
        const gauche = Math.max(2, q.left - 4), droite = Math.min(document.documentElement.clientWidth - 2, q.right + 4);
        doigt.style.left = gauche + "px"; doigt.style.top = q.top - 4 + "px";
        doigt.style.width = droite - gauche + "px"; doigt.style.height = q.height + 8 + "px";
      }
    }
    requestAnimationFrame(suivre);
  };
  requestAnimationFrame(suivre);
  // Lu par le parcours de vérification : quels boutons s'essaient, et où.
  window.visite = { etapes: C.etapes, essais: C.essais, etape: () => rang };
  montrer(C.etapes[0].etat); dire();
})();
`;

const html = `<!doctype html><html lang="fr" style="${premier.styleHtml}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f5f3ee">
<title>Visite de Cause</title>
<style>${css}</style><style>${STYLE}</style></head>
<body class="${premier.classeBody}">
${blocs}
<div class="v-calque"><div class="v-doigt" style="opacity:0"></div></div>
<section class="v-guide en-bas" aria-live="polite">
  <span class="v-chez" hidden>Chez votre client</span>
  <h2></h2><p class="v-dit"></p><p class="v-geste"></p>
  <div class="v-pied"><button type="button" class="v-retour">Retour</button><div class="v-barre"><i></i></div><button type="button" class="v-suivant">Suivant</button></div>
</section>
<div class="v-photo" aria-hidden="true"><img alt="" src="${ticket}"></div>
<div class="v-ouverture" role="dialog" aria-label="Visite de Cause"><div>
  <small>Visite guidée</small>
  <h1>Cause, d'un devis à votre comptable</h1>
  <p>Les vrais écrans de l'application. Les clients, les chiffres et la banque sont inventés.</p>
  <button type="button">Commencer</button>
</div></div>
<script>${SCRIPT}</script>
</body></html>`;
writeFileSync(SORTIE, html);
console.log("écrit", SORTIE, Math.round(html.length / 1024), "Ko,", ETAPES.length, "étapes,", RUBRIQUES.length, "rubriques");
