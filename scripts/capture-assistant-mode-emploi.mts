// Regarder l'assistant répondre — sa demande du 25 août 2026.
//
// **Pourquoi une capture et pas seulement des suites vertes.** Quatre défauts
// réels de ce dépôt n'ont été trouvés qu'à l'image (`CLAUDE.md` §5) : une barre
// de navigation de trop, l'ordre de totaux, une pile de notifications, trois
// noms coupés sous une batterie entièrement verte. Ici, ce qu'on veut voir :
// que la réponse tient dans la bulle, qu'elle se lit, et que le geste y est.
//
// Aucune clé n'est nécessaire : sans fournisseur configuré, Atlas emploie le
// fournisseur `dev`, qui appelle les mêmes outils et récite les mêmes fiches.
//
//   npx tsx scripts/capture-assistant-mode-emploi.mts <dossier>
//
// Demande un serveur BÂTI et démarré (`next build` puis `next start`) : le
// `next dev` de ce conteneur ne découvre pas les routes (`HANDOVER.md`).
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-assistant";
mkdirSync(dossier, { recursive: true });

/** Ses questions, dans ses mots — la première est celle de sa demande. */
const QUESTIONS = [
  // Ses trois questions du 26 août 2026 au soir, mot pour mot — les deux
  // dernières rendaient « L'assistant a mal formé sa demande à un outil
  // interne », trois fois de suite. Sa réaction : « il comprend rien ».
  "À quelle heure ouvre le cgr de mantes la jolie ?",
  "Peux tu me sortir le devis de Lucie",
  "Sort moi le dernier devis de Bernard",
];

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await contexte.newPage();
await connecter(page);

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.click('button[aria-label="Ouvrir l\'assistant"]');
await page.waitForSelector('input[placeholder="Votre question…"]', { timeout: 20_000 });
await page.screenshot({ path: path.join(dossier, "assistant-ouvert.png") });

for (const [index, question] of QUESTIONS.entries()) {
  await page.fill('input[placeholder="Votre question…"]', question);
  await page.press('input[placeholder="Votre question…"]', "Enter");
  // Attendre la RÉPONSE, pas un délai : sous une machine chargée, un délai fixe
  // capture « L'assistant réfléchit… » et l'on croit l'écran vide.
  //
  // **On compte les bulles, pas les « Sources : ».** Trouvé le 26 août 2026 :
  // une réponse hors périmètre ne consulte AUCUN outil, donc n'affiche aucune
  // source — la capture attendait alors un bloc qui ne viendrait jamais, et
  // rougissait sur le comportement voulu.
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll('[data-atlas="bulle-assistant"]').length >= n &&
      !document.body.innerText.includes("réfléchit"),
    index + 1,
    { timeout: 60_000 }
  );
  await page.screenshot({ path: path.join(dossier, `assistant-${index + 1}.png`) });
}

await navigateur.close();
console.log("Captures écrites dans", dossier);
