import assert from "node:assert";
import { pool } from "../src/server/db/client";
import { AccesRefuseError } from "../src/server/db/with-entreprise";
import { enregistrerPrecisions, listerPrecisions } from "../src/server/repositories/precisions-chantier";
import { nettoyerBase } from "./_test-db";

// Ce que le patron a répondu quand l'agent l'a arrêté avant de chiffrer.
//
// Deux promesses seulement, mais elles portent le reste :
//
// 1. **Ça survit.** Une réponse perdue, c'est une question reposée — et un
//    arrêt qu'on repose est un arrêt qu'on contourne. La règle la plus
//    exigeante est qu'elle survive à une RELECTURE de la dictée : le brouillon
//    se régénère, ces réponses-là ne viennent pas de la dictée.
// 2. **Ça ne fuit pas.** Comme partout ici, une lecture hors du contexte de
//    l'entreprise ne renvoie rien — silencieusement, ce qui est précisément ce
//    qui rend le contrôle nécessaire.

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
    const { rows: ch } = await client.query(
      `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,$2) RETURNING id`,
      [entrepriseId, `Chantier ${nom}`]
    );
    await client.query("COMMIT");
    return { entrepriseId, utilisateurId, chantierId: ch[0].id as string };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Ce qu'il répond sur son chêne mort — les deux réponses qui valent 800 €. */
const LE_CHENE = [
  {
    sujet: "abattage.technique#1",
    libellePrestation: "Abattage d'un chêne mort",
    valeur: "demontage_retention",
    lisible: "démontage avec rétention",
  },
  {
    sujet: "abattage.diametre#1",
    libellePrestation: "Abattage d'un chêne mort",
    valeur: "70",
    lisible: "⌀ 70 cm",
  },
];

async function main() {
  await nettoyerBase();
  const A = await creerEntrepriseComplete("Precisions A");
  const B = await creerEntrepriseComplete("Precisions B");

  await test("ce qu'il répond est relu tel quel", async () => {
    await enregistrerPrecisions(A, A.chantierId, LE_CHENE);
    const relues = await listerPrecisions(A, A.chantierId);
    assert.equal(relues.length, 2);
    const technique = relues.find((p) => p.sujet === "abattage.technique#1");
    assert.equal(technique?.valeur, "demontage_retention");
    assert.equal(technique?.lisible, "démontage avec rétention", "le texte du devis n'est pas conservé");
    assert.equal(technique?.libellePrestation, "Abattage d'un chêne mort", "on ne sait plus de quel arbre il s'agit");
  });

  await test("se corriger écrase, sans dupliquer", async () => {
    // Rien n'est encore parti au client à ce stade : il a le droit de changer
    // d'avis, et l'ancienne valeur n'a aucune valeur probante.
    await enregistrerPrecisions(A, A.chantierId, [{ ...LE_CHENE[0]!, valeur: "au_pied", lisible: "abattage au pied" }]);
    const relues = await listerPrecisions(A, A.chantierId);
    assert.equal(relues.length, 2, "la correction a créé une ligne de plus");
    assert.equal(relues.find((p) => p.sujet === "abattage.technique#1")?.valeur, "au_pied");
  });

  await test("une réponse vide n'écrit rien", async () => {
    const avant = (await listerPrecisions(A, A.chantierId)).length;
    const ecrites = await enregistrerPrecisions(A, A.chantierId, [
      { sujet: "haie.longueur#0", libellePrestation: "Taille de haie", valeur: "   ", lisible: "" },
    ]);
    assert.equal(ecrites, 0);
    assert.equal((await listerPrecisions(A, A.chantierId)).length, avant);
  });

  await test("ISOLATION : B ne lit rien du chantier de A", async () => {
    const vues = await listerPrecisions(B, A.chantierId);
    assert.deepEqual(vues, [], "les réponses de A sont visibles depuis B");
  });

  await test("ISOLATION : un utilisateur étranger est refusé, pas servi à vide", async () => {
    await assert.rejects(
      () => listerPrecisions({ utilisateurId: B.utilisateurId, entrepriseId: A.entrepriseId }, A.chantierId),
      AccesRefuseError
    );
  });

  await test("ISOLATION : B ne peut pas écrire sur le chantier de A", async () => {
    // La politique RLS refuse l'écriture ; le contrôle vaut d'être écrit parce
    // qu'une clé étrangère seule ne l'aurait pas empêchée.
    //
    // Le motif se cherche dans la CAUSE, pas dans le message : Drizzle enveloppe
    // l'erreur de PostgreSQL dans un « Failed query: … » qui ne dit rien du
    // refus. Chercher dans l'enveloppe ferait passer ce contrôle pour n'importe
    // quelle panne — un contrôle vert pour la mauvaise raison.
    await assert.rejects(
      async () => {
        await enregistrerPrecisions(B, A.chantierId, LE_CHENE);
      },
      (e: Error & { cause?: unknown }) => {
        const chaine = [e.message, (e.cause as Error | undefined)?.message ?? ""].join(" ");
        assert.match(chaine, /policy|violates|foreign key/i, `refus obtenu, mais pour un autre motif : ${chaine}`);
        return true;
      }
    );
    assert.equal((await listerPrecisions(A, A.chantierId)).length, 2, "les réponses de A ont bougé");
  });

  await test("les réponses survivent à une relecture de la dictée", async () => {
    // Le cas qui a décidé de la conception : le brouillon se régénère, les
    // réponses non. Rangées dans le brouillon, elles seraient effacées ici, et
    // l'agent reposerait les deux mêmes questions.
    await pool.query(`DELETE FROM brouillons_informations WHERE chantier_id = $1`, [A.chantierId]);
    const relues = await listerPrecisions(A, A.chantierId);
    assert.equal(relues.length, 2, "une relecture de la dictée a emporté les réponses");
  });

  await test("supprimer le chantier emporte ses précisions", async () => {
    const C = await creerEntrepriseComplete("Precisions C");
    await enregistrerPrecisions(C, C.chantierId, LE_CHENE);
    await pool.query(`SELECT set_config('app.entreprise_id', $1, false)`, [C.entrepriseId]);
    await pool.query(`DELETE FROM chantiers WHERE id = $1`, [C.chantierId]);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM precisions_chantier WHERE chantier_id = $1`, [
      C.chantierId,
    ]);
    assert.equal(rows[0].n, 0, "des réponses orphelines survivent au chantier");
  });

  console.log(`\n${passed} réussis, ${failed} échoués.`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

void main();
