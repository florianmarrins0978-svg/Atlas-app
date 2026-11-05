import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { pool } from "../src/server/db/client";
import { _reinitialiserEnvPourTests } from "../src/server/env";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  majLigneDeFacture,
  FacturePasPriseParLaPlateformeError,
} from "../src/server/repositories/factures";
import {
  delierPlateforme,
  liaisonPlateforme,
  relierPlateforme,
  transmissionsRecentes,
} from "../src/server/repositories/plateforme-facture";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { factures, liaisonsPlateformes, transmissionsFactures } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { mettreEnRegle } from "./_entreprise-en-regle";
import { demarrerFaussePlateforme, IDENTIFIANTS_DE_LA_FAUSSE_PLATEFORME as IDS, type FaussePlateforme } from "./_fausse-plateforme";

// ═══════════════════════════════════════════════════════════════════════════
// LA PLATEFORME DE FACTURE ÉLECTRONIQUE, EN BASE — ses choix du 5 novembre
// 2026 : 1 A, 2 A, 3 B (`ARCHITECTURE.md` §555)
// ═══════════════════════════════════════════════════════════════════════════
//
// Relier, délier, et surtout **son choix 3 B** : avec une plateforme reliée,
// la facture d'une entreprise n'est émise que si la plateforme l'a prise. Une
// plateforme qui refuse, se tait ou révoque ses identifiants laisse le
// brouillon intact, et le dit. Joué contre une fausse plateforme qui suit les
// contrats de l'API commune (`_fausse-plateforme.ts`), sous `atlas_app`.

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
    { email: `plateforme-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await mettreEnRegle(ctx);
  await entreprisesRepo.mettreAJourEntreprise(ctx, { adresse: "10 rue des Artisans 44000 Nantes" });
  return ctx;
}

async function brouillon(ctx: Ctx, client: { nom: string; civilite: "entreprise" | "mme" }) {
  const fiche = await clientsRepo.creerClient(ctx, { nom: client.nom, civilite: client.civilite });
  await clientsRepo.mettreAJourClient(ctx, fiche.id, {
    adresse: "18 avenue de la Gare, 33000 Bordeaux",
    ...(client.civilite === "entreprise" ? { siret: "98765432100014" } : {}),
  });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille des haies", clientId: fiche.id });
  const facture = await creerFactureSansDevis(ctx, chantier.id, new Date("2026-11-04T09:00:00Z"));
  const a = await ajouterLigneDeFacture(ctx, facture.id, "20.00");
  assert.ok(a.ok);
  await majLigneDeFacture(ctx, facture.id, a.ligne.id, { libelle: "Taille des haies de la résidence", prixUnitaire: "2400" });
  return facture.id;
}

async function lireFacture(ctx: Ctx, id: string) {
  const [f] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(factures).where(eq(factures.id, id)).limit(1)
  );
  return f;
}

async function refusDeLEmission(ctx: Ctx, id: string): Promise<FacturePasPriseParLaPlateformeError> {
  try {
    await emettreFacture(ctx, id, new Date("2026-11-05T09:00:00Z"));
  } catch (err) {
    assert.ok(err instanceof FacturePasPriseParLaPlateformeError, `attendu un refus de la plateforme, reçu : ${err}`);
    return err;
  }
  throw new Error("la facture est partie alors que la plateforme ne l'a pas prise");
}

async function main() {
  await nettoyerBase();
  const plateforme: FaussePlateforme = await demarrerFaussePlateforme();
  process.env.ATLAS_PENNYLANE_FLUX_URL = plateforme.adresseFlux;
  process.env.ATLAS_PENNYLANE_JETON_URL = plateforme.adresseJeton;
  _reinitialiserEnvPourTests();

  const ctx = await contexte("principal");
  const relier = (secret = IDS.secret, identifiant = IDS.identifiant) =>
    relierPlateforme(ctx, { plateforme: "pennylane", identifiant, secret });

  await test("des identifiants faux ne s'enregistrent pas, et la phrase dit quoi faire", async () => {
    const r = await relier("mauvais");
    assert.equal(r.ok, false);
    assert.match((r as { raison: string }).raison, /Pennylane refuse vos identifiants/);
    assert.equal(await liaisonPlateforme(ctx), null);
  });

  await test("relier : la liaison est enregistrée, le secret jamais en clair", async () => {
    const r = await relier();
    assert.deepEqual(r, { ok: true });
    const l = await liaisonPlateforme(ctx);
    assert.equal(l?.etat, "reliee");
    assert.equal(l?.nom, "Pennylane");
    const [brut] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select().from(liaisonsPlateformes).where(eq(liaisonsPlateformes.entrepriseId, ctx.entrepriseId))
    );
    assert.ok(!brut.secretChiffre.includes(IDS.secret), "le secret est écrit en clair");
  });

  await test("une autre entreprise ne voit pas la liaison", async () => {
    const autre = await contexte("autre");
    assert.equal(await liaisonPlateforme(autre), null);
  });

  await test("une plateforme qui n'a pas d'adresse ne se relie pas", async () => {
    const r = await relierPlateforme(ctx, { plateforme: "inconnue", identifiant: "", secret: "x" });
    assert.equal(r.ok, false);
  });

  await test("une facture d'entreprise est déposée, émise, puis lue « transmise »", async () => {
    plateforme.mode = "accepte";
    const id = await brouillon(ctx, { nom: "Syndic Les Tilleuls", civilite: "entreprise" });
    await emettreFacture(ctx, id, new Date("2026-11-05T09:00:00Z"));
    const f = await lireFacture(ctx, id);
    assert.equal(f.statut, "emise");
    const depot = plateforme.depots.at(-1)!;
    assert.equal(depot.flowInfo.trackingId, id);
    assert.equal(depot.flowInfo.processingRule, "B2B");
    assert.equal(depot.flowInfo.name, `facture-${f.numeroCommercial}.pdf`);
    // C'est une Factur-X qui est partie : son XML est dans le PDF déposé.
    const pdf = await PDFDocument.load(depot.fichier, { updateMetadata: false });
    assert.equal(pdf.context.trailerInfo.Encrypt, undefined);
    assert.ok(depot.fichier.includes(Buffer.from("factur-x.xml")), "le PDF déposé ne porte pas factur-x.xml");
    const lues = await transmissionsRecentes(ctx, new Date("2026-11-05T10:00:00Z"));
    const sienne = lues.find((t) => t.factureId === id);
    assert.equal(sienne?.etat, "transmise");
  });

  await test("un particulier ne passe pas par la plateforme, même reliée", async () => {
    const avant = plateforme.depots.length;
    const id = await brouillon(ctx, { nom: "Dupont", civilite: "mme" });
    await emettreFacture(ctx, id, new Date("2026-11-05T09:00:00Z"));
    assert.equal((await lireFacture(ctx, id)).statut, "emise");
    assert.equal(plateforme.depots.length, avant);
  });

  await test("3 B : la plateforme refuse la facture, elle reste en brouillon avec la raison", async () => {
    plateforme.mode = "rejette";
    const id = await brouillon(ctx, { nom: "Syndic Les Tilleuls", civilite: "entreprise" });
    const refus = await refusDeLEmission(ctx, id);
    assert.equal(refus.famille, "refusee");
    assert.match(refus.message, /Il manque le SIREN du client/);
    const f = await lireFacture(ctx, id);
    assert.equal(f.statut, "brouillon");
    assert.equal(f.pdfStorageKey, null);
    const traces = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select().from(transmissionsFactures).where(eq(transmissionsFactures.factureId, id))
    );
    assert.equal(traces.length, 0);
  });

  await test("3 B : la plateforme se tait, rien ne part, et la liaison reste reliée", async () => {
    plateforme.mode = "muette";
    const id = await brouillon(ctx, { nom: "Syndic Les Tilleuls", civilite: "entreprise" });
    const refus = await refusDeLEmission(ctx, id);
    assert.equal(refus.famille, "injoignable");
    assert.match(refus.message, /ne répond pas/);
    assert.equal((await lireFacture(ctx, id)).statut, "brouillon");
    assert.equal((await liaisonPlateforme(ctx))?.etat, "reliee");
  });

  await test("3 B : des identifiants révoqués coupent la liaison, et elle reste coupée", async () => {
    plateforme.mode = "revoque";
    const id = await brouillon(ctx, { nom: "Syndic Les Tilleuls", civilite: "entreprise" });
    const refus = await refusDeLEmission(ctx, id);
    assert.equal(refus.famille, "coupee");
    assert.equal((await liaisonPlateforme(ctx))?.etat, "coupee");
    // La plateforme revient : la liaison coupée refuse quand même, tant qu'il
    // n'a pas remplacé ses identifiants.
    plateforme.mode = "accepte";
    const encore = await refusDeLEmission(ctx, id);
    assert.equal(encore.famille, "coupee");
    assert.equal((await lireFacture(ctx, id)).statut, "brouillon");
    assert.deepEqual(await relier(), { ok: true });
    await emettreFacture(ctx, id, new Date("2026-11-05T09:00:00Z"));
    assert.equal((await lireFacture(ctx, id)).statut, "emise");
  });

  await test("un refus rendu après le dépôt se lit sur la transmission, avec sa raison", async () => {
    plateforme.mode = "refuse";
    const id = await brouillon(ctx, { nom: "Syndic Les Tilleuls", civilite: "entreprise" });
    await emettreFacture(ctx, id, new Date("2026-11-05T09:00:00Z"));
    const lues = await transmissionsRecentes(ctx, new Date("2026-11-05T10:00:00Z"));
    const sienne = lues.find((t) => t.factureId === id);
    assert.equal(sienne?.etat, "refusee");
    assert.match(sienne?.raison ?? "", /SIREN/);
  });

  await test("un jeton d'accès seul suffit, sans identifiant", async () => {
    plateforme.mode = "accepte";
    assert.deepEqual(await relier(IDS.jeton, ""), { ok: true });
    const id = await brouillon(ctx, { nom: "Syndic Les Tilleuls", civilite: "entreprise" });
    await emettreFacture(ctx, id, new Date("2026-11-05T09:00:00Z"));
    assert.equal((await lireFacture(ctx, id)).statut, "emise");
  });

  await test("délier : la facture d'entreprise repart sans plateforme", async () => {
    await delierPlateforme(ctx);
    assert.equal(await liaisonPlateforme(ctx), null);
    plateforme.mode = "muette";
    const id = await brouillon(ctx, { nom: "Syndic Les Tilleuls", civilite: "entreprise" });
    await emettreFacture(ctx, id, new Date("2026-11-05T09:00:00Z"));
    assert.equal((await lireFacture(ctx, id)).statut, "emise");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await plateforme.fermer();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
