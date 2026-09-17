import assert from "node:assert/strict";
import { Client } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { emettreFacture, terminerChantier } from "../src/server/repositories/factures";
import { facturesAvecPaiements, noterPaiement } from "../src/server/repositories/paiements-facture";
import {
  noterPaiementAction,
  retirerPaiementAction,
  soldeFactureAction,
} from "../src/app/termines/tva/actions";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

/**
 * QUAND LA BASE REFUSE UN RÈGLEMENT, L'ÉCRAN DOIT LE DIRE — sa capture du
 * 17 septembre 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Ce qu'il a vu :** « Ce règlement n'a pas pu être enregistré. Réessayez. »
 * sur une facture Martins de 745,00 €, dont 250,00 € déjà reçus, pour les
 * 495,00 € restants. Le montant était juste au centime — la règle l'accepte, et
 * `scripts/test-paiements-facture-db.ts` le prouve. Ce qui avait lâché, c'était
 * sa BASE : la fiche de son espace, écrite trois minutes plus tôt, portait
 * « état inconnu — la base n'a pas répondu ».
 *
 * **Et rien ne le disait.** Les trois actions de règlement laissaient
 * l'exception sortir : Next.js la remplace par un identifiant opaque
 * (`AGENTS.md`), l'écran retombait sur sa phrase de dernier recours, et
 * personne — ni lui, ni nous — n'apprenait que la base était en cause. Le
 * conseil rendu, « Réessayez », était même le mauvais : réessayer sur une base
 * qui ne répond pas ne donne rien.
 *
 * **Le mécanisme existait depuis le 13 septembre** (`src/lib/panne-de-base.ts`,
 * né de sa panne « Une erreur · Référence : 3285538552 ») ; il n'avait jamais
 * été branché sur l'écran des règlements. C'est ce que cette suite tient.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Le refus de la base est FABRIQUÉ, jamais imité** : on retire vraiment la
 * colonne qu'une migration a posée, comme sur un espace qui n'a pas rejoué ses
 * migrations. Un contrôle qui se contenterait d'une erreur inventée ne dirait
 * rien du chemin réel (`test-creer-son-compte-e2e.ts`, même technique).
 */

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/**
 * Le rôle propriétaire : `atlas_app` n'a délibérément aucun droit de DDL.
 *
 * **Tout ce qui passe par ici est idempotent**, et le `finally` ne suffit pas à
 * l'expliquer : une suite tuée au délai (`run-all-tests.ts`, huit minutes)
 * n'exécute aucun `finally`, et laisserait la base amputée pour les soixante
 * suites suivantes — qui accuseraient alors le produit (`CLAUDE.md` §5, la
 * demi-heure du 26 août 2026). La remise d'aplomb se rejoue donc au DÉBUT.
 */
async function surLaBase(sql: string) {
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

const AMPUTER = 'ALTER TABLE "paiements_facture" DROP COLUMN IF EXISTS "numero"';
const RENDRE_LA_COLONNE = 'ALTER TABLE "paiements_facture" ADD COLUMN IF NOT EXISTS "numero" text';
const RETIRER_LE_DROIT = 'REVOKE DELETE ON "paiements_facture" FROM atlas_app';
const RENDRE_LE_DROIT = 'GRANT DELETE ON "paiements_facture" TO atlas_app';

const EMISSION = new Date("2026-09-09T09:00:00Z");

/** Sa facture : 745,00 € TTC, émise le 09/09, 250,00 € déjà reçus le 17/09. */
async function saFacture(ctx: { utilisateurId: string; entrepriseId: string }) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Martins", telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie du fond", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille", "620.83");
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  const brouillon = await terminerChantier(ctx, chantier.id, EMISSION);
  const facture = await emettreFacture(ctx, brouillon.id, EMISSION);
  await noterPaiement(ctx, facture.id, { date: "2026-09-17", montant: "250" });
  return facture;
}

