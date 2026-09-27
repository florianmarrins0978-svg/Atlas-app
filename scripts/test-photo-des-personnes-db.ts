// La photo de chaque personne, et le lien entre un compte et son nom.
//
// *Sa demande du 27 septembre 2026 : « chaque personne doit pouvoir mettre et
// changer sa photo de profil ».* Relié à un nom, un compte écrit SA photo sur
// la ligne de ce nom, et nulle part ailleurs ; relié à personne, sur son
// adhésion.
//
// **Sous `atlas_app`**, le rôle bridé : c'est la seule façon d'éprouver
// l'isolation (`CLAUDE.md` §5).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { equipeParRang, poserPhotoSalarie } from "../src/server/repositories/equipes";
import { listerAcces } from "../src/server/repositories/membres-entreprise";
import { lireMaPhoto, poserMaPhoto, relierAuSalarie } from "../src/server/repositories/photo-des-personnes";

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

type Personne = { utilisateurId: string; entrepriseId: string; accesId: string };

async function creerCompte(marque: string): Promise<string> {
  const { rows } = await pg.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${marque.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@essai.local`,
    marque,
  ]);
  return rows[0].id as string;
}

async function adherer(entrepriseId: string, utilisateurId: string, role: string): Promise<string> {
  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    const { rows } = await client.query(
      `INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,$3) RETURNING id`,
      [entrepriseId, utilisateurId, role]
    );
    await client.query("COMMIT");
    return rows[0].id as string;
  } finally {
    client.release();
  }
}

/** Une entreprise, son patron, et un salarié qui a un compte. */
async function monter(nom: string): Promise<{ patron: Personne; gars: Personne; commercial: Personne }> {
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
  const personne = async (qui: string, role: string): Promise<Personne> => {
    const utilisateurId = await creerCompte(`${marque}-${qui}`);
    return { utilisateurId, entrepriseId, accesId: await adherer(entrepriseId, utilisateurId, role) };
  };
  return {
    patron: await personne("patron", "proprietaire"),
    gars: await personne("gars", "salarie"),
    commercial: await personne("commercial", "commercial"),
  };
}

async function main() {
  console.log("=== La photo de chaque personne ===");

  const a = await monter("Entreprise A");
  const b = await monter("Entreprise B");

  await essai("un compte relié à personne pose sa photo sur son adhésion", async () => {
    const { avant } = await poserMaPhoto(a.commercial, "entreprises/a/personnes/com.jpg");
    assert.equal(avant, null);
    assert.deepEqual(await lireMaPhoto(a.commercial), { photo: "entreprises/a/personnes/com.jpg", rang: null });
    const acces = (await listerAcces(a.patron)).find((x) => x.id === a.commercial.accesId);
    assert.equal(acces?.photo, "entreprises/a/personnes/com.jpg");
  });

  await essai("le gars pose sa photo AVANT d'être relié, puis le patron le relie : elle suit son nom", async () => {
    await poserMaPhoto(a.gars, "entreprises/a/personnes/kevin.jpg");
    const r = await relierAuSalarie(a.patron, a.gars.accesId, 2);
    assert.deepEqual(r, { ok: true, aSupprimer: null });
    assert.equal((await equipeParRang(a.patron, 2))?.photo, "entreprises/a/personnes/kevin.jpg");
    assert.deepEqual(await lireMaPhoto(a.gars), { photo: "entreprises/a/personnes/kevin.jpg", rang: 2 });
  });

  await essai("relié, il change SA photo : c'est la ligne de son nom qui change, et l'ancienne clef revient", async () => {
    const { avant } = await poserMaPhoto(a.gars, "entreprises/a/personnes/kevin2.jpg");
    assert.equal(avant, "entreprises/a/personnes/kevin.jpg");
    assert.equal((await equipeParRang(a.patron, 2))?.photo, "entreprises/a/personnes/kevin2.jpg");
  });

  await essai("le patron qui change la photo du nom change celle du gars : une seule vérité", async () => {
    await poserPhotoSalarie(a.patron, 2, "entreprises/a/salaries/par-le-patron.jpg");
    assert.equal((await lireMaPhoto(a.gars)).photo, "entreprises/a/salaries/par-le-patron.jpg");
    const acces = (await listerAcces(a.patron)).find((x) => x.id === a.gars.accesId);
    assert.equal(acces?.salarieRang, 2);
    assert.equal(acces?.photo, "entreprises/a/salaries/par-le-patron.jpg");
  });

  await essai("un nom déjà relié à un autre compte est refusé, pas déplacé", async () => {
    const r = await relierAuSalarie(a.patron, a.commercial.accesId, 2);
    assert.equal(r.ok, false);
    assert.deepEqual(await lireMaPhoto(a.gars), {
      photo: "entreprises/a/salaries/par-le-patron.jpg",
      rang: 2,
    });
  });

  await essai("relier un compte qui a sa photo à un nom qui en a déjà une rend son fichier à supprimer", async () => {
    await poserPhotoSalarie(a.patron, 3, "entreprises/a/salaries/trois.jpg");
    const r = await relierAuSalarie(a.patron, a.commercial.accesId, 3);
    assert.deepEqual(r, { ok: true, aSupprimer: "entreprises/a/personnes/com.jpg" });
    assert.equal((await lireMaPhoto(a.commercial)).photo, "entreprises/a/salaries/trois.jpg");
  });

  await essai("délier : le nom garde sa photo, le compte n'en a plus", async () => {
    const r = await relierAuSalarie(a.patron, a.commercial.accesId, null);
    assert.deepEqual(r, { ok: true, aSupprimer: null });
    assert.deepEqual(await lireMaPhoto(a.commercial), { photo: null, rang: null });
    assert.equal((await equipeParRang(a.patron, 3))?.photo, "entreprises/a/salaries/trois.jpg");
  });

  await essai("l'isolation tient : B ne relie pas un compte de A, et sa photo ne touche rien chez A", async () => {
    const r = await relierAuSalarie(b.patron, a.gars.accesId, 2);
    assert.equal(r.ok, false, "B a relié un compte de A");
    await poserMaPhoto(b.gars, "entreprises/b/personnes/x.jpg");
    assert.equal((await equipeParRang(a.patron, 2))?.photo, "entreprises/a/salaries/par-le-patron.jpg");
    assert.equal((await listerAcces(b.patron)).some((x) => x.photo?.includes("entreprises/a/")), false);
  });

  await pg.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} La photo de chaque personne : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
