/* =======================================================================
   Les films des outils de paysage (vente/outils.html).

   Sa demande du 20 novembre 2026, devant les démonstrations à toucher :
   « Je veux pas que ça soit l'utilisateur de cliquer. Je veux que ça soit
   comme s'il regardait un film. Comme on a fait sur le site internet
   normal. Il défile et puis il y a des mises en scène. »

   On filme donc les démonstrations elles-mêmes (vente/demo/*.html) : les
   vrais écrans de l'appli, montés sans serveur par
   demo-outils/construire.ts. Un film par geste ; les films d'un outil se
   tournent d'une traite, et chacun commence où le précédent s'arrête.

   Le temps de la page est figé (l'horloge de Playwright) et n'avance que
   d'une image à la fois : les minuteries, les images d'animation, et les
   animations de l'appli elle-même, qui sont recalées sur ce temps à chaque
   image (window.__film.synchro). Un défilement doux de l'appli, qui se
   jouerait sinon en temps réel entre deux photos, glisse lui aussi sur ce
   temps. Le film est ainsi le même à chaque tournage, et l'appli y bouge à
   sa vraie vitesse.

   Rien n'est dessiné sur l'écran : ni doigt, ni pastille, ni anneau (ses
   retours le refusent). Un geste est un vrai appui de la souris, enfoncé
   puis relâché : c'est l'appli qui répond, comme sous le doigt.

   LA CAMÉRA, comme dans les films de cause-2.html. Sa remarque du
   20 novembre au soir, devant des films qui montraient l'écran entier en
   petit : « on voit rien […] sur le site internet, regarde comment c'est
   fait. C'est fluide, c'est léger. Toi, tu fonces. » Chaque film s'approche
   de ce qu'on va toucher, puis accompagne la réponse de l'appli (la feuille
   qui s'ouvre, la ligne qui change), et finit sur elle, jamais sur un écran
   refermé. La caméra est de la photographie seule : on photographie une
   part de l'écran, que le film agrandit ; l'appli, elle, ne sait rien et
   peint à sa taille. Elle ne recule jamais sur un écran immobile (ce qu'il
   a vu comme un bug dans un film d'avant) : un changement de cadre
   accompagne toujours un geste ou une réponse.

   Utilisation, depuis la racine du dépôt :
     node appli/scripts/film-outils.cjs appli/vente/images
     node appli/scripts/film-outils.cjs appli/vente/images --seulement diagnostic
     node appli/scripts/film-outils.cjs <dossier> --apercu
       (une photo par quart de seconde, sans film, pour régler le récit)
     node appli/scripts/film-outils.cjs appli/vente/images --images
       (seulement les deux images du chapitre du plan, sans film)

   Il faut Playwright et ffmpeg (libx264, libvpx-vp9). Le navigateur est
   celui du poste (scripts/_navigateur.mjs), ou PLAYWRIGHT_EXECUTABLE_PATH.
   ======================================================================= */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { ouvrirBobine } = require('./_pellicule.cjs');

// Sa remarque du 20 novembre au soir, devant les premiers films : « tu
// passes trop vite, on n'a pas le temps de voir ». Chaque réponse de l'appli
// reste donc à l'écran deux secondes au moins, les défilements sont lents,
// et un film commence là où son geste se passe : d'un film à l'autre,
// l'écran se replace sans être filmé (ce sont deux téléphones sur le site).

// L'écran des démonstrations sur le site (390 × 664), photographié à trois
// pixels pour un : les images fixes font 1170 × 1992, comme celles des
// téléphones de cause-2.html, et le film 780 × 1328, comme son film de
// l'envoi signé.
const ECRAN = { l: 390, h: 664 }, ECHELLE = 3;
const FILM = { l: 780, h: 1328 };
const IPS = 60, PAS = 1000 / IPS;
// Douze films ralentis font sept mille images : aux réglages les plus lents
// de _pellicule.cjs, une heure et demie d'encodage. Ces réglages-ci (les
// derniers donnés l'emportent) le font trois fois plus vite, pour un écran
// d'appli, à plat, une différence qui ne se voit pas.
const ENCODAGE = {
  x264: ['-preset', 'slow', '-crf', '22', '-tune', 'animation', '-level', '4.1', '-g', String(IPS * 20)],
  vp9: ['-cpu-used', '3', '-crf', '36', '-g', String(IPS * 20)],
};
const APPLI = path.resolve(__dirname, '..');
const ORIGINE = 'http://cause.essai';
// Le jour des films : un vendredi, en fin de journée de chantier. L'heure
// s'écrit sur la fiche envoyée ; prise au poste, elle changeait à chaque
// tournage (21:05 le premier soir).
const JOUR = new Date('2026-11-20T17:36:00+01:00');

