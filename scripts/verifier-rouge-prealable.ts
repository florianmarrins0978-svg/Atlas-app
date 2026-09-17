import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { lireDernierVerdict } from "./_dernier-verdict";
import { SUR_MAIN, decisionSurLesRouges, resteARejouer, surMainPourCetteBase } from "./_rouge-prealable.mjs";
import { baseDuLot, cheminDuTemoin, preparerLeTemoin } from "./_temoin-de-main.mjs";
import { bilanDuJournal } from "./_bilan-suites.mjs";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REJOUER LES SEULS ROUGES SUR LA BASE DE `main` — sa règle du 17 sept. 2026
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npm run verifier:rouge-prealable
 *
 * *« Ne pas lancer toute la batterie sur main. Pour chaque contrôle rouge
 * uniquement : rejouer CE contrôle sur une copie propre du commit de référence
 * de main. »*
 *
 * **CE QUE ÇA COÛTE, et c'est tout le propos.** Une suite navigateur se rejoue
 * en deux à quatre minutes ; une suite de dépôt en quelques secondes. La
 * batterie entière sur `main` en coûtait trente à cinquante, et il fallait la
 * repayer à chaque `main` qui avance.
 *
 * **La réponse s'enregistre par BASE.** Elle ne vaut que pour le commit de
 * `main` mesuré : entre deux commits, quelqu'un a pu casser ou réparer la
 * suite. Changer de base efface donc ce qu'on croyait savoir.
 *
 * **Et ce qui ne se mesure pas se DIT.** Un témoin qui ne se prépare pas, une
 * suite qui ne rend pas de bilan lisible : « indéterminé », et le garde-fou
 * bloque sur ce cas-là — jamais « c'était déjà rouge ».
 */

const RACINE = path.join(__dirname, "..");
const FICHIER = "atlas-rouges-prealables.json";

function ou(): string | null {
  const temoin = cheminDuTemoin(RACINE);
  return temoin ? path.join(path.dirname(temoin), FICHIER) : null;
}

export function lireLesReponses(racine: string): { base?: string; suites?: Record<string, string> } | null {
  const temoin = cheminDuTemoin(racine);
  if (!temoin) return null;
  const chemin = path.join(path.dirname(temoin), FICHIER);
  if (!existsSync(chemin)) return null;
  try {
    const brut = JSON.parse(readFileSync(chemin, "utf8"));
    if (typeof brut.base !== "string" || typeof brut.suites !== "object") return null;
    return { base: brut.base, suites: brut.suites };
  } catch {
    return null;
  }
}

/**
 * REJOUER UNE SUITE, LÀ OÙ ELLE EST.
 *
 * **Deux moteurs, deux chemins** : une suite navigateur se filtre par son nom
 * (`--seulement`), une suite de dépôt se joue directement. Les deux rendent la
 * même chose — rouge, vert, ou rien de lisible.
 */
