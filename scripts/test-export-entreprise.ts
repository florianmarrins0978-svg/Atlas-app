import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { AccesRefuseError } from "../src/server/db/with-entreprise";
import { exporterEntreprise } from "../src/server/repositories/export-entreprise";
import { nettoyerBase } from "./_test-db";

// Ce que doit prouver cette suite, et rien d'autre :
//
// 1. **Rien ne manque.** Une sauvegarde incomplète est le pire des deux
//    mondes : on croit avoir ses données et on ne s'aperçoit du trou que le
//    jour où on en a besoin. Le contrôle d'exhaustivité ci-dessous interroge la
//    base elle-même — il attrapera donc une table AJOUTÉE DEMAIN et oubliée
//    dans l'export, ce qu'aucune relecture ne ferait.
// 2. **Rien ne fuit.** Un export est l'endroit le plus tentant pour contourner
//    l'isolation, et le seul où une fuite passerait inaperçue : le patron
//    n'ouvrira jamais un fichier de trois mille lignes pour vérifier qu'aucun
//    client d'une autre société n'y figure.

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

async function creerEntrepriseComplete(nom: string) {
  const { rows: e } = await pool.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [nom]);
  const entrepriseId = e[0].id as string;
  const { rows: u } = await pool.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${nom.toLowerCase().replace(/\s/g, "-")}@test.local`,
    nom,
  ]);
  const utilisateurId = u[0].id as string;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,'proprietaire')`,
      [entrepriseId, utilisateurId]
    );
    await client.query(`INSERT INTO entreprise_compteurs (entreprise_id) VALUES ($1)`, [entrepriseId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return { entrepriseId, utilisateurId };
}

/** Un chantier garni : client, prestation, photo, note vocale, devis. */
async function garnir(entrepriseId: string, marqueur: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    const { rows: c } = await client.query(
      `INSERT INTO clients (entreprise_id, nom, telephone) VALUES ($1,$2,$3) RETURNING id`,
      [entrepriseId, `Client ${marqueur}`, "0600000000"]
    );
    const { rows: ch } = await client.query(
      `INSERT INTO chantiers (entreprise_id, client_id, nom) VALUES ($1,$2,$3) RETURNING id`,
      [entrepriseId, c[0].id, `Chantier ${marqueur}`]
    );
    const chantierId = ch[0].id as string;
    await client.query(
      `INSERT INTO prestations (entreprise_id, chantier_id, libelle) VALUES ($1,$2,$3)`,
      [entrepriseId, chantierId, `Taille de haie ${marqueur}`]
    );
    await client.query(
      `INSERT INTO photos (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum)
       VALUES ($1,$2,$3,'image/jpeg',1024,'abc')`,
      [entrepriseId, chantierId, `photos/${marqueur}-1.jpg`]
    );
    await client.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum, transcription)
       VALUES ($1,$2,$3,'audio/webm',2048,'def',$4)`,
      [entrepriseId, chantierId, `audios/${marqueur}-1.webm`, `Dictée ${marqueur}`]
    );
    await client.query("COMMIT");
    return { chantierId, clientId: c[0].id as string };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Toutes les tables de la base portant une colonne `entreprise_id`. */
async function tablesScopeesParEntreprise(): Promise<string[]> {
  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT c.table_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'entreprise_id'
        AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name`
  );
  return rows.map((r) => r.table_name);
}

// Tables qui portent bien une entreprise mais n'ont RIEN à faire dans une
// sauvegarde téléchargeable. Chaque exclusion est motivée : si l'une d'elles
// disparaît un jour de la base, la suite le dira plutôt que de laisser une
// exception périmée couvrir une vraie omission.
const EXCLUSIONS_MOTIVEES: Record<string, string> = {
  // Rien : à ce jour, toute table portant entreprise_id est exportée. Ce
  // registre existe pour que la prochaine exclusion soit écrite, pas décidée
  // en silence dans la requête.
};

