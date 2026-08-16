#!/usr/bin/env node
/*
  Éprouve la maquette 66, JAVASCRIPT COUPÉ.

  **D'où elle vient.** Le patron, le 16 août 2026, photo d'un « graphe de
  connaissances » à l'appui : *« ça peut me servir pour mon appli ? »*. La
  réponse était non — le dépôt tient déjà sa mémoire, et ses données sont déjà
  reliées en base. Ce qu'il restait à en prendre : l'application SAIT beaucoup de
  choses sur un client et n'en MONTRE aucune.

  **LE CONTRÔLE QUI COMPTE EST L'ARITHMÉTIQUE, encore.** Une planche qui montre
  de l'argent à un artisan et qui ne tombe pas juste lui apprend à douter des
  chiffres de son application. Le contrôle recalcule : ce qui reste dû plus ce
  qui a été encaissé doit refaire le total facturé, et le détail des chantiers
  doit s'additionner pour donner ce total.

  Les autres contrôles :

    1. les trois arrangements existent SANS SCRIPT, un seul à la fois ;
    2. **A ne montre AUCUN écran nouveau** — c'est tout son intérêt, et sa
       légende le promet : un encart dans la fiche du chantier ;
    3. **C est le seul à toucher la barre du bas.** Sa légende annonce un
       cinquième onglet ; s'il n'y était pas, elle mentirait sur ce que ça
       coûte, et le patron choisirait sans le savoir ;
    4. **les nombres de fois ne dépassent pas le nombre de chantiers.** « Élagage
       5 fois » chez un client venu 4 fois est le genre de détail qui décrédibilise
       une planche entière ;
    5. **chaque arrangement dit ce qu'il NE fait pas.** C'est la moitié utile
       d'une planche : sans le coût écrit en face, il choisit à l'aveugle.

  **Il sait échouer, et il nomme le défaut.** Changer 740 en 700 rend le 1 rouge
  en donnant l'écart ; retirer l'onglet « Clients » de C rend le 3 rouge.

  Usage : node scripts/verifier-maquette-fiche-client.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "66-ce-que-je-sais-du-client.html"),
);

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

/**
 * Le MONTANT d'un texte — « 16 août · 887 € » vaut 887, pas 16887.
 *
 * **Première écriture fausse, et elle accusait la planche à tort.** Elle
 * retirait tout ce qui n'était pas un chiffre, avalant donc le quantième au
 * passage : la somme des quatre chantiers sortait à 44 200 € et le contrôle
 * annonçait que la maquette ne tombait pas juste — alors que 887 + 740 + 980 +
 * 593 font bien 3 200. Un contrôle qui accuse à tort coûte plus cher que pas de
 * contrôle du tout (`CLAUDE.md` §5).
 *
 * On lit donc ce qui précède l'euro, et rien d'autre.
 */
const enNombre = (t) => {
  const m = t.match(/([\d][\d\s  .,]*)\s?€/);
  const brut = m ? m[1] : t;
  return Number(brut.replace(/[^\d,.]/g, "").replace(",", "."));
};

/** Un compte simple — « 4 chantiers », sans euro. */
const enCompte = (t) => Number((t.match(/\d+/) ?? ["0"])[0]);

const ARRANGEMENTS = [
  { radio: "v-a", nom: "A · Un encart sur le chantier", panneau: ".a-encart", legende: ".l-a" },
  { radio: "v-b", nom: "B · Une fiche client", panneau: ".a-fiche", legende: ".l-b" },
  { radio: "v-c", nom: "C · Un onglet Clients", panneau: ".a-onglet", legende: ".l-c" },
];

const contexte = await navigateur.newContext({
  viewport: { width: 430, height: 1100 },
  javaScriptEnabled: false, // son lecteur n'en exécute pas — la planche non plus
});
const page = await contexte.newPage();
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La maquette 66 tombe-t-elle juste ? ===\n");

// ── 1. Un arrangement à la fois ─────────────────────────────────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const vus = [];
  for (const autre of ARRANGEMENTS) {
    if ((await page.locator(`${autre.panneau}:visible`).count()) > 0) vus.push(autre.radio);
  }
  dire(vus.length === 1 && vus[0] === a.radio, `${a.nom} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`);
}

