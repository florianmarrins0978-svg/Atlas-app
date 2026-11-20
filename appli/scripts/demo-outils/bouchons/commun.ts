/**
 * CE QUE LE SERVEUR RENDRAIT, SANS SERVEUR.
 *
 * La démonstration des outils, sur le site de vente (appli/vente/outils.html),
 * fait tourner les VRAIS écrans de l'appli dans le téléphone de la page : les
 * mêmes composants, le même calcul, la même feuille de style. Seules les
 * actions serveur (un fichier qui commence par « use server ») ne peuvent pas
 * venir : il n'y a ni session, ni base, ni IA sur une page publiée. Le
 * construire.ts les remplace, export par export, par ce qui est écrit ici.
 *
 * **Un geste qu'on ne sait pas rendre se dit, il ne fait pas semblant** :
 * toute action qui n'a pas son bouchon rend un refus en clair, comme l'appli
 * le ferait sans réseau.
 */
export type Action = (...args: unknown[]) => Promise<unknown>;

// Les écrans lisent leur refus sous l'un ou l'autre nom : `raison`, ou
// `phrase` (le diagnostic). Le même texte sous les deux.
export const refus = (raison: string) => async () => ({ ok: false, etat: "refus", raison, phrase: raison });
export const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DANS_L_APPLI = "Dans l’appli, ce geste part pour de vrai. Ici, c’est une démonstration.";

/** Une valeur d'un module du serveur (un journal, une configuration). */
const CONSTANTES: Record<string, Record<string, unknown>> = {
  "src/server/logger.ts": { logger: { info() {}, warn() {}, error() {}, debug() {}, child() { return this; } } },
};
const RIEN: unknown = new Proxy(function () {}, { get: (_c, k) => (k === "then" ? undefined : RIEN), apply: () => RIEN });

/** Ce que construire.ts branche à la place de chaque export remplacé. */
export function fabrique(bouchons: Record<string, Record<string, Action>>) {
  return {
    bouchon: (fichier: string, nom: string, action = true): Action =>
      bouchons[fichier]?.[nom] ?? (action ? refus(DANS_L_APPLI) : async () => undefined),
    constante: (fichier: string, nom: string): unknown => CONSTANTES[fichier]?.[nom] ?? RIEN,
  };
}
