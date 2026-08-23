#!/usr/bin/env node
/*
  Éprouve `appli/fiche-client-vocale.html` — la fiche client qui dicte le devis.

  **D'où elle vient.** Sa demande du 21 août 2026, capture de l'écran à l'appui :
  le nom et le numéro sur une seule ligne, plus aucun « facultatif », le carré
  photo et l'anneau de la fiche chantier ramenés ici, et — le cœur de la
  demande — *« dès que je rappuie sur la note vocale pour stopper
  l'enregistrement, il faut IMPÉRATIVEMENT que les infos aillent s'enregistrer
  dans le devis »*, parce qu'il est en rendez-vous et qu'il va fermer l'appli.

  ─────────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE TIENT, ET POURQUOI CHAQUE POINT EST LÀ.

  1. **Aucun « facultatif », nulle part.** C'est un retrait, et un retrait se
     vérifie par ce qui ne doit plus apparaître — sans quoi il revient à la
     première réécriture.

  2. **Le numéro n'est pas COUPÉ.** La première version le tronquait à « 06 79
     98 45 1 » : le dernier chiffre passait à la trappe, en silence, sur la
     seule donnée qu'on ne peut pas deviner. Le contrôle compare la largeur du
     texte à celle de sa boîte — et **refuse de conclure sur une boîte de zéro
     pixel** (`CLAUDE.md` §5, le contrôle qui mesurait 0 − 0 = 0).

  3. **Le carré photo n'impose PAS l'appareil.** Un attribut `capture` sur un
     iPhone retire l'accès à la pellicule : l'artisan qui a photographié le
     matin ne pourrait rien joindre l'après-midi. C'est écrit noir sur blanc
     dans `Pellicule.tsx`, et une maquette qui l'oublierait ferait recoder le
     défaut.

  4. **« Mon devis → » n'existe pas AVANT la dictée, et existe APRÈS.** Les deux
     moitiés comptent : un geste offert avant qu'il y ait quoi que ce soit à
     préparer est une promesse vide.

  5. **Le chantier se pose à l'accueil au second appui.** C'est sa phrase
     entière : il ferme l'appli tout de suite après. Si l'enregistrement
     attendait un geste de plus, il perdrait son rendez-vous.

  6. **Aucun prix n'est inventé sur le devis dessiné.** Il n'a annoncé aucun
     montant en dictant (`CLAUDE.md` §4).

  **Il sait échouer.** Éprouvé en remettant « (facultatif) » sur un intitulé, en
  rétrécissant la case du numéro à 132 px (la largeur fautive d'origine), en
  posant `capture="environment"` sur le champ de fichier, et en affichant « Mon
  devis → » dès l'arrivée : chacun rougit, en nommant le point exact.

  Usage : node scripts/verifier-maquette-fiche-client-vocale.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(process.argv[2] ?? join(RACINE, "appli", "fiche-client-vocale.html"));

if (!existsSync(CIBLE)) {
  console.error(`La maquette n'existe pas : ${CIBLE}`);
  process.exit(1);
}

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
// `networkidle` et non `load` : sans la mise en page appliquée, toutes les
// largeurs valent zéro et le contrôle rendrait un vert qui ne prouve rien.
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La fiche client qui dicte le devis ===\n");

// ── 1. Plus aucun « facultatif » ────────────────────────────────────────────
const texteEntier = (await page.locator("body").innerText()).toLowerCase();
dire(
  !texteEntier.includes("facultatif"),
  "« facultatif » n'apparaît nulle part — il a demandé de tous les retirer"
);
// **Le MOT part, les deux boutons restent.** Sa correction immédiate : « non,
// remets le Mr et Mme, je voulais juste que tu enlèves le titre civilité ».
// Les deux moitiés se tiennent — retirer les boutons était une amputation, et
// remettre l'intitulé annulerait le gain de place.
dire(!texteEntier.includes("civilité"), "l'intitulé « Civilité » a disparu");
dire(
  (await page.locator(".civilite button").count()) === 2,
  "mais Mr et Mme sont bien là — c'est l'intitulé qu'il voulait retirer, pas le choix"
);

// ── 2. Le nom et le numéro sur la MÊME ligne, et rien de coupé ──────────────
const nom = page.locator("#nom");
const tel = page.locator("#tel");
const bNom = await nom.boundingBox();
const bTel = await tel.boundingBox();
dire(
  bNom !== null && bTel !== null && bNom.width > 40 && bTel.width > 40,
  "les deux cases sont dessinées (une boîte de zéro pixel ne se mesure pas)"
);
if (bNom && bTel) {
  dire(
    Math.abs(bNom.y - bTel.y) < 4,
    `le nom et le numéro sont sur la même ligne (écart vertical ${Math.round(Math.abs(bNom.y - bTel.y))} px)`
  );
}
for (const [quoi, champ] of [["nom", nom], ["numéro", tel]]) {
  const { deborde, ecart } = await champ.evaluate((el) => ({
    deborde: el.scrollWidth > el.clientWidth + 1,
    ecart: el.scrollWidth - el.clientWidth,
  }));
  dire(!deborde, `le ${quoi} tient dans sa case, entier (${deborde ? `${ecart} px dehors` : "rien dehors"})`);
}

// ── 2 bis. Ses trois corrections du 21 août au soir ────────────────────────
//
//   « Garde un seul bouton, garde je rédige mon devis. »
//   « Comment lui envoyer son devis, tu le mets sous l'adresse. »
//   « Au-dessus du numéro de téléphone, marqué numéro de téléphone » — puis,
//   dans la foulée : « enlève numéro de, laisse juste téléphone ».
//
// Ce sont des demandes littérales : un contrôle qui vise l'ordre et les mots
// exacts est le seul qui les défende contre la réécriture suivante.

const titres = page.locator(".duo-titres span");
dire(
  (await titres.nth(1).innerText()).trim().toLowerCase() === "téléphone",
  "« Téléphone » est écrit au-dessus de la case du numéro — le mot qu'il a retenu"
);
for (const i of [0, 1]) {
  const { dehors } = await titres.nth(i).evaluate((el) => ({ dehors: el.scrollWidth - el.clientWidth }));
  dire(dehors <= 1, `l'intitulé « ${(await titres.nth(i).innerText()).trim()} » n'est pas coupé`);
}

const yAdresse = (await page.locator('input[placeholder="12 rue des Lilas, Nantes"]').boundingBox())?.y ?? 0;
const yCanal = (await page.locator("#bloc-canal").boundingBox())?.y ?? 0;
dire(yAdresse > 0 && yCanal > 0, "l'adresse et la question de l'envoi sont dessinées");
dire(yCanal > yAdresse, "« Comment lui envoyer son devis ? » est SOUS l'adresse, comme il l'a demandé");

const actions = page.locator("button.principal");
dire((await actions.count()) === 1, "un seul bouton d'action au bas de l'écran");
dire(
  (await actions.first().innerText()).trim() === "Je rédige mon devis",
  "et c'est « Je rédige mon devis » — ses mots, à la lettre"
);

// ── 2 ter. Les dix chiffres se posent tout seuls ───────────────────────────
//
// *« Il faut que je puisse taper les dix chiffres à la suite et qu'ils se
// mettent automatiquement avec les bons espaces. »* Sur un chantier, devant le
// client, on ne s'arrête pas toutes les deux touches.

await page.fill("#tel", "");
await page.type("#tel", "0679984514");
dire(
  (await page.inputValue("#tel")) === "06 79 98 45 14",
  `dix chiffres d'affilée deviennent « 06 79 98 45 14 » (obtenu : « ${await page.inputValue("#tel")} »)`
);

await page.fill("#tel", "");
await page.type("#tel", "06.79-98x45y14");
dire(
  (await page.inputValue("#tel")) === "06 79 98 45 14",
  "les points, tirets et lettres tombent — c'est un numéro, pas une note"
);

// **Un indicatif ne se découpe pas comme un numéro français.** Espacer
// « +33679984514 » par paires rendrait « +33 67 99 84 51 4 », qui n'est le
// numéro de personne : celui qui tape un « + » sait ce qu'il écrit.
await page.fill("#tel", "");
await page.type("#tel", "+33679984514");
dire(
  (await page.inputValue("#tel")) === "+33679984514",
  "un numéro international n'est pas retouché"
);

// Le geste le plus courant après la frappe : corriger un chiffre au milieu. Un
// curseur renvoyé au bout à chaque touche rend la correction impossible.
await page.fill("#tel", "");
await page.type("#tel", "0679984514");
await page.locator("#tel").evaluate((e) => e.setSelectionRange(4, 4));
await page.keyboard.type("5");
dire(
  (await page.locator("#tel").evaluate((e) => e.selectionStart)) === 5,
  "le curseur reste où l'on corrige, il ne saute pas à la fin"
);
await page.fill("#tel", "06 79 98 45 14");

// ── 3. Le carré photo ouvre le menu du téléphone, sans l'enfermer ───────────
const fichier = page.locator('input[type="file"]');
dire((await fichier.count()) === 1, "un seul champ de fichier, comme dans `Pellicule.tsx`");
dire((await fichier.getAttribute("accept")) === "image/*", "il accepte les images");
dire((await fichier.getAttribute("multiple")) !== null, "il en prend plusieurs d'un coup");
dire(
  (await fichier.getAttribute("capture")) === null,
  "il n'IMPOSE pas l'appareil photo — sur iPhone, `capture` retire l'accès à la pellicule"
);

// ── 4. L'anneau est bien celui de l'application ────────────────────────────
const cercles = page.locator("#anneau span[data-cercle]");
dire((await cercles.count()) === 2, "l'anneau porte ses deux cercles (74 px vert pin, 56 px or)");
const ailes = page.locator("#anneau .atlas-aile");
dire((await ailes.count()) === 2, "les ondes sont de chaque côté, comme sur la fiche chantier");
dire((await page.locator("#anneau .atlas-aile-g i").count()) === 8, "huit barreaux par aile, comme dans `globals.css`");

// ── 5. « Mon devis → » : absent avant la dictée, présent après ──────────────
dire(!(await page.locator("#vers-devis").isVisible()), "avant de dicter, « Mon devis » n'existe pas");

/**
 * L'accueil se regarde EN ÉTANT DESSUS, jamais depuis l'écran d'à côté.
 *
 * **Le piège, tombé du premier coup.** Les écrans de cette maquette sont des
 * sections masquées : demander « la carte est-elle visible ? » depuis la fiche
 * client rend TOUJOURS non — le parent est caché. Le contrôle aurait donc dit
 * vrai avant la dictée pour une mauvaise raison, et faux après pour la même.
 * Un contrôle qui répond juste par accident ne prouve rien (`CLAUDE.md` §5).
 */
