// Compose « L'essai avec la carte » : le modèle A du site (sa validation du
// 23 novembre 2026), dans l'appli. Les écrans qui existent sont les VRAIS,
// figés par `appli/scripts/parcours-inscription/figer.mjs` : les conditions,
// « C'est fait », l'accueil. Ceux qui n'existent pas encore (l'essai, la carte,
// la carte refusée, le retour sans carte) se posent dans la même page, avec
// les mêmes classes que « C'est fait », pour qu'il les reconnaisse. Usage :
//   node appli/scripts/essai-avec-carte/composer.mjs <dossier de figer.mjs> <sortie.html>
//
// La page de la carte n'imite pas celle de Stripe : elle dit ce qui s'y tape
// et ce qui est annoncé, dans un dessin à nous, et le nom du prestataire.
import { readFileSync } from "node:fs";
import { composer } from "../../../scripts/planche-figee/composer.mjs";
import { enHauteurStable } from "../_hauteur-stable.mjs";

const [S, SORTIE] = process.argv.slice(2);
const lire = (f) => JSON.parse(readFileSync(`${S}/${f}`, "utf8"));
const conditions = lire("17-conditions.json");
const pret = lire("18-pret.json");
const accueil = lire("19-accueil.json");

// Un écran neuf, dans le moule de « C'est fait » : son haut et son bas changent.
const HAUT = '<div class="flex-1 overflow-y-auto pb-4 pt-[30px]">';
const BAS = '<div class="flex-shrink-0 pb-1 pt-2">';
const debut = pret.html.slice(0, pret.html.indexOf(HAUT) + HAUT.length);
const ecran = (haut, bas) => ({ ...pret, html: `${debut}${haut}</div>${BAS}${bas}</div></div></div></main>` });

const SERIF = 'style="font-family: ui-serif, Georgia, serif;"';
const DOUX = 'style="color: var(--atlas-inkSoft, #4a4a44);"';
const titre = (t) => `<h1 class="text-[30px] leading-[1.12] tracking-[-0.01em]" ${SERIF}>${t}</h1>`;
const phrase = (t, marge = "mt-2") => `<p class="${marge} text-[15.5px] leading-[1.45]" ${DOUX}>${t}</p>`;
const ligne = (premier, intitule, valeur, sous, extra = "") =>
  `<div class="py-[13px]"${premier ? "" : ' style="box-shadow: inset 0 1px 0 var(--atlas-line, rgba(28,28,26,0.12));"'}>` +
  `<dt class="text-[14px] font-semibold" ${DOUX}>${intitule}</dt><dd class="m-0">` +
  `<span class="mt-[3px] block text-[18px] leading-[1.3]" ${SERIF}>${valeur}</span>` +
  (sous ? `<span class="mt-1 block text-[13.5px] leading-[1.4]" ${DOUX}>${sous}</span>` : "") +
  extra + `</dd></div>`;
const releve = (lignes) => `<dl class="mt-[18px] rounded-[14px] px-[18px]" style="background-color: var(--atlas-card, #faf9f5);">${lignes.join("")}</dl>`;
// Sa demande du 24 novembre : le chemin pour résilier, dessiné, pour être
// transparent. Les mots de l'appli : l'onglet « Réglages », l'écran
// « Abonnement », le bouton « Résilier » (rouge, comme `AbonnementClient`).
const chemin = () =>
  `<div class="ec-chemin" data-dit="Dans l'appli : Réglages, en bas ; puis Abonnement ; puis « Résilier », en rouge.">` +
  `<span class="ec-pas">Réglages</span><span class="ec-trait"></span>` +
  `<span class="ec-pas">Abonnement</span><span class="ec-trait"></span>` +
  `<span class="ec-pas ec-rouge">Résilier</span></div>`;
const plein = (mot, va, dit = "") =>
  `<button type="button" class="flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold" style="background: var(--atlas-plein, #7d9a6d); color: var(--atlas-card, #faf9f5);" data-va="${va}"${dit ? ` data-dit="${dit}"` : ""}>${mot}</button>`;
