import assert from "node:assert/strict";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { GRILLES_PAR_DEFAUT, cellulesDe } from "../src/lib/grille-prix";

// **« Je dois pouvoir ajouter ou retirer des cases. »** — le patron, le 14 août
// 2026, capture de l'écran « Mes prix » à l'appui. Trois formes dessinées
// (`maquettes/atlas-grilles-cases.html`), et sa réponse : *« code les toutes »*.
//
// Les règles sont éprouvées sans navigateur (`test-cases-reglables.ts`), le
// parcours en base aussi (`test-cases-reglables-db.ts`). Ce que CETTE suite
// tient, et qu'aucune des deux ne peut tenir :
//
//   · **la conséquence est SOUS SES YEUX avant qu'il valide.** Une tranche de
//     diamètre en pose dix d'un coup ; un écran qui le tait transforme un geste
//     anodin en dix questions surprises au chantier suivant ;
//   · **un refus lui parvient.** La dernière tranche est ouverte : tout ce qui
//     dépasse 90 cm y tombe déjà. Le refus doit s'afficher ET dire quoi faire,
//     sinon il réessaie trois fois et croit l'application cassée ;
//   · **le tiroir « Annuler » s'ouvre**, et dit combien de prix partent avec ;
//   · **les trois formes existent** : dans la grille, dans « Mes mesures », et
//     un travail entier.
//
// **Elle repart de ce qu'elle a trouvé.** L'écran est partagé avec
// `test-grille-prix-e2e`, qui compte les cases : une tranche oubliée ici la
// ferait rougir ailleurs, et l'échec accuserait le décompte.

const BASE = "http://localhost:3000";
const TOTAL_DEPART = GRILLES_PAR_DEFAUT.natures.reduce(
  (n, nature) => n + cellulesDe(nature.cle, GRILLES_PAR_DEFAUT).length,
  0
);

/** Le décompte que l'écran annonce : « 2 cases remplies sur 82. » */
async function totalAnnonce(page: Page): Promise<number> {
  const texte = await page.locator("body").innerText();
  const m = texte.match(/sur (\d+)\./);
  assert.ok(m, `Le décompte des cases est introuvable. Lu : « ${texte.slice(0, 200)} »`);
  return Number(m[1]);
}

