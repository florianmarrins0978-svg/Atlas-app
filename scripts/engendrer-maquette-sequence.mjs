#!/usr/bin/env node
/*
  Écrit `docs/maquettes/43-l-attente-a-lessai.html` — la planche que le patron
  MANIPULE : il appuie sur le micro, parle, rappuie, et les points se mettent à
  bouger. La séquence entière, comme sous son doigt.

  **Sa demande du 13 août 2026 :** *« Créez-moi une maquette dynamique en HTML,
  juste des points que je puisse cliquer dessus, enfin le dictaphone, puis je
  l'arrête et les points se mettent à bouger pour voir comment ça rend. »*

  ─── Pourquoi un script qui ÉCRIT la page, plutôt qu'une page écrite ─────────

  Deux raisons, et aucune n'est un confort :

  1. **La page livrée ne doit contenir AUCUN script.** C'est la vraie cause de
     « je ne peux pas ouvrir ça », répété trois fois : son lecteur n'exécute pas
     le JavaScript, et les maquettes qui engendraient leurs écrans lui
     arrivaient vides. La garantie « rien ne diverge d'un téléphone à l'autre »
     se tient donc ICI, dans le script qui écrit — jamais dans la page. Même
     choix que `engendrer-maquette-couleurs.mjs`.
  2. **Six téléphones identiques à un détail près.** Recopiés à la main, ils
     divergent au troisième ; et une planche dont les écrans diffèrent par
     autre chose que le geste comparé ne compare plus rien.

  ─── Comment trois états tiennent sans une ligne de script ──────────────────

  Trois boutons radio par téléphone, et des étiquettes qui pointent vers le
  SUIVANT : appuyer sur le micro coche « j'écoute », appuyer sur l'arrêt coche
  « je traite ». Les règles sont écrites en `:nth-of-type` plutôt que par
  identifiant, pour qu'elles vaillent pour les six sans être recopiées six fois.

  Usage : node scripts/engendrer-maquette-sequence.mjs [sortie.html]
*/

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "43-l-attente-a-lessai.html"),
);

/**
 * Les six téléphones. `avant` est celui d'aujourd'hui : il ne bouge pas, et
 * c'est exactement ce qu'il faut pouvoir comparer — sans lui, cinq gestes se
 * comparent entre eux et personne ne mesure le chemin parcouru.
 */
const VARIANTES = [
  {
    lettre: "0",
    nom: "L'avant",
    resume: "Ce qu'il y a aujourd'hui : le caractère « … », un seul signe posé là. Immobile, et sans un mot.",
    avant: true,
  },
  {
    lettre: "A",
    nom: "La vague",
    resume: "Les points montent et redescendent l'un après l'autre, de 4 px. Tout reste dans le rond.",
  },
  {
    lettre: "B",
    nom: "La vague ample",
    resume: "La même, 7 px et plus lente, la lumière montant avec elle. La houle plutôt que le clapot.",
  },
  {
    lettre: "C",
    nom: "Le souffle",
    resume: "Ils ne se déplacent pas : ils enflent et se rétractent. Rien ne sort du rond.",
  },
  {
    lettre: "D",
    nom: "Le point qui court",
    resume: "Trois points pâles, un quatrième fait la navette. Le seul qui montre un trajet.",
  },
  {
    lettre: "E",
    nom: "L'anneau qui tourne",
    resume: "Un cheveu d'or fait le tour du bouton. Le geste de l'anneau de la note vocale, déjà dans l'application.",
  },
];

const MICRO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3"/>
            <path d="M5 11a7 7 0 0 0 14 0" stroke-linecap="round"/>
            <path d="M12 18v3" stroke-linecap="round"/>
          </svg>`;

/** Le carré d'arrêt — le vocabulaire universel de « ça enregistre, touchez pour arrêter ». */
const ARRET = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="2.5"/>
          </svg>`;

const CHAMPS = [
  ["Nom du client (facultatif)", "Martins"],
  ["Téléphone (facultatif)", "06 79 98 45 14"],
  ["E-mail (facultatif)", "florian.martins0978@laposte.net"],
];

