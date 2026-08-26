// LE FORMAT DE SES NUMÉROS, DE L'ÉCRAN JUSQU'AU DEVIS QUI PART.
//
// **Sa demande du 26 août 2026**, capture d'une autre application à l'appui :
// *« dans la catégorie facture il faut rajouter le format de numéro »*. Puis
// ses trois décisions devant `appli/format-de-numero.html` : **six chiffres**,
// **le « F » reste**, **le compteur repart à 1 chaque 1ᵉʳ janvier**. Et enfin :
// *« l'utilisateur peut choisir entre ces 5 façons ? Si oui code ça »*.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VERRAIT.**
// `test-numero-documents.ts` éprouve la règle sans base ;
// `test-numero-documents-db.ts` éprouve le compteur sans écran. Les deux
// resteraient vertes si le réglage n'enregistrait rien — il choisirait un
// format, et ses documents partiraient dans l'ancien.
//
// **Et le cas qui compte le plus est le dernier** : un devis créé APRÈS le
// choix porte le numéro choisi. C'est le seul qui relie les deux bouts.
//
// Usage : npm run test:e2e -- --seulement format-numero
import assert from "node:assert/strict";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { FORMATS_NUMERO } from "../src/lib/numero-documents";

const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";
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

const formatEnBase = async () =>
  (
    await pool.query<{ format_numero: string | null }>(
      `SELECT format_numero FROM entreprises ORDER BY created_at LIMIT 1`
    )
  ).rows[0]?.format_numero ?? null;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  console.log("=== Le format de ses numéros, de bout en bout ===\n");

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
  await page.waitForSelector('button[data-atlas^="format-"]', { timeout: 30_000 });

  await cas("le réglage est dans « Devis & factures » — là où il l'a demandé", async () => {
    // Sa capture montrait ce réglage sous « Facturation » chez le concurrent.
    // Ici, la rubrique équivalente est « Devis & factures » : c'est celle qui
    // porte déjà les conditions, le message au client et l'allure.
    // **Le repère se lit sur les BOUTONS, pas sur tout ce qui commence par
    // « format- ».** Une première version comptait aussi la phrase de
    // conséquence : elle annonçait « 6 formats au lieu de 5 » sur un écran
    // juste, et envoyait chercher dans le produit un défaut qui était dans le
    // contrôle (`CLAUDE.md` §5). D'où `consequence-format`, qui ne peut plus
    // se confondre.
    const combien = await page.locator('button[data-atlas^="format-"]').count();
    assert.equal(
      combien,
      FORMATS_NUMERO.length,
      `${combien} formats proposés au lieu des ${FORMATS_NUMERO.length} de la planche`
    );
  });

  await cas("CHAQUE FORMAT MONTRE CE QU'IL DONNE — un nom seul ne se choisit pas", async () => {
    // « Année courte » ne dit rien tant qu'on n'a pas vu `26-0012`. C'est
    // exactement ce que sa capture du concurrent montrait : la liste déroulante
    // portait l'exemple, pas le nom.
    //
    // **Et l'exemple doit être VRAIMENT différent d'un format à l'autre** :
    // cinq lignes qui montrent la même chose, c'est un aperçu débranché — le
    // défaut qu'on chercherait des heures parce qu'il ne fait rien planter.
    const vus = new Set<string>();
    for (const f of FORMATS_NUMERO) {
      const exemple = (
        await page.locator(`[data-atlas="exemple-${f.clef}"]`).innerText()
      ).trim();
      assert.match(
        exemple,
        /\d{3,}/,
        `« ${f.nom} » ne montre aucun numéro d'exemple (lu « ${exemple} »)`
      );
      vus.add(exemple);
    }
    assert.equal(
      vus.size,
      FORMATS_NUMERO.length,
      `les cinq formats montrent ${vus.size} exemple(s) distinct(s) : l'aperçu ne suit pas le format`
    );
  });

  await cas("L'EXEMPLE PORTE L'ANNÉE DE L'HORLOGE — jamais un millésime en dur", async () => {
    // **C'est le défaut que ce lot corrige, retourné contre l'écran.** Le
    // numéro des factures portait « 2026 » écrit à la main : en janvier 2027
    // elles l'auraient porté encore. Un exemple figé referait la même faute,
    // au même endroit, sans que rien ne rougisse.
    const exemple = (await page.locator('[data-atlas="exemple-annee-6"]').innerText()).trim();
    assert.ok(
      exemple.includes(String(new Date().getFullYear())),
      `l'exemple montre « ${exemple} » et non l'année courante`
    );
  });

  await cas("le défaut est coché à l'ouverture — six chiffres, sa décision", async () => {
    // **Rien de réglé rend le DÉFAUT, pas du vide** : sinon il croit devoir
    // choisir pour ne rien changer, et le premier clic déplace ce qui allait bien.
    const coche = await page.locator('button[data-atlas^="format-"][aria-pressed="true"]').count();
    assert.equal(coche, 1, `${coche} format(s) coché(s) à l'ouverture`);
    assert.equal(
      await page.getAttribute('[data-atlas="format-annee-6"]', "aria-pressed"),
      "true",
      "le format coché n'est pas « Année et 6 chiffres »"
    );
  });

  await cas("choisir un format l'enregistre seul, sans toucher au bouton du bas", async () => {
    // Comme l'allure : le bouton du bas engage les CONDITIONS, qui lient
    // l'entreprise. Lui faire valider des conditions pour changer un format
    // serait une chausse-trappe.
    await page.click('[data-atlas="format-court"]');
    const lu = await attendreEnBase(formatEnBase, (v) => v === "court");
    assert.equal(lu, "court", "le format n'est pas arrivé en base");
  });

  await cas("CE QUE ÇA IMPLIQUE SE DIT — le compteur repart, ou ne repart pas", async () => {
    // **Sa décision : oui, chaque 1ᵉʳ janvier.** Mais elle ne vaut que si
    // l'année figure dans le numéro : sur « une suite sans année », repartir à
    // 1 ferait deux documents du même numéro à un an d'écart — un doublon, ce
    // que la loi interdit. La phrase doit donc changer avec le format, sinon
    // elle ment sur l'un des deux.
    const phrase = async () =>
      (await page.locator('[data-atlas="consequence-format"]').innerText()).trim();
    const avecAnnee = await phrase();
    assert.match(avecAnnee, /repart à 1/, `lu « ${avecAnnee} » sur un format daté`);

    await page.click('[data-atlas="format-suite"]');
    await attendreEnBase(formatEnBase, (v) => v === "suite");
    const sansAnnee = await phrase();
    assert.ok(
      !/repart à 1/.test(sansAnnee),
      `« une suite sans année » annonce encore « ${sansAnnee} » : deux documents porteraient le même numéro`
    );
  });

  await cas("le choix survit au rechargement — il n'est pas seulement à l'écran", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('button[data-atlas^="format-"]', { timeout: 30_000 });
    assert.equal(
      await page.getAttribute('[data-atlas="format-suite"]', "aria-pressed"),
      "true",
      "le format choisi n'est plus coché après rechargement"
    );
  });

  await cas("LE DEVIS SUIVANT PORTE LE FORMAT CHOISI — le fil entier", async () => {
    // **Le seul cas qui relie les deux bouts.** Tout le reste resterait vert si
    // le dépôt continuait d'écrire son millésime en dur : l'écran montrerait
    // fièrement `0148`, et son client recevrait `2026-0148`.
    await page.click('[data-atlas="format-mois"]');
    await attendreEnBase(formatEnBase, (v) => v === "mois");

    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `M. Numéro ${Date.now()}`);
    const chantierId = await creerPuisFiche(page, BASE);

    await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Ajouter une ligne")');
    const zones = page.locator('textarea[aria-label*="escription"]');
    for (const essai of [1, 2, 3, 4, 5]) {
      if ((await zones.count()) > 0) break;
      await page.waitForTimeout(essai * 300);
    }
    await zones.nth(0).fill("Taille de haie");
    await page.locator('input[aria-label*="Prix unitaire"]').nth(0).fill("320");
    await page.keyboard.press("Tab");

    const lu = await attendreEnBase(
      async () =>
        (
          await pool.query<{ numero_commercial: string }>(
            `SELECT numero_commercial FROM devis WHERE chantier_id = $1
             ORDER BY numero_version DESC LIMIT 1`,
            [chantierId]
          )
        ).rows[0]?.numero_commercial ?? null,
      (v) => v !== null,
      25_000
    );
    assert.ok(lu, "aucun devis n'a été enregistré : le fil ne peut pas être éprouvé ici");

    const annee = String(new Date().getFullYear());
    const mois = String(new Date().getMonth() + 1).padStart(2, "0");
    assert.match(
      lu!,
      new RegExp(`^${annee}-${mois}-\\d{3}$`),
      `le devis porte « ${lu} » alors que le format « Année, mois, numéro » était choisi : ` +
        "l'écran enregistre un réglage que le document ignore"
    );
  });

  await cas("on repose le défaut derrière soi", async () => {
    // Une suite qui laisse le décor de travers fait rougir sa voisine sur du
    // code juste (`CLAUDE.md` §5 bis).
    await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-atlas="format-annee-6"]', { timeout: 30_000 });
    await page.click('[data-atlas="format-annee-6"]');
    const lu = await attendreEnBase(formatEnBase, (v) => v === "annee-6");
    assert.equal(lu, "annee-6");

    // **Une capture, pour être REGARDÉE** : quatre défauts de ce dépôt sont
    // sortis d'une image et d'aucun test (`CLAUDE.md` §5).
    mkdirSync(CAPTURES, { recursive: true });
    await page.locator('[data-atlas="format-annee-6"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${CAPTURES}/format-de-numero.png` });
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? "\n✅ Le format choisi à l'écran est celui qui part chez son client."
      : `\n❌ Le format de ses numéros — ${echecs} échec(s).`
  );
  if (echecs > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
