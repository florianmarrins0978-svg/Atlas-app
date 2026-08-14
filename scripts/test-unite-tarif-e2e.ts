import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

// **« Crée-moi un bandeau déroulant avec infos à choisir, jours/hommes, m² etc. »**
// — le patron, le 13 août 2026, puis *« fais celle-là »* devant la forme 1 de
// `maquettes/atlas-unite-deroulante.html`.
//
// Les règles sont éprouvées sans navigateur (`test-unites-tarif.ts`). Ce que
// CETTE suite tient, et qu'aucune règle ne peut dire :
//
//   · **le bandeau n'est pas tranché.** La carte d'un tarif vit dans un
//     `LigneRetirable`, dont l'enveloppe masque ce qui dépasse pour pouvoir se
//     refermer — un bandeau posé dedans serait coupé net, et les dernières
//     unités deviendraient inatteignables. C'est le seul vrai risque de ce lot,
//     il ne se voit qu'à l'écran, et aucune règle pure ne le verra jamais ;
//   · **le choix arrive jusqu'en base** : rechargée, la page le porte encore ;
//   · **la case reste libre** : le stère s'écrit toujours. Une liste fermée
//     retirerait à un élagueur ce qu'il a aujourd'hui.

const BASE = "http://localhost:3000";

/**
 * La carte du tarif portant cet intitulé, désignée par sa POSITION réelle.
 *
 * **Pourquoi pas « la dernière ligne ».** « + Ajouter un tarif » passe par le
 * serveur : la carte n'apparaît qu'au retour, et l'ordre après rechargement
 * n'est pas celui de l'écran précédent. Viser la dernière ligne remplissait la
 * carte d'avant, puis les gestes suivants portaient sur une autre — l'échec
 * accusait alors le bandeau, qui n'y était pour rien. Une heure, le 14 août 2026.
 */
async function carteDuTarif(page: Page, marque: string): Promise<Locator> {
  const rang = await page.$$eval(
    '[aria-label="Intitulé du tarif"]',
    (champs, m) => (champs as HTMLInputElement[]).findIndex((c) => c.value === m),
    marque
  );
  assert.ok(rang >= 0, `Le tarif « ${marque} » a disparu de la grille.`);
  return page.locator("ul > li").nth(rang);
}

/** Ce que la case affiche, chevron mis à part. */
async function uniteLue(carte: Locator): Promise<string> {
  return (await carte.getByLabel("Unité du tarif").innerText()).trim().replace(/\s*▾$/, "");
}

/**
 * Recharger APRÈS que l'écriture soit partie, jamais pendant.
 *
 * **Ce que ça corrige, et pourquoi la suite mentait.** L'écran n'attend pas son
 * enregistrement (`void persister(…)` dans `ReglagesClient`) : le bandeau se
 * referme dès le doigt levé, et l'appel au serveur continue derrière. Recharger
 * à cet instant **avorte l'appel en vol** — l'unité n'arrive jamais en base, et
 * la suite accuse le bandeau d'avoir perdu la saisie.
 *
 * Elle passait seule et tombait dans la batterie complète, où le serveur est
 * occupé par soixante-quatorze autres suites : la course s'y perd. Une suite
 * qui échoue une fois sur trois s'apprend à être ignorée — c'est ce garde-fou
 * là qu'on perd, pas seulement dix minutes. Trouvée le 14 août 2026, sur un
 * lot qui n'était pas le mien.
 *
 * **`networkidle` NE SUFFIT PAS — constaté le 14 août 2026, dans la batterie.**
 * Il attend un demi-seconde de silence réseau, et l'écran est déjà silencieux
 * à l'instant où on le lui demande : React n'a pas encore lancé l'action. On
 * mesurait donc un calme d'AVANT l'appel, et le rechargement repartait dessus.
 * La suite passait seule et tombait sous les soixante-quinze autres. Le premier
 * correctif visait la bonne cause et s'arrêtait un cran trop tôt.
 *
 * **On relit donc la BASE, au lieu de deviner quand elle a reçu.** La page est
 * rechargée, la valeur relue du serveur ; si elle n'est pas encore là, on
 * recommence — jusqu'à quatre fois, en laissant à l'action le temps qu'il lui
 * faut sous la charge. C'est exactement le remède déjà écrit pour
 * `test-informations-e2e.ts` et `test-periodicite-tva-e2e.ts` : **attendre ce
 * qu'on affirme, jamais une durée.**
 *
 * Une suite qui échoue une fois sur trois s'apprend à être ignorée — c'est ce
 * garde-fou-là qu'on perd, pas seulement dix minutes.
 */
