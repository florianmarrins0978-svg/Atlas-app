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

// L'écran des démonstrations sur le site (390 × 664), photographié à trois
// pixels pour un : les images fixes font 1170 × 1992, comme celles des
// téléphones de cause-2.html, et le film 780 × 1328, comme son film de
// l'envoi signé.
const ECRAN = { l: 390, h: 664 }, ECHELLE = 3;
const FILM = { l: 780, h: 1328 };
const IPS = 60, PAS = 1000 / IPS;
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
    const temps = duree || Math.min(1000, 420 + Math.abs(d) * 0.25), debut = performance.now(), moi = {};
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
  window.__film = {
    glisser,
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
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('requestfailed', (r) => erreurs.push('introuvable : ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) erreurs.push(r.status() + ' : ' + r.url()); });
  await page.addInitScript(dansLaPage);
  await page.clock.install({ time: JOUR });
  await page.goto(ORIGINE + '/vente/demo/' + demo.page, { waitUntil: 'networkidle' });
  await page.waitForSelector(demo.pret, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  // Que l'écran se pose avant de figer le temps : une animation d'arrivée
  // commencée maintenant repartirait de zéro au premier recalage.
  await page.waitForTimeout(1500);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

  let bobine = null, rang = 0, nomDuFilm = '';
  const image = async () => {
    await page.clock.runFor(PAS);
    await page.evaluate(() => window.__film.synchro());
    // Hors d'un film (les images du chapitre), le temps avance sans photo.
    if (!nomDuFilm) return;
    rang++;
    if (APERCU) {
      if (rang % 15 === 1) await page.screenshot({ path: path.join(dossier, nomDuFilm + '-' + String(rang).padStart(4, '0') + '.png'), scale: 'css' });
      return;
    }
    await bobine.image(await page.screenshot({ type: 'png' }));
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
    const el = await trouver(sel, o);
    if (!el) throw new Error('introuvable dans ' + demo.page + ' : ' + sel + ' ' + JSON.stringify(o || {}));
    return el;
  };
  return {
    page, erreurs, pendant,
    async film(nom, jouer) {
      nomDuFilm = 'nov-film-' + nom;
      rang = 0;
      if (!APERCU) bobine = ouvrirBobine({ base: path.join(dossier, nomDuFilm), film: FILM, ips: IPS, x264: ['-crf', '22', '-tune', 'animation', '-level', '4.1', '-g', String(IPS * 20)], vp9: ['-crf', '36', '-g', String(IPS * 20)] });
      await jouer();
      if (erreurs.length) throw new Error(nom + ' : ' + erreurs.join(' ; '));
      console.log(nom + ' : ' + rang + ' images, ' + (rang / IPS).toFixed(2) + ' s');
      if (!APERCU) console.log('  écrits : ' + (await bobine.fermer()).join(', '));
    },
    /** Amène l'élément à « haut » pixels du haut de l'écran, en « secondes ». */
    async amener(sel, o, haut, secondes) {
      const el = await viser(sel, o);
      await page.evaluate(([y, ms]) => window.__film.glisser(y, ms), [el.haut - haut, secondes * 1000]);
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
const RECITS = {
  arrosage: {
    page: 'arrosage.html', pret: '[data-atlas="plan-arrosage"]',
    // Les deux images du chapitre, prises dans l'état où les films laissent
    // le jardin : la pelouse en Ø32, sur un réseau de 8 turbines à
    // recouvrement complet. Sa demande du 20 novembre au soir, devant la
    // carte en Ø25 (4 turbines sur un seul bord) : « les recouvrements ils
    // sont pas à 100 % ». La nourrice suit le plan : deux voies.
    // Rend aussi la place de « 20 m » sur la carte, où la cote du croquis se
    // pose (CIBLE_COTE dans vente/outils.html).
    async images(p) {
      await p.amener('[data-atlas="carte-reseau"]', {}, 120, 0.2);
      await p.toucher('[data-atlas="carte-reseau"] [data-atlas="choix-du-tuyau"] button', { texte: '32' });
      await p.pendant(1.5);
      await p.photographier('outils-plan-reseau.jpg', '[data-atlas="carte-reseau"]');
      const cible = await p.page.evaluate(() => {
        const carte = document.querySelector('[data-atlas="carte-reseau"]'), zone = carte.querySelector('[data-atlas="zone-du-reseau"]');
        const marche = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
        for (let n = marche.nextNode(); n; n = marche.nextNode()) {
          const i = n.textContent.indexOf('20 m');
          if (i < 0) continue;
          const plage = document.createRange(); plage.setStart(n, i); plage.setEnd(n, i + 4);
          const m = plage.getBoundingClientRect(), c = carte.getBoundingClientRect();
          return { x: ((m.left + m.width / 2 - c.left) / c.width).toFixed(4), y: ((m.top + m.height / 2 - c.top) / c.height).toFixed(4), l: (m.width / c.width).toFixed(4) };
        }
        return null;
      });
      console.log('CIBLE_COTE = ' + JSON.stringify(cible));
      // La nourrice de deux voies est plus haute que ce qui reste entre le
      // sommaire et la barre du bas : un écran plus haut la photographie
      // entière, la barre posée plus bas qu'elle.
      await p.page.setViewportSize({ width: ECRAN.l, height: 1200 });
      await p.photographier('outils-nourrice.jpg', '[data-atlas="nourrice-eclatee"] > div', { jusqua: ':scope > div', marge: 14 });
    },
    async jouer(p) {
      // 25 ou 32 : en Ø32, la pelouse tient sur un réseau de moins.
      await p.film('outils-tuyau', async () => {
        await p.pendant(0.7);
        await p.toucher(SOMMAIRE, { texte: 'Réseaux' });
        await p.pendant(1.5);
        await p.toucher('[data-atlas="carte-reseau"] [data-atlas="choix-du-tuyau"] button', { texte: '32' });
        await p.pendant(2.3);
      });
      // Une pièce de la nourrice : la changer, ou la supprimer.
      await p.film('outils-nourrice', async () => {
        await p.pendant(0.4);
        await p.toucher(SOMMAIRE, { texte: 'Nourrice' });
        await p.pendant(1.2);
        await p.amener('[data-atlas="piece-nourrice"]', { rang: 8 }, 300, 1.1);
        await p.pendant(0.5);
        await p.toucher('[data-atlas="piece-nourrice"]', { rang: 8 });
        await p.pendant(2.2);
        await p.toucher('[role="dialog"] button', GARDER);
        await p.pendant(0.8);
      });
      // Les turbines : une, ou toutes. La chaîne d'une tête monte juste sous
      // le sommaire : la ligne du PEHD, au-dessus d'elle, dit encore « Ø25 »
      // après le passage en Ø32 (PiecesDuReseau.tsx l'écrit en dur, TODO.md),
      // et le site ne montre pas un libellé faux.
      await p.film('outils-turbines', async () => {
        await p.pendant(0.4);
        await p.amener('[data-atlas="chaine"]', {}, 230, 1.6);
        await p.pendant(0.4);
        await p.toucher('[data-atlas="maillon"]', { rang: 4 });
        await p.pendant(2.2);
        await p.toucher('[role="dialog"] button', GARDER);
        await p.pendant(0.8);
      });
      // La liste, additionnée, puis le message au fournisseur.
      await p.film('outils-liste', async () => {
        await p.pendant(0.4);
        await p.toucher(SOMMAIRE, { texte: 'Liste' });
        await p.pendant(1.2);
        await p.amener('[data-atlas="total-de-la-liste"]', {}, 300, 2.6);
        await p.pendant(0.8);
        await p.toucher('[data-atlas="envoyer-fournisseur"]');
        await p.pendant(2.4);
      });
    },
  },
  diagnostic: {
    page: 'diagnostic.html', pret: '[data-atlas="prendre-photo-diagnostic"]',
    async jouer(p) {
      // Une photo, et la réponse.
      await p.film('outils-photo', async () => {
        await p.pendant(0.8);
        p.photo('diagnostic-anthracnose-platane-feuille.jpg', 'platane-exemple.jpg');
        await p.toucher('[data-atlas="prendre-photo-diagnostic"]');
        await p.pendant(4.2);
      });
      // Que faire, et est-ce grave.
      await p.film('outils-conduite', async () => {
        await p.pendant(0.4);
        await p.amener('[data-atlas="diagnostic-gravite"]', {}, 90, 2.0);
        await p.pendant(2.8);
      });
      // Le diagnostic rejoint le chantier du client.
      await p.film('outils-rattacher', async () => {
        await p.pendant(0.4);
        await p.amener('[data-atlas="diagnostic-details"]', {}, 260, 1.2);
        await p.toucher('[data-atlas="diagnostic-details"] summary');
        await p.pendant(0.8);
        await p.amener('[data-atlas="diagnostic-rattacher"]', {}, 260, 1.4);
        await p.pendant(0.6);
        await p.choisir('[data-atlas="diagnostic-rattacher"] select', 'Bernard');
        await p.pendant(0.9);
        await p.toucher('[data-atlas="diagnostic-rattacher"] button', { texte: 'Rattacher' });
        await p.pendant(2.2);
      });
    },
  },
  fiches: {
    page: 'fiches.html', pret: '[data-atlas="ouvrir-fiche-chantier"]',
    async jouer(p) {
      // Votre liste de prestations, composée une fois pour toutes.
      await p.film('outils-composer', async () => {
        await p.pendant(0.6);
        await p.toucher('[data-atlas="carte-composer-ma-fiche"]');
        await p.pendant(1.0);
        await p.toucher('button', { texte: 'Massifs' });
        await p.pendant(2.2);
      });
      // Une fiche pour M. Bernard : ses cases de la dernière fois.
      await p.film('outils-bernard', async () => {
        await p.pendant(0.3);
        await p.amener('a[aria-label^="Retour"]', {}, 14, 0.9);
        await p.pendant(0.2);
        await p.toucher('a[aria-label^="Retour"]');
        await p.pendant(0.9);
        await p.toucher('[data-atlas="ouvrir-fiche-chantier"]');
        await p.pendant(1.3);
        await p.toucher('[data-atlas="pont-client"]');
        await p.pendant(1.1);
        await p.toucher('[data-atlas="choix-du-client"] button', { contient: 'Bernard' });
        await p.pendant(1.4);
        await p.defiler(300, 1.6);
        await p.pendant(1.2);
      });
      // Enregistrée et envoyée.
      await p.film('outils-envoyer', async () => {
        await p.pendant(0.4);
        await p.amener(OBSERVATIONS, {}, 250, 2.0);
        await p.pendant(0.3);
        await p.toucher(OBSERVATIONS);
        await p.pendant(0.4);
        await p.ecrire('La haie du fond sera taillée la semaine prochaine.', 20);
        await p.pendant(0.6);
        await p.amener('[data-atlas="envoyer-fiche"]', {}, 380, 0.9);
        await p.pendant(0.3);
        await p.toucher('[data-atlas="envoyer-fiche"]');
        await p.pendant(2.4);
      });
      // Ce que lit le client, sur son téléphone.
      await p.page.evaluate(() => window.postMessage({ revenir: '/entretien/dernier' }, '*'));
      await p.page.waitForTimeout(600);
      await p.film('outils-client', async () => {
        await p.pendant(3.4);
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