const discret = (mot, attrs) =>
  `<button type="button" class="mt-1 flex min-h-[48px] w-full items-center justify-center text-[15.5px] font-semibold" ${DOUX} ${attrs}>${mot}</button>`;

// L'exemple : Artisan avec les outils, choisis sur le site, le 24 novembre.
const M = {
  formule: "Artisan", prixFormule: "39 € HT par mois", outils: "6 € HT par mois",
  fin: "9 décembre 2026", finCourt: "9 décembre", total: "45 € HT par mois", ttc: "54 € TTC",
};

const essai = ecran(
  titre("Votre essai.") +
    phrase("15 jours pour tout essayer. Rien n’est débité aujourd’hui.") +
    releve([
      ligne(true, "Votre formule", M.formule, M.prixFormule,
        `<button type="button" class="ec-changer" data-dit="Dans l'appli : rouvre le choix de la formule, celui du site.">Changer</button>`),
      ligne(false, "Les outils de paysage", "Ajoutés", M.outils),
      ligne(false, "Aujourd’hui", "0 €", ""),
      ligne(false, "Premier prélèvement", `Le ${M.fin}`, `${M.total}, soit ${M.ttc}, puis chaque mois`),
    ]) +
    // Sa demande du 24 novembre : dire comment arrêter, pour ne pas effrayer.
    // La phrase garde sa place ; le chemin est celui de l'appli (Réglages,
    // Abonnement, « Résilier », `AbonnementClient.tsx`).
    phrase(`Arrêtez avant le ${M.finCourt} : vous ne payez rien. Il suffit de toucher « Résilier » dans Réglages, Abonnement.`, "mt-[14px]") +
    chemin(),
  plein("Ajouter ma carte", "paiement") + discret("Plus tard", 'data-va="sans-carte" data-dit="Dans l\'appli : la session se ferme, et la prochaine ouverture redemande la carte."'),
);

// La page de la carte, chez le prestataire : un dessin à nous, clair, comme
// une page de paiement, et ce qu'elle annonce.
const champ = (lib, val, attrs = "") =>
  `<label class="pp-champ" ${attrs}><span class="pp-lib">${lib}</span><span class="pp-val">${val}</span></label>`;
const pagePaiement = (refus) => ({
  ...pret,
  html:
    `<main class="pp"><div class="pp-col">` +
    `<p class="pp-chez">Page de paiement sécurisée de Stripe</p>` +
    `<p class="pp-qui">Cause</p>` +
    `<p class="pp-essai">Essai gratuit de 15 jours</p>` +
    `<p class="pp-montant">0,00 €<span> aujourd’hui</span></p>` +
    `<p class="pp-puis">Puis ${M.ttc} par mois à partir du ${M.fin}</p>` +
    `<div class="pp-form">` +
    champ("E-mail", "jean.moreau@exemple.fr") +
    champ("Numéro de carte", refus ? "" : "4970 1012 3456 7890", 'data-dit="Ici, l\'artisan tape sa carte. La planche la montre remplie."') +
    `<div class="pp-deux">${champ("Expiration", refus ? "" : "08 / 29")}${champ("Code", refus ? "" : "123")}</div>` +
    champ("Titulaire de la carte", "Jean Moreau") +
    (refus ? `<p class="pp-refus" role="alert">Votre carte a été refusée. Essayez une autre carte.</p>` : "") +
    `<button type="button" class="pp-ok" data-va="pret" data-dit="Rien n'est débité : la carte est seulement enregistrée pour le ${M.finCourt}.">Enregistrer ma carte</button>` +
    (refus ? "" : `<button type="button" class="pp-lien" data-va="refusee">Voir une carte refusée</button>`) +
    `</div>` +
    `<button type="button" class="pp-lien" data-va="essai">Retour à Cause</button>` +
    `</div></main>`,
});

