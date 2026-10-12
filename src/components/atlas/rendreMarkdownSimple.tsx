import { Fragment } from "react";
import { lireMarkdownSimple, type LigneMarkdown, type OptionsMarkdown } from "@/lib/markdown-simple";

// Rendu volontairement minimal (pas de design complexe demandé) : la lecture
// vit dans `src/lib/markdown-simple.ts`, ici seulement des éléments nus que
// l'écran qui les monte habille. Toujours des éléments React, jamais de
// dangerouslySetInnerHTML.
export function rendreMarkdownSimple(texte: string, options?: OptionsMarkdown) {
  return lireMarkdownSimple(texte, options).map((bloc, i) => {
    switch (bloc.genre) {
      case "titre":
        return (
          <h4 key={i} className="font-medium">
            {rendreLigne(bloc.ligne)}
          </h4>
        );
      case "liste":
        return (
          <ul key={i} className="list-disc pl-5">
            {bloc.elements.map((element, j) => (
              <li key={j}>{rendreLigne(element)}</li>
            ))}
          </ul>
        );
      case "citation":
        return (
          <blockquote key={i} className="border-l-2 pl-3">
            {rendreLignes(bloc.lignes)}
          </blockquote>
        );
      case "paragraphe":
        return <p key={i}>{rendreLignes(bloc.lignes)}</p>;
    }
  });
}

function rendreLignes(lignes: LigneMarkdown[]) {
  return lignes.map((ligne, j) => (
    <Fragment key={j}>
      {j > 0 && <br />}
      {rendreLigne(ligne)}
    </Fragment>
  ));
}

function rendreLigne(ligne: LigneMarkdown) {
  return ligne.map((segment, i) =>
    segment.gras ? <strong key={i}>{segment.texte}</strong> : <Fragment key={i}>{segment.texte}</Fragment>
  );
}
