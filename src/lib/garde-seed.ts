/**
 * À quelles conditions le jeu de démonstration a le droit d'effacer la base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE RÈGLE EMPÊCHE, ET CE QUE SON ABSENCE COÛTAIT.**
 *
 * `src/server/db/seed.ts` commence par ceci :
 *
 *     TRUNCATE TABLE lignes_facture, factures, lignes_devis, devis, …,
 *                    membres_entreprise, entreprises, users
 *     RESTART IDENTITY CASCADE
 *
 * Jusqu'au 23 août 2026, **rien** ne l'empêchait de le faire sur une vraie
 * base. Le seul garde-fou était un commentaire : *« ce seed n'est de toute
 * façon jamais exécuté contre une base de production »*. L'audit de sécurité
 * (constat E1) l'a relevé comme le risque latent de plus fort impact du dépôt :
 * un `DATABASE_URL` de production dans l'environnement, `npm run db:seed`, et
 * toutes les entreprises, tous les utilisateurs, toutes les factures
 * disparaissaient — sans confirmation, sans sauvegarde derrière.
 *
 * Le dépôt s'interdit pourtant exactement cela ailleurs : *« en production,
 * jamais de repli silencieux vers un comportement de développement »*
 * (`src/server/env.ts`). Cette fonction applique la même exigence au seul
 * endroit qui détruit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **`NODE_ENV` ne suffit PAS, et c'est le cœur du dessin.**
 *
 * Une variable qu'on oublie de poser vaut `development` : s'en remettre à elle,
 * c'est faire dépendre l'effacement de toutes les données d'un oubli. On exige
 * donc que la cible se PROUVE : le nom de la base doit être l'un de ceux qu'on
 * a écrits ici, et l'hôte doit être local. Un défaut de configuration refuse,
 * il n'accorde pas.
 *
 * Fonction pure, dans `src/lib/`, pour que cela s'éprouve sans base — y compris
 * les cas qu'on ne veut surtout pas jouer en vrai
 * (`scripts/test-garde-seed.ts`).
 */

/** Les bases sur lesquelles effacer est sans conséquence. */
export const BASES_AUTORISEES = ["atlas_test", "atlas_dev"] as const;

/**
 * Les hôtes tenus pour locaux. `postgres` et `db` sont les noms de service des
 * deux `docker-compose` du dépôt : sans eux, le banc d'essai ne pourrait plus
 * refaire son jeu de démonstration, et le remède créerait une panne.
 */
export const HOTES_LOCAUX = ["localhost", "127.0.0.1", "::1", "postgres", "db"] as const;

/**
 * Ce qu'il faut écrire pour passer outre — en toutes lettres.
 *
 * **Pas un booléen, et c'est délibéré.** `ATLAS_SEED_FORCER=1` se pose par
 * distraction, se copie d'un terminal à l'autre, et survit dans un
 * `.bashrc`. Une phrase qui dit ce qu'elle fait ne se tape pas sans y penser.
 */
export const FORCAGE_ATTENDU = "oui-j-efface-tout";

export type RefusSeed =
  /** Aucune cible, ou une adresse qu'on ne sait pas lire. */
  | "cible-illisible"
  /** L'adresse ne nomme aucune base. */
  | "base-sans-nom"
  /** `NODE_ENV=production` : on ne discute pas. */
  | "production"
  /** Le nom de la base n'est pas l'un de ceux qu'on efface sans conséquence. */
  | "base-inconnue"
  /** La base est ailleurs que sur cette machine. */
  | "hote-distant"
  /** Forçage demandé, mais le mot de passe de démonstration n'est pas posé. */
  | "forcage-sans-mot-de-passe";

export type VerdictSeed =
  | { ok: true; force: boolean; base: string }
  | { ok: false; refus: RefusSeed; phrase: string };

