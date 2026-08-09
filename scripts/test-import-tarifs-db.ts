import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { listerTarifs, creerTarif } from "../src/server/repositories/tarifs";
import { rapprocher, lireTableau } from "../src/lib/import-tarifs";
import { lireFichierTarifs } from "../src/server/import/lire-fichier-tarifs";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **L'import d'une liste de prix, jusqu'en base.**
//
// Les règles de lecture sont éprouvées sans base (`test-import-tarifs.ts`). Ce
// que CETTE suite tient, et qu'elles ne peuvent pas tenir : que le fichier du
// patron arrive réellement dans SES tarifs, et **nulle part ailleurs**.
//
// Le risque n'est pas théorique. Ces tarifs commandent le prix des devis ; un
// import qui déborderait d'une entreprise sur une autre ferait chiffrer un
// artisan avec la grille de son concurrent.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/** La feuille du patron, telle qu'il l'aurait exportée d'Excel. */
const CSV = [
  "Intitulé;Prix (€);Unité",
  "Main d'œuvre;450,00;jour/homme",
  "Broyeur;200,00;Jour",
  "ABATTAGE;;",
  "Fendeuse;150,00;Jour",
  "Mini pelle;sur devis;Jour",
].join("\n");

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage A" },
    { email: "import-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage B" },
    { email: "import-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // A a déjà un tarif, au même nom mais à un autre prix : c'est le cas qui
  // décide si l'import CRÉE un doublon ou CORRIGE l'existant.
  await creerTarif(A, { intitule: "Main d'œuvre", prix: "400.00", unite: "jour/homme" });

  await test("le fichier se lit, et le rapprochement sait ce qu'il ferait", async () => {
    const lecture = lireFichierTarifs("tarifs.csv", new TextEncoder().encode(CSV));
    assert.equal(lecture.statut, "lu");
    if (lecture.statut !== "lu") return;

    const existants = (await listerTarifs(A)).map((t) => ({
      id: t.id,
      intitule: t.intitule,
      prix: t.prix,
      unite: t.unite,
    }));
    const r = rapprocher(existants, lecture.lecture.retenues);

    assert.deepStrictEqual(
      r.aCreer.map((l) => l.intitule).sort(),
      ["Broyeur", "Fendeuse"],
      "les tarifs nouveaux ne sont pas ceux attendus"
    );
    assert.strictEqual(r.aMettreAJour.length, 1, "« Main d'œuvre » aurait dû être reconnu comme existant");
    assert.strictEqual(r.aMettreAJour[0].avant.prix, "400.00");
    assert.strictEqual(r.aMettreAJour[0].apres.prix, "450.00");
  });

  await test("LIRE N'ÉCRIT RIEN — la garantie de tout le parcours", async () => {
    // Le patron doit pouvoir déposer un fichier, regarder, et repartir sans
    // rien avoir changé. Sans cela, un fichier ouvert par curiosité écraserait
    // sa grille — et il ne le découvrirait que sur un devis déjà envoyé.
    const avant = await listerTarifs(A);
    lireFichierTarifs("tarifs.csv", new TextEncoder().encode(CSV));
    const apres = await listerTarifs(A);
    assert.strictEqual(apres.length, avant.length, "la simple lecture a créé un tarif");
  });

  await test("après écriture, A a la grille de son fichier — et rien d'inventé", async () => {
    const lecture = lireFichierTarifs("tarifs.csv", new TextEncoder().encode(CSV));
    if (lecture.statut !== "lu") throw new Error("fichier non lu");
    const existants = (await listerTarifs(A)).map((t) => ({
      id: t.id,
      intitule: t.intitule,
      prix: t.prix,
      unite: t.unite,
    }));
    const r = rapprocher(existants, lecture.lecture.retenues);

    for (const ligne of r.aCreer) {
      await creerTarif(A, {
        intitule: ligne.intitule,
        prix: ligne.prix,
        ...(ligne.unite ? { unite: ligne.unite } : {}),
      });
    }

    const apres = await listerTarifs(A);
    const parNom = new Map(apres.map((t) => [t.intitule, t]));
    assert.ok(parNom.has("Broyeur") && parNom.has("Fendeuse"));
    // « ABATTAGE » est un titre de rubrique, « Mini pelle » est « sur devis ».
    // Ni l'un ni l'autre ne doit exister — surtout pas à 0 €.
    assert.ok(!parNom.has("ABATTAGE"), "une ligne de titre est devenue un tarif");
    assert.ok(!parNom.has("Mini pelle"), "« sur devis » est devenu un prix");
    assert.strictEqual(apres.length, 3, `${apres.length} tarifs : ${[...parNom.keys()].join(", ")}`);
  });

  await test("l'import de A n'a rien mis chez B", async () => {
    const chezB = await listerTarifs(B);
    assert.strictEqual(chezB.length, 0, `B a reçu ${chezB.length} tarif(s) qui ne lui appartiennent pas`);
  });

  await test("un fichier illisible ne touche à rien et dit pourquoi", async () => {
    const avant = await listerTarifs(A);
    const r = lireFichierTarifs("photo.pdf", new TextEncoder().encode("%PDF-1.7\n"));
    assert.strictEqual(r.statut, "refuse");
    assert.strictEqual((await listerTarifs(A)).length, avant.length);
  });

  await test("une feuille entière de « sur devis » ne crée aucun tarif", async () => {
    // Le cas dégradé qu'il faut savoir traverser sans rien casser : un fichier
    // où AUCUNE ligne n'a de montant. Il ne doit ni planter, ni écrire.
    const sansPrix = "Intitulé;Prix\nÉlagage;sur devis\nAbattage;nous consulter\n";
    const lecture = lireFichierTarifs("x.csv", new TextEncoder().encode(sansPrix));
    assert.strictEqual(lecture.statut, "lu");
    if (lecture.statut !== "lu") return;
    assert.deepStrictEqual(lecture.lecture.retenues, []);
    assert.strictEqual(lecture.lecture.ecartees.length, 2, "les lignes écartées ne sont pas toutes signalées");
  });

  await test("le tableau lu est le même que celui du fichier — aucun glissement", async () => {
    // Contrôle de bout en bout du décodage : ce que `lireTableau` reçoit doit
    // être exactement ce que le patron voit dans son tableur.
    const lecture = lireFichierTarifs("tarifs.csv", new TextEncoder().encode(CSV));
    if (lecture.statut !== "lu") throw new Error("fichier non lu");
    const direct = lireTableau([
      ["Intitulé", "Prix (€)", "Unité"],
      ["Main d'œuvre", "450,00", "jour/homme"],
      ["Broyeur", "200,00", "Jour"],
      ["ABATTAGE", "", ""],
      ["Fendeuse", "150,00", "Jour"],
      ["Mini pelle", "sur devis", "Jour"],
    ]);
    assert.deepStrictEqual(lecture.lecture, direct);
  });

  console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} réussi(s), ${failed} échec(s).`);
  await pool.end();
  await fermerLimiteur();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
