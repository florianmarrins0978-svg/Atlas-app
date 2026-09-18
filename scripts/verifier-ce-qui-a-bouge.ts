import { execFileSync } from "node:child_process";
import path from "node:path";
import { empreinteDesSources, fichiersRemues } from "./_empreinte-des-sources.mjs";
import { ecrireDernierVerdict, lireDernierVerdict, ilYA } from "./_dernier-verdict";
import { jouerEnGardantLaSortie } from "./_jouer-etape";
import { bilanDuJournal } from "./_bilan-suites.mjs";
import { commitCourant, baseDuLot, lireLesReponses } from "./_temoin-de-main.mjs";
import { cheminsDuLot, estUnPlancher, evaluerLeLot, porteUneGravite, rougesToleres } from "./_niveau-de-risque.mjs";
import { suitesDesRoutes } from "./_suites-ciblees.mjs";
import { construireLeGraphe } from "./_rayon-impact.mjs";
import { rencontreReelle, rougesApresComplement, suitesDuComplement } from "./_apres-fusion.mjs";
import { aRejouer, batterieDue, ceQuiABouge, horsSuitesApres, partagerLaRencontre } from "./_ce-qui-a-bouge.mjs";
import { etapesDeLaBatterie, type Etape } from "./_etapes-batterie";
import { prendreUnAtelierSync, suffixeDeLAtelier } from "./_atelier";
import { basesDeLAtelier } from "./_bases-essai";

/**
 * CE QUI A BOUGÉ DEPUIS LE VERDICT — et rien d'autre.
 *
 *   npx tsx scripts/verifier-ce-qui-a-bouge.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **SA COLÈRE DU 17 SEPTEMBRE 2026, À 23 H :** *« ça recommence et c'est ça à
 * chaque fois ! »*
 *
 * Ce qu'il montrait : une batterie finie, **158 suites sur 159 vertes**, deux
 * rouges — un rouge de documentation, à corriger en trois secondes, et un
 * rouge venu de `main`. La session corrige la documentation… et repart pour
 * **cinquante minutes**, parce que corriger a fait bouger l'arbre.
 *
 * **Les deux murs qui produisaient cette boucle, et ils sont tombés :**
 *
 *   1. une étape qui n'est pas un moteur de suites — Types, Lint, Mémoire du
 *      dépôt, Construction — tombait dans `rougesHorsSuites`, et **rien ne
 *      savait la rejouer seule** : la table des étapes vivait dans le script
 *      de la batterie, qui ne sait faire que tout. Elle vit désormais dans
 *      `_etapes-batterie.ts`, et l'on en rejoue une ;
 *   2. le complément d'après-fusion **refusait dès que le lot avait changé**.
 *      Or corriger un rouge, c'est changer le lot. Il ne servait donc jamais
 *      au moment où l'on en avait le plus besoin.
 *
 * **Ce qui les remplace, et c'est une seule question :** *qu'est-ce qui a bougé
 * depuis la mesure, et que peut-il casser ?*
 *
 *   · ce qui a bougé se lit par le CONTENU, jamais par la date — l'empreinte du
 *     verdict pour le code, git pour ce qu'elle n'indexe pas (`ARCHITECTURE.md`
 *     §380) ;
 *   · ce que cela peut casser se CALCULE — `evaluerLeLot` sur ce delta seul,
 *     et le graphe d'imports pour les écrans atteints. Niveau 3 : on refuse, et
 *     c'est la batterie ;
 *   · et **tout ce qui était rouge est rejoué**, étape ou suite : un rouge
 *     qu'on ne remesure pas garde son rouge. Ne pas savoir n'est jamais vert.
 *
 * **Ce qu'il NE fait PAS** : rendre vert ce qu'il n'a pas joué, abaisser le
 * niveau du verdict, ou tenir lieu de première mesure. La batterie complète
 * reste ce qui autorise la première poussée d'un lot (`CLAUDE.md` §5).
 * ═══════════════════════════════════════════════════════════════════════════
 */

