import assert from "node:assert/strict";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { GRILLES_PAR_DEFAUT, cellulesDe, type NatureGrille } from "../src/lib/grille-prix";

/** Les natures affichées, dans l'ordre de l'écran (`GrillesPrixClient`). */
const NATURES: NatureGrille[] = ["abattage", "grumes", "fendage", "dessouchage", "haie"];

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
//   3. elle tient dans la largeur d'un vrai téléphone. Huit colonnes de
//      diamètres en auraient fait quarante par colonne : c'est pour ça qu'elle
//      est dépliée en blocs, et c'est ce qu'on vérifie ;
//   4. **les trois grilles sont là** — abattre, fendre, tailler. Une grille
//      qu'il ne voit pas n'existe pas pour lui.

const BASE = "http://localhost:3000";
async function main() {
  const navigateur = await lancerNavigateur();
  // L'écran du patron vient de `e2e-browser` : 390 px de large, et non les 393
  // qu'on écrivait ici — trois pixels de marge qu'on s'accordait à soi-même.
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  // --- 1. On la trouve depuis les réglages ---------------------------------
  // Depuis le 14 août 2026, les prix vivent sous « Tarifs & catalogue » —
  // main-d'œuvre, machine et matière au même endroit (`ARCHITECTURE.md` §96).
  await page.goto(`${BASE}/reglages/tarifs`, { waitUntil: "networkidle" });
  const lien = page.getByRole("link", { name: /Mes prix/i });
  assert.equal(await lien.count(), 1, "Aucun lien vers les grilles dans les réglages : l'écran est introuvable.");
  await lien.click();
  await page.waitForURL(/\/reglages\/prix/);
  console.log("  ✓ les grilles s'atteignent depuis les réglages");

  // **Le décompte AVANT de remplir quoi que ce soit.**
  //
  // Ce contrôle attendait « 1 case remplie » — il se croyait seul à écrire dans
  // cette grille. Il ne l'est pas : sur le devis, enregistrer une ligne range
  // son prix dans la bonne case (`apprendrePrixGrille`), et c'est même le
  // sujet du produit — *« je fais plein de devis et dans un mois tu sauras les
  // remplir tout seul »*. Toute suite qui chiffre un devis avant celle-ci
  // remplit donc une case, et l'ordre alphabétique décide de qui passe en
  // premier. Le 13 août 2026, une suite nouvelle nommée « choix-civilite » est
  // arrivée avant « grille-prix » : le décompte a dit 2, et le contrôle a
  // accusé l'écran d'un défaut qui n'existait pas.
  //
  // On mesure donc l'ÉCART que produit notre propre saisie, seule chose dont
  // ce contrôle réponde.
  // L'écran arrive en deux temps : le décompte n'existe qu'une fois les
  // grilles peintes. Le lire trop tôt rendait « CHARGEMENT… » et faisait
  // accuser l'écran de n'annoncer aucun décompte.
  //
  // **Le motif désigne le REPLI, avec son décompte.** Depuis le 14 août 2026 la
  // rangée porte aussi une croix « Retirer Arbre 10 à 15 m » : un motif lâche
  // en trouvait deux, et l'échec accusait l'écran de ne plus afficher sa
  // rangée — alors qu'il en affichait une de plus.
  await page.getByRole("button", { name: /^Arbre 10 à 15 m \d+ \/ \d+$/ }).waitFor({ timeout: 30_000 });
  const decompteAvant = await lireDecompte(page);

  // --- 2. Un prix saisi survit au rechargement -----------------------------
  //
  // Le bloc « 10 à 15 m », le diamètre « 40 à 50 cm » : la case qu'un chêne
  // ordinaire désigne.
  await page.getByRole("button", { name: /^Arbre 10 à 15 m \d+ \/ \d+$/ }).click();
  // **Le nom accessible porte la grille ET la rangée.** Depuis l'arrivée du
  // dessouchage, « 40 à 50 cm » désigne deux cases à l'écran : un tronc à fendre
  // et une souche à arracher. Viser le libellé court seul rendrait ce contrôle
  // ambigu — et, le jour où il choisirait la mauvaise, il vérifierait le prix
  // d'une souche en croyant vérifier celui d'une fente.
  const champ = page.getByLabel("Fendre le bois — Arbre 10 à 15 m — 40 à 50 cm");
  await champ.fill("270");
  // Le prix part au serveur quand le champ perd le focus — comme sur le devis.
  await page.getByRole("button", { name: /^Arbre 10 à 15 m \d+ \/ \d+$/ }).click();
  await page.waitForTimeout(1200);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Arbre 10 à 15 m \d+ \/ \d+$/ }).click();
  assert.equal(
    await page.getByLabel("Fendre le bois — Arbre 10 à 15 m — 40 à 50 cm").inputValue(),
    "270",
    "Le prix ne survit pas au rechargement : le patron croirait avoir mal tapé."
  );
  console.log("  ✓ un prix saisi survit au rechargement");

  // --- 3. Le décompte dit ce qui reste à faire -----------------------------
  // **Le total se calcule, il ne se recopie pas.** Il était écrit « 73 » en dur,
  // et ajouter deux natures le 8 août 2026 a fait échouer ce contrôle pour une
  // bonne raison qui n'était pas la sienne. Dérivé des grilles, il suit.
  const TOTAL = NATURES.reduce((n, nature) => n + cellulesDe(nature, GRILLES_PAR_DEFAUT).length, 0);
  const corps = await page.locator("body").innerText();
  const decompteApres = await lireDecompte(page);
  assert.equal(
    decompteApres.total,
    TOTAL,
    `Le décompte annonce ${decompteApres.total} cases au lieu de ${TOTAL}.`
  );
  assert.equal(
    decompteApres.remplies,
    decompteAvant.remplies + 1,
    `Le décompte n'a pas suivi la case qu'on vient de remplir : ` +
      `${decompteAvant.remplies} avant, ${decompteApres.remplies} après.`
  );
  console.log(`  ✓ elle dit combien de cases sont remplies, sur ${TOTAL}`);

  // --- 3 bis. Les CINQ grilles sont là -------------------------------------
  //
  // **Ses réponses du 8 août**, à deux séries de questions : l'abattage à la
  // technique × le diamètre, la haie au mètre linéaire, puis « le dessouchage
  // oui, et les grumes aussi ». Une grille qui n'apparaît pas à l'écran
  // n'existe pas pour lui — elle ne se remplira jamais.
  for (const titre of [
    "Abattre un arbre",
    "Enlever les grumes",
    "Fendre le bois",
    "Dessoucher",
    "Tailler une haie",
  ]) {
    assert.match(corps, new RegExp(titre), `La grille « ${titre} » n'est pas à l'écran.`);
  }
  assert.match(
    corps,
    /Prix du mètre linéaire/,
    "La haie n'a pas son champ : elle n'a qu'une case, elle doit se remplir sans déplier quoi que ce soit."
  );
  // Le dessouchage n'a qu'un axe : ses huit diamètres doivent être là sans
  // qu'on ait à déplier quoi que ce soit.
  assert.match(
    corps,
    // Insensible à la casse : `innerText` rend le texte TEL QU'IL S'AFFICHE, et
    // ce libellé est en petites capitales — il remonte donc en majuscules.
    /diamètre de la souche/i,
    "Le dessouchage ne montre pas son axe : ses huit cases sont repliées pour rien."
  );
  console.log("  ✓ les cinq grilles sont à l'écran, chacune dans sa forme");

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
  console.log("  ✓ rien ne déborde de la largeur d'un vrai téléphone");

  // --- 5. Vider une case la rend à la question -----------------------------
  //
  // Se corriger doit être possible. Une case qu'on vide redevient une question
  // posée ; un zéro enregistré se proposerait sur un devis.
  await page.getByLabel("Fendre le bois — Arbre 10 à 15 m — 40 à 50 cm").fill("");
  await page.getByRole("button", { name: /^Arbre 10 à 15 m \d+ \/ \d+$/ }).click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Arbre 10 à 15 m \d+ \/ \d+$/ }).waitFor({ timeout: 30_000 });
  // **On revient au décompte de DÉPART, pas à zéro.** Attendre « Aucune case
  // remplie » supposait encore que ce contrôle est seul à écrire dans cette
  // grille — or toute suite qui chiffre un devis avant lui y range un prix.
  // C'est le même piège qu'au décompte d'entrée, et il s'est repris ici une
  // ligne plus bas.
  const decompteFinal = await lireDecompte(page);
  assert.equal(
    decompteFinal.remplies,
    decompteAvant.remplies,
    "Une case vidée reste enregistrée : le patron ne peut pas revenir sur un prix faux. " +
      `(${decompteAvant.remplies} au départ, ${decompteFinal.remplies} après l'avoir vidée.)`
  );
  console.log("  ✓ vider une case la rend à la question");

  await navigateur.close();
  console.log("✅ Les grilles se trouvent, se remplissent, se corrigent, et tiennent dans un téléphone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * « N case(s) remplie(s) sur M », lu sur l'écran des grilles.
 *
 * Une seule écriture de cette lecture : recopiée aux deux endroits qui en ont
 * besoin, elle finirait par lire deux choses différentes du même écran.
 */
async function lireDecompte(page: Page): Promise<{ remplies: number; total: number }> {
  const corps = await page.locator("body").innerText();
  // **« Aucune case remplie sur 82 » est un décompte, lui aussi.** L'écran
  // change de phrase à zéro, pour dire ce qui va se passer plutôt qu'un « 0 »
  // sec — et une lecture qui n'attendrait que des chiffres accuserait alors
  // l'écran de n'annoncer aucun décompte, sur une grille toute neuve.
  const aucune = /Aucune\s+case\s+remplie\s+sur\s+(\d+)/i.exec(corps);
  if (aucune) return { remplies: 0, total: Number(aucune[1]) };

  const trouve = /(\d+)\s+cases?\s+remplies?\s+sur\s+(\d+)/.exec(corps);
  if (!trouve) {
    throw new Error(
      `L'écran n'annonce aucun décompte. Lu : « ${corps.replace(/\s+/g, " ").slice(0, 200)} »`
    );
  }
  return { remplies: Number(trouve[1]), total: Number(trouve[2]) };
}
