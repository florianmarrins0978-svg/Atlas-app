import { spawn } from "node:child_process";
import { setTimeout as attendre } from "node:timers/promises";
import { rmSync, existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * **Sa page de connexion a-t-elle survécu à son serveur ?**
 *
 * Le patron, le 20 août 2026 au soir : *« Je ne peux plus me connecter à
 * l'application. »* Sa fiche d'état disait pourtant tout au vert — espace
 * allumé, serveur qui répond, code servi à jour — et `npm run verifier:connexion`
 * se connectait sans broncher sur son commit exact, derrière une origine
 * étrangère.
 *
 * **Ce qui manquait à tous ces contrôles, c'est le TEMPS.** Ils ouvrent la page
 * et appuient dans la seconde. Lui laisse son onglet ouvert des heures pendant
 * que son banc se reconstruit — plusieurs fois par soirée. Or le formulaire de
 * connexion est une ACTION SERVEUR : son identifiant et sa clé de chiffrement
 * sont fabriqués à la construction et inscrits dans la page. Après une
 * reconstruction, la page ouverte appelle une action que le nouveau serveur ne
 * connaît plus — et c'est le seul écran où il stationne avant de pouvoir faire
 * quoi que ce soit (`HANDOVER.md`, premier réflexe ; `ARCHITECTURE.md` §65).
 *
 * Ce script rejoue exactement sa séquence :
 *
 *   1. construire, démarrer, ouvrir `/login` et remplir les champs ;
 *   2. **reconstruire et redémarrer**, comme son banc le fait tout seul ;
 *   3. appuyer sur « Se connecter » depuis la page RESTÉE OUVERTE.
 *
 *   npx tsx scripts/eprouver-connexion-page-vieillie.mts
 *
 * Il n'est pas dans la batterie, et pour la même raison que
 * `eprouver-page-vieillie.mts` : il tue et relance le serveur du port 3000,
 * ce qui retirerait le sol sous les pieds des cinquante suites navigateur.
 * Compter dix à quinze minutes — deux constructions complètes.
 */

const BASE = "http://127.0.0.1:3000";
const SANTE = `${BASE}/api/health/live`;
const DIST = ".next-batie";

// Le même écart que chez lui, dans le bon sens : l'hôte porte l'adresse
// publique, l'origine vaut localhost (`verifier-connexion.mjs`).
const ORIGINE_NAVIGATEUR = "http://localhost:3000";
const HOTE_PUBLIC = "banc-essai-fictif-3000.app.github.dev";
const IDENTIFIANTS = { email: "demo@atlas.local", motDePasse: "demo1234" };

function cheminNavigateur(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const dossier = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  if (!dossier) return undefined;
  const chemin = `${racine}/${dossier}/chrome-linux/chrome`;
  return existsSync(chemin) ? chemin : undefined;
}

async function repond(): Promise<boolean> {
  try {
    return (await fetch(SANTE, { signal: AbortSignal.timeout(5000) })).status === 200;
  } catch {
    return false;
  }
}

let serveur: ReturnType<typeof spawn> | null = null;

function eteindre() {
  try {
    if (serveur?.pid) process.kill(-serveur.pid, "SIGTERM");
  } catch {
    /* déjà mort */
  }
  serveur = null;
}
process.on("exit", eteindre);
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => process.exit(1));

async function monter(quoi: string): Promise<void> {
  console.log(`→ ${quoi} — construction et démarrage (quelques minutes)…`);
  serveur = spawn("npm", ["run", "banc"], {
    stdio: "ignore",
    env: { ...process.env, ATLAS_PROFIL: "banc" },
    detached: true,
  });
  const limite = Date.now() + 900_000;
  while (Date.now() < limite) {
    if (await repond()) {
      console.log(`   ${quoi} : le serveur répond.`);
      return;
    }
    await attendre(2000);
  }
  throw new Error(`${quoi} : le serveur n'a pas répondu en quinze minutes.`);
}

async function attendreLeSilence(): Promise<void> {
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    if (!(await repond())) return;
    await attendre(1000);
  }
  throw new Error("le serveur refuse de s'éteindre — le port 3000 reste pris.");
}

if (await repond()) {
  console.error("❌ Le port 3000 est déjà pris. Arrêter le serveur en cours.");
  process.exit(1);
}

