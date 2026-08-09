import type { PeriodeOccupee } from "../../lib/agenda-externe";

/**
 * Le raccordement à Google Agenda.
 *
 * **Ce fichier est le seul du lot qui n'a pas pu être éprouvé ici, et il est
 * écrit pour que ce soit vrai le plus étroitement possible.** L'environnement
 * de développement n'a pas de compte Google, et son mandataire réseau refuse
 * les adresses de Google. Tout ce qui *décide* de quelque chose — quelles
 * demi-journées un rendez-vous occupe, comment elles se fondent dans le
 * planning — vit dans `src/lib/agenda-externe.ts`, ne parle à personne, et est
 * couvert par `scripts/test-agenda-externe.ts`.
 *
 * Ici, il ne reste que trois appels HTTP et la lecture de leurs réponses. C'est
 * la part irréductible : elle ne se vérifiera qu'avec de vrais identifiants,
 * et `docs/A-FAIRE.md` §7 dit qui peut les créer.
 *
 * **Ce que ce module ne demande jamais à Google.** La portée est
 * `calendar.freebusy` — « quand suis-je occupé », rien d'autre. Elle ne donne
 * accès ni aux intitulés, ni aux invités, ni au contenu des rendez-vous. Ce
 * n'est pas de la discrétion volontaire qu'on pourrait oublier un jour : c'est
 * Google qui refuse de les rendre, et c'est bien plus solide.
 */

/** Ce que l'installation doit poser pour que le raccordement existe. */
export type ConfigurationGoogle = {
  clientId: string;
  clientSecret: string;
  /** L'adresse de retour, déclarée à l'identique dans la console Google. */
  redirection: string;
};

/**
 * La portée demandée, et elle est délibérément minuscule.
 *
 * `calendar.freebusy` ne rend que des intervalles occupés. Demander
 * `calendar.readonly` aurait été plus simple — et aurait donné à Atlas les
 * intitulés de tous les rendez-vous de l'artisan, dont il n'a aucun besoin.
 * Une permission qu'on ne demande pas est une fuite qui ne peut pas arriver.
 */
export const PORTEE_GOOGLE = "https://www.googleapis.com/auth/calendar.freebusy";

const AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
const JETONS = "https://oauth2.googleapis.com/token";
const FREEBUSY = "https://www.googleapis.com/calendar/v3/freeBusy";

/**
 * La configuration, si elle existe.
 *
 * **Sans elle, personne n'est relié, et jamais l'inverse.** Une installation
 * qui ne dit rien ne doit pas ouvrir un raccordement à moitié configuré : le
 * défaut de configuration refuse, il n'accorde pas. Même règle que pour
 * l'éditeur (`src/server/editeur.ts`).
 */
export function configurationGoogle(): ConfigurationGoogle | null {
  const clientId = (process.env.ATLAS_GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.ATLAS_GOOGLE_CLIENT_SECRET ?? "").trim();
  const redirection = (process.env.ATLAS_GOOGLE_REDIRECTION ?? "").trim();
  if (!clientId || !clientSecret || !redirection) return null;
  return { clientId, clientSecret, redirection };
}

/** L'adresse vers laquelle envoyer l'artisan pour qu'il donne son accord. */
export function urlDeConsentement(config: ConfigurationGoogle, etat: string): string {
  const p = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirection,
    response_type: "code",
    scope: PORTEE_GOOGLE,
    // `offline` : sans lui, Google ne rend pas de jeton de rafraîchissement et
    // le raccordement meurt au bout d'une heure, sans rien dire.
    access_type: "offline",
    // `consent` : Google ne renvoie le jeton de rafraîchissement QUE la
    // première fois, sauf à le redemander explicitement. Sans cela, un artisan
    // qui rebranche son agenda obtient un raccordement muet qui expirera.
    prompt: "consent",
    state: etat,
  });
  return `${AUTORISATION}?${p.toString()}`;
}

export type JetonsGoogle = {
  acces: string;
  rafraichissement: string | null;
  expireAt: Date;
};

/** Échange le code reçu au retour de Google contre des jetons utilisables. */
export async function echangerCode(config: ConfigurationGoogle, code: string): Promise<JetonsGoogle> {
  return lireJetons(
    await postJetons({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirection,
      grant_type: "authorization_code",
      code,
    })
  );
}

/** Renouvelle un jeton d'accès expiré à partir du jeton de rafraîchissement. */
export async function rafraichirJeton(
  config: ConfigurationGoogle,
  jetonRafraichissement: string
): Promise<JetonsGoogle> {
  const jetons = lireJetons(
    await postJetons({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: jetonRafraichissement,
    })
  );
  // Un renouvellement ne renvoie pas de nouveau jeton de rafraîchissement :
  // c'est l'ancien qui continue de servir. L'oublier effacerait le seul moyen
  // de se reconnecter, et le raccordement mourrait à la première expiration.
  return { ...jetons, rafraichissement: jetons.rafraichissement ?? jetonRafraichissement };
}

