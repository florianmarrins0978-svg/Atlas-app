import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";

// **Rien n'est effacé pour de bon tant que le tiroir est ouvert.**
//
// C'est la promesse dont tout le geste dépend, et la seule qui ne se voie pas à
// l'écran. Le patron, le 10 août 2026 : *« une annulation qui ne rend rien est
// pire que pas d'annulation »*.
//
// Une photo et une note vocale ont un fichier derrière elles, et
// `supprimerPhoto` / `supprimerNoteVocale` mettent ce fichier en file de purge
// **dans la même transaction** que la suppression (`fichiers_a_purger`).
// Appeler le serveur au moment du geste rendrait « Annuler » menteur : la ligne
// reviendrait, le fichier non — et il serait effacé du disque à la purge
// suivante.
//
// Cette suite tient les deux moitiés de la promesse :
//
//   1. juste après le retrait, **la file n'a pas bougé** et la photo est
//      toujours en base ;
//   2. une fois le tiroir refermé, **elle a bougé d'exactement un** — sans
//      quoi le retrait ne serait qu'un masque, et la photo reviendrait au
//      prochain chargement.
//
// Le contrôle sait échouer dans les deux sens : c'est ce qui le distingue d'un
// contrôle qui regarde le mauvais moment.

const BASE = "http://localhost:3000";
/** Le délai du tiroir (`useRetraits`), plus une marge pour l'aller-retour. */
const DELAI_TIROIR_MS = 6000;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ hasTouch: true });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  // Un chantier qui a réellement des photos : sans cela le contrôle
  // n'éprouverait rien, et il le dit plutôt que de passer au vert.
  const { rows } = await pool.query(
    `SELECT c.id, count(p.id)::int AS photos
       FROM chantiers c JOIN photos p ON p.chantier_id = c.id AND p.deleted_at IS NULL
      GROUP BY c.id HAVING count(p.id) > 0 LIMIT 1`
  );
  if (rows.length === 0) {
    console.error("✗ Aucun chantier avec photo dans le jeu de démonstration : ce contrôle n'a rien éprouvé.");
    process.exit(1);
  }
  const chantierId = rows[0].id as string;

  const compterEnFile = async () =>
    Number((await pool.query(`SELECT count(*)::int AS n FROM fichiers_a_purger`)).rows[0].n);
  const compterPhotosVives = async () =>
    Number(
      (
        await pool.query(
          `SELECT count(*)::int AS n FROM photos WHERE chantier_id = $1 AND deleted_at IS NULL`,
          [chantierId]
        )
      ).rows[0].n
    );

  const fileAvant = await compterEnFile();
  const photosAvant = await compterPhotosVives();

  // Les photos vivent dans la pellicule du tiroir depuis le 11 août 2026 :
  // l'écran `/photos` n'existe plus, et la pellicule ne se voit qu'une fois le
  // tiroir ouvert.
  await page.goto(`${BASE}/chantiers/${chantierId}`, { waitUntil: "networkidle" });
  // Le marqueur n'apparaît qu'après le premier effet : le HTML rendu par le
  // serveur porte déjà les boutons, sans le moindre écouteur.
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 30000 });
  await page.click('button[aria-label="Ouvrir le détail du chantier"]');

  await page.getByRole("button", { name: "Voir la photo" }).first().click();
  await page.waitForSelector('button[aria-label="Retirer cette photo"]', { timeout: 10000 });
  await page.click('button[aria-label="Retirer cette photo"]');
  await page.waitForTimeout(900);

  // --- 1. Le tiroir est ouvert : RIEN ne doit avoir bougé en base ---------
  assert.equal(
    await page.locator(".atlas-tiroir[data-ouvert='oui']").count(),
    1,
    "Le tiroir ne s'est pas ouvert : le reste du contrôle n'éprouverait rien."
  );
  assert.equal(
    await compterEnFile(),
    fileAvant,
    "Le fichier est déjà en file de purge alors que le tiroir est encore ouvert : « Annuler » rendrait une photo sans son image."
  );
  assert.equal(
    await compterPhotosVives(),
    photosAvant,
    "La photo est déjà supprimée en base alors que le tiroir est encore ouvert."
  );
  console.log("  ✓ tiroir ouvert : ni la photo ni son fichier n'ont bougé");

  // --- 2. Le tiroir se referme : le retrait devient définitif -------------
  await page.waitForTimeout(DELAI_TIROIR_MS + 2500);

  assert.equal(
    await compterPhotosVives(),
    photosAvant - 1,
    "Après la fermeture du tiroir, la photo est toujours vive : le retrait n'était qu'un masque, elle reviendrait au prochain chargement."
  );
  assert.equal(
    await compterEnFile(),
    fileAvant + 1,
    "Après la fermeture du tiroir, le fichier n'est pas en file de purge : il resterait sur le disque pour toujours."
  );
  console.log("  ✓ tiroir refermé : la photo est retirée et son fichier mis en file de purge");

  await navigateur.close();
  await pool.end();
  console.log("✅ Rien n'est effacé tant que le tiroir est ouvert — et tout l'est une fois qu'il se referme.");
}

main().catch(async (e) => {
  console.error("❌", e);
  process.exit(1);
});
