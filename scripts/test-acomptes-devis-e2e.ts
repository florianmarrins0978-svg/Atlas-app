import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

/**
 * L'ACOMPTE SUR LE DEVIS, PAR SON GESTE — sa demande du 12 septembre 2026, la B
 * choisie sur planche (`appli/l-acompte-sur-le-devis.html`).
 *
 * Ce que cette suite éprouve, et qu'aucune suite pure ne peut voir :
 *
 *   · le devis NAÎT avec la ligne d'acompte — *« il doit être marqué
 *     d'office »* — quand ses Réglages en portent un ;
 *   · « + Ajouter un acompte » pose 50 puis 75, cumulés, et l'écran montre ce
 *     qui tombe à chaque fois ;
 *   · le « − » retire la ligne des totaux et la base la perd — mais la phrase
 *     du réglage reste dans les notes, *« quoi qu'il arrive »* ;
 *   · la colonne Unité, après Qté, s'enregistre.
 *
 * Le chiffre de la planche partout : 2 370 € HT, TVA 20 %, 2 844,00 € TTC.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // **Le réglage d'abord** : c'est lui que le devis recopie à sa naissance. Posé
  // en base plutôt que par l'écran des Réglages — cette suite éprouve le devis.
  const { rows: demo } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(demo[0]?.entreprise_id, "le compte de démonstration est absent : la base n'est pas amorcée");
  const entrepriseId: string = demo[0].entreprise_id;
  const { rows: avant } = await pool.query(`SELECT acompte_pourcent FROM entreprises WHERE id = $1`, [entrepriseId]);
  await pool.query(`UPDATE entreprises SET acompte_pourcent = 30 WHERE id = $1`, [entrepriseId]);

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Chausson ${Date.now()}`);
  const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
  const chantierId = url.split("/").pop()!;
  // La création atterrit DÉJÀ sur le devis, dont le rendu crée le brouillon. Le
  // redemander avant la fin de ce rendu lance deux `getOuCreerDevisBrouillon`
  // de front, et le second tombe sur `devis_chantier_version_uk` (TODO.md).
  await page.waitForLoadState("networkidle");

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  const lignesVoulues: [string, string, string, string][] = [
    ["Élagage du platane, taille douce", "1", "", "850"],
    ["Abattage du cerisier mort et dessouchage", "1", "", "1200"],
    ["Évacuation des déchets verts", "4", "m³", "80"],
  ];
  for (const [rang, [libelle, qte, unite, prix]] of lignesVoulues.entries()) {
    await page.click('button:has-text("Ajouter une ligne")');
    const zones = page.locator('textarea[aria-label*="escription"]');
    for (const essai of [1, 2, 3, 4, 5]) {
      if ((await zones.count()) > rang) break;
      await page.waitForTimeout(essai * 300);
    }
    await zones.nth(rang).fill(libelle);
    // **Un clic AVANT de remplir.** Le champ remet le curseur au bout à la
    // première sélection qui suit l'entrée (ChampsDuDevis.tsx, « auBout ») :
    // le tout-sélectionner de fill() est défait, et « 1 » devient « 11 ».
    // Le clic consomme cette première sélection ; fill() a ensuite le champ.
    const saisir = async (etiquette: string, valeur: string) => {
      const champ = page.locator(`input[aria-label*="${etiquette}"]`).nth(rang);
      await champ.click();
      await champ.fill(valeur);
    };
    await saisir("Quantité", qte);
    if (unite) await saisir("Unité", unite);
    await saisir("Prix unitaire", prix);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
  }

  // Les montants s'écrivent avec l'espace fine insécable du français (« 1 990,80 ») :
  // on lit l'écran en espaces ordinaires pour comparer ce qu'un œil compare.
  const lisible = (t: string) => t.replace(/[  ]/g, " ");

  for (const essai of [1, 2, 3, 4]) {
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    if (lisible(await page.locator("body").innerText()).includes("2 844,00")) break;
    await page.waitForTimeout(essai * 500);
  }

  const totaux = () => page.locator("section").filter({ hasText: "Total TTC" }).last();

  /** Attend que la base porte ces taux cumulés, dans l'ordre des rangs. */
  async function quandLaBasePorte(taux: string[]): Promise<string[]> {
    let lus: string[] = [];
    for (const essai of [0, 1, 2, 3, 4, 5]) {
      if (essai > 0) await page.waitForTimeout(essai * 700);
      lus = (
        await pool.query(
          `SELECT a.taux_cumule FROM acomptes_devis a
             JOIN devis d ON d.id = a.devis_id
            WHERE d.chantier_id = $1 ORDER BY d.numero_version DESC, a.rang ASC`,
          [chantierId]
        )
      ).rows.map((r) => r.taux_cumule);
      if (JSON.stringify(lus) === JSON.stringify(taux)) break;
    }
    return lus;
  }

  await cas("le devis naît avec l'acompte des Réglages, d'office, et son montant", async () => {
    const texte = lisible(await totaux().innerText());
    assert.ok(texte.includes("Acompte"), `aucune ligne d'acompte sur un devis dont le réglage en porte un :\n${texte}`);
    assert.ok(texte.includes("853,20"), `30 % de 2 844,00 € font 853,20 € :\n${texte}`);
    assert.ok(texte.includes("Reste à régler après acompte"), "le reste à régler n'est pas nommé");
    assert.ok(texte.includes("1 990,80"), `le reste à régler manque (1 990,80 €) :\n${texte}`);
    assert.deepEqual(await quandLaBasePorte(["30.00"]), ["30.00"], "la base ne porte pas l'acompte d'office");
  });

  await cas("l'unité tapée après la quantité est enregistrée", async () => {
    const { rows } = await pool.query(
      `SELECT unite FROM lignes_prix WHERE chantier_id = $1 AND libelle LIKE 'Évacuation%' LIMIT 1`,
      [chantierId]
    );
    assert.equal(rows[0]?.unite, "m³", `l'unité n'est pas en base : ${JSON.stringify(rows[0])}`);
  });

  await cas("« + Ajouter un acompte » deux fois : 50 puis 75, cumulés, et ce qui tombe", async () => {
    const bouton = page.getByRole("button", { name: /Ajouter un acompte/ });
    assert.equal(await bouton.count(), 1, "le geste manque");
    await bouton.click();
    await page.waitForTimeout(900);
    await bouton.click();
    await page.waitForTimeout(900);

    const texte = lisible(await totaux().innerText());
    for (const attendu of ["à mi-parcours", "568,80", "à l'avancement", "711,00", "Reste à régler après acomptes"]) {
      assert.ok(texte.includes(attendu), `« ${attendu} » manque à l'écran :\n${texte}`);
    }
    assert.deepEqual(await quandLaBasePorte(["30.00", "50.00", "75.00"]), ["30.00", "50.00", "75.00"]);
    assert.equal(await bouton.count(), 0, "un quatrième acompte est proposé : il n'y a pas de mot pour lui");
  });

  await cas("un taux tapé sous le précédent remonte ; le reste n'est jamais négatif", async () => {
    const champs = page.locator('input[data-atlas="taux-acompte"]');
    await champs.nth(2).fill("40");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(900);
    const texte = lisible(await totaux().innerText());
    // Un signe devant un chiffre — pas le trait d'union de « mi-parcours ».
    assert.ok(!/[-−]\s?\d/.test(texte), `un montant négatif à l'écran :\n${texte}`);
    assert.deepEqual(await quandLaBasePorte(["30.00", "50.00", "50.00"]), ["30.00", "50.00", "50.00"]);
  });

  await cas("le − retire la ligne ; la phrase des Réglages reste dans les notes", async () => {
    // Trois « − » ; on retire tout, du dernier au premier.
    for (let i = 0; i < 3; i++) {
      await page.locator('button[data-atlas="retirer-acompte"]').last().click();
      await page.waitForTimeout(700);
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const texte = lisible(await totaux().innerText());
    assert.ok(!texte.includes("Reste à régler"), `la ligne survit à son retrait :\n${texte}`);
    assert.deepEqual(await quandLaBasePorte([]), [], "la base garde un acompte que l'écran dit retiré");
    // La condition, elle, reste écrite sous les notes — comme le PDF l'écrira.
    const notes = lisible(await page.locator('[data-atlas="conditions-imprimees"]').innerText());
    assert.ok(notes.includes("Acompte de 30 % à la commande"), `la phrase du réglage a disparu des notes :
${notes}`);
  });

  // Le réglage revient à ce qu'il était : cette suite ne laisse rien derrière elle.
  await pool.query(`UPDATE entreprises SET acompte_pourcent = $2 WHERE id = $1`, [entrepriseId, avant[0]?.acompte_pourcent ?? null]);

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} L'acompte sur le devis — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
