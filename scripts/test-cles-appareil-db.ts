// Les clés d'appareil, en base — et surtout : la clé d'un artisan n'appartient
// qu'à lui.
//
// ─────────────────────────────────────────────────────────────────────────────
// **POURQUOI CETTE SUITE COMPTE PLUS QUE LA PLUPART.** `cles_appareil` n'est
// couverte par AUCUNE politique d'isolation — elle ne peut pas l'être, puisque
// au moment où l'on vérifie une clé, aucune session n'existe encore
// (`drizzle/0063_cles_appareil.sql`). Ce qui protège cette table est donc
// entièrement dans le code du dépôt : chaque écriture porte `utilisateur_id`
// dans son `WHERE`.
//
// **Une protection qui vit dans le code et non dans la base ne se relit pas :
// elle s'éprouve.** C'est ce que fait cette suite, en essayant pour de bon de
// retirer et de renommer la clé de quelqu'un d'autre.
//
// Éprouvée SOUS `atlas_app`, comme la production.

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { clesAppareil, users } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import {
  ajouterCle,
  cleParIdentifiant,
  identifiantsDe,
  listerCles,
  noterUsage,
  renommerCle,
  retirerCle,
} from "../src/server/repositories/cles-appareil";
import { CLES_MAX } from "../src/lib/cle-appareil";

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

async function creerUtilisateur(email: string): Promise<string> {
  const [ligne] = await db.insert(users).values({ email, nom: email }).returning({ id: users.id });
  return ligne.id;
}

async function poser(utilisateurId: string, identifiant: string, nom = "iPhone") {
  return ajouterCle({
    utilisateurId,
    identifiantCle: identifiant,
    clePublique: `publique-${identifiant}`,
    compteur: 0,
    nomAppareil: nom,
  });
}

