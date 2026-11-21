// Parcourt `appli/visite-guidee-le-debut-2.html` comme lui, au doigt, à dix tailles et
// conditions, et REFUSE ce qui cloche : un anneau sous la bulle, une page qui déborde,
// un appui à côté qui avance, deux étapes sautées, une barre du bas couverte, un trait
// d'or à côté de son mot. Aucun serveur, aucune base : la planche s'ouvre du disque.
//
//   node appli/scripts/visite-le-debut-2/parcourir.mjs [dossier des images] [adresse]
//   CAS=tel-390,pc-1280 node appli/scripts/visite-le-debut-2/parcourir.mjs
//
// Chacun de ces refus a été vu rouge avant sa correction (`LISEZ-MOI.md`).
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lancer } from "../../../scripts/planche-figee/figer.mjs";

const ici = path.dirname(fileURLToPath(import.meta.url));
const planche = path.join(ici, "..", "..", "visite-guidee-le-debut-2.html");
const dossier = process.argv[2] || path.join(os.tmpdir(), "visite-le-debut-2");
const adresse = process.argv[3] || pathToFileURL(planche).href;
mkdirSync(dossier, { recursive: true });

const CAS = [
  { nom: 'tel-390', vp: { width: 390, height: 664 }, tactile: true },
  { nom: 'tel-360', vp: { width: 360, height: 640 }, tactile: true },
  { nom: 'tel-320', vp: { width: 320, height: 568 }, tactile: true },
  { nom: 'tel-414', vp: { width: 414, height: 896 }, tactile: true },
  { nom: 'tablette-820', vp: { width: 820, height: 1180 }, tactile: true },
  { nom: 'pc-1280', vp: { width: 1280, height: 800 }, tactile: false },
  { nom: 'pc-1024', vp: { width: 1024, height: 700 }, tactile: false },
  { nom: 'tel-390-calme', vp: { width: 390, height: 664 }, tactile: true, calme: true },
  { nom: 'tel-390-sans-fondu', vp: { width: 390, height: 664 }, tactile: true, sansFondu: true },
  // Comme Safari sur iPhone : aucun clic n'arrive pour un appui hors d'un lien ou d'un bouton.
  { nom: 'tel-390-sans-clic', vp: { width: 390, height: 664 }, tactile: true, sansClic: true },
];
const SEULEMENT = process.env.CAS ? process.env.CAS.split(',') : null;
let fautes = 0;
const dire = (cas, ok, quoi) => { if (!ok) { fautes++; console.log(`  ✗ [${cas}] ${quoi}`); } };

