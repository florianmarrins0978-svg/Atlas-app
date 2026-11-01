import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { nettoyerBase } from "./_test-db";

/**
 * LES PHOTOS DE SES COORDONNÉES VONT SUR SON DERNIER CHANTIER.
 *
 * Sa planche du 1er novembre 2026 (`appli/soignee/client-coordonnees.html`) :
 * *« en dessous d'Enregistrer, tu laisses ce qui se trouve dans l'appli, le
 * plus pour les photos »*. Une photo appartient à un chantier (`photos.
 * chantier_id NOT NULL`) : posée depuis la fiche du client, elle rejoint son
 * chantier le plus récent, et rien ne s'affiche s'il n'en a aucun.
 *
 * Ce que la suite tient, sous `atlas_app` comme le serveur :
 *   le plus récent, pas le premier ; un chantier supprimé ne compte pas ;
 *   un client sans chantier rend `null` ; une autre entreprise ne voit rien.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function contexte(email: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Jardins Roux" }, { email });
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("dernier-chantier@test.local");
  const autre = await contexte("autre-entreprise@test.local");

  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Costa" });
  const sansChantier = await clientsRepo.creerClient(ctx, { nom: "M. Bernard" });
  const ancien = await chantiersRepo.creerChantier(ctx, { nom: "Terrasse", clientId: client.id });
  // Deux transactions, deux instants : `created_at` les range sans y toucher.
  // (Le réécrire ici passerait par `atlas_app` sans contexte : sous FORCE RLS,
  // zéro ligne touchée et aucune erreur, `.claude/rules/migrations.md`.)
  const recent = await chantiersRepo.creerChantier(ctx, { nom: "Taille de haies", clientId: client.id });

  await essai("le plus récent de ses chantiers, pas le premier", async () => {
    assert.equal(await chantiersRepo.dernierChantierDuClient(ctx, client.id), recent.id);
  });

  await essai("un client sans chantier : rien, et donc aucun « + » à l'écran", async () => {
    assert.equal(await chantiersRepo.dernierChantierDuClient(ctx, sansChantier.id), null);
  });

  await essai("un chantier supprimé ne reçoit plus de photos", async () => {
    await chantiersRepo.supprimerChantier(ctx, recent.id);
    assert.equal(await chantiersRepo.dernierChantierDuClient(ctx, client.id), ancien.id);
  });

  await essai("une autre entreprise ne voit pas ses chantiers", async () => {
    assert.equal(await chantiersRepo.dernierChantierDuClient(autre, client.id), null);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le dernier chantier du client : ${echecs} échec(s)\n`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
