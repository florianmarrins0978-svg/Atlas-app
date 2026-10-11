import { readdirSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { logger } from "./logger";
import { retardDeLaBase, type RetardDeLaBase } from "@/lib/retard-de-la-base";

/**
 * Ce que la base porte, confronté à ce que ce code suppose.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette lecture existe — sa panne du 13 septembre 2026.** Le code
 * servi supposait la migration 0090 ; sa base s'était arrêtée à 0087. L'écart
 * ne se voyait nulle part : il se découvrait par « Planning » et « Terminés »
 * qui tombaient, derrière un numéro de six chiffres. Le produit n'avait aucun
 * défaut, et c'est là qu'on a cherché.
 *
 * **Les deux côtés sont lus au même instant**, et chacun à sa source :
 *
 *   - ce que le code attend = les fichiers de `drizzle/`, qui voyagent avec lui ;
 *   - ce que la base a = la table `_migrations`, que le runner tient.
 *
 * Aucune liste écrite à la main : elle vieillirait, et un état « à jour »
 * mensonger vaut moins que rien.
 *
 * **`withEntreprise` n'a pas de sens ici**, et c'est la seule exception que ce
 * fichier s'autorise : `_migrations` n'appartient à aucune entreprise, ne porte
 * pas de RLS, et ne dit rien de personne. Le contexte d'isolation existe pour
 * les données du patron ; celle-ci décrit la forme du bâtiment, pas ce qu'il y
 * a dedans.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Rend `null` quand la mesure est IMPOSSIBLE — base injoignable, dossier des
 * migrations absent. Jamais un « à jour » de consolation : l'absence de matière
 * à mesurer n'est pas un succès (`CLAUDE.md` §5), et un vert rendu ici
 * renverrait chercher la panne dans le produit.
 */
export async function etatDeLaBase(): Promise<RetardDeLaBase | null> {
  try {
    const dossier = path.join(process.cwd(), "drizzle");
    const attendues = readdirSync(dossier)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    // Le dossier existe mais ne porte rien : on ne conclut pas. Un déploiement
    // qui n'embarque pas ses migrations rendrait sinon « le CODE est en retard
    // de 105 » — une erreur qui accuse à tort coûte plus cher que pas d'erreur
    // du tout (`AGENTS.md`).
    if (attendues.length === 0) return null;

    const resultat = await db.execute(sql`SELECT nom FROM _migrations`);
    const appliquees = resultat.rows.map((l) => String(l.nom));

    return retardDeLaBase({ attendues, appliquees });
  } catch (e) {
    // **On journalise AVANT de rendre « inconnu ».** Un défaut muet fait
    // chercher ailleurs : c'est la leçon du 11 août 2026 (`AGENTS.md`), et la
    // raison pour laquelle ce catch n'est pas vide.
    logger.warn("Impossible de lire l'état des migrations", {
      quoi: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
