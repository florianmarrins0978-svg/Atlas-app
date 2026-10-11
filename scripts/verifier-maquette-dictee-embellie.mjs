#!/usr/bin/env node
/*
  Éprouve `appli/dictee-embellie.html` — la dictée de la fiche chantier, quatre
  allures à essayer.

  **D'où elle vient.** Sa demande du 31 août 2026, capture à l'appui :
  *« propose-moi une maquette pour embellir cette partie de la fiche chantier,
  je trouve que ça dénature l'appli. Code rien, je veux un visuel que je peux
  essayer en .html »*

  ───────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE TIENT, ET POURQUOI CHAQUE POINT EST LÀ.

  1. **Au repos, le micro et rien d'autre.** Ni poubelle ni avion avant qu'on
     ait parlé : deux gestes offerts d'avance sont deux questions posées à
     quelqu'un qui n'a rien dit. Et le repos est le MÊME dans les cinq — s'il
     changeait d'une allure à l'autre, il choisirait sur autre chose que ce
     qu'on lui demande de trancher.

  2. **Les deux gestes existent dans les quatre propositions** : jeter et
     envoyer. Une proposition qui n'en porterait qu'un ne serait pas une
     proposition.

  3. **Le chrono avance pour de vrai, et la pause l'arrête pour de vrai** —
     mesuré sur des secondes réelles, jamais déduit d'une classe CSS.

  4. **Jeter remet à zéro et ne mène nulle part** : on revient au repos, et la
     dictée suivante repart de 0:00 — vérifié en redictant, pas en lisant une
     classe. C'est le garde-fou : arrêter n'est pas envoyer.

  5. **LE POINT CENTRAL, ET IL SE MESURE : l'aplat sombre.** Sa plainte n'est
     pas un goût, c'est une surface. Pendant la dictée, l'écran d'aujourd'hui
     porte deux aplats vert pin — 76 px et 46 px — là où le reste de la fiche
     n'en porte aucun. Le contrôle additionne la surface de tout ce qui est
     peint en plein, et exige que **chaque proposition en porte moins que
     l'existant**, et que la 2 (« l'anneau ») n'en porte **aucun**.

     Sans ce point, on pourrait livrer quatre variations qui déplacent le
     problème sans le régler, et le contrôle serait vert.

  6. **Rien ne déborde en largeur.** Sa règle du 30 août — *« l'écran ne doit
     plus pouvoir se balader de droite à gauche »*. Les ondes de repos sont
     posées en absolu de part et d'autre du disque, et un élément absolu compte
     dans le débordement d'une page.

  7. **Aucune boîte de zéro pixel.** Une mesure prise sur une boîte vide rend
     zéro, et `0 − 0 = 0` passerait pour un succès (`CLAUDE.md` §5). Chaque
     mesure refuse de conclure sur du vide.

  8. **Aucune flèche décorative** (`CLAUDE.md` §3). L'avion en papier n'en est
     pas une : il EST le bouton.

  9. **Les deux teintes**, et des captures des deux : sur Nuit l'aplat
     s'inverse — un `#faf9f5` posé sur `--pine` serait juste ici et illisible
     là-bas.

  Usage : node scripts/verifier-maquette-dictee-embellie.mjs [dossier-captures]
*/
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "appli", "dictee-embellie.html");
const CAPTURES = process.argv[2] ?? null;
if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });

const ALLURES = [
  { n: 0, nom: "Aujourd'hui" },
  { n: 1, nom: "La barre" },
  { n: 2, nom: "L'anneau" },
  { n: 3, nom: "La ligne" },
  { n: 4, nom: "Le galet" },
];

