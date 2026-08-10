/*
  Contrôle de l'accès à la note vocale — JavaScript coupé, iPhone 13.

  Une icône sans texte se juge sur trois choses, et aucune ne se lit dans le
  code : sa PLACE (entre le pavé et le tiroir), sa PRISE (ce que le doigt
  atteint, pas ce que le trait dessine), et son NOM pour qui ne la voit pas.
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] ||
  "maquettes/atlas-note-vocale.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("aucun href javascript:", !/javascript:/i.test(source));

// Contrôle de source, pas de navigateur : Chromium active un <label> sans
// `cursor:pointer`, Safari sur iPhone non. Aucun essai ici ne peut voir le
// défaut — seule la lecture du style le peut.
{
  const styles = source.split("</style>")[0];
  const global = /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(styles);
  verifie("les libellés portent cursor:pointer (Safari l'exige)", global);
}

const ESSAI = FICHIER.replace(/\.html$/, "-essai.html");
fs.writeFileSync(ESSAI, '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + source);

// Le navigateur de Playwright n'est pas téléchargé ici ; celui déjà installé
// fait l'affaire. CHROMIUM_BIN=playwright rend la main à Playwright.
const nav = await chromium.launch(
  process.env.CHROMIUM_BIN === "playwright"
    ? {}
    : { executablePath: process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium" }
);
const ctx = await nav.newContext({ ...devices["iPhone 13"], javaScriptEnabled: false, colorScheme: "light" });
const page = await ctx.newPage();
await page.goto("file://" + path.resolve(ESSAI));

const ECRANS = ["v"];
const rect = async (s) => page.$eval(s, (e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}).catch(() => null);

fs.mkdirSync(SORTIE, { recursive: true });
for (const s of ECRANS) {
  const el = await page.$(`[data-s="${s}"]`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await el.screenshot({ path: `${SORTIE}/final-note-${s}.png` });
}

for (const s of ECRANS) {
  try {
    const S = s.toUpperCase();
    const ec = `[data-s="${s}"]`;
    // `elementFromPoint` travaille en coordonnées de FENÊTRE : sans amener
    // l'écran devant, on sonde un point qui n'y est pas et tout revient vide.
    await (await page.$(ec)).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);

    // 1) Aucun texte visible dans l'icône, mais un nom pour qui ne la voit pas.
    const dedans = await page.$eval(`${ec} .anneaux`, (e) => e.innerText.trim());
    verifie(`${S} · aucun libellé visible`, dedans === "", `« ${dedans} »`);
    const nom = await page.$eval(`${ec} .anneaux`, (e) => e.getAttribute("aria-label") || "");
    verifie(`${S} · elle porte un nom accessible`, /note vocale/i.test(nom), nom);

    // 2) Sa place : après le pavé, avant le tiroir, et centrée.
    const calme = await rect(`${ec} .calme`);
    const icone = await rect(`${ec} .anneaux`);
    const tiroir = await rect(`${ec} .prise`);
    const scene = await rect(`${ec} .scene`);
    verifie(`${S} · elle est sous le pavé`, icone.y >= calme.y + calme.h - 1,
      `${(icone.y - (calme.y + calme.h)).toFixed(0)} px`);
    verifie(`${S} · elle est au-dessus du tiroir`, icone.y + icone.h <= tiroir.y + 1,
      `${(tiroir.y - (icone.y + icone.h)).toFixed(0)} px de dégagement`);
    verifie(`${S} · elle est centrée`, Math.abs(icone.cx - scene.cx) < 2,
      `${(icone.cx - scene.cx).toFixed(1)} px hors axe`);

    // 3) Sa prise : ce que le doigt atteint, pas ce que le trait dessine.
    verifie(`${S} · la prise vaut au moins 44 px`, icone.w >= 44 && icone.h >= 44,
      `${icone.w.toFixed(0)} × ${icone.h.toFixed(0)} px`);
    const dessin = await rect(`${ec} .anneaux`);
    const dedansCible =
      dessin.cx > icone.x && dessin.cx < icone.x + icone.w &&
      dessin.cy > icone.y && dessin.cy < icone.y + icone.h;
    verifie(`${S} · le dessin est dans sa propre cible`, dedansCible,
      `dessin (${dessin.cx.toFixed(0)},${dessin.cy.toFixed(0)}) cible ${icone.x.toFixed(0)}–${(icone.x + icone.w).toFixed(0)}`);
    // Le point du milieu doit bien atteindre le lien, pas le paragraphe voisin.
    const atteint = await page.$eval(`${ec} .anneaux`, (e) => {
      const r = e.getBoundingClientRect();
      const cible = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!cible && (cible === e || e.contains(cible));
    });
    verifie(`${S} · le doigt tombe bien dessus`, atteint);

    // 4) Du vert, du doré, et trois traits — la consigne, vérifiée à la lettre.
    const vert = await page.$eval(`${ec} .vert`, (e) => {
      const c = getComputedStyle(e);
      return { bord: c.borderColor, fond: c.backgroundColor, w: Math.round(e.getBoundingClientRect().width) };
    });
    const or = await page.$eval(`${ec} .or`, (e) => {
      const c = getComputedStyle(e);
      return { bord: c.borderColor, w: Math.round(e.getBoundingClientRect().width) };
    });
    verifie(`${S} · le cercle vert est du vert profond`,
      /42, 58, 46/.test(vert.bord) || /42, 58, 46/.test(vert.fond), `${vert.bord} / ${vert.fond}`);
    verifie(`${S} · le cercle doré est bronze ou or`,
      /143, 113, 48|194, 160, 95/.test(or.bord), or.bord);
    verifie(`${S} · le vert est plus gros que le doré`, vert.w > or.w + 4,
      `${vert.w} contre ${or.w} px`);
    const traits = await page.$$eval(`${ec} .traits i`, (l) => l.length);
    verifie(`${S} · trois traits, pas plus`, traits === 3, `${traits}`);

    // 4 bis) LA LECTURE. C'est le sujet : au repos tout dort, à l'appui tout
    // part, et le chronomètre avance pour de bon — pas un nombre peint.
    const etat = (sel) => page.$eval(`${ec} ${sel}`, (e) => getComputedStyle(e).animationPlayState);
    const opac = () => page.$eval(`${ec} .chrono`, (e) => +getComputedStyle(e).opacity);
    verifie(`${S} · au repos, rien ne bat`,
      (await etat(".traits i")) === "paused" && (await etat(".aile.g i")) === "paused",
      `${await etat(".traits i")} / ${await etat(".aile.g i")}`);
    verifie(`${S} · au repos, pas de chronomètre`, (await opac()) < .05, `${await opac()}`);

    await page.click(`${ec} .anneaux`);
    await page.waitForTimeout(700);
    verifie(`${S} · l'appui lance les traits`,
      (await etat(".traits i")) === "running" && (await etat(".aile.g i")) === "running" &&
      (await etat(".aile.d i")) === "running");
    verifie(`${S} · et fait paraître les secondes`, (await opac()) > .9, `${await opac()}`);
    const lireRouleau = () => page.$eval(`${ec} .colonne.uni .rouleau`, (e) => getComputedStyle(e).transform);
    const r1 = await lireRouleau();
    await page.waitForTimeout(1400);
    const r2 = await lireRouleau();
    verifie(`${S} · le chronomètre avance vraiment`, r1 !== r2, `${r1} puis ${r2}`);
    // Les ailes ne doivent jamais voler l'appui destiné à l'anneau.
    // Le point se sonde en coordonnées de FENÊTRE : on ramène l'anneau devant
    // juste avant, sinon on interroge un endroit qui n'est pas à l'écran et le
    // contrôle accuse la maquette d'un défaut qui est le sien.
    await (await page.$(`${ec} .anneaux`)).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const auCentre = await page.$eval(`${ec} .anneaux`, (e) => {
      const r = e.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const c = document.elementFromPoint(x, y);
      return { ok: !!c && (c === e || e.contains(c)),
               quoi: c ? (c.className || c.tagName) : "rien",
               point: [Math.round(x), Math.round(y)], vue: window.innerHeight };
    });
    verifie(`${S} · le doigt tombe sur l'anneau, pas sur une aile`, auCentre.ok,
      `touche « ${auCentre.quoi} » en (${auCentre.point}) pour une fenêtre de ${auCentre.vue}`);

    await page.click(`${ec} .anneaux`);
    await page.waitForTimeout(600);
    verifie(`${S} · le second appui arrête tout`,
      (await etat(".traits i")) === "paused" && (await opac()) < .05,
      `${await etat(".traits i")} / ${await opac()}`);

    // 4 ter) LE RETRAIT. Trois gestes, une issue commune : la note s'en va et
    // « Annuler » la rend. Rien ne doit partir sans que ce libellé apparaisse.
    // `getComputedStyle(e).opacity` ne dit rien de l'opacité HÉRITÉE : un
    // libellé resté à 1 dans un parent effacé passait pour visible. On demande
    // donc au navigateur ce qu'il affiche vraiment.
    const visible = (sel) => page.$eval(`${ec} ${sel}`, (e) => {
      if (typeof e.checkVisibility === "function")
        return e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      const c = getComputedStyle(e);
      return c.visibility !== "hidden" && +c.opacity > .5;
    });
    verifie(`${S} · au repos, rien n'est retiré`, !(await visible(".retire")));
    // La consigne doit dire le geste RÉEL : la première version annonçait
    // « descendre » alors que le doigt fait monter l'anneau.
    const consigne = await page.$eval(`${ec} .indice`, (e) => e.textContent.trim());
    verifie(`${S} · la consigne dit le bon sens`, /monter|haut/i.test(consigne) && !/descend/i.test(consigne), consigne);
    const annuler = await rect(`${ec} .retire .annuler`);
    {
      const decl = ".fosse";
      const cible = await rect(`${ec} ${decl}`);
      verifie(`${S} · le déclencheur est touchable`, cible.w >= 44 && cible.h >= 44,
        `${cible.w.toFixed(0)} × ${cible.h.toFixed(0)} px`);
      await page.click(`${ec} ${decl}`);
      await page.waitForTimeout(1000);
      verifie(`${S} · la note s'en va`, !(await visible(".anneaux")));
      verifie(`${S} · et « Annuler » paraît`, await visible(".retire"));
      // Le déclencheur doit s'éteindre avec elle : « Retirer » restait allumé
      // et s'imprimait par-dessus « Annuler » — illisible, et invisible au code.
      verifie(`${S} · le déclencheur s'efface aussi`, !(await visible(decl)));
      verifie(`${S} · et le mode d'emploi avec`, !(await visible(".indice")));
      verifie(`${S} · le chronomètre disparaît avec elle`, !(await visible(".chrono")));
      verifie(`${S} · « Annuler » est touchable`, annuler.h >= 30 && annuler.w >= 44,
        `${annuler.w.toFixed(0)} × ${annuler.h.toFixed(0)} px`);
      await page.click(`${ec} .retire .annuler`);
      await page.waitForTimeout(900);
      verifie(`${S} · Annuler rend la note`, await visible(".anneaux"));
      verifie(`${S} · et referme le message`, !(await visible(".retire")));
    }

    // 5) Les photos : touchables, et la dernière case ajoute.
    await page.click(`${ec} .prise`);
    await page.waitForTimeout(800);
    const vues = await page.$$eval(`${ec} .pellicule .vue`, (l) =>
      l.map((e) => { const r = e.getBoundingClientRect();
        return { nom: e.getAttribute("aria-label") || "", lien: e.tagName === "A",
                 w: Math.round(r.width), h: Math.round(r.height) }; }));
    verifie(`${S} · les six photos sont là`, vues.length === 6, `${vues.length}`);
    verifie(`${S} · chaque photo est un lien nommé`,
      vues.every((v) => v.lien && /photo/i.test(v.nom)), vues.map((v) => v.nom).join(" | "));
    verifie(`${S} · chaque vignette se touche`, vues.every((v) => v.w >= 44 && v.h >= 44),
      vues.map((v) => `${v.w}×${v.h}`).join(" "));
    const ajout = await page.$eval(`${ec} .ajouter`, (e) => ({
      nom: e.getAttribute("aria-label") || "", lien: e.tagName === "A" }));
    const rangAjout = await page.$eval(`${ec} .pellicule`, (e) => [...e.children].findIndex((c) => c.classList.contains("ajouter")));
    verifie(`${S} · la case d'ajout vient en premier`, rangAjout === 0, `rang ${rangAjout}`);
    verifie(`${S} · la case ajoute bien des photos`,
      ajout.lien && /ajouter/i.test(ajout.nom), JSON.stringify(ajout));
    const aj = await rect(`${ec} .ajouter`);
    verifie(`${S} · la case d'ajout se touche`, aj.w >= 44 && aj.h >= 44,
      `${aj.w.toFixed(0)} × ${aj.h.toFixed(0)} px`);
    // La pellicule doit démarrer à la marge du texte, pas se décaler seule.
    const v1 = await rect(`${ec} .pellicule > :first-child`);
    const l1 = await rect(`${ec} .contenu .ligne:first-of-type`);
    verifie(`${S} · la pellicule part à la marge du texte`, Math.abs(v1.x - l1.x) < 2,
      `${(v1.x - l1.x).toFixed(1)} px d'écart`);
    // Et la ligne « Photos » ne doit plus exister : elle faisait doublon.
    const lignes = await page.$$eval(`${ec} .contenu .ligne`, (l) =>
      l.map((e) => e.textContent.trim()));
    verifie(`${S} · plus de ligne « Photos »`, !lignes.some((t) => /^Photos/.test(t)), lignes.join(" | "));
    verifie(`${S} · les quatre autres étapes restent`, lignes.length === 4, `${lignes.length}`);
    await page.click(`${ec} .prise`);
    await page.waitForTimeout(700);

    // 6) Le tiroir ouvert ne doit pas l'avaler.
    await page.click(`${ec} .prise`);
    await page.waitForTimeout(800);
    const ti = await rect(`${ec} .tiroir`), ic2 = await rect(`${ec} .anneaux`);
    verifie(`${S} · le tiroir ouvert la recouvre franchement`, ic2.y > ti.y - 300);
    await page.click(`${ec} .prise`);
    await page.waitForTimeout(700);
  } catch (e) { echecs.push(`${s} · interrompu — ` + String(e.message).split("\n")[0]); }
}

// ── L'écran reste celui qu'il était ──────────────────────────────────────
for (const s of ECRANS) {
  try {
    const tout = await page.$eval(`[data-s="${s}"]`, (e) => e.textContent);
    verifie(`${s} · aucun bouton d'action sur un chantier planifié`,
      (await page.$$eval(`[data-s="${s}"] .agir`, (l) => l.length)) === 0);
    verifie(`${s} · l'écran dit la date et renvoie à Fin de chantier`,
      /vendredi 15 août/.test(tout) && /Fin de chantier/.test(tout));
    verifie(`${s} · les photos et les quatre étapes sont dans le tiroir`,
      (await page.$$eval(`[data-s="${s}"] .contenu .ligne`, (l) => l.length)) === 4 &&
      (await page.$$eval(`[data-s="${s}"] .pellicule .vue`, (l) => l.length)) === 6);
  } catch (e) { echecs.push(`${s} · fond interrompu — ` + String(e.message).split("\n")[0]); }
}

// ── Bandeau et mise en page ──────────────────────────────────────────────
try {
  for (const s of ECRANS) {
    const b = await page.$$eval(`[data-s="${s}"] .bas span`, (l) =>
      l.map((e) => { const r = document.createRange(); r.selectNodeContents(e);
        const q = r.getBoundingClientRect(); return { g: q.x, d: q.x + q.width, t: e.textContent.trim() }; }));
    let pire = { ecart: 1e9, ou: "" };
    for (let i = 1; i < b.length; i++) {
      const ec = b[i].g - b[i - 1].d;
      if (ec < pire.ecart) pire = { ecart: ec, ou: `${b[i - 1].t}|${b[i].t}` };
    }
    verifie(`${s} · les libellés du bandeau ne se touchent pas`, pire.ecart >= 6,
      `${pire.ecart.toFixed(1)} px entre ${pire.ou}`);
  }
  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verifie("aucun débordement horizontal", !deborde);
} catch (e) { echecs.push("bandeau · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
console.log(`\n${ok.length} contrôles au vert`);
if (echecs.length) { console.log(`\n${echecs.length} ROUGE(S) :`); for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("Tout est vert.");
