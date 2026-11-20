/* =======================================================================
   LE TOURNAGE DE LA SIGNATURE DU DEVIS, dans l'appli (la page du client,
   /devis/<jeton>), pour le film du chapitre Envoyez du site de vente.

   On joue le vrai geste du client : choisir la date, cocher la demande des
   quatorze jours, « J'accepte ce devis », tracer son paraphe sur la toile,
   valider. À chaque étape l'écran est FIGÉ tel que l'appli le peint
   (scripts/planche-figee/figer.mjs : son DOM, ses feuilles de style, sans un
   script) et photographié. Le paraphe est tracé à la souris, point par point,
   et chaque point envoyé est noté : une toile ne se fige pas, le montage la
   redessine avec ces points. Le PDF du devis est pris avant et après
   l'accord, tel que le client le télécharge, et mesuré (mesurer-devis.cjs).

   Sortie, dans rushes/envoi-signe/ (ou le dossier donné) :
     etats.html         les sept écrans figés (lien, choisi, coche, feuille,
                        trace, envoi, accepte), une seule feuille de style
     photo-*.png        la photo de trois d'entre eux, que film-envoi-signe.cjs
                        compare à son film avant de filmer
     devis-avant.*, devis-signe.*   les deux PDF et leur première page en image
     mesures.json       le tracé du paraphe et les mesures des PDF

   Avant : le récit joué jusqu'à l'envoi (recit.cjs), l'état « envoye » gardé
   (etat.sh), le serveur démarré (serveur.sh). La prise consomme l'état : un
   devis accepté ne s'accepte pas deux fois.

     node appli/scripts/tournage/tourner-signature.mjs [dossier de sortie]
   ======================================================================= */
process.env.ATLAS_ADRESSE = 'http://localhost:3000';      // figer.mjs y cherche les polices et les images
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const exiger = createRequire(import.meta.url);
const ICI = path.dirname(fileURLToPath(import.meta.url));
const { BASE, maintenant, navigateur, lienDuClient } = exiger('./commun.cjs');
const { poserLeParaphe } = exiger('./paraphe.cjs');
const { mesurerLesDevis } = exiger('./mesurer-devis.cjs');
const { feuilles, corps } = await import('../../../scripts/planche-figee/figer.mjs');

const SORTIE = path.resolve(process.argv[2] || path.join(ICI, '../rushes/envoi-signe'));
fs.mkdirSync(SORTIE, { recursive: true });
const L = 390, H = 664, ECHELLE = 3;          // son écran, mesuré par lui ; trois pixels pour un
const PHOTOS = ['lien', 'trace', 'accepte'];
const lien = lienDuClient('Lemaire');
if (lien.reponse) { console.error('REFUS : ce devis a déjà sa réponse (« ' + lien.reponse + ' »). Reprendre l\'état « envoye » (etat.sh).'); process.exit(1); }

const nav = await navigateur();
const contexte = await nav.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await contexte.newPage();
await page.clock.install({ time: maintenant() }); await page.clock.resume();
const pannes = [];
page.on('pageerror', (e) => pannes.push('page : ' + e.message.split('\n')[0]));
page.on('response', (r) => { if (r.status() >= 500) pannes.push(r.status() + ' sur ' + new URL(r.url()).pathname); });

/** Le PDF que le client télécharge, et sa première page en image (200 points par pouce). */
const pdf = async (nom) => {
  const r = await contexte.request.get(BASE + '/devis/' + lien.jeton + '/pdf');
  if (!r.ok()) throw new Error('le PDF du devis ne vient pas : ' + r.status());
  const f = path.join(SORTIE, nom + '.pdf'); fs.writeFileSync(f, await r.body());
  execFileSync('pdftoppm', ['-r', '200', '-png', '-f', '1', '-l', '1', '-singlefile', f, path.join(SORTIE, nom)]);
};
await pdf('devis-avant');

const etats = [];
const figer = async (nom) => {
  await page.waitForTimeout(500);                       // les transitions de l'appli (200 ms) sont finies
  etats.push({ nom, corps: await corps(page, contexte) });
  if (PHOTOS.includes(nom)) await page.screenshot({ path: path.join(SORTIE, 'photo-' + nom + '.png') });
  console.log('figé : ' + nom);
};

