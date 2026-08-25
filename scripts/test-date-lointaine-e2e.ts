import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { ajouterJours, versJourIso, HORIZON_PATRON_JOURS, DELAI_MINIMAL_JOURS } from "../src/server/disponibilites";
import { jourLisible } from "../src/lib/jour";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **« Comment je fais si je dois lui proposer une date dans six mois ? »**
// — le patron, le 8 août 2026, en ajoutant : *« c'est un problème qui va se
// produire à coup sûr. »*
//
// Les règles sont éprouvées sans navigateur (`test-fenetre-lointaine.ts`), et
// le parcours en base aussi (`test-envois-devis.ts`). Ce que CETTE suite tient,
// et qu'aucune des deux ne peut tenir : **que le geste existe à l'écran**.
//
// C'est exactement ce qui manquait. Les six jours suggérés étaient calculés
// correctement, la fenêtre du client fonctionnait, la base acceptait n'importe
// quelle date — et le patron n'avait aucun moyen d'en désigner une. Un défaut
// invisible depuis le code, visible en deux secondes sur l'écran.

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
  await page.waitForURL(`${BASE}/`);

  // Un chantier prêt à partir : un client joignable, une ligne chiffrée.
  const nom = `Date lointaine ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const chantierId = page.url().split("/").pop()!;

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC");
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Taille de haie de laurier");
  await page.getByLabel("Prix unitaire 1").fill("350");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.getByText("Choisir la date", { exact: false }).first().click();
  await page.waitForSelector('[data-atlas="invite-dates"]');

  // --- 1. Le calendrier existe, et il va jusqu'à dix-huit mois -------------
  //
  // **Depuis le 9 août 2026, c'est un vrai calendrier**, à sa demande — plus le
  // champ natif du téléphone, qui savait borner mais pas griser. Le contrôle
  // regardait `min` et `max` ; il navigue désormais comme le patron navigue.
  const aujourdHui = new Date();
  assert.equal(
    await page.locator("[data-jour]").count() > 0,
    true,
    "Aucun calendrier : le patron ne peut proposer que la semaine qui vient."
  );

  // **Le lendemain se REGARDE mais ne se PROPOSE pas.**
  //
  // Le contrôle exigeait auparavant une case éteinte. Depuis le 22 août 2026,
  // sur sa demande (planche 91), **toutes les cases restent touchables** :
  // *« un jour complet reste touchable — c'est justement celui sur lequel vous
  // voulez regarder avant de décider »*. Le refus a donc changé de place : il
  // n'éteint plus la case, il s'écrit sous elle.
  //
  // **Et depuis le 25 août, ce qu'on éprouve est la RÈGLE, plus le bouton.**
  // Toucher une case la propose désormais — le bouton n'existe plus, et un
  // contrôle qui l'exigeait réclamerait ce que le patron a fait retirer
  // (`CLAUDE.md` §5 bis). Ce qu'il faut prouver n'a pas bougé : un jour trop
  // proche ne part pas chez le client, quoi que touche le doigt.
  const demain = versJourIso(ajouterJours(aujourdHui, 1));
  const caseDemain = page.locator(`[data-jour="${demain}"]`);
  if ((await caseDemain.count()) > 0) {
    await caseDemain.first().click();
    const fiche = page.locator('[data-atlas="journee-regardee"]');
    await fiche.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(
      () => !document.body.innerText.includes("Vérification de votre planning"),
      undefined,
      { timeout: 30_000 }
    );
    // Ce contrôle-ci ne porte pas sur le week-end mais sur le DÉLAI MINIMAL :
    // demain est trop proche, quel que soit le jour de la semaine.
    assert.equal(
      await page.locator(`[data-jour="${demain}"][data-etat="retenu"]`).count(),
      0,
      `Le calendrier a PROPOSÉ ${demain} au client (délai minimal : ${DELAI_MINIMAL_JOURS} jours).`
    );
    // **Et il doit DIRE pourquoi.** Une case qui ne s'allume pas, sans un mot,
    // se lit comme une panne : c'est le défaut que la planche 91 a corrigé, et
    // il reviendrait si l'écran se contentait de ne rien faire.
    const dit = await page.locator('[data-atlas="verdict-du-jour"]').innerText();
    assert.ok(
      dit.trim().length > 0 && !/Vérification/.test(dit),
      `La fiche du ${demain} ne dit pas pourquoi il est refusé. Lue : « ${dit.trim()} »`
    );
  }

  // --- 2. Une date à six mois est acceptée, et elle se voit ----------------
  //
  // Un lundi, pour ne pas tomber sur l'avertissement du week-end : c'est le
  // cas courant, et c'est lui qu'on éprouve ici.
  const dansSixMois = prochainLundi(ajouterJours(aujourdHui, 182));

  // On avance de mois en mois, comme lui. Vingt appuis couvrent largement les
  // six mois visés ; au-delà, c'est que la navigation est bornée trop tôt — et
  // le message le dit plutôt que de laisser un délai d'attente s'écouler.
  for (let i = 0; i < 20 && (await page.locator(`[data-jour="${dansSixMois}"]`).count()) === 0; i++) {
    const suivant = page.getByRole("button", { name: /^Mois suivant/ });
    assert.ok(
      await suivant.isEnabled(),
      `Le calendrier s'arrête avant ${dansSixMois} — une haie « à l'automne prochain » ne s'y trouve pas ` +
        `(horizon annoncé : ${HORIZON_PATRON_JOURS} jours).`
    );
    await suivant.click();
    await page.waitForTimeout(120);
  }
  const cible = page.locator(`[data-jour="${dansSixMois}"]`);
  assert.equal(await cible.count(), 1, `${dansSixMois} reste introuvable dans le calendrier.`);
  // **Un seul geste depuis le 25 août 2026** : la case s'ouvre ET s'engage.
  await cible.click();
  await page.waitForSelector('[data-atlas="journee-regardee"]', { timeout: 30_000 });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Vérification de votre planning"),
    undefined,
    { timeout: 60_000 }
  );
  await page
    .locator(`[data-jour="${dansSixMois}"][data-etat="retenu"]`)
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => {
      throw new Error(`${dansSixMois} n'est pas proposé alors qu'il est libre.`);
    });
  console.log("  ✓ une autre date se choisit, d'après-demain à dix-huit mois");
  await page.waitForTimeout(2500);

  const ecran = await page.locator("body").innerText();
  assert.doesNotMatch(
    ecran,
    /ne tient pas ce jour-là|pas lisible|dix-huit mois/,
    `L'écran refuse une date à six mois. Lu : « ${ecran.replace(/\s+/g, " ").slice(0, 300) }»`
  );
  const apresLeChoix = await page.locator("body").innerText();
  // **La date se lit avec LA FONCTION QUI L'ÉCRIT**, jamais avec une seconde
  // façon de la mettre en français (`CLAUDE.md` §3). Ce contrôle recomposait
  // « 1 mars » à la main : le premier du mois est le seul ordinal en français,
  // l'écran écrit « 1er mars », et la suite rougissait sur un écran juste —
  // uniquement les jours où la date visée tombait un premier. Trouvé le
  // 25 août 2026, six mois plus loin étant le 1er mars 2027.
  const enClair = jourLisible(dansSixMois);
  assert.ok(
    apresLeChoix.includes(enClair),
    `La date choisie (« ${enClair} ») n'apparaît nulle part : le patron enverrait sans savoir ce qu'il propose.`
  );
  console.log("  ✓ une date à six mois est retenue, et affichée");

  // --- 3. Elle part réellement, et le client la reçoit ---------------------
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForTimeout(3000);

  const { rows } = await pool.query(
    `SELECT e.jeton, e.dates_proposees FROM envois_devis e WHERE e.chantier_id = $1 ORDER BY e.envoye_at DESC LIMIT 1`,
    [chantierId]
  );
  assert.ok(rows[0], "Aucun envoi enregistré : le devis n'est pas parti.");
  // `pg` rend les colonnes `date[]` en objets Date : on compare des jours, pas
  // des instants — sinon le fuseau du lecteur décalerait la comparaison d'une
  // case, ce qui est exactement le piège que `versJourIso` existe pour éviter.
  const enregistrees = (rows[0].dates_proposees as (string | Date)[]).map((d) =>
    d instanceof Date ? versJourIso(d) : String(d).slice(0, 10)
  );
  assert.ok(
    enregistrees.includes(dansSixMois),
    `La date à six mois ne figure pas dans l'envoi : ${JSON.stringify(enregistrees)}`
  );
  console.log("  ✓ la date à six mois part réellement au client");

  // --- 4. Et la page du client la lui propose ------------------------------
  //
  // Le contrôle qui verrait la barrière la plus coûteuse : une date validée à
  // l'envoi puis refusée à la lecture, parce que la fenêtre du client ne la
  // couvre pas. Le client lirait « plus disponible » sur la date qu'on vient
  // de lui proposer.
  const pageClient = await contexte.newPage();
  await pageClient.goto(`${BASE}/devis/${rows[0].jeton}`, { waitUntil: "networkidle" });
  const vueClient = await pageClient.locator("body").innerText();
  // La même lecture qu'au contrôle précédent, et le même `enClair` : la page du
  // client rend `jourLisible`, on la lit avec la fonction qui l'écrit. Les
  // espaces sont normalisés parce qu'un retour à la ligne peut couper la date.
  assert.ok(
    vueClient.replace(/\s+/g, " ").includes(enClair),
    `Le client ne voit pas la date proposée (« ${enClair} »). Lu : « ${vueClient.replace(/\s+/g, " ").slice(0, 400)} »`
  );
  console.log("  ✓ le client la voit sur sa page, en toutes lettres");

  await pool.end();
  await navigateur.close();
  console.log("✅ Une date à six mois se choisit, s'envoie, et arrive chez le client.");
}

/** Le lundi de cette semaine-là ou de la suivante — jamais un week-end. */
function prochainLundi(depuis: Date): string {
  const d = new Date(depuis.getTime());
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return versJourIso(d);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
