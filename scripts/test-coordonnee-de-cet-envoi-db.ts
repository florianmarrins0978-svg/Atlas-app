import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { clients as clientsTable, envoisFactures } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { effacerClient } from "../src/server/repositories/donnees-client";
import {
  corrigerCanalEnvoiFacture,
  creerEnvoiFacture,
  situationDeLEnvoi,
} from "../src/server/repositories/envois-factures";
import type { Ctx } from "../src/server/repositories/context";
import { nettoyerBase } from "./_test-db";

/**
 * La facture d'un client SUPPRIMÉ part vers ce qu'il a tapé, pour cet envoi
 * seulement. Éprouvé SOUS LE RÔLE APPLICATIF (`atlas_app`), RLS comprise.
 *
 * Sa demande du 3 novembre 2026 : *« J'ai supprimé le client, mais je ne l'ai
 * pas encore facturé. […] il faut que je puisse écrire les coordonnées pour lui
 * envoyer la facture. »* Son choix : « Pour cet envoi seulement ». Rien ne
 * s'écrit sur la fiche supprimée ; la trace de l'envoi porte ce qui a servi.
 *
 * Les suites navigateur traversent la RLS (`CLAUDE.md` §5) : ce qui se prouve
 * ici, entre deux entreprises, ne se prouve nulle part ailleurs.
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

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Envoi" },
    { email: `envoi-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Une facture arrêtée, prête à partir ; son client supprimé avant, si demandé. */
async function factureArretee(ctx: Ctx, nom: string, { supprimer }: { supprimer: boolean }) {
  const client = await clientsRepo.creerClient(ctx, { nom, telephone: "0612345678", email: "ancien@exemple.fr" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: `Chez ${nom}`,
    adresseChantier: "5 rue des Lilas, Nantes",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille d'une haie", "600.00");
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  // **Son cas exact** : la facture en brouillon garde le client (§542), sa
  // fiche passe hors de la liste et perd ses coordonnées.
  if (supprimer) {
    const rapport = await effacerClient(ctx, client.id);
    assert.equal(rapport?.disparu, false, "le montage n'a pas gardé la fiche derrière sa facture : rien à mesurer");
  }
  await emettreFacture(ctx, facture.id);
  return { facture, clientId: client.id };
}

async function relireClient(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    return row ?? null;
  });
}

