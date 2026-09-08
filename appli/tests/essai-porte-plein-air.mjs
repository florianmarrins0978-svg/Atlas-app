/**
 * « La porte en plein air » — la planche se parcourt en entier, comme lui.
 *
 * **Pourquoi cette suite existe.** Trois fois, une adresse lui a été transmise
 * sans que personne ne l'ait ouverte, et c'est LUI qui a trouvé le défaut
 * (`AGENTS.md`). Une planche dont on attend un choix se parcourt donc d'abord
 * ici, dans un vrai navigateur, sur un téléphone.
 *
 * **CE QU'ELLE GARDE PAR-DESSUS TOUT : LES DEUX EMBRANCHEMENTS.**
 *
 * Sa demande du 8 septembre — *« pour qu'il ait le moins d'infos à rentrer
 * ensuite »* — ne tient pas dans le nombre de questions, mais dans celles
 * qu'on NE POSE PAS :
 *
 *   · une EI ou une micro-entreprise n'a légalement ni capital ni RCS ;
 *   · un artisan en franchise n'a pas de numéro de TVA intracommunautaire.
 *
 * La suite joue donc DEUX parcours entiers, et compare leurs longueurs. Un
 * embranchement débranché rendrait des écrans parfaitement valides, tiendrait
 * dans le cadre, et poserait trois questions absurdes à un micro-entrepreneur.
 * Aucune mesure de hauteur ne le verrait.
 *
 * **ET LA QUESTION QUI FABRIQUE UN DOCUMENT FAUX SI ON L'OUBLIE.**
 * `entreprises.regimeTva` vaut « assujettie » par défaut : un artisan en
 * franchise qui ne répond pas facture une TVA qu'il n'a pas le droit de
 * facturer. La suite exige qu'elle soit **impossible à passer**.
 *
 * **LA PHOTO EST VÉRIFIÉE COMME UNE PIÈCE, PAS COMME UN DÉCOR.** Une image qui
 * ne charge pas laisse un écran NOIR avec du texte blanc dessus — donc
 * lisible, donc invisible à toute mesure de débordement. On exige des pixels
 * (`naturalWidth`), pas une balise.
 *
 * **Elle sait échouer**, et sur autre chose que le vide : l'écran doit d'abord
 * avoir de la matière — un cadre de zéro pixel passerait tout au vert sans
 * rien prouver (`CLAUDE.md` §5, la panne du 15 août 2026).
 *
 *   BASE_URL=http://127.0.0.1:8080 node tests/essai-porte-plein-air.mjs
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";
let rouges = 0;
const dire = (ok, quoi) => {
  if (!ok) rouges++;
  console.log((ok ? "  ok    " : "  ROUGE ") + quoi);
};

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const nav = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("requestfailed", (r) => erreurs.push("requête perdue : " + r.url()));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) erreurs.push(r.status() + " sur " + r.url());
});

// `networkidle` et pas `domcontentloaded` : sans la mise en page appliquée, et
// sans la photo chargée, toutes les mesures ci-dessous vaudraient 0.
await page.goto(BASE + "/la-porte-en-plein-air.html", { waitUntil: "networkidle" });

const tel = page.locator("[data-tel]");
const creation = tel.locator('[data-ecran="creation"]');

console.log("\nLa planche s'ouvre");
dire((await tel.count()) === 1, "le téléphone est là");
dire((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
  "rien ne déborde en largeur sur un téléphone de 390 px");

console.log("\nLa photo");
const photo = tel.locator(".porte .photo");
const pixels = await photo.evaluate((i) => ({ l: i.naturalWidth, h: i.naturalHeight, complet: i.complete }));
dire(pixels.complet && pixels.l > 400 && pixels.h > 400,
  "la photo a de vrais pixels (" + pixels.l + "×" + pixels.h + ")");
// Une photo décorative ne se lit pas à voix haute : elle ne dit rien qu'un
// aveugle n'ait déjà par les boutons. `alt=""` est VOULU, pas oublié.
dire((await photo.getAttribute("alt")) === "", "la photo est marquée décorative (alt vide)");

console.log("\nLa porte");
const cadre = await tel.locator('[data-ecran="porte"]').boundingBox();
dire(cadre !== null && cadre.width > 200 && cadre.height > 400,
  "l'écran a de la matière (" + (cadre ? Math.round(cadre.width) + "×" + Math.round(cadre.height) : "absent") + ")");
dire(await tel.locator(".pastille", { hasText: "Créer un compte" }).isVisible(), "« Créer un compte » se voit");
dire(await tel.locator(".second", { hasText: "Se connecter" }).isVisible(), "« Se connecter » se voit");
dire(await tel.locator(".porte .nom").isVisible(), "la marque se voit");
// Retirés à sa demande du 8 septembre. Une suite qui ne garde QUE ce qui est
// présent laisserait revenir ce qu'il a fait enlever, sans qu'on le voie.
dire((await tel.locator(".porte .sceau").count()) === 0, "aucun sceau à l'étoile — retiré à sa demande");
dire((await tel.locator("[data-accroche]").count()) === 0, "aucune accroche — retirée à sa demande");

const mentions = tel.locator(".porte .mentions");
dire(await mentions.isVisible(), "la phrase des conditions d'utilisation se voit");
dire(/vous acceptez nos/.test((await mentions.innerText()).replace(/\s+/g, " ")),
  "la phrase dit bien qu'on accepte en appuyant");
dire((await mentions.locator("a").count()) === 2, "elle porte ses deux liens");
dire(!(await tel.locator('[data-ecran="porte"]').evaluate((e) => e.scrollHeight > e.clientHeight + 1)),
  "tout tient dans le cadre de la porte");

// ── Le parcours, joué comme lui ──────────────────────────────────────────
//
// On entre par la PORTE, jamais en construisant l'écran à la main : c'est la
// leçon du 28 août (`CLAUDE.md` §5 quater) — un contrôle qui entre par une
// porte de service ne dit rien de la porte d'entrée, et c'est celle-là qui
// peut être fermée.
const ouvrirLaCreation = async () => {
  await tel.locator('[data-ecran="porte"] .pastille[data-aller="creation"]').click();
};

/** Repart de zéro depuis la porte, où qu'on en soit. « Recommencer » ne vit
 *  que sur l'écran final : s'en servir au milieu du parcours attendrait un
 *  bouton invisible pendant trente secondes, puis accuserait la planche. */
