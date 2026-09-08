import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * LA BATTERIE EST UNE MACHINE À UN SEUL OCCUPANT — et elle le vérifie.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Payé le 8 septembre 2026 au soir, une heure perdue, et le patron l'a vu.**
 *
 * Une batterie tournait. Sa correction est arrivée, j'ai codé pendant qu'elle
 * mesurait, puis je l'ai arrêtée pour la relancer. Deux fautes en une :
 *
 *   1. **des fichiers ont bougé sous elle** — son verdict ne portait plus sur
 *      rien ;
 *   2. **son moteur de suites navigateur a survécu à l'arrêt** : `pkill` a tué
 *      le père, jamais les enfants. Il a continué à jouer des suites qui
 *      **vident la base** (`TRUNCATE … CASCADE`), sous la batterie suivante.
 *      Cinq contrôles d'authentification ont rougi d'un coup, sur du code
 *      juste — exactement la panne du 26 août, réécrite à l'identique.
 *
 * **`CLAUDE.md` le disait déjà en prose**, et cela n'a pas suffi : une consigne
 * se lit au début d'une conversation et s'oublie au bout de trois heures — or
 * c'est au bout de trois heures qu'on arrête une batterie pour en relancer une.
 * D'où ces deux garde-fous, qui ne dépendent de la mémoire de personne.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QU'ILS NE FONT PAS, ET C'EST DÉLIBÉRÉ.** Ils ne tuent rien : le
 * processus d'à côté peut être la batterie d'une AUTRE session, en train de
 * mesurer pour de bon (l'atelier existe pour qu'elles cohabitent). On refuse de
 * démarrer, on nomme ce qui tourne, et l'on rend la décision à qui sait.
 */

/** Ce qui, dans une ligne de commande, trahit une batterie ou l'un de ses restes. */
const SIGNATURES = [
  "scripts/verifier-avant-livraison.ts",
  "scripts/run-all-tests.ts",
  "scripts/run-e2e-tests.ts",
  "scripts/verifier-connexion-avec-serveur.mts",
];

export type Reste = { pid: number; commande: string };

/**
 * TOUTE la lignée du processus courant — et pas seulement son père.
 *
 * **Trouvé en confrontant le garde-fou à une vraie batterie**, dans la minute
 * qui a suivi son écriture : il se dénonçait LUI-MÊME. Entre le terminal et le
 * `node` qui exécute la batterie, il y a cinq processus — `bash`, `timeout`,
 * `npm exec`, `sh -c`, `node` — et **tous portent son nom dans leur ligne de
 * commande**. Écarter le père et soi n'en retirait que deux : le refus partait
 * à tous les coups, et une batterie n'aurait plus jamais démarré.
 *
 * C'est exactement ce que sa propre suite annonçait sans pouvoir le voir : un
 * garde-fou qui parle toujours s'apprend à être ignoré, et l'on perd la
 * protection sans s'en apercevoir.
 */
export function lignee(pid: number, pereDe: (p: number) => number | null): number[] {
  const chaine: number[] = [];
  let courant: number | null = pid;
  // On s'arrête à 1 (`init`) ; la borne évite une boucle si la table des
  // processus ment — un père qui se désigne lui-même, vu sur certains conteneurs.
  while (courant && courant > 1 && chaine.length < 32) {
    chaine.push(courant);
    const pere: number | null = pereDe(courant);
    courant = pere === courant ? null : pere;
  }
  return chaine;
}

/**
 * Ce qu'il faut écarter : soi, et toute sa lignée jusqu'au terminal.
 *
 * Se donner en pâture à `restesDeBatterie` sans cela fait refuser TOUTES les
 * batteries — voir `lignee`, et la minute où c'est arrivé.
 */
export function saPropreLignee(
  processus: { pid: number; pere: number }[],
  soi = process.pid
): number[] {
  const peres = new Map(processus.map((p) => [p.pid, p.pere]));
  return lignee(soi, (p) => peres.get(p) ?? null);
}

/**
 * Les restes d'une batterie, lus dans une liste de processus.
 *
 * **Fonction pure**, parce que c'est la seule façon de l'éprouver : la nourrir
 * de vraies lignes relevées le soir de la panne, plutôt que d'espérer qu'une
 * panne se reproduise pendant qu'on regarde (`CLAUDE.md` §3).
 *
 * `soi` et son père sont retirés : une batterie qui se verrait elle-même
 * refuserait de démarrer à tous les coups, ce qui est le pire des garde-fous —
 * celui qui parle toujours, donc qu'on apprend à contourner.
 */