function rejouer(dossier: string, suite: string): string {
  const estNavigateur = /-e2e\.ts$/.test(suite);
  // **LA COPIE PREND SON PROPRE ATELIER.** Lui passer le port et la base de
  // l'appelant, c'est faire mesurer les deux dossiers dans la MÊME base : le
  // seed de l'un vide celle de l'autre, et les deux rougissent sur du code
  // juste (`CLAUDE.md` §5). On retire donc ce que l'atelier décide lui-même —
  // `prendreUnAtelier` lui donnera un rang libre, donc son port, sa base et
  // son coin de Redis.
  const env = { ...process.env };
  for (const clef of ["ATLAS_ADRESSE", "DATABASE_URL", "DATABASE_ADMIN_URL", "REDIS_URL"]) {
    delete env[clef];
  }
  const motif = suite.replace(/^test-/, "").replace(/\.ts$/, "");
  try {
    const sortie = execFileSync(
      "npm",
      estNavigateur
        ? ["run", "test:e2e", "--", "--seulement", motif]
        : ["exec", "--", "tsx", path.join("scripts", suite)],
      { cwd: dossier, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env, timeout: 20 * 60_000 }
    );
    // **Un moteur qui rend 0 mais n'a joué AUCUNE suite ne prouve rien** : un
    // motif trop étroit ne mesure pas, il se tait (`CLAUDE.md` §5).
    if (estNavigateur) {
      const bilan = bilanDuJournal(sortie);
      if (!bilan) return SUR_MAIN.INDETERMINE;
      return bilan.rouges.includes(suite) ? SUR_MAIN.ROUGE : SUR_MAIN.VERT;
    }
    return SUR_MAIN.VERT;
  } catch (e) {
    const err = e as { stdout?: string; status?: number | null };
    if (err.status === null || err.status === undefined) return SUR_MAIN.INDETERMINE; // tué, ou jamais lancé
    if (estNavigateur) {
      const bilan = bilanDuJournal(err.stdout ?? "");
      if (!bilan) return SUR_MAIN.INDETERMINE;
      return bilan.rouges.includes(suite) ? SUR_MAIN.ROUGE : SUR_MAIN.VERT;
    }
    return SUR_MAIN.ROUGE;
  }
}

function main() {
  const verdict = lireDernierVerdict(RACINE);
  if (!verdict) {
    console.error("❌ Aucun verdict à comparer : jouer d'abord le contrôle du niveau du lot.\n");
    process.exit(1);
  }
  const rouges: string[] = Array.isArray(verdict.rouges) ? verdict.rouges : [];
  const horsSuites: string[] = verdict.rougesHorsSuites ?? [];
  if (horsSuites.length > 0) {
    // **Une étape hors suites n'a pas de « rouge connu »** : types, lint,
    // construction, connexion. Un rouge y est toujours nouveau.
    console.error(`❌ Rouge hors des suites : ${horsSuites.join(", ")}. Celui-là est à corriger.\n`);
    process.exit(1);
  }
  if (rouges.length === 0) {
    console.log("✅ Le dernier verdict ne porte aucune suite rouge : rien à comparer.\n");
    process.exit(0);
  }

  const base = baseDuLot(RACINE);
  if (!base) {
    console.error("❌ La base de ce lot sur main ne se lit pas : rien ne peut être comparé.\n");
    process.exit(1);
  }
  console.log(`Base du lot sur main : ${base.slice(0, 8)}`);
  const connues = lireLesReponses(RACINE);
  const aJouer = resteARejouer(rouges, connues, base);
  const surMain: Record<string, string> = surMainPourCetteBase(connues, base);

  if (aJouer.length > 0) {
    const temoin = preparerLeTemoin(RACINE, base);
    if (!temoin) {
      console.error("❌ La copie propre de main n'a pas pu être préparée : on ne conclut pas.\n");
      process.exit(1);
    }
    console.log(`Copie propre : ${temoin}\n`);
    for (const suite of aJouer) {
      process.stdout.write(`→ ${suite} sur main… `);
      const dit = rejouer(temoin, suite);
      surMain[suite] = dit;
      console.log(
        dit === SUR_MAIN.ROUGE
          ? "déjà rouge sur main"
          : dit === SUR_MAIN.VERT
            ? "VERTE sur main — ce lot la casse"
            : "indéterminé"
      );
    }
    const chemin = ou();
    if (chemin) writeFileSync(chemin, JSON.stringify({ base, suites: surMain }));
  }

  const decision = decisionSurLesRouges(rouges, surMain);
  console.log("");
  if (decision.ok) {
    console.log(`✅ Aucune régression nouvelle. Déjà rouge(s) sur main : ${decision.toleres.join(", ")}`);
    console.log("   La fusion de ce lot est ouverte.\n");
    process.exit(0);
  }
  console.error(`❌ ${decision.raison}\n`);
  process.exit(1);
}

main();
