// Fige, depuis l'appli qui tourne sur la base de démonstration, les écrans
// ajoutés à la visite le 21 novembre 2026 (sa demande du soir) :
//   - la fiche de sécurité : son croquis, l'éditeur où il se dessine, la fiche
//     signée, et le PDF que reçoit le client ;
//   - les véhicules : la liste, la fiche de chacun, le rappel sur l'accueil ;
//   - chaque porte des Réglages qui ne s'ouvrait pas (« il faut qu'ils
//     puissent avoir accès à n'importe quelle porte dans la page réglage »).
// Puis, le 22 novembre (« expliquer aussi qu'on peut faire des sauts de ligne et
// des sauts de page avec l'aperçu du PDF » ; « sur la facture, je peux pas
// ajouter un travail ou un règlement reçu ») :
//   - l'aperçu du devis, une nouvelle page avant le tilleul, un espace avant le ramassage ;
//   - les travaux en plus de la facture : un travail, la main d'œuvre, une TVA, un règlement.
//
// Suppose `donnees.ts avant` déjà joué. Joue lui-même les autres phases de
// `donnees.ts` là où l'appli les attend : `signer` entre le croquis et la fiche
// signée (une fiche signée ne se modifie plus), `facturer` avant la facture.
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

const donnees = (phase) => execFileSync("npx", ["tsx", path.join(ici, "donnees.ts"), phase], { stdio: "inherit", env: process.env });
const chantier = execFileSync("psql", ["-h", "localhost", "-U", "postgres", "-d", "atlas_test", "-tAc", "SELECT id FROM chantiers WHERE nom = 'Lefèvre' AND deleted_at IS NULL LIMIT 1"]).toString().trim();

// ── L'aperçu du devis : une nouvelle page, puis un espace ──
// Le devis naît en ouvrant sa page (`getOuCreerDevisBrouillon`), puis prend la date
// et le titre de la visite d'origine.
await aller(`/chantiers/${chantier}/devis-complet`);
donnees("apercu");
await page.click('[data-atlas="apercu-pdf"]');
await figer("12-apercu-pdf", { attendre: '[data-atlas="page-pdf"]' });
// Les lignes du devis sont les boutons posés sur la page 1, après sa toile :
// l'élagage du tilleul est la troisième, le ramassage la deuxième.
const ligne = (rang) => page.locator(`[data-atlas="ligne-a-couper"]:nth-child(${rang + 2})`).first();
await ligne(2).click();
await figer("12b-apercu-ligne", { attendre: '[data-atlas="nouvelle-page-ici"]' });
await page.click('[data-atlas="nouvelle-page-ici"]');
await figer("12c-apercu-nouvelle-page", { attendre: '[data-atlas="saut-de-page"]' });
await ligne(1).click();
await figer("12d-apercu-ligne-2", { attendre: '[data-atlas="un-espace-ici"]' });
await page.click('[data-atlas="un-espace-ici"]');
await figer("12e-apercu-espace", { attendre: '[data-atlas="espace-pose"]' });
// Le devis repart sans ses coupures : la facture le reprendra tel qu'il a été envoyé.
await page.click('[data-atlas="tout-remettre"]');
await page.waitForFunction(() => !document.querySelector('[data-atlas="saut-de-page"], [data-atlas="espace-pose"]'));
donnees("apres-apercu");

// ── La fiche de sécurité du chantier Lefèvre ──
execFileSync("psql", ["-h", "localhost", "-U", "postgres", "-d", "atlas_test", "-tAc", `UPDATE fiches_securite SET etape_vue = 2 WHERE chantier_id = '${chantier}'`]);
await aller(`/planning/fiche-de-securite/${chantier}`);
await figer("24e-fiche-croquis");
await page.click('[data-atlas="modifier-le-croquis"]');
await figer("24f-croquis-editeur", { attendre: '[data-atlas="editeur-du-croquis"]' });
donnees("signer");
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
// ── Les travaux en plus de la facture : chaque bouton, ce qu'il pose ──
// En dernier : facturer passe le devis en « envoyé » et le chantier au 18 novembre.
donnees("facturer");
await aller(`/chantiers/${chantier}/facture`);
await page.click('button:has-text("Créer la facture")');
await page.waitForSelector('[data-atlas="ajouter-travaux-supplementaires"]', { timeout: 30000 });
donnees("dater-facture");
const enPlus = `/chantiers/${chantier}/facture/travaux-supplementaires`;
// Chaque essai repart de l'écran nu : ce qu'il a posé se retire, et la page se relit.
const toutRetirer = async () => {
  for (const sel of ['[data-atlas="retirer-reglement"]', '[data-atlas="retirer-main-doeuvre"]', '[data-atlas="retirer-supplement"]']) {
    while (await page.locator(sel).count()) { await page.locator(sel).first().click(); await page.waitForTimeout(800); }
  }
  await aller(enPlus);
};
await aller(enPlus);
await figer("27-travaux-en-plus");
await page.click('[data-atlas="ajouter-ligne-supplement"]');
await page.fill('textarea[aria-label="Description du travail supplémentaire 1"]', "Dessouchage d'une souche de thuya");
await page.fill('input[aria-label="Prix unitaire du travail supplémentaire 1"]', "85");
await page.keyboard.press("Tab");
await page.waitForTimeout(1500);
// Relue depuis la base : ce qui s'affiche est ce qui a été gardé.
await aller(enPlus);
await figer("27-travail-ajoute", { attendre: '[data-atlas="retirer-supplement"]' });
await toutRetirer();
await page.click('[data-atlas="poser-main-doeuvre"]');
await figer("27-main-doeuvre-feuille", { attendre: 'button:has-text("Ajouter la main")' });
await page.click('button:has-text("Ajouter la main")');
await figer("27-main-doeuvre-pose", { attendre: '[data-atlas="retirer-main-doeuvre"]' });
await toutRetirer();
await page.click('[data-atlas="ajouter-tva-supplement"]');
await figer("27-tva-feuille", { attendre: 'button:has-text("Ajouter la TVA")' });
await page.click('button:has-text("Ajouter la TVA")');
await page.waitForLoadState("networkidle");
await figer("27-tva-pose");
await toutRetirer();
// Un acompte de 300 € reçu par virement le 21 : il reste 624 €.
// Un champ à la fois, chacun enregistré et relu avant le suivant : chaque
// enregistrement renvoie la ligne entière telle que l'écran l'a reçue, et deux
// champs changés trop vite font perdre le premier (vu le 22 novembre : le moyen et
// la date revenaient à Chèque et au jour même ; `TODO.md`).
const enregistrer = async (geste) => { await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), geste()]); await aller(enPlus); };
await enregistrer(() => page.click('[data-atlas="poser-reglement"]'));
await enregistrer(() => page.selectOption('[data-atlas="moyen-reglement"]', "virement"));
await enregistrer(() => page.fill('[data-atlas="date-reglement"]', "2026-11-21"));
await enregistrer(async () => { await page.fill('[data-atlas="montant-reglement"]', "300"); await page.keyboard.press("Tab"); });
await figer("27-reglement-recu", { attendre: '[data-atlas="retirer-reglement"]' });
await toutRetirer();

writeFileSync(path.join(dossier, "ecrans.json"), JSON.stringify(ecrans));
console.log(`${ecrans.length} écrans figés dans ${dossier}/ecrans.json`);
await nav.close();
