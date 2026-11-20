/* =======================================================================
   Ce que le montage de la signature a besoin de savoir des deux PDF du devis
   (avant et après l'accord) et du PNG de la signature : on le MESURE sur les
   images, on ne le suppose pas.

     de combien le PDF signé est plus bas que celui d'avant (il porte une
       ligne de plus en tête) ;
     où est l'encadré « Bon pour accord » ;
     où est l'encre de la signature dans cet encadré, et dans le PNG de
       l'appli : l'une donne l'échelle et la place de l'autre ;
     où est la mention « Signé en ligne par », que le PDF d'avant n'a pas.

   Tout est en pixels de la première page mise en image à 200 points par
   pouce (1654 × 2339). tourner-signature.mjs s'en sert ; seul, il relit des
   rushes déjà tournés :
     node appli/scripts/tournage/mesurer-devis.cjs appli/scripts/rushes/envoi-signe
   ======================================================================= */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/** Une image PNG en tableau de pixels (rouge, vert, bleu, et l'opacité si on la demande). */
function lire(png, avecOpacite) {
  const l = png.readUInt32BE(16), h = png.readUInt32BE(20), n = avecOpacite ? 4 : 3;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', avecOpacite ? 'rgba' : 'rgb24', 'pipe:1'], { input: png, maxBuffer: 1 << 29 });
  if (r.status !== 0 || r.stdout.length !== l * h * n) throw new Error('image illisible : ' + String(r.stderr));
  return { l, h, n, p: r.stdout };
}
const loin = (im, x, y, de) => { const i = (y * im.l + x) * im.n; return Math.abs(im.p[i] - de[0]) + Math.abs(im.p[i + 1] - de[1]) + Math.abs(im.p[i + 2] - de[2]); };
const clair = (im, x, y) => { const i = (y * im.l + x) * im.n; return im.p[i] + im.p[i + 1] + im.p[i + 2]; };
const boite = (x0, y0, x1, y1) => ({ x: x0, y: y0, l: x1 - x0 + 1, h: y1 - y0 + 1 });

