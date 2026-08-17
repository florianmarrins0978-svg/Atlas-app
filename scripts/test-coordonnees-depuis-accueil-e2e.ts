import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import { pool } from "../src/server/db/client";

// **« Adresse non renseignée » ouvre l'écran du chantier.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 17 août 2026, capture de son accueil à l'appui : *« j'ai oublié
// de rentrer les infos du client. Il faut qu'à partir de cette page, il y a
// marqué adresse non renseignée, que je puisse cliquer dessus »*. Puis, devant
// une planche qui inventait une fiche client de toutes pièces : ***« que ça
// m'amène sur la page que je t'ai envoyée sur la deuxième photo. RIEN DE PLUS,
// RIEN DE MOINS. »*** — sa seconde photo montrait l'écran de création.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CE CONTRÔLE TIENT, ET QUE LES DEUX AUTRES NE PEUVENT PAS VOIR.**
// `test-nom-chantier` éprouve la règle sans base ; `test-reprendre-chantier-db`
// l'éprouve contre la base. Ni l'un ni l'autre ne sait si le doigt trouve la
// cible, ni où elle mène : les deux seraient verts sur une application où rien
// n'est branché à l'accueil.
//
//   1. la mention est un LIEN, et elle mène aux coordonnées du chantier ;
//   2. **le nom du chantier, lui, ne mène PAS là** — il garde sa reprise. C'est
//      « rien de plus, rien de moins » : il a dit « cliquer DESSUS » ;
//   3. l'écran d'arrivée est celui de la création, avec SES champs ;
//   4. les deux mots que la reprise oblige à changer sont changés — « Nouveau »
//      et « Créer le chantier » mentiraient sur un chantier qui existe ;
//   5. **ce qu'il saisit tient**, et le NOM DU CHANTIER SUIT : sans ce
//      recalcul, la ligne afficherait « Chantier du … » pour toujours, et le
//      défaut serait corrigé partout sauf là où il l'a vu ;
//   6. et la mention disparaît de l'accueil — il n'y a plus rien à compléter.

