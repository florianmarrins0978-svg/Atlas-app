import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";

// Parcours mobile du lot : informations confirmées → calcul du prix → détail
// explicatif → validation humaine → étape suivante du chantier.
//
// Les assertions portent sur les valeurs métier réellement en base, pas sur la
// présence de texte : un écran peut afficher le bon nombre pour de mauvaises
// raisons.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// **Ce parcours a changé de prix le 7 août 2026, et c'est le correctif.**
//
// Il attendait 1 674,00 € — le calcul depuis les paramètres de chiffrage :
// coûts internes (2 j × 2 ouvriers × 200 € + chef 2 × 280 €), déplacement, puis
// 20 % de marge. Le patron, devant l'équivalent sur son propre devis : « à quoi
// correspond ce prix ? Il n'est pas allé chercher dans la grille de prix, ça ne
// correspond pas du tout. »
//
// Il avait raison : l'entreprise de démonstration porte un tarif « Main d'œuvre
// (jour/homme) » à 280 €, et c'est ce prix de VENTE qui doit s'appliquer dès
// qu'une durée et une équipe sont connues — pas une reconstitution à partir de
// ce que le travail coûte. 2 jours × 2 hommes × 280 € = 1 120 €, déjà rond.
//
// Le calcul depuis les paramètres reste le repli quand aucun tarif au jour
// n'existe ; il est éprouvé par `scripts/test-proposition-prix.ts`, sur une
// entreprise qui n'en a pas.
const PRIX_ATTENDU = "1120.00";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const nomUnique = `Chantier calcul prix e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  // --- Informations : une prestation sans tarif correspondant, durée et équipe ---
  // Posées en base comme le ferait l'écran Informations, pour que le calcul ait
  // de quoi s'exercer sans dépendre du micro.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT entreprise_id FROM chantiers WHERE id = $1`, [chantierId]);
    const entrepriseId = rows[0].entreprise_id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO prestations (entreprise_id, chantier_id, libelle, ordre) VALUES ($1, $2, $3, 0)`,
      [entrepriseId, chantierId, "Démolition cloison e2e"]
    );
    await client.query(`UPDATE chantiers SET duree_prevue = '2 jours', taille_equipe = '2 hommes' WHERE id = $1`, [
      chantierId,
    ]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  // --- Validation des informations depuis l'écran dédié ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.click("text=Valider et calculer le prix");
  await page.waitForURL(/\/prix$/, { timeout: 10000 });

  const apresInfos = await pool.query(`SELECT informations_verifiees_at FROM chantiers WHERE id = $1`, [chantierId]);
  assert.ok(apresInfos.rows[0].informations_verifiees_at, "Les informations doivent être marquées vérifiées");

  // --- Origine du prix annoncée, détail consultable ---
  // waitForURL rend la main dès que l'URL change : le contenu rendu côté
  // serveur peut ne pas encore être peint. On attend donc l'élément lui-même.
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("text=Tarif de l'entreprise", { timeout: 10000 });

  await page.click("text=Voir le détail");
  // Le détail doit NOMMER le tarif employé : c'est exactement la question du
  // patron — « à quoi correspond ce prix ? ». Un montant sans provenance est ce
  // qui l'a fait douter de toute la chaîne.
  await page.waitForSelector("text=Main d'œuvre", { timeout: 5000 });

  // --- Rien n'est appliqué tant que le patron n'a pas agi ---
  const avant = await pool.query(`SELECT count(*) FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
  assert.equal(Number(avant.rows[0].count), 0, "Afficher une proposition ne doit créer aucune ligne");

  // --- Application explicite ---
  await page.click("text=Ajouter au détail");

  // **Attendre que la ligne EXISTE, pas une seconde.** Le 13 août 2026, en
  // batterie : la suite lisait zéro ligne et annonçait « Une seule ligne doit
  // avoir été créée » — elle passait pourtant jouée seule. Une seconde suffit
  // à un serveur au repos, pas sous soixante-six suites, et le message accusait
  // alors le produit d'un défaut qui n'existait pas. Même famille que les deux
  // suites corrigées la veille (`316326210`).
  //
  // On interroge la base, seule à dire la vérité ici : l'écran peut avoir peint
  // la ligne avant que l'action serveur ait rendu la main.
  const jusqua = Date.now() + 30_000;
  let apres = await pool.query(
    `SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre`,
    [chantierId]
  );
  while (apres.rows.length === 0 && Date.now() < jusqua) {
    await page.waitForTimeout(250);
    apres = await pool.query(
      `SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre`,
      [chantierId]
    );
  }

  assert.equal(
    apres.rows.length,
    1,
    "Une seule ligne doit avoir été créée (attendue jusqu'à 30 s après le geste)"
  );
  assert.equal(apres.rows[0].montant, PRIX_ATTENDU, "Le montant écrit doit être celui recalculé côté serveur");

  // --- Le prix n'est pas validé pour autant ---
  const avantValidation = await pool.query(`SELECT prix_valide_at FROM chantiers WHERE id = $1`, [chantierId]);
  assert.equal(avantValidation.rows[0].prix_valide_at, null, "Ajouter une ligne ne vaut pas validation du prix");

  // --- Validation humaine explicite ---
  await page.click("text=Préparer le devis");
  // Vers le DEVIS, et non plus vers la synthèse d'avant l'envoi : celle-ci a été
  // supprimée le 20 août 2026 (`ARCHITECTURE.md` §135).
  await page.waitForURL(/\/devis-complet$/, { timeout: 10000 });
  // L'écran Devis crée le brouillon et horodate devis_genere_at pendant son
  // rendu : lire les jalons avant la fin de ce rendu donnerait un état périmé.
  await page.waitForLoadState("networkidle");

  const apresValidation = await pool.query(`SELECT prix_valide_at FROM chantiers WHERE id = $1`, [chantierId]);
  assert.ok(apresValidation.rows[0].prix_valide_at, "Le prix doit être validé après action explicite");

  // --- Étape suivante du chantier ---
  // Les jalons sont relus en base pour vérifier qu'aucun envoi n'a eu lieu et
  // que la validation du prix tient.
  const { rows: jalons } = await pool.query(
    `SELECT informations_verifiees_at, prix_valide_at, devis_genere_at, devis_envoye_at, date_planifiee,
            (SELECT count(*)::int FROM photos p WHERE p.chantier_id = c.id AND p.deleted_at IS NULL) AS photos_count,
            EXISTS (SELECT 1 FROM notes_vocales n WHERE n.chantier_id = c.id) AS a_note
     FROM chantiers c WHERE c.id = $1`,
    [chantierId]
  );
  const j = jalons[0];
  assert.equal(j.devis_envoye_at, null, "Aucun devis ne doit être envoyé automatiquement");
  assert.ok(j.prix_valide_at, "Le prix doit rester validé");

  // Les deux étapes « devis » possibles sont acceptées : l'écran Devis crée son
  // brouillon de façon asynchrone après chargement, si bien que la sous-étape
  // exacte dépend d'un timing extérieur à ce lot. Ce qui est vérifié ici, et qui
  // relève bien du calcul du prix : le chantier a franchi l'étape Prix et ne
  // propose plus de la refaire.
  // « Consulter le devis » est devenu « Envoyer le devis au client » le 13 août
  // 2026 : le libellé dit désormais le GESTE qui reste, pas l'écran où il mène
  // (`ARCHITECTURE.md` §98). L'intention de ce contrôle — l'étape suivante doit
  // concerner le devis — n'a pas bougé d'un pouce.
  const etapesDevisAcceptees = [
    "Préparer le devis",
    "Consulter le devis",
    "Envoyer le devis au client",
  ];
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  // Lecture du texte réellement rendu : plus robuste que le moteur `text=` face
  // au libellé découpé en deux nœuds (`{label} →`), et le contenu obtenu sert
  // directement de diagnostic en cas d'écart.
  const texteFiche = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  assert.ok(
    etapesDevisAcceptees.some((label) => texteFiche.includes(label)),
    `L'étape suivante doit concerner le devis. Contenu rendu : ${texteFiche.slice(0, 500)}`
  );
  assert.ok(
    !texteFiche.includes("Calculer le prix"),
    "Le prix étant validé, le chantier ne doit plus proposer de le calculer"
  );
  // **La ligne « Prix » a quitté le tiroir le 11 août 2026**, à la demande du
  // patron : *« informations, prix, devis peuvent disparaître »*. Elle
  // décrivait un travail que la chaîne de la dictée fait désormais seule, et
  // qui se corrige de toute façon sur le devis, ligne à ligne.
  //
  // Ce contrôle lisait l'état de l'étape À L'ÉCRAN. Ce qu'il tient vraiment —
  // **le prix validé est bien enregistré** — se lit désormais là où il vit
  // réellement, en base : c'est plus solide qu'un libellé, et cela ne dépend
  // plus de la façon dont un tiroir l'écrit.
  const valide = await pool.query(`SELECT prix_valide_at FROM chantiers WHERE id = $1`, [chantierId]);
  assert.ok(
    valide.rows[0]?.prix_valide_at,
    `Le prix n'est pas marqué validé en base. Contenu rendu : ${texteFiche.slice(0, 500)}`
  );

  await browser.close();
  await pool.end();
  console.log("✅ Test bout-en-bout Calcul du prix réussi.");
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end();
  process.exit(1);
});
