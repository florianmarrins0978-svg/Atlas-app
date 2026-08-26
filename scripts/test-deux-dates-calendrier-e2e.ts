import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import {
  DELAI_MINIMAL_JOURS, versJourIso } from "../src/server/disponibilites";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **« Je ne peux choisir qu'un seul jour à même le planning. »**
//
// Le patron, le 12 août 2026, capture à l'appui : *« je ne peux pas choisir
// deux jours à partir du planning […] En fait je ne peux choisir que deux jours
// si c'est les premières propositions qu'il y a tout en haut. Mais dès que je
// choisis à même le planning, je ne peux choisir qu'un seul jour. Or je dois
// pouvoir proposer deux jours au client. »*
//
// **Il avait raison sur ce qu'il voyait, et c'est ce qui compte.** L'écran
// gardait la date choisie au calendrier dans un état SÉPARÉ de la sélection —
// une chaîne unique — et ne marquait donc jamais qu'un seul jour. Choisir un
// second effaçait le premier sous ses yeux. Rien ne lui disait que les deux
// étaient retenus, et rappuyer sur le premier pour le retirer le REMETTAIT.
//
// **Pourquoi aucune suite ne l'avait vu.** `test-date-lointaine-e2e` choisit UNE
// date au calendrier et vérifie qu'elle part — ce qu'elle faisait. Personne
// n'avait jamais essayé d'en choisir deux. Un parcours à moitié joué ne prouve
// que la moitié qu'on joue.
//
// Ce que cette suite tient, et qui est exactement son geste :
//
//   1. deux jours pris AU CALENDRIER se marquent tous les deux ;
//   2. l'écran annonce bien deux dates au client ;
//   3. rappuyer sur l'un le RETIRE, au lieu de le remettre ;
//   4. les deux partent réellement dans l'envoi ;
//   5. un troisième ne s'ajoute pas en silence — le plus ancien cède la place.

