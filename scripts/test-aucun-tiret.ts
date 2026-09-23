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
import { fautesDansDuCode, fautesDansDuHtml, autorise, AUTORISES } from "./_tirets.mjs";

const RACINE = path.join(__dirname, "..");

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

/** Le code : on lit l'ARBRE, pas le fichier — sinon on relirait les commentaires. */
function fautesDuCode(): Faute[] {
  const fautes: Faute[] = [];
  for (const chemin of fichiersDe("src", [".ts", ".tsx"])) {
    const fichier = relatif(chemin);
    // Un `.ts` se lit en TS : « const f = <E>(a, b) => … » y est un générique,
    // et le lire comme une balise ferait passer tout le fichier pour du texte
    // d'écran (quatre fichiers justes refusés, trouvé le 23 septembre 2026).
    for (const f of fautesDansDuCode(readFileSync(chemin, "utf8"), { tsx: chemin.endsWith(".tsx") })) {
      if (!autorise(fichier, f.texte)) fautes.push({ fichier, ligne: f.ligne, texte: f.texte.slice(0, 100) });
    }
  }
  return fautes;
}

/** Les maquettes : le texte de la page, balises et commentaires HTML retirés. */
function fautesDesMaquettes(): Faute[] {
  const fautes: Faute[] = [];
  for (const chemin of fichiersDe(MAQUETTES, [".html"])) {
    const fichier = relatif(chemin);
    for (const f of fautesDansDuHtml(readFileSync(chemin, "utf8"))) {
      if (!autorise(fichier, f.texte)) fautes.push({ fichier, ligne: f.ligne, texte: f.texte.slice(0, 100) });
    }
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