async function uniteEnBase(page: Page, marque: string, attendue: string): Promise<string> {
  let lue = "";
  for (const essai of [1, 2, 3, 4]) {
    await page.waitForLoadState("networkidle");
    await page.reload({ waitUntil: "networkidle" });
    lue = await uniteLue(await carteDuTarif(page, marque));
    if (lue === attendue) return lue;
    await page.waitForTimeout(essai * 400);
  }
  return lue;
}

async function main() {
  const navigateur = await lancerNavigateur();
  // **Son écran, et pas celui d'un ordinateur.** Sur un grand écran tout tient
  // sans effort : le bandeau ne passe jamais sous la barre basse, et le
  // contrôle 3 bis serait vert sans rien prouver. 390 × 664, c'est son iPhone.
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  // Les tarifs ont leur rubrique depuis le 14 août 2026 (ARCHITECTURE.md §96).
  await page.goto(`${BASE}/reglages/tarifs`, { waitUntil: "networkidle" });

  // **Son propre tarif, ajouté ici et retiré à la fin.** Se poser sur un tarif
  // du jeu de démonstration ferait dépendre le résultat de son contenu, et
  // laisserait la suite modifier une donnée qu'une autre suite lit.
  const MARQUE = `Unité E2E ${Date.now()}`;
  const rang = await page.locator("ul > li").count();
  await page.getByRole("button", { name: "+ Ajouter un tarif" }).click();
  const nouvelle = page.locator("ul > li").nth(rang);
  await nouvelle.waitFor({ state: "visible" });
  await nouvelle.getByLabel("Intitulé du tarif").fill(MARQUE);
  await nouvelle.getByLabel("Intitulé du tarif").blur();

  let carte = await carteDuTarif(page, MARQUE);
  const bandeau = () => carte.getByRole("listbox", { name: "Unités proposées" });

  // --- 1. Replié au départ, et la case invite à choisir --------------------
  assert.equal(await bandeau().count(), 0, "le bandeau est déjà déplié : il mange la carte de chaque tarif");
  assert.match(
    await uniteLue(carte),
    /Choisir/,
    "la case ne dit pas qu'on peut choisir : rien ne signale le bandeau"
  );
  console.log("  ✓ le bandeau est replié, et la case invite à choisir");

  // --- 2. Touchée, la case déplie le bandeau SOUS elle ----------------------
  await carte.getByLabel("Unité du tarif").click();
  await bandeau().waitFor({ state: "visible" });

  const c = (await carte.getByLabel("Unité du tarif").boundingBox())!;
  const b = (await bandeau().boundingBox())!;
  assert.ok(
    b.y >= c.y + c.height - 1,
    `le bandeau recouvre la case (case jusqu'à ${(c.y + c.height).toFixed(0)}, bandeau depuis ${b.y.toFixed(0)}) : il cache justement ce qu'on renseigne`
  );
  console.log("  ✓ le bandeau se déplie sous la case");

  // --- 3. LE contrôle : rien n'est tranché ---------------------------------
  //
  // Il sait échouer : remonter `<BandeauUnites>` dans la carte le rougit
  // aussitôt, et le message désigne l'enveloppe, pas le bandeau.
  assert.equal(
    await bandeau().evaluate((el) => (el.closest(".atlas-ligne") ? "dedans" : "dehors")),
    "dehors",
    "le bandeau est revenu DANS l'enveloppe de la ligne : elle masque ce qui dépasse pour pouvoir se refermer, donc elle le tranchera"
  );
  // La mesure structurelle ne dit rien d'un autre masquage : la dernière ligne
  // du bandeau doit être atteignable pour de bon.
  const libre = carte.getByLabel("Une autre unité");
  assert.ok(await libre.isVisible(), "la ligne libre, au bas du bandeau, n'est pas atteignable");
  console.log("  ✓ le bandeau est entier, hors de l'enveloppe qui se referme");

  // --- 3 bis. Et il se montre TOUT SEUL, barre basse comprise --------------
  //
  // Un tarif se règle en bas de la liste aussi souvent qu'en haut : le bandeau
  // s'ouvre alors sous le bord de l'écran, et le geste paraît sans effet. La
  // barre de navigation, elle, est posée par-dessus la page — s'arrêter « au
  // bord » cachait la ligne libre, celle qui sert justement à écrire son unité
  // à soi. Trouvé sur une capture, jamais par un test.
  // Le bandeau se montre EN DOUCEUR (`behavior: "smooth"`) : mesurer tout de
  // suite, c'est mesurer une page encore en train de glisser — et l'échec
  // accuserait alors la barre basse, qui n'y serait pour rien.
  await page.waitForTimeout(1_000);
  const place = await page.evaluate(() => {
    const champ = document.querySelector('[aria-label="Une autre unité"]')!.getBoundingClientRect();
    const barre = document.querySelector('nav[aria-label="Navigation principale"]')!.getBoundingClientRect();
    return { bas: Math.round(champ.bottom), barre: Math.round(barre.top) };
  });
  assert.ok(
    place.bas <= place.barre,
    `la ligne libre (jusqu'à ${place.bas}) passe sous la barre de navigation (à ${place.barre}) : elle est là, et intouchable`
  );
  console.log("  ✓ le bandeau se montre de lui-même, sans passer sous la barre basse");

  // --- 4. Ce qu'il a demandé y est -----------------------------------------
  const lignes = (await bandeau().innerText()).trim();
  for (const unite of ["Aucune unité", "jour/homme", "m²", "ml", "heure", "forfait", "tonne"]) {
    assert.ok(lignes.includes(unite), `« ${unite} » manque au bandeau. Lu : « ${lignes.replace(/\n/g, " · ")} »`);
  }
  assert.ok(lignes.includes("main d'œuvre"), "le bandeau ne dit plus à quoi sert « jour/homme »");
  console.log("  ✓ les six unités et « aucune unité » sont proposées");

  // --- 5. Choisir remonte dans la case, et arrive en base -------------------
  await bandeau().getByRole("option", { name: /^m²/ }).click();
  await bandeau().waitFor({ state: "detached" });
  assert.equal(await uniteLue(carte), "m²");

  assert.equal(
    await uniteEnBase(page, MARQUE, "m²"),
    "m²",
    "l'unité choisie n'a pas survécu au rechargement : elle n'est pas partie en base"
  );
  carte = await carteDuTarif(page, MARQUE);
  console.log("  ✓ l'unité choisie est enregistrée");

  // --- 6. La case reste libre : le stère s'écrit toujours ------------------
  await carte.getByLabel("Unité du tarif").click();
  const champLibre = carte.getByLabel("Une autre unité");
  await champLibre.waitFor({ state: "visible" });
  await champLibre.fill("stère");
  await champLibre.press("Enter");
  await bandeau().waitFor({ state: "detached" });

  assert.equal(
    await uniteEnBase(page, MARQUE, "stère"),
    "stère",
    "son unité à lui n'a pas tenu : la liste s'est refermée sur les six proposées"
  );
  carte = await carteDuTarif(page, MARQUE);
  console.log("  ✓ une unité à lui — « stère » — s'écrit et tient");

  // --- 7. Et l'on peut revenir en arrière ----------------------------------
  await carte.getByLabel("Unité du tarif").click();
  await bandeau().getByRole("option", { name: /Aucune unité/ }).click();
  await bandeau().waitFor({ state: "detached" });

  assert.match(
    // « Choisir… » est ce que la case affiche quand rien n'est posé : on attend
    // donc CE texte-là, et non l'absence de l'ancien.
    await uniteEnBase(page, MARQUE, "Choisir…"),
    /Choisir/,
    "une unité posée par erreur ne peut plus être retirée : le champ est pourtant facultatif"
  );
  carte = await carteDuTarif(page, MARQUE);
  console.log("  ✓ « Aucune unité » efface un choix posé par erreur");

  // --- Ne rien laisser derrière, et le VÉRIFIER ---------------------------
  //
  // Le retrait n'écrit qu'à la fermeture du tiroir — six secondes plus tard
  // (`useRetraits`). Partir sans attendre laisserait un tarif de plus à chaque
  // exécution dans la grille du jeu de démonstration.
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
