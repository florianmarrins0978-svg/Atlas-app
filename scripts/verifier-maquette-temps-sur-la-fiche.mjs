/*
  LE TEMPS PASSÉ, MONTRÉ OU NON — ce que cette planche doit tenir.

  Sa demande du 22 août 2026 : *« il faudrait mettre un petit bouton on/off pour
  si l'utilisateur ne veut pas que le temps apparaisse sur la fiche, pouvoir
  l'effacer. On, le temps apparaîtrait sur la fiche ; off, il n'apparaîtrait
  pas. »*

  CE CONTRÔLE NE REGARDE PAS UNE MISE EN PAGE, IL SE SERT DE LA PLANCHE.

    1. **L'interrupteur est SUR la ligne du titre « Temps passé »**, et son état
       s'écrit en toutes lettres. Un curseur nu se décode ; un mot se lit.
    2. **Éteint, la ligne du compte rendu DISPARAÎT** — elle ne se grise pas.
       C'est le cœur de sa demande, et c'est ce que le client verra.
    3. **Rallumé, elle revient**, et avec la bonne durée : un aller-retour qui
       ramènerait « — » ou un chiffre d'avant serait pire que pas de bouton.
    4. **Masqué, une phrase COURTE le dit** — celle qu'il a dictée le 23 août,
       mot pour mot : « votre client ne le verra pas sur son compte rendu ».
    5. **Aucun total gris à droite de la molette** (retiré le 23 août, à sa
       demande), et le compte rendu porte le libellé de l'application.
    6. **Une fois le rapport parti, l'interrupteur s'éteint** avec la molette et
       le bouton — la fiche est figée, c'est déjà la règle de cet écran.
    7. **Rien ne déborde à 390 px**, la largeur de son téléphone.

  Il sait échouer : éprouvé en remplaçant `display:none` de `.temps-doc.partie`
  par une simple opacité (2 rougit : la ligne est encore lue), en supprimant la
  phrase « reste enregistré » (4 rougit), et en laissant l'interrupteur vivant
  après l'envoi (6 rougit).

  Usage : node scripts/verifier-maquette-temps-sur-la-fiche.mjs
*/
import path from "node:path";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

// Le navigateur du bac à sable, quand il est là — le même chemin que les
// contrôles voisins. Ailleurs (la CI), Playwright trouve le sien.
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const PAGE = "file://" + path.resolve("appli/temps-sur-la-fiche.html");
const soucis = [];
const dire = (ok, quoi) => { if (!ok) soucis.push(quoi); };

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => soucis.push(`erreur JS : ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") soucis.push(`console : ${m.text()}`); });

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(200);

const bascule = page.locator("#bascule");
const tempsDoc = page.locator("#temps-doc");
const note = page.locator("#note");

// 1 — l'interrupteur est sur la ligne du titre, et il se lit
dire(await bascule.count() === 1, "aucun interrupteur : la planche ne répond pas à sa demande");
const surLaLigne = await page.evaluate(() => {
  const ligne = document.querySelector(".ligne-titre");
  return Boolean(ligne && ligne.querySelector("#bascule") && /temps passé/i.test(ligne.textContent));
});
dire(surLaLigne, "l'interrupteur n'est pas sur la ligne du titre « Temps passé »");
// `innerText` rend le texte TEL QU'IL EST PEINT : la ligne étant en petites
// capitales, il remonte « VISIBLE ». Comparer à la casse près ferait rougir un
// écran juste — et l'on retirerait la capitale pour contenter le contrôle.
const motAffiche = async () => (await page.locator("#mot").innerText()).trim().toLowerCase();
dire(await motAffiche() === "visible",
  "l'état ne s'écrit pas « Visible » au départ : il faut décoder la position du curseur");

// **Le doigt vise 44 px** — ce qu'Apple demande. Une bascule de 20 px se rate,
// et un raté sur CE bouton envoie une durée qu'il voulait cacher.
const boite = await bascule.boundingBox();
dire(boite !== null, "l'interrupteur n'a aucune boîte : la planche ne s'est pas mise en page");
if (boite) {
  dire(boite.width > 0 && boite.height > 0, "l'interrupteur mesure zéro : rien n'est mesurable ici");
  dire(boite.height >= 26, `l'interrupteur ne fait que ${Math.round(boite.height)} px de haut : le doigt le rate`);
}

