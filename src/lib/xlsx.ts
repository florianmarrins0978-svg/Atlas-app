import { ecrireArchiveZip } from "./archive-zip";

/**
 * Écrire un classeur Excel (`.xlsx`) : des feuilles de cellules, rien d'autre.
 *
 * **Sans bibliothèque**, pour la raison de `archive-zip.ts` et de
 * `lire-classeur.ts` : un `.xlsx` est un ZIP de quelques fichiers XML, et une
 * dépendance qui sait tout le format Office serait une surface d'attaque pour
 * quatre onglets de chiffres.
 *
 * **Ce qu'il sait écrire** : du texte (en ligne, sans magasin partagé), des
 * nombres au format « 1 234,56 », des dates au format « 22/10/2026 », des
 * sommes en formule avec leur valeur déjà calculée (le classeur s'ouvre juste
 * même dans une visionneuse qui ne recalcule pas), une première ligne figée,
 * un filtre sur les titres, les largeurs de colonnes.
 */

export type Cellule =
  | { t: "texte"; v: string; gras?: boolean }
  | { t: "nombre"; v: number; gras?: boolean }
  | { t: "date"; v: string }
  | { t: "formule"; f: string; v: number; gras?: boolean }
  | { t: "vide" };

export type Feuille = {
  nom: string;
  /** La largeur de chaque colonne, en caractères. */
  largeurs: number[];
  /** La première ligne porte les titres : elle se fige et prend le filtre. */
  lignes: Cellule[][];
};

const xml = (t: string) =>
  t
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** « A », « B », … « Z », « AA » : la colonne d'une cellule. */
export function colonne(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Le numéro de série d'Excel pour un jour : les jours écoulés depuis le 30 décembre 1899. */
function serieExcel(iso: string): number {
  const [a, m, j] = iso.split("-").map(Number);
  return Math.round((Date.UTC(a!, m! - 1, j!) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

// Les styles : 0 ordinaire, 1 titre en gras, 2 nombre, 3 date, 4 nombre en gras, 5 texte en gras.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF1C1C1A"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cellule(c: Cellule, ref: string, titre: boolean): string {
  switch (c.t) {
    case "vide":
      return "";
    case "texte":
      return c.v === "" ? "" : `<c r="${ref}" t="inlineStr" s="${titre ? 1 : c.gras ? 5 : 0}"><is><t xml:space="preserve">${xml(c.v)}</t></is></c>`;
    case "nombre":
      return `<c r="${ref}" s="${c.gras ? 4 : 2}"><v>${c.v}</v></c>`;
    case "date":
      return `<c r="${ref}" s="3"><v>${serieExcel(c.v)}</v></c>`;
    case "formule":
      return `<c r="${ref}" s="${c.gras ? 4 : 2}"><f>${xml(c.f)}</f><v>${c.v}</v></c>`;
  }
}

function feuilleXml(f: Feuille): string {
  const largeur = Math.max(1, ...f.lignes.map((l) => l.length));
  const fin = `${colonne(largeur - 1)}${Math.max(1, f.lignes.length)}`;
  const cols = f.largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const rangs = f.lignes
    .map((l, i) => `<row r="${i + 1}">${l.map((c, k) => cellule(c, `${colonne(k)}${i + 1}`, i === 0)).join("")}</row>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="A1:${fin}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${rangs}</sheetData>` +
    (f.lignes.length > 1 ? `<autoFilter ref="A1:${colonne(largeur - 1)}${f.lignes.length}"/>` : "") +
    `</worksheet>`
  );
}

/** Le nom d'un onglet : 31 caractères au plus, sans les sept qu'Excel refuse. */
const nomDOnglet = (n: string) => n.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Feuille";

export async function ecrireClasseur(feuilles: readonly Feuille[], maintenant: Date): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const noms = feuilles.map((f) => nomDOnglet(f.nom));
  const filtres = feuilles
    .map((f, i) => {
      if (f.lignes.length <= 1) return "";
      const largeur = Math.max(1, ...f.lignes.map((l) => l.length));
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(noms[i]!.replace(/'/g, "''"))}'!$A$1:$${colonne(largeur - 1)}$${f.lignes.length}</definedName>`;
    })
    .join("");
  const entrees = [
    {
      nom: "[Content_Types].xml",
      texte:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        `</Types>`,
    },
    {
      nom: "_rels/.rels",
      texte: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nom: "xl/workbook.xml",
      texte:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        noms.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        `</sheets>${filtres ? `<definedNames>${filtres}</definedNames>` : ""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    },
    {
      nom: "xl/_rels/workbook.xml.rels",
      texte:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nom: "xl/styles.xml", texte: STYLES },
    ...feuilles.map((f, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, texte: feuilleXml(f) })),
  ];
  const morceaux: Uint8Array[] = [];
  for await (const m of ecrireArchiveZip(
    entrees.map((e) => ({ nom: e.nom, contenu: enc.encode(e.texte) })),
    maintenant
  )) {
    morceaux.push(m);
  }
  const total = morceaux.reduce((s, m) => s + m.length, 0);
  const octets = new Uint8Array(total);
  let k = 0;
  for (const m of morceaux) {
    octets.set(m, k);
    k += m.length;
  }
  return octets;
}