const telephone = ({ lettre, nom, resume, avant }) => {
  const id = (etat) => `e${lettre}-${etat}`;
  const points = avant
    ? `<span class="glyphe">…</span>`
    : `<i class="pt"></i><i class="pt"></i><i class="pt"></i>${lettre === "D" ? '<i class="curseur"></i>' : ""}`;

  return `
    <figure>
      <div class="tel"><section class="ecran" data-variante="${lettre}">
        <input type="radio" name="etat-${lettre}" id="${id("repos")}" class="etat" checked>
        <input type="radio" name="etat-${lettre}" id="${id("ecoute")}" class="etat">
        <input type="radio" name="etat-${lettre}" id="${id("traite")}" class="etat">
        <div class="corps">
          <p class="marque">A T L A S</p>
          <div class="retour" aria-hidden="true">‹</div>
          <div class="tete">
            <div>
              <p class="surtitre">Nouveau</p>
              <h2 class="titre">Un chantier</h2>
            </div>
            <div class="colonne">
              <label class="micro repos" for="${id("ecoute")}" data-geste="parler"
                     title="Dicter les informations du client">${MICRO}</label>
              <label class="micro ecoute" for="${id("traite")}" data-geste="arreter"
                     title="Arrêter la dictée">${ARRET}</label>
              <span class="micro traite" data-geste="attendre">
                <span class="anneau"></span>
                <span class="points">${points}</span>
                <span class="signe-fini">${MICRO}</span>
              </span>
              <p class="mot">
                <span class="m-repos">Touchez pour dicter.</span>
                <span class="m-ecoute">J'écoute — touchez pour arrêter.</span>
                <span class="m-traite">${avant ? "" : "Atlas rédige…"}</span>
                <span class="m-fini">3 informations reprises — relisez avant de créer.</span>
              </p>
            </div>
          </div>
          <div class="champs">
            ${CHAMPS.map(
              ([etiquette, valeur]) => `<p class="etiquette">${etiquette}</p>
            <div class="plage"><span class="valeur">${valeur}</span></div>`,
            ).join("\n            ")}
          </div>
          <label class="recommencer" for="${id("repos")}">Recommencer</label>
        </div>
      </section></div>
      <figcaption>
        <span class="chapeau">${lettre === "0" ? "" : lettre + " · "}${nom}</span>
        ${resume}
      </figcaption>
    </figure>`;
};