const sansCarte = ecran(
  titre("Il manque votre carte.") +
    phrase(`Votre essai démarre dès qu’elle est enregistrée. Rien n’est débité avant 15 jours. Pour arrêter avant, touchez « Résilier » dans Réglages, Abonnement.`) +
    chemin() +
    releve([ligne(true, "Votre formule", `${M.formule} avec les outils`, M.total)]),
  plein("Ajouter ma carte", "paiement") + discret("Se déconnecter", 'data-dit="Dans l\'appli : ferme la session."'),
);

const rappel = {
  ...pret,
  html:
    `<main class="ml"><div class="ml-col">` +
    `<p class="ml-quand">Reçu le 6 décembre, trois jours avant le premier prélèvement</p>` +
    `<div class="ml-carte">` +
    `<p class="ml-de">Cause</p>` +
    `<p class="ml-objet">Votre essai se termine le ${M.finCourt}</p>` +
    `<p>Bonjour Jean,</p>` +
    `<p>Votre essai de Cause se termine le ${M.finCourt}. Ce jour-là, ${M.ttc} seront prélevés pour ${M.formule} avec les outils, puis chaque mois.</p>` +
    `<p>Pour continuer, vous n’avez rien à faire.</p>` +
    `<p>Pour arrêter sans rien payer, touchez « Résilier » dans Réglages, Abonnement, avant le ${M.finCourt}.</p>` +
    `<p>Florian, pour Cause</p>` +
    `</div></div></main>`,
};

const etats = [
  { nom: "conditions", etape: "conditions", corps: conditions },
  { nom: "essai", etape: "essai", corps: essai },
  { nom: "paiement", etape: "paiement", corps: pagePaiement(false) },
  { nom: "refusee", etape: "refusee", corps: pagePaiement(true) },
  { nom: "pret", etape: "pret", corps: pret },
  { nom: "accueil", etape: "accueil", corps: accueil },
  { nom: "sans-carte", etape: "sans-carte", corps: sansCarte },
  { nom: "rappel", etape: "rappel", corps: rappel },
].map((e) => ({ ...e, corps: { ...e.corps, html: enHauteurStable(e.corps.html) } }));

const ETAPES = [
  { va: "conditions", mot: "Les conditions" },
  { va: "essai", mot: "L'essai" },
  { va: "paiement", mot: "La carte" },
  { va: "refusee", mot: "Refusée" },
  { va: "pret", mot: "C'est fait" },
  { va: "accueil", mot: "L'appli" },
  { va: "sans-carte", mot: "Sans carte" },
  { va: "rappel", mot: "Le rappel" },
];

const retouches = (etat, d) => {
  const mot = (b) => (b.textContent || "").replace(/\s+/g, " ").trim();
  etat("conditions").querySelectorAll("button, a").forEach((b) => {
    if (mot(b) === "Accepter") b.dataset.va = "essai";
    if (mot(b) === "Se déconnecter") b.dataset.dit = "Dans l'appli : ferme la session sans accepter.";
  });
  // « C'est fait » : l'essai s'y lit en tête, et le téléphone avec son zéro,
  // comme l'appli l'écrit depuis le 24 novembre.
  const p = etat("pret");
  const dl = p.querySelector('[data-atlas="recapitulatif"]');
  const tete = document.createElement("div");
  tete.className = "py-[13px]";
  tete.innerHTML = `<dt class="text-[14px] font-semibold" style="color: var(--atlas-inkSoft, #4a4a44);">Votre essai</dt><dd class="m-0"><span class="mt-[3px] block text-[18px] leading-[1.3]" style="font-family: ui-serif, Georgia, serif;">Jusqu’au ${d.m.finCourt}</span><span class="mt-1 block text-[13.5px] leading-[1.4]" style="color: var(--atlas-inkSoft, #4a4a44);">Carte enregistrée. Puis ${d.m.total}.</span></dd>`;
  const premier = dl.firstElementChild;
  premier.style.boxShadow = "inset 0 1px 0 var(--atlas-line, rgba(28,28,26,0.12))";
  dl.insertBefore(tete, premier);
  const marcheur = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  while (marcheur.nextNode()) if (marcheur.currentNode.nodeValue === "6 39 98 00 00") marcheur.currentNode.nodeValue = "06 39 98 00 00";
  p.querySelectorAll("a, button").forEach((b) => { if (mot(b) === "Entrer dans Cause") { b.dataset.va = "accueil"; b.removeAttribute("href"); } });
  // L'accueil : ses gestes sont ceux de l'appli, la planche s'arrête ici.
  etat("accueil").querySelectorAll("a, button").forEach((b) => {
    if (!b.dataset.va && !b.dataset.dit) b.dataset.dit = "Dans l'appli : ouvre cet écran. La planche s'arrête à l'accueil.";
  });
};