// ── 2. L'argent tombe juste — encaissé + dû = facturé ───────────────────────
await page.click('label[for="v-b"]');
const chiffres = await page.locator(".a-fiche .ch").allInnerTexts();
if (chiffres.length !== 3) {
  dire(false, `la fiche doit porter trois chiffres, elle en porte ${chiffres.length}`);
} else {
  const chantiers = enCompte(chiffres[0]);
  const facture = enNombre(chiffres[1]);
  const du = enNombre(chiffres[2]);

  // Le détail des chantiers doit refaire le total facturé — c'est la seule
  // vérification qui prouve que la planche n'a pas été remplie au hasard.
  const parChantier = (await page.locator(".a-fiche .lgn .fois").allInnerTexts())
    .filter((t) => /€/.test(t) && /\d{1,2} (janvier|mars|juin|août)/.test(t))
    .map(enNombre);
  const somme = parChantier.reduce((s, n) => s + n, 0);

  dire(
    parChantier.length === chantiers,
    `le nombre de chantiers annoncé (${chantiers}) doit être celui de la liste (${parChantier.length})`,
  );
  dire(
    Math.abs(somme - facture) <= 2,
    `le détail des chantiers fait ${somme} € et le total annonce ${facture} € — un artisan refait la somme`,
  );
  dire(
    du > 0 && du < facture,
    `ce qui reste dû (${du} €) doit être une part de ce qui a été facturé (${facture} €)`,
  );

  // **Et il doit correspondre aux chantiers marqués impayés.** Sans ce
  // rapprochement, le contrôle laissait passer n'importe quel montant dû tant
  // qu'il restait inférieur au total : 700 € au lieu de 740 € passait au vert.
  // C'est le chiffre le plus lu de la fiche — celui qui dit ce qu'on lui doit.
  const impayes = (await page.locator(".a-fiche .lgn .fois").allInnerTexts())
    .filter((t) => /impay/i.test(t))
    .map(enNombre);
  dire(
    impayes.length > 0,
    "aucun chantier n'est marqué impayé : d'où sortirait ce qui reste dû ?",
  );
  dire(
    Math.abs(impayes.reduce((s, n) => s + n, 0) - du) <= 2,
    `les chantiers impayés font ${impayes.reduce((s, n) => s + n, 0)} € et la fiche annonce ${du} € dus`,
  );
  console.log(`    (${chantiers} chantiers, ${facture} € facturés, dont ${du} € dus)`);
}

// ── 3. Les nombres de fois ne dépassent pas le nombre de chantiers ──────────
{
  const chantiers = enCompte((await page.locator(".a-fiche .ch").allInnerTexts())[0]);
  const fois = (await page.locator(".a-fiche .lgn .fois").allInnerTexts())
    .filter((t) => /fois/.test(t))
    .map((t) => Number(t.match(/(\d+) fois/)?.[1] ?? 0));
  dire(fois.length > 0, `les prestations récurrentes sont là (${fois.length})`);
  dire(
    fois.every((n) => n > 0 && n <= chantiers),
    `une prestation revient plus souvent qu'il n'y a de chantiers : ${fois.join(", ")} pour ${chantiers}`,
  );
}

// ── 4. A ne montre aucun écran nouveau, C en montre un onglet ───────────────
await page.click('label[for="v-a"]');
{
  const texte = await page.locator(".a-encart").innerText();
  dire(
    /Chantier/i.test(texte) && !/Clients/.test(texte),
    "A reste dans la fiche du CHANTIER — c'est tout son intérêt",
  );
  dire(
    (await page.locator(".a-encart .onglets").count()) === 0,
    "A ne touche pas à la barre du bas",
  );
}

await page.click('label[for="v-c"]');
{
  const onglets = await page.locator(".a-onglet .onglets span").allInnerTexts();
  dire(
    onglets.length === 5 && onglets.some((o) => /Clients/.test(o)),
    `C doit montrer les CINQ onglets, « Clients » compris (vus : ${onglets.join(", ")})`,
  );
  // Sa légende annonce ce coût : si l'écran ne le montrait pas, elle mentirait.
  const legende = await page.locator(".l-c").innerText();
  dire(
    /cinquième onglet/i.test(legende),
    "la légende de C doit dire qu'elle ajoute un onglet — c'est son seul vrai coût",
  );
}

// ── 5. Chaque arrangement dit ce qu'il ne fait pas ──────────────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const legende = await page.locator(a.legende).innerText();
  dire(
    legende.length > 120 && /coûte/i.test(legende),
    `${a.radio} : sa légende doit dire ce que ça coûte, sinon il choisit à l'aveugle`,
  );
}

// ── 6. Rien ne déborde à 390 px, la largeur de son téléphone ────────────────
for (const a of ARRANGEMENTS) {
  await page.click(`label[for="${a.radio}"]`);
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  const vue = await page.evaluate(() => window.innerWidth);
  dire(large <= vue + 1, `${a.radio} ne déborde pas à droite (${large} pour ${vue})`);
}

await navigateur.close();

console.log(
  plaintes.length === 0
    ? "\n✅ La maquette 66 tombe juste."
    : `\n❌ ${plaintes.length} défaut(s) sur la maquette 66.`,
);
process.exit(plaintes.length === 0 ? 0 : 1);
