import { chromium, type Browser, type LaunchOptions } from "playwright";
import { existsSync } from "node:fs";

// Chemin spécifique à cet environnement de développement — utilisé
// uniquement s'il existe réellement. Sur un runner CI standard (après
// `npx playwright install chromium`), ce chemin n'existe pas : Playwright
// utilise alors son propre navigateur installé, sans configuration
// supplémentaire. PLAYWRIGHT_EXECUTABLE_PATH permet de surcharger
// explicitement si besoin (un autre environnement de développement, par
// exemple).
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/**
 * Le délai par défaut de toute attente, dans toutes les suites.
 *
 * **Trois faux échecs le 7 août 2026, tous le même.** Une suite passe seule et
 * tombe en batterie ; le message accuse alors le produit — l'adresse qui ne se
 * remplit pas, le lien du client qui n'arrive pas — alors que le seul coupable
 * est un serveur de développement qui compile une route pour la première fois,
 * sous trente-huit suites enchaînées.
 *
 * Un contrôle qui échoue au hasard est pire qu'aucun contrôle : il apprend à
 * ignorer le rouge. Quarante-cinq secondes ne cachent aucun défaut réel — une
 * page qui met plus de quarante-cinq secondes est cassée pour de bon — et elles
 * suppriment une classe entière de fausses alertes.
 *
 * Posé ICI plutôt que sur chaque appel : une valeur par site d'appel, c'est
 * trente endroits à corriger et vingt-neuf oublis.
 */
export const DELAI_PAR_DEFAUT_MS = 45_000;

/**
 * Le navigateur des suites, dont chaque contexte naît déjà patient.
 *
 * `newContext` est enveloppé plutôt que documenté : compter sur chaque suite
 * pour poser le délai elle-même, c'est le poser dans la première et l'oublier
 * dans les suivantes.
 */
export async function lancerNavigateur(optionsSupplementaires: Omit<LaunchOptions, "executablePath"> = {}): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(CHEMIN_SANDBOX) ? CHEMIN_SANDBOX : undefined);
  const navigateur = await chromium.launch({ ...optionsSupplementaires, ...(executablePath ? { executablePath } : {}) });

  const creerContexte = navigateur.newContext.bind(navigateur);
  navigateur.newContext = async (...args: Parameters<typeof creerContexte>) => {
    const contexte = await creerContexte(...args);
    contexte.setDefaultNavigationTimeout(DELAI_PAR_DEFAUT_MS);
    contexte.setDefaultTimeout(DELAI_PAR_DEFAUT_MS);
    return contexte;
  };

  return navigateur;
}
