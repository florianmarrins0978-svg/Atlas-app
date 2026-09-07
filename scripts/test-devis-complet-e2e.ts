import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

/**
 * Attend que la BASE porte ce qu'on vient d'écrire à l'écran.
 *
 * **Le remède au défaut le plus coûteux de ces suites** (`TODO.md`) : elles
 * lisaient la base après un `waitForTimeout` fixe. Neuf cents millisecondes
 * suffisaient à vide et manquaient sous la charge d'une batterie — alors elles
 * rougissaient une fois sur deux, sur du code parfaitement juste, et trois
 * sessions ont mené la même enquête avant qu'on l'écrive.
 *
 * On interroge donc jusqu'à ce que la valeur soit là. Si elle ne vient jamais,
 * on rend la dernière lue : c'est l'assertion de l'appelant qui accuse, avec
 * son message et son chiffre — pas cette attente, qui ne saurait pas quoi dire.
 */
async function attendreEnBase<T>(
  lire: () => Promise<T>,
  tient: (v: T) => boolean,
  msMax = 20_000
): Promise<T> {
  const fin = Date.now() + msMax;
  let dernier = await lire();
  while (!tient(dernier) && Date.now() < fin) {
    await new Promise((r) => setTimeout(r, 200));
    dernier = await lire();
  }
  return dernier;
}

