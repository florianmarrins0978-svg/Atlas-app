// UNE IDÉE POUR L'APPLI — les deux lecteurs, éprouvés sous `atlas_app`
// (migration 0170, `src/server/repositories/idees.ts`).
//
// **Ce que cette suite défend, et pourquoi elle est en base.** La table `idees`
// est la seule où un compte lit des lignes d'autres entreprises que la
// sienne : l'éditeur. Une suite navigateur tourne sous un rôle qui traverse la
// RLS (`CLAUDE.md` §5) et ne verrait rien d'un trou d'isolation. Ici, tout
// passe par `atlas_app`, celui de la production.
//
// **Et elle sait échouer** : le cas « hors de withEditeur, l'éditeur ne voit
// rien » rougit dès que la politique de l'éditeur s'ouvrirait sans son réglage,
// et le cas « l'artisan ne range pas » dès qu'une politique UPDATE lui serait
// donnée.

import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { db, pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { withEditeur, AccesEditeurRefuseError } from "../src/server/editeur";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  envoyerIdee,
  ideesRecues,
  mesIdees,
  nombreDIdeesNouvelles,
  rangerIdee,
  repondreAIdee,
  uneIdeeVientDEtreFaite,
} from "../src/server/repositories/idees";
import { jourIso } from "../src/lib/jour";
import { fermerLimiteur } from "../src/server/rate-limit";
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

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(nom: string, email: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom }, { email, nom: "Lefort" });
  await db.execute(sql`UPDATE users SET prenom = 'Marc' WHERE id = ${utilisateurId}`);
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function codeDuRefus(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e?.cause?.code ?? e?.code ?? "inconnu";
  }
}

