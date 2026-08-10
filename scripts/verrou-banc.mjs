import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

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
  if (existsSync(chemin)) {
    const ancien = Number.parseInt(readFileSync(chemin, "utf8").trim(), 10);
    // Un contenu illisible ne doit pas bloquer un démarrage : on le remplace.
    if (Number.isInteger(ancien) && ancien > 0 && ancien !== pid && vivant(ancien)) {
      return { pris: false, parPid: ancien };
    }
  }
  writeFileSync(chemin, `${pid}\n`);
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
