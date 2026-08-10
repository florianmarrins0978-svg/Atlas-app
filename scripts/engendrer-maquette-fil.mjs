#!/usr/bin/env node
/*
  Écrit `docs/maquettes/13-le-fil-quatre-couleurs.html`.

  L'écran aminci de la maquette 12, en quatre chartes, et sous ses trois
  formes : le fil, l'ourlet, la plage amincie.

  Deux consignes du patron sont tenues ici, et elles comptent plus que le
  reste :

  1. **Plus de cheveu sous ATLAS.** Le trait qui séparait le nom du « Bonjour
     Florian » disparaît. Celui qui ferme l'en-tête, juste au-dessus de
     « Nouveau chantier », reste — c'est lui qu'il avait demandé.
  2. **Aucun script dans la page.** Son lecteur n'en exécute pas : la
     maquette 09, du HTML pur, s'est ouverte du premier coup sur son téléphone
     quand les pages engendrées en JavaScript lui arrivaient vides.

  La garantie « rien ne diverge d'un écran à l'autre » se tient donc ici, dans
  ce script, et non dans la page. Ne pas modifier la page à la main : rejouer
  `node scripts/engendrer-maquette-fil.mjs`.
*/

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CIBLE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "maquettes",
  "13-le-fil-quatre-couleurs.html",
);

// Quatre chartes qui couvrent tout l'écart : ce qu'il connaît, le registre
// d'Aman, le vert assumé en fond, et une couleur qu'aucun de ses confrères
// n'emploie. En prendre plus reviendrait à ne rien trancher.
const CHARTES = [
  {
    nom: "Origine",
    texte: "Vos couleurs actuelles : gris-vert, or, vert pin pour l’action. Le repère.",
    jetons: { fond: "#edece6", plage: "#f7f6f2", encre: "#16170f", gris: "#83867c", bronze: "#8f7130",
              trait: "rgba(22,23,15,.13)", traitDoux: "rgba(22,23,15,.07)",
              plein: "#2a3a2e", pleinEncre: "#f2f1ea", signe: "#c2a05f", attente: "#8f7130" },
  },
  {
    nom: "Ivoire",
    texte: "Le registre d’Aman : ivoire chaud, encre presque noire, bronze mat. Lisible en plein soleil.",
    jetons: { fond: "#efece6", plage: "#f6f4ef", encre: "#221f1a", gris: "#8b8478", bronze: "#8a7452",
              trait: "rgba(34,31,26,.13)", traitDoux: "rgba(34,31,26,.07)",
              plein: "#221f1a", pleinEncre: "#f2efe8", signe: "#b8a17a", attente: "#8a7452" },
  },
  {
    nom: "Sylve",
    texte: "Le vert profond passe du bouton au fond. Un écran de paysagiste qui assume sa couleur.",
    jetons: { fond: "#16241c", plage: "#1e3026", encre: "#e6e6da", gris: "#8ba189", bronze: "#c3b184",
              trait: "rgba(230,230,218,.15)", traitDoux: "rgba(230,230,218,.08)",
              plein: "#e6e6da", pleinEncre: "#16241c", signe: "#3f5c46", attente: "#c3b184" },
  },
  {
    nom: "Océan",
    texte: "Bleu franc pour l’action, cuivre pour le signe, brique pour l’attente. Le bleu, personne ne l’emploie.",
    jetons: { fond: "#e6ecf2", plage: "#f3f7fb", encre: "#0d1b2c", gris: "#74839a", bronze: "#1e4f86",
              trait: "rgba(13,27,44,.13)", traitDoux: "rgba(13,27,44,.07)",
              plein: "#123253", pleinEncre: "#eef4fa", signe: "#d98f4e", attente: "#c25a3a" },
  },
];

const CHANTIERS = [
  { jour: "26", mois: "juil.", nom: "Pose de clôture", lieu: "2 route de Vertou, Vertou", etat: "Brouillon · sans photo", attend: false },
  { jour: "24", mois: "juil.", nom: "Rénovation salle de bain", lieu: "12 rue des Lilas, Nantes", etat: "À vérifier · 6 photos", attend: false },
  { jour: "22", mois: "juil.", nom: "Terrasse bois", lieu: "5 allée des Tilleuls, Nantes", etat: "Devis retourné · 3 photos", attend: true },
  { jour: "18", mois: "juil.", nom: "Reprise de toiture", lieu: "8 impasse du Moulin, Rezé", etat: "En attente · 9 photos", attend: false },
];

