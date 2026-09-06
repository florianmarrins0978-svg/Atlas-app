import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";

// **LA FICHE CLIENT N'A QU'UN VISAGE, AUX DEUX VISITES.**
//
// ─────────────────────────────────────────────────────────────────────────────
// **Sa remarque du 5 septembre 2026, capture à l'appui :** *« J'ai fait nouveau
// chantier. Je suis arrivé sur la page de la fiche client, j'ai dicté mon
// chantier, mais j'ai oublié de remplir les informations de mes clients. Je
// suis ensuite allé sur la page du devis, j'ai rempli mon devis, j'ai fait
// retour, donc je suis arrivé sur la page de la fiche client que je te joins en
// photo. Le problème, c'est que ce n'est pas la même que lorsque j'ai cliqué
// sur nouveau chantier. Tu verras par toi-même que la note vocale a changé. »*
//
// Il avait raison, et c'était mesurable : à la création l'objet est le micro
// vert de la DICTÉE ; au retour du devis, le même écran rendait l'anneau creux
// du LECTEUR, dont le seul geste est « Poussez l'anneau vers le haut » — c'est
// à dire retirer. Un troisième visage existait : quelques jours plus tard,
// l'audio purgé après transcription, l'anneau disparaissait entièrement.
//
// ─────────────────────────────────────────────────────────────────────────────
// **POURQUOI CETTE SUITE, ET PAS UNE ASSERTION AJOUTÉE AILLEURS.** Le défaut ne
// se voit qu'à la SECONDE visite, et seulement si la première a laissé une
// note. Aucune suite ne rejouait cet enchaînement : `test-devis-sans-client-e2e`
// rouvre bien la fiche, mais sur un chantier muet — l'anneau y était donc déjà
// le micro, et son contrôle restait vert pendant que l'écran du patron
// changeait sous ses yeux.
//
// On rejoue donc SON geste (`CLAUDE.md` §5 quater) : il crée, il dicte, il
// envoie. Le micro est simulé par Chromium — la dictée part pour de bon.
//
// **Ce que cette suite ne peut pas rejouer ici**, et il faut le dire : après
// l'avion, la chaîne du devis démarre seule et le dépose sur le devis. Sans clé
// d'IA sur ce poste, elle s'arrête et personne ne fait le chemin. On ouvre donc
// le devis à l'adresse, puis **on appuie sur SA flèche de retour** — celle-là
// est bien la sienne, et c'est elle qui ramène sur la fiche.

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

/** Le geste de dictée, tel qu'il se présente : le micro plein, appuyable. */
const DICTER = 'button[aria-label="Dicter une note vocale"]';
/** Le lecteur — l'anneau creux de la fiche du CHANTIER. Il n'a rien à faire ici. */
const ECOUTER = 'button[aria-label="Écouter la note vocale"]';

async function main() {
  console.log("=== La fiche client, à la création puis au retour du devis ===\n");

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

  // ── PREMIÈRE VISITE : « nouveau chantier ». Il ne remplit rien, il dicte. ──
  //
  // **Le nom sert à RETROUVER le chantier, pas à éprouver la saisie.** Sans
  // lui, on lisait « la dernière note écrite » — et une note laissée par la
  // batterie d'avant emmenait la suite entière sur un autre chantier, avec des
  // rouges qui accusaient l'écran. Payé le 5 septembre 2026.
  const NOM = `Visage ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', NOM);
  await page.locator(DICTER).waitFor({ state: "visible", timeout: 30_000 });

  await cas("À LA CRÉATION : la fiche porte le micro de la dictée", async () => {
    assert.equal(await page.locator(DICTER).count(), 1, "le geste de dictée n'est pas sur la fiche neuve");
    assert.equal(await page.locator(ECOUTER).count(), 0, "un lecteur sur un chantier qui n'a rien dicté");
  });

  await page.locator(DICTER).click();
  await page.locator('[data-atlas="dictee-envoyer"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2200);
  await page.locator('[data-atlas="dictee-envoyer"]').click();

  // **Le chantier est né de ce geste** (`assurerChantier`) : son identifiant
  // n'est nulle part à l'écran, la fiche ne change pas d'adresse. On le lit donc
  // là où la note vient de s'écrire — c'est un constat, pas un état fabriqué.
  let chantierId: string | null = null;
  for (let essai = 0; essai < 60 && !chantierId; essai++) {
    const { rows } = await pool.query<{ id: string }>(
      `select c.id from chantiers c
         join clients cl on cl.id = c.client_id
         join notes_vocales n on n.chantier_id = c.id
        where cl.nom = $1
        limit 1`,
      [NOM]
    );
    chantierId = rows[0]?.id ?? null;
    if (!chantierId) await page.waitForTimeout(500);
  }
  assert.ok(chantierId, "la dictée ne s'est pas enregistrée : le reste de cette suite n'éprouverait rien");

  // ── SECONDE VISITE : il ouvre son devis, puis fait retour. ────────────────
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  const retour = page.locator('[data-atlas="retour-du-devis"]');
  await retour.waitFor({ state: "visible", timeout: 45_000 });
  await retour.click();
  await page.waitForURL(/\/coordonnees/, { timeout: 45_000 });
  await page.locator("form").first().waitFor({ state: "visible", timeout: 30_000 });

  await cas("AU RETOUR DU DEVIS : c'est le MÊME objet, pas le lecteur", async () => {
    assert.equal(
      await page.locator(ECOUTER).count(),
      0,
      "la fiche rouverte montre l'anneau du lecteur : c'est l'écran qu'il ne reconnaît pas"
    );
    assert.equal(
      await page.locator(DICTER).count(),
      1,
      "la fiche rouverte n'a plus son micro : elle a encore changé de visage"
    );
  });

  await cas("et elle n'invite plus à parler par-dessus ce qu'il a dicté", async () => {
    // Sa règle du 1ᵉʳ septembre 2026 : *« la phrase "appuyez et décrivez le
    // chantier" doit disparaître, sinon ça incite à appuyer »*. Une seconde
    // dictée remplace la première — l'objet reste appuyable, il ne le réclame
    // pas.
    const ecran = await page.locator("form").first().innerText();
    assert.ok(
      !ecran.includes("Appuyez et décrivez"),
      "l'écran invite à dicter sur un chantier qui porte déjà sa note"
    );
  });

  await cas("L'AUDIO PURGÉ, L'ANNEAU RESTE — il ne disparaît plus au bout de quelques jours", async () => {
    // La clé de l'audio est mise à `null` après purge (`audios_a_purger`,
    // `docs/RGPD.md` §4). L'ancienne fiche retirait alors l'anneau ENTIER : un
    // troisième visage, celui-là silencieux. Le cas ne s'obtient pas au geste —
    // il faut attendre des jours —, d'où cette écriture, qui reproduit
    // exactement ce que la purge laisse derrière elle.
    await pool.query("update notes_vocales set storage_key = null where chantier_id = $1", [chantierId]);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page.locator(DICTER).count(),
      1,
      "l'anneau a disparu de la fiche client : l'écran a maigri sans que rien ne le dise"
    );
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La fiche client, un seul visage — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
