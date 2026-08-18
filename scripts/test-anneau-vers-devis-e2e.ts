import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// **« En une touche, on fait tout ça, et on arrive sur la page du devis. »**
//
// Le patron, le 11 août 2026. Il a essayé six formes du déclencheur et retenu
// la première — l'écriture nue sous l'anneau —, puis posé la question qui
// décidait de tout : *« si je clique dessus, j'arrive directement à la page du
// devis et je ne passe pas par une page intermédiaire ? »*
//
// Ce que cette suite tient, et qui ne doit jamais se défaire :
//
//   1. sur un chantier NEUF, « Mon devis » **n'existe pas** — il n'y a rien à
//      envoyer, et un déclencheur qui ne déclenche rien est un bouton en panne ;
//   2. la dictée le fait naître, **sous l'anneau**, sans recharger la page ;
//   3. un seul appui mène **au devis complet**, sans écran intermédiaire —
//      c'est sa question, mot pour mot ;
//   4. la transcription a été lancée **par la chaîne**, sans qu'il aille la
//      déclencher ailleurs : c'était le maillon manquant ;
//   5. **rien n'est parti au client.** L'arrêt avant l'envoi reste entier.
//
// La dictée simulée passe par le fournisseur `dev`, qui recopie mot à mot : le
// devis peut donc rester sans prix, et ce n'est pas un défaut. Ce qu'on éprouve
// ici est le PARCOURS — que chaque maillon appelle le suivant.

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
  console.log("=== De l'anneau au devis, en une touche ===\n");

  const navigateur = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${MICRO_SIMULE}`,
    ],
  });
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Anneau devis ${Date.now()}`);
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const fiche = page.url();
  const chantierId = fiche.split("/").pop()!;
  await page.goto(fiche, { waitUntil: "networkidle" });

  const monDevis = page.locator('[data-atlas="mon-devis"]');
  const anneau = page.locator('[data-atlas="anneau-note-vocale"] .atlas-anneaux');

  await cas("sur un chantier neuf, « Mon devis » n'existe pas", async () => {
    assert.equal(
      await monDevis.count(),
      0,
      "le déclencheur est là sans dictée : il n'aurait rien à envoyer"
    );
  });

  await cas("la dictée le fait naître, sous l'anneau", async () => {
    await anneau.click();
    await page.waitForTimeout(700);
    await page.waitForTimeout(2200);
    await anneau.click();

    await monDevis.waitFor({ state: "visible", timeout: 60_000 });

    // **Sous l'anneau, pas ailleurs.** C'est la forme qu'il a choisie ; posé
    // au-dessus ou à côté, ce ne serait plus la maquette qu'il a validée.
    const boiteAnneau = await page.locator('[data-atlas="anneau-note-vocale"]').boundingBox();
    const boiteDevis = await monDevis.boundingBox();
    assert.ok(boiteAnneau && boiteDevis, "l'anneau ou le déclencheur n'a pas de place à l'écran");
    assert.ok(
      boiteDevis.y > boiteAnneau.y,
      "« Mon devis » n'est pas sous l'anneau : la forme choisie le pose dessous"
    );
  });

  // **Sans service de transcription raccordé, le geste DIT pourquoi il
  // s'arrête.** C'est l'état réel de l'application au 11 août 2026 : aucun
  // contrat n'est signé (`TODO.md`, décision n°1), et le fournisseur `dev`
  // recopie une simulation. Ce que le patron verrait aujourd'hui en appuyant,
  // c'est cette phrase — et il vaut mieux qu'elle soit éprouvée, parce qu'un
  // geste qui ne fait rien SANS RIEN DIRE se lit comme une panne.
  await cas("sans service de transcription, il dit pourquoi il s'arrête", async () => {
    await monDevis.click();
    const raison = page.locator("text=/pas été transcrite|aucun prestataire/i").first();
    await raison.waitFor({ state: "visible", timeout: 120_000 });
    assert.ok(
      page.url().endsWith(`/chantiers/${chantierId}`),
      "on a quitté la fiche alors que rien ne pouvait être préparé"
    );
  });

  await cas("la transcription a été lancée par la chaîne, pas à la main", async () => {
    const { rows } = await pool.query(
      "select transcription from notes_vocales where chantier_id = $1",
      [chantierId]
    );
    assert.ok(rows[0], "aucune note vocale en base : la dictée ne s'est pas enregistrée");
    assert.ok(
      (rows[0].transcription ?? "").trim().length > 0,
      "la note n'a pas de transcription : le maillon que la chaîne doit lancer elle-même n'a pas joué"
    );
  });

  // **La question du patron, éprouvée pour de bon.**
  //
  // *« Si je clique dessus, j'arrive directement à la page du devis et je ne
  // passe pas par une page intermédiaire ? »*
  //
  // Pour y répondre il faut une dictée que l'application accepte de lire — le
  // refus ci-dessus se déclenche sur le PRÉFIXE que pose le fournisseur de
  // simulation (`estTranscriptionSimulee`). On écrit donc en base la dictée
  // qu'un vrai service aurait rendue. Ce n'est pas contourner le contrôle
  // précédent : c'est éprouver l'autre moitié du parcours, celle que cet
  // environnement ne peut pas produire lui-même (`AGENTS.md`).
  const DICTEE =
    "Taille de haie de laurier, 20 mètres linéaires. Chêne mort à démonter. " +
    "Couper le bois en 50, le laisser sur place. J'estime le temps de travaux à " +
    "2 jours, 2 hommes, un camion à broyeur et une fendeuse.";

  await cas("avec une dictée lisible, un appui mène AU DEVIS, sans écran intermédiaire", async () => {
    await pool.query("update notes_vocales set transcription = $1 where chantier_id = $2", [
      DICTEE,
      chantierId,
    ]);
    await page.goto(fiche, { waitUntil: "networkidle" });
    await monDevis.waitFor({ state: "visible", timeout: 30_000 });

    const avant = page.url();
    await monDevis.click();

    // **L'arrêt d'avant-chiffrage, franchi SANS quitter la fiche.**
    //
    // La dictée d'essai ne dit ni la longueur de la haie ni le diamètre du
    // tronc — les deux seules choses qui font le prix. Atlas s'arrête donc et
    // demande, et c'est délibéré : chiffrer sans savoir, c'est se tromper du
    // simple au double. Ce que le patron a exigé, ce n'est pas l'absence
    // d'arrêt, c'est l'absence d'ÉCRAN de plus — et c'est ce qu'on éprouve
    // ici : les questions s'ouvrent sur la fiche, on répond, la chaîne repart.
    const questions = page.locator("text=/précisions? avant de chiffrer/i").first();
    await Promise.race([
      questions.waitFor({ state: "visible", timeout: 120_000 }),
      page.waitForURL(/\/devis-complet$/, { timeout: 120_000 }),
    ]);

    if (await questions.count()) {
      assert.equal(
        page.url(),
        avant,
        "l'arrêt d'avant-chiffrage a changé d'écran : le patron voulait qu'il s'ouvre sur la fiche"
      );
      const champs = page.locator('input[type="number"]');
      const combien = await champs.count();
      assert.ok(combien > 0, "l'arrêt ne propose aucun champ : impossible de répondre");
      for (let i = 0; i < combien; i++) await champs.nth(i).fill("20");
      await page.getByRole("button", { name: /Continuer vers le devis|Continuer sans répondre/i }).click();
    }

    // La chaîne range, chiffre et rédige : c'est long, et c'est normal. Ce
    // qu'on éprouve, c'est qu'elle ARRIVE — et qu'elle n'a posé aucun écran
    // entre le geste et le devis.
    await page.waitForURL(/\/devis-complet$/, { timeout: 120_000 });
    await page.waitForSelector("text=DEVIS", { timeout: 30_000 });
    assert.equal(
      page.url(),
      `${BASE}/chantiers/${chantierId}/devis-complet`,
      `le geste a mené ailleurs que sur le devis de ce chantier (parti de ${avant})`
    );
  });

  await cas("rien n'est parti au client", async () => {
    const { rows } = await pool.query(
      `select c.devis_envoye_at, (select count(*) from envois_devis e where e.chantier_id = c.id) as envois
         from chantiers c where c.id = $1`,
      [chantierId]
    );
    assert.equal(rows[0].devis_envoye_at, null, "le devis a été marqué envoyé : l'arrêt avant l'envoi a sauté");
    assert.equal(Number(rows[0].envois), 0, "un envoi a été créé : le devis est parti chez le client");
  });

  // **Le tiroir allégé, et ce qui doit y survivre.**
  //
  // Retirer « Informations », « Prix » et « Devis » était sa demande. Les trois
  // décrivent un travail que la chaîne fait seule. Mais alléger, c'est
  // déplacer : la note vocale et la rédaction à la main restent, sans quoi on
  // ne pourrait ni réécouter, ni écrire son devis soi-même.
  await cas("le tiroir ne garde que ce qui reste à faire à la main", async () => {
    await page.goto(fiche, { waitUntil: "networkidle" });
    const tiroir = page.locator('[data-atlas="tiroir-fiche"]');
    assert.equal(await tiroir.count(), 1, "le tiroir a disparu de la fiche");

    for (const [quoi, href] of [
      ["la note vocale", "/note-vocale"],
      ["la rédaction à la main", "/devis-complet"],
    ] as const) {
      assert.ok(
        await tiroir.locator(`a[href*="${href}"]`).count(),
        `${quoi} a disparu du tiroir : alléger l'a supprimée au lieu de la déplacer`
      );
    }
    for (const [quoi, href] of [
      ["les informations", "/informations"],
      ["le prix", "/prix"],
    ] as const) {
      assert.equal(
        await tiroir.locator(`a[href$="${href}"]`).count(),
        0,
        `${quoi} est encore dans le tiroir : c'est un travail que la chaîne fait désormais seule`
      );
    }
  });

  // **Le devis d'un chantier dont le devis est PARTI reste joignable.**
  //
  // Le trou que ce contrôle bouche a été creusé, puis trouvé par une suite —
  // pas à la lecture. En retirant « Devis » du tiroir, on retirait aussi le
  // seul chemin vers le document une fois celui-ci envoyé : « Mon devis », lui,
  // disparaît à ce moment-là, puisqu'il n'y a plus rien à préparer.
  //
  // La ligne revient donc dès qu'un devis existe. Elle n'annonce alors plus une
  // besogne — elle mène au document.
  await cas("une fois le devis parti, le tiroir mène au document", async () => {
    await pool.query(
      "update chantiers set devis_genere_at = now(), devis_envoye_at = now() where id = $1",
      [chantierId]
    );
    await page.goto(fiche, { waitUntil: "networkidle" });
    const tiroir = page.locator('[data-atlas="tiroir-fiche"]');
    assert.ok(
      await tiroir.locator(`a[href$="/export"]`).count(),
      "le devis envoyé n'est joignable depuis aucune ligne du tiroir : le document est perdu de vue"
    );
    assert.equal(
      await page.locator('[data-atlas="mon-devis"]').count(),
      0,
      "« Mon devis » propose encore de préparer un devis déjà parti chez le client"
    );
    // On remet l'état d'avant : les contrôles suivants parlent d'un chantier
    // dont rien n'est parti, et se mentiraient sur un chantier qu'on vient de
    // marquer envoyé.
    await pool.query(
      "update chantiers set devis_genere_at = null, devis_envoye_at = null where id = $1",
      [chantierId]
    );
  });

  // **Les écrans retirés du tiroir restent joignables.** Les ôter d'une liste
  // n'est pas les supprimer : un signet, un lien profond, une suite existante
  // ne doivent pas tomber dans le vide.
  await cas("les écrans retirés du tiroir répondent toujours à leur adresse", async () => {
    for (const chemin of ["/informations", "/prix"]) {
      const r = await page.goto(`${BASE}/chantiers/${chantierId}${chemin}`, {
        waitUntil: "domcontentloaded",
      });
      assert.equal(
        r?.status(),
        200,
        `${chemin} ne répond plus : retirer une ligne du tiroir a condamné l'écran`
      );
    }
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} De l'anneau au devis — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
