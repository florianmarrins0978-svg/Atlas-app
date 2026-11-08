import { logger } from "@/server/logger";
import {
  PORTEE_URSSAF,
  type DemandePaiementUrssaf,
  type ParticulierUrssaf,
} from "@/lib/urssaf/avance-immediate";

/**
 * LA LIAISON AVEC L'URSSAF pour l'avance immédiate du crédit d'impôt.
 *
 * **Ce qu'elle fait, et rien d'autre** (description officielle de l'API
 * « Tiers de prestation », version 1.29.1) : obtenir un jeton avec les deux
 * codes que l'Urssaf donne à l'artisan, inscrire un client, transmettre une
 * demande de paiement, relire où en sont les demandes. Les règles de ce qui
 * part vivent dans `@/lib/urssaf/avance-immediate`, éprouvées sans réseau.
 *
 * **Les deux codes.** `client_id` et `client_secret`, envoyés en
 * authentification « Basic » au service de jeton, avec la portée
 * `homeplus.tiersprestations` (OAuth2 « client credentials »). Ils ne sont
 * jamais écrits dans le journal, même en cas de refus.
 *
 * **Un refus attendu se rend en VALEUR, jamais en exception** : une action
 * serveur de Next.js remplace le message d'une exception par un identifiant
 * opaque, et l'écran ne pourrait plus dire pourquoi l'Urssaf a refusé
 * (`HANDOVER.md`, piège 0 ter).
 *
 * **Les adresses sont surchargeables** (`URSSAF_ATP_BASE`, `URSSAF_JETON_URL`,
 * ou les options) pour deux raisons : les contrôles font répondre un faux
 * serveur, et l'Urssaf donne un bac à sable dont l'adresse n'est pas dans la
 * description officielle. Elle se pose quand l'Urssaf l'aura donnée, jamais
 * devinée.
 */

/** Les adresses de production, recopiées de la description officielle. */
const BASE_PAR_DEFAUT = "https://api.urssaf.fr/atp/v1/tiersPrestations";
const JETON_PAR_DEFAUT = "https://api.urssaf.fr/api/oauth/v1/token";

/** Au-delà, la page attend trop : on rend la main et l'écran le dit. */
const DELAI_MS = 15_000;
/** Un jeton se renouvelle une minute avant sa fin, jamais pendant un envoi. */
const MARGE_JETON_MS = 60_000;

export type IdentifiantsUrssaf = { clientId: string; clientSecret: string };

export type OptionsUrssaf = {
  base?: string;
  jetonUrl?: string;
  /** Pour les contrôles : un faux réseau, une fausse horloge. */
  fetch?: typeof fetch;
  maintenant?: () => number;
  delaiMs?: number;
};

/** Une erreur telle que l'Urssaf la décrit (définition `Erreur`). */
export type ErreurUrssaf = { code?: string; message?: string; description?: string };

export type RefusUrssaf =
  | { ok: false; raison: "codes-refuses" }
  | { ok: false; raison: "refuse"; statutHttp: number; erreurs: ErreurUrssaf[] }
  | { ok: false; raison: "injoignable" }
  | { ok: false; raison: "illisible"; statutHttp: number };

export type ReponseUrssaf<T> = ({ ok: true } & T) | RefusUrssaf;

export type DemandeTransmise = {
  idClient?: string;
  idDemandePaiement?: string;
  numFactureTiers?: string;
  statut?: string;
  errors?: ErreurUrssaf[];
};

export type DemandeSuivie = {
  idDemandePaiement?: string;
  demandePaiement?: Partial<DemandePaiementUrssaf>;
  statut?: { code?: string; libelle?: string };
  infoRejet?: { code?: string; commentaire?: string };
  infoVirement?: { mntVirement?: number; dateVirement?: string };
};

/** Les erreurs d'un corps de refus, quelle que soit leur enveloppe. */
function erreursDe(corps: unknown): ErreurUrssaf[] {
  if (Array.isArray(corps)) return corps.filter((e) => e && typeof e === "object") as ErreurUrssaf[];
  if (corps && typeof corps === "object") {
    const o = corps as Record<string, unknown>;
    if (Array.isArray(o.errors)) return erreursDe(o.errors);
    if (Array.isArray(o.erreurs)) return erreursDe(o.erreurs);
    if (typeof o.code === "string" || typeof o.message === "string") return [o as ErreurUrssaf];
  }
  return [];
}

