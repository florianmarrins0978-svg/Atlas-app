import assert from "node:assert";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";

// Le parcours du patron sur l'écran « Catalogue », arrangement B (17 août 2026).
//
// **Pourquoi une suite navigateur EN PLUS de la suite base.** La suite base
// (`test-mots-catalogue.ts`) prouve l'isolation, les refus et la recherche —
// tout ce qui ne se voit pas. Elle ne prouve rien de ce qu'il a réellement
// signalé : *« On peut rien modifier rajouter »*. Ce qu'il faut éprouver ici,
// c'est le GESTE : ouvrir l'écran depuis les réglages, poser un mot, le
// retrouver après rechargement, et repartir par la flèche.
//
// **La flèche de retour est un cas à elle seule.** Elle manquait depuis le
// 14 août, sortie d'une de ses captures et d'aucun test. Rien ne l'aurait
// rattrapée : la page compilait, l'écran s'affichait, et il ne pouvait pas
// revenir.
//
// **Il sait échouer** : retirer `retour` de l'en-tête rend le cas de la flèche
// rouge ; ignorer le mot ajouté dans le rendu rend le cas de la persistance
// rouge, en disant ce qu'il attendait et ce qu'il a vu.

const RACINE = "http://localhost:3000";
const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto(`${RACINE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${RACINE}/`, { timeout: 10000 });

  // Son chemin, pas une adresse tapée : on y arrive par « Tarifs & catalogue ».
  await page.goto(`${RACINE}/reglages/tarifs`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Le catalogue/ }).click();
  await page.getByRole("heading", { name: "Catalogue" }).waitFor({ timeout: 15000 });

  // --- 1. Le mot du jargon a disparu de l'écran -----------------------------
  const texte = await page.locator("body").innerText();
  assert.ok(
    !/Synonymes|Variantes/.test(texte),
    "« Synonymes » et « Variantes » disaient la même chose : l'écran n'en garde qu'un, « Aussi appelé »."
  );
  assert.ok(
    !/prix encore constat/i.test(texte),
    "« Aucun prix encore constaté » lisait une mémoire jamais écrite : cette phrase ne devait jamais revenir."
  );

  // --- 2. Poser un mot, et le retrouver après rechargement -------------------
  const mot = `motessai${Date.now()}`;
  await page.getByRole("button", { name: "+ mon mot" }).first().click();
  await page.locator('input[placeholder*="Comme vous le dites"]').first().fill(mot);
  await page.getByRole("button", { name: "Ajouter" }).first().click();

  await page.getByText(mot, { exact: false }).first().waitFor({ timeout: 15000 });
  mkdirSync(CAPTURES, { recursive: true });
  await page.screenshot({ path: `${CAPTURES}/catalogue-mes-mots.png` });

  await page.reload({ waitUntil: "networkidle" });
  const apres = await page.locator("body").innerText();
  assert.ok(
    apres.includes(mot),
    `Le mot « ${mot} » a disparu au rechargement : il n'a pas été enregistré.`
  );
  assert.ok(
    /· vous/.test(apres),
    "Ses mots doivent être marqués « vous » : sans la marque, il croit corriger le vocabulaire commun."
  );

  // --- 3. Le retirer ---------------------------------------------------------
  await page.getByRole("button", { name: `Retirer le mot « ${mot} »` }).click();
  await page.waitForFunction(
    (m) => !document.body.innerText.includes(m as string),
    mot,
    { timeout: 15000 }
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    !(await page.locator("body").innerText()).includes(mot),
    `Le mot « ${mot} » est revenu au rechargement : le retrait n'a pas pris.`
  );

  // --- 4. Ce qu'Atlas a entendu : il propose, il n'écrit pas ------------------
  //
  // **Sa demande du 17 août** : *« ça s'autoalimente à chaque fois qu'on rajoute
  // un nouveau mot dans un devis et qu'il comprend ce que c'est ? »*. Le mot est
  // unique à chaque exécution : sans cela, la deuxième passe ne proposerait plus
  // rien — le mot serait déjà retenu — et le contrôle passerait au vert sans
  // avoir rien éprouvé.
  //
  // **Que des LETTRES, et c'est le contrôle lui-même qui l'a appris** : les
  // chiffres sont retirés des dictées avant le rapprochement — « 450 » n'apprend
  // aucun vocabulaire —, si bien qu'un mot d'essai horodaté « motessai1786… »
  // arrivait à l'écran amputé de ses chiffres et n'était jamais retrouvé.
  const entendu = `ecimatest${Date.now()
    .toString()
    .split("")
    .map((d) => "abcdefghij"[Number(d)])
    .join("")}`;
  const base = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: comptes } = await base.query(
      `SELECT m.entreprise_id FROM membres_entreprise m
         JOIN users u ON u.id = m.utilisateur_id
        WHERE u.email = 'demo@atlas.local' LIMIT 1`
    );
    assert.ok(comptes[0], "le compte de démonstration n'a aucune entreprise : le jeu de démo manque.");
    const entrepriseId = comptes[0].entreprise_id;

    const { rows: chantiers } = await base.query(
      `SELECT id FROM chantiers WHERE entreprise_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [entrepriseId]
    );
    assert.ok(chantiers[0], "aucun chantier de démonstration : rien à quoi rattacher une dictée.");

    // Une dictée qu'Atlas a lue, et une ligne retenue que le catalogue reconnaît.
    const r = await base.query(
      `INSERT INTO corrections_dictee (entreprise_id, chantier_id, dictee, propose, retenu)
       VALUES ($1, $2, $3, $4::jsonb, $4::jsonb)
       ON CONFLICT (chantier_id) DO UPDATE
         SET dictee = EXCLUDED.dictee, propose = EXCLUDED.propose,
             retenu = EXCLUDED.retenu, updated_at = now()`,
      [
        entrepriseId,
        chantiers[0].id,
        `il faudra ${entendu} le grand tilleul du fond`,
        JSON.stringify([{ libelle: "Élagage", montant: "450.00" }]),
      ]
    );
    assert.equal(r.rowCount, 1, "la dictée d'essai n'a pas été écrite : le contrôle n'éprouverait rien.");

    await page.reload({ waitUntil: "networkidle" });
    const avecProposition = await page.locator("body").innerText();
    assert.ok(
      // **Insensible à la casse, et ce n'est pas une coquetterie** : le titre
      // est mis en capitales par la charte (`libelleCaps`), et `innerText` rend
      // le texte TRANSFORMÉ. Cherché tel qu'il est écrit dans le code, il ne se
      // trouve jamais — le contrôle accusait le produit d'un tort qui était le
      // sien.
      /atlas a entendu ces mots/i.test(avecProposition) && avecProposition.includes(entendu),
      // **Le message montre l'écran.** Sans lui, un rouge ici n'apprend rien :
      // on ne sait pas si Atlas n'a rien proposé, s'il a proposé autre chose,
      // ou si la page n'est même pas celle du catalogue.
      `Atlas n'a rien proposé pour « ${entendu} », alors que la dictée le porte et que la ligne retenue ` +
        `est un élagage. L'écran dit : ${JSON.stringify(avecProposition.slice(0, 400))}`
    );
    assert.ok(
      /Le retenir comme un mot pour/.test(avecProposition),
      "la proposition ne dit pas à QUOI le mot serait rattaché : il ne peut pas trancher."
    );

    // Le bouton de NOTRE proposition, pas le premier venu : d'autres mots de la
    // même dictée peuvent être proposés au-dessus, et retenir « grand » à la
    // place ne prouverait rien.
    const carteProposee = page.locator("li", { hasText: `« ${entendu} »` });
    await carteProposee.getByRole("button", { name: "Oui, retenir" }).click();
    // **Attendre la disparition de la PROPOSITION, pas de la section.** Les
    // autres mots de la dictée restent proposés : attendre la section entière
    // était une condition qui ne pouvait pas se réaliser, et le contrôle
    // rougissait sur un délai dépassé au lieu de dire ce qui n'allait pas.
    await page.waitForFunction(
      (m) => !document.body.innerText.includes(`« ${m as string} »`),
      entendu,
      { timeout: 15000 }
    );

    await page.reload({ waitUntil: "networkidle" });
    const apresRetenu = await page.locator("body").innerText();
    assert.ok(
      apresRetenu.includes(entendu),
      "le mot retenu doit rejoindre sa carte, en doré, sous l'entrée d'Atlas."
    );

    // On repart d'un écran propre : le mot d'essai n'a rien à faire dans son
    // catalogue, et une suite qui laisse ses déchets fausse la suivante.
    await base.query(`DELETE FROM mots_catalogue WHERE entreprise_id = $1 AND mot = $2`, [entrepriseId, entendu]);
  } finally {
    await base.end();
  }

  // --- 5. La flèche de retour, le défaut du 14 août --------------------------
  const retour = page.getByRole("link", { name: "Retour aux tarifs" });
  assert.equal(
    await retour.count(),
    1,
    "Aucune flèche de retour sur le catalogue : on y arrive depuis « Tarifs & catalogue » et on n'en repartait que par la barre du bas."
  );
  await retour.click();
  await page.getByRole("heading", { name: "Tarifs & catalogue" }).waitFor({ timeout: 15000 });

  console.log("✅ Catalogue — ses mots se posent, Atlas en propose, tout se retire, et la flèche ramène.");
  await browser.close();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
