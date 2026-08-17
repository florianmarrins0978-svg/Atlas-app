// Retrouver un client déjà connu, en base — et surtout, chez la BONNE entreprise.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE NAVIGATEUR NE VERRAIT.** Les
// suites navigateur démarrent leur serveur sous un rôle qui TRAVERSE la RLS
// (`CLAUDE.md` §5). Or le rapprochement PARCOURT la liste des clients : c'est
// exactement le genre de lecture qui, mal posée, ferait rattacher le chantier
// d'un artisan à la fiche d'un client d'une autre entreprise. Une suite
// navigateur verrait ça vert.
//
// Le reste, dans l'ordre :
//
//   1. le cas du patron — deuxième chantier chez Martins, une seule fiche ;
//   2. deux Martins aux numéros différents restent deux fiches ;
//   3. les cases vides de la fiche se complètent, les autres ne bougent pas ;
//   4. un client EFFACÉ (RGPD) n'est jamais réutilisé — le rapprochement ne
//      doit pas ressusciter un dossier qu'on a fait disparaître ;
//   5. un client supprimé non plus.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerClient, trouverOuCreerClient, getClient } from "../src/server/repositories/clients";
import { effacerClient } from "../src/server/repositories/donnees-client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { clients } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

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

async function monterEntreprise(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `rc-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  console.log("=== Retrouver un client déjà connu, en base ===\n");

  await essai("LE CAS DU PATRON : le deuxième chantier retrouve la même fiche", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rapprochement");
    const premier = await trouverOuCreerClient(ctx, { nom: "Martins" });
    assert.equal(premier.reutilise, false, "le premier passage doit créer");

    const second = await trouverOuCreerClient(ctx, { nom: "M. Martins" });
    assert.equal(second.reutilise, true, "le second passage doit retrouver");
    assert.equal(second.client.id, premier.client.id, "ce n'est pas la même fiche");
  });

  await essai("deux Martins aux numéros différents restent deux fiches", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rapprochement");
    const pere = await trouverOuCreerClient(ctx, { nom: "Martins", telephone: "05 56 00 00 12" });
    const fils = await trouverOuCreerClient(ctx, { nom: "Martins", telephone: "06 12 34 56 78" });
    assert.equal(fils.reutilise, false, "le fils a été versé sur la fiche du père");
    assert.notEqual(fils.client.id, pere.client.id);
  });

  await essai("le même numéro écrit autrement retrouve bien la fiche", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rapprochement");
    const a = await trouverOuCreerClient(ctx, { nom: "Martins", telephone: "+33 6 12 34 56 78" });
    const b = await trouverOuCreerClient(ctx, { nom: "Martins", telephone: "06.12.34.56.78" });
    assert.equal(b.client.id, a.client.id, "deux graphies du même numéro ont fait deux fiches");
  });

  await essai("les cases vides se complètent, les autres ne bougent pas", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rapprochement");
    const premier = await trouverOuCreerClient(ctx, {
      nom: "Martins",
      telephone: "05 56 00 00 12",
    });
    await trouverOuCreerClient(ctx, {
      nom: "Martins",
      telephone: "05 56 00 00 12", // le même, sinon c'est quelqu'un d'autre
      email: "martins@ex.test",
      adresse: "3 rue des Lilas",
    });
    const fiche = await getClient(ctx, premier.client.id);
    assert.equal(fiche?.email, "martins@ex.test", "l'e-mail manquant n'a pas été ajouté");
    assert.equal(fiche?.adresse, "3 rue des Lilas", "l'adresse manquante n'a pas été ajoutée");
    assert.equal(fiche?.telephone, "05 56 00 00 12", "le téléphone déjà noté a été réécrit");
  });

  await essai("UN CLIENT EFFACÉ (RGPD) N'EST JAMAIS RÉUTILISÉ", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rapprochement");
    const ancien = await creerClient(ctx, { nom: "Martins", telephone: "0612345678" });
    await effacerClient(ctx, ancien.id);

    const neuf = await trouverOuCreerClient(ctx, { nom: "Martins", telephone: "0612345678" });
    assert.equal(neuf.reutilise, false, "un chantier neuf a été rattaché à une fiche effacée");
    assert.notEqual(neuf.client.id, ancien.id);
  });

  await essai("un client supprimé n'est pas réutilisé non plus", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rapprochement");
    const ancien = await creerClient(ctx, { nom: "Martins" });
    // **Par `withEntreprise`, jamais par `db` directement.** Un `UPDATE` hors
    // de ce cadre ne touche AUCUNE ligne, silencieusement (`CLAUDE.md` §3) : le
    // cas passait alors au vert sans avoir rien supprimé — un contrôle qui ne
    // mesure rien.
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, ancien.id))
    );

    const neuf = await trouverOuCreerClient(ctx, { nom: "Martins" });
    assert.equal(neuf.reutilise, false, "une fiche supprimée a été ressuscitée");
  });

  await essai("ISOLATION : le client d'une autre entreprise n'est jamais retrouvé", async () => {
    await nettoyerBase();
    const a = await monterEntreprise("Entreprise A");
    const b = await monterEntreprise("Entreprise B");
    const chezA = await creerClient(a, { nom: "Martins", telephone: "0612345678" });

    const chezB = await trouverOuCreerClient(b, { nom: "Martins", telephone: "0612345678" });
    assert.equal(chezB.reutilise, false, "B a rattaché son chantier au client de A");
    assert.notEqual(chezB.client.id, chezA.id);

    // Et la fiche de A n'a pas été touchée au passage.
    const ficheDeA = await getClient(a, chezA.id);
    assert.equal(ficheDeA?.nom, "Martins");
  });

  await essai("deux homonymes indiscernables : le plus récent, pas un troisième", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rapprochement");
    const vieux = await creerClient(ctx, { nom: "Martins" });
    // `createdAt` a la seconde près : on vieillit le premier plutôt que
    // d'attendre — sans quoi le cas tiendrait à l'ordre d'insertion et
    // basculerait au hasard des machines.
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx
        .update(clients)
        .set({ createdAt: new Date("2026-01-01T00:00:00Z") })
        .where(eq(clients.id, vieux.id))
    );
    const recent = await creerClient(ctx, { nom: "Martins" });

    const retrouve = await trouverOuCreerClient(ctx, { nom: "Martins" });
    assert.equal(retrouve.reutilise, true, "un troisième Martins a été créé");
    assert.equal(retrouve.client.id, recent.id, "ce n'est pas la fiche la plus récente");
  });

  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Retrouver un client, en base — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