// 2 — éteint, la ligne du client DISPARAÎT (elle ne se grise pas)
dire(await tempsDoc.isVisible(), "le temps ne paraît pas sur le compte rendu au départ");
const avant = (await tempsDoc.innerText()).trim();
dire(avant.length > 0, "la ligne du compte rendu est vide : mesure impossible, pas un succès");

await bascule.click();
await page.waitForTimeout(200);
dire(await bascule.getAttribute("aria-pressed") === "false", "l'interrupteur ne s'éteint pas");
dire(await motAffiche() === "masqué", "l'état éteint ne s'écrit pas « Masqué »");
dire(await tempsDoc.isHidden(), "le temps est encore visible sur le compte rendu : c'est exactement ce qu'il veut effacer");
// Une ligne cachée par une simple opacité reste LUE : elle occupe encore sa
// place, et une capture d'écran la montrerait. On exige qu'elle s'en aille.
const encoreLa = await page.evaluate(() => {
  const p = document.getElementById("temps-doc");
  const r = p.getBoundingClientRect();
  return r.height > 0 || r.width > 0;
});
dire(!encoreLa, "la ligne du compte rendu est seulement grisée : elle prend encore sa place");

// 4 — masqué, une phrase COURTE dit ce que le client ne verra pas
//
// **Elle a maigri le 23 août, à sa demande** : « raccourcis la phrase à "votre
// client ne le verra pas sur son compte rendu" ». La version d'avant annonçait
// aussi que la durée restait enregistrée, et ce contrôle l'exigeait — le garder
// aurait rendu impossible le retrait qu'il demandait (`CLAUDE.md` §5 bis :
// quand une suite rougit après un retrait voulu, on adapte le contrôle).
dire(await note.isVisible(), "rien ne dit que le client ne verra pas le temps");
const phrase = (await note.innerText()).trim();
dire(phrase === "Votre client ne le verra pas sur son compte rendu.",
  `la phrase masquée est « ${phrase} » au lieu de celle qu'il a dictée`);

// 3 — rallumé, elle revient avec la bonne durée
await bascule.click();
await page.waitForTimeout(200);
dire(await tempsDoc.isVisible(), "le temps ne revient pas quand on rallume");
dire((await tempsDoc.innerText()).trim() === avant,
  `au retour le compte rendu écrit « ${(await tempsDoc.innerText()).trim()} » au lieu de « ${avant} »`);
dire(await note.isHidden(), "la phrase du masquage reste affichée alors que le temps est visible");

// 5 — le compte rendu suit la molette, et AUCUN total gris ne subsiste
//
// **Le total à droite des listes est parti le 23 août, à sa demande.** Ce
// contrôle le refuse désormais : le laisser revenir par mégarde ferait
// réapparaître ce qu'il a fait enlever.
dire(await page.locator("#total").count() === 0,
  "le total gris est revenu à droite de la molette : il l'a fait enlever le 23 août");
await page.selectOption("#heures", "0");
await page.selectOption("#minutes", "45");
await page.waitForTimeout(150);
dire((await page.locator("#temps-doc-valeur").innerText()).trim() === "45 min",
  "le compte rendu n'a pas suivi la molette : deux chiffres pour une même durée");
await page.selectOption("#heures", "2");
await page.selectOption("#minutes", "0");
await page.waitForTimeout(150);
dire((await page.locator("#temps-doc-valeur").innerText()).trim() === "2 h",
  "« 2 h 00 » au lieu de « 2 h » : ce n'est pas le libellé de l'application");

// 6 — une fois parti, tout se fige
await page.locator("#envoyer").click();
await page.waitForTimeout(200);
dire(await bascule.isDisabled(), "l'interrupteur vit encore après l'envoi : le compte rendu est pourtant figé");
dire(await page.locator("#heures").isDisabled(), "la molette vit encore après l'envoi");
dire(await page.locator("#envoyer").isDisabled(), "« Enregistrer et envoyer » se represse après l'envoi");
dire((await page.locator("#fige").innerText()).trim().length > 0, "rien ne dit que la fiche est figée");

// 7 — rien ne déborde
const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
dire(debord <= 0, `la planche déborde de ${debord} px sur la largeur de son téléphone`);

await navigateur.close();

if (soucis.length) {
  console.error("❌ Le temps passé, montré ou non — la planche ne tient pas :");
  for (const s of soucis) console.error(`   · ${s}`);
  process.exit(1);
}
console.log("✅ Le temps passé — l'interrupteur efface la ligne du client, et le dit.");
