#!/usr/bin/env node
/*
  Éprouve la maquette 68, JAVASCRIPT COUPÉ.

  **Ce qu'elle sert à trancher.** Le patron, le 17 août 2026 : *« tout comme on
  ajoute une ligne avec un petit plus, il faudrait qu'on ait un petit moins pour
  supprimer la ligne de la réduction »*. Trois façons de poser ce geste, et
  elles ne coûtent pas la même chose.

  **LE CONTRÔLE QUI COMPTE LE PLUS EST L'ARITHMÉTIQUE**, comme pour la 61 : une
  planche de devis dont les totaux ne tombent pas juste apprend à douter des
  totaux du vrai, et pire, elle ferait choisir un geste sur des chiffres faux.
  Les montants sont les SIENS, relevés sur sa capture — 1 850,00 € HT, 5 %. Ils
  sont recalculés ici à partir des lignes lues à l'écran, jamais recopiés de la
  planche : sans quoi le contrôle et la planche se tromperaient ensemble.

  **ET LES DEUX ÉTATS SONT ÉPROUVÉS, pas seulement celui d'ouverture.** Il
  touchera « Une fois retirés » — c'est même tout l'objet de la planche. Un
  contrôle qui ne regarderait que l'état « avec les 5 % » laisserait passer une
  colonne de chiffres faux, et le TTC plein est justement celui qu'il vérifiera.

  Les autres contrôles :

    1. les trois gestes existent SANS SCRIPT, un seul à la fois ;
    2. **le geste disparaît une fois la remise partie.** C'est exactement le
       défaut qu'on vient de réparer dans l'application : une ligne or « 0 % »
       qui survivait à son propre retrait. Une planche qui le reproduirait
       ferait choisir un geste qui ment ;
    3. **le « − » de B se touche** : au moins 24 px de côté. Un rond de 16 px
       dessiné à la souris se rate au doigt, et c'est sur un téléphone qu'il
       s'en sert ;
    4. **la TVA n'est JAMAIS calculée sur le prix plein tant que la remise est
       là.** 20 % de 1 850 font 370,00 € et non 351,50 € : un devis parti avec
       cette TVA-là est une déclaration fausse.

  **Il sait échouer, et il nomme le défaut plutôt que le sélecteur.** Changer
  1 757,50 en 1 750,00 rend l'arithmétique rouge en donnant l'écart ; laisser le
  « − » visible sur l'état « une fois retirés » rend le 2 rouge. Aucune boîte
  n'est mesurée sans avoir compté d'abord : une mesure sur du vide rend 0, et 0
  passe au vert en ne prouvant rien (`CLAUDE.md` §5).

  Usage : node scripts/verifier-maquette-retirer-remise.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "68-retirer-le-prix-accorde.html"),
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

/** « 1 850,00 € » et « − 92,50 € » deviennent 1850 et -92.5. */
const enNombre = (t) => {
  const signe = /[−-]/.test(t.trim()[0] ?? "") ? -1 : 1;
  const n = Number(t.replace(/[^\d,.]/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? signe * n : NaN;
};
const proche = (a, b) => Math.abs(a - b) < 0.005;

const GESTES = [
  { radio: "g-a", nom: "A · Glisser la ligne", panneau: ".et-a", legende: ".l-a" },
  { radio: "g-b", nom: "B · Le petit « − »", panneau: ".et-b", legende: ".l-b" },
  { radio: "g-c", nom: "C · La ligne du bas bascule", panneau: ".et-c", legende: ".l-c" },
];

const TAUX = 20;
const POURCENT = 5;

const contexte = await navigateur.newContext({
  viewport: { width: 430, height: 1200 },
  javaScriptEnabled: false, // son lecteur n'en exécute pas — la planche non plus
});
const page = await contexte.newPage();
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La maquette 68 tombe-t-elle juste ? ===\n");

// ── Ce que les prestations valent, LUES à l'écran ───────────────────────────
const prixLignes = (await page.locator(".lg span:last-child").allInnerTexts()).map(enNombre);
if (prixLignes.length === 0 || prixLignes.some((n) => !Number.isFinite(n))) {
  dire(false, `les prestations ne se lisent pas : ${JSON.stringify(prixLignes)}`);
} else {
  dire(true, `${prixLignes.length} prestations lues à l'écran`);
}
const plein = prixLignes.reduce((s, n) => s + n, 0);
const remise = (plein * POURCENT) / 100;
const net = plein - remise;
const attendu = {
  avant: { remise, net, tva: (net * TAUX) / 100, ttc: net + (net * TAUX) / 100 },
  apres: { tva: (plein * TAUX) / 100, ttc: plein + (plein * TAUX) / 100 },
};

/** Les montants affichés dans le bloc des totaux, dans l'ordre de l'écran. */
async function montantsVisibles() {
  const lignes = page.locator(".totaux .tot:visible");
  const n = await lignes.count();
  if (n === 0) throw new Error("le bloc des totaux est vide : rien à mesurer");
  const lus = [];
  for (let i = 0; i < n; i++) {
    const textes = await lignes.nth(i).locator("span:visible").allInnerTexts();
    for (const t of textes) {
      const v = enNombre(t);
      if (Number.isFinite(v) && /[€]/.test(t)) lus.push(v);
    }
  }
  return lus;
}

// ── 1. Les trois gestes existent, un seul à la fois ─────────────────────────
console.log("\n— Les trois gestes —");
for (const g of GESTES) {
  await page.click(`label[for="${g.radio}"]`);
  const autres = GESTES.filter((x) => x !== g);
  const legendeVue = await page.locator(g.legende).isVisible();
  const autresVues = [];
  for (const a of autres) if (await page.locator(a.legende).isVisible()) autresVues.push(a.nom);
  dire(
    legendeVue && autresVues.length === 0,
    `${g.nom} : sa description s'affiche seule${autresVues.length ? ` — ${autresVues.join(", ")} aussi` : ""}`,
  );
}

// ── 2. L'arithmétique, dans les DEUX états ──────────────────────────────────
console.log("\n— Les montants, avec la remise puis sans —");
await page.click('label[for="g-b"]');

await page.click('label[for="e-avant"]');
const avecRemise = await montantsVisibles();
for (const [quoi, valeur] of [
  ["le prix plein", plein],
  ["la remise", -attendu.avant.remise],
  ["le net", attendu.avant.net],
  ["la TVA du net", attendu.avant.tva],
  ["le TTC", attendu.avant.ttc],
]) {
  dire(
    avecRemise.some((n) => proche(n, valeur)),
    `avec les ${POURCENT} % : ${quoi} vaut ${valeur.toFixed(2)} €${
      avecRemise.some((n) => proche(n, valeur)) ? "" : ` — lus : ${avecRemise.map((n) => n.toFixed(2)).join(", ")}`
    }`,
  );
}
dire(
  !avecRemise.some((n) => proche(n, attendu.apres.tva)) && !avecRemise.some((n) => proche(n, attendu.apres.ttc)),
  `la TVA n'est pas calculée sur le prix plein tant que la remise est là (${attendu.apres.tva.toFixed(2)} € interdit)`,
);

await page.click('label[for="e-apres"]');
const sansRemise = await montantsVisibles();
for (const [quoi, valeur] of [
  ["le total HT", plein],
  ["la TVA pleine", attendu.apres.tva],
  ["le TTC plein", attendu.apres.ttc],
]) {
  dire(
    sansRemise.some((n) => proche(n, valeur)),
    `une fois retirés : ${quoi} vaut ${valeur.toFixed(2)} €${
      sansRemise.some((n) => proche(n, valeur)) ? "" : ` — lus : ${sansRemise.map((n) => n.toFixed(2)).join(", ")}`
    }`,
  );
}
dire(
  !sansRemise.some((n) => proche(n, -attendu.avant.remise)),
  "une fois retirés, plus aucun montant de remise ne traîne",
);

// ── 3. Le geste disparaît une fois la remise partie ─────────────────────────
console.log("\n— Le geste ne survit pas à son propre effet —");
for (const g of GESTES.filter((x) => x.radio !== "g-c")) {
  await page.click(`label[for="${g.radio}"]`);
  await page.click('label[for="e-apres"]');
  dire(
    !(await page.locator(`.totaux ${g.panneau}`).first().isVisible()),
    `${g.nom} : rien à retirer, donc plus de geste — c'est le défaut qu'on vient de réparer`,
  );
}
// C bascule au lieu de disparaître : elle doit alors PROPOSER, jamais retirer.
await page.click('label[for="g-c"]');
await page.click('label[for="e-apres"]');
const basBas = (await page.locator(".bascule:visible").allInnerTexts()).join(" ");
dire(
  basBas.includes("+") && !basBas.includes("Retirer"),
  `C · une fois retirée, la ligne du bas repropose au lieu de retirer — lue : « ${basBas.trim()} »`,
);

// ── 4. Le « − » de B se touche ──────────────────────────────────────────────
console.log("\n— Le « − » se touche —");
await page.click('label[for="g-b"]');
await page.click('label[for="e-avant"]');
const moins = page.locator(".moins").first();
if ((await moins.count()) === 0 || !(await moins.isVisible())) {
  dire(false, "le « − » de la proposition B n'existe pas : rien à mesurer");
} else {
  const b = await moins.boundingBox();
  dire(
    !!b && b.width >= 24 && b.height >= 24,
    `le « − » fait ${b ? `${Math.round(b.width)} × ${Math.round(b.height)}` : "?"} px — au doigt, il en faut 24`,
  );
  // Il doit être DANS la ligne or, pas ailleurs : un « − » égaré retirerait
  // visuellement autre chose que ce qu'il retire.
  const ligne = await page.locator(".tot.or:visible").first().boundingBox();
  dire(
    !!b && !!ligne && b.y >= ligne.y - 2 && b.y + b.height <= ligne.y + ligne.height + 2,
    "le « − » est bien dans la ligne du prix accordé, et pas à côté",
  );
}

await navigateur.close();
console.log(
  `\n${plaintes.length === 0 ? "✅" : "❌"} Maquette 68 — ${plaintes.length} défaut(s).`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