async function main() {
  // Une suite tuée au délai n'a rien remis d'aplomb : on le fait en arrivant.
  await surLaBase(RENDRE_LA_COLONNE);
  await surLaBase(RENDRE_LE_DROIT);
  await nettoyerBase();
  console.log("=== Un règlement refusé par la base ===\n");

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Martins" },
    { email: `reglement-panne-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;

  const facture = await saFacture(ctx);
  const [enAttente] = await facturesAvecPaiements(ctx);
  const paiementId = enAttente.paiements[0].id;

  await cas("UN REFUS MÉTIER GARDE SES MOTS — l'enveloppe ne les remplace pas", async () => {
    // Le cas vert de cette suite, et il passe par l'ACTION : sans lui, une
    // enveloppe qui rendrait « la base a refusé » à tout propos serait verte
    // partout ailleurs. « Il ne reste que 495,00 € » doit lui parvenir mot pour
    // mot — c'est ce que l'en-tête de `actions.ts` exige déjà.
    const r = await noterPaiementAction(facture.id, "2026-09-17", "600");
    assert.equal(r.ok, false, "un montant plus grand que le reste dû a été accepté");
    assert.match(r.ok ? "" : r.raison, /Il ne reste que 495\.00 € à recevoir/);
  });

  await cas("son cas, base saine : 495,00 € sur 745,00 € dont 250,00 € reçus, c'est accepté", async () => {
    // Par le dépôt et non par l'action : `revalidatePath` exige un contexte de
    // requête que ce script n'a pas, et c'est la seule chose qui manque ici. Ce
    // que ce cas défend est la RÈGLE — son montant était juste au centime.
    assert.equal(enAttente.reste, "495.00");
    const r = await noterPaiement(ctx, facture.id, { date: "2026-09-17", montant: "495" });
    assert.ok(r.ok, `la règle a refusé un montant juste : ${r.ok ? "" : r.raison}`);
    assert.equal(r.ok ? r.reste : "", "0.00");
  });

  // Tout ce qui suit se joue sur une base à qui il manque une colonne posée par
  // la migration 0092 — l'état exact d'un espace qui n'a pas rejoué ses
  // migrations. `noterPaiement` lit la table entière avant d'écrire : la
  // lecture part alors sur `42703`, « colonne inconnue ».
  await surLaBase(AMPUTER);
  try {
    await cas("LA PANNE REVIENT EN VALEUR — elle ne traverse plus l'action", async () => {
      // Levée, elle devient un identifiant opaque chez lui et l'écran n'a plus
      // que sa phrase de dernier recours à opposer (`AGENTS.md`).
      const r = await noterPaiementAction(facture.id, "2026-09-17", "10").catch((e) => {
        throw new Error(`l'exception est sortie de l'action : ${e instanceof Error ? e.message : String(e)}`);
      });
      assert.equal(r.ok, false, "la base refuse et l'action rend pourtant un succès");
    });

    await cas("ELLE NOMME LA BASE, et donne le geste SÛR — jamais reconstruire ni supprimer", async () => {
      const r = await noterPaiementAction(facture.id, "2026-09-17", "10");
      assert.equal(r.ok, false);
      const raison = r.ok ? "" : r.raison;
      assert.ok(
        /pas à jour avec sa base|en cours de mise à jour/.test(raison),
        `le refus ne nomme pas la base : « ${raison} »`
      );
      // `CLAUDE.md` §4 septies : aucun geste qui puisse effacer ses chantiers.
      for (const interdit of ["reconstru", "supprim", "rebuild", "seed", "amorc", "efface", "vider"]) {
        assert.ok(!raison.toLowerCase().includes(interdit), `le geste proposé contient « ${interdit} » : ${raison}`);
      }
    });

    await cas("ET ELLE PARLE DU RÈGLEMENT, pas de la création d'un compte", async () => {
      // La phrase est née pour l'écran « Créer mon compte » : branchée sans
      // précaution, elle lui annoncerait ici que son COMPTE n'a pas pu être créé.
      const r = await noterPaiementAction(facture.id, "2026-09-17", "10");
      assert.ok(!/compte/i.test(r.ok ? "" : r.raison), `la phrase parle d'un compte : « ${r.ok ? "" : r.raison} »`);
    });

    await cas("« J'ai reçu le paiement » suit la même règle", async () => {
      const r = await soldeFactureAction(facture.id, "2026-09-17").catch((e) => {
        throw new Error(`l'exception est sortie de l'action : ${e instanceof Error ? e.message : String(e)}`);
      });
      assert.equal(r.ok, false, "la base refuse et l'action rend pourtant un succès");
      assert.ok(/pas à jour avec sa base|en cours de mise à jour/.test(r.ok ? "" : r.raison));
    });
  } finally {
    await surLaBase(RENDRE_LA_COLONNE);
  }

  // Le retrait n'écrit aucune colonne : c'est le DROIT qu'on lui retire, l'état
  // d'une base dont les `GRANT` d'une migration ne sont pas passés (`42501`).
  await surLaBase(RETIRER_LE_DROIT);
  try {
    await cas("LE RETRAIT AUSSI SE DIT — il échouait sans un mot à l'écran", async () => {
      // Il rendait `void` : l'écran ne pouvait rien montrer, la ligne restait
      // en place, et il réappuyait sur une croix qui ne faisait rien.
      const r = await retirerPaiementAction(paiementId).catch((e) => {
        throw new Error(`l'exception est sortie de l'action : ${e instanceof Error ? e.message : String(e)}`);
      });
      assert.ok(r && typeof r === "object" && "ok" in r, "le retrait ne rend toujours rien à l'écran");
      assert.equal(r.ok, false, "la base refuse et l'action rend pourtant un succès");
      assert.ok(
        /pas à jour avec sa base|en cours de mise à jour/.test(r.ok ? "" : r.raison),
        `le refus ne nomme pas la base : « ${r.ok ? "" : r.raison} »`
      );
    });
  } finally {
    await surLaBase(RENDRE_LE_DROIT);
  }

  await cas("base remise d'aplomb, plus personne n'accuse la base", async () => {
    // Le droit rendu, le même geste ne doit plus parler de mise à jour : un
    // avertissement qui parle à tort s'apprend à être ignoré (`CLAUDE.md` §4 ter).
    const r = await noterPaiementAction(facture.id, "2026-09-17", "600");
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.ok ? "" : r.raison, /pas à jour avec sa base|en cours de mise à jour/);
  });

  console.log(`\nUn règlement refusé par la base — ${echecs} échec(s).`);
  await pool.end();
  await fermerLimiteur();
  if (echecs > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  await fermerLimiteur().catch(() => undefined);
  process.exit(1);
});
