// Le SOMMAIRE des réglages, à la taille de son téléphone, sur les deux pôles.
//   npx tsx scripts/capture-sommaire-reglages.mts <dossier>
//
// **Pourquoi 390 × 664 et non 390 × 844.** Les captures existantes prennent
// `fullPage`, ce qui rend un écran de deux mètres où tout paraît tenir. Or la
// question de ce lot est exactement l'inverse : COMBIEN FAUT-IL DÉFILER pour
// atteindre la douzième rubrique. Il faut donc la fenêtre qu'il a vraiment —
// 390 × 664, la mesure qu'il a donnée (`PRODUCT.md`) — et deux images : ce
// qu'il voit sans bouger le pouce, et la hauteur totale.
//
// **Les deux pôles, parce qu'ils s'inversent.** Sur Nuit l'accent est CLAIR et
// le fond SOMBRE : un écran juste sur Origine peut être illisible là-bas
// (`CLAUDE.md` §3, sa plainte du 22 août 2026).
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-sommaire";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/** La charte vit sur la PERSONNE (`users.charte`), pas sur l'entreprise. */
async function poserCharte(nom: string | null) {
  const client = new Client({
    connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query("UPDATE users SET charte = $1 WHERE email = $2", [nom, "demo@atlas.local"]);
  } finally {
    await client.end();
  }
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 2,
});
const page = await contexte.newPage();
await connecter(page);

const mesures: string[] = [];

for (const charte of ["origine", "nuit"] as const) {
  await poserCharte(charte);
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  // La mise en page doit être posée avant de mesurer : une boîte de zéro pixel
  // n'est pas un succès, c'est une mesure impossible (`CLAUDE.md` §5).
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(dossier, `sommaire-${charte}-fenetre.png`) });
  await page.screenshot({ path: path.join(dossier, `sommaire-${charte}-entier.png`), fullPage: true });

  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const fenetre = await page.evaluate(() => window.innerHeight);
  if (!h || !fenetre) throw new Error("hauteur nulle : la page n'était pas posée, la mesure ne vaut rien");

  // Où tombe la DERNIÈRE rubrique : c'est elle qui dit combien il faut défiler.
  const derniere = await page.evaluate(() => {
    const liens = [...document.querySelectorAll("a[href^='/reglages/']")];
    const d = liens[liens.length - 1];
    return d ? Math.round(d.getBoundingClientRect().bottom + window.scrollY) : 0;
  });
  mesures.push(
    `${charte.padEnd(8)} hauteur ${h} px · fenêtre ${fenetre} px · ` +
      `${(h / fenetre).toFixed(2)} écran(s) · dernière rubrique à ${derniere} px`
  );
}

await poserCharte(null);
await navigateur.close();

const rapport = mesures.join("\n");
writeFileSync(path.join(dossier, "mesures.txt"), rapport + "\n");
console.log(rapport);
console.log(`\nCaptures dans ${dossier}`);
