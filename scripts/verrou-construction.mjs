import { execFileSync } from "node:child_process";
import { readdirSync, readlinkSync, readFileSync } from "node:fs";

/**
 * **Une construction ORPHELINE tient le verrou, et le banc reste lent.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **La panne du 17 août 2026 au soir, dans ses mots :** *« même problème
 * qu'hier, l'appli est super lente »*. Sa fiche d'état, elle, disait tout :
 *
 *     Code SERVI : AUCUNE — la construction a ÉCHOUÉ
 *     dit: ⨯ Another next build process is already running.
 *
 * **C'est le même message que la veille, et pourtant ce n'est PAS la même
 * panne.** Le 16 août, la cause était le démarrage : `demarrer.sh` posait un
 * veilleur, celui-ci lançait un banc et sa construction, puis la mise à jour
 * remplaçait veilleur et serveur — en laissant la construction derrière. Le
 * correctif : `pkill` la construction au démarrage. Il tient toujours.
 *
 * **Ce qui manquait : la même chose peut arriver À TOUT MOMENT après.** Son
 * espace a 8 Go de mémoire, dont 181 Mo libres au moment de la panne. Quand le
 * noyau manque de mémoire, il tue un processus — le banc, par exemple — et
 * **sa construction lui survit**. Le veilleur constate alors qu'aucun serveur
 * ne répond, relance un banc, et celui-là tombe sur le verrou de l'orphelin.
 * Le `pkill` du démarrage n'y peut rien : le démarrage est passé depuis
 * longtemps.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi on la TUE, alors que ce dépôt s'interdit d'effacer le verrou.**
 *
 * Les deux gestes n'ont rien à voir. Effacer le fichier `lock` ne libère rien
 * — Next prend un verrou auprès du système — et lancerait une SECONDE
 * construction à côté de la première : le remède qui tue, déjà payé deux fois.
 * Ici, on ne double pas : **on retire l'orpheline avant de commencer.**
 *
 * Et sa mort ne coûte rien, parce que **son succès ne servirait à personne** :
 * le banc qui aurait basculé dessus est mort. Elle chauffe un processeur que
 * son voisin attend, garde le verrou, et son résultat n'a plus de destinataire.
 *
 * **Ce qu'on ne tue jamais : la nôtre.** Cette fonction n'est appelée
 * qu'AVANT de lancer la construction du banc — à cet instant, toute
 * construction qui tourne est étrangère par construction.
 */

/** Le motif qui désigne une construction Next, quelle que soit son enveloppe. */
export const MOTIF_CONSTRUCTION = "next build";

/**
 * Les constructions en cours sur la machine, hors la nôtre.
 *
 * `pgrep -af` rend « pid ligne de commande ». Trois processus par construction
 * — `npm exec next build`, `sh -c next build`, `node …/next build` —, relevés
 * en en lançant une pour de bon plutôt qu'en les imaginant.
 *
 * @param {{ motif?: string }} [options]
 * @returns {{ pid: number, ligne: string }[]}
 */
export function constructionsEnCours({ motif = MOTIF_CONSTRUCTION } = {}) {
  let sortie = "";
  try {
    sortie = execFileSync("pgrep", ["-af", motif], { encoding: "utf8" });
  } catch {
    // `pgrep` rend 1 quand rien ne correspond : c'est le cas ordinaire, pas
    // une panne. Et s'il manquait tout à fait, ne rien trouver est le bon
    // repli — on bâtira, et Next dira le reste.
    return [];
  }
  return sortie
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const espace = l.indexOf(" ");
      return { pid: Number.parseInt(l.slice(0, espace), 10), ligne: l.slice(espace + 1) };
    })
    .filter((p) => Number.isInteger(p.pid) && p.pid !== process.pid && p.pid !== process.ppid);
}

