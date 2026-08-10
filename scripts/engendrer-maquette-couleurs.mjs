#!/usr/bin/env node
/*
  Écrit `docs/maquettes/11-ecran-retenu-seize-couleurs.html` : le premier écran
  de la maquette 09 — « le trait seul » — dans les seize chartes.

  Pourquoi ce script existe, et pourquoi la page qu'il produit n'a AUCUN script.

  Les maquettes 10 et 11 engendraient leurs écrans en JavaScript, depuis un
  gabarit cloné. C'est plus sûr à écrire — aucune mesure ne peut diverger d'un
  écran à l'autre — mais le patron n'a rien pu ouvrir : *« Je ne peux pas
  ouvrir ça »*, trois fois. La maquette 09, elle, s'est affichée du premier
  coup sur son téléphone, et c'est la seule différence entre les deux : 09 est
  du HTML pur, sans une ligne de script. Son lecteur n'exécute pas les scripts.

  La garantie de non-divergence est donc déplacée : elle passe du navigateur à
  ce script. Les seize écrans sont écrits ICI, une fois, à partir d'un seul
  patron de balisage — puis déposés en clair dans la page. Le patron reçoit du
  HTML mort, qui s'ouvre partout ; nous gardons l'assurance qu'aucune mesure
  ne peut varier d'une charte à l'autre.

  Ne pas modifier la page à la main : rejouer
  `node scripts/engendrer-maquette-couleurs.mjs`.
*/

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CIBLE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "maquettes",
  "11-ecran-retenu-seize-couleurs.html",
);

