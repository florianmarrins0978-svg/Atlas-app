/* =======================================================================
   AUCUN TIRET AU MILIEU D'UNE PHRASE — ni point médian.

   **Sa règle, redite le 22 septembre 2026 :** *« Je ne veux plus de
   tiret, je veux des phrases normales, sans tiret en plein milieu. »*
   Elle avait été posée le matin même, devant « Probable · Peuplier » :
   *« Plus jamais tu mets de point entre le nom et probable ! Retiens
   pour les autres fiches, et plus jamais de tiret, fais des phrases
   normales. »*

   **Pourquoi un contrôle et pas seulement `CLAUDE.md` §3.** Le soir du
   22 septembre, deux cent quarante tirets vivaient encore dans les
   écrans, le papier du client et les maquettes — alors que la règle
   était écrite. Une règle de style qui ne vit qu'en prose se perd au
   troisième écran écrit par une autre session : les flèches décoratives
   ont dû être redemandées deux fois avant que `test-aucune-fleche.ts`
   existe, et c'est le même besoin ici.

   **CE QU'IL REGARDE.** Ce qui s'AFFICHE, et rien d'autre : les chaînes
   de caractères et le texte des écrans (`src/`), plus les maquettes
   publiées (`appli/`). Les commentaires sont épargnés — ils portent ses
   propres phrases, citées telles qu'il les a écrites, et les réécrire
   reviendrait à lui faire dire autre chose.

   **UN TIRET « ENTRE DEUX MOTS », ET PAS UN AUTRE.** « sous-traitant »,
   « 2026-09-22 », « — » seul dans une case vide (un montant absent
   s'écrit ainsi, `CLAUDE.md` §4) : rien de tout cela n'est visé. Ce qui
   est refusé, c'est le tiret qui remplace une virgule ou un point.

   Il sait échouer : remettre « Bon pour accord — signature du client »
   dans `document-commun.ts` le rend rouge en nommant le fichier.
   ======================================================================= */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const RACINE = path.join(__dirname, "..");

/**
 * Le tiret cadratin, le demi-cadratin, et le point médian.
 *
 * Le trait d'union simple n'y est PAS : il tient « sous-traitant », les
 * dates ISO et le « moins » d'un calcul CSS (`calc(100svh - …)`). Le viser
 * ferait rougir le contrôle des centaines de fois sur du texte juste, donc
 * l'éteindrait — c'est la leçon des guillemets français de
 * `test-aucune-fleche.ts`.
 */
const SIGNES = "—–·";
const MOT_AVANT = "\\p{L}\\p{N}%€»)\\]…”\"'";
const MOT_APRES = "\\p{L}\\p{N}«(\\[\"“";
const MILIEU = new RegExp(`[${MOT_AVANT}]\\s*[${SIGNES}]\\s+[${MOT_APRES}]`, "u");
/** « ${nom} — résilié » : le morceau commence par le tiret, le mot est avant. */
const DEBUT = new RegExp(`^\\s*[${SIGNES}]\\s+[${MOT_APRES}]`, "u");
/** « Créer : ${a} — » : le morceau finit par le tiret, le mot est après. */
const FIN = new RegExp(`[${MOT_AVANT}]\\s+[${SIGNES}]\\s*$`, "u");

/**
 * Les seuls endroits qui gardent le leur, chacun avec sa raison.
 *
 * Le motif vise la LIGNE, jamais le fichier entier : un libellé fléché
 * ajouté dans un fichier déjà cité ne passerait pas pour autant.
 */
const AUTORISES: { fichier: string; motif: RegExp; pourquoi: string }[] = [
  {
    fichier: "src/server/documents-legaux/versions.ts",
    motif: /ARTICLE 1 |Contrat de sous-traitance |# Politique de confidentialité/,
    pourquoi:
      "une version publiée ne se modifie JAMAIS : une acceptation déjà recueillie " +
      "désignerait un texte qui n'existe plus. Le tiret partira dans la version " +
      "rédigée par un juriste, qui sera une entrée de plus (`versions.ts`)",
  },
];

const DOSSIERS_CODE = ["src"];
const MAQUETTES = "appli";

function fichiersDe(racine: string, extensions: string[]): string[] {
  const trouves: string[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      if (entree === "node_modules" || entree === ".next") continue;
      const chemin = path.join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (extensions.some((e) => chemin.endsWith(e))) trouves.push(chemin);
    }
  };
  parcourir(path.join(RACINE, racine));
  return trouves;
}