(async () => {
  const b = await lancer();
  for (const cas of CAS) {
    if (SEULEMENT && !SEULEMENT.includes(cas.nom)) continue;
    const ctx = await b.newContext({ viewport: cas.vp, deviceScaleFactor: cas.nom === 'tel-390' || cas.nom === 'pc-1280' ? 2 : 1, hasTouch: cas.tactile, isMobile: cas.tactile, reducedMotion: cas.calme ? 'reduce' : 'no-preference' });
    if (cas.sansFondu) await ctx.addInitScript(() => { delete Document.prototype.startViewTransition; });
    if (cas.sansClic) await ctx.addInitScript(() => { window.addEventListener('click', (e) => { if (!(e.target instanceof Element && e.target.closest('button, a'))) e.stopImmediatePropagation(); }, true); });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(String(e)));
    // Une erreur dit d'OÙ elle vient : « 404 » seul envoie chercher au mauvais endroit.
    // L'icône du site, elle, n'est pas une ressource de la planche : le navigateur la
    // demande de lui-même à la racine, et aucune page du site publié n'en déclare.
    p.on('console', (m) => {
      const source = m.location().url || 'sans adresse';
      if (m.type() === 'error' && !source.endsWith('/favicon.ico')) erreurs.push(`${m.text()} (${source})`);
    });
    let partis = [];
    p.on('framenavigated', (f) => { if (f === p.mainFrame()) partis.push(f.url()); });
    await p.goto(adresse, { waitUntil: 'networkidle' });
    let n = 0;
    const photo = async (nom) => p.screenshot({ path: `${dossier}/${cas.nom}-${String(++n).padStart(2, '0')}-${nom}.png` });
    const etat = () => p.evaluate(() => {
      const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { g: q.left, h: q.top, d: q.right, b: q.bottom, l: q.width, t: q.height }; };
      const q = (s) => document.querySelector(s);
      return { etape: window.visite.etape(), enCours: window.visite.enCours(), ecran: q('.visite-ecran:not([hidden])').dataset.ecran, y: Math.round(scrollY),
        dit: q('.g-dit').textContent, suite: q('.g-suite').textContent, retour: !q('.g-retour').disabled,
        bulle: r(q('.g-bulle')), anneau: q('.g-anneau').classList.contains('visible') ? r(q('.g-anneau')) : null,
        regard: q('.g-regard').classList.contains('visible') ? r(q('.g-regard')) : null,
        nav: r(q('.visite-ecran:not([hidden]) .atlas-nav-basse')),
        onglet: r(q('.visite-ecran:not([hidden]) [role=tab][aria-selected=true]')), trait: r(q('.visite-ecran:not([hidden]) [role=tablist] > span[aria-hidden=true]')),
        deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth, vh: innerHeight, vw: innerWidth };
    });
    const toucher = async (x, y) => (cas.tactile ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
    const appuyer = async (sel) => (cas.tactile ? p.tap(sel) : p.click(sel));
    const croise = (a, c) => a && c && a.g < c.d && a.d > c.g && a.h < c.b && a.b > c.h;
    const verifierEtape = async (k, attendu) => {
      const e = await etat();
      dire(cas.nom, e.etape === k && e.ecran === attendu, `étape ${k + 1} : on attend ${attendu}, on a ${e.ecran} (étape ${e.etape + 1})`);
      dire(cas.nom, e.deborde === 0, `étape ${k + 1} : la page déborde de ${e.deborde}px`);
      dire(cas.nom, e.bulle.g >= 0 && e.bulle.d <= e.vw && e.bulle.b <= e.vh, `étape ${k + 1} : la bulle sort de l'écran ${JSON.stringify(e.bulle)}`);
      // Une barre couchée au bas de l'écran reste visible, quelle que soit la largeur.
      if (e.nav && e.nav.l > e.nav.t * 2) dire(cas.nom, e.bulle.b <= e.nav.h + 0.5, `étape ${k + 1} : la bulle couvre la barre du bas (bulle ${Math.round(e.bulle.b)}, barre ${Math.round(e.nav.h)})`);
      // Le trait d'or tombe sous le mot de l'onglet ouvert.
      if (e.onglet && e.trait) dire(cas.nom, Math.abs((e.trait.g + e.trait.d) / 2 - (e.onglet.g + e.onglet.d) / 2) <= 2, `étape ${k + 1} : le trait d'or est à ${Math.round((e.trait.g + e.trait.d) / 2 - (e.onglet.g + e.onglet.d) / 2)}px du mot`);
      if (k < 3) {
        dire(cas.nom, !!e.anneau, `étape ${k + 1} : pas d'anneau`);
        dire(cas.nom, !croise(e.anneau, e.bulle), `étape ${k + 1} : l'anneau passe sous la bulle`);
        if (e.anneau) dire(cas.nom, e.anneau.h >= 0 && e.anneau.b <= e.vh && e.anneau.g >= 0 && e.anneau.d <= e.vw, `étape ${k + 1} : l'anneau sort de l'écran ${JSON.stringify(e.anneau)}`);
        dire(cas.nom, e.suite === 'Passer', `étape ${k + 1} : le bouton dit « ${e.suite} »`);
      } else {
        dire(cas.nom, !!e.regard, 'étape 4 : pas de surligneur');
        dire(cas.nom, !croise(e.regard, e.bulle), 'étape 4 : le surligneur passe sous la bulle');
        if (e.regard) dire(cas.nom, e.regard.l > 60 && e.regard.l < 200 && e.regard.t > 12 && e.regard.t < 30, `étape 4 : le surligneur n'a pas la taille du texte ${JSON.stringify(e.regard)}`);
        dire(cas.nom, e.suite === 'Suivant', `étape 4 : le bouton dit « ${e.suite} »`);
      }
      dire(cas.nom, e.retour === (k > 0), `étape ${k + 1} : le bouton de retour est ${e.retour ? 'là' : 'absent'}`);
      return e;
    };
    const ECRANS = ['01-accueil', '02-clients', '02b-client-devis', '02c-client-factures'];
    const POSE = 2600;

    // L'ouverture : rien ne répond derrière elle, « Commencer » lance.
    await p.waitForTimeout(700); await photo('ouverture');
    dire(cas.nom, !(await etat()).enCours, 'la visite tourne avant « Commencer »');
    await appuyer('[data-va="commencer"]');
    await p.waitForTimeout(POSE);
    for (let k = 0; k < 3; k++) {
      const e = await verifierEtape(k, ECRANS[k]);
      await photo(`etape${k + 1}`);
      // À côté : rien n'avance.
      await toucher(e.vw / 2, 30); await p.waitForTimeout(350);
      dire(cas.nom, (await etat()).etape === k, `étape ${k + 1} : un appui à côté a fait avancer`);
      // Un doigt qui GLISSE depuis la cible fait défiler la page : ce n'est pas un appui.
      if (cas.tactile) {
        const c = (await etat()).anneau;
        if (c) {
          const cdp = await ctx.newCDPSession(p);
          const px = c.g + c.l / 2, py = c.h + c.t / 2;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px, y: py }] });
          for (const d of [10, 25, 45, 60]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: px, y: py - d }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await p.waitForTimeout(700);
          dire(cas.nom, (await etat()).etape === k, `étape ${k + 1} : un doigt qui glisse a fait avancer`);
          await toucher(e.vw / 2, 30); await p.waitForTimeout(1400);
        }
      }
      // Deux appuis rapides sur la cible : UNE étape, pas deux.
      const a = (await etat()).anneau;
      if (!a) { dire(cas.nom, false, `étape ${k + 1} : plus d'anneau après l'appui à côté`); break; }
      const x = a.g + a.l / 2, y = a.h + a.t / 2;
      const yAvant = (await etat()).y;
      await toucher(x, y); await p.waitForTimeout(40); await toucher(x, y);
      // Un onglet ne change pas de page : en avant aussi, rien ne bouge sous le doigt.
      if (k === 2) { await p.waitForTimeout(POSE); const d = (await etat()).y - yAvant; dire(cas.nom, Math.abs(d) <= 1, `de l'étape 3 à l'étape 4, la page a bougé de ${d}px`); continue; }
      if (k === 0) { await p.waitForTimeout(500); await photo('etape2-arrivee'); await p.waitForTimeout(POSE - 500); } else await p.waitForTimeout(POSE);
    }
    await verifierEtape(3, ECRANS[3]); await photo('etape4');
    // Retour, puis Passer : on retrouve l'étape, sans saut de page.
    const y4 = (await etat()).y;
    await appuyer('.g-retour'); await p.waitForTimeout(1200);
    const e3 = await verifierEtape(2, ECRANS[2]);
    dire(cas.nom, Math.abs(e3.y - y4) <= 1, `retour à l'étape 3 : la page a bougé de ${e3.y - y4}px`);
    await appuyer('.g-suite'); await p.waitForTimeout(1500);
    const e4 = await verifierEtape(3, ECRANS[3]);
    dire(cas.nom, Math.abs(e4.y - y4) <= 1, `l'onglet Factures : la page a bougé de ${e4.y - y4}px`);
    // Retour jusqu'au début, puis tout en « Passer ».
    for (let k = 2; k >= 0; k--) { await appuyer('.g-retour'); await p.waitForTimeout(700); await verifierEtape(k, ECRANS[k]); }
    for (let k = 1; k <= 3; k++) { await appuyer('.g-suite'); await p.waitForTimeout(POSE); await verifierEtape(k, ECRANS[k]); }
    await appuyer('.g-suite'); await p.waitForTimeout(900);
    dire(cas.nom, await p.isVisible('[data-feuille="fin"]') && !(await etat()).enCours, 'la fin ne s\'ouvre pas');
    await photo('fin');
    // La fin ouvre les deux autres planches : elles existent, à côté de celle-ci.
    const liens = await p.$$eval('[data-feuille="fin"] a', (a) => a.map((x) => x.getAttribute('href')));
    dire(cas.nom, liens.join() === 'visite-guidee-le-debut.html,visite-guidee.html', `les liens de la fin visent ${liens.join(', ')}`);
    for (const l of liens) dire(cas.nom, existsSync(path.join(path.dirname(planche), l)), `le lien de la fin vise une planche absente : ${l}`);
    await appuyer('[data-va="recommencer"]'); await p.waitForTimeout(POSE);
    await verifierEtape(0, ECRANS[0]);
    // Les erreurs se comptent ICI, sur la planche : la page où mène la croix n'est
    // pas la sienne, et en ligne son icône absente accusait la planche à tort.
    dire(cas.nom, erreurs.length === 0, `erreurs : ${erreurs.join(' | ')}`);
    // Quitter : la croix mène au site de vente.
    partis = [];
    await p.route('**/vente/index.html', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>site</title>' }));
    await appuyer('.g-quitter'); await p.waitForTimeout(600);
    dire(cas.nom, partis.some((u) => u.endsWith('vente/index.html')), `la croix ne quitte pas vers le site (${partis.join(', ') || 'aucun départ'})`);
    console.log(`${cas.nom} : parcouru`);
    await ctx.close();
  }
  await b.close();
  console.log(fautes ? `\n${fautes} faute(s).` : '\nTout tient, à toutes les tailles.');
  process.exit(fautes ? 1 : 0);
})().catch((e) => { console.error('ÉCHEC', e); process.exit(1); });
