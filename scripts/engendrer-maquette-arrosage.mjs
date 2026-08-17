#!/usr/bin/env node
/*
  Engendre les TROIS planches du PLAN D'ARROSAGE AUTOMATIQUE, à partir d'un
  seul jardin et d'un seul catalogue de matériel.

  **Pourquoi un script plutôt que trois fichiers écrits à la main.** Les trois
  planches montrent le MÊME jardin : celui qu'on saisit, celui qu'on découpe en
  secteurs, et celui qu'on chiffre. Recopiées, les listes finiraient par
  diverger — et l'écart se verrait précisément là où le patron compare les
  trois. C'est la règle du §3 du dépôt, appliquée à des maquettes, et c'est
  aussi ce qui a été fait pour la fiche d'entretien.

  **Et ici, il y a plus qu'un risque de recopie : il y a de l'arithmétique.**
  Neuf turbines, 1,76 m³/h, huit secteurs, 3 h 14 de cycle — chacun de ces
  nombres découle des autres. Écrits à la main, ils seraient faux au premier
  changement de dimension, et une maquette qui compte faux fait douter de tout
  ce qu'elle montre (payé sur la fiche d'entretien : « dix-huit » pour vingt
  prestations). Tout est donc CALCULÉ ci-dessous, et le contrôle
  `scripts/verifier-maquette-arrosage.mjs` relit les nombres SUR LES PLANCHES.

  Aucun `<script>` dans ce qui est produit : le lecteur du patron n'exécute pas
  JavaScript, et les pages bâties en JS lui arrivent VIDES (`PROJECT_STATE.md`).
  Tout ce qui réagit au doigt est fait d'`input` natifs et de CSS ; le plan est
  du SVG, qui se dessine sans script.

  RIEN N'EST CODÉ : `src/` n'est pas touché (règle du §3 bis).
*/

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "maquettes");

/* ══════════════════════════════════════════════════════════════════════════
   LE JARDIN, ET RIEN QU'UN JARDIN

   Un exemple plausible de pavillon, pas un cas d'école : c'est sur lui que le
   patron jugera si l'outil dit des choses justes. Les valeurs de matériel sont
   celles des catalogues courants à 3 bar — portée, débit et pluviométrie vont
   toujours ensemble, et c'est leur rapport qui fait tout le calcul.
   ══════════════════════════════════════════════════════════════════════════ */

// Le point d'eau se MESURE, il ne se suppose pas : un seau de 10 litres rempli
// en 20 secondes fait 30 L/min, soit 1,8 m³/h. C'est le geste que l'écran
// demande, parce qu'un débit supposé fait un plan qui ne fonctionne pas.
const POINT_DEAU = {
  litres: 10,
  secondes: 20,
  pression: 3,
  // On ne charge jamais un secteur au débit maximum : il faut de la marge pour
  // les pertes de charge du réseau, sans quoi les derniers arroseurs de la
  // ligne bavent au lieu d'arroser.
  marge: 0.85,
};
const DEBIT_DISPONIBLE = (POINT_DEAU.litres / POINT_DEAU.secondes) * 3.6; // m³/h
const DEBIT_MAX_SECTEUR = DEBIT_DISPONIBLE * POINT_DEAU.marge;

const MATERIELS = {
  turbine: {
    cle: "turbine",
    nom: "Turbine",
    detail: "buse 3,0",
    famille: "Arroseurs",
    portee: 9,
    debit360: 0.44, // m³/h en cercle entier
    pluvio: 11, // mm/h en pose tête-bêche
  },
  tuyere: {
    cle: "tuyere",
    nom: "Tuyère",
    detail: "buse 12",
    famille: "Arroseurs",
    portee: 3.7,
    debit360: 0.48,
    pluvio: 38,
  },
  gaine: {
    cle: "gaine",
    nom: "Gaine de goutteurs",
    detail: "2,3 L/h tous les 33 cm",
    famille: "Goutte-à-goutte",
    debitMetre: 0.007, // m³/h par mètre de gaine
    pluvio: 23, // mm/h sur la bande mouillée de 30 cm
  },
};

// `besoin` : millimètres d'eau par semaine en juillet. `passages` : combien de
// fois par semaine. Les deux ensemble donnent la durée — jamais l'un sans
// l'autre, sinon on arrose la bonne quantité au mauvais rythme.
const ZONES = [
  { nom: "Pelouse arrière", forme: "surface", L: 18, l: 12, materiel: "turbine", besoin: 25, passages: 3 },
  { nom: "Pelouse avant", forme: "surface", L: 12, l: 8, materiel: "tuyere", besoin: 25, passages: 3 },
  { nom: "Massifs", forme: "lineaire", ml: 45, materiel: "gaine", besoin: 20, passages: 2 },
  { nom: "Haie de charmilles", forme: "lineaire", ml: 60, materiel: "gaine", besoin: 20, passages: 2 },
  { nom: "Potager", forme: "lineaire", ml: 30, materiel: "gaine", besoin: 30, passages: 3 },
];

const DEPART_CYCLE = 3 * 60; // 3 h 00 du matin

/* ══════════════════════════════════════════════════════════════════════════
   LE CALCUL
   ══════════════════════════════════════════════════════════════════════════ */

// Pose tête-bêche : l'écart entre deux arroseurs vaut leur portée, de sorte que
// chacun arrose jusqu'au pied du suivant. C'est la seule pose qui donne une
// lame d'eau régulière — espacer davantage fait des couronnes sèches entre les
// arroseurs, et c'est le défaut qu'on voit en août sur les pelouses.
function poserSurUneSurface(zone) {
  const m = MATERIELS[zone.materiel];
  const nx = Math.ceil(zone.L / m.portee) + 1;
  const ny = Math.ceil(zone.l / m.portee) + 1;
  const coins = 4;
  const bords = Math.max(0, 2 * (nx - 2)) + Math.max(0, 2 * (ny - 2));
  const interieurs = Math.max(0, nx - 2) * Math.max(0, ny - 2);
  // Sur un bord, un arroseur ne tourne que d'un demi-tour ; dans un coin, d'un
  // quart. Compter tout le monde en cercle entier serait la faute classique :
  // elle gonfle le débit de moitié, et fait acheter des secteurs pour rien.
  const debit = coins * (m.debit360 / 4) + bords * (m.debit360 / 2) + interieurs * m.debit360;
  return { nx, ny, coins, bords, interieurs, nombre: coins + bords + interieurs, debit, mat: m };
}

function poserSurUnLineaire(zone) {
  const m = MATERIELS[zone.materiel];
  return { nombre: zone.ml, debit: zone.ml * m.debitMetre, mat: m };
}

const ZONES_POSEES = ZONES.map((zone) => {
  const pose = zone.forme === "surface" ? poserSurUneSurface(zone) : poserSurUnLineaire(zone);
  // La durée ne dépend PAS de la surface : elle dépend de la pluviométrie du
  // matériel. Une tuyère verse 38 mm à l'heure, une turbine 11 — la même
  // quantité d'eau demande donc trois fois moins de temps d'un côté que de
  // l'autre. C'est ce que personne ne calcule de tête, et c'est la raison
  // d'être de l'outil.
  const minutes = Math.round((zone.besoin / zone.passages / pose.mat.pluvio) * 60);
  return { ...zone, ...pose, minutes };
});

