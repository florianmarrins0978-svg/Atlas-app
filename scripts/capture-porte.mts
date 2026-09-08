// REGARDER LA PORTE — les trois écrans d'avant le compte, à la largeur de son
// téléphone.
//
// **`CLAUDE.md` §5 : « et surtout, regarder l'écran ».** Quatre défauts réels de
// ce dépôt ont été trouvés sur une capture et par aucun test vert. Ces
// trois-là ne s'atteignent pas depuis les autres captures, qui commencent
// toutes par se connecter : ce sont précisément les écrans d'avant la session.
//
// **Il parcourt la création de compte en RÉPONDANT**, plutôt que de
// photographier la première question : les six formes d'écran (le groupe de
// cases, le déroulant déplié, la liste qui avance seule, le champ seul, le
// refus, la fin) ne se montrent pas autrement, et c'est là que se voient les
// débordements.
//
//   npx tsx scripts/capture-porte.mts <dossier>
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page n'arrive alors jamais hydratée.
import { mkdirSync } from "node:fs";
import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-porte.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext(ECRAN_DU_PATRON);
const page = await contexte.newPage();

let numero = 0;
async function prendre(nom: string) {
  numero += 1;
  const fichier = `${dossier}/${String(numero).padStart(2, "0")}-${nom}.png`;
  await page.screenshot({ path: fichier });
  console.log(`  → ${fichier}`);
}

await page.goto(`${ADRESSE}/bienvenue`, { waitUntil: "networkidle" });
await prendre("porte");

// Par le RÔLE, jamais par le texte : la phrase juridique au-dessus cite
// « Créer un compte » entre guillemets, et `text=` la choisissait — un clic
// sur un paragraphe, puis quarante-cinq secondes d'attente d'une navigation
// qui n'arrivait pas.
await page.getByRole("link", { name: "Créer un compte" }).click();
await page.waitForURL(/creer-un-compte/);
await prendre("identite");

// Un refus, pour voir la place qui lui est réservée sous le champ.
await page.click("text=Continuer");
await prendre("identite-refus");

await page.click("text=Madame");
await page.fill('input[name="prenom"]', "Anne");
await page.fill('input[name="nom"]', "Amiot");
await page.click("text=Continuer");
// **Une adresse neuve à chaque passage** : le compte est réellement créé, et
// la seconde exécution tomberait sinon sur « cette adresse a déjà un compte »
// — un refus juste, mais qui n'est pas ce qu'on veut photographier.
await page.fill('input[name="email"]', `anne-${Date.now()}@exemple.fr`);
await page.click("text=Continuer");
await prendre("mot-de-passe");

await page.fill('input[name="mdp"]', "un mot de passe long");
await page.fill('input[name="confirm"]', "un mot de passe long");
await page.click("text=Continuer");
await page.fill('input[name="entreprise"]', "Amiot Paysage");
await page.click("text=Continuer");
await prendre("forme-repliee");

await page.click("text=Choisissez");
await prendre("forme-depliee");

await page.click('[role="option"]:has-text("SASU")');
await page.click("text=Continuer");
await prendre("siret");

// Jusqu'à la TVA, la seule question qui avance d'elle-même.
for (const _ of ["siret", "adresse", "capital", "rcs", "tel", "emailPro"]) {
  await page.click("text=Passer");
}
await prendre("tva");

await page.click("text=je facture la TVA");
await prendre("numero-tva");

for (const _ of ["numTva", "iban", "titulaire"]) {
  await page.click("text=Passer");
}
await prendre("derniere-question");

await page.click("text=Créer mon compte");
await page.waitForSelector("text=Entrer dans Atlas", { timeout: 60_000 });
await prendre("fin");

await page.goto(`${ADRESSE}/login`, { waitUntil: "networkidle" });
await prendre("connexion");

await navigateur.close();
console.log(`\n${numero} captures dans ${dossier}`);
