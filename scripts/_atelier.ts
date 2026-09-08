import { connect } from "node:net";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * L'ATELIER d'une session : son port, sa base, son coin de Redis.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le problème, dans ses mots (8 septembre 2026).** *« L'idée c'est qu'après
 * ça chaque session puisse tourner en même temps sans se gêner. »*
 *
 * Il fait tourner trois ou quatre sessions dans le même dossier. Une seule peut
 * mesurer, parce que la batterie s'approprie trois choses communes :
 *
 *   · le **port 3000**, où elle monte son serveur ;
 *   · la **base d'essai**, qu'elle vide (`TRUNCATE … CASCADE`) entre les
 *     suites — deux batteries dessus s'effacent mutuellement leurs données,
 *     et c'est le défaut payé le 26 août 2026 : cinq suites rouges d'un coup,
 *     une demi-heure à soupçonner du code juste ;
 *   · le **limiteur de connexion** dans Redis, remis à zéro entre deux suites.
 *
 * Les autres sessions attendent donc cinquante minutes, ou mesurent des
 * chiffres qui n'accusent personne.
 *
 * **Un atelier, c'est ces trois choses, dérivées d'UN seul numéro de rang.**
 * Le rang se prend au premier port libre : celui qui l'obtient possède le
 * créneau, sans que personne ait à se coordonner.
 *
 * | Rang | Port | Base | Redis |
 * |---|---|---|---|
 * | 0 | 3000 | `atlas_test` | base 0 |
 * | 1 | 3001 | `atlas_test_a1` | base 1 |
 * | 2 | 3002 | `atlas_test_a2` | base 2 |
 *
 * **Le rang 0 ne change RIEN à ce qui existe** — même port, même base, même
 * Redis qu'aujourd'hui. C'est délibéré : une session seule se comporte
 * exactement comme avant, et c'est ce qui rend ce lot éprouvable. Le partage ne
 * s'invente que lorsqu'une seconde session arrive.
 *
 * **Et il n'a aucune manip à faire** — sa condition du 5 septembre : *« je
 * t'envoie un prompt et tu te débrouilles »*. Le rang se choisit tout seul ;
 * `npm run verifier:avant-livraison` ne prend ni variable ni option nouvelle.
 * ───────────────────────────────────────────────────────────────────────────
 */
export type Atelier = {
  /** 0 pour la première session, 1 pour la suivante… */
  rang: number;
  port: number;
  /** `http://localhost:<port>`, sans barre oblique finale. */
  adresse: string;
};

/** Au-delà, on refuse plutôt que d'empiler des serveurs sur sa machine. */
const RANGS = 8;
const PORT_ORIGINE = 3000;

/**
 * Le dossier où les ateliers laissent leur jeton.
 *
 * **Pourquoi un jeton en plus du port.** Entre le moment où l'on constate qu'un
 * port est libre et celui où le serveur l'ouvre, il se passe une bonne minute —
 * seed, construction, démarrage. Deux sessions lancées dans la même minute
 * choisiraient toutes deux le même rang, et la seconde tomberait sur un
 * « port déjà pris » au bout d'une minute perdue. Le jeton, lui, se pose tout
 * de suite.
 */
const JETONS = path.join(tmpdir(), "atlas-ateliers");

function cheminDuJeton(rang: number): string {
  return path.join(JETONS, `rang-${rang}`);
}