// ─── 8. Aucune flèche décorative, avant même d'ouvrir un navigateur ────────
const source = readFileSync(FICHIER, "utf8");
const FLECHES = /[→←↑↓⇒⇐➔⟶▸▶◂◀]/u;
assert.ok(!FLECHES.test(source), "Une flèche décorative s'est glissée dans la planche.");

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const page = await navigateur.newPage({ viewport: { width: 390, height: 860 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => {
  console.error("La planche a levé une erreur :", e.message);
  process.exitCode = 1;
});
await page.goto("file://" + FICHIER);
await page.waitForLoadState("networkidle");

const visible = (sel) => page.locator(sel).first().isVisible();

/** La surface peinte en plein, en px². Ce qui est peint mais invisible ne
 *  compte pas — sinon les quatre propositions cachées s'additionneraient. */
async function surfacePleine() {
  return page.evaluate(() => {
    const fond = getComputedStyle(document.body).backgroundColor;
    let total = 0;
    for (const el of document.querySelectorAll(".zone *")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0") continue;
      const bg = s.backgroundColor;
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent" || bg === fond) continue;
      // On ne compte que les vrais aplats : un fond crème ou papier n'assombrit
      // rien, c'est la teinte des cartes de toute l'application.
      const [r0, g0, b0] = bg.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const clarte = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
      const fondClair = (() => {
        const [fr, fg, fb] = fond.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
        return (0.2126 * fr + 0.7152 * fg + 0.0722 * fb) / 255 > 0.5;
      })();
      // Un aplat, c'est ce qui tranche avec le fond : sombre sur clair, clair
      // sur sombre. La règle vaut donc dans les deux teintes.
      const tranche = fondClair ? clarte < 0.45 : clarte > 0.55;
      if (!tranche) continue;
      total += r.width * r.height;
    }
    return Math.round(total);
  });
}

async function pasDeDebordement(quand) {
  const trop = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert.ok(trop <= 0, `L'écran se balade de droite à gauche (${trop} px de trop) — ${quand}.`);
}

async function choisir(n) {
  await page.locator(`.onglets [data-v="${n}"]`).click();
  assert.equal(await page.evaluate(() => document.body.dataset.variante), String(n));
}

async function chrono() {
  const t = await page.locator(`.v${await page.evaluate(() => document.body.dataset.variante)} [data-chrono]`).first().textContent();
  return t.trim();
}

// ─── 1. Au repos : le micro, et rien d'autre ──────────────────────────────
assert.equal(await page.evaluate(() => document.body.dataset.etat), "repos");
assert.ok(await visible(".micro-plein"), "Le micro du repos ne s'affiche pas.");
assert.ok(!(await visible(".jeter")), "La poubelle est offerte avant qu'on ait parlé.");
assert.ok(!(await visible(".envoyer")), "L'avion est offert avant qu'on ait parlé.");
{
  // 7. Refuser de conclure sur une boîte de zéro pixel.
  const b = await page.locator(".micro-plein").first().boundingBox();
  assert.ok(b && b.width > 40 && b.height > 40, "Le micro mesure une boîte vide : rien n'est mesurable.");
}
await pasDeDebordement("au repos");
const pleinAuRepos = await surfacePleine();
assert.ok(pleinAuRepos > 3000, "Le repos ne porte plus son micro plein — la comparaison n'aurait plus de sens.");

const surfaces = {};
for (const { n, nom } of ALLURES) {
  await choisir(n);
  assert.equal(await page.evaluate(() => document.body.dataset.etat), "repos",
    `Changer d'onglet a lancé une dictée (${nom}).`);

  // ─── On entre par où LE PATRON entre : on appuie sur le micro ───────────
  await page.locator("#repos .micro-plein").click();
  assert.equal(await page.evaluate(() => document.body.dataset.etat), "dicte",
    `Appuyer sur le micro ne lance pas la dictée (${nom}).`);

  // 2. Les deux gestes existent.
  assert.ok(await visible(`.v${n} .jeter`), `Pas de poubelle dans « ${nom} ».`);
  assert.ok(await visible(`.v${n} .envoyer`), `Pas d'avion dans « ${nom} ».`);

  // 3. Le chrono avance pour de vrai.
  await page.waitForTimeout(2200);
  const apres = await chrono();
  assert.ok(/^0:0[23]$/.test(apres), `Le chrono n'a pas avancé en deux secondes (${nom}) : ${apres}`);

  // L'onde porte de vrais barreaux, et ils ne sont pas tous à plat.
  const onde = await page.evaluate((v) => {
    const o = document.querySelector(`.v${v} [data-onde]`);
    const hauteurs = [...o.children].map((i) => i.getBoundingClientRect().height);
    return { largeur: o.getBoundingClientRect().width, n: hauteurs.length, max: Math.max(...hauteurs, 0) };
  }, n);
  assert.ok(onde.largeur > 40, `L'onde de « ${nom} » n'a pas de largeur : rien n'est mesurable.`);
  assert.ok(onde.n >= 8, `L'onde de « ${nom} » n'a que ${onde.n} barreaux.`);
  assert.ok(onde.max > 3, `L'onde de « ${nom} » est plate : elle ne montre rien.`);

  await pasDeDebordement(`pendant la dictée (${nom})`);

  // 5. La surface d'aplat, pendant la dictée.
  surfaces[n] = await surfacePleine();

  // 3 bis. La pause arrête vraiment le chrono.
  await page.locator(`.v${n} .stop`).click();
  assert.equal(await page.evaluate(() => document.body.dataset.etat), "pause",
    `L'objet n'a pas mis la dictée en pause (${nom}).`);
  const fige = await chrono();
  await page.waitForTimeout(1600);
  assert.equal(await chrono(), fige, `Le chrono court encore en pause (${nom}).`);
  await page.locator(`.v${n} .stop`).click();

  // 4. Jeter remet à zéro, et le bouton revient.
  await page.locator(`.v${n} .jeter`).click();
  assert.equal(await page.evaluate(() => document.body.dataset.etat), "repos",
    `Jeter ne ramène pas au repos (${nom}).`);
  // Et la dictée suivante repart bien de zéro : un chrono qui reprendrait où il
  // s'est arrêté ferait croire à une note jetée qui vit encore.
  await page.locator("#repos .micro-plein").click();
  assert.ok(/^0:0[01]$/.test(await chrono()), `Le chrono ne repart pas de zéro après un jet (${nom}).`);
  await page.locator(`.v${n} .jeter`).click();

  // L'envoi mène à la transcription — et pas ailleurs.
  await page.locator("#repos .micro-plein").click();
  await page.locator(`.v${n} .envoyer`).click();
  assert.equal(await page.evaluate(() => document.body.dataset.etat), "envoi",
    `L'avion n'envoie pas (${nom}).`);
  assert.ok(await visible("#attente"), `Rien ne dit que la transcription est en cours (${nom}).`);
  assert.equal((await page.locator("#attente span").first().textContent()).trim(), "Transcription");
  await page.waitForTimeout(2600);
  assert.equal(await page.evaluate(() => document.body.dataset.etat), "repos",
    `La planche reste bloquée sur l'attente (${nom}).`);

  if (CAPTURES) {
    await page.locator("#repos .micro-plein").click();
    // Assez longtemps pour que le chrono ait bougé : une capture figée sur
    // « 0:00 » ne dit pas si l'objet vit.
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(CAPTURES, `dictee-${n}-clair.png`), fullPage: false });
    await page.locator(`.v${n} .jeter`).click();
  }
}