async function postJetons(corps: Record<string, string>): Promise<unknown> {
  const reponse = await fetch(JETONS, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(corps).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!reponse.ok) {
    // Le texte de Google est repris tel quel, tronqué. Reproduire le message du
    // serveur plutôt que l'idée qu'on s'en fait est une règle du dépôt payée
    // cher (`AGENTS.md`) : « invalid_grant » et « redirect_uri_mismatch »
    // demandent deux corrections opposées, et se ressemblent de loin.
    throw new Error(`Google a refusé (${reponse.status}) : ${(await reponse.text()).slice(0, 300)}`);
  }
  return reponse.json();
}

function lireJetons(brut: unknown): JetonsGoogle {
  const o = (brut ?? {}) as Record<string, unknown>;
  const acces = typeof o.access_token === "string" ? o.access_token : "";
  if (!acces) throw new Error("Google n'a pas renvoyé de jeton d'accès.");
  const duree = typeof o.expires_in === "number" ? o.expires_in : 3600;
  return {
    acces,
    rafraichissement: typeof o.refresh_token === "string" ? o.refresh_token : null,
    // Une minute de marge : un jeton qui expire pendant l'appel qu'il autorise
    // produit une erreur qu'on met une heure à comprendre.
    expireAt: new Date(Date.now() + Math.max(0, duree - 60) * 1000),
  };
}

/**
 * Les périodes occupées de l'artisan, entre deux instants.
 *
 * `freeBusy` ne rend que des intervalles — c'est tout ce qu'Atlas demande et
 * tout ce que la portée autorise. Les rendez-vous marqués « disponible » dans
 * l'agenda en sont exclus par Google lui-même, ce qui est le bon comportement :
 * un artisan qui note un pense-bête ne veut pas perdre sa journée.
 */
export async function periodesOccupees(
  jetonAcces: string,
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
  const reponse = await fetch(FREEBUSY, {
    method: "POST",
    headers: {
      authorization: `Bearer ${jetonAcces}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      timeMin: debut.toISOString(),
      timeMax: fin.toISOString(),
      // `primary` : l'agenda principal du compte. Les agendas secondaires — les
      // jours fériés, un calendrier partagé — ne disent rien de la disponibilité
      // de l'artisan et bloqueraient des journées qu'il aurait acceptées.
      items: [{ id: "primary" }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!reponse.ok) {
    throw new Error(`Google a refusé la lecture (${reponse.status}) : ${(await reponse.text()).slice(0, 300)}`);
  }
  return lirePeriodes(await reponse.json());
}

/**
 * Extrait les intervalles de la réponse `freeBusy`.
 *
 * Séparée de l'appel réseau **exprès** : c'est la seule partie de ce fichier
 * qui interprète quelque chose, et elle s'éprouve sans Google, sur une réponse
 * enregistrée (`scripts/test-agenda-google-lecture.ts`).
 *
 * Tout ce qui n'est pas une paire de dates lisibles est ignoré, jamais deviné.
 * Une réponse mal formée doit produire moins d'occupation, pas une occupation
 * inventée — et l'appelant, lui, saura que la lecture a échoué.
 */
export function lirePeriodes(brut: unknown): PeriodeOccupee[] {
  const o = (brut ?? {}) as Record<string, unknown>;
  const calendriers = (o.calendars ?? {}) as Record<string, unknown>;
  const periodes: PeriodeOccupee[] = [];

  for (const valeur of Object.values(calendriers)) {
    const cal = (valeur ?? {}) as Record<string, unknown>;
    const occupes = Array.isArray(cal.busy) ? cal.busy : [];
    for (const item of occupes) {
      const p = (item ?? {}) as Record<string, unknown>;
      if (typeof p.start !== "string" || typeof p.end !== "string") continue;
      const debut = new Date(p.start);
      const fin = new Date(p.end);
      if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) continue;
      periodes.push({ debut, fin });
    }
  }

  return periodes;
}

/**
 * L'adresse du compte relié, pour l'afficher à l'artisan.
 *
 * Rend `null` sans jeter : ne pas savoir *quel* compte est branché est
 * regrettable, mais cela n'empêche pas le raccordement de fonctionner, et
 * faire échouer le branchement entier pour un libellé serait absurde.
 *
 * Utilise le point d'accès `userinfo`, qui ne demande aucune portée
 * supplémentaire au-delà de ce que Google joint déjà au jeton.
 */
export async function adresseDuCompte(jetonAcces: string): Promise<string | null> {
  try {
    const reponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${jetonAcces}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!reponse.ok) return null;
    const o = (await reponse.json()) as Record<string, unknown>;
    return typeof o.email === "string" ? o.email : null;
  } catch {
    return null;
  }
}
