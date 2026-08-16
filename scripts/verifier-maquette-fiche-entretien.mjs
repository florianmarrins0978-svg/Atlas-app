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

await cas("aucun JavaScript dans les deux planches", async () => {
  for (const [nom, source] of [["62", sourceFiche], ["63", sourceRapport]]) {
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

await contexte.close();
await navigateur.close();

console.log(`\n${echecs === 0 ? "✅" : "❌"} Fiche d'entretien — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