// Cinq teintes par charte au lieu de trois : le patron a demandé plus de
// couleur. La cinquième — « attente » — ne colore que les états qui réclament
// un geste de lui. C'est la seule couleur de l'écran qui veuille dire quelque
// chose ; sans cette règle, ajouter des teintes rend l'écran bavard.
const FAMILLES = [
  {
    nom: "Celles que nous avons déjà vues",
    chartes: [
      {
        nom: "Origine",
        texte:
          "Vos couleurs actuelles : gris-vert, or, et le vert pin gardé pour l’action. Le repère — c’est ce que vous connaissez.",
        jetons: { fond: "#edece6", plage: "#f7f6f2", encre: "#16170f", gris: "#83867c", bronze: "#8f7130",
                  trait: "rgba(22,23,15,.12)", plein: "#2a3a2e", pleinEncre: "#f2f1ea", signe: "#c2a05f", attente: "#8f7130" },
      },
      {
        nom: "Pierre",
        texte:
          "Gris légèrement vert, encre presque noire, sauge désaturée. Aucun or. La plus intemporelle : elle ne datera pas parce qu’elle ne suit rien.",
        jetons: { fond: "#e8e8e3", plage: "#f4f4f0", encre: "#1b1d19", gris: "#83867c", bronze: "#6f8466",
                  trait: "rgba(27,29,25,.13)", plein: "#1b1d19", pleinEncre: "#f4f4f0", signe: "#8b9d83", attente: "#6f8466" },
      },
      {
        nom: "Brume",
        texte:
          "Gris froid presque bleu, vert profond en action. Le registre des parfumeries : clinique, net, cher.",
        jetons: { fond: "#eaedec", plage: "#f6f8f7", encre: "#14191a", gris: "#7c8688", bronze: "#1f4a44",
                  trait: "rgba(20,25,26,.13)", plein: "#1f4a44", pleinEncre: "#f0f5f3", signe: "#8fb3a9", attente: "#1f4a44" },
      },
      {
        nom: "Ivoire",
        texte:
          "Le registre exact d’Aman — celui de l’écran que vous avez retenu. Lisible dehors, en plein soleil.",
        jetons: { fond: "#efece6", plage: "#f6f4ef", encre: "#221f1a", gris: "#8b8478", bronze: "#8a7452",
                  trait: "rgba(34,31,26,.13)", plein: "#221f1a", pleinEncre: "#f2efe8", signe: "#b8a17a", attente: "#8a7452" },
      },
      {
        nom: "Nuit",
        texte:
          "Noir chaud, laiton doux, et l’action qui s’inverse en plage claire. La plus spectaculaire — et la moins lisible au soleil.",
        jetons: { fond: "#101210", plage: "#1a1d19", encre: "#e9e8de", gris: "#84887b", bronze: "#c6a15b",
                  trait: "rgba(233,232,222,.14)", plein: "#e9e8de", pleinEncre: "#101210", signe: "#8a7452", attente: "#c6a15b" },
      },
      {
        nom: "Sylve",
        texte:
          "Le vert profond passe du bouton au FOND. Un écran de paysagiste qui assume sa couleur au lieu de la réduire à un accent.",
        jetons: { fond: "#16241c", plage: "#1e3026", encre: "#e6e6da", gris: "#8ba189", bronze: "#c3b184",
                  trait: "rgba(230,230,218,.14)", plein: "#e6e6da", pleinEncre: "#16241c", signe: "#3f5c46", attente: "#c3b184" },
      },
      {
        nom: "Beurre",
        texte:
          "Le jaune beurre, très pâle, donne une chaleur qu’aucun crème n’atteint — sans virer au kraft.",
        jetons: { fond: "#efe7cf", plage: "#f8f3e4", encre: "#26221a", gris: "#8b8368", bronze: "#8a6a3a",
                  trait: "rgba(38,34,26,.12)", plein: "#26221a", pleinEncre: "#f8f3e4", signe: "#d8b877", attente: "#8a6a3a" },
      },
      {
        nom: "Moka",
        texte:
          "Un moka laiteux, une encre espresso, une argile pour l’accent : chaud sans être rustique.",
        jetons: { fond: "#e6ded5", plage: "#f2ece5", encre: "#2b241e", gris: "#8d8175", bronze: "#7c5c46",
                  trait: "rgba(43,36,30,.12)", plein: "#2b241e", pleinEncre: "#f2ece5", signe: "#c2a184", attente: "#7c5c46" },
      },
      {
        nom: "Ardoise",
        texte:
          "Un gris-bleu froid, réchauffé par un sable. Le contraste froid/chaud est ce qui rend une interface chère aujourd’hui — plus qu’un or.",
        jetons: { fond: "#e6e9ec", plage: "#f2f4f6", encre: "#1a222c", gris: "#7d858f", bronze: "#8f7a5c",
                  trait: "rgba(26,34,44,.12)", plein: "#1a222c", pleinEncre: "#f2f4f6", signe: "#c3aa85", attente: "#8f7a5c" },
      },
    ],
  },
  {
    nom: "Les plus colorées — jusqu’à cinq teintes",
    chartes: [
      {
        nom: "Verger",
        texte:
          "Un vert de feuille franche pour l’action, un abricot pour le signe, un orange soutenu pour ce qui vous attend.",
        jetons: { fond: "#eef2e4", plage: "#f8fbf1", encre: "#17240f", gris: "#7d8a6e", bronze: "#4f7a2a",
                  trait: "rgba(23,36,15,.13)", plein: "#2f5d16", pleinEncre: "#f2f7ea", signe: "#f0a860", attente: "#d9722c" },
      },
      {
        nom: "Argile",
        texte:
          "Terre cuite pour l’action, sable pour le signe, olive pour l’attente. Trois familles de couleur qui ne se disputent pas.",
        jetons: { fond: "#f2e9e1", plage: "#faf3ec", encre: "#2a1c14", gris: "#907c6c", bronze: "#b4552d",
                  trait: "rgba(42,28,20,.12)", plein: "#8a3c1c", pleinEncre: "#fbf2e9", signe: "#e0b27a", attente: "#6d7a3a" },
      },
      {
        nom: "Lagune",
        texte:
          "Turquoise profond et corail : le couple le plus vif de la page, et pourtant lisible, parce que le corail ne sert qu’à deux endroits.",
        jetons: { fond: "#e4eeec", plage: "#f1f8f6", encre: "#0e2224", gris: "#6f8a88", bronze: "#0f6e6a",
                  trait: "rgba(14,34,36,.12)", plein: "#0f6e6a", pleinEncre: "#eefaf7", signe: "#f0a58c", attente: "#e2643c" },
      },
      {
        nom: "Prune",
        texte:
          "Aubergine, rose poudré, cuivre. La plus habillée des seize — celle qui ressemble le moins à un outil, ce qui peut être le but.",
        jetons: { fond: "#efe6ea", plage: "#f9f2f5", encre: "#23131c", gris: "#8c7481", bronze: "#7a2f52",
                  trait: "rgba(35,19,28,.12)", plein: "#4a1832", pleinEncre: "#f8eef3", signe: "#d9a0b4", attente: "#c2603f" },
      },
      {
        nom: "Agrume",
        texte:
          "Jaune franc sur encre presque noire, avec un vert pour l’attente. Le contraste le plus fort : celle qui se lit le mieux en plein soleil.",
        jetons: { fond: "#f4efd8", plage: "#fbf8e8", encre: "#1e2016", gris: "#8a8768", bronze: "#a5740a",
                  trait: "rgba(30,32,22,.13)", plein: "#1e2016", pleinEncre: "#fbf8e8", signe: "#f2c53d", attente: "#4f7a2a" },
      },
      {
        nom: "Océan",
        texte:
          "Bleu franc pour l’action, cuivre pour le signe, brique pour l’attente. Le bleu est la couleur qu’aucun de vos confrères n’emploie.",
        jetons: { fond: "#e6ecf2", plage: "#f3f7fb", encre: "#0d1b2c", gris: "#74839a", bronze: "#1e4f86",
                  trait: "rgba(13,27,44,.12)", plein: "#123253", pleinEncre: "#eef4fa", signe: "#d98f4e", attente: "#c25a3a" },
      },
      {
        nom: "Braise",
        texte:
          "La seule sombre du lot coloré : brun de bois brûlé, orange de feu, blé pour l’attente. À regarder le soir, pas sur un chantier à midi.",
        jetons: { fond: "#1c1512", plage: "#271d18", encre: "#f0e6dc", gris: "#9a8578", bronze: "#e08b3c",
                  trait: "rgba(240,230,220,.15)", plein: "#f0e6dc", pleinEncre: "#1c1512", signe: "#b4552d", attente: "#e0b45a" },
      },
    ],
  },
];

