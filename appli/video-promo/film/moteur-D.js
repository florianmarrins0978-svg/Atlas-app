/*
  LE MOTEUR DES FILMS D : ce qui est commun aux trois directions, et au film.

  Pourquoi un moteur à part. La version C portait tout dans une seule page :
  le téléphone, les écrans, les titres, le rendu. Pour en faire trois
  directions puis un film, chaque page aurait recopié six cents lignes, et
  la première correction (le reflet du verre, l'ombre) aurait divergé entre
  elles. Ici, une page de film ne porte que son découpage : ce qui se passe
  à l'instant t. Le reste vit ici, une fois.

  UNE SEULE HORLOGE, toujours. Rien n'est animé par CSS : chaque page expose
  window.rendre(t) et ce moteur ne fait que POSER des éléments pour un
  instant donné. C'est ce qui permet le rendu image par image sans saccade
  (scripts/rendre-film.mjs), et l'arrêt sur n'importe quelle image (?t=).

  Ce que le moteur sait faire :
    · le temps : bornes, courbes, clés (cles), impacts ;
    · le téléphone : un objet ÉPAIS en CSS 3D (une pile de tranches), une
      lumière qui se calcule depuis son angle, un reflet qui balaie le verre,
      une ombre portée qui suit sa hauteur, et une pile d'écrans qui se
      poussent comme dans l'appli ;
    · la caméra : travelling, zoom, plongée dans l'écran, bougé ;
    · la matière : grain déterministe, vignette, étalonnage ;
    · le texte cinétique : mots et lettres posés un par un ;
    · l'appui du doigt, le cadre doré, le morceau d'écran qui voyage (le
      raccord), le chiffre qui se calcule.

  Rien ici n'est une capture : tout ce qui s'affiche DANS le téléphone vient
  des images que la page déclare, prises sur l'application servie.
*/
(function () {
  'use strict';

  // ─── le temps ────────────────────────────────────────────────────────────
  const borne = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lisse = x => { x = borne(x); return x * x * (3 - 2 * x); };
  const sortie = x => { x = borne(x); return 1 - Math.pow(1 - x, 3); };
  const sortieForte = x => { x = borne(x); return 1 - Math.pow(1 - x, 5); };
  const entreeCubique = x => { x = borne(x); return x * x * x; };
  const entreeSortie = x => { x = borne(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const ressort = x => { x = borne(x); const c = 1.35; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  // Un coup : la valeur dépasse puis revient, comme un objet qui frappe.
  const coup = x => { x = borne(x); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  // Une expo : part vite, finit très lentement. C'est la courbe des caméras.
  const expo = x => { x = borne(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
  const entre = (t, a, b) => borne((t - a) / (b - a));
  const mix = (a, b, p) => a + (b - a) * p;
  // Une fenêtre : 0 avant a, 1 entre a+montee et b-descente, 0 après b.
  const fenetre = (t, a, b, montee = .3, descente = montee) =>
    sortie(entre(t, a, a + montee)) * (1 - lisse(entre(t, b - descente, b)));

  // Une valeur qui passe par des clés [t, v], lissée entre chacune ; une clé
  // peut porter sa propre courbe en troisième position.
  function cles(t, liste, f = lisse) {
    if (t <= liste[0][0]) return liste[0][1];
    for (let i = 1; i < liste.length; i++) {
      if (t <= liste[i][0]) return mix(liste[i - 1][1], liste[i][1], (liste[i][2] || f)(entre(t, liste[i - 1][0], liste[i][0])));
    }
    return liste[liste.length - 1][1];
  }

  // Un bruit lisse et déterministe, pour les dérives : la somme de trois
  // sinus incommensurables. Jamais Math.random : deux rendus doivent donner
  // le même film.
  const derive = (t, graine = 0) =>
    (Math.sin(t * 0.73 + graine) + Math.sin(t * 1.31 + graine * 2.1) * .5 + Math.sin(t * 2.17 + graine * .7) * .25) / 1.75;

  // Un hachage entier déterministe (pour le grain).
  function hache(n) {
    n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296;
  }

  const $ = id => document.getElementById(id);
  const css = (el, props) => { for (const k in props) el.style[k] = props[k]; };
  // Deux couleurs hexadécimales mélangées : p = 0 rend a, p = 1 rend b.
  const melange = (a, b, p) => {
    p = borne(p);
    const ca = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), cb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${ca.map((v, i) => Math.round(v + (cb[i] - v) * p)).join(',')})`;
  };

  // ─── la scène et la caméra ───────────────────────────────────────────────
  //
  // Le MONDE est un plan de 1080 × 1920 (ou ce que la page demande) dans
  // lequel tout est posé en coordonnées fixes. La CAMÉRA est une transformation
  // de ce plan : elle regarde un point (x, y), à un zoom, avec une rotation.
  // Déplacer la caméra plutôt que chaque élément, c'est ce qui donne les
  // travellings et les plongées dans l'écran sans toucher au découpage.
  function creerScene({ largeur = 1080, hauteur = 1920, perspective = 2600 } = {}) {
    const scene = $('scene');
    const monde = $('monde');
    css(monde, { position: 'absolute', left: '0', top: '0', width: `${largeur}px`, height: `${hauteur}px`, transformOrigin: '0 0', willChange: 'transform' });
    css(scene, { perspective: `${perspective}px`, perspectiveOrigin: '50% 50%' });
    let bouge = { x: 0, y: 0, rz: 0 };
    return {
      largeur, hauteur,
      // Regarder le point (x, y) du monde, zoomé, tourné de rz degrés.
      poser({ x = largeur / 2, y = hauteur / 2, zoom = 1, rz = 0, secousse = 0, t = 0 } = {}) {
        // Le bougé de caméra : une main qui tient, jamais un tremblement.
        if (secousse > 0) {
          bouge = { x: derive(t * 9, 3) * 14 * secousse, y: derive(t * 11, 5) * 10 * secousse, rz: derive(t * 7, 9) * .5 * secousse };
        } else bouge = { x: 0, y: 0, rz: 0 };
        monde.style.transform =
          `translate(${largeur / 2 + bouge.x}px, ${hauteur / 2 + bouge.y}px) rotate(${rz + bouge.rz}deg) scale(${zoom}) translate(${-x}px, ${-y}px)`;
      },
    };
  }

  // ─── la matière : vignette, étalonnage, lueur ──────────────────────────
  //
  // LE GRAIN N'EST PLUS DESSINÉ ICI. Une tuile de bruit en `mix-blend-mode`
  // coûtait 450 ms par image à la capture (mesuré le 4 octobre 2026 : une
  // image passait de 2 s à 1,5 s sans elle), pour un effet que ffmpeg sait
  // poser en sortie, à graine fixe, pour rien (`rendre-film.mjs --grain`).
  // Même raison pour l'étalonnage : un `soft-light` plein cadre coûtait deux
  // fois un voile ordinaire, pour une teinte que l'œil ne distingue pas.
  function creerMatiere({ largeur = 1080, hauteur = 1920 } = {}) {
    const vignette = $('vignette');
    css(vignette, { position: 'absolute', inset: '0', zIndex: '55', pointerEvents: 'none' });
    const etalonnage = $('etalonnage');
    css(etalonnage, { position: 'absolute', inset: '0', zIndex: '50', pointerEvents: 'none', opacity: '.55' });
    const lueur = $('lueur');
    css(lueur, { position: 'absolute', left: '0', top: '0', width: '1200px', height: '1200px', marginLeft: '-600px', marginTop: '-600px', borderRadius: '50%', pointerEvents: 'none', zIndex: '1', willChange: 'transform,opacity' });
    return {
      poser(t, { vignetteForce = .5, lueurX = largeur / 2, lueurY = 0, lueurForce = .25, lueurCouleur = '201,161,94', teinte = 'rgba(47,59,47,.35)', teinte2 = 'rgba(201,161,94,.18)' } = {}) {
        void t;
        vignette.style.background = `radial-gradient(85% 62% at 50% 46%, rgba(0,0,0,0) 48%, rgba(0,0,0,${vignetteForce}) 100%)`;
        etalonnage.style.background = `linear-gradient(160deg, ${teinte} 0%, rgba(0,0,0,0) 45%, ${teinte2} 100%)`;
        lueur.style.transform = `translate(${lueurX}px, ${lueurY}px)`;
        lueur.style.background = `radial-gradient(circle, rgba(${lueurCouleur},${lueurForce}) 0%, rgba(${lueurCouleur},0) 60%)`;
      },
    };
  }

  // ─── le téléphone ────────────────────────────────────────────────────────
  //
  // Un objet ÉPAIS : dix-huit tranches empilées en Z font le chant, un cadre
  // devant, une plaque derrière. Vu de face, c'est un téléphone ; tourné,
  // son épaisseur apparaît, et c'est elle qui lui donne du poids. Les
  // proportions sont celles d'un téléphone de 71,6 × 147,6 × 7,8 mm.
  //
  // L'ÉCRAN mesure 620 px de large pour une appli de 390 : K = 620 / 390.
  // Les captures font 1170 px (échelle 3) : au zoom de la caméra, elles
  // restent nettes jusqu'à presque deux fois la taille du téléphone.
  const K = 620 / 390;
  function creerTelephone({ parent, ecrans = [], largeur = 664, hauteur = 1386, rayon = 92, epaisseur = 72, tranches = 18, ecranLargeur = 620, ecranHauteur = 1342, marge = 22, teinte = 'graphite' } = {}) {
    const racine = document.createElement('div');
    racine.className = 'telephone';
    css(racine, { position: 'absolute', left: '0', top: '0', width: `${largeur}px`, height: `${hauteur}px`, transformOrigin: '50% 50%', transformStyle: 'preserve-3d', willChange: 'transform' });
    parent.appendChild(racine);

    const couleurs = teinte === 'titane'
      ? { chant: ['#b9b6ae', '#6f6d67', '#8c8a83'], cadre: '#2a2b28', dos: '#3a3b37' }
      : { chant: ['#5c5f5a', '#1d1f1c', '#34362f'], cadre: '#101210', dos: '#1a1c19' };

    // LE CHANT : quatre faces droites, et quatre coins en tranches.
    //
    // La première version empilait dix-huit tranches pleines (664 × 1386 px
    // chacune) : le chant était juste, et chaque image coûtait 900 ms de plus
    // à composer, parce que le compositeur dessine toute la surface d'une
    // couche, transparente ou non. Une face droite est une bande de 72 px ;
    // un coin est un carré de 92 px. Même silhouette, vingt fois moins de
    // pixels à composer.
    const E = epaisseur, R = rayon;
    const faces = [];
    const face = (style) => {
      const f = document.createElement('div');
      css(f, { position: 'absolute', backfaceVisibility: 'hidden', ...style });
      racine.appendChild(f); faces.push(f); return f;
    };
    // Chaque face est un plan posé HORS du rectangle, sur son arête, puis
    // rabattu vers l'arrière (Z négatif) de sorte que sa face avant regarde
    // vers l'extérieur. Posée à l'intérieur et rabattue, sa normale pointait
    // vers le cœur du téléphone et `backface-visibility` la cachait : la
    // première planche montrait un chant sans épaisseur entre les coins.
    face({ left: `${R}px`, top: `${-E}px`, width: `${largeur - 2 * R}px`, height: `${E}px`, transformOrigin: '50% 100%', transform: 'rotateX(90deg)' });
    face({ left: `${R}px`, top: `${hauteur}px`, width: `${largeur - 2 * R}px`, height: `${E}px`, transformOrigin: '50% 0', transform: 'rotateX(-90deg)' });
    face({ left: `${-E}px`, top: `${R}px`, width: `${E}px`, height: `${hauteur - 2 * R}px`, transformOrigin: '100% 50%', transform: 'rotateY(-90deg)' });
    face({ left: `${largeur}px`, top: `${R}px`, width: `${E}px`, height: `${hauteur - 2 * R}px`, transformOrigin: '0 50%', transform: 'rotateY(90deg)' });
    const coins = [];
    const COINS = [
      ['0', '0', 'borderTopLeftRadius'], [`${largeur - R}px`, '0', 'borderTopRightRadius'],
      ['0', `${hauteur - R}px`, 'borderBottomLeftRadius'], [`${largeur - R}px`, `${hauteur - R}px`, 'borderBottomRightRadius'],
    ];
    for (const [left, top, arrondi] of COINS) {
      for (let k = 0; k < tranches; k++) {
        const c = document.createElement('div');
        const z = -(k + 1) * (E / tranches);
        css(c, { position: 'absolute', left, top, width: `${R}px`, height: `${R}px`, [arrondi]: `${R}px`, transform: `translateZ(${z}px)` });
        racine.appendChild(c); coins.push({ el: c, profondeur: k / (tranches - 1) });
      }
    }
    const dos = document.createElement('div');
    css(dos, { position: 'absolute', inset: '0', borderRadius: `${rayon}px`, transform: `translateZ(${-epaisseur}px) rotateY(180deg)`, background: `linear-gradient(135deg, ${couleurs.dos}, #0c0d0b)`, backfaceVisibility: 'hidden' });
    racine.appendChild(dos);

    const cadre = document.createElement('div');
    css(cadre, { position: 'absolute', inset: '0', borderRadius: `${rayon}px`, background: couleurs.cadre, transform: 'translateZ(0.5px)', backfaceVisibility: 'hidden' });
    racine.appendChild(cadre);
    const liseré = document.createElement('div');
    css(liseré, { position: 'absolute', inset: '0', borderRadius: `${rayon}px`, transform: 'translateZ(0.8px)', pointerEvents: 'none', willChange: 'box-shadow' });
    racine.appendChild(liseré);

    const ecran = document.createElement('div');
    css(ecran, { position: 'absolute', left: `${marge}px`, top: `${marge}px`, width: `${ecranLargeur}px`, height: `${ecranHauteur}px`, borderRadius: `${rayon - 20}px`, overflow: 'hidden', background: '#07080a', transform: 'translateZ(1px)', backfaceVisibility: 'hidden' });
    racine.appendChild(ecran);

    // La pile d'écrans : une image par capture, toutes dans l'écran, posées
    // par poserEcrans(t, ECRANS) selon le même découpage que la version C
    // (mode : fondu, glisse, monte, net) ; chacune peut défiler.
    const images = {};
    for (const { nom, src, haut } of ecrans) {
      const img = new Image(); img.src = src; img.alt = ''; img.dataset.ecran = nom;
      css(img, { position: 'absolute', left: '0', top: `${haut || 0}px`, width: `${ecranLargeur}px`, willChange: 'transform,opacity', opacity: '0' });
      ecran.appendChild(img); images[nom] = img;
    }
    const voile = document.createElement('div');
    css(voile, { position: 'absolute', inset: '0', background: '#000', opacity: '0', pointerEvents: 'none' });
    ecran.appendChild(voile);
    // L'allumage : un noir qui se lève quand le téléphone s'éveille.
    const noir = document.createElement('div');
    css(noir, { position: 'absolute', inset: '0', background: '#07080a', opacity: '1', zIndex: '2000', pointerEvents: 'none' });
    ecran.appendChild(noir);
    const encoche = document.createElement('div');
    css(encoche, { position: 'absolute', left: '50%', top: '40px', width: '190px', height: '52px', marginLeft: '-95px', borderRadius: '30px', background: '#07080a', zIndex: '2100' });
    ecran.appendChild(encoche);
    // Le verre : un reflet fixe très doux, et un reflet qui balaie.
    const verre = document.createElement('div');
    css(verre, { position: 'absolute', inset: '0', zIndex: '2200', pointerEvents: 'none', willChange: 'background' });
    ecran.appendChild(verre);
    const balayage = document.createElement('div');
    css(balayage, { position: 'absolute', left: '-80%', top: '-30%', width: '260%', height: '160%', zIndex: '2300', pointerEvents: 'none', opacity: '0', background: 'linear-gradient(108deg, rgba(255,255,255,0) 44%, rgba(255,255,255,.22) 50%, rgba(255,255,255,0) 56%)', willChange: 'transform,opacity' });
    ecran.appendChild(balayage);
    // L'appui du doigt et le cadre doré vivent dans l'écran, en pixels d'appli.
    const anneau = document.createElement('div');
    css(anneau, { position: 'absolute', width: '120px', height: '120px', margin: '-60px 0 0 -60px', borderRadius: '50%', border: '5px solid #C9A15E', opacity: '0', zIndex: '2400', pointerEvents: 'none', willChange: 'transform,opacity' });
    const point = document.createElement('div');
    css(point, { position: 'absolute', width: '54px', height: '54px', margin: '-27px 0 0 -27px', borderRadius: '50%', background: 'rgba(201,161,94,.55)', opacity: '0', zIndex: '2400', pointerEvents: 'none', willChange: 'transform,opacity' });
    const repere = document.createElement('div');
    css(repere, { position: 'absolute', border: '5px solid #C9A15E', borderRadius: '22px', boxShadow: '0 0 0 6px rgba(201,161,94,.14)', opacity: '0', zIndex: '2400', pointerEvents: 'none', willChange: 'opacity' });
    ecran.append(anneau, point, repere);

    // L'ombre portée : hors du contexte 3D, posée sur le sol de la scène.
    // Un dégradé radial, jamais un `filter: blur` : flouter une couche de la
    // taille du téléphone coûtait 100 ms par image, pour la même tache sombre.
    const ombre = document.createElement('div');
    css(ombre, { position: 'absolute', left: `${-largeur * .2}px`, top: `${-hauteur * .1}px`, width: `${largeur * 1.4}px`, height: `${hauteur * 1.2}px`, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(0,0,0,.62) 0%, rgba(0,0,0,.42) 38%, rgba(0,0,0,.12) 60%, rgba(0,0,0,0) 72%)', transformOrigin: '50% 50%', willChange: 'transform,opacity', pointerEvents: 'none' });
    parent.insertBefore(ombre, racine);

    const tel = {
      el: racine, ecran, images, ombre, K,
      largeur, hauteur, ecranLargeur, ecranHauteur, marge,
      // Où tombe, dans le MONDE, un point (x, y) de l'appli, pour la pose
      // courante (sans rotation). Sert à la caméra pour viser un bouton.
      pointDeLAppli(x, y) {
        const p = tel.pose;
        return { x: p.x + (marge + x * K - largeur / 2) * p.echelle, y: p.y + (marge + y * K - hauteur / 2) * p.echelle };
      },
      pose: { x: 540, y: 960, rx: 0, ry: 0, rz: 0, echelle: 1, hauteurSol: 0 },
      // La pose : position du CENTRE dans le monde, angles en degrés, échelle,
      // hauteur au-dessus du sol (pour l'ombre), lumière (angle en degrés
      // d'où elle vient, 0 = à droite, 90 = en haut), allumage de l'écran.
      poser({ x = 540, y = 960, z = 0, rx = 0, ry = 0, rz = 0, echelle = 1, hauteurSol = 60, lumiere = 120, force = 1, allume = 1, opacite = 1, flou = 0, balaye = null } = {}) {
        tel.pose = { x, y, rx, ry, rz, echelle, hauteurSol };
        racine.style.transform = `translate3d(${x - largeur / 2}px, ${y - hauteur / 2}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${echelle})`;
        racine.style.opacity = String(opacite);
        racine.style.filter = flou > .05 ? `blur(${flou}px)` : 'none';
        // La lumière sur le chant : le côté tourné vers elle s'éclaire. ry > 0
        // montre le chant gauche ; la lumière vient de l'angle `lumiere`.
        const rad = lumiere * Math.PI / 180;
        const versLaLumiereX = Math.cos(rad), versLaLumiereY = -Math.sin(rad);
        const faceX = Math.sin(ry * Math.PI / 180), faceY = -Math.sin(rx * Math.PI / 180);
        const eclaire = borne(.5 + .5 * (faceX * versLaLumiereX + faceY * versLaLumiereY) * 1.6) * force;
        // Chaque face du chant reçoit la lumière selon son orientation : une
        // face tournée vers elle s'éclaircit, l'opposée s'assombrit. Des
        // couleurs calculées, jamais un `filter` (coûteux à composer).
        const [clair, sombre, moyen] = couleurs.chant;
        const normales = [[0, -1], [0, 1], [-1, 0], [1, 0]];   // haut, bas, gauche, droite
        // Le dégradé part de l'arête qui touche la face avant (le chanfrein
        // clair) et va vers le dos : haut, bas, gauche, droite n'ont pas la
        // même arête de départ.
        const directions = ['0deg', '180deg', '270deg', '90deg'];
        faces.forEach((f, k) => {
          const [nx, ny] = normales[k];
          const e = borne(.5 + .5 * (nx * versLaLumiereX + ny * versLaLumiereY)) * force;
          f.style.background = `linear-gradient(${directions[k]}, ${melange(clair, moyen, 1 - e * .8)} 0%, ${melange(sombre, moyen, e * .5)} 12%, ${melange(sombre, moyen, e * .4)} 100%)`;
        });
        // Les coins prennent la couleur du chant à leur profondeur : le tout
        // premier porte le chanfrein clair, comme le haut des faces ; les
        // autres suivent le dégradé des faces, sans quoi ils ressortent en
        // blocs clairs aux angles (vu sur la première image rendue).
        coins.forEach(({ el, profondeur }) => {
          el.style.background = profondeur === 0 ? melange(clair, moyen, 1 - eclaire * .8) : melange(sombre, moyen, eclaire * .4);
        });
        liseré.style.boxShadow = `inset ${versLaLumiereX * 2}px ${versLaLumiereY * 2}px 0 0 rgba(255,255,255,${.1 + .22 * eclaire * force}), inset ${-versLaLumiereX * 2}px ${-versLaLumiereY * 2}px 0 0 rgba(0,0,0,.35)`;
        // Le verre : un voile très doux venant de la lumière.
        verre.style.background = `linear-gradient(${lumiere + 90}deg, rgba(255,255,255,${.07 * force}) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 70%, rgba(255,255,255,${.03 * force}) 100%)`;
        // Le balayage : si la page le demande, le reflet traverse l'écran.
        if (balaye !== null) {
          const p = borne(balaye);
          balayage.style.opacity = p > 0 && p < 1 ? String(force) : '0';
          balayage.style.transform = `translateX(${mix(-45, 45, p)}%)`;
        } else balayage.style.opacity = '0';
        noir.style.opacity = String(1 - borne(allume));
        // L'ombre : sous l'objet, décalée à l'opposé de la lumière, plus
        // large et plus pâle quand il flotte haut.
        const h = Math.max(0, hauteurSol);
        ombre.style.transform = `translate3d(${x - largeur / 2 - versLaLumiereX * h * .9}px, ${y - hauteur / 2 - versLaLumiereY * h * .9 + h * .35}px, 0) rotate(${rz}deg) scale(${echelle * (1 + h / 700) * (1 - Math.abs(ry) / 220)}, ${echelle * (1 + h / 700)})`;
        ombre.style.opacity = String(borne(.8 / (1 + h / 350)) * opacite * force);
      },
      // La pile d'écrans, selon un découpage [nom, apparaît, disparaît, mode, défilement?]
      // Un écran reste sous le suivant le temps que la poussée finisse.
      poserEcrans(t, ECRANS) {
        let voileOp = 0, voileZ = 0;
        // Un même écran peut revenir plus loin dans le découpage (la fiche
        // client, après l'éditeur de lignes) : une entrée hors de son temps
        // n'éteint pas l'image qu'une autre entrée, elle, montre.
        const actifs = new Set(ECRANS.filter(([, de, a]) => t >= de && t <= a).map(([nom]) => nom));
        ECRANS.forEach((e, k) => {
          const [nom, de, a, mode] = e;
          const img = images[nom];
          if (!img) return;
          if (t < de || t > a) { if (!actifs.has(nom)) img.style.opacity = '0'; return; }
          const p = mode === 'net' ? 1 : sortieForte(entre(t, de, de + .42));
          let x = 0, y = 0, op = 1;
          if (mode === 'glisse') x = ecranLargeur * (1 - p);
          else if (mode === 'monte') y = ecranHauteur * (1 - p);
          else if (mode === 'fondu') op = p;
          const defile = e[4] ? cles(t, e[4]) * K : 0;
          img.style.opacity = String(op);
          img.style.transform = `translate(${x}px, ${y - defile}px)`;
          img.style.zIndex = String(Math.round(de * 10) + 10);
          if (mode === 'glisse' && p < 1) {
            // L'écran recouvert recule et s'assombrit, comme dans l'appli.
            let prec = -1;
            ECRANS.forEach((f, j) => { if (j !== k && f[1] < de && (prec < 0 || f[1] > ECRANS[prec][1])) prec = j; });
            if (prec >= 0) {
              const ip = images[ECRANS[prec][0]];
              if (ip) ip.style.transform = `translate(${-190 * p}px, ${-(ECRANS[prec][4] ? cles(t, ECRANS[prec][4]) * K : 0)}px)`;
              voileOp = .3 * p; voileZ = Math.round(ECRANS[prec][1] * 10) + 11;
            }
          }
        });
        voile.style.opacity = String(voileOp); voile.style.zIndex = String(voileZ);
      },
      // L'appui du doigt sur un bouton : [instant, x, y] en pixels de l'appli.
      poserAppui(t, APPUIS) {
        const ap = APPUIS.find(([d]) => t >= d - .25 && t < d + .55);
        if (!ap) { anneau.style.opacity = '0'; point.style.opacity = '0'; return; }
        const [d, x, y] = ap;
        const p = entre(t, d, d + .55);
        anneau.style.left = point.style.left = `${x * K}px`;
        anneau.style.top = point.style.top = `${y * K}px`;
        point.style.opacity = String(t < d ? sortie(entre(t, d - .25, d)) : 1 - p);
        point.style.transform = `scale(${t < d ? mix(1.4, 1, sortie(entre(t, d - .25, d))) : mix(1, .8, p)})`;
        anneau.style.opacity = String(t < d ? 0 : 1 - p);
        anneau.style.transform = `scale(${mix(.4, 1.6, sortie(p))})`;
      },
      // Un cadre doré qui désigne sans toucher : [de, à, x, y, largeur, hauteur].
      poserRepere(t, REPERES) {
        const rp = REPERES.find(([d, a]) => t >= d && t < a);
        if (!rp) { repere.style.opacity = '0'; return; }
        const [d, a, x, y, w, h] = rp;
        css(repere, { left: `${x * K}px`, top: `${y * K}px`, width: `${w * K}px`, height: `${h * K}px` });
        repere.style.opacity = String(sortie(entre(t, d, d + .3)) * (1 - lisse(entre(t, a - .3, a))));
      },
    };
    return tel;
  }

  // ─── le texte cinétique ──────────────────────────────────────────────────
  //
  // Un titre se pose mot par mot, ou lettre par lettre : chaque morceau est
  // un span posé une fois pour toutes (la mise en page ne bouge pas), et
  // animer() ne touche qu'à l'opacité et au déplacement de chacun.
  function decouper(el, mode = 'mots') {
    const texte = el.textContent;
    el.textContent = '';
    const morceaux = [];
    if (mode === 'lettres') {
      for (const ch of texte) {
        const s = document.createElement('span');
        s.textContent = ch;
        css(s, { display: 'inline-block', willChange: 'transform,opacity', whiteSpace: 'pre' });
        el.appendChild(s); morceaux.push(s);
      }
    } else {
      texte.split(/(\s+)/).forEach(part => {
        if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(part)); return; }
        if (!part) return;
        const s = document.createElement('span');
        s.textContent = part;
        css(s, { display: 'inline-block', willChange: 'transform,opacity' });
        el.appendChild(s); morceaux.push(s);
      });
    }
    return morceaux;
  }
  // Pose les morceaux pour l'instant t : chacun entre à `debut + k·pas`,
  // en `duree`, selon un mode ; et sort tous ensemble à `fin`.
  function animer(morceaux, t, { debut, pas = .07, duree = .5, mode = 'monte', fin = Infinity, dureeSortie = .35, decalage = 50 } = {}) {
    const s = fin < Infinity ? lisse(entre(t, fin, fin + dureeSortie)) : 0;
    morceaux.forEach((m, k) => {
      const p = entre(t, debut + k * pas, debut + k * pas + duree);
      let op = 1, tr = '';
      if (mode === 'monte') { const e = sortie(p); op = e; tr = `translateY(${decalage * (1 - e)}px)`; }
      else if (mode === 'descend') { const e = sortie(p); op = e; tr = `translateY(${-decalage * (1 - e)}px)`; }
      else if (mode === 'coup') { const e = coup(p); op = borne(p * 4); tr = `scale(${mix(1.6, 1, e)})`; }
      else if (mode === 'frappe') { op = p > 0 ? 1 : 0; tr = ''; }
      else if (mode === 'fondu') { op = sortie(p); }
      else if (mode === 'glisse') { const e = expo(p); op = e; tr = `translateX(${-decalage * (1 - e)}px)`; }
      else if (mode === 'flou') { const e = sortie(p); op = e; m.style.filter = p < 1 ? `blur(${(1 - e) * 18}px)` : 'none'; }
      m.style.opacity = String(op * (1 - s));
      m.style.transform = tr + (s > 0 ? ` translateY(${-30 * s}px)` : '');
    });
  }

  // ─── le chiffre qui se calcule ───────────────────────────────────────────
  // Un montant qui monte de 0 à sa valeur, en euros français. Jamais un
  // chiffre inventé : la valeur vient de la page, qui la tient de la capture.
  function montant(el, t, { de, a, valeur, prefixe = '', suffixe = ' €', courbe = sortieForte }) {
    const p = courbe(entre(t, de, a));
    const v = valeur * p;
    const entier = Math.floor(v), cents = Math.round((v - entier) * 100);
    const groupe = String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    el.textContent = `${prefixe}${groupe},${String(cents).padStart(2, '0')}${suffixe}`;
  }

  // ─── le morceau d'écran qui voyage : le raccord ──────────────────────────
  //
  // Un rectangle d'une capture (en pixels d'appli) est copié dans un calque
  // à part, hors du téléphone, et transporté vers un autre rectangle d'une
  // autre capture. Entre les deux, il grandit, tourne, et l'image de départ
  // se fond dans celle d'arrivée. C'est ce qui fait qu'une ligne du devis
  // DEVIENT la case du planning, au lieu d'être remplacée par elle.
  function creerMorceau({ parent, de, vers }) {
    // de / vers : { src, zone: [x, y, w, h] en pixels de l'IMAGE, largeurSource }.
    // Le cadre vit en unités : 1000 de large, et une hauteur qui suit la
    // zone ; chaque image est posée pour que SA zone remplisse ces 1000.
    const cadre = document.createElement('div');
    css(cadre, { position: 'absolute', left: '0', top: '0', width: '1000px', overflow: 'hidden', borderRadius: '10px', transformOrigin: '0 0', willChange: 'transform,opacity', opacity: '0', background: '#faf9f5', boxShadow: '0 40px 90px rgba(0,0,0,.45)', zIndex: '30' });
    parent.appendChild(cadre);
    const faire = ({ src, zone, largeurSource }) => {
      const img = new Image(); img.src = src; img.alt = '';
      const k = 1000 / zone[2];
      css(img, { position: 'absolute', left: `${-zone[0] * k}px`, top: `${-zone[1] * k}px`, width: `${largeurSource * k}px`, willChange: 'opacity' });
      cadre.appendChild(img); return img;
    };
    const imgDe = faire(de), imgVers = faire(vers);
    const hauteurDe = 1000 * de.zone[3] / de.zone[2], hauteurVers = 1000 * vers.zone[3] / vers.zone[2];
    return {
      el: cadre,
      // Pose le morceau : son CENTRE au point (x, y) du monde, sa largeur
      // affichée, sa rotation, et p (0 : image de départ, 1 : image d'arrivée).
      poser({ x, y, largeur, rz = 0, rx = 0, ry = 0, p = 0, opacite = 1, ombre = 1 }) {
        const h = mix(hauteurDe, hauteurVers, p);
        const echelle = largeur / 1000;
        css(cadre, { height: `${h}px`, opacity: String(opacite), boxShadow: `0 ${40 * ombre}px ${90 * ombre}px rgba(0,0,0,${.45 * ombre})`, transform: `translate(${x}px, ${y}px) perspective(2200px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rz}deg) scale(${echelle}) translate(-500px, ${-h / 2}px)` });
        const fondu = lisse(entre(p, .35, .65));
        imgDe.style.opacity = String(1 - fondu);
        imgVers.style.opacity = String(fondu);
      },
    };
  }

  // ─── le lancement : horloge, image figée, boucle ─────────────────────────
  function demarrer({ duree, rendre, pret }) {
    window.DUREE = duree;
    window.rendre = rendre;
    window.pret = Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {})), pret || Promise.resolve()]);
    const params = new URLSearchParams(location.search);
    const fige = params.get('t');
    if (fige !== null) window.pret.then(() => rendre(+fige));
    else if (!params.has('image')) {
      window.pret.then(() => {
        const debut = performance.now();
        const tour = () => { rendre(((performance.now() - debut) / 1000) % duree); requestAnimationFrame(tour); };
        tour();
      });
    }
  }

  window.MoteurD = {
    borne, lisse, sortie, sortieForte, entreeCubique, entreeSortie, ressort, coup, expo, entre, mix, fenetre, cles, derive, hache,
    creerScene, creerMatiere, creerTelephone, decouper, animer, montant, creerMorceau, demarrer, melange, K, $,
  };
})();
