/**
 * Prend la capture d'un écran d'étape d'un chantier — et rien d'autre.
 *
 * **Pourquoi ce script existe.** Trois défauts réels de ce projet — une barre de
 * navigation sur la page publique du client, l'ordre des totaux d'une facture,
 * une pile de notifications qui poussait tout hors de l'écran — ont été trouvés
 * en REGARDANT une capture, jamais par une suite verte (`CLAUDE.md` §5).
 * `capture-accueil.mts` fait ce travail pour l'accueil ; celui-ci le fait pour
 * les écrans du parcours, qu'il faut atteindre en traversant une connexion.
 *
 * Il ne juge rien, et c'est délibéré : c'est l'œil qui juge. Il écrit deux
 * images par écran — le haut, puis le bas une fois la page déroulée, parce que
 * la bulle de l'assistant et la barre de navigation vivent en bas et ont déjà
 * mangé du contenu par le passé.
 *
 * Suppose un serveur déjà en écoute.
 *
 *   npx tsx scripts/capture-etape.mts <dossier> <chantierId> <etape…>
 *
 * Exemple :
 *   npx tsx scripts/capture-etape.mts /tmp/vues <uuid> informations prix
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

const dossier = process.argv[2];
const chantierId = process.argv[3];
const etapes = process.argv.slice(4);
const port = process.env.PORT_BANC ?? "3000";
// `localhost` et non `127.0.0.1` : Next bloque ses ressources de
// développement pour toute origine qu'il juge étrangère, et la page arrive
// alors sans être hydratée — visible, mais morte sous le doigt.
const base = `http://localhost:${port}`;

if (!dossier || !chantierId || etapes.length === 0) {
  console.error("usage : npx tsx scripts/capture-etape.mts <dossier> <chantierId> <etape…>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

/** Playwright ne trouve pas seul un navigateur installé hors de son cache. */
function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const chemin = `${racine}/chromium`;
  if (existsSync(chemin)) return chemin;
  const sousDossier = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  if (!sousDossier) return undefined;
  const complet = `${racine}/${sousDossier}/chrome-linux/chrome`;
  return existsSync(complet) ? complet : undefined;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
// iPhone 14/15 : 393 × 852 en points, densité 3 — la taille de la maquette que
// le patron a retenue. Comparer à une autre largeur ne prouverait rien.
const contexte = await navigateur.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${base}/`, { timeout: 60_000 });

for (const etape of etapes) {
  const chemin = etape === "fiche" ? "" : `/${etape}`;
  await page.goto(`${base}/chantiers/${chantierId}${chemin}`, { waitUntil: "networkidle" });
  // Les polices décident de la moitié des mesures qu'on vient de régler :
  // les attendre évite de juger une capture en Times.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dossier}/${etape}.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${dossier}/${etape}-bas.png` });
  console.log(`capture écrite : ${dossier}/${etape}.png (+ -bas)`);
}

await navigateur.close();
