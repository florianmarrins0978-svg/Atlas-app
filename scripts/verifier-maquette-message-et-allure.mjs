/*
  DEUX PLANCHES DU 23 AOÛT 2026 — ce qu'elles doivent tenir.

  Sa demande, en deux morceaux : *« y a-t-il un endroit dans les réglages où
  l'utilisateur peut rédiger ce message automatique ? S'il n'y en a pas, il faut
  en créer un. Et il faudrait également que l'utilisateur puisse avoir un endroit
  dédié à la modification de son devis — s'il veut rajouter son logo, changer la
  typographie, changer le fond de page. »*

  CE CONTRÔLE NE REGARDE PAS UNE MISE EN PAGE, IL SE SERT DES PLANCHES.

  Le premier point est le seul qui ne se voit pas à l'œil, et c'est le plus
  important :

    1. **Le texte de la planche EST celui que le code envoie.** Il est recopié de
       `src/lib/message-client.ts`, avec `[client]`, `[lien]` et `[entreprise]`
       à la place de ce qu'Atlas remplace. Une planche qui montrerait un autre
       message ferait juger un texte que ses clients ne reçoivent pas — c'est
       exactement le malentendu qu'il vient corriger. Le jour où le code change
       et pas la planche, ce contrôle rougit.
    2. **L'aperçu remplace pour de bon** : le nom du client, le nom de
       l'entreprise, et le lien — habillé en lien, pas en texte noir.
    3. **Effacer le lien se DIT.** Sans lui, son client ne peut ni voir son devis
       ni choisir sa date : le silence serait le pire des deux.
    4. **Une pastille pose son mot LÀ OÙ LE CURSEUR EST**, pas à la fin — sinon
       il faut le déplacer au doigt sur un téléphone.
    5. **Sur l'allure : un choix touché repeint le devis.** Fond, typographie,
       accent, logo — quatre réglages, quatre effets mesurés sur la feuille.
    6. **Rien ne déborde à 390 px**, la largeur de son téléphone, et aucune des
       deux planches ne jette d'erreur.

  Il sait échouer : éprouvé en changeant un mot du texte recopié (1 rougit), en
  retirant l'alerte du lien manquant (3 rougit), en posant le jeton à la fin de
  la zone (4 rougit), et en figeant le fond de la feuille (5 rougit).

  Usage : node scripts/verifier-maquette-message-et-allure.mjs
*/
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MESSAGE = "file://" + path.resolve("appli/mon-message-au-client.html");
const ALLURE = "file://" + path.resolve("appli/allure-de-mes-devis.html");

const soucis = [];
const dire = (ok, quoi) => { if (!ok) soucis.push(quoi); };

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => soucis.push(`erreur JS : ${e.message}`));
// **Une ressource qui ne charge pas ICI n'est pas un défaut de la planche.**
// Les dix typographies viennent de Google Fonts ; le mandataire de ce poste
// refuse ce domaine, et le navigateur écrit alors « Failed to load resource ».
// Faire rougir là-dessus, c'est accuser la planche d'une panne de réseau — et
// c'est le genre de faux coupable qui coûte plus cher que pas de contrôle
// (`CLAUDE.md` §5). Tout le reste de la console rougit toujours.
//
// **Et le choix des dix reste mesurable sans elles** : on compare les PILES
// déclarées, pas les glyphes rendus. Une police absente ne peut donc pas rendre
// ce contrôle complaisant.
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (/Failed to load resource/i.test(m.text())) return;
  soucis.push(`console : ${m.text()}`);
});
const refusees = [];
page.on("requestfailed", (r) => {
  const url = r.url();
  if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return;
  refusees.push(url);
});

