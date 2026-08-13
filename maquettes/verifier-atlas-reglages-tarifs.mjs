/*
  Contrôle des tarifs et du catalogue — JavaScript coupé, iPhone 13, meta
  viewport injectée.

  Le sujet n'est pas l'allure, ce sont QUATRE RÈGLES :

    · TROIS FAMILLES, ET L'UNITÉ SUIT LA FAMILLE. Une main-d'œuvre se compte en
      temps, un matériel à la journée, une prestation au forfait. Proposer les
      mêmes vingt unités aux trois, c'est se tromper une fois sur dix — et
      l'erreur ne se voit que sur le devis du client.
    · UN PRIX SANS UNITÉ N'EST PAS UN PRIX. « 90 € » ne dit pas si c'est par
      mètre cube ou par voyage. Signalé sur la LIGNE, comme le SIRET au lot 2.
    · UNE GRILLE VIDE SE DIT VIDE, ET DIT POURQUOI. C'est l'état normal du
      premier jour ; sans un mot, il se lit comme une panne.
    · CE QUI EST À LUI ET CE QUI VIENT AVEC L'APPLICATION sont distingués à
      l'écran. Le catalogue donne les mots, jamais les prix.

  Chacune sait échouer : donner les mêmes unités aux trois familles rougit la
  première, retirer `.sans` rougit la deuxième, effacer la phrase des grilles
  vides rougit la troisième, mêler catalogue et tarifs rougit la quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-tarifs.html";
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

const TARIFS = '[data-s="tarifs"]', FAM = '[data-s="famille"]',
      GRILLES = '[data-s="grilles"]', VIDE = '[data-s="vide"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Les trois familles qu'il a demandées ──────────────────────────────
try {
  await cadrer(TARIFS);
  const titres = await page.$$eval(`${TARIFS} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les trois familles demandées, dans cet ordre",
    titres.join("|") === "Prestations|Main-d'œuvre|Matériel", titres.join("|"));

  // Chaque prix porte son unité — sauf celui qui est là pour montrer le manque.
  const lignes = await page.$$eval(`${TARIFS} .tar`, (l) =>
    l.map((e) => ({
      nom: e.querySelector(".nom").textContent.trim(),
      unite: e.querySelector(".comment").textContent.trim(),
      prix: e.querySelector(".prix").textContent.trim(),
      manque: e.classList.contains("sans"),
    })));
  verifie("chaque tarif porte un prix", lignes.every((l) => /\d/.test(l.prix)), JSON.stringify(lignes.map((l) => l.prix)));
  verifie("et chacun dit en quoi il se compte",
    lignes.filter((l) => !l.manque).every((l) => l.unite.length > 3),
    JSON.stringify(lignes.map((l) => l.unite)));

  // UN PRIX SANS UNITÉ N'EST PAS UN PRIX : le manque se voit sur la ligne.
  const sans = lignes.filter((l) => l.manque);
  verifie("l'unité manquante est signalée sur sa ligne",
    sans.length === 1 && /manquante/i.test(sans[0].unite), JSON.stringify(sans));
  const couleur = await page.$eval(`${TARIFS} [data-s="sans-unite"] .comment`,
    (e) => getComputedStyle(e).color);
  verifie("dans la couleur d'alerte de la charte", couleur === "rgb(156, 59, 46)", couleur);

  // Un prix ne se casse jamais en deux : « 1 240,00 € » qui passe à la ligne
  // pousse le « € » tout seul en dessous.
  const casse = await page.$$eval(`${TARIFS} .tar .prix`, (l) =>
    l.filter((e) => e.getBoundingClientRect().height > 30).length);
  verifie("aucun prix ne se casse en deux lignes", casse === 0, `${casse}`);

  verifie("l'écran dit que ces prix lui appartiennent",
    /vôtres|jamais/i.test(await txt(`${TARIFS} [data-s="a-lui"]`)));
  await (await page.$(TARIFS)).screenshot({ path: `${SORTIE}/reglages-tarifs.png` });
} catch (e) { echecs.push("tarifs · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. L'UNITÉ SUIT LA FAMILLE ───────────────────────────────────────────
try {
  await cadrer(FAM);
  const familles = await page.$$eval(`${FAM} .opt .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les trois familles se choisissent",
    familles.join("|") === "Prestation|Main-d'œuvre|Matériel", familles.join("|"));

  const jeux = {};
  for (const [id, cle, nom] of [["f-presta", "u-presta", "prestation"],
                                ["f-main", "u-main", "main-d'œuvre"],
                                ["f-mat", "u-mat", "matériel"]]) {
    await page.click(`${FAM} .o-${id.slice(2)}`);
    await page.waitForTimeout(300);
    verifie(`choisir « ${nom} » montre ses unités`, await vu(`${FAM} [data-s="${cle}"]`));
    const ouverts = await page.$$eval(`${FAM} .unites`, (l) =>
      l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).length);
    verifie(`et un seul jeu d'unités à la fois (${nom})`, ouverts === 1, `${ouverts}`);
    jeux[cle] = await page.$$eval(`${FAM} [data-s="${cle}"] .past span`,
      (l) => l.map((e) => e.textContent.trim()));
    // Trois ou quatre, jamais vingt : une liste longue se choisit de travers.
    verifie(`« ${nom} » propose peu d'unités, et pas une liste de vingt`,
      jeux[cle].length >= 2 && jeux[cle].length <= 5, `${jeux[cle].length}`);
    // Un choix par défaut est déjà pris : un tarif sans unité est ce que la
    // planche interdit par ailleurs.
    const pris = await page.$$eval(`${FAM} [data-s="${cle}"] .past span.pris`, (l) => l.length);
    verifie(`et une unité est déjà retenue (${nom})`, pris === 1, `${pris}`);
  }

  // LE POINT : les jeux ne sont pas les mêmes. S'ils l'étaient, la famille ne
  // servirait à rien et autant proposer une liste unique.
  const memes = jeux["u-presta"].join("|") === jeux["u-main"].join("|");
  verifie("les unités d'une prestation ne sont pas celles d'une main-d'œuvre",
    !memes, jeux["u-presta"].join("|"));
  verifie("la main-d'œuvre se compte en temps",
    jeux["u-main"].every((u) => /heure|journée/i.test(u)), jeux["u-main"].join("|"));
  await (await page.$(FAM)).screenshot({ path: `${SORTIE}/reglages-tarifs-famille.png` });
} catch (e) { echecs.push("famille · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2 bis. AJOUTER ET SUPPRIMER ──────────────────────────────────────────
//
// Sa demande du 13 août 2026 : « pouvoir aussi ajouter ou supprimer du
// matériel, ou un prix, ou un machin ».
//
// UN GESTE PAR FAMILLE, et qui NOMME la famille : « Ajouter » tout court
// obligerait à choisir la famille sur un écran de plus, alors que c'est elle qui
// commande les unités proposées.
try {
  await cadrer(TARIFS);
  const ajouts = await page.$$eval(`${TARIFS} .ajout .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("chaque famille porte son propre geste d'ajout",
    ajouts.length === 3, `${ajouts.length}`);
  verifie("et chacun nomme ce qu'il ajoute, jamais « Ajouter » tout court",
    ajouts.every((a) => a.split(" ").length >= 3), ajouts.join(" | "));
  // Le geste se pose SOUS la liste de sa famille, pas en tête d'écran.
  const places = await page.$$eval(`${TARIFS} .bloc`, (l) =>
    l.map((b) => {
      const a = b.querySelector(".ajout");
      if (!a) return "aucun";
      return b.lastElementChild === a ? "en bas" : "au milieu";
    }));
  verifie("il ferme la liste de sa famille", places.every((p) => p === "en bas"), places.join(" | "));

  // LA SUPPRESSION NE S'EXÉCUTE PAS AU PREMIER APPUI.
  await cadrer(FAM);
  verifie("la fiche porte un geste de suppression", await vu(`${FAM} [data-s="retirer"]`));
  const bas = await page.$eval(FAM, (r) => {
    const c = r.querySelector(".corps"), x = r.querySelector('[data-s="retirer"]');
    return x.getBoundingClientRect().y - c.getBoundingClientRect().y;
  });
  verifie("posé au bas de la fiche, pas sur chaque ligne de la liste", bas > 200, `${bas.toFixed(0)} px`);
  verifie("aucune corbeille sur les lignes de la liste",
    (await page.$$eval(`${TARIFS} .tar .retirer`, (l) => l.length)) === 0);

  verifie("rien ne s'ouvre tant qu'on n'a pas touché", !(await vu(`${FAM} [data-s="feuille"]`)));
  await page.click(`${FAM} [data-s="retirer"]`);
  await page.waitForTimeout(320);
  verifie("le geste demande confirmation", await vu(`${FAM} [data-s="feuille"]`));
  const dit = await txt(`${FAM} [data-s="feuille"]`);
  verifie("et la feuille nomme ce qu'elle va supprimer", /Nacelle/.test(dit), dit.slice(0, 40));

  // CE QUI N'EST PAS TOUCHÉ, dit AVANT le geste. Vérifié dans le code : aucune
  // ligne de devis ne pointe vers un tarif. Le taire laisserait croire le
  // contraire, et personne n'ose supprimer dans le doute.
  verifie("elle dit que les devis déjà faits n'en seront pas touchés",
    /pas touchés/i.test(dit), dit.slice(0, 120));
  verifie("et pourquoi : ils gardent le prix qu'ils portaient",
    /gardent le prix/i.test(dit));

  const gestes = await page.$$eval(`${FAM} .feuille .bouton`, (l) =>
    l.map((e) => ({ t: e.textContent.trim(), fond: getComputedStyle(e).backgroundColor,
                    rayon: parseFloat(getComputedStyle(e).borderRadius) })));
  verifie("deux issues, et renoncer est possible",
    gestes.map((g) => g.t).join("|") === "Supprimer|Annuler", gestes.map((g) => g.t).join("|"));
  verifie("les deux sont des capsules, comme tous les boutons",
    gestes.every((g) => g.rayon >= 20), JSON.stringify(gestes.map((g) => g.rayon)));
  // Le rouge ne sert QU'À CELA dans la charte : confirmer une action
  // destructive. Un second aplat rouge à l'écran le banaliserait.
  verifie("seul le geste destructeur porte le rouge de la charte",
    gestes[0].fond === "rgb(156, 59, 46)" && gestes[1].fond !== gestes[0].fond,
    JSON.stringify(gestes.map((g) => g.fond)));
  await (await page.$(FAM)).screenshot({ path: `${SORTIE}/reglages-tarifs-supprimer.png` });

  await page.click(`${FAM} .feuille .renoncer`);
  await page.waitForTimeout(320);
  verifie("renoncer referme la feuille", !(await vu(`${FAM} [data-s="feuille"]`)));
} catch (e) { echecs.push("ajouter/supprimer · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Une grille vide se dit vide, et dit pourquoi ──────────────────────
try {
  await cadrer(GRILLES);
  const grilles = await page.$$eval(`${GRILLES} .gri`, (l) =>
    l.map((e) => ({
      nom: e.querySelector(".nom").textContent.trim(),
      etat: e.querySelector(".etat").textContent.trim(),
      creuse: e.classList.contains("creuse"),
    })));
  verifie("les cinq grilles de l'application sont là",
    grilles.map((g) => g.nom).join("|") === "Abattage|Fendage|Dessouchage|Haie|Grumes",
    grilles.map((g) => g.nom).join("|"));
  verifie("chacune dit combien de prix elle a appris",
    grilles.filter((g) => !g.creuse).every((g) => /\d/.test(g.etat)),
    JSON.stringify(grilles.map((g) => g.etat)));
  verifie("et une grille vide le dit avec un mot, pas avec un blanc",
    grilles.filter((g) => g.creuse).every((g) => /vide/i.test(g.etat)),
    JSON.stringify(grilles.filter((g) => g.creuse)));

  const apprend = await txt(`${GRILLES} [data-s="apprend"]`);
  verifie("l'écran dit que ces grilles ne se remplissent pas à la main",
    /pas à la main/i.test(apprend), apprend.slice(0, 60));
  const vides = await txt(`${GRILLES} [data-s="vides"]`);
  verifie("et qu'une grille vide n'est pas une panne", /normale/i.test(vides), vides.slice(0, 50));
  // La règle du produit, dans ses termes : ne rien inventer.
  verifie("il préfère se taire qu'inventer un prix",
    /taire|inventer/i.test(vides), vides.slice(0, 80));
  await (await page.$(GRILLES)).screenshot({ path: `${SORTIE}/reglages-tarifs-grilles.png` });
} catch (e) { echecs.push("grilles · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Le premier jour, et ce qui vient avec l'application ───────────────
try {
  await cadrer(VIDE);
  const rien = await txt(`${VIDE} [data-s="rien"]`);
  verifie("l'écran vide dit ce que l'absence de tarifs change",
    /aucun prix|ne proposera/i.test(rien), rien.slice(0, 60));

  const titres = await page.$$eval(`${VIDE} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("ses tarifs et ce qui vient avec Atlas sont DEUX blocs",
    titres.join("|") === "Deux façons de commencer|Ce qui vient avec Atlas", titres.join("|"));

  const partage = await txt(`${VIDE} [data-s="partage"]`);
  verifie("le catalogue donne les mots, jamais les prix",
    /aucun prix/i.test(partage), partage.slice(0, 60));
  verifie("et ce qui est à lui ne traverse jamais d'une entreprise à l'autre",
    /traversent jamais|vôtres/i.test(partage), partage.slice(0, 90));
  await (await page.$(VIDE)).screenshot({ path: `${SORTIE}/reglages-tarifs-vide.png` });
} catch (e) { echecs.push("premier jour · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. La grammaire des écrans, et les cibles ────────────────────────────
try {
  for (const [nom, sel] of [["tarifs", TARIFS], ["famille", FAM],
                            ["grilles", GRILLES], ["premier jour", VIDE]]) {
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

  await cadrer(TARIFS);
  await controlerGrammaire(page, TARIFS, verifie);
  await controlerRetrait(page, verifie);

  const petites = await page.$$eval(".ecran .tar, .ecran .gri, .ecran .opt, .ecran .ch, .ecran .past span", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .filter((e) => e.getBoundingClientRect().height < 36)
     .map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 30)));
  verifie("aucune ligne ni pastille trop basse pour le doigt", petites.length === 0, petites.join(" | "));
  const corps = await page.$$eval(".ecran .va", (l) =>
    l.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length);
  verifie("aucun champ ne fait zoomer Safari", corps === 0, `${corps}`);
  const grosses = await page.$$eval('.ecran input[type="radio"]', (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const coupe = await page.$$eval(".ecran .corps", (l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucun écran ne déborde sur le côté", coupe === 0, `${coupe}`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La loupe : éteinte sur téléphone, allumée en gros plan ────────────
try {
  const t = await rect(TARIFS);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    t.w <= 390, `${t.w.toFixed(0)} px de large`);

  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);
  const large = await pg.$eval(TARIFS, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);
  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  verifie("une planche par rangée, et non quatre de front",
    new Set(hauteurs).size === hauteurs.length, hauteurs.join(" | "));
  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);
  await (await pg.$(".prop")).screenshot({ path: `${SORTIE}/reglages-tarifs-gros-plan.png` });
  await grand.close();
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
