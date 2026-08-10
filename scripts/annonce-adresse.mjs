// L'annonce de l'adresse à ouvrir — écrite UNE fois, pour les deux façons de
// démarrer le banc.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Pourquoi ce fichier existe : deux textes ont divergé, et le contrôle a
// accusé le mauvais coupable pendant deux jours.**
//
// `npm run essai` (l'atelier) écrivait « L'application répond ». `npm run banc`
// (la version bâtie, celle que l'espace de travail démarre tout seul depuis le
// 9 août 2026) écrivait « Atlas répond ». Et `.devcontainer/verifier.sh`
// cherchait la première phrase dans un journal produit par le second script.
//
// Résultat : « ❌ l'adresse à ouvrir n'est annoncée nulle part » à chaque
// exécution — alors que l'adresse était bel et bien annoncée, mot pour mot,
// deux lignes plus haut. Le banc était vert sur tout le reste et rouge sur ce
// seul point, sans que le message désigne quoi que ce soit de réel.
//
// C'est exactement le défaut que `CLAUDE.md` §3 interdit : *« Jamais de règle
// dupliquée entre l'affichage et la vérification. Deux implémentations
// finissent toujours par diverger. »* Elles ont divergé.
//
// Le marqueur est donc **exporté**, et `scripts/test-annonce-adresse.ts`
// vérifie que la phrase cherchée par le script du conteneur est bien celle que
// ce module écrit. Changer l'une sans l'autre fait désormais rougir un test, et
// non le banc entier.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La phrase que `.devcontainer/verifier.sh` cherche dans `/tmp/essai.log`.
 * Elle est le contrat entre ce module et ce script : ne pas la modifier d'un
 * côté seulement.
 */
export const MARQUEUR_PRET = "L'application répond";

/** L'adresse publique de l'espace de travail, quand on y est. */
export function adressePubliquePossible(port) {
  const nom = process.env.CODESPACE_NAME;
  if (!nom) return null;
  const domaine = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
  return `https://${nom}-${port}.${domaine}`;
}

/**
 * Le bloc affiché quand l'application répond : l'adresse à ouvrir, et de quoi
 * s'y connecter.
 *
 * `precision` dit dans quel régime on tourne — bâti ou atelier. Elle vient
 * APRÈS le marqueur, sur la même ligne : le patron lit la phrase, la machine
 * lit le marqueur, et aucun des deux ne gêne l'autre.
 */
export function annoncePrete({ port, precision = "" }) {
  const adresse = adressePubliquePossible(port);
  return (
    "\n  ─────────────────────────────────────────────────────────────\n" +
    `   ${MARQUEUR_PRET}${precision ? ` — ${precision}` : "."}\n\n` +
    (adresse
      ? `     ${adresse}\n\n` +
        // **Ne JAMAIS affirmer que cette adresse est joignable.** Cette ligne
        // disait « Ouvrable depuis un téléphone, telle quelle » et « cette
        // adresse est publique » — sans rien avoir vérifié. Le 10 août 2026,
        // elle l'a écrit alors que le port était PRIVÉ : GitHub servait sa page
        // de connexion, le téléphone du patron ne montrait rien, et le terminal
        // lui affirmait le contraire. Un message qui affirme sans savoir est
        // pire qu'un silence : il fait chercher partout ailleurs.
        //
        // Ce module ne peut pas savoir — il faudrait interroger l'adresse du
        // dehors, ce que fait `scripts/diagnostiquer-banc.mjs`. Il dit donc ce
        // qu'il sait, et surtout à quoi ressemble la panne et comment en sortir.
        "   Si vous y voyez une page de connexion GITHUB au lieu d'Atlas,\n" +
        "   le port est privé. Trois clics dans cet éditeur :\n" +
        "     onglet PORTS → clic droit sur 3000 → « Visibilité » → « Public »\n\n" +
        "   N'y mettez que des données inventées : le mot de passe\n" +
        "   ci-dessous est public.\n\n"
      : `     http://localhost:${port}\n\n`) +
    "     demo@atlas.local  /  demo1234\n" +
    "  ─────────────────────────────────────────────────────────────\n"
  );
}
