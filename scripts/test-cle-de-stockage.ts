// Une clé de stockage ne sort jamais du dossier de stockage.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROTÈGE, ET CE QUI L'A RENDUE NÉCESSAIRE.**
//
// Audit du 23 août 2026. `local-storage.ts` portait ce commentaire :
//
//   « storageKey ne contient que des segments alphanumériques […] jamais
//     construits à partir d'une entrée utilisateur brute — pas de risque de
//     traversée de répertoire. »
//
// **C'était faux, et c'est justement pour ça que personne ne l'avait vu** : on
// relit un commentaire rassurant et l'on passe. `path.join` résout les `..`, et
// le dossier passé à `enregistrerObjet` porte un identifiant venu d'une action
// serveur. L'adaptateur S3 assainissait depuis toujours ; deux implémentations
// du même contrat, une seule prudente, et c'est la faible qui sert sur le banc.
//
// Ni base, ni réseau — on écrit dans un dossier d'essai et on regarde où les
// octets atterrissent.

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function main() {
  // Le module lit `process.cwd()` à l'import : on l'y amène avant de le charger.
  const bac = mkdtempSync(path.join(tmpdir(), "atlas-stockage-"));
  const departCwd = process.cwd();
  process.chdir(bac);
  const stockage = await import("../src/server/storage/local-storage");

  console.log("=== Une clé de stockage reste dans son dossier ===\n");

  // ─── D'abord : le rangement ORDINAIRE marche encore ──────────────────────

  await essai("une photo ordinaire se range, se relit, et porte sa somme", async () => {
    const octets = Buffer.from("des octets de photo");
    const objet = await stockage.enregistrerObjet("chantiers/abc/photos", octets, ".jpg");
    assert.match(objet.storageKey, /^chantiers\/abc\/photos\/[0-9a-f-]+\.jpg$/);
    assert.equal(objet.tailleOctets, octets.length);
    const relu = await stockage.lireObjet(objet.storageKey);
    assert.equal(relu.toString(), "des octets de photo");
    // Et le fichier est bien SOUS `.storage`, pas ailleurs.
    assert.ok(existsSync(path.join(bac, ".storage", objet.storageKey)));
  });

  // ─── LA TRAVERSÉE ────────────────────────────────────────────────────────

  await essai("UN DOSSIER QUI REMONTE EST REFUSÉ — rien n'est écrit dehors", async () => {
    const dehors = path.join(bac, "vole.jpg");
    await assert.rejects(
      () => stockage.enregistrerObjet("../..", Buffer.from("hors du bac"), ".jpg"),
      /hors du dossier de stockage/,
      "une clé remontante a été acceptée"
    );
    assert.ok(!existsSync(dehors), "un fichier a été écrit hors du dossier de stockage");
  });

  await essai("toutes les formes de remontée sont refusées", async () => {
    const formes = [
      "../../../../tmp",
      "chantiers/../../../../tmp",
      "chantiers/./../../..",
      "..",
      "../.storage-voisin",
    ];
    for (const dossier of formes) {
      await assert.rejects(
        () => stockage.enregistrerObjet(dossier, Buffer.from("x"), ".jpg"),
        /hors du dossier de stockage/,
        `« ${dossier} » est passé`
      );
    }
  });

  await essai("ON NE LIT PAS DAVANTAGE UN FICHIER DU DEHORS", async () => {
    // Le vrai danger de lecture : une clé forgée qui pointerait sur un secret.
    await assert.rejects(
      () => stockage.lireObjet("../../../../etc/passwd"),
      /hors du dossier de stockage/,
      "une lecture hors du dossier a été acceptée"
    );
  });

  await essai("et on n'en SUPPRIME pas un non plus", async () => {
    const temoin = path.join(bac, "ne-pas-effacer.txt");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(temoin, "je dois survivre");
    await assert.rejects(
      () => stockage.supprimerObjet("../ne-pas-effacer.txt"),
      /hors du dossier de stockage/
    );
    assert.equal(readFileSync(temoin, "utf-8"), "je dois survivre");
  });

  await essai("un point tout seul dans un nom ne gêne pas", async () => {
    // Le refus doit porter sur la REMONTÉE, pas sur le caractère `.` — sans
    // quoi une extension ou un dossier daté deviendrait impossible.
    const objet = await stockage.enregistrerObjet("entreprises/a.b/tickets", Buffer.from("x"), ".jpg");
    assert.ok(objet.storageKey.startsWith("entreprises/a.b/tickets/"));
  });

  process.chdir(departCwd);
  rmSync(bac, { recursive: true, force: true });

  console.log("");
  console.log(`Clé de stockage — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
