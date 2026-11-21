import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
const req = createRequire(import.meta.url);
const ICI = path.dirname(fileURLToPath(import.meta.url));
export const TRAVAIL = process.env.VISITE_TRAVAIL ?? "/tmp/visite-guidee";
const { chromium } = req("playwright");
import { corps } from "../figer.mjs";
export const BASE = "http://demo.cause.test:3001";
const ETAT = `${TRAVAIL}/etat.json`;
export const DOSSIER = `${TRAVAIL}/etats`;
mkdirSync(DOSSIER, { recursive: true });

export async function session({ anonyme = false } = {}) {
  const nav = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: [
      "--host-resolver-rules=MAP demo.cause.test 127.0.0.1",
      "--lang=fr-FR",
      "--unsafely-treat-insecure-origin-as-secure=http://demo.cause.test:3001",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${path.join(ICI, "../../fixtures/fake-mic.wav")}`,
    ],
  });
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    // Les PDF se peignent dans un canevas à la densité de l'écran : à 1, ils
    // sortaient flous sur un téléphone (sa remarque du 20 novembre). À 3, net.
    deviceScaleFactor: 3,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    permissions: ["microphone"],
    storageState: !anonyme && existsSync(ETAT) ? ETAT : undefined,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERREUR PAGE", e.message));
  const va = async (chemin) => {
    await page.goto(BASE + chemin, { waitUntil: "domcontentloaded", timeout: 120000 });
    if (/\/(login|bienvenue)/.test(new URL(page.url()).pathname)) {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.fill('input[name="email"]', "demo@atlas.local");
      await page.fill('input[name="password"]', "demo1234");
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });
      await ctx.storageState({ path: ETAT });
      await page.goto(BASE + chemin, { waitUntil: "domcontentloaded", timeout: 120000 });
    }
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
  };
  const fige = async (nom) => {
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(700);
    const feuilles = await page.evaluate(() =>
      [...document.styleSheets].map((f) => { try { return [...f.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } })
    );
    await page.evaluate(() => {
      document.querySelectorAll("canvas").forEach((cv) => {
        try {
          const img = document.createElement("img");
          // Une page de PDF est opaque : en JPEG, elle pèse cinq fois moins. La signature,
          // transparente, garde le PNG (en JPEG son fond devenait noir).
          const opaque = cv.getContext("2d")?.getImageData(0, 0, 1, 1).data[3] === 255;
          img.src = opaque ? cv.toDataURL("image/jpeg", 0.88) : cv.toDataURL("image/png");
          img.className = cv.className;
          img.setAttribute("style", (cv.getAttribute("style") || "") + `;width:${cv.getBoundingClientRect().width}px;height:${cv.getBoundingClientRect().height}px;display:block`);
          cv.replaceWith(img);
        } catch {}
      });
    });
    // Ce qui défile À L'INTÉRIEUR d'une feuille ne se fige pas tout seul : on note
    // où il en était, et la visite le remet (sinon une feuille repart toujours d'en haut).
    await page.evaluate(() => {
      document.querySelectorAll("[data-defile-interne]").forEach((e) => e.removeAttribute("data-defile-interne"));
      document.querySelectorAll("body *").forEach((e) => { if (e.scrollTop > 0) e.setAttribute("data-defile-interne", String(Math.round(e.scrollTop))); });
    });
    const c = await corps(page, ctx);
    const defile = await page.evaluate(() => window.scrollY);
    writeFileSync(`${DOSSIER}/${nom}.json`, JSON.stringify({ nom, url: page.url(), feuilles, corps: c, defile }));
    await page.screenshot({ path: `${DOSSIER}/${nom}.png` });
    console.log("figé", nom, page.url());
  };
  const fin = async () => { if (!anonyme) await ctx.storageState({ path: ETAT }); await nav.close(); };
  return { nav, ctx, page, va, fige, fin };
}
