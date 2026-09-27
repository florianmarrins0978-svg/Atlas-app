// L'organigramme, contre la base, sous `atlas_app` comme la production.
//
// **CE QUE CETTE SUITE TIENT :**
//
//   · **tout le monde le LIT** (sa règle du 27 septembre 2026) : un salarié y
//     trouve le patron et le bureau, et rien de leur adresse ;
//   · **un gars n'a qu'UN chef**, et un chef qui perd son titre libère ses gars ;
//   · **un chef d'une autre entreprise est refusé PAR LA BASE**, pas seulement
//     par le code (clé étrangère sur l'entreprise, migration 0110) ;
//   · **ajouter un gars fait monter le compteur** : le même geste que le +.

import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import { ajouterSalarie, lireOrganigramme, nommerChef, rangerSousChef } from "../src/server/repositories/organigramme";
import { construireOrganigramme } from "../src/lib/organigramme";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { equipes } from "../src/server/db/schema";
import type { Ctx } from "../src/server/repositories/context";

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

async function monter() {
  await nettoyerBase();
  const a = await creerEntreprise({ nom: "Chez A" }, { email: "a@essai.local", nom: "Anne" });
  const b = await creerEntreprise({ nom: "Chez B" }, { email: "b@essai.local", nom: "Bruno" });
  const ctxA: Ctx = { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id };
  const ctxB: Ctx = { utilisateurId: b.utilisateurId, entrepriseId: b.entreprise.id };
  return { ctxA, ctxB };
}

async function compte(ctx: Ctx, email: string, role: "commercial" | "facturation" | "salarie"): Promise<Ctx> {
  const r = await donnerUnAcces(ctx, {
    nom: email.split("@")[0],
    email,
    motDePasse: "un-mot-de-passe-assez-long",
    confirmation: "un-mot-de-passe-assez-long",
    role,
  });
  assert.equal(r.ok, true, `le montage n'a pas pu créer ${email}`);
  const acces = (await listerAcces(ctx)).find((l) => l.email === email)!;
  return { utilisateurId: acces.utilisateurId, entrepriseId: ctx.entrepriseId };
}

async function organigramme(ctx: Ctx) {
  const d = await lireOrganigramme(ctx);
  return construireOrganigramme(d.comptes, d.salaries, d.nombreSalaries);
}

async function main() {
  console.log("=== L'organigramme, contre la base ===\n");

  await essai("ajouter un gars fait monter le compteur et lui donne son chef", async () => {
    const { ctxA } = await monter();
    assert.deepEqual(await ajouterSalarie(ctxA, "Karim", null), { ok: true });
    assert.deepEqual(await nommerChef(ctxA, 1, true), { ok: true });
    assert.deepEqual(await ajouterSalarie(ctxA, "Léo", 1), { ok: true });
    assert.deepEqual(await ajouterSalarie(ctxA, "Tom", null), { ok: true });
    const o = await organigramme(ctxA);
    assert.equal((await lireOrganigramme(ctxA)).nombreSalaries, 3);
    assert.deepEqual(
      o.chefs.map((c) => [c.libelle, c.gars.map((g) => g.libelle)]),
      [["Karim", ["Léo"]]]
    );
    assert.deepEqual(o.sansChef.map((g) => g.libelle), ["Tom"]);
  });

  await essai("un gars n'a qu'un chef : le nouveau remplace l'ancien", async () => {
    const { ctxA } = await monter();
    for (const n of ["Karim", "Mathis", "Léo"]) await ajouterSalarie(ctxA, n, null);
    await nommerChef(ctxA, 1, true);
    await nommerChef(ctxA, 2, true);
    await rangerSousChef(ctxA, 3, 1);
    await rangerSousChef(ctxA, 3, 2);
    const o = await organigramme(ctxA);
    assert.deepEqual(o.chefs.map((c) => [c.libelle, c.gars.map((g) => g.libelle)]), [
      ["Karim", []],
      ["Mathis", ["Léo"]],
    ]);
  });

  await essai("on ne range pas un gars sous quelqu'un qui n'est pas chef, ni sous lui-même", async () => {
    const { ctxA } = await monter();
    for (const n of ["Karim", "Léo"]) await ajouterSalarie(ctxA, n, null);
    assert.deepEqual(await rangerSousChef(ctxA, 2, 1), { ok: false, refus: "chef-invalide" });
    await nommerChef(ctxA, 1, true);
    assert.deepEqual(await rangerSousChef(ctxA, 1, 1), { ok: false, refus: "chef-invalide" });
    assert.deepEqual(await rangerSousChef(ctxA, 9, 1), { ok: false, refus: "hors-compteur" });
  });

  await essai("un chef qui perd son titre libère ses gars", async () => {
    const { ctxA } = await monter();
    await ajouterSalarie(ctxA, "Karim", null);
    await nommerChef(ctxA, 1, true);
    await ajouterSalarie(ctxA, "Léo", 1);
    await nommerChef(ctxA, 1, false);
    const o = await organigramme(ctxA);
    assert.deepEqual(o.chefs, []);
    assert.deepEqual(o.sansChef.map((g) => g.libelle), ["Karim", "Léo"]);
    // Redevenu chef, il ne récupère personne sans qu'on l'ait redemandé.
    await nommerChef(ctxA, 1, true);
    assert.deepEqual((await organigramme(ctxA)).chefs[0].gars, []);
  });

  await essai("un chef d'une autre entreprise est refusé par la base", async () => {
    const { ctxA, ctxB } = await monter();
    await ajouterSalarie(ctxA, "Léo", null);
    await ajouterSalarie(ctxB, "Chef d'ailleurs", null);
    const [ailleurs] = (await lireOrganigramme(ctxB)).salaries;
    const [leo] = (await lireOrganigramme(ctxA)).salaries;
    await assert.rejects(
      withEntreprise(ctxA.utilisateurId, ctxA.entrepriseId, (tx) =>
        tx
          .update(equipes)
          .set({ chefId: ailleurs.id })
          .where(and(eq(equipes.entrepriseId, ctxA.entrepriseId), eq(equipes.id, leo.id)))
      ),
      "la base a accepté un chef venu d'une autre entreprise"
    );
  });

  await essai("un salarié lit l'organigramme entier, sans aucune adresse", async () => {
    const { ctxA, ctxB } = await monter();
    await compte(ctxA, "julien@essai.local", "commercial");
    await compte(ctxA, "sophie@essai.local", "facturation");
    const leo = await compte(ctxA, "leo@essai.local", "salarie");
    await ajouterSalarie(ctxA, "Karim", null);
    const o = await organigramme(leo);
    assert.deepEqual(o.patrons.map((p) => p.nom), ["Anne"]);
    assert.deepEqual(o.bureau.map((p) => [p.nom, p.role]), [
      ["julien", "commercial"],
      ["sophie", "facturation"],
    ]);
    assert.deepEqual(o.sansChef.map((g) => g.libelle), ["Karim"]);
    const d = await lireOrganigramme(leo);
    assert.ok(!JSON.stringify(d).includes("@"), "une adresse est lisible dans l'organigramme");
    // Et rien de la voisine.
    assert.ok(!(await lireOrganigramme(ctxB)).comptes.some((c) => c.nom === "Anne"));
  });

  console.log("");
  await pool.end();
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("L'organigramme en base — 0 échec(s).");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
