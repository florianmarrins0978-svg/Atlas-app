// LES REPÈRES SUR LA NOURRICE EN 3D : le numéro de la liste sur chaque pièce, et au bout des colonnes la
// flèche de l'arrivée d'eau, R1, R2… Une couche posée sur la vue, qui ne prend aucun toucher : la 3D reste
// à la main.
//
// Sa planche du 22 novembre 2026 (appli/arrosage-nourrice-3d-numeros.html), et son choix du même soir :
// « la A noire, à l'éclaté seulement ». L'écran du plan (src/app/paysage/arrosage/Nourrice3D.tsx) et la
// planche emploient ce module ; recopiés, les deux placements auraient divergé (CLAUDE.md §3).
//
//   var r = poserReperes(couche, v, { voie: function (k, goutte) { return { nom: "R1", couleur: "#2F6FB5" }; } });
//   v.scene.surImage(r.placer);   // les repères suivent les pièces à chaque image
//   r.choisir("mamelon");         // allume ses numéros, éteint les autres ; null rend tout
//   r.regler({ quand: "toujours", fil: true });   // les variantes que la planche garde à l'essai
//   r.detruire();
//
// `couche` : un élément vide, posé sur la vue (même boîte que la toile). `voie(k, goutte)` : le nom et la
// couleur de la k-ième voie (0 pour la première), dans l'ordre de la composition, le goutte-à-goutte en
// dernier.
//
// LES COULEURS SONT ÉCRITES ICI, ET C'EST VOULU. La scène peint son propre fond, gris clair, quelle que soit
// la charte de l'appli (scene.js, `fond`) : les repères se posent sur ce gris, jamais sur la charte. La
// pastille est donc celle du dessin d'avant (NourriceEclatee.tsx, `Badge`), noire au chiffre blanc, et
// une pastille aux couleurs d'une charte sombre y serait claire sur clair.

var STYLE = "nourrice-3d-reperes", SVG = "http://www.w3.org/2000/svg", ENCRE = "#4a4a44";
var FEUILLE =
  ".n3d-num{position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
  "background:#1c1c1a;color:#faf9f5;box-shadow:0 1px 3px rgba(28,28,26,.35);font-size:11.5px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;" +
  "transition:opacity .25s ease-out,scale .2s ease-out;will-change:transform}" +
  ".n3d-num.cache{opacity:0}.n3d-num.eteint{opacity:.18}.n3d-num.allume{scale:1.18}" +
  ".n3d-fil{stroke:rgba(28,28,26,.5);stroke-width:1;transition:opacity .25s ease-out}.n3d-fil.cache{opacity:0}.n3d-fil.eteint{opacity:.12}" +
  ".n3d-point{fill:rgba(28,28,26,.6)}" +
  // Le halo du fond de la scène autour des mots : ils restent lisibles quand ils passent devant une pièce.
  ".n3d-mot{position:absolute;left:0;top:0;font-size:11px;font-weight:600;line-height:1.2;text-align:center;white-space:nowrap;translate:-50% 0;" +
  "text-shadow:0 0 3px rgba(214,213,210,.9),0 0 6px rgba(214,213,210,.8)}" +
  ".n3d-fleche{stroke:" + ENCRE + ";stroke-width:1.6;fill:none}.n3d-pointe{fill:" + ENCRE + "}" +
  "@media (prefers-reduced-motion:reduce){.n3d-num,.n3d-fil{transition:none}}";

// Une place prise : on essaie autour (dessous, dessus, de l'autre côté de la pièce, en biais), au plus
// près d'abord ; ce n'est qu'à défaut qu'on descend jusqu'à trouver de la place.
var AUTOUR = [[0, 0], [0, 1], [0, -1], [-2.2, 0], [1, 0], [-2.2, 1], [-2.2, -1], [1, 1], [1, -1], [0, 2], [0, -2]];