async function chantierAAccueil() {
  const revenir = await page.locator("#fiche.actif").count();
  await page.click('[data-va="accueil"]');
  const la = await page.locator("#brin-julien").isVisible();
  if (revenir) await page.click('[data-va="fiche"]');
  return la;
}

dire(!(await chantierAAccueil()), "avant de dicter, l'accueil ne porte aucun chantier");

await page.click("#dicter");
await page.waitForTimeout(300);
dire((await page.locator("#anneau").getAttribute("data-lit")) === "oui", "un appui lance la dictée, et l'onde bat");
dire(!(await page.locator("#vers-devis").isVisible()), "pendant la dictée, « Mon devis » n'apparaît pas encore");

await page.click("#dicter");
await page.waitForTimeout(400);
dire(await page.locator("#vers-devis").isVisible(), "au second appui, « Mon devis → » apparaît");
dire(
  await chantierAAccueil(),
  "au second appui, le chantier EST à l'accueil — il peut fermer l'application"
);

// ── 6. Le chemin qu'il a décrit, en entier ─────────────────────────────────
//
// **Et avec SON nom, pas un nom d'exemple.** Sa remarque du 21 août au soir :
// « quand je clique sur devis à terminer, je dois arriver directement sur la
// page du devis, et les infos que j'ai dictées doivent être remplies ». Le
// contrôle change donc le nom et l'adresse AVANT de dicter, puis vérifie qu'on
// les retrouve à l'accueil et sur le devis — une maquette qui afficherait
// toujours « M. Julien » passerait pour juste sans rien prouver.
await page.click('[data-va="fiche"]');
await page.fill("#nom", "Mme Berthier");
await page.fill("#adresse", "3 chemin du Pré, Vertou");
await page.click("#dicter");
await page.waitForTimeout(300);
await page.click("#dicter");
await page.waitForTimeout(300);

