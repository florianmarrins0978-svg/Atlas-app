/**
 * LES ÉTAPES DE LA BATTERIE — une seule table, pour la jouer ENTIÈRE ou UNE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa colère du 17 septembre 2026, à 23 h :** *« ça recommence et c'est ça à
 * chaque fois ! »*, devant une session qui repartait pour cinquante minutes
 * après avoir corrigé **une ligne de documentation**.
 *
 * Voici pourquoi elle repartait. Une étape qui n'est pas un moteur de suites —
 * Types, Lint, Construction, Mémoire du dépôt, Fournisseurs d'IA, Connexion —
 * tombe dans `rougesHorsSuites`, et le garde-fou refuse la fusion tant qu'il y
 * en a une. Or **rien ne savait rejouer une étape seule** : cette table vivait
 * à l'intérieur du script de la batterie, qui ne sait faire que tout. Corriger
 * un rouge de trois secondes coûtait donc la mesure entière, et la mesure
 * entière produisait le rouge suivant. C'est la boucle.
 *
 * La table vit donc ici, et deux commandes la lisent : la batterie
 * (`verifier-avant-livraison.ts`) et le rattrapage
 * (`verifier-ce-qui-a-bouge.ts`), qui rejoue ce qui était rouge et ce que la
 * correction peut casser. **Une seule table** — deux copies de la même vérité
 * finissent toujours par diverger (`CLAUDE.md` §3).
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { AUTH, CRON, IA_COUPEE, SANS_CLES_IA } from "./_bases-essai";

export type Etape = {
  nom: string;
  commande: string;
  args: string[];
  /**
   * Un moteur de suites : sa sortie nomme chaque suite tombée, et c'est ce
   * qui permet de comparer un verdict à l'état connu de `main`. Les autres
   * étapes n'ont pas de « rouge connu » — chez elles, un rouge est toujours
   * nouveau.
   */
  suites?: true;
  /** Variables propres à l'étape ; le reste de l'environnement est repris. */
  env?: Record<string, string>;
  /**
   * Variables à RETIRER pour cette étape. Nécessaire parce que l'environnement
   * ambiant est repris : une variable présente par accident suffit à changer le
   * comportement d'une suite.
   */
  envSupprime?: string[];
  /** Pourquoi cette étape existe — affiché quand elle échoue. */
  ceQueCaAttrape: string;
};

/** Les adresses de l'atelier qui mesure — jamais devinées, toujours passées. */
export type Adresses = { APP: string; OWNER: string; SUPER: string; REDIS: Record<string, string>; DIST_VERIFICATION: string };

