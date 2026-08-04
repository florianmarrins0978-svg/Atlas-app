import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";

// **Trois demandes du patron, le 4 août 2026, éprouvées de bout en bout.**
//
// 1. « Je ne peux toujours pas rédiger mon devis seulement à la main si je le
//    souhaite. » Il le pouvait — mais uniquement par un lien caché au bas de
//    l'écran Informations, après avoir traversé photos et dictée. Et sa fiche
//    affichait « Prix — en attente des informations », qui se lit comme un
//    verrou alors que rien n'a jamais été verrouillé. Un chemin qui existe mais
//    que personne ne trouve n'existe pas.
//
// 2. « La durée du chantier, ½ journée plus bande déroulante max 100 jours,
//    elle a disparu !!!! » Elle n'avait pas disparu : elle n'était que sur
//    l'écran d'envoi, au bout du parcours, et il la cherchait là où l'on décrit
//    le chantier.
//
// 3. « Version » dans les Réglages — le contrôle le moins spectaculaire et le
//    plus utile : il a réessayé pendant trois échanges des correctifs livrés la
//    veille, sur un espace de travail resté en arrière, sans que rien ne le lui
//    dise.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const nom = `Devis à la main ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nom);
  await page.fill('input[placeholder="M. Bernard"]', "M. Durand");
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  // --- 1. Le devis à la main, depuis la fiche, sans passer par la dictée ----
  await page.waitForSelector("text=Autres étapes", { timeout: 10000 });
  const versLaMain = page.getByRole("link", { name: /rédiger le devis à la main/i });
  assert.equal(
    await versLaMain.count(),
    1,
    "La fiche d'un chantier neuf n'offre aucun chemin vers le devis écrit à la main."
  );

  // Et les étapes ne se lisent plus comme des verrous.
  const fiche = await page.locator("body").innerText();
  assert.ok(
    !/en attente des informations/i.test(fiche),
    "« En attente des informations » se lit comme un verrou : c'est ce qui lui a fait croire qu'il ne pouvait pas."
  );

  await versLaMain.click();
  await page.waitForURL(/\/prix\?saisie=manuelle$/, { timeout: 10000 });
  await page.waitForSelector("text=Vous écrivez ce devis vous-même", { timeout: 10000 });
  console.log("  ✓ la fiche mène au devis écrit à la main, en un lien");

  // Une ligne, son montant — c'est tout ce que le patron veut faire.
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(400);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Abattage d'un chêne mort");
  await champs.nth(1).fill("1250.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(900);

  const lignes = await pool.query(`SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
  assert.equal(lignes.rowCount, 1, "La ligne écrite à la main n'a pas été enregistrée.");
  assert.equal(lignes.rows[0].montant, "1250.00", `Montant enregistré : ${lignes.rows[0].montant}`);
  console.log("  ✓ une ligne écrite à la main est enregistrée avec son montant");

  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Envoyer au client", { timeout: 15000 });
  const devis = await page.locator("body").innerText();
  assert.ok(/chêne mort/i.test(devis), "Le devis ne porte pas la ligne écrite à la main.");
  assert.ok(!/TOTAL\s*0,00\s*€/i.test(devis), `Le devis reste à zéro : ${devis.slice(0, 300)}`);
  console.log("  ✓ le devis reprend la ligne écrite à la main, sans dictée ni proposition");

  // --- 2. La bande déroulante des durées, là où il la cherche --------------
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  const bande = page.getByLabel("Durée du chantier");
  assert.equal(await bande.count(), 1, "La bande déroulante des durées n'est pas sur l'écran Informations.");

  const options = await bande.locator("option").allInnerTexts();
  assert.ok(options.includes("½ journée"), `La demi-journée manque : ${JSON.stringify(options.slice(0, 5))}`);
  assert.ok(options.includes("100 jours"), "La bande ne va pas jusqu'à 100 jours.");
  // Rien n'a été dit de la durée : ne pas en afficher une par défaut, qui
  // entrerait ensuite dans un prix (`CLAUDE.md` §4).
  assert.equal(await bande.inputValue(), "", "Une durée est proposée alors que personne ne l'a donnée.");
  console.log("  ✓ la bande ½ journée → 100 jours est sur l'écran Informations");

  await bande.selectOption({ label: "3 jours" });
  await page.waitForTimeout(900);
  const duree = await pool.query(`SELECT duree_prevue FROM chantiers WHERE id = $1`, [chantierId]);
  assert.equal(duree.rows[0].duree_prevue, "3 jours", `Durée enregistrée : ${duree.rows[0].duree_prevue}`);

  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("Durée du chantier").inputValue(),
    "6",
    "La durée choisie ne se retrouve pas dans la bande après rechargement."
  );
  console.log("  ✓ la durée choisie est enregistrée, et relue au rechargement");

  // --- 3. L'application dit quelle version elle exécute --------------------
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Version", { timeout: 10000 });
  // Insensible à la casse : l'intertitre est rendu en capitales par la charte,
  // et `innerText` restitue le texte tel qu'il s'affiche, pas tel qu'il s'écrit.
  const reglages = await page.locator("body").innerText();
  assert.ok(
    /version/i.test(reglages),
    "Les Réglages n'annoncent aucune version : impossible de savoir quel code tourne sur une capture."
  );
  // Et la ligne dit quelque chose. Hors banc d'essai la variable n'est pas
  // posée : on attend alors l'aveu explicite, jamais un blanc.
  assert.ok(
    /inconnue|\d{2}\/\d{2}\/\d{4}/.test(reglages),
    "La version affichée est vide : une ligne muette ne répond à aucune question."
  );
  console.log("  ✓ les Réglages annoncent la version exécutée");

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ Devis à la main, bande de durée, et version affichée.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
