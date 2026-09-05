/**
 * AUCUNE COULEUR ÉCRITE EN CLAIR DANS UN ÉCRAN SURVEILLÉ.
 *
 * ─── POURQUOI CETTE SUITE EXISTE, ET POURQUOI ELLE EST ÉTROITE ──────────────
 *
 * **La faute a coûté quatre fois.** Le 22 août 2026, le patron : *« le mode
 * nuit est illisible »*. Sept chartes cohabitent, dont deux SOMBRES — sur Nuit
 * et Sylve les pôles s'inversent. Une encre écrite en clair (`rgba(20,18,14,…)`,
 * `#faf9f5`) est donc juste cinq fois sur sept, et invisible deux fois.
 *
 * **Et `test-chartes-lisibles.ts` ne peut pas la voir** : il mesure les CHARTES
 * entre elles, pas ce qu'un écran écrit de sa main. Les deux suites ne se
 * recouvrent pas — celle-ci lit le code, celle-là lit les couleurs.
 *
 * Le dernier retour, le 5 septembre 2026 : le voile du tiroir « Remplacer vos
 * corrections ? » portait `rgba(20,18,14,0.35)`. Sur Nuit, du sombre sur du
 * sombre — la feuille ne se détachait plus de la page, au-dessus du seul geste
 * irréversible de cet écran.
 *
 * **Pourquoi une LISTE d'écrans plutôt que tout `src/` :** six sessions
 * travaillent en même temps sur cette application, et une suite qui rougirait
 * sur le fichier d'une autre bloquerait son lot pour une faute qu'elle n'a pas
 * commise. Elle surveille donc ce qui a été repris, et **la liste s'allonge à
 * chaque écran refait** — c'est le seul entretien qu'elle demande.
 *
 * Ce qu'on écrit à la place : `colors.*` pour un aplat, `surPlein` pour ce
 * qu'on pose SUR un accent, `voile(colors.ink, α)` pour un voile — il est clair
 * sur une charte sombre et sombre sur une charte claire, sans que l'écran ait à
 * savoir laquelle est posée (`design-tokens.ts`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(__dirname, "..");

/** Les écrans repris, et qui ne doivent plus jamais écrire une couleur. */
const SURVEILLES = [
  "src/app/chantiers/[id]/transcription/page.tsx",
  "src/app/chantiers/[id]/transcription/TexteDicte.tsx",
  "src/app/chantiers/[id]/transcription/RafraichirPendantTranscription.tsx",
  "src/app/chantiers/[id]/informations/page.tsx",
  "src/app/chantiers/[id]/informations/InformationsClient.tsx",
  "src/app/chantiers/[id]/informations/BrouillonSection.tsx",
];

/**
 * Une couleur écrite : `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`, `hsl(...)`.
 * `color-mix(...)` n'en est pas une — c'est ce que rend `voile()`.
 */
const COULEUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/;

/**
 * Les commentaires en citent, et c'est le contraire d'une faute : ils
 * expliquent celle qu'on vient de retirer. Les retirer de la lecture, comme
 * `test-aucune-fleche.ts` le fait déjà.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

let lignesLues = 0;
const fautes: string[] = [];

for (const relatif of SURVEILLES) {
  const source = readFileSync(path.join(RACINE, relatif), "utf8");
  const lignes = sansCommentaires(source).split("\n");
  lignesLues += lignes.length;
  lignes.forEach((ligne, i) => {
    if (COULEUR.test(ligne)) fautes.push(`${relatif}:${i + 1} → ${ligne.trim()}`);
  });
}

// **Un contrôle qui mesure zéro ne mesure rien** (`CLAUDE.md` §5) : si la
// lecture échouait — un chemin renommé, un fichier vide —, l'absence de faute
// ne prouverait rien du tout.
assert.ok(lignesLues > 500, `seulement ${lignesLues} lignes lues : la lecture des écrans a échoué`);

assert.equal(
  fautes.length,
  0,
  `Couleur(s) écrite(s) en clair — invisible(s) sur Nuit et sur Sylve :\n  ${fautes.join("\n  ")}\n` +
    `  À la place : colors.*, surPlein, ou voile(colors.ink, α).`
);

console.log(`✅ ${SURVEILLES.length} écrans, ${lignesLues} lignes lues, aucune couleur écrite en clair.`);
