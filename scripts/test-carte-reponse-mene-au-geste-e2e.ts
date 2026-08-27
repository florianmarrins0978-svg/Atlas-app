import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await creerPuisFiche(page);
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

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();

  // **Attendre l'ÉTAT, jamais un délai fixe.** Trois secondes et demie tiennent
  // quand la suite est jouée seule ; sous soixante suites enchaînées, l'envoi ne
  // les tient pas, et le message accusait alors le produit — « le devis n'est
  // pas parti » — d'un défaut qui n'était qu'une impatience. Quatre suites de ce
  // dépôt sont tombées sur exactement ce piège les 12 et 13 août 2026.
  let jeton: string | undefined;
  for (let i = 0; i < 60 && !jeton; i++) {
    const { rows } = await pool.query(
      `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
      [chantierId]
    );
    jeton = rows[0]?.jeton as string | undefined;
    if (!jeton) await page.waitForTimeout(500);
  }
  if (!jeton) {
    throw new Error(
      `aucun envoi pour ${nom} après trente secondes : ce n'est pas une attente trop courte, ` +
        "c'est l'envoi lui-même qui a échoué."
    );
  }
  return { chantierId, jeton };
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
  // **Déplier la pile avant de chercher.** Depuis le 16 août 2026, les rappels
  // passent devant les réponses de clients (sa décision « fait la B »), et
  // l'accueil n'en pose que deux : une réponse peut donc être repliée derrière
  // « N autres devis à regarder ». Elle existe et se touche en un appui — mais
  // pas sans ce geste, et la suite accuserait la carte d'être absente.
  const deplier = page.getByRole("button", { name: /autres? devis à regarder/ });
  if ((await deplier.count()) > 0) {
    await deplier.first().click();
    await page.waitForTimeout(300);
  }
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

  // **ON ÉVITE LA DATE QUE L'ARTISAN A PROPOSÉE — sinon ce n'est pas une AUTRE
  // date.** Payé le 27 août 2026 : ce cas prenait « le dernier jour cliquable
  // du calendrier », et ce jour-là c'était le 31 août — précisément la date
  // proposée. Le client acceptait donc la proposition, `dateContreProposee`
  // valait `false` à juste titre, aucune carte n'était due, et la suite
  // accusait l'écran d'avoir perdu une notification qui n'existait pas.
  //
  // **Le produit avait raison, et le contrôle rougissait selon la date du
  // jour** — la faute exacte que ce dépôt a déjà payée sur une suite qui
  // tombait le samedi. On lit donc ce qui a été proposé, et l'on choisit
  // ailleurs.
  const { rows: proposees } = await pool.query<{ jours: string[] }>(
    `SELECT e.dates_proposees::text[] AS jours
       FROM envois_devis e JOIN devis d ON d.id = e.devis_id
      WHERE d.chantier_id = $1`,
    [accepte.chantierId]
  );
  const aEviter = new Set((proposees[0]?.jours ?? []).map((j) => String(Number(j.slice(8, 10)))));
  const jours = page.locator("button:not([disabled])").filter({ hasText: /^\d{1,2}$/ });
  let jourLibre = null;
  for (let i = (await jours.count()) - 1; i >= 0; i--) {
    const numero = (await jours.nth(i).innerText()).trim();
    if (!aEviter.has(numero)) {
      jourLibre = jours.nth(i);
      break;
    }
  }
  if (!jourLibre) {
    throw new Error(
      `aucun jour du calendrier n'est différent des dates proposées (${[...aEviter].join(", ")}) : ` +
        "ce cas ne peut pas jouer une CONTRE-proposition, et rien ne serait éprouvé"
    );
  }
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

  // **Sa demande du 13 août 2026 :** *« lorsque je clique sur corriger le
  // devis, je dois arriver directement sur la page du devis pour pouvoir le
  // corriger. Et aujourd'hui, ce n'est pas le cas. »*
  //
  // Les deux moitiés sont éprouvées séparément parce qu'elles cassent
  // séparément : arriver sur le devis, ET pouvoir y écrire. La veille, la
  // seconde manquait — un devis parti refuse la première frappe.
  await cas("correction : le geste mène DIRECTEMENT au devis", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const replie = page.getByRole("button", { name: /autres? devis à regarder/ });
    if ((await replie.count()) > 0) {
      await replie.first().click();
      await page.waitForTimeout(300);
    }
    const carte = page.locator(
      `[data-atlas="carte-reponse"][data-chantier="${correction.chantierId}"]`
    );
    await carte.first().waitFor({ state: "visible", timeout: 20_000 });
    const geste = carte.first().getByRole("button", { name: /Corriger le devis/i });
    if ((await geste.count()) === 0) {
      const ecran = await carte.first().innerText();
      throw new Error(`la carte n'offre pas « Corriger le devis ».\n      ${ecran}`);
    }
    await geste.first().click();
    // Le devis est REPRIS avant l'ouverture : cette attente traverse le réseau,
    // et c'est elle qui fait la différence entre un document mort et un
    // document qu'il peut corriger.
    await page.waitForURL(`${BASE}/chantiers/${correction.chantierId}/devis-complet`);
  });

  await cas("et le devis y est VRAIMENT modifiable", async () => {
    // **C'est ici que la règle seule ne suffisait pas.** Une adresse juste vers
    // un document figé serait verte dans la fonction pure et fausse à l'usage :
    // il verrait son devis, et ne pourrait rien y changer.
    await page.waitForSelector("text=Total TTC", { timeout: 30_000 }).catch(() => undefined);
    const ecran = await page.locator("body").innerText();
    if (/il ne se modifie plus/i.test(ecran)) {
      throw new Error(
        "le devis ouvert est FIGÉ : le patron arrive sur le document qu'il voulait " +
          "corriger, et il refuse la première frappe — exactement le défaut du 12 août."
      );
    }
    // Un champ qui accepte réellement la frappe, et pas seulement l'absence du
    // bandeau : le bandeau pourrait disparaître sans que rien ne s'écrive.
    const champ = page.getByLabel(/Description 1/i);
    if ((await champ.count()) === 0) {
      throw new Error(
        `aucune ligne à corriger sur le devis rouvert.\n      ` +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 12).join("\n      ")
      );
    }
    if (await champ.first().isDisabled()) {
      throw new Error("les lignes du devis rouvert sont verrouillées");
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