const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const nom = `Deux dates ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!;

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 40_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Taille de deux tilleuls");
  await page.getByLabel("Prix unitaire 1").fill("600");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.getByText("Choisir la date", { exact: false }).first().click();
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
  await page.waitForTimeout(600);

  // **On part d'une ardoise vide.** Le premier jour libre est pré-coché, et son
  // geste à lui porte sur le CALENDRIER : le laisser masquerait le défaut,
  // puisqu'une des deux dates viendrait alors de la liste du haut.
  const dejaProposees = page.locator('button[aria-pressed="true"]').filter({ hasText: /proposée/ });
  for (let i = await dejaProposees.count(); i > 0; i--) {
    await dejaProposees.first().click();
    await page.waitForTimeout(250);
  }
  assert.equal(
    await page.locator('[data-jour][data-etat="retenu"]').count(),
    0,
    "La sélection n'a pas pu être vidée : la suite mesurerait autre chose que son geste."
  );

  /**
   * Les journées qu'on peut aller REGARDER.
   *
   * **Depuis le 22 août 2026, aucune case n'est éteinte** — sa demande, planche
   * 91 : *« un jour complet reste touchable, c'est justement celui sur lequel
   * vous voulez regarder avant de décider »*. « choisissable » n'existe donc
   * plus ; ce qui reste, c'est ce que la case EST, et le serveur tranche
   * ensuite.
   */
  async function joursOffertsAuChoix(): Promise<string[]> {
    // **ON AVANCE D'UN MOIS QUAND CELUI-CI N'A PLUS ASSEZ DE JOURS — corrigé le
    // 25 août 2026, à minuit pile.**
    //
    // Le calendrier ouvre sur le mois EN COURS. En fin de mois, ce qui reste au
    // delà du délai minimal se compte sur les doigts : le 25 août, il restait
    // le 28 et le 31 — deux jours, et la suite s'arrêtait sur « trop peu pour
    // éprouver ». Verte tout le mois, rouge les cinq derniers jours : *une
    // règle éprouvée un seul jour n'est pas éprouvée* (`CLAUDE.md` §5).
    //
    // Le patron, lui, appuie sur « Mois suivant » sans y penser. La suite fait
    // désormais le même geste — et elle ne le fait QUE si le mois courant est
    // trop court, pour continuer d'éprouver le cas ordinaire le reste du temps.
    for (let mois = 0; mois < 2; mois++) {
      if ((await recolter()).length >= 3) break;
      const suivant = page.getByRole("button", { name: /^Mois suivant/ });
      if ((await suivant.count()) === 0 || !(await suivant.isEnabled())) break;
      await suivant.click();
      await page.waitForTimeout(250);
    }
    return recolter();
  }

  /** Ce que le mois affiché offre, une fois le délai minimal retiré. */
  async function recolter(): Promise<string[]> {
    const tous = await page
      .locator('[data-jour][data-etat="regardable"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-jour")!).filter(Boolean));
    // **Assez loin pour que le serveur les accepte.** Le mois affiché commence
    // au 1er : ses premiers jours ouvrés sont derrière nous, et le délai minimal
    // en écarte deux de plus. Les prendre ferait rougir cette suite sur un refus
    // parfaitement juste — le pire des rouges (`AGENTS.md`).
    //
    // Le mois qui n'en offre pas trois se feuillette, et c'est `troisJoursAuMoins`
    // qui s'en charge, plus bas : deux feuilletages superposés seraient la même
    // règle écrite deux fois.
    const plancher = new Date();
    plancher.setDate(plancher.getDate() + DELAI_MINIMAL_JOURS + 1);
    const depuis = plancher.toISOString().slice(0, 10);
    return tous.filter((j) => j >= depuis);
  }

  /**
   * Touche un jour : il se propose, ou se rend s'il l'était déjà.
   *
   * **UN SEUL GESTE depuis le 25 août 2026** — *« je dois pouvoir sélectionner
   * les jours juste en les touchant, pas besoin de cliquer sur proposer »*. Le
   * second appui, qui refermait la fiche, RETIRERAIT maintenant la date : cette
   * suite l'a fait tomber la première, et c'est exactement ce qu'on veut d'elle.
   */
  async function toucher(jour: string) {
    await page.locator(`[data-jour="${jour}"]`).click();
    await page.locator('[data-atlas="journee-regardee"]').waitFor({ state: "visible", timeout: 30_000 });
    // Le verdict vient du serveur, et c'est LUI qui retient : on attend qu'il
    // ait cessé de vérifier, plutôt qu'un délai fixe qui échouerait au hasard
    // sous la batterie complète — un contrôle qui rougit sans raison apprend à
    // ignorer le rouge.
    await page
      .locator("text=Vérification de votre planning…")
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(250);
  }

  /**
   * **Le mois affiché n'offre pas toujours trois jours, et c'est une affaire de
   * calendrier, pas de code.** Cette suite a besoin de trois journées au-delà du
   * délai minimal. En fin de mois il n'en reste pas trois : le 25 août 2026 il
   * n'en restait que deux, et la suite rougissait sur un écran juste — le pire
   * des rouges, celui qu'on apprend à ignorer (`AGENTS.md`).
   *
   * Le geste imité est celui du patron : quand son mois est plein, il passe au
   * suivant. Trois mois consultés suffisent largement ; au-delà, c'est la
   * navigation qui est bornée trop tôt, et le message le dit.
   */
  async function troisJoursAuMoins(): Promise<string[]> {
    let dernierCompte = 0;
    for (let mois = 0; mois < 3; mois++) {
      const trouves = await joursOffertsAuChoix();
      if (trouves.length >= 3) return trouves;
      dernierCompte = trouves.length;
      const suivant = page.getByRole("button", { name: /^Mois suivant/ });
      assert.ok(
        await suivant.isEnabled(),
        `Le calendrier n'offre que ${dernierCompte} jour(s) et ne va pas plus loin.`
      );
      await suivant.click();
      await page.waitForTimeout(250);
    }
    assert.fail(`Trois mois consultés sans trouver trois jours à proposer (dernier mois : ${dernierCompte}).`);
  }

  const offerts = await troisJoursAuMoins();
  const [premier, second, troisieme] = offerts;

  // --- 1. Deux jours pris au calendrier se marquent TOUS LES DEUX ----------
  await toucher(premier);
  await toucher(second);

  const marques = await page
    .locator('[data-jour][data-etat="retenu"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-jour")!));
  assert.deepEqual(
    [...marques].sort(),
    [premier, second].sort(),
    `Le calendrier ne marque que ${JSON.stringify(marques)} — le patron ne peut donc en désigner qu'un.`
  );
  console.log("  ✓ deux jours pris à même le calendrier restent marqués tous les deux");

  // --- 2. Et l'écran LISTE bien deux dates --------------------------------
  //
  // **La phrase « Le client choisira entre ces deux dates » a été retirée le
  // 26 août 2026**, à sa demande : elle redisait ce que la liste montre déjà.
  // Ce contrôle visait le libellé ; il vise désormais la LISTE — ce qu'on
  // défend, c'est que deux dates partent, pas la façon de l'annoncer
  // (`CLAUDE.md` §5 bis).
  const proposees = await page.locator("text=proposée").count();
  assert.equal(
    proposees,
    2,
    `L'écran ne liste pas deux dates à envoyer, mais ${proposees}.`
  );
  console.log("  ✓ l'écran liste les deux dates qui partiront");

  // --- 3. Rappuyer RETIRE, au lieu de remettre -----------------------------
  //
  // C'est l'autre moitié du défaut, et la plus traître : le premier jour
  // n'étant plus « la » date du calendrier, un second appui le rajoutait.
  await toucher(premier);
  const apresRetrait = await page
    .locator('[data-jour][data-etat="retenu"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-jour")!));
  assert.deepEqual(
    apresRetrait,
    [second],
    `Rappuyer sur ${premier} ne l'a pas retiré : il reste ${JSON.stringify(apresRetrait)}.`
  );
  await toucher(premier);
  console.log("  ✓ rappuyer sur un jour retenu le retire, et ne le remet pas");

  // --- 4. Un troisième ne s'empile pas en silence --------------------------
  //
  // La règle vient du patron (`docs/AGENT.md` §2.2) et vit dans
  // `src/lib/calendrier.ts` : au-delà de deux, le plus ancien cède la place —
  // plutôt qu'un bouton qui ne répond pas, ce qui se lit comme une panne.
  //
  // **Le plus ancien est `second`, et non `premier`** : au point précédent,
  // `premier` a été retiré puis remis, ce qui l'a replacé en queue. Écrire
  // l'inverse ici serait attendre du code qu'il retienne un ordre que le
  // patron a lui-même défait — première version de ce contrôle, qui accusait
  // donc à tort.
  await toucher(troisieme);
  const aTrois = await page
    .locator('[data-jour][data-etat="retenu"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-jour")!));
  assert.deepEqual(
    [...aTrois].sort(),
    [premier, troisieme].sort(),
    `Trois dates retenues à la fois : ${JSON.stringify(aTrois)} — le client n'a plus à choisir, il hésite.`
  );
  console.log("  ✓ au troisième jour, le plus ancien cède la place — jamais trois");

  // --- 5. Les deux partent réellement --------------------------------------
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForTimeout(3500);

  const { rows } = await pool.query(
    `SELECT e.dates_proposees FROM envois_devis e WHERE e.chantier_id = $1 ORDER BY e.envoye_at DESC LIMIT 1`,
    [chantierId]
  );
  assert.ok(rows[0], "Aucun envoi enregistré : le devis n'est pas parti.");
  // `pg` rend les colonnes `date[]` en objets Date : on compare des jours, pas
  // des instants — sinon le fuseau du lecteur décalerait d'une case.
  const envoyees = (rows[0].dates_proposees as (string | Date)[])
    .map((d) => (d instanceof Date ? versJourIso(d) : String(d).slice(0, 10)))
    .sort();
  assert.deepEqual(
    envoyees,
    [premier, troisieme].sort(),
    `Le client ne reçoit pas les deux dates choisies : ${JSON.stringify(envoyees)}`
  );
  console.log("  ✓ les deux dates choisies au calendrier partent bien au client");

  await pool.end();
  await contexte.close();
  await navigateur.close();
  console.log("✅ Deux dates se choisissent à même le calendrier, et arrivent chez le client.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