const RACINE = path.join(__dirname, "..");

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", RACINE, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function refuser(pourquoi: string, quoiJouer: string): never {
  console.log(`\n❌ Le rattrapage ne suffit pas : ${pourquoi}.\n\n    ${quoiJouer}\n`);
  process.exit(1);
}

/** Ce que git rapporte comme changé depuis le commit mesuré — suivi ou non. */
function cheminsDeGit(commit: string): string[] {
  return [
    ...(git("diff", "--name-only", `${commit}..HEAD`) ?? "").split("\n"),
    ...(git("status", "--porcelain") ?? "").split("\n").filter((l) => l.length > 3).map((l) => l.slice(3)),
  ]
    .map((c) => c.replace(/^"|"$/g, "").trim())
    .filter(Boolean)
    .map((c) => (c.includes(" -> ") ? c.split(" -> ")[1] : c));
}

const precedent = lireDernierVerdict(RACINE);
if (!precedent) refuser("aucun verdict à rattraper", "npm run verifier:avant-livraison");
if (!precedent.commit) refuser("le verdict ne dit pas quel commit il a mesuré", "npm run verifier:avant-livraison");
if (!precedent.niveau) refuser("le verdict ne dit pas à quel niveau il a mesuré", "npm run verifier:avant-livraison");
if (!Array.isArray(precedent.rouges) && !precedent.vert) {
  refuser("le verdict était rouge sans nommer ses suites", "npm run verifier:avant-livraison");
}
if (git("cat-file", "-e", `${precedent.commit}^{commit}`) === null) {
  refuser(`le commit mesuré (${precedent.commit.slice(0, 8)}) n'est plus dans le dépôt`, "npm run verifier:avant-livraison");
}

const bouge = ceQuiABouge(
  fichiersRemues(precedent.empreinte, empreinteDesSources(RACINE)),
  cheminsDeGit(precedent.commit)
);
const graphe = construireLeGraphe(RACINE);
// **Ce qui a bougé LOIN du lot ne le concerne pas** — la rencontre du
// 17 septembre 2026 (`_apres-fusion.mjs`) : le graphe dit, dans les deux sens,
// ce que le lot emploie et ce qui l'emploie. Une correction, elle, touche par
// construction un fichier du lot : elle y tombe toujours.
const fichiersDuLot = cheminsDuLot(RACINE);
const rencontre = rencontreReelle({ fichiersDuLot, fichiersDuDelta: bouge, graphe });
// **Ce que le lot apporte et ce que `main` apporte ne se doivent pas la même
// chose** (`_ce-qui-a-bouge.mjs`, `ARCHITECTURE.md` §382) : la gravité de
// `main` a déjà été éprouvée par `main`. Seul son PLANCHER refait le sol.
const part = partagerLaRencontre({ fichiers: rencontre.fichiers, fichiersDuLot });
const zone = evaluerLeLot(rencontre.fichiers, { racine: RACINE, graphe });
const niveauDuLot = evaluerLeLot(part.duLot, { racine: RACINE, graphe }).niveau;
const plancherVenuDeMain = part.venuDeMain.filter(estUnPlancher);
const graviteVenueDeMain = part.venuDeMain.some(porteUneGravite);
const rougesAvant = precedent.rouges ?? [];
const horsSuitesAvant = precedent.rougesHorsSuites ?? [];

console.log(`\x1b[1mCe qui a bougé depuis le verdict\x1b[0m — ${precedent.verdict} (${ilYA(precedent.quand)}, niveau ${precedent.niveau})`);
console.log(
  bouge.length
    ? `${bouge.length} fichier(s) : ${bouge.slice(0, 6).join(", ")}${bouge.length > 6 ? ` (+${bouge.length - 6})` : ""}`
    : "aucun fichier"
);
if (bouge.length === 0 && rougesAvant.length === 0 && horsSuitesAvant.length === 0) {
  console.log("\nRien n'a bougé et rien n'était rouge : le verdict vaut tel quel.\n");
  process.exit(0);
}