function mesurerLesDevis(pngAvant, pngSigne, pngSignature) {
  const avant = lire(pngAvant), signe = lire(pngSigne);
  if (avant.l !== signe.l || avant.h !== signe.h) throw new Error('les deux PDF n\'ont pas la même taille de page');
  const { l, h } = signe, papier = [signe.p[(5 * l + 5) * 3], signe.p[(5 * l + 5) * 3 + 1], signe.p[(5 * l + 5) * 3 + 2]];

  // 1. Le décalage : celui qui superpose le mieux la moitié droite des deux pages, du tableau au bas.
  let decalage = 0, moindre = Infinity;
  for (let d = 0; d <= 60; d++) {
    let n = 0;
    for (let y = Math.round(h * 0.35); y < Math.round(h * 0.82); y += 2) for (let x = Math.round(l * 0.56); x < Math.round(l * 0.96); x += 2) {
      const a = (y * l + x) * 3, b = ((y - d) * l + x) * 3;
      if (Math.abs(signe.p[a] - avant.p[b]) + Math.abs(signe.p[a + 1] - avant.p[b + 1]) + Math.abs(signe.p[a + 2] - avant.p[b + 2]) > 40) n++;
    }
    if (n < moindre) { moindre = n; decalage = d; }
  }

  // 2. L'encadré : un trait gris clair en pointillés. Ses deux côtés d'abord (des colonnes grises),
  // puis ses deux bords (des rangées grises entre ces côtés, qui ne les dépassent pas : le filet
  // plein qui traverse la page, lui, continue à gauche).
  const gris = (x, y) => loin(signe, x, y, papier) > 25 && clair(signe, x, y) > 450;
  const y0 = Math.round(h * 0.5), y1 = Math.round(h * 0.9), x0 = Math.round(l * 0.5), x1 = l - 20;
  const colonnes = [];
  for (let x = x0; x < x1; x++) { let n = 0; for (let y = y0; y < y1; y++) if (gris(x, y)) n++; if (n > 50) colonnes.push(x); }
  if (colonnes.length < 2) throw new Error('l\'encadré « Bon pour accord » est introuvable dans le PDF signé');
  const gauche = colonnes[0], droite = colonnes[colonnes.length - 1], rangees = [];
  for (let y = y0; y < y1; y++) {
    let n = 0; for (let x = gauche; x <= droite; x++) if (gris(x, y)) n++;
    let avantLeCote = 0; for (let x = gauche - 40; x < gauche - 10; x++) if (gris(x, y)) avantLeCote++;
    if (n > (droite - gauche) * 0.3 && avantLeCote < 10) rangees.push(y);
  }
  if (rangees.length < 2) throw new Error('les bords de l\'encadré sont introuvables');
  const encadre = boite(gauche, rangees[0], droite, rangees[rangees.length - 1]);

  // 3. L'encre de la signature, dans l'encadré : tout ce qui s'écarte du papier, moins les rangées
  // qu'un filet traverse d'un bord à l'autre.
  let sx0 = Infinity, sx1 = -1, sy0 = Infinity, sy1 = -1;
  for (let y = encadre.y + 5; y < encadre.y + encadre.h - 5; y++) {
    const touches = [];
    for (let x = encadre.x + 5; x < encadre.x + encadre.l - 5; x++) if (loin(signe, x, y, papier) > 30) touches.push(x);
    if (touches.length > (encadre.l - 10) * 0.6) continue;
    for (const x of touches) { if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y; }
  }
  if (sx1 < 0) throw new Error('aucune signature dans l\'encadré du PDF signé');
  const signature = boite(sx0, sy0, sx1, sy1);

  // 4. La mention : ce que le PDF signé porte sous l'encadré et que celui d'avant, remis à sa hauteur, n'a pas.
  let mx0 = Infinity, mx1 = -1, my0 = Infinity, my1 = -1;
  for (let y = encadre.y + encadre.h + 4; y < Math.min(h, encadre.y + encadre.h + 110); y++) for (let x = encadre.x - 60; x < Math.min(l, encadre.x + encadre.l + 60); x++) {
    const a = (y * l + x) * 3, b = ((y - decalage) * l + x) * 3;
    if (Math.abs(signe.p[a] - avant.p[b]) + Math.abs(signe.p[a + 1] - avant.p[b + 1]) + Math.abs(signe.p[a + 2] - avant.p[b + 2]) > 40) { if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; if (y < my0) my0 = y; if (y > my1) my1 = y; }
  }
  if (mx1 < 0) throw new Error('aucune mention « Signé en ligne par » sous l\'encadré du PDF signé');
  const mention = boite(mx0, my0, mx1, my1);

  // 5. L'encre dans le PNG de l'appli.
  const png = lire(pngSignature, true);
  let px0 = Infinity, px1 = -1, py0 = Infinity, py1 = -1;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.l; x++) if (png.p[(y * png.l + x) * 4 + 3] >= 1) { if (x < px0) px0 = x; if (x > px1) px1 = x; if (y < py0) py0 = y; if (y > py1) py1 = y; }
  if (px1 < 0) throw new Error('le PNG de la signature est vide');
  const encre = boite(px0, py0, px1, py1);
  // La même signature, vue deux fois : ses proportions doivent se retrouver.
  const rapport = (signature.l / signature.h) / (encre.l / encre.h);
  if (rapport < 0.96 || rapport > 1.04) throw new Error('la signature du PDF (' + signature.l + ' × ' + signature.h + ') n\'a pas les proportions de celle du PNG (' + encre.l + ' × ' + encre.h + ')');

  return { devis: { l, h, decalage, encadre, signature, mention }, png: { l: png.l, h: png.h, encre } };
}

module.exports = { mesurerLesDevis };

if (require.main === module) {
  const dossier = process.argv[2];
  if (!dossier) { console.error('Usage : node appli/scripts/tournage/mesurer-devis.cjs <dossier des rushes>'); process.exit(2); }
  const lu = (f) => fs.readFileSync(path.join(dossier, f));
  // Le PNG de l'appli est dans l'écran figé de l'accord.
  const donnee = (lu('etats.html').toString().match(/data-atlas="signature-donnee"[\s\S]*?<img[^>]*src="data:image\/png;base64,([^"]+)"/) || [])[1];
  if (!donnee) { console.error('pas de signature dans etats.html'); process.exit(1); }
  console.log(JSON.stringify(mesurerLesDevis(lu('devis-avant.png'), lu('devis-signe.png'), Buffer.from(donnee, 'base64'))));
}
