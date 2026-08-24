/**
 * « Ouvrir Atlas avec Face ID » — la planche se parcourt en entier, comme lui.
 *
 * **Pourquoi cette suite existe.** Trois fois, une adresse lui a été transmise
 * sans que personne ne l'ait ouverte, et c'est LUI qui a trouvé le défaut
 * (`AGENTS.md`). Une planche dont on attend un choix — ici A ou B — se parcourt
 * donc d'abord ici, dans un vrai navigateur, sur un téléphone de 390 px.
 *
 * **Ce qu'elle garde par-dessus tout : le mot de passe reste joignable.** C'est
 * la seule chose qu'il ait posée comme non négociable — *« bien entendu qu'il
 * faut conserver le mot de passe »*. Une planche qui montrerait une porte où
 * Face ID est le seul chemin lui ferait valider autre chose que ce qu'il a
 * demandé, et c'est la porte de l'application qui en sortirait.
 *
 * **Elle sait échouer**, et sur autre chose que le vide : chaque affirmation est
 * mesurée dans le navigateur, et l'écran doit d'abord avoir de la matière — un
 * écran de zéro pixel passerait tout au vert sans rien prouver (`CLAUDE.md` §5).
 *
 *   BASE_URL=http://127.0.0.1:8080 node tests/essai-face-id.mjs
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";
let rouges = 0;
const dire = (ok, quoi) => {
  if (!ok) rouges++;
  console.log((ok ? "  ok    " : "  ROUGE ") + quoi);
};

// Même convention que les contrôles de maquette du dépôt (`CHROME_ATLAS`) :
// l'environnement de l'agent porte un Chromium à part, la CI le sien.
const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const nav = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("requestfailed", (r) => erreurs.push("requête perdue : " + r.url()));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) erreurs.push(r.status() + " sur " + r.url());
});

// `networkidle` et pas `domcontentloaded` : sans la mise en page appliquée,
// toutes les mesures ci-dessous vaudraient 0, et « 0 ≤ 390 » passerait au vert
// sur une page vide (`CLAUDE.md` §5, la panne du 15 août 2026).
await page.goto(`${BASE}/face-id.html`, { waitUntil: "networkidle" });

const porteA = page.locator('[data-porte="A"]');
const porteB = page.locator('[data-porte="B"]');
const faceA = page.locator('[data-face="A"]');
const faceB = page.locator('[data-face="B"]');
const systeme = page.locator("[data-systeme]");

console.log("\n=== La planche s'ouvre, et il y a de la matière ===");
{
  const boite = await porteA.boundingBox();
  dire(!!boite && boite.height > 200, `la porte A mesure ${boite ? Math.round(boite.height) : 0} px de haut`);
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  dire(large <= 390, `rien ne déborde en largeur (${large} px pour 390)`);
}

console.log("\n=== Allumé : les deux portes proposent le visage ===");
dire(await faceA.isVisible(), "porte A — le grand bouton Face ID est là");
dire(await faceB.isVisible(), "porte B — la ligne Face ID est là");
dire(
  await porteB.locator('input[type="password"]').isVisible(),
  "porte B — le mot de passe est visible EN MÊME TEMPS que Face ID"
);
dire(
  await porteA.locator('[data-mdp="A"]').isVisible(),
  "porte A — le chemin vers le mot de passe est offert sans rien toucher d'autre"
);

console.log("\n=== Le visage reconnu fait entrer ===");
await faceA.click();
dire(await systeme.isVisible(), "la fenêtre du système s'ouvre");
await page.click("[data-regarder]");
dire(
  (await porteA.locator('[data-vue="dedans"]').textContent())?.includes("Bonjour Florian"),
  "on est dedans"
);
await porteA.locator('[data-recommencer="A"]').click();
dire(await faceA.isVisible(), "« recommencer » remet la planche à zéro");

console.log("\n=== ANNULER ne bloque pas : on retombe sur le mot de passe ===");
await faceA.click();
await page.click("[data-annuler]");
dire(!(await systeme.isVisible()), "la fenêtre se referme");
dire(await porteA.locator('input[type="password"]').isVisible(), "le mot de passe est là, tout de suite");
dire(
  (await porteA.locator('input[type="email"]').inputValue()).includes("@"),
  "l'adresse est restée remplie — pas à retaper sur un téléphone"
);

console.log("\n=== Face ID qui rate : il RAMÈNE au mot de passe, il ne mure rien ===");
await porteA.locator('[data-retour="A"]').click();
await page.click("[data-echec]");
await faceA.click();
await page.click("[data-regarder]");
dire(
  (await page.locator("[data-sheet-titre]").textContent())?.includes("non reconnu"),
  "le refus se dit DANS la fenêtre, comme le fait iOS"
);
await page.waitForSelector('[data-porte="A"] input[type="password"]', { state: "visible" });
{
  const refus = (await porteA.locator('[data-refus="A"]').textContent())?.trim() ?? "";
  dire(refus.length > 0, `un message explique le retour : « ${refus} »`);
  // La faute que ce dépôt s'interdit depuis le 6 août 2026 : accuser le mot de
  // passe de quelqu'un dont le mot de passe est bon.
  dire(!/incorrect|faux|erron/i.test(refus), "le message n'accuse JAMAIS le mot de passe");
  const focus = await page.evaluate(() => document.activeElement?.type ?? "");
  dire(focus === "password", "le clavier s'ouvre sur le mot de passe");
}
await page.click("[data-echec]");

console.log("\n=== Le mot de passe entre, toujours ===");
{
  await porteA.locator('[data-entrer="A"]').click();
  const vide = (await porteA.locator('[data-refus="A"]').textContent())?.trim() ?? "";
  dire(vide.includes("Entrez votre mot de passe"), "un mot de passe vide est refusé, et c'est dit");
  await porteA.locator('input[type="password"]').fill("uncertainmotdepasse");
  await porteA.locator('[data-entrer="A"]').click();
  dire(
    (await porteA.locator('[data-vue="dedans"]').textContent())?.includes("Bonjour Florian"),
    "avec le mot de passe, on entre"
  );
  await porteA.locator('[data-recommencer="A"]').click();
}

console.log("\n=== Éteint : la porte redevient EXACTEMENT celle d'aujourd'hui ===");
await page.click("[data-faceid]");
dire(!(await faceA.isVisible()), "porte A — plus aucun bouton Face ID");
dire(!(await faceB.isVisible()), "porte B — plus aucune ligne Face ID");
dire(await porteA.locator('input[type="password"]').isVisible(), "porte A — l'adresse et le mot de passe, comme aujourd'hui");
dire(await porteB.locator('input[type="password"]').isVisible(), "porte B — idem");
await page.click("[data-faceid]");
dire(await faceA.isVisible(), "rallumé, le visage revient");

console.log("\n=== Ce qu'il a posé comme non négociable ===");
{
  // Le mot de passe ne se retire pas : son interrupteur est allumé et inerte.
  const inter = page.locator("[data-mdp-toujours]");
  dire(await inter.isDisabled(), "l'interrupteur du mot de passe ne se touche pas");
  dire((await inter.getAttribute("aria-pressed")) === "true", "et il est allumé");
}
dire(
  (await page.locator(".acquis").textContent())?.includes("Le mot de passe reste, toujours"),
  "la planche ÉCRIT que le mot de passe reste — il n'a pas à le déduire"
);
dire(
  (await page.locator(".question").textContent())?.trim().length > 40,
  "la planche pose sa question, une seule : A ou B"
);
dire(
  (await page.locator(".avert").textContent())?.includes("dessin"),
  "la planche dit que la fenêtre Face ID est un dessin — rien n'est maquillé"
);

console.log("\n=== Aucune erreur de page ===");
dire(erreurs.length === 0, erreurs.length ? erreurs.join(" | ") : "rien dans la console, rien de perdu");

await nav.close();
console.log(`\nFace ID — ${rouges} rouge(s).`);
process.exit(rouges > 0 ? 1 : 0);
