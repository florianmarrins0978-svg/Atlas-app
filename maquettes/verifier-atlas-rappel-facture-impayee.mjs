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

const FICHIER = process.argv[2] || "maquettes/atlas-rappel-facture-impayee.html";
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
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. La carte du rappel dit LE MONTANT, et le bon ─────────────────────
try {
  await cadrer('[data-s="accueil"]');
  const dit = await texte('[data-s="carte-impayee"]');
  verifie("la carte porte le montant dû, en gros", /1 240,00 €/.test(dit), dit.slice(0, 120));
  verifie("et depuis combien de temps l'échéance est passée", /12 jours/.test(dit));

  // **LE CONTRÔLE QUI PORTE LA PLANCHE.** Sur une facture partiellement
  // réglée, afficher le TOTAL ferait réclamer une somme déjà encaissée — et
  // afficher le reste sans le rappeler laisserait croire à une petite facture.
  const partielle = await texte('[data-s="carte-partielle"]');
  verifie("sur un acompte reçu, c'est le RESTE DÛ qui s'affiche",
    /480,00 €/.test(partielle) && /restant sur 1 200,00 €/.test(partielle), partielle.slice(0, 140));

  // **UN SEUL MOT POUR RANGER UNE CARTE — sa demande du 30 août 2026.**
  // *« Pour chaque notification je dois pouvoir cliquer sur vu pour les faire
  // disparaître. »* Cette planche disait l'inverse jusque-là — « sans J'ai
  // vu » —, et c'est le patron qui l'a tranché depuis.
  //
  // **On regarde DANS LES CARTES, pas l'écran entier** : la note d'à côté parle
  // du geste, et une alerte qui rougit sur le texte censé l'expliquer coûte
  // plus cher que pas d'alerte (`AGENTS.md`).
  const dansLesCartes = await page.$$eval('[data-s="accueil"] .carte', (l) =>
    l.map((e) => e.innerText).join(" "));
  verifie("la carte d'impayé se range d'un « J'ai vu », comme les autres",
    /J'ai vu/i.test(dansLesCartes), dansLesCartes.slice(0, 100));

  // Le second geste doit mener LÀ OÙ L'ON SOLDE, pas au relevé de TVA.
  verifie("le geste mène là où l'on solde",
    /Marquer payée/.test(dit) && /Noter un règlement/.test(partielle));

  const cartes = await page.$$eval('[data-s="accueil"] .carte .gestes a', (l) =>
    l.map((e) => e.getBoundingClientRect().height));
  verifie("les gestes de la carte se touchent", cartes.every((h) => h >= 16), cartes.join(" "));
} catch (e) { echecs.push("carte · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. La question : deux réponses, un coût, un exemple ─────────────────
try {
  await cadrer('[data-s="question"]');
  const choix = await page.$$eval('[data-s="question"] .choix', (l) =>
    l.map((e) => ({
      lettre: e.querySelector(".lettre")?.textContent.trim() ?? "",
      cout: e.querySelector(".cout")?.textContent.trim() ?? "",
      haut: e.getBoundingClientRect().height,
    })));
  verifie("deux réponses, et chacune porte sa lettre",
    choix.map((c) => c.lettre).join("") === "AB", choix.map((c) => c.lettre).join("|"));
  verifie("et son coût — sans quoi elle se choisit au hasard",
    choix.every((c) => c.cout.length > 3), choix.map((c) => c.cout).join(" | "));
  verifie("chaque proposition tient la cible de 44 px",
    choix.every((c) => c.haut >= 44), choix.map((c) => c.haut.toFixed(0)).join(" "));

  // **L'EXEMPLE EST CACHÉ AU REPOS, ET IL S'OUVRE.** Un dépliant mort se
  // valide sur une capture sans que personne ne s'en aperçoive.
  verifie("au repos, les exemples sont repliés",
    !(await vu('[data-s="choix-a"] .plus')) && !(await vu('[data-s="choix-b"] .plus')));
  await page.click('[data-s="choix-a"]');
  await page.waitForTimeout(220);
  verifie("touchée, la proposition A montre son exemple", await vu('[data-s="choix-a"] .plus'));
  verifie("et B reste repliée — on compare, on ne subit pas",
    !(await vu('[data-s="choix-b"] .plus')));

  // **CHAQUE RÉPONSE DIT CE QU'ELLE COINCE.** Une proposition sans son défaut
  // se choisit sur sa promesse, et le défaut se découvre après le code.
  const a = await texte('[data-s="choix-a"] .plus');
  verifie("A avoue son cas qui coince", /coince/i.test(a) && /aucun délai/i.test(a), a.slice(0, 120));
  await page.click('[data-s="choix-b"]');
  await page.waitForTimeout(220);
  const b = await texte('[data-s="choix-b"] .plus');
  verifie("B avoue le sien", /coince/i.test(b) && /60 jours/.test(b), b.slice(0, 120));

  const avis = await texte('[data-s="avis"]');
  verifie("la question porte un avis motivé",
    /ce que je ferais/i.test(avis) && avis.length > 90, avis.slice(0, 80));
} catch (e) { echecs.push("question · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Le réglage : une QUATRIÈME ligne, et elle se coupe ───────────────
try {
  await cadrer('[data-s="reglage"]');
  const lignes = await page.$$eval('[data-s="reglage"] .reg', (l) => l.length);
  verifie("le réglage s'ajoute aux rappels existants, il ne les remplace pas",
    lignes >= 3, `${lignes} ligne(s)`);

  const impayee = await texte('[data-s="reg-impayee"]');
  verifie("le délai se compte depuis l'ÉCHÉANCE, pas depuis l'envoi",
    /après l'échéance/i.test(impayee), impayee.slice(0, 120));

  const inter = await page.$eval('[data-s="reg-impayee"] .inter', (e) => {
    const r = e.getBoundingClientRect();
    return { l: r.width, h: r.height };
  });
  verifie("l'interrupteur se touche", inter.l >= 44 || inter.h >= 26, `${inter.l}×${inter.h}`);

  // Sa règle du 13 août : un interrupteur seulement là où l'éteindre ne casse
  // rien — et l'écran doit dire ce que l'on perd.
  verifie("l'écran dit ce qu'on perd en l'éteignant",
    /ne plus savoir qu'un client ne vous a pas payé/i.test(await texte('[data-s="mot-coupe"]')));

  // Un rappel qui se tairait sans délai réglé serait un rappel qu'on croit
  // allumé — exactement l'interrupteur mort que le patron a interdit.
  verifie("et le cas « aucun délai réglé » est prévu, pas silencieux",
    /pas d'échéance/i.test(await texte('[data-s="mot-sans-delai"]')));
} catch (e) { echecs.push("réglage · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3 ter. LE RYTHME — sa demande du 16 août 2026 ──────────────────────
//
// *« Je veux un rappel toutes les semaines ou tous les quinze jours, mais pas
// qu'il y ait la notification tous les jours. »* Sans ce réglage, la carte
// resterait à l'écran chaque jour jusqu'au paiement — et au bout d'une semaine
// on ne la lit plus. C'est le rappel entier qu'on perdrait.
try {
  await cadrer('[data-s="reglage"]');
  const rythme = await texte('[data-s="rythme"]');
  verifie("le rythme se règle, et ce sont SES mots",
    /semaine/i.test(rythme) && /15 jours/i.test(rythme), rythme.slice(0, 120));

  // **Trois pastilles, pas une case de saisie.** Une case inviterait à écrire
  // « 3 jours », ce qu'il vient précisément d'exclure.
  const pastilles = await page.$$eval('[data-s="rythme"] .past', (l) =>
    l.map((e) => ({ t: e.textContent.trim(), h: e.getBoundingClientRect().height })));
  verifie("le rythme se choisit entre trois, il ne se tape pas",
    pastilles.length === 3, `${pastilles.length}`);
  verifie("et une seule est prise à la fois",
    (await page.$$eval('[data-s="rythme"] .past.pris', (l) => l.length)) === 1);
  verifie("chaque pastille se touche", pastilles.every((p) => p.h >= 30),
    pastilles.map((p) => p.h.toFixed(0)).join(" "));

  await cadrer('[data-s="rythme-ecran"]');
  const chrono = await page.$$eval('[data-s="rythme-ecran"] .jour', (l) => l.length);
  verifie("la chronologie montre le rythme au lieu de le décrire", chrono >= 5, `${chrono}`);

  // **Le silence doit se VOIR.** Une chronologie qui n'afficherait que les
  // jours où il se passe quelque chose ne ferait pas sentir l'espacement —
  // c'est pourtant tout l'objet du réglage.
  verifie("les six jours de silence sont montrés, pas sous-entendus",
    /Rien\. Six jours de silence/i.test(await texte('[data-s="j-3"]')));

  // Le geste EXISTE sur la carte : sans lui, le rythme n'a rien pour démarrer.
  verifie("la carte porte le geste « J'ai vu » qui met le rythme en marche",
    (await texte('[data-s="j-ai-vu"]')) === "J'ai vu");

  // Une carte qui s'endormirait seule pourrait passer un jour sans être vue.
  verifie("l'écran dit pourquoi la carte ne s'endort pas toute seule",
    /vous ne touchez pas/i.test(await texte('[data-s="pourquoi-geste"]')));

  // Et le rythme ne doit pas faire croire que la facture a disparu.
  verifie("il rappelle que la facture reste dans l'endroit en attente",
    /endroit en attente/i.test(await texte('[data-s="fin-rythme"]')));
} catch (e) { echecs.push("rythme · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3 bis. Les pièges sont nommés, pas sous-entendus ────────────────────
try {
  await cadrer('[data-s="pieges"]');
  const pieges = await page.$$eval('[data-s="pieges"] .reg', (l) => l.length);
  verifie("les trois pièges sont écrits", pieges === 3, `${pieges}`);
  const p2 = await texte('[data-s="piege-2"]');
  verifie("le piège de l'acompte chiffre ce qu'on oublierait",
    /720/.test(p2), p2.slice(0, 140));
  const p3 = await texte('[data-s="piege-3"]');
  verifie("et celui des deux listes désigne l'endroit en attente",
    /attente/i.test(p3), p3.slice(0, 140));
} catch (e) { echecs.push("pièges · interrompu — " + String(e.message).split("\n")[0]); }

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
  // `controlerGrammaire` exige un bloc titré : l'accueil n'en porte pas, ce
  // sont des cartes. On mesure donc les deux écrans qui en ont.
  await cadrer('[data-s="question"]');
  await controlerGrammaire(page, '[data-s="question"]', verifie);
  await controlerGrammaire(page, '[data-s="reglage"]', verifie);
  await controlerRetrait(page, verifie);
} catch (e) { echecs.push("grammaire · interrompu — " + String(e.message).split("\n")[0]); }

// ── 6. La loupe est éteinte là où l'on mesure ────────────────────────────
// SANS CE CONTRÔLE, toutes les mesures ci-dessus porteraient sur un écran
// agrandi : une cible de 33 px passerait pour 44 sans que rien ne rougisse.
try {
  const w = await page.$eval('[data-s="accueil"]', (e) => e.getBoundingClientRect().width);
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

  const large = await pg.$eval('[data-s="accueil"]', (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur", !deborde);

  const props = await pg.$$(".prop");
  verifie("les cinq écrans sont capturés", props.length === 5, `${props.length}`);
  for (let i = 0; i < props.length; i++) {
    await props[i].scrollIntoViewIfNeeded();
    await pg.waitForTimeout(200);
    await props[i].screenshot({ path: `${SORTIE}/rappel-impayee-${i + 1}.png` });
  }

  // ET UNE CAPTURE L'ŒIL OUVERT. Sans elle, la planche envoyée montre trois
  // rangées de points : le geste qu'il a demandé n'y est pas visible, et il
  // devrait ouvrir la page pour le voir.
  await pg.click('[data-s="choix-a"]');
  await pg.waitForTimeout(260);
  const ouvert = await pg.$eval('[data-s="choix-a"] .plus',
    (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
  verifie("la capture du geste montre bien l'exemple déplié", ouvert);
  const co = await pg.$('[data-s="question"]');
  await co.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(200);
  await co.screenshot({ path: `${SORTIE}/rappel-impayee-2-exemple-ouvert.png` });

  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
