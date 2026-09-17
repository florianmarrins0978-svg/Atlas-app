import { execFileSync } from "node:child_process";
import path from "node:path";
import { empreinteDesSources } from "./_batterie-solitaire";
import { ecrireDernierVerdict, lireDernierVerdict, ilYA } from "./_dernier-verdict";
import { jouerEnGardantLaSortie } from "./_jouer-etape";
import { bilanDuJournal } from "./_bilan-suites.mjs";
import { baseDuLot, commitCourant } from "./_temoin-de-main.mjs";
// **Jamais depuis `verifier-rouge-prealable` : c'est un script d'ENTRÉE.**
// L'importer exécutait son `main()`, qui écrivait un ✅ et sortait — ce
// complément n'a jamais joué une ligne (17 septembre 2026).
import { lireLesReponses } from "./_temoin-de-main.mjs";
import { cheminsDuLot, evaluerLeLot, rougesToleres } from "./_niveau-de-risque.mjs";
import { suitesDesRoutes } from "./_suites-ciblees.mjs";
import { construireLeGraphe } from "./_rayon-impact.mjs";
import { lotInchange, rencontreReelle, rougesApresComplement, suitesDuComplement } from "./_apres-fusion.mjs";
import { prendreUnAtelierSync } from "./_atelier";
import { AUTH, CRON, IA_COUPEE, SANS_CLES_IA, basesDeLAtelier } from "./_bases-essai";

/**
 * LE COMPLÉMENT — ce qu'on rejoue quand `main` a avancé sous un lot déjà éprouvé.
 *
 *   npx tsx scripts/verifier-apres-fusion.ts
 *
 * **Sa règle du 17 septembre 2026 :** *« Rejoue juste ce qui a bougé ! »*.
 * Le lot avait sa batterie, sans rouge nouveau ; `main` l'avait dépassé de
 * neuf commits pendant qu'elle mesurait ; le garde-fou disait « l'arbre a
 * changé », et la règle d'avant voulait cinquante minutes de plus.
 *
 * Ce contrôle tient la place de cette batterie, aux conditions de
 * `_apres-fusion.mjs` — le lot n'a pas bougé d'une ligne, et l'on rejoue la
 * rencontre : suites base, écrans du lot, écrans touchés par `main`, suites
 * apportées par `main`. Il REFUSE tout le reste, et dit alors quoi jouer.
 *
 * Au vert (ou sans rouge nouveau), il dépose le verdict du dernier contrôle
 * entier, au même niveau, sur CET arbre — c'est ce que le garde-fou relit.
 */

const RACINE = path.join(__dirname, "..");

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", RACINE, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function refuser(pourquoi: string, quoiJouer: string): never {
  console.log(`\n❌ Le complément ne suffit pas : ${pourquoi}.\n\n    ${quoiJouer}\n`);
  process.exit(1);
}

const precedent = lireDernierVerdict(RACINE);
if (!precedent) refuser("aucun verdict à compléter", "npm run verifier:avant-livraison");
if (!precedent.commit) refuser("le dernier verdict ne dit pas quel commit il a mesuré (trace d'avant le 16 septembre)", "npm run verifier:avant-livraison");
if (git("cat-file", "-e", `${precedent.commit}^{commit}`) === null) {
  refuser(`le commit mesuré (${precedent.commit.slice(0, 8)}) n'est plus dans le dépôt`, "npm run verifier:avant-livraison");
}

// **Le verdict d'avant ne doit pas porter un rouge nouveau** : compléter un
// rouge nouveau reviendrait à le faire passer par la fenêtre.
const baseSurMain = baseDuLot(RACINE);
if (!precedent.vert) {
  const t = rougesToleres(precedent, lireLesReponses(RACINE), baseSurMain);
  if (!t.ok) refuser(`le verdict d'avant : ${t.raison}`, "npm run verifier:avant-livraison");
}

// **Le lot doit être le même, à la ligne près.**
const baseAvant = git("merge-base", "origin/main", precedent.commit);
const baseApres = git("merge-base", "origin/main", "HEAD");
const tete = commitCourant(RACINE);
if (!baseAvant || !baseApres || !tete) refuser("git ne répond pas", "npm run verifier:avant-livraison");
const diffAvant = git("diff", baseAvant, precedent.commit) ?? "";
const diffApres = git("diff", baseApres, tete) ?? "";
if (!lotInchange(diffAvant, diffApres)) {
  refuser("le lot lui-même a changé depuis son verdict — ce n'est plus le même lot", "npm run verifier:avant-livraison");
}
if (baseAvant === baseApres) {
  refuser("main n'a pas bougé : rien à compléter — le verdict d'avant vaut tel quel, sauf si l'arbre a bougé hors du lot", "npm run verifier:avant-livraison");
}

