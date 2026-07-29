import { Fragment } from "react";

// Rendu volontairement minimal (pas de design complexe demandé) : gras
// (**texte**), paragraphes (ligne vide), listes à puces (lignes "- " ou "• ").
// Toujours des éléments React — jamais de dangerouslySetInnerHTML.
export function rendreMarkdownSimple(texte: string) {
  const blocs = texte.split(/\n{2,}/);

  return blocs.map((bloc, i) => {
    const lignes = bloc.split("\n").filter((l) => l.trim().length > 0);
    const estListe = lignes.length > 0 && lignes.every((l) => /^[-•]\s+/.test(l.trim()));

    if (estListe) {
      return (
        <ul key={i} className="list-disc pl-5">
          {lignes.map((l, j) => (
            <li key={j}>{rendreGras(l.replace(/^[-•]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={i}>
        {lignes.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {rendreGras(l)}
          </Fragment>
        ))}
      </p>
    );
  });
}

function rendreGras(ligne: string) {
  const parties = ligne.split(/(\*\*[^*]+\*\*)/g);
  return parties.map((partie, i) => {
    const match = partie.match(/^\*\*([^*]+)\*\*$/);
    return match ? <strong key={i}>{match[1]}</strong> : <Fragment key={i}>{partie}</Fragment>;
  });
}