// **La règle qui commande le découpage, et qui n'est pas un goût.** Deux
// matériels de pluviométries différentes ne peuvent pas partager un secteur :
// la vanne les ouvre ensemble, donc pour la même durée, et l'un reçoit trois
// fois l'eau de l'autre. Deux zones de RYTHMES différents non plus : le
// potager veut trois passages, la haie deux.
function clefDeRegime(z) {
  return `${z.materiel}|${z.besoin}|${z.passages}`;
}

function decouperEnSecteurs() {
  const groupes = new Map();
  for (const z of ZONES_POSEES) {
    const clef = clefDeRegime(z);
    if (!groupes.has(clef)) groupes.set(clef, []);
    groupes.get(clef).push(z);
  }

  const secteurs = [];
  for (const zonesDuGroupe of groupes.values()) {
    const debitTotal = zonesDuGroupe.reduce((s, z) => s + z.debit, 0);
    const combien = Math.max(1, Math.ceil(debitTotal / DEBIT_MAX_SECTEUR));
    const nomsDesZones = zonesDuGroupe.map((z) => z.nom);
    const premiere = zonesDuGroupe[0];
    for (let i = 0; i < combien; i++) {
      secteurs.push({
        // Le nom dit d'où vient le secteur : « Pelouse arrière — 1 sur 2 » se
        // retrouve sur le terrain, « Secteur 3 » ne se retrouve nulle part.
        zone: nomsDesZones.join(" + "),
        part: combien > 1 ? `${i + 1} sur ${combien}` : null,
        materiel: premiere.materiel,
        famille: premiere.materiel === "gaine" ? "Goutte-à-goutte" : "Arroseurs",
        debit: debitTotal / combien,
        minutes: premiere.minutes,
        passages: premiere.passages,
        // Le nombre d'arroseurs se répartit avec le débit : c'est ce que le
        // poseur cherchera sur le plan.
        nombre: Math.round(zonesDuGroupe.reduce((s, z) => s + z.nombre, 0) / combien),
        unite: premiere.forme === "surface" ? "arroseurs" : "m de gaine",
      });
    }
  }
  return secteurs;
}

const SECTEURS = decouperEnSecteurs();
const DEBIT_DEMANDE = ZONES_POSEES.reduce((s, z) => s + z.debit, 0);
const CYCLE_MINUTES = SECTEURS.reduce((s, x) => s + x.minutes, 0);
// Ce qu'il faudrait de secteurs si l'on ne regardait QUE le débit, en oubliant
// les deux règles (une pluviométrie, un rythme). L'écart entre ce nombre et le
// vrai est exactement ce que les deux règles coûtent — et il se calcule, sinon
// il ment au premier changement de dimension.
const SECTEURS_AU_SEUL_DEBIT = Math.ceil(DEBIT_DEMANDE / DEBIT_MAX_SECTEUR);

// Le matériel à acheter, engendré des secteurs et des zones : une électrovanne
// par secteur, et pas une de plus.
const NOMENCLATURE = (() => {
  const lignes = [];
  for (const cle of ["turbine", "tuyere"]) {
    const n = ZONES_POSEES.filter((z) => z.materiel === cle).reduce((s, z) => s + z.nombre, 0);
    if (n > 0) {
      const m = MATERIELS[cle];
      lignes.push({ nom: `${m.nom}s ${m.detail}`, quantite: n, unite: "u", connu: true });
    }
  }
  const ml = ZONES_POSEES.filter((z) => z.materiel === "gaine").reduce((s, z) => s + z.nombre, 0);
  if (ml > 0) lignes.push({ nom: `Gaine de goutteurs ${MATERIELS.gaine.detail}`, quantite: ml, unite: "ml", connu: true });
  lignes.push({ nom: "Électrovannes 24 V", quantite: SECTEURS.length, unite: "u", connu: true });
  lignes.push({ nom: "Regards de vannes", quantite: Math.ceil(SECTEURS.length / 3), unite: "u", connu: false });
  lignes.push({ nom: `Programmateur ${VOIES_PROGRAMMATEUR()} voies`, quantite: 1, unite: "u", connu: false });
  lignes.push({ nom: "Disconnecteur et réducteur de pression", quantite: 1, unite: "u", connu: true });
  lignes.push({ nom: "Tuyau PE 32 (ligne principale)", quantite: 60, unite: "ml", connu: true });
  lignes.push({ nom: "Tuyau PE 25 (antennes)", quantite: 120, unite: "ml", connu: true });
  return lignes;
})();

// Les programmateurs se vendent par 4, 6, 8, 12 voies. Prendre juste ce qu'il
// faut, c'est interdire au client d'ajouter un massif l'an prochain sans tout
// rouvrir — l'écran le dit plutôt que de le taire.
function VOIES_PROGRAMMATEUR() {
  return [4, 6, 8, 12, 16].find((v) => v >= SECTEURS.length) ?? SECTEURS.length;
}
const VOIES = VOIES_PROGRAMMATEUR();
const VOIES_LIBRES = VOIES - SECTEURS.length;

const PRIX_MANQUANTS = NOMENCLATURE.filter((l) => !l.connu).length;
const EN_LETTRES = { 1: "Un", 2: "Deux", 3: "Trois", 4: "Quatre", 5: "Cinq" };
const MANQUANTS_MOT = EN_LETTRES[PRIX_MANQUANTS] ?? String(PRIX_MANQUANTS);

/* ── Mise en forme française ────────────────────────────────────────────── */

