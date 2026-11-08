// Fige un VRAI écran d'Atlas en HTML autonome : le DOM tel que peint, ses
// feuilles de style, ses polices et ses images en ligne, sans un seul script.
// Sert à poser une planche SUR la vraie page (`CLAUDE.md` §3 bis, 2 quinquies ;
// sa colère du 8 novembre 2026 : « c'est pas la vraie page, donc c'est de la
// merde »).
//
// Le serveur tourne sur une base de démonstration (`ATLAS_ADRESSE`, port de son
// atelier) : on se connecte, on JOUE le geste, et l'on fige chaque étape avec
// `corps()`. `composer.mjs` assemble ensuite la planche, `parcourir.mjs` la
// parcourt comme lui, chaque geste compris. Modèles :
// `appli/soignee/planning-sans-fiche.html`, `client-nouvelle-facture.html`.
import { createRequire } from "node:module";
import { cheminDuNavigateur } from "../_navigateur.mjs";
const exiger = createRequire(import.meta.url);
export const { chromium } = exiger("playwright");
export const lancer = () => chromium.launch({ executablePath: cheminDuNavigateur() });

export const BASE = process.env.ATLAS_ADRESSE ?? "http://localhost:3001";

export async function ouvrir({ largeur = 390, hauteur = 844 } = {}) {
  const nav = await lancer();
  const contexte = await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 90000 });
  return { nav, contexte, page };
}

const enDonnees = async (contexte, url) => {
  const r = await contexte.request.get(new URL(url, BASE).toString());
  if (!r.ok()) return null;
  const type = r.headers()["content-type"]?.split(";")[0] ?? "application/octet-stream";
  return `data:${type};base64,${(await r.body()).toString("base64")}`;
};

/** Les feuilles de style de la page, polices et images comprises, en un seul texte. */
export async function feuilles(page, contexte) {
  let css = await page.evaluate(() =>
    [...document.styleSheets]
      .map((f) => {
        try {
          return [...f.cssRules].map((r) => r.cssText).join("\n");
        } catch {
          return "";
        }
      })
      .join("\n")
  );
  const urls = [...new Set([...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]))].filter(
    (u) => !u.startsWith("data:") && !u.startsWith("#")
  );
  for (const u of urls) {
    const d = await enDonnees(contexte, u);
    if (d) css = css.split(u).join(d);
  }
  return css;
}

/** Le corps de l'écran tel qu'il est peint maintenant, sans script ni outil de développement. */
export async function corps(page, contexte) {
  const brut = await page.evaluate(() => {
    const copie = document.body.cloneNode(true);
    copie
      .querySelectorAll("script, noscript, template, nextjs-portal, next-route-announcer, [data-nextjs-toast], [data-next-badge-root]")
      .forEach((n) => n.remove());
    // Ce qu'on a tapé dans un champ vit dans sa propriété, pas dans l'attribut.
    const vrais = document.body.querySelectorAll("input, textarea, select");
    const copies = copie.querySelectorAll("input, textarea, select");
    vrais.forEach((v, i) => {
      const c = copies[i];
      if (!c) return;
      if (v.tagName === "TEXTAREA") c.textContent = v.value;
      else if (v.type === "checkbox" || v.type === "radio") c.toggleAttribute("checked", v.checked);
      else if (v.tagName === "INPUT") c.setAttribute("value", v.value);
    });
    return {
      html: copie.innerHTML,
      classeBody: document.body.className,
      styleBody: document.body.getAttribute("style") ?? "",
      classeHtml: document.documentElement.className,
      styleHtml: document.documentElement.getAttribute("style") ?? "",
      attrsHtml: [...document.documentElement.attributes].filter((a) => a.name.startsWith("data-")).map((a) => [a.name, a.value]),
    };
  });
  let html = brut.html;
  const imgs = [...new Set([...html.matchAll(/\ssrc="(\/[^"]+)"/g)].map((m) => m[1]))];
  for (const u of imgs) {
    const d = await enDonnees(contexte, u.replace(/&amp;/g, "&"));
    if (d) html = html.split(`src="${u}"`).join(`src="${d}"`);
  }
  html = html.replace(/\ssrcset="[^"]*"/g, "");
  return { ...brut, html };
}