async function main() {
  await nettoyerBase();
  console.log("=== Clés d'appareil, en base ===\n");

  const patron = await creerUtilisateur("patron@essai.local");
  const autre = await creerUtilisateur("autre@essai.local");

  // ─── Poser une clé, la retrouver ─────────────────────────────────────────

  await essai("une clé posée se retrouve par son identifiant, avec son compte", async () => {
    const pose = await poser(patron, "cle-du-patron");
    assert.equal(pose.ok, true);

    const trouvee = await cleParIdentifiant("cle-du-patron");
    assert.ok(trouvee, "la clé posée devrait se retrouver");
    assert.equal(trouvee!.utilisateurId, patron);
    // C'est ce qui permet à l'artisan de ne RIEN taper : on part de la clé, et
    // l'adresse suit.
    assert.equal(trouvee!.email, "patron@essai.local");
    assert.equal(trouvee!.clePublique, "publique-cle-du-patron");
  });

  await essai("une clé inconnue ne rend rien — jamais une ligne au hasard", async () => {
    assert.equal(await cleParIdentifiant("cle-qui-n-existe-pas"), null);
  });

  // ─── L'ISOLATION, sans RLS pour la tenir ─────────────────────────────────

  await essai("LA LISTE D'UN COMPTE NE MONTRE QUE SES CLÉS", async () => {
    await poser(autre, "cle-de-l-autre", "Mac");
    const duPatron = await listerCles(patron);
    assert.equal(duPatron.length, 1);
    assert.equal(duPatron[0].nomAppareil, "iPhone");
  });

  await essai("ON NE RETIRE PAS LA CLÉ D'UN AUTRE — même en connaissant son identifiant", async () => {
    // C'est l'attaque que cette table ne peut pas parer avec une politique
    // d'isolation : il n'y en a aucune. Seul le `WHERE` du dépôt la tient.
    const [cleDeLAutre] = await db
      .select({ id: clesAppareil.id })
      .from(clesAppareil)
      .where(eq(clesAppareil.identifiantCle, "cle-de-l-autre"));

    const retire = await retirerCle(patron, cleDeLAutre.id);
    assert.equal(retire, false, "le patron a pu retirer la clé de quelqu'un d'autre");
    assert.ok(await cleParIdentifiant("cle-de-l-autre"), "la clé de l'autre a disparu");
  });

  await essai("ON NE RENOMME PAS DAVANTAGE LA CLÉ D'UN AUTRE", async () => {
    const [cleDeLAutre] = await db
      .select({ id: clesAppareil.id })
      .from(clesAppareil)
      .where(eq(clesAppareil.identifiantCle, "cle-de-l-autre"));

    const renomme = await renommerCle(patron, cleDeLAutre.id, "Volé");
    assert.equal(renomme, false);
    const [apres] = await db
      .select({ nom: clesAppareil.nomAppareil })
      .from(clesAppareil)
      .where(eq(clesAppareil.identifiantCle, "cle-de-l-autre"));
    assert.equal(apres.nom, "Mac");
  });

  await essai("retirer sa PROPRE clé fonctionne, et le dit", async () => {
    const [sienne] = await db
      .select({ id: clesAppareil.id })
      .from(clesAppareil)
      .where(eq(clesAppareil.identifiantCle, "cle-du-patron"));
    assert.equal(await retirerCle(patron, sienne.id), true);
    assert.equal(await cleParIdentifiant("cle-du-patron"), null);
    // Rendre `false` plutôt que `true` sur une clé déjà partie : sans ça,
    // l'écran dirait « c'est retiré » sans que rien ne le soit.
    assert.equal(await retirerCle(patron, sienne.id), false);
  });

  // ─── Le même appareil, deux fois ─────────────────────────────────────────

  await essai("le même appareil ne s'enregistre pas deux fois", async () => {
    await poser(patron, "cle-unique");
    const seconde = await poser(patron, "cle-unique");
    assert.equal(seconde.ok, false);
    if (!seconde.ok) assert.equal(seconde.refus, "deja-enregistree");
  });

  await essai("les identifiants déjà posés se listent — c'est ce qui fait dire NON à l'appareil", async () => {
    const ids = await identifiantsDe(patron);
    assert.deepEqual(ids.sort(), ["cle-unique"]);
  });

  // ─── La borne ────────────────────────────────────────────────────────────

  await essai(`au-delà de ${CLES_MAX} clés, on refuse — et on le dit`, async () => {
    const seul = await creerUtilisateur("collectionneur@essai.local");
    for (let n = 0; n < CLES_MAX; n++) {
      const r = await poser(seul, `cle-${n}`);
      assert.equal(r.ok, true, `la clé ${n} aurait dû passer`);
    }
    const trop = await poser(seul, "cle-de-trop");
    assert.equal(trop.ok, false);
    if (!trop.ok) assert.equal(trop.refus, "trop-de-cles");

    const posees = await listerCles(seul);
    assert.equal(posees.length, CLES_MAX);
  });

  await essai("LA BORNE TIENT MÊME EN POSANT PLUSIEURS CLÉS À LA FOIS", async () => {
    // Sans le verrou de `ajouterCle`, chaque écriture simultanée compterait
    // `CLES_MAX - 1` clés et passerait : la borne ne bornerait plus rien.
    const presse = await creerUtilisateur("presse@essai.local");
    await Promise.all(
      Array.from({ length: CLES_MAX + 6 }, (_, n) => poser(presse, `simultanee-${n}`))
    );
    const posees = await listerCles(presse);
    assert.ok(
      posees.length <= CLES_MAX,
      `${posees.length} clés posées alors que la borne est à ${CLES_MAX}`
    );
  });

  // ─── L'usage ─────────────────────────────────────────────────────────────

  await essai("une ouverture fait avancer le compteur et date l'usage", async () => {
    const trouvee = await cleParIdentifiant("cle-unique");
    assert.ok(trouvee);
    assert.equal(trouvee!.compteur, 0);

    await noterUsage(trouvee!.id, 7);
    const apres = await cleParIdentifiant("cle-unique");
    assert.equal(apres!.compteur, 7);

    const [ligne] = await listerCles(patron);
    assert.ok(ligne.dernierUsageLe instanceof Date, "l'usage n'est pas daté");
  });

  await essai("une clé jamais servie n'a PAS de date d'usage — l'écran doit pouvoir le dire", async () => {
    const neuf = await creerUtilisateur("neuf@essai.local");
    await poser(neuf, "cle-neuve");
    const [ligne] = await listerCles(neuf);
    assert.equal(ligne.dernierUsageLe, null);
  });

  // ─── Le compte s'en va, ses portes aussi ─────────────────────────────────

  await essai("SUPPRIMER UN COMPTE EMPORTE SES CLÉS — aucune porte orpheline", async () => {
    const passager = await creerUtilisateur("passager@essai.local");
    await poser(passager, "cle-passagere");
    await db.delete(users).where(eq(users.id, passager));
    assert.equal(
      await cleParIdentifiant("cle-passagere"),
      null,
      "une clé survit à son compte : elle ouvrirait un compte qui n'existe plus"
    );
  });

  console.log("");
  console.log(`Clés d'appareil (base) — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