export function poserReperes(couche, v, o) {
  var reglage = { quand: "eclatee", fil: false }, choisie = null, mots = [], fleches = [], pastilles = [], traits = [];
  if (!document.getElementById(STYLE)) {
    var feuille = document.createElement("style"); feuille.id = STYLE; feuille.textContent = FEUILLE; document.head.appendChild(feuille);
  }
  couche.style.position = "absolute"; couche.style.inset = "0"; couche.style.pointerEvents = "none"; couche.style.overflow = "hidden";
  var fils = document.createElementNS(SVG, "svg");
  fils.style.position = "absolute"; fils.style.inset = "0"; fils.style.width = "100%"; fils.style.height = "100%";
  couche.appendChild(fils);

  // LE BAS DE CHAQUE COLONNE. Le mot se pose dans le prolongement de la colonne, juste après son dernier
  // tuyau : il suit la colonne quand on tourne, comme le numéro suit sa pièce. La flèche de l'arrivée monte
  // vers le tuyau, comme l'eau. Rend les places prises, qu'aucun numéro ne recouvrira.
  function placerLesMots(ecr, W, H) {
    var cols = v.colonnes(), par = {}, pris = [];
    // Un mot reste dans le cadre : sa largeur mesurée, il glisse vers l'intérieur plutôt que d'être coupé.
    function poser(m, x, y) {
      var w = m.offsetWidth, h = m.offsetHeight;
      x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, x)); y = Math.max(6, Math.min(H - h - 6, y));
      m.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      pris.push({ x: x, y: y + h / 2 });
    }
    ecr.forEach(function (e) { par[e.indice] = e; });
    while (mots.length < cols.length) { var m = document.createElement("span"); m.className = "n3d-mot"; couche.appendChild(m); mots.push(m); }
    // UNE FLÈCHE PAR ARRIVÉE D'EAU : deux nourrices en ont deux (sa remarque du 23 novembre 2026 devant la
    // planche des deux nourrices : « sur la nourrice de gauche, il n'y a pas la flèche »). Une seule flèche,
    // reprise par chaque arrivée, ne restait que sur la dernière.
    var arrivees = cols.filter(function (c) { return c.arrivee; }).length;
    while (fleches.length < arrivees) { var f = document.createElementNS(SVG, "g"); f.innerHTML = '<line class="n3d-fleche"/><path class="n3d-pointe"/>'; fils.appendChild(f); fleches.push(f); }
    fleches.forEach(function (f, i) { f.style.display = i < arrivees ? "" : "none"; });
    var voie = 0, arrivee = 0;
    mots.forEach(function (m, i) {
      var c = cols[i];
      if (!c) { m.style.display = "none"; return; }
      m.style.display = "";
      var haut = par[c.pieces[0]], bas = par[c.pieces[c.pieces.length - 1]];
      var dx = bas.x - haut.x, dy = bas.y - haut.y, l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      // Le bout du tuyau : le centre du dernier, plus sa demi-longueur à l'écran.
      var demi = Math.abs(dx) * (bas.droite - bas.gauche) / 2 + Math.abs(dy) * (bas.bas - bas.haut) / 2;
      var bx = bas.x + dx * demi, by = bas.y + dy * demi;
      if (c.arrivee) {
        var fleche = fleches[arrivee++];
        var x0 = bx + dx * 34, y0 = by + dy * 34, x1 = bx + dx * 7, y1 = by + dy * 7, nx = -dy, ny = dx;
        fleche.firstChild.setAttribute("x1", x0); fleche.firstChild.setAttribute("y1", y0); fleche.firstChild.setAttribute("x2", x1 + dx * 5); fleche.firstChild.setAttribute("y2", y1 + dy * 5);
        fleche.lastChild.setAttribute("d", "M" + x1 + " " + y1 + " L" + (x1 + dx * 8 + nx * 5) + " " + (y1 + dy * 8 + ny * 5) + " L" + (x1 + dx * 8 - nx * 5) + " " + (y1 + dy * 8 - ny * 5) + " Z");
        m.style.color = ENCRE; m.innerHTML = "Arrivée<br>d’eau";
        poser(m, x0 + dx * 4, y0 + Math.max(dy, 0) * 4);
      } else {
        var d = o.voie(voie++, c.goutte);
        m.style.color = d.couleur;
        m.textContent = d.nom;
        if (c.goutte) { m.appendChild(document.createElement("br")); m.appendChild(document.createTextNode("goutte-à-goutte")); }
        poser(m, bx + dx * 12, by + dy * 12 - 4);
      }
    });
    return pris;
  }

  // LES NUMÉROS, replacés à chaque image : à droite de la pièce, à sa mi-hauteur. Deux numéros ne se
  // chevauchent jamais, et un numéro ne se pose jamais sur un mot du bas.
  function placer() {
    var H = couche.clientHeight, W = couche.clientWidth, ecr = v.scene.ecran();
    if (!W || !H) return;
    var posees = placerLesMots(ecr, W, H);
    var montrer = reglage.quand === "toujours" || v.scene.etat().t > 0.55, fil = reglage.fil, liste = v.numeros();
    // Sur le flanc de la pièce ; au fil, le numéro s'en écarte et son fil y ramène l'œil.
    var ECART = fil ? 22 : 23;
    var places = liste.map(function (e) { return { e: e, x: Math.min(W - 14, fil ? e.droite + 31 : e.x + 14), y: Math.max(14, Math.min(H - 14, e.y)) }; });
    function libre(x, y) { return posees.every(function (q) { return Math.abs(q.x - x) >= ECART || Math.abs(q.y - y) >= ECART; }); }
    places.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (p) {
      var x0 = p.x, y0 = p.y, trouve = AUTOUR.some(function (d) {
        var x = x0 + d[0] * ECART, y = y0 + d[1] * ECART;
        if (x < 12 || x > W - 12 || y < 12 || y > H - 12 || !libre(x, y)) return false;
        p.x = x; p.y = y; return true;
      });
      if (!trouve) while (!libre(p.x, p.y) && p.y < H) p.y += ECART;
      posees.push(p);
    });
    while (pastilles.length < places.length) { var d = document.createElement("span"); d.className = "n3d-num"; couche.appendChild(d); pastilles.push(d); }
    while (traits.length < places.length) { var g = document.createElementNS(SVG, "g"); g.innerHTML = '<line class="n3d-fil"/><circle class="n3d-point" r="1.6"/>'; fils.appendChild(g); traits.push(g); }
    pastilles.forEach(function (d, i) {
      var p = places[i], g = traits[i];
      if (!p) { d.className = "n3d-num cache"; g.style.display = "none"; return; }
      var etatNum = !montrer ? " cache" : choisie ? (p.e.cle === choisie ? " allume" : " eteint") : "";
      d.textContent = p.e.numero; d.className = "n3d-num" + etatNum;
      d.style.transform = "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px)";
      g.style.display = fil ? "" : "none";
      if (fil) {
        var l = g.firstChild, c = g.lastChild;
        l.setAttribute("x1", p.e.x); l.setAttribute("y1", p.e.y); l.setAttribute("x2", p.x - 10); l.setAttribute("y2", p.y);
        l.setAttribute("class", "n3d-fil" + etatNum); c.setAttribute("cx", p.e.x); c.setAttribute("cy", p.e.y); c.style.opacity = etatNum === " cache" ? 0 : etatNum === " eteint" ? 0.15 : 1;
      }
    });
  }

  return {
    placer: placer,
    choisir: function (cle) { choisie = cle || null; placer(); },
    regler: function (r) { Object.assign(reglage, r); placer(); },
    detruire: function () { couche.textContent = ""; mots = []; pastilles = []; traits = []; fleches = []; }
  };
}