const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node appli/scripts/film-outils.cjs <dossier des images du site> [--seulement <outil>] [--apercu]'); process.exit(2); }
const APERCU = process.argv.includes('--apercu');
const IMAGES_SEULES = process.argv.includes('--images');
const seul = process.argv.indexOf('--seulement') > 0 ? process.argv[process.argv.indexOf('--seulement') + 1] : null;

// ── Ce qui se pose dans la page avant l'appli ──────────────────────────────
// Le défilement doux glisse sur le temps de la page, et les animations sont
// recalées sur lui à chaque image. Une animation vue pour la première fois
// part de l'image où on la voit.
function dansLaPage() {
  const vraiScrollTo = window.scrollTo.bind(window);
  const vraiIntoView = Element.prototype.scrollIntoView;
  const doux = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  let enCours = null;
  const glisser = (vers, duree) => {
    const de = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
    const but = Math.max(0, Math.min(max, vers)), d = but - de;
    enCours = null;
    if (Math.abs(d) < 1) return;
    const temps = duree || Math.min(1800, 700 + Math.abs(d) * 0.4), debut = performance.now(), moi = {};
    enCours = moi;
    const pas = () => {
      if (enCours !== moi) return;
      const p = Math.min(1, (performance.now() - debut) / temps);
      vraiScrollTo(0, de + d * doux(p));
      if (p < 1) requestAnimationFrame(pas); else enCours = null;
    };
    requestAnimationFrame(pas);
  };
  window.scrollTo = function (a, b) {
    if (a && typeof a === 'object') {
      if (a.behavior === 'smooth') return glisser(a.top === undefined ? window.scrollY : a.top);
      enCours = null;
      return vraiScrollTo(a.left || 0, a.top === undefined ? window.scrollY : a.top);
    }
    enCours = null;
    return vraiScrollTo(a, b);
  };
  window.scroll = window.scrollTo;
  Element.prototype.scrollIntoView = function (o) {
    if (!o || typeof o !== 'object' || o.behavior !== 'smooth') return vraiIntoView.call(this, o);
    const r = this.getBoundingClientRect(), y = r.top + window.scrollY;
    const marge = parseFloat(getComputedStyle(this).scrollMarginTop) || 0;
    if (o.block === 'center') return glisser(y - (window.innerHeight - r.height) / 2);
    if (o.block === 'end') return glisser(y - window.innerHeight + r.height);
    return glisser(y - marge);
  };
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = 'html{scroll-behavior:auto!important}';
    document.head.appendChild(style);
  });
  // Le défilement d'une liste DANS une feuille (le catalogue de « Changer la
  // pièce ») : même courbe, sur la boîte qui défile autour de l'élément.
  const glisserDans = (el, haut, duree) => {
    let boite = el.parentElement;
    while (boite && !(boite.scrollHeight > boite.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(boite).overflowY))) boite = boite.parentElement;
    if (!boite) return false;
    const de = boite.scrollTop, but = Math.max(0, Math.min(boite.scrollHeight - boite.clientHeight, de + el.getBoundingClientRect().top - boite.getBoundingClientRect().top - haut));
    const debut = performance.now();
    const pas = () => {
      const p = Math.min(1, (performance.now() - debut) / duree);
      boite.scrollTop = de + (but - de) * doux(p);
      if (p < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
    return true;
  };
  window.__film = {
    glisser, glisserDans,
    synchro() {
      const t = performance.now();
      for (const a of document.getAnimations()) {
        if (a.__fini) continue;
        if (a.__debut === undefined) { a.__debut = t; a.pause(); }
        const ici = t - a.__debut, fin = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
        if (Number.isFinite(fin) && ici >= fin) { a.__fini = true; a.finish(); } else a.currentTime = ici;
      }
    },
  };
}

