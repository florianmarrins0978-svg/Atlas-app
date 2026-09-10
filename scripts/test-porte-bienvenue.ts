import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CHEMINS_PUBLICS } from "../src/lib/chemins-publics";
import { estEcranSansNavigation } from "../src/lib/ecrans-sans-navigation";

/**
 * LA PORTE EN PLEIN AIR — ce qu'il a fait RETIRER ne doit pas revenir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Une suite qui ne vérifie que ce qui est PRÉSENT laisse revenir ce qu'on a
 * fait enlever, sans que ça se voie.** Sur la planche du 8 septembre 2026, il a
 * retiré deux choses de l'écran d'accueil — l'accroche sous le nom et le sceau
 * à l'étoile —, et c'est le genre d'ornement qu'une session suivante rajoute de
 * bonne foi en trouvant l'écran nu.
 *
 * **Ce qui est vérifié ici est STRUCTUREL, jamais un libellé** (`CLAUDE.md`
 * §5 bis) : le middleware qui envoie ici, l'absence de navigation, et les deux
 * retraits. S'il fait changer un mot demain, rien ne rougit.
 *
 * **La porte est le seul écran d'Atlas qui écrit ses couleurs**, et c'est
 * assumé : elle est posée sur une photo, pas sur une charte — personne n'est
 * connu à cette adresse, donc aucune charte n'est choisie. Les deux voiles sont
 * ce qui rend le texte lisible sur cette photo ; leur absence se verrait au
 * soleil, et c'est pourquoi cette suite les exige.
 *
 * **Elle sait échouer** : remettre `<SceauAtlas` dans la porte, ou retirer un
 * voile, la fait rougir immédiatement.
 */

const RACINE = path.join(__dirname, "..");
const lire = (relatif: string) => readFileSync(path.join(RACINE, relatif), "utf8");

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/** Les commentaires en citent, et c'est le contraire d'une faute. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const PORTE = lire("src/app/bienvenue/page.tsx");
const CODE = sansCommentaires(PORTE);

test("un visiteur sans compte arrive à la porte, pas au formulaire", () => {
  const middleware = lire("src/middleware.ts");
  assert.match(middleware, /new URL\("\/bienvenue"/, "le middleware n'envoie plus à la porte");
});

test("la porte et la création s'ouvrent sans compte", () => {
  for (const chemin of ["/bienvenue", "/creer-un-compte"] as const) {
    assert.ok(
      (CHEMINS_PUBLICS as readonly string[]).includes(chemin),
      `${chemin} est privé : un visiteur y serait renvoyé vers lui-même, indéfiniment`
    );
  }
});

test("ni l'une ni l'autre ne porte la barre d'onglets", () => {
  // Une barre d'onglets sur un écran d'avant le compte proposerait des adresses
  // qui renverraient toutes ici : elle ne mène nulle part.
  assert.ok(estEcranSansNavigation("/bienvenue"));
  assert.ok(estEcranSansNavigation("/creer-un-compte"));
});

test("l'accroche et le sceau restent retirés — sa demande du 8 septembre", () => {
  assert.ok(!CODE.includes("SceauAtlas"), "le sceau à l'étoile est revenu sur la porte");
  assert.ok(!/Atlas vous suit|carnet|chantier au devis/i.test(CODE), "une accroche est revenue sous le nom");
});

test("les deux voiles tiennent la photo, sans quoi rien ne se lit dehors", () => {
  const voiles = CODE.match(/linear-gradient/g) ?? [];
  assert.ok(voiles.length >= 1, "le voile de la photo a disparu : ATLAS se perd dans le rai de soleil");
  assert.match(CODE, /priority/, "la photo n'est plus prioritaire : un carré noir, puis une forêt");
});

test("les deux gestes de la porte mènent quelque part", () => {
  assert.match(CODE, /href="\/creer-un-compte"/);
  assert.match(CODE, /href="\/login"/);
  // Et le retour existe dans les deux sens : sans lui, « Se connecter » est un
  // aller simple pour qui découvre qu'il n'a pas de compte.
  /**
   * **TOUT le dossier de la porte, et non son seul `page.tsx`.** La regle
   * defendue est « depuis /login on revient a la porte et l'on va a la
   * creation » — elle ne dit rien de la LIGNE ou le lien est ecrit. Le
   * 10 septembre 2026 la porte s'est scindee en `page.tsx` (serveur) et
   * `FormulaireConnexion.tsx` (ecran) : cette suite a rougi sur un
   * deplacement de fichier, alors que les deux liens etaient la. Une suite
   * qui fige un fichier rend l'ecran impossible a rearranger
   * (`CLAUDE.md` §5 bis).
   */
  const login = readdirSync("src/app/login")
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => sansCommentaires(lire(`src/app/login/${f}`)))
    .join("\n");
  assert.match(login, /href="\/bienvenue"/, "on ne peut plus revenir à la porte depuis /login");
  assert.match(login, /href="\/creer-un-compte"/, "/login ne mène pas à la création");
});

test("les fichiers de public/ ne passent pas par le middleware", () => {
  // **Trouvé sur une capture, pas par un test** : la photo de la porte ne
  // s'affichait pas, et les deux pages légales qu'on fait accepter renvoyaient
  // une redirection. Un visiteur sans session est précisément celui qui les
  // demande.
  const middleware = lire("src/middleware.ts");
  const ligne = middleware.match(/matcher: \[(.+)\]/)?.[1];
  assert.ok(ligne, "le matcher du middleware est introuvable");
  const motif = new RegExp(JSON.parse(ligne!.trim()));

  for (const fichier of [
    "/images/porte-foret.jpg",
    "/conditions-utilisation.html",
    "/confidentialite.html",
    "/manifest.json",
    "/robots.txt",
    "/favicon.ico",
    "/icones/icone-192.png",
  ]) {
    assert.ok(!motif.test(fichier), `${fichier} passe par le middleware : il recevra une redirection`);
  }
  // **ET LES FICHIERS SERVIS PAR UNE ROUTE RESTENT GARDÉS** — régression de ce
  // lot, trouvée le 9 septembre en réparant les rouges : les clés de stockage
  // portent l'extension du fichier, et la première version de la règle emportait
  // donc `/api/fichiers/<clé>.png`. Le logo du patron ne s'affichait plus sur
  // ses devis. Un fichier servi par une route n'est pas un fichier de `public/`.
  for (const ecran of [
    "/",
    "/planning",
    "/reglages",
    "/api/devis",
    "/devis/abc123",
    "/api/fichiers/logos/abc.png",
    "/api/fichiers/audio/note.webm",
  ]) {
    assert.ok(motif.test(ecran), `${ecran} ne passe plus par le middleware : la garde de session a sauté`);
  }
});

test("ce qu'on accepte est lisible AVANT d'accepter", () => {
  assert.match(CODE, /conditions-utilisation\.html/);
  assert.match(CODE, /confidentialite\.html/);
  for (const page of ["public/conditions-utilisation.html", "public/confidentialite.html"]) {
    assert.ok(lire(page).length > 2000, `${page} est vide ou tronquée`);
  }
});

console.log(`\n${passed} réussis, ${failed} échoués`);
if (failed > 0) process.exit(1);
