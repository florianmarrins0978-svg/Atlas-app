import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerChantier } from "../src/server/repositories/chantiers";
import { attribuerNumeroDevis } from "../src/server/repositories/devis";
import { attribuerNumeroFacture } from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { nettoyerBase } from "./_test-db";

// **« L'application doit pouvoir supporter dix mille, voire cent mille
// utilisateurs. Il ne faut pas qu'il y ait de problème si dix personnes rentrent
// des mots de passe en même temps, créent des devis en même temps, font des
// factures en même temps. »** — le patron, le 6 août 2026.
//
// Ce que cette suite éprouve, et qu'aucune autre ne voyait : ce qui se passe
// quand **plusieurs choses arrivent à la même seconde**. Toutes les autres
// suites font une chose après l'autre — c'est précisément ce qui laisse passer
// les défauts de concurrence, qui ne se voient jamais en usage solitaire.
//
// Le danger n'est pas la lenteur : c'est le **résultat faux**. Deux factures qui
// portent le même numéro, c'est une comptabilité irrecevable, et cela ne se
// découvre qu'au contrôle. On vérifie donc l'unicité et la continuité, sous
// charge réelle, sur une vraie base.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Une entreprise, son patron et son compteur — le strict nécessaire. */
async function creerEntreprise(nom: string): Promise<{ utilisateurId: string; entrepriseId: string }> {
  const { rows: e } = await pool.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [nom]);
  const entrepriseId = e[0].id as string;
  const { rows: u } = await pool.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@test.local`,
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
  return { utilisateurId, entrepriseId };
}

async function main() {
  await nettoyerBase();

  const marque = Date.now();
  const ctx = await creerEntreprise(`Concurrence ${marque}`);

  console.log("=== Trente numéros de devis demandés à la même seconde ===");

  await cas("aucun doublon, aucun trou : la numérotation tient sous charge", async () => {
    const numeros = await Promise.all(
      Array.from({ length: 30 }, () =>
        withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => attribuerNumeroDevis(tx, ctx.entrepriseId))
      )
    );
    const uniques = new Set(numeros);
    assert.equal(
      uniques.size,
      numeros.length,
      `${numeros.length - uniques.size} numéro(s) de devis en double : deux clients recevraient le même numéro.`
    );

    // Continuité : un trou ne serait pas illégal pour un devis, mais il
    // trahirait une numérotation qui perd des attributions en route.
    const suite = numeros.map((n) => Number(n.split("-")[1])).sort((a, b) => a - b);
    for (let i = 1; i < suite.length; i++) {
      assert.equal(suite[i], suite[i - 1] + 1, `Trou dans la numérotation : ${suite[i - 1]} puis ${suite[i]}.`);
    }
  });

  console.log("\n=== Trente numéros de FACTURE à la même seconde ===");

  await cas("aucun doublon : une facture en double est une comptabilité irrecevable", async () => {
    const numeros = await Promise.all(
      Array.from({ length: 30 }, () =>
        withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => attribuerNumeroFacture(tx, ctx.entrepriseId))
      )
    );
    const uniques = new Set(numeros);
    assert.equal(
      uniques.size,
      numeros.length,
      `${numeros.length - uniques.size} numéro(s) de facture en double. C'est le défaut qui ne se pardonne pas.`
    );
    const suite = numeros.map((n) => Number(n.split("-")[1])).sort((a, b) => a - b);
    for (let i = 1; i < suite.length; i++) {
      assert.equal(suite[i], suite[i - 1] + 1, `Trou dans la numérotation des factures : ${suite[i - 1]} puis ${suite[i]}.`);
    }
  });

  console.log("\n=== Deux entreprises qui travaillent en même temps ===");

  await cas("les numéros de l'une n'avancent pas ceux de l'autre", async () => {
    const ctx2 = await creerEntreprise(`Voisine ${marque}`);

    // Entrelacées volontairement : c'est la situation de dix mille artisans qui
    // facturent le même vendredi soir.
    const [a, b] = await Promise.all([
      Promise.all(
        Array.from({ length: 10 }, () =>
          withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => attribuerNumeroFacture(tx, ctx.entrepriseId))
        )
      ),
      Promise.all(
        Array.from({ length: 10 }, () =>
          withEntreprise(ctx2.utilisateurId, ctx2.entrepriseId, (tx) => attribuerNumeroFacture(tx, ctx2.entrepriseId))
        )
      ),
    ]);

    // Chaque entreprise a SA suite, qui commence à 1 : un compteur partagé
    // ferait sauter des numéros chez le voisin sans qu'il comprenne pourquoi.
    const numerosB = b.map((n) => Number(n.split("-")[1])).sort((x, y) => x - y);
    assert.equal(numerosB[0], 1, `La seconde entreprise commence à ${numerosB[0]} au lieu de 1.`);
    assert.equal(new Set([...a, ...b]).size, 20, "Des numéros se sont mélangés entre deux entreprises.");
  });

  console.log("\n=== Vingt chantiers créés d'un coup ===");

  await cas("tous créés, tous distincts, aucun perdu", async () => {
    const crees = await Promise.all(
      Array.from({ length: 20 }, (_, i) => creerChantier(ctx, { nom: `Chantier simultané ${i}` }))
    );
    assert.equal(new Set(crees.map((c) => c.id)).size, 20, "Des chantiers se sont écrasés entre eux.");

    // Le comptage passe par le contexte d'isolation : une requête nue sur ce
    // rôle ne voit RIEN, la RLS s'en assure. Première version de ce contrôle :
    // elle comptait 0 et accusait le produit d'avoir perdu vingt écritures qui
    // étaient pourtant bien là. Un contrôle qui accuse à tort coûte plus cher
    // que pas de contrôle du tout (`AGENTS.md`).
    const n = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const r = await tx.execute(sql`SELECT count(*)::int AS n FROM chantiers WHERE nom LIKE 'Chantier simultané%'`);
      return Number(r.rows[0].n);
    });
    assert.equal(n, 20, `${n} chantiers en base au lieu de 20 : des écritures se sont perdues.`);
  });

  console.log("\n=== L'isolation tient-elle quand tout arrive en même temps ? ===");

  await cas("aucune fuite d'une entreprise vers l'autre sous charge", async () => {
    // Le contexte d'isolation est posé PAR TRANSACTION (`set_config … true`).
    // S'il fuyait d'une connexion à l'autre du pool, deux requêtes simultanées
    // de deux entreprises se verraient l'une l'autre — le pire défaut possible
    // ici, et invisible en usage solitaire.
    const ctx2 = await creerEntreprise(`Étanche ${marque}`);
    await creerChantier(ctx2, { nom: "Chantier de la voisine" });

    const lectures = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        i % 2 === 0
          ? withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
              (await tx.execute(sql1)).rows.map((r) => String(r.nom))
            )
          : withEntreprise(ctx2.utilisateurId, ctx2.entrepriseId, async (tx) =>
              (await tx.execute(sql1)).rows.map((r) => String(r.nom))
            )
      )
    );

    for (let i = 0; i < lectures.length; i++) {
      const noms = lectures[i] as string[];
      if (i % 2 === 0) {
        assert.ok(
          !noms.includes("Chantier de la voisine"),
          "Une entreprise a vu le chantier d'une autre : l'isolation a fui sous charge."
        );
      } else {
        assert.deepEqual(noms, ["Chantier de la voisine"], `La voisine voit ${noms.length} chantiers au lieu du sien.`);
      }
    }
  });

  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Concurrence — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

import { sql } from "drizzle-orm";
const sql1 = sql`SELECT nom FROM chantiers WHERE deleted_at IS NULL`;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
