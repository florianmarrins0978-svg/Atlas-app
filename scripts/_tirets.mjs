/**
 * LA RÈGLE DU TIRET, ÉCRITE UNE SEULE FOIS.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa règle du 22 septembre 2026 :** *« Je ne veux plus de tiret, je veux des
 * phrases normales, sans tiret en plein milieu. »*
 *
 * Deux garde-fous la tiennent, et ils ne doivent pas répondre différemment :
 * `garde-tirets.mjs` refuse la phrase **au moment où elle s'écrit**,
 * `test-aucun-tiret.ts` la refuse **dans la batterie**. Deux implémentations
 * finiraient par diverger (`CLAUDE.md` §3) : celle qui écrit laisserait passer
 * ce que celle qui livre refuse, et l'on perdrait une journée à comprendre
 * pourquoi.
 *
 * **CE QU'ON LIT, ET RIEN D'AUTRE : ce qui s'AFFICHERA.** Les chaînes de
 * caractères et le texte des écrans. Les commentaires sont épargnés — ils
 * portent ses phrases à lui, citées telles qu'il les a écrites, et les
 * réécrire lui ferait dire autre chose.
 *
 * **POURQUOI L'ARBRE PLUTÔT QUE DES LIGNES.** La première version lisait
 * ligne à ligne et prenait une apostrophe française pour une ouverture de
 * chaîne : sur le dépôt entier, elle refusait **211 fichiers justes**, tous
 * pour un commentaire qui citait le patron. Un garde-fou qui parle à tort
 * s'apprend à être ignoré (`CLAUDE.md` §1 bis) — donc on demande à TypeScript
 * où sont vraiment les chaînes.
 * ───────────────────────────────────────────────────────────────────────────
 */
import ts from "typescript";

/**
 * Le tiret cadratin, le demi-cadratin, et le point médian.
 *
 * Le trait d'union simple n'y est PAS : il tient « sous-traitant », les dates
 * ISO et le moins d'un `calc(100svh - …)`. Le viser ferait rougir le contrôle
 * des centaines de fois sur du texte juste, donc l'éteindrait.
 */
export const SIGNES = "—–·";
const MOT_AVANT = "\\p{L}\\p{N}%€»)\\]…”\"'";
const MOT_APRES = "\\p{L}\\p{N}«(\\[\"“";

/** « Inconnu — sa fiche sera créée » */
export const MILIEU = new RegExp(`[${MOT_AVANT}]\\s*[${SIGNES}]\\s+[${MOT_APRES}]`, "u");
/** « ${nom} — résilié » : le morceau commence par le tiret, le mot est avant. */
export const DEBUT = new RegExp(`^\\s*[${SIGNES}]\\s+[${MOT_APRES}]`, "u");
/** « Créer : ${a} — » : le morceau finit par le tiret, le mot est après. */
export const FIN = new RegExp(`[${MOT_AVANT}]\\s+[${SIGNES}]\\s*$`, "u");

/**
 * Les phrases fautives d'un bout de code, avec leur ligne.
 *
 * `source` peut être un fichier entier ou le seul morceau qu'une session est
 * en train d'écrire : TypeScript lit l'un comme l'autre, et ce qu'il ne sait
 * pas rattacher ne devient jamais une chaîne, donc jamais une faute.
 */
export function fautesDansDuCode(source, { tsx = true } = {}) {
  const arbre = ts.createSourceFile(
    tsx ? "morceau.tsx" : "morceau.ts",
    String(source ?? ""),
    ts.ScriptTarget.Latest,
    true,
    tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const fautes = [];
  const regarder = (brut, noeud, morceau) => {
    const texte = String(brut).replace(/\s+/g, " ");
    const touche = MILIEU.test(texte) || (morceau && (DEBUT.test(texte) || FIN.test(texte)));
    if (!touche) return;
    const { line } = arbre.getLineAndCharacterOfPosition(noeud.getStart());
    fautes.push({ ligne: line + 1, texte: texte.trim() });
  };
  const visiter = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) regarder(n.text, n, false);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) regarder(n.text, n, true);
    else if (ts.isJsxText(n)) regarder(n.text, n, true);
    ts.forEachChild(n, visiter);
  };
  visiter(arbre);
  return fautes;
}

/**
 * Les phrases fautives d'une page, avec leur ligne.
 *
 * Les commentaires HTML et les feuilles de style sont blanchis **en gardant
 * leurs retours à la ligne**, pour que le numéro annoncé soit celui du
 * fichier. Un tiret seul entre deux balises est une case vide, pas une phrase
 * coupée : c'est ainsi qu'on écrit un montant absent (`CLAUDE.md` §4).
 */
export function fautesDansDuHtml(source) {
  const blanchir = (bloc) => bloc.replace(/[^\n]/g, " ");
  const lignes = String(source ?? "")
    .replace(/<!--[\s\S]*?-->/g, blanchir)
    .replace(/<style[\s\S]*?<\/style>/gi, blanchir)
    .replace(/>\s*[—–]\s*</g, "><")
    .replace(/<[^>]+>/g, " ")
    .split("\n");
  const fautes = [];
  lignes.forEach((ligne, i) => {
    if (MILIEU.test(ligne)) fautes.push({ ligne: i + 1, texte: ligne.trim() });
  });
  return fautes;
}

/**
 * Les seuls endroits qui gardent le leur, chacun avec sa raison.
 *
 * Elle vit ICI, et pas dans chacun des deux garde-fous : une exception connue
 * d'un seul côté ferait refuser à l'écriture ce que la batterie accepte.
 *
 * Le motif vise la LIGNE, jamais le fichier entier : une phrase fautive
 * ajoutée dans un fichier déjà cité ne passerait pas pour autant.
 */
export const AUTORISES = [
  {
    fichier: "src/server/documents-legaux/versions.ts",
    motif: /ARTICLE 1 |Contrat de sous-traitance |# Politique de confidentialité/,
    pourquoi:
      "une version publiée ne se modifie JAMAIS : une acceptation déjà recueillie " +
      "désignerait un texte qui n'existe plus. Le tiret partira dans la version " +
      "rédigée par un juriste, qui sera une entrée de plus (`versions.ts`)",
  },
];

/** Vrai quand cette phrase-là, dans ce fichier-là, garde son tiret. */
export function autorise(fichier, texte) {
  const propre = String(fichier ?? "").replace(/\\/g, "/");
  return AUTORISES.some((a) => propre.endsWith(a.fichier) && a.motif.test(texte));
}

/** Ce qu'on écrit à la place, et c'est la phrase qui décide. */
export const CE_QUI_REMPLACE = [
  "  · une VIRGULE quand la suite complète la phrase ;",
  "  · un DEUX-POINTS quand elle l'explique ;",
  "  · un POINT quand c'est une phrase entière ;",
  "  · deux PARENTHÈSES pour une incise que deux tirets encadraient.",
].join("\n");
