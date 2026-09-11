// Les quatre écrans de la facture sans devis, REGARDÉS — pas seulement testés.
//
//   npm run dev   (ou un serveur déjà debout sur le port de son atelier)
//   npx tsx scripts/capture-facture-sans-devis.mts <dossier> [adresse]
//
// **Pourquoi ce script existe alors que la suite de bout en bout passe.**
// Quatre défauts réels de ce dépôt sont sortis d'une image et d'AUCUN test : une
// barre de navigation sur la page du client, l'ordre des totaux d'une facture,
// une pile de notifications qui poussait tout hors de l'écran, et des noms
// tronqués que la suite déclarait intacts. Une suite dit « le bouton existe » ;
// elle ne dit pas qu'il est collé au texte d'à côté, ni qu'il est illisible en
// nuit (`CLAUDE.md` §5).
//
// Les quatre moments, dans son ordre : la porte, la fiche, la facture vide qui
// REFUSE de partir, et la facture remplie.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";
import path from "node:path";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-facture-sans-devis.mts <dossier> [adresse]");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });
const BASE = (process.argv[3] ?? process.env.ATLAS_ADRESSE ?? "http://localhost:3000").replace(/\/$/, "");

// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page arrive alors JAMAIS hydratée.
function pre(): string | undefined {
  const r = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!r || !existsSync(r)) return undefined;
  if (existsSync(`${r}/chromium`)) return `${r}/chromium`;
  const s = readdirSync(r).find((d) => /^chromium-\d+$/.test(d));
  return s && existsSync(`${r}/${s}/chrome-linux/chrome`) ? `${r}/${s}/chrome-linux/chrome` : undefined;
}

const navigateur = await chromium.launch({ executablePath: pre() });
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"],
  isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();
const reserves: string[] = [];

async function poser(nom: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dossier, `${nom}.png`) });
  console.log(`  · ${nom}.png`);
}

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60000 });

// ── 1. LA PORTE ───────────────────────────────────────────────────────────
await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
await poser("1-termines-avec-le-bouton");

// **Ce que l'image ne dit pas toute seule**, et qu'on relève pendant qu'on y
// est : le bouton est-il VRAIMENT collé à droite, et fait-il ses 44 px ?
const porte = await page.evaluate(() => {
  const b = document.querySelector<HTMLElement>('[data-atlas="creer-une-facture"]');
  const onglets = document.querySelector<HTMLElement>('[data-atlas="onglets-termines"]');
  if (!b || !onglets) return null;
  const r = b.getBoundingClientRect();
  const o = onglets.getBoundingClientRect();
  return {
    hauteur: Math.round(r.height),
    // La marge à droite, mesurée depuis le bord de l'écran.
    aDroite: Math.round(document.documentElement.clientWidth - r.right),
    // L'écart vertical entre le bas des onglets et le haut du bouton.
    sousLesOnglets: Math.round(r.top - o.bottom),
    rogne: b.scrollWidth > b.clientWidth + 1,
    mot: b.innerText.trim(),
  };
});
if (!porte) reserves.push("le bouton « Créer une facture » est introuvable sur Terminés");
else {
  console.log(
    `  → bouton « ${porte.mot} » : ${porte.hauteur} px de haut, ` +
      `${porte.aDroite} px du bord droit, ${porte.sousLesOnglets} px sous les onglets`
  );
  if (porte.hauteur < 44) reserves.push(`le bouton fait ${porte.hauteur} px : sous les 44 px du pouce`);
  if (porte.aDroite !== 26) reserves.push(`le bouton est à ${porte.aDroite} px du bord, pas 26`);
  if (porte.rogne) reserves.push("le libellé du bouton est rogné");
}

// ── 2. LA FICHE CLIENT QUI FACTURE ────────────────────────────────────────
await page.click('[data-atlas="creer-une-facture"]');
await page.waitForURL(/\/chantiers\/nouveau/, { timeout: 20000 });
await page.waitForLoadState("networkidle");
await poser("2-fiche-client-qui-facture");

