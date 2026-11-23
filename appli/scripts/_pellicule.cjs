/* =======================================================================
   Ce que les films composés du site de vente ont en commun.

   Une composition est une page dont tout l'état est une fonction du temps :
   window.poser(t). On la photographie image par image, et l'on en tire les
   quatre fichiers qu'une scène de vente/cause-2-visite.html attend (sa fonction
   bobine()) : le film en .mp4 et en .webm, sa première image (-debut.jpg),
   montrée dessous avant qu'il parte, et sa dernière (-fin.jpg), qui reste
   quand il a fini.

   Les deux films d'une scène se nourrissent de la même suite d'images, et
   portent les mêmes étiquettes de couleur : sans elles, un navigateur lit le
   film plus sombre ou plus clair que les deux images fixes qui l'encadrent,
   et la scène saute au départ et à la fin.

   Il faut ffmpeg (libx264, libvpx-vp9).
   ======================================================================= */
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const COULEUR = ['-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];

/** Le filtre qui amène une image à la taille du film, dans ses couleurs. */
function versLeFilm(film) {
  return 'scale=' + film.l + ':' + film.h + ':flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p';
}

/** Les pixels d'une image (PNG ou JPEG), en rouge, vert, bleu, à la taille demandée. */
function pixels(image, l, h) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-frames:v', '1', '-vf', 'scale=' + l + ':' + h + ':flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { input: image, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 || r.stdout.length !== l * h * 3) throw new Error('image illisible : ' + String(r.stderr));
  return r.stdout;
}

function ecrire(flux, tampon) {
  return new Promise((resolve, reject) => {
    flux.write(tampon, (e) => (e ? reject(e) : resolve()));
  });
}

/**
 * Ouvre les deux films d'une scène, et les nourrit image par image : rend
 * { image(png), fermer() }. fermer() écrit aussi la première et la dernière
 * image reçues (-debut.jpg, -fin.jpg), à la taille de la photographie.
 *
 * base  : le chemin des fichiers, sans extension.
 * film  : { l, h }, la taille du film.
 * x264, vp9 : ce qui est propre à ce film (qualité, niveau, images clés).
 * fixes : { l, h }, la taille des deux images fixes, quand les photos n'ont
 *         pas toutes la même (une caméra qui s'approche photographie une part
 *         de l'écran) ; sans lui, celle de la photographie.
 */
function ouvrirBobine({ base, film, ips, x264, vp9, fixes }) {
  const entree = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(ips), '-c:v', 'png', '-i', 'pipe:0', '-vf', versLeFilm(film)];
  const encodeurs = [
    [base + '.mp4', ['-c:v', 'libx264', '-preset', 'veryslow', '-profile:v', 'high', '-movflags', '+faststart'].concat(x264)],
    [base + '.webm', ['-c:v', 'libvpx-vp9', '-b:v', '0', '-deadline', 'good', '-cpu-used', '1', '-row-mt', '1'].concat(vp9)],
  ].map(([sortie, reglages]) => {
    const p = spawn('ffmpeg', entree.concat(reglages, COULEUR, ['-an', sortie]), { stdio: ['pipe', 'inherit', 'inherit'] });
    return { sortie, p, fini: new Promise((resolve) => p.on('close', resolve)) };
  });
  let premiere = null, derniere = null;
  return {
    async image(png) {
      if (!premiere) premiere = png;
      derniere = png;
      await Promise.all(encodeurs.map((e) => ecrire(e.p.stdin, png)));
    },
    async fermer() {
      for (const e of encodeurs) {
        e.p.stdin.end();
        if ((await e.fini) !== 0) throw new Error('l\'encodage a échoué : ' + e.sortie);
      }
      for (const [suffixe, png] of [['-debut.jpg', premiere], ['-fin.jpg', derniere]]) {
        const taille = fixes ? ['-vf', 'scale=' + fixes.l + ':' + fixes.h + ':flags=lanczos'] : [];
        const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'png_pipe', '-i', 'pipe:0'].concat(taille, ['-frames:v', '1', '-q:v', '4', base + suffixe]), { input: png });
        if (r.status !== 0) throw new Error('image fixe non écrite : ' + base + suffixe + ' ' + String(r.stderr));
      }
      return ['.mp4', '.webm', '-debut.jpg', '-fin.jpg'].map((s) => path.basename(base) + s);
    },
  };
}

/**
 * Photographie la composition et écrit <base>.mp4, <base>.webm,
 * <base>-debut.jpg et <base>-fin.jpg.
 *
 * page  : la page (Playwright) qui porte la composition, déjà vérifiée.
 * film  : { l, h }, la taille du film. Les deux images fixes gardent celle
 *         de la photographie, plus fine.
 * x264, vp9 : ce qui est propre à ce film (qualité, niveau, images clés).
 * cadre : { x, y, width, height }, la part de l'écran qu'on photographie,
 *         quand la composition n'en occupe qu'un coin (l'écran garde alors la
 *         largeur du tournage, dont dépend ce que l'appli peint). Sans lui,
 *         tout l'écran.
 */
async function tourner({ page, base, film, ips, duree, x264, vp9, cadre }) {
  const bobine = ouvrirBobine({ base, film, ips, x264, vp9 });
  const images = Math.round(duree * ips);
  for (let k = 0; k < images; k++) {
    await page.evaluate((t) => window.poser(t), k / ips);
    await bobine.image(await page.screenshot(cadre ? { type: 'png', clip: cadre } : { type: 'png' }));
  }
  return bobine.fermer();
}

module.exports = { tourner, ouvrirBobine, pixels, versLeFilm };