const nb = (x, d = 2) =>
  x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const heure = (minutesDepuisMinuit) => {
  const h = Math.floor(minutesDepuisMinuit / 60) % 24;
  const m = Math.round(minutesDepuisMinuit % 60);
  return `${h} h ${String(m).padStart(2, "0")}`;
};
const duree = (minutes) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`;

const DEBIT_DISPONIBLE_MOT = nb(DEBIT_DISPONIBLE, 2);
const DEBIT_DEMANDE_MOT = nb(DEBIT_DEMANDE, 2);
const COMBIEN_DE_FOIS = nb(DEBIT_DEMANDE / DEBIT_DISPONIBLE, 1);

/* ══════════════════════════════════════════════════════════════════════════
   LA CHARTE — la même que les autres planches, pour qu'elles se suivent
   ══════════════════════════════════════════════════════════════════════════ */

const CHARTE = `
  :root{
    --fond:#efece6; --encre:#1c1c1a; --gris:#8a8578; --or:#B98B47;
    --trait:rgba(28,28,26,.13); --papier:#faf9f5; --pin:#2f3b2f;
    --alerte:#9C3B2E; --teinte:#ece9e1; --eau:#3E6B7A;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --fond:#171613; --encre:#e9e5dc; --gris:#8a867c; --or:#C9A15E;
      --trait:rgba(233,229,220,.16); --papier:#201e1a; --pin:#7d9179;
      --alerte:#C87058; --teinte:#252320; --eau:#7FA8B5;
    }
  }
  :root[data-theme="dark"]{
    --fond:#171613; --encre:#e9e5dc; --gris:#8a867c; --or:#C9A15E;
    --trait:rgba(233,229,220,.16); --papier:#201e1a; --pin:#7d9179;
    --alerte:#C87058; --teinte:#252320; --eau:#7FA8B5;
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--fond);color:var(--encre);
       font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
       padding:26px 18px 70px}
  .dedans{max-width:940px;margin:0 auto}
  h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;
     font-size:27px;line-height:1.2;margin:0 0 8px}
  .intro{color:var(--gris);font-size:14px;line-height:1.65;margin:0 0 18px}
  .intro b{color:var(--encre);font-weight:600}
  .dit{margin:0 0 22px;padding:14px 16px;border-left:3px solid var(--or);
       background:var(--papier);font-size:14px;line-height:1.7;color:var(--gris)}
  .dit b{color:var(--encre);font-weight:600}

  .etat{position:absolute;opacity:0;pointer-events:none}
  .reglage{margin:0 0 18px}
  .reglage .quoi{display:block;font-size:11px;letter-spacing:.13em;
                 text-transform:uppercase;color:var(--or);margin-bottom:8px}
  .segments{display:flex;flex-wrap:wrap;gap:8px}
  .segments label{display:inline-block;padding:9px 15px;border-radius:999px;
                  border:1px solid var(--trait);background:var(--papier);
                  font-size:13.5px;cursor:pointer;color:var(--gris)}

  .rangee{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start}
  .tel{width:330px;flex:none;border-radius:26px;background:var(--papier);
       border:1px solid var(--trait);padding:16px 15px 20px;
       box-shadow:0 10px 34px rgba(28,28,26,.09)}
  .barre{display:flex;justify-content:space-between;align-items:baseline;
         margin-bottom:12px}
  .barre .ou{font-size:11px;letter-spacing:.13em;text-transform:uppercase;
             color:var(--or)}
  .barre .quand{font-size:11.5px;color:var(--gris)}
  .titre-fiche{font-family:Georgia,serif;font-size:20px;margin:0 0 2px}
  .sous{font-size:12.5px;color:var(--gris);margin:0 0 14px}

  .legende{flex:1;min-width:280px;font-size:13.5px;line-height:1.7;color:var(--gris)}
  .legende .t{display:block;font-family:Georgia,serif;font-size:18px;
              color:var(--encre);margin-bottom:8px}
  .legende b{color:var(--encre);font-weight:600}
  .legende .cout{display:block;margin-top:12px;padding-top:12px;
                 border-top:1px solid var(--trait)}

  .note{margin-top:30px;padding:16px 18px;border-radius:12px;
        background:var(--papier);font-size:13.5px;line-height:1.7;color:var(--gris)}
  .note b{color:var(--encre);font-weight:600}
  .note .t{display:block;font-size:11px;letter-spacing:.13em;
           text-transform:uppercase;color:var(--or);margin-bottom:8px}
  .note ul{margin:8px 0 0;padding-left:19px}
  .note li{margin-bottom:6px}

  .fam{margin:16px 0 2px;font-size:11px;letter-spacing:.13em;
       text-transform:uppercase;color:var(--or);display:flex;
       justify-content:space-between;align-items:baseline}
  .fam .compte{font-size:11px;color:var(--gris);letter-spacing:0}
`;

/* ══════════════════════════════════════════════════════════════════════════
   PLANCHE 69 — par où l'on entre
   ══════════════════════════════════════════════════════════════════════════ */

// Le plan dessiné de la pelouse arrière : les arroseurs aux nœuds de la pose
// tête-bêche, et leur portée découpée au bord du gazon. Les couronnes sont
// tronquées parce que les arroseurs de bord ne tournent QUE d'un demi-tour —
// dessiner des cercles entiers montrerait de l'eau sur la terrasse du voisin.
function planDeLaPelouse() {
  const z = ZONES_POSEES[0];
  const E = 12; // pixels par mètre
  const marge = 26;
  // **Une marge à gauche plus large, et elle est payée.** Avec la même marge
  // partout, la cote verticale « 12 m » sortait du cadre et s'affichait « 2 m »
  // — le dessin était juste, sa légende mentait, et aucun contrôle de DOM ne
  // pouvait le voir : le texte est entier dans la page, c'est le viewBox qui le
  // coupe. Trouvé en REGARDANT la capture, comme les cinq défauts d'avant.
  const margeG = 44;
  const L = z.L * E;
  const H = z.l * E;
  const points = [];
  for (let i = 0; i < z.nx; i++) {
    for (let j = 0; j < z.ny; j++) {
      points.push({
        x: margeG + (i * L) / (z.nx - 1),
        y: marge + (j * H) / (z.ny - 1),
        bord: i === 0 || j === 0 || i === z.nx - 1 || j === z.ny - 1,
      });
    }
  }
  const couronnes = points
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${z.mat.portee * E}" class="portee"/>`)
    .join("\n      ");
  const tetes = points
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" class="tete"/>`)
    .join("\n      ");
  return `<svg viewBox="0 0 ${L + margeG + marge} ${H + marge * 2}" class="plan" role="img"
         aria-label="Plan de la pelouse arrière : ${z.nombre} turbines et leur portée">
      <defs><clipPath id="gazon"><rect x="${margeG}" y="${marge}" width="${L}" height="${H}" rx="6"/></clipPath></defs>
      <rect x="${margeG}" y="${marge}" width="${L}" height="${H}" rx="6" class="gazon"/>
      <g clip-path="url(#gazon)">
      ${couronnes}
      </g>
      <rect x="${margeG}" y="${marge}" width="${L}" height="${H}" rx="6" class="bordure"/>
      ${tetes}
      <text x="${margeG + L / 2}" y="${marge + H + 17}" class="cote">${z.L} m</text>
      <text x="${margeG - 10}" y="${marge + H / 2}" class="cote cote-g">${z.l} m</text>
    </svg>`;
}

function lignesDeLaFeuille() {
  return ZONES_POSEES.map((z, i) => {
    const q = z.forme === "surface" ? `${z.nombre}` : `${z.nombre}`;
    const u = z.forme === "surface" ? "arroseurs" : "m";
    return `        <div class="fl">
          <span class="fl-nom">${z.mat.nom}${z.forme === "surface" ? "s" : ""} — ${z.nom.toLowerCase()}</span>
          <span class="fl-q"><input type="text" value="${q}" size="3" aria-label="Quantité pour ${z.nom}" readonly> ${u}</span>
          <span class="fl-d">${nb(z.debit)} m³/h</span>
        </div>`;
  }).join("\n");
}

function cartesDesZones() {
  return ZONES_POSEES.map(
    (z) => `        <div class="zc">
          <p class="zc-nom">${z.nom}</p>
          <p class="zc-mes">${z.forme === "surface" ? `${z.L} × ${z.l} m` : `${z.ml} m linéaires`} · <span class="zc-mat">${z.mat.nom.toLowerCase()}</span></p>
          <p class="zc-res">${z.nombre} ${z.forme === "surface" ? (z.nombre > 1 ? "arroseurs" : "arroseur") : "m de gaine"}
             · ${nb(z.debit)} m³/h · ${z.minutes} min, ${z.passages}×/semaine</p>
        </div>`
  ).join("\n");
}

