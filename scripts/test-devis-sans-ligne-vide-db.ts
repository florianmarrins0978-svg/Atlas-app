// UNE LIGNE SANS RIEN NE PART PAS SUR LE DEVIS — en base, sous `atlas_app`.
//
// **Sa capture du 29 septembre 2026** : une case ronde, vide, sur la fiche
// d'intervention de Bernard. Le devis portait une ligne que « + Ajouter une
// ligne » écrit sur la feuille dès l'appui, avant le premier mot, et qui était
// restée vide. Sa réponse, quand on lui a demandé s'il fallait l'arrêter :
// *« Oui »*.
//
// **Pourquoi ici et pas sur le bouton.** Trois gestes posent une ligne vide sur
// la feuille : « + Ajouter une ligne » sur le devis, le même sur l'écran Prix,
// « Ajouter une TVA » ; un quatrième la vide après coup, en effaçant son texte.
// Ils aboutissent tous à `getOuCreerDevisBrouillon`, qui fabrique le DEVIS (le
// PDF, l'envoi, le planning) à partir de la feuille. C'est là qu'une ligne sans
// rien s'arrête, une fois pour toutes.
//
// **Et ce qui doit rester.** Une ligne sans libellé mais avec un montant part,
// c'est une décision du patron (`peutPreparerLaPiece`) ; une ligne « à
// chiffrer » part aussi, puisqu'elle bloque l'envoi tant qu'elle n'a pas de prix.

import assert from "node:assert/strict";
import { asc, eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { lignesDevis } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { nettoyerBase } from "./_test-db";

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

async function main() {
  console.log("Le devis sans ligne vide, en base\n");
  await nettoyerBase();
  const A = await entreprisesRepo.creerEntreprise(
    { nom: "Paysages A" },
    { email: `ligne-vide-${Date.now()}@test.local`, nom: "Anne" }
  );
  const ctx = { utilisateurId: A.utilisateurId, entrepriseId: A.entreprise.id };

  const lignesDuDevis = (devisId: string) =>
    withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx
        .select({ libelle: lignesDevis.libelle, montant: lignesDevis.montant, ordre: lignesDevis.ordre })
        .from(lignesDevis)
        .where(eq(lignesDevis.devisId, devisId))
        .orderBy(asc(lignesDevis.ordre))
    );

  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Bernard" });
  // Dans l'ordre de ses gestes : la ligne ouverte par « + Ajouter une ligne »
  // et laissée vide, le travail, la catégorie « Ajouter une TVA » jamais
  // remplie, une ligne sans libellé mais chiffrée, une ligne à chiffrer.
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "", "0.00");
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Coupe de haie", "300.00");
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "", "0.00", { tauxTva: "10" });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "  ", "50.00");
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Abattage", "0", { aChiffrer: true });

  await essai("la ligne vide ne part pas sur le devis, le reste part dans l'ordre", async () => {
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const lignes = await lignesDuDevis(d.id);
    assert.deepEqual(
      lignes.map((l) => [l.libelle.trim(), l.montant, l.ordre]),
      [
        ["Coupe de haie", "300.00", 0],
        ["", "50.00", 1],
        ["Abattage", "0.00", 2],
      ]
    );
    assert.equal(d.totalHt, "350.00");
  });

  await essai("le brouillon régénéré ne la reprend pas non plus", async () => {
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "", "0.00");
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const lignes = await lignesDuDevis(d.id);
    assert.equal(lignes.length, 3, `le devis porte ${lignes.length} lignes`);
  });

  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Devis sans ligne vide, en base : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
