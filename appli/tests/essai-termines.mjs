/**
 * « Terminés », simplifié — la maquette se parcourt en entier, comme lui.
 *
 * **Pourquoi cette suite existe.** Trois fois, une adresse lui a été
 * transmise sans que personne ne l'ait ouverte, et c'est LUI qui a trouvé le
 * défaut (`AGENTS.md`). Une maquette qu'on lui demande d'essayer se parcourt
 * donc d'abord ici : les quatre onglets, les boutons appuyés pour de bon, sur
 * un téléphone de 390 px.
 *
 * **Elle sait échouer, et sur autre chose que le vide.** Chaque affirmation
 * est MESURÉE dans le navigateur — hauteurs, débordement, totaux relus à
 * l'écran — et l'écran doit d'abord avoir de la matière : un écran de zéro
 * pixel passerait tout le reste au vert sans rien prouver (`CLAUDE.md` §5).
 *
 * **Elle a déjà servi.** Elle fixe l'ordre des cinq factures de sa capture :
 * un comparateur qui répondait « plus petit » à deux dates égales sortait ses
 * deux factures du 19 août à l'envers, sur les trois écrans à la fois.
 *
 * Ce qu'elle ne voit pas, et qu'aucun contrôle ne verra : « Facture n° -5 »,
 * un tiret entré dans un numéro. Celui-là s'est trouvé en REGARDANT la
 * capture.
 *
 *   BASE_URL=http://127.0.0.1:8080 node tests/essai-termines.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";
let rouges = 0;
const dire = (ok, quoi) => {
  if (!ok) rouges++;
  console.log((ok ? "  ok    " : "  ROUGE ") + quoi);
};

/** « 5 868 € › » → 5868. Tout ce qui n'est ni chiffre ni virgule s'en va — le
    chevron et l'espace fine des milliers y entraient sinon, et `Number` rendait
    `NaN`, c'est-à-dire un rouge qui accusait la page au lieu du contrôle. */
const nombre = (t) => Number(String(t).replace(/[^0-9,]/g, "").replace(",", "."));

const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("requestfailed", (r) => erreurs.push("requête perdue : " + r.url()));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) erreurs.push(r.status() + " sur " + r.url());
});

await page.goto(`${BASE}/termines-simple.html`, { waitUntil: "networkidle" });

// 1. Les quatre écrans s'affichent, et aucun ne déborde d'un téléphone.
for (const [cle, nom] of [["aujourdhui", "Aujourd’hui"], ["a", "A"], ["b", "B"], ["c", "C"]]) {
  await page.click(`[data-vue="${cle}"]`);
  await page.waitForTimeout(200);

  const hauteur = await page.locator("#ecran").evaluate((e) => e.getBoundingClientRect().height);
  dire(hauteur > 300, `${nom} — l'écran mesure ${Math.round(hauteur)} px de haut`);

  const debord = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  dire(debord <= 0, `${nom} — aucun débordement horizontal (${debord} px)`);
}

// 2. L'écran d'aujourd'hui est celui de SA capture — sinon il ne prouve rien.
await page.click('[data-vue="aujourdhui"]');
await page.waitForTimeout(150);
dire(
  (await page.locator(".encart .caps").innerText()).toLowerCase() === "quatre à facturer",
  "Aujourd’hui — l'encart annonce « Quatre à facturer »"
);
// Les quatre lignes du volet portent une date, pas un numéro : on ne garde
// que les factures, sans quoi le contrôle mesure autre chose que ce qu'il dit.
const refs = (await page.$$eval(".ancienne .ref", (n) => n.map((x) => x.textContent.trim())))
  .filter((t) => t.startsWith("F2026-"));
dire(
  refs.join(" ") === "F2026-0005 · le 20 F2026-0004 · le 19 F2026-0002 · le 19 F2026-0001 · le 18 F2026-0003 · le 14",
  `Aujourd’hui — les cinq factures dans l'ordre de sa capture (${refs.join(", ")})`
);
const totalBas = nombre(await page.locator(".pied-ancien .tous b").innerText());
const totalMois = nombre(await page.locator(".mois .total-mois").first().innerText());
dire(totalBas === 3828 && totalMois === 3828,
  `Aujourd’hui — 3 828,00 € écrit deux fois (mois ${totalMois}, pied ${totalBas})`);
dire(nombre(await page.locator(".encart .prevu").innerText()) === 2040,
  "Aujourd’hui — 2 040,00 € à facturer, comme sa capture");

// 3. L'encart replié s'ouvre pour de bon : c'est LE geste que la planche
//    reproche à l'écran actuel, et il doit se voir avant d'être jugé.
const avant = await page.locator(".volet").evaluate((e) => e.getBoundingClientRect().height);
await page.click(".encart");
await page.waitForTimeout(600);
const apres = await page.locator(".volet").evaluate((e) => e.getBoundingClientRect().height);
dire(avant < 5 && apres > 150, `Aujourd’hui — le volet passe de ${Math.round(avant)} à ${Math.round(apres)} px`);

