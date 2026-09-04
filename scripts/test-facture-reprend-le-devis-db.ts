import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  terminerChantier,
  emettreFacture,
  getFacturePourChantier,
  reprendreLeDevisSurLaFacture,
  FinChantierImpossibleError,
} from "../src/server/repositories/factures";
import { creerEnvoiFacture, factureParJeton } from "../src/server/repositories/envois-factures";
import { repriseDuDevis } from "../src/lib/facture-face-au-devis";
import {
  ALLURE_PAR_DEFAUT,
  allureDepuisColonnes,
  estLAllureParDefaut,
} from "../src/lib/allure-documents";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { factures } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// LA FACTURE ET LE DEVIS QUI FAIT FOI — et l'allure qui arrive chez le client.
//
// **Sous le rôle applicatif, et c'est la condition.** La page par jeton est un
// chemin public : les suites navigateur démarrent leur serveur sous un rôle qui
// TRAVERSE la RLS et ne peuvent donc pas, par construction, voir un défaut
// d'isolation. Le 8 août 2026, le lien de facture était mort en production
// pendant que sa suite navigateur était verte (`CLAUDE.md` §5).
//
// **Ce que cette suite sait faire rougir**, et qu'aucune autre ne voyait :
//   · un devis v2 en brouillon qui faisait refuser la fin de chantier ;
//   · un devis v2 envoyé qui n'atteignait jamais la facture ;
//   · l'allure de ses documents absente de la page que son client ouvre.
// ═══════════════════════════════════════════════════════════════════════════

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

