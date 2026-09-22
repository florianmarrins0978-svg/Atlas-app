import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * TOUT CE QUI MÈNE À UN PDF PASSE PAR L'UNE DES DEUX PORTES — et rien d'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa demande du 13 septembre 2026 :** *« va vérifier sur chaque devis et
 * facture, à tous les endroits où on peut télécharger ou regarder le pdf, si ça
 * fonctionne bien — je veux plus que ça se reproduise »*.
 *
 * Trois fois de suite, un lot a corrigé UN bouton et laissé les autres :
 *
 *   · le 10 septembre, « Télécharger » servait un type mensonger — corrigé sur
 *     la facture, laissé ailleurs ;
 *   · le 11, la visionneuse a remplacé l'onglet de Safari sur trois liens — et
 *     le quatrième, « Ouvrir le PDF sans les prix » du planning, a été oublié.
 *     Il ouvrait encore un onglet sans flèche de retour, deux jours durant ;
 *   · le 12, les six liens de téléchargement sont devenus un composant — et
 *     rien n'empêchait le septième d'être écrit à la main demain.
 *
 * **Un écran ne remet JAMAIS un PDF au navigateur lui-même.** Il y a deux
 * portes, et deux seulement :
 *
 * | Le geste | Ce qui le porte |
 * |---|---|
 * | garder le document | `BoutonTelechargerDocument` — il va chercher le fichier et le remet à la feuille de partage |
 * | le regarder | `adresseDeLaVisionneuse(...)` — l'écran d'Atlas qui peint le PDF, avec son en-tête et sa flèche |
 *
 * Un `<a href="…/pdf">` posé à la main retombe dans l'un des deux défauts : sur
 * iPhone il PEINT au lieu de ranger, ou il ouvre un onglet d'où l'on ne revient
 * pas. Ce contrôle les refuse tous — y compris ceux qui n'existent pas encore.
 *
 * Ni base, ni réseau, ni navigateur : il lit le code des écrans.
 */

const ECRANS = path.join(__dirname, "..", "src", "app");
const COMPOSANTS = path.join(__dirname, "..", "src", "components");

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Tous les écrans et composants — les routes d'API, elles, SERVENT le PDF. */
function fichiersDEcran(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) {
      // `api/` sert les fichiers, `documents/pdf/` EST la visionneuse : ni
      // l'une ni l'autre ne peut passer par les portes qu'on vérifie ici.
      if (entree === "api") continue;
      trouves.push(...fichiersDEcran(complet));
    } else if (entree.endsWith(".tsx")) {
      trouves.push(complet);
    }
  }
  return trouves;
}

/**
 * Le code seul — les commentaires, eux, ont le droit de PARLER des liens.
 *
 * Trouvé le 22 septembre 2026, avant que cela gêne personne : l'en-tête qui
 * raconte pourquoi « Enregistrer » ne doit plus être un lien citait la forme
 * fautive, et le contrôle accusait l'écran corrigé. Un contrôle qui rougit sur
 * une explication s'apprend à être ignoré (`CLAUDE.md` §1 bis) — le même faux
 * positif qu'avait attrapé `test-garde-redis-des-autres.ts`.
 *
 * On retire les blocs `/* … *\/` et les lignes de commentaire ; un `//` collé
 * en bout de ligne de code reste, et c'est sans conséquence : ce qui précède
 * est du vrai code, et c'est lui qu'on cherche.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((ligne) => !/^\s*(\/\/|\*)/.test(ligne))
    .join("\n");
}

/**
 * Les noms de variables qui PORTENT une adresse de PDF, dans ce fichier-là.
 *
 * **Sans cela, le contrôle ne voyait que la moitié des liens — 22 septembre
 * 2026.** L'écran des fiches de sécurité rangeait son adresse dans un `const
 * pdf = …/pdf`, puis écrivait `href={`${pdf}?telecharger=1`}` : plus aucun
 * « /pdf » dans l'attribut, donc plus rien à voir pour la recherche littérale.
 * Le lien est passé, et sur son iPhone « Enregistrer le PDF » peignait le
 * document au lieu de le ranger — exactement le défaut que ce contrôle existe
 * pour refuser.
 *
 * Une variable n'est pas une cachette : on la suit d'un cran.
 */
