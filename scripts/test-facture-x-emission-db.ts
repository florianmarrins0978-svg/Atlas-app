import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, type PDFRef } from "pdf-lib";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  majLigneDeFacture,
} from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { factures } from "../src/server/db/schema";
import { lireObjet } from "../src/server/storage";
import { nettoyerBase } from "./_test-db";
import { mettreEnRegle } from "./_entreprise-en-regle";

/** Le flux d'un fichier joint, désigné par sa référence. */
function fluxBrut(doc: PDFDocument, ref: unknown): PDFRawStream {
  const flux = doc.context.lookup(ref as PDFRef);
  assert.ok(flux instanceof PDFRawStream, "le fichier joint n'est pas un flux");
  return flux;
}

// ═══════════════════════════════════════════════════════════════════════════
// LA FACTUR-X À L'ÉMISSION, EN BASE — sa décision du 5 novembre 2026
// (`ARCHITECTURE.md` §555)
// ═══════════════════════════════════════════════════════════════════════════
//
// **Le geste du patron, pas la fonction** (`CLAUDE.md` §5 quater) : on émet une
// facture comme « Envoyer la facture » le fait, puis on relit la pièce
// ARCHIVÉE, celle que le lien du client sert. Une entreprise doit y trouver
// une Factur-X (son XML dedans, aucun verrou) ; un particulier, le PDF
// verrouillé d'aujourd'hui. Et une entreprise dont l'adresse ne se lit pas
// garde le PDF ordinaire au lieu de ne rien recevoir. Tout tourne sous
// `atlas_app`, comme chez lui.
//
// Le XML lui-même est jugé par les règles officielles dans
// `test-facture-x.ts` ; ici, c'est le chemin.

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

async function contexte(suffixe: string, adresse: string | null): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Jardins de l'Erdre" },
    { email: `facture-x-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await mettreEnRegle(ctx);
  if (adresse) await entreprisesRepo.mettreAJourEntreprise(ctx, { adresse });
  return ctx;
}

/** Une facture d'une ligne, émise, et la pièce archivée relue. */
async function pieceEmise(
  ctx: Ctx,
  client: { nom: string; civilite: "entreprise" | "mme"; siret?: string; adresse: string }
): Promise<{ octets: Buffer; numero: string }> {
  const fiche = await clientsRepo.creerClient(ctx, { nom: client.nom, civilite: client.civilite });
  await clientsRepo.mettreAJourClient(ctx, fiche.id, { adresse: client.adresse, ...(client.siret ? { siret: client.siret } : {}) });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille des haies", clientId: fiche.id });
  const facture = await creerFactureSansDevis(ctx, chantier.id, new Date("2026-11-04T09:00:00Z"));
  const a = await ajouterLigneDeFacture(ctx, facture.id, "20.00");
  assert.ok(a.ok);
  await majLigneDeFacture(ctx, facture.id, a.ligne.id, { libelle: "Taille des haies de la résidence", prixUnitaire: "2400" });
  await emettreFacture(ctx, facture.id, new Date("2026-11-05T09:00:00Z"));
  const [f] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(factures).where(eq(factures.id, facture.id)).limit(1)
  );
  assert.ok(f.pdfStorageKey, "la facture émise n'a pas de pièce archivée");
  return { octets: await lireObjet(f.pdfStorageKey!), numero: f.numeroCommercial };
}

async function lire(octets: Buffer) {
  const doc = await PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false });
  const chiffre = doc.context.trailerInfo.Encrypt !== undefined;
  const noms = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict)?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  const liste = noms?.lookupMaybe(PDFName.of("Names"), PDFArray);
  let xml: string | null = null;
  if (liste) {
    for (let i = 0; i < liste.size(); i += 2) {
      if (String(liste.lookup(i)) !== "(factur-x.xml)") continue;
      const flux = liste.lookup(i + 1, PDFDict).lookup(PDFName.of("EF"), PDFDict).get(PDFName.of("F"));
      xml = inflateSync(fluxBrut(doc, flux).getContents()).toString("utf8");
    }
  }
  return { chiffre, xml };
}

async function main() {
  await nettoyerBase();

  await test("une entreprise reçoit une Factur-X : son XML dedans, aucun verrou", async () => {
    const ctx = await contexte("entreprise", "10 rue des Artisans 44000 Nantes");
    const { octets, numero } = await pieceEmise(ctx, {
      nom: "Syndic Les Tilleuls",
      civilite: "entreprise",
      siret: "98765432100014",
      adresse: "18 avenue de la Gare, 33000 Bordeaux",
    });
    const { chiffre, xml } = await lire(octets);
    assert.equal(chiffre, false, "une Factur-X ne peut pas être chiffrée");
    assert.ok(xml, "aucun factur-x.xml dans la pièce archivée");
    assert.ok(xml!.includes(`<ram:ID>${numero}</ram:ID>`), "le XML ne porte pas le numéro de la facture");
    assert.ok(xml!.includes('<ram:ID schemeID="0002">123456789</ram:ID>'), "le SIREN du vendeur manque");
    assert.ok(xml!.includes('<ram:ID schemeID="0002">987654321</ram:ID>'), "le SIREN du client manque");
    assert.ok(xml!.includes("<ram:GrandTotalAmount>2880.00</ram:GrandTotalAmount>"), "le total TTC n'est pas celui de la facture");
  });

  await test("un particulier garde le PDF verrouillé d'aujourd'hui, sans XML", async () => {
    const ctx = await contexte("particulier", "10 rue des Artisans 44000 Nantes");
    const { octets } = await pieceEmise(ctx, { nom: "Dupont", civilite: "mme", adresse: "3 allée des Pins, 44300 Nantes" });
    const { chiffre, xml } = await lire(octets);
    assert.equal(chiffre, true, "la facture d'un particulier a perdu son verrou");
    assert.equal(xml, null);
  });

  await test("une entreprise dont l'adresse ne se lit pas garde le PDF ordinaire, et la facture part", async () => {
    // L'adresse d'essai du dépôt, sans code postal : la règle refuse, et
    // c'est le PDF verrouillé qui s'archive au lieu de rien.
    const ctx = await contexte("sans-code-postal", null);
    const { octets } = await pieceEmise(ctx, {
      nom: "Syndic Les Tilleuls",
      civilite: "entreprise",
      siret: "98765432100014",
      adresse: "18 avenue de la Gare, 33000 Bordeaux",
    });
    const { chiffre, xml } = await lire(octets);
    assert.equal(chiffre, true);
    assert.equal(xml, null);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
