import assert from "node:assert/strict";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { arriverAFroid } from "./_arriver-a-froid";
import { ADRESSE } from "./_adresse";

// **« Le bouton retour doit marcher comme un vrai bouton marche arrière. »**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 9 septembre 2026, capture à l'appui : *« j'ai cliqué sur ouvrir
// le devis, une fois sur le devis je clique sur retour, j'arrive sur la page de
// la fiche client — or le bouton retour […] doit toujours renvoyer à la page
// d'où l'on vient juste avant. »*
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE TIENT, ET QUE LA SUITE PURE NE PEUT PAS VOIR.**
// `test-journal-de-navigation.ts` éprouve la règle ; ici on éprouve qu'elle est
// BRANCHÉE — que le journal se tient pour de bon dans le navigateur, et que la
// flèche le lit. C'est la leçon du 28 août 2026 (`CLAUDE.md` §5 quater) : six
// gestes livrés avec leurs contrôles verts, et aucun atteignable.
//
// **Et les DEUX moitiés comptent** : la page d'avant quand il y en a une, et la
// sortie déclarée de l'écran quand il n'y en a pas. La seconde est sa règle du
// 31 août 2026, et elle ne cesse pas d'exister parce qu'un journal la couvre le
// reste du temps.

const BASE = ADRESSE;

/** La flèche de retour, quel que soit l'écran — elle porte toujours ce libellé. */
const FLECHE = 'a[aria-label^="Retour"]';

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

const chemin = (url: string) => new URL(url).pathname;

const REPERE = '[data-atlas="retour-du-devis"]';

/**
 * Attendre que la flèche annonce `attendue`, et DIRE ce qu'elle annonçait sinon.
 *
 * **Le message doit désigner le bon coupable** (`AGENTS.md`). Un simple
 * dépassement de délai ne dit pas si le journal est vide, s'il porte le mauvais
 * écran, ou si la flèche ne s'est simplement pas corrigée : trois défauts très
 * différents, à chercher à trois endroits. On rend donc les deux — ce que la
 * flèche annonce, et ce que le journal contient.
 *
 * **Et l'on ATTEND, plutôt que de lire tout de suite** : la flèche rendue par
 * le serveur porte la sortie déclarée, puis se corrige dès que la page est
 * vivante. C'est ce que le patron voit, lui, à la première image.
 */
/**
 * **Le repère se choisit, et par défaut c'est celui du devis.** Il était écrit
 * en dur : la flèche de la fiche client et celle de la liste ne le portent pas,
 * et le contrôle attendait alors trente secondes un élément qui n'existe nulle
 * part — il accusait le produit d'un défaut qu'il venait de fabriquer.
 */
async function laFlecheAnnonce(page: Page, attendue: string, repere = REPERE): Promise<void> {
  const fleche = page.locator(repere);
  await fleche.first().waitFor({ state: "visible", timeout: 30_000 });
  try {
    await page.waitForFunction(
      ([ou, cible]) => document.querySelector(ou)?.getAttribute("href") === cible,
      [repere, attendue] as const,
      { timeout: 15_000 }
    );
  } catch {
    const vu = await fleche.first().getAttribute("href");
    const journal = await page.evaluate(() => {
      try {
        return window.sessionStorage.getItem("atlas:journal-de-navigation");
      } catch {
        return "illisible";
      }
    });
    assert.fail(
      `la flèche annonce « ${vu} » au lieu de « ${attendue} » — journal de l'onglet : ${journal}`
    );
  }
}

