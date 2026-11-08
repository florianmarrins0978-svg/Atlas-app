// Compose une planche à partir d'écrans VRAIS figés (`figer.mjs`) : une seule
// feuille de style, chaque état dans son bloc, et un petit script qui fait
// répondre chaque geste. Les retouches (le changement proposé) se font sur le
// DOM figé, dans un vrai navigateur, jamais en redessinant l'écran.
import { writeFileSync } from "node:fs";
import { lancer } from "./figer.mjs";

const STYLE_PLANCHE = `
.planche-tete { padding: 18px 22px 14px; border-bottom: 1px solid var(--atlas-line, rgba(28,28,26,0.12)); background: var(--atlas-cream, #f5f3ee); }
.planche-tete p { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase; color: var(--atlas-or, #B98B47); }
.planche-tete h1 { margin: 4px 0 12px; font-family: var(--font-display); font-size: 26px; line-height: 1.1; color: var(--atlas-ink, #1c1c1a); }
.planche-etapes { display: flex; flex-wrap: wrap; gap: 8px; }
.planche-etapes button { min-height: 40px; padding: 0 14px; border-radius: 999px; border: 0; font: inherit; font-size: 14px; font-weight: 600;
  background: var(--atlas-rustTint, #ece9e1); color: var(--atlas-inkSoft, #4a4a44); cursor: pointer; }
.planche-etapes button[aria-current="true"] { background: var(--atlas-ink, #1c1c1a); color: var(--atlas-cream, #f5f3ee); }
[data-planche][hidden] { display: none !important; }
.planche-dit { position: fixed; left: 16px; right: 16px; top: 14px; z-index: 90; max-width: 420px; margin: 0 auto; padding: 14px 18px; border-radius: 16px;
  background: var(--atlas-ink, #1c1c1a); color: var(--atlas-cream, #f5f3ee); font-size: 15px; line-height: 1.35;
  opacity: 0; transform: translateY(-10px); pointer-events: none; transition: opacity 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1); }
.planche-dit.visible { opacity: 1; transform: none; }
`;

const SCRIPT = `
(() => {
  const etats = [...document.querySelectorAll("[data-planche]")];
  const etapes = [...document.querySelectorAll(".planche-etapes button")];
  const dit = document.querySelector(".planche-dit");
  let minuteur = null, depart = null;
  const dire = (t) => { dit.textContent = t; dit.classList.add("visible"); clearTimeout(minuteur); minuteur = setTimeout(() => dit.classList.remove("visible"), 2600); };
  const montrer = (nom) => {
    const cible = etats.find((e) => e.dataset.planche === nom);
    if (!cible) return;
    dit.classList.remove("visible");
    etats.forEach((e) => (e.hidden = e !== cible));
    etapes.forEach((b) => b.setAttribute("aria-current", String(b.dataset.va === nom || (cible.dataset.etape && b.dataset.va === cible.dataset.etape))));
    cible.querySelectorAll("[data-part-seul]").forEach((b) => { b.hidden = false; });
    clearTimeout(depart);
    depart = setTimeout(() => cible.querySelectorAll("[data-part-seul]").forEach((b) => { b.hidden = true; }), 6000);
    window.scrollTo(0, 0);
  };
  const onglet = (tab) => {
    const liste = tab.closest("[role=tablist]");
    const tabs = [...liste.querySelectorAll("[role=tab]")];
    const ancien = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    if (ancien === tab) return;
    const styleChoisi = ancien ? ancien.getAttribute("style") : null;
    tabs.forEach((t) => {
      const oui = t === tab;
      if (ancien && t === ancien && !oui) t.setAttribute("style", tab.getAttribute("style") || "");
      t.setAttribute("aria-selected", String(oui));
      const p = document.getElementById(t.getAttribute("aria-controls"));
      const portee = t.closest("[data-planche]");
      const panneau = portee ? portee.querySelector("#" + CSS.escape(t.getAttribute("aria-controls"))) : p;
      if (panneau) panneau.hidden = !oui;
    });
    if (styleChoisi !== null) tab.setAttribute("style", styleChoisi);
    const trait = liste.querySelector("span[aria-hidden]");
    if (trait) { trait.style.width = tab.offsetWidth * 0.66 + "px"; trait.style.transform = "translateX(" + (tab.offsetLeft + tab.offsetWidth * 0.17) + "px)"; }
  };
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("a, button, [data-va], [data-dit], label");
    if (!el) return;
    if (el.matches("a")) ev.preventDefault();
    if (el.dataset.va) { ev.preventDefault(); montrer(el.dataset.va); if (el.dataset.dit) dire(el.dataset.dit); return; }
    if (el.getAttribute("role") === "tab") { onglet(el); return; }
    if (el.dataset.dit) { dire(el.dataset.dit); return; }
    const mot = (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim();
    if (mot) dire("Dans l'appli : ouvre « " + mot + " ».");
  });
  montrer(etats[0].dataset.planche);
})();
`;

/**
 * @param {object} o
 * @param {string} o.css feuilles de l'appli
 * @param {{nom: string, etape?: string, corps: {html: string, classeBody: string, styleHtml: string}}[]} o.etats
 * @param {{va: string, mot: string}[]} o.etapes
 * @param {string} o.titre
 * @param {string} o.surtitre
 * @param {Function} o.retouches exécutée dans la page, reçoit `etat(nom)`
 * @param {string} o.sortie
 */
export async function composer(o) {
  const premier = o.etats[0].corps;
  const blocs = o.etats
    .map((e) => `<div data-planche="${e.nom}"${e.etape ? ` data-etape="${e.etape}"` : ""}>${e.corps.html}</div>`)
    .join("\n");
  const brut = `<!doctype html><html lang="fr" style="${premier.styleHtml}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${o.titre}</title>
<style>${o.css}</style><style>${STYLE_PLANCHE}</style></head>
<body class="${premier.classeBody}">
<header class="planche-tete"><p>${o.surtitre}</p><h1>${o.titre}</h1>
<nav class="planche-etapes" aria-label="Étapes">${o.etapes.map((e) => `<button type="button" data-va="${e.va}">${e.mot}</button>`).join("")}</nav></header>
${blocs}
<div class="planche-dit" role="status"></div>
</body></html>`;
  const nav = await lancer();
  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: true })).newPage();
  await page.setContent(brut, { waitUntil: "load" });
  await page.evaluate(
    ([source, donnees]) => (0, eval)(`(${source})`)((nom) => document.querySelector('[data-planche="' + nom + '"]'), donnees),
    [o.retouches.toString(), o.donnees ?? {}]
  );
  let html = await page.evaluate(() => document.documentElement.outerHTML);
  await nav.close();
  html = `<!doctype html>\n${html.replace("</body>", `<script>${o.scriptEnPlus ?? ""}${SCRIPT}</script></body>`)}`;
  writeFileSync(o.sortie, html);
  return html.length;
}
