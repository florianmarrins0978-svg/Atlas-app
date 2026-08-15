import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * La pastille d'équipe sur la ligne du planning — geste A.
 *
 * *Retenu par le patron le 14 août 2026 sur
 * `docs/maquettes/52-appliquer-une-equipe.html`, après sa remarque de la
 * veille : « appliquer une équipe à un chantier n'est pas intuitif ».*
 *
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE BASE NE PEUT VOIR :**
 *
 *   · un chantier SANS équipe le DIT sur la ligne — « Équipe ? ». C'est le
 *     cœur de sa plainte : jusqu'ici la ligne n'écrivait rien du tout, et rien
 *     ne signalait qu'il manquait quelqu'un ;
 *   · deux appuis suffisent, contre six auparavant ;
 *   · le retrait fonctionne DEPUIS L'ÉCRAN. La règle serveur est éprouvée à
 *     part (`test-changer-equipe.ts`), et elle serait verte même si le bouton
 *     n'était pas branché — c'est le raccord qui casse, jamais la formule ;
 *   · **« Déplacer » n'a pas disparu avec sa place** : il est dans la feuille
 *     du chevron, et le planning ne redevient pas le cul-de-sac du 8 août.
 *
 * **Deux équipes sont posées en base** : à une seule, le mot « équipe » ne
 * s'écrit nulle part et la pastille n'existe pas (`src/lib/equipes.ts`).
 */