/** Le processus nommé par ce jeton vit-il encore ? */
function jetonVivant(fichier: string): boolean {
  try {
    const pid = Number(readFileSync(fichier, "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    // Le signal 0 ne tue rien : il demande seulement si le processus existe.
    process.kill(pid, 0);
    return true;
  } catch {
    // Fichier illisible, ou processus mort : le jeton est périmé.
    return false;
  }
}

/**
 * Quelqu'un écoute-t-il déjà sur ce port ?
 *
 * **On ESSAIE DE S'Y CONNECTER, on ne tente pas de l'ouvrir — et c'est un
 * correctif, mesuré le 8 septembre 2026.** La première version ouvrait un
 * serveur d'essai sur `127.0.0.1` : sous Windows, cela RÉUSSIT alors qu'un
 * autre serveur écoute déjà sur `0.0.0.0` — les deux adresses ne se disputent
 * pas comme sous Linux. Le rang 0 était donc rendu « libre » pendant qu'une
 * session voisine servait dessus, et les deux batteries se seraient marché
 * dessus exactement comme avant.
 *
 * Une connexion refusée, elle, dit la même chose sur les deux systèmes.
 */
function portLibre(port: number): Promise<boolean> {
  return new Promise((resoudre) => {
    const essai = connect({ port, host: "127.0.0.1" });
    const finir = (libre: boolean) => {
      essai.destroy();
      resoudre(libre);
    };
    essai.setTimeout(1500, () => finir(false));
    essai.once("error", () => finir(true));
    essai.once("connect", () => finir(false));
  });
}

/**
 * Prend le premier atelier libre, et le garde jusqu'à la fin du processus.
 *
 * **`ATLAS_ATELIER` force le rang**, et sert à deux choses : rejouer un
 * diagnostic sur le même créneau qu'une mesure précédente, et donner à la CI un
 * rang fixe où rien d'autre ne tourne.
 */
export async function prendreUnAtelier(): Promise<Atelier> {
  const impose = process.env.ATLAS_ATELIER;
  if (impose !== undefined) {
    const rang = Number(impose);
    if (!Number.isInteger(rang) || rang < 0 || rang >= RANGS) {
      throw new Error(
        `ATLAS_ATELIER vaut « ${impose} » : on attend un entier de 0 à ${RANGS - 1}.`
      );
    }
    const pris = poser(rang, true);
    if (!pris) throw new Error(`Le rang ${rang} est déjà tenu par une autre session.`);
    return pris;
  }

  mkdirSync(JETONS, { recursive: true });
  for (let rang = 0; rang < RANGS; rang++) {
    const jeton = cheminDuJeton(rang);
    if (existsSync(jeton) && jetonVivant(jeton)) continue;
    if (!(await portLibre(PORT_ORIGINE + rang))) continue;
    // Refusé : une autre session a posé son jeton entre notre coup d'œil et
    // maintenant. On lui laisse ce rang et l'on regarde le suivant.
    const pris = poser(rang);
    if (pris) return pris;
  }

  throw new Error(
    `Les ${RANGS} ateliers sont pris (ports ${PORT_ORIGINE} à ${PORT_ORIGINE + RANGS - 1}).\n` +
      "   Une session de trop mesure en même temps, ou un serveur orphelin tient un port."
  );
}

/**
 * La même chose, mais SANS attendre — pour la batterie.
 *
 * `verifier-avant-livraison.ts` bâtit ses étapes à la lecture du fichier, et il
 * lui faut donc son atelier avant la première ligne : une promesse arriverait
 * trop tard. Node n'offre aucune façon synchrone d'essayer un port, d'où ce
 * court processus enfant — huit au pire, une fois par batterie.
 */
export function prendreUnAtelierSync(): Atelier {
  const impose = process.env.ATLAS_ATELIER;
  if (impose !== undefined) {
    const rang = Number(impose);
    if (!Number.isInteger(rang) || rang < 0 || rang >= RANGS) {
      throw new Error(
        `ATLAS_ATELIER vaut « ${impose} » : on attend un entier de 0 à ${RANGS - 1}.`
      );
    }
    const pris = poser(rang, true);
    if (!pris) throw new Error(`Le rang ${rang} est déjà tenu par une autre session.`);
    return pris;
  }

  mkdirSync(JETONS, { recursive: true });
  for (let rang = 0; rang < RANGS; rang++) {
    const jeton = cheminDuJeton(rang);
    if (existsSync(jeton) && jetonVivant(jeton)) continue;
    if (!portLibreSync(PORT_ORIGINE + rang)) continue;
    // Refusé : une autre session a posé son jeton entre notre coup d'œil et
    // maintenant. On lui laisse ce rang et l'on regarde le suivant.
    const pris = poser(rang);
    if (pris) return pris;
  }

  throw new Error(
    `Les ${RANGS} ateliers sont pris (ports ${PORT_ORIGINE} à ${PORT_ORIGINE + RANGS - 1}).\n` +
      "   Une session de trop mesure en même temps, ou un serveur orphelin tient un port."
  );
}

function portLibreSync(port: number): boolean {
  // Même essai que `portLibre`, dans un court processus enfant : une connexion
  // refusée veut dire « personne n'écoute ». Voir le commentaire de
  // `portLibre` — ouvrir un serveur d'essai ment sous Windows.
  const r = spawnSync(process.execPath, [
    "-e",
    "const s=require('net').connect({port:" + port + ",host:'127.0.0.1'});" +
      "s.setTimeout(1500,()=>{s.destroy();process.exit(1);});" +
      "s.once('error',()=>process.exit(0));" +
      "s.once('connect',()=>{s.destroy();process.exit(1);});",
  ]);
  return r.status === 0;
}

/**
 * Pose le jeton de ce rang, ou rend `null` si quelqu'un vient de le prendre.
 *
 * **La création est EXCLUSIVE (`wx`), et c'est un correctif mesuré le
 * 8 septembre 2026.** Deux batteries lancées dans la même seconde regardaient
 * toutes deux le rang 0, le trouvaient libre, et le prenaient toutes deux — le
 * partage échouait précisément dans le cas qu'il devait couvrir. Ici, le
 * système d'exploitation tranche : un seul des deux crée le fichier, l'autre
 * essuie une erreur et passe au rang suivant.
 *
 * `force` sert au rang imposé par `ATLAS_ATELIER` : là, c'est un humain qui a
 * choisi, et on ne le contredit pas.
 */
function poser(rang: number, force = false): Atelier | null {
  mkdirSync(JETONS, { recursive: true });
  const jeton = cheminDuJeton(rang);
  // Un jeton dont le processus est mort ne garde rien : on le retire d'abord.
  if (existsSync(jeton) && !jetonVivant(jeton)) {
    try {
      unlinkSync(jeton);
    } catch {
      /* une autre session l'a retiré au même instant */
    }
  }
  try {
    writeFileSync(jeton, String(process.pid), { encoding: "utf8", flag: force ? "w" : "wx" });
  } catch {
    return null;
  }
  const rendre = () => {
    try {
      unlinkSync(jeton);
    } catch {
      /* déjà retiré */
    }
  };
  process.on("exit", rendre);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => process.exit(1));
  }
  const port = PORT_ORIGINE + rang;
  return { rang, port, adresse: `http://localhost:${port}` };
}

