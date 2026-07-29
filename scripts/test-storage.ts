import assert from "node:assert";
import { enregistrerObjet, lireObjet, supprimerObjet } from "../src/server/storage/local-storage";

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

async function main() {
  await test("Upload puis lecture : le contenu relu est identique à l'original", async () => {
    const contenu = Buffer.from("contenu de test atlas");
    const objet = await enregistrerObjet("tests", contenu, ".txt");
    assert.ok(objet.storageKey.startsWith("tests/"));
    assert.equal(objet.tailleOctets, contenu.length);

    const relu = await lireObjet(objet.storageKey);
    assert.ok(relu.equals(contenu));
  });

  await test("Suppression : l'objet n'est plus lisible ensuite", async () => {
    const objet = await enregistrerObjet("tests", Buffer.from("à supprimer"), ".txt");
    await supprimerObjet(objet.storageKey);
    let leve = false;
    try {
      await lireObjet(objet.storageKey);
    } catch {
      leve = true;
    }
    assert.ok(leve, "La lecture d'un objet supprimé doit échouer");
  });

  await test("Suppression idempotente : supprimer deux fois ne lève jamais", async () => {
    const objet = await enregistrerObjet("tests", Buffer.from("double suppression"), ".txt");
    await supprimerObjet(objet.storageKey);
    await supprimerObjet(objet.storageKey);
  });

  await test("Lecture d'un objet inexistant : échec explicite, jamais un contenu vide silencieux", async () => {
    let leve = false;
    try {
      await lireObjet("tests/inexistant-totalement-" + Date.now() + ".txt");
    } catch {
      leve = true;
    }
    assert.ok(leve);
  });

  await test("Clé objet stable et sans risque de traversée de chemin", async () => {
    const objet = await enregistrerObjet("tests", Buffer.from("x"), ".txt");
    assert.ok(!objet.storageKey.includes(".."));
    const segments = objet.storageKey.split("/");
    assert.equal(segments.length, 2);
    await supprimerObjet(objet.storageKey);
  });

  await test("Isolation par dossier : deux clés générées pour des dossiers différents ne se chevauchent jamais", async () => {
    const objetA = await enregistrerObjet("locataire-a", Buffer.from("a"), ".txt");
    const objetB = await enregistrerObjet("locataire-b", Buffer.from("b"), ".txt");
    assert.notEqual(objetA.storageKey, objetB.storageKey);
    assert.ok(objetA.storageKey.startsWith("locataire-a/"));
    assert.ok(objetB.storageKey.startsWith("locataire-b/"));
    const contenuA = await lireObjet(objetA.storageKey);
    assert.equal(contenuA.toString(), "a");
    await supprimerObjet(objetA.storageKey);
    await supprimerObjet(objetB.storageKey);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
