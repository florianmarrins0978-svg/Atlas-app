/* =======================================================================
   PAS DE PANSEMENT — le contrôle qui refuse les couches, et il BARRE la
   livraison.

   **Sa règle d'or, posée le 7 septembre 2026 :** *« lorsque tu fais une
   correction, je ne veux pas de pansement. Je veux que tu ailles corriger
   le problème directement à la racine — pas de superposition de couches
   de code. »* Puis, le même soir : *« je veux que ça soit une règle
   incontournable, non franchissable, obligatoire de respecter. »*

   **Pourquoi un contrôle et pas seulement `CLAUDE.md` §4 quater.** Le
   dépôt a déjà payé deux fois la même leçon : une règle qui ne vit qu'en
   prose se lit au début d'une conversation et s'oublie au bout de trois
   heures — et il en fait tourner trois ou quatre en parallèle, dont
   aucune n'a lu les autres. Les flèches décoratives ont dû être
   redemandées deux fois avant que `test-aucune-fleche.ts` existe ; le
   travail non enregistré s'est perdu avant que le garde-fou existe.
   « Incontournable » ne se décrète pas, ça se branche.

   **CE QU'IL MESURE, ET SA LIMITE — elle doit être dite.** Corriger à la
   racine est un JUGEMENT : aucun script ne sait si une correction vise
   l'origine ou la recouvre. Ce contrôle attrape les gestes qui, eux, ne
   se discutent pas — ceux qui ÉTOUFFENT un défaut au lieu de le régler.
   Il ne remplace pas la règle : il en tient la moitié vérifiable, et
   c'est cette moitié qui a coûté le plus cher jusqu'ici.

   **IL NE REGARDE QUE CE QUE CE LOT AJOUTE**, jamais le dépôt entier :
   un contrôle qui rougirait sur du code d'il y a six mois serait éteint
   dans la journée, et l'on aurait perdu le garde-fou pour de bon.

   **Ce qui reste permis, à condition d'être AVOUÉ.** Une racine hors
   d'atteinte du lot — dans une dépendance, derrière une migration —
   n'est pas un mensonge tant qu'elle est nommée : `pansement assumé :`
   suivi de sa raison, sur la ligne ou juste au-dessus, ET une trace dans
   `TODO.md`. Un pansement avoué se retire un jour ; un pansement oublié
   devient la fondation du suivant.
   ======================================================================= */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(__dirname, "..");

/**
 * Les gestes refusés, et ce qu'ils font vraiment.
 *
 * **Chacun est là pour la même raison : il rend un défaut MUET.** On ne
 * cherche pas ici les maladresses de style — le lint s'en charge — mais
 * ce qui empêche le prochain de voir ce qui casse. Les motifs sont
 * étroits volontairement : un contrôle qui parle à tort s'apprend à être
 * ignoré (`CLAUDE.md` §1 bis), et l'on perd alors ce qu'il protégeait.
 */
const PANSEMENTS: { nom: string; motif: RegExp; pourquoi: string }[] = [
  {
    nom: "catch vide",
    // `catch {}`, `catch (e) {}`, et la même chose avec des espaces.
    motif: /catch\s*(\([^)]*\))?\s*\{\s*\}/,
    pourquoi:
      "le refus est avalé : la panne devient muette, et la session suivante cherchera ailleurs",
  },
  {
    nom: "@ts-ignore",
    motif: /@ts-(ignore|nocheck)/,
    pourquoi: "le type ne colle pas et on le fait taire — le défaut reste, sans témoin",
  },
  {
    nom: "@ts-expect-error",
    motif: /@ts-expect-error/,
    pourquoi: "même chose, en s'engageant à ce que l'erreur dure",
  },
  {
    nom: "eslint-disable",
    motif: /eslint-disable/,
    pourquoi: "le garde-fou est éteint là où il parlait, plutôt que la cause corrigée",
  },
  {
    nom: "as any",
    motif: /\bas\s+any\b/,
    pourquoi: "le compilateur cesse de vérifier exactement là où l'on doutait",
  },
  {
    nom: "!important",
    motif: /!important/,
    pourquoi: "un style qui écrase un style : trois couches, et plus personne ne sait laquelle décide",
  },
];

/** L'aveu qui rend un contournement acceptable, avec sa raison. */
const AVEU = /pansement assum[ée]\s*:\s*(.{20,})/i;

/**
 * Ce que le lot ajoute, par rapport au tronc commun avec `main`.
 *
 * `git diff <base>` compare l'ARBRE DE TRAVAIL à cette base : ce qui est
 * commité comme ce qui ne l'est pas encore. C'est bien ce qu'on veut —
 * un pansement n'a pas besoin d'être commité pour être livré.
 */
function lignesAjoutees(): { fichier: string; ligne: string; precedente: string }[] {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: RACINE, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

  let base: string;
  try {
    base = git("merge-base", "HEAD", "origin/main");
  } catch {
    // Pas de `origin/main` sous la main (dépôt fraîchement cloné, CI d'une
    // fourche) : on se rabat sur le commit précédent plutôt que de rendre un
    // vert qui n'aurait rien mesuré.
    base = git("rev-parse", "HEAD~1");
  }

  const diff = git("diff", "--unified=0", base, "--", "src");
  const sorties: { fichier: string; ligne: string; precedente: string }[] = [];
  let fichier = "";
  let precedente = "";
  for (const ligne of diff.split("\n")) {
    if (ligne.startsWith("+++ b/")) {
      fichier = ligne.slice("+++ b/".length);
      precedente = "";
      continue;
    }
    if (ligne.startsWith("@@")) {
      precedente = "";
      continue;
    }
    if (!ligne.startsWith("+") || ligne.startsWith("+++")) continue;
    const texte = ligne.slice(1);
    sorties.push({ fichier, ligne: texte, precedente });
    precedente = texte;
  }
  return sorties;
}