const repartir = async () => {
  await page.reload({ waitUntil: "networkidle" });
  await ouvrirLaCreation();
};

/** Quel outil l'écran présente-t-il ? */
const outil = async () => {
  if (await creation.locator("[data-groupe]").isVisible()) return "groupe";
  if (await creation.locator("[data-deroulant]").isVisible()) return "deroulant";
  if (await creation.locator("[data-liste]").isVisible()) return "liste";
  return "champ";
};

/** Répond à la question affichée. `null` = passer quand c'est permis. */
const repondre = async (valeur) => {
  switch (await outil()) {
    case "groupe": {
      const paire = creation.locator("[data-choix]");
      if (await paire.count()) await paire.first().click();
      const cases = creation.locator("[data-cle]");
      const n = await cases.count();
      // Les deux mots de passe reçoivent la MÊME valeur : c'est le cas
      // ordinaire, le désaccord est éprouvé à part.
      for (let i = 0; i < n; i++) await cases.nth(i).fill(valeur === null ? "" : "essai");
      await creation.locator("[data-avancer]").click();
      break;
    }
    case "deroulant":
      await creation.locator("[data-deroulant-tete]").click();
      // Choisi par son SIGLE exact : « SAS » est contenu dans « SASU », et un
      // filtre sur le texte prendrait la mauvaise forme — donc le mauvais
      // embranchement.
      await creation.locator("[data-deroulant-panneau] button b", { hasText: new RegExp("^" + valeur + "$") })
        .first().click();
      await creation.locator("[data-avancer]").click();
      break;
    case "liste":
      await creation.locator("[data-liste] button", { hasText: valeur }).first().click();
      break;
    default:
      if (valeur === null) { await creation.locator("[data-passer]").click(); break; }
      await creation.locator("[data-champ]").fill(valeur);
      await creation.locator("[data-avancer]").click();
  }
};