await page.goto(BASE + '/devis/' + lien.jeton, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const css = await feuilles(page, contexte);
await figer('lien');

await page.getByRole('radio', { name: 'le vendredi 6 novembre' }).check();
await figer('choisi');
await page.locator('input[name="demarrageAnticipe"]').check();
await figer('coche');

await page.getByRole('button', { name: "J'accepte ce devis" }).first().click();
const feuille = page.locator('[data-atlas="signature-devis"]');
await feuille.waitFor({ state: 'visible' });
await figer('feuille');

// Le paraphe, sur la vraie toile. Chaque point est noté dans le repère de la toile : c'est ce que
// l'appli reçoit (Signature.tsx : la place du doigt, moins le coin de la toile).
const toile = feuille.locator('canvas');
const b = await toile.boundingBox();
const paraphe = await poserLeParaphe(page, { echelle: 1, dx: b.x, dy: b.y + 8 });
const traits = [];
for (let i = 0; i < paraphe.longueurs.length; i++) {
  const pas = Math.max(2, Math.ceil(paraphe.longueurs[i] / 1.5)), points = [];
  for (let k = 0; k <= pas; k++) {
    const [x, y] = await page.evaluate(([i, p]) => window.PARAPHE.point(i, p), [i, k / pas]);
    if (k === 0) { await page.mouse.move(x, y); await page.mouse.down(); } else await page.mouse.move(x, y);
    points.push([Math.round((x - b.x) * 1000) / 1000, Math.round((y - b.y) * 1000) / 1000]);
  }
  await page.mouse.up();
  traits.push(points);
}
await page.evaluate(() => window.PARAPHE.outil.remove());    // l'outil du paraphe n'est pas de l'appli : il ne se fige pas
await figer('trace');

// L'accord part : on retient la réponse du serveur le temps de figer « Envoi… », puis on la rend.
let retenue = null, vue;
const attendue = new Promise((r) => { vue = r; });
await page.route('**/*', async (route) => { if (route.request().method() === 'POST' && !retenue) { retenue = route; vue(); } else await route.continue(); });
await feuille.getByRole('button', { name: "J'accepte ce devis" }).click();
await attendue;
await figer('envoi');
await retenue.continue();
await page.locator('[data-atlas="signature-du-devis"]').waitFor({ state: 'visible', timeout: 30000 });
await figer('accepte');
await page.unrouteAll({ behavior: 'ignoreErrors' });
await pdf('devis-signe');
const signaturePng = Buffer.from((await page.locator('[data-atlas="signature-donnee"] img').getAttribute('src')).split(',')[1], 'base64');

// Une seule page pour tous les états : une feuille de style, un bloc par état. Le jeton du lien
// (un champ caché de la page) n'a rien à faire dans le dépôt : il est remplacé.
const premier = etats[0].corps;
fs.writeFileSync(path.join(SORTIE, 'etats.html'), (`<!doctype html><html lang="fr" class="${premier.classeHtml}" style="${premier.styleHtml}"><head><meta charset="utf-8">
<meta name="viewport" content="width=${L}"><meta name="robots" content="noindex">
<title>Rushes : la signature du devis</title>
<style>${css}</style><style>[data-planche][hidden]{display:none}</style></head>
<body class="${premier.classeBody}" style="${premier.styleBody}">
${etats.map((e) => `<div data-planche="${e.nom}" hidden>${e.corps.html}</div>`).join('\n')}
</body></html>`).split(lien.jeton).join('jeton-du-tournage'));
const mesures = mesurerLesDevis(fs.readFileSync(path.join(SORTIE, 'devis-avant.png')), fs.readFileSync(path.join(SORTIE, 'devis-signe.png')), signaturePng);
fs.writeFileSync(path.join(SORTIE, 'mesures.json'), JSON.stringify({ trace: { toile: { l: b.width, h: b.height }, epaisseur: 2.2, traits, sortieDuTrait2: paraphe.sortieDuTrait2 }, mesures }));
await nav.close();
console.log(etats.length + ' écrans figés, ' + traits.map((t) => t.length).join(' + ') + ' points de paraphe ; mesures : ' + JSON.stringify(mesures.devis));
if (pannes.length) { console.error('L\'APPLI A SIGNALÉ : ' + pannes.join(' ; ')); process.exit(1); }
