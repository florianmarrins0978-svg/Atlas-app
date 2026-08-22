import assert from "node:assert/strict";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lancerNavigateur } from "./e2e-browser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// **La séquence de Madame Lucie, rejouée à la lettre — 21 août 2026.**
//
// Ses mots : *« J'ai ouvert un chantier, Madame Lucie. J'ai rentré ces
// informations, j'appuie sur note vocale, j'ai dicté la prestation du chantier.
// J'ai rappuyé sur la note vocale, ça a enregistré les informations. J'ai
// quitté l'application. Je suis retourné dessus. J'ai cliqué sur Madame Lucie
// qui était enregistrée dans mes chantiers. Or, je ne suis pas arrivé
// directement sur la page du devis comme demandé, avec mes informations
// remplies que j'avais préalablement dictées. Corrige-moi ça, c'est le point le
// plus important. »*
//
// ─── Pourquoi cette suite, alors que deux autres couvrent déjà des morceaux ──
//
// `test-reprendre-ou-il-en-etait.ts` tient la règle du lien, mais ne clique
// nulle part. `test-anneau-vers-devis-e2e.ts` tient le geste unique — mais il
// APPUIE sur « Mon devis → », et c'est exactement ce que le patron n'a pas
// fait : il était chez sa cliente et il a fermé l'application. Ce trou-là est
// la panne, et aucune des deux ne pouvait le voir.
//
// Ce qu'on rejoue ici, dans l'ordre : on dicte, **on ferme sans rien appuyer
// d'autre**, on revient par la liste, on clique le nom — et le devis doit
// s'écrire tout seul.
//
// **Elle sait échouer.** Remettre `informations` dans `getNextAction` rougit le
// premier cas ; retirer `<PreparationDictee>` de la page du devis rougit le
// second et le troisième.

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

// Ce qu'il a dicté chez sa cliente, dans sa langue à lui. On l'écrit en base
// avant le retour : le fournisseur de simulation de cet environnement pose un
// préfixe que l'application refuse de lire, et ce refus est éprouvé ailleurs
// (`test-anneau-vers-devis-e2e`). Ici on éprouve l'AUTRE moitié — celle que
// cette machine ne sait pas produire, faute de clé (`AGENTS.md`).
const DICTEE =
  "Taille de la haie de laurier sur 20 mètres linéaires. Tonte de la pelouse. " +
  "J'estime le temps de travaux à 1 jour, 2 hommes.";

