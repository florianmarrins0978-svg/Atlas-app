import { createHash, randomUUID } from "node:crypto";

/**
 * L'API COMMUNE DES PLATEFORMES AGRÉÉES (AFNOR XP Z12-013, « Flow Service »).
 *
 * **Sa décision du 5 novembre 2026** (`ARCHITECTURE.md` §555, choix 1 A) :
 * Atlas fabrique la Factur-X, la plateforme de l'artisan la contrôle et la
 * transmet. Ce module ne connaît QUE la norme : la même porte pour toute
 * plateforme qui la parle, et c'est le catalogue (`catalogue.ts`) qui dit où
 * frapper.
 *
 * **Écrit d'après les contrats OpenAPI 1.3.0 de la norme** (annexe A), et
 * éprouvé contre une fausse plateforme qui les suit (`scripts/_fausse-plateforme.ts`).
 * Ce qui n'a PAS été éprouvé : une vraie plateforme. Le premier dépôt chez
 * Pennylane se joue sur son compte d'essai.
 *
 * | geste | appel |
 * |---|---|
 * | obtenir un jeton | OAuth2 « client credentials » à l'adresse du jeton ; sans identifiant, le secret EST le jeton |
 * | vérifier la liaison | `GET /v1/healthcheck`, après le jeton |
 * | déposer | `POST /v1/flows`, en multipart : `flowInfo` (JSON) et `file` (le PDF) |
 * | lire l'état | `GET /v1/flows/{flowId}` (métadonnées) : `acknowledgement.status` |
 *
 * **Ce qui revient au patron, c'est une phrase, jamais un code HTTP.** Trois
 * familles de refus, parce qu'elles appellent trois gestes différents :
 * `coupee` (ses identifiants ne valent plus : les remplacer), `injoignable`
 * (la plateforme ne répond pas : réessayer), `refusee` (elle a lu la facture
 * et la refuse : la corriger).
 */

export type Identifiants = { identifiant: string | null; secret: string };
export type AdressesPlateforme = { flux: string; jeton: string | null };

export type Refus = { ok: false; famille: "coupee" | "injoignable" | "refusee"; raison: string };
export type EtatDuFlux = "en_cours" | "transmise" | "refusee";

type Recuperer = typeof fetch;
const DELAI_MS = 15_000;

function injoignable(nom: string): Refus {
  return { ok: false, famille: "injoignable", raison: `${nom} ne répond pas. Réessayez dans un moment.` };
}
function coupee(nom: string): Refus {
  return { ok: false, famille: "coupee", raison: `${nom} refuse vos identifiants. Remplacez-les dans Réglages, Facture électronique.` };
}

/** Le texte d'un refus de la plateforme, lu dans sa réponse : jamais inventé. */
async function raisonsDe(reponse: Response): Promise<string | null> {
  try {
    const corps = (await reponse.json()) as Record<string, unknown>;
    const details = (corps.details ?? (corps.acknowledgement as Record<string, unknown> | undefined)?.details) as
      | { reasonMessage?: string; errorMessage?: string }[]
      | undefined;
    const lus = (details ?? []).map((d) => d.reasonMessage ?? d.errorMessage).filter((t): t is string => !!t?.trim());
    const message = (corps.errorMessage ?? corps.message ?? corps.error_description) as string | undefined;
    return lus.length ? lus.join(" ") : message?.trim() || null;
  } catch {
    // Un corps illisible n'est pas une raison : l'appelant dit le code à la place.
    return null;
  }
}

export async function jetonDAcces(
  nom: string,
  adresses: AdressesPlateforme,
  ids: Identifiants,
  recuperer: Recuperer = fetch
): Promise<{ ok: true; jeton: string } | Refus> {
  // Sans identifiant, le secret est un jeton d'accès (le « BearerAuth » de la norme).
  if (!ids.identifiant) return { ok: true, jeton: ids.secret };
  if (!adresses.jeton) return { ok: false, famille: "coupee", raison: `${nom} n'accepte pas encore d'identifiant ici : collez un jeton d'accès.` };
  let reponse: Response;
  try {
    reponse = await recuperer(adresses.jeton, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: ids.identifiant, client_secret: ids.secret }),
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch {
    return injoignable(nom);
  }
  if (reponse.status === 400 || reponse.status === 401 || reponse.status === 403) return coupee(nom);
  if (!reponse.ok) return injoignable(nom);
  const corps = (await reponse.json().catch(() => ({}))) as { access_token?: string };
  if (!corps.access_token) return injoignable(nom);
  return { ok: true, jeton: corps.access_token };
}