/** Déroule tout le parcours et rend la liste des questions vues. */
const parcourir = async (forme, tva, remplir) => {
  const vues = [];
  for (let garde = 0; garde < 30; garde++) {
    if (await creation.locator("[data-fini]").isVisible()) break;
    const q = (await creation.locator("[data-question]").innerText()).replace(/\s+/g, " ");
    let reponse = remplir ? "essai" : null;
    if (/forme juridique/i.test(q)) reponse = forme;
    else if (/Facturez-vous la TVA/i.test(q)) reponse = tva;
    else if (/identité|adresse e-mail \?|Choisissez un mot de passe|nom de votre entreprise/i.test(q)) {
      reponse = "essai";
    }
    vues.push(q);
    await repondre(reponse);
  }
  return vues;
};

/** Avance d'une question, quel que soit l'outil, en remplissant.
 *  Chaque outil veut sa propre réponse valable : « essai » ne désigne aucune
 *  forme juridique, et le bandeau attendrait indéfiniment. */
const avancerUneFois = async () => {
  const quoi = await outil();
  await repondre(quoi === "deroulant" ? "EI" : quoi === "liste" ? "Oui" : "essai");
};

console.log("\nParcours 1 — micro-entreprise en franchise");
await ouvrirLaCreation();
dire(await creation.isVisible(), "« Créer un compte » mène au parcours");
const court = await parcourir("Micro-entreprise", "Non", false);
dire(await creation.locator("[data-fini]").isVisible(), "le parcours arrive au bout");
dire(!court.some((q) => /capital social/i.test(q)), "le capital social n'est PAS demandé à une micro-entreprise");
dire(!court.some((q) => /ville du RCS/i.test(q)), "la ville du RCS n'est PAS demandée à une micro-entreprise");
dire(!court.some((q) => /TVA intracommunautaire/i.test(q)), "le numéro de TVA n'est PAS demandé en franchise");
console.log("        (" + court.length + " questions)");

console.log("\nParcours 2 — SAS assujettie");
await repartir();
const long = await parcourir("SAS", "Oui", false);
dire(long.some((q) => /capital social/i.test(q)), "le capital social EST demandé à une SAS");
dire(long.some((q) => /ville du RCS/i.test(q)), "la ville du RCS EST demandée à une SAS");
dire(long.some((q) => /TVA intracommunautaire/i.test(q)), "le numéro de TVA EST demandé à un assujetti");
console.log("        (" + long.length + " questions)");

// LE CŒUR DE SA DEMANDE, ET IL SE MESURE : trois questions de moins.
dire(long.length - court.length === 3,
  "l'embranchement épargne bien 3 questions (" + court.length + " contre " + long.length + ")");

// LES DEUX CHIFFRES ÉCRITS DANS LA PLANCHE SONT COMPARÉS À CE QU'ELLE FAIT.
// Un écran a déjà porté « 8 tés » au tableau et « 9 tés » dans la phrase en
// dessous : la phrase, écrite en dur, disait vrai la veille. Deux chiffres qui
// se contredisent, c'est toute la planche qu'on cesse de croire.
dire(Number(await page.locator("[data-court]").innerText()) === court.length,
  "le chiffre annoncé pour la micro-entreprise est le vrai (" +
    (await page.locator("[data-court]").innerText()) + " annoncé, " + court.length + " mesuré)");
dire(Number(await page.locator("[data-long]").innerText()) === long.length,
  "le chiffre annoncé pour la SAS est le vrai (" +
    (await page.locator("[data-long]").innerText()) + " annoncé, " + long.length + " mesuré)");

console.log("\nLe bandeau déroulant, et il est à NOUS");
await repartir();
for (let i = 0; i < 4; i++) await avancerUneFois();
dire(/forme juridique/i.test(await creation.locator("[data-question]").innerText()),
  "on arrive bien sur la forme juridique");
// Sa remarque du 8 septembre : « le bandeau déroulant doit respecter la charte
// de couleur et de style de l'appli ». Un <select> natif ne le peut pas —
// c'est le téléphone qui dessine sa roue. Le jour où quelqu'un le remet « pour
// faire simple », c'est ici qu'on doit l'apprendre.
dire((await creation.locator("select").count()) === 0,
  "aucun menu natif : le téléphone ne dessine plus rien à notre place");