/** `idees_alertes` est commune : on la vide sous le propriétaire, `atlas_app` n'y efface rien. */
async function viderLesAlertes() {
  const client = new Client({ connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM idees_alertes");
  } finally {
    await client.end();
  }
}

async function main() {
  await nettoyerBase();
  await viderLesAlertes();
  const suffixe = Date.now();
  const EMAIL_EDITEUR = `editeur-${suffixe}@t.test`;
  process.env.ATLAS_EDITEUR_EMAIL = EMAIL_EDITEUR;

  const a = await contexte("Jardins Démo", `a-${suffixe}@t.test`);
  const b = await contexte("Élagage Durand", `b-${suffixe}@t.test`);
  const editeur = await contexte("Eden Nature", EMAIL_EDITEUR);

  let ideeDeA = "";

  await test("l'artisan envoie : son nom, son rôle et son entreprise sont figés sur l'idée", async () => {
    const r = await envoyerIdee(a, "  Voir la météo de la semaine sur le planning.  ");
    assert.ok(r.ok, r.ok ? "" : r.message);
    ideeDeA = r.idee.id;
    assert.equal(r.idee.texte, "Voir la météo de la semaine sur le planning.");
    assert.equal(r.idee.etat, "envoyee");
    const recues = await ideesRecues(editeur);
    const la = recues.find((i) => i.id === ideeDeA);
    assert.ok(la, "l'éditeur ne voit pas l'idée envoyée");
    assert.equal(la.auteurNom, "Marc");
    assert.equal(la.auteurRole, "proprietaire");
    assert.equal(la.entrepriseNom, "Jardins Démo");
  });

  await test("un texte vide ne part pas, et ne laisse rien en base", async () => {
    const avant = (await mesIdees(a)).length;
    const r = await envoyerIdee(a, "   ");
    assert.equal(r.ok, false);
    assert.equal((await mesIdees(a)).length, avant);
  });

  await test("une autre entreprise ne voit pas l'idée, ni par le dépôt ni par une requête nue", async () => {
    await envoyerIdee(b, "Le devis en anglais.");
    assert.ok(!(await mesIdees(b)).some((i) => i.id === ideeDeA));
    const vues = await withEntreprise(b.utilisateurId, b.entrepriseId, (tx) =>
      tx.execute(sql`SELECT id FROM idees WHERE id = ${ideeDeA}`)
    );
    assert.equal(vues.rows.length, 0, "l'entreprise B lit une idée de A");
  });

  await test("l'artisan ne range pas sa propre idée : aucune ligne touchée", async () => {
    const touchees = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx.execute(sql`UPDATE idees SET etat = 'faite' WHERE id = ${ideeDeA}`)
    );
    assert.equal(touchees.rowCount, 0, "l'artisan a pu changer l'état de son idée");
    const la = (await mesIdees(a)).find((i) => i.id === ideeDeA);
    assert.equal(la?.etat, "envoyee");
  });

  await test("l'artisan n'efface rien : le droit lui est retiré", async () => {
    const code = await codeDuRefus(() =>
      withEntreprise(a.utilisateurId, a.entrepriseId, (tx) => tx.execute(sql`DELETE FROM idees WHERE id = ${ideeDeA}`))
    );
    assert.equal(code, "42501");
  });

  await test("l'artisan n'envoie pas une idée déjà « faite » ni répondue", async () => {
    const code = await codeDuRefus(() =>
      withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
        tx.execute(sql`INSERT INTO idees (entreprise_id, auteur_id, auteur_nom, auteur_role, entreprise_nom, texte, etat)
                       VALUES (${a.entrepriseId}, ${a.utilisateurId}, 'Marc', 'proprietaire', 'Jardins Démo', 'x', 'faite')`)
      )
    );
    assert.equal(code, "42501");
  });

  await test("un compte qui n'est pas l'éditeur ne lit pas les idées reçues", async () => {
    await assert.rejects(() => ideesRecues(a), AccesEditeurRefuseError);
    await assert.rejects(() => nombreDIdeesNouvelles(b), AccesEditeurRefuseError);
    await assert.rejects(() => rangerIdee(a, ideeDeA, "faite"), AccesEditeurRefuseError);
  });

  await test("hors de withEditeur, même le compte de l'éditeur ne voit rien d'autrui (le contrôle sait échouer)", async () => {
    const vues = await withEntreprise(editeur.utilisateurId, editeur.entrepriseId, (tx) =>
      tx.execute(sql`SELECT id FROM idees WHERE entreprise_id <> ${editeur.entrepriseId}`)
    );
    assert.equal(vues.rows.length, 0, "la politique de l'éditeur s'ouvre sans son réglage");
  });

  await test("l'éditeur lit les idées de toutes les entreprises, et rien d'autre de chez elles", async () => {
    const recues = await ideesRecues(editeur);
    const entreprises = new Set(recues.map((i) => i.entrepriseNom));
    assert.ok(entreprises.has("Jardins Démo") && entreprises.has("Élagage Durand"));
    // Des clients existent bien chez A : sans eux, « zéro » ne prouverait rien.
    await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx.execute(sql`INSERT INTO clients (entreprise_id, nom) VALUES (${a.entrepriseId}, 'Bernard')`)
    );
    const ailleurs = await withEditeur(editeur, "sonder", (tx) =>
      tx.execute(sql`SELECT (SELECT count(*) FROM clients)::int AS c, (SELECT count(*) FROM membres_entreprise)::int AS m`)
    );
    const ligne = ailleurs.rows[0] as { c: number; m: number };
    assert.deepEqual(ligne, { c: 0, m: 0 }, "le réglage de l'éditeur ouvre d'autres tables");
  });

  await test("ranger et répondre : l'artisan voit la suite sous son idée", async () => {
    assert.equal(await nombreDIdeesNouvelles(editeur), 2);
    assert.equal(await rangerIdee(editeur, ideeDeA, "prevue"), true);
    const reponse = await repondreAIdee(editeur, ideeDeA, "Bonne idée, on s'y met.");
    assert.ok(reponse.ok);
    const la = (await mesIdees(a)).find((i) => i.id === ideeDeA);
    assert.equal(la?.etat, "prevue");
    assert.equal(la?.reponse, "Bonne idée, on s'y met.");
    assert.equal(await nombreDIdeesNouvelles(editeur), 1);
  });

  await test("une idée faite se dit sur la ligne des Réglages de son auteur, et de lui seul", async () => {
    assert.equal(await uneIdeeVientDEtreFaite(a), false);
    await rangerIdee(editeur, ideeDeA, "faite");
    assert.equal(await uneIdeeVientDEtreFaite(a), true);
    assert.equal(await uneIdeeVientDEtreFaite(b), false);
  });

  await test("ranger une idée qui n'existe pas rend non, sans lever", async () => {
    assert.equal(await rangerIdee(editeur, "00000000-0000-0000-0000-000000000000", "faite"), false);
  });

  await test("un seul courriel par journée : la première idée marque le jour, les suivantes se taisent", async () => {
    const jours = await db.execute(sql`SELECT jour::text AS jour FROM idees_alertes`);
    assert.deepEqual(
      jours.rows.map((r) => (r as { jour: string }).jour),
      [jourIso(new Date())],
      "deux idées le même jour doivent laisser une seule trace d'alerte"
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  delete process.env.ATLAS_EDITEUR_EMAIL;
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
