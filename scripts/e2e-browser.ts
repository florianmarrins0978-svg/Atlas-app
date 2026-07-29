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

export async function lancerNavigateur(optionsSupplementaires: Omit<LaunchOptions, "executablePath"> = {}): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(CHEMIN_SANDBOX) ? CHEMIN_SANDBOX : undefined);
  return chromium.launch({ ...optionsSupplementaires, ...(executablePath ? { executablePath } : {}) });
}