export function etapesDeLaBatterie({ APP, OWNER, SUPER, REDIS, DIST_VERIFICATION }: Adresses): Etape[] {
  return [
    {
      nom: "Types",
      commande: "npm",
      args: ["run", "typecheck"],
      ceQueCaAttrape: "un appel qui ne correspond plus à sa signature",
    },
    {
      nom: "Lint",
      commande: "npm",
      args: ["run", "lint"],
      ceQueCaAttrape: "les pièges connus de React et de Next",
    },
    {
      // **La base de CET atelier, montée si elle n'existe pas encore.**
      //
      // Au rang 0 elle existe déjà : l'étape ne fait que vérifier qu'on l'atteint,
      // ce qui vaut mieux que de le découvrir six étapes plus loin sur un
      // « compte de démonstration absent » qui accuse le navigateur.
      nom: "Atelier",
      commande: "npx",
      args: ["tsx", "scripts/preparer-atelier.ts"],
      env: { ATLAS_BASE_SUPER: SUPER, ATLAS_BASE_OWNER: OWNER, ATLAS_BASE_APP: APP },
      envSupprime: SANS_CLES_IA,
      ceQueCaAttrape:
        "une base d'essai injoignable — et, quand plusieurs sessions mesurent,\n" +
        "     deux batteries qui s'effaceraient mutuellement leurs données",
    },
    {
      // **LA CONSTRUCTION, et il aura fallu une soirée entière pour l'ajouter.**
      //
      // Le 16 août 2026, le patron : « l'appli est vraiment très lente, mais
      // vraiment ». Son banc servait le mode développement, où chaque écran se
      // compile à l'ouverture, parce que `next build` échouait chez lui à chaque
      // démarrage. Or cette batterie vérifiait les types, le lint, la mémoire,
      // les suites base, les suites navigateur et une connexion réelle — **et ne
      // bâtissait jamais**. Une panne qui n'existe qu'à la construction
      // traversait donc les cinquante-huit contrôles au vert, et c'est LUI qui la
      // découvrait, un soir, en cliquant.
      //
      // Les suites navigateur ne la rattrapent pas : elles démarrent un serveur
      // de DÉVELOPPEMENT, qui compile à la demande et ne passe jamais par le
      // chemin de production — vérification des types de routes, rendu statique,
      // découpage des paquets. Le typecheck non plus : `tsc` ne connaît pas les
      // types de routes qu'engendre Next.
      //
      // Placée tôt, juste après le lint : elle dure deux à trois minutes, et
      // découvrir à la vingtième que rien ne se bâtit ferait perdre les dix-neuf
      // autres.
      nom: "Construction",
      commande: "npm",
      args: ["run", "build"],
      // Dans SON dossier, comme le banc : sans quoi la construction écraserait le
      // `.next` d'un serveur de développement qui tourne peut-être à côté.
      //
      // **`DATABASE_URL` posée ici, et ce n'est pas une commodité (20 août 2026).**
      // La construction *collecte les données de page*, ce qui instancie la
      // configuration du serveur : sans elle, elle s'arrête sur « Variable
      // d'environnement obligatoire manquante : DATABASE_URL » en accusant une
      // route d'agenda qui n'y est pour rien. La CI, elle, la pose au niveau du
      // job (`ci.yml`) et bâtit donc sans broncher — **l'étape locale ne jouait
      // pas ce que la CI joue**, et son rouge permanent apprenait à ignorer le
      // seul contrôle qui protège le banc du mode lent. Aucune requête n'est
      // faite pendant une construction : cette adresse n'a qu'à être lisible.
      env: { ATLAS_DIST_DIR: DIST_VERIFICATION, DATABASE_URL: APP },
      ceQueCaAttrape: "une erreur qui n'existe qu'à la construction — et qui condamne le banc au mode lent",
    },
    {
      nom: "Mémoire du dépôt",
      commande: "npm",
      args: ["run", "verifier:memoire"],
      ceQueCaAttrape: "une documentation qui décrit une version qui n'existe plus",
    },
    {
      nom: "Fournisseurs d'IA",
      commande: "npm",
      args: ["run", "verifier:ia"],
      // Volontairement SANS `envSupprime` : cette étape lit la configuration
      // réelle de la machine. Aucun appel réseau — il faut `--reseau` pour cela.
      env: { DATABASE_URL: APP },
      ceQueCaAttrape: "un fournisseur choisi sans sa clé, ou un nom de fournisseur mal orthographié",
    },
    {
      nom: "Suites base de données",
      commande: "npm",
      args: ["test"],
      suites: true,
      env: { DATABASE_URL: APP, DATABASE_ADMIN_URL: OWNER, ...AUTH, ...IA_COUPEE },
      // REDIS_URL retiré, et ce n'est pas un détail de configuration : avec
      // cette variable, la suite des propositions IA ouvre une connexion Redis
      // qui n'est jamais refermée, le processus ne se termine plus, et la
      // batterie entière reste bloquée sans le moindre message. Constaté deux
      // fois de suite, puis isolé : code 124 (délai dépassé) avec la variable,
      // code 0 sans. La CI ne la fournit pas non plus à cette étape.
      envSupprime: ["REDIS_URL", ...SANS_CLES_IA],
      ceQueCaAttrape: "l'isolation entre entreprises, les règles métier, la RLS",
    },
    {
      // `npm test` vide la base : sans réamorçage, l'étape suivante échouerait
      // sur un compte manquant et accuserait le navigateur.
      nom: "Données de démonstration",
      commande: "npx",
      args: ["tsx", "src/server/db/seed.ts"],
      env: { DATABASE_URL: SUPER, ...AUTH },
      envSupprime: ["REDIS_URL", ...SANS_CLES_IA],
      ceQueCaAttrape: "rien — c'est une remise en état, pas un contrôle",
    },
    {
      nom: "Suites navigateur",
      commande: "npm",
      args: ["run", "test:e2e"],
      suites: true,
      // Redis ici, comme en CI : la limitation de débit doit être remise à zéro
      // entre deux suites, ce que la mémoire du serveur ne permet pas.
      env: { DATABASE_URL: SUPER, ...AUTH, ...CRON, ...REDIS, ...IA_COUPEE },
      envSupprime: SANS_CLES_IA,
      ceQueCaAttrape: "le parcours complet, du devis à la facture",
    },
    {
      nom: "Connexion derrière un proxy",
      commande: "npx",
      args: ["tsx", "scripts/verifier-connexion-avec-serveur.mts"],
      env: { DATABASE_URL: SUPER, ...AUTH, ...CRON, ...REDIS, ...IA_COUPEE },
      envSupprime: SANS_CLES_IA,
      ceQueCaAttrape:
        "« Invalid Server Actions request. » — le défaut qui a coûté une demi-journée au patron,\n" +
        "     invisible partout ailleurs parce que tout le reste interroge 127.0.0.1",
    },
    ];
}
