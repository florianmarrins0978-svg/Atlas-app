import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { lireDernierVerdict } from "./_dernier-verdict";
import { SUR_MAIN, decisionSurLesRouges, resteARejouer, sortDUneSuite, surMainPourCetteBase } from "./_rouge-prealable.mjs";
import { FICHIER_REPONSES, baseDuLot, cheminDuTemoin, lireLesReponses, preparerLeTemoin } from "./_temoin-de-main.mjs";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REJOUER LES SEULS ROUGES SUR LA BASE DE `main` — sa règle du 17 sept. 2026
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npx tsx scripts/verifier-rouge-prealable.ts
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

function ou(): string | null {
  const temoin = cheminDuTemoin(RACINE);
  return temoin ? path.join(path.dirname(temoin), FICHIER_REPONSES) : null;
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
  // **LA COPIE PREND SON PROPRE PORT, PAS SA PROPRE BASE.** On retire
  // `ATLAS_ADRESSE` — sans quoi la copie servirait sur le port de l'appelant,
  // et Next.js refuse un second serveur au même endroit ; `prendreUnAtelier`
  // lui donne alors un rang libre, donc un port à elle et son coin de Redis.
  //
  // **Le reste de l'environnement passe tel quel**, et c'est mesuré, pas
  // supposé : le moteur refuse de démarrer sans `REDIS_URL` — *« le limiteur
  // bloque au bout de 5 connexions par quart d'heure »* — et sans
  // `DATABASE_URL` il n'a aucune base d'essai. Les rangs d'atelier nomment des
  // bases (`atlas_test_a1`…) que la machine n'a pas forcément créées ; les
  // inventer ici rendrait « indéterminé » à chaque comparaison.
  //
  // **Les deux dossiers ne mesurent jamais EN MÊME TEMPS** : le verrou de
  // batterie tient le dossier, et cette comparaison est séquentielle.
  const env = { ...process.env };
  delete env.ATLAS_ADRESSE;
  const motif = suite.replace(/^test-/, "").replace(/\.ts$/, "");
  // **Les DEUX flux, et la lecture vit ailleurs** (`sortDUneSuite`). Le moteur
  // nomme ses rouges sur stderr et compte sur stdout ; ne lire que stdout
  // faisait passer toute suite rouge pour verte, des deux côtés — donc
  // « pareil », donc tolérée (21 septembre 2026).
  const moteur = spawnSync(
    "npm",
    estNavigateur
      ? ["run", "test:e2e", "--", "--seulement", motif]
      : ["exec", "--", "tsx", path.join("scripts", suite)],
    // **`npm` est `npm.cmd` sous Windows** : sans interpréteur, le lancement
    // rend ENOENT — un statut absent —, donc « indéterminé » des DEUX côtés,
    // et rien ne se compare jamais (payé le 18 septembre 2026, sur douze
    // rouges d'outillage). Même geste que `_jouer-etape.ts`.
    { cwd: dossier, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env, timeout: 20 * 60_000, shell: process.platform === "win32" }
  );
  return sortDUneSuite({ suite, estNavigateur, status: moteur.status, stdout: moteur.stdout, stderr: moteur.stderr });
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
      // ─── LES DEUX CÔTÉS, DOS À DOS, DANS LE MÊME ÉTAT ───────────────────
      //
      // Voir `_rouge-prealable.mjs` : mesurer `main` seul ne dit rien du diff.
      process.stdout.write(`→ ${suite} sur main… `);
      const surLaBase = rejouer(temoin, suite);
      console.log(surLaBase === "rouge" ? "rouge" : surLaBase === "vert" ? "verte" : "illisible");
      process.stdout.write(`  et sur ce lot, juste après… `);
      const surLeLot = rejouer(RACINE, suite);
      console.log(surLeLot === "rouge" ? "rouge" : surLeLot === "vert" ? "verte" : "illisible");

      if (surLaBase === "indetermine" || surLeLot === "indetermine") {
        surMain[suite] = SUR_MAIN.INDETERMINE;
        console.log("  → rien de lisible d'un côté : on ne conclut pas.");
      } else if (surLaBase === surLeLot) {
        surMain[suite] = SUR_MAIN.PAREIL;
        console.log("  → le même sort des deux côtés : ce lot n'en est pas la cause.");
      } else if (surLaBase === "vert") {
        surMain[suite] = SUR_MAIN.CASSE_PAR_LE_LOT;
        console.log("  → verte sur main, rouge ici : c'est ce lot.");
      } else {
        surMain[suite] = SUR_MAIN.PAREIL;
        console.log("  → rouge sur main, verte ici : ce lot la répare.");
      }
    }
    const chemin = ou();
    if (chemin) writeFileSync(chemin, JSON.stringify({ base, suites: surMain }));
  }

  const decision = decisionSurLesRouges(rouges, surMain);
  console.log("");
  if (decision.ok) {
    console.log(`✅ Aucune régression nouvelle. Même sort des deux côtés : ${decision.toleres.join(", ")}`);
    console.log("   La fusion de ce lot est ouverte.\n");
    process.exit(0);
  }
  console.error(`❌ ${decision.raison}\n`);
  process.exit(1);
}

main();