async function main() {
  const navigateur = await lancerNavigateur();
  // Son écran : les encarts de conséquence et les rangs se lisent autrement sur
  // un ordinateur, et c'est sur un téléphone qu'il règle ses prix.
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/reglages/prix`, { waitUntil: "networkidle" });
  const auDepart = await totalAnnonce(page);
  assert.equal(auDepart, TOTAL_DEPART, "L'écran ne part pas des grilles d'origine : une suite a laissé quelque chose.");
  console.log(`  ✓ l'écran part de ses ${TOTAL_DEPART} cases`);

  // --- 1. La conséquence est dite AVANT de valider -------------------------
  await page.getByRole("button", { name: /^Au pied \d+ \/ \d+$/ }).click();
  const ajouter = page.getByRole("button", { name: "Ajouter une tranche de diamètre" }).first();
  await ajouter.click();

  const encart = page.getByText(/ajoutera \d+ cases? en tout/);
  await encart.waitFor({ state: "visible" });
  const dit = await encart.innerText();
  assert.match(dit, /10 cases/, `L'écran annonce « ${dit} » : une tranche de diamètre en pose dix.`);
  for (const grille of ["abattre", "fendre", "dessoucher"]) {
    assert.ok(dit.toLowerCase().includes(grille), `L'encart ne nomme pas « ${grille} ». Lu : « ${dit} »`);
  }
  console.log("  ✓ l'écran annonce les dix cases, et nomme les grilles touchées");

  // --- 2. Un refus lui parvient, et dit quoi faire -------------------------
  await page.getByLabel("Borne basse, en cm").first().fill("90");
  await page.getByLabel(/Borne haute, en cm/).first().fill("120");
  await page.getByRole("button", { name: "Ajouter", exact: true }).first().click();

  // **Le premier `role="alert"` de la page n'est pas le nôtre.** L'écran en
  // porte un autre, vide tant qu'il n'annonce rien — et c'est lui que le
  // sélecteur attrapait, si bien que le contrôle lisait « » et accusait le
  // refus de ne rien dire. On vise celui qui PARLE.
  const refus = page.locator('[role="alert"]').filter({ hasText: /.+/ }).first();
  await refus.waitFor({ state: "visible", timeout: 10_000 });
  const raison = await refus.innerText();
  assert.match(raison, /borne haute/i, `Le refus n'explique pas ce qui bloque : « ${raison} »`);
  assert.match(raison, /Retirez-la d'abord/i, `Le refus ne dit pas comment s'en sortir : « ${raison} »`);
  assert.equal(await totalAnnonce(page), TOTAL_DEPART, "Une tranche refusée a quand même été posée.");
  console.log("  ✓ le refus s'affiche, et dit quoi faire");

  // --- 3. Retirer : le tiroir dit ce qu'il emporte, et rend --------------
  await page.getByRole("button", { name: "Retirer la tranche jusqu'à 20 cm" }).first().click();
  const tiroir = page.locator('[role="status"]').filter({ hasText: /.+/ }).first();
  await tiroir.waitFor({ state: "visible", timeout: 10_000 });
  const dire = await tiroir.innerText();
  assert.match(dire, /jusqu'à 20 cm/, `Le tiroir ne nomme pas ce qui est parti : « ${dire} »`);
  assert.match(dire, /prix|aucun prix/i, `Le tiroir ne dit pas ce qui part avec : « ${dire} »`);

  await page.waitForFunction(
    (attendu) => !document.body.innerText.includes(`sur ${attendu}.`),
    TOTAL_DEPART,
    { timeout: 10_000 }
  );
  const apresRetrait = await totalAnnonce(page);
  assert.equal(apresRetrait, TOTAL_DEPART - 10, `Retirer une tranche a rangé ${TOTAL_DEPART - apresRetrait} cases.`);
  console.log("  ✓ retirer une tranche range bien dix cases, et le tiroir le dit");

  await tiroir.getByRole("button", { name: "Annuler" }).click();
  await page.waitForFunction((attendu) => document.body.innerText.includes(`sur ${attendu}.`), TOTAL_DEPART, {
    timeout: 10_000,
  });
  console.log("  ✓ « Annuler » rend la tranche et ses cases");

  // --- 4. « Mes mesures » : les trois axes, et ce qu'ils portent -----------
  await page.goto(`${BASE}/reglages/prix/mesures`, { waitUntil: "networkidle" });
  const mesures = await page.locator("body").innerText();
  for (const bloc of ["Diamètres", "Hauteurs d'arbre", "Façons d'abattre"]) {
    assert.ok(mesures.includes(bloc), `« ${bloc} » manque à l'écran des mesures.`);
  }
  assert.match(mesures, /Sert à \d+ grilles?/, "L'écran ne dit pas à quelles grilles un axe sert.");
  assert.ok(/\bvide\b/.test(mesures), "Aucune tranche n'annonce ce qu'elle porte.");
  console.log("  ✓ « Mes mesures » montre les trois axes et ce qu'ils portent");

  // Une façon d'abattre ajoutée ici doit apparaître dans « Mes prix ».
  await page.getByRole("button", { name: "Ajouter une façon" }).click();
  const nomFacon = `Par câble ${Date.now()}`;
  await page.getByLabel("Nom de la façon d'abattre").fill(nomFacon);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText(nomFacon).first().waitFor({ state: "visible", timeout: 10_000 });

  await page.goto(`${BASE}/reglages/prix`, { waitUntil: "networkidle" });
  assert.equal(
    await totalAnnonce(page),
    TOTAL_DEPART + 8,
    "Une façon d'abattre de plus n'a pas ajouté ses huit cases."
  );
  assert.ok(
    (await page.locator("body").innerText()).includes(nomFacon),
    "La façon ajoutée dans « Mes mesures » n'apparaît pas dans « Mes prix »."
  );
  console.log("  ✓ une façon d'abattre ajoutée arrive dans la grille d'abattage");

  // --- 5. Un travail entier, et la limite dite ----------------------------
  const nomTravail = `Broyer ${Date.now()}`;
  await page.getByRole("button", { name: "Ajouter un travail" }).click();
  await page.getByLabel("Nom du travail").fill(nomTravail);
  await page.getByRole("radio", { name: /Par diamètre/ }).click();
  await page.getByRole("button", { name: "Ajouter ce travail" }).click();
  await page.getByRole("heading", { name: nomTravail }).waitFor({ state: "visible", timeout: 10_000 });

  assert.equal(
    await totalAnnonce(page),
    TOTAL_DEPART + 8 + 8,
    "Un travail « par diamètre » n'a pas ajouté ses huit cases."
  );
  // **La limite, dite plutôt que découverte sur un devis.** Le chiffrage ne sait
  // pas retrouver « le broyage » dans une note vocale.
  assert.ok(
    (await page.locator("body").innerText()).includes("il ne le reconnaîtra pas tout seul"),
    "L'écran laisse croire qu'Atlas chiffrera ce travail tout seul depuis une dictée."
  );
  console.log("  ✓ un travail entier s'ajoute, et l'écran dit ce qu'Atlas n'en fera pas");

  // --- Ne rien laisser derrière, et le VÉRIFIER ---------------------------
  await page.getByRole("button", { name: `Retirer le travail ${nomTravail}` }).click();
  await page.waitForFunction((a) => document.body.innerText.includes(`sur ${a}.`), TOTAL_DEPART + 8, {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: `Retirer ${nomFacon}` }).first().click();
  await page.waitForFunction((a) => document.body.innerText.includes(`sur ${a}.`), TOTAL_DEPART, {
    timeout: 10_000,
  });

  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await totalAnnonce(page), TOTAL_DEPART, "La suite a laissé une tranche ou un travail derrière elle.");
  console.log("  ✓ l'écran est rendu tel qu'il a été trouvé");

  await contexte.close();
  await navigateur.close();
  console.log("\n✅ Les cases s'ajoutent, se retirent, et rien ne part en silence.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
