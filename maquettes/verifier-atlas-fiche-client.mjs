/*
  Contrôle de la planche « La fiche client, depuis l'accueil » — JavaScript
  coupé, iPhone 13, meta viewport injectée.

  CE QU'IL SURVEILLE, ET POURQUOI :

    · LA LIGNE DE L'ACCUEIL EST RECOPIÉE, PAS RÉINVENTÉE. Elle existe déjà
      (`ListeChantiers.tsx`) : grille 47 px / reste, écart de 26 px, nom en
      serif à 19 px, lieu à 11,5 px. Une ligne redessinée « à peu près » ferait
      juger un écran qui n'est pas le sien — et c'est SUR cette ligne qu'il doit
      décider où va son doigt.
    · LES DEUX QUESTIONS PORTENT UNE LETTRE, UN COÛT ET UN AVIS. Il répond par
      une lettre — « la B et 4 », « AA », « la A » — et une question sans coût
      chiffré se répond au hasard.
    · LA PLANCHE NE PROMET RIEN QUE LE CODE NE PUISSE TENIR. Elle dit en toutes
      lettres que le devis PARTI reste figé : une fiche qui laisserait croire
      qu'elle corrige un document déjà chez le client serait un mensonge, et il
      s'en apercevrait au premier essai.
    · LE CAS RÉEL EST CELUI DE SA CAPTURE : un chantier SANS client du tout,
      titré « Chantier du lundi 17 août ». Dessiner un client existant à
      corriger aurait esquivé le cas difficile — créer une fiche qui n'est pas
      là.
    · LES CIBLES SE TOUCHENT. La pastille de la proposition A est la seule cible
      neuve de cette planche : si elle passe sous 30 px, A n'est pas jouable
      sous un pouce ganté, et il faut le savoir AVANT de la choisir.

  CHACUN SAIT ÉCHOUER, et c'est vérifiable à la main : retirer « Adresse non
  renseignée » de l'écran 1 rougit le premier ; retirer un « ce qu'elle coûte »
  rougit le deuxième ; retirer la phrase sur le devis figé rougit le troisième ;
  remplacer le titre du 17 août par un nom de client rougit le quatrième ;
  rapetisser la pastille rougit le dernier.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-fiche-client.html";
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

// ── 1. L'écran 1 montre SA ligne, et son cas exact ──────────────────────
try {
  await cadrer('[data-s="ecran1"]');

  // **Le cas dessiné est celui de sa capture, et pas un cas confortable.**
  // « Chantier du lundi 17 août » est le titre qu'Atlas fabrique quand il n'y
  // a NI client NI adresse (`nom-chantier.ts`). Dessiner un client existant à
  // corriger aurait esquivé le vrai travail : créer une fiche absente.
  const a = await texte('[data-s="a1"]');
  verifie("la ligne dessinée est celle de sa capture, sans client du tout",
    /Chantier du lundi 17 août/.test(a), a.slice(0, 120));
  verifie("et elle porte la mention qu'il a lue", /Adresse non renseignée/.test(a));

  // **Les deux propositions diffèrent par le GESTE, et on compte l'ÉLÉMENT,
  // pas le mot.** Chercher « compléter » dans le texte accusait B à tort : son
  // état dit « à compléter avant d'envoyer », ce qui est exactement le contraire
  // d'un bouton. Une alerte qui accuse la bonne proposition coûte plus cher que
  // pas d'alerte (`AGENTS.md`).
  const boutonA = await page.$$eval('[data-s="a1"] .bouton', (l) => l.length);
  const boutonB = await page.$$eval('[data-s="b1"] .bouton', (l) => l.length);
  verifie("A pose un bouton sur la mention", boutonA === 1, `${boutonA} bouton(s)`);
  verifie("B n'en pose aucun — c'est toute la ligne qui mène", boutonB === 0, `${boutonB} bouton(s)`);
  // Et B doit DIRE où elle mène avant qu'on touche : sans cela, la ligne change
  // de destination en silence, ce que sa règle du 13 août interdit.
  const b = await texte('[data-s="b1"]');
  verifie("B annonce l'exception au lieu de la subir",
    /à compléter avant d'envoyer/i.test(b), b.slice(0, 160));

  // **La cible neuve se mesure.** Sous un pouce ganté, une pastille de moins
  // de 30 px ne s'attrape pas — et c'est la seule chose que A ajoute.
  const past = await page.$eval('[data-s="a1"] .bouton', (e) => {
    const r = e.getBoundingClientRect();
    return { h: r.height, l: r.width };
  }).catch(() => null);
  verifie("la pastille de A se touche pour de vrai",
    past !== null && past.h >= 32, past ? `${past.l.toFixed(0)}×${past.h.toFixed(0)}` : "absente");
} catch (e) { echecs.push("écran 1 · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. La question porte lettres, coûts et avis ─────────────────────────
try {
  // **UNE SEULE question à lettres, et c'est délibéré.** L'écran 2 ne propose
  // plus deux dictées côte à côte : la règle « elle propose, vous cochez » se
  // JOUE au doigt plus bas, et un comportement éprouvé vaut mieux que deux
  // images à comparer. La planche ne demande donc qu'une lettre — l'autre
  // question se pose en une phrase dans l'avis.
  const lettres = await page.$$eval('[data-s="ecran1"] .sous', (l) => l.map((e) => e.textContent.trim()));
  verifie("les deux propositions de l'écran 1 portent leur lettre",
    lettres.length === 2 && /^A ·/.test(lettres[0]) && /^B ·/.test(lettres[1]), lettres.join(" | "));

  // **Une proposition sans son coût se choisit sur sa promesse**, et le défaut
  // se découvre après le code.
  const couts = await page.$$eval('[data-s="ecran1"] .note .cout', (l) => l.map((e) => e.textContent.trim()));
  verifie("les deux avouent ce qu'elles coûtent", couts.length === 2, `${couts.length} coût(s)`);

  const avis1 = await texte('[data-s="avis1"]');
  const avis3 = await texte('[data-s="avis3"]');
  verifie("la question du geste porte un avis motivé",
    /ce que je ferais/i.test(avis1) && avis1.length > 120, avis1.slice(0, 90));
  verifie("et la dictée reçoit le sien, même sans lettre à donner",
    avis3.length > 120 && /coûte/i.test(avis3), avis3.slice(0, 90));

  // **L'avis doit rappeler ce qu'il a DÉJÀ tranché**, sinon il rejuge à froid
  // une question réglée ailleurs — et les deux réponses divergeront.
  verifie("l'avis du geste confronte sa règle du 13 août", /13 août/.test(avis1), avis1.slice(0, 90));
  verifie("l'avis de la dictée rappelle son choix du devis",
    /devis/i.test(avis3), avis3.slice(0, 90));
} catch (e) { echecs.push("questions · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. La fiche ne promet rien que le code ne tienne ────────────────────
try {
  await cadrer('[data-s="fiche"]');
  const f = await texte('[data-s="fiche-prop"]');

  // Cinq champs, et ce sont ceux du devis. En inventer un ferait valider un
  // formulaire dont la moitié n'a nulle part où aller en base.
  const champs = await page.$$eval('[data-s="fiche-prop"] .champ .et', (l) =>
    l.map((e) => e.textContent.trim()));
  verifie("la fiche porte cinq champs, ni plus ni moins",
    champs.length === 5, champs.join(" | "));
  verifie("et ce sont ceux que le devis imprime",
    /Civilité et nom/.test(champs.join("|")) && /Adresse/.test(champs.join("|")) &&
    /Téléphone/.test(champs.join("|")) && /E-mail/.test(champs.join("|")), champs.join(" | "));

  // **L'adresse des travaux est la DERNIÈRE et vide par défaut.** La demander
  // d'office ferait taper deux fois la même adresse — le défaut qu'il a signalé
  // le 6 août sur le devis.
  verifie("l'adresse du chantier vient en dernier, et vide par défaut",
    champs[4] === "Adresse du chantier" && /Vide = la même/.test(f), champs.join(" | "));

  // Le micro qu'il a demandé — « par la dictée ou par l'écrit ».
  const micro = await page.$eval('[data-s="fiche-prop"] .micro', (e) => {
    const r = e.getBoundingClientRect();
    return { h: r.height, l: r.width };
  }).catch(() => null);
  verifie("le micro est là, et se touche",
    micro !== null && micro.h >= 40 && micro.l >= 40,
    micro ? `${micro.l.toFixed(0)}×${micro.h.toFixed(0)}` : "absent");

  // **LE CONTRÔLE QUI PORTE LA PLANCHE.** Un devis parti est immuable. Une
  // fiche qui laisserait croire qu'elle le corrige serait un mensonge, et il
  // s'en apercevrait au premier essai — après avoir compté sur elle.
  const fin = await texte(".fin");
  verifie("la planche dit que le devis PARTI reste figé",
    /figé/i.test(fin) && /prochaine version/i.test(fin), fin.slice(0, 160));
  verifie("et qu'aucune dictée ne sait encore lire un nom ou une adresse",
    /aucune ne sait lire un nom ou une adresse/i.test(fin), fin.slice(0, 200));
} catch (e) { echecs.push("fiche · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3 bis. LES GESTES BOUGENT POUR DE BON ───────────────────────────────
//
// **Sa demande du 17 août : « fais-moi des maquettes DYNAMIQUES ».** Une
// planche qu'on annonce touchable et qui ne bouge pas se valide sur une
// capture, et le défaut ne paraît qu'entre ses mains. Chaque geste promis est
// donc joué ici, et son effet MESURÉ — pas supposé.
try {
  // 1. La fiche est cachée au repos, et arrive quand on touche la cible.
  const positionA = async () =>
    page.$eval('[data-s="a1"] .vue-fiche', (e) => Math.round(e.getBoundingClientRect().left));
  const gaucheEcran = await page.$eval('[data-s="a1"] .ecran', (e) => Math.round(e.getBoundingClientRect().left));
  verifie("au repos, la fiche est hors de l'écran", (await positionA()) > gaucheEcran + 100,
    `${await positionA()} contre ${gaucheEcran}`);

  // **SUR A, LE NOM DU CHANTIER NE FAIT RIEN — et c'est le sujet même de la
  // question.** S'il répondait, A et B seraient la même chose et il
  // trancherait entre deux propositions identiques.
  await page.click('[data-s="a1"] .brin h2');
  await page.waitForTimeout(500);
  verifie("A : toucher le nom du chantier ne fait rien, il faut viser",
    (await positionA()) > gaucheEcran + 100, `${await positionA()}`);

  await page.click('[data-s="a1"] .bouton');
  await page.waitForTimeout(600);
  verifie("A : la pastille fait bien venir la fiche",
    Math.abs((await positionA()) - gaucheEcran) < 6, `${await positionA()} contre ${gaucheEcran}`);

  // Et le retour la renvoie d'où elle vient : un aller sans retour enferme.
  await page.click('[data-s="a1"] .retour');
  await page.waitForTimeout(600);
  verifie("A : le retour renvoie la fiche d'où elle vient",
    (await positionA()) > gaucheEcran + 100, `${await positionA()}`);

  // 2. Sur B, c'est toute la ligne — y compris le nom.
  const positionB = async () =>
    page.$eval('[data-s="b1"] .vue-fiche', (e) => Math.round(e.getBoundingClientRect().left));
  const gaucheB = await page.$eval('[data-s="b1"] .ecran', (e) => Math.round(e.getBoundingClientRect().left));
  await page.click('[data-s="b1"] .brin.mene h2');
  await page.waitForTimeout(600);
  verifie("B : toucher le nom du chantier suffit",
    Math.abs((await positionB()) - gaucheB) < 6, `${await positionB()} contre ${gaucheB}`);
} catch (e) { echecs.push("gestes écran 1 · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3 ter. LA DICTÉE : elle PROPOSE, et ne reporte que le coché ─────────
//
// **C'est la règle même qu'il doit juger**, et une planche qui la décrirait
// sans la jouer lui ferait valider une phrase au lieu d'un comportement.
try {
  await cadrer('[data-s="fiche"]');
  verifie("au repos, la dictée est fermée", !(await vu('[data-s="dictee"]')));

  await page.click('[data-s="fiche-prop"] .micro');
  await page.waitForTimeout(400);
  verifie("le micro ouvre ce qu'elle a compris", await vu('[data-s="dictee"]'));

  // Les champs restent VIDES tant que rien n'est reporté : une dictée qui
  // remplirait d'office serait la proposition inverse.
  verifie("avant de reporter, les champs sont vides",
    !(await vu('[data-s="fiche-prop"] .v-nom .plein')));

  // **Le geste qui porte la question : on DÉCOCHE, puis on reporte.**
  await page.click('[data-s="fiche-prop"] .k-tel');
  await page.waitForTimeout(260);
  await page.click('[data-s="fiche-prop"] .valider');
  await page.waitForTimeout(500);

  verifie("reporté, le nom coché arrive dans son champ",
    await vu('[data-s="fiche-prop"] .v-nom .plein'));
  verifie("et l'adresse cochée aussi",
    await vu('[data-s="fiche-prop"] .v-adr .plein'));
  // **LE CONTRÔLE QUI PORTE L'ÉCRAN 2.** Si le décoché arrivait quand même,
  // la planche montrerait « elle remplit » en prétendant montrer « elle
  // propose » — et il trancherait sur un écran qui ment.
  verifie("MAIS le téléphone décoché reste vide — « elle propose » tient",
    !(await vu('[data-s="fiche-prop"] .v-tel .plein')),
    await texte('[data-s="fiche-prop"] .v-tel'));

  // Le panneau se referme et dit ce qu'il a fait : sinon le résultat est caché
  // derrière le panneau qui l'a produit.
  verifie("le panneau laisse un mot au lieu de rester ouvert",
    await vu('[data-s="fiche-prop"] .apres'));
} catch (e) { echecs.push("gestes dictée · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. La loupe : les mesures ci-dessus sont celles de SON écran ────────
try {
  const w = await page.$eval('[data-s="a1"] .ecran', (e) => e.getBoundingClientRect().width);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    w <= 390, `${w.toFixed(0)} px`);
  verifie("et l'écran fait bien 390 px, pas ce qui reste après la coque",
    w >= 390, `${w.toFixed(0)} px`);
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le gros plan, et les captures ────────────────────────────────────
try {
  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);

  const large = await pg.$eval('[data-s="a1"] .ecran', (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);

  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur", !deborde);

  const props = await pg.$$(".prop");
  verifie("les trois écrans sont capturés", props.length === 3, `${props.length}`);
  for (let i = 0; i < props.length; i++) {
    await props[i].scrollIntoViewIfNeeded();
    await pg.waitForTimeout(200);
    await props[i].screenshot({ path: `${SORTIE}/fiche-client-${i + 1}.png` });
  }
  // **ET DES CAPTURES DES ÉTATS, PAS SEULEMENT DU REPOS.** Sans elles, la
  // planche envoyée montre trois écrans immobiles : le geste qu'il a demandé
  // n'y est pas visible, et il devrait ouvrir la page pour le voir. La leçon
  // vient de `verifier-atlas-rappel-facture-impayee`, qui l'a payée avant.
  await pg.click('[data-s="b1"] .brin.mene h2');
  await pg.waitForTimeout(700);
  const arrivee = await pg.$eval('[data-s="b1"] .vue-fiche', (e) => Math.round(e.getBoundingClientRect().left));
  const bordB = await pg.$eval('[data-s="b1"] .ecran', (e) => Math.round(e.getBoundingClientRect().left));
  verifie("la capture du geste montre la fiche ARRIVÉE, pas en route",
    Math.abs(arrivee - bordB) < 8, `${arrivee} contre ${bordB}`);
  const vueB = await pg.$('[data-s="b1"] .tel');
  await vueB.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(200);
  await vueB.screenshot({ path: `${SORTIE}/fiche-client-4-fiche-ouverte.png` });

  await pg.click('[data-s="fiche-prop"] .micro');
  await pg.waitForTimeout(400);
  const dictee = await pg.$('[data-s="fiche-prop"] .tel');
  await dictee.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(250);
  await dictee.screenshot({ path: `${SORTIE}/fiche-client-5-dictee.png` });

  await pg.click('[data-s="fiche-prop"] .k-tel');
  await pg.waitForTimeout(260);
  await pg.click('[data-s="fiche-prop"] .valider');
  await pg.waitForTimeout(600);
  const resteVide = !(await pg.$eval('[data-s="fiche-prop"] .v-tel .plein',
    (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false));
  verifie("et celle du report montre bien le téléphone RESTÉ vide", resteVide);
  await dictee.screenshot({ path: `${SORTIE}/fiche-client-6-reporte.png` });

  await grand.close();
} catch (e) { echecs.push("gros plan · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
