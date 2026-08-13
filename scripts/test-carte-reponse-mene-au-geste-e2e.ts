import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

// **La carte de réponse mène là où est le geste — et le geste y est vraiment.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 12 août 2026 : *« si le chantier il est accepté par le client,
// il faut qu'à la place de "ouvrir le chantier", on puisse ouvrir le devis — et
// le devis validé, pas le devis en construction. Par contre, si le devis n'est
// pas validé et il nous revient pour une modification, il faut qu'on puisse
// ouvrir le devis, mais pour pouvoir le modifier. »*
//
// La règle elle-même est éprouvée sans navigateur (`test-suite-de-la-reponse`).
// **Ce que celui-ci tient, et que la règle ne peut pas tenir : que l'écran visé
// porte réellement ce que le lien promet.** Un lien juste vers un écran mort
// serait vert dans la règle et faux à l'usage — c'est la différence entre
// « l'adresse est la bonne » et « le patron peut faire son travail ».
//
// Deux parcours complets, du devis envoyé jusqu'à la réponse du client, parce
// que c'est le seul moyen d'obtenir les états « accepté » et « à corriger » tels
// qu'ils se produisent chez lui.

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof lancerNavigateur>>["newPage"]>>;

/** Un chantier chiffré, son devis envoyé — et le jeton que le client recevra. */
async function chantierAvecDevisEnvoye(page: Page, nom: string) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Abattage d'un cèdre mort");
  await page.getByLabel("Prix unitaire 1").fill("850");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);

  await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
  await page.click("text=Envoyer au client");
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();
  await page.waitForTimeout(3500);

  const { rows } = await pool.query(
    `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
    [chantierId]
  );
  if (!rows[0]) throw new Error(`aucun envoi pour ${nom} : le devis n'est pas parti`);
  return { chantierId, jeton: rows[0].jeton as string };
}

/**
 * Le lien que la carte d'accueil propose pour ce chantier.
 *
 * **Viser l'étiquette de code, jamais le nom.** Une première version cherchait
 * le nom du chantier et remontait au bloc parent : elle attrapait la LIGNE DE
 * LA LISTE, où ce nom figure aussi, et lisait donc « /chantiers/<id> » en
 * croyant lire la carte. Le contrôle accusait alors le produit d'un défaut
 * qu'il venait de corriger.
 */
async function lienDeLaCarte(page: Page, chantierId: string) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const carte = page.locator(`[data-atlas="carte-reponse"][data-chantier="${chantierId}"]`);
  await carte.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  if ((await carte.count()) === 0) {
    const ecran = await page.locator("body").innerText();
    throw new Error(
      `aucune carte de réponse pour le chantier ${chantierId} à l'accueil.\n      ` +
        ecran.split("\n").filter((l) => l.trim()).slice(0, 12).join("\n      ")
    );
  }
  const lien = carte.first().getByRole("link").first();
  if ((await lien.count()) === 0) throw new Error("la carte ne porte aucun lien");
  return { href: (await lien.getAttribute("href")) ?? "", libelle: (await lien.innerText()).trim() };
}

