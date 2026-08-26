// VOS SALARIÉS, ET CE QUI REMPLIT LE PLANNING — la planche des trois façons.
//
// Sa demande du 25 août 2026 : « un curseur + ou − qui définit le nombre de
// salariés, et pouvoir affilier des noms ; ceux-là permettront d'ajouter ces
// noms au chantier, et plus les équipes A ou B. Néanmoins les équipes doivent
// toujours servir à définir le remplissage du planning. »
//
// **Ce que ce contrôle défend, et pourquoi il ouvre un navigateur.** La planche
// n'affirme pas que le curseur des salariés crée deux vérités : elle le rend
// TOUCHABLE — on monte le curseur sans taper de nom, et le planning ne connaît
// que les noms. Un contrôle qui ne ferait que chercher la phrase dans le HTML
// resterait vert le jour où le geste cesserait de marcher, et la planche
// mentirait sans que personne le sache.
//
// Il défend aussi ce qu'il a explicitement voulu garder : le curseur des
// ÉQUIPES pilote le remplissage du planning — 2 équipes = 2 chantiers — dans
// les trois propositions, celle qui supprime l'autre curseur comprise.
//
//     node scripts/verifier-maquette-salaries-et-equipes.mjs
//
// Confronté à l'état dégradé le 26 août 2026 (CLAUDE.md §5, « un contrôle doit
// savoir échouer ») : planche amputée de son alerte de doublon, planche dont le
// curseur des équipes ne pilote plus le planning, planche dont la C garde le
// curseur des salariés — chaque fois rouge, sur la bonne ligne.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const CHEMIN = process.argv[2] ?? "appli/salaries-et-equipes.html";
const PLANCHE = resolve(CHEMIN);
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const echecs = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

console.log(`=== Vos salariés, et ce qui remplit le planning — ${CHEMIN} ===\n`);

const source = readFileSync(PLANCHE, "utf8");

// Sa consigne, répétée à chaque planche : « pas de photo, je veux pouvoir
// essayer ». Une image à la place d'un geste, et il ne peut rien essayer.
dire(!/<img\b/i.test(source), "aucune image : tout se touche");

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
const page = await navigateur.newPage({ viewport: { width: 1000, height: 1400 } });
const plaintes = [];
page.on("pageerror", (e) => plaintes.push(String(e.message)));
page.on("console", (m) => { if (m.type() === "error") plaintes.push(m.text()); });
await page.goto(`file://${PLANCHE}`, { waitUntil: "networkidle" });

const proposition = (lettre) => page.getByRole("button", { name: new RegExp(`^${lettre} ·`) }).click();
const nomsDesChantiers = () => page.locator(".chantier .nom").allTextContents();
const alertes = () => page.locator(".alerte").allTextContents();

// ── Ce qu'il a demandé de NE PAS bouger ────────────────────────────────────
// « 2 équipes = 2 chantiers par jour, comme avant, ça ne bouge pas. »
for (const lettre of ["A", "B", "C"]) {
  await proposition(lettre);
  const avant = (await nomsDesChantiers()).length;
  await page.locator("#eqPlus").click();
  const apres = (await nomsDesChantiers()).length;
  await page.locator("#eqMoins").click();
  dire(
    avant === 2 && apres === 3,
    `${lettre} — le curseur des équipes remplit le planning (${avant} chantiers, puis ${apres})`
  );
}

// ── Le défaut que la planche doit rendre touchable ─────────────────────────
await proposition("A");
dire(await page.locator("#compteurGens").isVisible(), "A — le curseur des salariés qu'il demande est bien là");
await page.locator("#saPlus").click();
await page.locator("#saPlus").click();
const pastillesA = await page.locator(".chantier").first().locator(".cocher button").count();
const ecrit = await page.locator("#saDit").textContent();
dire(
  pastillesA === 3 && /n'ont pas encore de nom/.test(ecrit),
  `A — le curseur annonce 5 salariés quand le chantier n'en connaît que ${pastillesA} : les deux vérités se voient`
);

