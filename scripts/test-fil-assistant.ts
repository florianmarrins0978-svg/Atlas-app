// LE FIL DE L'ASSISTANT SURVIT — et il ne franchit ni les entreprises, ni les
// personnes.
//
// **Cette suite tourne sous `atlas_app`**, le rôle bridé : c'est la seule façon
// d'éprouver la RLS. Les suites navigateur démarrent leur serveur sous un rôle
// qui TRAVERSE l'isolation — un défaut de cloisonnement leur est invisible
// (`CLAUDE.md` §5).
//
// Ce que cette suite défend, et qu'aucun écran ne peut défendre :
//   1. un fil relu revient dans l'ordre où il a été écrit ;
//   2. deux associés d'UNE MÊME entreprise ne voient pas le fil l'un de l'autre
//      — la RLS n'isole que les entreprises, c'est le dépôt qui isole les
//      personnes, et cette ligne-là ne se voit pas en regardant l'écran ;
//   3. une autre entreprise ne voit rien du tout ;
//   4. la coupe garde la FIN du fil, jamais son début.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  ajouterAuFilAssistant,
  lireFilAssistant,
  viderFilAssistant,
  MESSAGES_GARDES,
} from "../src/server/repositories/fil-assistant";

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

const pg = new Pool({ connectionString: process.env.DATABASE_URL });

async function ajouterMembre(entrepriseId: string, marque: string): Promise<string> {
  const { rows: u } = await pg.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${marque.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@essai.local`,
    marque,
  ]);
  const utilisateurId = u[0].id as string;
  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,'proprietaire')`,
      [entrepriseId, utilisateurId]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return utilisateurId;
}

async function monterEntreprise(nom: string) {
  const marque = `${nom}-${randomUUID().slice(0, 8)}`;
  const { rows: e } = await pg.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [marque]);
  const entrepriseId = e[0].id as string;
  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`INSERT INTO entreprise_compteurs (entreprise_id) VALUES ($1)`, [entrepriseId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return { entrepriseId, marque };
}

async function main() {
  console.log("=== Le fil de l'assistant ===\n");

  const { entrepriseId, marque } = await monterEntreprise("FilA");
  const patron = { utilisateurId: await ajouterMembre(entrepriseId, `${marque}-patron`), entrepriseId };
  const associe = { utilisateurId: await ajouterMembre(entrepriseId, `${marque}-associe`), entrepriseId };

  const autre = await monterEntreprise("FilB");
  const voisin = { utilisateurId: await ajouterMembre(autre.entrepriseId, `${autre.marque}-patron`), entrepriseId: autre.entrepriseId };

  await essai("un fil vierge se lit sans rien inventer", async () => {
    assert.deepEqual(await lireFilAssistant(patron), []);
  });

  await essai("ce qui est écrit se relit, dans l'ordre où il a été dit", async () => {
    await ajouterAuFilAssistant(patron, null, [
      { role: "user", contenu: "Le devis de Lucie" },
      { role: "assistant", contenu: "Le voici : 1 240 €." },
    ]);
    const fil = await lireFilAssistant(patron);
    assert.equal(fil.length, 2);
    assert.equal(fil[0].role, "user");
    assert.equal(fil[0].contenu, "Le devis de Lucie");
    assert.equal(fil[1].contenu, "Le voici : 1 240 €.");
  });

  await essai("L'ORDRE NE TIENT PAS À L'HORLOGE — question, puis réponse, dix fois", async () => {
    /**
     * **Le cas au-dessus passait une fois sur deux, et c'était un vrai
     * défaut.** `now()` rend l'instant de DÉBUT DE TRANSACTION : la question et
     * sa réponse, écrites ensemble, portent la même date à la microseconde
     * près. Le classement retombait alors sur l'identifiant — un UUID tiré au
     * hasard — et la réponse s'affichait avant la question.
     *
     * Un cas qui échoue une fois sur deux apprend à ignorer le rouge. Dix
     * paires le rendent décisif : passer par chance vaut une chance sur mille.
     */
    const seul = { utilisateurId: await ajouterMembre(entrepriseId, `${marque}-ordre`), entrepriseId };
    for (let i = 0; i < 10; i++) {
      await ajouterAuFilAssistant(seul, null, [
        { role: "user", contenu: `Q${i}` },
        { role: "assistant", contenu: `R${i}` },
      ]);
    }
    const fil = await lireFilAssistant(seul);
    assert.equal(fil.length, 20);
    assert.deepEqual(
      fil.map((m) => m.contenu),
      Array.from({ length: 10 }, (_, i) => [`Q${i}`, `R${i}`]).flat(),
      "le fil n'est pas dans l'ordre où il a été écrit"
    );
  });

  await essai("SON ASSOCIÉ NE VOIT PAS SON FIL — même entreprise, même RLS", async () => {
    // La politique de la table n'isole que les entreprises : sans le filtre par
    // personne dans le dépôt, ce cas passerait au vert avec le fil du patron.
    assert.deepEqual(await lireFilAssistant(associe), []);
  });

  await essai("l'associé a son propre fil, et il ne déborde pas sur celui du patron", async () => {
    await ajouterAuFilAssistant(associe, null, [
      { role: "user", contenu: "Mes chantiers de jeudi" },
      { role: "assistant", contenu: "Deux." },
    ]);
    assert.equal((await lireFilAssistant(associe)).length, 2);
    assert.equal((await lireFilAssistant(patron)).length, 2);
    assert.equal((await lireFilAssistant(patron))[0].contenu, "Le devis de Lucie");
  });

  await essai("une AUTRE entreprise ne voit rien", async () => {
    assert.deepEqual(await lireFilAssistant(voisin), []);
  });

  await essai("la coupe garde la FIN du fil, jamais son début", async () => {
    // Deux fois le plafond, écrits par paires comme dans l'application.
    for (let i = 0; i < MESSAGES_GARDES; i++) {
      await ajouterAuFilAssistant(patron, null, [
        { role: "user", contenu: `question ${i}` },
        { role: "assistant", contenu: `réponse ${i}` },
      ]);
    }
    const fil = await lireFilAssistant(patron);
    assert.equal(fil.length, MESSAGES_GARDES, `${fil.length} messages gardés au lieu de ${MESSAGES_GARDES}`);
    // Le dernier échange doit y être ; le premier ne doit plus y être.
    assert.equal(fil[fil.length - 1].contenu, `réponse ${MESSAGES_GARDES - 1}`);
    assert.ok(
      !fil.some((m) => m.contenu === "Le devis de Lucie"),
      "le début du fil est encore là : c'est la fin qui aurait dû être gardée"
    );
  });

  await essai("la coupe n'a pas touché au fil de l'associé", async () => {
    assert.equal((await lireFilAssistant(associe)).length, 2);
  });

  await essai("« Oublier » vide le sien, et lui seul", async () => {
    await viderFilAssistant(patron);
    assert.deepEqual(await lireFilAssistant(patron), []);
    assert.equal((await lireFilAssistant(associe)).length, 2);
  });

  await pg.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le fil de l'assistant — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
