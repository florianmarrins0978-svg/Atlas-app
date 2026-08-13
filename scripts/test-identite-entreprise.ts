/*
  L'identité de l'entreprise — migration 0037, `ARCHITECTURE.md` §81.

  CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE TENAIT :

    · LE RÉGIME DE TVA SE DÉCLARE, IL NE SE DEVINE PLUS. Jusqu'au 13 août 2026,
      `facture-pdf.ts` imprimait la mention de l'article 293 B quand le taux
      valait zéro — donc il tirait une situation fiscale d'un chiffre saisi
      chantier par chantier, et se trompait dans les deux sens.
    · LE REPLI SUR LE TAUX DEMEURE pour les factures antérieures, qui n'ont pas
      de régime figé. Le retirer réécrirait l'historique.
    · L'ISOLATION TIENT : ces champs sont des données d'entreprise comme les
      autres, et ne doivent pas traverser (`CLAUDE.md` §4).
    · UN NON-PROPRIÉTAIRE NE PEUT PAS ÉCRIRE : ces champs portent l'IBAN.

  Chacun sait échouer : rendre `regimeTva` à `mentionLegaleFacture` sans le lire
  rougit le premier, supprimer le repli rougit le deuxième, retirer
  `withEntreprise` rougit le troisième.
*/
import assert from "node:assert";
import type { TraceDocument } from "../src/server/pdf/document-commun";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { composerFacturePdf } from "../src/server/pdf/facture-pdf";
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

/** Ce que le document a réellement écrit. Le champ s'appelle `contenu`. */
const mots = (trace: TraceDocument) => trace.textes.map((t) => t.contenu).join(" ");

/** Le squelette minimal d'une facture, pour n'éprouver que la mention. */
function facture(extra: Record<string, unknown>) {
  return {
    numeroCommercial: "F-2026-001",
    statut: "emise" as const,
    dateEmission: "2026-08-13",
    entrepriseNom: "Arborea",
    clientNom: "M. Dupont",
    devise: "EUR",
    tauxTva: "20.00",
    totalHt: "1000.00",
    totalTva: "200.00",
    totalTtc: "1200.00",
    lignes: [{ libelle: "Abattage", quantite: "1", prixUnitaire: "1000.00", montant: "1000.00", unite: null }],
    ...extra,
  };
}

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Identite A" },
    { email: "a@identite.test", nom: "Patron A" }
  );
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Identite B" },
    { email: "b@identite.test", nom: "Patron B" }
  );
  const ctxA = { utilisateurId: userA, entrepriseId: entA.id };
  const ctxB = { utilisateurId: userB, entrepriseId: entB.id };

  // ── Le défaut ne change rien au comportement d'avant ───────────────────
  await test("une entreprise naît assujettie — le défaut qui ne change rien", async () => {
    const e = await entreprisesRepo.getEntreprise(ctxA);
    assert.strictEqual(e?.regimeTva, "assujettie");
  });

  await test("les quatre champs neufs s'écrivent et se relisent", async () => {
    await entreprisesRepo.mettreAJourEntreprise(ctxA, {
      formeJuridique: "SASU",
      numeroTva: "FR76812345678",
      titulaireCompte: "Arborea",
      regimeTva: "franchise",
    });
    const e = await entreprisesRepo.getEntreprise(ctxA);
    assert.strictEqual(e?.formeJuridique, "SASU");
    assert.strictEqual(e?.numeroTva, "FR76812345678");
    assert.strictEqual(e?.titulaireCompte, "Arborea");
    assert.strictEqual(e?.regimeTva, "franchise");
  });

  await test("un champ vidé revient à NULL, jamais à une chaîne vide", async () => {
    await entreprisesRepo.mettreAJourEntreprise(ctxA, { numeroTva: "" });
    const e = await entreprisesRepo.getEntreprise(ctxA);
    assert.strictEqual(e?.numeroTva, null);
  });

  // ── L'ISOLATION : ces champs ne traversent pas ─────────────────────────
  await test("le régime de A ne déteint pas sur B", async () => {
    const b = await entreprisesRepo.getEntreprise(ctxB);
    assert.strictEqual(b?.regimeTva, "assujettie", "B doit garder son propre régime");
    assert.strictEqual(b?.formeJuridique ?? null, null, "B n'a jamais rien saisi");
  });

  // ── LE POINT QUI COMPTE : la mention se lit dans le régime déclaré ─────
  await test("en franchise, la mention 293 B s'imprime — MÊME avec un taux non nul", async () => {
    const { trace } = await composerFacturePdf(
      facture({ regimeTva: "franchise", tauxTva: "20.00" }) as never
    );
    
    assert.ok(/293 B du CGI/.test(mots(trace)), "la franchise déclarée doit imprimer sa mention");
  });

  await test("assujettie, elle ne s'imprime pas — MÊME avec un taux nul", async () => {
    const { trace } = await composerFacturePdf(
      facture({ regimeTva: "assujettie", tauxTva: "0.00", totalTva: "0.00", totalTtc: "1000.00" }) as never
    );
    
    assert.ok(!/293 B/.test(mots(trace)), "un assujetti ne doit pas annoncer la franchise");
  });

  // C'étaient précisément les deux cas que l'ancienne déduction ratait : un
  // artisan en franchise qui laissait 20 % perdait sa mention, un assujetti qui
  // posait 0 % en gagnait une fausse. Sur une pièce comptable.

  // ── LE REPLI, qui porte tout l'historique ──────────────────────────────
  await test("sans régime figé, la mention se déduit du taux — comme avant", async () => {
    const { trace: sansTva } = await composerFacturePdf(
      facture({ tauxTva: "0.00", totalTva: "0.00", totalTtc: "1000.00" }) as never
    );
    assert.ok(/293 B/.test(mots(sansTva)),
      "une facture d'avant la migration, à 0 %, gardait sa mention");

    const { trace: avecTva } = await composerFacturePdf(facture({}) as never);
    assert.ok(!/293 B/.test(mots(avecTva)),
      "et une facture à 20 % ne l'avait pas");
  });

  await test("les pénalités et l'indemnité de 40 € s'impriment dans tous les cas", async () => {
    for (const regime of ["assujettie", "franchise", null]) {
      const { trace } = await composerFacturePdf(facture({ regimeTva: regime }) as never);
      const pied = mots(trace);
      assert.ok(/40 €/.test(pied), `l'indemnité manque (régime : ${regime})`);
      assert.ok(/trois fois le taux/.test(pied), `les pénalités manquent (régime : ${regime})`);
    }
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
