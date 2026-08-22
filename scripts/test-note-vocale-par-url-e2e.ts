import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **La note vocale part par une URL, jamais par une action serveur.**
//
// ─────────────────────────────────────────────────────────────────────────────
// **C'est l'invariant qui répare la panne du patron**, signalée trois fois entre
// le 11 et le 12 août 2026, capture à l'appui : *« L'enregistrement n'a pas pu
// être transmis — la connexion a été interrompue. »*
//
// Une action serveur n'a pas d'adresse : elle porte un identifiant fabriqué à
// la construction et inscrit dans la page. Son banc d'essai se met à jour tout
// seul ; une page restée ouverte appelle alors un identifiant que le nouveau
// serveur ne connaît plus, et l'envoi échoue **sans jamais l'atteindre**. Rien
// n'était donc journalisé, aucun refus ne s'affichait, et la phrase de secours
// accusait le réseau — alors que le serveur allait très bien.
//
// La preuve a été faite en reproduisant son parcours, pas en raisonnant :
// `scripts/eprouver-page-vieillie.mts` ouvre la fiche, redémarre le serveur,
// puis dicte. Sur le code d'avant, il rend un 500 et le message du patron mot
// pour mot ; par la route, un 200 et la note en base.
//
// **Ce contrôle tient l'invariant, pas le scénario** — le scénario tue et
// relance le serveur, ce qui n'a pas sa place au milieu de cinquante suites
// navigateur. Ici, on vérifie que l'envoi emprunte bien une URL et aboutit.
// Ramener l'enregistrement dans une action serveur le fera rougir, et c'est
// exactement le retour en arrière qu'il faut empêcher.

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La note vocale part par une URL ===\n");

  // **Le chantier est CRÉÉ par l'écran, pas pioché en base.** Une première
  // version prenait « un chantier sans note » au hasard — et tombait parfois sur
  // celui d'une autre entreprise, laissé par une suite voisine. L'isolation le
  // refusait alors, à très juste titre, et le contrôle accusait l'application
  // d'un défaut qui n'existait pas. Créer le sien, c'est éprouver ce qu'on croit
  // éprouver.
  const navigateur = await lancerNavigateur({
    // **Un micro simulé, sinon rien ne s'enregistre.** Sans ces deux drapeaux,
    // le navigateur demanderait une autorisation que personne ne peut donner, et
    // le contrôle passerait au vert sans avoir dicté une seconde.
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();

  const envois: Array<{ url: string; statut: number }> = [];
  page.on("response", (r) => {
    if (r.request().method() === "POST") envois.push({ url: r.url(), statut: r.status() });
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Note par URL ${Date.now()}`);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];
  await page.waitForTimeout(1500);

  const anneau = page.locator(".atlas-lecteur button").first();
  await cas("l'anneau est là, dès l'arrivée sur la fiche", async () => {
    if ((await anneau.count()) === 0) throw new Error("aucun anneau : rien à presser");
  });

  envois.length = 0;
  await anneau.click();
  await page.waitForTimeout(3000);
  await anneau.click();
  await page.waitForTimeout(9000);

  await cas("l'enregistrement est POSTÉ sur /api/notes-vocales, pas sur une action", async () => {
    const parLUrl = envois.find((e) => e.url.includes(`/api/notes-vocales/${chantierId}`));
    if (!parLUrl) {
      throw new Error(
        "aucun envoi vers /api/notes-vocales. L'enregistrement est-il repassé par une " +
          "action serveur ? Celles-ci portent un identifiant fabriqué à la construction : " +
          "une page ouverte avant une mise à jour du banc appellerait un identifiant " +
          `disparu. POST observés :\n      ` +
          (envois.map((e) => `${e.statut} ${e.url.slice(0, 80)}`).join("\n      ") || "aucun")
      );
    }
    if (parLUrl.statut !== 200) {
      throw new Error(`la route a répondu ${parLUrl.statut} au lieu de 200`);
    }
  });

  await cas("la note est réellement rangée en base", async () => {
    const { rows: notes } = await pool.query(
      `select taille_octets from notes_vocales where chantier_id = $1`,
      [chantierId]
    );
    // **Un 200 ne prouve pas qu'on a rangé quelque chose.** C'est la leçon du
    // devis « envoyé » qui ne partait pas : l'écran disait oui, la base non.
    if (notes.length === 0) throw new Error("la route a dit 200, mais rien n'est en base");
    if (Number(notes[0].taille_octets) === 0) throw new Error("une note de zéro octet a été rangée");
  });

  await cas("aucune erreur ne reste à l'écran", async () => {
    const texte = await page.locator("body").innerText();
    const restes = texte
      .split("\n")
      .filter((l) => /pas parti|interrompue|étape :|vieilli/i.test(l));
    if (restes.length > 0) throw new Error(restes.join(" | "));
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Note vocale par URL — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
