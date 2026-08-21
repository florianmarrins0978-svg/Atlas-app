import assert from "node:assert/strict";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * Enregistrer une pièce depuis la fiche du client.
 *
 * *Le patron, le 21 août 2026 :* **« Alors oui, je veux pouvoir l'enregistrer,
 * mais avant que tu codes quoi que ce soit, fais-moi une maquette visuelle. »**
 * Trois dosages lui ont été dessinés (`docs/maquettes/83-enregistrer-le-pdf.html`) ;
 * il a retenu **la C** : un appui ouvre une feuille — Enregistrer, Ouvrir, Partager.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VOIT.**
 *
 * Le défaut du 7 août 2026 — *« quand je clique sur télécharger le PDF, ça me
 * propose pas de l'enregistrer, ça ouvre juste une page de plus »* — tient à
 * TROIS conditions réunies, et aucune ne suffit seule. Elles sont éprouvées sur
 * la facture (`test-facture-au-client-e2e.ts`) ; il n'existait rien pour la
 * fiche du client, où vivent pourtant tous ses documents rangés.
 *
 * Une suite qui se contenterait de compter les boutons resterait verte le jour
 * où l'une des trois saute — et c'est lui qui le découvrirait, un fichier sans
 * nom dans son dossier.
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

async function main() {
  console.log("=== Enregistrer une pièce depuis la fiche du client ===\n");

  // **Un client qui a VRAIMENT un devis parti.** La colonne « Devis » ne retient
  // que le statut `envoye` : prendre un client au hasard donnerait une colonne
  // vide, et la suite accuserait la feuille de ne pas s'ouvrir.
  const { rows } = await pool.query(
    `SELECT c.client_id
       FROM devis d
       JOIN chantiers c ON c.id = d.chantier_id
      WHERE d.statut = 'envoye' AND c.client_id IS NOT NULL AND c.deleted_at IS NULL
      LIMIT 1`
  );
  const clientId = rows[0]?.client_id as string | undefined;
  if (!clientId) throw new Error("aucun client avec un devis parti dans le jeu de démonstration");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="piece"]', { timeout: 30_000 });

  await cas("un appui n'ouvre plus le PDF d'office : il propose", async () => {
    // **Le cœur de son choix.** La proposition A téléchargeait au premier
    // contact ; il a retenu celle qui ne décide de rien. L'adresse ne doit donc
    // pas bouger, et la feuille s'ouvrir par-dessus la fiche.
    const avant = page.url();
    await page.locator('[data-atlas="piece"]').first().click();
    await page.waitForSelector('[data-atlas="piece-enregistrer"]', { timeout: 20_000 });
    assert.equal(page.url(), avant, "l'appui a quitté la fiche du client");
  });

  await cas("LES TROIS CONDITIONS de « Enregistrer », réunies", async () => {
    const lien = page.locator('[data-atlas="piece-enregistrer"]');

    // 1 — le serveur doit poser `attachment`, sinon Chrome affiche.
    const href = (await lien.getAttribute("href")) ?? "";
    assert.match(
      href,
      /telecharger=1/,
      `le lien sert le PDF en aperçu (« ${href} ») : le navigateur l'affichera au lieu de l'enregistrer`
    );

    // 2 — le NOM, sinon Safari nomme le fichier d'après la page, sans extension.
    const nom = (await lien.getAttribute("download")) ?? "";
    assert.match(
      nom,
      /^(devis|facture|fiche-chantier)-.+\.pdf$/,
      `le lien n'annonce aucun nom de fichier utilisable (« ${nom} »)`
    );

    // 3 — pas d'onglet neuf, sinon Safari affiche au lieu de proposer.
    assert.equal(
      await lien.getAttribute("target"),
      null,
      "le lien ouvre un onglet : Safari y affichera le PDF au lieu de proposer de l'enregistrer"
    );
  });

  await cas("« Ouvrir » fait l'INVERSE, et c'est ce qui le distingue", async () => {
    // Si les deux gestes servaient la même adresse, l'un des deux mentirait.
    const ouvrir = page.locator('[data-atlas="piece-ouvrir"]');
    const href = (await ouvrir.getAttribute("href")) ?? "";
    assert.ok(
      !href.includes("telecharger=1"),
      `« Ouvrir » demande un téléchargement (« ${href} ») : les deux gestes font la même chose`
    );
    assert.equal(
      await ouvrir.getAttribute("target"),
      "_blank",
      "« Ouvrir » remplace la fiche du client : il faudrait y revenir à la main"
    );
  });

  await cas("« Partager » est là — il avait disparu de l'écran d'envoi", async () => {
    assert.equal(
      await page.locator('[data-atlas="piece-partager"]').count(),
      1,
      "« Partager » manque : c'est le seul chemin vers WhatsApp"
    );
  });

  await cas("la feuille se referme sans rien engager", async () => {
    await page.getByRole("button", { name: "Annuler" }).click();
    await page.waitForSelector('[data-atlas="piece-enregistrer"]', { state: "hidden", timeout: 15_000 });
    assert.equal(
      await page.locator('[data-atlas="piece"]').first().isVisible(),
      true,
      "la fiche du client n'est pas revenue"
    );
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? `\n✅ Enregistrer une pièce — ${reussis} réussis, 0 échec.\n`
      : `\n❌ Enregistrer une pièce — ${echecs} échec(s).\n`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
