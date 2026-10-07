import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { appareilsRetenus, codesSecours, connexionsEnAttente, doubleVerification } from "@/server/db/schema";
import { getEnv } from "@/server/env";
import { chiffrer, dechiffrer } from "@/server/agenda/secret-au-repos";
import { empreinteDuCode, empreinteDuJeton } from "@/server/empreinte-du-code";
import {
  DUREE_APPAREIL_RETENU_MS,
  DUREE_CONNEXION_EN_ATTENTE_MS,
  ESSAIS_MAX_CODE,
  NOMBRE_CODES_SECOURS,
  base32Decode,
  base32Encode,
  codeSecoursDepuis,
  ecrireCodeSecours,
  normaliserCodeSecours,
  uriOtpauth,
  verifierCodeTotp,
} from "@/lib/double-verification";

/**
 * LA DOUBLE VÉRIFICATION : ce qui se lit et s'écrit en base.
 *
 * Les règles (le code, sa fenêtre, les codes de secours, qui est obligé) vivent
 * dans `src/lib/double-verification.ts` et ne sont pas redites ici.
 *
 * **Le contexte est `app.utilisateur_id`**, posé à chaque transaction : ces
 * lignes appartiennent à une PERSONNE (migration 0123). Sans lui, la politique
 * ne rend rien, en silence.
 *
 * **Les deux jetons du navigateur portent l'identifiant de leur propriétaire**
 * (`<utilisateur>.<aléa>`). Ce n'est pas une confiance accordée : c'est ce qui
 * permet de poser le contexte avant de chercher la ligne. Un identifiant
 * changé à la main pose le contexte d'un autre, où l'empreinte ne correspond
 * à rien.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function enTantQue<T>(utilisateurId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    return fn(tx);
  });
}

const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<utilisateur>.<aléa>` : le propriétaire, ou `null` pour une forme inconnue. */
function proprietaireDuJeton(jeton: string | undefined): string | null {
  if (!jeton) return null;
  const point = jeton.indexOf(".");
  if (point < 0) return null;
  const id = jeton.slice(0, point);
  return FORME_UUID.test(id) && jeton.length > point + 20 ? id : null;
}

function nouveauJeton(utilisateurId: string): string {
  return `${utilisateurId}.${randomBytes(32).toString("base64url")}`;
}

function empreinteSecours(code: string, utilisateurId: string): string {
  return empreinteDuCode(code, utilisateurId, getEnv().authSecret);
}

export type EtatDoubleVerification = { active: boolean; codesRestants: number };

export async function etatDoubleVerification(utilisateurId: string): Promise<EtatDoubleVerification> {
  return enTantQue(utilisateurId, async (tx) => {
    const [ligne] = await tx
      .select({ activeLe: doubleVerification.activeLe })
      .from(doubleVerification)
      .where(eq(doubleVerification.utilisateurId, utilisateurId))
      .limit(1);
    if (!ligne?.activeLe) return { active: false, codesRestants: 0 };
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(codesSecours)
      .where(and(eq(codesSecours.utilisateurId, utilisateurId), isNull(codesSecours.utiliseLe)));
    return { active: true, codesRestants: n };
  });
}

/**
 * Le code du téléphone, ou un code de secours : vrai si l'un des deux ouvre.
 *
 * **Le code du téléphone d'abord**, et son pas est retenu : il ne resservira
 * pas. Un code de secours qui ouvre est marqué servi dans la même transaction.
 */
async function secondFacteurJuste(tx: Tx, utilisateurId: string, saisie: string): Promise<boolean> {
  const [ligne] = await tx
    .select({
      secretChiffre: doubleVerification.secretChiffre,
      activeLe: doubleVerification.activeLe,
      dernierPas: doubleVerification.dernierPas,
    })
    .from(doubleVerification)
    .where(eq(doubleVerification.utilisateurId, utilisateurId))
    .limit(1);
  if (!ligne?.activeLe) return false;

  const secret = secretLisible(ligne.secretChiffre);
  if (secret) {
    const verdict = verifierCodeTotp(secret, saisie, Date.now(), ligne.dernierPas);
    if (verdict.ok) {
      await tx
        .update(doubleVerification)
        .set({ dernierPas: verdict.pas })
        .where(eq(doubleVerification.utilisateurId, utilisateurId));
      return true;
    }
  }

  const code = normaliserCodeSecours(saisie);
  if (!code) return false;
  const servi = await tx
    .update(codesSecours)
    .set({ utiliseLe: new Date() })
    .where(
      and(
        eq(codesSecours.utilisateurId, utilisateurId),
        eq(codesSecours.empreinte, empreinteSecours(code, utilisateurId)),
        isNull(codesSecours.utiliseLe)
      )
    )
    .returning({ id: codesSecours.id });
  return servi.length > 0;
}