// **Une correction qui atteint elle-même le niveau 3 ne se rattrape pas.**
// Toucher une migration, le gabarit racine ou l'accès à la base remet en jeu ce
// que la batterie seule sait mesurer — et le doute tranche vers elle.
const due = batterieDue({ niveauDuLot });
if (due) refuser(due, "npm run verifier:avant-livraison");

const ATELIER = prendreUnAtelierSync();
process.env.ATLAS_ADRESSE = ATELIER.adresse;
const { APP, OWNER, SUPER, REDIS } = basesDeLAtelier(ATELIER);
const TOUTES = etapesDeLaBatterie({
  APP,
  OWNER,
  SUPER,
  REDIS,
  DIST_VERIFICATION: `.next-verification${suffixeDeLAtelier(ATELIER)}`,
});
const etapeNommee = (nom: string) => TOUTES.find((e) => e.nom === nom);

/** Les écrans que ce qui a bougé peut atteindre, et les suites qui les ouvrent. */
const plan = aRejouer({
  bouge: rencontre.fichiers,
  rougesAvant,
  horsSuitesAvant,
  graviteVenueDeMain,
  plancherVenuDeMain,
  // **Les écrans DU LOT, pas ceux de la rencontre** : un gabarit racine ou une
  // migration n'ont aucune arête d'import vers eux, et c'est pourtant sur ce
  // sol-là qu'ils tournent désormais (`ARCHITECTURE.md` §383).
  routesDuLot: suitesDesRoutes(RACINE, evaluerLeLot(fichiersDuLot, { racine: RACINE, graphe }).routes),
  suitesDesEcrans: suitesDuComplement({
    suitesDeLaRencontre: suitesDesRoutes(RACINE, zone.routes),
    fichiersDeLaRencontre: rencontre.fichiers,
  }),
});
const aJouerAuNavigateur = plan.navigateur;

const aJouer: Etape[] = plan.etapes.map((nom) => {
  const e = etapeNommee(nom);
  if (!e) refuser(`« ${nom} » ne correspond à aucune étape connue`, "npm run verifier:avant-livraison");
  // Le filtre du moteur navigateur : ces suites-là, et pas les cent autres.
  return nom === "Suites navigateur" && aJouerAuNavigateur.length
    ? { ...e, args: [...e.args, "--", "--seulement", aJouerAuNavigateur.join(",")] }
    : e;
});

console.log(`\nÀ rejouer : ${aJouer.map((e) => e.nom).join(", ")}`);
if (aJouerAuNavigateur.length) console.log(`Suites navigateur : ${aJouerAuNavigateur.join(", ")}`);
console.log(
  horsSuitesAvant.length || rougesAvant.length
    ? `Rouges du verdict : ${[...horsSuitesAvant, ...rougesAvant].join(", ")}`
    : "Aucun rouge au verdict précédent."
);

const empreinteAvant = empreinteDesSources(RACINE);

/**
 * Les suites base, toutes — parce qu'on les rejoue toutes ou pas du tout.
 *
 * C'est la seule façon de savoir ce qui a été REMESURÉ : leur moteur ne nomme
 * que ce qui tombe, et « on ne sait rien de neuf » doit garder son rouge.
 */
function suitesBase(): string[] {
  try {
    return execFileSync(
      process.execPath,
      [path.join(RACINE, "node_modules", "tsx", "dist", "cli.mjs"), path.join(__dirname, "run-all-tests.ts"), "--list"],
      { cwd: RACINE, encoding: "utf8" }
    )
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /\.ts$/.test(l));
  } catch {
    return [];
  }
}