export type ContexteSeed = {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
  /** La valeur de `ATLAS_SEED_FORCER`, telle qu'elle arrive. */
  forcage: string | undefined;
  /** La valeur de `ATLAS_MDP_DEMO`, telle qu'elle arrive. */
  motDePasseDemo: string | undefined;
};

/** Le nom de la base porté par une adresse PostgreSQL, ou `null`. */
function baseDe(url: URL): string | null {
  const nom = decodeURIComponent(url.pathname.replace(/^\//, "")).trim();
  return nom || null;
}

export function garderSeed(contexte: ContexteSeed): VerdictSeed {
  const { databaseUrl, nodeEnv, forcage, motDePasseDemo } = contexte;

  const refus = (refus: RefusSeed, phrase: string): VerdictSeed => ({ ok: false, refus, phrase });

  if (!databaseUrl?.trim()) {
    return refus("cible-illisible", "DATABASE_URL est absent : impossible de savoir quelle base serait effacée.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return refus("cible-illisible", "DATABASE_URL ne se lit pas comme une adresse : rien ne dit quelle base serait effacée.");
  }

  const base = baseDe(url);
  if (!base) {
    return refus("base-sans-nom", "DATABASE_URL ne nomme aucune base : rien ne dit ce qui serait effacé.");
  }

  const hote = url.hostname.toLowerCase();

  /**
   * **Le forçage vient ICI, après la lecture de la cible et avant les refus.**
   *
   * Après la lecture, pour que le message puisse nommer la base qu'on va
   * vraiment vider — forcer à l'aveugle, ce serait le défaut d'origine avec une
   * variable de plus.
   */
  if (forcage?.trim() === FORCAGE_ATTENDU) {
    // Forcer, c'est sortir du cadre : le mot de passe de démonstration écrit
    // dans un dépôt public n'a alors plus rien à faire là. On l'exige.
    if (!motDePasseDemo?.trim()) {
      return refus(
        "forcage-sans-mot-de-passe",
        "Forçage demandé sans ATLAS_MDP_DEMO : le mot de passe de démonstration du dépôt est public, " +
          "il ne doit pas se poser sur une base qu'on a dû forcer pour atteindre."
      );
    }
    return { ok: true, force: true, base };
  }

  if ((nodeEnv ?? "").trim() === "production") {
    return refus(
      "production",
      "NODE_ENV vaut « production » : le jeu de démonstration efface toutes les entreprises et tous les comptes.",
    );
  }

  if (!(BASES_AUTORISEES as readonly string[]).includes(base)) {
    return refus(
      "base-inconnue",
      `La base « ${base} » n'est pas une base d'essai connue (${BASES_AUTORISEES.join(", ")}). ` +
        "Le jeu de démonstration efface tout : il ne s'exécute que là où effacer est sans conséquence.",
    );
  }

  if (!(HOTES_LOCAUX as readonly string[]).includes(hote)) {
    return refus(
      "hote-distant",
      `La base « ${base} » se trouve sur « ${hote} », qui n'est pas cette machine. ` +
        "Une base d'essai qui porte le bon nom ailleurs reste la base de quelqu'un.",
    );
  }

  return { ok: true, force: false, base };
}

/** Ce qui s'affiche au terminal quand on refuse. Une phrase, puis quoi faire. */
export function phraseDeRefus(verdict: Extract<VerdictSeed, { ok: false }>): string {
  return (
    `❌ Le jeu de démonstration REFUSE de s'exécuter.\n\n` +
    `   ${verdict.phrase}\n\n` +
    `   Ce que fait ce script : il VIDE entièrement les tables (clients, chantiers,\n` +
    `   devis, factures, comptes) avant de réécrire un jeu inventé. Il n'y a pas de\n` +
    `   retour en arrière.\n\n` +
    `   Si c'est vraiment ce que vous voulez, sur cette base-là :\n` +
    `     ATLAS_SEED_FORCER=${FORCAGE_ATTENDU} ATLAS_MDP_DEMO=<un mot de passe> npm run db:seed\n`
  );
}