/**
 * **Un secret illisible ferme la porte au code du téléphone, pas au compte.**
 * `AUTH_SECRET` remplacé rend le secret illisible : le code du téléphone ne
 * passe plus, mais les codes de secours (HMAC, indépendants du chiffrement)
 * ouvrent encore, et c'est par eux qu'il désactive puis réactive.
 */
function secretLisible(secretChiffre: string): Buffer | null {
  const base32 = dechiffrer(secretChiffre, "double-verification");
  return base32 ? base32Decode(base32) : null;
}

// ─── Activer, désactiver ─────────────────────────────────────────────────────

export type DebutActivation = { ok: true; secretBase32: string; uri: string } | { ok: false; refus: "deja-active" };

/**
 * Étape 1 : un secret neuf, en attente de son premier code juste.
 *
 * Refait à chaque ouverture tant que l'activation n'est pas confirmée : un
 * secret affiché puis abandonné ne doit pas pouvoir être confirmé plus tard
 * par quelqu'un qui l'aurait photographié.
 */
export async function commencerActivation(utilisateurId: string, email: string): Promise<DebutActivation> {
  const secretBase32 = base32Encode(randomBytes(20));
  return enTantQue(utilisateurId, async (tx) => {
    const [deja] = await tx
      .select({ activeLe: doubleVerification.activeLe })
      .from(doubleVerification)
      .where(eq(doubleVerification.utilisateurId, utilisateurId))
      .limit(1);
    if (deja?.activeLe) return { ok: false, refus: "deja-active" } as const;
    const secretChiffre = chiffrer(secretBase32, "double-verification");
    await tx
      .insert(doubleVerification)
      .values({ utilisateurId, secretChiffre })
      .onConflictDoUpdate({
        target: doubleVerification.utilisateurId,
        set: { secretChiffre, activeLe: null, dernierPas: null, creeLe: new Date() },
      });
    return { ok: true, secretBase32, uri: uriOtpauth(secretBase32, email) } as const;
  });
}

export type FinActivation = { ok: true; codesSecours: string[] } | { ok: false; refus: "code-faux" | "rien-a-confirmer" };

/**
 * Étape 2 : le premier code juste ferme la porte, et donne les codes de secours.
 *
 * **Les codes de secours ne se montrent qu'ici, une seule fois.** La base n'en
 * garde que l'empreinte : il n'existe aucun moyen de les relire plus tard.
 */
export async function confirmerActivation(utilisateurId: string, saisie: string): Promise<FinActivation> {
  return enTantQue(utilisateurId, async (tx) => {
    const [ligne] = await tx
      .select({ secretChiffre: doubleVerification.secretChiffre, activeLe: doubleVerification.activeLe })
      .from(doubleVerification)
      .where(eq(doubleVerification.utilisateurId, utilisateurId))
      .limit(1);
    if (!ligne || ligne.activeLe) return { ok: false, refus: "rien-a-confirmer" } as const;
    const secret = secretLisible(ligne.secretChiffre);
    const verdict = secret ? verifierCodeTotp(secret, saisie, Date.now(), null) : { ok: false as const };
    if (!verdict.ok) return { ok: false, refus: "code-faux" } as const;

    await tx
      .update(doubleVerification)
      .set({ activeLe: new Date(), dernierPas: verdict.pas })
      .where(eq(doubleVerification.utilisateurId, utilisateurId));

    const codes = Array.from({ length: NOMBRE_CODES_SECOURS }, () => codeSecoursDepuis(randomBytes(8)));
    await tx.delete(codesSecours).where(eq(codesSecours.utilisateurId, utilisateurId));
    await tx
      .insert(codesSecours)
      .values(codes.map((c) => ({ utilisateurId, empreinte: empreinteSecours(c, utilisateurId) })));
    return { ok: true, codesSecours: codes.map(ecrireCodeSecours) } as const;
  });
}

/**
 * Désactiver demande un code : une session volée sans le téléphone ne peut pas
 * retirer la serrure. Tout part avec elle, appareils retenus compris.
 */
export async function desactiver(utilisateurId: string, saisie: string): Promise<{ ok: boolean }> {
  return enTantQue(utilisateurId, async (tx) => {
    if (!(await secondFacteurJuste(tx, utilisateurId, saisie))) return { ok: false };
    await tx.delete(codesSecours).where(eq(codesSecours.utilisateurId, utilisateurId));
    await tx.delete(appareilsRetenus).where(eq(appareilsRetenus.utilisateurId, utilisateurId));
    await tx.delete(doubleVerification).where(eq(doubleVerification.utilisateurId, utilisateurId));
    return { ok: true };
  });
}

// ─── Les appareils retenus ───────────────────────────────────────────────────

