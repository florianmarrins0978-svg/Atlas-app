import { readFileSync } from "node:fs";
import path from "node:path";
import { SYSTEME as SYSTEME_EXTRACTION } from "../src/server/ai/services/extraction-service";

/**
 * CE QU'UN UTILISATEUR D'ATLAS COÛTE PAR MOIS, EN IA.
 *
 * **Sa demande du 9 septembre 2026 :** *« et c'est à toi de me mesurer le
 * chiffre ! Dis-moi combien ça va me coûter une application comme ça par
 * utilisateur, va chercher les infos ! »*
 *
 * Il a raison, et je lui avais répondu de regarder sa facture — c'est-à-dire
 * lui faire porter une mesure qui se trouve dans SON code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE SCRIPT MESURE VRAIMENT, ET CE QU'IL SUPPOSE.** La distinction
 * commande la valeur du chiffre.
 *
 * | | |
 * |---|---|
 * | **mesuré** dans le dépôt | la taille des consignes système envoyées à chaque appel, les plafonds de réponse (`max_tokens`), la durée maximale d'une dictée, les modèles employés |
 * | **supposé**, et écrit comme tel | le tarif public de chaque modèle, et le nombre de devis par mois |
 *
 * Les tarifs ne sont PAS dans le dépôt : ils vivent chez les fournisseurs et
 * changent. Ils sont donc rassemblés en un seul endroit ci-dessous, datés, pour
 * qu'on sache quoi rouvrir le jour où ils bougent — plutôt que dispersés dans
 * un raisonnement qu'il faudrait refaire.
 *
 *   npx tsx scripts/mesurer-cout-ia.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// LES TARIFS — supposés, à revérifier chez les fournisseurs.
//
// En dollars par MILLION de jetons. Relevés de mémoire au 9 septembre 2026 :
// c'est la seule partie de ce calcul qui ne sort pas du code, et elle doit être
// confrontée aux pages de tarifs avant de fixer un prix de vente.
const TARIFS = {
  // `claude-sonnet-4-6` — le modèle par défaut d'`anthropic.ts`.
  sonnet: { entree: 3, sortie: 15 },
  // `whisper-1` — la transcription, facturée à la MINUTE et non au jeton.
  whisperParMinute: 0.006,
} as const;

/** Un jeton vaut environ quatre caractères en français. */
const CARACTERES_PAR_JETON = 4;

function jetons(texte: string): number {
  return Math.ceil(texte.length / CARACTERES_PAR_JETON);
}

