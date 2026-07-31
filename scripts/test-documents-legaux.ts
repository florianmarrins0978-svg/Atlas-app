import assert from "node:assert";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  documentsEnVigueur,
  documentsAAccepter,
  enregistrerAcceptations,
  acceptationsDe,
} from "../src/server/repositories/documents-legaux";
import { VERSIONS_DOCUMENTS, empreinteContenu } from "../src/server/documents-legaux/versions";
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

async function creerUtilisateur(email: string): Promise<string> {
  const { utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Entreprise ${email}` },
    { email }
  );
  return utilisateurId;
}

async function main() {
  await nettoyerBase();

  // Les documents sont publiés par le runner de migrations, jamais par
  // l'application. S'ils manquent, c'est que la base n'est pas à jour — mieux
  // vaut le dire clairement que laisser les tests suivants échouer en cascade.
  const enVigueur = await documentsEnVigueur();
  if (enVigueur.length === 0) {
    console.error(
      "❌ Aucun document légal publié. Lancer `npm run db:migrate` avant cette suite."
    );
    process.exit(1);
  }

  await test("les trois documents déclarés sont publiés", async () => {
    assert.strictEqual(enVigueur.length, VERSIONS_DOCUMENTS.length);
    for (const v of VERSIONS_DOCUMENTS) {
      assert.ok(
        enVigueur.some((d) => d.type === v.type && d.version === v.version),
        `${v.type}@${v.version} absent`
      );
    }
  });

  await test("l'empreinte publiée correspond au texte exact", async () => {
    for (const doc of enVigueur) {
      assert.strictEqual(
        doc.empreinte,
        empreinteContenu(doc.contenu),
        `empreinte incohérente pour ${doc.type}`
      );
    }
  });

  await test("l'ordre d'affichage suit versions.ts, pas la base", async () => {
    assert.deepStrictEqual(
      enVigueur.map((d) => d.type),
      VERSIONS_DOCUMENTS.map((v) => v.type)
    );
  });

  await test("un nouvel utilisateur doit accepter les documents requis", async () => {
    const utilisateurId = await creerUtilisateur(`neuf-${Date.now()}@atlas.test`);
    const attendus = await documentsAAccepter(utilisateurId);
    const requis = VERSIONS_DOCUMENTS.filter((v) => v.acceptationRequise);
    assert.strictEqual(attendus.length, requis.length);
  });

  await test("un document non requis ne bloque jamais l'accès", async () => {
    const utilisateurId = await creerUtilisateur(`facultatif-${Date.now()}@atlas.test`);
    const attendus = await documentsAAccepter(utilisateurId);
    const facultatifs = VERSIONS_DOCUMENTS.filter((v) => !v.acceptationRequise);
    for (const f of facultatifs) {
      assert.ok(
        !attendus.some((d) => d.type === f.type),
        `${f.type} ne devrait pas être exigé`
      );
    }
  });

  await test("après acceptation, plus rien n'est attendu", async () => {
    const utilisateurId = await creerUtilisateur(`accepte-${Date.now()}@atlas.test`);
    const attendus = await documentsAAccepter(utilisateurId);
    await enregistrerAcceptations(
      utilisateurId,
      attendus.map((d) => d.id),
      { adresseIp: "203.0.113.7", agentUtilisateur: "Test/1.0" }
    );
    assert.deepStrictEqual(await documentsAAccepter(utilisateurId), []);
  });

  await test("la preuve conserve adresse, horodatage, version et empreinte", async () => {
    const utilisateurId = await creerUtilisateur(`preuve-${Date.now()}@atlas.test`);
    const attendus = await documentsAAccepter(utilisateurId);
    const avant = new Date();
    await enregistrerAcceptations(
      utilisateurId,
      attendus.map((d) => d.id),
      { adresseIp: "198.51.100.42", agentUtilisateur: "Mozilla/5.0 (Test)" }
    );

    const preuves = await acceptationsDe(utilisateurId);
    assert.strictEqual(preuves.length, attendus.length);
    for (const p of preuves) {
      assert.strictEqual(p.adresseIp, "198.51.100.42");
      assert.strictEqual(p.agentUtilisateur, "Mozilla/5.0 (Test)");
      assert.ok(p.version, "version manquante");
      assert.match(p.empreinte, /^[0-9a-f]{64}$/, "empreinte absente ou malformée");
      assert.ok(p.accepteAt >= new Date(avant.getTime() - 5000), "horodatage incohérent");
    }
  });

  await test("réaccepter n'écrase pas la première acceptation", async () => {
    const utilisateurId = await creerUtilisateur(`rejoue-${Date.now()}@atlas.test`);
    const attendus = await documentsAAccepter(utilisateurId);
    const ids = attendus.map((d) => d.id);

    await enregistrerAcceptations(utilisateurId, ids, {
      adresseIp: "192.0.2.1",
      agentUtilisateur: "Premier",
    });
    const premiere = await acceptationsDe(utilisateurId);

    const { enregistrees } = await enregistrerAcceptations(utilisateurId, ids, {
      adresseIp: "192.0.2.99",
      agentUtilisateur: "Second",
    });

    assert.strictEqual(enregistrees, 0, "une réacceptation ne doit rien insérer");
    const apres = await acceptationsDe(utilisateurId);
    assert.strictEqual(apres.length, premiere.length);
    for (const p of apres) {
      assert.strictEqual(p.adresseIp, "192.0.2.1", "la première preuve a été écrasée");
    }
  });

  await test("une acceptation sans document ne casse rien", async () => {
    const utilisateurId = await creerUtilisateur(`vide-${Date.now()}@atlas.test`);
    const { enregistrees } = await enregistrerAcceptations(utilisateurId, [], {
      adresseIp: null,
      agentUtilisateur: null,
    });
    assert.strictEqual(enregistrees, 0);
  });

  await test("un utilisateur ne voit jamais les acceptations d'un autre", async () => {
    const a = await creerUtilisateur(`cloison-a-${Date.now()}@atlas.test`);
    const b = await creerUtilisateur(`cloison-b-${Date.now()}@atlas.test`);

    const attendusA = await documentsAAccepter(a);
    await enregistrerAcceptations(
      a,
      attendusA.map((d) => d.id),
      { adresseIp: "203.0.113.1", agentUtilisateur: "A" }
    );

    // B n'a rien accepté : il ne doit voir aucune preuve, et rester bloqué.
    assert.deepStrictEqual(await acceptationsDe(b), []);
    assert.strictEqual((await documentsAAccepter(b)).length, attendusA.length);
  });

  await test("la cloison tient aussi sans contexte utilisateur (RLS)", async () => {
    const utilisateurId = await creerUtilisateur(`rls-${Date.now()}@atlas.test`);
    const attendus = await documentsAAccepter(utilisateurId);
    await enregistrerAcceptations(
      utilisateurId,
      attendus.map((d) => d.id),
      { adresseIp: "203.0.113.5", agentUtilisateur: "RLS" }
    );

    // Sans app.utilisateur_id positionné, la politique RLS ne doit laisser
    // passer aucune ligne — la protection ne dépend pas du code applicatif.
    const fuite = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.utilisateur_id', '', true)`);
      return tx.execute(sql`SELECT count(*)::int AS n FROM acceptations_documents`);
    });
    const lignes = (fuite as unknown as { rows: { n: number }[] }).rows;
    assert.strictEqual(lignes[0].n, 0, "des acceptations sont lisibles hors contexte");
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
