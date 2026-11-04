import assert from "node:assert";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// LE DÉTAIL SOUS LA LIGNE, PAR SON GESTE — sa planche du 4 novembre 2026
// (`appli/soignee/devis-detail-ligne.html`) : *« si je me mets devant le mot
// suppression et que j'appuie sur la flèche supprimer, que ça me mette
// suppression sur la même ligne que frêne »*, et Entrée le renvoie dessous,
// au téléphone comme à l'ordinateur.
//
// La règle est éprouvée sans navigateur (`test-detail-de-la-ligne.ts`) ; ce que
// cette suite tient, c'est le CHAMP du devis : qu'il garde le retour à la
// ligne, qu'il remette l'espace en effaçant, et que la ligne enregistrée soit
// celle qu'il voit.

const BASE = ADRESSE;
const NOM = "Élagage d'un frêne";
const DETAIL = "Suppression du bois mort, allègement.";

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

async function libelleEnBase(chantierId: string, attendu: string): Promise<string | null> {
  // Attendre l'état, jamais un délai fixe (`CLAUDE.md` §5).
  let dernier: string | null = null;
  for (let i = 0; i < 40; i++) {
    const { rows } = await pool.query("SELECT libelle FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre LIMIT 1", [chantierId]);
    dernier = rows[0]?.libelle ?? null;
    if (dernier === attendu) return dernier;
    await new Promise((r) => setTimeout(r, 250));
  }
  return dernier;
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Frêne ${Date.now().toString().slice(-6)}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  const champ = page.getByLabel("Description 1");

  await cas("Entrée envoie le détail sous le nom, et la ligne s'enregistre ainsi", async () => {
    await champ.click();
    await champ.fill("");
    await page.keyboard.type(NOM);
    await page.keyboard.press("Enter");
    await page.keyboard.type(DETAIL);
    await page.getByLabel("Prix unitaire 1").click();
    assert.equal(await libelleEnBase(chantierId, `${NOM}\n${DETAIL}`), `${NOM}\n${DETAIL}`);
  });

  await cas("effacer devant le détail le remonte sur la ligne du nom, avec un espace", async () => {
    await champ.click();
    // Le curseur devant le détail, au début de la seconde ligne.
    await champ.evaluate((el: HTMLTextAreaElement) => {
      const i = el.value.indexOf("\n") + 1;
      el.setSelectionRange(i, i);
    });
    await page.keyboard.press("Backspace");
    assert.equal(await champ.inputValue(), `${NOM} ${DETAIL}`);
    // Le curseur reste là où il était : on peut taper juste après le nom.
    const curseur = await champ.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    assert.equal(curseur, NOM.length + 1, "le curseur est parti au bout du texte");
    await page.getByLabel("Prix unitaire 1").click();
    assert.equal(await libelleEnBase(chantierId, `${NOM} ${DETAIL}`), `${NOM} ${DETAIL}`);
  });

  await cas("une lettre effacée reste un effacement ordinaire", async () => {
    await champ.click();
    // Au bout du TEXTE : « Fin » mènerait au bout de la ligne affichée, et sur
    // un téléphone le texte en occupe deux.
    await champ.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
    await page.keyboard.press("Backspace");
    assert.equal(await champ.inputValue(), `${NOM} ${DETAIL.slice(0, -1)}`);
  });

  await navigateur.close();
  await pool.end();
  if (echecs > 0) {
    console.log(`\n✗ ${echecs} échec(s)`);
    process.exit(1);
  }
  console.log("\n✅ Le détail se pose sous la ligne et remonte d'un effacement, sur le vrai devis.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
