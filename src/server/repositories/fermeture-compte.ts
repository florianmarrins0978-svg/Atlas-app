import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import {
  abonnements,
  clients,
  entreprises,
  fichiersAPurger,
  liaisonsBancaires,
  messagesAssistant,
  photosDiagnostic,
} from "../db/schema";
import {
  JOURS_AVANT_EFFACEMENT,
  etatDeLaFermeture,
  resteAEffacer,
  type EtatFermeture,
  type Fermeture,
} from "@/lib/fermeture-compte";
import { effacerChantiersSansClientDans, effacerClientDans } from "./donnees-client";
import { logger } from "../logger";
import type { Ctx } from "./context";

/**
 * FERMER SON COMPTE — ce qui s'écrit en base (question 33 de
 * `docs/QUESTIONS.md`, planche `appli/soignee/fermer-mon-compte.html`).
 *
 * Les règles sont dans `src/lib/fermeture-compte.ts` ; ce fichier ne fait que
 * les poser et les lire. Ce qui ferme vraiment le compte (la lecture seule, le
 * refus des salariés) vit dans `withEntreprise`, l'unique porte de chaque
 * écriture.
 */

export type FermetureDuCompte = {
  etat: EtatFermeture;
  /** Une ligne d'abonnement existe : rouvrir après la fermeture passe par l'abonnement. */
  aUneLigneDAbonnement: boolean;
};

/**
 * Les trois dates telles quelles, pour `etatDeLAcces` : le ruban de l'accueil
 * et le bouton éteint disent « Compte fermé » depuis la même règle que la
 * lecture seule de `withEntreprise`.
 */
export async function fermetureDeLEntreprise(ctx: Ctx): Promise<Fermeture | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({
        demandeeLe: entreprises.fermetureDemandeeLe,
        effectiveLe: entreprises.fermetureLe,
        resteEffaceLe: entreprises.resteEffaceLe,
      })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    return ligne ?? null;
  });
}

export async function lireLaFermeture(ctx: Ctx, maintenant: Date = new Date()): Promise<FermetureDuCompte> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({
        demandeeLe: entreprises.fermetureDemandeeLe,
        effectiveLe: entreprises.fermetureLe,
        resteEffaceLe: entreprises.resteEffaceLe,
        abonnement: abonnements.id,
      })
      .from(entreprises)
      .leftJoin(abonnements, eq(abonnements.entrepriseId, entreprises.id))
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    const fermeture: Fermeture | null = ligne
      ? { demandeeLe: ligne.demandeeLe, effectiveLe: ligne.effectiveLe, resteEffaceLe: ligne.resteEffaceLe }
      : null;
    return { etat: etatDeLaFermeture(fermeture, maintenant), aUneLigneDAbonnement: Boolean(ligne?.abonnement) };
  });
}

/**
 * Pose la fermeture. `effectiveLe` vient de `dateDeFermeture` : la fin de ce
 * qui est payé, ou maintenant.
 *
 * **La date d'effacement n'est pas posée ici** : elle se calcule depuis
 * `effectiveLe` (`dateDEffacement`), et l'écrire en plus ferait deux sources.
 */
export async function programmerLaFermeture(ctx: Ctx, effectiveLe: Date, maintenant: Date = new Date()): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(entreprises)
      .set({ fermetureDemandeeLe: maintenant, fermetureLe: effectiveLe, resteEffaceLe: null, updatedAt: maintenant })
      .where(eq(entreprises.id, ctx.entrepriseId));
  });
}

/**
 * Retire la fermeture : avant son effet (il change d'avis), ou après, pour un
 * compte qui rouvre. **Ce que la purge a déjà effacé ne revient pas** : seules
 * les dates partent, et le compte se rouvre sur ce qui est gardé.
 */
export async function retirerLaFermeture(ctx: Ctx, maintenant: Date = new Date()): Promise<void> {
  await withEntreprise(
    ctx.utilisateurId,
    ctx.entrepriseId,
    async (tx) => {
      await tx
        .update(entreprises)
        .set({ fermetureDemandeeLe: null, fermetureLe: null, resteEffaceLe: null, updatedAt: maintenant })
        .where(eq(entreprises.id, ctx.entrepriseId));
    },
    { pourRouvrirLeCompte: true }
  );
}

/**
 * CE QU'AUCUN CLIENT NE PORTE, et qui part aussi (6 novembre 2026, sa
 * demande « tu peux faire ces 5 là ») :
 *
 * | | |
 * |---|---|
 * | les chantiers sans client | par la même règle que ceux d'un client (`effacerChantiersSansClientDans`) : une facture ou un devis accepté les retient |
 * | la liaison bancaire | l'accès à son compte en banque : plus personne ne s'en sert, et c'est un secret |
 * | les messages de l'assistant posés hors d'un chantier | ce qu'il a demandé, et qui peut nommer quelqu'un ; ceux d'un chantier sont partis avec lui |
 * | les photos de diagnostic | le fichier part, la fiche reste sans image, comme à la purge des quatre-vingt-dix jours (`purgerPhotosDiagnostic`) |
 *
 * **Ce qui reste, et c'est délibéré** : les mouvements et virements de la
 * banque. Ils sont reliés aux pièces de son comptable (migration 0145, en
 * cascade) et aux paiements de ses factures : les effacer emporterait des
 * pièces comptables. Ils sont dans `TODO.md`.
 */
