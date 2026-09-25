import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// TOUT BOUTON DE RETOUR PORTE LE GESTE — sa règle du 25 septembre 2026 :
// « à chaque fois qu'il y a une touche retour pour une page, qu'on puisse faire
// retour en slidant ». Il a prévenu le jour même qu'une nouvelle fenêtre avec
// un retour arrivait (Ma TVA à la calculette, planche d'une autre session).
//
// Le geste appuie sur l'élément marqué `data-geste-retour` (`GesteRetour.tsx`,
// `ARCHITECTURE.md` §415). Un retour dessiné à la main sans cette marque n'a
// PAS de geste, et rien ne le dit à l'écran : on glisse, rien ne se passe. Ce
// contrôle refuse donc tout élément dont le libellé commence par « Retour » et
// qui ne porte pas la marque, sauf `FlecheRetour`, qui la pose elle-même.

const RACINE = path.join(process.cwd(), "src");

// `src/app/design/*` : les maquettes gelées du 1er août 2026, hors produit
// (`mock-data.ts`). Aucun écran n'y mène ; les marquer toucherait sept fichiers
// qu'il ne voit jamais, pour un geste que personne ne fera.
const HORS_PRODUIT = path.join(RACINE, "app", "design");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    if (chemin === HORS_PRODUIT) return [];
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return chemin.endsWith(".tsx") ? [chemin] : [];
  });
}

/** Le libellé commence-t-il par « Retour », en clair ou dans une expression ? */
function libelleDeRetour(attribut: ts.JsxAttribute): boolean {
  const valeur = attribut.initializer;
  if (!valeur) return false;
  let trouve = false;
  const visiter = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && /^Retour/.test(n.text)) trouve = true;
    if (ts.isTemplateExpression(n) && /^Retour/.test(n.head.text)) trouve = true;
    // Un libellé calculé par une fonction de retour (`libelleRetourDesCoordonnees`).
    if (ts.isIdentifier(n) && /^libelleRetour|^libelle$/.test(n.text) && ts.isPropertyAccessExpression(n.parent)) trouve = true;
    ts.forEachChild(n, visiter);
  };
  visiter(valeur);
  if (ts.isJsxExpression(valeur) && valeur.expression && ts.isCallExpression(valeur.expression)) {
    if (/^libelleRetour/.test(valeur.expression.expression.getText())) trouve = true;
  }
  return trouve;
}

const fautes: string[] = [];
let vus = 0;
for (const fichier of fichiers(RACINE)) {
  const source = readFileSync(fichier, "utf8");
  if (!source.includes("Retour")) continue;
  const arbre = ts.createSourceFile(fichier, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visiter = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const attributs = n.attributes.properties.filter(ts.isJsxAttribute);
      const nom = (a: ts.JsxAttribute) => a.name.getText();
      const libelle = attributs.find((a) => nom(a) === "aria-label");
      if (libelle && libelleDeRetour(libelle) && n.tagName.getText() !== "FlecheRetour") {
        vus++;
        if (!attributs.some((a) => nom(a) === "data-geste-retour")) {
          const { line } = arbre.getLineAndCharacterOfPosition(n.getStart());
          fautes.push(`${path.relative(process.cwd(), fichier)}:${line + 1}`);
        }
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(arbre);
}

// Un contrôle qui ne voit aucun retour ne mesure rien (`CLAUDE.md` §5).
if (vus === 0) {
  console.log("✗ Aucun bouton de retour trouvé dans src/ : la recherche est cassée, pas le code.");
  process.exit(1);
}
if (fautes.length > 0) {
  console.log(`✗ ${fautes.length} retour(s) sans le geste. Ajoutez data-geste-retour="" sur :`);
  for (const f of fautes) console.log(`  ${f}`);
  console.log("  (ou employez FlecheRetour, qui le pose elle-même : ARCHITECTURE.md §415)");
  process.exit(1);
}
console.log(`✓ Les ${vus} boutons de retour dessinés à la main portent le geste.`);