async function jouer(): Promise<void> {
  const tombees: string[] = [];
  const rougesMesures: string[] = [];
  const suitesRejouees: string[] = [...aJouerAuNavigateur];

  for (const etape of aJouer) {
    console.log(`\n\x1b[1m→ ${etape.nom}\x1b[0m`);
    const env = { ...process.env, ...(etape.env ?? {}) };
    for (const cle of etape.envSupprime ?? []) delete env[cle];
    const issue = await jouerEnGardantLaSortie(etape.commande, etape.args, {
      cwd: RACINE,
      env,
      shell: process.platform === "win32",
    });
    if (issue.status === 0) {
      console.log(`   ✅ ${etape.nom}`);
      if (etape.nom === "Suites base de données") suitesRejouees.push(...suitesBase());
      continue;
    }
    console.log(`   ❌ ${etape.nom}`);
    const bilan = etape.suites ? bilanDuJournal(issue.sortie) : null;
    if (etape.suites && bilan && bilan.complet) {
      rougesMesures.push(...bilan.rouges);
      if (etape.nom === "Suites base de données") suitesRejouees.push(...suitesBase());
    } else {
      tombees.push(etape.suites ? `${etape.nom} (bilan incomplet)` : etape.nom);
    }
  }

  // **Un vert rendu sur un arbre qui a bougé pendant la mesure ne vaut rien** —
  // la même règle que la batterie, et pour la même raison.
  const remuesPendant = fichiersRemues(empreinteAvant, empreinteDesSources(RACINE));
  if (remuesPendant.length > 0) {
    refuser(`des fichiers ont été écrits PENDANT la mesure (${remuesPendant.slice(0, 3).join(", ")})`, "npx tsx scripts/verifier-ce-qui-a-bouge.ts");
  }

  // Ce qui a été rejoué prend sa nouvelle valeur ; ce qui ne l'a pas été garde
  // la sienne. Un rouge dont on ne sait rien de neuf reste rouge.
  const horsSuites = horsSuitesApres({
    horsSuitesAvant,
    etapesRejouees: aJouer.map((e) => e.nom),
    tombees,
  });
  const rouges = rougesApresComplement({ rougesAvant, suitesRejouees, rougesMesures });
  const vert = rouges.length === 0 && horsSuites.length === 0;

  ecrireDernierVerdict(RACINE, {
    quand: Date.now(),
    vert,
    verdict: vert
      ? `✅ Rattrapage au vert sur le verdict du ${new Date(precedent!.quand).toLocaleString("fr-FR")} (niveau ${precedent!.niveau}).`
      : `❌ Rattrapage : ${rouges.length} suite(s) rouge(s)${horsSuites.length ? `, hors suites : ${horsSuites.join(", ")}` : ""}`,
    empreinte: empreinteDesSources(RACINE),
    niveau: precedent!.niveau,
    rouges,
    rougesHorsSuites: horsSuites,
    commit: commitCourant(RACINE) ?? undefined,
  });

  console.log("\n─────────────────────────────────────────────────────────────");
  if (horsSuites.length > 0) {
    console.log(`❌ Hors suites : ${horsSuites.join(", ")} — le garde-fou refusera.`);
    process.exit(1);
  }
  const t = rouges.length
    ? rougesToleres({ rouges, rougesHorsSuites: horsSuites }, lireLesReponses(RACINE), baseDuLot(RACINE))
    : { ok: true, raison: "" };
  if (!t.ok) {
    console.log(`❌ ${t.raison} — le garde-fou refusera.`);
    console.log("   Un rouge venu d'ailleurs se compare : npx tsx scripts/verifier-rouge-prealable.ts");
    process.exit(1);
  }
  console.log(
    rouges.length
      ? `✅ Sans rouge nouveau (${rouges.length} déjà rouge(s) sur main) — la fusion est ouverte au niveau ${precedent!.niveau}.`
      : `✅ Au vert — la fusion est ouverte au niveau ${precedent!.niveau}.`
  );
}

jouer().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
