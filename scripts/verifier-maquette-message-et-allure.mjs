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
page.on("console", (m) => { if (m.type() === "error") soucis.push(`console : ${m.text()}`); });

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
await page.goto(ALLURE, { waitUntil: "networkidle" });
await page.waitForTimeout(200);

/** Ce que la feuille montre à cet instant — fond, police, accent, logo. */
const etatFeuille = () => page.evaluate(() => {
  const f = document.getElementById("feuille");
  const s = getComputedStyle(f);
  const rule = f.querySelector(".rule");
  return {
    fond: s.backgroundColor,
    police: s.fontFamily,
    accent: rule ? getComputedStyle(rule).backgroundColor : "",
    logo: Boolean(f.querySelector(".marque")),
    hauteur: f.getBoundingClientRect().height,
  };
});

const avant = await etatFeuille();
// **Refuser de conclure sur une feuille de zéro pixel** : sans mise en page,
// deux états se ressembleraient et le contrôle rendrait un vert qui ne prouve
// rien (`CLAUDE.md` §5).
dire(avant.hauteur > 200, `la feuille mesure ${Math.round(avant.hauteur)} px : mesure impossible, pas un succès`);
dire(avant.logo === false, "le logo est posé au départ : on ne verrait pas ce qu'il change");

// 5 — chaque réglage repeint la feuille
await page.locator('#choix-fond button[data-valeur="blanc"]').click();
dire((await etatFeuille()).fond !== avant.fond, "changer le fond de page ne change rien à la feuille");

await page.locator('#choix-police button[data-valeur="moderne"]').click();
dire((await etatFeuille()).police !== avant.police, "changer la typographie ne change rien à la feuille");

await page.locator('#choix-accent button[data-valeur="#6E2433"]').click();
dire((await etatFeuille()).accent !== avant.accent, "changer la couleur d'accent ne change rien à la feuille");

await page.locator("#basculer-logo").click();
dire((await etatFeuille()).logo === true, "poser un logo ne le fait pas apparaître sur le devis");
dire((await page.locator("#basculer-logo").innerText()).trim() === "Retirer le logo",
  "le bouton dit encore « Choisir une image » alors que le logo est posé");

// **Le choix touché se VOIT comme choisi.** Sans marque, il touche, la feuille
// change, et il ne sait plus lequel des trois est en cours.
const marques = await page.evaluate(() =>
  ["choix-fond", "choix-police", "choix-accent"].map((id) =>
    [...document.getElementById(id).querySelectorAll("button")]
      .filter((b) => b.getAttribute("aria-pressed") === "true").length
  )
);
dire(marques.every((n) => n === 1), `des rangées de choix marquent ${marques.join("/")} boutons au lieu d'un`);

// Ce qui reste scellé est ÉCRIT sur la planche : sans cette phrase, il croirait
// pouvoir déplacer les mentions obligatoires, et un devis mal posé se conteste.
const texte = await page.locator("body").innerText();
dire(/mentions obligatoires/i.test(texte), "la planche ne dit pas ce qui reste scellé");

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

await navigateur.close();

if (soucis.length) {
  console.error("❌ Les planches du 23 août ne tiennent pas :");
  for (const s of soucis) console.error(`   • ${s}`);
  process.exit(1);
}
console.log("✅ Le message se rédige, le devis s'habille — et le texte montré est celui qui part.");