function adressesDePdfEnVariable(source: string): string[] {
  const noms: string[] = [];
  for (const m of source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=([^\n]*)/g)) {
    if (/\/pdf|\.pdf/.test(m[2])) noms.push(m[1]);
  }
  return noms;
}

/**
 * Les `href` d'une balise `<a>` ou d'un `<Link>` qui visent une route PDF.
 *
 * **On cherche l'ATTRIBUT, pas le mot « pdf ».** Un commentaire qui parle du
 * PDF, une adresse passée en propriété à un composant qui saura quoi en faire,
 * un `fetch` : rien de tout cela ne remet le document au navigateur. Ce qui le
 * remet, c'est un lien qu'on touche.
 */
export function liensDirectsVersUnPdf(texte: string): string[] {
  const trouves: string[] = [];
  const source = sansCommentaires(texte);
  const variables = adressesDePdfEnVariable(source);
  // `href={...}` ou `href="..."`, jusqu'à la fin de la ligne.
  for (const m of source.matchAll(/href=(\{[^\n]*|"[^"]*")/g)) {
    const valeur = m[1];
    // La visionneuse est une porte : c'est ELLE qui reçoit l'adresse du PDF.
    if (valeur.includes("adresseDeLaVisionneuse")) continue;
    const litteral = /\/pdf|\.pdf/.test(valeur);
    // `?telecharger=1` dans un lien dit tout seul ce qu'il cherche à faire, et
    // c'est précisément ce qu'un lien ne sait pas faire sur un iPhone.
    const demandeUnTelechargement = /telecharger=1|adresseDeTelechargement/.test(valeur);
    const parVariable = variables.some((nom) => new RegExp(`\\b${nom}\\b`).test(valeur));
    if (!litteral && !demandeUnTelechargement && !parVariable) continue;
    trouves.push(valeur.slice(0, 120));
  }
  return trouves;
}

console.log("=== Tout ce qui mène à un PDF passe par l'une des deux portes ===\n");

const fichiers = [...fichiersDEcran(ECRANS), ...fichiersDEcran(COMPOSANTS)].filter(
  // La visionneuse elle-même reçoit le fichier : c'est son métier.
  (f) => !f.includes(path.join("documents", "pdf"))
);

cas("il y a bien des écrans à regarder — sinon ce contrôle ne mesure rien", () => {
  // Un contrôle qui parcourt zéro fichier rend un vert qui ne prouve rien
  // (`CLAUDE.md` §5, payé le 15 août 2026).
  assert.ok(fichiers.length > 50, `seulement ${fichiers.length} écran(s) lus`);
});

cas("aucun écran ne remet un PDF au navigateur par un lien", () => {
  const coupables: string[] = [];
  for (const fichier of fichiers) {
    for (const lien of liensDirectsVersUnPdf(readFileSync(fichier, "utf8"))) {
      coupables.push(`${path.relative(path.join(__dirname, ".."), fichier)} → ${lien}`);
    }
  }
  assert.deepEqual(
    coupables,
    [],
    "un lien direct vers un PDF : sur iPhone il s'ouvre au lieu de se ranger, ou " +
      "il part dans un onglet sans flèche de retour —\n      " +
      coupables.join("\n      ")
  );
});

cas("il voit le lien écrit en toutes lettres", () => {
  const vus = liensDirectsVersUnPdf('<a href="/planning/fiche/pdf">Enregistrer</a>');
  assert.equal(vus.length, 1, "un lien littéral vers un PDF passe inaperçu");
});

cas("il voit le lien dont l'adresse dort dans une variable", () => {
  // LE DÉFAUT DU 22 SEPTEMBRE 2026, tel quel : rien ne dit « pdf » dans
  // l'attribut, et le contrôle le laissait passer.
  const ecran = [
    "const pdf = `/planning/fiche-de-securite/${id}/pdf`;",
    "return <a href={`${pdf}?telecharger=1`}>Enregistrer le PDF</a>;",
  ].join("\n");
  assert.equal(liensDirectsVersUnPdf(ecran).length, 1, "une variable suffisait à cacher un lien");
});

cas("un commentaire qui CITE la forme fautive ne compte pas", () => {
  // Sinon l'écran corrigé est accusé par l'explication de sa correction, et un
  // contrôle qui parle à tort s'apprend à être ignoré.
  const ecran = '// interdit : <a href={`${pdf}?telecharger=1`}>\nconst x = 1;';
  assert.deepEqual(liensDirectsVersUnPdf(ecran), []);
});

cas("la visionneuse reste une porte ouverte", () => {
  const ecran = '<Link href={adresseDeLaVisionneuse(pdf, { titre: "x" })}>Ouvrir</Link>';
  assert.deepEqual(liensDirectsVersUnPdf(ecran), [], "la porte « regarder » est refusée à tort");
});

cas("les deux portes existent, et sont bien celles qu'on croit", () => {
  // Si l'une des deux est renommée ou retirée, le contrôle ci-dessus
  // deviendrait vert sans rien défendre.
  const bouton = path.join(COMPOSANTS, "atlas", "BoutonTelechargerDocument.tsx");
  const visionneuse = path.join(__dirname, "..", "src", "lib", "visionneuse-pdf.ts");
  assert.ok(readFileSync(bouton, "utf8").includes("navigator"), "la porte « garder » ne partage plus rien");
  assert.ok(
    readFileSync(visionneuse, "utf8").includes("export function adresseDeLaVisionneuse"),
    "la porte « regarder » a changé de nom : ce contrôle ne défend plus rien"
  );
});

/**
 * Les routes qui SERVENT un PDF — cherchées, jamais listées.
 *
 * La liste tenue à la main en nommait six et **oubliait déjà la septième**, la
 * fiche de sécurité, écrite la veille. Une liste qui abaisse le contrôle se
 * trompe toujours dans le même sens : le jour où elle oublie un fichier, rien
 * ne le dit (`.claude/rules/testing.md`).
 */
function routesQuiServentUnPdf(racine: string): string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) trouvees.push(...routesQuiServentUnPdf(complet));
    else if (entree === "route.ts" && readFileSync(complet, "utf8").includes("application/pdf")) trouvees.push(complet);
  }
  return trouvees;
}

cas("chaque route qui SERT un PDF répond bien sur les deux gestes", () => {
  // L'autre bout : une route qui ne saurait pas ranger le fichier laisserait la
  // porte « garder » sans effet, et le défaut reviendrait par le serveur.
  const routes = routesQuiServentUnPdf(ECRANS);
  assert.ok(routes.length >= 7, `seulement ${routes.length} route(s) de PDF trouvée(s) : la recherche ne mesure plus rien`);
  for (const complet of routes) {
    const relative = path.relative(path.join(__dirname, ".."), complet);
    const source = readFileSync(complet, "utf8");
    assert.ok(
      source.includes("enTetesDeRemise"),
      `${relative} écrit ses en-têtes lui-même : la règle vit dans src/lib/remise-de-fichier.ts, et une seconde écriture finit par diverger`
    );
    assert.ok(
      source.includes("application/pdf"),
      `${relative} ne sert pas le type réel : le fichier enregistré perdrait son identité et se rouvrirait blanc`
    );
  }
});

console.log(
  echecs === 0 ? "\n✅ Les deux portes, et rien d'autre." : `\n❌ ${echecs} échec(s).`
);
process.exit(echecs === 0 ? 0 : 1);
