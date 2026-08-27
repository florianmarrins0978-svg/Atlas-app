// QUAND IL PARLE LE PREMIER — les trois places doivent VRAIMENT se montrer.
//
// Sa réponse du 27 août 2026 : « 2 et 3 déjà ». Le 2 était *qu'il ouvre la
// bouche le premier* ; cette planche lui demande OÙ.
//
// **Pourquoi ce contrôle vit dans un navigateur et pas dans une expression
// régulière.** La première version de la page portait
// `#p1:checked ~ .dedans-choix .v1` — or `.dedans-choix` n'est pas un FRÈRE des
// boutons, c'est le petit-fils de `.dedans`. Aucun onglet ne répondait, et le
// fichier avait pourtant exactement l'allure qu'il fallait : un contrôle qui lit
// le texte l'aurait déclarée bonne. Elle a été trouvée en REGARDANT la page.
//
//     node scripts/verifier-maquette-parle-le-premier.mjs
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const CHEMIN = "appli/quand-il-parle-le-premier.html";
const SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const page = readFileSync(CHEMIN, "utf8");
const echecs = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

console.log("=== Quand il parle le premier ===\n");

dire(!/<script/i.test(page), "aucun script : la page s'ouvre hors ligne");
// Les balises, pas les occurrences : la feuille de style nomme le même groupe.
dire(
  (page.match(/<input type="radio" name="place"/g) ?? []).length === 3,
  "trois places, en boutons radio"
);
dire(/Ce que ça risque/.test(page), "chaque place dit aussi ce qu'elle coûte");

// **L'accueil pose DÉJÀ les réponses des clients et les liens expirés.** Une
// planche qui ne le dirait pas ferait redire à l'assistant ce qui est là, et
// un rappel qui répète s'apprend à être ignoré.
dire(/accueil pose <b>déjà<\/b>/.test(page), "la planche dit ce que l'accueil pose déjà");

const navigateur = await chromium.launch(
  existsSync(SANDBOX) ? { executablePath: SANDBOX } : {}
);
const onglet = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
await onglet.goto(`file://${process.cwd()}/${CHEMIN}`, { waitUntil: "networkidle" });

for (const [id, volet] of [["p1", ".v1"], ["p2", ".v2"], ["p3", ".v3"]]) {
  await onglet.locator(`label[for="${id}"]`).click();
  await onglet.waitForTimeout(120);
  const montres = await onglet
    .locator(".volet")
    .evaluateAll((els) => els.filter((e) => e.offsetParent !== null).length);
  const leBon = await onglet.locator(volet).isVisible();
  dire(leBon && montres === 1, `${id} : le volet ${volet} se montre, et lui seul (${montres} visible(s))`);
}

// **Une boîte de zéro pixel ne prouve rien** (`CLAUDE.md` §5) : la pastille
// avait d'abord été posée DANS le rond, où la courbure la rognait.
await onglet.locator('label[for="p2"]').click();
await onglet.waitForTimeout(120);
const point = await onglet.locator(".pastille").first().boundingBox();
dire(
  point !== null && point.width >= 12 && point.height >= 12,
  `la pastille se voit : ${point ? `${Math.round(point.width)}×${Math.round(point.height)} px` : "introuvable"}`
);

await navigateur.close();

console.log(`\n${echecs.length === 0 ? "✅" : "❌"} ${CHEMIN} — ${echecs.length} défaut(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
