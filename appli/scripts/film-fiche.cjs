/* =======================================================================
   Le film de la fiche d'intervention du site de vente : du trajet au retour
   du soir (chapitre Planifiez de vente/cause-2-visite.html).

   Ses demandes : le 18 novembre 2026, Maps puis l'appel au client depuis la
   fiche ; le 19, réunir dans la même cinématique les travaux cochés et le
   retour du soir, qui vivaient plus bas dans la page (« Ça fait peut-être
   une cinématique de moins »). Il a dit oui à la fusion, et oui pour filmer
   l'appli d'aujourd'hui sur une base d'essai.

   Le film est fait des écrans de l'appli, figés au tournage dans
   rushes/fiche/ (tournage/tourner-fiche.mjs les y range avec leurs photos).
   Le montage (film-fiche.js) dit ce qui vient de l'appli, ce qui est dessiné
   (la carte et l'écran d'appel) et ce qui est du montage. Ce script
   l'injecte dans les rushes, le photographie image par image, à soixante par
   seconde, et en tire vente/images/nov-film-fiche.mp4, .webm, -debut.jpg et
   -fin.jpg (la mécanique commune est dans _pellicule.cjs).

   L'écran garde la largeur du tournage (402, un iPhone 16 Pro, écran
   tactile) : c'est elle qui décide de ce que l'appli peint. Le film n'en
   photographie que le cadre : la fiche au repos (294 × 521) et huit pixels
   de la page autour d'elle, soit 310 × 537.

   Il refuse de filmer quand la fiche du film ne se superpose pas à ses
   photos prises dans l'appli aux mêmes étapes du geste : au repos, dépliée,
   les quatre travaux cochés, la remarque tapée, le retour envoyé, et l'écran
   du patron. Un écart veut dire qu'une police manque sur ce poste, ou que
   les rushes et le montage ne vont plus ensemble.

   Utilisation, depuis la racine du dépôt :
     node appli/scripts/film-fiche.cjs appli/vente/images
     node appli/scripts/film-fiche.cjs appli/vente/images --sans-film

   Il faut Playwright et ffmpeg (libx264, libvpx-vp9). Le navigateur est
   celui de PLAYWRIGHT_EXECUTABLE_PATH, comme pour tests/e2e.js.
   ======================================================================= */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { tourner, pixels } = require('./_pellicule.cjs');

const ECRAN = { l: 402, h: 874 };             // l'écran du tournage
const L = 310, H = 537, ECHELLE = 3;          // le cadre : 930 × 1611, trois pixels pour un
const FICHE = { marge: 8, l: 294, hauteurAuRepos: 521 };
const CADRE = { x: 0, y: 0, width: L, height: H };
const IPS = 60;
// Le film est plus petit que ses deux images fixes, comme ceux des autres
// scènes : 720 × 1248 à soixante images par seconde tient dans le niveau 4.1
// de H.264, que tous les téléphones décodent.
const FILM = { l: 720, h: 1248 };
// Part des pixels qui peuvent s'écarter d'une photo : au tournage, aucun.
const TOLERANCE = 0.002;

const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node appli/scripts/film-fiche.cjs <dossier des images du site> [--sans-film]'); process.exit(2); }
const SANS_FILM = process.argv.includes('--sans-film');
const base = path.join(dossier, 'nov-film-fiche');
const RUSHES = path.resolve(__dirname, 'rushes/fiche');

/** La hauteur d'un PNG, lue dans son en-tête. */
const hauteurDuPng = (png) => png.readUInt32BE(20);

/**
 * La part des pixels du cadre qui s'écartent de la photo, là où ils se
 * recouvrent. Le coin du cadre est en (x, y) dans le repère de la photo, en
 * pixels d'écran ; il peut déborder d'elle (la marge autour de la fiche, la
 * barre du bas de l'appli que le film ne montre pas, le tiroir qui flotte
 * sur le bas d'une photo) : `lignes` borne alors ce qu'on compare.
 */
function ecart(cadre, photo, l, x, y, lignes) {
  const tout = pixels(photo, l, hauteurDuPng(photo));
  // La fiche est à un demi-pixel dans la page, et sa photo commence au pixel
  // entier d'avant : elle et le film tombent à un ou deux pixels d'écran (des
  // tiers de pixel) l'un de l'autre. On garde le meilleur des cinq.
  return Math.min(...[-2, -1, 0, 1, 2].map((glisse) => ecartA(cadre, tout, l, x, y, lignes, glisse)));
}
function ecartA(cadre, tout, l, x, y, lignes, glisse) {
  const h = tout.length / 3 / l, lc = L * ECHELLE;
  let vus = 0, loin = 0;
  for (let j = 0; j < Math.min(H, lignes || H) * ECHELLE; j++) {
    const v = y * ECHELLE + j + glisse;
    if (v < 0 || v >= h) continue;
    for (let i = 0; i < lc; i++) {
      const u = x * ECHELLE + i;
      if (u < 0 || u >= l) continue;
      const a = (j * lc + i) * 3, b = (v * l + u) * 3;
      vus++;
      if (Math.abs(cadre[a] - tout[b]) + Math.abs(cadre[a + 1] - tout[b + 1]) + Math.abs(cadre[a + 2] - tout[b + 2]) > 48) loin++;
    }
  }
  return vus > lc * 300 ? loin / vus : 1;       // presque rien à comparer : ce n'est pas un accord
}

