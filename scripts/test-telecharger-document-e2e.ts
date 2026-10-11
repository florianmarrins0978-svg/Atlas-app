import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";
import { messageDeTelechargementRate } from "../src/lib/remise-de-fichier";

/**
 * « Télécharger » : le fichier descend — et quand il ne descend pas, ON LE DIT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE PROTÈGE, ET QU'AUCUNE AUTRE NE VOYAIT.**
 *
 * Trois fois de suite, le même bouton : *« quand je clique sur télécharger ça
 * ne la télécharge pas »* (7 septembre), *« page blanche »* (10 septembre),
 * *« je peux plus télécharger en cliquant sur télécharger »* (12 septembre). À
 * chaque fois, les contrôles interrogeaient le SERVEUR — en-tête, type, octets
 * — et le serveur avait raison. Ce que personne ne regardait, c'est ce que la
 * page fait de la réponse, et ce qu'elle en dit quand il n'y en a pas.
 *
 * Un lien ne rapporte rien : la route refuse, le navigateur reçoit un `404` en
 * JSON, et l'écran reste identique. « Rien ne se passe » se lit alors comme un
 * bouton cassé, et c'est la moitié du problème qui a coûté trois soirées.
 *
 * **Le contrôle du refus vaut autant que celui du succès** : c'est lui qui
 * garantit qu'un défaut futur aura une phrase, au lieu d'un silence
 * (`AGENTS.md` — un défaut muet se rend bavard avant d'être corrigé).
 *
 * Ce qui ne se prouve pas ici, et qui s'écrit comme tel : la feuille de partage
 * d'iOS. Aucun WebKit n'est installable dans l'environnement de l'agent ;
 * Chromium prend la seconde voie, le lien d'objet local. C'est donc SON
 * téléphone qui tranche pour la première.
 */

const BASE = ADRESSE;

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
  console.log("=== Télécharger un document : il descend, ou l'écran le dit ===\n");

  // Un chantier dont le devis est parti : la facture s'y crée en un appui, et
  // c'est l'écran exact de sa capture du 12 septembre.
  const { rows } = await pool.query(
    `SELECT c.id
       FROM devis d
       JOIN chantiers c ON c.id = d.chantier_id
      WHERE d.statut = 'envoye' AND c.deleted_at IS NULL
      LIMIT 1`
  );
  const chantierId = rows[0]?.id as string | undefined;
  if (!chantierId) throw new Error("aucun chantier avec un devis parti dans le jeu de démonstration");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  const creer = page.getByRole("button", { name: /Créer la facture/i });
  if (await creer.count()) {
    await creer.click();
    await page.waitForSelector('[data-atlas="telecharger-facture"]', { timeout: 45_000 });
  }

  const geste = page.locator('[data-atlas="telecharger-facture"]');
  await cas("le geste est là, et il se vise au doigt", async () => {
    assert.equal(await geste.count(), 1, "rien ne permet de télécharger la facture");
    const boite = await geste.boundingBox();
    // Refuser de conclure sur une boîte de zéro pixel (`CLAUDE.md` §5).
    assert.ok(boite && boite.width > 0 && boite.height > 0, "le geste n'a aucune dimension");
  });

  await cas("un appui fait DESCENDRE le fichier, non vide, sous le nom de la facture", async () => {
    const descente = page.waitForEvent("download", { timeout: 30_000 });
    await geste.click();
    const fichier = await descente.catch(() => null);
    assert.ok(fichier, "l'appui n'a fait descendre aucun fichier");
    assert.match(
      fichier.suggestedFilename(),
      /^F\d{4}-\d+(-brouillon)?\.pdf$/,
      `le fichier descend sous « ${fichier.suggestedFilename()} » : il ne se retrouve pas dans son dossier`
    );
    const octets = readFileSync(await fichier.path());
    assert.ok(octets.length > 0, "le fichier descendu est vide");
    // Un fichier non vide peut n'être qu'une page d'erreur enregistrée.
    assert.equal(octets.subarray(0, 5).toString("ascii"), "%PDF-", "ce qui descend n'est pas un PDF");
  });

  await cas("le libellé revient : le bouton ne reste pas sur « Un instant… »", async () => {
    const libelle = (await geste.innerText()).trim();
    assert.match(libelle, /^Télécharger \(/, `le bouton dit « ${libelle} » une fois le fichier parti`);
  });

  await cas("QUAND LA ROUTE REFUSE, L'ÉCRAN LE DIT — le silence d'avant", async () => {
    // **Le refus est provoqué, jamais attendu.** Un contrôle qui n'a jamais vu
    // rouge ne prouve rien (`AGENTS.md`) : on coupe la route, exactement comme
    // le ferait une session expirée ou un archivé disparu.
    await page.route("**/api/factures/**/pdf?*", (voie) =>
      voie.fulfill({ status: 404, contentType: "application/json", body: '{"error":"Introuvable"}' })
    );
    await geste.click();
    const alerte = page.locator('[role="alert"]', { hasText: messageDeTelechargementRate(404) });
    await alerte.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    assert.equal(
      await alerte.count(),
      1,
      "la route a refusé et l'écran n'a rien dit : c'est le silence qui a coûté trois soirées"
    );
    await page.unroute("**/api/factures/**/pdf?*");
  });

  console.log(
    echecs === 0
      ? `\n✅ Télécharger un document — ${reussis} réussi(s), 0 échec.`
      : `\n❌ Télécharger un document — ${echecs} échec(s).`
  );
  await navigateur.close();
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