// 4. « Facturer » facture VRAIMENT : les deux totaux se refont d'eux-mêmes.
await page.click('[data-vue="a"]');
await page.waitForTimeout(200);
const totalAttente = async () => nombre(await page.locator(".section h2 .somme").first().innerText());
const totalFait = async () => nombre(await page.locator(".nav-mois .somme").first().innerText());
const attenteAvant = await totalAttente();
const faitAvant = await totalFait();
const montant = nombre((await page.locator(".section .ligne .quand").first().innerText()).split("·")[1]);
await page.locator("[data-facturer]").first().click();
await page.waitForTimeout(200);
const attenteApres = await totalAttente();
const faitApres = await totalFait();
dire(Math.abs(attenteAvant - montant - attenteApres) < 0.005,
  `A — « à facturer » tombe de ${attenteAvant} à ${attenteApres} (la ligne valait ${montant})`);
dire(Math.abs(faitApres - faitAvant - montant) < 0.005,
  `A — « facturé » monte de ${faitAvant} à ${faitApres}`);
dire((await page.locator("[data-facturer]").count()) === 4, "A — il reste quatre boutons sur cinq");

// 4 bis. Revenir dans le passé — sa demande du 22 août.
//
// Trois choses à prouver ensemble, et la troisième est le cœur de sa demande :
// le mois recule VRAIMENT, un mois sans facture le DIT au lieu d'être sauté,
// et ce qui reste à facturer NE SUIT PAS le mois.
await page.click("#remettre");
await page.click('[data-vue="a"]');
await page.waitForTimeout(200);
dire((await page.locator(".nav-mois .nom-mois-nav").first().innerText()).trim() === "Août 2026",
  "A — le feuilletage part du mois le plus récent");
dire(await page.locator('.nav-mois [data-recul="-1"]').first().isDisabled(),
  "A — la flèche du futur est fermée sur le mois le plus récent");
const attenteAout = await totalAttente();
await page.locator('.nav-mois [data-recul="1"]').first().click();
await page.waitForTimeout(200);
const nomRecule = (await page.locator(".nav-mois .nom-mois-nav").first().innerText()).trim();
const texteA = await page.locator("#ecran").innerText();
dire(nomRecule === "Juillet 2026", `A — un appui sur ‹ ramène à ${nomRecule}`);
dire(texteA.includes("Aucune facture en juillet 2026"),
  "A — un mois sans facture le dit, il n'est pas sauté");
dire(Math.abs((await totalAttente()) - attenteAout) < 0.005 && texteA.includes("Ferreira"),
  "A — le retard de juillet reste visible quel que soit le mois feuilleté");
dire(!(await page.locator('.nav-mois [data-recul="-1"]').first().isDisabled()),
  "A — et la flèche du futur se rouvre dès qu'on a reculé");

// 4 ter. Le compte des factures est en NOIR GRAS — sa demande du 22 août.
// Mesuré dans le navigateur : une classe posée ne prouve pas une graisse.
await page.locator('.nav-mois [data-recul="-1"]').first().click();
await page.waitForTimeout(200);
const compte = page.locator(".section .compte").first();
const style = await compte.evaluate((e) => {
  const s = getComputedStyle(e);
  return { poids: Number(s.fontWeight), couleur: s.color };
});
dire((await compte.innerText()).startsWith("5 factures envoyées"),
  "A — le compte annonce « 5 factures envoyées »");
dire(style.poids >= 700 && style.couleur === "rgb(28, 28, 26)",
  `A — et il est en noir gras (graisse ${style.poids}, ${style.couleur})`);

// 5. Tout facturer : l'écran C doit le DIRE, jamais rester vide.
await page.click('[data-vue="c"]');
await page.waitForTimeout(150);
for (let i = 0; i < 8; i++) {
  const b = page.locator("[data-facturer]").first();
  if (!(await b.count())) break;
  await b.click();
  await page.waitForTimeout(120);
}
dire((await page.locator("#ecran").innerText()).includes("Tout est facturé"),
  "C — quand tout est facturé, l'écran le dit");
// 3 828 (sa capture) + 2 040 (les quatre en attente) + 890 (le retard de
// juillet) = 6 758, sur dix factures.
const porte = (await page.locator(".rangee").first().innerText()).replace(/\n/g, " ");
dire(/\b10\b/.test(porte) && nombre(porte.split("·")[1]) === 6758,
  `C — la porte « Mes factures » porte le nouveau total : ${porte}`);

// 6. « Tout remettre » rejoue la scène — sans quoi on ne peut essayer qu'une fois.
await page.click("#remettre");
await page.click('[data-vue="aujourdhui"]');
await page.waitForTimeout(200);
dire(nombre(await page.locator(".pied-ancien .tous b").innerText()) === 3828,
  "« Tout remettre » revient à sa capture");

dire(erreurs.length === 0,
  `Aucune erreur ni requête perdue${erreurs.length ? " — " + erreurs.join(" | ") : ""}`);

await nav.close();
console.log(rouges === 0 ? "\nTout est vert." : `\n${rouges} contrôle(s) au rouge.`);
process.exit(rouges === 0 ? 0 : 1);
