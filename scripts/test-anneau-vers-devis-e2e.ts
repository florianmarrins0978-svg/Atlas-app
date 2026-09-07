import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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
  // Le nom est RETENU : la feuille des portes se désigne par lui, et un
  // chevron pris au hasard sur le planning ouvrirait le chantier d'à côté.
  const nomChantier = `Anneau devis ${Date.now()}`;
  await page.fill('input[placeholder="Bernard"]', nomChantier);
  const chantierId = await creerPuisFiche(page);
  // **LE PARCOURS A DÉMÉNAGÉ SUR LA FICHE CLIENT — 4 septembre 2026.**
  //
  // L'anneau vivait au milieu de la fiche du chantier ; celle-ci est retirée
  // (`ARCHITECTURE.md` §254) parce qu'elle montrait une seconde fois ce que la
  // fiche client porte déjà. Sa question du 11 août, elle, ne bouge pas :
  // *« si je clique dessus, j'arrive directement à la page du devis et je ne
  // passe pas par une page intermédiaire ? »*
  const fiche = `${BASE}/chantiers/${chantierId}/coordonnees`;
  await page.goto(fiche, { waitUntil: "networkidle" });

  // **CE QU'ON GUETTE A CHANGÉ DE NOM, PAS DE FONCTION.** Sur la fiche du
  // chantier, il fallait toucher « Mon devis » sous l'anneau. Sur la fiche
  // client, sa demande du 30 août commande : *« appuyer sur la flèche pour
  // envoyer de suite la transcription et arriver sur la page du devis »* — la
  // chaîne part seule (`auto`), et ce qui paraît sous l'anneau n'est plus un
  // bouton mais **ce qui se passe**. Un déclencheur de moins entre lui et son
  // devis, ce qui est la direction de tout ce parcours depuis le 11 août.
  const monDevis = page.locator('[data-atlas="preparation-automatique"]');
  // **Le micro, et non plus l'anneau creux** — 30 août 2026. Le repos est
  // désormais le disque plein qu'il a choisi (repos B), et l'envoi ne se fait
  // plus au second appui : il a son bouton, l'avion. Ce contrôle vise donc les
  // marques STABLES (`data-atlas`) plutôt qu'une classe de dessin, pour qu'un
  // prochain habillage ne le fasse pas rougir sur du code juste
  // (`CLAUDE.md` §5 bis).
  const micro = page.locator('[data-atlas="anneau-note-vocale"] .atlas-micro');
  const avion = page.locator('[data-atlas="dictee-envoyer"]');

  await cas("sur un chantier neuf, la chaîne ne s'annonce pas", async () => {
    assert.equal(
      await monDevis.count(),
      0,
      "la chaîne s'annonce sans dictée : elle n'aurait rien à préparer"
    );
  });

  await cas("la dictée la fait naître, sous l'anneau", async () => {
    await micro.click();
    await page.waitForTimeout(700);
    await page.waitForTimeout(2200);
    // **C'est l'avion qui envoie, plus l'arrêt.** Sa demande du 30 août 2026 :
    // arrêter gardait la note et l'envoyait du même geste ; celui qui avait
    // laissé courir le micro envoyait quand même.
    await avion.click();

    await monDevis.waitFor({ state: "visible", timeout: 60_000 });

    // **Sous l'anneau, pas ailleurs.** C'est la forme qu'il a choisie ; posé
    // au-dessus ou à côté, ce ne serait plus la maquette qu'il a validée.
    const boiteAnneau = await page.locator('[data-atlas="anneau-note-vocale"]').boundingBox();
    const boiteDevis = await monDevis.boundingBox();
    assert.ok(boiteAnneau && boiteDevis, "l'anneau ou l'annonce n'a pas de place à l'écran");
    assert.ok(
      boiteDevis.y > boiteAnneau.y,
      "l'annonce n'est pas sous l'anneau : la forme choisie la pose dessous"
    );
  });

  // **Sans service de transcription raccordé, la chaîne DIT pourquoi elle
  // s'arrête.** C'est l'état réel de l'application au 11 août 2026 : aucun
  // contrat n'est signé (`TODO.md`, décision n°1), et le fournisseur `dev`
  // recopie une simulation. Ce que le patron verrait aujourd'hui, c'est cette
  // phrase — et il vaut mieux qu'elle soit éprouvée, parce qu'un travail qui
  // s'arrête SANS RIEN DIRE se lit comme une panne.
  //
  // **Plus rien à toucher, et c'est la seule différence** : la chaîne est
  // partie seule avec l'avion (sa demande du 30 août). L'attente reste la même.
  await cas("sans service de transcription, elle dit pourquoi elle s'arrête", async () => {
    const raison = page.locator("text=/pas été transcrite|aucun prestataire/i").first();
    await raison.waitFor({ state: "visible", timeout: 120_000 });
    assert.ok(
      page.url().startsWith(fiche),
      `on a quitté la fiche client alors que rien ne pouvait être préparé — ${page.url()}`
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
    // **PLUS AUCUN APPUI, ET C'EST LE PROGRÈS — sa demande du 30 août 2026.**
    //
    // Il fallait toucher « Mon devis » sous l'anneau, sur la fiche du chantier.
    // Cette fiche est retirée (`ARCHITECTURE.md` §254) et l'anneau vit sur la
    // fiche client, où la chaîne part SEULE : *« appuyer sur la flèche pour
    // envoyer de suite la transcription et arriver sur la page du devis »*.
    //
    // Sa question du 11 août, elle, ne bouge pas — *« j'arrive directement à la
    // page du devis et je ne passe pas par une page intermédiaire ? »* —, et
    // c'est exactement ce que la suite de ce cas éprouve. Un déclencheur de
    // moins entre lui et son devis.
    const avant = fiche;
    await page.goto(fiche, { waitUntil: "networkidle" });

    // **L'arrêt d'avant-chiffrage, franchi SANS quitter la fiche.**
    //
    // La dictée d'essai ne dit ni la longueur de la haie ni le diamètre du
    // tronc — les deux seules choses qui font le prix. Atlas s'arrête donc et
    // demande, et c'est délibéré : chiffrer sans savoir, c'est se tromper du
    // simple au double. Ce que le patron a exigé, ce n'est pas l'absence
    // d'arrêt, c'est l'absence d'ÉCRAN de plus — et c'est ce qu'on éprouve
    // ici : les questions s'ouvrent sur la fiche, on répond, la chaîne repart.
    const questions = page.locator('[data-atlas="question-chiffrage"]').first();
    // **`any` et non `race` :** l'une des deux attentes n'aboutira JAMAIS —
    // selon que la chaîne s'annonce ou qu'elle a déjà emmené. `race` échoue
    // sur la première qui expire, `any` réussit sur la première qui aboutit.
    await Promise.any([
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

  // ─── DEUX CAS DU TIROIR ONT ÉTÉ REMPLACÉS PAR UN SEUL, ET PLUS PROFOND ────
  //
  // « le tiroir ne garde que ce qui reste à faire à la main » et « une fois le
  // devis parti, le tiroir mène au document » éprouvaient le tiroir de la fiche
  // du chantier. **Cet écran est retiré le 4 septembre 2026**
  // (`ARCHITECTURE.md` §254) : le tiroir avec.
  //
  // Ce qu'ils défendaient de vivant tient en une phrase, et elle n'a pas
  // changé : **un devis parti ne doit jamais devenir injoignable.** C'est ce
  // qu'il signalait le 8 août — *« il se range dans les chantiers planifiés,
  // mais comment moi je fais pour avoir accès au devis ? »*. Le second de ces
  // deux cas était d'ailleurs né d'un trou creusé par un allègement précédent :
  // c'est précisément le risque de celui-ci.
  //
  // **Le contrôle suit donc SON chemin, pas une porte de service**
  // (`CLAUDE.md` §5 quater) : le signet qu'il a gardé sur l'ancienne fiche.
  await cas("un devis parti reste joignable, par le planning", async () => {
    await pool.query(
      "update chantiers set devis_genere_at = now(), devis_envoye_at = now() where id = $1",
      [chantierId]
    );

    // Son signet d'hier sur la fiche retirée : il ne rend pas un 404, il mène
    // là où le travail en est — le planning, où ce chantier attend sa date.
    await page.goto(`${BASE}/chantiers/${chantierId}`, { waitUntil: "networkidle" });
    assert.match(
      page.url(),
      /\/planning/,
      `l'ancienne adresse ne mène pas au planning — ${page.url()}`
    );

    // Et sa ligne y porte une porte vers son devis. Sans elle, un chantier
    // sans date serait un cul-de-sac : « À planifier » n'avait AUCUN lien
    // jusqu'au 4 septembre.
    const tiroir = page.locator('[data-atlas="tiroir-planning"]');
    await tiroir.waitFor({ state: "visible", timeout: 20_000 });
    // La poignée : elle ouvre le tiroir, elle ne mène nulle part.
    await tiroir.locator("button").first().click();
    // **CE chantier-ci, désigné par son nom.** Le planning en porte d'autres —
    // le jeu de démonstration en pose plusieurs —, et un chevron pris au hasard
    // ouvrirait les portes du voisin : le contrôle serait alors vert ou rouge
    // sans rapport avec ce qu'il éprouve.
    //
    // On vise la MARQUE UNIQUE du nom plutôt que le nom entier : le chantier
    // prend celui de son client, mais la règle qui le compose (`nom-chantier.ts`)
    // est libre de l'habiller — « Chez … » l'a fait, puis ne l'a plus fait.
    const chevron = page.getByRole("button", {
      name: new RegExp(`Ouvrir le chantier — .*${nomChantier.split(" ").pop()}`),
    });
    await chevron.waitFor({ state: "visible", timeout: 20_000 });
    await chevron.click();
    const versLeDevis = page.locator(`a[href="/chantiers/${chantierId}/export"]`);
    await versLeDevis.waitFor({ state: "visible", timeout: 20_000 });

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