async function effacerCeQuiNAppartientAAucunClient(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  entrepriseId: string,
  maintenant: Date
): Promise<void> {
  await effacerChantiersSansClientDans(tx, { entrepriseId }, maintenant);
  await tx.delete(liaisonsBancaires).where(eq(liaisonsBancaires.entrepriseId, entrepriseId));
  await tx
    .delete(messagesAssistant)
    .where(and(eq(messagesAssistant.entrepriseId, entrepriseId), isNull(messagesAssistant.chantierId)));
  const images = await tx
    .select({ id: photosDiagnostic.id, cle: photosDiagnostic.storageKey })
    .from(photosDiagnostic)
    .where(and(eq(photosDiagnostic.entrepriseId, entrepriseId), isNotNull(photosDiagnostic.storageKey)));
  for (const { id, cle } of images) {
    if (!cle) continue;
    await tx.insert(fichiersAPurger).values({ storageKey: cle });
    await tx.update(photosDiagnostic).set({ storageKey: null, purgeeLe: maintenant }).where(eq(photosDiagnostic.id, id));
  }
}

export type RapportFermetures = { comptesEffaces: number; clientsEffaces: number };

/**
 * TRENTE JOURS APRÈS LA FERMETURE, CE QUI NE SE GARDE PAS S'EFFACE.
 *
 * Opération planifiée, sans session (`api/cron/purge-fichiers`). Pour chaque
 * compte échu, **chaque client passe par l'effacement d'un client**, la règle
 * qui existe déjà et qu'il a tranchée le 27 août 2026 : ses factures, ses
 * devis et contrats acceptés restent avec son nom, tout le reste part
 * (chantiers sans pièce, devis jamais acceptés, photos, notes, dictées). Une
 * seconde règle écrite ici finirait par diverger d'elle.
 *
 * **Une transaction par compte** : un compte qui échoue n'empêche pas les
 * autres, et le sien ne reçoit pas sa date d'effacement, donc il sera repris
 * au passage suivant. Rien n'est marqué effacé qui ne l'a pas été.
 *
 * Le contexte d'entreprise est posé ici, depuis la ligne lue, jamais depuis
 * une entrée d'utilisateur : la RLS reste entière, on adopte celle de chaque
 * compte l'un après l'autre (le modèle de `purgerAudiosTranscrits`).
 */
export async function effacerLeResteDesComptesFermes(maintenant: Date = new Date()): Promise<RapportFermetures> {
  // `entreprises` n'est pas sous RLS : la liste des comptes échus se lit sans
  // contexte. Le filtre SQL n'est qu'un premier tri ; c'est `resteAEffacer`,
  // la règle pure, qui décide pour chaque ligne.
  const seuil = new Date(maintenant.getTime() - JOURS_AVANT_EFFACEMENT * 24 * 60 * 60 * 1000);
  const candidats = await db
    .select({
      id: entreprises.id,
      demandeeLe: entreprises.fermetureDemandeeLe,
      effectiveLe: entreprises.fermetureLe,
      resteEffaceLe: entreprises.resteEffaceLe,
    })
    .from(entreprises)
    .where(and(isNotNull(entreprises.fermetureLe), isNull(entreprises.resteEffaceLe), lte(entreprises.fermetureLe, seuil)));

  let comptesEffaces = 0;
  let clientsEffaces = 0;
  for (const c of candidats) {
    if (!resteAEffacer(c, maintenant)) continue;
    try {
      const n = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.entreprise_id', ${c.id}, true)`);
        // La même porte que l'effacement d'un client : sans elle, le
        // déclencheur d'immuabilité refuserait les devis envoyés jamais acceptés.
        await tx.execute(sql`SELECT set_config('atlas.effacement_client', 'oui', true)`);
        const aEffacer = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(and(eq(clients.entrepriseId, c.id), isNull(clients.effaceLe)));
        for (const { id } of aEffacer) {
          await effacerClientDans(tx, { entrepriseId: c.id }, id, maintenant);
        }
        await effacerCeQuiNAppartientAAucunClient(tx, c.id, maintenant);
        await tx.update(entreprises).set({ resteEffaceLe: maintenant, updatedAt: maintenant }).where(eq(entreprises.id, c.id));
        return aEffacer.length;
      });
      comptesEffaces++;
      clientsEffaces += n;
    } catch (e) {
      // Bavard, et sans arrêter les autres comptes : celui-ci n'a pas reçu sa
      // date, il repassera demain.
      logger.error("Échec de l'effacement d'un compte fermé", { entrepriseId: c.id, erreur: e });
    }
  }
  return { comptesEffaces, clientsEffaces };
}
