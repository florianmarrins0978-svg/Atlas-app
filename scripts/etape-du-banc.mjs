import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * **Où en est le banc — 27 octobre 2026.**
 *
 * Son espace a servi une page blanche toute une journée : « Serveur : ABSENT,
 * Veilleur : en place », et rien d'autre. La fiche ne publie pas le journal
 * (le dépôt est public), si bien que personne ne pouvait dire à quelle étape le
 * banc restait. Il note donc ici chacune de ses étapes, prise dans une liste
 * FERMÉE : un mot de cette liste ne peut rien porter de secret, et la fiche
 * peut le publier tel quel.
 */

export const CHEMIN_ETAPE = process.env.ATLAS_ETAPE_BANC || "/tmp/atlas-banc-etape.json";

export const ETAPES = ["démarrage", "dépendances", "clé de l'espace", "serveur lancé"];

export function noterEtape(etape, { chemin = CHEMIN_ETAPE, maintenant = Date.now() } = {}) {
  if (!ETAPES.includes(etape)) throw new Error(`étape inconnue du banc : ${etape}`);
  try {
    writeFileSync(chemin, JSON.stringify({ etape, depuis: maintenant }));
  } catch (erreur) {
    // Une étape non notée ne doit pas empêcher le serveur de partir.
    console.error(`⚠ étape du banc non notée (${erreur instanceof Error ? erreur.message : erreur})`);
  }
}

/** @returns {{ etape: string, minutes: number } | null} */
export function lireEtape({ chemin = CHEMIN_ETAPE, maintenant = Date.now() } = {}) {
  if (!existsSync(chemin)) return null;
  try {
    const { etape, depuis } = JSON.parse(readFileSync(chemin, "utf8"));
    if (!ETAPES.includes(etape) || !Number.isFinite(depuis)) return null;
    return { etape, minutes: Math.max(0, Math.round((maintenant - depuis) / 60_000)) };
  } catch {
    return null; // illisible : la fiche n'affirme rien plutôt qu'un mot inventé
  }
}