async function main() {
  console.log("=== La flèche ramène à la page d'où l'on vient ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const chantierId = await creerPuisFiche(page, BASE);
  const devis = `${BASE}/chantiers/${chantierId}/devis-complet`;
  const fleche = page.locator('[data-atlas="retour-du-devis"]');

  await cas("SON CAS : venu de l'accueil, le devis renvoie à l'accueil", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    await laFlecheAnnonce(page, "/");
    await fleche.click();
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
    assert.equal(chemin(page.url()), "/", `la flèche a déposé sur ${page.url()}`);
  });

  await cas("venu de VOS CLIENTS, le même devis renvoie chez les clients", async () => {
    // La même flèche, le même écran, une autre porte : c'est ce qu'aucune
    // destination écrite d'avance ne savait faire — et c'est la raison des cinq
    // signalements (20 août, 31 août, 7, 8 et 9 septembre).
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    await laFlecheAnnonce(page, "/clients");
  });

  await cas("deux retours de suite reculent de deux écrans, sans tourner en rond", async () => {
    // La boucle du 7 septembre 2026 : deux flèches qui se pointaient l'une
    // l'autre, et aucune sortie (`src/lib/retour-du-devis.ts`).
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    await laFlecheAnnonce(page, "/clients");
    await fleche.click();
    await page.waitForURL(/\/clients\/?$/, { timeout: 30_000 });

    const suivante = page.locator('a[aria-label^="Retour"]').first();
    await suivante.waitFor({ state: "visible", timeout: 30_000 });
    await suivante.click();
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
    assert.equal(chemin(page.url()), "/", `le second retour a mené à ${page.url()}`);
  });

  await cas("SON CAS DU 10 SEPT. : deux fois client → retour, sans quitter la liste", async () => {
    // *« Quand je fais deux fois le geste client → retour puis client → retour,
    // je reviens à la page d'accueil. »*
    //
    // **Deux pièces du même lot se marchaient dessus.** La flèche recule par
    // `router.back()` pour rendre sa place dans la liste ; ce `router.back()`
    // déclenche un `popstate`, et le `popstate` était écouté pour le bouton DU
    // NAVIGATEUR, avec la fonction qui RETIRE un écran. Le journal perdait donc
    // la destination qu'on venait d'atteindre — un pas de trop à chaque retour.
    //
    // **Le contrôle refait le geste QUATRE fois**, pas deux : une version qui
    // ne perdrait un pas qu'une fois sur deux passerait un aller-retour.
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    const clients = await page
      .locator('a[href^="/clients/"]')
      .evaluateAll((liens) =>
        liens
          .map((l) => l.getAttribute("href") ?? "")
          .filter((h) => h.split("/").length === 3)
      );
    if (clients.length < 2) throw new Error(`il faut deux clients, vu ${clients.length}`);

    for (const [rang, href] of [clients[0], clients[1], clients[0], clients[1]].entries()) {
      await page.locator(`a[href="${href}"]`).first().click();
      await page.waitForURL(`${BASE}${href}`, { timeout: 30_000 });
      await laFlecheAnnonce(page, "/clients", FLECHE);

      await page.locator(FLECHE).first().click();
      await page.waitForURL(/\/clients\/?$/, { timeout: 30_000 });
      assert.equal(
        chemin(page.url()),
        "/clients",
        `au tour ${rang + 1}, le retour a déposé sur ${page.url()}`
      );
      // **Et la liste reste sous les pieds** : c'est ce que le journal perdait.
      // Sans ce contrôle-ci, le tour suivant seul dirait qu'il manque un pas.
      await laFlecheAnnonce(page, "/", FLECHE);
    }
  });

  await cas("le bouton DU NAVIGATEUR ne fait pas repartir la flèche en avant", async () => {
    // C'est ce pour quoi l'écoute du `popstate` existe. Elle avait sa moitié de
    // défaut elle aussi : la flèche s'abonnait à l'ÉVÉNEMENT, alors que le
    // journal ne change qu'APRÈS lui — elle gardait donc l'adresse de l'écran
    // qu'on venait de quitter, et proposait d'y retourner.
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    const premier = await page
      .locator('a[href^="/clients/"]')
      .evaluateAll((liens) =>
        liens.map((l) => l.getAttribute("href") ?? "").find((h) => h.split("/").length === 3)
      );
    if (!premier) throw new Error("aucun client dans la liste");
    await page.locator(`a[href="${premier}"]`).first().click();
    await page.waitForURL(`${BASE}${premier}`, { timeout: 30_000 });

    await page.goBack();
    await page.waitForURL(/\/clients\/?$/, { timeout: 30_000 });
    await laFlecheAnnonce(page, "/", FLECHE);
  });

  await cas("SANS page d'avant, l'écran garde la sortie qu'il déclare", async () => {
    // Sa règle du 31 août 2026 : *« je veux tout le temps revenir à cette page
    // et seulement celle-là ! La page fiche client »*. Elle n'est pas abandonnée
    // — elle devient le repli, celui d'un signet ou d'une notification ouverte
    // à froid.
    await arriverAFroid(page, devis);
    await fleche.waitFor({ state: "visible", timeout: 30_000 });
    const cible = await fleche.getAttribute("href");
    assert.ok(
      cible?.startsWith(`/chantiers/${chantierId}/coordonnees`),
      `à froid, la flèche mène à « ${cible} » : sa sortie du 31 août a disparu`
    );
  });

  await cas("recharger ne coûte pas un retour de plus", async () => {
    // Son onglet reste ouvert des heures et son banc redémarre plusieurs fois
    // par soirée (`HANDOVER.md`, piège 0) : si chaque rechargement comptait pour
    // un pas, il faudrait appuyer autant de fois pour sortir.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.goto(devis, { waitUntil: "networkidle" });
    for (let i = 0; i < 3; i++) await page.reload({ waitUntil: "networkidle" });
    await laFlecheAnnonce(page, "/");
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La flèche et la page d'avant — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
