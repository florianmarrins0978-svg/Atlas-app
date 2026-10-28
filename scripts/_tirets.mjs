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
 * « {r.nom} · {montant} » : le signe SEUL entre deux valeurs (27 octobre 2026).
 *
 * Les trois motifs d'au-dessus cherchent un mot collé au signe ; quand le
 * signe se tient seul entre deux expressions, il n'y a de mot d'aucun côté
 * du morceau, et « Copropriété Les Tilleuls · 4 608,00 € » passait à l'écran.
 * Les espaces des deux côtés le distinguent du tiret d'une case vide, qui se
 * tient seul SANS espace (`<td>—</td>`).
 */
export const SEUL = new RegExp(`^\\s+[${SIGNES}]\\s*$|^\\s*[${SIGNES}]\\s+$`, "u");

/**
 * Le morceau touche-t-il quelque chose qui s'affiche, d'un côté au moins ?
 *
 * Un côté suffit : « {image.legende} — </span> » coupe la phrase aussi
 * sûrement que « {a} · {b} ». Seul le signe qui ne touche rien, dans sa case,
 * reste un montant absent.
 */
function aCoteDUneValeur(n) {
  const freres = n.parent?.children;
  if (!freres) return false;
  const i = freres.indexOf(n);
  const plein = (x) => x && !(ts.isJsxText(x) && x.text.trim() === "");
  return plein(freres[i - 1]) || plein(freres[i + 1]);
}

/** « a + " · " + b », ou « liste.join(" · ") » : une chaîne qui sert de séparateur. */
function chaineQuiSepare(n) {
  const p = n.parent;
  if (!p) return false;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken) return true;
  return ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === "join";
}

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
  const regarder = (brut, noeud, morceau, separateur = false) => {
    const texte = String(brut).replace(/\s+/g, " ");
    const touche =
      MILIEU.test(texte) || (morceau && (DEBUT.test(texte) || FIN.test(texte))) || (separateur && SEUL.test(texte));
    if (!touche) return;
    const { line } = arbre.getLineAndCharacterOfPosition(noeud.getStart());
    fautes.push({ ligne: line + 1, texte: texte.trim() });
  };
  const visiter = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) regarder(n.text, n, false, chaineQuiSepare(n));
    else if (ts.isTemplateHead(n) || ts.isTemplateTail(n)) regarder(n.text, n, true);
    else if (ts.isTemplateMiddle(n)) regarder(n.text, n, true, true);
    else if (ts.isJsxText(n)) regarder(n.text, n, true, aCoteDUneValeur(n));
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

/** Là où le texte finit sous ses yeux. Le reste ne s'affiche pas. */
const DOSSIERS_VUS = [/^src\//, /^appli\//, /^public\//];
/**
 * Une suite n'est pas une page : `appli/tests/` nomme ses cas comme il veut.
 *
 * **Et `src/app/design/` n'existe pas en production** (constat F12) : sa mise
 * en page rend `notFound()` hors du développement, et ces maquettes gelées
 * depuis le 1er août 2026 ne sont plus relues (`design/layout.tsx`). Même
 * exclusion que `test-geste-retour-partout.ts`, et pour la même raison.
 */
const DOSSIERS_MUETS = [/^appli\/tests\//, /^src\/app\/design\//];
const EXTENSIONS_VUES = /\.(ts|tsx|html|js|jsx)$/;

/**
 * Vrai quand ce fichier-là finit sous ses yeux.
 *
 * Partagé par les TROIS garde-fous : celui qui refuse à l'écriture, celui de
 * la batterie, et celui de la poussée vers `main`. Trois réponses différentes
 * à « ce fichier se voit-il ? » laisseraient une porte ouverte quelque part.
 */
export function fichierQuiSAffiche(chemin) {
  if (typeof chemin !== "string") return false;
  const propre = chemin.replace(/\\/g, "/").replace(/^.*?\/(?=(src|appli|public)\/)/, "");
  if (!EXTENSIONS_VUES.test(propre)) return false;
  if (DOSSIERS_MUETS.some((d) => d.test(propre))) return false;
  return DOSSIERS_VUS.some((d) => d.test(propre));
}

/** Les phrases fautives d'un fichier du dépôt, lues selon ce qu'il est. */
export function fautesDuFichier(chemin, contenu) {
  const html = /\.html$/.test(chemin);
  const fautes = html
    ? fautesDansDuHtml(contenu)
    : fautesDansDuCode(contenu, { tsx: /\.(tsx|jsx)$/.test(chemin) });
  return fautes.filter((f) => !autorise(chemin, f.texte));
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