async function envoisDe(ctx: Ctx, factureId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ canal: envoisFactures.canal, destinataire: envoisFactures.destinataire })
      .from(envoisFactures)
      .where(and(eq(envoisFactures.factureId, factureId), eq(envoisFactures.entrepriseId, ctx.entrepriseId)))
  );
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");

  await test("son cas : client supprimé, facture pas encore partie, la case s'offre", async () => {
    const { facture } = await factureArretee(ctx, "Mme Vasseur", { supprimer: true });
    assert.deepEqual(await situationDeLEnvoi(ctx, facture.id), { clientSupprime: true, partie: false });
  });

  await test("un client vivant : la situation le dit, la case ne s'offre pas", async () => {
    const { facture } = await factureArretee(ctx, "M. Durand", { supprimer: false });
    assert.deepEqual(await situationDeLEnvoi(ctx, facture.id), { clientSupprime: false, partie: false });
  });

  await test("l'envoi part vers l'e-mail tapé, et la trace le porte", async () => {
    const { facture } = await factureArretee(ctx, "Mme Leroy", { supprimer: true });
    const envoi = await creerEnvoiFacture(ctx, facture.id, "email", new Date(), "  jean.leroy@exemple.fr ");
    assert.equal(envoi.canal, "email");
    assert.equal(envoi.destinataire, "jean.leroy@exemple.fr", "l'envoi ne rend pas la coordonnée employée");
    assert.deepEqual(
      await envoisDe(ctx, facture.id),
      [{ canal: "email", destinataire: "jean.leroy@exemple.fr" }],
      "la trace de l'envoi ne porte pas l'adresse vers laquelle il est parti"
    );
    // Partie, elle ne reprend plus de coordonnée tapée.
    assert.deepEqual(await situationDeLEnvoi(ctx, facture.id), { clientSupprime: true, partie: true });
  });

  await test("par SMS, le numéro tapé part en chiffres", async () => {
    const { facture } = await factureArretee(ctx, "M. Garnier", { supprimer: true });
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms", new Date(), "06 98 76 54 32");
    assert.equal(envoi.destinataire, "0698765432");
    assert.deepEqual(await envoisDe(ctx, facture.id), [{ canal: "sms", destinataire: "0698765432" }]);
  });

  await test("RIEN ne s'écrit sur la fiche supprimée", async () => {
    const { facture, clientId } = await factureArretee(ctx, "Mme Roux", { supprimer: true });
    const avant = await relireClient(ctx, clientId);
    assert.ok(avant?.deletedAt, "le montage n'a pas supprimé le client : rien à mesurer");
    await creerEnvoiFacture(ctx, facture.id, "email", new Date(), "roux@exemple.fr");
    const apres = await relireClient(ctx, clientId);
    assert.deepEqual(apres, avant, "la fiche du client supprimé a changé pendant l'envoi");
    assert.equal(apres?.email, null, "l'adresse tapée a été écrite sur la fiche supprimée");
    // Toujours hors de sa liste.
    const liste = await clientsRepo.listerClients(ctx);
    assert.ok(!liste.some((c) => c.id === clientId), "le client supprimé est revenu dans la liste");
  });

  await test("refus pour un client vivant : aucun envoi", async () => {
    const { facture } = await factureArretee(ctx, "M. Petit", { supprimer: false });
    await assert.rejects(
      creerEnvoiFacture(ctx, facture.id, "email", new Date(), "autre@exemple.fr"),
      /fiche/,
      "une coordonnée tapée a été acceptée pour un client qui a sa fiche"
    );
    assert.deepEqual(await envoisDe(ctx, facture.id), [], "un envoi est resté derrière le refus");
  });

  await test("refus d'une forme fausse : aucun envoi", async () => {
    const { facture } = await factureArretee(ctx, "Mme Faure", { supprimer: true });
    for (const [canal, saisie] of [
      ["email", "faure@"],
      ["sms", "85 45"],
      ["email", ""],
      ["sms", "faure@exemple.fr"],
    ] as const) {
      await assert.rejects(
        creerEnvoiFacture(ctx, facture.id, canal, new Date(), saisie),
        (e: Error) => e.message.length > 0,
        `« ${saisie} » a été accepté par ${canal}`
      );
    }
    assert.deepEqual(await envoisDe(ctx, facture.id), [], "un envoi est resté derrière un refus");
  });

  await test("une facture déjà partie refuse une seconde coordonnée tapée", async () => {
    const { facture } = await factureArretee(ctx, "M. Blanc", { supprimer: true });
    await creerEnvoiFacture(ctx, facture.id, "email", new Date(), "blanc@exemple.fr");
    await assert.rejects(creerEnvoiFacture(ctx, facture.id, "email", new Date(), "autre@exemple.fr"), /partie/);
    assert.deepEqual(await envoisDe(ctx, facture.id), [{ canal: "email", destinataire: "blanc@exemple.fr" }]);
  });

  await test("le chemin habituel ne note rien de plus : un client vivant garde son comportement", async () => {
    const { facture } = await factureArretee(ctx, "Mme Morel", { supprimer: false });
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");
    assert.equal(envoi.destinataire, null);
    assert.deepEqual(await envoisDe(ctx, facture.id), [{ canal: "sms", destinataire: null }]);
  });

  await test("un canal corrigé ne garde pas la coordonnée de l'autre canal", async () => {
    // Le registre dirait « SMS » avec une adresse e-mail : un mensonge tranquille,
    // celui qu'on découvre en cherchant une preuve d'envoi.
    const { facture } = await factureArretee(ctx, "M. Henry", { supprimer: true });
    const envoi = await creerEnvoiFacture(ctx, facture.id, "email", new Date(), "henry@exemple.fr");
    await corrigerCanalEnvoiFacture(ctx, envoi.id, "sms");
    assert.deepEqual(await envoisDe(ctx, facture.id), [{ canal: "sms", destinataire: null }]);
  });

  await test("une autre entreprise ne peut rien sur cette facture", async () => {
    const { facture } = await factureArretee(ctx, "Mme Colin", { supprimer: true });
    const autre = await contexte("b");
    assert.equal(await situationDeLEnvoi(autre, facture.id), null, "une autre entreprise lit la situation de cet envoi");
    await assert.rejects(
      creerEnvoiFacture(autre, facture.id, "email", new Date(), "intrus@exemple.fr"),
      /introuvable/i,
      "une autre entreprise a préparé l'envoi d'une facture qui n'est pas à elle"
    );
    assert.deepEqual(await envoisDe(ctx, facture.id), [], "un envoi est né chez une autre entreprise");
  });

  await pool.end();
  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