async function appeler(
  nom: string,
  adresses: AdressesPlateforme,
  ids: Identifiants,
  chemin: string,
  init: RequestInit,
  recuperer: Recuperer
): Promise<{ ok: true; reponse: Response } | Refus> {
  const jeton = await jetonDAcces(nom, adresses, ids, recuperer);
  if (!jeton.ok) return jeton;
  let reponse: Response;
  try {
    reponse = await recuperer(`${adresses.flux}${chemin}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${jeton.jeton}`, "Request-Id": randomUUID() },
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch {
    return injoignable(nom);
  }
  if (reponse.status === 401 || reponse.status === 403) return coupee(nom);
  if (reponse.status === 429 || reponse.status >= 500) return injoignable(nom);
  return { ok: true, reponse };
}

/** La liaison répond-elle ? Appelé avant d'enregistrer des identifiants. */
export async function verifierLaLiaison(
  nom: string,
  adresses: AdressesPlateforme,
  ids: Identifiants,
  recuperer: Recuperer = fetch
): Promise<{ ok: true } | Refus> {
  const r = await appeler(nom, adresses, ids, "/v1/healthcheck", { method: "GET" }, recuperer);
  if (!r.ok) return r;
  return r.reponse.ok ? { ok: true } : injoignable(nom);
}

export async function deposerLaFactureX(
  nom: string,
  adresses: AdressesPlateforme,
  ids: Identifiants,
  piece: { fichier: string; pdf: Uint8Array; suivi: string },
  recuperer: Recuperer = fetch
): Promise<{ ok: true; fluxId: string } | Refus> {
  const formulaire = new FormData();
  formulaire.append(
    "flowInfo",
    new Blob(
      [
        JSON.stringify({
          trackingId: piece.suivi,
          name: piece.fichier,
          flowSyntax: "Factur-X",
          processingRule: "B2B",
          sha256: createHash("sha256").update(piece.pdf).digest("hex"),
        }),
      ],
      { type: "application/json" }
    )
  );
  formulaire.append("file", new Blob([Buffer.from(piece.pdf)], { type: "application/pdf" }), piece.fichier);
  const r = await appeler(nom, adresses, ids, "/v1/flows", { method: "POST", body: formulaire }, recuperer);
  if (!r.ok) return r;
  if (r.reponse.status === 202 || r.reponse.status === 200 || r.reponse.status === 201) {
    const corps = (await r.reponse.json().catch(() => ({}))) as { flowId?: string };
    if (corps.flowId) return { ok: true, fluxId: corps.flowId };
    return injoignable(nom);
  }
  const raison = await raisonsDe(r.reponse);
  return { ok: false, famille: "refusee", raison: raison ? `${nom} refuse la facture : ${raison}` : `${nom} refuse la facture (code ${r.reponse.status}).` };
}

export async function etatDuFlux(
  nom: string,
  adresses: AdressesPlateforme,
  ids: Identifiants,
  fluxId: string,
  recuperer: Recuperer = fetch
): Promise<{ ok: true; etat: EtatDuFlux; raison: string | null } | Refus> {
  const r = await appeler(nom, adresses, ids, `/v1/flows/${encodeURIComponent(fluxId)}?docType=Metadata`, { method: "GET" }, recuperer);
  if (!r.ok) return r;
  if (!r.reponse.ok) return injoignable(nom);
  const corps = (await r.reponse.json().catch(() => ({}))) as {
    acknowledgement?: { status?: string; details?: { reasonMessage?: string }[] };
  };
  const statut = corps.acknowledgement?.status;
  if (statut === "Ok") return { ok: true, etat: "transmise", raison: null };
  if (statut === "Error") {
    const raisons = (corps.acknowledgement?.details ?? []).map((d) => d.reasonMessage).filter((t): t is string => !!t?.trim());
    return { ok: true, etat: "refusee", raison: raisons.join(" ") || null };
  }
  return { ok: true, etat: "en_cours", raison: null };
}