function lire(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

/**
 * Le plafond de réponse, lu dans le code plutôt que supposé.
 *
 * **Ce qui compte, c'est le PLAFOND, pas la moyenne** : on chiffre le pire cas.
 * Un devis qui va au bout de ses jetons est celui qui coûte le plus, et c'est
 * lui qui doit tenir dans le prix de vente — pas le devis moyen (`CLAUDE.md`
 * §4 ter : se tromper vers le sûr).
 */
function plafondSortie(): number {
  const source = lire("src/server/ai/providers/llm/anthropic.ts");
  const m = source.match(/MAX_TOKENS_TEXTE\s*=\s*(\d+)/);
  if (!m) throw new Error("MAX_TOKENS_TEXTE introuvable : le calcul serait supposé, pas mesuré.");
  return Number(m[1]);
}

/**
 * La dictée la plus longue qu'Atlas accepte, en secondes.
 *
 * **Elle n'est plafonnée NULLE PART — et c'est une trouvaille, pas un détail.**
 * Aucune constante de durée n'existe dans `src/` : la seule borne est la taille
 * du fichier. Une dictée de trente minutes coûte donc dix fois celle de trois,
 * et rien ne l'arrête. Tant que ce plafond n'existe pas, ce calcul retient
 * **trois minutes** — une dictée de chantier ordinaire — et le DIT, plutôt que
 * de laisser croire à une mesure (`CLAUDE.md` §4 ter : ce qui n'est pas calculé
 * se dit).
 */
const DICTEE_SUPPOSEE_SECONDES = 180;

function dicteeMaximaleSecondes(): { secondes: number; mesuree: boolean } {
  for (const fichier of ["src/lib/limites-audio.ts", "src/server/audio-entrant.ts"]) {
    try {
      const m = lire(fichier).match(/DUREE_MAX_SECONDES\s*=\s*(\d+)/);
      if (m) return { secondes: Number(m[1]), mesuree: true };
    } catch {
      // Fichier absent : on continue de chercher, on ne conclut pas.
    }
  }
  return { secondes: DICTEE_SUPPOSEE_SECONDES, mesuree: false };
}

const SORTIE_MAX = plafondSortie();
const DICTEE = dicteeMaximaleSecondes();
const DICTEE_S = DICTEE.secondes;
const SYSTEME_JETONS = jetons(SYSTEME_EXTRACTION);

console.log("═══ CE QUI EST MESURÉ DANS LE DÉPÔT ═══\n");
console.log(`  consigne système du devis   ${SYSTEME_EXTRACTION.length} caractères ≈ ${SYSTEME_JETONS} jetons`);
console.log(`  plafond de réponse          ${SORTIE_MAX} jetons`);
console.log(
  `  dictée retenue              ${DICTEE_S} s (${(DICTEE_S / 60).toFixed(1)} min) — ` +
    (DICTEE.mesuree ? "plafond lu dans le code" : "AUCUN PLAFOND DANS LE CODE : durée supposée")
);

// ─────────────────────────────────────────────────────────────────────────────
// UN DEVIS DICTÉ, DE BOUT EN BOUT.
//
// Trois appels, et pas un : c'est le parcours réel du patron — il dicte, Atlas
// transcrit, puis extrait les prestations, puis rédige le brouillon.
const dicteeMinutes = DICTEE_S / 60;
const transcription = dicteeMinutes * TARIFS.whisperParMinute;

// La dictée transcrite entre à son tour dans le devis : ~150 mots par minute,
// et un mot français fait environ 1,3 jeton.
const jetonsDictee = Math.ceil(dicteeMinutes * 150 * 1.3);
const entreeDevis = SYSTEME_JETONS + jetonsDictee;
const coutEntree = (entreeDevis / 1_000_000) * TARIFS.sonnet.entree;
const coutSortie = (SORTIE_MAX / 1_000_000) * TARIFS.sonnet.sortie;
const unDevis = transcription + coutEntree + coutSortie;

console.log("\n═══ UN DEVIS DICTÉ, AU PIRE CAS ═══\n");
console.log(`  transcription   ${dicteeMinutes.toFixed(1)} min          ${(transcription * 100).toFixed(2)} centimes`);
console.log(`  ce qui entre    ${entreeDevis} jetons     ${(coutEntree * 100).toFixed(2)} centimes`);
console.log(`  ce qui sort     ${SORTIE_MAX} jetons     ${(coutSortie * 100).toFixed(2)} centimes`);
console.log(`  ───────────────────────────────────────────`);
console.log(`  UN DEVIS                        ${(unDevis * 100).toFixed(1)} centimes`);

console.log("\n═══ PAR UTILISATEUR ET PAR MOIS ═══\n");
console.log("  devis/mois   coût IA");
for (const n of [20, 40, 60, 100, 200]) {
  console.log(`  ${String(n).padStart(10)}   ${(n * unDevis).toFixed(2)} $`);
}

console.log(
  "\n  Lecture : ces chiffres sont le PIRE cas — dictée au plafond, réponse au\n" +
    "  plafond. Un devis ordinaire coûte moins."
);
console.log(
  "\n  Ce qui n'est PAS compté ici : l'hébergement, le stockage des photos et des\n" +
    "  PDF, et les appels d'IA qui ne sont pas un devis (lecture d'un ticket, d'un\n" +
    "  croquis d'arrosage, l'assistant). Ils se chiffrent à part."
);