dire(await creation.locator("[data-deroulant-tete]").isVisible(),
  "le bandeau est replié, et il a l'allure d'un champ");
dire(await creation.locator("[data-deroulant-panneau]").isHidden(),
  "son panneau est fermé tant qu'on ne l'ouvre pas");
await creation.locator("[data-deroulant-tete]").click();
dire(await creation.locator("[data-deroulant-panneau]").isVisible(), "il s'ouvre au doigt");
const formes = await creation.locator("[data-deroulant-panneau] button").allTextContents();
dire(formes.length === 11, "il porte les onze formes (" + formes.length + ")");
dire(formes.some((o) => /^EURL/.test(o) && /SARL à associé unique/.test(o)),
  "chaque sigle voyage avec son nom — « EURL » seul ne se retient pas");
// La couleur se vérifie, sinon « à la charte » n'est qu'une intention : l'or
// d'Atlas est #B98B47, éclairci en #c6a15b sur la charte « Nuit ».
const orDuChevron = await creation.locator("[data-deroulant-tete] svg")
  .evaluate((e) => getComputedStyle(e).color);
dire(orDuChevron === "rgb(198, 161, 91)", "son chevron porte l'or de la charte (" + orDuChevron + ")");
await creation.locator("[data-deroulant-tete]").click();
dire(await creation.locator("[data-deroulant-panneau]").isHidden(), "il se referme");

// Obligatoire veut dire obligatoire : « Continuer » ne doit pas enjamber un
// bandeau resté sur son invite, sinon les deux questions que la forme commande
// disparaîtraient pour de mauvaises raisons.
await creation.locator("[data-avancer]").click();
dire(/forme juridique/i.test(await creation.locator("[data-question]").innerText()),
  "« Continuer » n'enjambe pas un bandeau resté vide");
dire(await creation.locator("[data-refus]").isVisible(), "et il dit pourquoi");
dire(!(await creation.evaluate((e) => e.scrollHeight > e.clientHeight + 1)),
  "l'écran de la forme juridique ne défile pas, bandeau replié");

console.log("\nLe mot de passe se confirme, et l'œil le montre");
await repartir();
await avancerUneFois();
await avancerUneFois();
dire(/mot de passe/i.test(await creation.locator("[data-question]").innerText()),
  "on arrive sur le mot de passe");
const cases = creation.locator("[data-cle]");
dire((await cases.count()) === 2, "il y a bien DEUX cases : le mot de passe et sa confirmation");
await cases.nth(0).fill("secret-un");
await cases.nth(1).fill("secret-deux");
await creation.locator("[data-avancer]").click();
dire(/mot de passe/i.test(await creation.locator("[data-question]").innerText()),
  "deux mots de passe différents ne passent pas");
dire(await creation.locator("[data-refus]").isVisible(), "et l'écran dit lequel est le problème");
// L'ŒIL : sans lui, un mot de passe tapé sur un clavier de téléphone au soleil
// se saisit à l'aveugle, et l'on ne sait jamais lequel des deux est faux.
const oeil = creation.locator(".oeil").first();
dire(await oeil.isVisible(), "l'œil est là");
dire((await cases.nth(0).getAttribute("type")) === "password", "au départ, rien ne se lit");
await oeil.click();
dire((await cases.nth(0).getAttribute("type")) === "text", "l'œil montre ce qu'il écrit");
dire((await oeil.getAttribute("aria-label")) === "Masquer le mot de passe",
  "et son libellé suit — celui de l'application, mot pour mot");
await oeil.click();
dire((await cases.nth(0).getAttribute("type")) === "password", "il se referme");
await cases.nth(1).fill("secret-un");
await creation.locator("[data-avancer]").click();
dire(!/mot de passe/i.test(await creation.locator("[data-question]").innerText()),
  "deux mots de passe identiques passent");

console.log("\nL'identité : civilité, prénom, nom");
await repartir();
dire(/identité/i.test(await creation.locator("[data-question]").innerText()),
  "la première question est l'identité");
