import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * FABRIQUE LE TEXTE D'UNE VERSION DE CGU À PARTIR DE LA PAGE PUBLIÉE.
 *
 * **Pourquoi ce script existe.** Sa question du 9 septembre 2026 — « ça sera
 * visible où ? » — a montré que ce que l'artisan ACCEPTE n'est pas ce qu'on
 * PUBLIE : il coche un canevas de quatre paragraphes pendant que dix-neuf
 * articles écrits ne sont acceptés par personne.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI EST REFUSÉ ICI, ET POURQUOI.** Recopier le texte à la main dans
 * `versions.ts` en ferait une TROISIÈME version du même document — après
 * `appli/` et `public/` —, et c'est exactement l'écart qu'on vient de corriger
 * (`CLAUDE.md` §3). Le texte se DÉDUIT donc de la page publiée, une fois, et
 * `test-pages-legales-uniques` refuse ensuite toute divergence.
 *
 * **Et il ne tourne pas au démarrage de l'application.** Une version publiée ne
 * se modifie jamais : si le contenu était lu à chaud, changer un mot dans la
 * page changerait le texte que des artisans ont déjà accepté — leur empreinte
 * SHA-256 ne désignerait plus rien. Le texte est donc figé dans le code, et ce
 * script sert à l'y poser la première fois.
 *
 *   npx tsx scripts/generer-version-cgu.ts            # affiche le texte
 *   npx tsx scripts/generer-version-cgu.ts --ecrire   # l'écrit dans un fichier
 */

const RACINE = path.join(__dirname, "..");

/**
 * Le texte d'une page légale, tel qu'un artisan doit le lire dans un `<pre>`.
 *
 * **Le balisage ne se retire pas au hasard.** Les titres deviennent des lignes
 * en majuscules, les tableaux des lignes « clé : valeur », et les cases
 * `[À COMPLÉTER]` restent VISIBLES — les cacher ferait accepter un document qui
 * paraît fini alors qu'il ne l'est pas.
 */
export function texteDeLaPage(html: string): string {
  // Le corps seul : l'en-tête, le sommaire et le bandeau de brouillon ne font
  // pas partie de ce qu'on accepte — ce sont des aides de lecture.
  const corps = html.slice(html.indexOf("<h2 id=\"art1\""));
  const fin = corps.lastIndexOf("</main>") >= 0 ? corps.lastIndexOf("</main>") : corps.lastIndexOf("<footer");
  const utile = fin > 0 ? corps.slice(0, fin) : corps;

  return (
    utile
      // Un titre d'article devient une ligne à lui, précédée d'un blanc.
      .replace(/<h2[^>]*><span class="num">([^<]*)<\/span>([^<]*)<\/h2>/g, "\n\n$1 — $2\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, "\n\n$1\n")
      // Un tableau se lit en lignes : « intitulé : valeur ».
      .replace(/<tr>\s*<th>(.*?)<\/th>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/g, "\n$1 : $2")
      .replace(/<th>(.*?)<\/th>/g, "$1 · ")
      .replace(/<td[^>]*>(.*?)<\/td>/g, "$1 · ")
      .replace(/<li>/g, "\n  · ")
      .replace(/<\/p>|<\/li>|<\/ul>|<\/ol>|<\/table>|<\/tr>/g, "\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      // Les entités qui restent, et l'espace insécable qui ne se voit pas.
      .replace(/&nbsp;/g, " ")
      .replace(/&laquo;/g, "«")
      .replace(/&raquo;/g, "»")
      .replace(/&rsquo;/g, "’")
      .replace(/&mdash;/g, "—")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/ /g, " ")
      // Trois lignes vides d'affilée ne veulent rien dire de plus que deux.
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

const html = readFileSync(path.join(RACINE, "appli", "conditions-utilisation.html"), "utf8");
const texte = texteDeLaPage(html);

const articles = (texte.match(/^ARTICLE \d+/gm) ?? []).length;
const aCompleter = (texte.match(/\[À COMPLÉTER/g) ?? []).length;

console.log(`${texte.length} caractères · ${articles} articles · ${aCompleter} case(s) à compléter`);
if (articles < 19) {
  console.error("❌ moins de dix-neuf articles : la conversion a perdu quelque chose.");
  process.exit(1);
}

if (process.argv.includes("--ecrire")) {
  const cible = path.join(RACINE, "scripts", "cgu-version-2.txt");
  writeFileSync(cible, texte, "utf8");
  console.log(`écrit dans ${cible}`);
} else {
  console.log("\n──────── les 1 200 premiers caractères ────────\n");
  console.log(texte.slice(0, 1200));
}
