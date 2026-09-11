/**
 * UN TITRE DE `TODO.md` NE DOIT PAS DIRE LE CONTRAIRE DE SON PROPRE CORPS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **PAYÉ LE 11 SEPTEMBRE 2026, ET C'EST LUI QUI L'A RELEVÉ.** Trois planches
 * lui ont été présentées comme attendant sa réponse. Les trois étaient codées,
 * deux depuis deux jours. Sa réponse : *« la planche déconnecter est déjà
 * faite, va vérifier ! La 2ᵉ aussi ! Et la 3ᵉ aussi ! »*
 *
 * L'une des trois portait la contradiction **dans son propre texte** : son
 * titre annonçait « ⏳ UNE PLANCHE À REGARDER », et son corps, quarante lignes
 * plus bas, disait « CODÉ LE 9 SEPTEMBRE 2026 ». Personne ne lit un corps quand
 * le titre a déjà répondu.
 *
 * **Ce que ce contrôle tient, et ce qu'il ne tient PAS.** Il attrape la moitié
 * mécanique : un titre qui attend une réponse au-dessus d'un corps qui dit
 * l'avoir livrée. L'autre moitié — une entrée qui ne se contredit pas
 * elle-même, mais que le CODE contredit — reste au jugement, et c'est la règle
 * de `CLAUDE.md` §1 : *le code fait foi*. Un contrôle qui prétendrait tenir les
 * deux serait une carte planche → écran, qui se périmerait au premier
 * remaniement.
 *
 * **Un titre barré ne compte pas** : `~~…~~` dit déjà que la chose est réglée,
 * et c'est la convention du fichier.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const FICHIER = path.join(__dirname, "..", "TODO.md");

/** Un titre qui ANNONCE une attente : une réponse, un choix, un regard. */
const TITRE_EN_ATTENTE = /^##\s+⏳\s+(.*(?:À REGARDER|À TRANCHER|À CHOISIR).*)$/iu;

/** Un corps qui DIT que c'est fait. Les formules réellement employées ici. */
const CORPS_LIVRE = /\*\*CODÉ LE \d|^\*\*CODÉ\*\*|\bEST CODÉ\b|\bA ÉTÉ CODÉ\b/mu;

type Section = { titre: string; ligne: number; corps: string };

function sections(texte: string): Section[] {
  const lignes = texte.split("\n");
  const trouvees: Section[] = [];
  let courante: Section | null = null;
  for (const [i, l] of lignes.entries()) {
    if (l.startsWith("## ")) {
      if (courante) trouvees.push(courante);
      courante = { titre: l, ligne: i + 1, corps: "" };
    } else if (courante) {
      courante.corps += l + "\n";
    }
  }
  if (courante) trouvees.push(courante);
  return trouvees;
}

let echecs = 0;
const cas = (nom: string, verifier: () => void) => {
  try {
    verifier();
    console.log(`  ok    ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ÉCHEC ${nom}\n        ${e instanceof Error ? e.message : e}`);
  }
};

console.log("=== Aucun titre de TODO.md ne contredit son propre corps ===\n");

// **Le contrôle sait échouer, et on le lui montre** — sinon il ne prouve rien
// (`AGENTS.md`). On lui donne les deux cas qu'il doit séparer.
cas("un titre en attente au-dessus d'un corps livré est vu", () => {
  const faux = sections("## ⏳ UNE PLANCHE À REGARDER — x\n\n**CODÉ LE 9 septembre 2026**, sur son choix.\n");
  const pris = faux.filter((s) => TITRE_EN_ATTENTE.test(s.titre) && CORPS_LIVRE.test(s.corps));
  if (pris.length !== 1) throw new Error(`le cas fabriqué n'est pas vu (${pris.length})`);
});

cas("un titre barré et un titre sans attente ne sont pas accusés", () => {
  const sains = sections(
    "## ~~UNE PLANCHE À REGARDER — x~~ — CODÉE\n\n**CODÉ LE 9 septembre 2026**\n" +
      "## ⏳ UN LOT EN COURS\n\nrien de livré ici\n"
  );
  const pris = sains.filter((s) => TITRE_EN_ATTENTE.test(s.titre) && CORPS_LIVRE.test(s.corps));
  if (pris.length !== 0) throw new Error(`${pris.length} accusation(s) à tort`);
});

const texte = readFileSync(FICHIER, "utf8");
const toutes = sections(texte);
const menteurs = toutes.filter((s) => TITRE_EN_ATTENTE.test(s.titre) && CORPS_LIVRE.test(s.corps));

cas("TODO.md n'en porte aucun", () => {
  if (menteurs.length === 0) return;
  throw new Error(
    menteurs
      .map(
        (s) =>
          `TODO.md:${s.ligne} — « ${s.titre.slice(0, 90)} » attend une réponse, ` +
          `et son corps dit que c'est codé. Barrer le titre, ou retirer la mention.`
      )
      .join("\n        ")
  );
});

console.log(
  `\n  ${toutes.length} sections lues, ${toutes.filter((s) => TITRE_EN_ATTENTE.test(s.titre)).length} en attente d'une réponse.\n`
);

if (echecs > 0) {
  console.log(`❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("✅ Aucun titre ne contredit son corps.");