type Faute = { fichier: string; ligne: number; texte: string };

const relatif = (chemin: string) => path.relative(RACINE, chemin).replace(/\\/g, "/");

function autorise(fichier: string, texte: string): boolean {
  return AUTORISES.some((a) => a.fichier === fichier && a.motif.test(texte));
}

/** Le code : on lit l'ARBRE, pas le fichier — sinon on relirait les commentaires. */
function fautesDuCode(): Faute[] {
  const fautes: Faute[] = [];
  for (const chemin of fichiersDe("src", [".ts", ".tsx"])) {
    const source = ts.createSourceFile(
      chemin,
      readFileSync(chemin, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      chemin.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const fichier = relatif(chemin);
    const regarder = (brut: string, noeud: ts.Node, morceau: boolean) => {
      const texte = brut.replace(/\s+/g, " ");
      const touche = MILIEU.test(texte) || (morceau && (DEBUT.test(texte) || FIN.test(texte)));
      if (!touche || autorise(fichier, texte)) return;
      const { line } = source.getLineAndCharacterOfPosition(noeud.getStart());
      fautes.push({ fichier, ligne: line + 1, texte: texte.trim().slice(0, 100) });
    };
    const visiter = (noeud: ts.Node) => {
      if (ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud)) {
        regarder(noeud.text, noeud, false);
      } else if (ts.isTemplateHead(noeud) || ts.isTemplateMiddle(noeud) || ts.isTemplateTail(noeud)) {
        regarder(noeud.text, noeud, true);
      } else if (ts.isJsxText(noeud)) {
        regarder(noeud.text, noeud, true);
      }
      ts.forEachChild(noeud, visiter);
    };
    visiter(source);
  }
  return fautes;
}

/** Les maquettes : le texte de la page, balises et commentaires HTML retirés. */
function fautesDesMaquettes(): Faute[] {
  const fautes: Faute[] = [];
  for (const chemin of fichiersDe(MAQUETTES, [".html"])) {
    const brut = readFileSync(chemin, "utf8");
    const fichier = relatif(chemin);
    const lignes = brut
      .replace(/<!--[\s\S]*?-->/g, (bloc) => bloc.replace(/[^\n]/g, " "))
      // **Un tiret SEUL dans une balise est une case vide**, pas une phrase
      // coupée : « la page fait <b id="large">—</b> pour 664 px » attend une
      // mesure. C'est l'écriture d'un montant absent (`CLAUDE.md` §4), et la
      // retirer AVANT d'enlever les balises évite d'accuser une valeur qui
      // n'est pas encore là.
      .replace(/>\s*[—–]\s*</g, "><")
      .replace(/<style[\s\S]*?<\/style>/gi, (bloc) => bloc.replace(/[^\n]/g, " "))
      .replace(/<[^>]+>/g, " ")
      .split("\n");
    lignes.forEach((ligne, i) => {
      if (!MILIEU.test(ligne) || autorise(fichier, ligne)) return;
      fautes.push({ fichier, ligne: i + 1, texte: ligne.trim().slice(0, 100) });
    });
  }
  return fautes;
}

console.log("=== Aucun tiret au milieu d'une phrase ===\n");

const fautes = [...fautesDuCode(), ...fautesDesMaquettes()];

if (fautes.length > 0) {
  for (const f of fautes.slice(0, 40)) {
    console.error(`  ✗ ${f.fichier}:${f.ligne}\n      ${f.texte}`);
  }
  if (fautes.length > 40) console.error(`  … et ${fautes.length - 40} autre(s)`);
  console.error(
    `\n❌ ${fautes.length} tiret(s) ou point(s) médian(s) au milieu d'une phrase.\n` +
      "   Sa règle du 22 septembre 2026 : des phrases normales. Une virgule, un\n" +
      "   deux-points, un point — et deux parenthèses pour une incise.\n"
  );
  process.exit(1);
}

console.log(`  ✓ ${AUTORISES.length} exception(s) nommée(s), chacune avec sa raison`);
for (const a of AUTORISES) console.log(`      ${a.fichier} : ${a.pourquoi.split(" :")[0]}`);
console.log("\n✅ Les écrans, le papier et les maquettes font des phrases.");