const FORMES = [
  {
    classe: "fil",
    nom: "Le fil",
    texte:
      "Plus aucune boîte. Un trait vertical traverse la liste et porte les jours, comme une tige. Une seule perle s’y pose — sur le chantier qui attend votre réponse.",
  },
  {
    classe: "ourlet",
    nom: "L’ourlet",
    texte:
      "La plage se réduit à un cheveu vertical, qui prend la couleur d’attente uniquement là où un geste vous est dû.",
  },
  {
    classe: "plage",
    nom: "La plage amincie",
    texte:
      "La plage reste, mais resserrée : 26 px des bords, 12 px de hauteur intérieure, rayon de 4 px.",
  },
];

// L'en-tête, écrit une fois. Le cheveu sous ATLAS a disparu — c'est la seule
// chose que le patron ait explicitement refusée dans la version précédente.
// Celui qui ferme l'en-tête reste : il l'avait demandé.
const entete = `        <div class="enseigne">ATLAS</div>

        <div class="titre">
          <p class="salut caps">Bonjour Florian</p>
          <h1 class="serif">Vos chantiers</h1>
          <p class="compte caps num">Quatre en cours</p>
        </div>

        <div class="fermeture"></div>

        <a class="action" href="#">
          <span class="quoi serif">Nouveau chantier</span>
          <span class="plus">+</span>
        </a>

        <div class="rubrique caps"><span>En cours</span><span class="num">Quatre</span></div>`;

const pied = `        <nav class="bas">
          <a class="on caps" href="#">Chantiers</a>
          <a class="caps" href="#">Planning</a>
          <a class="caps" href="#">Terminés</a>
          <a class="caps" href="#">Réglages</a>
        </nav>`;

function liste(forme) {
  if (forme === "fil") {
    const brins = CHANTIERS.map(
      (c) => `            <a class="brin${c.attend ? " attend" : ""}" href="#">
              <span class="jour caps num"><b>${c.jour}</b><span>${c.mois}</span></span>
              <p class="nom serif">${c.nom}</p>
              <p class="lieu">${c.lieu}</p>
              <p class="etat caps${c.attend ? " attend" : ""}">${c.etat}</p>
            </a>`,
    ).join("\n");
    return `        <div class="tige">\n${brins}\n        </div>`;
  }

  return CHANTIERS.map(
    (c) => `        <a class="bloc${c.attend ? " attend" : ""}" href="#">
          <span class="quand caps num">${c.jour} ${c.mois}</span>
          <p class="nom serif">${c.nom}</p>
          <p class="lieu">${c.lieu}</p>
          <p class="etat caps${c.attend ? " attend" : ""}">${c.etat}</p>
        </a>`,
  ).join("\n");
}

function ecran(charte, forme) {
  const j = charte.jetons;
  const couleurs = [
    `--e-fond:${j.fond}`,
    `--e-plage:${j.plage}`,
    `--e-encre:${j.encre}`,
    `--e-gris:${j.gris}`,
    `--e-bronze:${j.bronze}`,
    `--e-trait:${j.trait}`,
    `--e-trait-doux:${j.traitDoux}`,
    `--e-plein:${j.plein}`,
    `--e-plein-encre:${j.pleinEncre}`,
    `--e-signe:${j.signe}`,
    `--e-attente:${j.attente}`,
  ].join(";");

  return `    <div class="prop">
      <div class="tel"><div class="ecran ${forme}" style="${couleurs}">
${entete}

${liste(forme)}

${pied}
      </div></div>
      <p class="sous">${charte.nom}</p>
    </div>`;
}

