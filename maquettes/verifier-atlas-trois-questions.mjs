/*
  Contrôle de la planche des trois questions — JavaScript coupé, iPhone 13,
  meta viewport injectée.

  CE QU'IL SURVEILLE, ET POURQUOI :

    · LES DEUX ÉCRANS D'UNE QUESTION PORTENT LES MÊMES DONNÉES. C'est le
      contrôle qui justifie la planche : si le devis valait 3 480 € d'un côté et
      2 900 € de l'autre, ou si une rubrique manquait à l'un des deux sommaires,
      le patron comparerait deux contenus au lieu de comparer deux partis — et
      choisirait une allure en croyant en choisir une autre.
    · CHAQUE QUESTION PORTE UNE RECOMMANDATION. « À vous de voir » est une
      non-réponse : elle lui rend le travail d'analyse qu'on est censé faire.
    · LE GESTE ÉTEINT NE PART PAS. Sur l'écran qui bloque, le bouton doit être
      visiblement inerte — et sur celui qui prévient, visiblement actif. Deux
      boutons identiques rendraient la comparaison illisible.
    · LA RECOMMANDATION EST ÉCRITE APRÈS LES ÉCRANS, pour qu'il regarde avant
      de lire.

  Chacun sait échouer : changer un montant d'un seul côté rougit le premier,
  retirer un `.avis` rougit le deuxième, donner la même couleur aux deux gestes
  rougit le troisième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-trois-questions.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source.split("</style>")[0]));

controlerCharte(source, verifie);

const ESSAI = FICHIER.replace(/\.html$/, "-essai.html");
fs.writeFileSync(ESSAI, '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + source);

const nav = await chromium.launch(
  process.env.CHROMIUM_BIN === "playwright"
    ? {}
    : { executablePath: process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium" }
);
const ctx = await nav.newContext({ ...devices["iPhone 13"], javaScriptEnabled: false, colorScheme: "light" });
const page = await ctx.newPage();
await page.goto("file://" + path.resolve(ESSAI));

const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(200); };
const texte = async (s) => page.$eval(s, (e) => e.innerText.replace(/\s+/g, " ").trim()).catch(() => "");

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Trois questions, deux écrans chacune, une recommandation ──────────
try {
  const questions = await page.$$eval(".q h2", (l) => l.map((e) => e.textContent.trim()));
  verifie("la planche pose bien trois questions", questions.length === 3, `${questions.length}`);

  const avis = await page.$$eval(".avis", (l) => l.map((e) => e.innerText.trim()));
  verifie("chacune porte une recommandation, et aucune ne se dérobe",
    avis.length === 3 && avis.every((a) => a.length > 120 && /recommande/i.test(a)),
    avis.map((a) => a.slice(0, 30)).join(" | "));

  // « À vous de voir » rendrait au patron le travail qu'on est censé faire.
  verifie("aucune recommandation ne se contente de renvoyer la balle",
    !avis.some((a) => /à vous de voir|comme vous voulez|au choix$/i.test(a)));

  const rangees = await page.$$eval(".rangee", (l) => l.map((e) => e.querySelectorAll(".prop").length));
  verifie("chaque question montre exactement deux partis",
    rangees.length === 3 && rangees.every((n) => n === 2), rangees.join(" | "));

  // La recommandation vient APRÈS les écrans : lue avant, elle décide à sa
  // place, et il ne regarde plus qu'à moitié.
  const ordre = await page.evaluate(() => {
    const rangee = document.querySelector(".rangee");
    const avis = document.querySelector(".avis");
    return rangee.getBoundingClientRect().y < avis.getBoundingClientRect().y;
  });
  verifie("la recommandation est écrite sous les écrans, jamais au-dessus", ordre);
} catch (e) { echecs.push("structure · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. LE contrôle de la planche : les deux côtés portent la même chose ──
try {
  await cadrer('[data-s="q1a"]');
  const a = await page.$$eval('[data-s="q1a"] .nom', (l) => l.map((e) => e.textContent.trim()));
  const b = await page.$$eval('[data-s="q1b"] .nom', (l) => l.map((e) => e.textContent.trim()));
  verifie("question 1 : les deux registres listent les mêmes rubriques, dans le même ordre",
    a.length > 0 && a.join("|") === b.join("|"), `${a.length} contre ${b.length}`);

  const ditsA = await page.$$eval('[data-s="q1a"] .dit', (l) => l.map((e) => e.textContent.trim()));
  const ditsB = await page.$$eval('[data-s="q1b"] .dit', (l) => l.map((e) => e.textContent.trim()));
  verifie("et les mêmes explications sous chacune", ditsA.join("|") === ditsB.join("|"));

  const marqueesA = await page.$$eval('[data-s="q1a"] .plus_tard .nom', (l) => l.map((e) => e.textContent.trim()));
  const marqueesB = await page.$$eval('[data-s="q1b"] .plus_tard .nom', (l) => l.map((e) => e.textContent.trim()));
  verifie("et les mêmes rubriques marquées « Bientôt »",
    marqueesA.join("|") === marqueesB.join("|"), `${marqueesA.join("|")} / ${marqueesB.join("|")}`);
} catch (e) { echecs.push("question 1 · interrompu — " + String(e.message).split("\n")[0]); }

try {
  await cadrer('[data-s="q2a"]');
  const tarifsA = await page.$$eval('[data-s="q2a"] .tarif', (l) => l.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
  const tarifsB = await page.$$eval('[data-s="q2b"] .tarif', (l) => l.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
  // Le second écran porte EN PLUS le catalogue : ce sont les quatre tarifs qui
  // doivent coïncider, pas la liste entière.
  verifie("question 2 : les quatre mêmes tarifs, aux mêmes prix, des deux côtés",
    tarifsA.length === 4 && tarifsA.join("|") === tarifsB.slice(0, 4).join("|"),
    `${tarifsA.join(" · ")} / ${tarifsB.slice(0, 4).join(" · ")}`);

  // L'ARGUMENT DU PARTI A NE SE RACONTE PAS, IL SE MONTRE : si l'écran unique
  // n'était pas nettement plus haut, la planche plaiderait dans le vide.
  const hauteurs = await page.evaluate(() => {
    const h = (s) => document.querySelector(`${s} .corps`).scrollHeight;
    return { a: h('[data-s="q2a"]'), b: h('[data-s="q2b"]') };
  });
  // **Le seuil dit ce que la planche PROMET**, et il a servi : la note
  // annonçait « cinq fois la hauteur » là où le rapport valait 2,1. Une planche
  // qui exagère son propre argument est une planche qui ment au patron pour le
  // faire pencher — exactement ce qu'un contrôle doit attraper.
  verifie("et l'écran unique fait bien plus du double — l'argument se voit",
    hauteurs.b > hauteurs.a * 2, `${hauteurs.a} px contre ${hauteurs.b} px`);
} catch (e) { echecs.push("question 2 · interrompu — " + String(e.message).split("\n")[0]); }

try {
  await cadrer('[data-s="q3a"]');
  const recapA = await texte('[data-s="q3a"] .recap');
  const recapB = await texte('[data-s="q3b"] .recap');
  verifie("question 3 : le même devis, le même montant, la même date des deux côtés",
    recapA.length > 40 && recapA === recapB, `${recapA.slice(0, 60)} / ${recapB.slice(0, 60)}`);

  for (const [nom, sel] of [["qui bloque", '[data-s="q3a"]'], ["qui prévient", '[data-s="q3b"]']]) {
    const ecran = await texte(sel);
    verifie(`l'écran ${nom} nomme les deux manques, SIRET et IBAN`,
      /SIRET/.test(ecran) && /IBAN/.test(ecran), ecran.slice(0, 80));
    verifie(`et l'écran ${nom} mène là où ça se répare`,
      /Compléter mon entreprise/.test(ecran));
  }

  // Deux gestes identiques rendraient la comparaison illisible : c'est
  // exactement ce que la planche doit montrer.
  const gestes = await page.evaluate(() => {
    const f = (s) => getComputedStyle(document.querySelector(`${s} .geste`)).backgroundColor;
    return { bloque: f('[data-s="q3a"]'), previent: f('[data-s="q3b"]') };
  });
  verifie("le geste bloqué est visiblement éteint, celui qui prévient visiblement actif",
    gestes.bloque !== gestes.previent && gestes.previent === "rgb(47, 59, 47)",
    `${gestes.bloque} / ${gestes.previent}`);

  // **Le devis n'est jamais bloqué à l'écriture**, et l'écran doit le dire :
  // sans cette phrase, le patron croit qu'on lui prend son travail.
  verifie("l'écran qui bloque promet que le devis est gardé",
    /gardé tel quel/i.test(await texte('[data-s="q3a"] .sous_geste')));
} catch (e) { echecs.push("question 3 · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. La charte, mesurée dans le navigateur ─────────────────────────────
try {
  await cadrer('[data-s="q1a"]');
  await controlerGrammaire(page, '[data-s="q1a"]', verifie);
  await controlerGrammaire(page, '[data-s="q2a"]', verifie);
  await controlerGrammaire(page, '[data-s="q3a"]', verifie);
  await controlerRetrait(page, verifie);
} catch (e) { echecs.push("grammaire · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. La loupe est éteinte là où l'on mesure ────────────────────────────
try {
  const w = await page.$eval('[data-s="q1a"]', (e) => e.getBoundingClientRect().width);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    w <= 390, `${w.toFixed(0)} px`);
  verifie("et l'écran fait bien 390 px, pas ce qui reste après la coque",
    w >= 390, `${w.toFixed(0)} px`);
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Sur grand écran, les deux partis se voient ENSEMBLE ───────────────
// Une question est une comparaison : deux écrans qu'on ne peut pas voir d'un
// même regard ne se comparent pas, ils se mémorisent — et l'on choisit mal.
try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);

  const cote = await pg.evaluate(() => {
    const props = [...document.querySelectorAll(".rangee")].map((r) =>
      [...r.querySelectorAll(".prop")].map((p) => Math.round(p.getBoundingClientRect().y)));
    return props.every((paire) => new Set(paire).size === 1);
  });
  verifie("les deux partis d'une question sont côte à côte, jamais l'un sous l'autre", cote);

  const large = await pg.$eval('[data-s="q1a"]', (e) => e.getBoundingClientRect().width);
  verifie("et la loupe agrandit tout de même", large > 440, `${large.toFixed(0)} px`);

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur", !deborde);

  // **On prend les rangées par leur RANG dans la collection, pas par
  // `:nth-of-type`.** Les `.rangee` ne se suivent pas — un `.q` et un `.avis`
  // les séparent —, si bien que `.rangee:nth-of-type(2)` ne désignait rien et
  // que la capture de la deuxième question manquait, sans que rien ne rougisse.
  const rangeesVues = await pg.$$(".rangee");
  verifie("les trois questions sont capturées, pas deux", rangeesVues.length === 3,
    `${rangeesVues.length} rangée(s)`);
  for (let i = 0; i < rangeesVues.length; i++) {
    await rangeesVues[i].scrollIntoViewIfNeeded();
    await pg.waitForTimeout(200);
    await rangeesVues[i].screenshot({ path: `${SORTIE}/trois-questions-q${i + 1}.png` });
  }
  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
