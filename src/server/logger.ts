import { getContexteRequete } from "./request-context";
import { empreinteCourriel, estCleDeCourriel } from "@/lib/empreinte-courriel";

type Niveau = "debug" | "info" | "warn" | "error";

const ORDRE_NIVEAUX: Record<Niveau, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Jamais journalisé, quelle que soit la casse ou l'imbrication de la clé.
const CLES_SENSIBLES = [
  "password",
  "motdepasse",
  "passwordhash",
  "secret",
  "token",
  "authorization",
  "cookie",
  "databaseurl",
  "database_url",
  "accesskeyid",
  "secretaccesskey",
  "apikey",
  "api_key",
  "dsn",
  // **`jeton`, parce que ce dépôt est en français** — constat de l'audit final,
  // 29 août 2026. La liste ne portait que `token` : dans un code où tout le
  // reste s'écrit en français, le premier `logger.info("…", { jeton })` serait
  // parti en clair dans le journal, et de là chez Sentry. Or un jeton d'envoi
  // ouvre à lui seul la page publique d'un devis ou d'une facture — nom,
  // adresse et montants du client compris.
  //
  // Aucun appel ne le fait aujourd'hui : c'est un piège qu'on ferme avant qu'il
  // serve, pas une fuite constatée.
  "jeton",
];

// **Une adresse e-mail s'écrit en EMPREINTE, jamais en clair** (sa décision du
// 25 octobre 2026, `src/lib/empreinte-courriel.ts`). Elle restait en clair
// pour répondre à « je n'arrive pas à entrer » (la panne du 6 août 2026) ;
// l'empreinte le permet toujours, en calculant celle de son adresse
// (`npm run empreinte`), sans livrer la liste des comptes à qui lit le
// journal. La rétention déclarée (`RETENTION.journauxJours`) reste à appliquer
// chez l'hébergeur.
//
// La clé est `AUTH_SECRET`, que l'environnement exige en production : sans
// elle (essais), l'empreinte se calcule sans clé, et l'adresse ne part pas
// davantage en clair.
function cleDesEmpreintes(): string {
  return process.env.AUTH_SECRET ?? "";
}

function estCleSensible(cle: string): boolean {
  const c = cle.toLowerCase().replace(/[_-]/g, "");
  return CLES_SENSIBLES.some((sensible) => c.includes(sensible));
}

// Rédaction récursive et sûre : ne lève jamais, ne boucle jamais sur une
// structure circulaire, remplace toute clé sensible par "[rédigé]".
export function redigerPourJournal(valeur: unknown, profondeur = 0): unknown {
  if (profondeur > 6) return "[profondeur max]";
  if (valeur === null || valeur === undefined) return valeur;

  if (valeur instanceof Error) {
    return {
      nom: valeur.name,
      message: valeur.message,
      pile: valeur.stack,
      cause: valeur.cause ? redigerPourJournal(valeur.cause, profondeur + 1) : undefined,
    };
  }

  if (Array.isArray(valeur)) {
    return valeur.map((v) => redigerPourJournal(v, profondeur + 1));
  }

  if (typeof valeur === "object") {
    const resultat: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      resultat[cle] = estCleSensible(cle)
        ? "[rédigé]"
        : estCleDeCourriel(cle) && typeof v === "string"
          ? empreinteCourriel(v, cleDesEmpreintes())
          : redigerPourJournal(v, profondeur + 1);
    }
    return resultat;
  }

  return valeur;
}

function niveauMinimum(): Niveau {
  const configure = (process.env.LOG_LEVEL as Niveau) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
  return ORDRE_NIVEAUX[configure] !== undefined ? configure : "info";
}

function ecrire(niveau: Niveau, message: string, contexte?: Record<string, unknown>) {
  if (ORDRE_NIVEAUX[niveau] < ORDRE_NIVEAUX[niveauMinimum()]) return;

  const requete = getContexteRequete();
  const contexteRedige = redigerPourJournal(contexte ?? {}, 0) as Record<string, unknown>;
  const entree = {
    horodatage: new Date().toISOString(),
    niveau,
    message,
    requestId: requete?.requestId,
    ...contexteRedige,
  };

  if (process.env.NODE_ENV === "production") {
    console[niveau === "debug" ? "log" : niveau](JSON.stringify(entree));
  } else {
    console[niveau === "debug" ? "log" : niveau](`[${niveau.toUpperCase()}] ${message}`, entree);
  }

  // Transmission best-effort à Sentry si configuré — jamais bloquant, jamais
  // requis pour que la journalisation elle-même fonctionne (import
  // dynamique : aucune dépendance dure à Sentry pour les tests/dev sans DSN).
  if (niveau === "error" && process.env.SENTRY_DSN) {
    import("@sentry/nextjs")
      .then((Sentry) => {
        const erreurBrute = contexte?.erreur;
        if (erreurBrute instanceof Error) {
          Sentry.captureException(erreurBrute, { extra: { message, ...contexteRedige } });
        } else {
          Sentry.captureMessage(message, { level: "error", extra: contexteRedige });
        }
      })
      .catch(() => {
        // Sentry indisponible : ne doit jamais faire échouer la journalisation.
      });
  }
}

export const logger = {
  debug: (message: string, contexte?: Record<string, unknown>) => ecrire("debug", message, contexte),
  info: (message: string, contexte?: Record<string, unknown>) => ecrire("info", message, contexte),
  warn: (message: string, contexte?: Record<string, unknown>) => ecrire("warn", message, contexte),
  error: (message: string, contexte?: Record<string, unknown>) => ecrire("error", message, contexte),
};
