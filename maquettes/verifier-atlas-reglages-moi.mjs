/*
  Contrôle de la planche « Mon compte et ma connexion » — JavaScript coupé,
  iPhone 13, meta viewport injectée.

  CE QU'IL SURVEILLE, ET POURQUOI :

    · LA PLANCHE NE PROMET RIEN QUE LA BASE N'AIT. C'est tout son objet : elle
      existe parce que deux libellés du sommaire annoncent un TÉLÉPHONE et des
      APPAREILS qui n'existent nulle part. Une planche qui les dessinerait
      quand même se validerait en dix secondes, et le défaut n'apparaîtrait
      qu'au moment de coder. Les contrôles vérifient donc que le champ
      téléphone est ABSENT de l'écran du compte, et qu'aucun appareil n'est
      inventé — pas de « iPhone · il y a 2 h » sorti de nulle part.
    · LES DEUX QUESTIONS PORTENT UNE LETTRE, un coût et un avis. Il répond par
      une lettre — « 1 A 2 À 3 A », le 14 août 2026 — et une question sans coût
      chiffré se répond au hasard.
    · L'ÉCRAN DU COMPTE DIT QUE L'E-MAIL EST L'IDENTIFIANT DE CONNEXION. Sans
      cette phrase, le changer paraît anodin ; il ferme la porte.
    · LES CIBLES FONT 44 PX, et le bouton est posé au-dessus de la navigation,
      jamais par-dessus — la règle retenue le 14 août pour « Mon entreprise ».

  CHACUN SAIT ÉCHOUER, et c'est vérifiable à la main : ajouter un champ
  « Téléphone » à l'écran 1 rougit le premier ; retirer la lettre d'une
  proposition rougit le deuxième ; retirer la phrase sur l'identifiant rougit le
  troisième ; remonter la barre du bouton rougit le dernier.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-moi.html";
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

// ── 1. Mon compte : deux champs, et RIEN qui n'existe pas ────────────────
try {
  await cadrer('[data-s="compte"]');
  const etiquettes = await page.$$eval('[data-s="compte"] .champ .et',
    (l) => l.map((e) => e.textContent.trim().toLowerCase()));
  verifie("l'écran du compte porte le nom et l'e-mail",
    etiquettes.includes("nom") && etiquettes.includes("e-mail"), etiquettes.join(" | "));

  // LE CONTRÔLE QUI JUSTIFIE LA PLANCHE. `users` n'a pas de colonne
  // téléphone, et rien n'appellerait ce numéro : le dessiner ferait valider un
  // champ qu'il faudrait ensuite créer, remplir et ne jamais employer.
  verifie("et AUCUN champ téléphone, qui n'existe pas en base",
    !etiquettes.some((e) => /t[ée]l[ée]phone/.test(e)), etiquettes.join(" | "));

  // Et l'écran doit DIRE pourquoi il n'y en a pas : une absence muette se lit
  // comme un oubli, et la question reviendra.
  const dit = await texte('[data-s="compte"]');
  verifie("l'écran dit POURQUOI il n'y a pas de téléphone",
    /pas de téléphone ici/i.test(dit) && /entreprise/i.test(dit), dit.slice(0, 120));

  // Changer d'e-mail, c'est changer sa façon d'entrer. Sans cette phrase, le
  // geste paraît aussi anodin que corriger une faute dans son nom.
  verifie("l'écran dit que l'e-mail est l'identifiant de connexion",
    /identifiant avec lequel vous vous connectez/i.test(dit));

  const init = await page.$eval('[data-s="portrait"] .rond_init', (e) => {
    const r = e.getBoundingClientRect();
    return { t: e.textContent.trim(), h: r.height };
  });
  verifie("le portrait montre des initiales, pas un rond vide",
    /^[A-ZÀ-Þ]{2}$/.test(init.t), init.t);
  verifie("et il tient la cible de 44 px", init.h >= 44, `${init.h.toFixed(0)} px`);
} catch (e) { echecs.push("mon compte · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Connexion : le mot de passe, et le geste qui compte ───────────────
try {
  await cadrer('[data-s="connexion"]');
  const masques = await page.$$eval('[data-s="connexion"] .va.masque',
    (l) => l.map((e) => e.textContent.trim()));
  verifie("les mots de passe sont montrés masqués, jamais en clair",
    masques.length >= 2 && masques.every((m) => /^[•]+$/.test(m)), masques.join(" | "));

  const dit = await texte('[data-s="connexion"]');
  verifie("« Me déconnecter partout » est proposé",
    /me déconnecter partout/i.test(dit));

  // **AUCUN APPAREIL INVENTÉ.** Une liste plausible — « iPhone · il y a 2 h » —
  // se valide sans qu'on voie qu'elle n'existe pas : Atlas ne garde aucune
  // session en base (`src/auth.ts`, jeton signé). C'est le piège que la
  // planche entière sert à éviter, et il vaut un contrôle.
  verifie("et AUCUNE liste d'appareils inventée sur l'écran de connexion",
    !/(iphone|android|ipad|chrome|safari|firefox|windows)/i.test(dit), dit.slice(0, 140));

  const b = await page.$eval('[data-s="connexion"] .bouton', (e) => {
    const r = e.getBoundingClientRect();
    return { h: r.height, fond: getComputedStyle(e).backgroundColor };
  });
  verifie("le bouton tient la cible de 44 px", b.h >= 44, `${b.h.toFixed(0)} px`);
  verifie("il porte le vert pin — c'est ce qu'on FAIT", b.fond === "rgb(47, 59, 47)", b.fond);

  // Posé JUSTE au-dessus de la navigation : mesurer la distance au bas de
  // l'écran accuserait la barre du bas, qui a le droit d'être là.
  const place = await page.$eval('[data-s="connexion"]', (e) => {
    const barre = e.querySelector(".barre").getBoundingClientRect();
    const bas = e.querySelector(".bas").getBoundingClientRect();
    return bas.y - (barre.y + barre.height);
  });
  verifie("le bouton est posé juste au-dessus de la navigation, jamais dessous",
    Math.abs(place) < 2, `${place.toFixed(0)} px`);
} catch (e) { echecs.push("connexion · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Les deux questions : une lettre, un coût, un avis ─────────────────
try {
  for (const [ecran, quoi] of [['[data-s="q-telephone"]', "téléphone"], ['[data-s="q-appareils"]', "appareils"]]) {
    await cadrer(ecran);
    const choix = await page.$$eval(`${ecran} .choix`, (l) =>
      l.map((e) => ({
        lettre: e.querySelector(".lettre")?.textContent.trim() ?? "",
        titre: e.querySelector(".titre")?.textContent.trim() ?? "",
        cout: e.querySelector(".cout")?.textContent.trim() ?? "",
        haut: e.getBoundingClientRect().height,
      })));
    verifie(`la question du ${quoi} propose deux réponses`, choix.length === 2, `${choix.length}`);
    verifie(`et chacune porte SA LETTRE — il répond par une lettre`,
      choix.map((c) => c.lettre).join("") === "AB", choix.map((c) => c.lettre).join("|"));
    // Une proposition sans coût se choisit au hasard : c'est le seul élément
    // qui lui permette d'arbitrer sans connaître le code.
    verifie(`et son coût, faute de quoi elle se choisit au hasard`,
      choix.every((c) => c.cout.length > 3), choix.map((c) => c.cout).join(" | "));
    verifie(`chaque proposition tient la cible de 44 px`,
      choix.every((c) => c.haut >= 44), choix.map((c) => c.haut.toFixed(0)).join(" "));

    // Un avis, et il doit être MOTIVÉ : « je ferais A » sans raison ne se
    // discute pas, et il ne peut alors que suivre ou refuser en aveugle.
    const avis = await texte(`${ecran} .fin`);
    verifie(`la question du ${quoi} porte un avis motivé`,
      /ce que je ferais/i.test(avis) && avis.length > 90, avis.slice(0, 80));
  }

  // L'écran des appareils doit AVOUER qu'il n'y a rien en base : c'est le fait
  // qui décide, et sans lui les deux coûts paraissent arbitraires.
  const app = await texte('[data-s="q-appareils"]');
  verifie("la question des appareils dit qu'Atlas n'en garde AUCUNE trace",
    /aucune trace/i.test(app) && /jeton/i.test(app), app.slice(0, 120));
} catch (e) { echecs.push("questions · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Aucun filet dans le vide sous l'en-tête ───────────────────────────
//
// LE CHEVEU DE L'EN-TÊTE FERME DÉJÀ AU-DESSUS DU CORPS. Un premier élément qui
// porte à son tour un `border-top` dessine un second trait trente pixels plus
// bas, avec rien entre les deux : une bande morte. Vue sur la capture de
// l'écran 4, jamais par un contrôle — celui de `charte.mjs` ne compare que les
// filets DANS le corps, et le cheveu lui est extérieur.
try {
  const fautifs = await page.$$eval(".ecran", (ecrans) =>
    ecrans
      .map((e) => {
        const premier = e.querySelector(".corps")?.firstElementChild;
        if (!premier) return null;
        const haut = parseFloat(getComputedStyle(premier).borderTopWidth);
        return haut > 0 ? `${e.dataset.s} · ${premier.className}` : null;
      })
      .filter(Boolean));
  verifie("aucun écran n'ouvre son corps par un filet, sous celui de l'en-tête",
    fautifs.length === 0, fautifs.join(" | "));
} catch (e) { echecs.push("bande morte · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. La charte, mesurée dans le navigateur ─────────────────────────────
try {
  await cadrer('[data-s="compte"]');
  await controlerGrammaire(page, '[data-s="compte"]', verifie);
  await controlerGrammaire(page, '[data-s="connexion"]', verifie);
  await controlerRetrait(page, verifie);
} catch (e) { echecs.push("grammaire · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La loupe est éteinte là où l'on mesure ────────────────────────────
// SANS CE CONTRÔLE, toutes les mesures ci-dessus porteraient sur un écran
// agrandi : une cible de 33 px passerait pour 44 sans que rien ne rougisse.
try {
  const w = await page.$eval('[data-s="compte"]', (e) => e.getBoundingClientRect().width);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    w <= 390, `${w.toFixed(0)} px`);
  verifie("et l'écran fait bien 390 px, pas ce qui reste après la coque",
    w >= 390, `${w.toFixed(0)} px`);
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

// ── 7. Le gros plan, et les captures ─────────────────────────────────────
try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);

  const large = await pg.$eval('[data-s="compte"]', (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur", !deborde);

  const props = await pg.$$(".prop");
  verifie("les quatre écrans sont capturés", props.length === 4, `${props.length}`);
  for (let i = 0; i < props.length; i++) {
    await props[i].scrollIntoViewIfNeeded();
    await pg.waitForTimeout(200);
    await props[i].screenshot({ path: `${SORTIE}/reglages-moi-${i + 1}.png` });
  }
  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