/**
 * Un client de l'API pour UNE entreprise : ses deux codes, son jeton. Rien
 * n'est partagé entre deux entreprises, pas même le jeton.
 */
export function clientUrssaf(ids: IdentifiantsUrssaf, options: OptionsUrssaf = {}) {
  const base = (options.base ?? process.env.URSSAF_ATP_BASE ?? BASE_PAR_DEFAUT).replace(/\/+$/, "");
  const jetonUrl = options.jetonUrl ?? process.env.URSSAF_JETON_URL ?? JETON_PAR_DEFAUT;
  const appeler = options.fetch ?? fetch;
  const maintenant = options.maintenant ?? Date.now;
  const delai = options.delaiMs ?? DELAI_MS;
  let jeton: { valeur: string; finMs: number } | null = null;

  async function obtenirJeton(neuf: boolean): Promise<{ ok: true; valeur: string } | RefusUrssaf> {
    if (!neuf && jeton && jeton.finMs - MARGE_JETON_MS > maintenant()) return { ok: true, valeur: jeton.valeur };
    let reponse: Response;
    try {
      reponse = await appeler(jetonUrl, {
        method: "POST",
        signal: AbortSignal.timeout(delai),
        headers: {
          Authorization: `Basic ${btoa(`${ids.clientId}:${ids.clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ grant_type: "client_credentials", scope: PORTEE_URSSAF }).toString(),
      });
    } catch (e) {
      logger.error("Urssaf injoignable (jeton)", { err: String(e) });
      return { ok: false, raison: "injoignable" };
    }
    // 400 et 401 au jeton : ce sont les codes qui ne passent pas. L'écran le
    // dit en ces mots, au lieu d'un refus générique qui enverrait chercher
    // ailleurs.
    if (reponse.status === 400 || reponse.status === 401 || reponse.status === 403) {
      logger.error("Urssaf : codes refusés au jeton", { statut: reponse.status });
      return { ok: false, raison: "codes-refuses" };
    }
    if (!reponse.ok) {
      logger.error("Urssaf : le jeton est refusé", { statut: reponse.status });
      return { ok: false, raison: "refuse", statutHttp: reponse.status, erreurs: [] };
    }
    let corps: { access_token?: unknown; expires_in?: unknown };
    try {
      corps = (await reponse.json()) as typeof corps;
    } catch {
      return { ok: false, raison: "illisible", statutHttp: reponse.status };
    }
    if (typeof corps.access_token !== "string" || !corps.access_token) {
      return { ok: false, raison: "illisible", statutHttp: reponse.status };
    }
    const dureeS = typeof corps.expires_in === "number" && corps.expires_in > 0 ? corps.expires_in : 0;
    jeton = { valeur: corps.access_token, finMs: maintenant() + dureeS * 1000 };
    return { ok: true, valeur: corps.access_token };
  }

  /**
   * Un appel à l'API. Un 401 sur un jeton qu'on croyait bon (révoqué, horloge
   * décalée) se rejoue UNE fois avec un jeton neuf, pas davantage : une
   * boucle cacherait des codes devenus mauvais.
   */
  async function requete<T>(methode: "GET" | "POST", chemin: string, corpsEnvoye?: unknown): Promise<ReponseUrssaf<{ valeur: T }>> {
    for (const neuf of [false, true]) {
      const j = await obtenirJeton(neuf);
      if (!j.ok) return j;
      let reponse: Response;
      try {
        reponse = await appeler(`${base}${chemin}`, {
          method: methode,
          signal: AbortSignal.timeout(delai),
          headers: {
            Authorization: `Bearer ${j.valeur}`,
            Accept: "application/json",
            ...(corpsEnvoye === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(corpsEnvoye === undefined ? {} : { body: JSON.stringify(corpsEnvoye) }),
        });
      } catch (e) {
        logger.error("Urssaf injoignable", { chemin, err: String(e) });
        return { ok: false, raison: "injoignable" };
      }
      if (reponse.status === 401 && !neuf) continue;
      let corps: unknown = null;
      const texte = await reponse.text();
      if (texte.trim()) {
        try {
          corps = JSON.parse(texte);
        } catch {
          logger.error("Réponse de l'Urssaf illisible", { chemin, statut: reponse.status });
          return { ok: false, raison: "illisible", statutHttp: reponse.status };
        }
      }
      if (!reponse.ok) {
        const erreurs = erreursDe(corps);
        logger.error("L'Urssaf a refusé", { chemin, statut: reponse.status, erreurs });
        // Un second 401, avec un jeton tout neuf : ce sont les codes.
        if (reponse.status === 401) return { ok: false, raison: "codes-refuses" };
        return { ok: false, raison: "refuse", statutHttp: reponse.status, erreurs };
      }
      return { ok: true, valeur: corps as T };
    }
    return { ok: false, raison: "codes-refuses" };
  }

  return {
    /** Vérifie les deux codes, sans rien envoyer d'autre : le geste « Relier ». */
    async verifierCodes(): Promise<{ ok: true } | RefusUrssaf> {
      const j = await obtenirJeton(true);
      return j.ok ? { ok: true } : j;
    },

    /** Inscrit un client ; l'Urssaf rend son identifiant, à garder sur sa fiche. */
    async inscrireParticulier(particulier: ParticulierUrssaf): Promise<ReponseUrssaf<{ idClient: string }>> {
      const r = await requete<{ idClient?: unknown }>("POST", "/particulier", particulier);
      if (!r.ok) return r;
      const idClient = r.valeur && typeof r.valeur.idClient === "string" ? r.valeur.idClient : "";
      if (!idClient) return { ok: false, raison: "illisible", statutHttp: 200 };
      return { ok: true, idClient };
    },

    /**
     * Où en est l'inscription d'un client (a-t-il activé son compte ?).
     * Absent de la description 1.29.1, mais employé par deux intégrations
     * publiques (`GET /particulier?idClient=`). À confirmer sur le bac à sable.
     */
    async statutParticulier(idClient: string): Promise<ReponseUrssaf<{ statut: unknown }>> {
      const r = await requete<unknown>("GET", `/particulier?idClient=${encodeURIComponent(idClient)}`);
      return r.ok ? { ok: true, statut: r.valeur } : r;
    },

    /** Transmet UNE facture. L'API prend une liste ; Atlas en envoie une à la fois. */
    async transmettreDemande(demande: DemandePaiementUrssaf): Promise<ReponseUrssaf<{ demande: DemandeTransmise }>> {
      const r = await requete<unknown>("POST", "/demandePaiement", [demande]);
      if (!r.ok) return r;
      const premiere = Array.isArray(r.valeur) ? (r.valeur[0] as DemandeTransmise | undefined) : undefined;
      if (!premiere) return { ok: false, raison: "illisible", statutHttp: 200 };
      return { ok: true, demande: premiere };
    },

    /** Relit des demandes par leurs identifiants, ou sur une période. */
    async rechercherDemandes(filtre: { idDemandePaiements?: string[]; dateDebut?: string; dateFin?: string }): Promise<ReponseUrssaf<{ demandes: DemandeSuivie[]; erreurs: ErreurUrssaf[] }>> {
      const corps = {
        ...(filtre.idDemandePaiements?.length ? { idDemandePaiements: filtre.idDemandePaiements } : {}),
        ...(filtre.dateDebut ? { dateDebut: `${filtre.dateDebut}T00:00:00.000Z` } : {}),
        ...(filtre.dateFin ? { dateFin: `${filtre.dateFin}T00:00:00.000Z` } : {}),
      };
      const r = await requete<{ infoDemandePaiements?: unknown; errors?: unknown }>("POST", "/demandePaiement/rechercher", corps);
      if (!r.ok) return r;
      const demandes = Array.isArray(r.valeur?.infoDemandePaiements) ? (r.valeur.infoDemandePaiements as DemandeSuivie[]) : [];
      return { ok: true, demandes, erreurs: erreursDe(r.valeur?.errors) };
    },
  };
}
