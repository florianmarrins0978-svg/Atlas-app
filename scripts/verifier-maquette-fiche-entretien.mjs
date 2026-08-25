#!/usr/bin/env node
/*
  Garde les deux planches de la fiche d'entretien.

  **Ce qu'un contrôle de maquette doit attraper ici, et qui n'a rien de
  cosmétique :**

  1. **Aucun JavaScript.** Le lecteur du patron n'en exécute pas : une planche
     bâtie en JS lui arrive VIDE, et elle passe pourtant tous les contrôles
     ordinaires (`PROJECT_STATE.md`). On l'ouvre donc `javaScriptEnabled: false`
     et on compte ce qui s'affiche vraiment.
  2. **Les deux planches parlent de la même fiche.** Elles sont engendrées d'une
     seule liste ; si un jour l'une était retouchée à la main, les prestations
     divergeraient — et l'écart se verrait à l'endroit exact où le patron
     compare les deux.
  3. **« Vrai » et « Faux » ne sortent pas vers le client.** C'est le défaut de
     l'autre application, et c'est ce que ces planches proposent de ne PAS
     recopier. Le jour où ces mots reviennent dans la planche du client, ce
     contrôle le dit.
  4. **La version B ne montre QUE ce qui a été fait.** C'est tout son propos ;
     sans ce cas, elle pourrait redevenir la version A sans que rien n'alerte.

  Éprouvé à l'envers avant d'être gardé : chaque cas a été vu rouge sur la
  planche dégradée qu'il prétend détecter.
*/

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAQUETTES = join(RACINE, "docs", "maquettes");
const FICHE = join(MAQUETTES, "62-la-fiche-dentretien.html");
const RAPPORT = join(MAQUETTES, "63-le-rapport-au-client.html");
const MODELE = join(RACINE, "appli", "composer-sa-fiche.html");

const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
async function cas(nom, verifier) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("=== La fiche d'entretien et son rapport ===");

const sourceFiche = readFileSync(FICHE, "utf8");
const sourceRapport = readFileSync(RAPPORT, "utf8");
const sourceModele = readFileSync(MODELE, "utf8");

