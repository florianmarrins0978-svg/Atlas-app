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

/** Répond à la question affichée. `null` = passer. Rend son intitulé. */
const repondre = async (valeur) => {
  const q = (await creation.locator("[data-question]").innerText()).replace(/\s+/g, " ");
  if (await creation.locator("[data-select]").isVisible()) {
    // Le menu déroulant se choisit PAR SA VALEUR, jamais par son libellé :
    // « SAS » est contenu dans « SASU », et un filtre sur le texte prendrait
    // la mauvaise forme juridique — donc le mauvais embranchement.
    await creation.locator("[data-select]").selectOption(valeur);
    await creation.locator("[data-avancer]").click();
  } else if (await creation.locator("[data-liste]").isVisible()) {
    await creation.locator("[data-liste] button", { hasText: valeur }).first().click();
  } else if (valeur === null) {
    await creation.locator("[data-passer]").click();
  } else {
    await creation.locator("[data-champ]").fill(valeur);
    await creation.locator("[data-avancer]").click();
  }
  return q;
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
    else if (/vous appelez-vous|adresse e-mail \?|mot de passe|nom de votre entreprise/i.test(q)) reponse = "essai";
    vues.push(q);
    await repondre(reponse);
  }
  return vues;
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

console.log("\nLa forme juridique est un menu déroulant");
await repartir();
for (let i = 0; i < 4; i++) {
  await creation.locator("[data-champ]").fill("essai");
  await creation.locator("[data-avancer]").click();
}
dire(/forme juridique/i.test(await creation.locator("[data-question]").innerText()),
  "on arrive bien sur la forme juridique");
dire(await creation.locator("[data-select]").isVisible(),
  "c'est un menu déroulant — pas onze boutons énumérés");
dire(!(await creation.locator("[data-liste]").isVisible()),
  "aucune liste de boutons n'est affichée à sa place");
const options = await creation.locator("[data-select] option").allTextContents();
dire(options.length === 12, "il porte les onze formes, plus l'invite (" + options.length + " lignes)");
dire(options.some((o) => /^EURL — SARL à associé unique/.test(o)),
  "chaque sigle voyage avec son nom — « EURL » seul ne se retient pas");
// Obligatoire veut dire obligatoire : « Continuer » ne doit pas enjamber un
// menu resté sur son invite, sinon les deux questions que la forme commande
// disparaîtraient pour de mauvaises raisons.
await creation.locator("[data-avancer]").click();
dire(/forme juridique/i.test(await creation.locator("[data-question]").innerText()),
  "« Continuer » n'enjambe pas un menu resté vide");
dire(!(await creation.evaluate((e) => e.scrollHeight > e.clientHeight + 1)),
  "l'écran de la forme juridique ne défile plus");

console.log("\nCe qui ne se passe pas, et ce qui se passe");
await repartir();
for (const attendu of [true, true, true, true, true]) {
  dire((await creation.locator("[data-passer]").isHidden()) === attendu,
    "question obligatoire : « Passer » est absent — " +
      (await creation.locator("[data-question]").innerText()).replace(/\s+/g, " ").slice(0, 34));
  if (await creation.locator("[data-select]").isVisible()) {
    await creation.locator("[data-select]").selectOption({ index: 1 });
    await creation.locator("[data-avancer]").click();
  } else if (await creation.locator("[data-liste]").isVisible()) {
    await creation.locator("[data-liste] button").first().click();
  } else { await creation.locator("[data-champ]").fill("essai"); await creation.locator("[data-avancer]").click(); }
}
// Cinq obligatoires d'affilée : nom, e-mail, mot de passe, nom de
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
  if (await creation.locator("[data-select]").isVisible()) {
    await creation.locator("[data-select]").selectOption({ index: 1 });
    await creation.locator("[data-avancer]").click();
  } else if (await creation.locator("[data-liste]").isVisible()) {
    await creation.locator("[data-liste] button").first().click();
  } else if (await creation.locator("[data-passer]").isVisible()) {
    await creation.locator("[data-passer]").click();
  } else {
    await creation.locator("[data-champ]").fill("essai");
    await creation.locator("[data-avancer]").click();
  }
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
  // Le bouton « Continuer » ne doit jamais être poussé hors du cadre par une
  // liste longue : la forme juridique en a onze.
  if (await creation.locator("[data-select]").isVisible()) {
    await creation.locator("[data-select]").selectOption({ index: 1 });
    await creation.locator("[data-avancer]").click();
  } else if (await creation.locator("[data-liste]").isVisible()) {
    await creation.locator("[data-liste] button").first().click();
  } else {
    const b = await creation.locator("[data-avancer]").boundingBox();
    const c = await creation.boundingBox();
    if (!(b && c && b.y + b.height <= c.y + c.height + 1)) {
      dire(false, "« Continuer » sort du cadre à la question " + (i + 1));
      break;
    }
    await creation.locator("[data-champ]").fill("essai");
    await creation.locator("[data-avancer]").click();
  }
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
