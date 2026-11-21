// Compose la planche « Les dossiers du plan d'arrosage » sur les écrans VRAIS
// figés par figer.mjs. Seul ce qui est proposé s’ajoute. Usage :
//   node appli/scripts/dossiers-arrosage/composer.mjs <dossier de figer.mjs> <brut.html>
import { readFileSync } from "node:fs";
import { composer } from "../../../scripts/planche-figee/composer.mjs";

const S = process.argv[2]; // le dossier rempli par figer.mjs
const SORTIE = process.argv[3];
const lire = (n) => JSON.parse(readFileSync(`${S}/${n}.json`, "utf8"));
const depart = lire("depart");
const plan = lire("plan");
const paysage = lire("paysage");
const css = readFileSync(`${S}/css.txt`, "utf8");
const feuille = readFileSync(`${S}/feuille.html`, "utf8");

// La ligne d'un outil de Paysage : le modèle des lignes de « Mes dossiers ».
const debutNav = paysage.html.indexOf('<nav aria-label="Outils"');
const finNav = paysage.html.indexOf("</nav>", debutNav) + 6;
const navPaysage = paysage.html.slice(debutNav, finNav);


// Le croquis photographié : un dessin au crayon sur une feuille quadrillée.
// Ses couleurs sont celles d'une feuille, pas d'une charte (comme les photos).
const croquis = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440"><defs><pattern id="q" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#c9d3dc" stroke-width="1"/></pattern></defs><rect width="640" height="440" fill="#f4f1e8"/><rect width="640" height="440" fill="url(#q)"/><g fill="none" stroke="#55524a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M42 48 L246 50 L244 252 L40 250 Z"/><path d="M282 46 L420 49 L418 186 L280 184 Z"/><path d="M280 220 L604 222 L603 262 L281 260 Z"/><path d="M40 288 L212 290 L211 324 L41 322 Z"/><rect x="250" y="140" width="18" height="18"/><circle cx="262" cy="58" r="7"/></g><g fill="#55524a" font-family="Bradley Hand, Segoe Print, cursive" font-size="22"><text x="92" y="150">pelouse</text><text x="120" y="40">12</text><text x="8" y="160">12</text><text x="318" y="122">pelouse</text><text x="342" y="38">8</text><text x="428" y="122">8</text><text x="360" y="248">massif</text><text x="430" y="212">20</text><text x="612" y="248">2,4</text><text x="88" y="314">couloir</text><text x="120" y="282">10</text><text x="218" y="314">2</text><text x="224" y="186" font-size="18">nourrice</text><text x="276" y="86" font-size="18">compteur</text></g></svg>`;
const croquisUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(croquis)}`;

const ETAPES = [
  { va: "depart", mot: "Départ" },
  { va: "dossiers", mot: "Mes dossiers" },
  { va: "plan", mot: "Le plan" },
  { va: "dossier", mot: "Le dossier" },
  { va: "revu", mot: "Revu" },
  { va: "pdf", mot: "Le PDF" },
];

// ─── Ce qui tourne dans la planche publiée : les feuilles, les pilotes, la mémoire du geste.
const SCRIPT_EN_PLUS = `
(() => {
  const b = document.body;
  b.dataset.dossier = "libre"; b.dataset.photo = "gardee";
  const dire = (t) => { const d = document.querySelector(".planche-dit"); d.textContent = t; d.classList.add("visible"); clearTimeout(dire.m); dire.m = setTimeout(() => d.classList.remove("visible"), 3200); };
  const fermer = () => document.querySelectorAll("[data-feuille]").forEach((f) => (f.hidden = true));
  const ouvrir = (id) => { fermer(); const f = document.querySelector('[data-planche]:not([hidden]) [data-feuille="' + id + '"]'); if (f) { f.hidden = false; f.querySelector('[role="dialog"]').scrollTop = 0; } };
  const pilote = (cle, val) => {
    b.dataset[cle] = val;
    document.querySelectorAll('[data-pilote^="' + cle + ':"]').forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pilote === cle + ":" + val)));
  };
  document.addEventListener("submit", (e) => e.preventDefault(), true);
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t.matches && t.matches("[data-feuille]")) { fermer(); ev.stopImmediatePropagation(); return; }
    const el = t.closest("button, a, label, [data-ouvre], [data-ferme], [data-pilote], [data-choix], [data-client]");
    if (!el) return;
    if (el.matches("label")) ev.preventDefault();
    if (el.dataset.pilote) { const [c, v] = el.dataset.pilote.split(":"); pilote(c, v); dire(el.dataset.dire); ev.stopImmediatePropagation(); return; }
    if (el.dataset.ouvre) { ev.preventDefault(); ouvrir(el.dataset.ouvre); ev.stopImmediatePropagation(); return; }
    if (el.dataset.ferme !== undefined) { ev.preventDefault(); fermer(); if (el.dataset.dit) dire(el.dataset.dit); ev.stopImmediatePropagation(); return; }
    if (el.dataset.choix) {
      const liste = el.closest("[data-choix-liste]");
      liste.querySelectorAll("[data-choix]").forEach((x) => x.setAttribute("aria-checked", String(x === el)));
      const f = el.closest("[role=dialog]");
      f.querySelectorAll("[data-si-nouveau]").forEach((x) => (x.hidden = el.dataset.choix !== "nouveau"));
      const go = f.querySelector("[data-enregistrer]"); if (go) { go.disabled = false; go.style.opacity = ""; }
      ev.stopImmediatePropagation(); return;
    }
    if (el.dataset.client) {
      const f = el.closest("[role=dialog]");
      const nom = f.querySelector("[data-nom-dossier]"); if (nom) nom.value = "Plan d’arrosage de " + el.dataset.client;
      const champ = f.querySelector("[data-champ-client]"); if (champ) champ.value = el.dataset.client;
      f.querySelectorAll("[data-client]").forEach((x) => x.setAttribute("aria-checked", String(x === el)));
      ev.stopImmediatePropagation(); return;
    }
    if (el.dataset.enregistrer !== undefined) {
      const f = el.closest("[role=dialog]");
      const choisi = f.querySelector('[data-choix][aria-checked="true"]');
      if (!choisi) { dire("Choisissez un dossier."); ev.stopImmediatePropagation(); return; }
      if (choisi.dataset.choix === "intel" && b.dataset.enregistre === "oui") { fermer(); dire("Ce plan est déjà enregistré tel quel dans ce dossier."); ev.stopImmediatePropagation(); return; }
      if (choisi.dataset.choix === "nouveau") {
        const nom = f.querySelector("[data-nom-dossier]").value.trim();
        if (!nom) { dire("Donnez un nom au dossier."); ev.stopImmediatePropagation(); return; }
        fermer(); dire("Dossier « " + nom + " » créé, et le plan y est enregistré. Dans la planche, seul le dossier de Madame Intel s’ouvre."); ev.stopImmediatePropagation(); return;
      }
      if (choisi.dataset.choix !== "intel") { fermer(); dire("Enregistré dans « " + choisi.dataset.nom + " ». Dans la planche, seul le dossier de Madame Intel s’ouvre."); ev.stopImmediatePropagation(); return; }
      b.dataset.enregistre = "oui"; fermer(); dire("Enregistré : version 2 du dossier."); ev.stopImmediatePropagation(); return;
    }
    if (el.dataset.creer !== undefined) {
      const f = el.closest("[role=dialog]");
      const nom = f.querySelector("[data-nom-dossier]").value.trim();
      if (!nom) { dire("Donnez un nom au dossier."); ev.stopImmediatePropagation(); return; }
      const pris = [...document.querySelectorAll('[data-planche="dossiers"] [data-liste-dossiers] [data-nom]')].some((x) => x.textContent.trim().toLowerCase() === nom.toLowerCase() && !x.closest("[hidden]"));
      if (pris) { dire("Un dossier porte déjà ce nom."); ev.stopImmediatePropagation(); return; }
      const liste = document.querySelector('[data-planche="dossiers"] [data-liste-dossiers]');
      const modele = liste.querySelector("[data-modele-ligne]");
      const neuve = modele.cloneNode(true);
      neuve.removeAttribute("data-modele-ligne"); neuve.removeAttribute("data-va"); neuve.hidden = false;
      neuve.querySelector("[data-nom]").textContent = nom;
      neuve.dataset.dit = "Ce dossier attend son premier plan : faites le plan, puis « Enregistrer dans un dossier ».";
      liste.insertBefore(neuve, liste.firstChild);
      fermer(); dire("Dossier créé."); ev.stopImmediatePropagation(); return;
    }
    if (el.dataset.supprimer !== undefined) {
      fermer();
      document.querySelectorAll('[data-ligne-intel]').forEach((x) => (x.hidden = true));
      ev.stopImmediatePropagation();
      const va = document.querySelector('.planche-etapes [data-va="dossiers"]'); va.click();
      setTimeout(() => dire("Dossier supprimé. Le calcul, sans nom ni photo, reste gardé."), 30);
      return;
    }
    if (el.closest("[data-sommaire-local]") && el.matches("button")) {
      const etat = el.closest("[data-planche]");
      const cible = etat.querySelector('[data-partie="' + el.textContent.trim() + '"]');
      el.parentElement.querySelectorAll("button").forEach((x) => { x.setAttribute("aria-pressed", String(x === el)); x.style.backgroundColor = x === el ? "var(--atlas-card, #faf9f5)" : "transparent"; x.style.color = x === el ? "var(--atlas-ink, #1c1c1a)" : "var(--atlas-inkSoft, #4a4a44)"; x.style.boxShadow = x === el ? "0 1px 2px color-mix(in srgb, var(--atlas-ink, #1c1c1a) 14%, transparent)" : "none"; });
      if (cible) window.scrollTo({ top: cible.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
      ev.stopImmediatePropagation(); return;
    }
    if (el.dataset.va) fermer();
  }, true);
  document.addEventListener("input", (ev) => {
    const champ = ev.target.closest("[data-champ-client]");
    if (!champ) return;
    const q = champ.value.trim().toLowerCase();
    champ.closest("[role=dialog]").querySelectorAll("[data-client]").forEach((x) => (x.hidden = q !== "" && !x.dataset.client.toLowerCase().includes(q)));
  });
})();
`;