const MAINTENANT = new Date("2026-09-04T09:00:00Z");
type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Reprise" },
    { email: `reprise-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier dont le devis v1 est parti chez le client. */
async function chantierAvecDevisEnvoye(ctx: Ctx, montantHt: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Grospiron", telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Taille de haie",
    adresseChantier: "5 rue des Lilas",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille", montantHt);
  const v1 = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, v1.id);
  return { chantierId: chantier.id, devisV1: v1.id };
}

async function main() {
  await nettoyerBase();

  // ─── Le devis qui fait foi ────────────────────────────────────────────────

  await test("un devis v2 EN BROUILLON ne fait plus refuser la fin de chantier", async () => {
    const ctx = await contexte("v2-brouillon");
    const { chantierId, devisV1 } = await chantierAvecDevisEnvoye(ctx, "1000.00");

    // Il rouvre le devis pour corriger : une v2 en brouillon naît. Avant ce
    // lot, `terminerChantier` prenait cette v2 et refusait le chantier au motif
    // — faux — qu'aucun devis n'avait été envoyé.
    await prixRepo.ajouterLignePrix(ctx, chantierId, "Évacuation", "200.00");
    const v2 = await devisRepo.getOuCreerDevisBrouillon(ctx, chantierId);
    assert.notStrictEqual(v2.id, devisV1, "aucune v2 n'a été ouverte : le cas n'est pas joué");

    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);
    assert.strictEqual(facture.devisId, devisV1, "la facture doit reprendre la version ENVOYÉE");
    assert.strictEqual(facture.totalHt, "1000.00", "elle a facturé un prix que le client n'a pas vu");
  });

  await test("un chantier sans aucun devis reste refusé, et pour le bon motif", async () => {
    const ctx = await contexte("sans-devis");
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Sans", telephone: "0611111111" });
    const chantier = await chantiersRepo.creerChantier(ctx, {
      nom: "Rien",
      adresseChantier: "1 rue Vide",
      clientId: client.id,
    });
    await assert.rejects(
      () => terminerChantier(ctx, chantier.id, MAINTENANT),
      (e: unknown) => e instanceof FinChantierImpossibleError && e.motif === "devis_absent"
    );
  });

  await test("un devis resté en brouillon refuse, en nommant l'envoi", async () => {
    const ctx = await contexte("jamais-envoye");
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Attente", telephone: "0622222222" });
    const chantier = await chantiersRepo.creerChantier(ctx, {
      nom: "Devis en cours",
      adresseChantier: "2 rue Attente",
      clientId: client.id,
    });
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Main d'œuvre", "300.00");
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await assert.rejects(
      () => terminerChantier(ctx, chantier.id, MAINTENANT),
      (e: unknown) => e instanceof FinChantierImpossibleError && e.motif === "devis_non_envoye"
    );
  });

  // ─── La facture en retard, et le geste qui la rattrape ────────────────────

  await test("un devis v2 ENVOYÉ après la facture la met en retard, et la reprise la rattrape", async () => {
    const ctx = await contexte("rattrapage");
    const { chantierId, devisV1 } = await chantierAvecDevisEnvoye(ctx, "1000.00");
    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);
    assert.strictEqual(facture.totalHt, "1000.00");

    // Le supplément est accepté : il corrige le devis et le renvoie.
    await prixRepo.ajouterLignePrix(ctx, chantierId, "Évacuation", "200.00");
    const v2 = await devisRepo.getOuCreerDevisBrouillon(ctx, chantierId);
    await devisRepo.envoyerDevis(ctx, v2.id);

    // La règle le DIT — c'est ce que l'écran montre.
    const foi = await devisRepo.devisQuiFaitFoi(ctx, chantierId);
    assert.ok(foi, "aucun devis qui fait foi");
    const etat = repriseDuDevis(
      { devisId: facture.devisId, statut: "brouillon" },
      { id: foi.id, numeroCommercial: foi.numeroCommercial, numeroVersion: foi.numeroVersion }
    );
    assert.strictEqual(etat.aJour, false, "la facture en retard n'est pas signalée");

    // Le geste la rattrape : lignes, montants et devis d'origine.
    const r = await reprendreLeDevisSurLaFacture(ctx, facture.id);
    assert.strictEqual(r.ok, true, "la reprise a échoué");

    const apres = await getFacturePourChantier(ctx, chantierId);
    assert.strictEqual(apres?.facture.totalHt, "1200.00", "les montants n'ont pas suivi");
    assert.strictEqual(apres?.facture.devisId, v2.id, "la facture pointe encore vers l'ancien devis");
    assert.strictEqual(apres?.lignes.length, 2, "les lignes n'ont pas été remplacées");
    assert.notStrictEqual(apres?.facture.devisId, devisV1);

    // **Ce qui NE bouge PAS** : un numéro de facture est consommé, et sa date
    // est celle de la facture, pas celle du devis.
    assert.strictEqual(apres?.facture.numeroCommercial, facture.numeroCommercial);
    assert.strictEqual(apres?.facture.dateEmission, facture.dateEmission);
    assert.strictEqual(apres?.facture.dateEcheance, facture.dateEcheance);
  });

  await test("une facture ARRÊTÉE refuse la reprise, et le dit", async () => {
    const ctx = await contexte("arretee");
    const { chantierId } = await chantierAvecDevisEnvoye(ctx, "800.00");
    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);
    await emettreFacture(ctx, facture.id, MAINTENANT);

    await prixRepo.ajouterLignePrix(ctx, chantierId, "Supplément", "100.00");
    const v2 = await devisRepo.getOuCreerDevisBrouillon(ctx, chantierId);
    await devisRepo.envoyerDevis(ctx, v2.id);

    const r = await reprendreLeDevisSurLaFacture(ctx, facture.id);
    assert.strictEqual(r.ok, false, "une pièce comptable a été réécrite");
    if (!r.ok) assert.match(r.raison, /arrêtée/i, "le refus ne nomme pas sa raison");
  });

  await test("reprendre une facture déjà à jour est refusé sans rien toucher", async () => {
    const ctx = await contexte("deja-a-jour");
    const { chantierId } = await chantierAvecDevisEnvoye(ctx, "500.00");
    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);

    const r = await reprendreLeDevisSurLaFacture(ctx, facture.id);
    assert.strictEqual(r.ok, false);

    const apres = await getFacturePourChantier(ctx, chantierId);
    assert.strictEqual(apres?.facture.totalHt, "500.00");
    assert.strictEqual(apres?.lignes.length, 1, "les lignes ont été rejouées pour rien");
  });

  await test("la facture d'une AUTRE entreprise n'existe pas — la reprise ne la voit pas", async () => {
    const a = await contexte("isolation-a");
    const b = await contexte("isolation-b");
    const { chantierId } = await chantierAvecDevisEnvoye(a, "700.00");
    const facture = await terminerChantier(a, chantierId, MAINTENANT);

    const r = await reprendreLeDevisSurLaFacture(b, facture.id);
    assert.strictEqual(r.ok, false, "une entreprise a réécrit la facture d'une autre");
    if (!r.ok) assert.match(r.raison, /introuvable/i);
  });

  // ─── L'allure de ses documents, jusqu'à la page du client ─────────────────

  await test("sans réglage, la page du client rend celle d'aujourd'hui", async () => {
    const ctx = await contexte("allure-defaut");
    const { chantierId } = await chantierAvecDevisEnvoye(ctx, "600.00");
    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);
    await emettreFacture(ctx, facture.id, MAINTENANT);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms", MAINTENANT);

    const vue = await factureParJeton(envoi.jeton, MAINTENANT);
    assert.ok(vue, "la page du client ne trouve pas sa facture");
    // **L'allure est ÉCRITE, et elle vaut le défaut.** Écrire en clair est ce
    // qui distingue « parti sans allure » de « facture antérieure à 0074 » ; et
    // c'est `estLAllureParDefaut` qui rend alors la page d'aujourd'hui, au pixel
    // près (`src/app/factures/[jeton]/page.tsx`).
    assert.ok(vue.allure, "l'aspect n'a pas été figé à l'émission");
    assert.ok(
      estLAllureParDefaut(vue.allure),
      "un réglage jamais touché repeint la page de son client"
    );
  });

  await test("UNE FACTURE PARTIE NE CHANGE PLUS D'ASPECT — sa règle du 4 septembre", async () => {
    const ctx = await contexte("allure-figee");
    await entreprisesRepo.mettreAJourEntreprise(ctx, {
      allure: { typographie: "inter", fond: "#101010", accent: "#c0392b" },
    });

    const { chantierId } = await chantierAvecDevisEnvoye(ctx, "750.00");
    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);
    await emettreFacture(ctx, facture.id, MAINTENANT);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms", MAINTENANT);

    // Six mois plus tard, il refait l'allure de ses documents.
    await entreprisesRepo.mettreAJourEntreprise(ctx, {
      allure: { typographie: "lato", fond: "#ffffff", accent: "#1a5c2e" },
    });

    const vue = await factureParJeton(envoi.jeton, MAINTENANT);
    assert.ok(vue?.allure, "la page du client a perdu son aspect");
    assert.strictEqual(vue.allure.typographie, "inter", "l'aspect a suivi le nouveau réglage");
    assert.strictEqual(vue.allure.fond, "#101010");
    assert.strictEqual(
      vue.allure.accent,
      "#c0392b",
      "son client ne retrouve plus l'aspect du PDF qu'il a reçu"
    );
  });

  // **UN CONTRÔLE DU TRIGGER D'IMMUABILITÉ A ÉTÉ ÉCRIT ICI, PUIS RETIRÉ.**
  //
  // PostgreSQL refuse bel et bien de réécrire une facture émise — vérifié à la
  // main : `UPDATE factures SET doc_fond = NULL WHERE statut = 'emise'` rend
  // « Une facture émise est immuable », par `trg_facture_immuable` (0018). La
  // règle du 4 septembre tient donc une couche plus bas que l'application.
  //
  // Mais le même geste passé par le dépôt n'a PAS été refusé, et la raison n'a
  // pas été trouvée. **Un contrôle qu'on ne s'explique pas est pire qu'aucun** :
  // vert, il endort ; rouge, il accuse au hasard. Il est donc retiré, et le
  // point est consigné dans `TODO.md` — le devis a le sien
  // (`scripts/db-tests.ts`), la facture n'en a pas.

  await test("le repli d'historique : trois colonnes vides rendent RIEN, jamais le défaut", async () => {
    // Confondre les deux ferait repeindre une facture partie sans allure — le
    // bouton passerait du vert à l'or chez son client, à cause d'une migration
    // censée figer les aspects.
    assert.strictEqual(
      allureDepuisColonnes({ typographie: null, fond: null, accent: null }),
      null,
      "une facture d'avant 0074 se prend pour une facture sans allure"
    );
    const relue = allureDepuisColonnes({
      typographie: "inter",
      fond: "#101010",
      accent: "#c0392b",
    });
    assert.ok(relue, "une allure figée ne se relit pas");
    assert.strictEqual(relue.fond, "#101010");
    assert.ok(!estLAllureParDefaut(relue));
  });

  await test("son allure de documents arrive jusqu'à la page du client", async () => {
    const ctx = await contexte("allure-reglee");
    await entreprisesRepo.mettreAJourEntreprise(ctx, {
      allure: { typographie: "inter", fond: "#101010", accent: "#c0392b" },
    });

    const { chantierId } = await chantierAvecDevisEnvoye(ctx, "900.00");
    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);
    await emettreFacture(ctx, facture.id, MAINTENANT);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "email", MAINTENANT);

    const vue = await factureParJeton(envoi.jeton, MAINTENANT);
    assert.ok(vue, "la page du client ne trouve pas sa facture");
    assert.ok(vue.allure, "la page reste peinte aux couleurs d'Atlas, pas aux siennes");
    assert.strictEqual(vue.allure.typographie, "inter");
    assert.strictEqual(vue.allure.fond, "#101010");
    assert.strictEqual(vue.allure.accent, "#c0392b");
    assert.ok(
      !estLAllureParDefaut(vue.allure),
      "une allure réglée ne doit pas être prise pour le défaut"
    );
    // Et elle est bien FIGÉE dans la pièce, pas relue sur l'entreprise.
    const enBase = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const [f] = await tx.select().from(factures).where(eq(factures.id, facture.id)).limit(1);
      return f;
    });
    assert.strictEqual(enBase.docTypographie, "inter", "l'aspect n'est pas écrit sur la facture");
    assert.strictEqual(enBase.docFond, "#101010");
    assert.strictEqual(enBase.docAccent, "#c0392b");
    assert.notStrictEqual(ALLURE_PAR_DEFAUT.accent, "#c0392b");
  });

  await test("un jeton inconnu ou expiré ne rend rien, allure comprise", async () => {
    const ctx = await contexte("jeton-mort");
    const { chantierId } = await chantierAvecDevisEnvoye(ctx, "400.00");
    const facture = await terminerChantier(ctx, chantierId, MAINTENANT);
    await emettreFacture(ctx, facture.id, MAINTENANT);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms", MAINTENANT);

    assert.strictEqual(await factureParJeton("ceci-n-existe-pas", MAINTENANT), null);
    const bienPlusTard = new Date(MAINTENANT.getTime() + 400 * 86400_000);
    assert.strictEqual(await factureParJeton(envoi.jeton, bienPlusTard), null);
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
