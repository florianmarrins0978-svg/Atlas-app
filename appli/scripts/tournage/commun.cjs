/* =======================================================================
   Ce que les scripts du tournage ont en commun : un navigateur réglé comme un
   téléphone, à l'heure du récit, branché sur l'appli d'essai de CE poste.

   L'appli tourne sur http://localhost:3000 (serveur.sh), et nulle part
   ailleurs : ces scripts créent un client, un devis, un retour. Le compte est
   celui du jeu d'essai (demo@atlas.local), qui n'existe sur aucune base
   habitée.
   ======================================================================= */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const BASE = 'http://localhost:3000';
const TOURNAGE = process.env.TOURNAGE || path.join(os.tmpdir(), 'atlas-tournage');
const PG = 'postgresql://postgres@localhost:5432/atlas_test';
fs.mkdirSync(path.join(TOURNAGE, 'vu'), { recursive: true });

/** L'écart entre l'heure du récit et celle du poste, tel que serveur.sh l'a gardé. */
const ecart = () => { const f = path.join(TOURNAGE, 'ecart-ms'); return fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) : 0; };
const maintenant = () => new Date(Date.now() + ecart());
const navigateur = () => chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {});

/** Une page de téléphone. Son horloge suit celle du serveur : elle avance, mais depuis le jour du récit. */
async function ouvrir({ largeur = 390, hauteur = 844, echelle = 1, session = true } = {}) {
  const nav = await navigateur();
  const etat = path.join(TOURNAGE, 'session.json');
  const contexte = await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: echelle, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', storageState: session && fs.existsSync(etat) ? etat : undefined });
  const page = await contexte.newPage();
  await page.clock.install({ time: maintenant() });
  await page.clock.resume();
  const pannes = [];
  page.on('pageerror', (e) => pannes.push('page : ' + e.message.split('\n')[0]));
  page.on('response', (r) => { if (r.status() >= 500) pannes.push(r.status() + ' sur ' + new URL(r.url()).pathname); });
  return { nav, contexte, page, pannes, etat };
}

/** Se connecter avec le compte du jeu d'essai, et garder la session pour les scripts suivants. */
async function connecter(page, contexte, etat) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    await page.fill('input[name="email"]', 'demo@atlas.local');
    await page.fill('input[name="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  }
  if (etat) await contexte.storageState({ path: etat });
}

/** Une photo de l'écran, pour le regarder : dans $TOURNAGE/vu. */
async function voir(page, nom) {
  const f = path.join(TOURNAGE, 'vu', nom + '.png');
  await page.screenshot({ path: f });
  return f;
}

/** Une question à la base d'essai locale (lecture, ou l'heure d'un retour à ramener). */
const sql = (requete) => execFileSync('psql', [PG, '-tA', '-c', requete]).toString().trim();

/** Le lien que le client de ce nom a reçu, et son chantier. */
function lienDuClient(nom) {
  const [jeton, chantier, reponse] = sql(`select e.jeton, e.chantier_id, coalesce(e.reponse, '') from envois_devis e join chantiers c on c.id = e.chantier_id join clients k on k.id = c.client_id where k.nom = '${nom.replace(/'/g, "''")}' order by e.envoye_at desc limit 1`).split('|');
  if (!jeton) throw new Error('aucun devis envoyé à ' + nom + ' dans la base d\'essai');
  return { jeton, chantier, reponse };
}

module.exports = { BASE, TOURNAGE, ouvrir, connecter, voir, maintenant, ecart, navigateur, sql, lienDuClient };