const BASE = "http://localhost:3000";
const ECRAN_DU_PATRON = devices["iPhone 13"];

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
  console.log("=== « Adresse non renseignée » ouvre l'écran du chantier ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Le chantier de sa capture : ni client, ni adresse.** On le crée par le
  // vrai chemin, en laissant tout vide — c'est ce qu'il a fait, et c'est ce qui
  // produit « Chantier du … ». Fabriquer la ligne à la main éprouverait une
  // forme de donnée que l'application ne produit pas.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  const ligne = page.locator(`[data-atlas="lieu-manquant"][href$="/chantiers/${chantierId}/coordonnees"]`);

  await cas("la mention est un lien, et elle mène aux coordonnées de CE chantier", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    if ((await ligne.count()) === 0) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "aucune mention cliquable pour ce chantier à l'accueil.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n      ")
      );
    }
    const dit = (await ligne.innerText()).trim();
    if (dit !== "Adresse non renseignée") {
      throw new Error(`la mention dit « ${dit} » : ce n'est pas la phrase qu'il a lue`);
    }

    // **Sous un pouce ganté, un texte de 11,5 px n'est pas une cible.** Mesuré
    // à l'écran, pas déduit d'une classe : c'est la hauteur RENDUE qui décide.
    const boite = await ligne.boundingBox();
    if (!boite) throw new Error("la mention n'a aucune boîte : rien à toucher");
    if (boite.height < 34) {
      throw new Error(`la mention fait ${Math.round(boite.height)} px de haut, il en faut 34`);
    }
  });

  await cas("le NOM du chantier, lui, garde sa reprise — « rien de plus »", async () => {
    // S'il menait lui aussi aux coordonnées, la ligne changerait de destination
    // et sa règle du 13 août — « que ça me renvoie à l'étape où je me suis
    // arrêté » — cesserait de valoir. Il a dit « cliquer DESSUS ».
    const nom = page.locator(`a:has(h2)`).filter({ hasText: "Chantier du" }).first();
    const cible = await nom.getAttribute("href");
    if (cible === null) throw new Error("le nom du chantier ne mène nulle part");
    if (/\/coordonnees$/.test(cible)) {
      throw new Error(`le nom mène aussi aux coordonnées (${cible}) : la mention n'est plus seule`);
    }
  });

  await cas("elle ouvre l'écran de la création, avec SES champs", async () => {
    await ligne.click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}/coordonnees$`), { timeout: 30_000 });
    await page.waitForTimeout(400);
    const ecran = await page.locator("body").innerText();
    // Les mots de sa seconde photo, et pas d'autres.
    for (const attendu of [
      "Nom du client (facultatif)",
      "Téléphone (facultatif)",
      "E-mail (facultatif)",
      "Adresse du chantier (facultatif)",
      "Ajouter une adresse client différente",
    ]) {
      if (!ecran.toUpperCase().includes(attendu.toUpperCase())) {
        throw new Error(
          `« ${attendu} » manque de l'écran d'arrivée — ce n'est pas celui de sa photo.\n      ` +
            ecran.split("\n").filter((l) => l.trim()).slice(0, 18).join("\n      ")
        );
      }
    }
  });

  await cas("les deux mots qui mentiraient sont changés", async () => {
    const ecran = await page.locator("body").innerText();
    // « Nouveau » au-dessus d'un chantier ouvert il y a trois jours fait douter
    // d'avoir cliqué au bon endroit ; « Créer le chantier » ne créerait rien.
    if (/\bNOUVEAU\b/.test(ecran)) {
      throw new Error("l'écran dit encore « Nouveau » sur un chantier qui existe");
    }
    const bouton = page.locator('[data-atlas="action-creation"]');
    const dit = (await bouton.innerText()).replace(/\s+/g, " ").trim();
    if (/Créer le chantier/i.test(dit)) {
      throw new Error(`le bouton dit « ${dit} » : il ne créerait rien`);
    }
    if (!/Enregistrer/i.test(dit)) throw new Error(`le bouton dit « ${dit} » au lieu d'enregistrer`);
  });

  const CLIENT = `Martins ${Date.now()}`;
  await cas("ce qu'il saisit tient, et le NOM DU CHANTIER suit", async () => {
    await page.locator('input[placeholder="Bernard"]').fill(CLIENT);
    await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
    await page.locator('input[placeholder="12 rue des Lilas, Nantes"]').fill("10 rue des Lilas, Nantes");
    await page.getByRole("button", { name: /Enregistrer/ }).click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}$`), { timeout: 30_000 });

    // **Le nom recalculé est ce qui fait disparaître la ligne fautive.** Sans
    // lui, la base porterait le bon client et l'accueil dirait encore
    // « Chantier du … » : le défaut corrigé partout sauf là où il l'a vu.
    const { rows } = await pool.query(
      `SELECT c.nom, c.adresse_chantier AS adresse, cl.nom AS client, cl.telephone
         FROM chantiers c LEFT JOIN clients cl ON cl.id = c.client_id
        WHERE c.id = $1`,
      [chantierId]
    );
    if (rows.length !== 1) throw new Error("le chantier a disparu de la base");
    if (rows[0].client !== CLIENT) throw new Error(`client « ${rows[0].client} » au lieu de « ${CLIENT} »`);
    if (rows[0].telephone !== "0679984514") throw new Error(`téléphone « ${rows[0].telephone} »`);
    if (rows[0].adresse !== "10 rue des Lilas, Nantes") {
      throw new Error(`adresse « ${rows[0].adresse ?? "vide"} »`);
    }
    if (!rows[0].nom.includes(CLIENT)) {
      throw new Error(`le chantier s'appelle encore « ${rows[0].nom} » : le nom n'a pas suivi`);
    }
  });

  await cas("et la mention a disparu de l'accueil — plus rien à compléter", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    if ((await ligne.count()) !== 0) {
      throw new Error("la mention est toujours là alors que le client est renseigné");
    }
    const ecran = await page.locator("body").innerText();
    if (!ecran.includes("10 rue des Lilas")) {
      throw new Error("l'adresse saisie ne s'affiche pas sous le nom du chantier");
    }
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La mention qui ouvre le chantier — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