const BASE = "http://localhost:3000";

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

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  // Un chantier posé, sans équipe — l'état exact de sa capture.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const client = `M. Pastille ${Date.now()}`;
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "05 56 00 00 12");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierId = page.url().split("/").pop()!;

  const r = await pool.query(
    `UPDATE chantiers
        SET devis_envoye_at = now(), date_planifiee = CURRENT_DATE + 4,
            creneau_debut = 'matin', duree_demi_journees = 2, equipe_id = NULL
      WHERE id = $1`,
    [chantierId]
  );
  if (r.rowCount !== 1) {
    throw new Error(
      "Le montage n'a pas pu poser la date : le rôle de test ne traverse probablement " +
        "plus RLS (voir CLAUDE.md §5)."
    );
  }
  await pool.query(
    `UPDATE entreprises SET nombre_equipes = 2
      WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
    [chantierId]
  );
  const nom = (await pool.query(`SELECT nom FROM chantiers WHERE id = $1`, [chantierId])).rows[0]
    .nom as string;

  const equipeEnBase = async () =>
    (
      await pool.query(
        `SELECT e.rang FROM chantiers c LEFT JOIN equipes e ON e.id = c.equipe_id WHERE c.id = $1`,
        [chantierId]
      )
    ).rows[0].rang as number | null;

  const allerAuPlanning = async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('h1:has-text("Planning")', { timeout: 30_000 });
  };

  await test("Un chantier sans équipe le dit sur la ligne : « Équipe ? »", async () => {
    await allerAuPlanning();
    const pastille = page.getByRole("button", { name: `Choisir l'équipe — ${nom}` });
    await pastille.scrollIntoViewIfNeeded();
    assert.equal((await pastille.innerText()).trim(), "Équipe ?");
  });

  await test("Deux appuis suffisent à donner une équipe, et la base la porte", async () => {
    await allerAuPlanning();
    await page.getByRole("button", { name: `Choisir l'équipe — ${nom}` }).click();
    await page.waitForSelector("text=Qui s’en occupe", { timeout: 10_000 });
    await page.getByRole("button", { name: /^Équipe B$/ }).click();
    await page.waitForTimeout(900);
    assert.equal(await equipeEnBase(), 2, "l'équipe choisie n'est pas arrivée en base");
  });

  await test("La ligne montre la nouvelle équipe sans rechargement", async () => {
    const pastille = page.getByRole("button", { name: `Changer l'équipe — ${nom}` });
    assert.equal((await pastille.innerText()).trim(), "Équipe B");
  });

  // **Le cas qui n'existait pas avant ce jour.** Une équipe posée ne pouvait
  // plus jamais être défaite, par aucun chemin.
  await test("« Personne pour l'instant » retire l'équipe pour de bon", async () => {
    await allerAuPlanning();
    await page.getByRole("button", { name: `Changer l'équipe — ${nom}` }).click();
    await page.waitForSelector("text=Qui s’en occupe", { timeout: 10_000 });
    await page.getByRole("button", { name: /Personne pour l/ }).click();
    await page.waitForTimeout(900);
    assert.equal(await equipeEnBase(), null, "l'équipe est restée collée au chantier");
    await page.reload({ waitUntil: "domcontentloaded" });
    const pastille = page.getByRole("button", { name: `Choisir l'équipe — ${nom}` });
    await pastille.scrollIntoViewIfNeeded();
    assert.equal((await pastille.innerText()).trim(), "Équipe ?");
  });

  // Elle n'a rien à retirer : la proposer serait offrir un geste sans effet.
  await test("Sans équipe, « Personne pour l'instant » ne s'affiche pas", async () => {
    await allerAuPlanning();
    await page.getByRole("button", { name: `Choisir l'équipe — ${nom}` }).click();
    await page.waitForSelector("text=Qui s’en occupe", { timeout: 10_000 });
    assert.equal(await page.getByRole("button", { name: /Personne pour l/ }).count(), 0);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await page.waitForTimeout(300);
  });

  // **Le planning ne redevient pas un cul-de-sac.** « Déplacer » a quitté la
  // ligne pour la feuille ; s'il n'y était pas, changer une date deviendrait
  // impossible — le défaut du 8 août 2026, en pire.
  await test("« Déplacer » a suivi dans la feuille du chevron", async () => {
    await allerAuPlanning();
    assert.equal(
      await page.getByRole("button", { name: `Déplacer le chantier ${nom}` }).count(),
      0,
      "« Déplacer » ne doit plus encombrer la ligne"
    );
    await page.getByRole("button", { name: `Y aller — ${nom}` }).click();
    await page.waitForSelector("text=Y aller", { timeout: 10_000 });
    assert.equal(
      await page.getByRole("button", { name: `Déplacer le chantier ${nom}` }).count(),
      1,
      "« Déplacer » manque dans la feuille : la seule façon de changer une date a disparu"
    );
  });

  // **LES DEUX CHEMINS DOIVENT FAIRE LA MÊME CHOSE.** Sa question du 14 août :
  // « si on affilie une équipe et qu'au final on change d'avis, on doit pouvoir
  // la retirer ». Le geste existait sur la pastille, pas dans la feuille du
  // chevron — deux portes, deux réponses, et celui qui prend la seconde conclut
  // que c'est impossible. Un écart de ce genre ne se voit pas en relisant.
  await test("Depuis la feuille du chevron aussi, l'équipe se retire", async () => {
    await allerAuPlanning();
    await page.getByRole("button", { name: `Choisir l'équipe — ${nom}` }).click();
    await page.waitForSelector("text=Qui s’en occupe", { timeout: 10_000 });
    await page.getByRole("button", { name: /^Équipe A$/ }).click();
    await page.waitForTimeout(900);
    assert.equal(await equipeEnBase(), 1, "le montage de ce cas n'a pas pris");

    await allerAuPlanning();
    await page.getByRole("button", { name: `Y aller — ${nom}` }).click();
    await page.waitForSelector("text=Y aller", { timeout: 10_000 });
    await page.getByRole("button", { name: /^Équipe/ }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Personne pour l/ }).click();
    await page.waitForTimeout(900);
    assert.equal(await equipeEnBase(), null, "le chevron ne sait pas retirer l'équipe");
  });

  // À une seule équipe, il n'y a personne à désigner — sa règle du 10 août.
  await test("À une seule équipe, la pastille n'existe pas", async () => {
    await pool.query(
      `UPDATE entreprises SET nombre_equipes = 1
        WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
      [chantierId]
    );
    await allerAuPlanning();
    assert.equal(await page.getByRole("button", { name: /l'équipe — / }).count(), 0);
  });

  console.log(`\n${failed === 0 ? "✅" : "❌"} La pastille d'équipe — ${failed} échec(s).`);
  await browser.close();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