export async function appareilRetenu(utilisateurId: string, jeton: string | undefined): Promise<boolean> {
  if (proprietaireDuJeton(jeton) !== utilisateurId) return false;
  return enTantQue(utilisateurId, async (tx) => {
    const [ligne] = await tx
      .select({ id: appareilsRetenus.id })
      .from(appareilsRetenus)
      .where(
        and(
          eq(appareilsRetenus.utilisateurId, utilisateurId),
          eq(appareilsRetenus.empreinte, empreinteDuJeton(jeton!)),
          gt(appareilsRetenus.expireLe, new Date())
        )
      )
      .limit(1);
    return Boolean(ligne);
  });
}

export async function retenirAppareil(utilisateurId: string): Promise<{ jeton: string; expireLe: Date }> {
  const jeton = nouveauJeton(utilisateurId);
  const expireLe = new Date(Date.now() + DUREE_APPAREIL_RETENU_MS);
  await enTantQue(utilisateurId, async (tx) => {
    // Les appareils dont les trente jours sont passés partent au passage :
    // rien d'autre ne les ramasserait.
    await tx
      .delete(appareilsRetenus)
      .where(and(eq(appareilsRetenus.utilisateurId, utilisateurId), lt(appareilsRetenus.expireLe, new Date())));
    await tx.insert(appareilsRetenus).values({ utilisateurId, empreinte: empreinteDuJeton(jeton), expireLe });
  });
  return { jeton, expireLe };
}

/** « Me déconnecter partout » : plus aucun appareil n'entre sans code. */
export async function oublierAppareils(utilisateurId: string): Promise<void> {
  await enTantQue(utilisateurId, (tx) =>
    tx.delete(appareilsRetenus).where(eq(appareilsRetenus.utilisateurId, utilisateurId))
  );
}

// ─── La connexion en attente du code ─────────────────────────────────────────

/**
 * Faut-il un code à cette connexion ? Oui si la double vérification est active
 * et que l'appareil n'est pas retenu.
 */
export async function codeExige(utilisateurId: string, jetonAppareil: string | undefined): Promise<boolean> {
  const etat = await etatDoubleVerification(utilisateurId);
  if (!etat.active) return false;
  return !(await appareilRetenu(utilisateurId, jetonAppareil));
}

/** Le mot de passe est juste : cinq minutes pour donner le code. */
export async function ouvrirConnexionEnAttente(utilisateurId: string): Promise<string> {
  const jeton = nouveauJeton(utilisateurId);
  await enTantQue(utilisateurId, async (tx) => {
    // Une seule attente à la fois : un mot de passe retapé remplace la
    // précédente, et ses essais restants avec.
    await tx.delete(connexionsEnAttente).where(eq(connexionsEnAttente.utilisateurId, utilisateurId));
    await tx.insert(connexionsEnAttente).values({
      utilisateurId,
      empreinte: empreinteDuJeton(jeton),
      expireLe: new Date(Date.now() + DUREE_CONNEXION_EN_ATTENTE_MS),
    });
  });
  return jeton;
}

export type VerdictConnexionEnAttente =
  | { ok: true; utilisateurId: string }
  | { ok: false; refus: "expiree" }
  | { ok: false; refus: "code-faux"; utilisateurId: string; derniereChance: boolean };

/**
 * Le code de la connexion en attente : juste, elle aboutit et disparaît ;
 * faux, un essai de moins ; au cinquième, elle meurt et il faut retaper le
 * mot de passe, qui est lui-même temporisé.
 */
export async function consommerConnexionEnAttente(
  jeton: string | undefined,
  saisie: string
): Promise<VerdictConnexionEnAttente> {
  const utilisateurId = proprietaireDuJeton(jeton);
  if (!utilisateurId) return { ok: false, refus: "expiree" };
  return enTantQue(utilisateurId, async (tx) => {
    const [ligne] = await tx
      .select({ id: connexionsEnAttente.id, essais: connexionsEnAttente.essais })
      .from(connexionsEnAttente)
      .where(
        and(
          eq(connexionsEnAttente.utilisateurId, utilisateurId),
          eq(connexionsEnAttente.empreinte, empreinteDuJeton(jeton!)),
          gt(connexionsEnAttente.expireLe, new Date())
        )
      )
      .limit(1);
    if (!ligne || ligne.essais >= ESSAIS_MAX_CODE) return { ok: false, refus: "expiree" } as const;

    if (await secondFacteurJuste(tx, utilisateurId, saisie)) {
      await tx.delete(connexionsEnAttente).where(eq(connexionsEnAttente.id, ligne.id));
      return { ok: true, utilisateurId } as const;
    }

    const essais = ligne.essais + 1;
    if (essais >= ESSAIS_MAX_CODE) {
      await tx.delete(connexionsEnAttente).where(eq(connexionsEnAttente.id, ligne.id));
    } else {
      await tx.update(connexionsEnAttente).set({ essais }).where(eq(connexionsEnAttente.id, ligne.id));
    }
    return { ok: false, refus: "code-faux", utilisateurId, derniereChance: essais === ESSAIS_MAX_CODE - 1 } as const;
  });
}