const STYLE_EN_PLUS = `
body:not([data-enregistre="oui"]) [data-si-enregistre] { display: none !important; }
body[data-enregistre="oui"] [data-si-pas-enregistre] { display: none !important; }
body:not([data-dossier="client"]) [data-si-client] { display: none !important; }
body[data-photo="non"] [data-si-photo] { display: none !important; }
body:not([data-photo="non"]) [data-si-sans-photo] { display: none !important; }
[data-feuille][hidden], [data-ligne-intel][hidden], [hidden] { display: none !important; }
.planche-pilotes { display: grid; gap: 8px; margin-top: 12px; }
.planche-tete .planche-pilotes p { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13.5px; letter-spacing: 0; text-transform: none; font-weight: 600; color: var(--atlas-inkSoft, #4a4a44); }
.planche-tete .planche-pilotes span.cle { width: 82px; flex: none; }
.planche-tete .planche-pilotes button { letter-spacing: 0; text-transform: none; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 0; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer;
  background: transparent; color: var(--atlas-inkSoft, #4a4a44); box-shadow: inset 0 0 0 1px var(--atlas-line, rgba(28,28,26,0.12)); }
.planche-tete .planche-pilotes button[aria-pressed="true"] { background: var(--atlas-ink, #1c1c1a); color: var(--atlas-cream, #f5f3ee); box-shadow: none; }
.pdf-fond { background: #8d8a83; min-height: 100dvh; padding: 0 0 40px; }
.pdf-barre { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #2b2a27; color: #f5f3ee; font-size: 14px; }
.pdf-barre b { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-barre button { min-height: 40px; border: 0; background: transparent; color: #f5f3ee; font: inherit; font-weight: 600; font-size: 15px; cursor: pointer; }
.pdf-page { width: 340px; min-height: 481px; margin: 14px auto 0; background: ${"#faf9f5"}; color: #1c1c1a;
  box-shadow: 0 2px 10px rgba(0,0,0,.25); padding: 22px 22px 26px; position: relative; font-size: 7.2px; line-height: 1.42; font-family: var(--font-body, system-ui); }
.pdf-page h2 { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 15px; line-height: 1.15; }
.pdf-page h3 { margin: 10px 0 4px; font-size: 6.4px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #B98B47; }
.pdf-page .tete { display: flex; justify-content: space-between; gap: 10px; padding-bottom: 7px; border-bottom: 0.6px solid #e2ded3; }
.pdf-page .tete p { margin: 1px 0 0; color: #6b6b5c; }
.pdf-page .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; }
.pdf-page .grille figure { margin: 0; }
.pdf-page .grille svg { display: block; width: 100%; height: auto; }
.pdf-page figcaption { margin-top: 1px; color: #1c1c1a; }
.pdf-page figcaption span { color: #6b6b5c; }
.pdf-page ul { margin: 0; padding: 0 0 0 10px; list-style: disc outside; }
.pdf-page li { margin: 0 0 1.5px; }
.pdf-page li::marker { color: #9C3B2E; }
.pdf-page .ligne { display: flex; gap: 8px; padding: 2px 0; border-top: 0.5px solid #e2ded3; }
.pdf-page .ligne b { width: 30px; flex: none; font-weight: 600; color: #8b6835; }
.pdf-page .groupe { margin: 7px 0 2px; font-family: var(--font-display); font-size: 9px; }
.pdf-page .resume { margin: 5px 0 0; color: #4a4a44; }
.pdf-page .titre-reseau { display: flex; align-items: baseline; gap: 6px; }
.pdf-page .titre-reseau .pastille { width: 8px; height: 8px; border-radius: 2px; flex: none; align-self: center; }
.pdf-page .plan-couleur svg { display: block; width: 100%; height: auto; }
.pdf-page .bloc-ecran { font-size: 16px; line-height: 1.5; }
.pdf-page .bloc-ecran .choix-fige { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: #4a4a44; }
.pdf-page .bandeau { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 12px; align-items: start; }
.pdf-page .bandeau .zone { margin: 1px 0 0; color: #6b6b5c; }
.pdf-page .bandeau .plan-couleur { margin-top: 2px; }
.pdf-page .tete-de-bas-en-haut { position: relative; }
[data-choix][aria-checked="true"] .pastille-choix { box-shadow: inset 0 0 0 7px var(--atlas-ink, #1c1c1a) !important; }
[data-client][aria-checked="true"] { font-weight: 600; color: var(--atlas-orTexte, #8b6835) !important; }
.pdf-gestes { width: 340px; max-width: calc(100% - 24px); margin: 16px auto 0; display: grid; gap: 10px; }
`;