// Le patron de balisage : écrit UNE fois, déposé seize fois. C'est ici, et
// nulle part ailleurs, que se joue la promesse « rien ne change sauf la
// couleur » — la page produite, elle, n'a plus rien pour la tenir.
function ecran(jetons) {
  const couleurs = [
    `--e-fond:${jetons.fond}`,
    `--e-plage:${jetons.plage}`,
    `--e-encre:${jetons.encre}`,
    `--e-gris:${jetons.gris}`,
    `--e-bronze:${jetons.bronze}`,
    `--e-trait:${jetons.trait}`,
    `--e-plein:${jetons.plein}`,
    `--e-plein-encre:${jetons.pleinEncre}`,
    `--e-plein-signe:${jetons.signe}`,
    `--e-attente:${jetons.attente}`,
  ].join(";");

  return `      <div class="tel"><div class="ecran" style="${couleurs}">
        <div class="enseigne">ATLAS</div>
        <div class="regle"></div>

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

        <p class="rubrique caps">En cours</p>

        <a class="bloc" href="#">
          <span class="etat caps">Brouillon</span>
          <span class="quand caps num">26 juil.</span>
          <p class="nom serif">Pose de clôture</p>
          <p class="lieu">2 route de Vertou, Vertou</p>
          <span class="cpt caps num">Sans photo</span>
        </a>
        <a class="bloc" href="#">
          <span class="etat caps">À vérifier</span>
          <span class="quand caps num">24 juil.</span>
          <p class="nom serif">Rénovation salle de bain</p>
          <p class="lieu">12 rue des Lilas, Nantes</p>
          <span class="cpt caps num">6 photos</span>
        </a>
        <a class="bloc" href="#">
          <span class="etat caps attend">Devis retourné</span>
          <span class="quand caps num">22 juil.</span>
          <p class="nom serif">Terrasse bois</p>
          <p class="lieu">5 allée des Tilleuls, Nantes</p>
          <span class="cpt caps num">3 photos</span>
        </a>

        <nav class="bas">
          <a class="on caps" href="#">Chantiers</a>
          <a class="caps" href="#">Planning</a>
          <a class="caps" href="#">Terminés</a>
          <a class="caps" href="#">Réglages</a>
        </nav>
      </div></div>`;
}

