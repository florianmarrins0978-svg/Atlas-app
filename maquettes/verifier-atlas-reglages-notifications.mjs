/*
  Contrôle des notifications — JavaScript coupé, iPhone 13, meta viewport
  injectée.

  Le sujet n'est pas l'allure, ce sont QUATRE RÈGLES :

    · LES HUIT FAMILLES QU'IL A CITÉES SONT TOUTES LÀ, groupées par ce qu'elles
      servent — huit interrupteurs à la file font une liste qu'on parcourt sans
      lire, et l'argent vient en premier.
    · LA PHRASE EXACTE EST MONTRÉE, pas décrite. « Une alerte d'impayé » ne se
      juge pas ; « Facture Martin, 1 240 €, en retard depuis 7 jours », si.
    · CE QUI N'EXISTE PAS EST DIT. Une seule famille fonctionne aujourd'hui, et
      rien ne part hors de l'application. Le taire ferait croire à un produit
      qui n'est pas là (`CLAUDE.md` §5).
    · PAS DE SMS, ET L'ÉCRAN DIT POURQUOI. Il a été écarté le 4 août 2026
      (`docs/A-FAIRE.md` §5) ; le porter comme « bientôt » serait promettre ce
      qui a été refusé.

  Chacune sait échouer : retirer une famille rougit la première, remplacer la
  phrase par sa description rougit la deuxième, effacer la réserve rougit la
  troisième, ajouter une pastille « SMS » rougit la quatrième.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { controlerCharte, controlerGrammaire, controlerRetrait } from "./charte.mjs";

const FICHIER = process.argv[2] || "maquettes/atlas-reglages-notifications.html";
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

const FAM = '[data-s="familles"]', DET = '[data-s="detail"]', SIL = '[data-s="silence"]';
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}).catch(() => null);
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const cadrer = async (s) => { await (await page.$(s)).scrollIntoViewIfNeeded(); await page.waitForTimeout(240); };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 1. Les huit familles, groupées, l'argent en premier ──────────────────
try {
  await cadrer(FAM);
  const groupes = await page.$$eval(`${FAM} .bloc .t`, (l) => l.map((e) => e.textContent.trim()));
  verifie("trois groupes, et l'argent en premier",
    groupes.length === 3 && /argent/i.test(groupes[0]), groupes.join(" | "));

  const familles = await page.$$eval(`${FAM} .reg .nom`, (l) => l.map((e) => e.textContent.trim()));
  verifie("les huit familles qu'il a citées sont là", familles.length === 8, `${familles.length}`);
  // Chacune de ses huit demandes, retrouvée par son mot-clé.
  const attendus = ["impayé", "devis", "échéance", "lendemain", "déplacé", "facturé",
                    "relancer", "affectation"];
  const manquants = attendus.filter((m) =>
    !familles.some((f) => new RegExp(m, "i").test(f)));
  verifie("planning, devis, facture, impayé, relance, équipe, déplacement, à facturer",
    manquants.length === 0, `manque : ${manquants.join(", ")}`);

  // Le canal se lit SUR la ligne : une grille famille × canal serait illisible.
  const canaux = await page.$$eval(`${FAM} .reg .canal`, (l) => l.map((e) => e.textContent.trim()));
  verifie("chaque ligne dit par où elle arrive", canaux.length === 8, `${canaux.length}`);
  verifie("et jamais par SMS — il a été écarté le 4 août",
    !canaux.some((c) => /sms/i.test(c)), canaux.join(" | "));

  // CE QUI N'EXISTE PAS EST DIT.
  const etat = await txt(`${FAM} [data-s="etat"]`);
  verifie("l'écran dit qu'une seule famille existe aujourd'hui",
    /une seule/i.test(etat), etat.slice(0, 60));
  verifie("et que rien ne part encore sur le téléphone",
    /rien ne part/i.test(etat), etat.slice(0, 120));
  await (await page.$(FAM)).screenshot({ path: `${SORTIE}/reglages-notifications.png` });
} catch (e) { echecs.push("familles · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. La phrase exacte, et l'alerte qui coûte de l'argent ───────────────
try {
  await cadrer(DET);
  const phrase = await txt(`${DET} [data-s="exemple"] .quoi`);
  // MONTRÉE, PAS DÉCRITE : elle porte un nom, un montant et un délai.
  verifie("la phrase exacte est montrée, avec un montant et un délai",
    /€/.test(phrase) && /\d+ jours/.test(phrase), phrase);
  verifie("et non une description de l'alerte", !/alerte|notification/i.test(phrase), phrase);

  const canaux = await page.$$eval(`${DET} [data-s="canaux"] span`, (l) =>
    l.map((e) => e.textContent.trim()));
  verifie("deux canaux, et deux seulement",
    canaux.length === 2, canaux.join(" | "));
  verifie("aucun SMS proposé", !canaux.some((c) => /sms/i.test(c)), canaux.join(" | "));
  const dit = await txt(`${DET} [data-s="pas-sms"]`);
  verifie("et l'écran dit pourquoi il n'y en a pas", /SMS/i.test(dit) && /abonnement|centimes/i.test(dit),
    dit.slice(0, 80));

  // Elle se coupe — pas de verrou — mais elle prévient.
  const cout = await txt(`${DET} [data-s="cout"]`);
  verifie("l'alerte d'impayé se coupe, et prévient de ce qu'on y perd",
    /se coupe/i.test(cout) && /payé/i.test(cout), cout.slice(0, 80));
  const verrou = await page.$$eval(`${DET} .oblig`, (l) => l.length);
  verifie("aucune notification n'est verrouillée", verrou === 0, `${verrou}`);
  await (await page.$(DET)).screenshot({ path: `${SORTIE}/reglages-notifications-detail.png` });
} catch (e) { echecs.push("détail · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Tout éteint : ce que le silence ne coupe PAS ──────────────────────
try {
  await cadrer(SIL);
  const eteints = await page.$$eval(`${SIL} .reg`, (l) =>
    l.filter((e) => !e.querySelector(".interrupteur").checked).length);
  verifie("tout est éteint sur cet écran", eteints > 0, `${eteints}`);

  // SANS CETTE PHRASE, il croira avoir tout perdu et rallumera au hasard.
  const reste = await txt(`${SIL} [data-s="reste"]`);
  verifie("l'écran dit que rien n'est perdu", /perdez rien|ne perdez/i.test(reste), reste.slice(0, 60));
  verifie("et que l'accueil continue de tout porter", /accueil/i.test(reste));
  const pourquoi = await txt(`${SIL} [data-s="pourquoi-silence"]`);
  verifie("le silence est présenté comme un choix, pas une panne",
    /choix/i.test(pourquoi) && /panne/i.test(pourquoi), pourquoi.slice(0, 60));
  await (await page.$(SIL)).screenshot({ path: `${SORTIE}/reglages-notifications-silence.png` });
} catch (e) { echecs.push("silence · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. La grammaire des écrans, et les cibles ────────────────────────────
try {
  for (const [nom, sel] of [["familles", FAM], ["détail", DET], ["silence", SIL]]) {
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

  await cadrer(FAM);
  await controlerGrammaire(page, FAM, verifie);
  await controlerRetrait(page, verifie);

  const petites = await page.$$eval(".ecran .bat, .ecran .past span", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .filter((e) => e.getBoundingClientRect().height < 36)
     .map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 30)));
  verifie("aucune ligne ni pastille trop basse pour le doigt", petites.length === 0, petites.join(" | "));
  const grosses = await page.$$eval('.ecran input[type="checkbox"]', (l) =>
    l.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 || r.height > 2; }).length);
  verifie("aucune case native visible", grosses === 0, `${grosses}`);

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
  const coupe = await page.$$eval(".ecran .corps", (l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  verifie("aucun écran ne déborde sur le côté", coupe === 0, `${coupe}`);
} catch (e) { echecs.push("mise en page · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. La loupe : éteinte sur téléphone, allumée en gros plan ────────────
try {
  const t = await rect(FAM);
  verifie("sur téléphone, la loupe est éteinte — les mesures ci-dessus sont vraies",
    t.w <= 390, `${t.w.toFixed(0)} px de large`);

  const grand = await nav.newContext({ viewport: { width: 1600, height: 1200 }, colorScheme: "light" });
  const pg = await grand.newPage();
  await pg.goto("file://" + path.resolve(ESSAI));
  await pg.waitForTimeout(300);
  const large = await pg.$eval(FAM, (e) => e.getBoundingClientRect().width);
  verifie("sur grand écran, la loupe agrandit pour de bon", large > 520, `${large.toFixed(0)} px`);
  const hauteurs = await pg.$$eval(".prop", (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  verifie("une planche par rangée, et non trois de front",
    new Set(hauteurs).size === hauteurs.length, hauteurs.join(" | "));
  const deborde = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("rien ne déborde en largeur, en gros plan", !deborde);
  await (await pg.$(".prop")).screenshot({ path: `${SORTIE}/reglages-notifications-gros-plan.png` });
  await grand.close();
} catch (e) { echecs.push("loupe · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