function retouches(etat, D) {
  const doc = document;
  const cree = (html) => { const t = doc.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const S = (s) => s; // les chaînes restent lisibles telles qu'écrites
  const dossierSvg = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="flex-none"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"></path></svg>';
  const telechargerSvg = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="flex-none"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"></path></svg>';
  const plusSvg = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" class="flex-none"><path d="M12 5v14M5 12h14"></path></svg>';

  // Renomme les identifiants d'un bloc recopié : deux SVG qui partagent un clipPath s'emmêlent.
  const renommerIds = (racine, suffixe) => {
    racine.querySelectorAll("[id]").forEach((n) => {
      const ancien = n.id, neuf = ancien + "-" + suffixe;
      n.id = neuf;
      racine.querySelectorAll("*").forEach((x) => {
        for (const a of [...x.attributes]) if (a.value.includes("#" + ancien + ")") || a.value === "#" + ancien) x.setAttribute(a.name, a.value.split("#" + ancien + ")").join("#" + neuf + ")").replace(new RegExp("^#" + ancien + "$"), "#" + neuf));
        if (x.getAttribute("for") === ancien) x.setAttribute("for", neuf);
        if (x.getAttribute("aria-controls") === ancien) x.setAttribute("aria-controls", neuf);
      });
    });
  };

  // ─── L'en-tête de la planche : deux pilotes, les deux choix qui changent l'écran.
  const tete = doc.querySelector(".planche-tete");
  tete.appendChild(cree(`<div class="planche-pilotes">
    <p><span class="cle">Le dossier</span><button type="button" data-pilote="dossier:libre" aria-pressed="true" data-dire="Le dossier porte le nom que vous tapez.">Un nom libre</button><button type="button" data-pilote="dossier:client" aria-pressed="false" data-dire="Le dossier peut se rattacher à une fiche client : voyez Mes dossiers et Nouveau dossier.">Relié à un client</button></p>
    <p><span class="cle">La photo</span><button type="button" data-pilote="photo:gardee" aria-pressed="true" data-dire="La photo du croquis est gardée avec le plan : voyez Revu, puis Voir la saisie.">Gardée</button><button type="button" data-pilote="photo:non" aria-pressed="false" data-dire="Sans la photo : seules vos saisies et le plan sont gardés.">Pas gardée</button></p>
  </div>`));

  // ─── Une feuille, la même que celle de l'appli (« Au fournisseur », figée).
  const gabarit = cree(D.feuille);
  const feuilleDe = (id, titre, contenu, { garder = false } = {}) => {
    const f = gabarit.cloneNode(true);
    f.setAttribute("data-feuille", id);
    f.setAttribute("data-atlas", "feuille-" + id);
    f.hidden = true;
    const dlg = f.querySelector('[role="dialog"]');
    dlg.setAttribute("aria-label", titre);
    dlg.querySelector("h2").textContent = titre;
    const fermerBouton = dlg.querySelector("h2").parentElement.querySelector("button");
    fermerBouton.setAttribute("data-ferme", "");
    if (garder) fermerBouton.remove();
    [...dlg.children].slice(2).forEach((n) => n.remove());
    dlg.insertAdjacentHTML("beforeend", contenu);
    return f;
  };

  // Les gestes vrais de l'appli, recopiés pour leurs styles.
  const D0 = etat("depart");
  const plein = D0.querySelector("[data-atlas=ajouter-croquis]");
  const contour = D0.querySelector("[data-atlas=ouvrir-dessin]");
  const porte = D0.querySelector("[data-atlas=porte-devis]");
  const stylePlein = plein.getAttribute("style");
  const styleContour = contour.getAttribute("style");
  const boutonPlein = (mot, attrs = "", icone = "") => `<button type="button" ${attrs} class="atlas-plein mt-[14px] flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full border-0 text-[17px] font-semibold" style="${stylePlein}">${icone}${mot}</button>`;
  const boutonContour = (mot, attrs = "", icone = "") => `<button type="button" ${attrs} class="mt-[10px] flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full bg-transparent text-[17px] font-semibold" style="${styleContour}">${icone}${mot}</button>`;
  const libelle = (mot) => `<p class="mb-[6px] mt-[18px] text-[14.5px] font-semibold" style="color: var(--atlas-inkSoft, #4a4a44);">${mot}</p>`;
  const caseTexte = (attrs) => `<input type="text" ${attrs} class="block w-full rounded-[10px] border-0 px-[12px] py-3 text-[16px]" style="background-color: var(--atlas-card, #faf9f5); color: var(--atlas-ink, #1c1c1a); box-shadow: inset 0 0 0 1px var(--atlas-line, rgba(28,28,26,0.12));">`;
  const champClient = () => `
    <div data-si-client>
      ${libelle("Sa fiche client")}
      <div class="champ-recherche relative flex items-center gap-[12px] border-b-[1.5px] border-[color:var(--atlas-muted,#8a8578)] focus-within:border-[color:var(--atlas-or,#B98B47)]"><svg aria-hidden="true" width="21" height="21" viewBox="0 0 20 20" fill="none" stroke="var(--atlas-or, #B98B47)" stroke-width="1.5" class="pointer-events-none flex-none"><circle cx="8.2" cy="8.2" r="6.2"></circle><path d="M12.8 12.8L18 18" stroke-linecap="round"></path></svg><input type="text" inputmode="search" autocomplete="off" data-champ-client placeholder="Le nom du client" aria-label="Chercher un client" class="atlas-recherche min-w-0 flex-1 border-0 bg-transparent py-[11px] outline-none" style="color: var(--atlas-ink, #1c1c1a); font-size: 17px; caret-color: var(--atlas-or, #B98B47);"></div>
      <div class="mt-1">${D.clients.map((c) => `<button type="button" data-client="${c}" aria-checked="false" role="radio" class="flex min-h-[48px] w-full items-center gap-3 border-0 bg-transparent px-1 text-left text-[16px]" style="color: var(--atlas-ink, #1c1c1a); border-bottom: 1px solid var(--atlas-line, rgba(28,28,26,0.12));"><span class="min-w-0 flex-1">${c}</span></button>`).join("")}</div>
      <p class="mt-[6px] text-[13.5px]" style="color: var(--atlas-muted, #8a8578);">Facultatif. Le nom se remplit tout seul.</p>
    </div>`;

  // ═══ 1. LE DÉPART : « Mes dossiers » sous « J'ai déjà un devis fournisseur ». ═══
  D0.querySelectorAll("[data-atlas=alerte]").forEach((n) => n.remove());
  plein.setAttribute("data-va", "plan");
  plein.setAttribute("data-dit", "Dans l’appli, le croquis lu s’ouvre à vérifier, puis « Faire le plan ». Ici, le plan de l’exemple.");
  contour.setAttribute("data-va", "plan");
  contour.setAttribute("data-dit", "Dans l’appli, vous dessinez, puis « Faire le plan ». Ici, le plan de l’exemple.");
  porte.setAttribute("data-dit", "Dans l’appli : ouvre l’import d’un devis fournisseur, comme aujourd’hui.");
  const sectionPorte = porte.closest("section");
  const ligneDossiers = sectionPorte.cloneNode(true);
  ligneDossiers.classList.remove("mt-4");
  ligneDossiers.querySelectorAll("input").forEach((n) => n.remove());
  const bDossiers = ligneDossiers.querySelector("button");
  bDossiers.setAttribute("data-atlas", "mes-dossiers");
  bDossiers.removeAttribute("data-dit");
  bDossiers.setAttribute("data-va", "dossiers");
  bDossiers.querySelector("span").innerHTML = dossierSvg;
  bDossiers.lastChild.textContent = "Mes dossiers";
  sectionPorte.after(ligneDossiers);

  // L'en-tête d'un écran : on garde le vrai, on change ses mots.
  const enTete = (racine, { titre, surtitre, retour }) => {
    const h1 = racine.querySelector("header h1");
    h1.textContent = titre;
    if (titre.length > 22) { h1.style.fontSize = "30px"; h1.style.lineHeight = "1.08"; }
    racine.querySelector("header h1 + p").textContent = surtitre;
    const r = racine.querySelector("header a[aria-label=Retour]");
    r.setAttribute("data-va", retour);
    r.removeAttribute("href");
  };
  D0.querySelector("header a[aria-label=Retour]").setAttribute("data-dit", "Retour à Paysage.");

  // ═══ 2. MES DOSSIERS ═══
  const E2 = etat("dossiers");
  enTete(E2, { titre: "Mes dossiers", surtitre: "Plan d’arrosage", retour: "depart" });
  E2.querySelectorAll("[data-atlas=alerte]").forEach((n) => n.remove());
  const form2 = E2.querySelector("form");
  const corps2 = cree(`<div data-atlas="mes-dossiers-ecran" class="pb-[120px]"></div>`);
  form2.replaceWith(corps2);
  corps2.insertAdjacentHTML("beforeend", `<div class="mx-[22px] mt-2">${boutonContour("Nouveau dossier", 'data-ouvre="nouveau" data-atlas="nouveau-dossier"', plusSvg)}</div>`);
  const nav = cree(D.navPaysage);
  nav.setAttribute("aria-label", "Mes dossiers");
  nav.setAttribute("data-liste-dossiers", "");
  nav.classList.remove("mt-[28px]");
  nav.classList.add("mt-[18px]");
  const modele = nav.querySelector("a");
  [...nav.querySelectorAll("a")].forEach((a) => a.remove());
  const ligne = (d) => {
    const a = modele.cloneNode(true);
    a.removeAttribute("href");
    a.querySelector("span[aria-hidden] svg").outerHTML = dossierSvg.replace('width="20" height="20"', 'width="22" height="22"');
    const nom = a.querySelector("span.min-w-0");
    nom.innerHTML = `<span data-nom class="block">${d.nom}</span>${d.sous.map((s) => `<span ${s.attrs || ""} class="mt-[3px] block text-[14px]" style="font-family: var(--font-body); color: var(--atlas-inkSoft, #4a4a44);">${s.texte}</span>`).join("")}`;
    if (d.va) a.setAttribute("data-va", d.va);
    if (d.dit) a.setAttribute("data-dit", d.dit);
    if (d.attrs) for (const [k, v] of Object.entries(d.attrs)) a.setAttribute(k, v);
    return a;
  };
  const filet = cree(D.navPaysage).querySelectorAll("a")[1].querySelector("span.absolute");
  const lignes = [
    ligne({ nom: "Plan d’arrosage de Madame Intel", va: "dossier", attrs: { "data-ligne-intel": "" }, sous: [
      { texte: "Fiche de Mme Intel", attrs: "data-si-client" },
      { texte: "1 plan, le 14 novembre 2026", attrs: "data-si-pas-enregistre" },
      { texte: "2 plans, le dernier aujourd’hui", attrs: "data-si-enregistre" },
    ] }),
    ligne({ nom: "Jardin de M. Faucher", dit: "Dans la planche, seul le dossier de Madame Intel s’ouvre.", sous: [
      { texte: "Fiche de M. Faucher", attrs: "data-si-client" },
      { texte: "1 plan, le 7 novembre 2026" },
    ] }),
    ligne({ nom: "Résidence Les Tilleuls", dit: "Dans la planche, seul le dossier de Madame Intel s’ouvre.", sous: [
      { texte: "3 plans, le dernier le 28 octobre 2026" },
    ] }),
  ];
  const vide = ligne({ nom: "", sous: [{ texte: "Aucun plan encore" }], attrs: { "data-modele-ligne": "" } });
  vide.hidden = true;
  nav.appendChild(vide);
  lignes.forEach((l, i) => { if (i > 0 && filet) l.prepend(filet.cloneNode(true)); nav.appendChild(l); });
  corps2.appendChild(nav);
  corps2.appendChild(feuilleDe("nouveau", "Nouveau dossier", `
    ${champClient()}
    ${libelle("Nom du dossier")}
    ${caseTexte('data-nom-dossier placeholder="Plan d’arrosage de…" aria-label="Nom du dossier"')}
    ${boutonPlein("Créer le dossier", 'data-creer data-atlas="creer-dossier"')}
  `));

  // ═══ 3. LE PLAN : « Enregistrer dans un dossier » sous ses réserves. ═══
  const E3 = etat("plan");
  E3.querySelectorAll("[data-atlas=alerte]").forEach((n) => n.remove());
  const replie = E3.querySelector("[data-atlas=croquis-replie]");
  // Un croquis lu se replie avec sa photo, comme dans l'appli (`apercu`).
  replie.insertAdjacentHTML("afterbegin", `<span aria-hidden="true" class="h-[44px] w-[64px] flex-none rounded-[4px] bg-cover bg-center" style="background-image: url(&quot;${D.croquis}&quot;); box-shadow: inset 0 0 0 1px var(--atlas-line, rgba(28,28,26,0.12));"></span>`);
  replie.querySelector("[data-atlas=rouvrir-le-dessin]").setAttribute("data-dit", "Dans l’appli : rouvre le piquage, le croquis et le dessin.");
  E3.querySelector("header a[aria-label=Retour]").setAttribute("data-va", "depart");
  const reserves = E3.querySelector("[data-atlas=reserves]");
  reserves.insertAdjacentHTML("afterend", `<div data-atlas="enregistrer-dans-un-dossier" class="mt-5">
    ${boutonContour("Enregistrer dans un dossier", 'data-ouvre="enregistrer" data-atlas="enregistrer-dossier"', dossierSvg)}
    <p data-si-enregistre class="mt-3 text-[14.5px] leading-[1.45]" style="color: var(--atlas-inkSoft, #4a4a44);" data-atlas="plan-enregistre">Enregistré dans Plan d’arrosage de Madame Intel, aujourd’hui à 9 h 41. <button type="button" data-va="dossier" class="min-h-[40px] border-0 bg-transparent p-0 text-[14.5px] font-semibold underline" style="color: var(--atlas-orTexte, #8b6835);">Ouvrir le dossier</button></p>
  </div>`);
  const choixDossier = (cle, nom, sous) => `<button type="button" role="radio" aria-checked="false" data-choix="${cle}" data-nom="${nom}" class="flex min-h-[60px] w-full items-center gap-[14px] border-0 bg-transparent px-1 py-2 text-left" style="border-bottom: 1px solid var(--atlas-line, rgba(28,28,26,0.12)); color: var(--atlas-ink, #1c1c1a);"><span aria-hidden="true" class="pastille-choix flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full" style="box-shadow: inset 0 0 0 1.5px var(--atlas-muted, #8a8578);"></span><span class="min-w-0 flex-1"><span class="block text-[17px]" style="font-family: var(--font-display);">${nom}</span>${sous ? `<span class="mt-[2px] block text-[13.5px]" style="color: var(--atlas-inkSoft, #4a4a44);">${sous}</span>` : ""}</span></button>`;
  E3.querySelector("[data-atlas=plan-arrosage]").appendChild(feuilleDe("enregistrer", "Dans quel dossier ?", `
    <p data-si-photo class="mb-[10px] text-[14.5px] leading-[1.45]" style="color: var(--atlas-inkSoft, #4a4a44);">Le croquis, vos saisies, le plan, la liste et les réserves, tels qu’à l’écran.</p>
    <p data-si-sans-photo class="mb-[10px] text-[14.5px] leading-[1.45]" style="color: var(--atlas-inkSoft, #4a4a44);">Vos saisies, le plan, la liste et les réserves, tels qu’à l’écran.</p>
    <div role="radiogroup" aria-label="Le dossier" data-choix-liste>
      ${choixDossier("intel", "Plan d’arrosage de Madame Intel", "1 plan, le 14 novembre 2026")}
      ${choixDossier("faucher", "Jardin de M. Faucher", "1 plan, le 7 novembre 2026")}
      ${choixDossier("tilleuls", "Résidence Les Tilleuls", "3 plans")}
      ${choixDossier("nouveau", "Nouveau dossier", "")}
    </div>
    <div data-si-nouveau hidden>
      ${champClient()}
      ${libelle("Nom du dossier")}
      ${caseTexte('data-nom-dossier placeholder="Plan d’arrosage de…" aria-label="Nom du nouveau dossier"')}
    </div>
    ${boutonPlein("Enregistrer", 'data-enregistrer data-atlas="enregistrer"')}
  `));
  // Le message au fournisseur : la vraie feuille, figée.
  const vraieFeuille = cree(D.feuille);
  vraieFeuille.setAttribute("data-feuille", "fournisseur");
  vraieFeuille.hidden = true;
  vraieFeuille.querySelector("h2").parentElement.querySelector("button").setAttribute("data-ferme", "");
  const copier = [...vraieFeuille.querySelectorAll("button")].find((b) => b.textContent.trim() === "Copier");
  if (copier) copier.setAttribute("data-dit", "Dans l’appli : le message est copié, et la liste s’enregistre chez le fournisseur.");
  E3.querySelector("[data-atlas=plan-arrosage]").appendChild(vraieFeuille);
  const envoyer = E3.querySelector("[data-atlas=envoyer-fournisseur]");
  envoyer.setAttribute("data-ouvre", "fournisseur");

  // Les autres gestes du plan disent ce qu'ils font dans l'appli.
  const direSur = (racine, sel, phrase) => racine.querySelectorAll(sel).forEach((n) => { if (!n.dataset.va && !n.dataset.ouvre) n.setAttribute("data-dit", phrase); });
  const gestesDuPlan = (racine) => {
    direSur(racine, "[data-atlas=choix-du-tuyau] button", "Dans l’appli : le tuyau change, et le plan se refait.");
    direSur(racine, "[data-atlas=bascule] button", "Dans l’appli : la pièce entre dans la liste, ou en sort.");
    direSur(racine, "[data-atlas=piece], [data-atlas=piece-nourrice], [data-atlas=maillon], [data-atlas=piece-nourrice] *", "Dans l’appli : la pièce se change ou se supprime, au nombre choisi.");
    direSur(racine, "[data-atlas=ajouter-piece]", "Dans l’appli : ouvre le choix d’une pièce à ajouter.");
    direSur(racine, "[data-atlas=modifier-zone]", "Dans l’appli : les cotes de la zone se corrigent ici.");
    direSur(racine, "[data-atlas=ajouter-une-zone]", "Dans l’appli : une zone que l’IA n’a pas lue s’ajoute ici.");
    direSur(racine, "[data-atlas=modifier-liste]", "Dans l’appli : la liste se retouche ligne par ligne.");
    direSur(racine, "[data-atlas=envoyer-discussion]", "Dans l’appli : Cause change un réglage, et le plan se refait.");
    direSur(racine, "[data-atlas=nourrice-eclatee] button", "Dans l’appli : la pièce de la nourrice se change ou se supprime.");
  };
  gestesDuPlan(E3);
  // Le sommaire défile dans l'état visible.
  const sommaire = (racine) => {
    const s = racine.querySelector("[data-atlas=sommaire-du-plan]");
    if (!s) return;
    s.setAttribute("data-sommaire-local", "");
    const ids = { Piquage: "piquage", Nourrice: "nourrice", Réseaux: "reseaux", Pièces: "pieces", Liste: "liste" };
    for (const [mot, cle] of Object.entries(ids)) { const sec = racine.querySelector("[data-atlas=" + cle + "]"); if (sec) sec.setAttribute("data-partie", mot); }
  };
  sommaire(E3);

  // ═══ 4. LE DOSSIER OUVERT ═══
  const E4 = etat("dossier");
  enTete(E4, { titre: "Plan d’arrosage de Madame Intel", surtitre: "Mes dossiers", retour: "dossiers" });
  E4.querySelectorAll("[data-atlas=alerte]").forEach((n) => n.remove());
  const corps4 = cree(`<div data-atlas="dossier-ouvert" class="pb-[120px]"></div>`);
  E4.querySelector("form").replaceWith(corps4);
  corps4.insertAdjacentHTML("beforeend", `<p data-si-client class="mx-[26px] mt-1"><button type="button" data-dit="Dans l’appli : ouvre la fiche de Mme Intel, où ce dossier se retrouve aussi." class="min-h-[40px] border-0 bg-transparent p-0 text-[15px] font-semibold" style="color: var(--atlas-orTexte, #8b6835);">Fiche de Mme Intel</button></p>`);
  const nav4 = cree(D.navPaysage);
  nav4.setAttribute("aria-label", "Les plans du dossier");
  nav4.classList.remove("mt-[28px]");
  nav4.classList.add("mt-[14px]");
  [...nav4.querySelectorAll("a")].forEach((a) => a.remove());
  const version = (d) => {
    const a = modele.cloneNode(true);
    a.removeAttribute("href");
    a.querySelector("span[aria-hidden]").remove();
    a.classList.remove("pl-[14px]"); a.classList.add("pl-[18px]");
    const nom = a.querySelector("span.min-w-0");
    nom.innerHTML = `<span class="block">${d.date}</span><span class="mt-[3px] block text-[14px]" style="font-family: var(--font-body); color: var(--atlas-inkSoft, #4a4a44);">${d.resume}</span>`;
    if (d.va) a.setAttribute("data-va", d.va);
    if (d.dit) a.setAttribute("data-dit", d.dit);
    if (d.attrs) for (const [k, v] of Object.entries(d.attrs)) a.setAttribute(k, v);
    return a;
  };
  const v2 = version({ date: "Aujourd’hui, 9 h 41", resume: D.v2, va: "revu", attrs: { "data-si-enregistre": "", "data-atlas": "version-2" } });
  const v1 = version({ date: "14 novembre 2026, 17 h 05", resume: D.v1, dit: "Revu tel qu’enregistré le 14 novembre. Dans la planche, seul le plan d’aujourd’hui est figé.", attrs: { "data-atlas": "version-1" } });
  const filet4 = filet.cloneNode(true); filet4.style.left = "18px";
  v1.prepend(filet4);
  nav4.append(v2, v1);
  corps4.appendChild(nav4);
  corps4.insertAdjacentHTML("beforeend", `<p data-si-pas-enregistre class="mx-[26px] mt-[14px] text-[14px]" style="color: var(--atlas-muted, #8a8578);">Le plan d’aujourd’hui n’y est pas encore : enregistrez-le depuis le plan.</p>
    <div class="mx-[22px] mt-[26px] flex flex-col items-start">
      <button type="button" data-ouvre="renommer" class="min-h-[48px] border-0 bg-transparent px-1 text-[16px] font-semibold" style="color: var(--atlas-ink, #1c1c1a);">Renommer</button>
      <button type="button" data-ouvre="supprimer" data-atlas="supprimer-dossier" class="min-h-[48px] border-0 bg-transparent px-1 text-[16px] font-semibold" style="color: var(--atlas-alerte, #9C3B2E);">Supprimer le dossier</button>
    </div>`);
  corps4.appendChild(feuilleDe("renommer", "Renommer", `
    ${libelle("Nom du dossier")}
    ${caseTexte('value="Plan d’arrosage de Madame Intel" aria-label="Nom du dossier"')}
    ${champClient()}
    ${boutonPlein("Garder ce nom", 'data-ferme data-dit="Renommé. Les plans enregistrés ne changent pas."')}
  `));
  const styleAlerte = stylePlein.replace(/background-color:[^;]+;?/, "background-color: var(--atlas-alerte, #9C3B2E);");
  corps4.appendChild(feuilleDe("supprimer", "Supprimer ce dossier ?", `
    <p class="text-[16px] leading-[1.5]" style="color: var(--atlas-ink, #1c1c1a);"><span data-si-pas-enregistre>Son plan disparaît</span><span data-si-enregistre>Ses 2 plans disparaissent</span> de vos dossiers. Le nom du dossier<span data-si-photo>, la photo du croquis</span><span data-si-client> et le lien à la fiche</span> sont effacés.</p>
    <p class="mt-3 text-[14.5px] leading-[1.5]" style="color: var(--atlas-inkSoft, #4a4a44);">Le calcul, sans rien qui désigne votre client, reste gardé 5 ans : la trace de ce que Cause a rendu.</p>
    <button type="button" data-supprimer class="atlas-plein mt-[18px] flex min-h-[56px] w-full items-center justify-center rounded-full border-0 text-[17px] font-semibold" style="${styleAlerte}">Supprimer</button>
    <button type="button" data-ferme class="mt-[10px] min-h-[48px] w-full border-0 bg-transparent text-[16px] font-semibold" style="color: var(--atlas-inkSoft, #4a4a44);">Garder</button>
  `, { garder: true }));

  // ═══ 5. LE PLAN REVU : le même plan, figé, sans rien qui le change. ═══
  const E5 = etat("revu");
  renommerIds(E5, "revu");
  E5.querySelectorAll("[data-atlas=alerte]").forEach((n) => n.remove());
  enTete(E5, { titre: "Plan d’arrosage", surtitre: "Mes dossiers", retour: "dossier" });
  const replie5 = E5.querySelector("[data-atlas=croquis-replie]");
  replie5.insertAdjacentHTML("afterbegin", `<span data-si-photo aria-hidden="true" class="h-[44px] w-[64px] flex-none rounded-[4px] bg-cover bg-center" style="background-image: url(&quot;${D.croquis}&quot;); box-shadow: inset 0 0 0 1px var(--atlas-line, rgba(28,28,26,0.12));"></span>`);
  const voir = replie5.querySelector("[data-atlas=rouvrir-le-dessin]");
  voir.textContent = "Voir la saisie";
  voir.setAttribute("data-ouvre", "saisie");
  voir.setAttribute("data-atlas", "voir-la-saisie");
  replie5.insertAdjacentHTML("beforebegin", `<div data-atlas="plan-enregistre-le" class="mx-[22px] mt-2 mb-[10px] rounded-[6px] px-4 py-3" style="background-color: color-mix(in srgb, var(--atlas-or, #B98B47) 13%, transparent);">
    <b class="block text-[15.5px]" style="color: var(--atlas-ink, #1c1c1a);">Enregistré aujourd’hui à 9 h 41</b>
    <span class="mt-[2px] block text-[14px]" style="color: var(--atlas-inkSoft, #4a4a44);">Plan d’arrosage de Madame Intel. Tel que rendu ce jour-là.</span>
  </div>`);
  // Ce qui modifie un plan n'a rien à faire sur un plan enregistré.
  E5.querySelectorAll("[data-atlas=ajouter-piece], [data-atlas=ajouter-une-zone], [data-atlas=modifier-liste], [data-atlas=modifier-zone], [data-atlas=discuter-plan]").forEach((n) => n.remove());
  [...E5.querySelectorAll("p")].filter((p) => p.textContent.startsWith("Touchez une pièce")).forEach((p) => p.remove());
  const champDiscussion = E5.querySelector("[data-atlas=champ-discussion]");
  if (champDiscussion) champDiscussion.closest("section, div").remove();
  [...E5.querySelectorAll("p")].filter((p) => /^Demander une modification$/i.test(p.textContent.trim()) || p.textContent.startsWith("Pour changer un métré")).forEach((p) => p.remove());
  E5.querySelectorAll("button:not([data-va]):not([data-ouvre]), [data-atlas=piece], [data-atlas=piece-nourrice]").forEach((b) => {
    if (b.closest("header, [data-sommaire-local], [data-atlas=sommaire-du-plan], .atlas-nav-basse, nav[aria-label]")) return;
    b.setAttribute("data-dit", "Un plan enregistré ne change pas. Pour le changer : Reprendre dans l’outil.");
  });
  sommaire(E5);
  const reserves5 = E5.querySelector("[data-atlas=reserves]");
  reserves5.insertAdjacentHTML("afterend", `<div class="mt-5">${boutonContour("Reprendre dans l’outil", 'data-va="plan" data-atlas="reprendre-dans-l-outil" data-dit="Le plan est refait avec le calcul d’aujourd’hui. Enregistré, il fera une version de plus."')}</div>`);
  const bas5 = E5.querySelector("[data-atlas=action-du-bas]");
  bas5.innerHTML = boutonPlein("Télécharger le PDF", 'data-va="pdf" data-atlas="telecharger-pdf"', telechargerSvg).replace("mt-[14px] ", "");
  // Ce que l'artisan a saisi, rangé avec le plan.
  const rangee = (cle, val) => `<div class="flex gap-3 py-3 text-[15px] leading-[1.4]" style="border-top: 1px solid var(--atlas-line, rgba(28,28,26,0.12));"><span class="w-[92px] flex-none" style="color: var(--atlas-inkSoft, #4a4a44);">${cle}</span><span class="min-w-0 flex-1" style="color: var(--atlas-ink, #1c1c1a);">${val}</span></div>`;
  E5.querySelector("[data-atlas=plan-arrosage]").appendChild(feuilleDe("saisie", "Ce que vous avez saisi", `
    <img data-si-photo alt="Le croquis photographié" src="${D.croquis}" class="block w-full rounded-[6px]" style="box-shadow: inset 0 0 0 1px var(--atlas-line, rgba(28,28,26,0.12));">
    <p data-si-sans-photo class="text-[14.5px]" style="color: var(--atlas-muted, #8a8578);">La photo du croquis n’est pas gardée.</p>
    <div class="mt-[14px]">
      ${rangee("Le piquage", "Juste après le compteur d’eau, 3 bar")}
      ${rangee("Les zones", "Pelouse arrière, 12 m sur 12 m<br>Pelouse avant, 8 m sur 8 m<br>Massif, 20 m sur 2,40 m <span style=\"color: var(--atlas-orTexte, #8b6835);\">(lu 2 m, corrigé par vous)</span><br>Couloir, 10 m sur 2 m")}
      ${rangee("Vos choix", "Ø25 sur l’amenée et les 4 réseaux. Sonde de pluie, grillage et téflon : non.")}
    </div>
  `));

  // ═══ 6. LE PDF : ses réserves, une page par réseau, puis la liste. ═══
  // Sa demande du 21 novembre au soir : « voir les réseaux en grand », chacun
  // sur sa page, à la fois le réseau en couleur et le réseau avec ses pièces,
  // qu'on voie la photo des pièces. Les deux dessins sont ceux de l'écran.
  const E6 = etat("pdf");
  const reseaux = [...E3.querySelectorAll("[data-atlas=carte-reseau]")].map((c, i) => {
    const titre = c.querySelector("b").textContent.trim();
    const zone = (c.querySelector("[data-atlas=zone-du-reseau] span") || {}).textContent || "";
    const svg = c.querySelector("[data-atlas=plan-reseau] svg").cloneNode(true);
    const materiel = [...c.querySelectorAll("ul li")].map((li) => [...li.querySelectorAll("span")].map((x) => x.textContent.trim()).join(" "));
    const couleur = c.querySelector("p span").style.backgroundColor;
    return { titre, zone, svg, materiel, couleur, i };
  });
  const groupes = [...E3.querySelectorAll("[data-atlas=liste-des-pieces] [data-atlas=groupe]")].map((g) => ({
    titre: g.dataset.titre,
    lignes: [...g.querySelectorAll("[data-atlas=ligne]")].map((l) => { const s = l.querySelectorAll("span"); return [s[0].textContent.trim(), s[1].textContent.trim()]; }),
  }));
  // Les pages se remplissent bloc par bloc, MESURÉES : ce qui ne tient pas passe
  // à la page suivante, rien n'est coupé ni recouvert.
  E6.innerHTML = "";
  const atelier = cree(`<div class="pdf-fond" data-atlas="apercu-pdf"></div>`);
  E6.appendChild(atelier);
  const pages = [];
  let courante = null;
  const nouvellePage = (titreSuite) => {
    courante = cree(`<section class="pdf-page"></section>`);
    atelier.appendChild(courante);
    pages.push(courante);
    if (titreSuite) poser(`<h3 style="margin-top: 0;">${titreSuite}</h3>`, null);
  };
  // Le bas utile de la page, avec 5 % de jeu : la mesure se fait ici, avec les
  // polices de ce poste, et son iPhone écrit plus large. Sa remarque du 21 au
  // soir : des lignes du bas passaient sur d'autres mots. Une page qui
  // déborderait encore s'allonge (hauteur plancher), elle ne recouvre rien.
  const limite = () => 481 * 0.95 - 22;
  // Pose un bloc ; s'il dépasse, il part sur une page neuve, précédé de son titre de suite.
  function poser(html, titreSuite, garderAvec, rappel) {
    const el = cree(html);
    courante.appendChild(el);
    if (el.offsetTop + el.offsetHeight > limite()) {
      el.remove();
      const garde = garderAvec ? garderAvec.filter((g) => g.isConnected) : [];
      garde.forEach((g) => g.remove());
      nouvellePage(titreSuite);
      garde.forEach((g) => courante.appendChild(g));
      if (!garde.length && rappel) courante.appendChild(cree(rappel));
      courante.appendChild(el);
    }
    return el;
  }
  // Ce qui se touche à l'écran devient une image : un bouton dans un PDF ne fait rien.
  const figer = (racine) => {
    racine.querySelectorAll("[data-atlas=ajouter-piece]").forEach((n) => n.remove());
    racine.querySelectorAll('[role="group"]').forEach((g) => {
      const choisis = [...g.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent.trim());
      g.replaceWith(cree(`<p class="choix-fige">${choisis.join(". ")}.</p>`));
    });
    racine.querySelectorAll("button").forEach((b) => {
      const span = doc.createElement("span");
      for (const a of b.attributes) if (!["type", "aria-pressed"].includes(a.name)) span.setAttribute(a.name, a.value);
      span.append(...b.childNodes);
      b.replaceWith(span);
    });
    return racine;
  };
  // Un bloc de l'écran, réduit pour tenir dans ce qui reste de la page : sa
  // largeur de mise en page est fixée, puis il est réduit d'un seul tenant
  // (`zoom`), photos et positions des pièces comprises.
  const largeurUtile = () => courante.clientWidth - 2 * parseFloat(getComputedStyle(courante).paddingLeft);
  // La mesure se lit sur ce qui est PEINT (getBoundingClientRect) : sous `zoom`,
  // offsetHeight rend la hauteur d'avant réduction, et la boucle réduisait à vide.
  const basDe = (el) => el.getBoundingClientRect().bottom - courante.getBoundingClientRect().top;
  const reduire = (boite, largeurEcran) => {
    courante.appendChild(boite);
    boite.style.width = largeurEcran + "px";
    boite.style.zoom = "1";
    const haut = boite.getBoundingClientRect().top - courante.getBoundingClientRect().top;
    let k = Math.min(largeurUtile() / largeurEcran, (limite() - haut) / boite.getBoundingClientRect().height);
    boite.style.zoom = String(k);
    boite.style.marginInline = "auto";
    while (basDe(boite) > limite() && k > 0.2) { k *= 0.98; boite.style.zoom = String(k); }
    return k;
  };

  nouvellePage(null);
  courante.setAttribute("data-atlas", "pdf-page-1");
  poser(`<div class="tete"><div><b style="font-size: 8.6px;">Atelier Démo</b><p>Plan d’arrosage de Madame Intel</p></div><div style="text-align: right;"><h2>Plan d’arrosage</h2><p>21 novembre 2026</p></div></div>`, null);
  poser(`<p class="resume">${D.v2}.</p>`, null);
  // « Ce qui n'est pas calculé, tu me l'enlèves. Pas besoin de l'avoir sur le
  // PDF » : sa décision du 21 novembre au soir. Les réserves restent sous le
  // plan à l'écran, et dans l'enregistrement figé.
  // La légende des symboles, celle de l'écran : elle fait lire les pages des réseaux.
  const titreLegende = poser(`<h3>Lire les plans</h3>`, null);
  const legende = figer(E3.querySelector("[data-atlas=symboles]").cloneNode(true));
  legende.setAttribute("data-atlas", "pdf-legende");
  const boiteLegende = cree(`<div class="bloc-ecran"></div>`);
  boiteLegende.appendChild(legende);
  courante.appendChild(boiteLegende);
  // Écrite à la taille de l'écran, puis réduite à celle du texte de la page.
  boiteLegende.style.width = "640px";
  boiteLegende.style.zoom = String(largeurUtile() / 640);
  if (basDe(boiteLegende) > limite()) {
    boiteLegende.remove(); titreLegende.remove();
    nouvellePage(null);
    courante.appendChild(titreLegende);
    courante.appendChild(boiteLegende);
  }

  // Une page par réseau, A4 droit comme les autres : sa remarque du 21 au soir,
  // *« pourquoi les pages des réseaux sont plus petites ? mets des grandes pages
  // pour toutes »* (couchées, un téléphone les réduisait à sa largeur). Pour
  // garder la place aux photos : en haut le nom, le matériel et le réseau en
  // couleur dans le jardin, côte à côte ; au milieu le dessin des pièces, aussi
  // grand que la page le permet ; en bas une tête, de bas en haut.
  const enBoite = (el, largeurEcran) => {
    const boite = cree(`<div class="bloc-ecran"></div>`);
    boite.appendChild(el);
    boite.style.width = largeurEcran + "px";
    return boite;
  };
  const haut = (el) => el.getBoundingClientRect().top - courante.getBoundingClientRect().top;
  reseaux.forEach((r) => {
    nouvellePage(null);
    courante.setAttribute("data-atlas", "pdf-reseau-" + (r.i + 1));
    const source = figer(E3.querySelector(`[data-atlas=pieces-reseau][data-reseau="${r.i}"]`).cloneNode(true));
    source.firstElementChild.remove();
    source.classList.remove("mt-7");
    source.setAttribute("data-atlas", "pdf-pieces-reseau");
    const tuyau = source.querySelector('[data-cle$=":pe"]')?.parentElement;
    const surCePlan = [...source.querySelectorAll("p")].find((p) => p.textContent.startsWith("Sur ce plan"));
    const chaine = source.querySelector("[data-atlas=chaine]");
    [tuyau, surCePlan, chaine].forEach((n) => n && n.remove());
    // En haut : le nom et le matériel à gauche, le réseau en couleur à droite.
    const bandeau = poser(`<div class="bandeau"><div><div class="titre-reseau"><span class="pastille" style="background-color: ${r.couleur};"></span><h2>${r.titre}</h2></div><p class="zone">${r.zone}</p><p class="resume">${r.materiel.join(". ")}.</p></div><div class="plan-couleur"></div></div>`, null);
    bandeau.querySelector(".plan-couleur").appendChild(r.svg);
    if (tuyau) { const b = enBoite(tuyau, 346); bandeau.firstElementChild.appendChild(b); b.style.zoom = "0.5"; }
    // En bas : une tête, de bas en haut, posée d'abord pour savoir ce qu'il reste au milieu.
    let pied = null;
    if (chaine) {
      pied = cree(`<div class="tete-de-bas-en-haut"><h3>Une tête, de bas en haut</h3></div>`);
      const b = enBoite(chaine, 346);
      pied.appendChild(b);
      courante.appendChild(pied);
      b.style.zoom = String(largeurUtile() / 346 * 0.82);
      b.style.marginInline = "auto";
    }
    const titrePieces = cree(`<h3>Les pièces</h3>`);
    const boite = enBoite(source, 346);
    courante.insertBefore(titrePieces, pied);
    courante.insertBefore(boite, pied);
    const place = () => limite() - (pied ? pied.getBoundingClientRect().height + 6 : 0);
    let k = Math.min(largeurUtile() / 346, (place() - haut(boite)) / boite.getBoundingClientRect().height);
    boite.style.zoom = String(k);
    boite.style.marginInline = "auto";
    while (haut(boite) + boite.getBoundingClientRect().height > place() && k > 0.2) { k *= 0.98; boite.style.zoom = String(k); }
    renommerIds(courante, "pdf" + r.i);
  });

  // La liste des pièces, à partir d'une page neuve.
  nouvellePage(null);
  poser(`<h3 style="margin-top: 0;">La liste des pièces</h3>`, null);
  for (const g of groupes) {
    const titreGroupe = poser(`<p class="groupe">${g.titre}</p>`, "La liste des pièces, suite");
    let premiereLigne = true;
    for (const [q, n] of g.lignes) {
      poser(`<div class="ligne"><b>${q}</b><span>${n}</span></div>`, `La liste des pièces, suite`, premiereLigne ? [titreGroupe] : null, `<p class="groupe">${g.titre}, suite</p>`);
      premiereLigne = false;
    }
  }
  // La phrase « Nous ne garantissons pas… », posée ici un temps, est retirée :
  // sa décision du 21 novembre au soir. Rien des réserves ne part dans le PDF.

  const fond = atelier;
  fond.insertAdjacentHTML("afterbegin", `<div class="pdf-barre"><button type="button" data-va="revu">Fermer</button><b>Plan d’arrosage de Madame Intel, 21 novembre 2026.pdf</b></div>`);
  fond.insertAdjacentHTML("beforeend", `<div class="pdf-gestes">
    ${boutonPlein("Enregistrer dans mes fichiers", 'data-dit="Le téléphone demande où le ranger."').replace("mt-[14px] ", "")}
    ${boutonContour("Transmettre", 'data-dit="Ouvre le partage du téléphone : SMS, e-mail, WhatsApp. Cause n’envoie rien tout seul."').replace("mt-[10px] ", "")}
  </div>`);
}

const n = await composer({
  css: css + STYLE_EN_PLUS,
  etats: [
    { nom: "depart", corps: depart },
    { nom: "dossiers", corps: depart },
    { nom: "plan", corps: plan },
    { nom: "dossier", corps: depart },
    { nom: "revu", corps: plan },
    { nom: "pdf", corps: depart },
  ],
  etapes: ETAPES,
  titre: "Les dossiers du plan d’arrosage",
  surtitre: "Planche",
  retouches,
  donnees: {
    navPaysage,
    feuille,
    croquis: croquisUri,
    clients: ["Mme Intel", "M. Bernard", "Mme Costa", "M. Faucher", "Mme Aubry"],
    v1: "3 réseaux, 83 m de tranchée, 38 pièces",
    v2: "4 réseaux, 83 m de tranchée, 45 pièces",
  },
  scriptEnPlus: SCRIPT_EN_PLUS,
  sortie: SORTIE,
});
console.log("planche", SORTIE, n);
