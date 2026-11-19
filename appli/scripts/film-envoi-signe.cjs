/* =======================================================================
   Le film « le client signe son devis » du site de vente (chapitre Envoyez
   de vente/cause-2.html).

   Sa demande du 18 novembre 2026 : « quand il clique sur accepter le devis,
   il y a le petit truc pour signer électroniquement qui apparaît. Il signe
   et ensuite sa signature vient s'apposer sur le devis. Ça serait bien que
   tu mettes cette animation sur le site. »

   La première version animait sa planche : la signature était en cours de
   codage. Elle a été livrée dans l'appli le soir même, et il a dit oui le
   19 novembre pour qu'on la filme sur une base d'essai. Ce film est donc
   fait des écrans de l'appli, figés au tournage dans rushes/envoi-signe/
   (tournage/tourner-signature.mjs les y range, avec le tracé du paraphe et
   les deux PDF). Le montage (film-envoi-signe.js) dit ce qui vient de
   l'appli et ce qui est du montage. Ce script l'injecte dans les rushes, le
   photographie image par image et en tire vente/images/
   nov-film-envoi-signe.mp4, .webm, -debut.jpg et -fin.jpg (la mécanique
   commune est dans _pellicule.cjs).

   Il refuse de filmer quand un écran du film ne se superpose pas à la photo
   prise dans l'appli au même instant du geste :
     la page du client, avant tout choix (photo-lien.png) ;
     la feuille « Votre signature » une fois le paraphe tracé
       (photo-trace.png) : c'est elle qui dit que le trait redessiné est
       celui de la vraie toile ;
     l'accord donné, avec la signature enregistrée (photo-accepte.png).
   Un écart veut dire qu'une police manque sur ce poste, ou que les rushes et
   le montage ne vont plus ensemble : le film mentirait sans rien dire.

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

const L = 390, H = 664, ECHELLE = 3;          // photographié à 1170 × 1992, trois pixels pour un, comme au tournage
const IPS = 60;
// La taille du film d'avant, que la scène attend : 780 × 1328 à soixante
// images par seconde tient encore dans le niveau 4.1 de H.264.
const FILM = { l: 780, h: 1328 };
// Part des pixels qui peuvent différer d'une photo. La page et l'accord se
// peignent à l'identique (zéro au tournage) ; sur la feuille signée, le
// trait est redessiné : son bord peut bouger d'une fraction de pixel.
const TOLERANCE = { lien: 0.0002, trace: 0.003, accepte: 0.0002 };

const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node appli/scripts/film-envoi-signe.cjs <dossier des images du site> [--sans-film]'); process.exit(2); }
const SANS_FILM = process.argv.includes('--sans-film');
const base = path.join(dossier, 'nov-film-envoi-signe');
const RUSHES = path.resolve(__dirname, 'rushes/envoi-signe');

/** La part des pixels qui s'écartent nettement entre deux images de même taille. */
function ecart(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 48) n++;
  return n / (a.length / 3);
}

(async () => {
  const exe = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const navigateur = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await navigateur.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE })).newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('requestfailed', (r) => erreurs.push('introuvable : ' + r.url()));
  await page.goto('file://' + path.join(RUSHES, 'etats.html'), { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: 'window.RUSHES = ' + fs.readFileSync(path.join(RUSHES, 'mesures.json'), 'utf8') + ';' });
  await page.addScriptTag({ path: path.resolve(__dirname, 'film-envoi-signe.js') });
  await page.waitForFunction(() => window.poser && [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => erreurs.push('le montage ne s\'est pas posé, ou une image des rushes ne s\'est pas chargée'));
  await page.evaluate(() => document.fonts.ready);

  // ── Les refus : chaque écran du film contre sa photo prise dans l'appli ──
  if (!erreurs.length) {
    const T = await page.evaluate(() => window.INSTANTS);
    const instants = { lien: 0, trace: T.signeFin + 0.15, accepte: T.range + 0.7 };
    for (const nom of Object.keys(instants)) {
      await page.evaluate((t) => window.poser(t), instants[nom]);
      const film = pixels(await page.screenshot({ type: 'png' }), L * ECHELLE, H * ECHELLE);
      const photo = pixels(fs.readFileSync(path.join(RUSHES, 'photo-' + nom + '.png')), L * ECHELLE, H * ECHELLE);
      const e = ecart(film, photo);
      console.log('Calage sur la photo de l\'appli, « ' + nom + ' » : ' + (e * 100).toFixed(3) + ' % des pixels diffèrent (au plus ' + (TOLERANCE[nom] * 100).toFixed(2) + ' %)');
      if (e > TOLERANCE[nom]) erreurs.push('l\'écran « ' + nom + ' » du film ne se superpose pas à sa photo');
    }
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
