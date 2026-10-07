import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import {
  terminerChantier,
  emettreFacture,
  FactureEnRetardSurLeDevisError,
} from "../src/server/repositories/factures";
import { creerEntreprise } from "./_devis-et-facture";

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

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
