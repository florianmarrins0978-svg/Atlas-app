import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

/**
 * MODIFIER UN CLIENT DEPUIS SA FICHE — son geste, de bout en bout.
 *
 * **Sa demande du 14 septembre 2026 :** *« je veux pouvoir modifier un client
 * si par exemple il change d'adresse ou de numéro »*, puis sa réponse devant
 * les trois places : *« la A »*.
 *
 * **CE QUE CETTE SUITE ÉPROUVE, ET POURQUOI PAR LÀ.** Le dépôt a déjà payé
 * d'avoir éprouvé des gestes par une porte de service : six d'entre eux
 * étaient écrits, verts et INATTEIGNABLES (`CLAUDE.md` §5 quater). On entre
 * donc par où le patron entre — sa fiche —, on touche la porte, on corrige, on
 * enregistre, et l'on vérifie **en base**, pas à l'écran : un libellé se
 * remanie, une ligne de la table `clients` non.
 *
 * **Et ce qui NE doit pas bouger** : l'adresse du chantier. C'est tout l'objet
 * de cet écran séparé — sur la fiche client d'un chantier, le client reprend
 * l'adresse des travaux, et corriger l'une changeait l'autre sans le dire.
 */
const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
async function cas(nom: string, f: () => Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Modifier un client depuis sa fiche ===\n");

  // Un client à nous, avec un chantier : c'est la scène où le piège vit.
  const marque = `Costa ${Date.now()}`;
  const { rows: ctxRows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me
      ORDER BY me.role = 'proprietaire' DESC
      LIMIT 1`
  );
  assert.ok(ctxRows[0], "aucune entreprise dans la base : rien à éprouver");
  const entrepriseId = ctxRows[0].e as string;

  const { rows: cree } = await pool.query(
    `INSERT INTO clients (entreprise_id, nom, civilite, telephone, email, adresse)
     VALUES ($1, $2, 'mme', '0612345678', 'costa@exemple.fr', '1 rue d''Avant, Nantes')
     RETURNING id`,
    [entrepriseId, marque]
  );
  const clientId = cree[0].id as string;

  const { rows: chantier } = await pool.query(
    `INSERT INTO chantiers (entreprise_id, client_id, nom, adresse_chantier)
     VALUES ($1, $2, $3, 'Le jardin du chantier, Nantes')
     RETURNING id`,
    [entrepriseId, clientId, `Chez ${marque}`]
  );
  const chantierId = chantier[0].id as string;

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  if (page.url().includes("documents-legaux")) {
    await page.getByRole("button", { name: /Continuer|accepte/i }).first().click();
    await page.waitForTimeout(2000);
  }
  assert.ok(!page.url().includes("/login"), "la connexion a échoué : rien de ce qui suit n'a de sens");

  await cas("sa fiche porte la porte, et elle se touche au pouce", async () => {
    await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "domcontentloaded" });
    const porte = page.locator('[data-atlas="modifier-le-client"]');
    await porte.waitFor({ state: "visible", timeout: 20_000 });
    const boite = await porte.boundingBox();
    assert.ok(boite && boite.height >= 44, `la porte fait ${Math.round(boite?.height ?? 0)} px, sous les 44 px du pouce`);
  });

  await cas("elle ouvre SES coordonnées — rien du chantier", async () => {
    await page.locator('[data-atlas="modifier-le-client"]').click();
    await page.waitForURL(new RegExp(`/clients/${clientId}/coordonnees`), { timeout: 20_000 });
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Ses coordonnées/, "l'écran ne s'annonce pas");
    // Ce que cet écran n'a PAS, et c'est sa raison d'être.
    assert.doesNotMatch(texte, /Le jardin du chantier/, "l'adresse du chantier est sur cet écran");
    assert.doesNotMatch(texte, /Appuyez et décrivez/, "le micro du chantier est sur cet écran");
  });

  await cas("il corrige l'adresse et le numéro, et c'est enregistré", async () => {
    await page.getByLabel("Téléphone", { exact: true }).fill("0700000042");
    await page.getByLabel(/Son adresse/i).fill("9 rue d'Après, Nantes");
    await page.getByRole("button", { name: /Enregistrer/ }).click();
    await page.waitForURL(new RegExp(`/clients/${clientId}$`), { timeout: 30_000 });

    // **La preuve est en base.** Un écran peut afficher ce qu'il vient de
    // recevoir sans que rien n'ait été écrit (`CLAUDE.md` §5 bis).
    const { rows } = await pool.query(
      "select telephone, adresse, nom from clients where id = $1",
      [clientId]
    );
    assert.equal(rows[0].telephone, "0700000042", `le numéro en base vaut « ${rows[0].telephone} »`);
    assert.match(String(rows[0].adresse), /9 rue d'Après/, `l'adresse en base vaut « ${rows[0].adresse} »`);
    assert.match(String(rows[0].nom), new RegExp(marque.split(" ")[1]), "le nom a été perdu en chemin");
  });

  await cas("l'adresse du CHANTIER n'a pas bougé", async () => {
    const { rows } = await pool.query(
      "select adresse_chantier from chantiers where id = $1",
      [chantierId]
    );
    assert.equal(
      rows[0].adresse_chantier,
      "Le jardin du chantier, Nantes",
      "corriger le client a déplacé le chantier : c'est le piège que cet écran existe pour éviter"
    );
  });

  await cas("et sa fiche montre la correction", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(texte, /9 rue d'Après/, "la fiche montre encore l'ancienne adresse");
    assert.match(texte, /07 00 00 00 42/, "la fiche montre encore l'ancien numéro");
  });

  await navigateur.close();
  await pool.query("delete from chantiers where id = $1", [chantierId]);
  await pool.query("delete from clients where id = $1", [clientId]);
  await pool.end();

  console.log(
    echecs === 0
      ? "\n✅ Modifier un client — 0 échec(s).\n"
      : `\n❌ Modifier un client — ${echecs} échec(s).\n`
  );
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
