/**
 * LE MARKDOWN MINIMAL D'ATLAS, LU SANS ÉCRAN — titres, gras, listes, citations.
 *
 * Il servait d'abord aux bulles de l'assistant (`rendreMarkdownSimple`). Le
 * 11 octobre 2026, la planche `appli/documents-legaux-accepter.html` a demandé
 * que le texte des documents légaux se lise en clair : le contrat de
 * sous-traitance montrait ses `#` et ses `**` tels quels dans un `<pre>`. Un
 * second lecteur de Markdown pour l'occasion aurait fini par lire autrement le
 * même texte (`CLAUDE.md` §3) ; c'est donc celui-ci qui apprend les titres et
 * les citations.
 *
 * La lecture est ici, pure, pour s'éprouver sans navigateur
 * (`scripts/test-markdown-simple.ts`) ; le dessin reste dans
 * `src/components/atlas/rendreMarkdownSimple.tsx`.
 */

export type Segment = { texte: string; gras: boolean };
/** Une ligne affichée : ses morceaux, gras ou non. */
export type LigneMarkdown = Segment[];

export type BlocMarkdown =
  | { genre: "titre"; niveau: number; ligne: LigneMarkdown }
  | { genre: "paragraphe"; lignes: LigneMarkdown[] }
  | { genre: "citation"; lignes: LigneMarkdown[] }
  | { genre: "liste"; elements: LigneMarkdown[] };

export type OptionsMarkdown = {
  /**
   * Les documents légaux sont coupés à quatre-vingts colonnes dans la source :
   * gardées, ces coupures hachent la lecture sur un téléphone. L'assistant, lui,
   * écrit un retour à la ligne quand il en veut un, et il le garde.
   */
  joindreLesLignes?: boolean;
};

const TITRE = /^(#{1,6})\s+(.*)$/;
const PUCE = /^[-•]\s+/;
const CITATION = /^>\s?/;

export function lireMarkdownSimple(texte: string, options: OptionsMarkdown = {}): BlocMarkdown[] {
  const lignesDe = (brutes: string[]): LigneMarkdown[] =>
    options.joindreLesLignes ? [lireGras(brutes.map((l) => l.trim()).join(" "))] : brutes.map(lireGras);

  const blocs: BlocMarkdown[] = [];
  for (const morceau of texte.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    let enCours: string[] = [];
    const vider = () => {
      if (enCours.length > 0) blocs.push(classer(enCours, lignesDe));
      enCours = [];
    };
    for (const ligne of morceau.split("\n")) {
      if (ligne.trim().length === 0) continue;
      const titre = ligne.trim().match(TITRE);
      if (titre) {
        vider();
        blocs.push({ genre: "titre", niveau: titre[1].length, ligne: lireGras(titre[2].trim()) });
        continue;
      }
      enCours.push(ligne);
    }
    vider();
  }
  return blocs;
}

function classer(lignes: string[], lignesDe: (brutes: string[]) => LigneMarkdown[]): BlocMarkdown {
  if (lignes.every((l) => CITATION.test(l.trim()))) {
    return { genre: "citation", lignes: lignesDe(lignes.map((l) => l.trim().replace(CITATION, ""))) };
  }

  // Une puce coupée dans la source continue sur une ligne en retrait : c'est
  // la même puce, pas un paragraphe qui commencerait par « - ».
  const estListe =
    PUCE.test(lignes[0].trim()) && lignes.every((l) => PUCE.test(l.trim()) || /^\s+\S/.test(l));
  if (estListe) {
    const elements: string[] = [];
    for (const l of lignes) {
      if (PUCE.test(l.trim())) elements.push(l.trim().replace(PUCE, ""));
      else elements[elements.length - 1] += ` ${l.trim()}`;
    }
    return { genre: "liste", elements: elements.map(lireGras) };
  }

  return { genre: "paragraphe", lignes: lignesDe(lignes) };
}

function lireGras(ligne: string): LigneMarkdown {
  return ligne
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((partie) => partie.length > 0)
    .map((partie) => {
      const gras = partie.match(/^\*\*([^*]+)\*\*$/);
      return gras ? { texte: gras[1], gras: true } : { texte: partie, gras: false };
    });
}
