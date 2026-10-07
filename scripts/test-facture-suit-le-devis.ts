import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { getOuCreerDevisBrouillon, envoyerDevis, getPromesseDuDevis } from "../src/server/repositories/devis";
import { montantAcompteDuDevis } from "../src/lib/acomptes-facture";
import {
  reprendreLeDevisSurLaFacture,
  terminerChantier,
  emettreFacture,
  ajouterLigneDeFacture,
  majLigneDeFacture,
  majReductionDeFacture,
  FactureEnRetardSurLeDevisError,
} from "../src/server/repositories/factures";
import { creerEntreprise, regler } from "./_devis-et-facture";

/** Les Réglages de l'entreprise, changés après coup : ce que le devis a figé ne doit pas bouger. */
async function reglerLEntreprise(entrepriseId: string, delaiPaiementJours: number) {
  const r = await pool.query(`UPDATE entreprises SET delai_paiement_jours = $2 WHERE id = $1`, [
    entrepriseId,
    delaiPaiementJours,
  ]);
  assert.equal(r.rowCount, 1, "les Réglages n'ont pas changé : la suite ne mesurerait rien");
}

/**
 * ─── LA FACTURE SUIT LE DEVIS — le check-up du 7 octobre 2026 ──────────────
 *
 * Sa règle : *« Si on fait une modification sur un devis il faut que ça suive
 * sur les factures ! »* Chaque cas ci-dessous est un écart relevé entre ce que
 * le client a accepté sur le devis et ce que la facture lui réclamait. Ils
 * passent tous par les fonctions que l'écran appelle, jamais par la base à la
 * main : c'est son chemin qui se joue (`CLAUDE.md` §5 quater).
 */

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

async function main() {
  await nettoyerBase();
  console.log("\n=== La facture suit le devis ===\n");

  // Point 1. Le bandeau « Reprendre ce devis » prévenait, rien n'arrêtait
  // l'envoi : la facture partait figée sur l'ancien prix, et ne se corrige
  // plus que par un avoir.
  await test("une facture en retard sur le devis corrigé ne part pas", async () => {
    const { ctx, chantierId } = await creerEntreprise("Aubert", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await envoyerDevis(ctx, v1.id);
    const facture = await terminerChantier(ctx, chantierId);

    const v2 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.notEqual(v2.id, v1.id, "aucune version corrigée : le cas n'est pas éprouvé");
    await envoyerDevis(ctx, v2.id);

    await assert.rejects(
      () => emettreFacture(ctx, facture.id),
      (e: unknown) => e instanceof FactureEnRetardSurLeDevisError && /v2/.test(e.message),
      "la facture est partie sur la version d'avant du devis"
    );
  });

  await test("une facture à jour du devis part", async () => {
    const { ctx, chantierId } = await creerEntreprise("Bastide", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await envoyerDevis(ctx, v1.id);
    const facture = await terminerChantier(ctx, chantierId);
    const emise = await emettreFacture(ctx, facture.id);
    assert.equal(emise.statut, "emise");
  });

  // Point 2. L'échéance venait des Réglages du jour de la facture, jamais du
  // délai que le client avait accepté sur le devis.
  await test("l'échéance suit le délai du devis, pas les Réglages d'aujourd'hui", async () => {
    const { ctx, chantierId } = await creerEntreprise("Carrel", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await regler(ctx.entrepriseId, v1.id, { delai_paiement_jours: "0" });
    await envoyerDevis(ctx, v1.id);
    await reglerLEntreprise(ctx.entrepriseId, 45);
    const facture = await terminerChantier(ctx, chantierId);
    assert.equal(facture.dateEcheance, facture.dateEmission, "un devis payable comptant donne une facture à 45 jours");
  });

  await test("reprendre le devis corrigé reprend aussi son délai", async () => {
    const { ctx, chantierId } = await creerEntreprise("Duclos", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await envoyerDevis(ctx, v1.id);
    const facture = await terminerChantier(ctx, chantierId);
    const v2 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await regler(ctx.entrepriseId, v2.id, { delai_paiement_jours: "0" });
    await envoyerDevis(ctx, v2.id);
    const r = await reprendreLeDevisSurLaFacture(ctx, facture.id);
    assert.ok(r.ok, "la reprise a été refusée");
    const reprise = await terminerChantier(ctx, chantierId);
    assert.equal(reprise.id, facture.id);
    assert.equal(reprise.dateEcheance, reprise.dateEmission, "la facture reprise garde l'échéance de la version d'avant");
  });

  // Point 3. L'acompte proposé d'office se comptait sur le total de la
  // facture : 1 000 € de travaux en plus faisaient proposer 30 % de 11 000 €
  // pour un acompte versé sur 10 000 €.
  await test("l'acompte proposé se compte sur le total du devis, travaux en plus ou non", async () => {
    const { ctx, chantierId } = await creerEntreprise("Esnault", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    const parti = await envoyerDevis(ctx, v1.id);
    const facture = await terminerChantier(ctx, chantierId);
    const ajout = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(ajout.ok, "la ligne en plus n'a pas été posée");
    await majLigneDeFacture(ctx, facture.id, ajout.ligne.id, {
      libelle: "Bordure en plus",
      quantite: "1",
      prixUnitaire: "1000.00",
    });
    const promesse = await getPromesseDuDevis(ctx, facture.devisId);
    assert.equal(promesse.totalTtc, parti.totalTtc, "la promesse porte le total de la facture");
    const attendu = (Math.round(Number(parti.totalTtc) * 30) / 100).toFixed(2);
    assert.equal(montantAcompteDuDevis(0, promesse), attendu);
  });

  // Point 5, sa « A » du 7 octobre 2026 : la remise du devis reste sur les
  // lignes du devis. Elle ne s'étend pas aux travaux en plus, et ne se change
  // pas sur la facture (la passer à 0 refacturait le devis plein tarif).
  await test("la remise du devis ne touche pas les travaux en plus, et ne se change pas sur la facture", async () => {
    const { ctx, chantierId } = await creerEntreprise("Fabre", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await regler(ctx.entrepriseId, v1.id, { reduction_pourcent: "10.00", reduction_montant: "237.00" });
    await envoyerDevis(ctx, v1.id);
    const facture = await terminerChantier(ctx, chantierId);
    const ajout = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(ajout.ok);
    await majLigneDeFacture(ctx, facture.id, ajout.ligne.id, { libelle: "Bordure en plus", quantite: "1", prixUnitaire: "1000.00" });

    const refus = await majReductionDeFacture(ctx, facture.id, null);
    assert.equal(refus.ok, false, "la remise accordée sur le devis s'est retirée depuis la facture");

    const emise = await emettreFacture(ctx, facture.id);
    // 2 370 € du devis moins 10 %, plus 1 000 € de travaux en plus sans remise.
    assert.equal(emise.totalHt, "3133.00", "la remise du devis s'est étendue aux travaux en plus");
    assert.equal(emise.reductionPourcent, "10.00");
  });

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
