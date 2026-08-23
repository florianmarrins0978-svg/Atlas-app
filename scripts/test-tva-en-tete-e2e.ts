import assert from "node:assert/strict";
import { devices } from "playwright";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * Où se lit la TVA, et ce qui fait monter la déductible.
 *
 * *Le patron, le 23 août 2026 :* **« je trouve que l'outil Ma TVA à déclarer,
 * il est caché, on ne le voit pas trop »**, puis, sur l'écran du relevé :
 * **« on ne comprend pas trop que scanner ou écrire à la main, c'est pour la
 * TVA déductible »**.
 *
 * Deux planches, deux choix, dits mot pour mot : **« Pour ma TVA la B »**
 * (`docs/maquettes/86-ou-mettre-ma-tva.html`) et **« pour les achats la C »**
 * (`docs/maquettes/85-achats-tva-deductible.html`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VOIT.**
 *
 * Les deux choix sont des choix de PLACE. Rien ne casse si la place se perd :
 * la carte redevient un lien en pied de liste, les deux boutons redescendent
 * sous les achats — et tout reste vert, parce que tout marche encore. Ce sont
 * précisément les défauts qu'aucun autre contrôle ne peut voir.
 *
 * D'où trois mesures, et non trois présences :
 *
 * 1. **La carte est AU-DESSUS de la liste** — la B se distingue de l'ancien
 *    pied de page par sa place, pas par son existence.
 * 2. **Elle porte le montant** — c'est ce qui sépare la B de la A, qui n'était
 *    qu'un lien. « Le montant se lit sans ouvrir, et donne la raison d'ouvrir. »
 * 3. **Les gestes sont collés à l'encadré des chiffres** — la C ne dit le lien
 *    par aucun mot : elle le dit par la couture. Un écart qui se rouvre, et le
 *    choix est défait sans qu'une phrase ait bougé.
 */

const BASE = "http://localhost:3000";

let reussis = 0;
let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Le haut d'un élément, mesuré dans la page entière et non dans le cadre. */
async function hautDe(page: Page, selecteur: string, quoi: string): Promise<number> {
  const cible = page.locator(selecteur).first();
  assert.ok(
    await cible.count(),
    `${quoi} est introuvable (${selecteur}) — c'est lui qui manque, pas sa place.`
  );
  const boite = await cible.boundingBox();
  assert.ok(boite, `${quoi} n'a aucune boîte : il est dans la page mais invisible.`);
  return boite.y;
}

async function main() {
  console.log("=== Où se lit la TVA, et ce qui fait monter la déductible ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ── Sa proposition B : une carte, en tête, portant le chiffre ──────────────

  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Terminés", { timeout: 30_000 });

  await cas("la carte de TVA est au-dessus de la liste des chantiers", async () => {
    // **Mesurer la carte contre la LISTE, jamais contre sa propre mention.** Le
    // premier jet comparait la carte au « Reste à payer » qui la suit : la carte
    // remise en pied d'écran, la mention descendait avec elle et le contrôle
    // restait vert — vert sur le défaut même dont il portait le nom.
    const carte = await hautDe(page, '[data-atlas="carte-tva"]', "La carte « Ma TVA à déclarer »");
    const liste = await hautDe(page, '[data-atlas="contenu-termines"]', "Le contenu de l'écran Terminés");
    assert.ok(
      carte < liste,
      `La carte n'est plus en tête : elle passe APRÈS le contenu de l'écran ` +
        `(carte y=${Math.round(carte)}, contenu y=${Math.round(liste)}). C'est la place d'avant, ` +
        `celle dont il disait « je trouve que l'outil Ma TVA à déclarer, il est caché ».`
    );
  });

  await cas("elle porte le montant, et pas seulement le mot « TVA »", async () => {
    const texte = (await page.locator('[data-atlas="carte-tva"]').first().innerText()).replace(/\s+/g, " ");
    assert.match(
      texte,
      /\d+([ .,]\d+)*\s*€/,
      `La carte ne porte aucun montant : elle dit « ${texte} ». C'est la proposition A ` +
        `(un simple lien), pas la B qu'il a retenue — « le montant se lit sans ouvrir ».`
    );
  });

  await cas("elle mène au relevé", async () => {
    await page.locator('[data-atlas="carte-tva"]').first().click();
    await page.waitForURL(`${BASE}/termines/tva`, { timeout: 30_000 });
  });

  // ── Sa proposition C : les gestes collés à l'encadré des chiffres ──────────

  await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Déductible", { timeout: 30_000 });

  await cas("les deux gestes précèdent la liste des achats", async () => {
    const gestes = await hautDe(page, '[data-atlas="gestes-deductible"]', "Le bloc des deux gestes");
    const achats = await hautDe(page, "text=Vos achats", "Le titre « Vos achats »");
    assert.ok(
      gestes < achats,
      `Les gestes sont redescendus SOUS les achats (gestes y=${Math.round(gestes)}, ` +
        `« Vos achats » y=${Math.round(achats)}). C'est la place d'avant, celle dont il ` +
        `disait « on ne comprend pas trop que c'est pour la TVA déductible ».`
    );
  });

  await cas("ils sont cousus à l'encadré des chiffres, sans écart", async () => {
    // **Mesurer les DEUX ENCADRÉS, jamais leur texte.** Le premier jet mesurait
    // depuis le bas des mots « Reste à payer » et annonçait 25 px d'écart alors
    // que les deux pièces se touchaient : il comptait le rembourrage de la
    // carte comme une brèche. Un contrôle qui accuse à tort coûte plus cher que
    // pas de contrôle du tout (`AGENTS.md`).
    const encadre = await page.locator('[data-atlas="encadre-tva"]').first().boundingBox();
    assert.ok(encadre, "L'encadré des chiffres (« Reste à payer ») n'a aucune boîte.");
    const gestes = await page
      .locator('[data-atlas="gestes-deductible"]')
      .first()
      .evaluate((el) => {
        const r = el.parentElement!.getBoundingClientRect();
        return { haut: r.top + window.scrollY, gauche: r.left, largeur: r.width };
      });

    const ecart = gestes.haut - (encadre.y + encadre.height);
    assert.ok(
      ecart <= 1,
      `Un écart de ${Math.round(ecart)} px s'est rouvert entre l'encadré des chiffres ` +
        `et les gestes. La proposition C ne dit le lien par AUCUN mot : elle le dit par ` +
        `la couture. Cet écart la défait sans qu'une phrase ait bougé.`
    );
    // Et la couture ne tient que si les deux pièces ont la même largeur : deux
    // marges différentes feraient un décrochement, visible et jamais rouge.
    assert.ok(
      Math.abs(gestes.gauche - encadre.x) <= 1 && Math.abs(gestes.largeur - encadre.width) <= 1,
      `Les deux pièces ne sont plus alignées : l'encadré fait ${Math.round(encadre.width)} px ` +
        `à x=${Math.round(encadre.x)}, le bloc des gestes ${Math.round(gestes.largeur)} px ` +
        `à x=${Math.round(gestes.gauche)}. Le décrochement se voit, et rien d'autre ne le dirait.`
    );
  });

  await cas("le titre du bloc nomme ce à quoi les gestes servent", async () => {
    const titre = page.getByText("Pour faire monter la déductible", { exact: false });
    assert.ok(
      await titre.count(),
      `Le titre « Pour faire monter la déductible » a disparu. Il est la seule ` +
        `chose qui relie les deux boutons à la tuile au-dessus.`
    );
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${reussis} réussis, ${echecs} échecs`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
