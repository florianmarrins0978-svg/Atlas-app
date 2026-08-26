import assert from "node:assert";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import { creerEnvoi, lireParJeton, genererJeton } from "../src/server/repositories/envois-devis";
import { fenetreProposition, versJourIso, ajouterJours } from "../src/server/disponibilites";

// Parcours réel de la page publique de réponse au devis (docs/AGENT.md §2.2 bis).
// Exercée dans un navigateur, SANS session : c'est tout l'intérêt de cette page,
// et c'est ce qui la rend sensible.

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

async function preparerEnvoi(suffixe: string, datesDansNJours: number[]) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier du Test" },
    { email: `client-e2e-${suffixe}-${Date.now()}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Élagage du grand chêne",
    adresseChantier: "5 avenue de la République",
  });
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  const maintenant = new Date();
  const envoi = await creerEnvoi(
    ctx,
    {
      chantierId: chantier.id,
      devisId: d.id,
      canal: "sms",
      datesProposees: datesDansNJours.map((n) => versJourIso(ajouterJours(maintenant, n))),
      contenuDevis: `devis-${suffixe}`,
    },
    maintenant
  );
  return { ctx, chantierId: chantier.id, envoi, maintenant };
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();

  await test("un jeton inconnu ne révèle rien au visiteur", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${genererJeton()}`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator("text=Ce lien n'est plus valable").isVisible(),
      "le message générique n'est pas affiché"
    );
    await page.close();
  });

  await test("le client voit son devis sans être connecté", async () => {
    const { envoi } = await preparerEnvoi("vue", [10, 14]);
    const page = await context.newPage();
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));

    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    assert.ok(await page.locator("text=Atelier du Test").isVisible(), "émetteur absent");
    assert.ok(await page.locator("text=Quelle date vous arrange").isVisible(), "choix de date absent");
    assert.ok(await page.locator('button:has-text("J\'accepte ce devis")').isVisible());
    assert.ok(await page.locator('button:has-text("Je ne donne pas suite")').isVisible());
    assert.strictEqual(erreurs.length, 0, `erreurs JS : ${erreurs.join(", ")}`);
    await page.close();
  });

  await test("aucune redirection vers la connexion ni vers l'acceptation", async () => {
    const { envoi } = await preparerEnvoi("public", [10]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    assert.ok(page.url().includes(`/devis/${envoi.jeton}`), `redirigé vers ${page.url()}`);
    await page.close();
  });

  await test("le client ne voit pas la navigation de l'application", async () => {
    const { envoi } = await preparerEnvoi("chrome", [10]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    // La barre « Chantiers / Planning / Tarifs » appartient à l'espace de
    // travail du patron. Chez le client, ses liens ne mèneraient qu'à une page
    // de connexion : une navigation inopérante est pire qu'absente.
    for (const libelle of ["Chantiers", "Planning", "Réglages"]) {
      assert.strictEqual(
        await page.locator(`nav >> text=${libelle}`).count(),
        0,
        `« ${libelle} » est visible sur la page du client`
      );
    }
    await page.close();
  });

  await test("le calendrier est borné à la fenêtre de proposition", async () => {
    const { envoi, maintenant } = await preparerEnvoi("bornes", [10]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    await page.locator('input[name="choixDate"][value="autre"]').check();

    // **Un calendrier, et non plus le sélecteur du téléphone** (9 août 2026).
    // Le contrôle regardait `min` et `max` d'un champ natif ; il regarde
    // maintenant ce que le client peut TOUCHER, ce qui est la vraie question :
    // un champ correctement borné laissait quand même choisir un jour pris.
    const f = fenetreProposition(maintenant);
    const veille = versJourIso(ajouterJours(new Date(f.debut + "T12:00:00Z"), -1));

    assert.strictEqual(
      await page.locator(`[data-jour="${f.debut}"]:not([disabled])`).count(),
      1,
      `Le premier jour de la fenêtre (${f.debut}) ne se choisit pas.`
    );
    const avant = page.locator(`[data-jour="${veille}"]`);
    if ((await avant.count()) > 0) {
      assert.ok(
        await avant.first().isDisabled(),
        `La veille de la fenêtre (${veille}) se choisit : le client peut proposer trop tôt.`
      );
    }
    await page.close();
  });

  await test("UN CHOIX FAIT PAR ERREUR SE DÉFAIT — sa demande du 26 août 2026", async () => {
    // *« Si par erreur j'ai sélectionné un des 3 champs je ne peux plus le
    // désélectionner ! Je dois pouvoir désélectionner. »*
    //
    // **Un bouton radio ne se décoche pas, par construction** : le navigateur
    // ne connaît que « passer de l'un à l'autre ». Le client qui touchait la
    // mauvaise ligne restait donc engagé sur une date qu'il n'avait pas
    // choisie — et c'est la date où l'artisan viendra.
    const { envoi, maintenant } = await preparerEnvoi("devalider", [5, 30]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    const proche = versJourIso(ajouterJours(maintenant, 5));
    const lointaine = versJourIso(ajouterJours(maintenant, 30));
    const laProche = page.locator(`input[name="choixDate"][value="${proche}"]`);
    const laLointaine = page.locator(`input[name="choixDate"][value="${lointaine}"]`);
    const uneAutre = page.locator('input[name="choixDate"][value="autre"]');
    const cochees = page.locator('input[name="choixDate"]:checked');

    // 1. Le second appui sur la MÊME ligne la défait, et rien ne la remplace.
    await laProche.click();
    assert.ok(await laProche.isChecked(), "le premier appui ne coche rien");
    await laProche.click();
    assert.strictEqual(
      await laProche.isChecked(),
      false,
      "le choix reste collé : c'est très exactement ce qu'il signale"
    );
    assert.strictEqual(await cochees.count(), 0, "une autre ligne s'est cochée à la place");

    // 2. **Le contrôle qui empêche la correction d'aller trop loin.** Défaire
    //    à chaque appui passerait le point 1 et rendrait le choix impossible :
    //    changer d'avis doit toujours choisir la nouvelle date.
    await laProche.click();
    await laLointaine.click();
    assert.ok(await laLointaine.isChecked(), "changer de date ne choisit plus rien");
    assert.strictEqual(await laProche.isChecked(), false, "les deux dates sont cochées ensemble");

    // 3. Ce qui dépendait de la date s'en va avec elle. Sans cela, l'écran
    //    garderait la demande de démarrage anticipé d'une date effacée — et
    //    c'est une autorisation légale que le client n'aurait plus donnée.
    await laLointaine.click();
    await laProche.click();
    const retractation = page.locator('input[name="demarrageAnticipe"]');
    assert.strictEqual(await retractation.count(), 1, "la date proche n'ouvre pas la rétractation");
    await laProche.click();
    assert.strictEqual(
      await retractation.count(),
      0,
      "la case de rétractation survit à la date qui l'a fait naître"
    );

    // 4. « Une autre date » se défait pareil, et referme son calendrier.
    await uneAutre.click();
    assert.ok((await page.locator("[data-jour]").count()) > 0, "le calendrier ne s'ouvre pas");
    await uneAutre.click();
    assert.strictEqual(await uneAutre.isChecked(), false, "« une autre date » reste collée");
    assert.strictEqual(await page.locator("[data-jour]").count(), 0, "le calendrier reste ouvert");

    await page.close();
  });

  await test("accepter une date proposée planifie le chantier", async () => {
    const { ctx, chantierId, envoi, maintenant } = await preparerEnvoi("accepte", [20, 24]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    const dateVoulue = versJourIso(ajouterJours(maintenant, 24));
    await page.locator(`input[name="choixDate"][value="${dateVoulue}"]`).check();
    await page.click('button:has-text("J\'accepte ce devis")');
    await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 10000 });

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, dateVoulue, "le chantier n'est pas planifié");

    const relu = await lireParJeton(envoi.jeton);
    assert.strictEqual(relu?.reponse, "acceptee");
    await page.close();
  });

  await test("la case de rétractation n'apparaît que pour une date proche", async () => {
    const { envoi, maintenant } = await preparerEnvoi("retract", [5, 40]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    const proche = versJourIso(ajouterJours(maintenant, 5));
    const lointaine = versJourIso(ajouterJours(maintenant, 40));
    const caseRetract = page.locator('input[name="demarrageAnticipe"]');

    await page.locator(`input[name="choixDate"][value="${lointaine}"]`).check();
    assert.strictEqual(await caseRetract.count(), 0, "affichée alors que la date est lointaine");

    await page.locator(`input[name="choixDate"][value="${proche}"]`).check();
    assert.strictEqual(await caseRetract.count(), 1, "absente alors que la date est proche");
    assert.strictEqual(await caseRetract.isChecked(), false, "elle ne doit jamais être pré-cochée");
    await page.close();
  });

  await test("un refus est enregistré sans rien planifier", async () => {
    const { ctx, chantierId, envoi } = await preparerEnvoi("refus", [12]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    await page.click('button:has-text("Je ne donne pas suite")');
    await page.waitForSelector("text=Votre réponse a bien été transmise", { timeout: 10000 });

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, null, "un refus ne doit rien planifier");
    const relu = await lireParJeton(envoi.jeton);
    assert.strictEqual(relu?.reponse, "refusee");
    await page.close();
  });

  await test("accepter sans choisir de date est refusé avec un message clair", async () => {
    const { envoi } = await preparerEnvoi("sansdate", [12]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    await page.click('button:has-text("J\'accepte ce devis")');
    // Sélecteur restreint au paragraphe : Next.js injecte son propre élément
    // role="alert" (l'annonceur de route), qui rendrait le sélecteur ambigu.
    await page.waitForSelector('p[role="alert"]', { timeout: 10000 });
    assert.ok(
      (await page.locator('p[role="alert"]').innerText()).includes("date"),
      "le message ne parle pas de la date"
    );
    await page.close();
  });

  await test("marteler la réponse finit par être borné, et le refus dit quoi faire", async () => {
    /**
     * **LA SEULE ÉCRITURE D'ATLAS OUVERTE SANS SESSION — constat F9.**
     *
     * Ce contrôle martèle pour de bon : onze envois du formulaire, par le vrai
     * chemin HTTP, sur le vrai limiteur. Rien n'est simulé — c'est ce qui le
     * distingue d'un contrôle qui relirait les seuils dans `LIMITES` et se
     * croirait quitte.
     *
     * **Le levier, et pourquoi il fallait le chercher :** un jeton ne se répond
     * qu'une fois, donc le formulaire disparaît après une réponse acceptée. On
     * passe donc par le refus « choisissez une date », qui LAISSE le formulaire
     * en place — et qui survient APRÈS la borne de cadence, donc chaque essai
     * compte pour un.
     *
     * Ce qui est vérifié tient en deux moitiés, et la seconde compte autant :
     * le dixième essai passe encore (on ne gêne pas un client qui hésite), et
     * le onzième est refusé par un message qui dit quoi faire et rassure sur le
     * devis. Un refus muet ferait conclure au client que l'application est
     * cassée — la leçon du 6 août 2026.
     */
    const { envoi } = await preparerEnvoi("cadence", [12]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    const alerte = page.locator('p[role="alert"]');
    let dernier = "";
    for (let essai = 1; essai <= 10; essai++) {
      await page.click('button:has-text("J\'accepte ce devis")');
      await page.waitForSelector('p[role="alert"]', { timeout: 10000 });
      dernier = await alerte.innerText();
      assert.ok(
        dernier.includes("date"),
        `essai ${essai} : le seuil s'est déclenché trop tôt — reçu « ${dernier} ». ` +
          `Dix essais doivent passer : un client qui hésite ne doit pas être mis dehors.`
      );
    }

    await page.click('button:has-text("J\'accepte ce devis")');
    // Le message change de contenu sans changer d'élément : on attend le
    // changement lui-même, jamais un délai fixe.
    await page.waitForFunction(
      (avant) => document.querySelector('p[role="alert"]')?.textContent?.trim() !== avant,
      dernier.trim(),
      { timeout: 15000 }
    );
    const refus = await alerte.innerText();
    assert.ok(
      /patientez/i.test(refus),
      `le onzième essai n'est pas borné — reçu « ${refus} »`
    );
    assert.ok(
      /devis reste valable/i.test(refus),
      `le refus ne rassure pas le client sur son devis — reçu « ${refus} »`
    );

    // Et il n'a rien enregistré : une cadence atteinte n'est pas une réponse.
    const relu = await lireParJeton(envoi.jeton);
    assert.strictEqual(relu?.reponse, null, "un refus de cadence a enregistré une réponse");
    await page.close();
  });

  await test("un devis déjà accepté ne peut plus être répondu", async () => {
    const { envoi, maintenant } = await preparerEnvoi("rejoue", [15]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    await page
      .locator(`input[name="choixDate"][value="${versJourIso(ajouterJours(maintenant, 15))}"]`)
      .check();
    await page.click('button:has-text("J\'accepte ce devis")');
    await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 10000 });

    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    assert.ok(await page.locator("text=Devis accepté").isVisible());
    // L'écran de retour redonne la date retenue : c'est ce que le client vient
    // y chercher, et ça lui évite de rappeler son artisan pour la vérifier.
    assert.ok(
      await page.locator("text=Intervention prévue le").isVisible(),
      "la date retenue n'est pas rappelée"
    );
    await page.close();
  });

  await test("l'encart INVITE à laisser un mot, il ne se contente pas de le permettre", async () => {
    // **Le patron, le 13 août 2026 :** *« écris une petite phrase sur l'encart
    // pour laisser un mot, qu'il sache qu'il peut le faire »*.
    //
    // L'intitulé posait une question — « Une erreur, une question, une
    // précision ? » — sans dire qu'on avait le droit d'y répondre. Ce qui est
    // en jeu n'est pas la politesse : un client qui repère une faute et n'ose
    // pas l'écrire touche « Je ne donne pas suite », et le patron lit un refus
    // là où il n'y avait qu'une coquille.
    const { envoi } = await preparerEnvoi("invite", [3, 6]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    const invite = page.locator("text=/vous pouvez laisser un mot/i");
    assert.strictEqual(
      await invite.count(),
      1,
      "aucune phrase n'invite le client à écrire : il ne saura pas qu'il en a le droit"
    );

    // **Au-dessus du champ, jamais en dessous** : une invitation lue après coup
    // n'invite plus personne. Mesuré, parce que l'ordre dans le code ne dit
    // rien de l'ordre à l'écran.
    const boiteInvite = await invite.first().boundingBox();
    const boiteChamp = await page.locator("#precision").boundingBox();
    assert.ok(boiteInvite && boiteChamp, "l'invitation ou le champ n'est pas à l'écran");
    assert.ok(
      boiteInvite!.y + boiteInvite!.height <= boiteChamp!.y + 1,
      `l'invitation est sous le champ (y=${boiteInvite!.y.toFixed(0)} contre ${boiteChamp!.y.toFixed(0)})`
    );

    // Et elle ne promet rien que l'application ne tienne : le client n'a aucun
    // moyen de recevoir une réponse ici.
    const texte = (await invite.first().innerText()).toLowerCase();
    assert.ok(
      !/répondra|réponse sous|rappellera/.test(texte),
      `l'invitation promet une réponse que rien ne garantit : « ${texte} »`
    );
    await page.close();
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
