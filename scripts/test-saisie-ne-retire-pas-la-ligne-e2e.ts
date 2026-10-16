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
 * **Le glissement a été RETIRÉ du devis le 16 octobre 2026**, sa demande :
 * *« il faut totalement retirer le slide pour supprimer une ligne pour le
 * devis »*. La ligne ne défile plus : rien ne peut s'entrouvrir sous ses
 * chiffres. Seule la croix retire, et elle a quitté le bord du texte, où son
 * doigt la rencontrait en voulant retoucher une description (*« il arrive
 * encore fréquemment qu'on appuie sur la petite croix sans faire exprès »*).
 * Elle se tient au-dessus de la colonne des chiffres, montée au haut de la
 * ligne, sa réponse « D » (`appli/devis-croix-plus-a-droite.html`) : 8 px la
 * séparaient du texte, 18 aujourd'hui.
 *
 * Ce que la suite défend : **aucune colonne qui glisse sur une ligne du
 * devis**, la croix assez loin du texte et entière (une zone coupée par
 * l'enveloppe ne se touche plus), le doigt posé sur le prix tombe sur le
 * prix, et la croix retire toujours, avec « Annuler ».
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

  await cas("la ligne du devis ne glisse plus", async () => {
    const ligne = page.locator(".atlas-ligne").filter({ has: page.getByLabel("Quantité 1", { exact: true }) });
    assert.equal(await ligne.count(), 1, "la ligne du devis est introuvable : rien à conclure");
    assert.equal(await ligne.locator(".atlas-glisse").count(), 0, "la ligne porte encore une colonne qui glisse");
    assert.equal(await ligne.locator(".atlas-decouvre").count(), 0, "« Retirer » est encore caché derrière la ligne");
  });

  await cas("la croix se tient loin du texte, entière et au haut de la ligne", async () => {
    const m = await page.locator('[data-atlas="croix-ligne"]').evaluate((b) => {
      // `elementFromPoint` ne voit que l'écran : hors de lui, il ne rend rien.
      b.scrollIntoView({ block: "center" });
      const c = b.getBoundingClientRect();
      const t = b.closest(".atlas-ligne")!.querySelector("textarea")!.getBoundingClientRect();
      const e = b.closest(".atlas-ligne")!.getBoundingClientRect();
      const dessous = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
      return {
        largeur: c.width,
        ecart: c.left - t.right,
        dedans: c.left >= e.left && c.right <= e.right && c.top >= e.top,
        auHaut: c.top < t.top,
        touchee: !!dessous && b.contains(dessous),
      };
    });
    assert.ok(m.largeur > 0, "la croix ne se mesure pas : rien à conclure");
    assert.ok(m.ecart >= 16, `la croix est à ${m.ecart} px du texte (8 avant le 16 octobre)`);
    assert.ok(m.dedans, "l'enveloppe de la ligne coupe la croix : sa zone ne se touche plus en entier");
    assert.ok(m.auHaut, "la croix n'est pas montée au-dessus du texte");
    assert.ok(m.touchee, "le centre de la croix ne tombe pas sur elle");
  });

  await cas("après la quantité, le doigt posé sur le prix vide tombe sur le prix", async () => {
    // Son enchaînement : la quantité d'abord, puis le prix vide juste dessous.
    await page.getByLabel("Quantité 1", { exact: true }).tap();
    await page.waitForTimeout(600);
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

  await cas("la croix retire la ligne, et « Annuler » la rend", async () => {
    const croix = page.locator('[data-atlas="croix-ligne"]');
    assert.equal(await croix.count(), 1, "pas de croix sur la ligne");
    await croix.tap();
    await page.waitForTimeout(600);
    // La ligne se replie à hauteur zéro : ses champs gardent une boîte, et
    // `isVisible` les dirait encore là. C'est l'état de la ligne qui se lit.
    const etat = () => croix.evaluate((b) => b.closest(".atlas-ligne")?.getAttribute("data-retiree"));
    assert.equal(await etat(), "oui", "la ligne est toujours là");
    await page.getByRole("button", { name: /^Annuler/i }).tap();
    await page.waitForTimeout(7000);
    const { rows } = await pool.query(`SELECT 1 FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
    assert.equal(rows.length, 1, "« Annuler » n'a pas rendu la ligne");
    assert.equal(await etat(), "non", "la ligne n'est pas revenue à l'écran");
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