// **Le niveau du lot n'a pas baissé de lui-même** : le complément dépose au
// niveau du verdict d'avant, qui doit couvrir le niveau exigé aujourd'hui.
const lot = evaluerLeLot(cheminsDuLot(RACINE), { racine: RACINE });
if ((precedent.niveau ?? 0) < lot.niveau) {
  refuser(`le verdict d'avant est de niveau ${precedent.niveau ?? "?"}, le lot exige ${lot.niveau}`, lot.niveau >= 3 ? "npm run verifier:avant-livraison" : "npm run verifier:avant-fusion");
}

// **Ce que main a apporté entre les deux bases — et ce qui RENCONTRE le lot.**
const fichiersDuDelta = (git("diff", "--name-only", baseAvant, baseApres) ?? "").split("\n").filter(Boolean);
const graphe = construireLeGraphe(RACINE);
const rencontre = rencontreReelle({
  fichiersDuLot: cheminsDuLot(RACINE),
  fichiersDuDelta,
  graphe,
});
const zone = evaluerLeLot(rencontre.fichiers, { racine: RACINE, graphe });
const suites = rencontre.sansRapport
  ? []
  : suitesDuComplement({
      suitesDeLaRencontre: suitesDesRoutes(RACINE, zone.routes),
      fichiersDeLaRencontre: rencontre.fichiers,
    });

console.log(`\x1b[1mComplément après fusion\x1b[0m — verdict d'avant : ${precedent.verdict} (${ilYA(precedent.quand)}, niveau ${precedent.niveau})`);
console.log(`main a avancé de ${baseAvant.slice(0, 8)} à ${baseApres.slice(0, 8)} : ${fichiersDuDelta.length} fichier(s)`);
console.log(`Le lot est inchangé (${lot.raison})`);

// ─── SANS RAPPORT : RIEN À REJOUER — sa règle du 17 septembre 2026 ─────────
//
// *« Si les changements arrivés de main sont sans rapport avec le lot : aucun
// nouveau test lourd. »* Le verdict du lot portait sur SON travail ; ce que
// `main` a apporté ne le croise nulle part, ni par ce que le lot emploie, ni
// par ce qui l'emploie. Le faire attendre serait la cascade qu'il a supprimée.
if (rencontre.sansRapport) {
  console.log("\nCe que main a apporté ne rencontre pas ce lot : rien à rejouer.\n");
  ecrireDernierVerdict(RACINE, {
    quand: Date.now(),
    vert: precedent.vert,
    verdict: `${precedent.verdict} — reposé sur main ${baseApres.slice(0, 8)}, sans rencontre`,
    empreinte: empreinteDesSources(RACINE),
    niveau: precedent.niveau ?? 3,
    rouges: precedent.rouges ?? [],
    rougesHorsSuites: precedent.rougesHorsSuites ?? [],
    commit: tete,
  });
  console.log("✅ Le verdict du lot vaut sur cet arbre. La fusion est ouverte.\n");
  process.exit(0);
}

console.log(
  `La rencontre porte sur ${rencontre.fichiers.length} fichier(s) : ${rencontre.fichiers.slice(0, 6).join(", ")}` +
    (rencontre.fichiers.length > 6 ? ` (+${rencontre.fichiers.length - 6})` : "")
);
console.log(`Suites navigateur à rejouer (${suites.length}) : ${suites.join(", ") || "aucune"}`);

// **Une rencontre qui atteint elle-même le niveau 3 se rejoue en entier** —
// une migration arrivée de main sous un lot qui touche la base, par exemple.
if (zone.niveau >= 3) {
  refuser(`la rencontre atteint le niveau 3 (${zone.raison})`, "npm run verifier:avant-livraison");
}

const ATELIER = prendreUnAtelierSync();
process.env.ATLAS_ADRESSE = ATELIER.adresse;
const { APP, OWNER, SUPER, REDIS } = basesDeLAtelier(ATELIER);