const PLANCHE_ENTREE = `<title>Le plan d'arrosage</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /*
    LE PLAN D'ARROSAGE AUTOMATIQUE — par où le paysagiste y entre.

    LE PATRON, LE 17 AOÛT 2026 : « j'ai besoin qu'on crée un outil pour les
    paysagistes pour réaliser des plans d'arrosage automatique. »

    ————————————————————————————————————————————————————————————————
    CE QUE L'OUTIL DOIT SAVOIR FAIRE, ET QUE PERSONNE NE FAIT DE TÊTE

    Un plan d'arrosage tient en trois nombres qui s'enchaînent :

      · LE DÉBIT DU ROBINET  — ${DEBIT_DISPONIBLE_MOT} m³/h ici, mesuré au seau.
      · LE DÉBIT DEMANDÉ     — ${DEBIT_DEMANDE_MOT} m³/h pour ce jardin,
                               soit ${COMBIEN_DE_FOIS} fois ce qu'on a.
      · LA PLUVIOMÉTRIE      — 11 mm/h pour une turbine, 38 pour une tuyère.

    Le premier interdit d'ouvrir tout le jardin à la fois : il faut DÉCOUPER
    EN SECTEURS. Le troisième donne les durées, et il ne se devine pas — la
    même quantité d'eau demande ${ZONES_POSEES[0].minutes} minutes de turbine
    et ${ZONES_POSEES[1].minutes} minutes de tuyère.

    C'est exactement le travail de bureau que le patron veut voir disparaître :
    des additions faites sur un coin de camionnette, et refaites à chaque fois
    que le client déplace un massif.

    ————————————————————————————————————————————————————————————————
    CE QUI N'EST PAS À CHOISIR — ce sont des conséquences, pas des goûts.

    · LE DÉBIT SE MESURE, il ne se suppose pas. Un seau de ${POINT_DEAU.litres} L
      rempli en ${POINT_DEAU.secondes} s : ${DEBIT_DISPONIBLE_MOT} m³/h. Un plan
      bâti sur un débit supposé s'écroule à la mise en eau, et c'est le
      paysagiste qui revient gratuitement.
    · ON NE MÉLANGE PAS DEUX PLUVIOMÉTRIES dans un secteur. La vanne les ouvre
      ensemble, donc pour la même durée : l'un reçoit trois fois l'eau de
      l'autre. C'est le défaut le plus courant des installations reprises.
    · ATLAS N'INVENTE AUCUN PRIX. Le matériel arrive dans le devis avec ses
      QUANTITÉS ; le prix vient de « Mes prix », et reste vide et signalé quand
      il n'y est pas (règle du §4 du dépôt, et \`docs/AGENT.md\` §3).

    ————————————————————————————————————————————————————————————————
    RIEN N'EST CODÉ : \`src/\` n'est pas touché (règle du §3 bis).
    AUCUN SCRIPT : les bascules sont des \`input\` natifs, le plan est du SVG.
    Engendré par \`scripts/engendrer-maquette-arrosage.mjs\`.
    Contrôle : \`scripts/verifier-maquette-arrosage.mjs\`.
  */
${CHARTE}
  .ea,.eb,.ec{display:none}
  #e-a:checked ~ .dedans .ea,
  #e-b:checked ~ .dedans .eb,
  #e-c:checked ~ .dedans .ec{display:block}
  #e-a:checked ~ .dedans label[for="e-a"],
  #e-b:checked ~ .dedans label[for="e-b"],
  #e-c:checked ~ .dedans label[for="e-c"]{background:var(--pin);color:var(--papier);
                                          border-color:var(--pin)}

  /* A — la feuille : il saisit, Atlas additionne. */
  .fl{display:flex;align-items:center;gap:8px;min-height:52px;
      border-bottom:1px solid var(--trait);padding:6px 2px}
  .fl-nom{flex:1;min-width:0;font-size:13.5px;color:var(--gris)}
  .fl-q{flex:none;font-size:12px;color:var(--gris)}
  .fl-q input{font:inherit;font-size:15px;color:var(--encre);background:transparent;
              border:1px solid var(--trait);border-radius:8px;padding:7px 6px;
              width:44px;text-align:center}
  .fl-d{flex:none;font-size:12.5px;color:var(--encre);font-variant-numeric:tabular-nums;
        min-width:64px;text-align:right}

  .total{display:flex;justify-content:space-between;align-items:baseline;
         margin-top:14px;padding-top:12px;border-top:1px solid var(--trait);font-size:13px}
  .total .gros{font-family:Georgia,serif;font-size:21px;color:var(--encre)}
  .verdict{margin-top:12px;padding:12px 13px;border-radius:12px;background:var(--teinte);
           font-size:13px;line-height:1.6;color:var(--encre)}
  .verdict b{color:var(--alerte)}

  /* B — les zones : il mesure, Atlas pose le matériel. */
  .robinet{border:1px solid var(--trait);border-radius:14px;padding:12px 13px;margin-bottom:12px}
  .robinet .q{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--or)}
  .robinet .geste{display:flex;align-items:center;gap:8px;margin:8px 0 6px;font-size:13.5px;color:var(--gris)}
  .robinet .geste input{font:inherit;font-size:15px;color:var(--encre);background:transparent;
                        border:1px solid var(--trait);border-radius:8px;padding:8px 6px;
                        width:52px;text-align:center}
  .robinet .sort{font-size:13px;color:var(--encre)}
  .robinet .sort b{font-family:Georgia,serif;font-size:19px;font-weight:400}

  .zc{border-bottom:1px solid var(--trait);padding:11px 2px}
  .zc-nom{margin:0;font-size:15px;color:var(--encre);font-weight:600}
  .zc-mes{margin:2px 0 0;font-size:12.5px;color:var(--gris)}
  .zc-res{margin:4px 0 0;font-size:12.5px;color:var(--pin);line-height:1.5}
  .ajouter{display:block;margin-top:12px;text-align:center;padding:13px;
           border-radius:999px;border:1px dashed var(--trait);color:var(--gris);font-size:13.5px}

  /* C — le plan dessiné. */
  .plan{width:100%;height:auto;display:block;margin:6px 0 4px}
  .plan .gazon{fill:var(--teinte)}
  .plan .bordure{fill:none;stroke:var(--trait);stroke-width:1.5}
  .plan .portee{fill:var(--eau);fill-opacity:.13;stroke:var(--eau);stroke-opacity:.35;stroke-width:1}
  .plan .tete{fill:var(--pin);stroke:var(--papier);stroke-width:1.5}
  .plan .cote{fill:var(--gris);font-size:11px;text-anchor:middle;font-family:inherit}
  .plan .cote-g{text-anchor:end}

  .bouton{display:block;margin-top:16px;text-align:center;padding:15px;
          border-radius:999px;background:var(--pin);color:var(--papier);font-size:15px}
  .recap{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
  .recap span{font-size:12px;color:var(--encre);background:var(--teinte);
              border-radius:999px;padding:6px 11px}
</style>

<input type="radio" name="e" id="e-a" class="etat">
<input type="radio" name="e" id="e-b" class="etat" checked>
<input type="radio" name="e" id="e-c" class="etat">

<div class="dedans">
  <h1>Le plan d'arrosage — par où l'on entre</h1>
  <p class="intro">Votre demande du 17 août. <b>Rien n'est codé</b> — c'est votre
    règle. <b>Touchez les trois gestes</b> : c'est la seule chose à choisir ici,
    le calcul est le même dans les trois.</p>

  <p class="dit">« J'ai besoin qu'on crée <b>un outil pour les paysagistes pour
    réaliser des plans d'arrosage automatique</b>. »</p>

  <div class="reglage">
    <span class="quoi">Comment il entre son jardin</span>
    <div class="segments">
      <label for="e-a">A · La feuille — il saisit tout</label>
      <label for="e-b">B · Les zones — il mesure, Atlas pose · <b>je recommande</b></label>
      <label for="e-c">C · Le plan dessiné</label>
    </div>
  </div>

  <div class="rangee">
    <div class="tel">
      <div class="barre"><span class="ou">Arrosage</span><span class="quand">Jardin Martins</span></div>

      <div class="ea">
        <p class="titre-fiche">Ce que je pose</p>
        <p class="sous">Vous entrez les quantités, Atlas additionne.</p>
${lignesDeLaFeuille()}
        <div class="total"><span>Débit demandé</span><span class="gros">${DEBIT_DEMANDE_MOT} m³/h</span></div>
        <div class="total"><span>Débit du robinet</span><span>${DEBIT_DISPONIBLE_MOT} m³/h</span></div>
        <p class="verdict"><b>Il faut ${SECTEURS.length} secteurs.</b> Le jardin
          demande ${COMBIEN_DE_FOIS} fois le débit disponible : rien ne peut
          s'ouvrir en même temps.</p>
        <span class="bouton">Découper en secteurs</span>
      </div>

      <div class="eb">
        <p class="titre-fiche">Le point d'eau</p>
        <div class="robinet">
          <span class="q">Mesuré au seau</span>
          <p class="geste">Un seau de
            <input type="text" value="${POINT_DEAU.litres}" size="2" aria-label="Litres du seau" readonly> L
            rempli en
            <input type="text" value="${POINT_DEAU.secondes}" size="2" aria-label="Secondes de remplissage" readonly> s
          </p>
          <p class="sort">Débit disponible <b>${DEBIT_DISPONIBLE_MOT} m³/h</b> · pression ${nb(POINT_DEAU.pression, 1)} bar</p>
        </div>
        <p class="titre-fiche">Les zones</p>
        <p class="sous">Vous donnez les mesures. Atlas choisit le matériel, la pose et la durée.</p>
${cartesDesZones()}
        <span class="ajouter">+ Ajouter une zone</span>
        <div class="recap">
          <span>${SECTEURS.length} secteurs</span>
          <span>cycle ${duree(CYCLE_MINUTES)}</span>
          <span>${DEBIT_DEMANDE_MOT} m³/h demandés</span>
        </div>
        <span class="bouton">Voir le découpage</span>
      </div>

      <div class="ec">
        <p class="titre-fiche">Le plan</p>
        <p class="sous">Pelouse arrière — ${ZONES_POSEES[0].nombre} turbines, portée ${nb(ZONES_POSEES[0].mat.portee, 0)} m,
          posées tête-bêche.</p>
        ${planDeLaPelouse()}
        <p class="zc-res">Les couronnes s'arrêtent au bord du gazon : les
          arroseurs de bordure ne tournent que d'un demi-tour, ceux des coins
          d'un quart. C'est ce qui fait ${nb(ZONES_POSEES[0].debit)} m³/h au
          lieu de ${nb(ZONES_POSEES[0].nombre * ZONES_POSEES[0].mat.debit360)}.</p>
        <span class="bouton">Poser un arroseur</span>
      </div>
    </div>

    <div class="legende">
      <span class="t">Ce que chacune coûte, et ce qu'elle rend</span>
      <p><b>A · La feuille.</b> Il saisit le matériel qu'il a l'habitude de
        poser ; Atlas additionne les débits, dit combien de secteurs il faut et
        s'arrête là. C'est utile le jour même — mais ça ne fait que l'addition
        qu'il sait déjà faire.</p>
      <p><b>B · Les zones.</b> Il donne le point d'eau et les mesures de chaque
        zone. Atlas choisit le matériel, calcule la pose tête-bêche, découpe les
        secteurs et sort les durées d'arrosage par saison. <b>C'est celle qui
        rend le temps de bureau</b>, et la seule qui peut se tromper à sa place
        — donc la seule qui doit être juste.</p>
      <p><b>C · Le plan dessiné.</b> Il pose les arroseurs sur un fond de plan
        et voit les couronnes se recouvrir. C'est ce que le client comprend d'un
        coup d'œil — et ce qui coûte le plus cher : dessiner un jardin au doigt,
        c'est un écran entier, pas une case.</p>
      <p class="cout"><b>Ce que je recommande :</b> B d'abord, C ensuite. Le
        plan dessiné se pose PAR-DESSUS le calcul de B — l'inverse n'est pas
        vrai, et un joli plan qui n'a pas vérifié le débit se paie à la mise en
        eau.</p>
    </div>
  </div>

  <div class="note">
    <span class="t">Le jardin de l'exemple</span>
    <p>${ZONES.length} zones, ${DEBIT_DEMANDE_MOT} m³/h demandés pour
      ${DEBIT_DISPONIBLE_MOT} disponibles, ${SECTEURS.length} secteurs,
      ${duree(CYCLE_MINUTES)} de cycle. <b>Tous ces nombres sont calculés</b>, pas
      écrits : changez une dimension dans le script et les trois planches
      suivent. Une maquette qui compte faux fait douter de tout ce qu'elle
      montre.</p>
    <ul>
      <li><b>Ce qui reste hors du calcul pour l'instant :</b> le diamètre des
        tuyaux et les pertes de charge. Sur un jardin de cette taille en PE 32,
        ça ne change pas le découpage ; sur 80 m de ligne, si.</li>
      <li><b>Le disconnecteur n'est pas une option :</b> un réseau d'arrosage
        raccordé à l'eau potable en demande un. Il est dans la nomenclature.</li>
    </ul>
  </div>
</div>
`;

