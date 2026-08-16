// Les trois façons de placer le rappel sur l'accueil, PHOTOGRAPHIÉES.
//
// **Sa question du 16 août 2026 :** *« fais-moi la capture des trois cas »* —
// après que l'accueil lui a été décrit : il ne montre que DEUX cartes, et les
// rappels ferment la marche. Avec deux réponses de clients en cours, la sienne
// passe derrière « 1 autre devis à regarder ».
//
// **Pourquoi photographier plutôt que dessiner.** Une maquette dirait ce que je
// crois ; ces trois images disent ce que l'application fait. Le montage pose
// exactement l'état qui l'inquiète — deux réponses de clients ET son rappel —
// puis joue les trois dispositions sur l'écran réel.
//
// Les deux variantes ne touchent PAS le produit : elles sont posées à la volée
// dans le navigateur, sur le rendu déjà là (l'ordre des cartes, le nombre
// visible). Ce que la capture montre est donc la vraie mise en page, sans
// qu'aucune ligne de l'application ait bougé.
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-rang-du-rappel.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const echecs: string[] = [];

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

// Le chantier qui dort : ouvert il y a quatorze jours, aucun devis parti.
await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.locator('input[placeholder="Bernard"]').fill("Felicie");
await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
await page.click('button:has-text("Créer le chantier")');
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
const chantierId = page.url().split("/").pop()!.split("?")[0];
const vieilli = await pool.query(
  `UPDATE chantiers SET created_at = now() - interval '14 days' WHERE id = $1`,
  [chantierId]
);
if (vieilli.rowCount !== 1) {
  throw new Error("le montage n'a pas pu vieillir le chantier : les trois images seraient fausses");
}

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

/** Combien de cartes l'écran porte en tout, et lesquelles se voient. */
async function etat() {
  return page.evaluate(() => {
    const titres = [...document.querySelectorAll<HTMLElement>('[data-atlas="carte-reponse"]')].map(
      (c) => (c.querySelector("p")?.textContent ?? "").trim()
    );
    const replie = document.body.innerText.match(/(\d+) autres? devis à regarder/);
    return { visibles: titres, repliees: replie ? Number(replie[1]) : 0 };
  });
}

const avant = await etat();
if (avant.visibles.length + avant.repliees < 3) {
  echecs.push(
    `l'accueil ne porte que ${avant.visibles.length + avant.repliees} carte(s) : ` +
      "le cas qui l'inquiète — deux réponses ET son rappel — n'est pas reproduit, " +
      "et les trois images ne compareraient rien"
  );
}

// ── A. Ce qui existe aujourd'hui ───────────────────────────────────────────
await page.screenshot({ path: `${dossier}/A-aujourdhui.png` });
console.log(`A · visibles : ${avant.visibles.join(" | ")} — repliées : ${avant.repliees}`);
if (!avant.visibles.some((t) => /DEVIS EN ATTENTE/i.test(t))) {
  console.log("   (son rappel est bien CACHÉ derrière le repli — c'est le défaut à montrer)");
} else {
  echecs.push("son rappel est visible d'emblée : l'image A ne montre pas ce qu'elle prétend");
}

// ── B. Le rappel passe devant ──────────────────────────────────────────────
await page.evaluate(() => {
  const pile = document.querySelector<HTMLElement>('[data-atlas="carte-reponse"]')?.parentElement;
  if (!pile) return;
  const cartes = [...pile.children] as HTMLElement[];
  const rappel = cartes.find((c) => /DEVIS EN ATTENTE/i.test(c.innerText));
  if (rappel) pile.insertBefore(rappel, pile.firstChild);
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${dossier}/B-le-rappel-devant.png` });
console.log(`B · visibles : ${(await etat()).visibles.join(" | ")}`);

// ── C. Trois cartes au lieu de deux ────────────────────────────────────────
// L'ordre d'origine est rétabli : on ne compare qu'une chose à la fois.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
const deplier = page.getByRole("button", { name: /autres? devis à regarder/ });
if ((await deplier.count()) > 0) {
  await deplier.first().click();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${dossier}/C-trois-cartes.png`, fullPage: true });
console.log(`C · visibles : ${(await etat()).visibles.join(" | ")}`);

await navigateur.close();
await pool.end();

console.log(`\nTrois images dans ${dossier}/ :`);
console.log("  A-aujourdhui.png          son rappel derrière le repli");
console.log("  B-le-rappel-devant.png    le rappel en tête");
console.log("  C-trois-cartes.png        tout déplié");

if (echecs.length > 0) {
  console.error(`\n❌ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.error(`   • ${e}`);
  process.exit(1);
}
