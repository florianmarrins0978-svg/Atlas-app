// Les équipes en base : isolation, nommage, et ce qui survit au compteur.
//
// **Cette suite tourne sous `atlas_app`**, le rôle bridé — c'est la seule façon
// d'éprouver la RLS. Les suites navigateur, elles, démarrent leur serveur sous
// un rôle qui TRAVERSE l'isolation parce qu'elles inspectent la base : un
// défaut d'isolation leur est invisible (`CLAUDE.md` §5).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { listerEquipes, nommerEquipe, equipeParRang } from "../src/server/repositories/equipes";
import { libelleEquipe, equipesAffichees } from "../src/lib/equipes";

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

/** Une entreprise, son patron et son compteur — le strict nécessaire. */
async function monterEntreprise(nom: string): Promise<{ utilisateurId: string; entrepriseId: string }> {
  const marque = `${nom}-${randomUUID().slice(0, 8)}`;
  const { rows: e } = await pg.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [marque]);
  const entrepriseId = e[0].id as string;
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
    await client.query(`INSERT INTO entreprise_compteurs (entreprise_id) VALUES ($1)`, [entrepriseId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return { utilisateurId, entrepriseId };
}

async function main() {
  console.log("=== Les équipes en base ===");

  const a = await monterEntreprise("Entreprise A");
  const b = await monterEntreprise("Entreprise B");

  await essai("une entreprise neuve n'a AUCUNE équipe en base", async () => {
    // Le repli est un affichage : rien n'est écrit tant que le patron n'a rien
    // saisi. Créer vingt lignes vides d'avance reviendrait à inventer.
    assert.deepEqual(await listerEquipes(a), []);
  });

  await essai("nommer une équipe la crée, et une seule", async () => {
    await nommerEquipe(a, 2, "Théo");
    const lignes = await listerEquipes(a);
    assert.equal(lignes.length, 1, `${lignes.length} lignes créées`);
    assert.equal(lignes[0].rang, 2);
    assert.equal(lignes[0].nom, "Théo");
  });

  await essai("nommer deux fois le même rang ne fait pas deux lignes", async () => {
    await nommerEquipe(a, 2, "Théo B.");
    const lignes = await listerEquipes(a);
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].nom, "Théo B.");
  });

  await essai("vider le champ remet NULL, jamais une chaîne vide", async () => {
    // Sinon la base porterait deux façons de dire « pas de nom », et
    // `libelleEquipe` devrait connaître les deux.
    await nommerEquipe(a, 2, "   ");
    const ligne = await equipeParRang(a, 2);
    assert.equal(ligne?.nom, null, `la base porte ${JSON.stringify(ligne?.nom)}`);
    assert.equal(libelleEquipe(ligne, 2), "Équipe B");
  });

  await essai("l'isolation tient : B ne voit rien des équipes de A", async () => {
    await nommerEquipe(a, 1, "Nadia");
    const chezB = await listerEquipes(b);
    assert.equal(chezB.length, 0, `B lit ${chezB.length} équipe(s) de A`);
    assert.equal(await equipeParRang(b, 1), null, "B lit l'équipe de rang 1 de A");
  });

  await essai("B peut nommer SON rang 1 sans toucher à celui de A", async () => {
    await nommerEquipe(b, 1, "Malik");
    assert.equal((await equipeParRang(a, 1))?.nom, "Nadia");
    assert.equal((await equipeParRang(b, 1))?.nom, "Malik");
  });

  await essai("un nom survit à la descente du compteur, puis revient", async () => {
    // `entreprises.nombre_equipes` fait autorité sur le NOMBRE ; la table ne
    // porte que des noms. Effacer serait une perte silencieuse sur une donnée
    // saisie à la main que rien ne reconstitue.
    await nommerEquipe(a, 3, "Sofia");
    const enBase = await listerEquipes(a);
    assert.equal(enBase.length, 3);

    // Compteur à 2 : la troisième ne se montre plus…
    const vues = equipesAffichees(enBase, 2);
    assert.equal(vues.length, 2);
    assert.ok(!vues.some((e) => e.nom === "Sofia"));

    // …mais elle est toujours là, et elle revient.
    const revenues = equipesAffichees(await listerEquipes(a), 3);
    assert.equal(libelleEquipe(revenues[2], 3), "Sofia");
  });

  await essai("un rang hors bornes est ramené dans les clous plutôt que refusé", async () => {
    // La contrainte de base (1..20) ferait tomber la requête ; l'écran, lui, ne
    // doit jamais pouvoir provoquer une erreur de contrainte.
    const haut = await nommerEquipe(a, 99, "Trop loin");
    assert.equal(haut.rang, 20);
    const bas = await nommerEquipe(a, 0, "Trop bas");
    assert.equal(bas.rang, 1);
  });

  await pg.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les équipes en base — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
