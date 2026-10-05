import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { listerFichesClients } from "../src/server/repositories/fiche-client";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  genererPdfFacturePourApercu,
  getFacturePourChantier,
  majAutoliquidationFacture,
  majDateTravauxFacture,
  majLigneDeFacture,
  majTvaClientFacture,
  manquesDeLaFactureAEmettre,
  terminerChantier,
} from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, clients, entreprises } from "../src/server/db/schema";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";
import { mettreEnRegle } from "./_entreprise-en-regle";

// ═══════════════════════════════════════════════════════════════════════════
// LA FACTURE EN RÈGLE, EN BASE — ses choix du 3 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// La date des travaux (6A), la sous-traitance sans TVA et le numéro du
// donneur d'ordre retenu (5B), ce qui manque pour émettre (1A). Tout tourne
// sous `atlas_app`, comme chez lui : une écriture refusée par la RLS ne
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

async function contexte(suffixe: string, enRegle = true): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Jardins de l'Erdre" },
    { email: `en-regle-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  if (enRegle) await mettreEnRegle(ctx);
  return ctx;
}

/** Une facture directe, sur un chantier posé jeudi et vendredi derniers. */
async function factureDuChantier(ctx: Ctx, nom = "Jardins Ribault", adresse: string | null = "4 rue de la Garenne, Rezé") {
  // **Une entreprise** : la sous-traitance d'une facture sans devis ne s'offre
  // qu'à elle depuis le 4 octobre 2026.
  const client = await clientsRepo.creerClient(ctx, { nom, adresse: adresse ?? undefined, civilite: "entreprise" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: `Chez ${nom}`, clientId: client.id });
  // Posé par la base : l'application ne propose que des dates à venir, et un
  // chantier facturé est derrière soi.
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .update(chantiers)
      .set({ datePlanifiee: "2026-09-24", creneauDebut: "matin", dureeDemiJournees: 4 })
      .where(eq(chantiers.id, chantier.id))
  );
  const facture = await creerFactureSansDevis(ctx, chantier.id, new Date("2026-10-03T09:00:00Z"));
  return { client, chantier, facture };
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("principal");

  // ── 6A : LA DATE DES TRAVAUX ─────────────────────────────────────────────

  await test("la facture naît avec le dernier jour du planning", async () => {
    const { facture } = await factureDuChantier(ctx);
    assert.equal(facture.dateTravaux, "2026-09-25");
  });

  await test("il la change, et une date qui n'en est pas une se refuse avec ses mots", async () => {
    const { facture } = await factureDuChantier(ctx);
    const r = await majDateTravauxFacture(ctx, facture.id, "2026-09-26");
    assert.deepEqual(r, { ok: true, dateTravaux: "2026-09-26" });
    const faux = await majDateTravauxFacture(ctx, facture.id, "demain");
    assert.equal(faux.ok, false);
  });

  // ── 5B : LA SOUS-TRAITANCE, SANS TVA ─────────────────────────────────────

  await test("l'activer met la pièce sans TVA, lignes ajoutées et corrigées comprises", async () => {
    const { chantier, facture } = await factureDuChantier(ctx);
    const a = await ajouterLigneDeFacture(ctx, facture.id, "10.00");
    assert.ok(a.ok);
    await majLigneDeFacture(ctx, facture.id, a.ligne.id, { libelle: "Massifs", prixUnitaire: "1000" });

    const on = await majAutoliquidationFacture(ctx, facture.id, true);
    assert.ok(on.ok, on.ok ? "" : on.raison);
    let lue = (await getFacturePourChantier(ctx, chantier.id))!;
    assert.equal(lue.facture.tauxTva, "0.00");
    assert.deepEqual(lue.lignes.map((l) => l.tauxTva), ["0.00"]);

    // Pendant : une ligne neuve naît sans TVA, et un taux posé ne prend pas.
    const b = await ajouterLigneDeFacture(ctx, facture.id, "20.00");
    assert.ok(b.ok);
    assert.equal(b.ligne.tauxTva, "0.00");
    await majLigneDeFacture(ctx, facture.id, b.ligne.id, { tauxTva: "20.00" });
    lue = (await getFacturePourChantier(ctx, chantier.id))!;
    assert.deepEqual(lue.lignes.map((l) => l.tauxTva), ["0.00", "0.00"]);

    // L'enlever rend la ligne à 10 % à 10 %, et la neuve au taux de la facture.
    const off = await majAutoliquidationFacture(ctx, facture.id, false);
    assert.ok(off.ok);
    lue = (await getFacturePourChantier(ctx, chantier.id))!;
    assert.equal(lue.facture.tauxTva, facture.tauxTva);
    assert.deepEqual(lue.lignes.map((l) => l.tauxTva), ["10.00", null]);
  });

  await test("sans devis, la sous-traitance se refuse à un particulier", async () => {
    const client = await clientsRepo.creerClient(ctx, { nom: "Bernard", adresse: "Nantes", civilite: "mr" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chez Bernard", clientId: client.id });
    const facture = await creerFactureSansDevis(ctx, chantier.id);
    assert.equal((await majAutoliquidationFacture(ctx, facture.id, true)).ok, false);
  });

  await test("en franchise, le bouton se refuse", async () => {
    const franchise = await contexte("franchise");
    await entreprisesRepo.mettreAJourEntreprise(franchise, { regimeTva: "franchise" });
    const { facture } = await factureDuChantier(franchise);
    const r = await majAutoliquidationFacture(franchise, facture.id, true);
    assert.equal(r.ok, false);
  });

  await test("le numéro du donneur d'ordre est retenu sur sa fiche, et revient sur sa facture suivante", async () => {
    const { client, facture } = await factureDuChantier(ctx, "Paysages Lebrun");
    await majAutoliquidationFacture(ctx, facture.id, true);
    const r = await majTvaClientFacture(ctx, facture.id, "fr 12 345 678 901");
    assert.deepEqual(r, { ok: true, clientNumeroTva: "FR12345678901" });
    const [fiche] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select({ numeroTva: clients.numeroTva }).from(clients).where(eq(clients.id, client.id))
    );
    assert.equal(fiche?.numeroTva, "FR12345678901");

    // Un second chantier pour le même client : le numéro se reprend.
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Chez Lebrun, bis", clientId: client.id });
    const seconde = await creerFactureSansDevis(ctx, autre.id);
    const on = await majAutoliquidationFacture(ctx, seconde.id, true);
    assert.ok(on.ok);
    assert.equal(on.ok && on.clientNumeroTva, "FR12345678901");

    assert.equal((await majTvaClientFacture(ctx, facture.id, "12345")).ok, false);
  });

  await test("le papier : ni TVA ni 293 B, la mention, le numéro du client, la date des travaux", async () => {
    const { facture } = await factureDuChantier(ctx, "Jardins Ribault bis");
    const a = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(a.ok);
    await majLigneDeFacture(ctx, facture.id, a.ligne.id, { libelle: "Création de massifs", prixUnitaire: "1200" });
    await majAutoliquidationFacture(ctx, facture.id, true);
    await majTvaClientFacture(ctx, facture.id, "FR00123456789");

    // Les lignes du pied se coupent où la largeur le veut : on lit le texte d'un tenant.
    const texte = texteDuPdf(await genererPdfFacturePourApercu(ctx, facture.id)).replace(/\s+/g, " ");
    assert.match(texte, /Autoliquidation : TVA due par le preneur, article 283-2 nonies du CGI\./);
    assert.match(texte, /TVA intracommunautaire FR00123456789/);
    assert.match(texte, /TVA intracommunautaire FR12123456789/, "le numéro de l'artisan manque");
    assert.match(texte, /Travaux réalisés/);
    assert.match(texte, /25\/09\/2026/);
    assert.match(texte, /Total à payer/);
    assert.doesNotMatch(texte, /293 B/);
    assert.doesNotMatch(texte, /TVA 20/);

    const emise = await emettreFacture(ctx, facture.id, new Date("2026-10-03T10:00:00Z"));
    assert.equal(emise.totalTva, "0.00");
    assert.equal(emise.totalTtc, "1200.00");
    assert.equal(emise.autoliquidation, true);
  });

  // ── 1A : CE QUI MANQUE POUR ÉMETTRE ──────────────────────────────────────

  await test("une entreprise incomplète : ce qui manque se nomme", async () => {
    const nue = await contexte("nue", false);
    const { facture } = await factureDuChantier(nue);
    const cles = (await manquesDeLaFactureAEmettre(nue, facture.id)).map((m) => m.cle);
    assert.deepEqual(cles, ["adresse", "siret", "forme", "tva"]);
  });

  await test("l'adresse complétée sur la fiche du client lève le refus du brouillon", async () => {
    const { client, facture } = await factureDuChantier(ctx, "Mme Sans Adresse", null);
    assert.deepEqual((await manquesDeLaFactureAEmettre(ctx, facture.id)).map((m) => m.cle), ["client-adresse"]);
    await clientsRepo.mettreAJourClient(ctx, client.id, { adresse: "7 allée des Pins, Orvault" });
    assert.deepEqual(await manquesDeLaFactureAEmettre(ctx, facture.id), []);
    const emise = await emettreFacture(ctx, facture.id);
    assert.equal(emise.clientAdresse, "7 allée des Pins, Orvault", "la pièce est partie sans l'adresse");
  });

  await test("en sous-traitance sans numéro du donneur d'ordre, la facture ne part pas", async () => {
    const { facture } = await factureDuChantier(ctx, "Paysages Sans Numéro");
    await majAutoliquidationFacture(ctx, facture.id, true);
    assert.deepEqual((await manquesDeLaFactureAEmettre(ctx, facture.id)).map((m) => m.cle), ["tva-client"]);
  });

  // ── 4 OCTOBRE : MR, MME OU ENTREPRISE ──────────────────────────────────

  /** Un client Entreprise, son chantier, une ligne à 10 % et une ligne au taux du devis. */
  async function chantierEntreprise(nom = "Paysages Lebrun") {
    const client = await clientsRepo.creerClient(ctx, { nom, adresse: "12 allée des Chênes, Orvault" });
    await clientsRepo.mettreAJourClient(ctx, client.id, {
      civilite: "entreprise",
      siret: "812 345 678 00021",
      numeroTva: "FR00812345678",
    });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: `Chez ${nom}`, clientId: client.id });
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Création de massifs", "1000.00");
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille", "200.00", { tauxTva: "10.00" });
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    return { client, chantier, brouillon };
  }

  await test("Entreprise : le devis écrit le nom seul, avec son SIRET", async () => {
    const { brouillon } = await chantierEntreprise("Jardins Ribault");
    const brut = texteDuPdf(await devisRepo.genererPdfPourApercu(ctx, brouillon.id));
    const texte = brut.replace(/\s+/g, " ");
    // Le nom SEUL sur sa ligne : ni « Mr. », ni un mot fabriqué devant.
    assert.ok(
      brut.split("\n").some((l) => l.trim() === "Jardins Ribault"),
      "le bloc client n'écrit pas le nom seul"
    );
    assert.match(texte, /SIRET 812 345 678 00021/);
  });

  await test("la liste range l'entreprise derrière sa porte, et SARL y entre sans choix", async () => {
    await clientsRepo.creerClient(ctx, { nom: "Vert Bocage SARL" });
    await clientsRepo.creerClient(ctx, { nom: "Bernard" });
    const liste = await listerFichesClients(ctx);
    const de = (nom: string) => liste.find((c) => c.nom === nom)?.entreprise;
    assert.equal(de("Vert Bocage SARL"), true);
    assert.equal(de("Bernard"), false);
    // « Jardins Ribault » n'a aucun mot de société : seul son choix Entreprise le range à part.
    assert.ok(liste.some((c) => c.nom === "Jardins Ribault" && c.entreprise));
  });

  // ── 4 OCTOBRE : LE DEVIS EN SOUS-TRAITANCE (B, décoché d'office) ────────

  await test("décoché d'office ; refusé pour un particulier", async () => {
    const { chantier } = await chantierEntreprise("Lebrun décoché");
    const lu = await chantiersRepo.getChantier(ctx, chantier.id);
    assert.equal(lu?.autoliquidation, false, "la sous-traitance est cochée d'office");

    const client = await clientsRepo.creerClient(ctx, { nom: "Bernard" });
    const particulier = await chantiersRepo.creerChantier(ctx, { nom: "Chez Bernard", clientId: client.id });
    await prixRepo.ajouterLignePrix(ctx, particulier.id, "Taille", "100.00");
    await devisRepo.getOuCreerDevisBrouillon(ctx, particulier.id);
    assert.equal((await devisRepo.majAutoliquidationDevis(ctx, particulier.id, true)).ok, false);
  });

  await test("allumée : devis sans TVA, papier sans formulaire ; éteinte, la ligne à 10 % revient", async () => {
    const { chantier } = await chantierEntreprise("Lebrun allumé");
    const on = await devisRepo.majAutoliquidationDevis(ctx, chantier.id, true);
    assert.ok(on.ok, on.ok ? "" : on.raison);

    // Une ligne ajoutée « dans la catégorie à 20 % » pendant : aucun taux ne prend.
    const ajoutee = await prixRepo.ajouterLignePrix(ctx, chantier.id, "Paillage", "50.00", { tauxTva: "20.00" });
    assert.equal(ajoutee.tauxTva, null);

    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    assert.equal(d.autoliquidation, true);
    assert.equal(d.totalTva, "0.00");
    assert.equal(d.totalTtc, "1250.00");
    assert.equal(d.clientNumeroTva, "FR00812345678");
    const texte = texteDuPdf(await devisRepo.genererPdfPourApercu(ctx, d.id)).replace(/\s+/g, " ");
    assert.match(texte, /Autoliquidation : TVA due par le preneur/);
    assert.match(texte, /Total à payer/);
    assert.match(texte, /TVA intracommunautaire FR00812345678/);
    assert.doesNotMatch(texte, /FORMULAIRE DE RÉTRACTATION/, "un sous-traitant n'a pas les 14 jours");

    const off = await devisRepo.majAutoliquidationDevis(ctx, chantier.id, false);
    assert.ok(off.ok);
    const apres = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    assert.equal(apres.autoliquidation, false);
    assert.notEqual(apres.totalTva, "0.00");
    const lignes = await prixRepo.listerLignesPrix(ctx, chantier.id);
    assert.equal(lignes.find((l) => l.libelle === "Taille")?.tauxTva, "10.00", "la ligne à 10 % n'est pas revenue");
  });

  await test("la facture du devis en sous-traitance l'est aussi, et ne se rallume pas en TVA", async () => {
    const { chantier } = await chantierEntreprise("Lebrun facturé");
    await devisRepo.majAutoliquidationDevis(ctx, chantier.id, true);
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await devisRepo.envoyerDevis(ctx, d.id);
    const facture = await terminerChantier(ctx, chantier.id);
    assert.equal(facture.autoliquidation, true);
    assert.equal(facture.tauxTva, "0.00");
    assert.equal(facture.clientSiret, "812 345 678 00021");
    const off = await majAutoliquidationFacture(ctx, facture.id, false);
    assert.equal(off.ok, false, "la facture remet la TVA sur un prix accepté sans");
    const emise = await emettreFacture(ctx, facture.id);
    assert.equal(emise.totalTva, "0.00");
  });

  await test("la facture d'un devis avec TVA ne passe pas en sous-traitance : elle suit le devis", async () => {
    const { chantier } = await chantierEntreprise("Lebrun en direct");
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await devisRepo.envoyerDevis(ctx, d.id);
    const facture = await terminerChantier(ctx, chantier.id);
    assert.equal(facture.autoliquidation, false);
    assert.equal((await majAutoliquidationFacture(ctx, facture.id, true)).ok, false);
  });

  // ── LE CHECK-UP LÉGAL DU 4 OCTOBRE 2026 ──────────────────────────────────

  await test("le texte d'origine enregistré tel quel reste « celui d'Atlas », et suit ses corrections", async () => {
    // L'écran des réglages range le texte affiché en quittant le champ : rangé
    // en copie, il ne suivait plus les corrections du texte d'origine.
    await entreprisesRepo.mettreAJourEntreprise(ctx, { conditions: { conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES } });
    const [e] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select({ c: entreprises.conditionsGenerales }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId))
    );
    assert.equal(e!.c, null);
    // Le sien, même retouché d'un mot, reste le sien.
    const sien = TEXTE_ORIGINE_CONDITIONS_GENERALES.replace("1. Commande.", "1. Commande,");
    await entreprisesRepo.mettreAJourEntreprise(ctx, { conditions: { conditionsGenerales: sien } });
    const [f] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select({ c: entreprises.conditionsGenerales }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId))
    );
    assert.equal(f!.c, sien);
    await entreprisesRepo.mettreAJourEntreprise(ctx, { conditions: { conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES } });
  });

  // ── 5 OCTOBRE : L'ASSURANCE DÉCENNALE, SON CHOIX A ───────────────────────

  /** Les pages d'un PDF protégé : ses dictionnaires ne sont pas chiffrés, seuls ses textes. */
  const pages = (pdf: Uint8Array) => (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

  await test("l'attestation part en dernière page du devis et de la facture, avec l'adresse de l'assureur", async () => {
    const { brouillon, chantier } = await chantierEntreprise("Paysages Attestés");
    const devisPdf = await devisRepo.genererPdfPourApercu(ctx, brouillon.id);
    const texte = texteDuPdf(devisPdf).replace(/\s+/g, " ");
    assert.match(texte, /Assurance décennale : Assureur d'essai, 1 rue de l'Exemple, 44000 Nantes, contrat n° 0000000/);
    assert.match(texte, /Attestation d'assurance de responsabilité décennale \(essai\)/, "l'attestation manque au devis");
    assert.equal((await devisRepo.manquesDuDevisAEnvoyer(ctx, brouillon.id)).length, 0);

    const facture = await creerFactureSansDevis(ctx, (await chantiersRepo.creerChantier(ctx, { nom: "Bis", clientId: chantier.clientId! })).id);
    const a = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(a.ok);
    await majLigneDeFacture(ctx, facture.id, a.ligne.id, { libelle: "Massifs", prixUnitaire: "100" });
    const apercu = await genererPdfFacturePourApercu(ctx, facture.id);
    assert.match(texteDuPdf(apercu), /Attestation d'assurance de responsabilité décennale \(essai\)/, "l'attestation manque à la facture");
    const sans = await contexte("sans-attestation");
    await entreprisesRepo.mettreAJourEntreprise(sans, { attestationDecennale: null });
    const { facture: nue } = await factureDuChantier(sans, "Lebrun nu");
    const b = await ajouterLigneDeFacture(sans, nue.id);
    assert.ok(b.ok);
    await majLigneDeFacture(sans, nue.id, b.ligne.id, { libelle: "Massifs", prixUnitaire: "100" });
    assert.equal(pages(apercu), pages(await genererPdfFacturePourApercu(sans, nue.id)) + 1, "une page de plus, pas davantage");
  });

  await test("un assureur nommé sans attestation ni adresse : la pièce ne part pas", async () => {
    const sans = await contexte("assure-incomplet");
    await entreprisesRepo.mettreAJourEntreprise(sans, { attestationDecennale: null, adresseAssureurDecennale: "" });
    const { facture } = await factureDuChantier(sans, "Lebrun incomplet");
    const cles = (await manquesDeLaFactureAEmettre(sans, facture.id)).map((m) => m.cle);
    assert.deepEqual(cles, ["decennale-adresse", "decennale-attestation"]);
  });

  await test("une attestation illisible arrête la pièce au lieu de la laisser partir sans elle", async () => {
    const perdue = await contexte("attestation-perdue");
    await entreprisesRepo.mettreAJourEntreprise(perdue, {
      attestationDecennale: { cle: `entreprises/${perdue.entrepriseId}/attestation-decennale/absente.pdf`, mime: "application/pdf" },
    });
    const { facture } = await factureDuChantier(perdue, "Lebrun perdu");
    await assert.rejects(() => genererPdfFacturePourApercu(perdue, facture.id), /attestation d'assurance est illisible/);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
