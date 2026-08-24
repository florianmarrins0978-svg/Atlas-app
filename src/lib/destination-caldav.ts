/**
 * Où Atlas a le droit d'aller frapper, quand il parle CalDAV.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LE DÉFAUT QUE CE MODULE FERME** (audit du 23 août 2026, constat E2).
 *
 * L'écran des réglages laissait choisir le calendrier d'écriture ainsi :
 *
 *     reglerEcritureAppleAction({ active, calendrier: { href, nom } })
 *
 * `href` arrivait **du navigateur**, n'était vérifié nulle part, était rangé en
 * base tel quel, puis servait directement d'adresse à `fetch` — avec, sur
 * chaque saut, l'en-tête `Authorization` du compte iCloud de l'artisan.
 *
 * Autrement dit, un propriétaire d'entreprise pouvait faire émettre au serveur
 * des `PUT` et des `DELETE` vers **n'importe quelle adresse** : le service de
 * métadonnées de l'hébergeur, une administration interne, un service qui n'est
 * joignable que depuis l'intérieur. Et faire partir un en-tête
 * d'authentification chez qui il voulait. C'est une falsification de requête
 * côté serveur, et elle était authentifiée mais ouverte à tout locataire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI FERME L'ATTAQUE, ET DANS QUEL ORDRE.**
 *
 * 1. **Une liste blanche de domaines.** C'est elle qui fait le travail : une
 *    destination qui n'est pas sous `icloud.com` n'existe pas pour Atlas. Rien
 *    d'interne n'est joignable, quelle que soit l'astuce.
 * 2. **`https` obligatoire.** Un `http://` traverserait le réseau en clair avec
 *    le mot de passe du compte dedans.
 * 3. **Le refus des adresses IP privées, de bouclage, de lien-local et de
 *    métadonnées**, en v4 comme en v6. Redondant avec (1) — une adresse IP
 *    n'est jamais sous `icloud.com` — et c'est délibéré : le jour où quelqu'un
 *    élargira la liste blanche, ce garde-fou-là sera déjà en place.
 *
 * **On compare des URL ANALYSÉES, jamais du texte.** `https://icloud.com@mechant.example/`
 * commence par « https://icloud.com » et mène chez `mechant.example` : toute
 * comparaison par `startsWith` se fait avoir. `new URL()` rend l'hôte réel,
 * celui auquel le navigateur — et `fetch` — se connectera vraiment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE MODULE NE PRÉTEND PAS FAIRE, et il faut le dire** (`AGENTS.md`).
 *
 * Il ne protège pas d'un **réattachement DNS** : si quelqu'un pouvait faire
 * résoudre `p42-caldav.icloud.com` vers une adresse interne, la liste blanche
 * serait franchie. S'en défendre vraiment demande d'épingler l'adresse résolue
 * à la connexion elle-même — ce que `fetch` ne permet pas sans remplacer sa
 * couche de transport. **Ce n'est donc pas fait, et ce n'est pas prétendu.**
 * Le franchir suppose de toute façon de contrôler le résolveur du serveur,
 * c'est-à-dire une compromission d'un tout autre ordre. C'est écrit dans le
 * rapport de correction, et ce sera à vérifier côté infrastructure.
 */

export const DOMAINE_ICLOUD = "icloud.com";

export type RefusDestination =
  /** L'adresse ne se lit pas comme une URL. */
  | "illisible"
  /** Autre chose que `https`. */
  | "schema"
  /** Une adresse IP privée, de bouclage, de lien-local ou de métadonnées. */
  | "adresse-interne"
  /** Un hôte qui n'est pas sous un domaine autorisé. */
  | "hote-refuse";

export type Destination =
  | { ok: true; url: URL; hote: string }
  | { ok: false; refus: RefusDestination; phrase: string };

/** L'hôte, nettoyé de ce qui peut tromper une comparaison. */
function hoteNormalise(url: URL): string {
  return url.hostname
    .toLowerCase()
    // Le point final d'un nom absolu : `icloud.com.` désigne le même hôte, et
    // le laisser passerait à côté d'une comparaison exacte.
    .replace(/\.$/, "")
    // `new URL` garde les crochets d'une adresse IPv6 littérale.
    .replace(/^\[|\]$/g, "");
}

