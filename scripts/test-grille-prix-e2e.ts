import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **Les trois grilles de prix, dans un vrai navigateur, sur un vrai téléphone.**
//
// Ce que les suites sans navigateur ne peuvent pas voir, et qui a déjà coûté
// trois défauts réels à ce projet — une barre de navigation en trop, un ordre
// de totaux, une pile de notifications qui poussait le contenu hors de l'écran :
// **un écran juste en base peut être inutilisable en main.**
//
// Ici, trois choses qu'aucun test de fonction n'attrape :
//
//   1. la grille est **atteignable** depuis les réglages — un écran qu'on ne
//      trouve pas n'existe pas ;
//   2. un prix saisi **survit au rechargement**. Un champ qui se vide après
//      coup ferait croire au patron qu'il a mal tapé, dix fois de suite ;
//   3. elle tient dans **393 pixels** de large. Huit colonnes de diamètres en
//      auraient fait quarante par colonne : c'est pour ça qu'elle est dépliée
//      en blocs, et c'est ce qu'on vérifie ;
//   4. **les trois grilles sont là** — abattre, fendre, tailler. Une grille
//      qu'il ne voit pas n'existe pas pour lui.

const BASE = "http://localhost:3000";
const LARGEUR = 393;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: LARGEUR, height: 852 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  // --- 1. On la trouve depuis les réglages ---------------------------------
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  const lien = page.getByRole("link", { name: /Mes prix/i });
  assert.equal(await lien.count(), 1, "Aucun lien vers les grilles dans les réglages : l'écran est introuvable.");
  await lien.click();
  await page.waitForURL(/\/reglages\/prix/);
  console.log("  ✓ les grilles s'atteignent depuis les réglages");

  // --- 2. Un prix saisi survit au rechargement -----------------------------
  //
  // Le bloc « 10 à 15 m », le diamètre « 40 à 50 cm » : la case qu'un chêne
  // ordinaire désigne.
  await page.getByRole("button", { name: /Arbre 10 à 15 m/ }).click();
  const champ = page.getByLabel("40 à 50 cm");
  await champ.fill("270");
  // Le prix part au serveur quand le champ perd le focus — comme sur le devis.
  await page.getByRole("button", { name: /Arbre 10 à 15 m/ }).click();
  await page.waitForTimeout(1200);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Arbre 10 à 15 m/ }).click();
  assert.equal(
    await page.getByLabel("40 à 50 cm").inputValue(),
    "270",
    "Le prix ne survit pas au rechargement : le patron croirait avoir mal tapé."
  );
  console.log("  ✓ un prix saisi survit au rechargement");

  // --- 3. Le décompte dit ce qui reste à faire -----------------------------
  const corps = await page.locator("body").innerText();
  assert.match(
    corps,
    /1 case remplie sur 73/,
    `Le décompte ne dit pas où en est la grille. Lu : « ${corps.replace(/\s+/g, " ").slice(0, 200)} »`
  );
  console.log("  ✓ elle dit combien de cases sont remplies, sur 73");

  // --- 3 bis. Les trois grilles sont là ------------------------------------
  //
  // **Sa réponse du 8 août au soir**, à deux questions posées avec leurs
  // options : l'abattage à la technique × le diamètre, la haie au mètre
  // linéaire. Une grille qui n'apparaît pas à l'écran n'existe pas pour lui.
  for (const titre of ["Abattre un arbre", "Fendre le bois", "Tailler une haie"]) {
    assert.match(corps, new RegExp(titre), `La grille « ${titre} » n'est pas à l'écran.`);
  }
  assert.match(
    corps,
    /Prix du mètre linéaire/,
    "La haie n'a pas son champ : elle n'a qu'une case, elle doit se remplir sans déplier quoi que ce soit."
  );
  console.log("  ✓ les trois grilles sont à l'écran : abattre, fendre, tailler");

  // --- 4. Rien ne déborde de l'écran ---------------------------------------
  //
  // Le contrôle qui justifie la forme dépliée. Un tableau à huit colonnes
  // passerait tous les tests de fonction et serait illisible en main.
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert.ok(
    debordement <= 1,
    `La page déborde de ${debordement} px : la grille ne tient pas dans un téléphone.`
  );
  console.log("  ✓ rien ne déborde d'un écran de 393 px");

  // --- 5. Vider une case la rend à la question -----------------------------
  //
  // Se corriger doit être possible. Une case qu'on vide redevient une question
  // posée ; un zéro enregistré se proposerait sur un devis.
  await page.getByLabel("40 à 50 cm").fill("");
  await page.getByRole("button", { name: /Arbre 10 à 15 m/ }).click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  assert.match(
    await page.locator("body").innerText(),
    /Aucune case remplie sur 73/,
    "Une case vidée reste enregistrée : le patron ne peut pas revenir sur un prix faux."
  );
  console.log("  ✓ vider une case la rend à la question");

  await navigateur.close();
  console.log("✅ Les grilles se trouvent, se remplissent, se corrigent, et tiennent dans un téléphone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