/**
 * Le cœur, isolé pour qu'il puisse être ÉPROUVÉ sans dépôt ni diff.
 *
 * **C'est ce qui permet à cette suite de mesurer quelque chose même quand
 * le lot n'a rien ajouté** (`CLAUDE.md` §5 : un contrôle qui mesure zéro
 * ne mesure rien). Elle se confronte plus bas à un échantillon qui porte
 * les six gestes, et à du code propre qui n'en porte aucun.
 */
export function pansementsDe(
  lignes: { fichier: string; ligne: string; precedente: string }[]
): { fichier: string; ligne: string; nom: string; pourquoi: string }[] {
  const trouves = [];
  for (const { fichier, ligne, precedente } of lignes) {
    const avoue = AVEU.test(ligne) || AVEU.test(precedente);
    for (const p of PANSEMENTS) {
      if (!p.motif.test(ligne)) continue;
      if (avoue) continue;
      trouves.push({ fichier, ligne: ligne.trim(), nom: p.nom, pourquoi: p.pourquoi });
    }
  }
  return trouves;
}

console.log("=== Pas de pansement : on corrige à la racine ===\n");

// ── 1. Le détecteur sait reconnaître ce qu'il prétend refuser ────────────
const ECHANTILLON_SALE = [
  "  try { await envoyer(); } catch {}",
  "  // @ts-ignore",
  "  // @ts-expect-error",
  "  /* eslint-disable no-console */",
  "  const devis = reponse as any;",
  "  style={{ color: 'red !important' }}",
].map((ligne) => ({ fichier: "src/exemple.ts", ligne, precedente: "" }));

const surSale = pansementsDe(ECHANTILLON_SALE);
assert.equal(
  surSale.length,
  PANSEMENTS.length,
  `le détecteur laisse passer un pansement : ${PANSEMENTS.map((p) => p.nom)
    .filter((n) => !surSale.some((t) => t.nom === n))
    .join(", ")}`
);
console.log(`  ok    les ${PANSEMENTS.length} gestes refusés sont reconnus`);

const ECHANTILLON_PROPRE = [
  "  try { await envoyer(); } catch (erreur) { journaliser(erreur); }",
  "  const devis = relireProposition(reponse);",
  "  if (!montant) return { erreur: \"Le prix manque\" };",
].map((ligne) => ({ fichier: "src/exemple.ts", ligne, precedente: "" }));
assert.equal(
  pansementsDe(ECHANTILLON_PROPRE).length,
  0,
  "le détecteur accuse du code juste — un contrôle qui parle à tort s'apprend à être ignoré"
);
console.log("  ok    du code qui corrige à la racine n'est pas accusé");

// L'aveu, sur la ligne comme au-dessus.
assert.equal(
  pansementsDe([
    {
      fichier: "src/exemple.ts",
      ligne: "  const x = y as any; // pansement assumé : le type vient de la dépendance PDF",
      precedente: "",
    },
  ]).length,
  0,
  "un contournement nommé avec sa raison doit passer"
);
assert.equal(
  pansementsDe([
    { fichier: "src/exemple.ts", ligne: "  const x = y as any;", precedente: "  // pansement assumé : idem" },
  ]).length,
  1,
  "un aveu sans raison suffisante ne doit PAS suffire"
);
console.log("  ok    l'aveu compte, mais seulement avec sa raison");

// ── 2. Ce que CE lot ajoute ──────────────────────────────────────────────
const ajoutees = lignesAjoutees();
const trouves = pansementsDe(ajoutees);
console.log(`\n  ${ajoutees.length} ligne(s) ajoutée(s) sous src/ par ce lot, mesurées.`);

if (trouves.length > 0) {
  console.error("\n❌ Pansement(s) dans ce lot :\n");
  for (const t of trouves) {
    console.error(`   ${t.fichier}`);
    console.error(`     ${t.ligne}`);
    console.error(`     ${t.nom} — ${t.pourquoi}\n`);
  }
  console.error("   Corriger à la racine (CLAUDE.md §4 quater). Si la racine est hors");
  console.error("   d'atteinte de ce lot : « pansement assumé : <la raison> » sur la ligne");
  console.error("   ou juste au-dessus, ET une entrée dans TODO.md.");
  process.exit(1);
}

// ── 3. Un aveu doit laisser une trace ailleurs que dans le code ──────────
//
// Sans quoi il se perd : le commentaire vieillit avec le fichier, et
// personne ne saura qu'il restait quelque chose à faire.
const avoues = ajoutees.filter((l) => AVEU.test(l.ligne));
if (avoues.length > 0) {
  const todo = readFileSync(path.join(RACINE, "TODO.md"), "utf8").toLowerCase();
  assert.ok(
    todo.includes("pansement"),
    `${avoues.length} contournement(s) avoué(s) dans le code, et rien dans TODO.md : ` +
      "un pansement qui n'est écrit que dans le fichier qu'il rustine ne se retire jamais"
  );
  console.log(`  ok    ${avoues.length} contournement(s) avoué(s), et TODO.md les porte`);
}

console.log("\n✅ Aucun pansement : ce lot corrige à la racine.");
