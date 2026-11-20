/* =======================================================================
   LE TOURNAGE DE LA FICHE D'INTERVENTION, dans l'appli, pour le film du
   chapitre Planifiez du site de vente : les travaux dépliés, cochés un à un,
   la remarque, « Envoyer le retour du jour », puis le retour tel que le
   patron le retrouve (Terminés, Retours d'intervention).

   À chaque étape du vrai geste l'écran est figé (scripts/planche-figee/
   figer.mjs) et la fiche photographiée. Deux écrans sont figés en entier (la
   fiche dépliée, l'écran du patron) : ce sont eux que le montage anime. Des
   autres étapes on ne garde que la fiche, pour y lire ce qui a changé (un
   compte, un style, « Retour du jour envoyé »).

   Sortie, dans rushes/fiche/ (ou le dossier donné) : etats.html, et les six
   photos que film-fiche.cjs compare à son film avant de filmer.

   Avant : le devis accepté par le client (tourner-signature.mjs), l'état
   « accepte » gardé (etat.sh), le serveur démarré, LE JOUR DU CHANTIER (le
   retour du jour ne s'envoie que ce jour-là). La prise consomme l'état.

     node appli/scripts/tournage/tourner-fiche.mjs [dossier de sortie]
   ======================================================================= */
process.env.ATLAS_ADRESSE = 'http://localhost:3000';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const exiger = createRequire(import.meta.url);
const ICI = path.dirname(fileURLToPath(import.meta.url));
const { BASE, maintenant, ecart, navigateur, connecter, sql } = exiger('./commun.cjs');
const { feuilles, corps } = await import('../../../scripts/planche-figee/figer.mjs');

const SORTIE = path.resolve(process.argv[2] || path.join(ICI, '../rushes/fiche'));
fs.mkdirSync(SORTIE, { recursive: true });
const L = 402, H = 874, ECHELLE = 3;          // un iPhone 16 Pro : la fiche y fait 294 de large, comme sur les captures du 7 novembre
const REMARQUE = 'Le portail ferme mal, à revoir.';
const PHOTOS = ['repos', 'deplie', 'coche4', 'remarque', 'envoye'];
if (sql('select count(*) from retours_intervention') !== '0') { console.error('REFUS : un retour d\'intervention existe déjà dans la base d\'essai. Reprendre l\'état « accepte » (etat.sh).'); process.exit(1); }

const nav = await navigateur();
const contexte = await nav.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await contexte.newPage();
await page.clock.install({ time: maintenant() }); await page.clock.resume();
const pannes = [];
page.on('pageerror', (e) => pannes.push('page : ' + e.message.split('\n')[0]));
page.on('response', (r) => { if (r.status() >= 500) pannes.push(r.status() + ' sur ' + new URL(r.url()).pathname); });
await connecter(page, contexte, null);

const etats = [];
const fiche = page.locator("[data-atlas='feuille']");
const photo = async (nom) => { if (PHOTOS.includes(nom)) await fiche.screenshot({ path: path.join(SORTIE, 'photo-' + nom + '.png') }); };
/** Tout l'écran, figé. */
const figer = async (nom) => { await page.waitForTimeout(700); etats.push({ nom, html: (await corps(page, contexte)).html, entier: true }); console.log('figé : ' + nom); };
/** La fiche seule, figée : elle ne sert qu'à lire ce qui a changé. Ce qu'on a tapé vit dans la propriété du champ, pas dans son contenu. */
const fragment = async (nom) => {
  await page.waitForTimeout(700);
  const html = await fiche.evaluate((f) => { const c = f.cloneNode(true), vrais = f.querySelectorAll('textarea'), copies = c.querySelectorAll('textarea'); vrais.forEach((v, i) => { copies[i].textContent = v.value; }); return c.outerHTML; });
  etats.push({ nom, html, entier: false }); console.log('fragment : ' + nom);
};

await page.goto(BASE + '/planning', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.locator("[data-atlas='ligne-planifiee']", { hasText: 'Lemaire' }).first().click();
await fiche.waitFor({ state: 'visible', timeout: 15000 });
const css = await feuilles(page, contexte);
const premier = await corps(page, contexte);
await fragment('repos'); await photo('repos');

await page.locator("[data-atlas='ouvrir-travaux']").click();
await page.locator("[data-atlas='tache-du-retour']").first().waitFor({ state: 'visible' });
await figer('deplie'); await photo('deplie');

const taches = page.locator("[data-atlas='tache-du-retour']");
const combien = await taches.count();
for (let i = 0; i < combien; i++) { await taches.nth(i).click(); await fragment('coche' + (i + 1)); await photo('coche' + (i + 1)); }

const signaler = page.locator("[data-atlas='a-signaler']");
await signaler.click(); await signaler.pressSequentially(REMARQUE, { delay: 25 });
await signaler.evaluate((e) => e.blur());
await fragment('remarque'); await photo('remarque');

// Le retour part : on retient la réponse du serveur le temps de figer « Un instant… », puis on la rend.
let retenue = null, vue; const attendue = new Promise((r) => { vue = r; });
await page.route('**/*', async (route) => { if (route.request().method() === 'POST' && !retenue) { retenue = route; vue(); } else await route.continue(); });
await page.locator("[data-atlas='envoyer-le-retour']").click();
await attendue;
await fragment('envoi');
await retenue.continue();
await page.locator("[data-atlas='retour-envoye']").waitFor({ state: 'visible', timeout: 20000 });
await fragment('envoye'); await photo('envoye');
await page.unrouteAll({ behavior: 'ignoreErrors' });

// La base d'essai tourne à l'heure du poste, pas à celle du récit : ce qu'elle a horodaté elle-même
// (le retour vient d'être posé, par now()) est ramené du même écart que l'horloge du serveur.
if (ecart()) console.log('retour horodaté à : ' + sql(`update retours_intervention set pose_le = pose_le + interval '${ecart()} milliseconds', created_at = created_at + interval '${ecart()} milliseconds', updated_at = updated_at + interval '${ecart()} milliseconds' where pose_le > now() - interval '1 day' returning pose_le`).split('\n')[0]);

await page.goto(BASE + '/termines/retours', { waitUntil: 'networkidle' });
await page.locator('[data-atlas="carte-de-retour"]').first().click();
await page.locator('[data-atlas="retour-deplie"]').waitFor({ state: 'visible' });
await figer('retour'); await page.screenshot({ path: path.join(SORTIE, 'photo-retour.png') });
const lu = (await page.locator('[data-atlas="groupe-de-retours"]').innerText()).replace(/\n+/g, ' | ');

fs.writeFileSync(path.join(SORTIE, 'etats.html'), `<!doctype html><html lang="fr" class="${premier.classeHtml}" style="${premier.styleHtml}"><head><meta charset="utf-8">
<meta name="viewport" content="width=${L}"><meta name="robots" content="noindex">
<title>Rushes : la fiche d'intervention et le retour du jour</title>
<style>${css}</style><style>[data-planche][hidden]{display:none}</style></head>
<body class="${premier.classeBody}" style="${premier.styleBody}">
${etats.map((e) => `<div data-planche="${e.nom}"${e.entier ? '' : ' data-fragment'} hidden>${e.html}</div>`).join('\n')}
</body></html>`);
await nav.close();
console.log(etats.length + ' états (' + etats.filter((e) => e.entier).length + ' écrans entiers) ; chez le patron : ' + lu);
if (pannes.length) { console.error('L\'APPLI A SIGNALÉ : ' + pannes.join(' ; ')); process.exit(1); }