/* ══════════════════════════════════════════════════════════════════════════
   PLANCHE 70 — le débit ne se partage pas
   ══════════════════════════════════════════════════════════════════════════ */

function barresDesSecteurs() {
  return SECTEURS.map((s, i) => {
    const part = Math.round((s.debit / DEBIT_DISPONIBLE) * 100);
    return `        <div class="sec">
          <p class="sec-t"><span class="sec-n">S${i + 1}</span><span class="sec-z">${s.zone}</span>${s.part ? ` <span class="sec-part">${s.part}</span>` : ""}</p>
          <div class="jauge"><span style="width:${part}%"></span></div>
          <p class="sec-d"><span class="sec-fam">${s.famille}</span><span class="sec-q">${nb(s.debit)}</span> m³/h · <span class="sec-min">${s.minutes}</span> min · ${s.passages}×/sem.</p>
        </div>`;
  }).join("\n");
}

const PLANCHE_SECTEURS = `<title>Le débit ne se partage pas</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /*
    LE DÉCOUPAGE EN SECTEURS — le calcul qui fait tout l'outil.

    Il n'y a RIEN À CHOISIR sur cette planche : c'est de l'arithmétique, et
    elle est montrée pour être vérifiée, pas pour être préférée.

    ————————————————————————————————————————————————————————————————
    LE RAISONNEMENT, EN TROIS LIGNES

    Le robinet donne ${DEBIT_DISPONIBLE_MOT} m³/h. Le jardin en demande
    ${DEBIT_DEMANDE_MOT}, soit ${COMBIEN_DE_FOIS} fois plus. On ouvre donc les
    zones l'une APRÈS l'autre, par groupes qui tiennent dans le débit : ce sont
    les secteurs, et ici il en faut ${SECTEURS.length}.

    On ne charge jamais un secteur à ${DEBIT_DISPONIBLE_MOT} : il faut de la
    marge pour les pertes de charge, sinon les derniers arroseurs de la ligne
    bavent. La limite retenue est ${Math.round(POINT_DEAU.marge * 100)} % du
    débit, soit ${nb(DEBIT_MAX_SECTEUR)} m³/h — et AUCUN secteur ne la dépasse.

    ————————————————————————————————————————————————————————————————
    LES DEUX RÈGLES QUI DÉCOUPENT, ET QUI NE SE NÉGOCIENT PAS

    1. UN SECTEUR, UNE PLUVIOMÉTRIE. La vanne ouvre tout son secteur pour la
       même durée. Mélanger turbines (11 mm/h) et tuyères (38 mm/h) revient à
       donner trois fois trop d'eau à l'une des deux zones — quoi qu'on règle.
    2. UN SECTEUR, UN RYTHME. Le potager veut trois passages par semaine, la
       haie deux. Deux rythmes dans un secteur, c'est un des deux qui perd.

    Ces deux règles PASSENT AVANT le remplissage : mieux vaut un secteur à
    ${nb(SECTEURS[SECTEURS.length - 1].debit)} m³/h qu'un secteur mélangé plein.

    ————————————————————————————————————————————————————————————————
    CE QUE LE NOMBRE DE SECTEURS COÛTE VRAIMENT — et personne ne le voit à la
    signature du devis : chaque secteur allonge le CYCLE. Ici ${duree(CYCLE_MINUTES)},
    départ ${heure(DEPART_CYCLE)}, fin ${heure(DEPART_CYCLE + CYCLE_MINUTES)}. Un secteur de
    plus, et l'arrosage finit après le lever du soleil — donc s'évapore.

    RIEN N'EST CODÉ : \`src/\` n'est pas touché.
    Engendré par \`scripts/engendrer-maquette-arrosage.mjs\`.
  */
${CHARTE}
  .compare{border:1px solid var(--trait);border-radius:14px;padding:13px;margin-bottom:14px}
  .compare .l{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;
              color:var(--gris);margin:0 0 6px}
  .compare .l b{font-family:Georgia,serif;font-size:20px;font-weight:400;color:var(--encre)}
  .duo{height:10px;border-radius:999px;background:var(--teinte);overflow:hidden;margin-bottom:4px}
  .duo span{display:block;height:100%;background:var(--alerte)}
  .duo.ok span{background:var(--pin)}
  .compare .dit-le{margin:8px 0 0;font-size:12.5px;line-height:1.55;color:var(--encre)}
  .compare .dit-le b{color:var(--alerte)}

  .sec{padding:11px 2px;border-bottom:1px solid var(--trait)}
  .sec-t{margin:0 0 6px;font-size:14px;color:var(--encre);display:flex;align-items:baseline;gap:8px}
  .sec-n{flex:none;font-size:11px;letter-spacing:.1em;color:var(--or);
         border:1px solid var(--trait);border-radius:6px;padding:2px 6px}
  .sec-part{font-size:11.5px;color:var(--gris)}
  .jauge{height:8px;border-radius:999px;background:var(--teinte);overflow:hidden}
  .jauge span{display:block;height:100%;background:var(--eau)}
  .sec-d{margin:5px 0 0;font-size:12px;color:var(--gris);font-variant-numeric:tabular-nums}
  .sec-fam{display:inline-block;margin-right:8px;font-size:10.5px;letter-spacing:.08em;
           text-transform:uppercase;color:var(--pin)}

  .cycle{margin-top:14px;padding:12px 13px;border-radius:12px;background:var(--teinte);
         font-size:13px;line-height:1.6;color:var(--encre)}
  .cycle b{font-family:Georgia,serif;font-size:19px;font-weight:400}
</style>

<div class="dedans">
  <h1>Le débit ne se partage pas</h1>
  <p class="intro">Le calcul qui fait tout l'outil. <b>Il n'y a rien à choisir
    ici</b> — c'est de l'arithmétique, montrée pour être vérifiée. Les nombres
    sont ceux du jardin de la planche 69.</p>

  <p class="dit">Un robinet de pavillon donne <b>${DEBIT_DISPONIBLE_MOT} m³/h</b>.
    Ce jardin en demande <b>${DEBIT_DEMANDE_MOT}</b>. Tout le métier tient dans
    cet écart.</p>

  <div class="rangee">
    <div class="tel">
      <div class="barre"><span class="ou">Secteurs</span><span class="quand">Jardin Martins</span></div>

      <div class="compare">
        <p class="l"><span>Demandé, tout ouvert</span><b>${DEBIT_DEMANDE_MOT}</b></p>
        <div class="duo"><span style="width:100%"></span></div>
        <p class="l"><span>Disponible au robinet</span><b>${DEBIT_DISPONIBLE_MOT}</b></p>
        <div class="duo ok"><span style="width:${Math.round((DEBIT_DISPONIBLE / DEBIT_DEMANDE) * 100)}%"></span></div>
        <p class="dit-le"><b>${COMBIEN_DE_FOIS} fois trop.</b> Je découpe en
          ${SECTEURS.length} secteurs, aucun au-dessus de ${nb(DEBIT_MAX_SECTEUR)} m³/h.</p>
      </div>

${barresDesSecteurs()}

      <p class="cycle">Cycle complet <b>${duree(CYCLE_MINUTES)}</b><br>
        Départ ${heure(DEPART_CYCLE)}, fin ${heure(DEPART_CYCLE + CYCLE_MINUTES)} — avant le soleil,
        sinon la moitié s'évapore.</p>
    </div>

    <div class="legende">
      <span class="t">Pourquoi ${SECTEURS.length} secteurs, et pas ${SECTEURS_AU_SEUL_DEBIT}</span>
      <p><b>Le seul débit en demanderait ${SECTEURS_AU_SEUL_DEBIT}.</b> Les deux
        autres viennent des règles ci-dessous, et elles passent avant le
        remplissage.</p>
      <p><b>Une pluviométrie par secteur, un rythme par secteur.</b> Un secteur ne porte
        qu'une pluviométrie — la vanne l'ouvre en entier, pour la même durée, et
        mélanger turbines et tuyères donne trois fois trop d'eau à l'une des
        deux. Et un secteur ne porte qu'un rythme : le potager veut trois
        passages par semaine, la haie deux.</p>
      <p><b>La pelouse arrière tient en un seul secteur… sur le papier.</b>
        ${nb(ZONES_POSEES[0].debit)} m³/h pour ${nb(DEBIT_MAX_SECTEUR)} admissibles :
        elle est coupée en deux. C'est le genre de dépassement qu'on ne voit pas
        à l'œil, et qui se paie quand le dernier arroseur de la ligne bave au
        lieu d'arroser.</p>
      <p><b>Et la tuyère coûte cher en débit.</b> ${ZONES_POSEES[1].nombre} tuyères
        pour ${ZONES_POSEES[1].L} × ${ZONES_POSEES[1].l} m, ${nb(ZONES_POSEES[1].debit)} m³/h
        — quatre secteurs à elles seules, contre deux pour une pelouse deux fois
        plus grande en turbines. En échange elles arrosent en
        ${ZONES_POSEES[1].minutes} minutes ce que la turbine met
        ${ZONES_POSEES[0].minutes} minutes à faire.</p>
      <p class="cout"><b>Ce que le cycle change :</b> chaque secteur s'ajoute à
        la nuit. À ${duree(CYCLE_MINUTES)}, il faut démarrer à ${heure(DEPART_CYCLE)}.
        C'est cela qu'il faut dire au client AVANT de poser, pas après.</p>
    </div>
  </div>

  <div class="note">
    <span class="t">Ce que ce découpage n'a pas encore</span>
    <ul>
      <li><b>Les saisons.</b> Ces durées sont celles de juillet. En avril, le
        besoin tombe de moitié — l'outil devra sortir un tableau par saison,
        c'est ce que le client colle dans son coffret.</li>
      <li><b>La pluie.</b> Une sonde de pluie coupe le cycle : c'est une ligne
        de nomenclature, pas un calcul.</li>
      <li><b>Les pertes de charge.</b> Voir la planche 69 : sans effet ici,
        déterminantes sur une longue ligne.</li>
    </ul>
  </div>
</div>
`;

