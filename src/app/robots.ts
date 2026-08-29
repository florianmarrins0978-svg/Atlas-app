import type { MetadataRoute } from "next";

/**
 * Atlas ne s'indexe pas — constat F13.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE FICHIER N'EST PAS UNE FRONTIÈRE DE SÉCURITÉ, ET IL FAUT LE DIRE ICI.**
 *
 * `robots.txt` est une DEMANDE, pas une serrure. Les moteurs sérieux la
 * respectent ; un aspirateur hostile la lit surtout comme une carte de ce qu'on
 * préférerait cacher. Rien de ce qui compte ne doit donc jamais reposer
 * dessus — et rien n'en dépend : les écrans du patron sont fermés par le
 * middleware (`src/middleware.ts`), les pages du client par un jeton de
 * 256 bits contrôlé en base par une politique dédiée (`chemins-publics.ts`).
 *
 * **Ce qu'il apporte réellement**, et c'est modeste mais réel : les liens que
 * le patron envoie par SMS ou par courriel — `/devis/<jeton>`,
 * `/factures/<jeton>`, `/entretien/<jeton>` — voyagent par des canaux qui les
 * font parfois suivre. Une barre d'outils de navigateur, un service qui
 * « déplie » les liens, un moteur qui explore une page ouverte : il suffit
 * d'une fois pour qu'un devis nominatif se retrouve dans un index public, et il
 * n'en sortira plus. Cette ligne dit non à ceux qui écoutent.
 *
 * **Interdire TOUT, plutôt qu'énumérer.** Une liste de chemins interdits est
 * une liste de chemins révélés, et elle se périme au premier écran neuf. Aucune
 * partie d'Atlas n'a vocation à être trouvée par un moteur : ni l'application
 * du patron, ni les documents de ses clients.
 *
 * **Sans `sitemap`, délibérément** : Next.js en poserait la ligne, et un plan
 * de site est exactement ce qu'on ne veut pas publier.
 *
 * **Il faut qu'il soit ATTEIGNABLE SANS SESSION pour servir à quelque chose.**
 * Le middleware renvoie à `/login` tout ce qui n'est pas explicitement laissé
 * de côté : `robots.txt` a donc rejoint `favicon.ico` dans son `matcher`. Sans
 * cela, un moteur recevrait une redirection au lieu de la consigne, et ce
 * fichier n'aurait servi à rien — un garde-fou muet qu'on croit en place.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
