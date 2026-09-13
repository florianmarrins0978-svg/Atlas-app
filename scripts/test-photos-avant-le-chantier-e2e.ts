import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

/**
 * SIX PHOTOS D'UN COUP, UN SEUL CHANTIER — le 13 septembre 2026.
 *
 * *« J'ai repris un client qui s'appelle Julien. J'ai ajouté six photos. Et
 * ensuite, j'ai fait retour. Quand j'ai voulu retrouver mon client, au lieu
 * de m'en avoir fait un, il m'en a créé six avec une photo à chaque fois. »*
 *
 * **Ce que cette suite éprouve, et qu'aucune autre ne faisait :** plusieurs
 * photos choisies ensemble sur la fiche client, AVANT que le chantier existe.
 * `test-photos-e2e` envoie une photo sur un chantier déjà créé ; ici c'est la
 * première photo qui le crée, et les suivantes doivent le retrouver.
 *
 * **Pourquoi le défaut passait.** La pellicule envoie les fichiers un à un,
 * dans une boucle qui garde la fonction de création telle qu'elle était avant
 * la première photo. La mémoire du chantier créé vivait dans un état React,
 * vide pour cette boucle jusqu'à la fin, et la promesse de création s'effaçait
 * dès qu'elle aboutissait : chaque photo suivante recréait. La correction tient
 * la promesse dans une référence, qui ne vieillit pas avec le rendu
 * (`FormulaireNouveauChantier.tsx`, `chantierDeCetEcran`).
 *
 * **Ce qu'elle fixe, c'est la RÈGLE** (`CLAUDE.md` §5 bis) : ce qui se compte
 * en base — un chantier, ses photos —, pas un libellé de l'écran.
 */

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "test-photo.jpg");
// Six, comme lui — et pas deux : avec deux, une course gagnée par hasard
// rendrait un vert qui ne prouve rien.
const NOMBRE_DE_PHOTOS = 6;

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  console.log("=== Plusieurs photos avant que le chantier existe ===\n");

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext()).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const client = `Julien ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', client);

  const pellicule = page.locator('[aria-label="Photos du chantier"]');
  const [choix] = await Promise.all([
    page.waitForEvent("filechooser"),
    pellicule.locator('button[aria-label="Ajouter des photos"]').click(),
  ]);
  await choix.setFiles(Array.from({ length: NOMBRE_DE_PHOTOS }, () => FIXTURE));

  // Toutes les vignettes, pas la première : c'est à partir de la deuxième que
  // le défaut se jouait.
  await pellicule
    .locator('img[src^="/api/fichiers/"]')
    .nth(NOMBRE_DE_PHOTOS - 1)
    .waitFor({ state: "visible", timeout: 60_000 });

  // Le nom du chantier se déduit du client (`nomDuChantier`) : c'est par lui
  // qu'on retrouve ce que cet essai a créé, et rien d'autre.
  const chantiers = await pool.query<{ id: string; photos: string }>(
    `SELECT c.id, count(p.id) AS photos
       FROM chantiers c LEFT JOIN photos p ON p.chantier_id = c.id
      WHERE c.nom LIKE $1
      GROUP BY c.id`,
    [`%${client}%`]
  );

  await cas(`${NOMBRE_DE_PHOTOS} photos choisies d'un coup font UN chantier`, async () => {
    assert.equal(
      chantiers.rowCount,
      1,
      `${chantiers.rowCount} chantiers pour un seul client — les photos ont recréé le chantier ` +
        `au lieu de le retrouver (répartition : ${chantiers.rows.map((r) => r.photos).join(", ")})`
    );
  });

  await cas("et il porte toutes les photos", async () => {
    assert.equal(Number(chantiers.rows[0]?.photos), NOMBRE_DE_PHOTOS);
  });

  // Puis « Je rédige à la main » : le chantier né des photos n'est pas recréé, et c'est
  // bien lui que le devis ouvre — sinon il verrait deux lignes à l'accueil.
  await cas("« Je rédige à la main » ouvre le devis de CE chantier, sans en créer un autre", async () => {
    await page.click('[data-atlas="action-ecrire"]');
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet$/, { timeout: 30_000 });
    assert.ok(page.url().includes(chantiers.rows[0].id), `ouvert : ${page.url()}`);
    const apres = await pool.query(`SELECT count(*)::int AS n FROM chantiers WHERE nom LIKE $1`, [
      `%${client}%`,
    ]);
    assert.equal(apres.rows[0].n, 1);
  });

  await navigateur.close();
  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Photos avant le chantier — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
