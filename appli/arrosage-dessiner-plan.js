/*
  MAQUETTE, RIEN N'EST CODÉ (CLAUDE.md §3 bis). Sa demande du 18 octobre 2026
  au soir : au moment de la photo du croquis, un petit outil pour DESSINER le
  plan. Deux façons, à comparer :

    A, au doigt   on trace chaque zone comme sur le papier, puis on tape ses
                  cotes. Le dessin n'est pas à l'échelle : il ordonne.
    B, à l'échelle on tape les cotes d'abord, la zone se pose à sa taille, on
                  la glisse à sa place.

  Ses réponses du 18 octobre, avant les planches : rectangles, la haie en
  trait ; le terrain a ses métrés ; deux boutons au départ, la photo ou le
  dessin. Le massif reste une SURFACE (longueur et largeur), parce que c'est
  ce que le calcul attend (calcul.js, TYPES.massif, forme « nappe ») : seule
  la haie se mesure en mètres linéaires.

  CE QUE L'OUTIL REND EST CE QUE LA PHOTO REND (CroquisLu de
  src/server/ai/services/lire-croquis.ts) : des zones avec leur centre et leur
  emprise en FRACTION du dessin, leurs cotes, la nourrice, le piquage et le
  point d'eau. Rien de neuf pour le calcul.

  Les fractions sont prises sur un CARRÉ dont le côté est le plus grand côté
  du terrain. Sinon un terrain de 34 × 16 donnerait deux échelles, une en
  largeur et une en hauteur, que echelleDuCroquis mélangerait.

  CE QUI DIT CE QUI MANQUE ET CE QUI COMPTE L'AMENÉE, CE SONT LES VRAIES
  FONCTIONS DU DÉPÔT : etatDuCroquis, LIBELLES (croquis-complet.ts),
  longueurDeLAmenee (geometrie-croquis.ts), empaquetées telles quelles le
  18 octobre 2026 dans arrosage-dessin-calcul.js (esbuild). C'est un
  instantané.

  Rien n'est placé d'office : ni la nourrice, ni le piquage. L'exemple pose
  les zones de son jardin d'exemple (arrosage-plan.html), le terrain de 34 × 16
  en est déduit (le massif finit à 34 m, le couloir à 16 m).
*/
(function () {
  "use strict";
  var MODE = window.MODE_DESSIN === "B" ? "B" : "A";
  var C = window.CROQUIS;
  var NS = "http://www.w3.org/2000/svg";
  var MARGE = 9;

  var TYPES = {
    gazon: { nom: "Pelouse", forme: "surface" },
    potager: { nom: "Potager", forme: "surface" },
    massif: { nom: "Massif", forme: "surface" },
    haie: { nom: "Haie", forme: "trait" }
  };
  var POINTS = {
    nourrice: { nom: "La nourrice", consigne: "Touchez l’endroit de la nourrice." },
    compteur: { nom: "Le compteur", consigne: "Touchez l’endroit du compteur." },
    robinet: { nom: "Le robinet", consigne: "Touchez l’endroit du robinet." }
  };

  var etat = {
    terrain: { L: null, l: null },
    zones: [],
    nourrice: null,
    piquage: null,
    outil: null,
    choisie: null,
    suivant: 1
  };

  function $(id) { return document.getElementById(id); }
  function nombre(v) {
    var n = parseFloat(String(v).replace(",", ".").replace(/\s/g, ""));
    return isFinite(n) && n > 0 && n <= 500 ? n : null;
  }
  function ecrit(n) {
    return String(Math.round(n * 100) / 100).replace(".", ",");
  }
  function cote(n) { return n == null ? "?" : ecrit(n); }

  /* Le côté du carré, en mètres. Sans les cotes du terrain, le carré n'a pas
     d'échelle à lui : les fractions restent celles du dessin. */
  function cote_du_carre() {
    var t = etat.terrain;
    return t.L && t.l ? Math.max(t.L, t.l) : null;
  }
  function terrainU() {
    var s = cote_du_carre();
    if (!s) return { w: 100, h: 100 };
    return { w: etat.terrain.L / s * 100, h: etat.terrain.l / s * 100 };
  }
  function mesuree(z) {
    return TYPES[z.type].forme === "trait" ? z.ml != null : z.L != null && z.l != null;
  }
  function nomDe(z) { return z.nom || TYPES[z.type].nom; }

  /* En B, la taille d'une zone sort de ses cotes, jamais du doigt. */
  function tailleSelonCotes(z) {
    var s = cote_du_carre();
    if (!s) return;
    if (TYPES[z.type].forme === "trait") {
      var lg = (z.ml || 0) / s * 100;
      if (z.debout) { z.w = 0; z.h = lg; } else { z.w = lg; z.h = 0; }
    } else {
      z.w = (z.L || 0) / s * 100;
      z.h = (z.l || 0) / s * 100;
    }
  }

  /* ── Le dessin ─────────────────────────────────────────────── */
  function el(nom, attrs, texte) {
    var e = document.createElementNS(NS, nom);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (texte != null) e.textContent = texte;
    return e;
  }

  function dessiner() {
    var svg = $("toile");
    var t = terrainU();
    svg.setAttribute("viewBox", [-MARGE, -MARGE, t.w + 2 * MARGE, t.h + 2 * MARGE].join(" "));
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    svg.appendChild(el("rect", { x: 0, y: 0, width: t.w, height: t.h, rx: 1.2, fill: "var(--atlas-cream)", stroke: "var(--atlas-ink)", "stroke-width": 0.5 }));
    svg.appendChild(el("text", { x: t.w / 2, y: -3, "text-anchor": "middle", "font-size": 3.4, fill: etat.terrain.L ? "var(--atlas-inkSoft)" : "var(--atlas-alerte)" }, etat.terrain.L ? cote(etat.terrain.L) + " m" : "? m"));
    svg.appendChild(el("text", { x: -3, y: t.h / 2, "text-anchor": "middle", "font-size": 3.4, fill: etat.terrain.l ? "var(--atlas-inkSoft)" : "var(--atlas-alerte)", transform: "rotate(-90 -3 " + t.h / 2 + ")" }, etat.terrain.l ? cote(etat.terrain.l) + " m" : "? m"));

    etat.zones.forEach(function (z) { svg.appendChild(dessinZone(z)); });
    if (brouillon) svg.appendChild(dessinBrouillon());
    if (etat.piquage) svg.appendChild(dessinPiquage(etat.piquage));
    if (etat.nourrice) svg.appendChild(dessinNourrice(etat.nourrice));
    rendreEtat();
  }

  function remplissage(type) {
    if (type === "gazon") return "color-mix(in srgb, var(--atlas-vertPale) 75%, var(--atlas-card))";
    if (type === "potager") return "color-mix(in srgb, var(--atlas-orClair) 38%, var(--atlas-card))";
    return "color-mix(in srgb, var(--atlas-rustDeep) 24%, var(--atlas-card))";
  }

  function dessinZone(z) {
    var g = el("g", { "data-id": z.id, style: "cursor:grab" });
    var choisie = etat.choisie === z.id;
    var ok = mesuree(z);
    if (TYPES[z.type].forme === "trait") {
      var x2 = z.x + z.w, y2 = z.y + z.h;
      g.appendChild(el("line", { x1: z.x, y1: z.y, x2: x2, y2: y2, stroke: "transparent", "stroke-width": 9, "stroke-linecap": "round" }));
      g.appendChild(el("line", { x1: z.x, y1: z.y, x2: x2, y2: y2, stroke: "var(--atlas-plein)", "stroke-width": choisie ? 2.8 : 2.2, "stroke-linecap": "round", "stroke-dasharray": ok ? "none" : "2 1.6" }));
      var debout = z.w === 0;
      var cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      var tx = debout ? cx + 3 : cx, ty = debout ? cy : cy - 2.6;
      g.appendChild(el("text", { x: tx, y: ty, "text-anchor": debout ? "start" : "middle", "dominant-baseline": debout ? "middle" : "auto", "font-size": 3.1, fill: ok ? "var(--atlas-ink)" : "var(--atlas-alerte)", stroke: "var(--atlas-card)", "stroke-width": 0.7, "paint-order": "stroke", "stroke-linejoin": "round" }, nomDe(z) + ", " + cote(z.ml) + " m"));
      if (choisie && MODE === "A") g.appendChild(poignee(x2, y2, z.id));
      return g;
    }
    g.appendChild(el("rect", { x: z.x, y: z.y, width: Math.max(z.w, 0.5), height: Math.max(z.h, 0.5), rx: 0.8, fill: remplissage(z.type), stroke: ok ? (choisie ? "var(--atlas-ink)" : "var(--atlas-rustDeep)") : "var(--atlas-alerte)", "stroke-width": choisie ? 0.9 : 0.45, "stroke-dasharray": ok ? "none" : "1.6 1.2" }));
    // Le nom, puis « longueur × largeur » : la longueur est le côté couché.
    // Une zone trop basse pour deux lignes les met sur une seule.
    var cotes = cote(z.L) + " × " + cote(z.l);
    var couleur = ok ? "var(--atlas-inkSoft)" : "var(--atlas-alerte)";
    var cx2 = z.x + z.w / 2, cy2 = z.y + z.h / 2;
    if (z.h >= 9) {
      g.appendChild(etiquette(cx2, cy2 - 0.6, nomDe(z), 3.2, z.w, "var(--atlas-ink)"));
      g.appendChild(etiquette(cx2, cy2 + 3.4, cotes, 2.9, z.w, couleur));
    } else {
      g.appendChild(etiquette(cx2, cy2 + 1.1, nomDe(z) + ", " + cotes, 3, z.w, couleur));
    }
    if (choisie && MODE === "A") g.appendChild(poignee(z.x + z.w, z.y + z.h, z.id));
    return g;
  }

  /* Un texte qui tient dans sa zone : il rapetisse plutôt que de déborder,
     et un liseré de la couleur du fond le détache des traits qu’il croise. */
  function etiquette(x, y, texte, taille, largeur, couleur) {
    var t = Math.min(taille, Math.max(1.9, (largeur - 1.5) / (texte.length * 0.56)));
    return el("text", { x: x, y: y, "text-anchor": "middle", "font-size": t, fill: couleur, stroke: "var(--atlas-card)", "stroke-width": 0.7, "paint-order": "stroke", "stroke-linejoin": "round" }, texte);
  }

  function poignee(x, y, id) {
    var g = el("g", { "data-poignee": id, style: "cursor:nwse-resize" });
    g.appendChild(el("circle", { cx: x, cy: y, r: 6, fill: "transparent" }));
    g.appendChild(el("circle", { cx: x, cy: y, r: 2.2, fill: "var(--atlas-card)", stroke: "var(--atlas-ink)", "stroke-width": 0.6 }));
    return g;
  }

  function dessinNourrice(p) {
    var g = el("g", { "data-id": "nourrice", style: "cursor:grab" });
    g.appendChild(el("rect", { x: p.x - 6, y: p.y - 6, width: 12, height: 12, fill: "transparent" }));
    g.appendChild(el("rect", { x: p.x - 3.6, y: p.y - 2.2, width: 7.2, height: 4.4, rx: 0.6, fill: "var(--atlas-ink)" }));
    g.appendChild(el("text", { x: p.x, y: p.y + 6, "text-anchor": "middle", "font-size": 3, fill: "var(--atlas-ink)", "font-weight": 600, stroke: "var(--atlas-card)", "stroke-width": 0.8, "paint-order": "stroke", "stroke-linejoin": "round" }, "nourrice"));
    return g;
  }

  function dessinPiquage(p) {
    var g = el("g", { "data-id": "piquage", style: "cursor:grab" });
    g.appendChild(el("rect", { x: p.x - 6, y: p.y - 6, width: 12, height: 12, fill: "transparent" }));
    if (p.sorte === "robinet") {
      // Sa règle du 18 octobre : une petite croix blanche, et « robinet » à côté.
      var d = "M" + (p.x - 1.8) + " " + p.y + "H" + (p.x + 1.8) + "M" + p.x + " " + (p.y - 1.8) + "V" + (p.y + 1.8);
      g.appendChild(el("path", { d: d, stroke: "var(--atlas-ink)", "stroke-width": 1.5, "stroke-linecap": "round" }));
      g.appendChild(el("path", { d: d, stroke: "#ffffff", "stroke-width": 0.65, "stroke-linecap": "round" }));
      g.appendChild(el("text", { x: p.x + 3, y: p.y + 1.1, "font-size": 3, fill: "var(--atlas-ink)", "font-weight": 600, stroke: "var(--atlas-card)", "stroke-width": 0.8, "paint-order": "stroke", "stroke-linejoin": "round" }, "robinet"));
    } else {
      g.appendChild(el("circle", { cx: p.x, cy: p.y, r: 2, fill: "var(--atlas-card)", stroke: "var(--atlas-ink)", "stroke-width": 0.7 }));
      g.appendChild(el("circle", { cx: p.x, cy: p.y, r: 0.6, fill: "var(--atlas-ink)" }));
      g.appendChild(el("text", { x: p.x + 3, y: p.y + 1.1, "font-size": 3, fill: "var(--atlas-ink)", "font-weight": 600, stroke: "var(--atlas-card)", "stroke-width": 0.8, "paint-order": "stroke", "stroke-linejoin": "round" }, "compteur"));
    }
    return g;
  }

  /* ── Le doigt ──────────────────────────────────────────────── */
  var brouillon = null;   // A : la zone en train d'être tracée
  var prise = null;       // ce qu'on déplace ou étire

  function point(evt) {
    var svg = $("toile");
    var m = svg.getScreenCTM().inverse();
    var p = svg.createSVGPoint();
    p.x = evt.clientX; p.y = evt.clientY;
    var q = p.matrixTransform(m);
    return { x: q.x, y: q.y };
  }
  function borne(v, max) { return Math.max(0, Math.min(max, v)); }
  function dansLeTerrain(p) {
    var t = terrainU();
    return { x: borne(p.x, t.w), y: borne(p.y, t.h) };
  }

  function dessinBrouillon() {
    var b = brouillon;
    if (b.type === "haie") {
      var f = finDeHaie(b);
      return el("line", { x1: b.x0, y1: b.y0, x2: f.x, y2: f.y, stroke: "var(--atlas-plein)", "stroke-width": 2.2, "stroke-linecap": "round", opacity: 0.6 });
    }
    var r = rectDe(b);
    return el("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx: 0.8, fill: remplissage(b.type), stroke: "var(--atlas-ink)", "stroke-width": 0.5, "stroke-dasharray": "1.6 1.2" });
  }
  function rectDe(b) {
    return { x: Math.min(b.x0, b.x1), y: Math.min(b.y0, b.y1), w: Math.abs(b.x1 - b.x0), h: Math.abs(b.y1 - b.y0) };
  }
  /* Une haie suit un bord : elle se trace droite, couchée ou debout. */
  function finDeHaie(b) {
    return Math.abs(b.x1 - b.x0) >= Math.abs(b.y1 - b.y0) ? { x: b.x1, y: b.y0 } : { x: b.x0, y: b.y1 };
  }

  function appui(evt) {
    if (evt.button != null && evt.button !== 0) return;
    var svg = $("toile");
    var p = point(evt);
    var cible = evt.target.closest ? evt.target.closest("[data-id],[data-poignee]") : null;

    if (etat.outil && POINTS[etat.outil]) {
      var q = dansLeTerrain(p);
      if (etat.outil === "nourrice") etat.nourrice = q;
      else etat.piquage = { x: q.x, y: q.y, sorte: etat.outil };
      choisirOutil(null);
      dessiner();
      return;
    }
    if (etat.outil && MODE === "A") {
      var d = dansLeTerrain(p);
      brouillon = { type: etat.outil, x0: d.x, y0: d.y, x1: d.x, y1: d.y };
      svg.setPointerCapture(evt.pointerId);
      dessiner();
      return;
    }
    if (cible) {
      var poig = cible.getAttribute("data-poignee");
      var id = poig || cible.getAttribute("data-id");
      prise = { id: isNaN(+id) ? id : +id, etire: !!poig, depart: p, bouge: false, avant: copie(objetDe(id)) };
      if (!isNaN(+id)) etat.choisie = +id;
      svg.setPointerCapture(evt.pointerId);
      dessiner();
      return;
    }
    if (etat.choisie !== null) { etat.choisie = null; dessiner(); }
  }

  function objetDe(id) {
    if (id === "nourrice") return etat.nourrice;
    if (id === "piquage") return etat.piquage;
    return etat.zones.filter(function (z) { return z.id === +id; })[0];
  }
  function copie(o) { return JSON.parse(JSON.stringify(o)); }

  function glisse(evt) {
    var p = point(evt);
    var t = terrainU();
    if (brouillon) {
      var d = dansLeTerrain(p);
      brouillon.x1 = d.x; brouillon.y1 = d.y;
      dessiner();
      return;
    }
    if (!prise) return;
    var dx = p.x - prise.depart.x, dy = p.y - prise.depart.y;
    if (!prise.bouge && Math.abs(dx) + Math.abs(dy) < 1.5) return;
    prise.bouge = true;
    var o = objetDe(prise.id), a = prise.avant;
    if (prise.id === "nourrice" || prise.id === "piquage") {
      o.x = borne(a.x + dx, t.w); o.y = borne(a.y + dy, t.h);
    } else if (prise.etire) {
      if (o.type === "haie") {
        if (a.h === 0) o.w = Math.max(3, Math.min(t.w - a.x, a.w + dx));
        else o.h = Math.max(3, Math.min(t.h - a.y, a.h + dy));
      } else {
        o.w = Math.max(3, Math.min(t.w - a.x, a.w + dx));
        o.h = Math.max(3, Math.min(t.h - a.y, a.h + dy));
      }
    } else {
      o.x = borne(a.x + dx, Math.max(0, t.w - o.w));
      o.y = borne(a.y + dy, Math.max(0, t.h - o.h));
    }
    dessiner();
  }

  function relache() {
    if (brouillon) {
      var b = brouillon;
      brouillon = null;
      var t = terrainU();
      var z = { id: etat.suivant++, type: b.type, nom: null, L: null, l: null, ml: null };
      if (b.type === "haie") {
        var f = finDeHaie(b);
        var w = f.x - b.x0, h = f.y - b.y0;
        // Un simple toucher pose une haie couchée : le doigt ne trace pas toujours.
        if (Math.abs(w) + Math.abs(h) < 4) { w = Math.min(30, t.w - b.x0); h = 0; }
        z.x = Math.min(b.x0, b.x0 + w); z.y = Math.min(b.y0, b.y0 + h); z.w = Math.abs(w); z.h = Math.abs(h);
      } else {
        var r = rectDe(b);
        if (r.w < 4 || r.h < 4) {
          r = { w: Math.min(22, t.w), h: Math.min(16, t.h) };
          r.x = borne(b.x0 - r.w / 2, t.w - r.w); r.y = borne(b.y0 - r.h / 2, t.h - r.h);
        }
        z.x = r.x; z.y = r.y; z.w = r.w; z.h = r.h;
      }
      etat.zones.push(z);
      etat.choisie = z.id;
      choisirOutil(null);
      dessiner();
      ouvrir(z, true);
      return;
    }
    if (prise) {
      var pr = prise;
      prise = null;
      if (!pr.bouge && !pr.etire) {
        var o = objetDe(pr.id);
        if (pr.id === "nourrice" || pr.id === "piquage") ouvrirPoint(pr.id);
        else ouvrir(o, false);
      }
      dessiner();
    }
  }

  /* ── Les outils ────────────────────────────────────────────── */
  function choisirOutil(o) {
    etat.outil = etat.outil === o ? null : o;
    document.querySelectorAll(".outils button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.outil === etat.outil));
    });
    var c = "";
    if (etat.outil && POINTS[etat.outil]) c = POINTS[etat.outil].consigne;
    else if (etat.outil && MODE === "A") c = etat.outil === "haie" ? "Tracez la haie au doigt." : "Tracez la zone au doigt.";
    $("consigne").textContent = c;
  }

  function surOutil(o) {
    if (MODE === "B" && TYPES[o]) {
      var z = { id: null, type: o, nom: null, L: null, l: null, ml: null, x: 0, y: 0, w: 0, h: 0, debout: false };
      ouvrir(z, true);
      return;
    }
    choisirOutil(o);
  }

  /* ── La feuille des cotes ──────────────────────────────────── */
  var enCours = null;

  function ouvrir(z, neuve) {
    enCours = { z: z, neuve: neuve };
    var trait = TYPES[z.type].forme === "trait";
    $("f-titre").textContent = nomDe(z);
    $("f-nom").value = z.nom || "";
    $("f-nom").placeholder = TYPES[z.type].nom;
    $("f-surface").hidden = trait;
    $("f-trait").hidden = !trait;
    $("f-L").value = z.L == null ? "" : ecrit(z.L);
    $("f-l").value = z.l == null ? "" : ecrit(z.l);
    $("f-ml").value = z.ml == null ? "" : ecrit(z.ml);
    $("f-cotes").hidden = false;
    ["f-L", "f-l", "f-ml"].forEach(function (i) { $(i).removeAttribute("aria-invalid"); });
    var nouvelleB = MODE === "B" && neuve;
    $("f-valider").textContent = nouvelleB ? "Poser" : "Valider";
    $("f-tourner").hidden = MODE !== "B" || nouvelleB;
    $("f-valider").classList.toggle("seul", $("f-tourner").hidden);
    $("f-supprimer").hidden = nouvelleB;
    $("feuille").hidden = false;
    setTimeout(function () { (trait ? $("f-ml") : $("f-L")).focus(); }, 60);
  }

  function ouvrirPoint(id) {
    enCours = { point: id };
    var nom = id === "nourrice" ? "La nourrice" : POINTS[etat.piquage.sorte].nom;
    $("f-titre").textContent = nom;
    $("f-cotes").hidden = true;
    $("f-tourner").hidden = true;
    $("f-valider").textContent = "Fermer";
    $("f-valider").classList.add("seul");
    $("f-supprimer").hidden = false;
    $("feuille").hidden = false;
  }

  /* Toucher à côté referme la feuille (le pavé de l’iPhone n’a pas de touche OK).
     Une zone de B pas encore posée s’abandonne : rien n’était dessiné. */
  function horsFeuille() {
    if (enCours && enCours.neuve && MODE === "B") { fermer(); return; }
    valider();
  }

  function fermer() { $("feuille").hidden = true; enCours = null; dessiner(); }

  function lireFeuille(z) {
    z.nom = $("f-nom").value.trim() || null;
    if (TYPES[z.type].forme === "trait") z.ml = nombre($("f-ml").value);
    else { z.L = nombre($("f-L").value); z.l = nombre($("f-l").value); }
  }

  function valider() {
    if (!enCours) return;
    if (enCours.point) { fermer(); return; }
    var z = enCours.z;
    if (MODE === "B") {
      // En B, c'est la cote qui donne la taille : sans elle, rien à poser.
      var essai = copie(z);
      lireFeuille(essai);
      var vides = TYPES[z.type].forme === "trait" ? [["f-ml", essai.ml]] : [["f-L", essai.L], ["f-l", essai.l]];
      var manque = false;
      vides.forEach(function (v) {
        $(v[0]).setAttribute("aria-invalid", String(v[1] == null));
        if (v[1] == null) manque = true;
      });
      if (manque) return;
    }
    lireFeuille(z);
    // En A, le dessin ordonne : une longueur tapée pour le côté que le doigt
    // a tracé debout va sur ce côté-là. La zone est la même, les cotes aussi.
    if (MODE === "A" && z.L != null && z.l != null && (z.L - z.l) * (z.w - z.h) < 0) {
      var L0 = z.L; z.L = z.l; z.l = L0;
    }
    if (MODE === "B") {
      tailleSelonCotes(z);
      if (enCours.neuve) {
        // Posée au milieu du terrain, un peu décalée de la précédente : il la
        // glisse ensuite à sa place. La place n'est pas une donnée, la cote si.
        var t = terrainU(), n = etat.zones.length % 5;
        z.x = borne(t.w / 2 - z.w / 2 + n * 3, Math.max(0, t.w - z.w));
        z.y = borne(t.h / 2 - z.h / 2 + n * 3, Math.max(0, t.h - z.h));
        z.id = etat.suivant++;
        etat.zones.push(z);
        etat.choisie = z.id;
        $("consigne").textContent = "Glissez la zone à sa place.";
      }
    }
    fermer();
  }

  function tourner() {
    var z = enCours && enCours.z;
    if (!z) return;
    lireFeuille(z);
    if (TYPES[z.type].forme === "trait") z.debout = !z.debout;
    else { var L = z.L; z.L = z.l; z.l = L; }
    tailleSelonCotes(z);
    var t = terrainU();
    z.x = borne(z.x, Math.max(0, t.w - z.w));
    z.y = borne(z.y, Math.max(0, t.h - z.h));
    fermer();
  }

  function supprimer() {
    if (!enCours) return;
    if (enCours.point === "nourrice") etat.nourrice = null;
    else if (enCours.point === "piquage") etat.piquage = null;
    else {
      var id = enCours.z.id;
      etat.zones = etat.zones.filter(function (z) { return z.id !== id; });
      etat.choisie = null;
    }
    fermer();
  }

  /* ── Le terrain ────────────────────────────────────────────── */
  function surTerrain() {
    var avant = terrainU(), sAvant = cote_du_carre();
    etat.terrain.L = nombre($("t-L").value);
    etat.terrain.l = nombre($("t-l").value);
    var apres = terrainU(), sApres = cote_du_carre();
    etat.zones.forEach(function (z) {
      if (MODE === "B" && sAvant && sApres) {
        // En B, une zone garde ses mètres : c'est le carré qui change d'échelle.
        var k = sAvant / sApres;
        z.x *= k; z.y *= k;
        tailleSelonCotes(z);
      } else {
        // En A, le dessin suit le cadre : ce qui était au tiers gauche y reste.
        var kx = apres.w / avant.w, ky = apres.h / avant.h;
        z.x *= kx; z.w *= kx; z.y *= ky; z.h *= ky;
      }
    });
    [etat.nourrice, etat.piquage].forEach(function (p) {
      if (!p) return;
      if (MODE === "B" && sAvant && sApres) { p.x *= sAvant / sApres; p.y *= sAvant / sApres; }
      else { p.x *= apres.w / avant.w; p.y *= apres.h / avant.h; }
    });
    rendreOutils();
    dessiner();
  }

  function rendreOutils() {
    var bloque = MODE === "B" && !cote_du_carre();
    document.querySelectorAll(".outils button").forEach(function (b) { b.disabled = bloque; });
    if (bloque) $("consigne").textContent = "Les métrés du terrain d’abord.";
    else if ($("consigne").textContent === "Les métrés du terrain d’abord.") $("consigne").textContent = "";
  }

  /* ── Ce que l'outil comprend ───────────────────────────────── */
  function croquisLu() {
    var reserves = [];
    var zones = etat.zones.map(function (z) {
      var trait = TYPES[z.type].forme === "trait";
      if (!mesuree(z)) reserves.push("« " + nomDe(z) + " » n’a pas ses métrés");
      return {
        type: z.type,
        nom: z.nom,
        L: trait ? null : z.L,
        l: trait ? null : z.l,
        ml: trait ? z.ml : null,
        x: arrondi((z.x + z.w / 2) / 100),
        y: arrondi((z.y + z.h / 2) / 100),
        largeurFraction: arrondi(z.w / 100),
        hauteurFraction: arrondi(z.h / 100)
      };
    });
    if (!etat.nourrice) reserves.push("le croquis ne montre pas où la nourrice est posée");
    if (!etat.piquage) reserves.push("le croquis ne montre pas où le piquage se fait");
    return {
      zones: zones,
      pointDEau: etat.piquage ? etat.piquage.sorte : null,
      nourrice: etat.nourrice ? { x: arrondi(etat.nourrice.x / 100), y: arrondi(etat.nourrice.y / 100) } : null,
      piquage: etat.piquage ? { x: arrondi(etat.piquage.x / 100), y: arrondi(etat.piquage.y / 100) } : null,
      reserves: reserves
    };
  }
  function arrondi(n) { return Math.round(n * 10000) / 10000; }

  function rendreEtat() {
    var lu = croquisLu();
    var mesurees = lu.zones.filter(function (z, i) { return mesuree(etat.zones[i]); });
    var e = C.etatDuCroquis({
      zonesMesurees: mesurees.length,
      nourrice: !!lu.nourrice,
      piquage: !!lu.piquage,
      branchement: lu.pointDEau === "compteur" ? "compteur" : "ailleurs"
    });
    var ul = $("etat");
    ul.innerHTML = "";
    function ligne(texte, classe) {
      var li = document.createElement("li");
      li.textContent = texte;
      if (classe) li.className = classe;
      ul.appendChild(li);
    }
    e.manque.forEach(function (m) { ligne(C.LIBELLES[m].titre, "rouge"); });
    etat.zones.forEach(function (z) {
      if (!mesuree(z)) ligne("Les métrés de " + nomDe(z) + " manquent, cette zone n’entre pas dans le plan.");
    });
    var faire = $("faire");
    faire.hidden = !e.complet;
    if (lu.nourrice && lu.piquage) {
      var places = mesurees.map(function (z) {
        return { position: { x: z.x, y: z.y }, largeurFraction: z.largeurFraction, hauteurFraction: z.hauteurFraction, L: z.L, l: z.l, ml: z.ml };
      });
      var a = C.longueurDeLAmenee(lu.piquage, lu.nourrice, places);
      var depuis = lu.pointDEau === "robinet" ? "Du robinet" : "Du compteur";
      if (a.ok) ligne(depuis + " à la nourrice : " + ecrit(a.metres) + " m.", "bon");
      else ligne("L’amenée n’est pas comptée : " + a.raison + ".", "rouge");
    }
    $("recu-json").textContent = JSON.stringify(lu, null, 2);
  }

  /* ── L'exemple ─────────────────────────────────────────────── */
  function exemple() {
    // Les zones de son jardin d'exemple (arrosage-plan.html), en mètres.
    var Z = [
      { type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
      { type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
      { type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4 },
      { type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2 }
    ];
    // En A, le dessin est fait à main levée : un peu large ici, un peu court
    // là. Les cotes, elles, sont justes. C'est le cas qu'il a demandé de lire.
    var MAIN = [[1.12, 0.95], [0.86, 1.1], [0.9, 1.6], [1.15, 1.5]];
    etat.terrain = { L: 34, l: 16 };
    $("t-L").value = "34"; $("t-l").value = "16";
    var s = 34;
    etat.zones = Z.map(function (z, i) {
      var k = MODE === "A" ? MAIN[i] : [1, 1];
      return { id: i + 1, type: z.type, nom: z.nom, L: z.L, l: z.l, ml: null, x: z.x / s * 100, y: z.y / s * 100, w: z.L / s * 100 * k[0], h: z.l / s * 100 * k[1], debout: false };
    });
    etat.suivant = Z.length + 1;
    etat.nourrice = null; etat.piquage = null; etat.choisie = null;
    choisirOutil(null);
    rendreOutils();
    dessiner();
  }

  /* ── Les deux écrans ───────────────────────────────────────── */
  function montrer(outil) {
    $("depart").hidden = outil;
    $("outil").hidden = !outil;
    window.scrollTo(0, 0);
    if (outil) dessiner();
  }

  function lancer() {
    var ch = $("charte");
    ["origine", "brume", "pierre", "beurre", "moka", "prune", "sylve", "nuit"].forEach(function (n) {
      var o = document.createElement("option");
      o.value = n; o.textContent = n.charAt(0).toUpperCase() + n.slice(1);
      ch.appendChild(o);
    });
    ch.value = document.body.dataset.charte || "origine";
    ch.addEventListener("change", function () { document.body.dataset.charte = ch.value; });

    $("dessiner").addEventListener("click", function () { montrer(true); });
    $("retour").addEventListener("click", function () { montrer(false); });
    $("exemple").addEventListener("click", function () { montrer(true); exemple(); });
    $("t-L").addEventListener("input", surTerrain);
    $("t-l").addEventListener("input", surTerrain);
    document.querySelectorAll(".outils button").forEach(function (b) {
      b.addEventListener("click", function () { surOutil(b.dataset.outil); });
    });
    var svg = $("toile");
    svg.addEventListener("pointerdown", appui);
    svg.addEventListener("pointermove", glisse);
    svg.addEventListener("pointerup", relache);
    svg.addEventListener("pointercancel", function () { brouillon = null; prise = null; dessiner(); });
    $("f-valider").addEventListener("click", valider);
    $("f-tourner").addEventListener("click", tourner);
    $("f-supprimer").addEventListener("click", supprimer);
    $("feuille").addEventListener("click", function (e) { if (e.target === $("feuille")) horsFeuille(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("feuille").hidden) horsFeuille();
      if (e.key === "Enter" && !$("feuille").hidden && e.target.tagName === "INPUT") { e.preventDefault(); valider(); }
    });
    $("faire").querySelector("button").addEventListener("click", function () {
      var d = $("recu");
      d.open = true;
      d.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    rendreOutils();
    dessiner();
  }

  document.addEventListener("DOMContentLoaded", lancer);
})();
