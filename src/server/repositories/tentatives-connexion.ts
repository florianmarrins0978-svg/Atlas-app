import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { tentativesConnexion } from "../db/schema";
import {
  FENETRE_OUBLI_MS,
  attenteRestanteMs,
  etatApresEchec,
  type EtatTentatives,
} from "../../lib/tentatives-connexion";

/**
 * Le compteur d'échecs de connexion — écriture et lecture.
 *
 * **PAS de `withEntreprise` ICI, et ce n'est pas un oubli** (même raisonnement
 * que `compte.ts`) : au moment où l'on compte un échec, on ne sait pas encore
 * qui est en face — c'est justement la question posée. Il n'y a donc aucune
 * entreprise dont poser le contexte, et prétendre le contraire ferait croire à
 * un cloisonnement qui n'existe pas à cet endroit (`CLAUDE.md` §4).
 *
 * **Ce qui remplace la RLS, et qui doit tenir sans elle :** chaque requête vise
 * une empreinte EXACTE. Cette table ne se parcourt jamais — sauf le ménage
 * ci-dessous, qui ne lit rien et ne rend rien.
 */

/**
 * L'empreinte d'une saisie.
 *
 * Normalisée d'abord — `Jean@Atlas.LOCAL ` et `jean@atlas.local` sont la même
 * tentative, et compter séparément offrirait autant de compteurs neufs qu'il y
 * a de façons d'écrire une adresse. C'est exactement le contournement que ce
 * lot ferme du côté de `x-forwarded-for` ; il n'a pas à se rouvrir ici.
 */
export function empreinteDe(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

async function lire(empreinte: string): Promise<EtatTentatives | null> {
  const [ligne] = await db
    .select()
    .from(tentativesConnexion)
    .where(eq(tentativesConnexion.empreinte, empreinte))
    .limit(1);
  if (!ligne) return null;
  return {
    echecs: ligne.echecs,
    dernierEchecAt: ligne.dernierEchecAt,
    bloqueJusqua: ligne.bloqueJusqua,
  };
}

/**
 * Cette saisie doit-elle attendre, et combien de millisecondes ?
 *
 * **Rend `null` quand la base ne répond pas**, et c'est délibéré : cette
 * fonction protège d'un abus, elle ne doit pas devenir elle-même la panne. Si
 * PostgreSQL est couché, la connexion échouera de toute façon deux lignes plus
 * loin, avec le message qui nomme le bon coupable (« un service d'Atlas ne
 * répond pas »). Refuser ici afficherait « trop de tentatives » à quelqu'un qui
 * n'en a fait aucune — une erreur qui accuse à tort coûte plus cher que pas
 * d'erreur du tout (`AGENTS.md`).
 */
export async function attenteAvantEssai(email: string, maintenant = new Date()): Promise<number | null> {
  try {
    return attenteRestanteMs(await lire(empreinteDe(email)), maintenant);
  } catch {
    return null;
  }
}

/**
 * Un échec de plus.
 *
 * **Ne lève jamais.** Un compteur qui tombe ne doit pas transformer un mot de
 * passe faux en écran d'erreur : le refus doit rester lisible.
 */
export async function noterEchec(email: string, maintenant = new Date()): Promise<void> {
  const empreinte = empreinteDe(email);
  try {
    /**
     * **Lire et écrire dans la MÊME transaction, la ligne verrouillée.**
     *
     * Deux essais simultanés sur le même compte ne doivent pas se recouvrir et
     * n'en compter qu'un : ce serait la brèche qu'un attaquant exploite, en
     * tirant en parallèle. `FOR UPDATE` fait attendre le second jusqu'à ce que
     * le premier ait écrit.
     *
     * **La première rédaction s'y prenait autrement, et c'était un défaut** —
     * trouvé en relisant ce lot d'un œil hostile. Elle écrivait
     * `GREATEST(echecs + 1, …)` pour parer la course, et ce `GREATEST`
     * ressuscitait des échecs que la fenêtre d'oubli venait d'effacer : neuf
     * fautes lundi, une seule mardi, et l'artisan repartait au plafond — un
     * quart d'heure d'attente pour une faute isolée. La règle d'oubli existait,
     * et le SQL la contredisait.
     *
     * Ici, **la règle décide seule** (`src/lib/tentatives-connexion.ts`) : on
     * ne recalcule rien en SQL, donc rien ne peut diverger (`CLAUDE.md` §3).
     */
    await db.transaction(async (tx) => {
      const [ligne] = await tx
        .select()
        .from(tentativesConnexion)
        .where(eq(tentativesConnexion.empreinte, empreinte))
        .limit(1)
        .for("update");

      const suivant = etatApresEchec(
        ligne
          ? { echecs: ligne.echecs, dernierEchecAt: ligne.dernierEchecAt, bloqueJusqua: ligne.bloqueJusqua }
          : null,
        maintenant
      );

      await tx
        .insert(tentativesConnexion)
        .values({
          empreinte,
          echecs: suivant.echecs,
          dernierEchecAt: suivant.dernierEchecAt,
          bloqueJusqua: suivant.bloqueJusqua,
        })
        .onConflictDoUpdate({
          target: tentativesConnexion.empreinte,
          set: {
            echecs: suivant.echecs,
            dernierEchecAt: suivant.dernierEchecAt,
            bloqueJusqua: suivant.bloqueJusqua,
          },
        });
    });
    await menage(maintenant);
  } catch {
    // Volontairement silencieux ici : `login/actions.ts` journalise déjà
    // l'échec de connexion lui-même, et une seconde ligne de journal par essai
    // raté noierait le signal le jour d'une vraie rafale.
  }
}

/**
 * La connexion a réussi : le compteur repart de zéro.
 *
 * **Effacer plutôt que remettre à zéro** : une ligne à zéro échec ne dit rien
 * de plus qu'une ligne absente, et la laisser ferait grossir la table pour
 * chaque adresse jamais tapée à côté.
 */
export async function oublierEchecs(email: string): Promise<void> {
  try {
    await db.delete(tentativesConnexion).where(eq(tentativesConnexion.empreinte, empreinteDe(email)));
  } catch {
    // Idem : ne jamais faire échouer une connexion réussie sur un ménage.
  }
}

/**
 * Le ménage — car n'importe qui peut faire naître une ligne ici.
 *
 * Il suffit de taper une adresse au hasard pour en créer une. Sans cette
 * coupe, une rafale sur dix mille adresses inventées laisserait dix mille
 * lignes derrière elle, définitivement. On efface ce que la fenêtre d'oubli a
 * déjà rendu sans effet : ces lignes ne comptent plus pour personne.
 *
 * Fait à l'écriture plutôt que dans le planificateur : la table reste petite
 * par construction, et l'index sur `dernier_echec_at` rend la coupe immédiate.
 */
async function menage(maintenant: Date): Promise<void> {
  await db
    .delete(tentativesConnexion)
    .where(lt(tentativesConnexion.dernierEchecAt, new Date(maintenant.getTime() - FENETRE_OUBLI_MS)));
}