dire((await creation.locator("[data-choix]").count()) === 2, "Madame et Monsieur, deux choix");
const civilites = await creation.locator("[data-choix]").allTextContents();
dire(civilites.join("|") === "Madame|Monsieur", "en toutes lettres (" + civilites.join(", ") + ")");
const nomEtPrenom = await creation.locator("[data-cle]").evaluateAll((l) => l.map((i) => i.placeholder));
dire(nomEtPrenom.join("|") === "Prénom|Nom", "prénom et nom, séparés (" + nomEtPrenom.join(", ") + ")");
dire(!(await creation.evaluate((e) => e.scrollHeight > e.clientHeight + 1)),
  "les trois tiennent sur un écran");

console.log("\nLa domiciliation est demandée, et avec ses mots");
await repartir();
const vues = await parcourir("Micro-entreprise", "Non", false);
dire(vues.some((q) => /Où est domiciliée votre entreprise/i.test(q)),
  "« Où est domiciliée votre entreprise ? » est bien posée");
dire(!vues.some((q) => /accompagner vos devis/i.test(q)),
  "le mot pour accompagner les devis est retiré, à sa demande");

console.log("\nCe qui ne se passe pas, et ce qui se passe");
await repartir();
for (const attendu of [true, true, true, true, true]) {
  dire((await creation.locator("[data-passer]").isHidden()) === attendu,
    "question obligatoire : « Passer » est absent — " +
      (await creation.locator("[data-question]").innerText()).replace(/\s+/g, " ").slice(0, 34));
  await avancerUneFois();
}
// Cinq obligatoires d'affilée : identité, e-mail, mot de passe, nom de
// l'entreprise, forme juridique. La sixième — le SIRET — se passe.
dire(await creation.locator("[data-passer]").isVisible(),
  "question facultative : « Passer » est offert");

console.log("\nLa TVA ne se passe JAMAIS");
await repartir();
let vueTva = null;
for (let i = 0; i < 30; i++) {
  if (await creation.locator("[data-fini]").isVisible()) break;
  const q = (await creation.locator("[data-question]").innerText()).replace(/\s+/g, " ");
  if (/Facturez-vous la TVA/i.test(q)) { vueTva = true; break; }
  await avancerUneFois();
}
dire(vueTva === true, "la question de la TVA est atteinte");
dire(await creation.locator("[data-passer]").isHidden(),
  "elle est IMPOSSIBLE à passer — son oubli ferait facturer une TVA indue");
dire((await creation.locator("[data-liste] button").count()) === 2, "elle offre deux réponses, oui et non");

console.log("\nCe qui manque se dit, et ce qui est complet se tait");
await repartir();
await parcourir("Micro-entreprise", "Non", false);
const dit = (await creation.locator("[data-reste]").innerText()).replace(/\s+/g, " ");
dire(/Il manque/.test(dit), "tout passé : l'écran de fin dit ce qui manque");
dire(/Réglages/.test(dit), "il dit OÙ le remplir");
dire(/C.est fait/.test(await creation.locator("[data-fini-titre]").innerText()),
  "et le titre reste sobre tant qu'il manque quelque chose");

await repartir();
await parcourir("Micro-entreprise", "Non", true);
dire(/Tout est prêt/.test(await creation.locator("[data-fini-titre]").innerText()),
  "tout rempli : « Tout est prêt », et l'écran ne réclame rien");
dire(/premier devis/.test((await creation.locator("[data-reste]").innerText()).replace(/\s+/g, " ")),
  "il dit qu'il peut s'en servir tout de suite");
dire(await creation.locator("[data-fini] .principal").isVisible(),
  "l'écran de fin offre d'entrer dans Atlas");

console.log("\nLe parcours tient dans le cadre");
await repartir();
for (let i = 0; i < 30; i++) {
  if (await creation.locator("[data-fini]").isVisible()) break;
  const deborde = await creation.evaluate((e) => e.scrollHeight > e.clientHeight + 1);
  if (deborde) { dire(false, "l'écran déborde à la question " + (i + 1)); break; }
  // « Continuer » ne doit jamais être poussé hors du cadre — ni par le groupe
  // de trois cases de l’identité, ni par le bandeau des onze formes.
  if ((await outil()) !== "liste") {
    const b = await creation.locator("[data-avancer]").boundingBox();
    const c = await creation.boundingBox();
    if (!(b && c && b.y + b.height <= c.y + c.height + 1)) {
      dire(false, "« Continuer » sort du cadre à la question " + (i + 1));
      break;
    }
  }
  await avancerUneFois();
  if (i === 29) dire(false, "le parcours ne s'arrête pas");
}
dire(await creation.locator("[data-fini]").isVisible(),
  "tous les écrans tiennent dans le cadre, et « Continuer » reste atteignable");

