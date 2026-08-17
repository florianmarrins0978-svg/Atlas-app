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

/* Chemin du navigateur, quand il ne vit pas là où Playwright l'attend.
   Sur un runner CI (npx playwright install), la variable est absente et
   Playwright utilise le navigateur qu'il a lui-même installé — rien ne change.
   Ailleurs, elle évite d'avoir à réinstaller un navigateur déjà présent.
   Même mécanisme que scripts/e2e-browser.ts, côté application Next.js. */
const EXE = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
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

  // 8) Envoi mobile : le partage natif n'a pas de champ destinataire (limite
  //    d'iOS/Android, pas du code). L'adresse du client doit donc être copiée
  //    dans le presse-papier et rappelée à l'écran, sans quoi le patron doit la
  //    retrouver lui-même au moment de composer son message.
  {
    const cDest = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    await cDest.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());
    // Simulations posées sur le CONTEXTE : les deux pages de ce bloc en ont
    // besoin, et les attacher page par page laisse la seconde sans stub —
    // l'échec ressemble alors à un défaut du code plutôt qu'à un oubli du test.
    await cDest.addInitScript(() => {
      window.__copie = null;
      const fakeBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      window.html2pdf = () => ({ set: () => ({ from: () => ({ outputPdf: async () => fakeBlob }) }) });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: d => !!(d && d.files) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async t => { window.__copie = t; } }
      });
    });

    const page = await cDest.newPage();
    const errs = []; page.on('pageerror', e => errs.push('destinataire: ' + e.message));
    await page.goto(`${B}/devis-modele.html`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(150);

    await page.fill('#clientNom', 'Merlot');
    await page.fill('#clientEmail', 'merlot@example.test');
    await page.fill('#devisNum', '2026-001');
    await page.click('#sendClientBtn'); await page.waitForTimeout(400);

    ok('envoi : adresse du client copiée dans le presse-papier',
      (await page.evaluate(() => window.__copie)) === 'merlot@example.test');
    const statut = await page.$eval('#sendStatus', el => ({ visible: !el.hidden, texte: el.textContent }));
    ok('envoi : l’adresse est rappelée à l’écran', statut.visible && /merlot@example\.test/.test(statut.texte));
    ok('envoi : l’objet suggéré est rappelé', /2026-001/.test(statut.texte));
    ok('envoi : aucune erreur JS (destinataire)', errs.length === 0);
    if (errs.length) fails.push(...errs);

    // Sans e-mail renseigné, le patron doit être averti plutôt que de découvrir
    // un champ « À : » vide une fois dans son application de messagerie.
    const page2 = await cDest.newPage();
    await page2.goto(`${B}/devis-modele.html`, { waitUntil: 'domcontentloaded' }); await page2.waitForTimeout(150);
    await page2.fill('#clientNom', 'Sans Mail');
    await page2.click('#sendClientBtn'); await page2.waitForTimeout(400);
    const statut2 = await page2.$eval('#sendStatus', el => ({ visible: !el.hidden, texte: el.textContent }));
    ok('envoi : absence d’e-mail signalée', statut2.visible && /Aucun e-mail/.test(statut2.texte));

    await cDest.close();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PLAN D'ARROSAGE — la maquette essayable (17 août 2026).

     Elle n'a pas la barre de navigation d'Arborea, et c'est voulu : c'est une
     maquette d'Atlas posée ici parce que c'est le seul endroit du dépôt qui
     soit PUBLIÉ, donc le seul où le patron puisse l'ouvrir depuis son téléphone
     avec JavaScript. Les contrôles ci-dessous gardent ce qui casserait sans
     bruit : une erreur au chargement (page blanche), un calcul qui déborde le
     débit du robinet, et un prix qui apparaîtrait alors que toute la page tient
     sur la promesse qu'il n'y en a aucun.
     ───────────────────────────────────────────────────────────────────────── */
  {
    const cArr = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await cArr.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());
    const page = await cArr.newPage();
    const errs = []; page.on('pageerror', e => errs.push('arrosage: ' + e.message));
    await page.goto(`${B}/arrosage.html`, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(250);

    ok('arrosage : aucune erreur JS au chargement', errs.length === 0);
    if (errs.length) fails.push(...errs);

    const dispo = (await page.$eval('#debitDispo', el => el.textContent)).trim();
    ok('arrosage : le débit se calcule du seau', dispo === '1,80');

    const secteurs = await page.$$eval('.sec', e => e.length);
    ok('arrosage : le jardin de départ se découpe', secteurs >= 6);

    // **Le quinconce retire un arroseur, il ne le déplace pas.** Une pose
    // décalée qui garde tous ses points fait exactement ce qu'il a signalé le
    // 17 août : une capture avec une tête en trop, cerclée en rouge. Le plan
    // dessine désormais EXACTEMENT ce que le calcul a compté — même liste de
    // points, jamais recalculée à côté.
    const nomSurZone = await page.$eval('.zone-res', el => el.textContent);
    const teteAttendue = Number((nomSurZone.match(/^(\d+)\s/) || [])[1]);
    const tetesDessinees = await page.$$eval('#plans .plan', e => e.length ? e[0].querySelectorAll('.tete').length : -1);
    ok('arrosage : le plan dessine autant de têtes que le calcul en compte',
       teteAttendue > 0 && tetesDessinees === teteAttendue);

    // L'invariant du métier : un secteur au-dessus du robinet, et les derniers
    // arroseurs bavent au lieu d'arroser.
    const debits = await page.$$eval('.sec-q', e => e.map(x => parseFloat(x.textContent.replace(',', '.'))));
    ok('arrosage : aucun secteur au-dessus du robinet',
       debits.length > 0 && debits.every(d => d <= parseFloat(dispo.replace(',', '.'))));

    // Le cycle décide de l'heure de départ : s'il ne fait pas la somme de ses
    // secteurs, il envoie arroser en plein soleil.
    const mins = await page.$$eval('.sec-min', e => e.map(x => Number(x.textContent)));
    const verdict = await page.$eval('#verdict', el => el.innerText);
    const m = verdict.match(/(\d+)\s*h\s*(\d+)/);
    ok('arrosage : le cycle est la somme des secteurs',
       !!m && Number(m[1]) * 60 + Number(m[2]) === mins.reduce((a, b) => a + b, 0));

    // Sa décision du 17 août : la sortie est une liste de quantités, pas un
    // devis. Le jour où un montant apparaît, ce contrôle le dit.
    const corps = await page.$eval('body', el => el.innerText);
    ok('arrosage : aucun prix nulle part', !/€|\bEUR\b/.test(corps));
    ok('arrosage : la liste porte le disconnecteur', /Disconnecteur/.test(corps));

    // Un ajout de zone doit vraiment ajouter : c'est le geste central.
    const avant = await page.$$eval('.zone', e => e.length);
    await page.click('[data-ajout="massif"]'); await page.waitForTimeout(150);
    ok('arrosage : ajouter une zone l’ajoute', (await page.$$eval('.zone', e => e.length)) === avant + 1);

    // **Le coude SBE, sa consigne du 17 août : « sous les arroseurs il faut
    // obligatoirement des coudes SBE, choisis-les en fonction des diamètres,
    // un à chaque fois par arroseur. »** Le taraudage vient du corps choisi
    // (1/2" ou 3/4"), pas d'une supposition — deux références différentes
    // selon la famille, et le mauvais choix ne visse simplement pas.
    const materiel = await page.$eval('#materiel', el => el.innerText);
    ok('arrosage : un coude SBE est compté, un par arroseur', /Coude SBE/.test(materiel));
    ok('arrosage : plus de « crosse » générique — remplacée par le vrai coude',
       !/[Cc]rosse/.test(materiel), materiel.match(/[Cc]rosse[^\n]*/)?.[0] || '');

        // **Le corps par défaut, sa décision du 17 août : « 10 cm sans option,
    // mais proposer les autres à chaque fois ». Un sélecteur cassé (élément
    // absent du DOM) fait planter TOUTE la page — c'est le défaut réellement
    // survenu en écrivant ce lot : une édition partielle avait laissé le
    // script référencer un <select id="corps"> qui n'existait pas.**
    const corpsChoix = await page.$eval('#corps', el => el.value);
    ok('arrosage : un corps est sélectionné par défaut', !!corpsChoix, 'lu : ' + corpsChoix);
    const corpsNote = await page.$eval('#corpsNote', el => el.innerText);
    ok('arrosage : le corps par défaut est le 10 cm sans option',
       /10 cm/.test(corpsNote) && !/SAM|régulateur/i.test(corpsNote), corpsNote.slice(0, 80));
    ok('arrosage : ce que le corps apporte est expliqué en clair',
       /courant|pente|pression/i.test(corpsNote), corpsNote.slice(0, 80));

    // Rien ne doit déborder sur un téléphone.
    ok('arrosage : rien ne déborde en largeur',
       await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    // **Le chemin qu'aucune donnée n'emprunte encore.** Ses fiches de nourrice
    // n'existent pas au 17 août ; le jour où elles arriveront, il faut que le
    // rendu marche du premier coup — sinon c'est lui qui découvre la panne
    // après avoir tapé sa fiche. On en injecte une factice, ici et seulement
    // ici : le catalogue livré, lui, reste vide tant qu'il n'a rien donné.
    await page.evaluate(() => {
      CATALOGUE.nourrices[99] = { nom:'Nourrice 99 voies', source:'essai',
        pieces:[{ q:1, u:'u', nom:'Pièce d’essai' }] };
      window.__voies = document.querySelectorAll('.sec').length;
      CATALOGUE.nourrices[window.__voies] = CATALOGUE.nourrices[99];
      recalculer(false);
    });
    await page.waitForTimeout(150);
    const fiche = await page.$eval('#nourrice', el => el.innerText);
    ok('arrosage : une fiche de nourrice enregistrée s’affiche',
       /Pièce d’essai/.test(fiche) && !/à renseigner/.test(fiche));

    // **Les débits par ARC sont lus au catalogue, jamais déduits par division.**
    // Sur les grosses buses la division tombe juste, donc un contrôle posé sur
    // la 18-VAN n'aurait rien vu. Celui-ci force une petite zone, où la 6-VAN
    // est retenue : le tableau donne 0,08 / 0,13 / 0,27, quand une division du
    // tour complet donnerait 0,0675 / 0,135. Douze arroseurs → 1,64 m³/h par le
    // tableau, 0,54 par division. Quatre centièmes : c'est tout ce qui sépare
    // une donnée relevée d'une donnée supposée, et c'est mesurable.
    await page.evaluate(() => {
      etat.zones = [{ id:900, nom:'Petit gazon', type:'gazon', L:3, l:2, materiel:'tuyere' }];
      recalculer(true);
    });
    await page.waitForTimeout(200);
    const petite = await page.$eval('.zone-res', el => el.textContent);
    ok('arrosage : le débit d’un arc vient du tableau, pas d’une division',
       /0,58\s*m³\/h/.test(petite), 'lu : ' + petite.slice(0, 90));

    ok('arrosage : toujours aucune erreur JS', errs.length === 0);
    await cArr.close();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     LE REGISTRE DE SES PRIX (17 août 2026).

     Sa consigne : les prix des catalogues sont des prix CLIENT, ils ne
     s'enregistrent pas. Les siens, négociés, se tapent ici et ne quittent pas
     son navigateur. Ce que ces contrôles tiennent, et qui se perdrait sans eux :
     tant que le registre est vide, AUCUN euro n'apparaît sur le plan ; dès
     qu'un prix est saisi, il est repris — et les lignes sans prix restent
     comptées comme manquantes plutôt que comblées.
     ───────────────────────────────────────────────────────────────────────── */
  {
    const cPrix = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await cPrix.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());
    const page = await cPrix.newPage();
    const errs = []; page.on('pageerror', e => errs.push('tarifs: ' + e.message));
    await page.goto(`${B}/arrosage-tarifs.html`, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(250);
    await page.evaluate(() => localStorage.removeItem('atlas-arrosage-prix'));
    await page.reload({ waitUntil:'domcontentloaded' });
    await page.waitForTimeout(250);

    ok('tarifs : aucune erreur JS au chargement', errs.length === 0);
    if (errs.length) fails.push(...errs);

    const produits = await page.$$eval('.p', e => e.length);
    ok('tarifs : le registre liste les produits du catalogue', produits >= 10);
    ok('tarifs : aucun prix pré-rempli',
       (await page.$$eval('.p input', e => e.filter(x => x.value !== '').length)) === 0);

    // **Aucun prix de CATALOGUE nulle part.** Sa consigne : les tarifs imprimés
    // sont des prix client. Une première version de ce contrôle ne regardait
    // que le plan — un prix recopié dans la fiche produit passait au vert. Il
    // regarde donc les descriptifs eux-mêmes.
    const details = await page.$$eval('.p .det', e => e.map(x => x.textContent).join(' | '));
    ok('tarifs : aucun montant dans les descriptifs produits', !/\d\s*€/.test(details));

    // Le plan, registre vide : pas un euro. C'est la promesse de toute la page.
    const plan = await cPrix.newPage();
    await plan.goto(`${B}/arrosage.html`, { waitUntil:'domcontentloaded' });
    await plan.waitForTimeout(300);
    ok('tarifs : registre vide, aucun euro sur le plan',
       !/€/.test(await plan.$eval('#materiel', el => el.innerText)));

    // Il tape un prix : le plan le reprend, et dit ce qui manque encore.
    await page.$eval('.p input', el => { el.value = '3.10'; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(200);
    ok('tarifs : le compte suit la saisie', /1 \/ /.test(await page.$eval('#compte', el => el.innerText)));

    await plan.reload({ waitUntil:'domcontentloaded' });
    await plan.waitForTimeout(300);
    const total = await plan.$eval('#total', el => el.innerText);
    ok('tarifs : le plan chiffre à SON prix', /€ HT/.test(total));
    // **Le montant est vérifié au centime**, pas par un motif de texte. Une
    // version antérieure se contentait de lire « … sans prix » : un total qui
    // comblait ses trous à 10 € la ligne affichait toujours cette phrase et
    // passait au vert. 11 buses (quinconce : un arroseur de moins que la
    // grille carrée, sa correction du 17 août) à 3,10 € font 34,10 € — rien d'autre.
    ok('tarifs : le total vaut EXACTEMENT les lignes chiffrées', /34,10\s*€/.test(total),
       'lu : ' + total.slice(0, 80));
    ok('tarifs : et les lignes sans prix restent annoncées', /sans prix|INCOMPLET/.test(total));

    // Une case vidée efface le prix — « gratuit » n'est pas « pas renseigné ».
    await page.$eval('.p input', el => { el.value = ''; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(200);
    ok('tarifs : vider une case efface le prix', /0 \/ /.test(await page.$eval('#compte', el => el.innerText)));

    ok('tarifs : toujours aucune erreur JS', errs.length === 0);
    await cPrix.close();
  }

  await browser.close();
  console.log(`\n✅ PASS: ${pass}   ❌ FAIL: ${fail}`);
  if (fails.length){ console.log('\nÉchecs :'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
