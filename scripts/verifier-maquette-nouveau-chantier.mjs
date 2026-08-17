#!/usr/bin/env node
/*
  Éprouve la maquette 67, JAVASCRIPT COUPÉ.

  **Ce qu'elle sert à trancher.** Le patron, le 16 août 2026, capture à
  l'appui : *« le nouveau chantier fait le plus gros et en gras »*. Trois
  formes, trois tailles, trois graisses — et un témoin figé à côté, sans quoi
  « plus gros » ne se compare à rien.

  **LE CONTRÔLE QUI COMPTE VRAIMENT EST CELUI DE LA COUPURE.** Un mot qu'on
  grossit finit par ne plus tenir, et « Nouveau chantier » coupé en « Nouveau
  chan… » serait pire que le libellé minuscule d'aujourd'hui. Le budget n'est
  pas mesuré sur la planche mais reconstruit : l'écran le plus étroit qu'il
  utilise fait 360 px, l'écran des chantiers garde 26 px de marge de chaque
  côté (`EcranChantiers.tsx`), il reste donc 308 px pour le mot, l'écart de
  13 px et le rond. Mesurer la boîte de la planche à la place aurait rendu un
  faux rouge : à 360 px, la page a ses propres marges et rétrécit le téléphone
  en dessous de la largeur réelle.

  **Aucune mesure n'est prise sans avoir compté d'abord** (`CLAUDE.md` §5) : une
  boîte de zéro pixel rend « rien n'est coupé » en vert sans rien prouver — le
  défaut du 15 août 2026, trouvé sur une capture et par aucun contrôle. Ici, une
  largeur nulle est un échec, pas un succès.

  Les autres contrôles :

    1. les trois formes existent SANS SCRIPT, une seule affichée à la fois ;
    2. **la taille et la graisse suivent vraiment les réglages**, sur les trois
       formes : neuf combinaisons par forme, pas seulement celle d'ouverture.
       C'est le sens de sa demande — une planche qu'il essaie, pas une photo ;
    3. **le témoin ne bouge JAMAIS** — 9 px, graisse 500, rond de 38 px, les
       valeurs relevées dans `globals.css`. Un repère qui suivrait les réglages
       ne comparerait plus rien, et c'est exactement le piège dans lequel une
       suite est déjà tombée ;
    4. **chaque cran est strictement plus gros que le témoin**, et les trois
       crans sont ordonnés. « Plus gros » qui rendrait la même taille serait une
       planche qui ment ;
    5. **aucun aplat plein** : le rond reste un anneau d'un cheveu, sur les trois
       formes. Le patron a refusé le bouton vert le 11 août, et une maquette qui
       le réintroduirait ferait rouvrir un débat clos.

  **Il sait échouer, et il nomme le défaut plutôt que le sélecteur.** Porter le
  cran « le plus gros » à 22 px rend le contrôle de coupure rouge en donnant les
  pixels manquants ; figer `--gras` rend le 2 rouge ; faire suivre le témoin aux
  réglages rend le 3 rouge.

  Usage : node scripts/verifier-maquette-nouveau-chantier.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "67-le-nouveau-chantier-plus-gros.html"),
);

if (!existsSync(CIBLE)) {
  console.error(`La maquette n'existe pas : ${CIBLE}`);
  process.exit(1);
}

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

const FORMES = [
  { radio: "f-a", nom: "A · Les capitales", panneau: ".f-a" },
  { radio: "f-b", nom: "B · La serif du titre", panneau: ".f-b" },
  { radio: "f-c", nom: "C · Toute la largeur", panneau: ".f-c" },
];
// Les tailles attendues, forme par forme : les capitales et la serif ne se
// mesurent pas au même chiffre pour un même cran — une serif de 17 px paraît
// deux fois plus petite qu'une capitale de 17 px.
const TAILLES = [
  { radio: "t-1", nom: "Gros", caps: 13, serif: 20, rond: 42 },
  { radio: "t-2", nom: "Plus gros", caps: 15, serif: 23, rond: 46 },
  { radio: "t-3", nom: "Le plus gros", caps: 17, serif: 26, rond: 50 },
];
const GRAISSES = [
  { radio: "g-1", nom: "Celle d’aujourd’hui", poids: 500 },
  { radio: "g-2", nom: "Gras", poids: 700 },
  { radio: "g-3", nom: "Très gras", poids: 800 },
];

// Ce que l'écran des chantiers laisse vraiment au mot, sur le plus étroit de
// ses téléphones. 26 px de marge de chaque côté, et 13 px entre le mot et le
// rond — les trois viennent de `EcranChantiers.tsx` et de `globals.css`.
const ECRAN_ETROIT = 360;
const MARGE = 26;
const ECART = 13;
const BUDGET = ECRAN_ETROIT - 2 * MARGE;

// Le témoin, relevé dans `globals.css` : `.atlas-mot` et `.atlas-rond`.
const TEMOIN = { taille: 9, poids: 500, rond: 38 };

const contexte = await navigateur.newContext({
  // 430 px : assez large pour que le téléphone de la planche s'affiche à sa
  // taille pleine (390 px). La coupure, elle, se juge sur le budget de 308 px
  // reconstruit plus haut, pas sur cette fenêtre.
  viewport: { width: 430, height: 1400 },
  javaScriptEnabled: false, // son lecteur n'en exécute pas — la planche non plus
});
const page = await contexte.newPage();
// `networkidle`, et non `domcontentloaded` : sans la mise en page appliquée,
// toutes les largeurs valent 0 — et 0 passe au vert en ne prouvant rien.
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La maquette 67 grossit-elle sans couper ? ===\n");
console.log(`    (budget reconstruit : ${ECRAN_ETROIT} − 2 × ${MARGE} = ${BUDGET} px pour le mot, l'écart et le rond)\n`);

/** Les mesures d'un mot affiché — et jamais une boîte vide rendue pour bonne. */
const mesurer = async (selecteur) => {
  const boite = await page.locator(selecteur).boundingBox();
  if (!boite || boite.width < 1 || boite.height < 1) return null;
  const style = await page
    .locator(selecteur)
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        taille: Number.parseFloat(s.fontSize),
        poids: Number.parseInt(s.fontWeight, 10),
        lignes: el.getClientRects().length,
        deborde: el.scrollWidth > el.clientWidth + 1,
      };
    });
  return { ...boite, ...style };
};

