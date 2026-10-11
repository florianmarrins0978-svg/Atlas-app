import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { getChantierPourHub } from "../src/server/repositories/chantiers";
import { getNextAction, getStatutAffiche, lienDeReprise } from "../src/lib/chantier-etat";
import { nettoyerBase } from "./_test-db";

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
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Hub A" },
    { email: "hub-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Hub B" },
    { email: "hub-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  let chantierId: string;
  const setup = await pool.connect();
  try {
    await setup.query("BEGIN");
    await setup.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
    const { rows: c } = await setup.query(`INSERT INTO clients (entreprise_id, nom) VALUES ($1,'Client Hub') RETURNING id`, [
      A.entrepriseId,
    ]);
    const { rows: ch } = await setup.query(
      `INSERT INTO chantiers (entreprise_id, client_id, nom, adresse_chantier, informations_verifiees_at)
       VALUES ($1,$2,'Chantier Hub','12 rue Test', now()) RETURNING id`,
      [A.entrepriseId, c[0].id]
    );
    chantierId = ch[0].id;
    await setup.query(
      `INSERT INTO photos (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum) VALUES ($1,$2,'k','image/jpeg',10,'c')`,
      [A.entrepriseId, chantierId]
    );
    await setup.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum) VALUES ($1,$2,'k','audio/mp4',10,'c')`,
      [A.entrepriseId, chantierId]
    );
    await setup.query("COMMIT");
  } finally {
    setup.release();
  }

  await test("getChantierPourHub retourne le chantier avec client + agrégats", async () => {
    const c = await getChantierPourHub(A, chantierId);
    assert.ok(c);
    assert.equal(c!.nom, "Chantier Hub");
    assert.equal(c!.clientNom, "Client Hub");
    assert.equal(c!.photosCount, 1);
    assert.ok(c!.informationsVerifieesAt !== null);
  });

  await test("Chantier introuvable -> null", async () => {
    const c = await getChantierPourHub(A, "00000000-0000-0000-0000-000000000000");
    assert.equal(c, null);
  });

  await test("Chantier d'une autre entreprise -> null (jamais distingué d'introuvable)", async () => {
    const c = await getChantierPourHub(B, chantierId);
    assert.equal(c, null);
  });

  await test("getNextAction / lienDeReprise fonctionnent sur la forme réelle", async () => {
    const c = await getChantierPourHub(A, chantierId);
    const statut = getStatutAffiche(c!);
    assert.equal(statut, "verifie"); // photos + info vérifiées, pas de prix -> "verifie"
    // **Ce chantier porte une dictée**, et depuis le 21 août 2026 une dictée
    // mène AU DEVIS — plus à l'écran « Prix » (`ARCHITECTURE.md` §142). La
    // chaîne va de la dictée au devis d'un seul tenant ; l'écran « Prix » reste
    // pour qui chiffre à la main, et se rejoint par le tiroir.
    const next = getNextAction(c!);
    assert.equal(next?.key, "devis-preparer");

    // **CE QUE CE CONTRÔLE DÉFEND A CHANGÉ DE FORME, PAS DE FOND.**
    //
    // Il lisait `getSecondarySteps` — la liste du tiroir de la fiche du
    // chantier — pour prouver que l'écran « Prix » restait joignable. La fiche
    // est retirée le 4 septembre 2026 (`ARCHITECTURE.md` §254), et une suite
    // qui réclamerait sa liste rendrait l'écran impossible à changer
    // (`CLAUDE.md` §5 bis).
    //
    // La règle, elle, n'a pas bougé : **rouvrir un chantier depuis la liste
    // mène à une adresse qui existe, et jamais à la fiche retirée** — sans
    // quoi la route redirigerait sur elle-même.
    const reprise = lienDeReprise(c!.id, c!);
    assert.notEqual(
      reprise,
      `/chantiers/${c!.id}`,
      "la reprise renvoie sur la fiche retirée : la route boucle sur elle-même"
    );
    assert.equal(reprise, `/chantiers/${c!.id}/devis-complet`);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
