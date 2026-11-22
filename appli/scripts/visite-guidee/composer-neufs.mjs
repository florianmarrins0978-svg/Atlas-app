// Pose dans `appli/visite-guidee.html` les écrans que `figer-neufs.mjs` a figés :
// les règles de style qui leur manquent, les écrans eux-mêmes (remplacés s'ils
// y sont déjà), et leurs étapes. Se rejoue sans rien doubler : les étapes
// qu'il pose portent `neuf`, et il les retire avant de les reposer.
//   node appli/scripts/visite-guidee/composer-neufs.mjs <dossier de ecrans.json>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lancer } from "../../../scripts/planche-figee/figer.mjs";

const ici = path.dirname(fileURLToPath(import.meta.url));
const VISITE = path.join(ici, "../../visite-guidee.html");
const ecrans = JSON.parse(readFileSync(path.join(process.argv[2], "ecrans.json"), "utf8"));
let s = readFileSync(VISITE, "utf8");

// ── 1. Les règles de style que les écrans neufs emploient et que la visite n'a pas ──
const debutCss = s.indexOf("<style>") + 7;
const finCss = s.indexOf("</style>");
const nav = await lancer();
const page = await nav.newPage();
const manquantes = await page.evaluate(([tete, autres]) => {
  // Une règle se compare avec la chaîne de ses enveloppes (@layer, @media, @supports) :
  // comparer les blocs entiers déclarerait manquante toute une couche pour une classe en plus.
  const feuilles = (css) => {
    const f = new CSSStyleSheet();
    f.replaceSync(css.replace(/@import[^;]+;/g, ""));
    const out = [];
    const parcourir = (regles, chaine) => {
      for (const r of regles) {
        if (r.cssRules && !(r instanceof CSSKeyframesRule)) parcourir(r.cssRules, [...chaine, r.cssText.slice(0, r.cssText.indexOf("{")).trim()]);
        else out.push({ chaine, texte: r.cssText });
      }
    };
    parcourir(f.cssRules, []);
    return out;
  };
  const connues = new Set(feuilles(tete).map((r) => r.chaine.join("|") + "|" + r.texte));
  const vues = new Set();
  const neuves = [];
  for (const css of autres) for (const r of feuilles(css)) {
    const cle = r.chaine.join("|") + "|" + r.texte;
    if (connues.has(cle) || vues.has(cle)) continue;
    vues.add(cle);
    neuves.push(r.chaine.map((h) => h + "{").join("") + r.texte + "}".repeat(r.chaine.length));
  }
  return neuves;
}, [s.slice(debutCss, finCss), ecrans.map((e) => e.css)]);
await nav.close();
s = s.replace(/<style data-visite="neufs">[\s\S]*?<\/style>/, "");
s = s.replace("</head>", `<style data-visite="neufs">${manquantes.join("\n")}</style></head>`);
console.log(`${manquantes.length} règles de style ajoutées`);