// Le même homme sur deux chantiers le même jour doit être signalé SUR LES DEUX :
// n'avertir que sur le second laisserait croire que le premier va bien.
await page.locator(".chantier").nth(0).getByRole("button", { name: "Marc" }).click();
await page.locator(".chantier").nth(1).getByRole("button", { name: "Marc" }).click();
const doublons = await alertes();
dire(
  doublons.length === 2 && doublons.every((t) => /déjà sur un autre chantier/.test(t)),
  `A — la même personne sur deux chantiers est signalée sur les deux (${doublons.length} avertissement(s))`
);

// ── B : le planning écrit les gens, plus la lettre ─────────────────────────
await proposition("B");
dire(!(await page.locator("#compteurGens").isVisible()), "B — pas de curseur de salariés : les gens vivent dans les équipes");
const quiB = await page.locator(".chantier").first().locator(".qui").nth(1).textContent();
dire(/Marc/.test(quiB) && !/Équipe A/.test(quiB), `B — le planning écrit les prénoms, pas la lettre (« ${quiB.trim()} »)`);

// Baisser le compteur d'équipes ne doit PERDRE personne : quelqu'un qu'on n'a
// jamais retiré ne disparaît pas parce qu'un chiffre a bougé.
await page.locator("#eqMoins").click();
const perdus = await page.locator("#listeGens .oter").count();
const avertissement = (await alertes()).join(" ");
dire(
  perdus === 3 && /Remontez-le/.test(avertissement),
  `B — personne n'est perdu quand une équipe disparaît (${perdus} noms encore à l'écran, et l'écran le dit)`
);
await page.locator("#eqPlus").click();

// ── C : une seule vérité, la liste ─────────────────────────────────────────
await proposition("C");
dire(!(await page.locator("#compteurGens").isVisible()), "C — le curseur des salariés a disparu");
const cleAvant = await page.locator("#clefGens").textContent();
await page.locator("#ajouterGens").click();
await page.locator("#listeGens input").last().fill("Nadia");
const cleApres = await page.locator("#clefGens").textContent();
const pastillesC = await page.locator(".chantier").first().locator(".cocher button").allTextContents();
dire(
  /3 personnes/.test(cleAvant) && /4 personnes/.test(cleApres) && pastillesC.includes("Nadia"),
  `C — le nombre se compte à partir des noms (« ${cleAvant.trim()} » → « ${cleApres.trim()} »)`
);

// Un écran vide doit dire quoi faire, pas rester muet.
for (let i = 0; i < 6; i += 1) {
  const restants = await page.locator("#listeGens .oter").count();
  if (restants) await page.locator("#listeGens .oter").first().click();
}
const vide = await page.locator(".chantier").first().locator(".cocher").textContent();
dire(/Ajoutez d'abord/.test(vide), "C — sans personne, l'écran dit où aller plutôt que de rester vide");

// ── Ce qui doit être ÉCRIT, parce qu'il tranche dessus ─────────────────────
dire(/C'est votre appel/.test(source), "la remarque sur le curseur lui est posée, pas imposée");
dire(/RIEN N'EST CODÉ/.test(source), "la planche dit qu'elle ne touche pas à l'application");

// Son téléphone d'abord.
const tel = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
await tel.goto(`file://${PLANCHE}`, { waitUntil: "networkidle" });
const deborde = await tel.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
dire(!deborde, "sur son téléphone, la page ne déborde pas sur le côté");
const petites = await tel.evaluate(() =>
  [...document.querySelectorAll("button")]
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 40); })
    .map((b) => (b.textContent || "").trim().slice(0, 20))
);
dire(petites.length === 0, petites.length === 0 ? "chaque bouton fait au moins 40 px pour le pouce" : `trop petits : ${petites.join(", ")}`);

dire(plaintes.length === 0, plaintes.length === 0 ? "aucune erreur JavaScript" : `erreurs : ${plaintes.join(" | ")}`);

await navigateur.close();
console.log(`\n${echecs.length === 0 ? "✅" : "❌"} ${CHEMIN} — ${echecs.length} défaut(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