// ── Le plateau : une démonstration ouverte, et les gestes qu'on y fait ─────
async function plateau(navigateur, demo) {
  const contexte = await navigateur.newContext({ viewport: { width: ECRAN.l, height: ECRAN.h }, deviceScaleFactor: ECHELLE, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  // Les fichiers du site se servent depuis le disque : aucun serveur.
  await contexte.route(ORIGINE + '/**', (route) => {
    const fichier = path.join(APPLI, decodeURIComponent(new URL(route.request().url()).pathname));
    if (!fichier.startsWith(APPLI) || !fs.existsSync(fichier)) return route.fulfill({ status: 404, body: 'introuvable' });
    return route.fulfill({ path: fichier });
  });
  const erreurs = [];
  // Une page du plateau, au temps figé. « style » s'ajoute à la sienne : il
  // cache ce qui, dans une planche, n'est pas l'écran de l'appli.
  const ouvrir = async (adresse, pret, style) => {
    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreurs.push(e.message));
    page.on('requestfailed', (r) => erreurs.push('introuvable : ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400) erreurs.push(r.status() + ' : ' + r.url()); });
    await page.addInitScript(dansLaPage);
    if (style) await page.addInitScript((css) => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }), style);
    await page.clock.install({ time: JOUR });
    await page.goto(ORIGINE + adresse, { waitUntil: 'networkidle' });
    await page.waitForSelector(pret, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    // Que l'écran se pose avant de figer le temps : une animation d'arrivée
    // commencée maintenant repartirait de zéro au premier recalage.
    await page.waitForTimeout(1500);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    return page;
  };
  let page = await ouvrir('/vente/demo/' + demo.page, demo.pret);

  let bobine = null, rang = 0, nomDuFilm = '', horloge = 0;
  // La caméra : le centre de ce qu'on photographie (en pixels d'écran) et
  // l'agrandissement. Un mouvement va d'un cadre à l'autre en ralentissant
  // aux deux bouts, image par image.
  const PLEIN = { x: ECRAN.l / 2, y: ECRAN.h / 2, z: 1 };
  let camera = PLEIN, mouvement = null;
  const doux = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const cameraMaintenant = () => {
    if (!mouvement) return camera;
    const t = Math.min(1, (horloge - mouvement.debut) / mouvement.images), e = doux(t), { de, vers } = mouvement;
    const c = { x: de.x + (vers.x - de.x) * e, y: de.y + (vers.y - de.y) * e, z: de.z * Math.pow(vers.z / de.z, e) };
    if (t >= 1) { camera = vers; mouvement = null; }
    return c;
  };
  const cadreDe = (c) => {
    const l = ECRAN.l / c.z, h = ECRAN.h / c.z;
    return { x: Math.max(0, Math.min(ECRAN.l - l, c.x - l / 2)), y: Math.max(0, Math.min(ECRAN.h - h, c.y - h / 2)), width: l, height: h };
  };
  const image = async () => {
    await page.clock.runFor(PAS);
    await page.evaluate(() => window.__film.synchro());
    horloge++;
    const cadre = cadreDe(cameraMaintenant());
    // Hors d'un film (les images du chapitre), le temps avance sans photo.
    if (!nomDuFilm) return;
    rang++;
    if (APERCU) {
      if (rang % 15 === 1) await page.screenshot({ path: path.join(dossier, nomDuFilm + '-' + String(rang).padStart(4, '0') + '.png'), scale: 'css', clip: cadre });
      return;
    }
    await bobine.image(await page.screenshot({ type: 'png', clip: cadre }));
  };
  const pendant = async (secondes) => { for (let k = Math.round(secondes * IPS); k > 0; k--) await image(); };
  const trouver = (sel, o = {}) => page.evaluate(([sel, o]) => {
    let liste = Array.from(document.querySelectorAll(sel));
    if (o.texte) liste = liste.filter((el) => el.textContent.trim() === o.texte);
    if (o.contient) liste = liste.filter((el) => el.textContent.includes(o.contient));
    const el = liste[o.rang || 0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, haut: r.top + window.scrollY, h: r.height };
  }, [sel, o]);
  const viser = async (sel, o) => {
    // Un écran « serveur » se compose par promesses, hors du temps figé : on
    // lui laisse un peu de temps réel avant de conclure qu'il manque.
    let el = await trouver(sel, o);
    for (let essai = 0; !el && essai < 40; essai++) {
      await page.waitForTimeout(50);
      el = await trouver(sel, o);
    }
    if (!el) {
      // L'écran tel qu'il était, pour voir ce qui manquait.
      await page.screenshot({ path: path.join(dossier, 'refus.png') });
      throw new Error('introuvable dans ' + demo.page + ' : ' + sel + ' ' + JSON.stringify(o || {}) + ' (l\'écran : ' + path.join(dossier, 'refus.png') + ')');
    }
    return el;
  };
  return {
    get page() { return page; },
    erreurs, pendant,
    /**
     * La suite du film se tourne sur une autre page, d'une coupe : un écran
     * qui n'existe pas encore dans l'appli et que sa planche pose sur la
     * vraie page (la fiche de diagnostic soignée).
     */
    async passerA(adresse, pret, style) {
      page = await ouvrir(adresse, pret, style);
    },
    async film(nom, jouer) {
      nomDuFilm = 'nov-film-' + nom;
      rang = 0;
      if (!APERCU) bobine = ouvrirBobine({ base: path.join(dossier, nomDuFilm), film: FILM, ips: IPS, x264: ENCODAGE.x264, vp9: ENCODAGE.vp9, fixes: { l: ECRAN.l * ECHELLE, h: ECRAN.h * ECHELLE } });
      await jouer();
      if (erreurs.length) throw new Error(nom + ' : ' + erreurs.join(' ; '));
      console.log(nom + ' : ' + rang + ' images, ' + (rang / IPS).toFixed(2) + ' s');
      if (!APERCU) console.log('  écrits : ' + (await bobine.fermer()).join(', '));
      nomDuFilm = '';
      camera = PLEIN; mouvement = null;
    },
    /**
     * Déplace la caméra, en « secondes » (0 : d'un coup, entre deux films).
     * Le cadre se centre en hauteur sur l'élément (décalé de dy), et reste
     * au milieu de l'écran en largeur (décalé de dx), avec l'agrandissement
     * z ; sans élément, l'écran entier à z.
     */
    async cadrer({ sel, o, z = 1, dx = 0, dy = 0 }, secondes) {
      let vers = { x: PLEIN.x, y: PLEIN.y, z };
      if (sel) {
        const el = await viser(sel, o);
        vers = { x: PLEIN.x + dx, y: el.y + dy, z };
      }
      // Le centre retenu est celui du cadre réellement photographié : un
      // élément près d'un bord ne fait pas glisser la caméra hors de l'écran.
      const c = cadreDe(vers);
      vers = { x: c.x + c.width / 2, y: c.y + c.height / 2, z };
      if (!secondes) { camera = vers; mouvement = null; return; }
      mouvement = { de: cameraMaintenant(), vers, debut: horloge, images: Math.max(1, Math.round(secondes * IPS)) };
    },
    /** Entre deux films : l'élément à « haut » pixels du haut, sans être filmé. */
    async placer(sel, o, haut) {
      const el = await viser(sel, o);
      await page.evaluate((y) => window.scrollTo(0, y), el.haut - haut);
      await pendant(0.5);
    },
    /** Amène l'élément à « haut » pixels du haut de l'écran, en « secondes ». */
    async amener(sel, o, haut, secondes) {
      const el = await viser(sel, o);
      await page.evaluate(([y, ms]) => window.__film.glisser(y, ms), [el.haut - haut, secondes * 1000]);
      await pendant(secondes);
    },
    /** Dans une feuille : l'élément à « haut » pixels du haut de sa liste. */
    async amenerDansLaFeuille(sel, o, haut, secondes) {
      const trouve = await page.evaluate(([sel, o, haut, ms]) => {
        let liste = Array.from(document.querySelectorAll(sel));
        if (o.texte) liste = liste.filter((el) => el.textContent.trim() === o.texte);
        if (o.contient) liste = liste.filter((el) => el.textContent.includes(o.contient));
        const el = liste[o.rang || 0];
        return !!el && window.__film.glisserDans(el, haut, ms);
      }, [sel, o || {}, haut, secondes * 1000]);
      if (!trouve) throw new Error('aucune liste à faire défiler autour de ' + sel + ' ' + JSON.stringify(o || {}));
      await pendant(secondes);
    },
    /** Un appui : enfoncé, tenu le temps qu'on le voie, relâché. */
    async toucher(sel, o) {
      const el = await viser(sel, o);
      if (el.y < 0 || el.y > ECRAN.h) throw new Error('hors de l\'écran : ' + sel + ' ' + JSON.stringify(o || {}));
      await page.mouse.move(el.x, el.y);
      await page.mouse.down();
      await pendant(0.14);
      await page.mouse.up();
    },
    /** Fait défiler l'écran de « dy » pixels, en « secondes ». */
    async defiler(dy, secondes) {
      await page.evaluate(([dy, ms]) => window.__film.glisser(window.scrollY + dy, ms), [dy, secondes * 1000]);
      await pendant(secondes);
    },
    /** Tape un texte, lettre à lettre, dans le champ qui a la main. */
    async ecrire(texte, lettresParSeconde) {
      for (const lettre of texte) {
        await page.keyboard.type(lettre);
        await pendant(1 / lettresParSeconde);
      }
    },
    /** Choisit dans une liste déroulante l'option qui contient ce texte. */
    async choisir(sel, contient) {
      const valeur = await page.evaluate(([sel, contient]) => {
        const option = Array.from(document.querySelectorAll(sel + ' option')).find((o) => o.textContent.includes(contient));
        return option ? option.value : null;
      }, [sel, contient]);
      if (valeur === null) throw new Error('aucune option « ' + contient + ' » dans ' + sel);
      await page.selectOption(sel, valeur);
    },
    /**
     * Une photo fixe d'une part de l'écran, à trois pixels pour un : de
     * l'élément, haut et bas étendus de « marge », jusqu'au bas de « jusqua »
     * s'il est donné. L'élément est d'abord amené en haut de l'écran.
     */
    async photographier(fichier, sel, { jusqua, marge = 0 } = {}) {
      const cadre = await page.evaluate(([sel, jusqua, marge]) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70);
        const r = el.getBoundingClientRect(), bas = jusqua ? el.querySelector(jusqua).getBoundingClientRect().bottom + marge : r.bottom;
        return { x: r.left, y: r.top, width: r.width, height: bas - r.top };
      }, [sel, jusqua, marge]);
      if (!cadre) throw new Error('introuvable dans ' + demo.page + ' : ' + sel);
      await page.evaluate(() => window.__film.synchro());
      await page.screenshot({ path: path.join(dossier, fichier), type: 'jpeg', quality: 88, clip: cadre });
      console.log(fichier + ' : ' + Math.round(cadre.width) + ' × ' + Math.round(cadre.height));
    },
    /** Une photo fixe de l'écran entier, à trois pixels pour un. */
    async photographierEcran(fichier) {
      await page.evaluate(() => window.__film.synchro());
      await page.screenshot({ path: path.join(dossier, fichier), type: 'jpeg', quality: 88 });
      console.log(fichier + ' : l\'écran');
    },
    /** La photo que donnera le prochain appareil photo ouvert par l'appli. */
    photo(fichier, nom) {
      page.once('filechooser', (choix) => choix.setFiles({ name: nom, mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(APPLI, fichier)) }));
    },
    async fermer() { await contexte.close(); },
  };
}