type Etape = { titre: string; commande: string[]; env?: Record<string, string>; envSupprime?: string[]; suites?: true };
// **Les types et le style, toujours** : ils sont rapides, et c'est là que la
// rencontre de deux signatures se voit d'abord.
const ETAPES: Etape[] = [
  { titre: "Types", commande: ["npm", "run", "typecheck"] },
  { titre: "Lint", commande: ["npm", "run", "lint"] },
];
// **Les suites du dépôt seulement si la rencontre les regarde** : elles
// éprouvent les règles et l'isolation, donc ce qui vit sous `src/lib` et
// `src/server`. Une rencontre qui ne touche que des écrans ne les concerne pas.
if (rencontre.fichiers.some((f) => /^src\/(lib|server)\//.test(f.replace(/\\/g, "/")))) {
  ETAPES.push({
    titre: "Suites du dépôt",
    commande: ["npm", "test"],
    env: { DATABASE_URL: APP, DATABASE_ADMIN_URL: OWNER, ...AUTH, ...IA_COUPEE },
    envSupprime: ["REDIS_URL", ...SANS_CLES_IA],
    suites: true,
  });
}
if (suites.length) {
  ETAPES.push({
    titre: "Les écrans où le lot et main se rencontrent",
    commande: ["npm", "run", "test:e2e", "--", "--seulement", suites.join(",")],
    env: { DATABASE_URL: SUPER, ...AUTH, ...CRON, ...REDIS, ...IA_COUPEE },
    envSupprime: SANS_CLES_IA,
    suites: true,
  });
}

/** Les suites base, rejouées seulement quand la rencontre les regarde. */
function suitesBase(): string[] {
  try {
    return execFileSync(process.execPath, [path.join(RACINE, "node_modules", "tsx", "dist", "cli.mjs"), path.join(__dirname, "run-all-tests.ts"), "--list"], {
      cwd: RACINE,
      encoding: "utf8",
    })
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /\.ts$/.test(l));
  } catch {
    return [];
  }
}

async function jouer(): Promise<void> {
  const echecs: string[] = [];
  const rougesMesures: string[] = [];
  const rougesHorsSuites: string[] = [];
  for (const etape of ETAPES) {
    console.log(`\n\x1b[1m→ ${etape.titre}\x1b[0m`);
    const [programme, ...args] = etape.commande;
    const env = { ...process.env, ...(etape.env ?? {}) };
    for (const clef of etape.envSupprime ?? []) delete env[clef];
    const issue = await jouerEnGardantLaSortie(programme, args, { cwd: RACINE, env, shell: process.platform === "win32" });
    if (issue.status === 0) {
      console.log(`   ✅ ${etape.titre}`);
      continue;
    }
    echecs.push(etape.titre);
    console.log(`   ❌ ${etape.titre}`);
    const bilan = etape.suites ? bilanDuJournal(issue.sortie) : null;
    if (etape.suites && bilan && bilan.complet) rougesMesures.push(...bilan.rouges);
    else rougesHorsSuites.push(etape.suites ? `${etape.titre} (bilan incomplet)` : etape.titre);
  }

  const rouges = rougesApresComplement({
    rougesAvant: precedent!.rouges ?? [],
    suitesRejouees: [...suitesBase(), ...suites],
    rougesMesures,
  });
  const vert = rouges.length === 0 && rougesHorsSuites.length === 0;
  ecrireDernierVerdict(RACINE, {
    quand: Date.now(),
    vert,
    verdict: vert
      ? `✅ Complément au vert sur le verdict du ${new Date(precedent!.quand).toLocaleString("fr-FR")} (niveau ${precedent!.niveau}).`
      : `❌ Complément : ${rouges.length} suite(s) rouge(s)${rougesHorsSuites.length ? `, hors suites : ${rougesHorsSuites.join(", ")}` : ""}`,
    empreinte: empreinteDesSources(RACINE),
    niveau: precedent!.niveau,
    rouges,
    rougesHorsSuites,
    commit: tete!,
  });

  console.log("\n─────────────────────────────────────────────────────────────");
  if (rougesHorsSuites.length > 0) {
    console.log(`❌ Hors suites : ${rougesHorsSuites.join(", ")} — le garde-fou refusera.`);
    process.exit(1);
  }
  const t = rouges.length
    ? rougesToleres({ rouges, rougesHorsSuites }, lireLesReponses(RACINE), baseSurMain)
    : { ok: true, raison: "" };
  if (!t.ok) {
    console.log(`❌ ${t.raison} — le garde-fou refusera.`);
    process.exit(1);
  }
  console.log(
    rouges.length
      ? `✅ Complément sans rouge nouveau (${rouges.length} rouge(s) déjà rouge(s) sur main) — la fusion est ouverte au niveau ${precedent!.niveau}.`
      : `✅ Complément au vert — la fusion est ouverte au niveau ${precedent!.niveau}.`
  );
}

jouer().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
