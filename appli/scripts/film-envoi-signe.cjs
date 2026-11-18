/* =======================================================================
   Le film « le client signe son devis » du site de vente (chapitre Envoyez
   de vente/cause-2.html).

   Sa demande du 18 novembre 2026 : « quand il clique sur accepter le devis,
   il y a le petit truc pour signer électroniquement qui apparaît. Il signe
   et ensuite sa signature vient s'apposer sur le devis. Ça serait bien que
   tu mettes cette animation sur le site. »

   La signature du devis est en cours de codage : il n'y a pas encore d'écran
   à filmer dans l'appli. La composition (film-envoi-signe.js, qui dit ce qui
   est vrai et ce qui est du montage) anime donc la planche qu'il a choisie,
   soignee/devis-signe-dans-une-feuille.html, c'est-à-dire la vraie page du
   client figée telle que l'appli la peint, avec le chantier de Mr. Lemaire
   à la place du jeu d'essai. Ce script l'y injecte, la photographie image
   par image et en tire vente/images/nov-film-envoi-signe.mp4, .webm,
   -debut.jpg et -fin.jpg (la mécanique commune est dans _pellicule.cjs).

   Il refuse de filmer dans trois cas, parce que chacun donnerait un film
   faux sans rien dire :
     un mot du jeu d'essai n'a pas été trouvé dans la planche (elle a été
       refigée autrement : il resterait « Mme Lefèvre » quelque part) ;
     la page ne se superpose plus à la première image du film d'avant, filmé
       dans l'appli (nov-film-envoi-debut.jpg) : une police absente de ce
       poste, une mise en page qui a bougé ;
     le caractère du PDF manque, et la mention « Signé en ligne par » serait
       composée dans un autre que la ligne qu'elle suit.

   Utilisation, depuis la racine du dépôt :
     node appli/scripts/film-envoi-signe.cjs appli/vente/images
     node appli/scripts/film-envoi-signe.cjs appli/vente/images --sans-film

   Il faut Playwright et ffmpeg (libx264, libvpx-vp9). Le navigateur est
   celui de PLAYWRIGHT_EXECUTABLE_PATH, comme pour tests/e2e.js.
   ======================================================================= */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { tourner, pixels } = require('./_pellicule.cjs');

const L = 390, H = 664, ECHELLE = 3;          // photographié à 1170 × 1992, trois pixels pour un
const IPS = 60;
// La taille du film d'avant, que la scène attend : 780 × 1328 à soixante
// images par seconde tient encore dans le niveau 4.1 de H.264.
const FILM = { l: 780, h: 1328 };
const FOND_PAGE = [245, 243, 238];
// Largeur de « Bon pour accord, signature du client » en Liberation Sans, à
// un corps de 100 : c'est le caractère du PDF.
const LARGEUR_DU_CARACTERE = 1601;

const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node appli/scripts/film-envoi-signe.cjs <dossier des images du site> [--sans-film]'); process.exit(2); }
const SANS_FILM = process.argv.includes('--sans-film');
const base = path.join(dossier, 'nov-film-envoi-signe');
const REFERENCE = path.resolve(__dirname, '../vente/images/nov-film-envoi-debut.jpg');

/** L'encre d'une image : vrai là où le pixel s'écarte du fond de la page. */
function encre(rvb) {
  const m = new Uint8Array(rvb.length / 3);
  for (let i = 0; i < m.length; i++) m[i] = Math.abs(rvb[3 * i] - FOND_PAGE[0]) + Math.abs(rvb[3 * i + 1] - FOND_PAGE[1]) + Math.abs(rvb[3 * i + 2] - FOND_PAGE[2]) > 90 ? 1 : 0;
  return m;
}

/**
 * Ce que deux images ont d'encre en commun, bande par bande : le pire
 * compte. Une seule ligne de texte qui a changé de place ou de caractère ne
 * pèse rien sur la page entière, et tout sur sa bande.
 */
function recouvrement(a, b) {
  const BANDE = 48;
  let pire = 1, bandes = 0;
  for (let y0 = 0; y0 < FILM.h; y0 += BANDE) {
    let commun = 0, tout = 0;
    for (let i = y0 * FILM.l, fin = Math.min(FILM.h, y0 + BANDE) * FILM.l; i < fin; i++) { if (a[i] && b[i]) commun++; if (a[i] || b[i]) tout++; }
    if (tout < 600) continue;                  // une bande sans encre ne dit rien
    bandes++;
    pire = Math.min(pire, commun / tout);
  }
  return { pire, bandes };
}

(async () => {
  const exe = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const navigateur = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await navigateur.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE })).newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('requestfailed', (r) => erreurs.push('introuvable : ' + r.url()));
  await page.goto('file://' + path.resolve(__dirname, '../soignee/devis-signe-dans-une-feuille.html'), { waitUntil: 'networkidle' });
  await page.addScriptTag({ path: path.resolve(__dirname, 'film-envoi-signe.js') });
  await page.waitForFunction(() => window.poser && [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => erreurs.push('le devis (vente/images/nov-devis.jpg) ne s\'est pas chargé'));
  await page.evaluate(() => document.fonts.ready);

  // ── Les trois refus ───────────────────────────────────────────────────────
  const calage = await page.evaluate(() => window.CALAGE || null);
  if (!calage) erreurs.push('la composition ne s\'est pas posée sur la planche');
  else {
    if (calage.manquent.length) erreurs.push('mots du jeu d\'essai introuvables dans la planche : ' + calage.manquent.join(', '));
    if (Math.abs(calage.largeurDuCaractere - LARGEUR_DU_CARACTERE) > 2) erreurs.push('le caractère du PDF (Liberation Sans) manque ici : la mention ferait ' + calage.largeurDuCaractere.toFixed(0) + ' au lieu de ' + LARGEUR_DU_CARACTERE);
  }
  if (!erreurs.length) {
    await page.evaluate(() => window.poser(0));
    const ici = encre(pixels(await page.screenshot({ type: 'png' }), FILM.l, FILM.h));
    const avant = encre(pixels(fs.readFileSync(REFERENCE), FILM.l, FILM.h));
    const r = recouvrement(ici, avant);
    console.log('Calage de la page sur la première image du film d\'avant : ' + (r.pire * 100).toFixed(1) + ' % d\'encre en commun dans la bande la moins bonne (' + r.bandes + ' bandes)');
    if (r.bandes < 8 || r.pire < 0.8) erreurs.push('la page ne se superpose pas à celle de l\'appli : il faut au moins 80 % en commun dans chaque bande');
  }
  if (erreurs.length) {
    console.error('REFUS : ' + erreurs.join(' ; '));
    await navigateur.close();
    process.exit(1);
  }

  const duree = await page.evaluate(() => window.DUREE);
  console.log(Math.round(duree * IPS) + ' images à ' + IPS + ' par seconde, soit ' + duree.toFixed(2) + ' s');
  if (SANS_FILM) { await navigateur.close(); return; }

  // Une seule image clé, comme pour la fiche d'intervention : le film ne se
  // lit que depuis son début.
  const ecrits = await tourner({
    page, base, film: FILM, ips: IPS, duree,
    x264: ['-crf', '23', '-tune', 'animation', '-level', '4.1', '-g', String(IPS * 10)],
    vp9: ['-crf', '37', '-g', String(IPS * 10)],
  });
  await navigateur.close();
  console.log('Écrits : ' + ecrits.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
