import { execFileSync } from "node:child_process";

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
  patienceMs = 15_000,
  dire = () => {},
} = {}) {
  const trouvees = constructionsEnCours({ motif });
  if (trouvees.length === 0) return { delogees: 0, restantes: 0 };

  dire(
    `  (Une construction d'une exécution précédente tenait encore le verrou — ${trouvees.length} processus délogé(s).)`
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
