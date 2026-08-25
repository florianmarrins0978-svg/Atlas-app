import { and, eq, sql } from "drizzle-orm";
import { db } from "./db/client";
import { preuvesAuthentification } from "./db/schema";
import {
  FENETRE_PREUVE_MINUTES,
  messagePreuveExigee,
  preuveEstRecente,
  type GesteSensible,
  type MethodePreuve,
} from "../lib/preuve-recente";

/**
 * LA PREUVE RÉCENTE, côté serveur — et **rien d'autre ne fait autorité**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE FICHIER GARANTIT :**
 *
 * > Un geste vraiment sensible n'aboutit que si CETTE session — pas une autre du
 * > même utilisateur — a prouvé son identité il y a moins de dix minutes.
 *
 * **Aucune valeur venue du navigateur n'est une preuve.** Ni un `reauthenticated`
 * dans un formulaire, ni un état React, ni un en-tête. La preuve est une ligne
 * en base, posée par le serveur après une vérification cryptographique réelle —
 * un mot de passe confronté en base (M9) ou une signature WebAuthn.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI LA SESSION, ET PAS SEULEMENT L'UTILISATEUR.**
 *
 * Une date unique par personne se partagerait entre ses appareils : le patron se
 * ré-authentifie sur son iPhone, et une session volée sur un autre ordinateur en
 * profiterait dans la seconde. C'est le défaut que ce fichier est écrit pour ne
 * pas avoir.
 *
 * Le `sessionId` vient du jeton signé (`src/lib/identite-session.ts`) : le
 * navigateur ne peut ni le lire ni le choisir, et il ne change pas quand Auth.js
 * réémet le jeton — une preuve ne s'évapore donc pas au milieu de sa fenêtre
 * pour une raison technique.
 */

export class PreuveRecenteExigeeError extends Error {
  constructor(readonly geste: GesteSensible) {
    super(messagePreuveExigee(geste));
    this.name = "PreuveRecenteExigeeError";
  }
}

/** Ce dont la garde a besoin — l'identité de la personne ET celle de sa session. */
export type ContextePreuve = { utilisateurId: string; sessionId?: string };

/**
 * Poser — ou rafraîchir — la preuve de CETTE session.
 *
 * À n'appeler qu'après une vérification réelle. Une seule ligne par session : se
 * ré-authentifier rafraîchit la sienne au lieu d'empiler des lignes que rien ne
 * nettoierait.
 */
export async function poserPreuve(
  utilisateurId: string,
  sessionId: string,
  methode: MethodePreuve
): Promise<void> {
  await db
    .insert(preuvesAuthentification)
    .values({ utilisateurId, sessionId, methode, prouveLe: new Date() })
    .onConflictDoUpdate({
      target: [preuvesAuthentification.utilisateurId, preuvesAuthentification.sessionId],
      set: { prouveLe: new Date(), methode },
    });
}

/** Cette session a-t-elle prouvé son identité assez récemment ? */
export async function preuveRecenteExiste(ctx: ContextePreuve): Promise<boolean> {
  /**
   * **Sans identité de session, pas de preuve — jamais un passe-droit.**
   *
   * Un jeton signé avant cette version n'en porte pas. Le traiter comme prouvé
   * ouvrirait la garde à toutes les sessions d'avant, c'est-à-dire exactement
   * celles qu'on veut atteindre. L'artisan retapera son mot de passe une fois ;
   * sa session suivante en portera un.
   */
  if (!ctx.sessionId) return false;

  const [ligne] = await db
    .select({ prouveLe: preuvesAuthentification.prouveLe })
    .from(preuvesAuthentification)
    .where(
      and(
        eq(preuvesAuthentification.utilisateurId, ctx.utilisateurId),
        eq(preuvesAuthentification.sessionId, ctx.sessionId)
      )
    )
    .limit(1);

  return preuveEstRecente(ligne?.prouveLe ?? null, new Date());
}

/**
 * La garde. **Elle lève**, pour qu'un appelant qui l'oublierait ne puisse pas
 * poursuivre par inadvertance.
 */
export async function exigerPreuveRecente(ctx: ContextePreuve, geste: GesteSensible): Promise<void> {
  if (!(await preuveRecenteExiste(ctx))) throw new PreuveRecenteExigeeError(geste);
}

/**
 * Effacer les preuves d'une personne — **toutes ses sessions**.
 *
 * Appelé quand le contexte de sécurité change sous les pieds de tout le monde :
 * un changement de mot de passe, une coupure générale. Une preuve posée avant
 * n'atteste plus de rien après.
 */
export async function effacerPreuves(utilisateurId: string): Promise<void> {
  await db.delete(preuvesAuthentification).where(eq(preuvesAuthentification.utilisateurId, utilisateurId));
}

/**
 * Le ménage des preuves périmées.
 *
 * Sans lui, la table grossit d'une ligne par session et par personne, sans que
 * rien ne les retire — les sessions durent des semaines, les preuves dix
 * minutes. Rien ne dépend de cette purge pour la sécurité : `preuveEstRecente`
 * refuse déjà une ligne trop vieille. Elle empêche seulement une table de
 * grandir pour rien.
 */
export async function purgerPreuvesPerimees(): Promise<number> {
  const resultat = await db
    .delete(preuvesAuthentification)
    .where(sql`${preuvesAuthentification.prouveLe} < now() - make_interval(mins => ${FENETRE_PREUVE_MINUTES})`);
  return resultat.rowCount ?? 0;
}
