import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// **« Crée-moi un bandeau déroulant avec infos à choisir, jours/hommes, m² etc. »**
// — le patron, le 13 août 2026. Depuis le 11 octobre 2026, les mêmes choix
// sont des pastilles dans la ligne ouverte du tarif (`appli/mes-tarifs-corrige.html`,
// version Corrigé), et la ligne repliée écrit « par m² » sous le prix.
//
// Les règles sont éprouvées sans navigateur (`test-unites-tarif.ts`). Ce que
// CETTE suite tient, et qu'aucune règle ne peut dire :
//
//   · **les choix y sont tous**, la ligne libre comprise, et atteignables ;
//   · **le choix arrive jusqu'en base** : rechargée, la ligne le porte encore ;
//   · **la case reste libre** : le stère s'écrit toujours. Une liste fermée
//     retirerait à un élagueur ce qu'il a aujourd'hui ;
//   · **sans unité, le prix est écrit seul**, jamais « Choisir… ».

const BASE = ADRESSE;

/** La ligne REPLIÉE du tarif portant cet intitulé (ouverte, le nom est dans un champ). */
function ligneDuTarif(page: Page, marque: string): Locator {
  return page.locator('[data-atlas="tarif"]', { hasText: marque });
}

/**
 * Attend que l'écriture soit PARTIE avant de recharger.
 *
 * **Recharger trop tôt l'avorte.** L'action serveur est encore en vol après le
 * geste : un `reload` immédiat annule la requête, et le contrôle suivant
 * constate que le choix « n'a pas tenu », en accusant l'écran d'un défaut qui
 * n'existe pas. Vu en batterie le 14 août 2026, là où la suite seule passait.
 */
async function ecritureFinie(page: Page, geste: () => Promise<void>): Promise<void> {
  const partie = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/reglages/"),
    { timeout: 15_000 }
  );
  await geste();
  await partie;
}

/** Ce que la ligne repliée écrit sous le prix : « m² » pour « par m² », "" sans unité. */
async function uniteLue(page: Page, marque: string): Promise<string> {
  const texte = await ligneDuTarif(page, marque).innerText();
  return /^par (.+)$/m.exec(texte)?.[1].trim() ?? "";
}

/**
 * Relit la BASE, au lieu de deviner quand elle a reçu.
 *
 * `networkidle` ne suffit pas (constaté le 14 août 2026, dans la batterie) :
 * l'écran est déjà silencieux à l'instant où on le lui demande, React n'a pas
 * encore lancé l'action. On recharge donc et l'on relit, jusqu'à quatre fois :
 * **attendre ce qu'on affirme, jamais une durée.**
 */
async function uniteEnBase(page: Page, marque: string, attendue: string): Promise<string> {
  let lue = "";
  for (const essai of [1, 2, 3, 4]) {
    await page.waitForLoadState("networkidle");
    await page.reload({ waitUntil: "networkidle" });
    lue = await uniteLue(page, marque);
    if (lue === attendue) return lue;
    await page.waitForTimeout(essai * 400);
  }
  return lue;
}

/** Ouvre la ligne repliée de ce tarif, et rend son groupe de pastilles. */
async function ouvrir(page: Page, marque: string): Promise<Locator> {
  await ligneDuTarif(page, marque).getByRole("button").first().click();
  const groupe = page.getByRole("group", { name: "Unité du tarif" });
  await groupe.waitFor({ state: "visible" });
  return groupe;
}

