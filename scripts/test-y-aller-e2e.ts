import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * « Y aller » — le chevron doré du planning, et la feuille qu'il ouvre.
 *
 * *Le patron, le 12 août 2026 : « lorsque je vais sur planning et qu'il y a un
 * chantier planifié, en cliquant dessus je puisse avoir un petit truc genre
 * accéder à l'adresse, et en cliquant dessus ça met l'adresse toute seule dans
 * le GPS, soit Maps, soit Waze ».* Retenu sur maquette
 * (`docs/maquettes/32-le-chevron.html`) après quatre versions.
 *
 * **Ce que cette suite regarde, et qu'aucun test unitaire ne peut voir :** que
 * l'adresse arrive VRAIMENT jusqu'au `href`. La règle pure est éprouvée à part
 * (`test-itineraire.ts`) et elle serait verte même si l'écran oubliait de lui
 * passer l'adresse — la feuille s'ouvrirait alors sur « Adresse non
 * renseignée » pour un chantier qui en a une, et le patron croirait sa base
 * vide. C'est le raccord qui se casse, jamais la formule.
 *
 * **Ce qu'elle ne prouve pas, et il faut le savoir :** que le GPS s'ouvre. Un
 * navigateur d'essai n'a ni Plans, ni Waze. Ce qui est vérifiable ici, c'est
 * que le lien est universel (`https://`) — donc qu'il retombe sur un site
 * plutôt que d'échouer en silence, ce que fait un `waze://` sans application.
 */

const BASE = "http://localhost:3000";

/** Un nom de chantier dans une expression régulière : il porte des points. */
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ADRESSE = "12 chemin des Chênes, 33600 Pessac";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/**
 * Un chantier planifié, avec ou sans adresse.
 *
 * Le devis et la date sont posés **en base** plutôt qu'à l'écran : le parcours
 * complet du devis est déjà éprouvé ailleurs (`test-planning-vers-facture-e2e`),
 * et le rejouer ici ajouterait deux minutes à la batterie pour ne rien
 * apprendre de neuf sur le chevron.
 */
async function chantierPlanifie(page: Page, suffixe: string, adresse: string | null) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const client = `M. Bernard ${suffixe} ${Date.now()}`;
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "05 56 00 00 12");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierId = page.url().split("/").pop()!;

  const r = await pool.query(
    `UPDATE chantiers
        SET devis_envoye_at = now(),
            date_planifiee  = CURRENT_DATE + 3,
            adresse_chantier = $2
      WHERE id = $1`,
    [chantierId, adresse]
  );
  if (r.rowCount !== 1) {
    throw new Error(
      "Le montage n'a pas pu poser le devis et la date : le rôle de test ne traverse " +
        "probablement plus RLS (voir CLAUDE.md §5)."
    );
  }
  const nom = (await pool.query(`SELECT nom FROM chantiers WHERE id = $1`, [chantierId])).rows[0].nom as string;
  return { chantierId, nom, client };
}

async function ouvrirLaFeuille(page: Page, nom: string) {
  await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('h1:has-text("Planning")', { timeout: 30_000 });
  await page.getByRole("button", { name: `Y aller — ${nom}` }).click();
  await page.waitForSelector("text=Y aller", { timeout: 10_000 });
}

