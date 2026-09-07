import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Client } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// SON GESTE, DANS UN VRAI NAVIGATEUR : taper un prix avec SA virgule.
//
// ═══════════════════════════════════════════════════════════════════════════
// **POURQUOI CETTE SUITE EXISTE EN PLUS DE LA SUITE PURE.**
//
// `test-case-du-prix.ts` éprouve les fonctions, et elles étaient déjà justes
// AVANT ce lot : `montantEcrivable` lisait « 1 400,50 » depuis le 29 août. Le
// défaut ne vivait pas là — il vivait dans l'écran, qui ne les employait pas.
// Un contrôle qui entre par une porte de service ne dit rien de la porte
// d'entrée, et c'est celle-là qui peut être fermée (`CLAUDE.md` §5 quater).
//
// Ce que celle-ci rejoue est donc le geste, et rien d'autre : il ouvre l'écran
// des prix, il ajoute une ligne, il tape **1 400,50** comme son clavier
// français l'écrit, il quitte la case. Et l'on va voir **en base** ce qui y est
// arrivé — pas à l'écran, qui affichait justement le bon chiffre pendant que
// zéro partait.
//
// **La preuve est en base, jamais à l'écran** : c'est tout le défaut. Un écran
// qui montre « 1 400,50 » alors que la colonne porte `0.00` est exactement ce
// que le patron ne pouvait pas voir.
// ═══════════════════════════════════════════════════════════════════════════

const BASE = process.env.ATLAS_BASE_URL ?? "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const nom = `Chantier virgule e2e ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  // Elle rend l'identifiant et laisse le devis ouvert : on va à l'écran des
  // prix par son adresse, comme les quatre-vingts autres suites.
  const chantierId = await creerPuisFiche(page);

  await page.goto(`${BASE}/chantiers/${chantierId}/prix?saisie=manuelle`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");

  const libelle = page.getByLabel("Description de la ligne").first();
  await libelle.waitFor({ state: "visible", timeout: 15_000 });
  await libelle.fill("Dessouchage");
  await libelle.blur();

  // ─── LE GESTE ────────────────────────────────────────────────────────────
  // Sa virgule, son espace des milliers. C'est ce que rend le pavé de chiffres
  // d'un téléphone français, et c'est ce que l'ancien champ jetait.
  const montant = page.getByLabel("Montant de la ligne, en euros").first();
  await montant.fill("1 400,50");
  await montant.blur();

  // On attend que l'écriture soit partie, sans parier sur une durée : une pause
  // fixe est un pari sur la charge de la machine, et ce pari se reperd à chaque
  // suite ajoutée à la batterie (`test-devis-doublon-e2e.ts`, 27 août 2026).
  const lecteur = new Client({ connectionString: process.env.DATABASE_URL });
  await lecteur.connect();
  let lu: string[] = [];
  try {
    // **Le contexte d'entreprise, sinon la RLS rend zéro ligne** — et le
    // contrôle mesurerait zéro, ce qui est pire qu'absent (`CLAUDE.md` §5).
    const { rows: ent } = await lecteur.query(
      `SELECT entreprise_id FROM chantiers WHERE id = $1`,
      [chantierId]
    );
    assert.ok(ent[0], "le chantier d'essai n'existe pas : la suite ne mesure rien");
    await lecteur.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ent[0].entreprise_id]);

    const finAttente = Date.now() + 20_000;
    do {
      const { rows } = await lecteur.query(
        `SELECT montant FROM lignes_prix WHERE chantier_id = $1 ORDER BY created_at`,
        [chantierId]
      );
      lu = rows.map((r) => String(r.montant));
      if (lu.some((m) => Number(m) === 1400.5)) break;
      await new Promise((r) => setTimeout(r, 500));
    } while (Date.now() < finAttente);

    assert.ok(
      lu.some((m) => Number(m) === 1400.5),
      `sa virgule n'est pas arrivée en base — lu : ${JSON.stringify(lu)}. ` +
        "C'est le défaut du 5 septembre : la case avale la virgule, et le zéro part sans un mot."
    );
  } finally {
    await lecteur.end();
  }

  // ─── ET L'ÉCRAN NE LE CONTREDIT PAS ──────────────────────────────────────
  // Le total est le premier montant en euros de la page. Deux chiffres qui se
  // contredisent dans le même écran, c'est toute la liste qu'on cesse de croire.
  await page.reload({ waitUntil: "networkidle" });
  const total = await page.locator("p").filter({ hasText: /€/ }).first().innerText();
  assert.match(
    total.replace(/ | /g, " "),
    /1 400,50/,
    `le total affiche « ${total} » alors que la base porte 1400.50`
  );

  await navigateur.close();
  console.log("✅ La case du prix garde sa virgule, et la base la reçoit.");
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