async function main() {
  const navigateur = await lancerNavigateur();
  // **Son écran, et pas celui d'un ordinateur.** Sur un grand écran tout tient
  // sans effort : la ligne ouverte ne passe jamais sous la barre basse, et le
  // contrôle 2 serait vert sans rien prouver. 390 × 664, c'est son iPhone.
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/reglages/tarifs`, { waitUntil: "networkidle" });

  // **Son propre tarif, ajouté ici et retiré à la fin.** Se poser sur un tarif
  // du jeu de démonstration ferait dépendre le résultat de son contenu, et
  // laisserait la suite modifier une donnée qu'une autre suite lit.
  const MARQUE = `Unité E2E ${Date.now()}`;
  // « Ajouter un tarif », sans le « + » écrit : depuis la planche soignée du
  // 26 octobre 2026, le plus est un dessin dans son rond doré, pas une lettre
  // du libellé. Le geste visé reste le même : le bouton qui crée un tarif.
  await page.getByRole("button", { name: "Ajouter un tarif" }).click();
  // Le tarif neuf s'ouvre de lui-même : il n'a encore ni nom ni prix.
  const nom = page.getByLabel("Nom du tarif");
  await nom.waitFor({ state: "visible" });
  assert.equal(await nom.inputValue(), "", "la ligne ouverte n'est pas celle du tarif qu'on vient d'ajouter");
  await nom.fill(MARQUE);
  await ecritureFinie(page, () => nom.blur());

  let groupe = page.getByRole("group", { name: "Unité du tarif" });

  // --- 1. Aucune unité au départ, et tous les choix sont là ---------------
  assert.equal(
    await groupe.getByRole("button", { name: "Aucune", pressed: true }).count(),
    1,
    "un tarif neuf porte déjà une unité : rien ne l'a pourtant choisie"
  );
  for (const unite of ["Aucune", "jour/homme", "m²", "ml", "heure", "forfait", "tonne"]) {
    assert.equal(
      await groupe.getByRole("button", { name: unite, exact: true }).count(),
      1,
      `« ${unite} » manque aux pastilles`
    );
  }
  assert.ok(await page.getByLabel("Une autre unité").isVisible(), "la ligne libre a disparu : la liste s'est fermée");
  console.log("  ✓ « Aucune », les six unités et la ligne libre sont proposées");

  // --- 2. Ce qui finit la ligne ouverte n'est pas sous la barre basse -----
  //
  // Un tarif se règle en bas de la liste aussi souvent qu'en haut. La barre de
  // navigation est posée par-dessus la page : « Fermer » derrière elle serait
  // là, et intouchable. La ligne se montre en douceur, d'où l'attente.
  await page.waitForTimeout(1_000);
  const place = await page.evaluate(() => {
    const fermer = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Fermer")!;
    const barre = document.querySelector('nav[aria-label="Navigation principale"]')!.getBoundingClientRect();
    return { bas: Math.round(fermer.getBoundingClientRect().bottom), barre: Math.round(barre.top) };
  });
  assert.ok(
    place.bas <= place.barre,
    `« Fermer » (jusqu'à ${place.bas}) passe sous la barre de navigation (à ${place.barre}) : il est là, et intouchable`
  );
  console.log("  ✓ la ligne ouverte se montre d'elle-même, sans passer sous la barre basse");

  // --- 3. Choisir arrive en base, et la ligne repliée l'écrit « par m² » --
  await ecritureFinie(page, () => groupe.getByRole("button", { name: "m²", exact: true }).click());
  assert.equal(await groupe.getByRole("button", { name: "m²", pressed: true }).count(), 1);
  await page.getByRole("button", { name: "Fermer" }).click();
  assert.equal(await uniteLue(page, MARQUE), "m²", "la ligne repliée n'écrit pas « par m² »");
  assert.equal(
    await uniteEnBase(page, MARQUE, "m²"),
    "m²",
    "l'unité choisie n'a pas survécu au rechargement : elle n'est pas partie en base"
  );
  console.log("  ✓ l'unité choisie est enregistrée, et se lit « par m² »");

  // --- 4. La case reste libre : le stère s'écrit toujours ------------------
  await ouvrir(page, MARQUE);
  const champLibre = page.getByLabel("Une autre unité");
  await champLibre.fill("stère");
  await ecritureFinie(page, () => champLibre.press("Enter"));
  assert.equal(
    await uniteEnBase(page, MARQUE, "stère"),
    "stère",
    "son unité à lui n'a pas tenu : la liste s'est refermée sur les six proposées"
  );
  console.log("  ✓ une unité à lui, « stère », s'écrit et tient");

  // --- 5. Et l'on peut revenir en arrière ----------------------------------
  groupe = await ouvrir(page, MARQUE);
  await ecritureFinie(page, () => groupe.getByRole("button", { name: "Aucune", exact: true }).click());
  assert.equal(
    await uniteEnBase(page, MARQUE, ""),
    "",
    "une unité posée par erreur ne peut plus être retirée : le champ est pourtant facultatif"
  );
  const replie = await ligneDuTarif(page, MARQUE).innerText();
  assert.ok(!/Choisir/.test(replie), `sans unité, la ligne dit encore « Choisir… » : « ${replie} »`);
  console.log("  ✓ « Aucune » efface un choix posé par erreur, et le prix s'écrit seul");

  // --- Ne rien laisser derrière, et le VÉRIFIER ---------------------------
  //
  // Le retrait n'écrit qu'à la fermeture du tiroir, six secondes plus tard
  // (`useRetraits`). Partir sans attendre laisserait un tarif de plus à chaque
  // exécution dans la grille du jeu de démonstration.
  await ouvrir(page, MARQUE);
  await page.getByRole("button", { name: `Retirer le tarif « ${MARQUE} »` }).click();
  await page.waitForTimeout(7_000);
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    !(await page.locator("body").innerText()).includes(MARQUE),
    "le tarif de la suite est resté dans sa grille"
  );

  await contexte.close();
  await navigateur.close();
  console.log("\n✅ Le choix de l'unité tient, et la case reste libre.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
