// Fige, écran par écran, la VRAIE création d'un compte dans l'appli : la porte,
// chaque question, le code reçu par e-mail, les conditions, « C'est prêt », et
// l'accueil. Sa demande du 23 novembre 2026, devant la planche des formules :
// « j'ai envie de faire toute la marche jusqu'à rentrer dans l'appli pour voir
// comment ça marche ».
//
// Le compte se crée pour de bon, sur la base de démonstration de ce poste, avec
// des réponses inventées (aucune vraie personne, aucun vrai SIRET). Le code de
// l'e-mail se lit dans le journal du serveur, puisqu'en développement aucun
// e-mail ne part (`src/server/courriel/dev.ts`). Usage, serveur lancé :
//   ATLAS_ADRESSE=http://localhost:3000 node appli/scripts/parcours-inscription/figer.mjs <dossier> <journal du serveur>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { lancer, feuilles, corps, BASE } from "../../../scripts/planche-figee/figer.mjs";

const [SORTIE, JOURNAL] = process.argv.slice(2);
mkdirSync(SORTIE, { recursive: true });

// Les réponses, inventées. Le téléphone est dans la tranche que l'Arcep réserve
// à la fiction : il n'appartient à personne.
const EMAIL = `jean.moreau.${Date.now().toString(36)}@exemple.fr`;
const CHAMPS = {
  prenom: "Jean",
  nom: "Moreau",
  email: EMAIL,
  mdp: "Essai-Cause-2026",
  confirm: "Essai-Cause-2026",
  tel: "06 39 98 00 00",
  emailPro: "contact@moreau-paysage.fr",
  entreprise: "Moreau Paysage",
  adresse: "12 rue des Lilas, 78000 Versailles",
};
// Pour une question à choix, le début du mot du choix.
const CHOIX = [
  [/identité/, "Monsieur"],
  [/forme juridique/, "EI"],
  [/Facturez/, "Non"],
  [/moyens de paiement/, "Virement"],
  [/assurance décennale/, "Non"],
];

const nav = await lancer();
const contexte = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await contexte.newPage();
const etats = [];
const figer = async (nom, legende) => {
  await page.waitForTimeout(500);
  const c = await corps(page, contexte);
  writeFileSync(`${SORTIE}/${String(etats.length).padStart(2, "0")}-${nom}.json`, JSON.stringify(c));
  etats.push({ nom, legende, url: new URL(page.url()).pathname });
  console.log("figé", nom, "|", legende);
};
// La question de l'écran : le plus grand titre visible.
const question = () => page.evaluate(() => {
  const t = [...document.querySelectorAll("h1, h2, legend, label, p")].filter((e) => e.offsetParent && /\?$/.test(e.innerText.trim()) || /photo|mot de passe/i.test(e.innerText));
  return (t[0]?.innerText || "").trim();
});
const visibles = () => page.evaluate(() => [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent).map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()));
const bouton = (debutMot) => page.locator("button:visible").filter({ hasText: new RegExp(`^\\s*${debutMot}`) }).first();

await page.goto(`${BASE}/bienvenue`, { waitUntil: "networkidle" });
writeFileSync(`${SORTIE}/css.txt`, await feuilles(page, contexte));
await figer("porte", "La porte de l'appli");
await page.click('a[href="/creer-un-compte"]');
await page.waitForURL(/creer-un-compte/);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);

for (let n = 0; n < 40; n++) {
  if (!/creer-un-compte/.test(page.url())) break;
  const avant = await page.evaluate(() => document.body.innerText);
  const q = await question();
  const mots = await visibles();
  const noms = await page.evaluate(() => [...document.querySelectorAll("input")].filter((e) => e.offsetParent && e.type !== "file").map((e) => e.name));
  let connus = 0;
  for (const nomChamp of noms) {
    if (CHAMPS[nomChamp] !== undefined) { await page.fill(`input[name="${nomChamp}"]`, CHAMPS[nomChamp]); connus++; }
  }
  const choix = CHOIX.find(([motif]) => motif.test(q));
  const aContinuer = mots.some((m) => /^(Continuer|Créer mon compte)$/.test(m));
  console.log(`écran ${n} « ${q} » champs=${noms.join(",")} boutons=${mots.filter((m) => m.length < 40).join(" / ")}`);
  if (choix && !aContinuer) {
    await figer(`q${n}`, q);
    await bouton(choix[1]).click();
  } else {
    if (choix) { await bouton(choix[1]).click(); await page.waitForTimeout(200); }
    const inconnu = noms.length > 0 && connus === 0;
    const passer = mots.includes("Passer");
    if ((inconnu || (!aContinuer && !choix)) && passer) {
      await figer(`q${n}`, q);
      await bouton("Passer").click();
    } else if (mots.includes("Créer mon compte")) {
      await figer(`q${n}`, q);
      await bouton("Créer mon compte").click();
      await page.waitForTimeout(3000);
      break;
    } else if (aContinuer) {
      await figer(`q${n}`, q);
      await bouton("Continuer").click();
    } else {
      console.log("écran sans issue connue, arrêt");
      break;
    }
  }
  await page.waitForTimeout(600);
  if ((await page.evaluate(() => document.body.innerText)) === avant) {
    const refus = await page.evaluate(() => document.body.innerText.slice(0, 400));
    console.log("rien n'a bougé :", refus.replace(/\s+/g, " "));
    break;
  }
}

// Le code reçu par e-mail : en développement, il est écrit dans le journal.
await page.waitForTimeout(2500);
await figer("code", "Le code reçu par e-mail");
const journal = readFileSync(JOURNAL, "utf8");
const code = [...journal.matchAll(/\b(\d{6})\b/g)].map((m) => m[1]).pop();
console.log("code lu dans le journal :", code);
const champsCode = page.locator("input:visible");
if ((await champsCode.count()) === 1) await champsCode.first().fill(code);
else for (let i = 0; i < 6; i++) await champsCode.nth(i).fill(code[i]);
await page.waitForTimeout(400);
await figer("code-tape", "Le code tapé");
const valider = page.locator("button:visible").filter({ hasText: /Valider|Continuer|Vérifier/ }).first();
if (await valider.count()) await valider.click();
await page.waitForURL(/documents-legaux|pret|\/$/, { timeout: 60000 });
await page.waitForLoadState("networkidle");
await figer("conditions", "Les conditions à accepter");
await page.locator("button:visible").filter({ hasText: /^\s*Accepter\s*$/ }).first().click();
await page.waitForURL(/creer-un-compte\/pret/, { timeout: 60000 });
await page.waitForLoadState("networkidle");
// Face ID ne se propose que sur un appareil qui sait le faire : pas dans ce
// navigateur sans écran, où « C'est fait » vient tout de suite.
const plusTard = page.locator("button:visible").filter({ hasText: /^\s*Plus tard\s*$/ }).first();
if (await plusTard.count()) {
  await figer("face-id", "Face ID, proposé");
  await plusTard.click();
  await page.waitForTimeout(800);
}
await figer("pret", "C'est fait");
await page.locator("a:visible").filter({ hasText: /Entrer dans Cause/ }).first().click();
await page.waitForURL(`${BASE}/`, { timeout: 90000 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1500);
await figer("accueil", "L'accueil, compte neuf");
writeFileSync(`${SORTIE}/etats.json`, JSON.stringify({ email: EMAIL, etats }, null, 1));
await nav.close();
