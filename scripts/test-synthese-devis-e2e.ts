import { lancerNavigateur } from "./e2e-browser";

// **La synthèse du devis : le nom, puis le détail à la ligne — sans tiret.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 13 août 2026, capture de son écran Devis à l'appui :
//
//   *« Il faut qu'il y ait écrit monsieur Martins et pas chez Martins. Ensuite
//   tu me retires le tiret entre le nom et l'adresse et il faut qu'il soit l'un
//   au-dessus de l'autre. D'abord le nom, ensuite à la ligne l'adresse. Pour le
//   client, c'est pareil. C'est M. Martins, puis le numéro de téléphone en
//   dessous, sans les tirets. »*
//
// **Ce que ce contrôle tient, et qu'une fonction pure ne peut pas tenir.** La
// civilité est éprouvée sans navigateur (`test-civilite`), l'ordre des lignes
// aussi (`test-nom-chantier`). Ce qui ne s'éprouve qu'ici, c'est la GÉOMÉTRIE :
// que l'adresse soit réellement SOUS le nom, à la même marge, et non repliée à
// côté. Sur les 390 px du patron, la phrase d'origine se repliait déjà sur deux
// lignes — mais la coupure tombait au milieu de l'adresse, jamais entre le nom
// et elle. Un contrôle qui n'aurait compté que les lignes serait passé au vert
// sur le défaut qu'il signale.
//
// Le nom du client est saisi **nu**, exprès : c'est le cas du patron.

import { devices } from "playwright";
// La civilité vient de la règle, jamais recopiée : le patron peut changer le
// mot (il l'a fait le 13 août, « Monsieur » puis « Mr. ») sans rougir la suite.
import { avecCivilite } from "../src/lib/civilite";

const BASE = "http://localhost:3000";
const ECRAN_DU_PATRON = devices["iPhone 13"];

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La synthèse du devis : le nom, puis le détail dessous ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Un client au nom NU — sans « M. », sans « Mme » : c'est ainsi que le patron
  // le saisit, et c'est ce cas-là qui produisait « Chez Martins ».
  const NOM_CLIENT = `Martins ${Date.now()}`;
  const ADRESSE = "10 rue d'Enfer, 44200 Nantes";
  const TELEPHONE = "0679984514";

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', NOM_CLIENT);
  await page.fill('input[placeholder="06 12 34 56 78"]', TELEPHONE);
  // Le champ est libre et sans `name` (`ChampAdresse`) : on le vise par son
  // libellé, qui est ce que le patron lit.
  await page.getByPlaceholder("12 rue des Lilas, Nantes").fill(ADRESSE);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  // Une ligne, pour que le devis existe et que l'écran d'export s'ouvre.
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Taille d'une haie de laurier (20 ml)");
  await page.getByLabel("Prix unitaire 1").fill("350");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);

  await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="ligne-chantier"]', { timeout: 30_000 });

  await cas("l'en-tête porte la civilité, plus jamais « Chez … »", async () => {
    const ecran = await page.locator("body").innerText();
    if (new RegExp(`Chez\\s+${NOM_CLIENT}`, "i").test(ecran)) {
      throw new Error(`l'écran porte encore « Chez ${NOM_CLIENT} »`);
    }
    if (!ecran.includes(avecCivilite(NOM_CLIENT))) {
      throw new Error(
        `« ${avecCivilite(NOM_CLIENT)} » est absent de l'écran.\n      ` +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 12).join("\n      ")
      );
    }
  });

  /**
   * Le nom et son détail sont-ils bien l'un AU-DESSUS de l'autre ?
   *
   * Mesuré, pas déduit du texte : deux paragraphes peuvent se suivre dans le
   * code et s'afficher côte à côte, et c'est exactement ce qu'on veut exclure.
   */
  async function verifierEmpilement(repere: string, detailAttendu: string) {
    const bloc = page.locator(`[data-atlas="${repere}"]`);
    const texte = (await bloc.innerText()).trim();
    if (texte.includes("—") || texte.includes(" - ")) {
      throw new Error(`le tiret est toujours là : « ${texte.replace(/\n/g, " ⏎ ")} »`);
    }

    const nom = await bloc.locator(`[data-atlas="${repere}-nom"]`).boundingBox();
    const detail = await bloc.locator(`[data-atlas="${repere}-detail"]`).boundingBox();
    if (!nom) throw new Error("le nom n'est pas à l'écran");
    if (!detail) throw new Error(`le détail (« ${detailAttendu} ») n'est pas à l'écran`);

    // D'abord le nom, ensuite l'adresse — l'ordre qu'il a demandé.
    if (detail.y < nom.y + nom.height - 1) {
      throw new Error(
        `le détail n'est pas sous le nom : nom en y=${nom.y.toFixed(0)} (h=${nom.height.toFixed(0)}), ` +
          `détail en y=${detail.y.toFixed(0)}`
      );
    }
    // Et à la même marge : décalé, il se lirait comme la suite d'une phrase.
    if (Math.abs(detail.x - nom.x) > 1) {
      throw new Error(`les deux lignes ne partent pas de la même marge : ${nom.x} vs ${detail.x}`);
    }
  }

  await cas("chantier : le nom, puis l'adresse dessous, sans tiret", async () => {
    await verifierEmpilement("ligne-chantier", ADRESSE);
  });

  await cas("client : la civilité, puis le téléphone dessous, sans tiret", async () => {
    await verifierEmpilement("ligne-client", TELEPHONE);
    const nom = await page.locator('[data-atlas="ligne-client-nom"]').innerText();
    if (nom.trim() !== avecCivilite(NOM_CLIENT)) {
      throw new Error(`la ligne du client dit « ${nom.trim()} » au lieu de « ${avecCivilite(NOM_CLIENT)} »`);
    }
  });

  await cas("rien ne déborde de son écran", async () => {
    // Le nom ayant gagné un mot, la carte pourrait pousser la page en largeur.
    const debord = await page.evaluate(
      "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    );
    if ((debord as number) > 1) throw new Error(`la page déborde de ${debord} px en largeur`);
  });

  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La synthèse du devis — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