console.log("\nSe connecter — la proposition B, recopiée");
await repartir();
await creation.locator("[data-reculer]").click();
dire(await tel.locator('[data-ecran="porte"]').isVisible(), "le retour depuis la première question ramène à la porte");
await tel.locator('.second[data-aller="connexion"]').click();
const connexion = tel.locator('[data-ecran="connexion"]');
dire(await connexion.isVisible(), "« Se connecter » mène à la connexion");
for (const mot of ["Google", "Apple"]) {
  dire(await connexion.locator(".duo button", { hasText: mot }).isVisible(), "connexion : le bouton " + mot + " se voit");
}
dire(await connexion.locator(".visage").isVisible(),
  "connexion : « Ouvrir avec Face ID » est là — sa règle du 30 août, le mot de passe et le visage cohabitent");
for (const champ of ["Adresse", "Mot de passe"]) {
  dire(await connexion.locator('input[placeholder="' + champ + '"]').isVisible(),
    "connexion : le champ « " + champ + " » se voit");
}
dire(!(await connexion.evaluate((e) => e.scrollHeight > e.clientHeight + 1)),
  "connexion : tout tient dans le cadre");
await connexion.locator(".retour").click();
dire(await tel.locator('[data-ecran="porte"]').isVisible(), "le retour ramène à la porte");

console.log("\nLes deux pages légales, et leurs liens depuis la porte");
const liens = await tel.locator(".porte .mentions a").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
dire(liens.includes("conditions-utilisation.html"), "la porte mène aux conditions d'utilisation");
dire(liens.includes("confidentialite.html"), "la porte mène à la politique de confidentialité");
for (const f of ["conditions-utilisation.html", "confidentialite.html"]) {
  const r = await page.request.get(BASE + "/" + f);
  dire(r.status() === 200, f + " répond (" + r.status() + ")");
  const corps = await r.text();
  // Ces deux documents ne sont PAS publiables : ils portent des cases vides et
  // des durées qu'on n'applique pas encore. Le jour où le bandeau disparaît
  // sans que les cases soient remplies, c'est ici qu'on doit l'apprendre.
  const cases = (corps.match(/À COMPLÉTER/g) || []).length;
  const avertit = /Brouillon — à faire relire/.test(corps);
  dire(cases === 0 ? avertit === false : avertit === true,
    f + " : " + cases + " case(s) à compléter, et le bandeau de brouillon " + (avertit ? "est là" : "est absent"));

  // ELLES SE LISENT SUR SON TÉLÉPHONE, PAS SEULEMENT SUR UN ÉCRAN LARGE.
  // Payé le 8 septembre : « [À COMPLÉTER — dénomination, adresse, téléphone] »
  // portait white-space:nowrap, et cela a emporté la page ENTIÈRE à 546 px de
  // large sur un écran de 390. Une page qui glisse latéralement se lit une
  // main sur deux — et toutes les autres mesures étaient vertes.
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const onglet = await ctx.newPage();
  await onglet.goto(BASE + "/" + f, { waitUntil: "networkidle" });
  const large = await onglet.evaluate(() => document.documentElement.scrollWidth);
  dire(large <= 390, f + " : rien ne déborde en largeur (" + large + " px)");
  dire(await onglet.locator(".brouillon").first().isVisible(),
    f + " : le bandeau de brouillon se voit dès l'ouverture, sans défiler");
  await ctx.close();
}

console.log("\nLes règles du dépôt");
const texte = await page.evaluate(() => document.body.innerText);
dire(!/[→›]/.test(texte), "aucune flèche décorative (CLAUDE.md §3)");
dire(erreurs.length === 0, "aucune erreur de page" + (erreurs.length ? " : " + erreurs[0] : ""));

await nav.close();
console.log(rouges === 0 ? "\nTout est vert." : "\n" + rouges + " ROUGE(S).");
process.exit(rouges === 0 ? 0 : 1);