function estIPv4(hote: string): boolean {
  const parts = hote.split(".");
  return (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
  );
}

/** Une adresse v4 qu'on refuse de joindre. */
function ipv4Interne(hote: string): boolean {
  const [a, b] = hote.split(".").map(Number);
  if (a === 0) return true; // « cet hôte »
  if (a === 10) return true; // privé
  if (a === 127) return true; // bouclage
  if (a === 169 && b === 254) return true; // lien-local ET métadonnées (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // privé
  if (a === 192 && b === 168) return true; // privé
  if (a === 192 && b === 0) return true; // 192.0.0/24, protocoles
  if (a === 100 && b >= 64 && b <= 127) return true; // partagé entre opérateurs
  if (a === 198 && (b === 18 || b === 19)) return true; // bancs de mesure
  if (a >= 224) return true; // multidiffusion et réservé
  return false;
}

/** Une adresse v6 qu'on refuse de joindre. */
function ipv6Interne(hote: string): boolean {
  const h = hote.toLowerCase();

  // Une v4 déguisée en v6 (`::ffff:169.254.169.254`) doit se juger comme une v4 :
  // c'est le contournement le plus court de tout ce fichier.
  const mappee = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappee) return ipv4Interne(mappee[1]);
  // Même chose écrite en hexadécimal (`::ffff:a9fe:a9fe`).
  const hexMappee = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMappee) {
    const n = (parseInt(hexMappee[1], 16) << 16) | parseInt(hexMappee[2], 16);
    return ipv4Interne([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }

  if (h === "::1" || h === "::") return true; // bouclage, indéterminée
  if (/^fe[89ab]/.test(h)) return true; // lien-local fe80::/10
  if (/^f[cd]/.test(h)) return true; // adresses locales uniques fc00::/7
  if (/^ff/.test(h)) return true; // multidiffusion
  return false;
}

/** Cet hôte est-il une adresse IP littérale, et interne ? */
export function hoteInterne(hote: string): boolean {
  if (estIPv4(hote)) return ipv4Interne(hote);
  if (hote.includes(":")) return ipv6Interne(hote);
  // Un nom, pas une adresse. La liste blanche s'en charge — et les noms qui
  // désignent la machine elle-même sont refusés ici pour que ce garde-fou
  // tienne seul si la liste blanche s'élargit un jour.
  return hote === "localhost" || hote.endsWith(".localhost") || hote === "localhost.localdomain";
}

/** Cet hôte est-il sous l'un des domaines autorisés ? */
export function hoteSousDomaine(hote: string, domaines: readonly string[]): boolean {
  return domaines.some((d) => {
    const domaine = d.toLowerCase();
    return hote === domaine || hote.endsWith(`.${domaine}`);
  });
}

/**
 * Cette adresse est-elle une destination CalDAV légitime ?
 *
 * @param domaines Les domaines autorisés. Par défaut ceux d'iCloud — le seul
 *   fournisseur CalDAV branché à ce jour.
 */
export function destinationAutorisee(
  adresse: string,
  domaines: readonly string[] = [DOMAINE_ICLOUD]
): Destination {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return { ok: false, refus: "illisible", phrase: "Cette adresse ne se lit pas." };
  }

  if (url.protocol !== "https:") {
    return {
      ok: false,
      refus: "schema",
      phrase: `Atlas ne parle à un agenda qu'en https — « ${url.protocol.replace(":", "")} » est refusé.`,
    };
  }

  const hote = hoteNormalise(url);

  if (hoteInterne(hote)) {
    return {
      ok: false,
      refus: "adresse-interne",
      phrase: `« ${hote} » désigne une machine interne : Atlas n'y enverra jamais un agenda.`,
    };
  }

  if (!hoteSousDomaine(hote, domaines)) {
    return {
      ok: false,
      refus: "hote-refuse",
      phrase: `« ${hote} » n'est pas un serveur d'agenda reconnu (${domaines.join(", ")}).`,
    };
  }

  return { ok: true, url, hote };
}
