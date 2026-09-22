/**
 * La base porte-t-elle le schéma que ce code attend ?
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **SA PANNE DU 13 SEPTEMBRE 2026 :** *« Plus rien ne fonctionne ! »* —
 * « Planning » et « Terminés » par terre, « Chantiers » debout. Sa base était
 * restée à la migration 0087 sous le code de `main`, et le serveur répondait
 * `column "conditions_generales" does not exist` (migration 0090). À l'écran :
 * « Impossible de charger le planning » et un numéro de six chiffres.
 *
 * **Ce qui manquait n'était pas la migration : c'était de SAVOIR.** Rien, dans
 * l'application, ne comparait ce que le code suppose à ce que la base porte.
 * L'écart se découvrait par un écran mort, au hasard de la colonne qu'il
 * touchait, derrière un identifiant opaque — et l'on cherchait la panne dans le
 * produit, là où il n'y en avait pas.
 *
 * **La règle est ici, pure, et une seule fois.** Elle sert l'écran des Réglages
 * (`src/server/retard-de-la-base.ts`) ET la fiche que son espace publie
 * (`scripts/etat-de-la-base.ts`) : deux calculs auraient fini par se
 * contredire, et c'est exactement le genre de contradiction qui fait douter de
 * tout le reste (`CLAUDE.md` §3).
 * ───────────────────────────────────────────────────────────────────────────
 */

export type EtatDesMigrations = {
  /** Les fichiers de `drizzle/`, c'est-à-dire ce que le code servi suppose. */
  attendues: string[];
  /** Ce que la table `_migrations` déclare appliqué. */
  appliquees: string[];
};

export type RetardDeLaBase = {
  /** Ce que le code attend et que la base n'a pas. Dans l'ordre. */
  manquantes: string[];
  /**
   * Ce que la base porte et que ce code ne connaît pas — donc du code en RETARD
   * sur sa base, pas l'inverse. Cela arrive quand on redescend d'une version, et
   * cela se dit : sans ce cas, un « à jour » mentirait à l'endroit précis où le
   * schéma et le code divergent le plus dangereusement.
   */
  enTrop: string[];
  /** Rien ne manque et rien n'est en trop. */
  accordee: boolean;
};

export function retardDeLaBase(etat: EtatDesMigrations): RetardDeLaBase {
  const appliquees = new Set(etat.appliquees);
  const attendues = new Set(etat.attendues);

  const manquantes = etat.attendues.filter((m) => !appliquees.has(m));
  const enTrop = etat.appliquees.filter((m) => !attendues.has(m)).sort();

  return { manquantes, enTrop, accordee: manquantes.length === 0 && enTrop.length === 0 };
}

/**
 * La ligne du diagnostic, telle que la fiche de son espace la porte.
 *
 * **Elle NOMME les migrations qui manquent**, et ne se contente pas d'un
 * compte : c'est ce numéro-là qui dit quelle colonne manque, donc quel écran
 * tombe. « EN RETARD DE 3 » aurait encore demandé d'aller chercher lesquelles,
 * et cette fiche existe précisément pour n'avoir rien à lui demander
 * (`CLAUDE.md` §1 bis).
 */
export function ligneEtatDeLaBase(retard: RetardDeLaBase | null): string {
  // **Un contrôle qui ne peut pas mesurer ne rend JAMAIS un vert.** Base
  // injoignable, dossier absent : on le dit. L'absence de matière à mesurer
  // n'est pas un succès (`CLAUDE.md` §5).
  if (!retard) return "état inconnu, la base n'a pas répondu";

  const morceaux: string[] = [];
  if (retard.manquantes.length > 0) {
    morceaux.push(
      `EN RETARD DE ${retard.manquantes.length} — ${retard.manquantes.map(numeroDeLaMigration).join(", ")}`
    );
  }
  if (retard.enTrop.length > 0) {
    morceaux.push(
      `le CODE est en retard sur elle de ${retard.enTrop.length} — ${retard.enTrop
        .map(numeroDeLaMigration)
        .join(", ")}`
    );
  }
  return morceaux.length > 0 ? morceaux.join(" · ") : "à jour";
}

/** « 0090_remise_main_doeuvre_conditions_generales.sql » → « 0090 ». */
function numeroDeLaMigration(fichier: string): string {
  return /^(\d+)/.exec(fichier)?.[1] ?? fichier;
}
