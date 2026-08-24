// L'ALLURE DE SES DEVIS, DE L'ÉCRAN JUSQU'AU PDF QUE SON CLIENT TÉLÉCHARGE.
//
// **Sa demande du 23 août 2026 :** *« il faudrait que l'utilisateur puisse avoir
// un endroit dédié à la modification de son devis. S'il veut rajouter son logo,
// changer la typographie, changer le fond de page. »* Puis ses bornes : **B**
// (dans « Devis & factures »), **juste pour devis et facture**, *« une
// dizaine »* de typographies, et *« les réglages actuels doivent être par
// défaut »*.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VERRAIT.**
// `test-allure-documents.ts` éprouve la règle sans base, `test-allure-pdf.ts`
// éprouve le document sans écran, `test-allure-documents-db.ts` éprouve les
// colonnes sans navigateur. Chacune resterait verte si l'écran n'enregistrait
// rien. C'est le FIL qui compte : il choisit, et son devis change.
//
// **Et surtout : l'écran ne doit pas MENTIR.** Le 24 août, il proposait neuf
// typographies qu'aucune n'était chargée — « Playfair Display » s'affichait en
// Georgia. Vu à la capture, jamais par un test ; d'où le contrôle de largeur
// plus bas, qui compare la même phrase dans deux polices.
//
// Usage : npm run test:e2e -- --seulement allure-de-mes-devis
import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
const cas = async (nom: string, verifier: () => Promise<void>) => {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
};

/** Attend que la BASE porte la valeur, jamais un délai fixe. */
async function attendreEnBase<T>(lire: () => Promise<T>, tient: (v: T) => boolean, msMax = 20_000) {
  const fin = Date.now() + msMax;
  let dernier = await lire();
  while (!tient(dernier) && Date.now() < fin) {
    await new Promise((r) => setTimeout(r, 200));
    dernier = await lire();
  }
  return dernier;
}