await page.fill('input[placeholder="Bernard"]', `M. Julien ${Date.now()}`);
await page.fill('input[placeholder="06 12 34 56 78"]', "06 14 22 87 30");
await page.click('[data-atlas="action-facture-directe"]');

// ── 3. LA FACTURE VIDE, QUI REFUSE DE PARTIR ──────────────────────────────
await page.waitForURL(/\/chantiers\/[^/]+\/facture$/, { timeout: 30000 });
await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 30000 });
await poser("3-facture-vide-qui-refuse");

const refus = await page.evaluate(() => {
  const r = document.querySelector<HTMLElement>('[data-atlas="facture-pas-prete"]');
  const envoyer = document.querySelector<HTMLButtonElement>('[data-atlas="envoyer-la-facture"]');
  return {
    refusVisible: Boolean(r && r.getBoundingClientRect().height > 0),
    dit: r?.innerText.replace(/\s+/g, " ").trim() ?? "",
    envoiFerme: Boolean(envoyer?.disabled),
  };
});
console.log(`  → refus visible : ${refus.refusVisible} · envoi fermé : ${refus.envoiFerme}`);
if (!refus.refusVisible) reserves.push("rien ne dit pourquoi une facture vide ne part pas");
if (!refus.envoiFerme) reserves.push("une facture vide peut être envoyée");
if (/devis/i.test(refus.dit)) reserves.push(`le refus parle de devis : « ${refus.dit} »`);

// ── 4. LA FACTURE REMPLIE ─────────────────────────────────────────────────
await page.click('[data-atlas="ajouter-travaux-supplementaires"]');
await page.waitForURL(/travaux-supplementaires/, { timeout: 20000 });
await page.waitForLoadState("networkidle");
await poser("4-la-saisie-des-lignes");

await page.click('[data-atlas="ajouter-ligne-supplement"]');
await page.waitForTimeout(700);
const description = page.locator('[data-atlas="ligne-supplement"] textarea').first();
await description.fill("Dépannage arrosage — remplacement électrovanne");
await description.blur();
const chiffres = page.locator('[data-atlas="ligne-supplement"] input');
await chiffres.nth(1).fill("145");
await chiffres.nth(1).blur();
await page.waitForTimeout(900);
await poser("5-la-ligne-saisie");

await page.click('[data-atlas="revenir-a-la-facture"]');
await page.waitForURL(/\/facture$/, { timeout: 20000 });
await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 20000 });
await poser("6-la-facture-prete-a-partir");

const prete = await page.evaluate(() => {
  const envoyer = document.querySelector<HTMLButtonElement>('[data-atlas="envoyer-la-facture"]');
  return {
    envoiOuvert: Boolean(envoyer && !envoyer.disabled),
    refusParti: !document.querySelector('[data-atlas="facture-pas-prete"]'),
    // Le mot interdit : cet écran se photographie et s'envoie au client.
    parleDeDevis: /Reprise du devis/.test(document.body.innerText),
  };
});
console.log(`  → envoi ouvert : ${prete.envoiOuvert} · refus parti : ${prete.refusParti}`);
if (!prete.envoiOuvert) reserves.push("l'envoi reste fermé sur une facture remplie");
if (!prete.refusParti) reserves.push("le refus reste affiché alors que la facture porte une ligne");
if (prete.parleDeDevis) reserves.push("la facture directe annonce « Reprise du devis »");

await contexte.close();
await navigateur.close();

console.log(`\nLes écrans sont dans ${dossier} — à REGARDER, pas seulement à compter.`);
if (reserves.length > 0) {
  console.error("\n❌ Ce que la mesure a relevé :");
  for (const r of reserves) console.error(`   · ${r}`);
  process.exit(1);
}
console.log("✅ Rien à signaler sur les mesures. Les images restent à regarder.");