// ── 1. Une forme à la fois ──────────────────────────────────────────────────
for (const f of FORMES) {
  await page.click(`label[for="${f.radio}"]`);
  const vues = [];
  for (const autre of FORMES) {
    if ((await page.locator(`.action${autre.panneau}:visible`).count()) > 0) vues.push(autre.radio);
  }
  dire(
    vues.length === 1 && vues[0] === f.radio,
    `${f.nom} s'affiche seule (vues : ${vues.join(", ") || "aucune"})`,
  );
}

// ── 2, 4, 5 : les neuf combinaisons de chaque forme ─────────────────────────
for (const f of FORMES) {
  const serif = f.radio === "f-b";
  const vues = [];
  for (const t of TAILLES) {
    for (const g of GRAISSES) {
      await page.click(`label[for="${f.radio}"]`);
      await page.click(`label[for="${t.radio}"]`);
      await page.click(`label[for="${g.radio}"]`);
      const cas = `${f.radio} · ${t.nom} · ${g.nom}`;

      const mot = await mesurer(`${f.panneau} .mot`);
      if (!mot) {
        // Une boîte de zéro pixel n'est pas un succès : c'est une mesure
        // impossible, et la traiter en vert est le défaut du 15 août.
        dire(false, `${cas} : le mot ne se mesure pas (boîte vide — rien n'a été éprouvé)`);
        continue;
      }
      const rond = await page.locator(`${f.panneau} .rond`).boundingBox();
      if (!rond || rond.width < 1) {
        dire(false, `${cas} : le rond ne se mesure pas (boîte vide)`);
        continue;
      }

      const attendue = serif ? t.serif : t.caps;
      dire(
        Math.abs(mot.taille - attendue) < 0.5,
        `${cas} : le mot fait ${mot.taille} px (${attendue} attendus)`,
      );
      dire(
        mot.poids === g.poids,
        `${cas} : la graisse est ${mot.poids} (${g.poids} attendue)`,
      );
      dire(
        Math.abs(rond.width - t.rond) < 0.5,
        `${cas} : le rond fait ${rond.width} px (${t.rond} attendus)`,
      );

      // Le contrôle qui compte : tient-il sur son écran le plus étroit ?
      const total = mot.width + ECART + rond.width;
      dire(
        total <= BUDGET,
        `${cas} : tient sur un écran de ${ECRAN_ETROIT} px — ${total.toFixed(0)} px pour ${BUDGET}` +
          (total > BUDGET ? ` (il manque ${(total - BUDGET).toFixed(0)} px, le mot serait coupé)` : ""),
      );
      dire(!mot.deborde && mot.lignes === 1, `${cas} : le mot tient sur une seule ligne, sans « … »`);

      // Plus gros que ce qu'il a aujourd'hui : c'est toute la demande.
      dire(
        mot.taille > TEMOIN.taille,
        `${cas} : plus gros qu'aujourd'hui (${mot.taille} px contre ${TEMOIN.taille})`,
      );

      vues.push({ cas: `${t.radio}/${g.radio}`, taille: mot.taille, largeur: mot.width });

      // Aucun aplat : le rond reste un anneau d'un cheveu.
      const cerne = await page
        .locator(`${f.panneau} .rond .cerne`)
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return { fond: s.backgroundColor, bord: Number.parseFloat(s.borderTopWidth) };
        });
      const plein = !/^rgba\(0, 0, 0, 0\)$|transparent/.test(cerne.fond);
      dire(
        !plein && cerne.bord <= 1.5,
        `${cas} : le rond reste un anneau (bord ${cerne.bord} px, fond ${cerne.fond}) — pas l'aplat refusé le 11 août`,
      );
    }
  }

  // Les trois crans doivent être ORDONNÉS : « plus gros » qui rendrait la même
  // taille ferait choisir sur une différence qui n'existe pas.
  const parCran = TAILLES.map((t) => vues.find((v) => v.cas.startsWith(`${t.radio}/g-2`)));
  if (parCran.every(Boolean)) {
    dire(
      parCran[0].taille < parCran[1].taille && parCran[1].taille < parCran[2].taille,
      `${f.nom} : les trois crans grossissent vraiment (${parCran.map((v) => `${v.taille}px`).join(" < ")})`,
    );
  } else {
    dire(false, `${f.nom} : les trois crans n'ont pas pu être lus`);
  }
}

