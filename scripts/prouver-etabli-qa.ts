import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// **PROUVER L'ÉTABLI DE QUALIFICATION — et non l'affirmer.**
//
//   npm run qa:preuve
//
// Ce contrôle répond, une par une, aux neuf questions qu'il faut avoir tranchées
// AVANT de lancer une campagne de tests, et surtout avant une campagne de
// charge : où suis-je, sur quelle branche, quelle base, est-elle jetable, quels
// services sont muets, et l'environnement de tous les jours est-il hors de
// portée.
//
// ─────────────────────────────────────────────────────────────────────────────
// **POURQUOI UN SCRIPT PLUTÔT QU'UNE LISTE DE COMMANDES À TAPER.**
//
// Une liste se déroule à la main le premier jour, puis on la saute. Or le seul
// moment où elle compte est le vingtième — quand on a rouvert trois terminaux,
// changé de branche deux fois, et qu'on ne sait plus lequel regarde quoi. Neuf
// vérifications qui tiennent en une commande se rejouent ; neuf commandes à
// recopier, non.
//
// **Et il doit savoir échouer** (`AGENTS.md`). Chaque contrôle a été confronté à
// l'état dégradé qu'il prétend détecter — base de développement, branche `main`,
// clé d'IA posée, port habituel. Un contrôle jamais vu rouge ne prouve rien.
//
// **Ce qu'il ne fait PAS, délibérément :** il ne corrige rien et ne démarre
// rien. Un outil qui répare ce qu'il mesure finit par cacher ce qu'il devait
// montrer.
// ═══════════════════════════════════════════════════════════════════════════

const RACINE = process.cwd();

/** Le port et la base de l'environnement de tous les jours — ce dont il faut rester loin. */
const PORT_HABITUEL = "5432";
const REDIS_HABITUEL = "6379";
const BASE_QA = "atlas_qa";

const HOTES_LOCAUX = ["localhost", "127.0.0.1", "::1"];

type Verdict = { ok: boolean; titre: string; constat: string; remede?: string };
const verdicts: Verdict[] = [];

function vert(titre: string, constat: string) {
  verdicts.push({ ok: true, titre, constat });
}
function rouge(titre: string, constat: string, remede: string) {
  verdicts.push({ ok: false, titre, constat, remede });
}

/**
 * Le `.env` du worktree, lu ICI plutôt que par `--env-file`.
 *
 * Node refuse de démarrer sur un `--env-file` absent, avec une erreur de
 * chargeur qui ne dit pas quoi faire. Or « le `.env` n'a pas été copié » est
 * précisément l'oubli le plus probable du premier jour : il mérite la phrase
 * qui le règle, pas une trace de pile (`AGENTS.md` — le message doit désigner
 * le bon coupable).
 */
function lireEnv(): Record<string, string> | null {
  const chemin = path.join(RACINE, ".env");
  if (!existsSync(chemin)) return null;
  const env: Record<string, string> = {};
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    const nette = ligne.trim();
    if (!nette || nette.startsWith("#")) continue;
    const coupure = nette.indexOf("=");
    if (coupure < 1) continue;
    env[nette.slice(0, coupure).trim()] = nette.slice(coupure + 1).trim();
  }
  return env;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: RACINE, encoding: "utf8" }).trim();
}

