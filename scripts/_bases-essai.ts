import { baseDeLAtelier, redisDeLAtelier, type Atelier } from "./_atelier";

/**
 * LES ADRESSES D'ESSAI, ÉCRITES UNE FOIS — pour la batterie comme pour le
 * niveau 2.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Ce que ce fichier répare, et il a été trouvé en direct le 16 septembre
 * 2026.** Le niveau 2 venait de gagner une étape « écrans atteints » qui joue
 * des suites navigateur. Elle héritait de l'environnement ambiant — donc du
 * rôle `atlas_app`, qui n'a pas le droit d'amorcer une base : *« permission
 * denied »*, et l'étape tombait sans que le produit ait rien à se reprocher.
 *
 * La batterie, elle, savait déjà : elle donne à chaque étape SON rôle. Mais
 * elle le savait toute seule, dans ses propres constantes. Les recopier dans le
 * niveau 2 aurait fait deux vérités sur la même question (`CLAUDE.md` §3) — et
 * c'est celle qui ne bouge pas qui aurait fini par mentir.
 *
 * **Trois rôles, trois droits, et l'oubli coûte cher dans les deux sens :**
 *
 *   · `atlas_app` — ce que le produit emploie, RLS comprise. Aucun droit de
 *     DDL : c'est ce qui prouve l'isolation ;
 *   · `atlas_owner` — le propriétaire, qui applique les migrations. Migrer
 *     sous un autre rôle crée des tables qui ne lui appartiennent pas, et la
 *     panne n'apparaît qu'à la suite suivante (payé le 13 août 2026) ;
 *   · `postgres` — traverse la RLS. Les suites navigateur en ont besoin parce
 *     qu'elles INSPECTENT la base pour vérifier ce qu'elles affirment.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Surchargeable par l'environnement : les mots de passe diffèrent d'un poste à l'autre. */
const adresse = (nom: string, defaut: string) => process.env[nom]?.trim() || defaut;

export function basesDeLAtelier(atelier: Atelier) {
  return {
    /** Le rôle du produit — RLS active, aucun droit de DDL. */
    APP: baseDeLAtelier(adresse("ATLAS_BASE_APP", "postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test"), atelier),
    /** Le propriétaire : les migrations, et rien d'autre. */
    OWNER: baseDeLAtelier(adresse("ATLAS_BASE_OWNER", "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test"), atelier),
    /** Celui qui traverse la RLS : le seed et les suites navigateur. */
    SUPER: baseDeLAtelier(adresse("ATLAS_BASE_SUPER", "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test"), atelier),
    /** Le limiteur de connexion, dans le coin de Redis de cet atelier. */
    REDIS: { REDIS_URL: redisDeLAtelier("redis://localhost:6379", atelier) },
  };
}

export const AUTH = { AUTH_SECRET: "ci-secret-not-a-real-production-value-000000000000" };
export const CRON = { CRON_SECRET: "ci-placeholder-cron-secret-0000000000" };

/**
 * **Aucune suite ne doit appeler un vrai fournisseur d'IA.** Une vérification
 * lancée dans l'espace de travail du patron — où ses clés vivent — enverrait
 * les dictées d'essai chez le fournisseur, et les lui ferait payer.
 */
export const SANS_CLES_IA = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "DEEPGRAM_API_KEY", "GOOGLE_API_KEY"];

/**
 * Retirer les clés ne suffit pas : Next.js charge `.env.local`, où le patron
 * est invité à coller les siennes. Une variable réelle l'emporte sur ce
 * fichier — d'où ce réglage explicite.
 */
export const IA_COUPEE = { LLM_PROVIDER: "dev", TRANSCRIPTION_PROVIDER: "dev" };
