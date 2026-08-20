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
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const client = `M. Durand ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  // --- 1. Le devis à la main, depuis la fiche, sans passer par la dictée ----
  // Le repère d'arrivée est le tiroir du bas. « Autres étapes » ne s'écrit plus
  // nulle part depuis que les étapes y sont rangées (`ARCHITECTURE.md` §49) :
  // attendre un titre disparu ferait échouer le contrôle sur un écran sain.
  await page.waitForSelector("[data-atlas='tiroir-fiche']", { timeout: 10000 });
  // **Repéré par sa DESTINATION, plus par son libellé.** Depuis le 11 août 2026,
  // le corps de la fiche ne porte plus que l'anneau (à la demande du patron,
  // maquette en main) : la rédaction à la main est descendue dans le tiroir, où
  // elle s'écrit « Devis à la main ». Ce qui compte n'a jamais été le mot mais
  // le chemin — et viser le chemin met ce contrôle à l'abri du prochain
  // changement de mise en page.
  const versLaMain = page.locator('[data-atlas="tiroir-fiche"] a[href$="/devis-complet"]');
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
  // Depuis le 5 août 2026, le lien ouvre le DEVIS ENTIER, seul sur sa page —
  // « une page où il n'y a que le devis ». Le détail de ce document est éprouvé
  // par `test-devis-complet-e2e.ts` ; ici on vérifie seulement que le chemin y
  // mène et qu'une ligne écrite à la main aboutit au devis.
  await page.waitForURL(/\/devis-complet$/, { timeout: 10000 });
  await page.waitForSelector("text=DEVIS", { timeout: 10000 });
  console.log("  ✓ la fiche mène au devis écrit à la main, en un lien");

  // Une ligne, son prix — c'est tout ce que le patron veut faire.
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(500);
  await page.getByLabel("Description 1").fill("Abattage d'un chêne mort");
  await page.getByLabel("Description 1").blur();
  await page.getByLabel("Prix unitaire 1").fill("1250");
  await page.getByLabel("Prix unitaire 1").blur();
  await page.waitForTimeout(900);

  const lignes = await pool.query(`SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
  assert.equal(lignes.rowCount, 1, "La ligne écrite à la main n'a pas été enregistrée.");
  assert.equal(lignes.rows[0].montant, "1250.00", `Montant enregistré : ${lignes.rows[0].montant}`);
  console.log("  ✓ une ligne écrite à la main est enregistrée avec son montant");

  // **Relu sur le DEVIS, et son libellé dans le CHAMP.** La synthèse d'avant
  // l'envoi — qui écrivait les libellés en toutes lettres — a disparu le 20 août
  // 2026 (`ARCHITECTURE.md` §135). Sur le devis, une ligne est un champ : son
  // libellé n'est pas dans le texte de la page, et le chercher là ferait rougir
  // un écran parfaitement juste.
  await page.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Choisir la date", { timeout: 15000 });
  const libelle = await page.getByLabel("Description 1").inputValue();
  assert.ok(
    /chêne mort/i.test(libelle),
    `Le devis ne porte pas la ligne écrite à la main : le champ dit « ${libelle} ».`
  );
  const devis = await page.locator("body").innerText();
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
