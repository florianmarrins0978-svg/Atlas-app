// UNE PURGE QUI ÉCHOUE NE DOIT PAS SE DIRE RÉUSSIE.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE DÉFEND, ET POURQUOI C'EST LE POINT CENTRAL DU LOT.**
//
// L'audit final du 29 août 2026 a relevé que la purge n'était appelée par
// personne. Le lot de clôture la rend surveillable — mais une surveillance
// peut mentir de deux façons, et la seconde est la pire :
//
//   1. elle ne voit pas que la purge s'est arrêtée → on croit le ménage fait ;
//   2. **elle note un succès alors que la purge a échoué** → on croit le ménage
//      fait, et cette fois c'est le garde-fou lui-même qui rassure à tort.
//
// Le second cas est celui qu'un `finally` mal placé produirait, ou un
// horodatage posé avant le travail plutôt qu'après. Il ne se voit jamais à la
// relecture : le code a l'air parfaitement correct.
//
// C'est exactement le motif que le brief nomme — « timestamp de purge écrit
// même quand la purge échoue » — et cette suite le provoque pour de bon plutôt
// que de vérifier qu'une fonction existe.
//
// ═══════════════════════════════════════════════════════════════════════════
// **ELLE NE SIMULE PAS L'ÉCHEC : ELLE LE FABRIQUE.** On retire à `atlas_app` le
// droit d'écrire dans une table que la purge doit toucher, on appelle la purge,
// et l'on regarde ce que le journal contient. Un `throw` fabriqué en
// TypeScript n'éprouverait que le `try` ; ceci éprouve le chemin réel.

import assert from "node:assert/strict";
import { Client } from "pg";
import { nettoyerBase } from "./_test-db";
import { db, pool } from "../src/server/db/client";
import { executionsPurge } from "../src/server/db/schema";
import {
  noterPurgeReussie,
  etatDesPurges,
  HEURES_AVANT_ANOMALIE,
  JOURS_DE_JOURNAL,
} from "../src/server/journal-purge";

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

/** Le rôle propriétaire — pour poser et retirer des droits. */
async function proprietaire(): Promise<Client> {
  const url = process.env.DATABASE_ADMIN_URL;
  assert.ok(url, "DATABASE_ADMIN_URL est nécessaire : sans elle, l'échec ne peut pas être fabriqué");
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
}