const PAGE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas — l'attente, à l'essai</title>
</head>
<body>
<style>
  /*
    ⚠ CETTE PAGE EST ENGENDRÉE — ne pas la corriger à la main.
    Sa source est \`scripts/engendrer-maquette-sequence.mjs\` ; toute retouche
    faite ici disparaît à la régénération suivante.

    « Créez-moi une maquette dynamique, juste des points que je puisse cliquer
      dessus, enfin le dictaphone, puis je l'arrête et les points se mettent à
      bouger pour voir comment ça rend. »
        — le patron, le 13 août 2026

    Aucun script : trois boutons radio et des étiquettes qui pointent vers
    l'état suivant. C'est ce qui permet à la page de s'ouvrir dans un aperçu,
    une visionneuse, un lecteur qui n'exécute rien — la cause, trois fois, de
    « je ne peux pas ouvrir ça ».
  */

  :root{
    /* Les couleurs réelles de l'application — src/lib/design-tokens.ts */
    --fond:#f5f3ee; --carte:#faf9f5; --encre:#1c1c1a; --gris:#8a8578;
    --pin:#2f3b2f; --teinte:#ece9e1; --alerte:#9C3B2E; --or:#8a7452;
    --trait:rgba(28,28,26,.13);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --fond:#171613; --carte:#221f19; --encre:#e9e5dc; --gris:#8a867c;
      --pin:#a9b8a4; --teinte:#272420; --or:#b39b72; --trait:rgba(233,229,220,.16);
    }
  }
  :root[data-theme="dark"]{
    --fond:#171613; --carte:#221f19; --encre:#e9e5dc; --gris:#8a867c;
    --pin:#a9b8a4; --teinte:#272420; --or:#b39b72; --trait:rgba(233,229,220,.16);
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--fond);color:var(--encre);
       font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
       font-size:16px;line-height:1.65;padding:44px 16px 90px}
  .page{max-width:1240px;margin:0 auto}

  .intro{max-width:64ch;margin:0 auto}
  .intro .sur{margin:0 0 16px;font-size:10px;letter-spacing:.34em;text-transform:uppercase;
              color:var(--or);text-align:center}
  .intro h1{margin:0 0 16px;font-family:ui-serif,Georgia,"Iowan Old Style",serif;
            font-size:32px;font-weight:400;line-height:1.2;text-align:center}
  .intro p{margin:0 0 12px;color:var(--gris);font-size:15px;text-align:center}
  .intro b{color:var(--encre);font-weight:500}
  .marche{max-width:60ch;margin:24px auto 0;padding:15px 20px;border:1px solid var(--trait);
          border-radius:6px;font-size:13.5px;color:var(--gris);line-height:1.7}
  .marche b{color:var(--encre);font-weight:500}
  .marche ol{margin:8px 0 0;padding-left:20px}
  .marche li{margin:0 0 4px}

  /* Le seul réglage de la planche, et il est nommé pour ce qu'il fait. */
  .reglage{max-width:60ch;margin:18px auto 0;text-align:center;font-size:13.5px;color:var(--gris)}
  .reglage label{cursor:pointer;display:inline-flex;align-items:center;gap:9px;
                 padding:9px 16px;border:1px solid var(--trait);border-radius:999px}
  .reglage .case{width:15px;height:15px;border:1px solid var(--gris);border-radius:4px;flex-shrink:0}
  #resultat{position:absolute;opacity:0;pointer-events:none;width:0;height:0}
  #resultat:checked ~ .reglage .case{background:var(--pin);border-color:var(--pin)}
  #resultat:checked ~ .reglage .oui{display:inline}
  #resultat:checked ~ .reglage .non{display:none}
  .reglage .oui{display:none}

  .rangee{display:flex;flex-wrap:wrap;gap:34px;justify-content:center;align-items:flex-start;
          margin-top:48px}
  figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:14px}
  figcaption{max-width:32ch;text-align:center;font-size:13px;color:var(--gris);line-height:1.62}
  figcaption .chapeau{display:block;color:var(--encre);font-weight:500;font-size:13.5px;margin-bottom:4px}

  /* ─── Le téléphone, à la dalle réelle ───────────────────────────────────── */
  .tel{width:340px;max-width:100%;border-radius:40px;padding:10px;background:#cfccc4;
       box-shadow:0 1px 3px rgba(20,18,14,.16),0 26px 58px rgba(20,18,14,.20)}
  .ecran{position:relative;overflow:hidden;border-radius:31px;height:534px;background:var(--fond)}
  .corps{height:100%;display:flex;flex-direction:column;padding:18px 18px 0}

  .etat{position:absolute;opacity:0;pointer-events:none;width:0;height:0}

  .marque{text-align:center;font-size:10px;letter-spacing:.34em;color:var(--encre);margin:0 0 14px}
  .retour{width:34px;height:34px;border-radius:999px;background:var(--teinte);
          display:flex;align-items:center;justify-content:center;color:var(--pin);font-size:13px}

  .tete{display:flex;justify-content:space-between;align-items:flex-start;margin:14px 0 0;gap:12px}
  .surtitre{font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--gris);margin:0 0 2px}
  .titre{margin:0;font-family:ui-serif,Georgia,serif;font-size:30px;font-weight:400;line-height:1.1}
  .colonne{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0}

  /*
    LE BOUTON — 44 px, la mesure réelle (\`h-11 w-11\`), jamais un agrandissement.
    Un geste se juge à sa taille : c'est la leçon de la maquette 34.
  */
  .micro{width:44px;height:44px;border-radius:999px;background:var(--teinte);color:var(--pin);
         display:none;align-items:center;justify-content:center;position:relative;cursor:pointer;
         -webkit-tap-highlight-color:transparent}
  .micro svg{display:block}
  .micro.ecoute{background:var(--alerte);color:#fff;cursor:pointer}
  .micro.traite{cursor:default}

  /*
    L'AVANT GARDE SON DEMI-EFFACEMENT, et ce n'est pas un détail de fidélité :
    c'est la moitié du défaut. Le bouton passe aujourd'hui à \`opacity: 0.5\`
    pendant le traitement — le vocabulaire d'un bouton ÉTEINT, pas d'un bouton
    qui travaille. Le lui montrer immobile ET à pleine encre le ferait paraître
    moins mauvais qu'il n'est, et fausserait la comparaison.
  */
  [data-variante="0"] .micro.traite{opacity:.5}

  /*
    L'ÉTAT, EN \`:nth-of-type\` PLUTÔT QU'EN IDENTIFIANT.

    Les trois radios sont les trois seuls \`input\` de l'écran : la règle vaut donc
    pour les six téléphones sans être recopiée six fois — et un septième
    téléphone ajouté plus tard marchera sans qu'on ait à y penser. Écrite par
    identifiant, elle se serait désynchronisée au premier oubli.
  */
  .etat:nth-of-type(1):checked ~ .corps .micro.repos{display:flex}
  .etat:nth-of-type(2):checked ~ .corps .micro.ecoute{display:flex}
  .etat:nth-of-type(3):checked ~ .corps .micro.traite{display:flex}

  /* Le battement de l'écoute : le rouge seul pourrait passer pour un état figé. */
  @keyframes ecoute{ 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.06);opacity:.86} }
  .etat:nth-of-type(2):checked ~ .corps .micro.ecoute{animation:ecoute 1.4s ease-in-out infinite}

  /* La phrase sous le bouton — sa place est RÉSERVÉE, sinon tout saute. */
  .mot{margin-top:8px;max-width:152px;text-align:right;font-size:12px;line-height:1.35;
       color:var(--gris);min-height:46px}
  .mot span{display:none}
  .etat:nth-of-type(1):checked ~ .corps .mot .m-repos{display:inline}
  .etat:nth-of-type(2):checked ~ .corps .mot .m-ecoute{display:inline}
  .etat:nth-of-type(3):checked ~ .corps .mot .m-traite{display:inline}

  .points{display:flex;align-items:center;justify-content:center;gap:4px;height:44px}
  .pt{width:5px;height:5px;border-radius:999px;background:var(--pin);display:block}
  .glyphe{font-size:11px;font-weight:600;color:var(--pin)}
  .signe-fini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
              opacity:0}

  .champs{margin-top:20px}
  .etiquette{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--gris);margin:0 0 5px}
  .plage{background:var(--carte);border-radius:4px;height:44px;margin:0 0 13px;
         display:flex;align-items:center;padding:0 13px;overflow:hidden}
  .valeur{font-size:14px;color:var(--encre);opacity:0;white-space:nowrap;
          text-overflow:ellipsis;overflow:hidden}

  .recommencer{margin:auto 0 16px;align-self:center;font-size:12px;color:var(--gris);
               border:1px solid var(--trait);border-radius:999px;padding:7px 18px;cursor:pointer}

  /*
    LE RETOUR DU RÉSULTAT — décoché par défaut, et c'est réfléchi.

    En boucle, on peut fixer un geste aussi longtemps qu'on veut pour le
    comparer. Coché, la planche va jusqu'au bout : au bout de quatre secondes
    les champs se remplissent, la phrase change, le micro revient. C'est le
    parcours réel — mais on n'a que quatre secondes pour juger le geste.
  */
  @keyframes paraitre{ to{opacity:1} }
  @keyframes disparaitre{ to{opacity:0} }
  #resultat:checked ~ .rangee .etat:nth-of-type(3):checked ~ .corps .valeur{
    animation:paraitre .5s ease-out 4s forwards}
  #resultat:checked ~ .rangee .etat:nth-of-type(3):checked ~ .corps .points{
    animation:disparaitre .35s ease-out 4s forwards}
  #resultat:checked ~ .rangee .etat:nth-of-type(3):checked ~ .corps .anneau{
    animation:disparaitre .35s ease-out 4s forwards !important}
  #resultat:checked ~ .rangee .etat:nth-of-type(3):checked ~ .corps .signe-fini{
    animation:paraitre .4s ease-out 4.3s forwards}
  #resultat:checked ~ .rangee .etat:nth-of-type(3):checked ~ .corps .mot .m-traite{
    animation:disparaitre .3s ease-out 4s forwards}
  #resultat:checked ~ .rangee .etat:nth-of-type(3):checked ~ .corps .mot .m-fini{
    display:inline;opacity:0;animation:paraitre .4s ease-out 4.3s forwards}

  /* ═══ A — LA VAGUE ═══════════════════════════════════════════════════════ */
  @keyframes vague{ 0%,58%,100%{transform:translateY(0)} 29%{transform:translateY(-4px)} }
  [data-variante="A"] .pt{animation:vague 1.05s ease-in-out infinite}
  [data-variante="A"] .pt:nth-child(2){animation-delay:.13s}
  [data-variante="A"] .pt:nth-child(3){animation-delay:.26s}

  /* ═══ B — LA VAGUE AMPLE ═════════════════════════════════════════════════ */
  @keyframes houle{ 0%,62%,100%{transform:translateY(0);opacity:.5} 30%{transform:translateY(-7px);opacity:1} }
  [data-variante="B"] .pt{animation:houle 1.5s ease-in-out infinite;opacity:.5}
  [data-variante="B"] .pt:nth-child(2){animation-delay:.2s}
  [data-variante="B"] .pt:nth-child(3){animation-delay:.4s}

  /* ═══ C — LE SOUFFLE ═════════════════════════════════════════════════════ */
  @keyframes souffle{ 0%,66%,100%{transform:scale(.72);opacity:.34} 30%{transform:scale(1.5);opacity:1} }
  [data-variante="C"] .pt{animation:souffle 1.25s ease-in-out infinite;transform:scale(.72);opacity:.34}
  [data-variante="C"] .pt:nth-child(2){animation-delay:.16s}
  [data-variante="C"] .pt:nth-child(3){animation-delay:.32s}

  /* ═══ D — LE POINT QUI COURT ═════════════════════════════════════════════ */
  [data-variante="D"] .points{position:relative}
  [data-variante="D"] .pt{opacity:.26}
  .curseur{position:absolute;left:50%;margin-left:-2.5px;width:5px;height:5px;border-radius:999px;
           background:var(--pin);display:block}
  @keyframes courir{ 0%{transform:translateX(-9px)} 50%{transform:translateX(9px)} 100%{transform:translateX(-9px)} }
  [data-variante="D"] .curseur{animation:courir 1.15s cubic-bezier(.45,.05,.55,.95) infinite}

  /* ═══ E — L'ANNEAU QUI TOURNE ════════════════════════════════════════════ */
  .anneau{position:absolute;inset:-3px;border-radius:999px;display:none;
          background:conic-gradient(from 0deg,transparent 0deg 288deg,var(--or) 350deg,transparent 360deg);
          -webkit-mask:radial-gradient(circle,transparent 0 21px,#000 21.8px);
                  mask:radial-gradient(circle,transparent 0 21px,#000 21.8px)}
  @keyframes tour{ to{transform:rotate(360deg)} }
  [data-variante="E"] .anneau{display:block;animation:tour 1.4s linear infinite}
  @keyframes respire{ 0%,100%{opacity:.32} 50%{opacity:1} }
  [data-variante="E"] .pt{animation:respire 1.4s ease-in-out infinite;opacity:.32}
  [data-variante="E"] .pt:nth-child(2){animation-delay:.14s}
  [data-variante="E"] .pt:nth-child(3){animation-delay:.28s}

  /*
    MOUVEMENT RÉDUIT — et ce n'est PAS « on ne bouge plus ».

    Tout couper rendrait le défaut qu'on répare : trois points fixes, et
    personne pour dire si ça travaille. Ce qui gêne dans ce réglage, c'est le
    DÉPLACEMENT, pas la lumière. Les cinq se replient donc sur une même
    respiration, sans un pixel de trajet.
  */
  @media (prefers-reduced-motion: reduce){
    .pt,.curseur,.anneau,.micro.ecoute{
      animation:respire 2s ease-in-out infinite !important;transform:none !important}
    .curseur,.anneau{display:none !important}
  }

  .bilan{max-width:74ch;margin:64px auto 0;border:1px solid var(--trait);border-radius:8px;padding:22px 26px}
  .bilan h2{margin:0 0 12px;font-family:ui-serif,Georgia,serif;font-size:20px;font-weight:400}
  .bilan p{margin:0 0 10px;font-size:14px;color:var(--gris)}
  .bilan b{color:var(--encre);font-weight:500}
  .bilan ul{margin:0;padding-left:20px;font-size:14px;color:var(--gris)}
  .bilan li{margin:0 0 8px}
</style>

<div class="page">

  <div class="intro">
    <p class="sur">Maquette 43 · 13 août 2026</p>
    <h1>L'attente, à l'essai</h1>
    <p>Six téléphones, six façons d'attendre. <b>Ils se manipulent</b> — c'est tout l'objet.</p>
    <div class="marche">
      <b>La marche à suivre, sur chaque téléphone :</b>
      <ol>
        <li>appuyez sur le <b>micro</b> — il devient rouge et bat : Atlas écoute&nbsp;;</li>
        <li>appuyez sur le <b>carré</b> pour arrêter — les points prennent la place&nbsp;;</li>
        <li>regardez, comparez, et <b>« Recommencer »</b> remet tout à zéro.</li>
      </ol>
      Les points tournent en boucle : en vrai l'attente dure de deux à dix secondes,
      et une boucle laisse le temps de juger.
    </div>
  </div>

  <input type="checkbox" id="resultat">
  <p class="reglage">
    <label for="resultat">
      <span class="case"></span>
      <span class="non">Aller jusqu'au résultat (4 s), plutôt que de tourner en boucle</span>
      <span class="oui">Le résultat arrive au bout de 4 s — décochez pour tourner en boucle</span>
    </label>
  </p>

  <div class="rangee">${VARIANTES.map(telephone).join("\n")}
  </div>

  <div class="bilan">
    <h2>Ce qui part avec n'importe laquelle</h2>
    <p>Trois choses ne dépendent pas de votre lettre. Elles sont dans les cinq — dites le mot
       et elles sautent.</p>
    <ul>
      <li><b>Le bouton reste à pleine encre.</b> Il passe aujourd'hui à moitié effacé pendant
          le traitement : le vocabulaire d'un bouton éteint, pas d'un bouton qui travaille.</li>
      <li><b>Une phrase paraît sous le bouton</b> — « Atlas rédige… ». L'écran parle quand il
          écoute et quand il a fini ; il se taisait pendant le seul moment où l'on se demande
          s'il est en panne.</li>
      <li><b>Sous « mouvement réduit », ça ne s'arrête pas</b> : les points respirent lentement,
          sans se déplacer. Tout couper rendrait le défaut d'origine à qui a activé ce réglage.</li>
    </ul>
    <p><b>Ce qui reste ouvert :</b> ce que l'écran dit si le traitement s'éternise. Une vague
       qui tourne depuis trente secondes redevient une vague qui ne dit rien.</p>
  </div>

</div>
</body>
</html>
`;

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, PAGE, "utf8");

// Un fichier écrit ne prouve rien : on relit ce qu'on vient de produire. La
// page ne doit contenir NI \`<script>\` NI gestionnaire en ligne — c'est la
// condition d'ouverture chez le patron, et elle a été trois fois oubliée.
const suspect = /<script|\son(?:click|load|change|input)=/i.exec(PAGE);
if (suspect) {
  console.error(`✗ La page engendrée contient du script (« ${suspect[0]} ») — elle lui arriverait vide.`);
  process.exit(1);
}
console.log(`✅ ${SORTIE} — ${VARIANTES.length} téléphones, sans une ligne de script.`);