async function main() {
  await nettoyerBase();

  const A = await creerEntrepriseComplete("Export A");
  const B = await creerEntrepriseComplete("Export B");
  await garnir(A.entrepriseId, "A");
  await garnir(B.entrepriseId, "B");

  await test("l'export rend les données de l'entreprise", async () => {
    const e = await exporterEntreprise(A);
    assert.equal(e.compte.entreprises, 1);
    assert.equal(e.compte.clients, 1);
    assert.equal(e.compte.chantiers, 1);
    assert.equal(e.compte.prestations, 1);
    assert.equal(e.tables.clients?.[0]?.nom, "Client A");
    assert.equal(e.entrepriseId, A.entrepriseId);
    assert.equal(e.versionFormat, 1);
  });

  await test("aucune donnée d'une autre entreprise n'y figure", async () => {
    const e = await exporterEntreprise(A);
    // Le contrôle porte sur le fichier ENTIER, pas sur une table choisie :
    // c'est le fichier que le patron enverra, et une fuite dans n'importe
    // laquelle de ses vingt-trois tables serait une fuite.
    const rendu = JSON.stringify(e);
    assert.doesNotMatch(rendu, /Client B/, "un client de l'autre société est dans l'export");
    assert.doesNotMatch(rendu, /Chantier B/, "un chantier de l'autre société est dans l'export");
    assert.doesNotMatch(rendu, /Export B/, "l'autre société est nommée dans l'export");
    assert.ok(!rendu.includes(B.entrepriseId), "l'identifiant de l'autre société est dans l'export");
  });

  await test("un utilisateur étranger à l'entreprise n'obtient rien", async () => {
    await assert.rejects(
      () => exporterEntreprise({ utilisateurId: B.utilisateurId, entrepriseId: A.entrepriseId }),
      AccesRefuseError
    );
  });

  await test("les fichiers rattachés sont listés, sans doublon", async () => {
    const e = await exporterEntreprise(A);
    const cles = e.fichiers.map((f) => f.storageKey);
    assert.ok(cles.includes("photos/A-1.jpg"), "la photo manque");
    assert.ok(cles.includes("audios/A-1.webm"), "l'enregistrement manque");
    assert.equal(new Set(cles).size, cles.length, "une clé est listée deux fois");
    assert.equal(e.fichiers.find((f) => f.storageKey === "photos/A-1.jpg")?.origine, "photo");
  });

  await test("AUCUNE table portant une entreprise n'est oubliée", async () => {
    // Le contrôle qui compte. Il interroge la base, jamais une liste écrite à
    // la main : une table ajoutée demain et oubliée dans l'export fera échouer
    // cette ligne, au lieu de disparaître silencieusement des sauvegardes.
    const enBase = await tablesScopeesParEntreprise();
    const e = await exporterEntreprise(A);
    const exportees = new Set(Object.keys(e.tables));
    const oubliees = enBase.filter((t) => !exportees.has(t) && !(t in EXCLUSIONS_MOTIVEES));
    assert.deepEqual(
      oubliees,
      [],
      `Ces tables portent un entreprise_id et ne sont PAS dans l'export : ${oubliees.join(", ")}. ` +
        "Les ajouter à src/server/repositories/export-entreprise.ts, ou les inscrire dans " +
        "EXCLUSIONS_MOTIVEES avec la raison."
    );

    // L'inverse : une exclusion qui ne correspond plus à aucune table est une
    // dispense périmée, et une dispense périmée couvre la prochaine omission.
    const perimees = Object.keys(EXCLUSIONS_MOTIVEES).filter((t) => !enBase.includes(t));
    assert.deepEqual(perimees, [], `Exclusions sans table correspondante : ${perimees.join(", ")}`);
  });

  await test("le contrôle d'exhaustivité sait échouer", async () => {
    // Un contrôle jamais vu rouge ne prouve rien (AGENTS.md). On lui présente
    // ici l'état dégradé qu'il prétend détecter : une table scopée absente de
    // l'export.
    const enBase = await tablesScopeesParEntreprise();
    const exportees = new Set(Object.keys((await exporterEntreprise(A)).tables));
    exportees.delete("clients");
    const oubliees = enBase.filter((t) => !exportees.has(t));
    assert.deepEqual(oubliees, ["clients"], "le contrôle n'a pas vu la table retirée");
  });

  await test("les tables partagées restent hors de l'export", async () => {
    const e = await exporterEntreprise(A);
    for (const table of ["users", "accounts", "catalogue_prestations", "documents_legaux"]) {
      assert.ok(!(table in e.tables), `${table} n'a rien à faire dans une sauvegarde d'entreprise`);
    }
  });

  await test("une entreprise vide s'exporte quand même", async () => {
    const C = await creerEntrepriseComplete("Export C");
    const e = await exporterEntreprise(C);
    assert.equal(e.compte.clients, 0);
    assert.equal(e.compte.entreprises, 1, "la fiche de l'entreprise doit y être");
    assert.equal(e.fichiers.length, 0);
  });

  console.log(`\n${passed} réussis, ${failed} échoués.`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

void main();
