import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";

// **« Modifier » mène au devis — et seulement tant qu'il peut être modifié.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 13 août 2026, capture à l'appui : *« j'ai un devis sur le feu.
// En cliquant sur Mme Félicie, voilà où j'arrive, mais si je veux modifier mon
// devis avant de l'envoyer, je peux pas. »*
//
// Il avait raison, et le trou était réel : « Modifier mon devis » n'existait
// que sur l'écran du devis PARTI. Avant l'envoi — au moment précis où l'on
// corrige — aucun chemin ne menait d'ici à `devis-complet`.
//
// Cinq propositions lui ont été dessinées (`docs/maquettes/45-…`) ; il a retenu
// *« le modifier en or à droite du mot devis »*.
//
// **CE QUE CE CONTRÔLE TIENT, ET QUI N'EST PAS L'APPARENCE DU MOT.** Deux
// choses, et la seconde est la plus importante :
//
//   1. avant l'envoi, le lien existe et MÈNE VRAIMENT au devis modifiable ;
//   2. après l'envoi, il a DISPARU.
//
// Le second n'est pas un raffinement. Un devis parti ne se modifie plus — le
// déclencheur `empecher_modification_devis_envoye` refuse la première frappe.
// Il se REPREND, ce qui ouvre une nouvelle version, et c'est un geste que le
// patron décide (`ARCHITECTURE.md` §66). Laisser « Modifier » après l'envoi le
// mènerait sur un document mort, sans lui dire pourquoi.

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
  console.log("=== « Modifier » : avant l'envoi, et pas après ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const CLIENT = `Felicie ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Bernard"]').fill(CLIENT);
  await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  // Un devis chiffré : sans ligne, l'écran d'envoi n'a rien à montrer.
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Haie de laurier — 20 ml");
  await page.getByLabel("Prix unitaire 1").fill("50");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);

  await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="ligne-client"]', { timeout: 30_000 });

  await cas("avant l'envoi, « Modifier » est en face du titre", async () => {
    const lien = page.getByRole("link", { name: "Modifier" });
    if ((await lien.count()) !== 1) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "« Modifier » est absent de l'écran d'avant l'envoi — c'est le défaut du 13 août.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 10).join("\n      ")
      );
    }
    // **Mesuré, pas déduit du code.** C'est la place qu'il a retenue sur la
    // maquette : sur la LIGNE du titre, pas au-dessus à côté du surtitre. Un
    // simple `items-start` suffirait à le faire remonter sans que rien ne
    // rougisse.
    const mot = await lien.boundingBox();
    const titre = await page.locator("h1").first().boundingBox();
    if (!mot || !titre) throw new Error("le mot ou le titre n'est pas à l'écran");
    const ecartBas = Math.abs(mot.y + mot.height - (titre.y + titre.height));
    if (ecartBas > 4) {
      throw new Error(`« Modifier » n'est pas sur la ligne du titre : ${ecartBas.toFixed(0)} px d'écart`);
    }
    if (mot.x < titre.x + titre.width) {
      throw new Error("« Modifier » chevauche le titre au lieu de se poser à sa droite");
    }
  });

  await cas("et il mène vraiment au devis modifiable", async () => {
    // Une adresse juste vers un écran qui n'offre rien serait verte partout et
    // fausse à l'usage : on vérifie qu'on peut y écrire.
    await page.getByRole("link", { name: "Modifier" }).click();
    await page.waitForURL(/\/devis-complet$/, { timeout: 30_000 });
    await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
    const champ = page.getByLabel("Description 1");
    if ((await champ.count()) === 0) throw new Error("aucune ligne modifiable sur l'écran atteint");
    if (await champ.first().isDisabled()) throw new Error("les lignes y sont figées");
  });

  await cas("le retour ramène à l'écran d'envoi, pas ailleurs", async () => {
    await page.goBack({ waitUntil: "networkidle" });
    if (!page.url().endsWith("/export")) throw new Error(`le retour mène à « ${page.url()} »`);
  });

  // --- Une fois le devis parti -------------------------------------------
  await page.click("text=Envoyer au client");
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();
  await page.waitForTimeout(3500);

  await cas("APRÈS l'envoi, « Modifier » a disparu", async () => {
    // **Le cas qui compte.** Un devis parti ne se modifie plus : il se reprend,
    // et c'est un autre geste, porté par cet écran sous son propre libellé.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const lien = page.getByRole("link", { name: "Modifier" });
    if ((await lien.count()) > 0) {
      throw new Error(
        "« Modifier » est encore là sur un devis parti : il mènerait à un document " +
          "que la base refuse de modifier, sans dire pourquoi"
      );
    }
  });

  await cas("mais l'écran du devis parti garde SON geste", async () => {
    // Sans cette vérification, on pourrait faire passer le cas précédent en
    // retirant le lien partout — et le patron n'aurait plus aucune issue.
    const ecran = await page.locator("body").innerText();
    if (!/Modifier mon devis|Reprendre le devis|Corriger et renvoyer/i.test(ecran)) {
      throw new Error(
        "aucun geste de reprise sur l'écran du devis parti.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 10).join("\n      ")
      );
    }
  });

  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} « Modifier » avant l'envoi — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
