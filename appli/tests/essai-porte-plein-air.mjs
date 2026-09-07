/**
 * « La porte en plein air » — la planche se parcourt en entier, comme lui.
 *
 * **Pourquoi cette suite existe.** Trois fois, une adresse lui a été transmise
 * sans que personne ne l'ait ouverte, et c'est LUI qui a trouvé le défaut
 * (`AGENTS.md`). Une planche dont on attend un choix — ici la proposition 1 ou
 * la 2 pour la création de compte — se parcourt donc d'abord ici, dans un vrai
 * navigateur, sur un téléphone.
 *
 * **Ce qu'elle garde par-dessus tout : les écrans TIENNENT.** Une porte est le
 * seul écran qu'on ne peut pas faire défiler du pouce avant d'être entré ; un
 * bouton « Créer un compte » repoussé hors du cadre ne se voit pas sur une
 * capture d'en haut, et se paie à l'essai. Chaque écran est donc mesuré.
 *
 * **Et elle garde LE CHEMIN QU'IL A DEMANDÉ**, qui est tout l'objet de la
 * planche : « Créer un compte » mène à la création, « Se connecter » mène à la
 * proposition B. Une porte dont les deux boutons mèneraient au même endroit
 * passerait toutes les mesures de hauteur sans qu'on s'en aperçoive.
 *
 * **LA PHOTO EST VÉRIFIÉE COMME UNE PIÈCE, PAS COMME UN DÉCOR.** C'est la
 * première image du dossier `appli/`, et une image qui ne charge pas laisse
 * un écran NOIR avec du texte blanc dessus — donc lisible, donc invisible à
 * toute mesure de débordement. La suite exige que le fichier réponde et qu'il
 * ait des pixels (`naturalWidth`), pas seulement qu'une balise existe.
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

console.log("\nLa planche s'ouvre");
const tel = page.locator("[data-tel]");
const pas = page.locator("[data-tel-pas]");
dire((await tel.count()) === 1 && (await pas.count()) === 1, "les deux téléphones sont là");
dire(
  (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
  "rien ne déborde en largeur sur un téléphone de 390 px",
);

console.log("\nLa photo");
const photo = tel.locator(".porte .photo");
const pixels = await photo.evaluate((i) => ({ l: i.naturalWidth, h: i.naturalHeight, complet: i.complete }));
dire(pixels.complet && pixels.l > 400 && pixels.h > 400,
  "la photo a de vrais pixels (" + pixels.l + "×" + pixels.h + ")");
// Une photo décorative ne se lit pas à voix haute : elle ne dit rien qu'un
// aveugle n'ait déjà par les boutons. `alt=""` est donc VOULU, pas oublié.
dire((await photo.getAttribute("alt")) === "", "la photo est marquée décorative (alt vide)");

console.log("\nLa porte");
const cadre = await tel.locator('[data-ecran="porte"]').boundingBox();
dire(cadre !== null && cadre.width > 200 && cadre.height > 400,
  "l'écran a de la matière (" + (cadre ? Math.round(cadre.width) + "×" + Math.round(cadre.height) : "absent") + ")");
dire(await tel.locator('.pastille', { hasText: "Créer un compte" }).isVisible(), "« Créer un compte » se voit");
dire(await tel.locator('.second', { hasText: "Se connecter" }).isVisible(), "« Se connecter » se voit");
dire(await tel.locator(".porte .nom").isVisible(), "la marque se voit");
// Retirés à sa demande du 8 septembre. Une suite qui ne garde QUE ce qui est
// présent laisserait revenir ce qu'il a fait enlever, sans qu'on le voie.
dire((await tel.locator(".porte .sceau").count()) === 0, "aucun sceau à l'étoile — retiré à sa demande");
dire((await tel.locator("[data-accroche]").count()) === 0, "aucune accroche — retirée à sa demande");

// Sa demande porte SUR CETTE PHRASE : elle doit être là, et ses deux liens avec.
const mentions = tel.locator(".porte .mentions");
dire(await mentions.isVisible(), "la phrase des conditions d'utilisation se voit");
const texteMentions = (await mentions.innerText()).replace(/\s+/g, " ");
dire(/vous acceptez nos/.test(texteMentions), "la phrase dit bien qu'on accepte en appuyant");
dire((await mentions.locator("a").count()) === 2, "elle porte ses deux liens");

const debordePorte = await tel.locator('[data-ecran="porte"]')
  .evaluate((e) => e.scrollHeight > e.clientHeight + 1);
dire(!debordePorte, "tout tient dans le cadre de la porte");

console.log("\nLe chemin qu'il a demandé");
await tel.locator('.pastille[data-aller="creation"]').click();
dire(await tel.locator('[data-ecran="creation"]').isVisible(), "« Créer un compte » mène à la création");
for (const champ of ["Votre nom", "Votre e-mail", "Un mot de passe", "Nom de l’entreprise"]) {
  dire(await tel.locator('[data-ecran="creation"] input[placeholder="' + champ + '"]').isVisible(),
    "création : le champ « " + champ + " » se voit");
}
// Sa demande du 8 septembre : ce qui est saisi ici doit remplir ses réglages,
// « ça fait d'une pierre deux coups ». Les libellés sont ceux de l'écran
// « Mon entreprise » — deux mots différents pour la même case feraient croire
// à deux cases.
for (const champ of ["SIRET — 14 chiffres", "Adresse du siège", "Numéro de téléphone"]) {
  dire(await tel.locator('[data-ecran="creation"] input[placeholder="' + champ + '"]').isVisible(),
    "création : le champ de réglages « " + champ + " » se voit");
}
{
  const mot = (await tel.locator('[data-ecran="creation"] .section').innerText()).toLowerCase();
  dire(mot.includes("facultatif"), "création : la section est annoncée facultative");
  const apres = (await tel.locator('[data-ecran="creation"] .apres').innerText()).replace(/\s+/g, " ");
  dire(/Réglages/.test(apres), "création : l'écran dit où finir plus tard");
}
dire(await tel.locator('[data-ecran="creation"] .principal').isVisible(), "création : le bouton se voit");
// La création a le droit de défiler — elle vient APRÈS la porte, et sept
// champs ne tiennent pas en 604 px. Ce qui se garde n'est donc plus qu'elle
// tienne, mais que le bouton soit ATTEIGNABLE au doigt.
{
  const ecran = tel.locator('[data-ecran="creation"]');
  const bouton = ecran.locator(".principal");
  await bouton.scrollIntoViewIfNeeded();
  const b = await bouton.boundingBox();
  const c = await ecran.boundingBox();
  dire(b !== null && c !== null && b.height > 30 && b.y >= c.y - 1 && b.y + b.height <= c.y + c.height + 1,
    "création : le bouton est atteignable en faisant défiler");
  await ecran.evaluate((e) => { e.scrollTop = 0; });
}

await tel.locator('[data-ecran="creation"] .retour').click();
await tel.locator('.second[data-aller="connexion"]').click();
dire(await tel.locator('[data-ecran="connexion"]').isVisible(), "« Se connecter » mène à la connexion");
// C'est la proposition B, recopiée : ce qu'elle portait doit y être encore.
for (const mot of ["Google", "Apple"]) {
  dire(await tel.locator('[data-ecran="connexion"] .duo button', { hasText: mot }).isVisible(),
    "connexion : le bouton " + mot + " se voit");
}
dire(await tel.locator('[data-ecran="connexion"] .visage').isVisible(),
  "connexion : « Ouvrir avec Face ID » est là — sa règle du 30 août, le mot de passe et le visage cohabitent");
for (const champ of ["Adresse", "Mot de passe"]) {
  dire(await tel.locator('[data-ecran="connexion"] input[placeholder="' + champ + '"]').isVisible(),
    "connexion : le champ « " + champ + " » se voit");
}
dire(!(await tel.locator('[data-ecran="connexion"]').evaluate((e) => e.scrollHeight > e.clientHeight + 1)),
  "connexion : tout tient dans le cadre");

await tel.locator('[data-ecran="connexion"] .retour').click();
dire(await tel.locator('[data-ecran="porte"]').isVisible(), "le retour ramène à la porte");

console.log("\nUne question à la fois");
const ETAPES = 7;
dire((await pas.locator("[data-rang]").innerText()) === "1 sur " + ETAPES, "elle commence à la première question");

// « Passer » n'existe QUE sur les facultatives. C'est la moitié de sa demande
// du 8 septembre — « faut pas non plus que ça le bloque » — et l'autre moitié
// est qu'il ne croie pas pouvoir sauter les quatre premières.
for (let i = 0; i < 4; i++) {
  dire(await pas.locator("[data-passer]").isHidden(), "question " + (i + 1) + " : pas de « Passer » — elle est obligatoire");
  await pas.locator("[data-etape-champ]").fill("essai");
  await pas.locator("[data-avancer]").click();
}
for (let i = 5; i <= ETAPES; i++) {
  dire(await pas.locator("[data-passer]").isVisible(), "question " + i + " : « Passer » est offert");
  await pas.locator("[data-passer]").click();
}
dire(await pas.locator("[data-fini]").isVisible(), "sept étapes mènent au bout");
// Un écran de fin sans geste de suite est un cul-de-sac : il a l'air d'une
// panne. Trouvé en REGARDANT la capture, par aucun test.
dire(await pas.locator("[data-fini] .principal").isVisible(), "l'écran de fin offre d'entrer dans Atlas");

// L'AUTRE MOITIÉ DE SA DEMANDE : « mais faut lui préciser ». Un « c'est fait »
// muet laisserait partir un premier devis sans SIRET ni adresse, et il ne
// l'apprendrait que chez son client.
const reste = pas.locator("[data-reste]");
dire(await reste.isVisible(), "l'écran de fin dit ce qui manque");
const dit = (await reste.innerText()).replace(/\s+/g, " ");
for (const manquant of ["le SIRET", "l’adresse", "le téléphone"]) {
  dire(dit.includes(manquant), "il nomme « " + manquant + " » parmi ce qui manque");
}
dire(/Réglages/.test(dit), "il dit OÙ le remplir");

dire(!(await pas.locator(".ecran").evaluate((e) => e.scrollHeight > e.clientHeight + 1)),
  "une question à la fois : tout tient dans le cadre");

// Et quand tout est rempli, il ne réclame rien : un avertissement qui parle à
// tort s'apprend à être ignoré (`CLAUDE.md` §4 ter).
await pas.locator("[data-recommencer]").click();
for (let i = 0; i < ETAPES; i++) {
  await pas.locator("[data-etape-champ]").fill("essai");
  await pas.locator("[data-avancer]").click();
}
dire(await pas.locator("[data-reste]").isHidden(), "rien de rempli ne manque : l'écran se tait");

await pas.locator("[data-recommencer]").click();
dire((await pas.locator("[data-rang]").innerText()) === "1 sur " + ETAPES, "« Recommencer » revient au début");
await pas.locator("[data-etape-champ]").fill("essai");
await pas.locator("[data-avancer]").click();
await pas.locator("[data-reculer]").click();
dire((await pas.locator("[data-rang]").innerText()) === "1 sur " + ETAPES, "le retour recule d'une question");
dire((await pas.locator("[data-etape-champ]").inputValue()) === "essai", "le retour retrouve ce qui était saisi");

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
}

console.log("\nLes règles du dépôt");
const texte = await page.evaluate(() => document.body.innerText);
dire(!/[→›]/.test(texte), "aucune flèche décorative (CLAUDE.md §3)");
dire(erreurs.length === 0, "aucune erreur de page" + (erreurs.length ? " : " + erreurs[0] : ""));

await nav.close();
console.log(rouges === 0 ? "\nTout est vert." : "\n" + rouges + " ROUGE(S).");
process.exit(rouges === 0 ? 0 : 1);