const allureEnBase = async () =>
  (
    await pool.query<{ doc_typographie: string | null; doc_fond: string | null; doc_accent: string | null }>(
      `SELECT doc_typographie, doc_fond, doc_accent FROM entreprises ORDER BY created_at LIMIT 1`
    )
  ).rows[0] ?? null;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  console.log("=== L'allure de ses devis, de bout en bout ===\n");

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="typo-playfair"]', { timeout: 30_000 });

  await cas("le réglage est dans « Devis & factures » — sa réponse B", async () => {
    // **La A aurait été une rubrique à part.** On le prouve par les DEUX bouts :
    // le choix est ici (le `waitForSelector` ci-dessus vient de le voir), et il
    // n'est pas dans « Apparence », qui existait déjà pour ses sept chartes.
    //
    // *Une première version de ce contrôle interdisait la rubrique
    // `/reglages/apparence` elle-même — celle des chartes, qui n'a rien à voir
    // et qui est là depuis le 14 août. Il rougissait sur du code juste
    // (`CLAUDE.md` §5 bis).*
    await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
    assert.equal(
      await page.locator('[data-atlas^="typo-"]').count(),
      0,
      "le choix de typographie est apparu dans « Apparence » : ce n'est pas là qu'il l'a demandé"
    );
    await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-atlas="typo-playfair"]', { timeout: 30_000 });
  });

  await cas("une dizaine de typographies lui sont proposées", async () => {
    const combien = await page.locator('[data-atlas^="typo-"]').count();
    assert.ok(combien >= 10, `seulement ${combien} typographies`);
  });

  await cas("LES POLICES SONT VRAIMENT CHARGÉES — l'écran ne montre pas du Georgia", async () => {
    // **Le défaut du 24 août, et il ne se voyait qu'à l'image.** Sans les
    // fichiers servis, les quatre serif retombent toutes sur Georgia et les
    // cinq linéales sur la police de l'appareil : il choisirait « Playfair
    // Display » en regardant autre chose, et découvrirait la vraie sur le devis
    // parti chez son client.
    //
    // On mesure la MÊME phrase dans deux familles : Archivo Narrow est étroite
    // par construction, Merriweather large. Si rien n'est chargé, les deux
    // tombent sur la même police et la même largeur.
    await page.evaluate(async () => {
      for (const famille of ["Archivo Narrow", "Merriweather"]) {
        const d = document.createElement("span");
        d.textContent = "Évacuation des déchets verts";
        d.style.cssText = `position:fixed;left:-9999px;font-size:40px;font-family:"${famille}"`;
        document.body.appendChild(d);
      }
      await document.fonts.ready;
    });
    const [etroite, large] = await page.evaluate(() =>
      [...document.querySelectorAll("span")]
        .filter((s) => s.style.left === "-9999px")
        .map((s) => s.getBoundingClientRect().width)
    );
    // **Un zéro ne prouve rien** (`CLAUDE.md` §5) : une mesure impossible n'est
    // pas un succès. On refuse de conclure sur une boîte vide.
    assert.ok(etroite > 50 && large > 50, `mesure impossible : ${etroite} / ${large}`);
    assert.ok(
      large - etroite > 30,
      `Archivo Narrow (${Math.round(etroite)} px) et Merriweather (${Math.round(large)} px) ` +
        "font la même largeur : aucune des deux n'est chargée, l'écran montre la police de l'appareil"
    );
  });

  await cas("choisir une typographie l'enregistre, sans toucher au bouton du bas", async () => {
    // L'allure s'enregistre seule : le bouton du bas engage les conditions, qui
    // lient l'entreprise. Lui faire valider des conditions pour changer une
    // police serait une chausse-trappe.
    await page.click('[data-atlas="typo-playfair"]');
    const lu = await attendreEnBase(allureEnBase, (v) => v?.doc_typographie === "playfair");
    assert.equal(lu?.doc_typographie, "playfair", "la typographie n'est pas arrivée en base");
  });

  await cas("un fond choisi s'enregistre, et l'aperçu se repeint", async () => {
    // **`fill`, et pas `value = …` suivi d'un événement.** React suit la valeur
    // de ses champs contrôlés : posée à la main, elle ne déclenche pas son
    // `onChange`, et le contrôle rougirait sur un écran qui marche.
    await page.fill('[data-atlas="couleur-fond"]', "#1c2b1c");
    const lu = await attendreEnBase(allureEnBase, (v) => v?.doc_fond === "#1c2b1c");
    assert.equal(lu?.doc_fond, "#1c2b1c", "le fond n'est pas arrivé en base");

    // Et l'aperçu doit MONTRER ce fond : un aperçu resté crème pendant que le
    // devis part en vert, c'est le mensonge d'écran que ce lot combat.
    const fond = await page.locator('[data-atlas="allure-feuille"]').evaluate(
      (n) => getComputedStyle(n).backgroundColor
    );
    assert.equal(fond, "rgb(28, 43, 28)", `l'aperçu est resté ${fond}`);
  });

  await cas("SUR UN FOND SOMBRE, L'APERÇU ÉCLAIRCIT SON ENCRE", async () => {
    // Sa capture du 22 août — *« le mode nuit est illisible »* — était le même
    // défaut ailleurs. Une encre qui ne suit pas le fond ne se voit qu'à
    // l'impression, chez le client.
    const [fond, encre] = await page.locator('[data-atlas="allure-feuille"]').evaluate((n) => {
      const s = getComputedStyle(n);
      return [s.backgroundColor, s.color];
    });
    const clarte = (c: string) => {
      const [r, v, b] = c.match(/\d+/g)!.map(Number);
      return 0.299 * r + 0.587 * v + 0.114 * b;
    };
    assert.ok(
      clarte(encre) - clarte(fond) > 90,
      `encre ${encre} sur fond ${fond} : le devis serait illisible`
    );
  });

  await cas("le choix survit au rechargement — il n'est pas seulement à l'écran", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-atlas="typo-playfair"]', { timeout: 30_000 });
    const choisie = await page.getAttribute('[data-atlas="typo-playfair"]', "aria-pressed");
    assert.equal(choisie, "true", "la typographie choisie n'est plus cochée après rechargement");
    const valeur = await page.textContent('[data-atlas="couleur-fond-valeur"]');
    assert.equal(valeur?.trim(), "#1C2B1C", `l'écran affiche ${valeur}`);
  });

  await cas("« revenir aux réglages d'aujourd'hui » vide les colonnes", async () => {
    // **Vide, et pas la couleur du jour écrite en clair** : c'est ce qui permet
    // à ses documents de suivre la charte si elle bouge.
    await page.click('[data-atlas="allure-defaut"]');
    const lu = await attendreEnBase(allureEnBase, (v) => v?.doc_fond === null);
    assert.equal(lu?.doc_fond, null, "le fond n'a pas été remis à vide");
    assert.equal(lu?.doc_typographie, null, "la typographie n'a pas été remise à vide");
    assert.equal(lu?.doc_accent, null);
  });

  await cas("le bouton « revenir » disparaît quand il n'y a plus rien à défaire", async () => {
    // Un bouton qui reste allumé sur un réglage déjà par défaut fait douter :
    // on appuie, rien ne bouge, et l'on ne sait plus si l'écran répond.
    await page.waitForTimeout(400);
    assert.equal(await page.locator('[data-atlas="allure-defaut"]').count(), 0);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? "\n✅ L'allure va de l'écran des réglages jusqu'au document du client."
      : `\n❌ L'allure de ses devis — ${echecs} échec(s).`
  );
  if (echecs > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