async function main() {
  const browser = await lancerNavigateur();
  // Le presse-papier est refusé par défaut hors d'un geste de confiance : sans
  // cette permission, « Copier l'adresse » afficherait « Copie impossible » et
  // le contrôle accuserait le code d'un défaut du navigateur d'essai.
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await seConnecter(context);

  const avec = await chantierPlanifie(page, "avec-adresse", ADRESSE);
  const sans = await chantierPlanifie(page, "sans-adresse", null);

  await test("Le chevron ouvre la feuille SANS quitter le planning", async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('h1:has-text("Planning")', { timeout: 30_000 });
    const avant = page.url();
    await page.getByRole("button", { name: `Y aller — ${avec.nom}` }).click();
    await page.waitForSelector(`text=${ADRESSE}`, { timeout: 10_000 });
    assert.equal(page.url(), avant, "toucher le chevron ne doit pas changer de page");
  });

  await test("Les trois destinations portent l'adresse du chantier", async () => {
    await ouvrirLaFeuille(page, avec.nom);
    const attendus = {
      Plans: "maps.apple.com",
      "Google Maps": "google.com/maps",
      Waze: "waze.com",
    } as const;
    for (const [nom, hote] of Object.entries(attendus)) {
      const href = await page.getByRole("link", { name: nom, exact: true }).getAttribute("href");
      assert.ok(href, `« ${nom} » n'a pas de lien`);
      assert.ok(href.includes(hote), `« ${nom} » ne vise pas ${hote} : ${href}`);
      // Le raccord, et c'est tout l'objet de cette suite : l'adresse doit se
      // relire ENTIÈRE depuis le lien, virgule et accents compris.
      const valeurs = [...new URL(href).searchParams.values()];
      assert.ok(
        valeurs.includes(ADRESSE),
        `« ${nom} » ne porte pas l'adresse du chantier (reçu : ${valeurs.join(" | ")})`
      );
    }
  });

  await test("Aucun lien de GPS n'est un schéma propre — ils retombent tous sur un site", async () => {
    await ouvrirLaFeuille(page, avec.nom);
    for (const nom of ["Plans", "Google Maps", "Waze"]) {
      const href = await page.getByRole("link", { name: nom, exact: true }).getAttribute("href");
      assert.ok(
        href?.startsWith("https://"),
        `« ${nom} » échouerait en silence sans l'application installée : ${href}`
      );
    }
  });

  await test("Le numéro du client mène à un vrai appel", async () => {
    await ouvrirLaFeuille(page, avec.nom);
    const href = await page.getByRole("link", { name: "Appeler le client" }).getAttribute("href");
    assert.equal(href, "tel:0556000012");
  });

  await test("« Copier l'adresse » copie pour de bon, et le dit", async () => {
    await ouvrirLaFeuille(page, avec.nom);
    await page.getByRole("button", { name: "Copier l’adresse" }).click();
    await page.waitForSelector("text=Adresse copiée", { timeout: 5000 });
    const presse = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(presse, ADRESSE);
  });

  // **On n'invente pas d'adresse** (`CLAUDE.md` §4). Un chantier dicté à la
  // va-vite n'en a pas toujours : la feuille dit alors ce qui manque et où le
  // saisir, au lieu d'ouvrir un GPS sur rien.
  await test("Sans adresse, la feuille le dit et n'offre aucune destination", async () => {
    await ouvrirLaFeuille(page, sans.nom);
    await page.waitForSelector("text=Adresse non renseignée", { timeout: 10_000 });
    // La consigne écrite a cédé la place à un BOUTON (13 août 2026) : ce que ce
    // contrôle garde est qu'un chemin existe, pas qu'une phrase existe.
    assert.equal(
      await page.getByRole("link", { name: /^Saisir l'adresse/ }).count(),
      1,
      "sans adresse, la feuille doit offrir d'aller la saisir"
    );
    for (const nom of ["Plans", "Google Maps", "Waze"]) {
      assert.equal(
        await page.getByRole("link", { name: nom, exact: true }).count(),
        0,
        `« ${nom} » ne doit pas être un lien quand il n'y a pas d'adresse`
      );
    }
  });

  // **Sans adresse, il faut un chemin pour aller la saisir** — sa décision du
  // 13 août 2026 sur maquette (`docs/maquettes/34`, variante B). La feuille
  // disait où saisir sans y mener : trois gestes, et il fallait savoir que le
  // nom du chantier ouvre la fiche.
  await test("Sans adresse, un bouton mène là où elle se saisit", async () => {
    await ouvrirLaFeuille(page, sans.nom);
    const bouton = page.getByRole("link", { name: `Saisir l'adresse — ${sans.nom}` });
    assert.equal(await bouton.count(), 1, "le bouton manque sur un chantier sans adresse");
    assert.equal(
      await bouton.getAttribute("href"),
      `/chantiers/${sans.chantierId}/devis-complet`,
      "il doit mener au seul écran où l'adresse s'édite"
    );
  });

  // **Et il ne doit PAS encombrer les onze fois sur douze où l'adresse est
  // là.** La feuille porte déjà « Créer la facture » ; un bouton permanent de
  // plus la chargerait pour rien.
  await test("Avec une adresse, ce bouton n'existe pas", async () => {
    await ouvrirLaFeuille(page, avec.nom);
    assert.equal(await page.getByRole("link", { name: /^Saisir l'adresse/ }).count(), 0);
  });

  await test("Le chevron ne mange pas le geste voisin de la ligne", async () => {
    // **LE VOISIN A CHANGÉ LE 14 AOÛT 2026, PAS LE DÉFAUT.** C'était
    // « Déplacer » ; c'est désormais la pastille d'équipe, qui lui a pris sa
    // place sur la ligne (geste A). Le carré de 44 px du chevron est invisible :
    // posé sans précaution, il recouvre son voisin et le geste devient
    // injoignable — un défaut qu'aucun test de rendu ne voit, puisque les deux
    // éléments SONT là.
    //
    // **Deux équipes sont posées d'abord**, sans quoi la pastille n'existe pas :
    // à une seule équipe le mot « équipe » ne s'écrit nulle part
    // (`src/lib/equipes.ts`). Un contrôle qui viserait un élément absent
    // passerait au vert sans rien avoir mesuré.
    await pool.query(
      `UPDATE entreprises SET nombre_equipes = 2
       WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
      [avec.chantierId]
    );
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('h1:has-text("Planning")', { timeout: 30_000 });
    const deplacer = page.getByRole("button", { name: new RegExp(`l'équipe — ${echapper(avec.nom)}$`) });
    // **Amener à l'écran d'abord, et ce n'est pas une politesse.** `elementFromPoint`
    // lit des coordonnées de FENÊTRE : sur une ligne restée sous le pli, elle
    // interroge un point vide et le contrôle accuse le chevron de recouvrir ce
    // qu'il n'a jamais touché. Ce même appel attend en prime que la ligne ait
    // une boîte — mesurée trop tôt, elle en est encore dépourvue.
    await deplacer.scrollIntoViewIfNeeded();
    const boite = await deplacer.boundingBox();
    assert.ok(boite, "la pastille d'équipe doit rester à l'écran");
    const dessus = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x as number, y as number);
        return el?.closest("a,button")?.getAttribute("aria-label") ?? el?.textContent ?? "";
      },
      [boite.x + boite.width / 2, boite.y + boite.height / 2]
    );
    assert.ok(
      /l'équipe/i.test(dessus),
      `au centre de la pastille d'équipe, le doigt touche « ${dessus} » — le chevron la recouvre`
    );
  });

  // **Le planning ne doit pas redevenir un cul-de-sac** (8 août 2026 : « comment
  // je fais pour avoir accès au devis ? »). « Créer la facture » a quitté la
  // ligne le 12 août pour la feuille, à sa demande — un appui de plus, jamais un
  // chemin en moins.
  await test("« Créer la facture » est dans la feuille, et mène à la facture", async () => {
    await ouvrirLaFeuille(page, avec.nom);
    const facture = page.locator(`a[href="/chantiers/${avec.chantierId}/facture"]`);
    assert.equal(await facture.count(), 1, "« Créer la facture » manque dans la feuille");
    assert.equal(
      await page.locator(`a[href="/chantiers/${avec.chantierId}/facture"]`).textContent(),
      "Créer la facture"
    );
  });

  await test("« Annuler » referme la feuille et rend le planning", async () => {
    await ouvrirLaFeuille(page, avec.nom);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await page.waitForSelector(`text=${ADRESSE}`, { state: "detached", timeout: 5000 });
    assert.ok(
      (await page.locator('h1:has-text("Planning")').count()) > 0,
      "le planning doit être là, dessous, intact"
    );
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
