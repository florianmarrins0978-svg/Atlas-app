// UNE LIGNE DE DEVIS NE PREND PAS UN NOMBRE QU'AUCUN ÉCRAN N'ENVOIE.
//
// **Audit du 26 octobre 2026, scénario de l'argent.** Le serveur recalcule le
// montant d'une ligne depuis sa quantité et son prix, et la base fige le devis
// une fois émis. Restait la requête forgée : un prix négatif retirait de
// l'argent au devis sans passer par la remise, un nombre démesuré faisait une
// erreur 500 au lieu d'un refus. Le dépôt les refuse avant d'écrire.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { ajouterLignePrix, listerLignesPrix, modifierLignePrix } from "../src/server/repositories/lignes-prix";
import { nombreDeLigneAdmis } from "../src/lib/montant-ecrivable";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Les nombres d'une ligne de devis ===\n");

  await essai("la règle : positif, lisible, borné ; les décimales de l'écran passent", () => {
    for (const ok of ["0", "0.00", "17.50", "0,125", "1 250", "99999999.99"]) assert.equal(nombreDeLigneAdmis(ok), true, ok);
    for (const ko of ["-1", "-0.01", "abc", "", "Infinity", "1e12", "100000000"]) assert.equal(nombreDeLigneAdmis(ko), false, ko);
  });

  const marque = Date.now();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Nombres ${marque}` },
    { email: `nombres-${marque}@test.local`, nom: "Patron" }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie" });
  const ligne = await ajouterLignePrix(ctx, chantier.id, "Taille de haie", "300.00", { quantite: "20", prixUnitaire: "15.00" });

  await essai("un prix unitaire NÉGATIF est refusé, et la ligne ne bouge pas", async () => {
    await assert.rejects(modifierLignePrix(ctx, ligne.id, { prixUnitaire: "-500" }));
    const relue = (await listerLignesPrix(ctx, chantier.id)).find((l) => l.id === ligne.id);
    assert.equal(relue?.prixUnitaire, "15.00", "LE PRIX NÉGATIF S'EST ÉCRIT");
  });

  await essai("une quantité démesurée est refusée avant la base (pas une erreur 500)", async () => {
    await assert.rejects(modifierLignePrix(ctx, ligne.id, { quantite: "1e12" }), /nombre négatif, illisible ou démesuré/);
  });

  await essai("une ligne AJOUTÉE avec un montant négatif est refusée", async () => {
    await assert.rejects(ajouterLignePrix(ctx, chantier.id, "Remise cachée", "-100.00"), /nombre négatif/);
  });

  await essai("un prix ordinaire passe, et le montant suit la quantité", async () => {
    const r = await modifierLignePrix(ctx, ligne.id, { prixUnitaire: "16.00" });
    assert.equal(r?.montant, "320.00");
  });

  await pool.end();
  console.log(`\nNombres de ligne — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
