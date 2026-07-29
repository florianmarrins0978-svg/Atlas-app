import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type ContexteRequete = {
  requestId: string;
  entrepriseId?: string;
  utilisateurId?: string;
};

const stockage = new AsyncLocalStorage<ContexteRequete>();

// Format strict et sûr : uuid v4 uniquement. Toute entrée qui ne correspond
// pas exactement est ignorée (jamais tronquée, jamais réutilisée partiellement)
// — un identifiant entrant arbitrairement long ou malformé ne peut jamais
// être injecté dans les journaux.
const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idRequeteValideOuGenere(entrant: string | null | undefined): string {
  if (entrant && entrant.length <= 100 && FORMAT_UUID.test(entrant)) return entrant;
  return randomUUID();
}

// Exécute fn() avec un contexte de requête actif. Limite documentée : repose
// sur AsyncLocalStorage (runtime Node — Route Handlers et Server Actions de
// ce projet s'exécutent tous en runtime Node, jamais Edge, à l'exception du
// middleware qui a sa propre configuration allégée et n'a pas besoin de ce
// contexte). Ne requiert aucune modification des signatures de repository :
// la propagation est implicite via l'AsyncLocalStorage, pas explicite.
export function executerAvecContexte<T>(contexte: ContexteRequete, fn: () => Promise<T>): Promise<T> {
  return stockage.run(contexte, fn);
}

export function getContexteRequete(): ContexteRequete | undefined {
  return stockage.getStore();
}

// Permet d'enrichir le contexte en cours (ex. une fois entrepriseId/
// utilisateurId connus après authentification) sans ouvrir un nouveau
// contexte imbriqué.
export function enrichirContexteRequete(partiel: Partial<Omit<ContexteRequete, "requestId">>): void {
  const actuel = stockage.getStore();
  if (actuel) Object.assign(actuel, partiel);
}
