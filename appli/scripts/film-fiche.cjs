/* =======================================================================
   Le film de la fiche d'intervention du site de vente.

   Sa demande du 18 novembre 2026 : « Il faut faire une animation pour cette
   page aussi ! Qu'on voit qu'en un clic on peut avoir l'adresse sur Maps ou
   Waze. Pour la note tu peux écrire quelque chose comme tu as fait pour le
   retour du jour. »

   La composition vit dans film-fiche.html, qui dit ce qui est vrai (la
   capture de la fiche, la note telle que l'appli l'écrit) et ce qui est
   dessiné (les deux cartes : Maps et Waze ne se filment pas ici). Ce script
   la photographie image par image, à soixante par seconde, et en tire
   vente/images/nov-film-fiche.mp4, .webm, -debut.jpg et -fin.jpg.

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
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const L = 294, H = 532, ECHELLE = 3;          // la capture : 882 × 1596, trois pixels pour un
const IPS = 60;
// Le film est plus petit que ses deux images fixes, comme ceux des autres
// scènes : 720 × 1302 à soixante images par seconde tient dans le niveau 4.1
// de H.264, que tous les téléphones décodent ; à la taille de la capture il
// aurait fallu le 4.2.
const FILM = { l: 720, h: 1302 };
const EXEMPLE = 'Penser à prendre le broyeur. Client dispo à partir de 9 h.';
const FOND_NOTE = [241, 235, 223];
const COULEUR = ['-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];

const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node appli/scripts/film-fiche.cjs <dossier des images du site> [--sans-film]'); process.exit(2); }
const SANS_FILM = process.argv.includes('--sans-film');
const base = path.join(dossier, 'nov-film-fiche');

/** Les pixels d'une image PNG, en rouge, vert, bleu. */
function pixels(png) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-f', 'png_pipe', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { input: png, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || r.stdout.length !== L * ECHELLE * H * ECHELLE * 3) throw new Error('image illisible : ' + String(r.stderr));
  return r.stdout;
}

/** L'encre d'une zone : vrai là où le pixel s'écarte du fond de la note. */
function encre(rvb, seuil) {
  const l = L * ECHELLE, x0 = 90, x1 = 760, y0 = 650, y1 = 800, m = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * l + x) * 3;
    m.push(Math.abs(rvb[i] - FOND_NOTE[0]) + Math.abs(rvb[i + 1] - FOND_NOTE[1]) + Math.abs(rvb[i + 2] - FOND_NOTE[2]) > seuil);
  }
  return m;
}

function ecrire(flux, tampon) {
  return new Promise((resolve, reject) => {
    flux.write(tampon, (e) => (e ? reject(e) : resolve()));
  });
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
  const capture = encre(pixels(await photo()), 60);
  await page.evaluate((t) => window.calage(t), EXEMPLE);
  const pose = encre(pixels(await photo()), 120);
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

  // ── Les deux films, nourris de la même suite d'images ─────────────────────
  const filtre = 'scale=' + FILM.l + ':' + FILM.h + ':flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p';
  const entree = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(IPS), '-c:v', 'png', '-i', 'pipe:0', '-vf', filtre];
  const encodeurs = [
    // Une seule image clé : le film ne se lit que depuis son début, et une
    // image clé toutes les deux secondes lui coûtait 140 Ko de plus. Le
    // reste du poids est dans les quatre passages d'une appli à l'autre ;
    // mesuré à qualité 20, 22 et 23, le texte ne change pas à l'œil.
    [base + '.mp4', ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', '22', '-tune', 'animation', '-profile:v', 'high', '-level', '4.1', '-g', String(IPS * 10), '-movflags', '+faststart']],
    [base + '.webm', ['-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-deadline', 'good', '-cpu-used', '1', '-row-mt', '1', '-g', String(IPS * 10)]],
  ].map(([sortie, reglages]) => {
    const p = spawn('ffmpeg', entree.concat(reglages, COULEUR, ['-an', sortie]), { stdio: ['pipe', 'inherit', 'inherit'] });
    return { sortie, p, fini: new Promise((resolve) => p.on('close', resolve)) };
  });
  let premiere = null, derniere = null;
  for (let k = 0; k < images; k++) {
    await page.evaluate((t) => window.poser(t), k / IPS);
    const png = await photo();
    if (k === 0) premiere = png;
    derniere = png;
    await Promise.all(encodeurs.map((e) => ecrire(e.p.stdin, png)));
  }
  for (const e of encodeurs) {
    e.p.stdin.end();
    if ((await e.fini) !== 0) throw new Error('l\'encodage a échoué : ' + e.sortie);
  }
  // La première et la dernière image, à la taille de la capture : la page
  // les montre avant et après le film.
  for (const [suffixe, png] of [['-debut.jpg', premiere], ['-fin.jpg', derniere]]) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'png_pipe', '-i', 'pipe:0', '-frames:v', '1', '-q:v', '4', base + suffixe], { input: png });
    if (r.status !== 0) throw new Error('image fixe non écrite : ' + base + suffixe + ' ' + String(r.stderr));
  }
  await navigateur.close();
  console.log('Écrits : ' + ['.mp4', '.webm', '-debut.jpg', '-fin.jpg'].map((s) => path.basename(base) + s).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