// **« Le fichier devis, le vrai ! Le fichier en entier. »**
//
// Le patron, le 5 août 2026 : « je veux que lorsqu'on clique sur rédiger à la
// main, ça ouvre le fichier devis, le vrai ! Celui qui se trouve dans modèle de
// devis, le fichier en entier, pas juste les lignes pour remplir les infos et
// les prix, le document entier. »
//
// Il avait raison sur le fond : l'écran Prix ne montrait que des lignes et des
// montants. Ce qu'il envoie à son client est un **document** — son en-tête, ses
// coordonnées, celles du client, le tableau, les totaux, ses conditions, le
// cadre de signature.
//
// Ce que cette suite tient :
//   1. le lien mène au document entier, avec toutes ses parties ;
//   2. ce qu'il y écrit part vers la bonne source et **reste dans Atlas** —
//      c'est la condition pour que la facture et la TVA continuent d'en
//      découler. Un beau document dont Atlas ne saurait rien serait une impasse ;
//   3. un devis déjà parti ne se modifie plus.

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

  const client = `M. Ledoux ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', client);
  const chantierId = await creerPuisFiche(page);
  const chantierUrl = `${BASE}/chantiers/${chantierId}`;

  // --- 1. Le chemin mène au document entier ------------------------------
  // **Sans détour depuis le 4 septembre 2026.** La rédaction à la main vivait
  // dans le tiroir de la fiche du chantier, retirée (`ARCHITECTURE.md` §254) ;
  // « Je rédige à la main », sur la fiche client, y mène droit — c'est ce
  // bouton que `creerPuisFiche` vient de toucher.
  await page.waitForURL(/\/devis-complet$/, { timeout: 10000 });
  // Le titre du DOCUMENT, et non un titre d'écran : la page ne porte plus que
  // le devis (« une page où il n'y a que le devis », le 5 août 2026).
  await page.waitForSelector("text=DEVIS", { timeout: 10000 });

  // Et rien d'autre : ni barre d'onglets, ni titre d'application. Une feuille
  // de devis entourée d'onglets redevient un écran, ce qu'il ne voulait plus.
  assert.equal(
    await page.locator(".atlas-nav-basse").count(),
    0,
    "La barre d'onglets est revenue sur la page du devis."
  );

  // Toutes les parties du modèle, sur un devis encore vierge : ce sont celles
  // qui doivent être là AVANT même qu'une ligne soit écrite. Les libellés du
  // tableau, eux, n'apparaissent qu'avec une ligne (sur téléphone) ou en
  // en-têtes de colonnes (sur grand écran) — vérifiés juste après.
  const document = await page.locator("body").innerText();
  for (const partie of [
    // **« Émetteur » a disparu le 18 août 2026**, et c'est voulu : l'en-tête
    // porte le nom, l'adresse, le téléphone, l'e-mail et le SIRET — le bloc du
    // bas les réécrivait. Sa question : *« pourquoi il y a deux fois
    // l'émetteur ? »*.
    "Devis n°",
    "Validité",
    "Client",
    "Total HT",
    "TVA",
    "Total TTC",
    "Notes / conditions",
    "Modalités de paiement",
    "signature du client",
  ]) {
    assert.ok(
      document.toLowerCase().includes(partie.toLowerCase()),
      `« ${partie} » manque au document : ce n'est pas le devis entier, seulement un bout.`
    );
  }
  console.log("  ✓ le document entier s'ouvre, avec toutes ses parties");

  // Les en-têtes de colonnes n'apparaissent qu'à partir du format tablette : sur
  // six pouces, chaque cellule porte son libellé, comme le modèle d'origine. On
  // les vérifie donc là où ils existent, plutôt que de les croire absents.
  const large = await navigateur.newContext({ viewport: { width: 1024, height: 900 } });
  const pageLarge = await large.newPage();
  await pageLarge.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await pageLarge.fill('input[name="email"]', "demo@atlas.local");
  await pageLarge.fill('input[name="password"]', "demo1234");
  await pageLarge.click('button[type="submit"]');
  await pageLarge.waitForURL(`${BASE}/`, { timeout: 15000 });
  await pageLarge.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
  const surGrandEcran = await pageLarge.locator("body").innerText();
  for (const colonne of ["Description", "Qté", "Prix unitaire HT", "Total HT"]) {
    assert.ok(
      surGrandEcran.toLowerCase().includes(colonne.toLowerCase()),
      `La colonne « ${colonne} » manque au tableau sur grand écran.`
    );
  }
  await large.close();
  console.log("  ✓ le tableau porte ses colonnes, comme sur le papier");

  const lireEntreprise = () =>
    pool.query(
      `SELECT e.iban, e.siret FROM entreprises e
       JOIN chantiers c ON c.entreprise_id = e.id WHERE c.id = $1`,
      [chantierId]
    );

  // --- 2. Ce qui s'y écrit part vers la bonne source ----------------------
  // L'IBAN : sans lui, le client reçoit un devis qu'il ne peut pas payer, et
  // aucun autre écran ne le demandait.
  const iban = page.getByLabel("IBAN");
  await iban.fill("FR76 3000 1000 0100 0000 0000 123");
  await iban.blur();
  await page.waitForTimeout(800);

  const siret = page.getByLabel("SIREN / SIRET");
  await siret.fill("123 456 789 00012");
  await siret.blur();
  await page.waitForTimeout(800);

  // **On RELIT la base jusqu'à ce qu'elle ait reçu, au lieu d'attendre 800 ms.**
  // Le champ rend la main dès le doigt levé et laisse l'enregistrement partir
  // derrière lui. Huit cents millisecondes suffisent quand cette suite est jouée
  // seule ; sous la batterie, la lecture arrivait avant l'écriture et trouvait
  // l'IBAN du jeu de démonstration — le contrôle accusait alors l'en-tête de
  // l'entreprise, qui n'y était pour rien. Attendre ce qu'on affirme, jamais une
  // durée (`test-prix-e2e.ts`, même remède).
  let entreprise = await lireEntreprise();
  for (const essai of [1, 2, 3, 4]) {
    if (entreprise.rows[0]?.iban === "FR76 3000 1000 0100 0000 0000 123") break;
    await page.waitForTimeout(essai * 400);
    entreprise = await lireEntreprise();
  }
  assert.equal(entreprise.rows[0].iban, "FR76 3000 1000 0100 0000 0000 123", "L'IBAN n'a pas été enregistré.");
  assert.equal(entreprise.rows[0].siret, "123 456 789 00012", "Le SIRET n'a pas été enregistré.");
  console.log("  ✓ l'en-tête de l'entreprise s'enregistre — IBAN compris");

  // Une ligne complète : description, quantité, prix unitaire.
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(600);
  await page.getByLabel("Description 1").fill("Élagage d'un tilleul — taille architecturée");
  await page.getByLabel("Description 1").blur();
  await page.getByLabel("Quantité 1").fill("3");
  await page.getByLabel("Quantité 1").blur();
  await page.getByLabel("Prix unitaire 1").fill("250");
  await page.getByLabel("Prix unitaire 1").blur();
  await page.waitForTimeout(900);

  // Le total de la ligne se calcule sous ses yeux : 3 × 250 = 750.
  assert.ok(
    (await page.locator("body").innerText()).includes("750,00"),
    "Le total de la ligne (3 × 250 €) ne s'affiche pas : le patron ne voit pas ce qu'il écrit."
  );

  const ligne = await pool.query(
    `SELECT libelle, quantite, prix_unitaire, montant FROM lignes_prix WHERE chantier_id = $1`,
    [chantierId]
  );
  assert.equal(ligne.rowCount, 1, "La ligne n'a pas été enregistrée.");
  assert.equal(ligne.rows[0].quantite, "3.00", `Quantité enregistrée : ${ligne.rows[0].quantite}`);
  assert.equal(ligne.rows[0].prix_unitaire, "250.00", `Prix unitaire : ${ligne.rows[0].prix_unitaire}`);
  assert.equal(ligne.rows[0].montant, "750.00", `Montant : ${ligne.rows[0].montant}`);
  console.log("  ✓ une ligne s'écrit avec sa quantité et son prix unitaire");

  // Le taux de TVA appartient au document : 10 % en rénovation, 20 % en neuf.
  const taux = page.getByLabel("Taux de TVA");
  await taux.fill("10");
  await taux.blur();
  const devisApres = await attendreEnBase(
    () => pool.query(`SELECT taux_tva, total_ttc FROM devis WHERE chantier_id = $1`, [chantierId]),
    // **L'attente couvre TOUT ce que les assertions regardent.** N'attendre que
    // le taux laissait passer le TTC, calculé juste après : la suite rougissait
    // alors sur « 0,00 » une ligne plus bas — le défaut déplacé d'une
    // assertion, pas réparé.
    (r) => r.rows[0]?.taux_tva === "10.00" && r.rows[0]?.total_ttc === "825.00"
  );
  assert.equal(devisApres.rows[0].taux_tva, "10.00", `Taux enregistré : ${devisApres.rows[0].taux_tva}`);
  assert.equal(devisApres.rows[0].total_ttc, "825.00", `TTC à 10 % : ${devisApres.rows[0].total_ttc}`);
  console.log("  ✓ le taux de TVA se change, et les totaux suivent");

  const conditions = page.getByLabel("Notes et conditions");
  await conditions.fill("Acompte de 30 % à la signature, solde à réception des travaux.");
  await conditions.blur();
  await page.waitForTimeout(900);

  // --- 3. Le devis reste dans Atlas : la chaîne tient ---------------------
  // C'est la raison d'être de cet écran plutôt que du fichier d'origine, qui
  // gardait tout dans le navigateur.
  // **Le devis se relit chez lui.** L'écran de synthèse d'avant l'envoi, qui
  // écrivait les libellés en toutes lettres, a disparu le 20 août 2026
  // (`ARCHITECTURE.md` §136) : sur le devis, un libellé vit dans son champ, et
  // le chercher dans le texte de la page ferait rougir un écran juste. Les
  // totaux, eux, restent du texte — c'est bien ce qu'on lit.
  await page.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Choisir la date", { timeout: 15000 });
  const libelleRelu = await page.getByLabel("Description 1").inputValue();
  assert.ok(
    /tilleul/i.test(libelleRelu),
    `L'écran Devis ignore ce qui a été écrit à la main : le champ dit « ${libelleRelu} ».`
  );
  const ecranDevis = await page.locator("body").innerText();
  assert.ok(/825,00/.test(ecranDevis), `Le total TTC ne suit pas : ${ecranDevis.slice(0, 300)}`);
  console.log("  ✓ ce qui est écrit à la main devient le devis d'Atlas");

  // Et le PDF, qui est ce que le client reçoit.
  const pdf = await page.request.get(`${BASE}/api/devis/${devisApres.rows[0].id ?? ""}/pdf`).catch(() => null);
  if (pdf && pdf.ok()) {
    assert.ok((await pdf.body()).length > 1000, "Le PDF produit est vide.");
  }

  // Les conditions écrites survivent à une régénération du brouillon : elles ne
  // font pas partie de l'instantané, et une ligne ajoutée ne doit pas les
  // effacer.
  const conditionsEnBase = await pool.query(`SELECT conditions_paiement FROM devis WHERE chantier_id = $1`, [chantierId]);
  assert.ok(
    /Acompte de 30 %/.test(conditionsEnBase.rows[0].conditions_paiement ?? ""),
    "Les conditions écrites ont été effacées par la régénération du devis."
  );
  console.log("  ✓ les conditions écrites survivent à la régénération du devis");

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ Le devis à la main est le document entier, et il reste dans Atlas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
