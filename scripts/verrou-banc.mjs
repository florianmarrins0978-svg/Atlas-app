import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

/**
 * **Un seul banc à la fois.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **La panne du 10 août 2026, chez le patron :**
 *
 *     Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
 *     errno: -98, syscall: 'listen'
 *
 * puis, juste après, un second « Creating an optimized production build ». Deux
 * bancs tournaient. L'espace de travail en démarre un tout seul à chaque
 * allumage (`demarrer.sh` → `veiller.sh`) ; le patron, ne voyant rien venir, en
 * a lancé un second à la main. Les deux ont bâti, et le premier à vouloir
 * servir a trouvé le port pris par l'autre.
 *
 * Rien ne l'en empêchait : `essai.mjs` refuse de démarrer quand quelqu'un
 * répond déjà (défaut du 9 août), mais `banc.mjs` n'avait pas cette garde — et
 * elle ne suffirait pas ici, puisque pendant sa construction un banc ne répond
 * pas encore sur le port. **Ce n'est pas le port qu'il faut regarder, c'est
 * l'existence d'un autre banc.**
 *
 * **Le verrou porte un identifiant de processus**, jamais un simple drapeau :
 * un fichier resté d'un banc tué — ou d'un conteneur précédent — bloquerait
 * sinon tout démarrage ultérieur, et l'application ne reviendrait plus jamais.
 * C'est la même prudence que `veiller.sh`, pour la même raison.
 * ───────────────────────────────────────────────────────────────────────────
 */

const CHEMIN_PAR_DEFAUT = "/tmp/atlas-banc.pid";

/** Le processus existe-t-il encore ? `kill(pid, 0)` ne tue rien : il interroge. */
function vivant(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tente de prendre le verrou.
 *
 * @param {{ chemin?: string, pid?: number }} [options]
 * @returns {{ pris: true } | { pris: false, parPid: number }}
 */
export function prendreVerrouBanc({ chemin = CHEMIN_PAR_DEFAUT, pid = process.pid } = {}) {
  // **Créer d'abord, EXCLUSIVEMENT — et c'est le trou du 17 août 2026.**
  //
  // La version précédente regardait si le fichier existait, puis l'écrivait.
  // Deux bancs qui démarrent dans la même seconde — l'espace en lance un à
  // l'allumage, le veilleur en relance un dès qu'il croit le serveur mort — ne
  // trouvaient donc RIEN ni l'un ni l'autre, et repartaient tous les deux. Deux
  // constructions, un seul verrou chez Next : *« Another next build process is
  // already running »*, et le banc reste en mode développement — c'est-à-dire
  // « l'appli est super lente ».
  //
  // `wx` demande au système de créer le fichier **ou d'échouer** : un seul des
  // deux peut réussir, quelle que soit la précision de leur simultanéité.
  try {
    writeFileSync(chemin, `${pid}\n`, { flag: "wx" });
    return { pris: true };
  } catch (erreur) {
    if (erreur?.code !== "EEXIST") {
      // Autre chose que « il existe déjà » — disque plein, droits. Ne JAMAIS
      // empêcher un démarrage pour un verrou qu'on n'arrive pas à poser : au
      // pire on perd la garde, au mieux Atlas revient.
      return { pris: true };
    }
  }

  const ancien = Number.parseInt(readFileSync(chemin, "utf8").trim(), 10);
  if (Number.isInteger(ancien) && ancien > 0 && ancien !== pid && vivant(ancien)) {
    return { pris: false, parPid: ancien };
  }

  // Mort, illisible, ou le nôtre : on reprend la place. Le remplacement passe
  // par un fichier temporaire puis un `rename`, qui est atomique — un lecteur
  // ne verra jamais un verrou à moitié écrit.
  const provisoire = `${chemin}.${pid}`;
  writeFileSync(provisoire, `${pid}\n`);
  renameSync(provisoire, chemin);
  return { pris: true };
}

/** Rend le verrou — et seulement s'il est bien à nous. */
export function libererVerrouBanc({ chemin = CHEMIN_PAR_DEFAUT, pid = process.pid } = {}) {
  try {
    if (!existsSync(chemin)) return;
    const tenu = Number.parseInt(readFileSync(chemin, "utf8").trim(), 10);
    if (tenu === pid) rmSync(chemin, { force: true });
  } catch {
    // Un verrou qu'on n'arrive pas à retirer expirera par la mort de son
    // processus : le prochain démarrage le constatera et passera outre.
  }
}