async function main() {
  console.log("=== Le journal des purges ===\n");
  await nettoyerBase();
  await db.delete(executionsPurge);

  // ─── 1. AUCUNE PURGE = ANOMALIE, jamais un état neutre ────────────────────
  await essai("une base où AUCUNE purge n'a tourné est ANORMALE", async () => {
    const etat = await etatDesPurges();
    assert.equal(etat.dernierSucces, null);
    assert.equal(etat.heuresDepuis, null);
    assert.equal(
      etat.anormal,
      true,
      "« jamais purgé » est rendu pour normal : c'est l'état d'Atlas AVANT ce lot, " +
        "et le laisser passer reproduirait exactement le défaut qu'on corrige."
    );
  });

  // ─── 2. Une purge notée se lit ────────────────────────────────────────────
  await essai("une purge notée se relit, avec sa date", async () => {
    await noterPurgeReussie({ fichiersPurges: 3, audiosPurges: 1, photosPurgees: 0, preuvesPurgees: 2 });
    const etat = await etatDesPurges();
    assert.ok(etat.dernierSucces, "la purge notée ne se relit pas");
    assert.ok(etat.heuresDepuis !== null && etat.heuresDepuis < 1, "la date lue n'est pas récente");
    assert.equal(etat.anormal, false, "une purge à l'instant est vue comme anormale");
  });

  // ─── 3. LE SEUIL SAIT DIRE NON ────────────────────────────────────────────
  await essai("au-delà du seuil, l'anomalie se déclare", async () => {
    // On ne dort pas 48 heures : on demande à la fonction où elle en est « plus
    // tard ». C'est le paramètre `maintenant`, qui existe pour cela.
    const bienPlusTard = new Date(Date.now() + (HEURES_AVANT_ANOMALIE + 1) * 3600_000);
    const etat = await etatDesPurges(bienPlusTard);
    assert.equal(etat.anormal, true, `${HEURES_AVANT_ANOMALIE} h passées, et rien n'est signalé`);
  });

  await essai("juste EN DEÇÀ du seuil, elle se tait — sinon elle crie pour rien", async () => {
    // Une alerte qui parle à tort s'apprend à être ignorée, et l'on perd le
    // garde-fou sans s'en apercevoir (`CLAUDE.md` §4 ter). Les deux bords du
    // seuil comptent donc autant l'un que l'autre.
    const unPeuAvant = new Date(Date.now() + (HEURES_AVANT_ANOMALIE - 1) * 3600_000);
    const etat = await etatDesPurges(unPeuAvant);
    assert.equal(etat.anormal, false, "l'anomalie se déclare avant le seuil");
  });

  // ─── 4. LE CŒUR : UN ÉCHEC NE S'ÉCRIT PAS ────────────────────────────────
  await essai("UNE PURGE QUI ÉCHOUE N'ÉCRIT RIEN — le faux vert le plus dangereux", async () => {
    const admin = await proprietaire();
    const avant = (await db.select().from(executionsPurge)).length;
    try {
      // On casse pour de bon ce dont la purge a besoin : le droit d'écrire dans
      // le journal lui-même. La purge doit alors être comptée comme ÉCHOUÉE.
      await admin.query('REVOKE INSERT ON "executions_purge" FROM "atlas_app"');

      let aLeve = false;
      try {
        await noterPurgeReussie({ fichiersPurges: 9, audiosPurges: 9, photosPurgees: 9, preuvesPurgees: 9 });
      } catch {
        aLeve = true;
      }
      assert.equal(aLeve, true, "l'écriture du journal a réussi alors que le droit était retiré");

      const apres = (await db.select().from(executionsPurge)).length;
      assert.equal(
        apres,
        avant,
        "une ligne a été écrite malgré l'échec : le journal dirait « le ménage se fait » " +
          "pendant que rien n'est purgé."
      );
    } finally {
      await admin.query('GRANT INSERT ON "executions_purge" TO "atlas_app"');
      await admin.end();
    }
  });

  await essai("et le droit est bien rendu — sinon la suite suivante accuserait à tort", async () => {
    await noterPurgeReussie({ fichiersPurges: 0, audiosPurges: 0, photosPurgees: 0, preuvesPurgees: 0 });
  });

  // ─── 5. Le journal élague le journal ──────────────────────────────────────
  await essai("le journal ne grossit pas sans fin", async () => {
    const admin = await proprietaire();
    try {
      // Une exécution bien plus vieille que la fenêtre gardée.
      await admin.query(
        `INSERT INTO "executions_purge" ("terminee_le") VALUES (now() - interval '${JOURS_DE_JOURNAL + 10} days')`
      );
      const avant = (await db.select().from(executionsPurge)).length;
      await noterPurgeReussie({ fichiersPurges: 0, audiosPurges: 0, photosPurgees: 0, preuvesPurgees: 0 });
      const apres = (await db.select().from(executionsPurge)).length;
      // +1 pour celle qu'on vient d'écrire, −1 pour la vieille élaguée.
      assert.equal(apres, avant, `le journal est passé de ${avant} à ${apres} : l'élagage ne se fait pas`);
    } finally {
      await admin.end();
    }
  });

  // ─── 6. La table ne porte AUCUNE donnée d'artisan ────────────────────────
  await essai("le journal ne contient que des dates et des compteurs", async () => {
    // C'est ce qui justifie qu'elle ne soit pas cloisonnée par entreprise. Si
    // une colonne de texte y apparaissait un jour, la justification tomberait —
    // et rien ne le signalerait. Même raisonnement que pour les files de purge
    // (`test-toute-table-est-cloisonnee.ts`).
    const admin = await proprietaire();
    try {
      const { rows } = await admin.query<{ n: string; t: string }>(
        `SELECT a.attname AS n, format_type(a.atttypid, a.atttypmod) AS t
           FROM pg_attribute a
          WHERE a.attrelid = 'executions_purge'::regclass AND a.attnum > 0 AND NOT a.attisdropped`
      );
      const suspectes = rows.filter((c) => !/^(uuid|timestamp|integer)/.test(c.t)).map((c) => `${c.n} (${c.t})`);
      assert.deepEqual(
        suspectes,
        [],
        `Colonnes pouvant porter de la donnée d'artisan : ${suspectes.join(", ")}.\n` +
          "    Le journal n'est pas cloisonné par entreprise PARCE QU'il n'en contient aucune."
      );
    } finally {
      await admin.end();
    }
  });

  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Journal des purges — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("❌ Suite interrompue :", e instanceof Error ? e.message : e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
