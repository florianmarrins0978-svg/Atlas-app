// Ce que partagent les scripts de tournage : ouvrir la vraie appli dans un
// navigateur à la taille d'un téléphone, et s'y connecter.
//
// L'appli doit tourner (version construite, base d'essai) : voir LISEZ-MOI.md.
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { cheminDuNavigateur } from "../../../../scripts/_navigateur.mjs";

export const BASE = process.env.ATLAS_ADRESSE ?? "http://localhost:3000";
export const SORTIE = process.env.TOURNAGE_SORTIE ?? "/tmp/tournage-atlas";
const ETAT = path.join(SORTIE, "session.json");

// Le téléphone du film : 390 points de large comme un iPhone, 600 de haut,
// la part de l'écran que le montage montre sous ses titres.
export const TELEPHONE = { largeur: 390, hauteur: 600 };

export async function ouvrir({ dpr = 3, hauteur = TELEPHONE.hauteur, session = true } = {}) {
  mkdirSync(SORTIE, { recursive: true });
  const navigateur = await chromium.launch({
    executablePath: cheminDuNavigateur(),
    // Le micro est simulé par le navigateur : le vrai chrono de l'appli tourne
    // sans qu'on ait à parler dans un conteneur.
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const contexte = await navigateur.newContext({
    viewport: { width: TELEPHONE.largeur, height: hauteur },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    permissions: ["microphone"],
    ...(session && existsSync(ETAT) ? { storageState: ETAT } : {}),
  });
  const page = await contexte.newPage();
  const pannes = [];
  page.on("pageerror", (e) => pannes.push(`page : ${e.message.split("\n")[0]}`));
  page.on("response", (r) => {
    if (r.status() >= 500) pannes.push(`${r.status()} sur ${new URL(r.url()).pathname}`);
  });
  return { navigateur, contexte, page, pannes };
}

// La connexion, puis les deux murs qui interceptent tout écran : l'acceptation
// des documents et la bienvenue (même geste que scripts/voir-un-ecran.mts).
export async function seConnecter(page, contexte) {
  // Par /login, jamais par l'accueil : sans session, l'accueil mène à la
  // bienvenue, qui n'a pas de formulaire.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.fill('input[name="email"], input[type="email"]', "demo@atlas.local");
    await page.fill('input[name="password"], input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(900);
  }
  for (let essai = 0; essai < 3 && /documents-legaux/.test(page.url()); essai++) {
    const cases = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await cases.count()); i++) await cases.nth(i).check().catch(() => {});
    await page
      .getByRole("button", { name: /^accepter$|continuer|j'accepte|commencer/i })
      .click()
      .catch(() => {});
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(900);
  }
  await contexte.storageState({ path: ETAT });
}

export async function attendrePose(page, ms = 700) {
  await page
    .waitForFunction(() => !document.body.innerText.includes("CHARGEMENT"), null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(ms);
}