// **TOUT CE QUI SUIT EST SOUS FILET.** Un contrôle qui PLANTE n'accuse
// personne : en retirant une typographie pour l'éprouver, le clic sur la
// dixième a levé une exception et le rapport n'a jamais été écrit — on voyait
// une pile d'appels au lieu de « neuf typographies au lieu de dix ». Une panne
// devient donc un souci comme un autre, et le verdict s'écrit toujours
// (`CLAUDE.md` §5 : son message doit désigner le bon coupable).
try {

// ─── LA PLANCHE DU MESSAGE ───────────────────────────────────────────────
//
// **Elle a changé de forme le 23 août au soir**, et c'est lui qui l'a demandé :
// *« Pas compris, montre des exemples. »* Un aperçu unique ne montrait pas ce
// qui se joue — la phrase du milieu n'est pas la même sur un devis et sur une
// facture. Elle porte donc SIX bulles : les trois documents, dans les deux
// façons de faire.
await page.goto(MESSAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(200);

const modele = page.locator("#modele");
const refus = page.locator("#refus");
const enregistrer = page.locator("#enregistrer");

const depart = await modele.inputValue();
dire(depart.trim().length > 0, "le cadre est vide au départ : rien à juger, et rien à mesurer");

// 1 — les trois phrases de la planche sont celles que le code envoie
//
// **On lit la SOURCE, on ne rejoue pas les fonctions** : elles sont en
// TypeScript et tirent la civilité d'un autre module. Ce qui compte est que les
// phrases littérales qu'elles assemblent soient celles que la planche montre —
// une phrase changée là-bas sans l'être ici fait rougir ce contrôle, et c'est
// le but : la planche doit dire ce que ses clients reçoivent, pas autre chose.
const source = readFileSync("src/lib/message-client.ts", "utf8");
for (const nom of [
  "composerMessageClient",
  "composerMessageFacture",
  "composerMessageEntretien",
]) {
  dire(source.includes(`export function ${nom}`), `${nom} a été renommée : le contrôle ne mesure plus le bon message`);
}
const planche = readFileSync("appli/mon-message-au-client.html", "utf8");
for (const phrase of [
  "Voici votre devis. Vous pouvez le consulter et choisir votre date ",
  "vous pouvez en proposer une autre. Tout se fait sur cette page :",
  "Vous pouvez la consulter et la télécharger ici :",
  "Voici le compte rendu de mon passage chez vous :",
]) {
  dire(source.includes(phrase), `le code n'envoie plus : « ${phrase} »`);
  dire(planche.includes(phrase), `la planche ne montre pas ce que le code envoie : « ${phrase} »`);
}
for (const jeton of ["[client]", "[document]", "[lien]", "[entreprise]"]) {
  dire(depart.includes(jeton), `le texte de départ ne porte pas ${jeton} : rien ne se remplace`);
}

// 2 — SIX bulles, et la façon 1 rend à chacune SA phrase
const bulles = () => page.evaluate(() => {
  const lire = (id) => [...document.querySelectorAll(`#${id} .bulle`)].map((b) => b.innerText);
  return { un: lire("facon1"), deux: lire("facon2") };
});
const vu = await bulles();
dire(vu.un.length === 3 && vu.deux.length === 3,
  `les six bulles ne sont pas là : ${vu.un.length} + ${vu.deux.length}`);
dire(vu.un.every((b) => b.length > 40), "une bulle est presque vide : mesure impossible, pas un succès");

dire(/votre devis/i.test(vu.un[0]), "le devis ne porte pas sa phrase");
dire(/votre facture/i.test(vu.un[1]), "la facture ne porte pas sa phrase");
dire(/à régler avant le/i.test(vu.un[1]),
  "l'échéance manque à la facture : c'est précisément ce que la façon 2 lui coûte, il faut le voir");
dire(/compte rendu/i.test(vu.un[2]), "le compte rendu ne porte pas sa phrase");
dire(!vu.un.join(" ").includes("["), `une pastille n'a pas été remplacée : ${vu.un.join(" | ").slice(0, 90)}`);

// 3 — LA DÉMONSTRATION : façon 2, les trois bulles disent la MÊME chose
//
// **Et c'est le cœur de la planche.** Elle affichait « [document] » en clair
// dans ces trois bulles-là : cela ne montrait rien qu'un écran cassé. Ce qu'il
// doit voir, c'est sa facture qui parle d'un devis.
dire(vu.deux[0] === vu.deux[1] && vu.deux[1] === vu.deux[2],
  "les trois bulles de la façon 2 diffèrent : elle ne démontre plus rien");
dire(/votre devis/i.test(vu.deux[1]),
  "la facture de la façon 2 ne parle pas d'un devis : la démonstration est perdue");
dire(!vu.deux.join(" ").includes("["), "la façon 2 laisse une pastille en clair dans la bulle");

// Et l'écran DIT lesquelles sont fausses — deux, jamais celle du devis.
dire(await page.locator(".faux:visible").count() === 2,
  "l'écran ne désigne pas les deux bulles fausses de la façon 2");

// 4 — LE LIEN EST OBLIGATOIRE, sa décision du 23 août
//
// **Atlas REFUSE, il ne se contente pas de prévenir.** Et le bouton s'éteint
// avec le message : un bouton qui reste allumé s'appuie, ne fait rien, et l'on
// croit l'écran cassé.
dire(await refus.isHidden(), "l'écran refuse alors que le lien est là");
dire(!(await enregistrer.isDisabled()), "« Enregistrer » est éteint alors que le message est complet");
await modele.fill("Bonjour [client], voici [document]. [entreprise]");
await page.waitForTimeout(120);
const dit = (await refus.innerText()).trim();
dire(dit.length > 0, "le lien effacé ne dit rien : son client ne pourrait rien ouvrir");
dire(/obligatoire/i.test(dit), `le refus ne dit pas que le lien est obligatoire : « ${dit} »`);
dire(await enregistrer.isDisabled(), "on peut encore enregistrer un message sans lien");
// **On DIT, on ne rattrape pas.** Un lien remis tout seul se verrait à l'envoi
// et pas à l'écriture : il croirait avoir écrit autre chose que ce qui part.
dire(!(await modele.inputValue()).includes("[lien]"),
  "la planche a remis le lien toute seule : il ne verrait pas ce qu'il envoie");

// 5 — la pastille pose le mot LÀ OÙ LE CURSEUR EST
await modele.fill("AVANT [lien] APRES");
await page.evaluate(() => {
  const z = document.getElementById("modele");
  z.focus();
  z.selectionStart = z.selectionEnd = "AVANT ".length;
});
await page.locator('[data-jeton="[document]"]').click();
const pose = await modele.inputValue();
dire(pose === "AVANT [document][lien] APRES",
  `le jeton n'atterrit pas sous le curseur : « ${pose} » — il faudrait le déplacer au doigt`);

await page.locator("#remettre").click();
dire(await modele.inputValue() === depart, "« Remettre le texte d'origine » ne rend pas le texte de départ");

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth
);
dire(deborde <= 0, `la planche du message déborde de ${deborde} px sur son téléphone`);

// ─── LA PLANCHE DE L'ALLURE ──────────────────────────────────────────────
//
// **Ses décisions du 23 août au soir :** *« Allure des devis B, juste pour
// devis facture. Fais-en une dizaine. Le fond teinté fais-le modifiable […] les
// réglages actuels doivent être par défaut. »*
await page.goto(ALLURE, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

/** Ce que la feuille montre à cet instant. */
const etatFeuille = () => page.evaluate(() => {
  const f = document.getElementById("feuille");
  const s = getComputedStyle(f);
  const rule = f.querySelector(".rule");
  return {
    fond: s.backgroundColor,
    police: s.fontFamily,
    accent: rule ? getComputedStyle(rule).backgroundColor : "",
    logo: Boolean(f.querySelector(".marque")),
    titre: f.querySelector("h1")?.textContent ?? "",
    hauteur: f.getBoundingClientRect().height,
  };
});

const depart2 = await etatFeuille();
// **Refuser de conclure sur une feuille de zéro pixel** : sans mise en page,
// deux états se ressembleraient et le contrôle rendrait un vert qui ne prouve
// rien (`CLAUDE.md` §5).
dire(depart2.hauteur > 200, `la feuille mesure ${Math.round(depart2.hauteur)} px : mesure impossible, pas un succès`);

// 1 — UNE DIZAINE, et chacune s'écrit DANS SA POLICE
//
// Une liste où les dix noms se lisent dans la même police ne se choisit pas :
// il faudrait toutes les essayer une par une pour voir laquelle est laquelle.
const polices = page.locator("#choix-police button");
dire(await polices.count() === 10, `${await polices.count()} typographies proposées au lieu de dix`);
const pilesDistinctes = await page.evaluate(() => {
  const vues = [...document.querySelectorAll("#choix-police button")]
    .map((b) => getComputedStyle(b).fontFamily);
  return { total: vues.length, distinctes: new Set(vues).size };
});
dire(pilesDistinctes.distinctes === 10,
  `les dix boutons n'affichent que ${pilesDistinctes.distinctes} polices différentes : on ne peut pas choisir à l'œil`);

// 2 — SES RÉGLAGES D'AUJOURD'HUI SONT CEUX PAR DÉFAUT — sa règle, mot pour mot
dire(await polices.first().getAttribute("aria-pressed") === "true",
  "la police par défaut n'est pas « celle d'aujourd'hui »");
dire(/par défaut/i.test(await polices.first().innerText()),
  "rien ne dit laquelle est celle d'aujourd'hui");
dire(depart2.fond === "rgb(236, 233, 225)", `le fond de départ est ${depart2.fond} au lieu du crème d'aujourd'hui`);
dire(depart2.accent === "rgb(185, 139, 71)", `l'accent de départ est ${depart2.accent} au lieu de l'or d'aujourd'hui`);
dire(depart2.logo === false, "un logo est posé au départ : ce n'est pas son réglage d'aujourd'hui");

// 3 — LE FOND EST MODIFIABLE, pas seulement choisi dans une liste
const fondLibre = page.locator("#fond-libre");
dire(await fondLibre.count() === 1, "aucune couleur libre pour le fond : il ne peut pas mettre la sienne");
dire(await fondLibre.getAttribute("type") === "color", "le fond ne se choisit pas au nuancier");
await fondLibre.evaluate((e) => { e.value = "#1d3b2a"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(150);
const sombre = await etatFeuille();
dire(sombre.fond === "rgb(29, 59, 42)", `une couleur libre ne prend pas : ${sombre.fond}`);
// **L'encre suit le fond.** Un fond sombre avec une encre noire donne un devis
// illisible, et il ne s'en apercevrait qu'à l'impression.
const encre = await page.evaluate(() => getComputedStyle(document.getElementById("feuille")).color);
dire(encre === "rgb(245, 243, 238)", `sur un fond sombre l'encre reste ${encre} : le devis serait illisible`);
dire(await page.locator("#fond-valeur").innerText() === "#1D3B2A",
  "la couleur choisie ne s'écrit nulle part : il ne peut pas la redonner à son imprimeur");

// 4 — DEVIS ET FACTURE, et rien d'autre : sa règle « juste pour devis facture »
dire(depart2.titre.trim() === "Devis", `l'aperçu s'ouvre sur « ${depart2.titre} »`);
await page.locator('#onglets button[data-doc="facture"]').click();
await page.waitForTimeout(150);
const surFacture = await etatFeuille();
dire(surFacture.titre.trim() === "Facture", `l'onglet facture montre « ${surFacture.titre} »`);
const texteAllure = await page.locator("body").innerText();
dire(/feuille de chantier/i.test(texteAllure) && /compte rendu/i.test(texteAllure),
  "la planche ne dit pas que la feuille de chantier et le compte rendu gardent leur allure");

// 5 — chaque réglage repeint la feuille
await polices.nth(9).click();
dire((await etatFeuille()).police !== depart2.police, "changer la typographie ne change rien à la feuille");
await page.locator('#accent-rapide button[data-valeur="#6e2433"]').click();
dire((await etatFeuille()).accent !== depart2.accent, "changer l'accent ne change rien à la feuille");
await page.locator("#basculer-logo").click();
dire((await etatFeuille()).logo === true, "poser un logo ne le fait pas apparaître sur le devis");

// 6 — ET L'ON REVIENT À AUJOURD'HUI
//
// **Un aller sans retour se craint, donc ne s'essaie pas.** Sans ce bouton, il
// touche deux réglages puis n'ose plus rien changer, faute de savoir comment
// retrouver ses documents d'avant.
await page.locator("#revenir").click();
await page.waitForTimeout(200);
const revenu = await etatFeuille();
dire(revenu.fond === "rgb(236, 233, 225)", `le retour ne rend pas le crème : ${revenu.fond}`);
dire(revenu.accent === "rgb(185, 139, 71)", `le retour ne rend pas l'or : ${revenu.accent}`);
dire(revenu.police === depart2.police, "le retour ne rend pas la police d'aujourd'hui");
dire(revenu.logo === false, "le retour laisse le logo posé");

// Ce qui reste scellé est ÉCRIT sur la planche.
dire(/mentions obligatoires/i.test(texteAllure), "la planche ne dit pas ce qui reste scellé");
// Et la limite du PDF est dite, plutôt que découverte au codage : il n'embarque
// aujourd'hui que les deux polices du format.
dire(/deux polices/i.test(texteAllure),
  "la planche ne dit pas que le PDF ne connaît aujourd'hui que deux polices");

const deborde2 = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth
);
dire(deborde2 <= 0, `la planche de l'allure déborde de ${deborde2} px sur son téléphone`);

// ─── LES DEUX SONT ATTEIGNABLES ──────────────────────────────────────────
//
// **Une planche qu'il ne peut pas ouvrir n'existe pas** (`CLAUDE.md` §3 bis) :
// `pages.yml` déduit d'`essais.html` la liste des pages publiées, et c'est cette
// page-là qu'on lui donne.
const essais = readFileSync("appli/essais.html", "utf8");
for (const fichier of ["mon-message-au-client.html", "allure-de-mes-devis.html"]) {
  dire(essais.includes(fichier), `${fichier} n'est pas liée depuis essais.html : elle n'aura pas d'adresse`);
}

dire(refusees.length === 0, `des ressources ne chargent pas : ${refusees.join(" | ")}`);

} catch (e) {
  soucis.push(`le contrôle s'est arrêté avant la fin : ${e instanceof Error ? e.message.split("\n")[0] : e}`);
}

await navigateur.close();

if (soucis.length) {
  console.error("❌ Les planches du 23 août ne tiennent pas :");
  for (const s of soucis) console.error(`   • ${s}`);
  process.exit(1);
}
console.log("✅ Le message se rédige, le devis s'habille — et le texte montré est celui qui part.");