export function restesDeBatterie(
  lignes: { pid: number; commande: string }[],
  soi: number[] = []
): Reste[] {
  return lignes
    .filter((l) => !soi.includes(l.pid))
    .filter((l) => SIGNATURES.some((s) => l.commande.includes(s)))
    .map(({ pid, commande }) => ({ pid, commande }));
}

/** Les processus de la machine, sous la forme que la fonction ci-dessus attend. */
export function processusDeLaMachine(): { pid: number; pere: number; commande: string }[] {
  try {
    const sortie = execFileSync("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8" });
    return sortie
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(\d+)\s+(\d+)\s+(.*)$/);
        return m ? { pid: Number(m[1]), pere: Number(m[2]), commande: m[3] } : null;
      })
      .filter((l): l is { pid: number; pere: number; commande: string } => l !== null);
  } catch {
    // **Pas de `ps` — Windows, un conteneur nu.** On ne bloque pas une batterie
    // pour un outil absent : le garde-fou se tait, et c'est la seule forme de
    // silence acceptable ici. L'autre garde-fou, lui, ne dépend d'aucun outil.
    return [];
  }
}

/** Ce qu'on affiche quand on refuse — nommer, et dire quoi faire. */
export function phraseDuRefus(restes: Reste[]): string {
  const lignes = restes.map((r) => `     ${r.pid}  ${r.commande.slice(0, 110)}`);
  return (
    "❌ Une batterie tourne déjà, ou elle a laissé des restes.\n\n" +
    lignes.join("\n") +
    "\n\n" +
    "   Ces processus VIDENT LA BASE entre deux suites. Mesurer par-dessus rend\n" +
    "   des rouges qui n'accusent personne — une demi-heure à soupçonner du code\n" +
    "   juste, deux fois déjà (26 août, 8 septembre).\n\n" +
    "   Si c'est la batterie d'une autre session : attendez-la.\n" +
    `   Si ce sont des restes de la vôtre : kill ${restes.map((r) => r.pid).join(" ")}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Ce qu'on relève d'un fichier : son chemin et la date de sa dernière écriture. */
export type Empreinte = Map<string, number>;

const SURVEILLES = ["src", "scripts", "drizzle"];
const IGNORES = new Set(["node_modules", ".git", ".next"]);

/**
 * L'état des sources à un instant — pour savoir, à la fin, si elles ont bougé.
 *
 * On relève la DATE D'ÉCRITURE et non le contenu : lire trois mille fichiers au
 * début et à la fin d'une batterie coûterait plus que ce qu'on cherche à
 * protéger, et une écriture qui rend le même contenu ne change rien au verdict.
 */
export function empreinteDesSources(racine: string): Empreinte {
  const empreinte: Empreinte = new Map();
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      if (IGNORES.has(entree.name) || entree.name.startsWith(".next")) continue;
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      else if (/\.(ts|tsx|js|mjs|mts|sql|css)$/.test(entree.name)) {
        empreinte.set(path.relative(racine, chemin), statSync(chemin).mtimeMs);
      }
    }
  };
  for (const dossier of SURVEILLES) {
    try {
      parcourir(path.join(racine, dossier));
    } catch {
      // Un dossier absent n'est pas une faute : `drizzle/` n'existe pas partout.
    }
  }
  return empreinte;
}

/**
 * Ce qui a bougé entre deux empreintes — écrit, ajouté ou supprimé.
 *
 * **Fonction pure**, et c'est ce qui permet de l'éprouver sans attendre
 * cinquante minutes qu'une batterie finisse.
 */
export function fichiersRemues(avant: Empreinte, apres: Empreinte): string[] {
  const remues = new Set<string>();
  for (const [chemin, date] of apres) {
    if (avant.get(chemin) !== date) remues.add(chemin);
  }
  for (const chemin of avant.keys()) {
    if (!apres.has(chemin)) remues.add(chemin);
  }
  return [...remues].sort();
}

/** Ce qu'on ajoute au verdict quand des fichiers ont bougé pendant la mesure. */
export function phraseDuVerdictCaduc(remues: string[]): string {
  const trois = remues.slice(0, 3);
  const suite = remues.length > 3 ? `, et ${remues.length - 3} autre(s)` : "";
  return (
    "⚠️  CE VERDICT NE PORTE SUR RIEN : des fichiers ont été écrits PENDANT la mesure.\n\n" +
    trois.map((f) => `     ${f}`).join("\n") +
    (suite ? `\n     …${suite}` : "") +
    "\n\n" +
    "   Ce qui a été mesuré n'est plus ce qui est sur le disque. Rejouez-la sur un\n" +
    "   arbre qui ne bouge pas — et si c'est une autre session qui écrit, mettez-vous\n" +
    "   d'accord avant, pas après."
  );
}