/* ══════════════════════════════════════════════════════════════════════════
   PLANCHE 71 — ce qui sort du plan
   ══════════════════════════════════════════════════════════════════════════ */

function lignesDeNomenclature() {
  return NOMENCLATURE.map(
    (l) => `        <div class="nl">
          <span class="nl-nom">${l.nom}</span>
          <span class="nl-q">${l.quantite} ${l.unite}</span>
          <span class="nl-p${l.connu ? "" : " manque"}">${l.connu ? "à votre tarif" : "prix absent"}</span>
        </div>`
  ).join("\n");
}

function lignesDeProgrammation() {
  return SECTEURS.map(
    (s, i) => `        <div class="pl">
          <span class="pl-n">S${i + 1}</span>
          <span class="pl-z">${s.zone}${s.part ? ` (${s.part})` : ""}</span>
          <span class="pl-m">${s.minutes} min</span>
          <span class="pl-j">${s.passages}×/sem.</span>
        </div>`
  ).join("\n");
}

const PLANCHE_SORTIES = `<title>Ce qui sort du plan</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /*
    CE QUI SORT DU PLAN — trois documents, et l'ordre dans lequel les écrire.

    Le plan d'arrosage n'a d'intérêt que par ce qu'il produit. Trois sorties
    possibles, et elles ne se valent pas :

    A · LE DEVIS. La nomenclature part dans le parcours qui existe déjà —
        devis, envoi au client, acceptation, facture. C'est la sortie qui
        RAPPORTE, et elle ne demande aucune plomberie nouvelle.
    B · LA CARTE DE PROGRAMMATION. Ce qu'on colle dans le coffret : secteur,
        minutes, jours. C'est ce que le client redemande six mois plus tard,
        et c'est aujourd'hui un papier manuscrit qui se perd.
    C · LE PLAN REMIS AU CLIENT. Le dessin des couronnes. Le plus beau, le plus
        cher, et le seul dont on peut se passer la première année.

    ————————————————————————————————————————————————————————————————
    ATLAS N'INVENTE AUCUN PRIX — règle du §4 du dépôt.

    La nomenclature sort avec ses QUANTITÉS. Le prix vient de « Mes prix » ; ce
    qui n'y est pas arrive VIDE ET SIGNALÉ (« prix absent »), jamais estimé.
    Deux lignes le sont ici volontairement : c'est ce que le patron doit voir,
    parce que c'est ce qu'il devra compléter une fois pour toutes.

    RIEN N'EST CODÉ : \`src/\` n'est pas touché.
    Engendré par \`scripts/engendrer-maquette-arrosage.mjs\`.
  */
${CHARTE}
  .sa,.sb,.sc{display:none}
  #s-a:checked ~ .dedans .sa,
  #s-b:checked ~ .dedans .sb,
  #s-c:checked ~ .dedans .sc{display:block}
  #s-a:checked ~ .dedans label[for="s-a"],
  #s-b:checked ~ .dedans label[for="s-b"],
  #s-c:checked ~ .dedans label[for="s-c"]{background:var(--pin);color:var(--papier);
                                          border-color:var(--pin)}

  .nl{display:flex;align-items:baseline;gap:8px;padding:9px 2px;
      border-bottom:1px solid var(--trait)}
  .nl-nom{flex:1;min-width:0;font-size:13.5px;color:var(--encre)}
  .nl-q{flex:none;font-size:12.5px;color:var(--gris);font-variant-numeric:tabular-nums}
  .nl-p{flex:none;font-size:11px;color:var(--gris);min-width:74px;text-align:right}
  .nl-p.manque{color:var(--alerte)}

  .pl{display:flex;align-items:baseline;gap:8px;padding:10px 2px;
      border-bottom:1px solid var(--trait);font-variant-numeric:tabular-nums}
  .pl-n{flex:none;font-size:11px;letter-spacing:.1em;color:var(--or);
        border:1px solid var(--trait);border-radius:6px;padding:2px 6px}
  .pl-z{flex:1;min-width:0;font-size:13px;color:var(--encre)}
  .pl-m{flex:none;font-size:13px;color:var(--encre)}
  .pl-j{flex:none;font-size:11.5px;color:var(--gris)}

  .avert{margin-top:12px;padding:11px 12px;border-radius:12px;background:var(--teinte);
         font-size:12.5px;line-height:1.6;color:var(--encre)}
  .avert b{color:var(--alerte)}
  .saison{display:flex;gap:6px;margin:10px 0 2px;flex-wrap:wrap}
  .saison span{font-size:11.5px;color:var(--gris);border:1px solid var(--trait);
               border-radius:999px;padding:5px 10px}
  .saison span.ici{background:var(--pin);color:var(--papier);border-color:var(--pin)}
  .bouton{display:block;margin-top:16px;text-align:center;padding:15px;
          border-radius:999px;background:var(--pin);color:var(--papier);font-size:15px}
  .plan-mini{width:100%;height:auto;display:block;margin:8px 0 4px;
             border:1px solid var(--trait);border-radius:12px}
  .plan-mini .gazon{fill:var(--teinte)}
  .plan-mini .portee{fill:var(--eau);fill-opacity:.13;stroke:var(--eau);stroke-opacity:.35}
  .plan-mini .tete{fill:var(--pin);stroke:var(--papier);stroke-width:1.5}
  .plan-mini .bordure{fill:none;stroke:var(--trait);stroke-width:1.5}
  .plan-mini .cote{fill:var(--gris);font-size:11px;text-anchor:middle;font-family:inherit}
  .plan-mini .cote-g{text-anchor:end}
</style>

<input type="radio" name="s" id="s-a" class="etat" checked>
<input type="radio" name="s" id="s-b" class="etat">
<input type="radio" name="s" id="s-c" class="etat">

<div class="dedans">
  <h1>Ce qui sort du plan</h1>
  <p class="intro">Trois documents, et ils ne se valent pas. <b>Ce qu'il y a à
    choisir : par lequel on commence.</b> Le jardin est celui des planches 69
    et 70 — mêmes nombres, calculés une seule fois.</p>

  <p class="dit">Un plan d'arrosage ne vaut que par ce qu'il produit :
    <b>un devis</b> qu'on signe, <b>une carte</b> qu'on colle dans le coffret,
    <b>un plan</b> qu'on remet au client.</p>

  <div class="reglage">
    <span class="quoi">Ce qui sort</span>
    <div class="segments">
      <label for="s-a">A · Le devis · <b>je recommande</b></label>
      <label for="s-b">B · La carte de programmation</label>
      <label for="s-c">C · Le plan pour le client</label>
    </div>
  </div>

  <div class="rangee">
    <div class="tel">
      <div class="barre"><span class="ou">Arrosage</span><span class="quand">Jardin Martins</span></div>

      <div class="sa">
        <p class="titre-fiche">La liste pour le fournisseur</p>
        <p class="sous">${NOMENCLATURE.length} lignes de quantités. Aucun prix : c'est lui qui les rend.</p>
${lignesDeNomenclature()}
        <p class="avert"><b>${MANQUANTS_MOT} prix ${PRIX_MANQUANTS > 1 ? "manquent" : "manque"}</b> dans « Mes prix ». Atlas ne
          les invente pas : la ligne part vide et signalée, et le devis vous
          attend dessus.</p>
        <span class="bouton">En faire un devis</span>
      </div>

      <div class="sb">
        <p class="titre-fiche">La carte du coffret</p>
        <p class="sous">Ce que le client retrouve six mois plus tard.</p>
        <div class="saison">
          <span>Avril</span><span>Mai–juin</span><span class="ici">Juillet–août</span><span>Septembre</span>
        </div>
${lignesDeProgrammation()}
        <p class="avert">Départ ${heure(DEPART_CYCLE)} · cycle ${duree(CYCLE_MINUTES)} ·
          fin ${heure(DEPART_CYCLE + CYCLE_MINUTES)}. Programmateur ${VOIES} voies,
          ${VOIES_LIBRES === 0 ? "<b>aucune voie libre</b> — un massif de plus et il faut le changer" : `${VOIES_LIBRES} voie(s) libre(s)`}.</p>
        <span class="bouton">Envoyer au client</span>
      </div>

      <div class="sc">
        <p class="titre-fiche">Le plan remis</p>
        <p class="sous">Pelouse arrière — ${ZONES_POSEES[0].nombre} turbines, couronnes de ${nb(ZONES_POSEES[0].mat.portee, 0)} m.</p>
        ${planDeLaPelouse().replace('class="plan"', 'class="plan-mini"')}
        <p class="sous">Le même dessin qu'à la saisie, sans les cotes de pose.
          C'est ce que le client comprend d'un coup d'œil — et ce qu'il montre
          au prochain artisan.</p>
        <span class="bouton">Joindre au devis</span>
      </div>
    </div>

    <div class="legende">
      <span class="t">Par lequel commencer</span>
      <p><b>A · Le devis.</b> La nomenclature entre dans le parcours qui existe
        déjà : devis, envoi, acceptation, facture. <b>Aucune plomberie
        nouvelle</b> — et c'est la seule sortie qui rapporte de l'argent.</p>
      <p><b>B · La carte de programmation.</b> Aujourd'hui c'est un papier
        manuscrit dans le coffret, et il se perd. Elle coûte peu, et c'est elle
        qu'on rappelle au paysagiste en juin quand la pelouse jaunit.</p>
      <p><b>C · Le plan.</b> Le plus beau, le plus cher. Il suppose l'écran de
        dessin de la planche 69 — donc il vient forcément après.</p>
      <p class="cout"><b>Et une chose qui n'est pas à choisir :</b> rien ne part
        tout seul. Le mot « automatique » désigne l'arrosage, pas l'expédition —
        le devis et la carte partent d'un geste du patron, comme tout le
        reste (<code>docs/A-FAIRE.md</code> §5).</p>
    </div>
  </div>

  <div class="note">
    <span class="t">Ce que ça touche dans Atlas, et ce que ça n'ouvre pas</span>
    <ul>
      <li><b>Le devis existe déjà</b> : lignes, quantités, unités, TVA, envoi,
        acceptation. La nomenclature s'y verse — elle n'a pas de parcours à
        elle.</li>
      <li><b>Les prix viennent de « Mes prix »</b>, à la lettre près sur
        l'unité (piège du §101 de <code>ARCHITECTURE.md</code> : « jours/homme »
        mal tapé faisait cesser la multiplication en silence).</li>
      <li><b>L'entretien de l'arrosage rejoint la fiche d'entretien</b> : mise
        en route au printemps, hivernage à l'automne. Deux lignes de plus dans
        le modèle, pas un troisième parcours.</li>
      <li><b>Ce qui n'est pas ouvert :</b> le calcul des pertes de charge et le
        dimensionnement des tuyaux. À dire au patron plutôt qu'à laisser
        croire.</li>
    </ul>
  </div>
</div>
`;

/* ══════════════════════════════════════════════════════════════════════════ */

writeFileSync(join(DOSSIER, "69-le-plan-darrosage.html"), PLANCHE_ENTREE);
writeFileSync(join(DOSSIER, "70-le-debit-ne-se-partage-pas.html"), PLANCHE_SECTEURS);
writeFileSync(join(DOSSIER, "71-ce-qui-sort-du-plan.html"), PLANCHE_SORTIES);

console.log("Planches engendrées :");
console.log("  · 69-le-plan-darrosage.html");
console.log("  · 70-le-debit-ne-se-partage-pas.html");
console.log("  · 71-ce-qui-sort-du-plan.html");
console.log(
  `\n  ${DEBIT_DISPONIBLE_MOT} m³/h disponibles · ${DEBIT_DEMANDE_MOT} demandés · ` +
    `${SECTEURS.length} secteurs · cycle ${duree(CYCLE_MINUTES)}`
);
for (const [i, s] of SECTEURS.entries()) {
  console.log(`   S${i + 1} ${s.zone}${s.part ? ` (${s.part})` : ""} — ${nb(s.debit)} m³/h, ${s.minutes} min`);
}