await page.click('[data-va="accueil"]');
const carte = await page.locator("#brin-julien").innerText();
dire(carte.includes("Mme Berthier"), "à l'accueil, la carte porte le nom QU'IL A saisi");
dire(carte.includes("3 chemin du Pré, Vertou"), "et son adresse");

await page.click("#brin-julien");
dire(await page.locator("#devis.actif").isVisible(), "depuis l'accueil, le chantier ouvre DIRECTEMENT le devis");
const entete = await page.locator("#devis .doc").innerText();
dire(entete.includes("Mme Berthier"), "le devis ouvre déjà rempli à son nom");
dire(entete.includes("3 chemin du Pré, Vertou"), "avec l'adresse du chantier");

const devis = (await page.locator("#devis").innerText()).toLowerCase();
for (const attendu of ["taille de haie", "hortensias", "tonte de la pelouse"]) {
  dire(devis.includes(attendu), `le devis porte « ${attendu} », tirée de la dictée`);
}
dire(devis.includes("20 ml"), "la mesure dictée est là, en 20 ml");
dire(
  !/\d+[\s ]*€/.test(await page.locator(".doc").innerText()),
  "aucun montant n'est inventé sur le devis — il n'en a dicté aucun"
);

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ La maquette tient ce qu'elle promet."
    : `\n❌ ${plaintes.length} manquement(s) :\n   · ${plaintes.join("\n   · ")}`
);
process.exit(plaintes.length === 0 ? 0 : 1);
