import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * LA COULEUR DE CHAQUE TEXTE D'UN PDF, relue dans les opérations de ses pages.
 *
 * Sa demande du 24 novembre 2026, devant les documents du comptable : « vu que
 * c'est des documents comptables, il faut que ça soit lisible facilement ;
 * tout ce qui est gris clair, tu le mets en noir ; ce que tu veux faire
 * ressortir, soit tu modifies la police, soit tu mets en gras ». Les suites de
 * ces documents (le dossier, l'attestation) relisent ici la même chose, pour
 * ne jamais tenir deux règles du gris.
 *
 * Rend, pour chaque couleur en #rrggbb, le nombre de textes écrits avec elle :
 * la dernière couleur de remplissage posée avant chaque « écrire ».
 */
export async function couleursDuTexte(octets: Uint8Array): Promise<Map<string, number>> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = `${pathToFileURL(path.resolve("node_modules/pdfjs-dist/standard_fonts")).href}/`;
  const doc = await pdfjs.getDocument({ data: octets.slice(), standardFontDataUrl }).promise;
  const { OPS } = pdfjs;
  const ecrire = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);
  const hex = (a: unknown[]): string =>
    typeof a[0] === "string"
      ? a[0].toLowerCase()
      : `#${(a as number[]).slice(0, 3).map((v) => Math.round(v <= 1 ? v * 255 : v).toString(16).padStart(2, "0")).join("")}`;
  const vu = new Map<string, number>();
  for (let i = 1; i <= doc.numPages; i++) {
    const ops = await (await doc.getPage(i)).getOperatorList();
    let courante = "#000000";
    const pile: string[] = [];
    ops.fnArray.forEach((fn, k) => {
      if (fn === OPS.save) pile.push(courante);
      else if (fn === OPS.restore) courante = pile.pop() ?? "#000000";
      else if (fn === OPS.setFillRGBColor) courante = hex(ops.argsArray[k] as unknown[]);
      else if (ecrire.has(fn)) vu.set(courante, (vu.get(courante) ?? 0) + 1);
    });
  }
  return vu;
}

/** Un gris : les trois teintes presque égales, et plus clair que l'encre (#1c1c1a). */
export function estGris(hexa: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexa.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) > 0x30;
}

/** Les textes gris d'un PDF, en une phrase par couleur ; vide quand tout est à l'encre. */
export async function textesGris(octets: Uint8Array): Promise<{ total: number; encre: boolean; grises: string[] }> {
  const couleurs = await couleursDuTexte(octets);
  return {
    total: [...couleurs.values()].reduce((a, n) => a + n, 0),
    encre: couleurs.has("#1c1c1a"),
    grises: [...couleurs].filter(([c]) => estGris(c)).map(([c, n]) => `${c} (${n} textes)`),
  };
}
