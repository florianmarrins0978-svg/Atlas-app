import assert from "node:assert";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import * as clientsRepo from "../src/server/repositories/clients";
import * as prixRepo from "../src/server/repositories/lignes-prix";
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

async function preparerEnvoi(
  suffixe: string,
  datesDansNJours: number[],
  /**
   * Envoyer le devis pour de bon, ce qui **archive son PDF**.
   *
   * Facultatif parce que c'est lent (le document se compose, se protège et
   * s'écrit), et qu'un seul contrôle en a besoin : celui qui télécharge la
   * pièce. Sans cela, `pdfStorageKey` est vide et la route renvoie le client
   * vers la page — un 200 en HTML, qui n'est pas un devis.
   */
  avecPdfArchive = false
) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier du Test" },
    { email: `client-e2e-${suffixe}-${Date.now()}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  // **Un client nommé, et une adresse** : c'est le cas du patron, et c'est le
  // plus haut. Un envoi sans client tient dans l'écran sans rien prouver de
  // celui qui en porte un — la ligne « Pour Mme … » fait vingt pixels.
  const client = await clientsRepo.creerClient(ctx, {
    nom: "Huguette Groupiron",
    civilite: "mme",
    telephone: "06 12 34 56 78",
  });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Élagage du grand chêne",
    adresseChantier: "5 avenue de la République",
    clientId: client.id,
  });
  if (avecPdfArchive) {
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Élagage d'un chêne", "1200.00");
  }
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  if (avecPdfArchive) await devisRepo.envoyerDevis(ctx, d.id);
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

    // 4. « Une autre date » se défait pareil — mais le GESTE a changé le
    //    4 septembre 2026, et sa règle, non.
    //
    //    Le calendrier monte désormais du bas (sa réponse A) : il couvre le
    //    bouton radio, qu'on ne peut donc plus rappuyer. Ce qui compte est la
    //    RÈGLE — « si par erreur j'ai sélectionné un des 3 champs je ne peux
    //    plus le désélectionner » —, et elle est tenue autrement : refermer la
    //    feuille sans avoir touché de jour défait le choix.
    //
    //    Viser le rappui du radio, ce serait fixer une mise en page plutôt
    //    qu'un droit (`CLAUDE.md` §5 bis).
    await uneAutre.click();
    assert.ok((await page.locator("[data-jour]").count()) > 0, "le calendrier ne s'ouvre pas");
    await page.locator('button[aria-label="Refermer"]').click();
    assert.strictEqual(await uneAutre.isChecked(), false, "« une autre date » reste collée");
    assert.strictEqual(await page.locator("[data-jour]").count(), 0, "le calendrier reste ouvert");

    // 4 bis. **Une date RETENUE survit à la fermeture — et c'est CE QUI PART
    //    AU SERVEUR qu'on vérifie, plus une case cochée.**
    //
    //    Depuis son choix du 4 septembre, la liste se replie une fois la date
    //    retenue : les boutons radio quittent le document, et un champ caché
    //    prend leur place. Viser `isChecked()` reviendrait à exiger la mise en
    //    page d'hier ; ce qui compte est que le formulaire envoie encore le
    //    choix ET la date (`CLAUDE.md` §5 bis).
    //
    //    Sans ce contrôle, une feuille qui viderait tout en se refermant — ou
    //    un repli qui oublierait son champ caché — perdrait la date du client
    //    en silence, et son acceptation serait refusée sans qu'il comprenne.
    await uneAutre.click();
    const jourLibre = page.locator('[data-jour]:not([disabled])').first();
    const jourRetenu = await jourLibre.getAttribute("data-jour");
    await jourLibre.click();
    await page.locator('button:has-text("Retenir cette date")').click();
    assert.strictEqual(await page.locator("[data-jour]").count(), 0, "la feuille ne s'est pas refermée");
    assert.strictEqual(
      await page.locator('input[name="dateAutre"]').inputValue(),
      jourRetenu,
      "la date retenue ne part pas au serveur"
    );
    assert.strictEqual(
      await page.locator('input[name="choixDate"]').inputValue(),
      "autre",
      "la liste repliée n'envoie plus aucun choix de date"
    );

    // 4 ter. **« changer » redéplie la liste.** Sans cette sortie, un appui
    //    ferait de la date retenue un choix définitif : le client ne pourrait
    //    plus revenir à l'une des deux dates de son artisan.
    await page.locator('button:has-text("changer")').click();
    assert.ok(await laProche.isVisible(), "les dates proposées ne reviennent pas");
    assert.ok(await uneAutre.isVisible(), "« une autre date » ne revient pas");

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

    // **Ce contrôle exigeait une phrase, mot pour mot** — « vous pouvez laisser
    // un mot à votre artisan » — et le patron a fait réunir cette phrase avec
    // l'intitulé le 31 août 2026, pour que l'écran tienne d'un seul tenant. Il
    // vise donc ce qu'il défend : que le libellé du champ INVITE à écrire, et
    // qu'il soit au-dessus (`CLAUDE.md` §5 bis).
    const invite = page.locator('label[for="precision"]');
    assert.strictEqual(await invite.count(), 1, "le champ de message n'a plus d'intitulé");
    const texte = (await invite.first().innerText()).toLowerCase();
    assert.ok(
      /écriv|dites|laissez/.test(texte),
      `l'intitulé ne dit pas au client qu'il peut écrire : « ${texte} »`
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
    assert.ok(
      !/répondra|réponse sous|rappellera/.test(texte),
      `l'invitation promet une réponse que rien ne garantit : « ${texte} »`
    );
    await page.close();
  });

  await test("TOUT TIENT DANS UN ÉCRAN — sa demande du 31 août 2026", async () => {
    /**
     * *« Je veux que le choix de la date qui arrive au client par SMS tienne
     * sur une seule page ! Il ne doit pas avoir à scroll pour voir toutes les
     * infos. »*
     *
     * Un client nommé, une adresse de chantier, **deux dates proposées** — le
     * maximum que l'écran d'envoi autorise —, et la contre-proposition OUVERTE.
     *
     * Mesuré sur son écran — 390 × 664, un téléphone barre d'adresse déduite,
     * la mesure du dépôt depuis le 30 août.
     *
     * ═══════════════════════════════════════════════════════════════════════
     * **IL ANNONÇAIT « la contre-proposition ouverte » ET NE L'OUVRAIT PAS —
     * corrigé le 3 septembre 2026, complété le 4.**
     *
     * Il chargeait la page et mesurait, sans jamais toucher « Une autre
     * date » : il éprouvait l'état replié en promettant l'autre, et son vert
     * se lisait comme une garantie qu'il ne donnait pas.
     *
     * Ce qu'il cachait, mesuré le 3 septembre :
     *
     * | état | page | dernier bouton |
     * |---|---|---|
     * | replié | 664 px | 602 px |
     * | calendrier ouvert | **990 px** | **963 px** |
     *
     * Le patron a retenu **la feuille** (`appli/ecran-de-son-client.html`,
     * 4 septembre) : le calendrier monte par-dessus, la page derrière garde sa
     * hauteur. Puis il a fait replier la liste des dates, puis resserrer les
     * espacements — sans qu'aucun mot soit retiré.
     *
     * | état | avant | après |
     * |---|---|---|
     * | calendrier ouvert | 990 px | **664 px** |
     * | + date à moins de 14 jours | 1 148 px | **664 px** |
     *
     * **Le pire cas est éprouvé plus bas**, et c'est lui qui compte : il ne
     * reste plus un pixel de marge, et deux px ajoutés quelque part le
     * rouvriraient sans que personne ne s'en aperçoive.
     *
     * **Ce contrôle ouvre donc la feuille pour de bon.** Sans ce geste, le
     * jour où quelqu'un remettrait le calendrier dans le flux, il resterait
     * vert.
     * ═══════════════════════════════════════════════════════════════════════
     */
    const { envoi } = await preparerEnvoi("pli", [3, 10]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    // **La contre-proposition OUVERTE — le geste que ce contrôle annonçait.**
    // C'est l'instant où le client cherche une autre date, donc celui où ce
    // parcours évite l'aller-retour téléphonique : ses trois issues doivent
    // rester sous les yeux.
    await page.locator('input[value="autre"]').check();
    await page.waitForTimeout(400);
    const calendrierVisible = await page.locator("[data-jour]").first().isVisible();
    assert.ok(calendrierVisible, "le calendrier ne s'est pas ouvert : le contrôle ne mesure pas ce qu'il annonce");

    const m = await page.evaluate(() => ({
      page: document.documentElement.scrollHeight,
      ecran: window.innerHeight,
      dernier: document.querySelector('button[value="refuse"]')?.getBoundingClientRect().bottom ?? 0,
    }));

    // **Sans ce garde-fou, « 0 ≤ 664 » rendrait un vert qui ne mesure rien** —
    // une page pas encore mise en page mesure zéro, et c'est arrivé dans ce
    // dépôt le 15 août 2026 (`CLAUDE.md` §5).
    assert.ok(m.dernier > 100, `rien n'est mis en page (dernier bouton à ${m.dernier} px)`);
    assert.ok(m.ecran > 100, `écran de mesure absurde : ${m.ecran} px`);

    assert.ok(
      m.page <= m.ecran,
      `la page fait ${m.page} px pour ${m.ecran} px d'écran : le client doit faire défiler`
    );
    // Et le dernier geste est réellement visible, pas seulement « dans la
    // page » : c'est ce que le client regarde.
    assert.ok(
      m.dernier <= m.ecran,
      `« Je ne donne pas suite » finit à ${m.dernier} px, sous un écran de ${m.ecran} px`
    );

    // ═══════════════════════════════════════════════════════════════════
    // **LE PIRE CAS : une date à MOINS DE QUATORZE JOURS.**
    //
    // Elle fait apparaître la case de rétractation — 125 px — que la loi
    // impose : sans elle cochée, l'artisan n'a pas le droit de commencer
    // avant la fin du délai. C'est l'état le plus haut de cet écran, et
    // celui que personne n'éprouvait : la page y faisait **1 148 px** le
    // 3 septembre, puis 790, puis 717.
    //
    // Le 4 septembre, sur sa demande — *« il y a pas moyen de garder
    // aujourd'hui mais de resserrer le texte ? »* —, les 53 px restants ont
    // été pris dans les espacements, **sans retirer un seul mot**. Il ne
    // reste donc plus aucune marge : deux px ajoutés n'importe où rouvrent
    // le défaut, et c'est ce contrôle qui doit le dire.
    // ═══════════════════════════════════════════════════════════════════
    const proche = new Date(Date.now() + 4 * 86400_000).toISOString().slice(0, 10);
    const caseProche = page.locator(`[data-jour="${proche}"]`);
    if ((await caseProche.count()) > 0 && !(await caseProche.isDisabled())) {
      await caseProche.click();
      await page.locator('button:has-text("Retenir cette date")').click();
      await page.waitForTimeout(400);
      const retract = await page
        .locator("text=délai de rétractation")
        .first()
        .isVisible()
        .catch(() => false);
      assert.ok(retract, "la case de rétractation ne s'affiche pas sur une date proche");

      const p = await page.evaluate(() => ({
        page: document.documentElement.scrollHeight,
        ecran: window.innerHeight,
        dernier: document.querySelector('button[value="refuse"]')?.getBoundingClientRect().bottom ?? 0,
      }));
      assert.ok(p.dernier > 100, `rien n'est mis en page (dernier bouton à ${p.dernier} px)`);
      assert.ok(
        p.page <= p.ecran,
        `avec la case de rétractation, la page fait ${p.page} px pour ${p.ecran} px d'écran`
      );
      assert.ok(
        p.dernier <= p.ecran,
        `avec la case de rétractation, « Je ne donne pas suite » finit à ${p.dernier} px`
      );
    }
    await page.close();
  });

  await test("le devis reste téléchargeable APRÈS l'acceptation", async () => {
    /**
     * **Sa demande du 31 août 2026 :** *« lorsque le client a accepté le devis
     * et qu'il revient sur la page via le SMS il n'a plus accès à son devis, or
     * il doit encore pouvoir le télécharger s'il a oublié de le faire »*.
     *
     * L'écran de retour ne portait aucun geste : le lien reçu par SMS devenait
     * un cul-de-sac le jour même de l'accord.
     */
    const { envoi, maintenant } = await preparerEnvoi("telecharger", [8], true);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    await page
      .locator(`input[name="choixDate"][value="${versJourIso(ajouterJours(maintenant, 8))}"]`)
      .check();
    await page.click('button:has-text("J\'accepte ce devis")');
    await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 10000 });

    // **Le compte n'est pas fixé à un**, et c'est voulu : depuis le 31 août
    // 2026, l'en-tête du devis porte lui aussi « Télécharger mon devis (PDF) ».
    // Ce qui est vérifié est ce qui compte — qu'il existe un geste pour emporter
    // la pièce, et qu'il rende vraiment le fichier.
    const geste = 'a:has-text("Télécharger mon devis")';
    assert.ok(
      (await page.locator(geste).count()) >= 1,
      "aucun geste pour emporter le devis juste après l'avoir accepté"
    );

    // **Et surtout au RETOUR, des jours plus tard, par le lien du SMS** : c'est
    // le cas qu'il décrit.
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    assert.ok(await page.locator("text=Devis accepté").isVisible());
    assert.strictEqual(
      await page.locator(geste).count(),
      1,
      "l'écran de retour ne redonne pas le devis : le lien est un cul-de-sac"
    );

    // **Et le lien de l'en-tête EMPORTE le fichier, il ne l'affiche plus** — sa
    // demande du 31 août 2026. « Voir le devis complet » est devenu
    // « Télécharger mon devis (PDF) », en gras et souligné : un lien qui dit
    // télécharger et se contente d'ouvrir laisse croire qu'on a gardé le devis.
    const surLaPageDuChoix = await context.newPage();
    const autre = await preparerEnvoi("entete", [6], true);
    await surLaPageDuChoix.goto(`${BASE}/devis/${autre.envoi.jeton}`, { waitUntil: "networkidle" });
    const lienEnTete = surLaPageDuChoix.locator("header a");
    assert.strictEqual(await lienEnTete.count(), 1, "l'en-tête ne porte plus de lien vers le devis");
    const libelle = await lienEnTete.innerText();
    assert.ok(/télécharger/i.test(libelle), `l'en-tête dit « ${libelle} » au lieu de télécharger`);
    const style = await lienEnTete.evaluate((el) => {
      const c = getComputedStyle(el);
      return { graisse: Number(c.fontWeight), souligne: c.textDecorationLine };
    });
    assert.ok(style.graisse >= 600, `le lien n'est pas en gras (graisse ${style.graisse})`);
    assert.ok(style.souligne.includes("underline"), `le lien n'est pas souligné (${style.souligne})`);
    const fichier = await surLaPageDuChoix.request.get(
      new URL((await lienEnTete.getAttribute("href"))!, BASE).toString()
    );
    assert.strictEqual(fichier.status(), 200, `le devis ne se télécharge pas (${fichier.status()})`);
    assert.ok(
      (fichier.headers()["content-disposition"] ?? "").startsWith("attachment"),
      `le lien de l'en-tête ouvre au lieu d'emporter : ${fichier.headers()["content-disposition"]}`
    );
    await surLaPageDuChoix.close();

    // Le geste doit RENDRE le fichier, pas seulement exister. Et le rendre à
    // enregistrer : ouvert dans le lecteur du téléphone, le client croit
    // l'avoir gardé alors qu'il n'a fait que le regarder.
    const adresse = await page.locator(geste).getAttribute("href");
    assert.ok(adresse, "le geste ne mène nulle part");
    const reponse = await page.request.get(new URL(adresse!, BASE).toString());
    assert.strictEqual(reponse.status(), 200, `le devis ne se télécharge pas (${reponse.status()})`);
    assert.strictEqual(reponse.headers()["content-type"], "application/pdf");
    assert.ok(
      (reponse.headers()["content-disposition"] ?? "").startsWith("attachment"),
      `le fichier s'ouvre au lieu de descendre : ${reponse.headers()["content-disposition"]}`
    );
    await page.close();
  });

  await test("une correction sans un mot ne part pas, et l'écran dit pourquoi", async () => {
    // Le bouton était éteint, avec une phrase grise en dessous pour dire
    // pourquoi — trente pixels sur un écran qui doit tenir d'un seul tenant. Il
    // répond désormais, et c'est sa réponse qui l'explique. Ce qui ne change
    // pas : rien ne part, et le dépôt le refuserait de toute façon.
    const { envoi } = await preparerEnvoi("correction-vide", [9]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    await page.click('button:has-text("Une correction avant d\'accepter")');
    await page.waitForSelector('p[role="alert"]', { timeout: 10000 });
    assert.ok(
      (await page.locator('p[role="alert"]').innerText()).toLowerCase().includes("corrig"),
      "le message ne dit pas ce qui manque"
    );
    assert.strictEqual((await lireParJeton(envoi.jeton))?.reponse, null, "une réponse vide est partie");

    // Un mot écrit, et la voie se rouvre — sans quoi le contrôle prouverait
    // seulement qu'on a cassé le bouton.
    await page.fill("#precision", "Mon nom est mal écrit.");
    await page.click('button:has-text("Une correction avant d\'accepter")');
    await page.waitForSelector("text=Votre demande est transmise", { timeout: 10000 });
    assert.strictEqual((await lireParJeton(envoi.jeton))?.reponse, "correction");
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