const sections = FORMES.map(
  (f) => `  <div class="forme">
    <p class="famille"><span>${f.nom}</span></p>
    <p class="dit">${f.texte}</p>
  </div>

  <div class="rangee">
${CHARTES.map((c) => ecran(c, f.classe)).join("\n\n")}
  </div>`,
).join("\n\n");

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas — le fil, en quatre couleurs</title>
</head>
<body>
<style>
  /*
    L'écran aminci, en quatre chartes et sous trois formes.

    Deux choses à ne pas défaire :

    — PAS de cheveu sous ATLAS. Le patron l'a refusé explicitement. Celui qui
      ferme l'en-tête, au-dessus de « Nouveau chantier », reste : c'est lui
      qu'il avait demandé.
    — AUCUN script. Son lecteur n'en exécute pas ; les pages engendrées en
      JavaScript lui arrivaient vides. Cette page est écrite par
      « node scripts/engendrer-maquette-fil.mjs » — ne pas la modifier à la
      main.
  */
  :root{ --fond:#edece6; --plage:#f7f6f2; --encre:#16170f; --gris:#83867c; --bronze:#8f7130; --trait:rgba(22,23,15,.12); }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){ --fond:#141510; --plage:#1c1e17; --encre:#e8e7dd; --gris:#8a8c80; --bronze:#c2a05f; --trait:rgba(232,231,221,.15); }
  }
  :root[data-theme="dark"]{ --fond:#141510; --plage:#1c1e17; --encre:#e8e7dd; --gris:#8a8c80; --bronze:#c2a05f; --trait:rgba(232,231,221,.15); }

  *{box-sizing:border-box}
  body{margin:0;background:var(--fond);color:var(--encre);
       font:16px/1.65 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;padding:44px 16px 84px}
  .page{max-width:1400px;margin:0 auto}
  .intro{max-width:60ch;margin:0 auto 12px;text-align:center}
  .intro .sur{margin:0 0 16px;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--bronze)}
  .intro h1{margin:0 0 14px;font:400 30px/1.25 ui-serif,Georgia,"Iowan Old Style",serif;letter-spacing:-.01em}
  .intro p{margin:0;color:var(--gris);font-size:15px}

  .famille{margin:56px 0 12px;text-align:center;font-size:10px;letter-spacing:.3em;
           text-transform:uppercase;color:var(--gris)}
  .famille span{position:relative;display:inline-block;padding:0 20px;background:var(--fond)}
  .famille span::before,.famille span::after{content:"";position:absolute;top:50%;width:60px;height:1px;background:var(--trait)}
  .famille span::before{right:100%}
  .famille span::after{left:100%}
  .dit{max-width:56ch;margin:0 auto 30px;text-align:center;font-size:13.5px;color:var(--gris);line-height:1.6}

  .rangee{display:flex;flex-wrap:wrap;gap:44px 36px;justify-content:center;align-items:flex-start}
  .prop{display:flex;flex-direction:column;align-items:center;gap:14px;width:390px;max-width:100%}
  .sous{margin:0;font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--bronze)}

  .tel{width:390px;max-width:100%;border-radius:44px;padding:11px;background:#cfccc4;
       box-shadow:0 1px 3px rgba(20,18,14,.16),0 30px 66px rgba(20,18,14,.22)}
  .ecran{overflow:hidden;border-radius:34px;height:816px;display:flex;flex-direction:column;
         background:var(--e-fond);color:var(--e-encre);
         font:16px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
  .serif{font-family:ui-serif,Georgia,"Iowan Old Style","Palatino Linotype",serif}
  .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
  .caps{text-transform:uppercase;letter-spacing:.28em;font-size:9.5px;font-weight:500}

  /* ── L'en-tête : le nom seul, sans rien dessous ───────────────────────── */
  .enseigne{padding:30px 0 0;text-align:center;font-size:11px;letter-spacing:.52em}
  .titre{padding:52px 26px 0}
  .titre .salut{margin:0;color:var(--e-bronze)}
  .titre h1{margin:16px 0 0;font-size:40px;line-height:1.02;font-weight:400;letter-spacing:-.018em}
  .titre .compte{margin:16px 0 0;color:var(--e-gris)}

  /* Le seul trait de l'en-tête : celui qui le ferme. */
  .fermeture{height:1px;background:var(--e-trait);margin:30px 26px 0}

  .action{display:flex;align-items:center;justify-content:space-between;gap:16px;
          margin:24px 26px 0;padding:16px 20px;border-radius:5px;text-decoration:none;
          background:var(--e-plein);color:var(--e-plein-encre)}
  .action .quoi{display:block;font-size:18px;line-height:1.1}
  .action .plus{font-size:18px;line-height:1;color:var(--e-signe)}

  .rubrique{display:flex;justify-content:space-between;margin:32px 26px 12px;color:var(--e-gris)}

  /* ── Les trois formes de liste ────────────────────────────────────────── */
  .plage .bloc,.ourlet .bloc{display:grid;grid-template-columns:1fr auto;gap:0 14px;
                             text-decoration:none;color:inherit}
  .plage .bloc{margin:0 26px 4px;padding:12px 15px;border-radius:4px;background:var(--e-plage)}
  .ourlet .bloc{margin:0 26px;padding:14px 0 14px 15px;border-left:1px solid var(--e-trait)}
  /* Le cheveu prend la couleur d'attente UNIQUEMENT là où un geste est dû :
     la couleur ne décore pas, elle désigne. */
  .ourlet .bloc.attend{border-left-color:var(--e-attente)}
  .plage .nom,.ourlet .nom{grid-column:1;margin:0;font-size:19px;line-height:1.15;font-weight:400}
  .plage .lieu,.ourlet .lieu{grid-column:1;margin:3px 0 0;font-size:11.5px;color:var(--e-gris)}
  .plage .quand,.ourlet .quand{grid-column:2;grid-row:1;text-align:right;color:var(--e-gris);padding-top:4px}
  .plage .etat,.ourlet .etat{grid-column:1;margin:7px 0 0;color:var(--e-gris)}
  .plage .etat.attend,.ourlet .etat.attend{color:var(--e-attente)}

  .fil .tige{position:relative;margin:0 26px}
  .fil .tige::before{content:"";position:absolute;left:47px;top:10px;bottom:10px;
                     width:1px;background:var(--e-trait)}
  .fil .brin{position:relative;display:grid;grid-template-columns:47px 1fr;gap:0 26px;
             padding:15px 0;text-decoration:none;color:inherit}
  .fil .jour{grid-row:1 / span 3;text-align:right;padding-right:13px;color:var(--e-gris)}
  .fil .jour b{display:block;font-weight:400;font-size:19px;line-height:1;color:var(--e-encre);
               font-family:ui-serif,Georgia,serif}
  .fil .jour span{display:block;margin-top:4px}
  .fil .nom{margin:0;font-size:19px;line-height:1.15;font-weight:400}
  .fil .lieu{margin:3px 0 0;font-size:11.5px;color:var(--e-gris)}
  .fil .etat{margin:7px 0 0;color:var(--e-gris)}
  .fil .etat.attend{color:var(--e-attente)}
  /* La perle sur le fil : le seul point de couleur de l'écran, et il ne se
     pose que sur ce qui attend une réponse. */
  .fil .brin.attend::after{content:"";position:absolute;left:44px;top:21px;
                           width:7px;height:7px;border-radius:99px;
                           background:var(--e-attente);box-shadow:0 0 0 4px var(--e-fond)}

  /* ── Le pied d'Aman ───────────────────────────────────────────────────── */
  .bas{margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);
       border-top:1px solid var(--e-trait);padding:18px 14px 30px}
  .bas a{text-align:center;text-decoration:none;color:var(--e-gris);padding-bottom:8px}
  .bas a.on{color:var(--e-encre);box-shadow:inset 0 -1px 0 var(--e-bronze)}
</style>

<div class="page">
  <div class="intro">
    <p class="sur">Le fil — quatre couleurs</p>
    <h1>Sans le trait sous ATLAS</h1>
    <p>Le cheveu qui séparait le nom du « Bonjour Florian » a disparu : le haut respire d’un seul tenant jusqu’au trait qui ferme l’en-tête. Tout le reste est celui que vous venez de garder.</p>
  </div>

${sections}
</div>
</body>
</html>
`;

writeFileSync(CIBLE, page);
console.log(
  `${FORMES.length} formes × ${CHARTES.length} chartes = ${FORMES.length * CHARTES.length} écrans, en HTML pur → ${CIBLE} (${(page.length / 1024).toFixed(0)} Ko)`,
);
