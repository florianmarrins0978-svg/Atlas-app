// L'adresse qu'on met dans un message à un client — et celles qui n'y vont pas.
//
// **Sa capture du 24 août 2026 : « Connexion au serveur impossible. »** Le
// client ouvre le SMS de sa fiche de chantier et tombe sur une page morte, sur
// `localhost`. Le rapport existait, son jeton était bon, la page fonctionnait —
// mais l'adresse envoyée désignait **le téléphone du client lui-même**.
//
// **Le dépôt connaissait déjà ce piège, ailleurs.** Le 9 août 2026, le retour
// d'autorisation Google renvoyait l'artisan vers `localhost:3000` : même cause,
// même page morte, et c'est ce qui a fait naître `adressePublique`
// (`src/server/agenda/adresse-publique.ts`). Ce qui manquait, c'est qu'aucune
// règle ne DISAIT qu'une adresse pareille ne se donne pas à quelqu'un d'autre.
//
// **Pourquoi cela n'arrive que par moments.** L'adresse d'un lien est celle du
// navigateur qui l'a fabriquée. Ouvert par l'adresse publique de son espace de
// travail, le lien est bon ; ouvert par la redirection de port de son éditeur —
// `http://localhost:3000` —, il ne vaut que sur sa machine. Rien à l'écran ne
// distinguait les deux, et le message partait pareil.
//
// **Règle pure, dans `src/lib/`** : le même verdict sert à barrer le geste et à
// écrire la phrase. Deux implémentations finiraient par diverger, et la
// divergence serait un lien mort de plus (`CLAUDE.md` §3).

/**
 * Ce qui ne s'ouvre que depuis la machine qui l'a écrit.
 *
 * **Les plages privées y sont, et il le faut** : `192.168.x.x` s'ouvre chez lui
 * et nulle part ailleurs — sur le téléphone d'un client, elle ne désigne rien,
 * ou pire, sa propre box. Une adresse qui « marche quand on la teste au bureau »
 * est exactement celle qui échoue chez le client.
 */
function estAdresseLocale(hote: string): boolean {
  const nu = hote.trim().toLowerCase();
  if (!nu) return true;

  // IPv6 entre crochets : `[::1]`, et les adresses de lien local `fe80::`.
  if (nu.startsWith("[")) {
    const dedans = nu.slice(1, nu.indexOf("]") === -1 ? undefined : nu.indexOf("]"));
    return dedans === "::1" || dedans.startsWith("fe80:") || dedans.startsWith("fc") || dedans.startsWith("fd");
  }

  const domaine = nu.split(":")[0];
  if (domaine === "localhost" || domaine.endsWith(".localhost")) return true;
  // `.local` est le domaine de Bonjour/mDNS : il ne sort pas du réseau local.
  if (domaine.endsWith(".local")) return true;

  const octets = domaine.split(".");
  if (octets.length === 4 && octets.every((o) => /^\d{1,3}$/.test(o))) {
    const [a, b] = octets.map(Number);
    if (a === 127 || a === 0) return true;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 169.254.x.x : l'auto-configuration, quand aucun serveur n'a répondu.
    if (a === 169 && b === 254) return true;
  }
  return false;
}

/**
 * Cette adresse peut-elle être ouverte par quelqu'un d'AUTRE que l'artisan ?
 *
 * Rend `false` pour une adresse vide : un message sans adresse ne se répare pas
 * mieux qu'un message avec une mauvaise. Dans les deux cas, le client n'a rien.
 */
export function ouvrableParLeClient(origine: string | null | undefined): boolean {
  const nu = (origine ?? "").trim();
  if (!nu) return false;
  try {
    const url = new URL(nu);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return !estAdresseLocale(url.host);
  } catch {
    return false;
  }
}

/**
 * Ce qu'il lit quand le lien ne partirait nulle part.
 *
 * **Elle dit le geste, pas le mécanisme** (`CLAUDE.md` §3 ter). Il n'a pas à
 * savoir ce qu'est une redirection de port : il a à savoir par quelle adresse
 * rouvrir Atlas.
 *
 * **Et elle dit que son travail est SAUF**, ce qui compte autant que le reste :
 * le rapport est figé, le devis envoyé, la facture arrêtée. Sans cette moitié
 * de phrase, il recommencerait — et sur une facture, il rappuierait sur un
 * bouton qui a déjà engagé sa comptabilité.
 *
 * **`quoi` se termine par un verbe neutre — « vous attend ici ».** Écrire
 * « est enregistré » obligerait à accorder : « votre facture est enregistré »
 * est le genre de faute que le patron relève, et il a raison.
 *
 * @param quoi ce qui est en jeu, tel qu'on le lui nomme : « votre rapport »,
 *             « votre devis », « votre facture ».
 */
export function phraseAdresseLocale(quoi: string): string {
  return (
    "Atlas est ouvert sur une adresse qui n'existe que sur votre machine : le lien " +
    "s'ouvrirait sur le téléphone de votre client, pas sur son document. Rouvrez " +
    `Atlas par son adresse web, puis renvoyez — ${quoi} vous attend ici, rien n'est ` +
    "perdu."
  );
}