function charte(c, rang) {
  const j = c.jetons;
  const pastilles = [j.fond, j.encre, j.bronze, j.signe, j.attente]
    .map((teinte) => `<i style="background:${teinte}"></i>`)
    .join("");

  return `    <div class="prop">
${ecran(j)}
      <div class="legende">
        <h2><span class="rang num">${String(rang).padStart(2, "0")}</span> ${c.nom}</h2>
        <div class="nuancier">${pastilles}</div>
        <p>${c.texte}</p>
      </div>
    </div>`;
}

let rang = 0;
const corps = FAMILLES.map(
  (f) => `  <p class="famille"><span>${f.nom}</span></p>

  <div class="chartes">
${f.chartes.map((c) => charte(c, ++rang)).join("\n\n")}
  </div>`,
).join("\n\n");

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas — l'écran retenu, seize couleurs</title>
</head>
<body>
<style>
  /*
    L'écran retenu — « le trait seul » de la maquette 09 — dans seize chartes.

    AUCUN SCRIPT, délibérément. Les versions précédentes clonaient un gabarit
    en JavaScript ; le patron n'a rien pu ouvrir, trois fois de suite, tandis
    que la maquette 09 — du HTML pur — s'affichait du premier coup sur son
    téléphone. Son lecteur n'exécute pas les scripts.

    Les seize écrans sont donc déposés en clair. La garantie qu'aucune mesure
    ne diverge d'une charte à l'autre est tenue par le script qui écrit cette
    page, pas par la page elle-même :
    « node scripts/engendrer-maquette-couleurs.mjs ».
    Ne pas modifier ce fichier à la main.

    Les mesures sont celles de la maquette 09, au pixel : 390 px de large,
    corps à 16 px, titre à 40 px. Une version à 300 px avait été essayée pour
    en poser quatre par rangée — illisible sur son écran.
  */
  :root{ --fond:#efece6; --plage:#f6f4ef; --encre:#221f1a; --gris:#8b8478; --bronze:#8a7452; --trait:rgba(34,31,26,.13); }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){ --fond:#171613; --plage:#1e1c18; --encre:#e9e5dc; --gris:#8a867c; --bronze:#b39b72; --trait:rgba(233,229,220,.16); }
  }
  :root[data-theme="dark"]{ --fond:#171613; --plage:#1e1c18; --encre:#e9e5dc; --gris:#8a867c; --bronze:#b39b72; --trait:rgba(233,229,220,.16); }

  *{box-sizing:border-box}
  body{margin:0;background:var(--fond);color:var(--encre);
       font:16px/1.65 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;padding:44px 16px 84px}
  .page{max-width:1440px;margin:0 auto}
  .intro{max-width:60ch;margin:0 auto 10px;text-align:center}
  .intro .sur{margin:0 0 16px;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--bronze)}
  .intro h1{margin:0 0 14px;font:400 30px/1.25 ui-serif,Georgia,"Iowan Old Style",serif;letter-spacing:-.01em}
  .intro p{margin:0;color:var(--gris);font-size:15px}

  .famille{margin:52px 0 28px;text-align:center;font-size:10px;letter-spacing:.3em;
           text-transform:uppercase;color:var(--gris)}
  .famille span{position:relative;display:inline-block;padding:0 20px;background:var(--fond)}
  .famille span::before,.famille span::after{content:"";position:absolute;top:50%;width:60px;height:1px;background:var(--trait)}
  .famille span::before{right:100%}
  .famille span::after{left:100%}

  .chartes{display:flex;flex-wrap:wrap;gap:58px 40px;justify-content:center;align-items:flex-start}
  .prop{display:flex;flex-direction:column;align-items:center;gap:18px;width:390px;max-width:100%}
  .legende{text-align:center}
  .legende h2{margin:0 0 8px;font:400 11px/1 ui-sans-serif,sans-serif;letter-spacing:.3em;
              text-transform:uppercase;color:var(--bronze)}
  .legende .rang{margin-right:6px;color:var(--gris);letter-spacing:.14em}
  .nuancier{display:flex;gap:5px;justify-content:center;margin:0 0 9px}
  .nuancier i{width:12px;height:12px;border-radius:99px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)}
  .legende p{margin:0;font-size:13.5px;color:var(--gris);line-height:1.6}

  .tel{width:390px;max-width:100%;border-radius:44px;padding:11px;background:#cfccc4;
       box-shadow:0 1px 3px rgba(20,18,14,.16),0 30px 66px rgba(20,18,14,.22)}
  .ecran{overflow:hidden;border-radius:34px;height:816px;display:flex;flex-direction:column;
         background:var(--e-fond);color:var(--e-encre);
         font:16px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
  .serif{font-family:ui-serif,Georgia,"Iowan Old Style","Palatino Linotype",serif}
  .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
  .caps{text-transform:uppercase;letter-spacing:.28em;font-size:9.5px;font-weight:500}

  .enseigne{padding:26px 0 18px;text-align:center;font-size:11px;letter-spacing:.52em}
  .regle{height:1px;background:var(--e-trait)}

  .titre{padding:42px 22px 0}
  .titre .salut{margin:0;color:var(--e-bronze)}
  .titre h1{margin:16px 0 0;font-size:40px;line-height:1.02;font-weight:400;letter-spacing:-.018em}
  .titre .compte{margin:16px 0 0;color:var(--e-gris)}

  /* Le trait des maquettes « colonne » : il ferme l'en-tête, en retrait de
     16 px comme les plages — de bord à bord il couperait l'écran en deux. */
  .fermeture{height:1px;background:var(--e-trait);margin:30px 16px 0}

  .action{display:flex;align-items:center;justify-content:space-between;gap:16px;
          margin:26px 16px 0;padding:20px 22px;border-radius:6px;text-decoration:none;
          background:var(--e-plein);color:var(--e-plein-encre)}
  .action .quoi{display:block;font-size:19px;line-height:1.1}
  .action .plus{font-size:19px;line-height:1;color:var(--e-plein-signe)}

  .rubrique{margin:40px 22px 12px;color:var(--e-gris)}

  .bloc{display:grid;grid-template-columns:1fr auto;gap:0 16px;margin:0 16px 6px;padding:18px 20px;
        border-radius:6px;background:var(--e-plage);text-decoration:none;color:inherit}
  .etat{grid-column:1;color:var(--e-gris)}
  /* La seule couleur qui veut dire quelque chose : un geste vous attend. */
  .etat.attend{color:var(--e-attente)}
  .quand{grid-column:2;grid-row:1;text-align:right;color:var(--e-gris)}
  .nom{grid-column:1;margin:11px 0 0;font-size:21px;line-height:1.14;font-weight:400}
  .lieu{grid-column:1;margin:5px 0 0;font-size:12.5px;color:var(--e-gris)}
  .cpt{grid-column:2;grid-row:3;align-self:end;text-align:right;color:var(--e-gris)}

  /* Le pied d'Aman : un cheveu au-dessus, l'onglet actif souligné de bronze. */
  .bas{margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);
       border-top:1px solid var(--e-trait);padding:18px 14px 30px}
  .bas a{text-align:center;text-decoration:none;color:var(--e-gris);padding-bottom:8px}
  .bas a.on{color:var(--e-encre);box-shadow:inset 0 -1px 0 var(--e-bronze)}
</style>

<div class="page">
  <div class="intro">
    <p class="sur">L’écran retenu — seize couleurs</p>
    <h1>Le trait seul, dans les seize chartes</h1>
    <p>Exactement l’écran que vous avez gardé, seize fois : ni une marge, ni un filet, ni un corps de texte ne changent d’une charte à l’autre. Ce que vous comparez, c’est la couleur, et elle seule.</p>
  </div>

${corps}
</div>
</body>
</html>
`;

writeFileSync(CIBLE, page);
console.log(`${rang} chartes écrites en HTML pur → ${CIBLE} (${(page.length / 1024).toFixed(0)} Ko)`);
