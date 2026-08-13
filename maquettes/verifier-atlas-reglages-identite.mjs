/*
  Contrôle de l'identité de l'entreprise — JavaScript coupé, iPhone 13, meta
  viewport injectée.

  Le sujet n'est pas l'allure, ce sont QUATRE RÈGLES :

    · LE SIREN NE SE SAISIT PAS. Il est les neuf premiers chiffres du SIRET, et
      l'écran le MONTRE au lieu de le redemander. Le contrôle vérifie qu'il n'y
      a pas de second champ, et que les neuf chiffres correspondent — deux
      saisies, ce serait deux façons de se contredire.
    · LE RÉGIME DE TVA COMMANDE CE QUI S'IMPRIME. En franchise, la mention de
      l'article 293 B ; assujetti, le numéro intracommunautaire. Jamais les deux,
      jamais aucun.
    · UN CHAMP QUI N'EXISTE PAS ENCORE LE DIT. La planche montre des champs que
      la base ne porte pas ; les faire passer pour acquis, c'est le piège que
      `CLAUDE.md` §5 nomme — une chose « prête » qui ne l'est pas.
    · LE MANQUE SE SIGNALE SUR LA LIGNE, et dit ce qu'il EMPÊCHE.

  Chacune sait échouer : ajouter un champ « SIREN » rougit la première, retirer
  la règle `#r-assujetti:checked ~ .choix .siAssujetti` rougit la deuxième,
  effacer la réserve rougit la troisième, retirer `.creux` rougit la quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-identite.html";
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

const IDENT = '[data-s="identite"]', SIRET = '[data-s="siret"]', TVA = '[data-s="tva"]',
      BANQUE = '[data-s="banque"]', MANQUE = '[data-s="manque"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };
const etiquettes = async (s) => page.$$eval(`${s} .ch .et`, (l) => l.map((e) => e.textContent.trim()));

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. L'identité : ce qui s'imprime, et rien de plus ────────────────────
try {
  await cadrer(IDENT);
  const e = await etiquettes(IDENT);
  verifie("l'identité demande le nom, la forme juridique et l'adresse",
    e.join("|") === "Nom de l'entreprise|Forme juridique|Adresse du siège", e.join("|"));

  // L'adresse passe à plusieurs lignes : dans un `<input>`, « 12 route des
  // Coteaux 78200 Mantes-la-Jolie » s'arrête au bord de l'écran, et le patron
  // lit une adresse amputée sur son propre devis (`ChampNu`, option `long`).
  const balise = await page.$eval(`${IDENT} [data-s="ch-adresse"] .va`, (x) => x.tagName);
  verifie("l'adresse ne se coupe pas au bord de l'écran", balise === "TEXTAREA", balise);

  // Aucun interrupteur ici : ce qui identifie une pièce ne se coupe pas.
  const bascules = await page.$$eval(`${IDENT} input[type="checkbox"], ${IDENT} .piste`, (l) => l.length);
  verifie("aucun champ d'identité n'a d'interrupteur", bascules === 0, `${bascules}`);

  verifie("l'écran dit où ces lignes atterrissent",
    /devis|émetteur/i.test(await txt(`${IDENT} [data-s="mot-identite"]`)));
  await (await page.$(IDENT)).screenshot({ path: `${SORTIE}/reglages-identite.png` });
} catch (e) { echecs.push("identité · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. LE SIREN NE SE SAISIT PAS ─────────────────────────────────────────
try {
  await cadrer(SIRET);
  const e = await etiquettes(SIRET);
  verifie("un seul champ d'identifiant, et c'est le SIRET", e.join("|") === "SIRET", e.join("|"));
  verifie("aucun champ ne demande le SIREN",
    !e.some((x) => /siren/i.test(x)), e.join("|"));

  const saisi = (await page.$eval(`${SIRET} .va`, (x) => x.value)).replace(/\s/g, "");
  const montre = (await txt(`${SIRET} [data-s="siren"] b`)).replace(/\s/g, "");
  verifie("le SIRET fait quatorze chiffres", /^\d{14}$/.test(saisi), saisi);
  verifie("le SIREN montré EST les neuf premiers chiffres du SIRET",
    montre === saisi.slice(0, 9), `${montre} pour ${saisi.slice(0, 9)}`);
  verifie("et l'écran dit qu'il ne se saisit pas séparément",
    /ne se saisit pas/i.test(await txt(`${SIRET} [data-s="siren"]`)));
  await (await page.$(SIRET)).screenshot({ path: `${SORTIE}/reglages-identite-siret.png` });
} catch (e) { echecs.push("siret · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Le régime commande ce qui s'imprime ───────────────────────────────
try {
  await cadrer(TVA);
  verifie("l'écran s'ouvre sur la franchise", await vu(`${TVA} [data-s="mention"]`));
  verifie("et le numéro de TVA n'est alors demandé nulle part",
    !(await vu(`${TVA} [data-s="numero"]`)));
  verifie("la mention imprimée est nommée mot pour mot",
    /293 B du CGI/.test(await txt(`${TVA} [data-s="mention"]`)));

  await page.click(`${TVA} .o-assujetti`);
  await page.waitForTimeout(320);
  verifie("assujetti, le numéro intracommunautaire paraît", await vu(`${TVA} [data-s="numero"]`));
  verifie("et la mention de franchise disparaît — jamais les deux à la fois",
    !(await vu(`${TVA} [data-s="mention"]`)));

  // La réserve est portée par l'écran lui-même : ce champ n'existe pas encore
  // dans Atlas, et rien ne l'imprime. Le taire ferait croire à un acquis.
  const reserve = await txt(`${TVA} [data-s="numero"] .mot`);
  verifie("l'écran dit que ce champ n'existe pas encore",
    /n'existe pas encore/i.test(reserve), reserve.slice(0, 60));
  verifie("et renvoie la vérification à son comptable", /comptable/i.test(reserve));

  const marque = await page.$eval(`${TVA} .o-assujetti .rond`, (x) => getComputedStyle(x).boxShadow);
  const autre = await page.$eval(`${TVA} .o-franchise .rond`, (x) => getComputedStyle(x).boxShadow);
  verifie("la marque se déplace, sans en laisser deux", marque !== autre, `${marque} | ${autre}`);
  await (await page.$(TVA)).screenshot({ path: `${SORTIE}/reglages-identite-tva.png` });

  await page.click(`${TVA} .o-franchise`);
  await page.waitForTimeout(320);
  verifie("et l'on peut revenir en franchise", await vu(`${TVA} [data-s="mention"]`));
} catch (e) { echecs.push("tva · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Banque : l'obligatoire, et ce qui n'est pas imprimé ───────────────
try {
  await cadrer(BANQUE);
  const e = await etiquettes(BANQUE);
  verifie("téléphone, e-mail, IBAN, titulaire — et rien de plus",
    e.join("|") === "Téléphone|Adresse e-mail|IBAN|Titulaire du compte", e.join("|"));
  // « Seulement les obligatoires » : le BIC n'en est pas, un virement SEPA se
  // fait sur le seul IBAN.
  verifie("aucun champ ne demande le BIC", !e.some((x) => /bic|swift/i.test(x)), e.join("|"));
  verifie("et l'écran dit pourquoi il ne le demande pas",
    /BIC/i.test(await txt(`${BANQUE} [data-s="mot-bic"]`)));

  // Le fait vérifié dans `document-commun.ts` : le bloc émetteur n'imprime que
  // le nom, l'adresse et le SIRET. Ni téléphone, ni e-mail.
  verifie("l'écran avertit que le téléphone ne figure pas sur le devis",
    /ne figure/i.test(await txt(`${BANQUE} [data-s="mot-joindre"]`)));
  await (await page.$(BANQUE)).screenshot({ path: `${SORTIE}/reglages-identite-banque.png` });
} catch (e) { echecs.push("banque · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le manque se voit sur la ligne, et dit ce qu'il empêche ───────────
try {
  await cadrer(MANQUE);
  const creux = await page.$$eval(`${MANQUE} .ch.creux .et`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les deux lignes manquantes se signalent elles-mêmes",
    creux.length === 2 && creux.every((c) => /manquant/i.test(c)), creux.join(" | "));

  // Un signalement qui ne se voit qu'en couleur ne se voit pas de tous : le mot
  // « manquante » est écrit dans l'étiquette, pas seulement porté par le rouge.
  const rouge = await page.$eval(`${MANQUE} .ch.creux .et`, (e) => getComputedStyle(e).color);
  verifie("et la couleur d'alerte est celle de la charte",
    rouge === "rgb(156, 59, 46)", rouge);

  // Le trait rouge tient LES DEUX lignes, y compris la dernière. La règle qui
  // efface le filet du dernier élément vaut pour un séparateur ; ici le trait
  // est le signalement, et deux lignes vides dont une seule soulignée se lisent
  // comme un défaut d'affichage.
  const traits = await page.$$eval(`${MANQUE} .ch.creux`, (l) =>
    l.map((e) => getComputedStyle(e).borderBottomColor));
  verifie("chaque ligne manquante garde son trait, la dernière comprise",
    traits.length === 2 && traits.every((c) => c === "rgb(156, 59, 46)"), traits.join(" | "));

  const vides = await page.$$eval(`${MANQUE} .ch.creux .va`, (l) =>
    l.map((e) => ({ v: e.value.trim(), creux: e.placeholder })));
  verifie("aucun champ manquant n'est rempli d'un exemple plausible",
    vides.every((c) => c.v === "" && /aucun/i.test(c.creux)), JSON.stringify(vides));

  // « Champ requis » ne fait agir personne : la phrase dit ce que l'absence
  // EMPÊCHE, et pourquoi Atlas ne comble pas le vide tout seul.
  const dit = await txt(`${MANQUE} [data-s="empeche"]`);
  verifie("l'écran dit ce que l'absence empêche", /conforme/i.test(dit), dit.slice(0, 50));
  verifie("et pourquoi Atlas n'invente pas à la place", /inventer|vide/i.test(dit));
  await (await page.$(MANQUE)).screenshot({ path: `${SORTIE}/reglages-identite-manque.png` });
} catch (e) { echecs.push("manque · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La grammaire des écrans, et les cibles ────────────────────────────
try {
  for (const [nom, sel] of [["identité", IDENT], ["SIRET", SIRET], ["TVA", TVA],
                            ["banque", BANQUE], ["manque", MANQUE]]) {
    await cadrer(sel);
    verifie(`le bandeau de « ${nom} » désigne les réglages`,
      (await txt(`${sel} .bas .actif`)).toLowerCase() === "réglages");
    const sl = await page.$eval(sel, (r) => {
      const t = r.querySelector(".bas i").getBoundingClientRect();
      const a = r.querySelector(".bas .actif");
      const g = document.createRange(); g.selectNodeContents(a);
      const m = g.getBoundingClientRect();
      return (t.x + t.width / 2) - (m.x + m.width / 2);
    });
    verifie(`et son trait tombe sous « Réglages » (${nom})`, Math.abs(sl) < 8, `${sl.toFixed(1)} px`);
  }

  await cadrer(IDENT);
  await controlerGrammaire(page, IDENT, verifie);

  // Les lignes VISIBLES seulement : le numéro de TVA est replié tant que la
  // franchise est choisie, et une ligne qu'on ne peut pas toucher n'a pas de
  // cible à tenir. Mesurer les autres faisait rougir un contrôle juste sur un
  // écran sain — une alerte qui accuse à tort coûte plus cher que pas d'alerte.
  const petites = await page.$$eval(".ecran .ch, .ecran .opt", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .filter((e) => e.getBoundingClientRect().height < 44)
     .map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 40)));
  verifie("aucune ligne de saisie sous la cible de 44 px", petites.length === 0, petites.join(" | "));
  const corps = await page.$$eval(".ecran .va", (l) =>
    l.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length);
  verifie("aucun champ ne fait zoomer Safari", corps === 0, `${corps}`);
  const grosses = await page.$$eval('.ecran input[type="radio"]', (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);

  await controlerRetrait(page, verifie);

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const coupe = await page.$$eval(".ecran .corps", (l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucun écran ne déborde sur le côté", coupe === 0, `${coupe}`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

// ── 7. La loupe : éteinte sur téléphone, allumée en gros plan ────────────
try {
  const t = await rect(IDENT);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    t.w <= 390, `${t.w.toFixed(0)} px de large`);

  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);
  const large = await pg.$eval(IDENT, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);
  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  verifie("une planche par rangée, et non cinq de front",
    new Set(hauteurs).size === hauteurs.length, hauteurs.join(" | "));
  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);
  await (await pg.$(".prop")).screenshot({ path: `${SORTIE}/reglages-identite-gros-plan.png` });
  await grand.close();
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