await cas("aucun JavaScript dans les deux planches", async () => {
  for (const [nom, source] of [["62", sourceFiche], ["63", sourceRapport], ["64", sourceModele]]) {
    assert(!/<script/i.test(source), `la planche ${nom} porte une balise <script>`);
    assert(!/javascript:/i.test(source), `la planche ${nom} porte un lien javascript:`);
    assert(
      !/\son[a-z]+\s*=\s*["']/i.test(source),
      `la planche ${nom} porte un gestionnaire en ligne (onclick, onchange…)`
    );
  }
});

await cas("« Vrai » et « Faux » ne sortent pas vers le client", async () => {
  // Le mot peut apparaître dans le COMMENTAIRE qui explique le défaut de
  // l'autre application — c'est même l'intérêt. Ce qui est interdit, c'est
  // qu'il apparaisse dans ce que le client lit.
  const corps = sourceRapport.slice(sourceRapport.indexOf("</style>"));
  assert(!/>\s*Vrai\s*</.test(corps), "« Vrai » s'affiche dans le rapport du client");
  assert(!/>\s*Faux\s*</.test(corps), "« Faux » s'affiche dans le rapport du client");
});

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
// **Sans JavaScript, comme chez lui.** C'est la seule façon de voir ce qu'il
// verra : une planche bâtie en JS s'affiche parfaitement ici, et vide chez lui.
const contexte = await navigateur.newContext({ javaScriptEnabled: false });
const page = await contexte.newPage();

const prestationsVisibles = async (fichier, variante, selecteur) => {
  await page.goto(`file://${fichier}`, { waitUntil: "networkidle" });
  await page.locator(`label[for="${variante}"]`).click();
  return page.locator(selecteur).allInnerTexts();
};

await cas("sans JavaScript, la fiche affiche bien ses prestations", async () => {
  const lignes = await prestationsVisibles(FICHE, "g-a", ".fa .pres .mot");
  assert(lignes.length >= 15, `seulement ${lignes.length} prestations affichées — la page arrive vide ?`);
});

await cas("les deux planches portent la MÊME liste de prestations", async () => {
  const surLaFiche = new Set(await prestationsVisibles(FICHE, "g-a", ".fa .pres .mot"));
  const surLeRapport = new Set(
    (await prestationsVisibles(RAPPORT, "r-a", ".ra .rl")).map((t) => t.replace(/^[✓·]\s*/, ""))
  );
  const manquantes = [...surLaFiche].filter((p) => !surLeRapport.has(p));
  const en_trop = [...surLeRapport].filter((p) => !surLaFiche.has(p));
  assert(
    manquantes.length === 0 && en_trop.length === 0,
    `les listes ont divergé — absentes du rapport : ${manquantes.join(", ") || "aucune"} ; ` +
      `absentes de la fiche : ${en_trop.join(", ") || "aucune"}`
  );
});

await cas("la version B du rapport ne montre QUE ce qui a été fait", async () => {
  const toutes = await prestationsVisibles(RAPPORT, "r-a", ".ra .rl");
  const faites = await prestationsVisibles(RAPPORT, "r-b", ".rb .rl");
  assert(faites.length > 0, "la version B ne montre rien du tout");
  assert(
    faites.length < toutes.length,
    `la version B montre ${faites.length} lignes sur ${toutes.length} : elle ne filtre plus rien`
  );
  const eteintes = await page.locator(".rb .rl.non").count();
  assert(eteintes === 0, `${eteintes} ligne(s) non faites subsistent dans la version B`);
});

await cas("la version C nomme le reste sans le lister comme des refus", async () => {
  await page.goto(`file://${RAPPORT}`, { waitUntil: "networkidle" });
  await page.locator('label[for="r-c"]').click();
  const repli = await page.locator(".rc .replie").innerText();
  assert(/non prévu/i.test(repli), `le repli ne dit pas « non prévu » : « ${repli.slice(0, 60)}… »`);
  assert(!/faux/i.test(repli), "le repli parle encore de « Faux »");
});

await cas("les versions RETENUES le 16 août s'ouvrent les premières", () => {
  // **Sa décision, tenue par un contrôle.** « B et B », le 16 août. Une planche
  // qui s'ouvrirait sur A lui montrerait, dans six mois, autre chose que ce
  // qu'il a choisi — et personne ne s'en apercevrait.
  assert(
    /id="g-b" class="etat" checked/.test(sourceFiche),
    "la planche 62 ne s'ouvre plus sur B (rangée par familles)"
  );
  assert(
    /id="r-b" class="etat" checked/.test(sourceRapport),
    "la planche 63 ne s'ouvre plus sur B (seulement ce qui a été fait)"
  );
});

await cas("la fiche porte la saisie du temps passé, avec le planifié à côté", () => {
  // Sa demande du 16 août : « une case pour pouvoir rentrer le temps passé ».
  const corps = sourceFiche.slice(sourceFiche.indexOf("</style>"));
  assert(/Temps passé/.test(corps), "la fiche ne demande plus le temps passé");
  assert(
    /<input[^>]*aria-label="Temps passé/.test(corps),
    "le temps passé ne se SAISIT pas : ce n'est qu'un texte affiché"
  );
  assert(/planifié/.test(corps), "le temps planifié n'est plus rappelé à côté du temps saisi");
});

await cas("le modèle se compose : ajouter, retirer, et se dédire", async () => {
  await page.goto(`file://${MODELE}`, { waitUntil: "networkidle" });
  const noms = await page.locator(".mod .nom").allInnerTexts();
  assert(noms.length >= 15, `seulement ${noms.length} prestations — la page arrive vide ?`);
  assert(
    (await page.locator(".ajouter").count()) > 0,
    "rien ne permet d'AJOUTER une prestation : la fiche ne se compose pas"
  );
  // **Le retrait réversible, règle du 10 août.** Une ligne barrée doit offrir
  // de se rétablir : une croix sans retour est le geste le plus coûteux.
  const retiree = page.locator(".mod.retiree");
  assert((await retiree.count()) > 0, "aucune ligne retirée n'est montrée : le geste ne se voit pas");
  assert(
    /Rétablir/.test(await retiree.first().innerText()),
    "la ligne retirée n'offre pas de se rétablir"
  );
});

await cas("le modèle porte la même liste que la fiche", async () => {
  const surLaFiche = new Set(await prestationsVisibles(FICHE, "g-b", ".fb .pres .mot"));
  await page.goto(`file://${MODELE}`, { waitUntil: "networkidle" });
  const surLeModele = new Set(await page.locator(".mod .nom").allInnerTexts());
  const ecart = [...surLaFiche].filter((p) => !surLeModele.has(p));
  assert(ecart.length === 0, `le modèle a divergé de la fiche : ${ecart.join(", ")}`);
});

await cas("aucune signature, et surtout aucun « Non signé » SUR LE DOCUMENT", async () => {
  // **Décidé le 16 août 2026.** Sur sa propre capture de l'autre application,
  // les deux signatures étaient « Non signé » — la sienne et celle du client,
  // absent onze fois sur douze. Un champ qui reste vide fait passer chaque
  // rapport pour un document inachevé.
  //
  // **Le contrôle vise le TÉLÉPHONE, pas la page.** Sa première version
  // interdisait la phrase partout après la feuille de style — y compris dans
  // l'explication de la planche, qui a le droit de citer le défaut qu'elle
  // corrige. Un contrôle qui accuse le commentaire au lieu du document apprend
  // à être ignoré.
  await page.goto(`file://${RAPPORT}`, { waitUntil: "networkidle" });
  const document = await page.locator(".tel").innerText();
  assert(!/Non signé/i.test(document), "« Non signé » est revenu sur le rapport du client");
  assert(!/Signature/i.test(document), "un cadre de signature est revenu sur le rapport");
  assert(
    /horodaté|empreinte/i.test(document),
    "le rapport ne dit plus ce qui le prouve à la place d'une signature"
  );
});


await contexte.close();
await navigateur.close();

console.log(`\n${echecs === 0 ? "✅" : "❌"} Fiche d'entretien — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
