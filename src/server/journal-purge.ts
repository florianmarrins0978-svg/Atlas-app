import { desc, lt } from "drizzle-orm";
import { db } from "./db/client";
import { executionsPurge } from "./db/schema";

/**
 * LE JOURNAL DES PURGES — savoir si le ménage se fait encore.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CE MODULE FERME, ET POURQUOI C'ÉTAIT LE POINT BLOQUANT.**
 *
 * L'audit final du 29 août 2026 a relevé que `/api/cron/purge-fichiers` existe,
 * fonctionne, et n'est appelée par personne. Le grave n'est pas l'oubli du
 * planificateur — cela se branche en une ligne chez l'hébergeur. Le grave est
 * qu'**une purge qui ne tourne pas ne se signale pas** : aucune erreur, aucun
 * écran rouge, aucun ralentissement. Les audios de dictée s'accumulent, les
 * photos de diagnostic échues restent, et tout a l'air normal.
 *
 * On ne le découvrirait qu'en cherchant autre chose, des mois plus tard — et
 * d'ici là, toutes les durées de conservation annoncées seraient fausses.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CE MODULE NE FAIT PAS, ET NE DOIT PAS FAIRE.**
 *
 * Il **ne planifie rien**. Atlas ne réimplémente pas un planificateur : c'est le
 * travail de l'hébergeur, il le fait mieux, et un minuteur interne mourrait
 * avec le processus sans que personne ne le sache — soit exactement le défaut
 * qu'on répare ici, déplacé d'un cran.
 *
 * Il se contente de rendre l'état **LISIBLE** : quand la dernière purge a
 * réussi, et depuis combien de temps. Ce qu'on branche dessus — une sonde de
 * l'hébergeur, un appel depuis une machine de garde — se décide au déploiement,
 * et `docs/DEPLOIEMENT-PURGE.md` le dit précisément.
 */

/**
 * Au-delà de quoi l'absence de purge est une anomalie.
 *
 * **Pourquoi 48 heures et pas 2, alors qu'on la veut horaire ou quotidienne.**
 * Ce seuil ne mesure pas la ponctualité, il mesure la PANNE. Une purge qui
 * saute parce que l'hébergeur redéploie, parce qu'une bascule de base a duré,
 * parce qu'un déploiement a pris vingt minutes, n'est pas un incident — et une
 * alerte qui parle pour ça s'apprend à être ignorée. On perd alors le garde-fou
 * sans s'en apercevoir, ce qui est pire que de ne pas en avoir
 * (`CLAUDE.md` §4 ter).
 *
 * Deux jours laissent passer tous les accidents ordinaires, et ne laissent
 * passer aucune vraie panne : la plus longue rétention du produit se compte en
 * jours, pas en heures. Un retard de deux jours ne fait donc dépasser aucune
 * durée annoncée.
 */
export const HEURES_AVANT_ANOMALIE = 48;

/**
 * Combien de temps on garde le journal lui-même.
 *
 * Assez pour répondre à « depuis quand est-ce arrêté ? » même après des
 * vacances, et assez peu pour que la table ne grossisse pas sans fin. C'est la
 * purge qui élague son propre journal — pas un second mécanisme à brancher.
 */
export const JOURS_DE_JOURNAL = 90;

/** L'état du ménage, tel qu'une sonde a besoin de le lire. */
export type EtatDesPurges = {
  /** L'instant de la dernière purge RÉUSSIE, ou `null` si aucune n'a jamais eu lieu. */
  dernierSucces: Date | null;
  /** Depuis combien d'heures — `null` quand aucune purge n'a jamais tourné. */
  heuresDepuis: number | null;
  /**
   * `true` quand le ménage ne se fait plus.
   *
   * **Une base où AUCUNE purge n'a jamais tourné est une anomalie**, pas un
   * état neutre : c'est précisément l'état d'Atlas avant ce lot, et le laisser
   * passer pour « rien à signaler » reproduirait le défaut qu'on corrige.
   */
  anormal: boolean;
};

/**
 * Noter qu'une purge **a réussi**.
 *
 * **À n'appeler QUE dans le chemin de succès**, et jamais dans un `finally` :
 * un horodatage écrit malgré l'échec dirait « tout va bien » pendant que rien
 * n'est purgé. C'est le faux vert le plus dangereux, celui qui rassure —
 * `scripts/test-journal-purge-db.ts` le vérifie en faisant échouer la purge.
 */
export async function noterPurgeReussie(compteurs: {
  fichiersPurges: number;
  audiosPurges: number;
  photosPurgees: number;
  preuvesPurgees: number;
}): Promise<void> {
  await db.insert(executionsPurge).values({
    fichiersPurges: compteurs.fichiersPurges,
    audiosPurges: compteurs.audiosPurges,
    photosPurgees: compteurs.photosPurgees,
    preuvesPurgees: compteurs.preuvesPurgees,
  });

  // Le journal élague le journal : pas de second rouage à brancher, donc pas de
  // second rouage à oublier de brancher.
  const limite = new Date(Date.now() - JOURS_DE_JOURNAL * 24 * 3600_000);
  await db.delete(executionsPurge).where(lt(executionsPurge.termineeLe, limite));
}

/** Où en est le ménage ? */
export async function etatDesPurges(maintenant: Date = new Date()): Promise<EtatDesPurges> {
  const [derniere] = await db
    .select({ termineeLe: executionsPurge.termineeLe })
    .from(executionsPurge)
    .orderBy(desc(executionsPurge.termineeLe))
    .limit(1);

  if (!derniere) return { dernierSucces: null, heuresDepuis: null, anormal: true };

  const heuresDepuis = (maintenant.getTime() - derniere.termineeLe.getTime()) / 3600_000;
  return {
    dernierSucces: derniere.termineeLe,
    heuresDepuis,
    anormal: heuresDepuis > HEURES_AVANT_ANOMALIE,
  };
}
