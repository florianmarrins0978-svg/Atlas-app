/**
 * D'où l'on vient quand on ouvre la fiche d'un client, et donc où la flèche
 * ramène.
 *
 * **Sa remarque du 20 août 2026, capture à l'appui :** *« Quand j'appuie sur
 * retour, ça ne me fait pas un retour, mais deux retours. Je reviens
 * directement à la page vos chantiers. Or, je devrais rester dans la catégorie
 * mes clients. »*
 *
 * Il avait raison, et le défaut était écrit noir sur blanc : la fiche renvoyait
 * toujours à l'accueil (`href: "/"`), quel que soit l'écran d'où l'on venait.
 * Depuis la liste des clients, un seul appui sautait donc **deux** écrans.
 *
 * **Pourquoi une fonction plutôt qu'un lien en dur.** La fiche s'atteint depuis
 * DEUX endroits — la liste des clients, et le tiroir d'un chantier. Un retour
 * fixe se trompe forcément pour l'un des deux : renvoyer toujours vers les
 * clients ferait sortir du chantier celui qui y était. On transporte donc
 * l'origine dans l'adresse, et cette règle la traduit — une seule fois, hors de
 * tout écran (`CLAUDE.md` §3).
 *
 * **À NE PAS CONFONDRE AVEC `retour-du-devis.ts`.** Deux écrans s'appellent
 * « fiche client » : celui-ci, `/clients/[id]`, qui montre ce que l'application
 * SAIT du client — et `/chantiers/[id]/coordonnees`, le formulaire qu'on
 * REMPLIT, titré « Fiche client » à l'écran. Les deux transportent leur origine
 * sous le même nom (`?de=`), et chacun a sa règle : les mêler ferait sortir d'un
 * chantier celui qui y était.
 */

/** Le retour par défaut : la liste des clients, d'où l'on vient presque toujours. */
const VERS_LES_CLIENTS = { href: "/clients", libelle: "Retour à vos clients" } as const;

/**
 * Un chemin de chantier, et rien d'autre.
 *
 * **Le filtre n'est pas une précaution de principe.** Cette valeur vient de
 * l'adresse, donc de n'importe qui : sans lui, `?de=https://ailleurs.example`
 * ferait de la flèche « retour » une porte de sortie vers un site étranger, et
 * `?de=javascript:…` pire encore. On n'accepte donc qu'une forme connue, et
 * tout le reste retombe sur les clients — jamais une erreur, jamais un vide.
 */
const CHANTIER = /^\/chantiers\/[0-9a-fA-F-]{36}$/;

export type Retour = { href: string; libelle: string };

/**
 * Où la flèche de la fiche client doit ramener.
 *
 * @param de La valeur du paramètre `de` de l'adresse, telle qu'elle arrive.
 */
export function retourFicheClient(de: string | null | undefined): Retour {
  if (typeof de !== "string") return { ...VERS_LES_CLIENTS };
  const chemin = de.trim();
  if (CHANTIER.test(chemin)) return { href: chemin, libelle: "Retour au chantier" };
  return { ...VERS_LES_CLIENTS };
}

/** L'adresse de la fiche d'un client, en disant d'où l'on part. */
export function versFicheClient(clientId: string, depuis?: string): string {
  const base = `/clients/${clientId}`;
  if (!depuis) return base;
  return `${base}?de=${encodeURIComponent(depuis)}`;
}
