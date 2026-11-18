/* =======================================================================
   Le film de la fiche d'intervention du site de vente.

   Sa demande du 18 novembre 2026 : « Il faut faire une animation pour cette
   page aussi ! Qu'on voit qu'en un clic on peut avoir l'adresse sur Maps ou
   Waze. Pour la note tu peux écrire quelque chose comme tu as fait pour le
   retour du jour. »

   La composition vit dans film-fiche.html, qui dit ce qui est vrai (la
   capture de la fiche, la note telle que l'appli l'écrit) et ce qui est
   dessiné (la carte et l'écran d'appel : Maps et le téléphone ne se filment
   pas ici). Ce script la photographie image par image, à soixante par
   seconde, et en tire vente/images/nov-film-fiche.mp4, .webm, -debut.jpg et
   -fin.jpg (la mécanique commune est dans _pellicule.cjs).

   Pourquoi un film, et pas la scène jouée dans la page : c'est la mécanique
   des autres scènes, qu'il a vues jouer sur son iPhone (la première image
   dessous, le film, la dernière image). Une scène écrite dans la page aurait
   été du neuf à éprouver sur Safari, que ce poste n'a pas.

   Il refuse de produire un film quand la note ne tombe plus sur le texte
   d'exemple de la capture : une police qui n'est pas arrivée, une capture
   refaite à une autre taille, et la note s'écrirait à côté sans rien dire.

   Utilisation, depuis la racine du dépôt :
     node appli/scripts/film-fiche.cjs appli/vente/images
     node appli/scripts/film-fiche.cjs appli/vente/images --sans-film

   Il faut Playwright et ffmpeg (libx264, libvpx-vp9). Le navigateur est
   celui de PLAYWRIGHT_EXECUTABLE_PATH, comme pour tests/e2e.js.
   ======================================================================= */
const { chromium } = require('playwright');
const path = require('path');
const { tourner, pixels } = require('./_pellicule.cjs');

const L = 294, H = 532, ECHELLE = 3;          // la capture : 882 × 1596, trois pixels pour un
const IPS = 60;
// Le film est plus petit que ses deux images fixes, comme ceux des autres
// scènes : 720 × 1302 à soixante images par seconde tient dans le niveau 4.1
// de H.264, que tous les téléphones décodent ; à la taille de la capture il
// aurait fallu le 4.2.
const FILM = { l: 720, h: 1302 };
const EXEMPLE = 'Penser à prendre le broyeur. Client dispo à partir de 9 h.';
const FOND_NOTE = [241, 235, 223];

const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node appli/scripts/film-fiche.cjs <dossier des images du site> [--sans-film]'); process.exit(2); }
const SANS_FILM = process.argv.includes('--sans-film');
const base = path.join(dossier, 'nov-film-fiche');

/** L'encre d'une zone : vrai là où le pixel s'écarte du fond de la note. */
function encre(rvb, seuil) {
  const l = L * ECHELLE, x0 = 90, x1 = 760, y0 = 650, y1 = 800, m = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * l + x) * 3;
    m.push(Math.abs(rvb[i] - FOND_NOTE[0]) + Math.abs(rvb[i + 1] - FOND_NOTE[1]) + Math.abs(rvb[i + 2] - FOND_NOTE[2]) > seuil);
  }
  return m;
}

(async () => {
  const exe = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const navigateur = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await navigateur.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE })).newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('requestfailed', (r) => erreurs.push('introuvable : ' + r.url()));
  await page.goto('file://' + path.resolve(__dirname, 'film-fiche.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const photo = () => page.screenshot({ type: 'png' });

  // ── Le calage : la note s'écrit-elle là où l'appli écrit ? ────────────────
  const inter = await page.evaluate(() => document.fonts.check('16px Inter'));
  await page.evaluate(() => window.poser(0));
  const capture = encre(pixels(await photo(), L * ECHELLE, H * ECHELLE), 60);
  await page.evaluate((t) => window.calage(t), EXEMPLE);
  const pose = encre(pixels(await photo(), L * ECHELLE, H * ECHELLE), 120);
  let commun = 0, tout = 0;
  for (let i = 0; i < capture.length; i++) { if (capture[i] && pose[i]) commun++; if (capture[i] || pose[i]) tout++; }
  const recouvrement = tout ? commun / tout : 0;
  console.log('Calage de la note sur le texte d\'exemple de la capture : ' + (recouvrement * 100).toFixed(1) + ' % en commun (Inter ' + (inter ? 'chargée' : 'ABSENTE') + ')');
  if (erreurs.length || !inter || tout < 2000 || recouvrement < 0.93) {
    console.error('REFUS : la note ne tombe pas sur celle de l\'appli. ' + (erreurs.join(' ; ') || 'Il faut au moins 93 % en commun, sur de l\'encre qui existe.'));
    await navigateur.close();
    process.exit(1);
  }

  const duree = await page.evaluate(() => window.DUREE);
  const images = Math.round(duree * IPS);
  console.log(images + ' images à ' + IPS + ' par seconde, soit ' + duree.toFixed(2) + ' s ; la note : « ' + (await page.evaluate(() => window.NOTE)) + ' »');
  if (SANS_FILM) { await navigateur.close(); return; }

  // Une seule image clé : le film ne se lit que depuis son début, et une
  // image clé toutes les deux secondes lui coûtait 140 Ko de plus. Le reste
  // du poids est dans les quatre passages d'une appli à l'autre ; mesuré à
  // qualité 20, 22 et 23, le texte ne change pas à l'œil.
  const ecrits = await tourner({
    page, base, film: FILM, ips: IPS, duree,
    x264: ['-crf', '22', '-tune', 'animation', '-level', '4.1', '-g', String(IPS * 10)],
    vp9: ['-crf', '36', '-g', String(IPS * 10)],
  });
  await navigateur.close();
  console.log('Écrits : ' + ecrits.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