// ── 2. Les écrans : remplacés s'ils y sont, posés avant le guide sinon ──
// Une même page de PDF revient sur les cinq écrans de l'aperçu (les conditions
// générales, le formulaire, l'attestation) : écrite cinq fois, elle pesait un
// mégaoctet et demi de plus à charger sur un téléphone. Elle ne s'écrit qu'une fois ; les
// autres écrans la reprennent au chargement (le guide, « data-visite-meme »).
const images = new Map();
for (const e of ecrans) {
  e.html = e.html.replace(/<img([^>]*?) src="(data:image\/[a-z]+;base64,[^"]{20000,})"/g, (tout, avant, url) => {
    if (!images.has(url)) { images.set(url, createHash("sha1").update(url).digest("hex").slice(0, 12)); return `<img${avant} data-visite-image="${images.get(url)}" src="${url}"`; }
    return `<img${avant} data-visite-meme="${images.get(url)}"`;
  });
}
let lignes = s.split("\n");
const noms = new Set(ecrans.map((e) => e.nom));
// Des fiches de véhicules d'un essai d'avant (autres identifiants) ne doivent pas rester.
lignes = lignes.filter((l) => { const m = l.match(/^<div class="visite-ecran" data-ecran="(r-vehicules-[^"]+)"/); return !m || noms.has(m[1]); });
for (const e of ecrans) {
  // L'exemple « 06 12 34 56 78 » des champs peut appartenir à quelqu'un (docs/visite-guidee.md).
  // UN écran, UNE ligne : la visite se compose ligne à ligne, et un écran sur
  // plusieurs lignes (« Mon message au client » en porte 23) laissait ses restes
  // hors de toute enveloppe, visibles par-dessus la visite. Dans le texte, « &#10; »
  // se relit en retour à la ligne : rien ne change à l'écran.
  // Dans une feuille de style posée dans l'écran (« L'allure de mes devis »), une
  // entité ne se relit pas : là, le retour à la ligne devient une espace.
  const html = e.html
    .replace(/06 12 34 56 78/g, "06 39 98 00 00")
    .split(/(<style[\s>][\s\S]*?<\/style>)/)
    .map((morceau, k) => (k % 2 ? morceau.replace(/\r?\n/g, " ") : morceau.replace(/\r?\n/g, "&#10;")))
    .join("");
  const ligne = `<div class="visite-ecran" data-ecran="${e.nom}" data-defile="${e.defile}" hidden>${html}</div>`;
  const k = lignes.findIndex((l) => l.startsWith(`<div class="visite-ecran" data-ecran="${e.nom}" `));
  if (k >= 0) lignes[k] = ligne;
  else lignes.splice(lignes.findIndex((l) => l.startsWith('<div class="v-calque">')), 0, ligne);
}
s = lignes.join("\n");

// ── 3. Les étapes ──
const debutC = s.indexOf("  const C = ");
const finC = s.indexOf("\n", debutC);
const C = JSON.parse(s.slice(debutC + "  const C = ".length, finC).replace(/;$/, ""));
C.etapes = C.etapes.filter((e) => !e.neuf);
const camion = ecrans.find((e) => e.nom.startsWith("r-vehicules-") && e.html.includes("Camion benne")).nom;
// L'ordre des repères du croquis, celui de `donnees.ts` : chacun allume son outil en apparaissant.
const ORDRE_DU_CROQUIS = ["limite", "voie", "acces", "maison", "tailler", "danger", "crayon", "stockage", "reseau", "secours"];
const fiche = [
  { etat: "24e-fiche-croquis", titre: "Le croquis", geste: "Touchez Modifier le croquis.", dit: "Obligatoire : l'accès, la voie, les arbres à traiter.", cible: '[data-atlas="modifier-le-croquis"]', voir: '[data-atlas="apercu-du-croquis"]' },
  { etat: "24f-croquis-editeur", titre: "Il se dessine au doigt.", dit: "Un outil, puis un appui sur le dessin : la maison, l'arbre, la zone de danger, les secours.", dessiner: ORDRE_DU_CROQUIS, bulleEnHaut: true },
  { etat: "24g-fiche-signee", titre: "Signée", geste: "Touchez Ouvrir le PDF.", dit: "Par vous et par l'équipe. « Envoyer au client » la lui fait partir.", cible: '[data-atlas="ouvrir-le-pdf-de-la-fiche"]', voir: '[data-atlas="envoyer-client"]' },
  { etat: "24h-fiche-pdf", titre: "Ce que reçoit votre client.", dit: "La fiche, son croquis et les signatures, en PDF." },
].map((e) => ({ ...e, neuf: true }));
const vehicules = [
  { etat: "50-reglages", titre: "Vos véhicules", geste: "Touchez Véhicules.", dit: "Cause vous prévient avant le contrôle technique et l'anti-pollution.", cible: 'a[href="/reglages/vehicules"]', chapitre: true },
  { etat: "r-vehicules", titre: "Vos véhicules", geste: "Touchez le Camion benne.", dit: "Entrés une fois : la plaque, et la date de chaque contrôle.", cible: '[data-atlas="vehicule"]:has-text("Camion benne")' },
  { etat: camion, titre: "Contrôle technique avant le 3 décembre.", dit: "Deux mois avant, Cause vous prévient. À quinze jours, en ambre." },
  { etat: "v-accueil-rappels", titre: "Le rappel, sur l'accueil.", dit: "En rouge une fois la date passée. « J'ai vu » le range.", regard: '[data-atlas="rappel-vehicule"]' },
].map((e) => ({ ...e, neuf: true }));
// L'aperçu du devis : sa demande du 22 novembre, « expliquer aussi qu'on peut faire
// des sauts de ligne et des sauts de page ». L'étape d'origine fait toucher une ligne
// au lieu de revenir ; c'est la dernière des nouvelles qui ramène au devis.
Object.assign(C.etapes.find((e) => e.etat === "12-apercu-pdf" && !e.neuf), {
  titre: "Le PDF", dit: "Tel que votre client le recevra.", geste: "Touchez l'élagage du tilleul.", cible: '[data-atlas="ligne-a-couper"]:nth-child(4)',
});
const apercu = [
  { etat: "12b-apercu-ligne", titre: "Une nouvelle page", geste: "Touchez Nouvelle page.", dit: "Le tilleul commencera la page 2.", cible: '[data-atlas="nouvelle-page-ici"]' },
  { etat: "12c-apercu-nouvelle-page", titre: "Le tilleul passe en page 2.", geste: "Touchez le ramassage.", dit: "Maintenant, une ligne blanche.", cible: '[data-atlas="ligne-a-couper"]:nth-child(3)', voir: '[data-atlas="saut-de-page"]' },
  { etat: "12d-apercu-ligne-2", titre: "Un espace", geste: "Touchez Un espace ici.", dit: "Pour aérer avant le ramassage.", cible: '[data-atlas="un-espace-ici"]' },
  { etat: "12e-apercu-espace", titre: "Votre PDF, à votre main.", geste: "Revenez au devis.", dit: "Tout remettre efface vos choix.", cible: 'a[aria-label="Retour"]', voir: '[data-atlas="espace-pose"]' },
].map((e) => ({ ...e, neuf: true }));
C.etapes.splice(C.etapes.findIndex((e) => e.etat === "12-apercu-pdf") + 1, 0, ...apercu);
const apresDecret = C.etapes.findIndex((e) => e.etat === "24c-fiche-decret") + 1;
C.etapes.splice(apresDecret, 0, ...fiche);
C.etapes.splice(C.etapes.findIndex((e) => e.libre), 0, ...vehicules);
// Les travaux en plus de la facture : chaque bouton s'essaie (« sur la facture, je peux
// pas ajouter un travail ou un règlement reçu », 22 novembre). Ouverts depuis l'écran
// des travaux en plus (`depuis`), ils y ramènent : Annuler, ou retirer ce qu'ils ont posé.
const ENPLUS = "27-travaux-en-plus";
C.essais.facture = C.essais.facture.filter((x) => !x.neuf);
// `voir` : ce que l'écran posé doit montrer en arrivant. Sans lui, la visite se calait sur
// le premier bouton à essayer, Facture acquittée, tout en bas : les boutons des travaux en
// plus et la ligne ajoutée restaient au-dessus, hors de l'écran (vu le 22 novembre).
Object.assign(C.essais.facture.find((x) => x.pose === ENPLUS), {
  fait: "Ce qui s'ajoute sur place, et ce qu'il a déjà réglé. Touchez un bouton.",
  voir: ['[data-atlas="categorie-supplement"]', '[data-atlas="poser-reglement"]'],
});
const LIGNE = '[data-atlas="ligne-supplement"]';
C.essais.facture.push(...[
  { ouvre: '[data-atlas="ajouter-ligne-supplement"]', pose: "27-travail-ajoute", defait: '[data-atlas="retirer-supplement"]', titre: "Un travail en plus", fait: "Le dessouchage, ajouté sur place : le total passe à 1 026 €.", voir: [LIGNE, '[data-atlas="ajouter-tva-supplement"]'] },
  { ouvre: '[data-atlas="poser-main-doeuvre"]', feuille: "27-main-doeuvre-feuille", pose: "27-main-doeuvre-pose", applique: 'button:has-text("Ajouter la main")', defait: '[data-atlas="retirer-main-doeuvre"], [data-atlas="retirer-supplement"]', titre: "La main d'œuvre", geste: "Touchez Ajouter la main d'œuvre.", fait: "Les hommes, les jours, votre tarif : la ligne s'ajoute.", voir: [LIGNE, '[data-atlas="montant-main-doeuvre"]'] },
  { ouvre: '[data-atlas="ajouter-tva-supplement"]', feuille: "27-tva-feuille", pose: "27-tva-pose", applique: 'button:has-text("Ajouter la TVA")', titre: "Un autre taux", geste: "Touchez Ajouter la TVA.", fait: "Ce qui s'ajoute peut prendre un autre taux.", voir: [LIGNE, '[data-atlas="ajouter-tva-supplement"]'] },
  { ouvre: '[data-atlas="poser-reglement"]', pose: "27-reglement-recu", defait: '[data-atlas="retirer-reglement"]', titre: "Un règlement reçu", fait: "300 € d'acompte par virement : il reste 624 € à payer.", voir: ['[data-atlas="total-ttc"]', '[data-atlas="net-a-payer"]'] },
].map((x) => ({ ...x, depuis: ENPLUS, neuf: true })));
// La fiche d'intervention ouvre son chapitre : le planning en comptait quatorze.
C.etapes.find((e) => e.etat === "24-planning-fiche").chapitre = true;
// Les portes des Réglages qui ne sont pas sous /reglages, et ce que dit le guide dans une rubrique.
// Celles qui mènent hors des Réglages ouvrent l'écran que la visite a déjà montré.
C.portes = {
  "/catalogue": "r-catalogue",
  "/documents/pdf?fichier=%2Fapi%2Ffactures%2Fexemple%2Fpdf&de=Exemple&titre=La+facture": "r-exemple-facture",
  "/termines/comptable": "41-comptable", "/termines": "25-termines", "/planning": "20-planning", "/": "01-accueil",
};
// Ce qui n'ouvre pas d'écran : le guide dit ce que ça ferait.
C.sansEcran = [
  { debut: "/api/mes-donnees", dit: "Dans l'appli, ce bouton télécharge toutes vos données, en un fichier." },
  { debut: "?mois=", dit: "Dans l'appli, ces flèches passent d'un mois à l'autre." },
];
delete C.telechargements;
// Ce que ces scripts ont posé : `figer-neufs.mjs` le refige au passage suivant.
C.ecransNeufs = ecrans.map((e) => e.nom);
C.textesDesRubriques = { "r-vehicules": "Entrez vos véhicules : Cause vous prévient avant le contrôle technique et l'anti-pollution." };
s = s.slice(0, debutC) + "  const C = " + JSON.stringify(C) + ";" + s.slice(finC);

writeFileSync(VISITE, s);
console.log(`${ecrans.length} écrans posés, ${C.etapes.length} étapes`);