await monter("Première construction");

const nav = await chromium.launch({ executablePath: cheminNavigateur() });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
await page.setExtraHTTPHeaders({ Origin: ORIGINE_NAVIGATEUR, "x-forwarded-host": HOTE_PUBLIC });

const reponses: string[] = [];
page.on("response", (r) => {
  if (r.request().method() === "POST") reponses.push(`[POST] ${r.status()} ${r.url()}`);
});
// **Le défaut doit être BAVARD avant d'être corrigé** (`AGENTS.md`). En version
// bâtie, l'écran d'erreur tait la cause — c'est délibéré, un message serveur
// peut divulguer la structure de la base. On écoute donc le navigateur
// lui-même : ses exceptions, sa console, et les requêtes qui n'aboutissent pas.
const erreurs: string[] = [];
page.on("pageerror", (e) => erreurs.push(`exception: ${String(e)}`));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") erreurs.push(`console.${m.type()}: ${m.text()}`);
});
page.on("requestfailed", (r) => erreurs.push(`requête perdue: ${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) erreurs.push(`réponse ${r.status()}: ${r.request().method()} ${r.url()}`);
});

console.log("→ Il ouvre la page de connexion et tape ses identifiants.");
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.locator('input[name="email"]').fill(IDENTIFIANTS.email);
await page.locator('input[name="password"]').fill(IDENTIFIANTS.motDePasse);

// **Sa page reste ouverte pendant que son banc se reconstruit.** C'est le seul
// ingrédient qui manquait à tous les autres contrôles.
console.log("→ Son banc se met à jour : on éteint, on efface la construction, on rebâtit.");
eteindre();
await attendreLeSilence();
// **Le serveur meurt plus lentement qu'il ne cesse de répondre.** Effacer la
// construction dans la seconde a rendu un `ENOTEMPTY` : un processus écrivait
// encore dedans. On réessaie plutôt que de conclure — un contrôle qui tombe sur
// sa propre plomberie accuse le mauvais coupable.
for (let essai = 1; ; essai++) {
  try {
    rmSync(DIST, { recursive: true, force: true });
    break;
  } catch (e) {
    if (essai >= 10) throw e;
    await attendre(2000);
  }
}
await monter("Seconde construction");

// **Avant même de toucher au bouton** : la page a-t-elle déjà lâché toute seule
// pendant la reconstruction ? La réponse change le coupable — un écran mort
// avant le geste n'est pas un envoi refusé.
const avantLeGeste = await page
  .locator("body")
  .innerText()
  .catch(() => "(page illisible)");
console.log(`   Avant qu'il touche quoi que ce soit : ${avantLeGeste.replace(/\s+/g, " ").slice(0, 160)}`);

console.log("→ Il appuie sur « Se connecter », depuis la page restée ouverte.");
let arrive = false;
try {
  await page.locator('button[type="submit"]').click();
  await page.getByRole("heading", { name: "Vos chantiers" }).waitFor({ timeout: 45_000 });
  arrive = true;
} catch {
  arrive = false;
}

const texte = await page
  .locator("body")
  .innerText()
  .catch(() => "(page illisible)");

console.log("\n─────────────── Ce qui s'est passé ───────────────");
console.log(reponses.length ? reponses.join("\n") : "(aucun POST — le formulaire n'a rien envoyé)");
console.log(`\nADRESSE : ${page.url()}`);
console.log(`ÉCRAN   : ${texte.replace(/\s+/g, " ").slice(0, 300)}`);
if (erreurs.length) {
  console.log("CE QUE LE NAVIGATEUR A DIT :");
  for (const e of erreurs.slice(0, 25)) console.log(`  · ${e}`);
} else {
  console.log("CE QUE LE NAVIGATEUR A DIT : rien du tout.");
}
console.log("──────────────────────────────────────────────────\n");

await nav.close();
eteindre();

if (arrive) {
  console.log("✅ Il entre malgré la reconstruction : sa page de connexion survit à son serveur.");
  process.exit(0);
}

console.error("❌ SA PAGE N'A PAS SURVÉCU : la connexion est refusée après une reconstruction.");
console.error("   C'est ce qu'il vit — un écran qui ne le laisse plus entrer, sur une");
console.error("   application qui tourne. Voir `ARCHITECTURE.md` §65.");
process.exit(1);