/**
 * Les processus qui tiennent VRAIMENT le verrou, trouvés par le fichier et non
 * par un nom.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le trou du 21 août 2026, et il s'était déjà refermé deux fois ailleurs.**
 * Le patron, au réveil : *« l'appli est hyper lente »*. Sa fiche portait, pour
 * la troisième matinée : « Another next build process is already running », et
 * 4,5 Gio de mémoire libres — donc pas la saturation du 17 août.
 *
 * Tout ce qui déloge une construction visait jusqu'ici un MOTIF : `pkill -f
 * "[n]ext(-server| dev| start| build)"` au démarrage, `pgrep -af "next build"`
 * ici. Or une construction Next n'est pas trois processus, elle en est cinq :
 *
 *     npm exec next build                          ← le motif l'attrape
 *     sh -c next build                             ← le motif l'attrape
 *     node …/node_modules/.bin/next build          ← le motif l'attrape
 *     node …/<dist>/build/<empreinte>.js 43027     ← IL NE L'ATTRAPE PAS
 *     node …/jest-worker/processChild.js           ← IL NE L'ATTRAPE PAS
 *
 * Les deux derniers ne portent nulle part les mots « next build ». Un survivant
 * de cette espèce garde le verrou du système, et **aucun de nos gestes ne peut
 * le voir** : on tue les parents, on croit avoir nettoyé, et la construction
 * suivante tombe sur un verrou tenu par un orphelin invisible.
 *
 * **On cesse donc de deviner par le nom : on demande au système QUI a le
 * fichier ouvert.** `/proc/<pid>/fd` porte un lien par descripteur ; celui qui
 * pointe sur `<dist>/lock` désigne le détenteur, quel que soit son nom, et
 * quelle que soit la façon dont Next découpera ses processus demain.
 *
 * Rendre une liste vide n'est jamais une erreur : sur un système sans `/proc`,
 * on retombe simplement sur la recherche par motif, qui attrape le cas courant.
 */
export function detenteursDuVerrou(dossierDist = process.env.ATLAS_DIST_DIR || ".next") {
  const fin = `${dossierDist.replace(/\/+$/, "")}/lock`;
  const trouves = [];
  let pids;
  try {
    pids = readdirSync("/proc").filter((n) => /^\d+$/.test(n));
  } catch {
    return trouves; // Pas de /proc : on ne sait pas, et on ne prétend pas savoir.
  }
  for (const pid of pids) {
    const n = Number.parseInt(pid, 10);
    if (n === process.pid) continue;
    let fds;
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue; // Processus disparu entre-temps, ou pas à nous : ce n'est pas une panne.
    }
    for (const fd of fds) {
      let cible;
      try {
        cible = readlinkSync(`/proc/${pid}/fd/${fd}`);
      } catch {
        continue;
      }
      if (cible.endsWith(fin)) {
        let ligne = "(ligne de commande illisible)";
        try {
          ligne = readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim();
        } catch {
          // Le processus a pu mourir entre le lien et sa fiche : on garde le pid,
          // qui suffit à le déloger.
        }
        trouves.push({ pid: n, ligne });
        break;
      }
    }
  }
  return trouves;
}

/** Le processus existe-t-il encore ? `kill(pid, 0)` ne tue rien : il interroge. */
function vivant(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Déloge les constructions orphelines, et attend que le noyau rende le verrou.
 *
 * **L'attente n'est pas une politesse.** Le verrou n'est relâché qu'à la mort
 * réelle du processus : bâtir dans la seconde retomberait sur le même refus, et
 * le banc conclurait à tort qu'il ne peut pas bâtir. On attend donc la
 * disparition, puis on insiste (`SIGKILL`) — une construction qui ignore un
 * `SIGTERM` est justement celle qui ne rendra jamais la main.
 *
 * @returns {Promise<{ delogees: number, restantes: number }>}
 */
export async function delogerConstructionsOrphelines({
  motif = MOTIF_CONSTRUCTION,
  dossierDist = process.env.ATLAS_DIST_DIR || ".next",
  patienceMs = 15_000,
  dire = () => {},
} = {}) {
  // **Les deux façons de chercher, réunies.** Le motif attrape les enveloppes
  // d'une construction normale ; le verrou attrape celui qui le TIENT, quel que
  // soit son nom — c'est lui qui manquait le 21 août 2026. Un même processus
  // peut sortir des deux : on le déloge une seule fois.
  const parLeNom = constructionsEnCours({ motif });
  const parLeVerrou = detenteursDuVerrou(dossierDist);
  const vus = new Set();
  const trouvees = [...parLeNom, ...parLeVerrou].filter(({ pid }) => {
    if (vus.has(pid)) return false;
    vus.add(pid);
    return true;
  });
  if (trouvees.length === 0) return { delogees: 0, restantes: 0 };

  dire(
    `  (Une construction d'une exécution précédente tenait encore le verrou — ${trouvees.length} processus délogé(s)` +
      `${parLeVerrou.length > 0 ? `, dont ${parLeVerrou.length} trouvé(s) par le verrou lui-même` : ""}.)`
  );

  for (const { pid } of trouvees) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Déjà mort entre le relevé et le geste : c'est le résultat voulu.
    }
  }

  const debut = Date.now();
  while (Date.now() - debut < patienceMs) {
    if (!trouvees.some(({ pid }) => vivant(pid))) break;
    await attendre(250);
  }

  for (const { pid } of trouvees) {
    if (!vivant(pid)) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Rien à faire de plus : le compte rendu ci-dessous dira ce qui reste.
    }
  }
  await attendre(500);

  return {
    delogees: trouvees.length,
    restantes: trouvees.filter(({ pid }) => vivant(pid)).length,
  };
}