async function main() {
  console.log("=== La carte de réponse mène là où est le geste ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // --- 1. Le client ACCEPTE ------------------------------------------------
  const nomAccepte = `Accepte ${Date.now()}`;
  const accepte = await chantierAvecDevisEnvoye(page, nomAccepte);
  await page.goto(`${BASE}/devis/${accepte.jeton}`, { waitUntil: "networkidle" });
  // **Il accepte sur UNE AUTRE DATE, et c'est délibéré.** Une acceptation sur
  // l'une des dates proposées ne fait volontairement aucune carte — c'est le
  // déroulement attendu, et la signaler noierait celles qui appellent un geste
  // (`notificationsPatron`). La carte que le patron a photographiée porte
  // d'ailleurs « AUTRE DATE PROPOSÉE » : c'est ce cas-là qu'il faut jouer.
  await page.locator('input[name="choixDate"][value="autre"]').check();
  await page.waitForTimeout(600);
  const jourLibre = page
    .locator("button:not([disabled])")
    .filter({ hasText: /^\d{1,2}$/ })
    .last();
  await jourLibre.click();
  await page.waitForTimeout(400);
  await page.click('button:has-text("J\'accepte ce devis")');
  await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 20_000 });

  await cas("accepté : la carte mène au devis VALIDÉ, pas à la fiche", async () => {
    const { href, libelle } = await lienDeLaCarte(page, accepte.chantierId);
    if (href !== `/chantiers/${accepte.chantierId}/devis-complet`) {
      throw new Error(`le lien mène à « ${href} » (libellé : « ${libelle} »)`);
    }
    if (!/devis validé/i.test(libelle)) throw new Error(`libellé inattendu : « ${libelle} »`);
  });

  await cas("et ce devis s'ouvre FIGÉ — c'est celui que le client a reçu", async () => {
    await page.goto(`${BASE}/chantiers/${accepte.chantierId}/devis-complet`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(900);
    const ecran = await page.locator("body").innerText();
    if (!/ne se modifie plus|est parti/i.test(ecran)) {
      throw new Error(
        "l'écran ne dit pas que ce devis est parti et figé : le patron pourrait croire " +
          `qu'il modifie le devis validé.\n      ${ecran.split("\n").filter((l) => l.trim()).slice(0, 10).join("\n      ")}`
      );
    }
    // **Un devis figé ne se modifie pas, et c'est la garantie qui compte.**
    const modifiables = await page.locator("textarea:not([readonly]), input:not([readonly])").count();
    if (modifiables > 0) {
      throw new Error(`${modifiables} champ(s) modifiable(s) sur un devis déjà parti`);
    }
  });

  // --- 2. Le client demande une CORRECTION ---------------------------------
  const nomCorrection = `Correction ${Date.now()}`;
  const correction = await chantierAvecDevisEnvoye(page, nomCorrection);
  await page.goto(`${BASE}/devis/${correction.jeton}`, { waitUntil: "networkidle" });
  // **Le bouton de correction reste éteint tant que rien n'est écrit** — une
  // demande sans message obligerait le patron à rappeler. On écrit donc d'abord.
  await page.locator("textarea").first().fill("Le devis comprend une faute sur le diamètre.");
  await page.getByRole("button", { name: /Une correction avant d'accepter/i }).click();
  await page.waitForSelector("text=/artisan/i", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  await cas("correction : la carte mène là où le devis peut être repris", async () => {
    const { href, libelle } = await lienDeLaCarte(page, correction.chantierId);
    if (href !== `/chantiers/${correction.chantierId}/export`) {
      throw new Error(`le lien mène à « ${href} » (libellé : « ${libelle} »)`);
    }
    if (!/corriger/i.test(libelle)) throw new Error(`libellé inattendu : « ${libelle} »`);
  });

  await cas("et cet écran porte VRAIMENT le geste promis", async () => {
    // **C'est ici que la règle seule ne suffisait pas.** Une adresse juste vers
    // un écran qui n'offre rien serait verte dans la fonction pure et fausse à
    // l'usage.
    await page.goto(`${BASE}/chantiers/${correction.chantierId}/export`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const bouton = page.getByRole("button", { name: /Corriger et renvoyer/i });
    if ((await bouton.count()) === 0) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "« Corriger et renvoyer » est absent : le lien promet un geste que l'écran " +
          `n'offre pas.\n      ${ecran.split("\n").filter((l) => l.trim()).slice(0, 10).join("\n      ")}`
      );
    }
    // Et le message du client doit être là, sinon il corrige à l'aveugle.
    const ecran = await page.locator("body").innerText();
    if (!/diamètre/i.test(ecran)) {
      throw new Error("le message du client n'est pas sur l'écran où il doit corriger");
    }
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La carte mène au geste — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
