import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { basculerAcquittee } from "../src/server/repositories/paiements-facture";
import {
  creerEnvoiFacture,
  dernierEnvoiFacture,
  factureParJeton,
  jetonAcquitteVivant,
  pdfFactureParJeton,
  preparerEnvoiAcquitte,
} from "../src/server/repositories/envois-factures";
import { jourIso } from "../src/lib/jour";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";

// **L'EXEMPLAIRE ACQUITTÉ D'UNE FACTURE DÉJÀ PARTIE** — sa demande du
// 23 octobre 2026 (`appli/facture-acquittee.html`) : *« lorsque j'ai déjà
// envoyé la facture au client et que son assurance veut une facture
// acquittée, il faut pouvoir lui renvoyer la même facture avec la mention
// acquittée. Même numéro, tout pareil. »*
//
// **Le défaut d'avant, que la première épreuve tient** : le lien du client sert
// le PDF archivé à l'émission (`pdfFactureParJeton`). Noter le paiement puis
// renvoyer le SMS lui redonnait donc la facture SANS la mention, et aucune
// porte ne menait à un exemplaire acquitté.
//
// Sous le rôle applicatif, comme toute porte publique par jeton
// (`test-facture-jeton-rls.ts`) : le client n'a pas de session.

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
    { nom: "Atelier Acquitté" },
    { email: `acquittee-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function factureEmise(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Lala", telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Chez M. Lala",
    adresseChantier: "5 rue des Platanes",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de platanes", "100.00");
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  await emettreFacture(ctx, facture.id);
  return facture;
}

const texte = (octets: Uint8Array) => texteDuPdf(octets).replace(/\s+/g, " ");
// Le tampon est imprimé en capitales ESPACÉES (« A C Q U I T T É E L E … ») :
// on le cherche sans les espaces, sinon l'épreuve passerait au vert sur un
// tampon absent comme sur un tampon présent.
const TAMPON = /ACQUITTÉELE\d{2}\/\d{2}\/\d{4}/;

async function main() {
  await nettoyerBase();
  const ctx = await contexte("principal");
  const aujourdHui = jourIso(new Date());

  const facture = await factureEmise(ctx);
  const origine = await creerEnvoiFacture(ctx, facture.id, "sms");
  const pdfDOrigine = await pdfFactureParJeton(origine.jeton);

  await test("avant tout règlement, le lien du client sert la facture sans mention", async () => {
    assert.ok(pdfDOrigine, "le PDF d'origine n'est pas servi");
    assert.doesNotMatch(texte(pdfDOrigine.octets).replace(/ /g, ""), TAMPON);
  });

  await test("l'interrupteur, sur une facture partie, demande le moyen et ne l'invente pas", async () => {
    const r = await basculerAcquittee(ctx, facture.id, true, aujourdHui);
    assert.equal(r.ok, false, "un solde a été noté sans moyen de paiement");
  });

  await test("une facture non réglée ne prépare aucun exemplaire acquitté", async () => {
    const r = await preparerEnvoiAcquitte(ctx, facture.id, "sms");
    assert.equal(r.ok, false);
  });

  await test("allumé avec un chèque, le solde est noté au relevé", async () => {
    const r = await basculerAcquittee(ctx, facture.id, true, aujourdHui, "cheque");
    assert.ok(r.ok, r.ok ? "" : r.raison);
    assert.equal(r.reglements.length, 1);
    assert.equal(r.reglements[0].moyen, "cheque");
    assert.equal(r.reglements[0].solde, true);
    assert.equal(Number(r.reglements[0].montant), 120);
  });

  let jetonAcquitte = "";
  await test("l'exemplaire acquitté part sur son lien : même numéro, le tampon en plus", async () => {
    const r = await preparerEnvoiAcquitte(ctx, facture.id, "sms");
    assert.ok(r.ok, r.ok ? "" : r.raison);
    jetonAcquitte = r.jeton;
    assert.notEqual(r.jeton, origine.jeton, "l'exemplaire acquitté a pris le lien d'origine");
    const pdf = await pdfFactureParJeton(r.jeton);
    assert.ok(pdf, "le client n'ouvre pas son exemplaire acquitté");
    const t = texte(pdf.octets);
    assert.match(t.replace(/ /g, ""), TAMPON, "le PDF envoyé ne porte pas la mention acquittée");
    assert.ok(t.includes(facture.numeroCommercial), "le numéro de la facture a changé");
    assert.match(t, /chèque du \d{2}\/\d{2}\/\d{4}, 120,00/, "les montants versés ne sont pas imprimés");
    const vue = await factureParJeton(r.jeton);
    assert.equal(vue?.acquitteeLe, aujourdHui, "la page du client ne dit pas que la facture est acquittée");
  });

  await test("le lien d'origine sert toujours le fichier du premier envoi, octet pour octet", async () => {
    const pdf = await pdfFactureParJeton(origine.jeton);
    assert.ok(pdf && pdfDOrigine);
    assert.ok(Buffer.from(pdf.octets).equals(Buffer.from(pdfDOrigine.octets)), "la pièce d'origine a été réécrite");
    assert.equal((await factureParJeton(origine.jeton))?.acquitteeLe, null);
  });

  await test("un second appui reprend le même lien, et le lien d'origine reste le dernier envoi", async () => {
    const r = await preparerEnvoiAcquitte(ctx, facture.id, "email");
    assert.ok(r.ok);
    assert.equal(r.jeton, jetonAcquitte, "deux exemplaires acquittés pour les mêmes règlements");
    assert.equal(await jetonAcquitteVivant(ctx, facture.id), jetonAcquitte);
    assert.equal((await dernierEnvoiFacture(ctx, facture.id))?.jeton, origine.jeton);
  });

  await test("éteint, le solde repart et l'exemplaire ne vaut plus", async () => {
    const r = await basculerAcquittee(ctx, facture.id, false, aujourdHui);
    assert.ok(r.ok);
    assert.equal(r.reglements.length, 0);
    assert.equal(await jetonAcquitteVivant(ctx, facture.id), null);
    assert.equal((await preparerEnvoiAcquitte(ctx, facture.id, "sms")).ok, false);
  });

  await test("rallumé avec un autre moyen, un nouvel exemplaire, qui l'imprime", async () => {
    const b = await basculerAcquittee(ctx, facture.id, true, aujourdHui, "virement");
    assert.ok(b.ok);
    const r = await preparerEnvoiAcquitte(ctx, facture.id, "sms");
    assert.ok(r.ok);
    assert.notEqual(r.jeton, jetonAcquitte, "l'ancien exemplaire, payé par chèque, est reparti");
    const pdf = await pdfFactureParJeton(r.jeton);
    assert.ok(pdf);
    assert.match(texte(pdf.octets), /virement du \d{2}\/\d{2}\/\d{4}, 120,00/);
  });

  await test("le lien d'une entreprise n'ouvre pas l'exemplaire d'une autre", async () => {
    const autre = await contexte("voisine");
    const r = await preparerEnvoiAcquitte(autre, facture.id, "sms");
    assert.equal(r.ok, false, "une autre entreprise a préparé l'exemplaire de cette facture");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await fermerLimiteur();
  await pool.end();
  process.exit(1);
});
