import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

/**
 * UNE LIGNE DU DEVIS PARTAIT QUAND IL TOUCHAIT SES CHIFFRES — sa plainte du
 * 3 octobre 2026 : *« plusieurs fois une ligne s'est supprimée sans que je
 * sache pourquoi ; je crois que c'est lorsque je clique sur la quantité quand
 * aucun prix n'est inscrit »*.
 *
 * **Le mécanisme, mesuré.** Chaque ligne du devis vit dans une colonne qui
 * défile de côté (`LigneRetirable`) pour découvrir « Retirer ». Ce bouton fait
 * 92 px de large et TOUTE la hauteur de la ligne, à droite : exactement là où
 * s'alignent la quantité, l'unité et le prix. Une ligne entrouverte, et le
 * doigt posé sur le prix touche « Retirer » ; la ligne tombe, et le tiroir qui
 * dit « Retiré à l'instant » s'affiche sous la ligne, loin sous le clavier.
 *
 * **Ce qui l'entrouvre sans qu'il glisse.** Sur iPhone, entrer dans un champ
 * fait défiler ses conteneurs pour montrer le curseur — et la colonne de la
 * ligne en est un. D'où son enchaînement : la quantité, puis le prix vide juste
 * dessous, et c'est « Retirer » que le second appui rencontre. Sur une ligne
 * déjà chiffrée, il ne touche pas le prix après la quantité : rien ne part.
 *
 * Chromium ne fait pas ce défilement de lui-même : la suite le pose à la main,
 * comme Safari, pendant que le champ a le doigt. Ce qu'elle défend : **tant
 * qu'il écrit dans une ligne, la ligne ne s'ouvre pas** — et le geste de
 * retrait, lui, reste entier quand il n'écrit rien.
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
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON, hasTouch: true });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `M. Lolo ${Date.now()}`);
  const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
  const chantierId = url.split("/").pop()!;
  await page.waitForLoadState("networkidle");
  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

  // Sa ligne de la capture : une tonte, une quantité, AUCUN prix.
  await page.locator('textarea[aria-label="Description 1"]').fill("Tonte de pelouse");
  const quantite = page.getByLabel("Quantité 1", { exact: true });
  await quantite.click();
  await quantite.fill("500");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(800);
  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

  const colonne = page.locator(".atlas-glisse").filter({ has: page.getByLabel("Quantité 1", { exact: true }) });
  const decalage = () => colonne.evaluate((g) => g.scrollLeft);
  /** Ce que Safari fait en entrant dans le champ : il pousse la colonne pour montrer le curseur. */
  const pousserCommeSafari = () =>
    colonne.evaluate((g) => {
      g.scrollLeft = g.scrollWidth;
    });

  // **Là où il VOIT le prix avant de toucher la quantité** : c'est ce point que
  // son doigt vise ensuite, que la ligne ait bougé dessous ou non. Mesurer le
  // champ après coup suivrait la ligne, et passerait au vert sur le défaut.
  const prix = page.getByLabel("Prix unitaire 1", { exact: true });
  // Mesuré par rapport à l'enveloppe de la ligne, qui ne glisse pas : la page,
  // elle, peut défiler quand le clavier s'ouvre.
  const ecart = await prix.evaluate((champ) => {
    const r = champ.getBoundingClientRect();
    const e = champ.closest(".atlas-ligne")!.getBoundingClientRect();
    return { dx: r.left + r.width / 2 - e.left, dy: r.top + r.height / 2 - e.top, largeur: r.width };
  });
  const pointVise = () =>
    prix.evaluate((champ, ec) => {
      const e = champ.closest(".atlas-ligne")!.getBoundingClientRect();
      return { x: e.left + ec.dx, y: e.top + ec.dy };
    }, ecart);

  await cas("toucher la quantité ne découvre pas « Retirer »", async () => {
    await page.getByLabel("Quantité 1", { exact: true }).tap();
    await pousserCommeSafari();
    await page.waitForTimeout(600);
    assert.equal(await decalage(), 0, "la ligne s'est ouverte pendant qu'il écrivait dans sa quantité");
  });

  await cas("le doigt posé ensuite sur le prix vide tombe sur le prix, pas sur « Retirer »", async () => {
    assert.ok(ecart.largeur > 0, "le champ du prix ne se mesure pas : rien à conclure");
    const { x, y } = await pointVise();
    const touche = await page.evaluate(
      ([x, y]) => (document.elementFromPoint(x, y) as HTMLElement | null)?.getAttribute("aria-label") ?? "rien",
      [x, y]
    );
    assert.equal(touche, "Prix unitaire 1", `sous son doigt : ${touche}`);
    await page.touchscreen.tap(x, y);
    await prix.fill("25");
    await page.keyboard.press("Tab");
    // Au-delà des six secondes du tiroir : un retrait aurait le temps de s'écrire.
    await page.waitForTimeout(7000);
    const { rows } = await pool.query(`SELECT prix_unitaire FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
    assert.equal(rows.length, 1, "la ligne a disparu de la base");
    assert.equal(Number(rows[0].prix_unitaire), 25, `le prix n'est pas celui tapé : ${rows[0].prix_unitaire}`);
  });

  await cas("sans champ sous le doigt, la ligne glisse toujours jusqu'à « Retirer »", async () => {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await pousserCommeSafari();
    await page.waitForTimeout(600);
    assert.ok((await decalage()) > 0, "le geste de retrait ne s'ouvre plus du tout");
    assert.equal(
      await page.getByRole("button", { name: "Retirer « Tonte de pelouse »" }).isVisible(),
      true,
      "« Retirer » n'est pas découvert"
    );
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La saisie ne retire pas la ligne — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