// ── Les récits ─────────────────────────────────────────────────────────────
const SOMMAIRE = '[data-atlas="sommaire-du-plan"] button';
const GARDER = { texte: 'Garder' };
const OBSERVATIONS = 'textarea[placeholder^="Ce que le client"]';
const BASCULE = '[data-atlas="bascule"] [role="switch"]';
const TUYAU_DU_RESEAU_1 = '[data-atlas="carte-reseau"] [data-atlas="choix-du-tuyau"]';
const EZ_FLO = 'EZ FLO+ 1" MM solénoïde 9V';
// Le rapprochement de la caméra. Les cartes de l'appli prennent toute la
// largeur de l'écran, à 22 pixels des bords : au-delà de 1,12, un mot sur
// deux se coupait au bord du cadre. C'est aussi ce que font les films de
// cause-2.html, qui ne s'approchent que d'un dixième.
const ZOOM = 1.12;
// La fiche de diagnostic soignée, sur sa planche : l'écran de l'appli seul,
// sans le titre ni les notes de la planche.
const FICHE_SOIGNEE = '/soignee/fiche-de-diagnostic.html';
const PRET_FICHE = '[data-atlas="ecran-diagnostic-resultat"]';
const CACHER_LA_PLANCHE = '.planche-tete,.planche-notes,.planche-dit{display:none!important}';
const RECITS = {
  arrosage: {
    page: 'arrosage.html', pret: '[data-atlas="plan-arrosage"]',
    // Les deux images du chapitre, prises sur le jardin tel que le calcul le
    // pose, en Ø25. Sa demande du 20 novembre au soir, devant la carte du
    // seul réseau 1 (4 turbines sur un bord, la pelouse à moitié couverte) :
    // « tu mets réseau 1, 4 [turbines 3504]. En dessous, tu mets réseau 2
    // avec une autre couleur. Et tu me remets 4 [turbines] en face qui se
    // recoupent. » L'image est donc les deux cartes, l'une sous l'autre comme
    // l'appli les pose ; la nourrice va avec, en trois voies.
    // Rend aussi la place de « 20 m » sur la carte du réseau 1, où la cote du
    // croquis se pose (CIBLE_COTE dans vente/outils.html).
    async images(p) {
      // Deux cartes et la nourrice sont plus hautes que ce qui reste entre le
      // sommaire et la barre du bas : un écran plus haut les prend entières.
      await p.page.setViewportSize({ width: ECRAN.l, height: 1200 });
      const cadre = await p.page.evaluate(() => {
        const cartes = document.querySelectorAll('[data-atlas="carte-reseau"]');
        window.scrollTo(0, cartes[0].getBoundingClientRect().top + window.scrollY - 80);
        const haut = cartes[0].getBoundingClientRect(), bas = cartes[1].getBoundingClientRect();
        const r = { x: haut.left, y: haut.top, width: haut.width, height: bas.bottom - haut.top };
        const zone = cartes[0].querySelector('[data-atlas="zone-du-reseau"]'), marche = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
        for (let n = marche.nextNode(); n; n = marche.nextNode()) {
          const i = n.textContent.indexOf('20 m');
          if (i < 0) continue;
          const plage = document.createRange(); plage.setStart(n, i); plage.setEnd(n, i + 4);
          const m = plage.getBoundingClientRect();
          r.cible = { x: ((m.left + m.width / 2 - r.x) / r.width).toFixed(4), y: ((m.top + m.height / 2 - r.y) / r.height).toFixed(4), l: (m.width / r.width).toFixed(4) };
        }
        return r;
      });
      await p.page.evaluate(() => window.__film.synchro());
      await p.page.screenshot({ path: path.join(dossier, 'outils-plan-reseau.jpg'), type: 'jpeg', quality: 88, clip: { x: cadre.x, y: cadre.y, width: cadre.width, height: cadre.height } });
      console.log('outils-plan-reseau.jpg : ' + Math.round(cadre.width) + ' × ' + Math.round(cadre.height));
      console.log('CIBLE_COTE = ' + JSON.stringify(cadre.cible));
      await p.photographier('outils-nourrice.jpg', '[data-atlas="nourrice-eclatee"] > div', { jusqua: ':scope > div', marge: 14 });
    },
    async jouer(p) {
      const DIALOGUE = '[role="dialog"]';
      // 25 ou 32 : en Ø32, la pelouse tient sur un réseau de moins.
      await p.placer('[data-atlas="reseaux"]', {}, 64);
      await p.film('outils-tuyau', async () => {
        await p.pendant(1.2);
        await p.cadrer({ sel: TUYAU_DU_RESEAU_1, z: ZOOM }, 1.1);
        await p.pendant(1.4);
        await p.toucher(TUYAU_DU_RESEAU_1 + ' button', { texte: '32' });
        await p.pendant(0.5);
        await p.cadrer({ sel: '[data-atlas="carte-reseau"]', z: ZOOM, dy: -40 }, 1.2);
        await p.pendant(3.2);
      });
      // La nourrice à votre idée : une sonde de pluie, le grillage
      // avertisseur, et chacun s'ajoute à la liste. Le téflon n'est pas au
      // catalogue, et l'appli le dit : le film ne le touche pas.
      await p.placer('[data-atlas="nourrice"]', {}, 64);
      await p.film('outils-options', async () => {
        await p.pendant(1.0);
        await p.cadrer({ sel: BASCULE + '[aria-label="Grillage avertisseur"]', z: ZOOM, dy: 10 }, 1.1);
        await p.pendant(1.3);
        await p.toucher(BASCULE + '[aria-label="Sonde de pluie"]');
        await p.pendant(1.8);
        await p.toucher(BASCULE + '[aria-label="Grillage avertisseur"]');
        await p.pendant(0.4);
        await p.cadrer({ sel: BASCULE + '[aria-label="Grillage avertisseur"]', z: ZOOM, dy: 70 }, 1.0);
        await p.pendant(2.8);
      });
      // Une pièce de la nourrice : la changer, ou la supprimer. L'électrovanne
      // Rain Bird 1" MM 9 V à impulsion devient une Toro EZ FLO+ 1" MM, au
      // solénoïde 9 V à impulsion : même filetage, même pile, le même
      // programmateur la commande.
      const PIECE_9 = '[data-atlas="piece-nourrice"]';
      await p.placer(PIECE_9, { rang: 8 }, 300);
      await p.film('outils-nourrice', async () => {
        await p.pendant(1.0);
        await p.cadrer({ sel: PIECE_9, o: { rang: 8 }, z: ZOOM }, 1.1);
        await p.pendant(1.2);
        await p.toucher(PIECE_9, { rang: 8 });
        await p.pendant(0.3);
        await p.cadrer({ sel: DIALOGUE, z: ZOOM }, 1.0);
        await p.pendant(1.8);
        await p.toucher(DIALOGUE + ' button', { texte: 'Changer' });
        await p.pendant(0.3);
        await p.cadrer({ sel: DIALOGUE + ' button', o: { texte: 'Électrovannes' }, z: ZOOM, dy: 60 }, 1.0);
        await p.pendant(1.2);
        await p.toucher(DIALOGUE + ' button', { texte: 'Électrovannes' });
        await p.pendant(1.2);
        await p.amenerDansLaFeuille(DIALOGUE + ' button', { contient: EZ_FLO }, 140, 1.4);
        await p.cadrer({ sel: DIALOGUE + ' button', o: { contient: EZ_FLO }, z: ZOOM }, 0.9);
        await p.pendant(1.3);
        await p.toucher(DIALOGUE + ' button', { contient: EZ_FLO });
        await p.pendant(0.6);
        await p.cadrer({ sel: PIECE_9, o: { rang: 8 }, z: ZOOM }, 1.0);
        await p.pendant(2.8);
      });
      // Les turbines : une, ou toutes. La chaîne d'une tête monte juste sous
      // le sommaire : la ligne du PEHD, au-dessus d'elle, dit encore « Ø25 »
      // après le passage en Ø32 (PiecesDuReseau.tsx l'écrit en dur, TODO.md),
      // et le site ne montre pas un libellé faux.
      await p.placer('[data-atlas="chaine"]', {}, 230);
      await p.film('outils-turbines', async () => {
        await p.pendant(1.0);
        await p.cadrer({ sel: '[data-atlas="chaine"]', z: ZOOM }, 1.1);
        await p.pendant(1.3);
        await p.toucher('[data-atlas="maillon"]', { rang: 4 });
        await p.pendant(0.3);
        await p.cadrer({ sel: DIALOGUE, z: ZOOM }, 1.0);
        await p.pendant(3.2);
      });
      await p.toucher(DIALOGUE + ' button', GARDER);
      // La liste, additionnée, puis le message au fournisseur.
      await p.placer('[data-atlas="liste"]', {}, 64);
      await p.film('outils-liste', async () => {
        await p.pendant(1.0);
        await p.amener('[data-atlas="total-de-la-liste"]', {}, 260, 4.2);
        await p.cadrer({ sel: '[data-atlas="total-de-la-liste"]', z: ZOOM }, 1.0);
        await p.pendant(1.8);
        await p.cadrer({ sel: '[data-atlas="envoyer-fournisseur"]', z: ZOOM }, 1.0);
        await p.pendant(0.6);
        await p.toucher('[data-atlas="envoyer-fournisseur"]');
        await p.pendant(0.3);
        await p.cadrer({ sel: DIALOGUE + ' textarea', z: ZOOM, dy: -40 }, 1.1);
        await p.pendant(3.2);
      });
    },
  },
  diagnostic: {
    page: 'diagnostic.html', pret: '[data-atlas="prendre-photo-diagnostic"]',
    // Sa demande du 20 novembre au soir : « Pour le diagnostic végétal,
    // utilise que la brunissure des feuilles de peuplier en exemple », sur
    // la fiche de sa planche soignée (appli/soignee/fiche-de-diagnostic.html,
    // vue Proposé), qu'une autre session code. La démonstration de l'appli
    // n'a que la fiche du platane : le film y prend la photo, coupe pendant
    // l'analyse, et la réponse est la fiche du peuplier telle que la planche
    // la pose sur la vraie page. « Et pareil, tu vas trop vite. Fais défiler
    // doucement, qu'on ait un petit peu le temps de lire. Ou même tu peux
    // mettre à côté des captures figées » : les trois captures de « La
    // fiche, à lire » (images, plus bas).
    async images(p) {
      await p.passerA(FICHE_SOIGNEE, PRET_FICHE, CACHER_LA_PLANCHE);
      await p.photographierEcran('outils-diagnostic.jpg');
      await p.placer('h2', { contient: 'Est-ce grave' }, 90);
      await p.photographierEcran('outils-fiche-a-lire-gravite.jpg');
      await p.placer('h2', { contient: 'Que faire' }, 90);
      await p.photographierEcran('outils-fiche-a-lire-que-faire.jpg');
    },
    async jouer(p) {
      // Une photo, et la réponse.
      await p.film('outils-photo', async () => {
        await p.pendant(1.0);
        await p.cadrer({ sel: '[data-atlas="prendre-photo-diagnostic"]', z: ZOOM, dy: -60 }, 1.1);
        await p.pendant(1.0);
        // Le nom que la démonstration attend : la photo, elle, est la feuille
        // du peuplier. La réponse de la démonstration (le platane) n'est pas
        // filmée.
        p.photo('diagnostic-brunissure-peuplier-feuille.jpg', 'platane-exemple.jpg');
        await p.toucher('[data-atlas="prendre-photo-diagnostic"]');
        await p.pendant(1.4);
        await p.passerA(FICHE_SOIGNEE, PRET_FICHE, CACHER_LA_PLANCHE);
        await p.pendant(2.8);
        await p.amener('h2', { contient: 'À quoi ça ressemble' }, 80, 3.0);
        await p.pendant(2.8);
      });
      // Est-ce grave, et que faire : lu lentement.
      await p.placer('h2', { contient: 'Est-ce grave' }, 90);
      await p.film('outils-gravite', async () => {
        await p.pendant(3.4);
        await p.amener('h2', { contient: 'Que faire' }, 90, 3.4);
        await p.pendant(4.0);
      });
      // Les détails : comment le reconnaître, puis « Voir les détails ».
      await p.placer('h2', { contient: 'Comment le reconnaître' }, 90);
      await p.film('outils-details', async () => {
        await p.pendant(2.8);
        await p.amener('summary', { contient: 'Voir les détails' }, 330, 3.4);
        await p.pendant(0.6);
        await p.toucher('summary', { contient: 'Voir les détails' });
        await p.pendant(1.2);
        await p.defiler(360, 3.4);
        await p.pendant(3.0);
      });
    },
  },
  fiches: {
    page: 'fiches.html', pret: '[data-atlas="ouvrir-fiche-chantier"]',
    async jouer(p) {
      // Votre liste de prestations, composée une fois pour toutes.
      await p.film('outils-composer', async () => {
        await p.pendant(1.0);
        await p.cadrer({ sel: '[data-atlas="carte-composer-ma-fiche"]', z: ZOOM, dy: 60 }, 1.1);
        await p.pendant(0.9);
        await p.toucher('[data-atlas="carte-composer-ma-fiche"]');
        await p.pendant(1.2);
        await p.cadrer({ sel: 'button', o: { texte: 'Massifs' }, z: ZOOM, dy: 120 }, 1.0);
        await p.pendant(0.8);
        await p.toucher('button', { texte: 'Massifs' });
        await p.pendant(3.2);
      });
      // Une fiche pour M. Bernard : ses cases de la dernière fois. Le retour
      // à la liste des fiches se fait entre deux films.
      await p.placer('a[aria-label^="Retour"]', {}, 14);
      await p.toucher('a[aria-label^="Retour"]');
      await p.pendant(1.0);
      await p.film('outils-bernard', async () => {
        await p.pendant(1.0);
        await p.cadrer({ sel: '[data-atlas="ouvrir-fiche-chantier"]', z: ZOOM, dy: -40 }, 1.0);
        await p.pendant(0.8);
        await p.toucher('[data-atlas="ouvrir-fiche-chantier"]');
        await p.pendant(1.0);
        await p.cadrer({ sel: '[data-atlas="pont-client"]', z: ZOOM, dy: 60 }, 1.0);
        await p.pendant(0.8);
        await p.toucher('[data-atlas="pont-client"]');
        await p.pendant(1.0);
        await p.cadrer({ sel: '[data-atlas="choix-du-client"] button', o: { contient: 'Bernard' }, z: ZOOM }, 0.9);
        await p.pendant(0.8);
        await p.toucher('[data-atlas="choix-du-client"] button', { contient: 'Bernard' });
        await p.pendant(0.5);
        await p.cadrer({ z: ZOOM }, 1.1);
        await p.pendant(1.4);
        await p.defiler(300, 2.6);
        await p.pendant(2.0);
      });
      // Une remarque, et c'est envoyé.
      await p.film('outils-envoyer', async () => {
        await p.pendant(1.0);
        await p.amener(OBSERVATIONS, {}, 250, 2.6);
        await p.cadrer({ sel: OBSERVATIONS, z: ZOOM, dy: 20 }, 1.0);
        await p.pendant(0.6);
        await p.toucher(OBSERVATIONS);
        await p.pendant(0.5);
        await p.ecrire('La haie du fond sera taillée la semaine prochaine.', 14);
        await p.pendant(1.0);
        await p.amener('[data-atlas="envoyer-fiche"]', {}, 380, 1.4);
        await p.cadrer({ sel: '[data-atlas="envoyer-fiche"]', z: ZOOM, dy: -50 }, 1.0);
        await p.pendant(0.6);
        await p.toucher('[data-atlas="envoyer-fiche"]');
        await p.pendant(3.4);
      });
      // Ce que lit le client, sur son téléphone.
      await p.page.evaluate(() => window.postMessage({ revenir: '/entretien/dernier' }, '*'));
      await p.page.waitForTimeout(600);
      await p.film('outils-client', async () => {
        await p.pendant(1.4);
        await p.cadrer({ sel: '[data-atlas="rapport-entretien"] p', o: { contient: 'La haie du fond' }, z: ZOOM, dy: -150 }, 1.4);
        await p.pendant(2.6);
      });
    },
  },
};

(async () => {
  fs.mkdirSync(dossier, { recursive: true });
  const { cheminDuNavigateur } = await import('../../scripts/_navigateur.mjs');
  const exe = cheminDuNavigateur();
  const navigateur = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const [nom, recit] of Object.entries(RECITS)) {
    if (seul && seul !== nom) continue;
    if (recit.images) {
      const p = await plateau(navigateur, recit);
      await recit.images(p);
      await p.fermer();
    }
    if (IMAGES_SEULES) continue;
    const p = await plateau(navigateur, recit);
    if (p.erreurs.length) throw new Error(nom + ' ne s\'ouvre pas : ' + p.erreurs.join(' ; '));
    await recit.jouer(p);
    await p.fermer();
  }
  await navigateur.close();
})().catch((e) => { console.error('REFUS : ' + (e && e.message ? e.message : e)); process.exit(1); });