// ── 3. Le témoin ne bouge jamais ────────────────────────────────────────────
for (const t of TAILLES) {
  for (const g of GRAISSES) {
    await page.click(`label[for="${t.radio}"]`);
    await page.click(`label[for="${g.radio}"]`);
    const temoin = await mesurer('[data-atlas="mot-temoin"]');
    if (!temoin) {
      dire(false, `témoin sous ${t.radio}/${g.radio} : il ne se mesure pas (boîte vide)`);
      continue;
    }
    dire(
      Math.abs(temoin.taille - TEMOIN.taille) < 0.5 && temoin.poids === TEMOIN.poids,
      `le témoin reste à ${TEMOIN.taille} px / ${TEMOIN.poids} sous ${t.radio} et ${g.radio}` +
        ` (vu ${temoin.taille} px / ${temoin.poids})`,
    );
    const rondTemoin = await page.locator('[data-atlas="temoin"] .rond').boundingBox();
    dire(
      Boolean(rondTemoin) && Math.abs(rondTemoin.width - TEMOIN.rond) < 0.5,
      `le rond du témoin reste à ${TEMOIN.rond} px (vu ${rondTemoin ? rondTemoin.width : "rien"})`,
    );
  }
}

// ── Une capture, parce que trois défauts de ce dépôt sont sortis d'une image
// et d'aucun test (`CLAUDE.md` §5).
await page.click('label[for="f-a"]');
await page.click('label[for="t-3"]');
await page.click('label[for="g-2"]');
const capture = join(RACINE, "docs", "maquettes", "images", "67-le-plus-gros.png");
await page.locator(".tel").screenshot({ path: capture });
console.log(`\n  → capture : ${capture}`);

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n=== La maquette 67 tient : plus gros, en gras, et jamais coupé. ==="
    : `\n=== ${plaintes.length} défaut(s) ===\n${plaintes.map((p) => `  · ${p}`).join("\n")}`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
