import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { creerEnvoiFacture, factureParJeton, pdfFactureParJeton } from "../src/server/repositories/envois-factures";
import { creerEnvoi, lireParJeton, pdfDevisParJeton } from "../src/server/repositories/envois-devis";
import { jourIso } from "../src/lib/jour";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **La facture que le client ouvre, éprouvée SOUS LE RÔLE APPLICATIF.**
//
// Le 8 août 2026, en cherchant tout autre chose : le lien de facture envoyé au
// client répondait « ce lien n'est plus valable » sur une facture parfaitement
// valide. Toute la branche « envoi de la facture » était morte en production.
//
// La cause : `envois_factures` porte une politique de lecture par jeton,
// `factures` n'en porte pas — elle reste protégée par l'isolation d'entreprise.
// Retrouver l'envoi marchait donc, lire la facture derrière ne marchait pas.
// Le correctif pose le contexte d'entreprise **déduit du jeton**, comme le fait
// déjà la page du devis.
//
// **Pourquoi aucune suite ne l'avait vu, et c'est le vrai enseignement.**
// `test-facture-au-client-e2e.ts` parcourt exactement ce chemin, dans un
// navigateur, et il était vert. Mais les suites navigateur démarrent leur
// serveur sous un rôle qui **traverse la RLS**, parce qu'elles inspectent la
// base pour vérifier ce qu'elles affirment. Elles ne peuvent donc pas, par
// construction, voir un défaut d'isolation.
//
// C'est la règle de `CLAUDE.md` §5 dans sa version la plus coûteuse : un
// environnement de vérification qui diffère du vrai ne vérifie pas ce qu'on
// croit. **Tout chemin public par jeton doit être éprouvé ici**, sous
// `atlas_app`, et non seulement au navigateur.

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
    { nom: "Atelier Jeton" },
    { email: `jeton-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Une facture émise, prête à partir chez le client. */
async function factureEmise(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Costa", telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Chez Mme Costa",
    adresseChantier: "5 rue des Lilas",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Abattage d'un chêne mort", "1000.00");
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  await emettreFacture(ctx, facture.id);
  return facture;
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("rls");

  await test("le client ouvre sa facture avec son jeton, sous le rôle applicatif", async () => {
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");

    // **Aucun contexte d'entreprise ici, et c'est tout le sujet** : le client
    // n'a pas de session. Seul son jeton doit suffire.
    const vue = await factureParJeton(envoi.jeton);
    assert.ok(
      vue,
      "le client lit « ce lien n'est plus valable » sur une facture valide — " +
        "la lecture de `factures` est bloquée par l'isolation d'entreprise"
    );
    assert.equal(vue.numeroCommercial, facture.numeroCommercial);
    assert.ok(Number(vue.totalTtc) > 0, "le montant ne parvient pas au client");
    assert.ok(vue.entrepriseNom.length > 0, "le client ne sait pas de qui vient la facture");
  });

  await test("le PDF archivé lui parvient par le même jeton", async () => {
    // La page et le PDF passent par deux fonctions distinctes : corriger l'une
    // sans l'autre laisserait le client devant un document introuvable après
    // avoir vu sa facture à l'écran.
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");

    const pdf = await pdfFactureParJeton(envoi.jeton);
    assert.ok(pdf, "le PDF de la facture n'est pas servi au porteur du jeton");
    assert.ok(pdf.octets.length > 1000, `PDF suspect : ${pdf.octets.length} octets`);
    assert.match(pdf.nom, /\.pdf$/);
  });

  await test("un jeton inconnu ne donne rien, et ne dit pas pourquoi", async () => {
    // Le correctif pose un contexte d'entreprise : il ne doit surtout pas
    // ouvrir une porte à qui n'a pas de jeton valide.
    assert.equal(await factureParJeton("jeton-qui-n-existe-pas"), null);
    assert.equal(await factureParJeton(""), null);
    assert.equal(await pdfFactureParJeton("jeton-qui-n-existe-pas"), null);
  });

  await test("un jeton expiré ne donne rien non plus", async () => {
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");
    const bienPlusTard = new Date(envoi.expireAt.getTime() + 1000);
    assert.equal(await factureParJeton(envoi.jeton, bienPlusTard), null);
    assert.equal(await pdfFactureParJeton(envoi.jeton, bienPlusTard), null);
  });

  await test("le jeton d'une entreprise n'ouvre pas la facture d'une autre", async () => {
    // Le contrôle qui rend le correctif défendable : le contexte posé vient du
    // jeton, donc il n'emmène que là où ce jeton mène.
    const autre = await contexte("voisine");
    const factureA = await factureEmise(ctx);
    const factureB = await factureEmise(autre);
    const envoiA = await creerEnvoiFacture(ctx, factureA.id, "sms");

    const vue = await factureParJeton(envoiA.jeton);
    assert.ok(vue);
    assert.equal(vue.numeroCommercial, factureA.numeroCommercial);
    assert.notEqual(
      vue.numeroCommercial,
      factureB.numeroCommercial,
      "le jeton d'une entreprise a ouvert la facture d'une autre"
    );
  });

  await test("le client télécharge aussi le PDF de son DEVIS", async () => {
    // **Le même défaut, sur le chemin le plus important.** La page du devis
    // s'affichait — `lireParJeton` pose bien le contexte — mais le
    // téléchargement du PDF renvoyait le client vers « ce lien n'est plus
    // valable ». Or c'est ce que `docs/A-FAIRE.md` §5 lui promet : « il voit
    // son devis, télécharge le PDF s'il le veut ».
    //
    // Deux fonctions voisines, un correctif appliqué à l'une : c'est
    // exactement le genre d'oubli que ce contrôle existe pour attraper.
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", telephone: "0612345678" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chez M. Faucher", clientId: client.id });
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "600.00");
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    // `envoyerDevis` archive le PDF au passage : c'est la pièce que le client
    // recevra, et elle ne se régénère jamais.
    await devisRepo.envoyerDevis(ctx, brouillon.id);

    const dans7Jours = new Date();
    dans7Jours.setDate(dans7Jours.getDate() + 7);
    const envoi = await creerEnvoi(ctx, {
      chantierId: chantier.id,
      devisId: brouillon.id,
      canal: "sms",
      datesProposees: [jourIso(dans7Jours)],
      contenuDevis: "Taille de haie",
    });

    assert.ok(await lireParJeton(envoi.jeton), "la page du devis ne s'ouvre pas");
    const pdf = await pdfDevisParJeton(envoi.jeton);
    assert.ok(pdf, "le client ne peut pas télécharger le PDF de son devis");
    assert.ok(pdf.octets.length > 1000, `PDF suspect : ${pdf.octets.length} octets`);
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