(async () => {
  const exe = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const navigateur = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await navigateur.newContext({ viewport: { width: ECRAN.l, height: ECRAN.h }, deviceScaleFactor: ECHELLE, hasTouch: true, isMobile: true })).newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('requestfailed', (r) => erreurs.push('introuvable : ' + r.url()));
  await page.goto('file://' + path.join(RUSHES, 'etats.html'), { waitUntil: 'networkidle' });
  await page.addScriptTag({ path: path.resolve(__dirname, 'film-fiche.js') });
  await page.waitForFunction(() => window.poser, null, { timeout: 15000 }).catch(() => erreurs.push('le montage ne s\'est pas posé'));
  await page.evaluate(() => document.fonts.ready);
  const cadre = async () => pixels(await page.screenshot({ type: 'png', clip: CADRE }), L * ECHELLE, H * ECHELLE);

  // ── Les refus : la fiche du film contre ses photos prises dans l'appli ───
  if (!erreurs.length) {
    const T = await page.evaluate(() => window.INSTANTS), A = await page.evaluate(() => window.ARRETS), F = await page.evaluate(() => window.FICHE);
    if (F.marge !== FICHE.marge || Math.round(F.l) !== FICHE.l || Math.ceil(F.hauteurAuRepos) !== FICHE.hauteurAuRepos) erreurs.push('la fiche a changé de taille (' + Math.round(F.l) + ' × ' + Math.round(F.hauteurAuRepos) + ' au repos) : le cadre du film est à repenser');
    // Au repos, la photo a été prise fiche en bas d'écran : le tiroir des
    // clients sans date flotte sur son bas. On compare ce qui est au-dessus.
    const etapes = [
      ['repos', 0, A.haut, 400], ['deplie', T.coches[0] - 0.05, A.auxTravaux], ['coche4', T.aLaRemarque - 0.02, A.auxTravaux],
      ['remarque', T.ecritFin + 0.3, A.aLaRemarque], ['envoye', T.envoye + 0.9, A.envoyee],
    ];
    await page.evaluate(() => { window.SANS_CURSEUR = true; });
    for (const [nom, t, y, lignes] of etapes) {
      await page.evaluate((t) => window.poser(t), t);
      const e = ecart(await cadre(), fs.readFileSync(path.join(RUSHES, 'photo-' + nom + '.png')), FICHE.l * ECHELLE, -FICHE.marge, y, lignes);
      console.log('Calage sur la photo de l\'appli, « ' + nom + ' » : ' + (e * 100).toFixed(3) + ' % des pixels diffèrent');
      if (e > TOLERANCE) erreurs.push('la fiche « ' + nom + ' » du film ne se superpose pas à sa photo');
    }
    const coin = await page.evaluate(() => window.calageDuSoir());
    // La photo de l'écran du patron porte la barre du bas de l'appli, que le
    // film ne montre pas : on s'arrête au-dessus d'elle.
    const e = ecart(await cadre(), fs.readFileSync(path.join(RUSHES, 'photo-retour.png')), ECRAN.l * ECHELLE, coin.x, coin.y, 820 - coin.y);
    console.log('Calage sur la photo de l\'appli, « retour » : ' + (e * 100).toFixed(3) + ' % des pixels diffèrent');
    if (e > TOLERANCE) erreurs.push('l\'écran du patron ne se superpose pas à sa photo');
    await page.evaluate(() => { window.SANS_CURSEUR = false; });
  }
  if (erreurs.length) {
    console.error('REFUS : ' + erreurs.join(' ; ') + ' (au plus ' + (TOLERANCE * 100).toFixed(1) + ' % d\'écart)');
    await navigateur.close();
    process.exit(1);
  }

  const duree = await page.evaluate(() => window.DUREE);
  console.log(Math.round(duree * IPS) + ' images à ' + IPS + ' par seconde, soit ' + duree.toFixed(2) + ' s');
  if (SANS_FILM) { await navigateur.close(); return; }

  // Une seule image clé : le film ne se lit que depuis son début.
  const ecrits = await tourner({
    page, base, film: FILM, ips: IPS, duree, cadre: CADRE,
    x264: ['-crf', '22', '-tune', 'animation', '-level', '4.1', '-g', String(IPS * 20)],
    vp9: ['-crf', '36', '-g', String(IPS * 20)],
  });
  await navigateur.close();
  console.log('Écrits : ' + ecrits.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
