/* =======================================================================
   Arborea — Tests de bout en bout (Playwright).
   Exerce chaque écran et les cas limites pour garantir « zéro bug » à
   chaque mise en ligne. À lancer AVANT chaque déploiement.

   Utilisation, depuis le dossier appli/ :
     python3 -m http.server 8080 &        # sert l'appli
     BASE_URL=http://127.0.0.1:8080 node tests/e2e.js

   (Playwright requis. Voir tests/README.md.)
   ======================================================================= */
const { chromium } = require('playwright');
const B = process.env.BASE_URL || 'http://127.0.0.1:8080';

let pass = 0, fail = 0; const fails = [];
function ok(name, cond){ if (cond) pass++; else { fail++; fails.push(name); } }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  // Coupe les ressources externes (polices/CDN) : tests hors-ligne, rapides et déterministes.
  await ctx.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());

  const GRID = { tvaDefault:10, ressources:[
    { libelle:'Main-d’œuvre — 1 personne', categorie:'Main-d’œuvre', unite:'jour', prix:250 },
    { libelle:'Camion benne', categorie:'Matériel / location', unite:'jour', prix:120 },
    { libelle:'Broyeur', categorie:'Matériel / location', unite:'jour', prix:180 },
    { libelle:'Dessouchage', categorie:'Prestation', unite:'forfait', prix:null }
  ], forfaits:[{ libelle:'1 homme + broyeur + camion', unite:'jour', prix:480 }] };

  // 1) Navigation présente et saine sur chaque écran
  const PAGES = ['app','devis-vocal','devis-modele','mes-tarifs','facture-modele','tva-modele'];
  for (const p of PAGES){
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(p + ': ' + e.message));
    await page.goto(`${B}/${p}.html`, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(150);
    const links = await page.$$eval('.arborea-appnav .link', e => e.length).catch(() => 0);
    const brand = await page.$eval('.arborea-appnav .brand', a => a.getAttribute('href')).catch(() => null);
    ok(`nav présente sur ${p}`, links === 5);
    ok(`logo → app.html sur ${p}`, brand === 'app.html');
    ok(`aucune erreur JS au chargement de ${p}`, errs.length === 0);
    if (errs.length) fails.push(...errs);
    await page.close();
  }

  // 2) Page active correctement surlignée
  for (const [p,label] of [['devis-vocal','Nouveau devis'],['devis-modele','Devis'],['mes-tarifs','Mes tarifs'],['facture-modele','Factures'],['tva-modele','TVA déductible']]){
    const page = await ctx.newPage();
    await page.goto(`${B}/${p}.html`, { waitUntil:'domcontentloaded' }); await page.waitForTimeout(100);
    const active = await page.$$eval('.arborea-appnav .link.active', e => e.map(x => x.textContent));
    ok(`page active = ${label}`, active.length === 1 && active[0] === label);
    await page.close();
  }

  // 3) Mes tarifs : exemples, édition, persistance, ajout, suppression
  {
    const c2 = await browser.newContext(); await c2.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());
    const page = await c2.newPage();
    await page.goto(`${B}/mes-tarifs.html`, { waitUntil:'domcontentloaded' }); await page.waitForTimeout(150);
    await page.click('#loadExamples'); await page.waitForTimeout(100);
    ok('exemples chargent 3 postes', (await page.$$eval('#ressourcesList .card', e => e.length)) === 3);
    await page.$eval('#ressourcesList .card:first-child .f-prix', el => { el.value = '300'; el.dispatchEvent(new Event('input')); });
    await page.click('#addForfait'); await page.waitForTimeout(80);
    ok('ajout d’un forfait', (await page.$$eval('#forfaitsList .card', e => e.length)) === 1);
    await page.$eval('#tvaDefault', el => { el.value = '20'; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(80);
    await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(150);
    ok('prix persiste après reload (300)', (await page.$eval('#ressourcesList .card:first-child .f-prix', el => el.value)) === '300');
    ok('TVA défaut persiste (20)', (await page.$eval('#tvaDefault', el => el.value)) === '20');
    ok('forfait persiste après reload', (await page.$$eval('#forfaitsList .card', e => e.length)) === 1);
    const before = await page.$$eval('#ressourcesList .card', e => e.length);
    await page.click('#ressourcesList .card:first-child .btn-remove'); await page.waitForTimeout(100);
    ok('suppression d’un poste', (await page.$$eval('#ressourcesList .card', e => e.length)) === before - 1);
    await c2.close();
  }

  // 4) Devis vocal : cas d'extraction (aucun prix jamais inventé)
  async function analyze(page, grid, note){
    const reviewShown = await page.$eval('#reviewSection', el => getComputedStyle(el).display !== 'none').catch(() => false);
    if (reviewShown){ await page.click('#backBtn'); await page.waitForTimeout(60); }
    await page.evaluate(g => localStorage.setItem('arborea_tarifs', JSON.stringify(g)), grid);
    await page.fill('#transcript', note);
    await page.dispatchEvent('#transcript', 'input');
    await page.click('#analyzeBtn'); await page.waitForTimeout(120);
    return page.$$eval('.rline', els => els.map(r => ({
      desc: r.querySelector('.desc').childNodes[0].textContent.trim(),
      flagged: r.classList.contains('flag'),
      amount: r.querySelector('.amount').textContent.trim()
    })));
  }
  {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push('vocal: ' + e.message));
    await page.goto(`${B}/devis-vocal.html`, { waitUntil:'domcontentloaded' }); await page.waitForTimeout(150);

    let l = await analyze(page, GRID, "Chêne mort, deux jours, deux hommes, broyeur et camion.");
    ok('forfait reconnu (nombres en lettres)', l.some(x => /1 homme/.test(x.desc)));
    ok('pas de double comptage broyeur/camion', !l.some(x => x.desc === 'Broyeur') && !l.some(x => x.desc === 'Camion benne'));

    l = await analyze(page, { tvaDefault:10, ressources:GRID.ressources, forfaits:[] }, "Il faut le broyeur pendant 3 jours.");
    const broyeur = l.find(x => x.desc === 'Broyeur');
    ok('ressource seule reconnue (chiffres)', !!broyeur);
    ok('broyeur chiffré (3×180=540)', broyeur && /540/.test(broyeur.amount));

    l = await analyze(page, GRID, "Prévoir un dessouchage.");
    const dess = l.find(x => /Dessouchage/.test(x.desc));
    ok('poste sans prix reconnu', !!dess);
    ok('poste sans prix = signalé, jamais chiffré', dess && dess.flagged && dess.amount === '—');

    l = await analyze(page, GRID, "Bonjour, il fait beau aujourd'hui.");
    ok('note hors-sujet → 0 ligne', l.length === 0);
    ok('total 0 sur note hors-sujet', /0,00/.test(await page.$eval('#reviewTotal', e => e.textContent)));

    l = await analyze(page, GRID, "Chez Madame Martin au 5 avenue de la République. Broyeur une journée.");
    const cli = await page.$eval('#clientDetected', e => e.textContent);
    ok('client (Mme) détecté', /Martin/.test(cli));
    ok('adresse (avenue) détectée', /avenue de la République/i.test(cli));

    ok('aucune erreur JS pendant les analyses', errs.length === 0);
    if (errs.length) fails.push(...errs);
    await page.close();
  }

  // 5) Enchaînement vocal → devis
  {
    const page = await ctx.newPage();
    await page.goto(`${B}/devis-vocal.html`, { waitUntil:'domcontentloaded' }); await page.waitForTimeout(120);
    await page.evaluate(g => localStorage.setItem('arborea_tarifs', JSON.stringify(g)), GRID);
    await page.fill('#transcript', "Chez M. Dupont, 12 rue des Tilleuls. Deux jours, deux hommes, broyeur et camion.");
    await page.dispatchEvent('#transcript', 'input');
    await page.click('#analyzeBtn'); await page.waitForTimeout(100);
    await Promise.all([ page.waitForNavigation({ waitUntil:'domcontentloaded', timeout:15000 }), page.click('#toDevisBtn') ]);
    await page.waitForSelector('#linesBody tr .desc', { timeout:8000 }); await page.waitForTimeout(150);
    ok('handoff : client transféré', (await page.$eval('#clientNom', e => e.value)) === 'Dupont');
    const rows = await page.$$eval('#linesBody tr', trs => trs.map(t => ({ q:t.querySelector('.qty').value, p:t.querySelector('.price').value })));
    ok('handoff : ligne forfait 2×480', rows.length === 1 && rows[0].p === '480' && rows[0].q === '2');
    ok('handoff : TVA reprise (10)', (await page.$eval('#tvaRate', e => e.value)) === '10');
    await page.close();
  }

  // 6) Enchaînement devis → facture
  {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push('facture: ' + e.message));
    await page.goto(`${B}/devis-modele.html`, { waitUntil:'domcontentloaded' }); await page.waitForTimeout(150);
    await page.fill('#clientNom', 'Client Test');
    await page.$eval('#linesBody tr .desc', el => { el.value = 'Élagage tilleul'; el.dispatchEvent(new Event('input')); });
    await page.$eval('#linesBody tr .price', el => { el.value = '500'; el.dispatchEvent(new Event('input')); });
    await Promise.all([ page.waitForNavigation({ waitUntil:'domcontentloaded', timeout:15000 }), page.click('#createFactureBtn') ]);
    await page.waitForTimeout(200);
    ok('devis → facture : navigation', /facture-modele\.html$/.test(page.url()));
    ok('devis → facture : sans erreur JS', errs.length === 0);
    if (errs.length) fails.push(...errs);
    await page.close();
  }

  // 7) Envoi au client : partage natif mobile avec le PDF joint (html2pdf + share simulés)
  {
    const cShare = await browser.newContext();
    await cShare.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());
    const page = await cShare.newPage();
    const errs = []; page.on('pageerror', e => errs.push('envoi: ' + e.message));
    await page.addInitScript(() => {
      window.__shareCalls = [];
      const fakeBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      window.html2pdf = () => ({ set: () => ({ from: () => ({ outputPdf: async () => fakeBlob }) }) });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: d => !!(d && d.files) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
        window.__shareCalls.push({ title: d.title, text: d.text, files: (d.files || []).map(f => ({ name: f.name, type: f.type })) });
      }});
    });
    await page.goto(`${B}/devis-modele.html`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(150);
    ok('bouton « Envoyer au client » présent', (await page.$('#sendClientBtn')) !== null);
    await page.fill('#devisNum', '2026-042');
    await page.fill('#clientNom', 'Marie Martin');
    await page.$eval('#linesBody tr .price', el => { el.value = '600'; el.dispatchEvent(new Event('input')); });
    await page.click('#sendClientBtn'); await page.waitForTimeout(300);
    const calls = await page.evaluate(() => window.__shareCalls);
    ok('envoi : partage natif déclenché', calls.length === 1);
    ok('envoi : PDF joint (application/pdf)', calls[0] && calls[0].files.length === 1 && calls[0].files[0].type === 'application/pdf');
    ok('envoi : nom du fichier = Devis-2026-042.pdf', calls[0] && calls[0].files[0].name === 'Devis-2026-042.pdf');
    ok('envoi : objet contient le n° de devis', calls[0] && /2026-042/.test(calls[0].title));
    ok('envoi : message nomme le client', calls[0] && /Marie Martin/.test(calls[0].text));
    ok('envoi : aucune erreur JS', errs.length === 0);
    if (errs.length) fails.push(...errs);
    await cShare.close();
  }

  // 8) Envoi au client : dès qu'une adresse est connue, le message doit partir
  //    pré-rempli. `mailto:` est la seule voie qui remplit le destinataire —
  //    au prix de la pièce jointe, que le PDF téléchargé vient compenser.
  {
    const cDest = await browser.newContext({ acceptDownloads: true });
    await cDest.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());
    await cDest.addInitScript(() => {
      const fakeBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      window.html2pdf = () => ({ set: () => ({ from: () => ({ outputPdf: async () => fakeBlob }) }) });
      window.__shareCalls = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: d => !!(d && d.files) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
        window.__shareCalls.push({ files: (d.files || []).map(f => f.name) });
      }});
    });

    const page = await cDest.newPage();
    const errs = []; page.on('pageerror', e => errs.push('destinataire: ' + e.message));
    await page.goto(`${B}/devis-modele.html`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(150);

    await page.fill('#clientNom', 'Merlot');
    await page.fill('#clientEmail', 'merlot@example.test');
    await page.fill('#devisNum', '2026-001');

    // Le PDF doit être enregistré pour rester joignable depuis les fichiers.
    const [telechargement] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      page.click('#sendClientBtn')
    ]);
    await page.waitForTimeout(300);

    ok('envoi : le devis est enregistré pour être joint',
      !!telechargement && /Devis-2026-001\.pdf$/.test(telechargement.suggestedFilename()));

    const statut = await page.$eval('#sendStatus', el => ({ visible: !el.hidden, texte: el.textContent }));
    ok('envoi : le destinataire est annoncé', statut.visible && /merlot@example\.test/.test(statut.texte));
    ok('envoi : le nom du fichier à joindre est rappelé', /Devis-2026-001\.pdf/.test(statut.texte));

    // Avec une adresse, on ne passe PAS par le partage natif : il ne remplirait
    // pas le destinataire, ce que ce lot corrige précisément.
    ok('envoi : le partage natif n’est pas employé quand l’adresse est connue',
      (await page.evaluate(() => window.__shareCalls.length)) === 0);
    ok('envoi : aucune erreur JS (destinataire)', errs.length === 0);
    if (errs.length) fails.push(...errs);

    // Sans adresse, `mailto:` n'apporterait rien : on repasse au partage natif,
    // qui joint au moins le PDF, et le manque est signalé à l'écran.
    const page2 = await cDest.newPage();
    await page2.goto(`${B}/devis-modele.html`, { waitUntil: 'domcontentloaded' }); await page2.waitForTimeout(150);
    await page2.fill('#clientNom', 'Sans Mail');
    await page2.click('#sendClientBtn'); await page2.waitForTimeout(400);

    const statut2 = await page2.$eval('#sendStatus', el => ({ visible: !el.hidden, texte: el.textContent }));
    ok('envoi : absence d’adresse signalée', statut2.visible && /Aucun e-mail/.test(statut2.texte));
    ok('envoi : sans adresse, le PDF part au moins en partage',
      (await page2.evaluate(() => window.__shareCalls.length)) === 1);

    await cDest.close();
  }

  await browser.close();
  console.log(`\n✅ PASS: ${pass}   ❌ FAIL: ${fail}`);
  if (fails.length){ console.log('\nÉchecs :'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