/**
 * Attend qu'une construction en cours FINISSE, au lieu de la tuer.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, trois matins de suite : « l'appli est hyper lente ».** Chaque
 * fois, sa fiche portait le même refus — « Another next build process is
 * already running » — avec de la mémoire de reste. Ce n'est donc pas une
 * machine à genoux : ce sont deux constructions qui se rencontrent.
 *
 * **Et elles se rencontrent PAR CONSTRUCTION, au démarrage.** `demarrer.sh`
 * pose un veilleur avant la mise à jour, délibérément — pour qu'il ait une
 * application qui répond même si la mise à jour échoue. Ce premier veilleur
 * lance un banc, donc une construction. Si la mise à jour aboutit, on remplace
 * veilleur et serveur, et le banc suivant en lance une seconde. Deux
 * constructions par allumage : c'est le prix assumé d'un serveur qui répond
 * tout de suite.
 *
 * **Ce qui manquait, c'est quoi faire quand on tombe sur l'autre.** On
 * délogeait, puis on relançait aussitôt. Or déloger n'a de sens que pour une
 * ORPHELINE — une construction dont le destinataire est mort. Contre une
 * construction VIVANTE, qui fait exactement le travail qu'on s'apprêtait à
 * faire, c'est le pire des gestes : on jette plusieurs minutes de calcul, et
 * l'on recommence sur une machine qui n'en a pas les moyens.
 *
 * On l'attend donc. Quelques minutes de patience contre une journée en mode
 * développement — c'est le même arbitrage que la relance du veilleur, et il a
 * déjà été tranché dans ce sens.
 *
 * **Elle est bornée, et l'attente n'est jamais infinie** : passé le délai, on
 * rend `false` et l'appelant reprend la main pour déloger comme avant.
 *
 * @returns `true` si plus rien ne bâtit, `false` si le délai a été atteint.
 *
 * @param {{ motif?: string, dossierDist?: string, patienceMs?: number,
 *           dire?: (message: string) => void }} [options]
 */
export async function attendreLaConstructionEnCours({
  motif = MOTIF_CONSTRUCTION,
  dossierDist = process.env.ATLAS_DIST_DIR || ".next",
  patienceMs = 10 * 60_000,
  /** @type {(message: string) => void} */
  dire = () => {},
} = {}) {
  const enCours = () =>
    constructionsEnCours({ motif }).length + detenteursDuVerrou(dossierDist).length;

  if (enCours() === 0) return true;

  dire(
    "  (Une autre construction tourne déjà : on l'attend au lieu de la tuer —\n" +
      "   elle fait le même travail, et le refaire coûterait plus cher.)"
  );

  const debut = Date.now();
  let prochainSigne = debut + 60_000;
  while (Date.now() - debut < patienceMs) {
    if (enCours() === 0) {
      dire(`  (Elle a fini au bout de ${Math.round((Date.now() - debut) / 1000)} s. On reprend.)`);
      return true;
    }
    if (Date.now() >= prochainSigne) {
      dire(`  (Toujours en cours — ${Math.round((Date.now() - debut) / 60_000)} min.)`);
      prochainSigne = Date.now() + 60_000;
    }
    await attendre(2000);
  }
  return false;
}