// ─── 5. L'APLAT : chaque proposition en porte moins que l'existant ────────
console.log("Surface peinte en plein, pendant la dictée (px²) :");
for (const { n, nom } of ALLURES) console.log(`  ${n} · ${nom.padEnd(12)} ${surfaces[n]}`);

assert.ok(surfaces[0] > 5000, `L'existant ne porte plus ses deux aplats (${surfaces[0]} px²) : la comparaison ne prouverait rien.`);
for (const { n, nom } of ALLURES.slice(1)) {
  assert.ok(
    surfaces[n] < surfaces[0],
    `« ${nom} » porte autant d'aplat que l'existant (${surfaces[n]} contre ${surfaces[0]} px²) : elle déplace le défaut sans le régler.`
  );
}
// « L'anneau » ne garde en plein que le carré d'arrêt (15 px) et la pastille du
// chrono (8 px) — 289 px², soit un vingt-septième de l'existant. Le seuil est
// posé au-dessus de ces deux signes et EN DESSOUS du plus petit disque de la
// planche (42 px, 1 764 px²) : un aplat qui reviendrait le ferait rougir.
assert.ok(
  surfaces[2] <= 400,
  `« L'anneau » ne doit garder en plein que le carré d'arrêt et la pastille, elle porte ${surfaces[2]} px².`
);

// ─── 9. La teinte sombre : l'aplat s'inverse, et il reste lisible ─────────
await page.locator("#teinte").click();
assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), "dark");
for (const { n, nom } of ALLURES) {
  await choisir(n);
  await page.locator("#repos .micro-plein").click();
  await page.waitForTimeout(1400);
  const sombre = await surfacePleine();
  if (n !== 2) {
    assert.ok(sombre > 0, `En nuit, « ${nom} » n'a plus aucun aplat : l'envoi a disparu dans le fond.`);
  }
  // Le contraste de l'envoi, là où il existe : un geste qu'on ne voit pas n'existe pas.
  if (n !== 2) {
    const ok = await page.evaluate((v) => {
      const b = document.querySelector(`.v${v} .envoyer`);
      const s = getComputedStyle(b);
      const lum = (c) => {
        const [r, g, bl] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((x) => {
          const u = x / 255;
          return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      const a = lum(s.backgroundColor), c = lum(s.color);
      return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
    }, n);
    assert.ok(ok >= 4.5, `En nuit, l'avion de « ${nom} » tient ${ok.toFixed(2)} de contraste.`);
  }
  await pasDeDebordement(`en nuit (${nom})`);
  if (CAPTURES) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(CAPTURES, `dictee-${n}-nuit.png`) });
  }
  await page.locator(`.v${n} .jeter`).click();
}

await navigateur.close();
if (process.exitCode) process.exit(process.exitCode);
console.log("\nLa planche tient : cinq allures, deux teintes, aucun débordement.");