async function main() {
  console.log("=== La séquence de Madame Lucie ===\n");

  const navigateur = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${MICRO_SIMULE}`,
    ],
  });
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ─── 1. « J'ai ouvert un chantier, Madame Lucie » ────────────────────────
  const nomCliente = `Madame Lucie ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomCliente);

  // ─── 2. « J'appuie sur note vocale, je dicte, je rappuie » ───────────────
  //
  // L'anneau vit sur la fiche client depuis le 21 août : c'est ce geste-là qui
  // crée le chantier, puisqu'il n'a rien touché d'autre.
  const anneau = page.locator('[data-atlas="anneau-note-vocale"] .atlas-anneaux');
  await anneau.click();
  await page.waitForTimeout(2500);
  await anneau.click();
  await page.locator('[data-atlas="mon-devis"]').waitFor({ state: "visible", timeout: 60_000 });

  const { rows: crees } = await pool.query(
    `select c.id from chantiers c
       left join clients cl on cl.id = c.client_id
      where cl.nom = $1 order by c.created_at desc limit 1`,
    [nomCliente]
  );
  assert.ok(crees[0], "le chantier n'a pas été créé par l'arrêt de la dictée");
  const chantierId: string = crees[0].id;

  // La transcription qu'un vrai service aurait rendue — voir DICTEE ci-dessus.
  await pool.query("update notes_vocales set transcription = $1 where chantier_id = $2", [
    DICTEE,
    chantierId,
  ]);

  // ─── 3. « J'ai quitté l'application » ────────────────────────────────────
  //
  // **Sans jamais toucher « Mon devis → »**, et c'est tout le sujet : il est
  // chez sa cliente, il range son téléphone. Un nouveau contexte plutôt qu'une
  // simple navigation — l'onglet d'avant n'existe plus, comme chez lui.
  await contexte.close();
  const retour = await navigateur.newContext({ permissions: ["microphone"] });
  const page2 = await retour.newPage();
  await page2.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page2.fill('input[name="email"]', "demo@atlas.local");
  await page2.fill('input[name="password"]', "demo1234");
  await page2.click('button[type="submit"]');
  await page2.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ─── 4. « J'ai cliqué sur Madame Lucie » ─────────────────────────────────
  //
  // **Le devis est vide À CET INSTANT, et c'est le fait qui compte.** Mesuré
  // avant le clic, jamais après : la chaîne écrit vite, et un contrôle posé
  // ensuite mesurerait sa propre lenteur plutôt que l'état de départ.
  const { rows: avant } = await pool.query(
    "select count(*)::int as n from lignes_prix where chantier_id = $1",
    [chantierId]
  );
  const lignesAvantLeClic: number = avant[0].n;

  await cas("cliquer sa cliente mène AU DEVIS, pas sur un écran intermédiaire", async () => {
    const ligne = page2.locator(`a:has-text("${nomCliente}")`).first();
    await ligne.waitFor({ state: "visible", timeout: 30_000 });
    // Le lien est lu AVANT le clic : si la page du devis met du temps à
    // s'ouvrir, l'assertion doit accuser le lien, pas la lenteur.
    const destination = await ligne.getAttribute("href");
    assert.equal(
      destination,
      `/chantiers/${chantierId}/devis-complet`,
      `la liste l'envoie sur « ${destination} » — c'est la panne qu'il décrit`
    );
    await ligne.click();
    await page2.waitForURL(/\/devis-complet$/, { timeout: 60_000 });
  });

  // ─── 5. « … avec mes informations remplies que j'avais dictées » ─────────
  await cas("le devis se prépare tout seul, sans qu'il appuie sur rien", async () => {
    // **Le devis était bien VIDE au moment du clic**, mesuré plus haut : c'est
    // ce qui prouve que la préparation vient de l'arrivée sur l'écran, et non
    // d'un geste qu'il aurait fait avant de fermer l'application. Relire le
    // compte ICI ne prouverait rien — la chaîne a le temps d'écrire pendant que
    // l'assertion se prépare, et le contrôle mesurerait sa propre lenteur.
    assert.equal(
      lignesAvantLeClic,
      0,
      "des lignes existaient déjà avant le clic : la séquence n'a pas été rejouée fidèlement"
    );
    const voile = page2.locator('[data-atlas="preparation-dictee"]');
    // Le voile a pu déjà se refermer si la chaîne a été rapide : ce qui compte
    // est qu'il ait paru, ou que le devis porte désormais des lignes.
    const paru = await voile
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    const { rows } = await pool.query("select count(*)::int as n from lignes_prix where chantier_id = $1", [
      chantierId,
    ]);
    assert.ok(
      paru || rows[0].n > 0,
      "aucune préparation ne s'est ouverte et le devis reste vide : il tomberait sur la feuille vide qu'il dénonce"
    );
  });

  await cas("sa dictée arrive sur le devis, en lignes", async () => {
    // L'arrêt d'avant-chiffrage peut s'ouvrir : sa dictée ne dit pas tout ce
    // qui fait un prix. C'est voulu, et il le franchit d'un appui.
    const questions = page2.locator("text=/précisions? avant de chiffrer/i").first();
    const voile = page2.locator('[data-atlas="preparation-dictee"]');
    await Promise.race([
      questions.waitFor({ state: "visible", timeout: 180_000 }),
      voile.waitFor({ state: "detached", timeout: 180_000 }),
    ]);
    if (await questions.count()) {
      const champs = page2.locator('input[type="number"]');
      for (let i = 0; i < (await champs.count()); i++) await champs.nth(i).fill("20");
      await page2.getByRole("button", { name: /Continuer vers le devis|Continuer sans répondre/i }).click();
      await voile.waitFor({ state: "detached", timeout: 180_000 });
    }

    // **La preuve est en base, pas à l'écran.** Un libellé se remanie ; ce qui
    // doit tenir, c'est que sa dictée soit devenue des lignes de devis.
    const { rows } = await pool.query(
      "select libelle from lignes_prix where chantier_id = $1 order by created_at",
      [chantierId]
    );
    assert.ok(
      rows.length > 0,
      "le devis n'a aucune ligne : il retomberait sur la feuille vide qu'il dénonce"
    );
    const tout = rows.map((r) => String(r.libelle).toLowerCase()).join(" | ");
    assert.match(tout, /haie|laurier|tonte|pelouse/, `ses prestations dictées sont absentes : « ${tout} »`);
  });

  await cas("rien n'est parti chez la cliente", async () => {
    // L'arrêt avant l'envoi reste entier : préparer n'est pas envoyer.
    const { rows } = await pool.query(
      `select c.devis_envoye_at,
              (select count(*)::int from envois_devis e where e.chantier_id = c.id) as envois
         from chantiers c where c.id = $1`,
      [chantierId]
    );
    assert.equal(rows[0].devis_envoye_at, null, "le devis a été marqué envoyé sans un geste de lui");
    assert.equal(rows[0].envois, 0, "un envoi a été créé : le devis est parti chez la cliente");
  });

  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? "\n✅ La séquence de Madame Lucie — 0 échec(s).\n"
      : `\n❌ La séquence de Madame Lucie — ${echecs} échec(s).\n`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main();
