// Fige, depuis l'appli qui tourne sur la base de démonstration, les écrans
// ajoutés à la visite le 21 novembre 2026 (sa demande du soir) :
//   - la fiche de sécurité : son croquis, l'éditeur où il se dessine, la fiche
//     signée, et le PDF que reçoit le client ;
//   - les véhicules : la liste, la fiche de chacun, le rappel sur l'accueil ;
//   - chaque porte des Réglages qui ne s'ouvrait pas (« il faut qu'ils
//     puissent avoir accès à n'importe quelle porte dans la page réglage »).
//
// Suppose `donnees.ts avant` déjà joué. Joue lui-même `donnees.ts signer`
// entre le croquis et la fiche signée : une fiche signée ne se modifie plus.
//   ATLAS_ADRESSE=http://localhost:3001 node appli/scripts/visite-guidee/figer-neufs.mjs <dossier>
// Écrit <dossier>/ecrans.json ; `composer-neufs.mjs` les pose dans la visite.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, corps, feuilles, lancer } from "../../../scripts/planche-figee/figer.mjs";

const ici = path.dirname(fileURLToPath(import.meta.url));
const dossier = process.argv[2];
if (!dossier) throw new Error("Donnez le dossier où écrire ecrans.json.");
mkdirSync(dossier, { recursive: true });

const nav = await lancer();
// À la densité d'un téléphone récent : le PDF figé à celle d'un vieil écran se lisait flou
// (sa remarque du 20 novembre sur l'aperçu du devis).
const contexte = await nav.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3 });
const page = await contexte.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 90000 });

const ecrans = [];
const vus = new Set();
async function figer(nom, { attendre } = {}) {
  await page.waitForLoadState("networkidle");
  if (attendre) await page.waitForSelector(attendre, { timeout: 30000 });
  await page.waitForTimeout(700);
  // Les pages d'un PDF sont des toiles : figées, elles deviennent des images.
  await page.evaluate(() => {
    for (const t of document.querySelectorAll("canvas")) {
      const img = document.createElement("img");
      img.src = t.toDataURL("image/jpeg", 0.82);
      for (const a of t.attributes) if (a.name !== "width" && a.name !== "height") img.setAttribute(a.name, a.value);
      img.style.cssText = t.style.cssText;
      t.replaceWith(img);
    }
  });
  const c = await corps(page, contexte);
  const defile = await page.evaluate(() => Math.round(scrollY));
  ecrans.push({ nom, defile, html: c.html, css: await feuilles(page, contexte) });
  vus.add(nom);
  console.log(`figé : ${nom}`);
}
const aller = async (url) => { await page.goto(new URL(url, BASE).toString()); await page.waitForLoadState("networkidle"); };

// ── La fiche de sécurité du chantier Lefèvre ──
const chantier = execFileSync("psql", ["-h", "localhost", "-U", "postgres", "-d", "atlas_test", "-tAc", "SELECT id FROM chantiers WHERE nom = 'Lefèvre' AND deleted_at IS NULL LIMIT 1"]).toString().trim();
execFileSync("psql", ["-h", "localhost", "-U", "postgres", "-d", "atlas_test", "-tAc", `UPDATE fiches_securite SET etape_vue = 2 WHERE chantier_id = '${chantier}'`]);
await aller(`/planning/fiche-de-securite/${chantier}`);
await figer("24e-fiche-croquis");
await page.click('[data-atlas="modifier-le-croquis"]');
await figer("24f-croquis-editeur", { attendre: '[data-atlas="editeur-du-croquis"]' });
execFileSync("npx", ["tsx", path.join(ici, "donnees.ts"), "signer"], { stdio: "inherit", env: process.env });
await aller(`/planning/fiche-de-securite/${chantier}`);
await figer("24g-fiche-signee", { attendre: '[data-atlas="fiche-signee"]' });
await page.click('[data-atlas="ouvrir-le-pdf-de-la-fiche"]');
await figer("24h-fiche-pdf", { attendre: '[data-atlas="page-pdf"]' });

// ── Les véhicules ──
await aller("/reglages/vehicules");
await figer("r-vehicules");
const fiches = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/reglages/vehicules/"]')].map((a) => a.getAttribute("href")))]);
for (const h of fiches) { await aller(h); await figer("r-" + h.replace(/^\/reglages\//, "").replace(/\//g, "-")); }
await aller("/");
// La carte « Correction demandée » du jeu de démonstration passe d'abord : le
// rappel du contrôle technique arrive en tête, là où la visite le montre.
// (« J'ai vu » d'une notification : `j-ai-vu` ; celui d'un véhicule reste, c'est lui qu'on montre.)
for (let k = 0; k < 5 && (await page.locator('[data-atlas="j-ai-vu"]').count()); k++) { await page.locator('[data-atlas="j-ai-vu"]').first().click(); await page.waitForTimeout(800); }
await aller("/");
await figer("v-accueil-rappels");

// ── Les portes des Réglages, puis celles qu'elles ouvrent à leur tour ──
const AUTRES = { "/catalogue": "r-catalogue", "/documents/pdf?fichier=%2Fapi%2Ffactures%2Fexemple%2Fpdf&de=Exemple&titre=La+facture": "r-exemple-facture" };
const nomDe = (h) => (h.startsWith("/reglages/") ? "r-" + h.replace(/^\/reglages\//, "").replace(/\//g, "-") : AUTRES[h]);
// Ce que la visite porte déjà ne se refige pas : il resterait deux versions d'un même
// écran. Sauf ce que CE script y a posé (`C.ecransNeufs`, écrit par `composer-neufs.mjs`) :
// celui-là se refige à chaque passage, sans quoi un second passage le perdrait.
const visite = readFileSync(path.join(ici, "../../visite-guidee.html"), "utf8");
const neufs = JSON.parse(visite.match(/"ecransNeufs":(\[[^\]]*\])/)?.[1] ?? "[]");
const deja = [...visite.matchAll(/data-ecran="([^"]+)"/g)].map((m) => m[1]).filter((n) => n !== "r-vehicules" && !neufs.includes(n));
const aOuvrir = ["/reglages/documents", "/reglages/donnees", "/reglages/equipe", "/reglages/identite", "/reglages/tarifs"];
for (let tour = 0; tour < 3 && aOuvrir.length; tour++) {
  const suivants = [];
  for (const depuis of aOuvrir.splice(0)) {
    await aller(depuis);
    const portes = await page.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))]);
    for (const h of portes) {
      const nom = nomDe(h);
      if (!nom || vus.has(nom) || deja.includes(nom)) continue;
      await aller(h);
      await figer(nom, { attendre: nom === "r-exemple-facture" ? '[data-atlas="page-pdf"]' : undefined });
      if (h.startsWith("/reglages/")) suivants.push(h);
    }
  }
  aOuvrir.push(...suivants);
}
writeFileSync(path.join(dossier, "ecrans.json"), JSON.stringify(ecrans));
console.log(`${ecrans.length} écrans figés dans ${dossier}/ecrans.json`);
await nav.close();