const css = enHauteurStable(readFileSync(`${S}/css.txt`, "utf8")) + `
.ec-changer{display:inline-flex;align-items:center;min-height:44px;margin-top:2px;padding:0;border:0;background:none;font:inherit;font-size:15px;font-weight:600;color:var(--atlas-or,#B98B47);cursor:pointer}
.ec-chemin{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:12px;cursor:default}
.ec-pas{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background-color:var(--atlas-card,#faf9f5);box-shadow:inset 0 0 0 1px var(--atlas-line,rgba(28,28,26,0.12));font-size:14.5px;font-weight:600;color:var(--atlas-ink,#1c1c1a)}
.ec-rouge{color:var(--atlas-alerte,#da8c81)}
.ec-trait{display:inline-block;width:12px;height:1px;background:var(--atlas-chevron,rgba(233,232,222,0.28))}
.ml{min-height:100svh;background:#f4f3ef;color:#1c1c1a;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:28px 18px 40px}
.ml-col{max-width:440px;margin:0 auto}
.ml-quand{margin:0 0 12px;font-size:13px;font-weight:600;color:#6a6a62}
.ml-carte{padding:20px 18px;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06),0 4px 14px rgba(0,0,0,.05);font-size:15.5px;line-height:1.5}
.ml-carte p{margin:0 0 12px}
.ml-de{font-size:13px;font-weight:600;color:#6a6a62}
.ml-objet{font-size:18px;font-weight:700;line-height:1.3}
.pp{min-height:100svh;background:#f6f7f9;color:#1a1f36;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:28px 20px 40px}
.pp-col{max-width:420px;margin:0 auto}
.pp-chez{margin:0 0 18px;font-size:13px;font-weight:600;color:#5b6170}
.pp-qui{margin:0;font-size:17px;font-weight:600}
.pp-essai{margin:14px 0 0;font-size:15px;color:#5b6170}
.pp-montant{margin:4px 0 0;font-size:34px;font-weight:700;letter-spacing:-0.01em}
.pp-montant span{font-size:16px;font-weight:500;color:#5b6170}
.pp-puis{margin:4px 0 0;font-size:15px;color:#5b6170}
.pp-form{margin-top:24px;padding:18px;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(26,31,54,.08),0 4px 14px rgba(26,31,54,.06)}
.pp-champ{display:block;margin-bottom:12px;cursor:default}
.pp-lib{display:block;font-size:13px;font-weight:600;color:#5b6170;margin-bottom:5px}
.pp-val{display:block;min-height:46px;line-height:46px;padding:0 12px;border-radius:8px;box-shadow:inset 0 0 0 1px #d5d9e0;font-size:16px;color:#1a1f36;background:#fff}
.pp-deux{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pp-refus{margin:2px 0 12px;font-size:14.5px;font-weight:600;color:#c0392b}
.pp-ok{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:6px;border:0;border-radius:10px;background:#1a1f36;color:#fff;font:inherit;font-size:16.5px;font-weight:600;cursor:pointer}
.pp-lien{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;margin-top:6px;border:0;background:none;font:inherit;font-size:15px;font-weight:600;color:#5b6170;cursor:pointer}
`;

const taille = await composer({
  css,
  etats,
  etapes: ETAPES,
  titre: "L'essai avec la carte",
  surtitre: "Planche, les vrais écrans",
  retouches,
  donnees: { m: M },
  sortie: SORTIE,
});
console.log("écrit", SORTIE, taille);