/**
 * La base de cet atelier, dérivée d'une adresse de connexion.
 *
 * **Le rang 0 rend l'adresse INCHANGÉE**, à la lettre près : c'est ce qui
 * garantit qu'une session seule travaille sur `atlas_test` comme avant, et
 * qu'aucun chiffre de la batterie ne bouge sans seconde session.
 */
export function baseDeLAtelier(url: string, atelier: Atelier): string {
  if (atelier.rang === 0) return url;
  const u = new URL(url);
  // `pathname` porte « /atlas_test » : la barre oblique reste, le nom change.
  u.pathname = `${u.pathname}_a${atelier.rang}`;
  return u.toString();
}

/**
 * Le coin de Redis de cet atelier.
 *
 * Redis tient seize bases numérotées, étanches entre elles. Un rang par base :
 * la remise à zéro du limiteur de connexion (`ratelimit:connexion:*`) ne touche
 * alors que ses propres clés. Sans cela, une session effacerait le compteur
 * qu'une autre est justement en train d'éprouver
 * (`test-connexion-limite-e2e.ts`) — un rouge fabriqué par la voisine.
 */
export function redisDeLAtelier(url: string, atelier: Atelier): string {
  if (atelier.rang === 0) return url;
  const u = new URL(url);
  u.pathname = `/${atelier.rang}`;
  return u.toString();
}

/**
 * Le suffixe à coller à tout ce qui s'écrit SUR LE DISQUE — vide au rang 0.
 *
 * **Les ressources partagées ne sont pas seulement le port et la base.** Deux
 * batteries simultanées se disputeraient aussi :
 *
 *   · `.next-verification`, où l'étape « Construction » écrit — et que la
 *     batterie EFFACE avant de commencer (piège du 5 septembre 2026 : `tsc`
 *     relisait le validateur de routes laissé par la précédente). L'effacer
 *     sous la construction d'une voisine la ferait tomber sur un dossier
 *     disparu, et le rouge accuserait son code ;
 *   · `.next`, où le serveur de développement des suites compile à la demande ;
 *   · le journal de ce serveur, dans le dossier temporaire — deux serveurs y
 *     écrivant l'un sur l'autre, on ne saurait plus lequel est tombé, et c'est
 *     précisément ce journal qu'on lit quand une suite dépasse son délai.
 */
export function suffixeDeLAtelier(atelier: Atelier): string {
  return atelier.rang === 0 ? "" : `-a${atelier.rang}`;
}