async function main() {
  console.log("\n═══ L'établi de qualification, prouvé ═══\n");

  // ── 1. Où sommes-nous, et est-ce bien un worktree séparé ? ────────────────
  //
  // Dans un worktree, `--git-dir` pointe vers `.../.git/worktrees/<nom>` alors
  // que `--git-common-dir` pointe vers le `.git` du dépôt principal. Les deux
  // coïncident dans un clone ordinaire : c'est ce qui les distingue, et c'est
  // plus sûr que de regarder le nom du dossier.
  let estWorktree = false;
  try {
    const propre = path.resolve(RACINE, git("rev-parse", "--git-dir"));
    const commun = path.resolve(RACINE, git("rev-parse", "--git-common-dir"));
    estWorktree = propre !== commun;
    if (estWorktree) {
      vert("Dossier", `${RACINE}\n     worktree séparé — le dépôt principal est ailleurs : ${path.dirname(commun)}`);
    } else {
      // Pas un échec : on peut qualifier depuis un clone dédié. Mais il faut le
      // SAVOIR, parce que le dossier habituel n'est alors protégé par rien.
      vert("Dossier", `${RACINE}\n     ⚠ ce n'est PAS un worktree : vérifie que ce dossier n'est pas ton Atlas de tous les jours`);
    }
  } catch {
    rouge("Dossier", `${RACINE} — ce n'est pas un dépôt git`, "Se placer dans le worktree QA.");
  }

  // ── 2. La branche, et surtout : PAS main ──────────────────────────────────
  let branche = "";
  try {
    branche = git("rev-parse", "--abbrev-ref", "HEAD");
    if (branche === "main" || branche === "master" || branche === "HEAD") {
      rouge(
        "Branche",
        `« ${branche} » — la campagne modifierait la branche de livraison`,
        "git switch -c qa/<nom-de-la-campagne>",
      );
    } else {
      vert("Branche", `${branche}  (ce n'est ni main ni master)`);
    }
  } catch {
    rouge("Branche", "illisible", "Se placer dans le worktree QA.");
  }

  // ── 3. Le .env existe-t-il ? ──────────────────────────────────────────────
  const env = lireEnv();
  if (!env) {
    rouge(
      ".env",
      "absent de ce dossier",
      "cp .env.qa.example .env   — puis rejouer `npm run qa:preuve`",
    );
    rendre();
    return;
  }
  vert(".env", "présent dans ce dossier (jamais versionné)");

  // ── 4. La base : QA, locale, et sur son propre port ───────────────────────
  const brut = env.DATABASE_URL ?? "";
  let base = "";
  let hote = "";
  let port = "";
  try {
    const url = new URL(brut);
    base = decodeURIComponent(url.pathname.replace(/^\//, ""));
    hote = url.hostname.toLowerCase();
    port = url.port || PORT_HABITUEL;
  } catch {
    rouge("Base PostgreSQL", `DATABASE_URL illisible : « ${brut} »`, "Reprendre .env.qa.example.");
  }

  if (base) {
    if (base !== BASE_QA) {
      rouge(
        "Base PostgreSQL",
        `« ${base} » — ce n'est pas la base de qualification`,
        `DATABASE_URL doit nommer « ${BASE_QA} ».`,
      );
    } else if (!HOTES_LOCAUX.includes(hote)) {
      rouge(
        "Base PostgreSQL",
        `« ${base} » se trouve sur « ${hote} » — ce n'est pas cette machine`,
        "Une base d'essai qui porte le bon nom ailleurs reste la base de quelqu'un.",
      );
    } else if (port === PORT_HABITUEL) {
      // **Le contrôle qui compte le plus.** Le nom seul ne protège de rien : le
      // port habituel est celui de l'environnement de tous les jours, et une
      // adresse recopiée d'un terminal à l'autre est l'erreur la plus banale.
      rouge(
        "Base PostgreSQL",
        `« ${base} » sur le port ${PORT_HABITUEL} — c'est le port de ton Atlas habituel`,
        "L'établi QA écoute sur 55432. Reprendre .env.qa.example.",
      );
    } else {
      vert("Base PostgreSQL", `${base} · ${hote}:${port}  — locale, et hors du port habituel (${PORT_HABITUEL})`);
    }
  }

  // ── 5. La base est-elle joignable, et JETABLE ? ───────────────────────────
  //
  // « Jetable » ne se déduit pas d'un nom : on va le demander au moteur. Une
  // base servie par le conteneur QA porte le mot de passe `_qa_pw` et vit sur
  // un volume qu'un `down -v` efface. Ce qu'on vérifie ici, c'est qu'elle
  // RÉPOND et qu'elle est bien celle qu'annonce l'adresse — un `.env` juste
  // devant un conteneur éteint est un piège silencieux.
  if (base === BASE_QA && port !== PORT_HABITUEL) {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: brut, connectionTimeoutMillis: 4000 });
      await client.connect();
      const { rows } = await client.query<{ base: string; utilisateur: string; tables: string }>(
        `SELECT current_database() AS base,
                current_user       AS utilisateur,
                (SELECT count(*)::text FROM pg_tables WHERE schemaname = 'public') AS tables`,
      );
      await client.end();
      const r = rows[0];
      if (r.base !== BASE_QA) {
        rouge(
          "Base joignable",
          `l'adresse dit « ${BASE_QA} » mais le moteur répond « ${r.base} »`,
          "Un conteneur d'un autre environnement écoute sur ce port.",
        );
      } else if (Number(r.tables) === 0) {
        // **Un contrôle qui mesure zéro ne mesure rien** (`CLAUDE.md` §5) :
        // zéro table n'est pas « propre », c'est « pas encore migrée ».
        rouge(
          "Base joignable",
          `« ${r.base} » répond, mais elle ne porte AUCUNE table`,
          "npm run qa:setup   — migrations puis jeu de démonstration",
        );
      } else {
        vert(
          "Base joignable",
          `${r.base} · ${r.tables} tables · connecté en « ${r.utilisateur} »` +
            `\n     jetable : ` +
            `docker compose -f docker-compose.qa.yml down -v  efface le volume atlas-qa-pgdata`,
        );
      }
    } catch (e) {
      rouge(
        "Base joignable",
        (e as Error).message.split("\n")[0],
        "npm run qa:up   — puis attendre que le conteneur soit sain",
      );
    }
  }

  // ── 6. Redis, sur son propre port lui aussi ───────────────────────────────
  const redis = env.REDIS_URL ?? "";
  if (!redis) {
    rouge("Redis", "REDIS_URL absente", "Reprendre .env.qa.example.");
  } else {
    try {
      const url = new URL(redis);
      const portRedis = url.port || REDIS_HABITUEL;
      if (portRedis === REDIS_HABITUEL) {
        rouge(
          "Redis",
          `port ${REDIS_HABITUEL} — c'est le Redis de ton Atlas habituel`,
          "L'établi QA écoute sur 56379.",
        );
      } else if (!HOTES_LOCAUX.includes(url.hostname.toLowerCase())) {
        rouge("Redis", `« ${url.hostname} » n'est pas cette machine`, "Reprendre .env.qa.example.");
      } else {
        vert("Redis", `${url.hostname}:${portRedis}  — local, hors du port habituel (${REDIS_HABITUEL})`);
      }
    } catch {
      rouge("Redis", `REDIS_URL illisible : « ${redis} »`, "Reprendre .env.qa.example.");
    }
  }

  // ── 7. Les services extérieurs sont-ils muets ? ───────────────────────────
  //
  // Le contrôle le plus important de la liste pour une campagne de CHARGE :
  // c'est le seul qui protège d'une facture.
  const clesIa = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "DEEPGRAM_API_KEY", "GOOGLE_API_KEY"];
  const clesPosees = clesIa.filter((c) => (env[c] ?? "").trim() !== "");
  const llm = (env.LLM_PROVIDER ?? "").trim().toLowerCase();
  const transcription = (env.TRANSCRIPTION_PROVIDER ?? "").trim().toLowerCase();

  if (llm !== "dev" || transcription !== "dev") {
    rouge(
      "IA coupée",
      `LLM_PROVIDER=« ${llm || "(vide)"} » · TRANSCRIPTION_PROVIDER=« ${transcription || "(vide)"} »`,
      "Poser les deux à « dev ». Une variable VIDE ne coupe rien : une clé trouvée " +
        "dans .env.local suffirait à brancher un vrai fournisseur — et à faire payer la campagne.",
    );
  } else if (clesPosees.length > 0) {
    // Les deux `dev` l'emportent déjà. Mais une vraie clé qui traîne dans un
    // fichier d'essai reste une clé qui a fuité d'un dossier vers un autre : on
    // le dit, sans faire échouer ce que la configuration tient réellement.
    vert(
      "IA coupée",
      `LLM_PROVIDER=dev · TRANSCRIPTION_PROVIDER=dev — aucun appel réseau` +
        `\n     ⚠ mais ${clesPosees.join(", ")} porte(nt) une valeur dans ce .env : à vider`,
    );
  } else {
    vert("IA coupée", "LLM_PROVIDER=dev · TRANSCRIPTION_PROVIDER=dev · aucune clé posée");
  }

  const detourne = (v: string | undefined) => (v ?? "").includes("127.0.0.1") || (v ?? "").includes("localhost");
  const services: [string, string, string][] = [
    ["Adresses (BAN)", "ADRESSE_BASE_URL", "api-adresse.data.gouv.fr"],
    ["Itinéraires (IGN)", "ITINERAIRE_BASE_URL", "data.geopf.fr"],
  ];
  for (const [nom, variable, vraiService] of services) {
    if (detourne(env[variable])) {
      vert(nom, `détourné vers ${env[variable]} — le service public n'est jamais appelé`);
    } else {
      rouge(
        nom,
        `${variable} non détournée : les requêtes partiraient vers ${vraiService}`,
        `${variable}=http://127.0.0.1:9  (le champ redevient un champ ordinaire, chemin déjà éprouvé)`,
      );
    }
  }

  if ((env.SENTRY_DSN ?? "").trim() === "") {
    vert("Sentry", "sans DSN — muet, aucune requête");
  } else {
    rouge("Sentry", "un DSN est posé : une campagne y enverrait des milliers d'événements", "Vider SENTRY_DSN.");
  }

  const stockage = (env.STORAGE_PROVIDER ?? "local").trim();
  if (stockage === "local") {
    vert("Stockage", `local — dans ${path.join(RACINE, ".storage")}, propre à ce worktree`);
  } else {
    rouge("Stockage", `« ${stockage} » — une campagne écrirait dans un compartiment distant`, "STORAGE_PROVIDER=local");
  }

  // ── 8. Le serveur QA répond-il ? ──────────────────────────────────────────
  const port_app = process.env.PORT ?? "3000";
  try {
    const r = await fetch(`http://127.0.0.1:${port_app}/api/health/live`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) vert("Application", `répond sur http://localhost:${port_app}`);
    else rouge("Application", `répond ${r.status} sur le port ${port_app}`, "Regarder le terminal de `npm run dev`.");
  } catch {
    // Pas un échec de l'établi : on prépare, on ne démarre pas.
    vert("Application", `pas encore démarrée sur le port ${port_app} — normal tant que \`npm run dev\` n'a pas été lancé`);
  }

  // ── 9. L'Atlas habituel est-il hors de portée ? ───────────────────────────
  //
  // La preuve par l'absence : rien de ce .env ne nomme le port 5432 ni le port
  // 6379. C'est ce qui permet d'affirmer que RIEN de ce qu'on lancera d'ici ne
  // peut l'atteindre — pas même par distraction.
  const nomme5432 = Object.values(env).some((v) => v.includes(`:${PORT_HABITUEL}`) || v.includes(`:${REDIS_HABITUEL}`));
  if (nomme5432) {
    rouge(
      "Atlas habituel hors de portée",
      "une variable de ce .env nomme le port 5432 ou 6379",
      "Aucune adresse de cet établi ne doit désigner les ports de tous les jours.",
    );
  } else {
    vert(
      "Atlas habituel hors de portée",
      `aucune variable ne nomme les ports ${PORT_HABITUEL} / ${REDIS_HABITUEL}` +
        `\n     ⚠ SAUF si tu lances \`npm run verifier:avant-livraison\` : cette commande code` +
        `\n       en dur localhost:5432/atlas_test (scripts/verifier-avant-livraison.ts, l. 55-57)` +
        `\n       et ignore ce .env. À ne PAS jouer depuis l'établi QA.`,
    );
  }

  rendre();
}

function rendre() {
  console.log("");
  for (const v of verdicts) {
    console.log(`  ${v.ok ? "✓" : "✗"} ${v.titre}`);
    console.log(`     ${v.constat}`);
    if (v.remede) console.log(`     → ${v.remede}`);
    console.log("");
  }
  const echecs = verdicts.filter((v) => !v.ok).length;
  if (echecs === 0) {
    console.log("═══ L'établi est isolé. La campagne peut commencer. ═══\n");
  } else {
    console.log(`═══ ${echecs} point(s) à régler AVANT de lancer quoi que ce soit. ═══\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
