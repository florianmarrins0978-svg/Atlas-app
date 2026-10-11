/**
 * Une ligne : la base porte-t-elle le schéma que ce code attend ?
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pour la fiche que son espace publie** (`scripts/diagnostiquer-espace.mjs`,
 * lui-même en JavaScript et hors d'atteinte du TypeScript). Sa panne du
 * 13 septembre 2026 s'est jouée là : sa base était restée en 0087 sous le code
 * de `main`, et rien — ni l'écran, ni la fiche — ne portait cet écart. On l'a
 * cherché dans le produit, où il n'était pas.
 *
 * **Le calcul ne vit PAS ici** : il est dans `src/lib/retard-de-la-base.ts`, et
 * la lecture dans `src/server/retard-de-la-base.ts` — les mêmes que l'écran des
 * Réglages. Un second calcul aurait fini par dire autre chose que l'écran, et
 * deux verdicts qui se contredisent font douter des deux (`CLAUDE.md` §3).
 *
 *   npx tsx scripts/etat-de-la-base.ts
 * ───────────────────────────────────────────────────────────────────────────
 */
import { ligneEtatDeLaBase } from "../src/lib/retard-de-la-base";

async function main() {
  // Importé ICI et non en tête : ouvrir le pool demande `DATABASE_URL`, et sans
  // elle l'import lui-même échoue. Le diagnostic doit rendre une ligne dans tous
  // les cas — c'est une fiche d'état, pas une commande qui a le droit de tomber.
  const { etatDeLaBase } = await import("../src/server/retard-de-la-base");
  const { fermerPool } = await import("../src/server/db/client");

  console.log(ligneEtatDeLaBase(await etatDeLaBase()));
  await fermerPool();
}

main().catch((e) => {
  console.log(ligneEtatDeLaBase(null));
  // La raison sur la sortie d'erreur : la fiche ne publie que la ligne, et le
  // journal garde de quoi comprendre. Taire la cause, c'est la faute du 11 août.
  console.error(e instanceof Error ? e.message : String(e));
});
