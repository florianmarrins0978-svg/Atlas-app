import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **Trois défauts trouvés par le patron sur son premier vrai devis à la main.**
//
// Le 6 août 2026, il crée un chantier, renseigne son client, ouvre « rédiger le
// devis à la main », et rapporte :
//
//   1. « l'adresse n'est pas au bon endroit, le numéro de téléphone devrait
//      être en dernier » — il avait saisi l'adresse des travaux, laissé vide
//      « adresse du client », et retrouvé un client sans adresse et une rue
//      orpheline en bas de page ;
//   2. « quand j'essaye de cliquer pour mettre un prix, ce n'est pas
//      cliquable » — le champ l'était, mais vide, sans repère, haut de 24 px ;
//   3. « quand je fais aperçu en PDF, rien n'a été enregistré » — ses lignes
//      étaient bien en base, mais le PDF imprimait un instantané figé au
//      chargement de la page, donc antérieur à tout ce qu'il avait écrit.
//
// Aucune suite ne les voyait : chaque morceau marchait isolément. Celle-ci
// parcourt son chemin, dans son ordre, avec un écran de six pouces.

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
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  // Exactement sa saisie : nom, téléphone, e-mail, adresse DU CHANTIER — et
  // rien dans « adresse du client », puisque l'écran annonce « si différente ».
  const ADRESSE = "10 rue denfert rochereau 78200 mantes la jolie";
  const nomClient = `Martin ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomClient);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0660060265");
  await page.fill('input[placeholder="bernard@exemple.fr"]', "client@exemple.net");
  await page.fill('input[placeholder="12 rue des Lilas, Nantes"]', ADRESSE);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15000 });
  const chantierId = page.url().split("/").pop()!;

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 20000 });

  // --- 1. Le bloc client, dans l'ordre d'une lettre -------------------------
  //
  // « Si différente de l'adresse du chantier » : laissée vide, elle est donc
  // la même. Ce n'est pas une donnée inventée — c'est ce que l'écran promet.
  assert.equal(
    await page.getByLabel("Adresse du client").inputValue(),
    ADRESSE,
    "L'adresse saisie à la création n'arrive pas au client : il la retrouve orpheline en bas du devis."
  );

  // L'ordre se lit dans l'ordre du document, pas dans le code — c'est celui
  // que ses yeux suivent. Et il se lit sur les CHAMPS : `innerText` ignore le
  // contenu des zones de saisie, si bien qu'un contrôle qui l'interrogerait ne
  // verrait ni le nom, ni l'adresse, ni le téléphone. Piège vérifié en le
  // rencontrant.
  const ordre = await page.$$eval("input[aria-label], textarea[aria-label]", (champs) =>
    champs.map((c) => ({ aria: c.getAttribute("aria-label") ?? "", valeur: (c as HTMLInputElement).value }))
  );
  const rang = (aria: string) => ordre.findIndex((c) => c.aria === aria);
  const lu = ordre.map((c) => c.aria).join(" → ");
  assert.ok(rang("Adresse du client") > rang("Nom du client"), `L'adresse doit suivre le nom. Lu : ${lu}`);
  assert.ok(
    rang("Téléphone du client") > rang("E-mail du client") && rang("Téléphone du client") > rang("Adresse du client"),
    `Le patron l'a demandé le 6 août 2026 : le téléphone en DERNIER. Lu : ${lu}`
  );
  console.log("  ✓ nom, adresse, e-mail, puis téléphone — dans cet ordre");

  // La même rue ne s'affiche pas deux fois : la ligne « Chantier » n'apparaît
  // que si l'adresse des travaux diffère.
  const fois = ordre.filter((c) => c.valeur.trim() === ADRESSE).length;
  assert.equal(fois, 1, `L'adresse apparaît ${fois} fois sur le devis. Champs : ${lu}`);
  console.log("  ✓ l'adresse des travaux ne se répète pas quand elle est la même");

  // --- 2. Le prix se voit, et se touche ------------------------------------
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(1000);

  const prix = page.getByLabel("Prix unitaire 1");
  const boite = await prix.boundingBox();
  assert.ok(boite, "Le champ du prix n'a aucune surface à l'écran.");
  // 44 px : la cible tactile recommandée par Apple. En dessous, on touche à
  // côté — et l'on conclut que « ce n'est pas cliquable ».
  assert.ok(
    boite!.height >= 44,
    `Le champ du prix ne fait que ${Math.round(boite!.height)} px de haut : trop petit pour un doigt.`
  );
  // Vide et sans repère, il était invisible : rien n'invitait à le toucher.
  assert.ok(
    await prix.getAttribute("placeholder"),
    "Le champ du prix est vide et sans exemple : rien ne dit qu'on peut y écrire."
  );
  console.log("  ✓ le champ du prix a la taille d'un doigt et se voit");

  await page.getByLabel("Description 1").fill("Élagage d'un tilleul");
  await prix.fill("450");
  await page.getByLabel("Quantité 1").fill("2");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);

  // --- 3. L'aperçu PDF imprime ce qui est à l'écran -------------------------
  //
  // Le cœur du défaut : il écrit, puis touche « Aperçu du PDF » SANS recharger
  // la page. L'instantané imprimé doit être rafraîchi à cet instant.
  const devisId = (await pool.query(`SELECT id FROM devis WHERE chantier_id = $1`, [chantierId])).rows[0].id;
  const reponse = await page.request.get(`${BASE}/api/devis/${devisId}/pdf`);
  assert.equal(reponse.status(), 200, "L'aperçu du PDF ne répond pas.");

  const { rows } = await pool.query(
    `SELECT d.total_ht,
            (SELECT count(*) FROM lignes_devis ld WHERE ld.devis_id = d.id) AS imprimees,
            (SELECT count(*) FROM lignes_prix lp WHERE lp.chantier_id = d.chantier_id) AS a_l_ecran
       FROM devis d WHERE d.id = $1`,
    [devisId]
  );
  const { total_ht, imprimees, a_l_ecran } = rows[0];
  assert.equal(
    Number(imprimees),
    Number(a_l_ecran),
    `Le PDF imprime ${imprimees} ligne(s) quand l'écran en montre ${a_l_ecran} : c'est le « rien n'a été enregistré » du patron.`
  );
  assert.equal(Number(total_ht), 900, `Le PDF totalise ${total_ht} € au lieu de 900 € (2 × 450).`);
  console.log("  ✓ l'aperçu du PDF imprime les lignes et le total de l'écran");

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ Le devis à la main : adresses en place, prix saisissable, PDF fidèle à l'écran.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
