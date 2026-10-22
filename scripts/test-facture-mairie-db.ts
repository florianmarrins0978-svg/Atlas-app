import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  genererPdfFacturePourApercu,
  majAutoliquidationFacture,
  majEcheanceFacture,
  majLigneDeFacture,
  majReferencesChorusFacture,
} from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { entreprises } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";
import { mettreEnRegle } from "./_entreprise-en-regle";

// ═══════════════════════════════════════════════════════════════════════════
// LA FACTURE D'UNE MAIRIE, EN BASE — ses choix du 22 octobre 2026
// (`appli/facture-mairie-chorus.html`)
// ═══════════════════════════════════════════════════════════════════════════
//
// Le code service vient de la fiche et se change sur la facture pour elle
// seule ; le numéro d'engagement ne vit que sur la facture ; les deux
// s'impriment sous le SIRET ; l'échéance ne dépasse pas 30 jours ; la
// sous-traitance ne s'offre pas ; une facture arrêtée ne change plus. Tout
// tourne sous `atlas_app`, comme chez lui : une écriture refusée par la RLS ne
// rendrait rien, sans un mot (`CLAUDE.md` §5).

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

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Jardins de l'Erdre" },
    { email: `mairie-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await mettreEnRegle(ctx);
  return ctx;
}

/** La facture directe d'une mairie dont la fiche porte « Public » et son code service. */
async function factureDeLaMairie(ctx: Ctx, codeService: string | null = "SERV-TECH") {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mairie de Rezé", civilite: "public" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { siret: "21440143200017", codeService });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Square de la mairie", clientId: client.id });
  const facture = await creerFactureSansDevis(ctx, chantier.id, new Date("2026-10-22T09:00:00Z"));
  return { client, chantier, facture };
}

async function avecUneLigne(ctx: Ctx, factureId: string) {
  const a = await ajouterLigneDeFacture(ctx, factureId, "20.00");
  assert.ok(a.ok);
  await majLigneDeFacture(ctx, factureId, a.ligne.id, { libelle: "Taille des haies du square", prixUnitaire: "2400" });
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("principal");

  await test("le code service de la fiche est repris sur la facture, le numéro d'engagement naît vide", async () => {
    const { facture } = await factureDeLaMairie(ctx);
    assert.equal(facture.clientCodeService, "SERV-TECH");
    assert.equal(facture.clientNumeroEngagement, null);
    assert.equal(facture.clientCivilite, "public");
  });

  await test("il les change pour cette facture seule, la fiche garde son code", async () => {
    const { client, facture } = await factureDeLaMairie(ctx);
    const r = await majReferencesChorusFacture(ctx, facture.id, { numeroEngagement: " BC2026/0318 ", codeService: "VOIRIE" });
    assert.deepEqual(r, { ok: true, numeroEngagement: "BC2026/0318", codeService: "VOIRIE" });
    const fiche = await clientsRepo.getClient(ctx, client.id);
    assert.equal(fiche?.codeService, "SERV-TECH");
  });

  await test("vide est permis : la facture s'arrête sans numéro d'engagement", async () => {
    const { facture } = await factureDeLaMairie(ctx, null);
    await avecUneLigne(ctx, facture.id);
    const emise = await emettreFacture(ctx, facture.id, new Date("2026-10-22T10:00:00Z"));
    assert.equal(emise.statut, "emise");
  });

  await test("une facture arrêtée ne change plus ses numéros", async () => {
    const { facture } = await factureDeLaMairie(ctx);
    await avecUneLigne(ctx, facture.id);
    await emettreFacture(ctx, facture.id, new Date("2026-10-22T10:00:00Z"));
    const r = await majReferencesChorusFacture(ctx, facture.id, { numeroEngagement: "BC9", codeService: "X" });
    assert.equal(r.ok, false);
  });

  await test("le PDF porte le SIRET, puis le numéro d'engagement et le code service", async () => {
    const { facture } = await factureDeLaMairie(ctx);
    await avecUneLigne(ctx, facture.id);
    await majReferencesChorusFacture(ctx, facture.id, { numeroEngagement: "BC2026/0318", codeService: "SERV-TECH" });
    const texte = texteDuPdf(await genererPdfFacturePourApercu(ctx, facture.id)).replace(/\s+/g, " ");
    assert.match(texte, /SIRET 21440143200017 N° d'engagement BC2026\/0318 Code service SERV-TECH/);
  });

  await test("le PDF porte la phrase des retards de la commande publique", async () => {
    const { facture } = await factureDeLaMairie(ctx);
    await avecUneLigne(ctx, facture.id);
    const texte = texteDuPdf(await genererPdfFacturePourApercu(ctx, facture.id)).replace(/\s+/g, " ");
    assert.match(texte, /taux de la BCE majoré de 8 points/);
    assert.doesNotMatch(texte, /trois fois le taux d'intérêt légal/);
  });

  await test("son délai de 45 jours devient 30 pour une mairie", async () => {
    const lent = await contexte("quarante-cinq");
    await withEntreprise(lent.utilisateurId, lent.entrepriseId, (tx) =>
      tx.update(entreprises).set({ delaiPaiementJours: 45 }).where(eq(entreprises.id, lent.entrepriseId))
    );
    const { facture } = await factureDeLaMairie(lent);
    assert.equal(facture.dateEcheance, "2026-11-21");
  });

  await test("une échéance au-delà de 30 jours se refuse pour une mairie", async () => {
    const { facture } = await factureDeLaMairie(ctx);
    const r = await majEcheanceFacture(ctx, facture.id, "2026-11-25");
    assert.equal(r.ok, false);
    assert.equal((await majEcheanceFacture(ctx, facture.id, "2026-11-20")).ok, true);
  });

  await test("la sous-traitance, sans TVA, se refuse pour une mairie", async () => {
    const { facture } = await factureDeLaMairie(ctx);
    const r = await majAutoliquidationFacture(ctx, facture.id, true);
    assert.equal(r.ok, false);
  });

  await test("une « Mairie de… » d'avant la pastille est lue publique, sans code service", async () => {
    const client = await clientsRepo.creerClient(ctx, { nom: "Mairie de Bouguenais" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Parc", clientId: client.id });
    const facture = await creerFactureSansDevis(ctx, chantier.id, new Date("2026-10-22T09:00:00Z"));
    assert.equal(facture.clientCodeService, null);
    assert.equal((await majAutoliquidationFacture(ctx, facture.id, true)).ok, false);
  });

  console.log(`\n${passed} vérification(s) verte(s), ${failed} en échec.`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
