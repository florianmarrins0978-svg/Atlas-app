import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";

// **Le parcours que le patron réclamait : de la dictée au devis, en un geste.**
//
// Le 4 août 2026 : « toujours pas de devis créé tout seul à partir de la note
// vocale ! Problème qui traîne. Je veux vraiment que tu te consacres à fond pour
// régler ce problème une bonne fois pour toutes. »
//
// Chaque maillon existait et était éprouvé — brouillon, prestations, chiffrage,
// devis. Aucune suite ne les parcourait **à la file**, et c'est précisément
// l'enchaînement qui manquait : cinq boutons sur quatre écrans, dont aucun ne
// menait au suivant. Un contrôle par maillon peut rester vert pendant que le
// parcours, lui, ne mène nulle part.
//
// Ce que cette suite tient, et qui ne doit jamais se défaire :
//   1. depuis l'écran Transcription, **un seul appui** produit un devis chiffré ;
//   2. le devis porte les prestations dictées et un total non nul ;
//   3. **rien ne part au client** — l'arrêt avant l'envoi reste entier.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

const DICTEE =
  "Taille de haie de laurier, 20 mètres linéaire, chaîne mort à démonter, couper le bois en 50, " +
  "le laisser sur place, j'estime le temps de travaux à 2 jours, 2 hommes, un camion à broyeur et une fendeuse.";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const nomDuClient = `M. Dupont ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomDuClient);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  // L'enregistrement micro n'est pas pilotable dans un navigateur sans
  // périphérique audio : la note et sa transcription sont posées en base,
  // exactement comme le fait l'écran Note vocale. Tout ce qui suit — c'est-à-dire
  // ce que ce lot ajoute — est bien exercé par l'écran.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT entreprise_id FROM chantiers WHERE id = $1`, [chantierId]);
    const entrepriseId = rows[0].entreprise_id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum,
                                  transcription, transcription_statut)
       VALUES ($1, $2, 'e2e/dictee-devis.webm', 'audio/webm', 100, 'chk', $3, 'reussie')`,
      [entrepriseId, chantierId, DICTEE]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  // --- Un seul geste ------------------------------------------------------
  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  const bouton = page.getByRole("button", { name: "Créer le devis à partir de ma dictée" });
  assert.equal(
    await bouton.count(),
    1,
    "L'écran de la dictée ne propose pas d'aller au devis : le patron repart pour cinq boutons."
  );
  await bouton.click();
  // **Il atterrit sur le devis lui-même.** Le 5 août 2026 : « une fois qu'on
  // valide la note vocale, cette page s'ouvre — la page où il n'y a que le
  // devis — et là je fais mes modifications. Je ne veux pas tous les autres
  // trucs intermédiaires. » Le compte rendu qui s'affichait ici était l'un de
  // ces intermédiaires.
  // **L'arrêt d'avant-chiffrage peut s'intercaler, et c'est voulu.**
  //
  // Cette dictée dit « chêne mort à démonter » sans donner le diamètre du
  // tronc — l'agent le demande donc avant de chiffrer (décision du patron du
  // 6 août 2026, `docs/EXEMPLE-DICTEE.md` §7). Ce n'est pas un intermédiaire de
  // plus au sens où il l'entendait : c'est le seul moment où répondre coûte
  // moins cher que se tromper de 800 €.
  //
  // La promesse tenue ici reste « un seul appui mène au devis », avec cette
  // réserve : si de l'argent est en jeu, on lui pose la question d'abord. On
  // franchit donc l'arrêt sans rien remplir — il en a le droit — pour vérifier
  // que le parcours va au bout dans le pire des cas.
  const arret = page.locator("text=avant de chiffrer");
  await Promise.race([
    page.waitForURL(/\/devis-complet$/, { timeout: 60000 }),
    arret.first().waitFor({ timeout: 60000 }),
  ]);
  if (await arret.count()) {
    console.log("  ✓ l'agent s'arrête pour demander ce qui fait le prix");
    await page.locator("button", { hasText: /^Continuer/ }).first().click();
  }
  await page.waitForURL(/\/devis-complet$/, { timeout: 60000 });
  // La navigation commence avant que la page soit rendue : sans cette attente,
  // on lirait un écran encore vide et l'on conclurait à tort que le devis ne
  // porte rien.
  await page.waitForSelector("text=Total TTC", { timeout: 20000 });
  console.log("  ✓ un seul appui mène droit au devis, depuis l'écran de la dictée");

  // Les lignes du devis sont des champs de saisie : leur contenu n'est PAS dans
  // `innerText`. Le lire là aurait fait conclure à un devis vide alors qu'il
  // était rempli — un contrôle qui accuse à tort coûte plus cher que pas de
  // contrôle du tout.
  //
  // **Ce contrôle a changé le 8 août 2026, et dans le bon sens.** Il exigeait
  // que la haie soit sur la PREMIÈRE ligne. Depuis qu'elle a sa grille au mètre
  // linéaire, elle a sa propre ligne — après le chantier principal, comme sur
  // son devis du 5 août. Exiger la première place revenait à verrouiller le
  // regroupement qu'il a demandé de défaire.
  const lignesEcrites: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const champ = page.getByLabel(`Description ${i}`);
    if ((await champ.count()) === 0) break;
    lignesEcrites.push(await champ.inputValue());
  }
  assert.ok(lignesEcrites.length > 0, "Le devis ne porte aucune ligne : c'est le devis vide d'avant.");
  const laHaie = lignesEcrites.find((l) => /haie/i.test(l));
  assert.ok(
    laHaie,
    `Le devis ne porte pas ce qui a été dicté : « ${lignesEcrites.join(" || ")} »`
  );
  // Et elle est SEULE sur sa ligne : un client peut commander sa haie sans
  // toucher aux arbres, donc il doit pouvoir la refuser seule.
  assert.ok(
    !/abatt|d[ée]mont|fend/i.test(laHaie),
    `La haie est collée à un autre travail : « ${laHaie} »`
  );
  const devisEcrit = await page.locator("body").innerText();
  assert.ok(
    !/Total TTC\s*0,00\s*€/i.test(devisEcrit),
    `Le devis est chiffré à zéro — c'est le devis vide d'avant : ${devisEcrit.slice(0, 400)}`
  );
  console.log("  ✓ le devis porte les prestations dictées et un montant");

  // --- Ce qui est réellement en base --------------------------------------
  const enBase = await pool.query(
    `SELECT (SELECT count(*) FROM prestations WHERE chantier_id = $1) AS prestations,
            (SELECT count(*) FROM lignes_prix WHERE chantier_id = $1) AS lignes,
            (SELECT count(*) FROM devis WHERE chantier_id = $1) AS devis,
            (SELECT count(*) FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1) AS envois`,
    [chantierId]
  );
  const { prestations, lignes, devis, envois } = enBase.rows[0];
  assert.ok(Number(prestations) >= 3, `Les prestations dictées ne sont pas au chantier (${prestations}).`);
  assert.ok(Number(lignes) >= 1, "Aucune ligne de prix : le devis partirait à 0,00 €.");
  assert.equal(Number(devis), 1, "Le devis n'a pas été préparé.");
  console.log("  ✓ prestations, ligne de prix et devis existent réellement en base");

  // **L'arrêt avant l'envoi est intact.** C'est la seule promesse que ce
  // raccourci ne doit jamais entamer : préparer n'est pas envoyer.
  assert.equal(Number(envois), 0, "Un devis est parti au client sans que le patron l'ait décidé.");
  console.log("  ✓ rien n'est parti au client");

  // --- Le devis, tel qu'il partira au client ------------------------------
  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Envoyer au client", { timeout: 15000 });
  const ecranDevis = await page.locator("body").innerText();
  assert.ok(/taille de haie/i.test(ecranDevis), "Le devis ne porte pas la prestation dictée.");
  assert.ok(
    !/TOTAL\s*0,00\s*€/i.test(ecranDevis),
    `Le devis affiche un total nul. Écran : ${ecranDevis.slice(0, 400)}`
  );
  console.log("  ✓ l'écran Devis porte les prestations et un total");

  // --- Rejouer le geste ne double rien -------------------------------------
  // Le défaut du 3 août — un devis passé de 1 674 à 3 348 € — est venu d'un
  // second appui. Le raccourci ne doit pas le rouvrir.
  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  const rejouable = page.getByRole("button", { name: "Créer le devis à partir de ma dictée" });
  if (await rejouable.count()) {
    await rejouable.click();
    // **L'arrêt d'avant-chiffrage peut s'intercaler, et c'est voulu.**
  //
  // Cette dictée dit « chêne mort à démonter » sans donner le diamètre du
  // tronc — l'agent le demande donc avant de chiffrer (décision du patron du
  // 6 août 2026, `docs/EXEMPLE-DICTEE.md` §7). Ce n'est pas un intermédiaire de
  // plus au sens où il l'entendait : c'est le seul moment où répondre coûte
  // moins cher que se tromper de 800 €.
  //
  // La promesse tenue ici reste « un seul appui mène au devis », avec cette
  // réserve : si de l'argent est en jeu, on lui pose la question d'abord. On
  // franchit donc l'arrêt sans rien remplir — il en a le droit — pour vérifier
  // que le parcours va au bout dans le pire des cas.
  const arret = page.locator("text=avant de chiffrer");
  await Promise.race([
    page.waitForURL(/\/devis-complet$/, { timeout: 60000 }),
    arret.first().waitFor({ timeout: 60000 }),
  ]);
  if (await arret.count()) {
    console.log("  ✓ l'agent s'arrête pour demander ce qui fait le prix");
    await page.locator("button", { hasText: /^Continuer/ }).first().click();
  }
  await page.waitForURL(/\/devis-complet$/, { timeout: 60000 });
    const apres = await pool.query(`SELECT count(*) FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
    assert.equal(
      Number(apres.rows[0].count),
      Number(lignes),
      "Rejouer l'enchaînement a ajouté une seconde ligne de prix : le devis du patron a doublé."
    );
    console.log("  ✓ rejouer le geste n'ajoute pas une seconde ligne de prix");
  }

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ De la dictée au devis, en un seul geste — et rien n'est parti.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
