import { spawn } from "node:child_process";
import { setTimeout as attendre } from "node:timers/promises";
import { readFileSync, readdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

/**
 * Ouvrir la fiche, REDÉMARRER le serveur, puis dicter.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **C'est le parcours du patron, et c'est ce script qui a trouvé la cause.**
 *
 * Le 11 et le 12 août 2026, il a signalé trois fois la même chose, capture à
 * l'appui : *« L'enregistrement n'a pas pu être transmis — la connexion a été
 * interrompue. »* La dictée passait pourtant à chaque essai ici — en mode
 * développement, sur la version bâtie, derrière une origine étrangère.
 *
 * **Ce qui manquait, c'était le temps.** Les suites ouvrent une page et
 * agissent dans la seconde. Lui ouvre la fiche, regarde, réfléchit — et pendant
 * ce temps son banc se met à jour tout seul. Or une action serveur n'a pas
 * d'adresse : elle a un identifiant fabriqué à la construction et inscrit dans
 * la page. Après une reconstruction, la page ouverte appelle un identifiant que
 * le nouveau serveur ne connaît plus.
 *
 * Ce script reproduit exactement cela. **Confronté au code d'avant, il rend le
 * message du patron, mot pour mot :**
 *
 *     [POST] 500 http://localhost:3000/chantiers/5366e923-…
 *     ÉCRAN : L'enregistrement n'a pas pu être transmis — la connexion a été
 *             interrompue. Réessayez.
 *     EN BASE : []
 *
 * Avec la route (`/api/notes-vocales/<chantier>`), le même parcours donne un
 * 200 et la note en base : une URL ne vieillit pas.
 *
 * **Pourquoi il n'est PAS dans la batterie**, alors qu'il tient une preuve :
 * il tue et relance le serveur du port 3000. Lâché au milieu de cinquante
 * suites navigateur, il leur retirerait le sol sous les pieds — et le dépôt a
 * déjà payé un « serveur fantôme sur le port 3000 » qui faisait accuser des
 * suites innocentes (`TODO.md`). L'invariant, lui, est tenu en continu par
 * `test-note-vocale-par-url-e2e.ts`, qui vérifie que l'envoi passe par une URL.
 *
 *   npx tsx scripts/eprouver-page-vieillie.mts
 *
 * Suppose un serveur déjà en écoute sur le port 3000, et le jeu de démonstration
 * chargé.
 */

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function pidsNext(): number[] {
  const out: number[] = [];
  for (const d of readdirSync("/proc")) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const cmd = readFileSync(`/proc/${d}/cmdline`, "utf8").replace(/\0/g, " ");
      if (/next dev|next-server/.test(cmd)) out.push(Number(d));
    } catch {
      // Le processus a disparu entre la liste et la lecture : sans intérêt.
    }
  }
  return out;
}

async function repond() {
  try {
    return (await fetch(`${BASE}/api/health/live`, { signal: AbortSignal.timeout(4000) })).ok;
  } catch {
    return false;
  }
}

async function main() {
  const { rows } = await pool.query(
    `select c.id from chantiers c
      where not exists (select 1 from notes_vocales n where n.chantier_id = c.id) limit 1`
  );
  if (!rows[0]) {
    throw new Error(
      "aucun chantier sans note vocale : rien à dicter. Recharger le jeu de démonstration."
    );
  }
  const chantierId = rows[0].id as string;

  const navigateur = await lancerNavigateur({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();
  page.on("response", (r) => {
    if (r.request().method() === "POST") console.log(`  [POST] ${r.status()} ${r.url().slice(0, 90)}`);
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  await page.goto(`${BASE}/chantiers/${chantierId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("→ page ouverte");

  // Le banc se met à jour : le serveur redémarre SOUS la page déjà ouverte.
  for (const pid of pidsNext()) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Déjà mort — c'est le but.
    }
  }
  await attendre(6000);
  spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", "3000"], {
    stdio: "ignore",
    detached: true,
    env: process.env,
  }).unref();
  for (let i = 0; i < 40; i++) {
    if (await repond()) break;
    await attendre(5000);
  }
  if (!(await repond())) throw new Error("le serveur n'est pas revenu : rien n'a pu être éprouvé");
  await page.waitForTimeout(3000);
  console.log("→ serveur redémarré, la page n'a PAS été rechargée");

  const anneau = page.locator(".atlas-lecteur button").first();
  await anneau.click();
  await page.waitForTimeout(3000);
  await anneau.click();
  await page.waitForTimeout(12000);

  const texte = await page.locator("body").innerText();
  const mauvais = texte
    .split("\n")
    .filter((l) => /pas parti|étape :|vieilli|refusé|interrompue|prévu/i.test(l));
  console.log(mauvais.length ? "ÉCRAN : " + mauvais.join(" | ") : "ÉCRAN : aucune erreur");
  const { rows: apres } = await pool.query(
    `select taille_octets from notes_vocales where chantier_id = $1`,
    [chantierId]
  );
  console.log("EN BASE :", JSON.stringify(apres));

  await navigateur.close();
  await pool.end();
  process.exit(apres.length > 0 && mauvais.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
