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
// Le troisième mot dit CE QUI A ÉTÉ MESURÉ. Il était passé par des dizaines de
// contrôles et jeté ici : un échec sur la machine de publication ne donnait
// que son nom, et il fallait deviner (19 novembre 2026).
function ok(name, cond, mesure){ if (cond) pass++; else { fail++; fails.push(mesure ? name + '\n      mesuré : ' + String(mesure).slice(0, 400) : name); } }

/* Chemin du navigateur, quand il ne vit pas là où Playwright l'attend.
   Sur un runner CI (npx playwright install), la variable est absente et
   Playwright utilise le navigateur qu'il a lui-même installé — rien ne change.
   Ailleurs, elle évite d'avoir à réinstaller un navigateur déjà présent.
   Même mécanisme que scripts/e2e-browser.ts, côté application Next.js. */
const EXE = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

/* Une photo d'essai engendrée ici, pour éprouver le croquis sans dépendre d'un
   binaire déposé à la main — qui se perdrait au premier rangement du dépôt. */
const CROQUIS_ESSAI = '/tmp/croquis-essai-e2e.png';
{
  const { writeFileSync } = require('fs');
  const zlib = require('zlib');
  const w = 900, h = 700, lignes = [];
  for (let y = 0; y < h; y++){
    const l = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++){ l[1 + x*3] = 205; l[2 + x*3] = 212; l[3 + x*3] = 195; }
    lignes.push(l);
  }
  const morceau = (type, data) => {
    const c = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(c));
    return Buffer.concat([len, c, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(CROQUIS_ESSAI, Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(Buffer.concat(lignes))),
    morceau('IEND', Buffer.alloc(0))
  ]));
}

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const ctx = await browser.newContext();
  // Coupe les ressources externes (polices/CDN) : tests hors-ligne, rapides et déterministes.
  await ctx.route(/googleapis|gstatic|cloudflare|jsdelivr/i, r => r.abort());

  const GRID = { tvaDefault:10, ressources:[
    { libelle:'Main-d’œuvre, 1 personne', categorie:'Main-d’œuvre', unite:'jour', prix:250 },
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

    // Le panneau des secteurs a été retiré le 17 août sur sa demande ; le
    // découpage, lui, tourne toujours et décide de tout le reste.
    const secteurs = await page.evaluate(() => decouper().secteurs.length);
    // Le seuil était de 6 : il visait le jardin d'exemple d'alors. Le quinconce
    // de son croquis du 18 août a fait tomber le débit, donc le nombre de
    // vannes. Ce que ce contrôle garde n'est pas un nombre — c'est que le
    // découpage RÉPONDE au lieu de rendre zéro, ce qui serait le signe qu'il ne
    // tourne plus depuis que son écran a disparu.
    ok('arrosage : le jardin de départ se découpe', secteurs >= 1);

    // **Le quinconce retire un arroseur, il ne le déplace pas.** Une pose
    // décalée qui garde tous ses points fait exactement ce qu'il a signalé le
    // 17 août : une capture avec une tête en trop, cerclée en rouge. Le plan a
    // depuis quitté l'écran, sur sa demande — mais l'invariant qui comptait
    // reste : le nombre ANNONCÉ sur la zone et la liste de points sont une
    // seule et même chose, jamais deux calculs côte à côte.
    const nomSurZone = await page.$eval('.zone-res', el => el.textContent);
    const teteAttendue = Number((nomSurZone.match(/^(\d+)\s/) || [])[1]);
    const pointsComptes = await page.evaluate(() => {
      const z = etat.zones.filter(x => TYPES[x.type].forme === 'surface')[0];
      const p = poser(z);
      return { nombre: p.nombre, points: p.points.length };
    });
    ok('arrosage : le nombre annoncé est exactement la liste de points',
       teteAttendue > 0 && pointsComptes.points === teteAttendue &&
       pointsComptes.nombre === teteAttendue);

    // L'invariant du métier : un secteur au-dessus du robinet, et les derniers
    // arroseurs bavent au lieu d'arroser.
    //
    // **Lu dans le CALCUL et non à l'écran** : le panneau des secteurs a été
    // retiré le 17 août sur sa demande (« tu supprimes la 3 »), mais le
    // découpage tourne toujours — c'est lui qui donne les couleurs du plan et
    // le nombre d'électrovannes. L'invariant, lui, n'a pas bougé d'un pouce.
    const debits = await page.evaluate(() => decouper().secteurs.map(s => s.debit));
    ok('arrosage : aucun secteur au-dessus du robinet',
       debits.length > 0 && debits.every(d => d <= parseFloat(dispo.replace(',', '.')) + 1e-9));


    // **LE CROQUIS — sa demande du 17 août : « la 2, ça doit être la photo du
    // croquis qu'on ajoute ».** La page est publiée sans serveur : elle ne LIT
    // pas les cotes, et elle doit le dire. Un écran qui laisserait croire le
    // contraire ferait partir un jardin vide sur un chantier.
    ok('arrosage : le croquis se photographie', (await page.$$eval('#croquisFichier', e => e.length)) === 1);
    // **On POSE une photo pour éprouver l'avertissement.** Une première version
    // acceptait aussi le texte affiché SANS photo : elle passait au vert même
    // quand l'avertissement avait disparu, puisque l'autre branche du message
    // suffisait à la satisfaire. Un contrôle qui accepte deux états n'en garde
    // aucun.
    await page.setInputFiles('#croquisFichier', CROQUIS_ESSAI);
    await page.waitForTimeout(900);
    ok('arrosage : la photo du croquis s\'affiche', (await page.$$eval('.croquis-vue img', e => e.length)) === 1);
    ok('arrosage : et la page annonce ce qu\'elle ne sait pas encore lire',
       /ne se lisent pas encore/.test(await page.$eval('#croquisNote', el => el.innerText)));
    // Et les sections retirées le sont VRAIMENT : « tu supprimes la 3 ».
    const titres = await page.$$eval('h2', e => e.map(x => x.textContent.trim()));
    ok('arrosage : trois sections — le découpage ET le plan retirés',
       titres.length === 3 && /Le croquis/.test(titres[1]) &&
       !titres.some(t => /secteurs/i.test(t)) && !titres.some(t => /^\d+ · Le plan/.test(t)));

    // Sa décision du 17 août : la sortie est une liste de quantités, pas un
    // devis. Le jour où un montant apparaît, ce contrôle le dit.
    const corps = await page.$eval('body', el => el.innerText);
    ok('arrosage : aucun prix nulle part', !/€|\bEUR\b/.test(corps));
    // Retourné le 18 août sur sa décision : *« le disconnecteur, tu peux le
    // supprimer à tout jamais, je n'en mets jamais. »* Gardé plutôt que
    // supprimé, pour que la pièce ne revienne pas au premier raisonnement
    // « c'est obligatoire sur l'eau potable » — juste en général, faux pour
    // lui, et sa décision serait perdue.
    ok('arrosage : le disconnecteur n\'est plus dans la liste', !/Disconnecteur/.test(corps),
       (corps.match(/[^\n]*Disconnecteur[^\n]*/) || [''])[0]);

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

    // **Deux SBE par arroseur, pas un** — sa planche du 17 août sur le réseau
    // latéral : un raccord en bas (toujours 3/4", sur la tuyauterie) et un en
    // haut (au diamètre du corps). En manquer un sous-compte une pièce que
    // chaque arroseur porte réellement.
    //
    // **Ce contrôle lisait les étiquettes « (haut, au corps) » et « (bas, sur
    // la ligne) » ; il compte désormais.** Le patron a fait retirer ces
    // mentions le 18 août — *« ce sont des données pour toi [...] l'utilisateur
    // n'a pas besoin de ces infos-là »* —, et les deux emplois d'une même
    // référence se sont fondus en une ligne. Un contrôle accroché à un libellé
    // meurt au premier changement de libellé ; la RÈGLE, elle, ne bouge pas :
    // deux SBE par arroseur, quel que soit le nom écrit sur la ligne.
    const sbe = await page.evaluate(() => {
      const arroseurs = etat.zones.reduce((s, z) => {
        const p = poser(z);
        return s + (p.m && p.m.type !== 'gaine' ? p.nombre : 0);
      }, 0);
      const total = listeMateriel(decouper())
        .filter(l => /SBE/.test(l.nom)).reduce((s, l) => s + l.q, 0);
      return { arroseurs, total };
    });
    // Le cas qui empêche de mesurer zéro : sans arroseur posé, 0 === 2×0 serait
    // vert sans rien prouver (le piège du 15 août).
    ok('arrosage : le jardin d\'épreuve pose bien des arroseurs', sbe.arroseurs > 0,
       JSON.stringify(sbe));
    ok('arrosage : deux SBE par arroseur — celui du haut ET celui du bas',
       sbe.arroseurs > 0 && sbe.total === sbe.arroseurs * 2, JSON.stringify(sbe));
    ok('arrosage : le PEBD16 de reprise est compté', /PEBD rigide/.test(materiel));

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
    // arrivées le 17 août 2026 (de 1 à 6 voies, relevées « ce qui se trouve
    // dans le regard d'arrosage »). Un jardin de 8×6 m avec des tuyères
    // tombe sur 3 secteurs, qui a sa fiche réelle : la 3504 (Rain Bird) prend
    // sa place. Testé sur de VRAIES données, pas un montage de fortune.
    await page.evaluate(() => {
      etat.zones = [{ id:900, nom:'Test', type:'gazon', L:8, l:6, materiel:'tuyere' }];
      recalculer(true);
    });
    await page.waitForTimeout(150);
    const fiche = await page.$eval('#nourrice', el => el.innerText);
    // Le mot « Clarinette » était un indice de « c'est une vraie fiche », et il
    // est tombé le 18 août : les petites fiches se montent sans clarinette.
    // Ce qui compte est que la fiche soit LA SIENNE (source « patron ») et
    // qu'elle s'affiche complète.
    ok('arrosage : une fiche de nourrice enregistrée s’affiche',
       /votre fiche/i.test(fiche) && /Électrovanne/.test(fiche) && !/à renseigner/.test(fiche));
    // Ses pièces se retrouvent aussi dans la liste chiffrable — pas dupliquées,
    // pas oubliées : c'est ELLES qui remplacent les lignes génériques.
    // **Ce contrôle exigeait le mot « Clarinette », et il est devenu faux le
    // 18 août** : le quinconce de son croquis a fait tomber ce jardin à moins
    // de voies, et les petites fiches se montent sans clarinette. Le mot
    // n'était qu'un indice ; la RÈGLE est que ses pièces REMPLACENT les
    // lignes génériques au lieu de s'y ajouter.
    const materiel2 = await page.$eval('#materiel', el => el.innerText);
    const remplace = await page.evaluate(() => {
      const d = decouper();
      const f = CATALOGUE.ficheNourrice(d.secteurs.length, combienGoutteAGoutte(d));
      if (!f || !f.pieces || !f.pieces.length) return { fiche: false };
      const refs = listeMateriel(d).map(l => l.ref);
      const manquantes = f.pieces.filter(x => refs.indexOf(x.ref) < 0);
      return { fiche: true, source: f.source, pieces: f.pieces.length,
               manquantes: manquantes.map(x => x.ref) };
    });
    // Sans fiche, rien n'est éprouvé : on le dit au lieu de rendre du vert.
    ok('arrosage : une fiche de nourrice existe bien pour ce jardin',
       remplace.fiche === true && remplace.source === 'patron', JSON.stringify(remplace));
    ok('arrosage : les pièces de la fiche entrent dans la liste chiffrable',
       remplace.fiche && remplace.pieces > 0 && remplace.manquantes.length === 0 &&
       !/Électrovannes 24 V|Regards de vannes/.test(materiel2),
       'manquantes : ' + (remplace.manquantes || []).join(', '));

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
    // **Le nombre 0,58 était écrit en dur, et il a bougé avec le quinconce.**
    // Ce qu'il gardait ne bouge pas : le débit d'un quart et d'un demi-tour est
    // LU au catalogue, jamais obtenu en divisant le tour complet. On compare
    // donc les deux façons de compter — et l'on exige qu'elles DIFFÈRENT, ce
    // qui est le seul témoignage qu'on a bien lu le tableau.
    const arcs = await page.evaluate(() => {
      const z = etat.zones[0], p = poser(z);
      if (!p.m || !p.points) return { pose: false };
      const parTable = p.debit;
      // La 6-VAN s'arrête à 330° (16 octobre 2026) : son dernier chiffre tient
      // lieu de tour complet pour la division qu'on compare.
      const tour = p.m.debit360 != null ? p.m.debit360 : p.m.debitParAngle[330];
      const parDivision = p.points.reduce((s, pt) =>
        s + (pt.zone === 'coin' ? tour/4 : pt.zone === 'bord' ? tour/2 : tour), 0);
      return { pose: true, buse: p.m.nom + ' ' + p.m.detail, tetes: p.points.length,
               lu: !!p.m.debitParAngle, parTable: +parTable.toFixed(3), parDivision: +parDivision.toFixed(3) };
    });
    ok('arrosage : la petite zone pose bien des tuyères à arcs', arcs.pose && arcs.tetes > 0 && arcs.lu,
       JSON.stringify(arcs));
    ok('arrosage : le débit d’un arc vient du tableau, pas d’une division',
       arcs.pose && Math.abs(arcs.parTable - arcs.parDivision) > 0.005, JSON.stringify(arcs));

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
    //
    // **Le contrôle DEMANDE AU PLAN quelle référence il commande, au lieu de
    // la nommer.** Deux versions ont rougi pour n'avoir pas fait cela : la
    // première visait la première carte du registre, la seconde nommait la
    // 12-VAN — et chaque fois qu'une de ses règles a changé le jardin
    // d'exemple (les turbines posables, puis les tuyères réservées aux petits
    // espaces), le contrôle chiffrait un produit que le plan ne commande plus.
    // Trois cases rouges pour une raison qui n'était pas la leur. Ici, la
    // référence et sa quantité sortent du plan lui-même : le jardin peut
    // changer autant qu'il veut, le contrôle éprouve toujours la même chose —
    // que le total vaille EXACTEMENT quantité × prix saisi.
    const cible = await plan.evaluate(() => {
      const l = listeMateriel(decouper()).filter(x => x.ref && x.u === 'u');
      return l.length ? { ref: l[0].ref, q: l[0].q } : null;
    });
    ok('tarifs : le plan commande bien une référence chiffrable', !!cible && cible.q > 0,
       JSON.stringify(cible));
    await page.$$eval('.p', (cartes, ref) => {
      const carte = cartes.filter(c => c.textContent.indexOf(ref) >= 0)[0];
      const el = carte.querySelector('input');
      el.value = '3.10'; el.dispatchEvent(new Event('input'));
    }, cible.ref);
    await page.waitForTimeout(200);
    ok('tarifs : le compte suit la saisie', /1 \/ /.test(await page.$eval('#compte', el => el.innerText)));

    await plan.reload({ waitUntil:'domcontentloaded' });
    await plan.waitForTimeout(300);
    const total = await plan.$eval('#total', el => el.innerText);
    ok('tarifs : le plan chiffre à SON prix', /€ HT/.test(total));
    // **Le montant est vérifié au centime**, pas par un motif de texte. Une
    // version antérieure se contentait de lire « … sans prix » : un total qui
    // comblait ses trous à 10 € la ligne affichait toujours cette phrase et
    // passait au vert. Le montant attendu est calculé depuis la quantité que
    // le plan commande — et surtout pas depuis le total des arroseurs, ce qui
    // laisserait passer un cumul de lignes non chiffrées.
    const attendu = (cible.q * 3.10).toFixed(2).replace('.', ',');
    ok('tarifs : le total vaut EXACTEMENT les lignes chiffrées',
       new RegExp(attendu.replace(',', ',') + '\\s*€').test(total),
       'attendu ' + attendu + ' € (' + cible.q + ' × 3,10) | lu : ' + total.slice(0, 80));
    ok('tarifs : et les lignes sans prix restent annoncées', /sans prix|INCOMPLET/.test(total));

    // Une case vidée efface le prix — « gratuit » n'est pas « pas renseigné ».
    // La MÊME carte que celle qu'on vient de remplir, sinon on vide une case
    // déjà vide et le contrôle passe au vert sans rien avoir éprouvé.
    await page.$$eval('.p', (cartes, ref) => {
      const carte = cartes.filter(c => c.textContent.indexOf(ref) >= 0)[0];
      const el = carte.querySelector('input');
      el.value = ''; el.dispatchEvent(new Event('input'));
    }, cible.ref);
    await page.waitForTimeout(200);
    ok('tarifs : vider une case efface le prix', /0 \/ /.test(await page.$eval('#compte', el => el.innerText)));

    ok('tarifs : toujours aucune erreur JS', errs.length === 0);
    await cPrix.close();
  }

  // ── Les clients, à l'essai ────────────────────────────────────────────────
  //
  // Sa demande du 17 août 2026 au soir : *« montre-moi depuis chantier ce que ça
  // donnerait, crée une maquette dynamique que je puisse essayer »*.
  //
  // **Elle se manipule SANS JavaScript** — la navigation passe par `:target`.
  // Le contrôle coupe donc le script : c'est la seule façon de prouver que la
  // page ne dépend pas de lui, et une planche qui ne s'ouvrirait pas chez lui
  // ne vaut rien.
  {
    const cCl = await browser.newContext({ viewport: { width: 390, height: 850 }, javaScriptEnabled: false });
    const page = await cCl.newPage();
    const visible = (id) => page.locator('#' + id).isVisible();

    await page.goto(`${B}/clients.html`, { waitUntil: 'domcontentloaded' });
    ok('clients : l\'accueil s\'ouvre seul', (await visible('accueil')) && !(await visible('liste')));

    await page.locator('#accueil a[href="#liste"]').click();
    ok('clients : « Vos clients » ouvre la liste', (await visible('liste')) && !(await visible('accueil')));

    await page.locator('#liste a[href="#client"]').first().click();
    ok('clients : un nom ouvre sa fiche', await visible('client'));

    // **Le chemin qu'il a demandé de voir : DEPUIS un chantier.**
    await page.locator('#client a[href="#chantier"]').first().click();
    ok('clients : un chantier s\'ouvre depuis la fiche', await visible('chantier'));
    await page.locator('#chantier a[href="#client"]').first().click();
    ok('clients : et le chantier ramène à la fiche du client', await visible('client'));

    // **L'arithmétique, parce qu'il la refait.** Le détail des chantiers doit
    // faire le total facturé, et le seul impayé doit faire ce qui reste dû.
    await page.goto(`${B}/clients.html#client`, { waitUntil: 'domcontentloaded' });
    const texte = await page.locator('#client').innerText();
    const montants = (texte.match(/(\d[\d  ]*) €/g) || []).map(m => Number(m.replace(/[^\d]/g, '')));
    const parChantier = [887, 740, 980, 593];
    ok('clients : le détail des chantiers fait bien le total facturé',
       montants.indexOf(parChantier.reduce((a, b) => a + b, 0)) >= 0,
       'attendu 3200 quelque part dans : ' + montants.join(', '));
    ok('clients : ce qui reste dû est bien le seul chantier impayé',
       /740 €.*impay|impay.*740 €/s.test(texte) && montants.indexOf(740) >= 0);

    // La barre du bas garde QUATRE onglets : le cinquième est réservé aux
    // outils métier, et à cinq colonnes « CHANTIERS » déborde déjà.
    const onglets = await page.locator('.barre span').count();
    ok('clients : la barre du bas garde quatre onglets', onglets === 4, 'vus : ' + onglets);

    // Rien ne déborde sur son téléphone.
    const large = await page.evaluate(() => document.documentElement.scrollWidth);
    ok('clients : rien ne déborde à 390 px', large <= 391, 'largeur ' + large);

    await cCl.close();
  }

  // ── Le site de vente : le bouton d'essai caché ne dépasse pas ────────────
  //
  // Sa capture du 7 novembre 2026, sur iPhone : un petit bandeau vert au bas
  // du site. C'était le bouton « Essayer 15 jours gratuits », caché en le
  // descendant de 140 % de sa hauteur, alors qu'il est posé à 12 px du bas
  // PLUS la marge que l'iPhone réserve à sa barre d'accueil. Chromium vaut 0
  // pour cette marge : la page est servie ici avec 34 px, la valeur d'un
  // iPhone, sans quoi le contrôle ne verrait jamais le défaut.
  //
  // `cause-2.html` (17 novembre 2026) reprend ce bouton et ces films dans une
  // page au mouvement refait : elle passe les deux mêmes contrôles, sans quoi
  // les deux défauts qu'il a signalés pourraient y revenir sans rien dire.
  // Chaque page nomme ses films : celui de l'équipe a été remonté pour la
  // planche en mouvement (« c'est pas fluide », 17 novembre 2026), celui de
  // l'envoi y montre le client qui signe (18 novembre 2026), celui de la
  // fiche d'intervention y porte aussi les travaux cochés et le retour du
  // soir (19 novembre 2026 : le film des travaux n'y est donc plus), et
  // l'autre page garde les siens. Un film renommé d'un seul côté ferait
  // chercher un cadre qui n'existe pas : le contrôle le dit au lieu de s'y
  // casser.
  //
  // Le dernier mot de chaque page dit si, le film fini, il doit rester sous
  // sa dernière image (voir plus bas, « reste sous sa dernière image ») : la
  // planche en mouvement le tient depuis le 19 novembre 2026. L'autre page,
  // qu'il a demandé de ne pas toucher, garde l'ancienne mécanique.
  const FILMS = ['micro', 'envoi', 'mois', 'equipe', 'travaux'];
  const FILMS_EN_MOUVEMENT = ['micro', 'envoi-signe', 'mois', 'equipe-fluide', 'fiche'];
  const PAGES_DE_VENTE = [
    ['chapitres-6.html', 'vente', FILMS, false],
    ['cause-2.html', 'vente, en mouvement', FILMS_EN_MOUVEMENT, true],
  ];
  for (const [fichier, nomPage] of PAGES_DE_VENTE) {
    const cVe = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await cVe.route((url) => url.pathname.endsWith('/vente/' + fichier), async (route) => {
      const r = await route.fetch();
      route.fulfill({ response: r, body: (await r.text()).replace(/env\(safe-area-inset-bottom\)/g, '34px') });
    });
    const page = await cVe.newPage();
    await page.goto(`${B}/vente/${fichier}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200);
    const pouce = await page.evaluate(() => {
      const el = document.getElementById('pouce'), r = el.getBoundingClientRect();
      return { cache: !el.classList.contains('vu'), haut: r.top, ecran: innerHeight, visible: getComputedStyle(el).visibility };
    });
    ok(nomPage + ' : au bas du site, le bouton d\'essai est caché', pouce.cache);
    ok(nomPage + ' : caché, il ne dépasse pas du bas de l\'écran',
       pouce.visible === 'hidden' || pouce.haut >= pouce.ecran,
       'il dépasse de ' + Math.round(pouce.ecran - pouce.haut) + ' px');
    await cVe.close();
  }

  // ── Le site de vente : la porte des outils de paysage ───────────────────
  //
  // Sa demande du 20 novembre 2026 : « qu'on puisse cliquer sur l'abonnement
  // de 6 € pour les outils, et que ça soit une porte » vers une page qui les
  // montre. La carte « Les outils de paysage », sous les trois formules de
  // cause-2.html, s'ouvre donc d'un doigt posé n'importe où sur elle, pas
  // seulement sur son bouton : on la touche au milieu de sa liste. Puis la
  // page derrière la porte : chacune de ses images est là (leurs noms ne se
  // composent pas, mais une image absente laisserait un téléphone vide), et
  // son bouton d'essai, caché au bas, ne dépasse pas (le défaut du
  // 7 novembre, vu plus haut).
  {
    const cPo = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await cPo.route((url) => url.pathname.endsWith('/vente/outils.html'), async (route) => {
      const r = await route.fetch();
      route.fulfill({ response: r, body: (await r.text()).replace(/env\(safe-area-inset-bottom\)/g, '34px') });
    });
    const page = await cPo.newPage();
    await page.goto(`${B}/vente/cause-2.html`, { waitUntil: 'domcontentloaded' });
    const carte = page.locator('.option-outils');
    await carte.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);
    const prix = await page.evaluate(() => { const c = document.querySelector('.option-outils'); return c && c.querySelector('.montant').textContent + ' ' + c.querySelector('.rythme').textContent; });
    ok('vente, en mouvement : la carte des outils dit 6 € HT par mois', prix === '6 € HT par mois', prix);
    // Sur un téléphone la carte est plus haute que l'écran : on amène la
    // ligne touchée à l'écran, sans quoi le doigt tombe hors de la page.
    await page.locator('.outils-liste li').nth(1).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const ligne = await page.locator('.outils-liste li').nth(1).boundingBox();
    if (ligne) {
      await Promise.all([page.waitForURL(/\/vente\/outils\.html$/, { timeout: 8000 }).catch(() => {}), page.mouse.click(ligne.x + ligne.width / 2, ligne.y + ligne.height / 2)]);
    }
    ok('vente, en mouvement : toucher la carte des outils ouvre leur page', /\/vente\/outils\.html$/.test(page.url()), page.url());
    if (!/\/vente\/outils\.html$/.test(page.url())) await page.goto(`${B}/vente/outils.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    const images = await page.evaluate(() => Array.from(document.images).filter((i) => !(i.complete && i.naturalWidth)).map((i) => i.getAttribute('src')));
    ok('vente, les outils : chaque image de la page est là', images.length === 0, images.join(', '));
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200);
    const pouce = await page.evaluate(() => {
      const el = document.getElementById('pouce'), r = el.getBoundingClientRect();
      return { cache: !el.classList.contains('vu'), haut: r.top, ecran: innerHeight, visible: getComputedStyle(el).visibility };
    });
    ok('vente, les outils : au bas de la page, le bouton d\'essai est caché', pouce.cache);
    ok('vente, les outils : caché, il ne dépasse pas du bas de l\'écran',
       pouce.visible === 'hidden' || pouce.haut >= pouce.ecran,
       'il dépasse de ' + Math.round(pouce.ecran - pouce.haut) + ' px');
    await cPo.close();
  }

  // ── Le site de vente : chaque film se joue jusqu'à sa dernière image ─────
  //
  // Les scènes du 7 novembre 2026 sont des films de la vraie appli, montés
  // avec HyperFrames. Leurs noms se composent dans le script
  // (« nov-film- » + data-film) : aucun grep ne dit qu'un fichier manque, et
  // un film absent laisserait un téléphone figé sur sa première image. On
  // les regarde donc jouer, un par un, comme lui en descendant.
  //
  // Le film fini, sa dernière image se pose par-dessus : s'il se cache au
  // même instant, le navigateur, qui n'a encore jamais peint cette image, met
  // un rendu à la décoder, et l'on revoit un éclair de la PREMIÈRE image du
  // film (vu le 19 novembre 2026 à la fin des travaux : la liste décochée
  // qui repasse). Le film reste donc dessous, sur sa dernière image.
  for (const [fichier, nomPage, films, resteDessous] of PAGES_DE_VENTE) {
    const cFi = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await cFi.newPage();
    await page.goto(`${B}/vente/${fichier}`, { waitUntil: 'domcontentloaded' });
    for (const nom of films) {
      const cadre = await page.evaluate((n) => { const el = document.querySelector('[data-film="' + n + '"]'); if (el) scrollTo(0, scrollY + el.getBoundingClientRect().top - 90); return !!el; }, nom);
      ok(nomPage + ' : le film ' + nom + ' a son cadre dans la page', cadre);
      if (!cadre) continue;
      // Le plus long, celui de la fiche d'intervention, dure onze secondes.
      const fin = await page.waitForFunction((n) => {
        const f = document.querySelector('[data-film="' + n + '"] .film-fin');
        return f && f.classList.contains('vue');
      }, nom, { timeout: 25000 }).then(() => true, () => false);
      const etat = await page.evaluate((n) => {
        const c = document.querySelector('[data-film="' + n + '"]'), v = c.querySelector('video');
        const vu = (s) => { const i = c.querySelector(s); return !!(i && i.complete && i.naturalWidth); };
        return { erreur: v && v.error && v.error.code, joue: v && v.played.length ? v.played.end(v.played.length - 1) / v.duration : 0, debut: vu('.film-debut'), fin: vu('.film-fin'), dessous: v ? getComputedStyle(v).opacity : null };
      }, nom);
      ok(nomPage + ' : le film ' + nom + ' se joue jusqu\'au bout', fin && !etat.erreur && etat.joue > 0.95, JSON.stringify(etat));
      ok(nomPage + ' : le film ' + nom + ' a sa première et sa dernière image', etat.debut && etat.fin, JSON.stringify(etat));
      if (resteDessous) ok(nomPage + ' : le film ' + nom + ' reste sous sa dernière image', etat.dessous === '1', JSON.stringify(etat));
    }
    await cFi.close();
  }

  // ── Le site de vente en mouvement : l'ouverture ne se fige pas ───────────
  //
  // Sa remarque du 19 novembre 2026 : « quand on clique sur créer le devis et
  // que la fiche client apparaît [...] comme si elle freezait une
  // demi-seconde ». Dans l'appli, le « + » tourne 520 ms avant que la fiche
  // monte : son choix, et à la taille d'un vrai téléphone on le voit. Sur le
  // site il mesure dix pixels, et une demi-seconde où rien d'autre ne bouge
  // se lit comme une panne. Le film de cette page est donc recoupé
  // (scripts/film-creer-un-devis-vif.sh). On le feuillette image par image :
  // du début à la première image où la fiche monte, moins de 0,3 s. Puis on
  // le regarde jouer dans la page, au premier défilement, comme lui.
  {
    const cOu = await browser.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
    const page = await cOu.newPage();
    await page.goto(`${B}/vente/cause-2.html`, { waitUntil: 'networkidle' });
    const film = await page.evaluate(async () => {
      const source = document.querySelector('#scene-creer video').currentSrc;
      if (!source) return { erreur: 'le film de l\'ouverture n\'a pas de source lisible' };
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = source;
      const pret = await new Promise((r) => { v.addEventListener('loadeddata', () => r(true), { once: true }); v.addEventListener('error', () => r(false), { once: true }); });
      if (!pret) return { erreur: 'film illisible : ' + source };
      const k = document.createElement('canvas'); k.width = 195; k.height = 332;
      const x = k.getContext('2d', { willReadFrequently: true });
      // Un pas deux fois plus fin que le film : aucune image n'échappe.
      let avant = null, monte = null, pire = 0;
      for (let t = 0; t < v.duration - 0.005; t += 0.02) {
        v.currentTime = t; await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
        x.drawImage(v, 0, 0, 195, 332);
        const d = x.getImageData(0, 0, 195, 332).data;
        if (avant) {
          let somme = 0; for (let i = 0; i < d.length; i += 4) somme += Math.abs(d[i] - avant[i]) + Math.abs(d[i + 1] - avant[i + 1]) + Math.abs(d[i + 2] - avant[i + 2]);
          const bouge = somme / (d.length / 4) / 3; pire = Math.max(pire, bouge);
          // Le « + » qui tourne déplace moins d'un demi-niveau en moyenne ;
          // la fiche qui monte, plus de dix.
          if (monte === null && bouge > 2) monte = +t.toFixed(2);
        }
        avant = d;
      }
      return { source: source.split('/').pop(), duree: +v.duration.toFixed(2), monte, pire: +pire.toFixed(1) };
    });
    ok('ouverture en mouvement : la fiche monte moins de 0,3 s après l\'appui', !film.erreur && film.monte !== null && film.monte <= 0.3, JSON.stringify(film));
    // Le premier défilement lance la scène, une fois le téléphone posé.
    await page.waitForTimeout(3200);
    await page.evaluate(() => { const r = document.querySelector('#scene-creer').getBoundingClientRect(); scrollTo(0, Math.max(40, scrollY + r.top - 120)); });
    const fini = await page.waitForFunction(() => document.querySelector('#scene-creer .film-fin').classList.contains('vue'), null, { timeout: 12000 }).then(() => true, () => false);
    const etatOu = await page.evaluate(() => {
      const v = document.querySelector('#scene-creer video');
      return { erreur: v.error && v.error.code, joue: v.played.length ? v.played.end(v.played.length - 1) / v.duration : 0, dessous: getComputedStyle(v).opacity, source: v.currentSrc.split('/').pop() };
    });
    ok('ouverture en mouvement : le film se joue jusqu\'au bout au premier défilement', fini && !etatOu.erreur && etatOu.joue > 0.95, JSON.stringify(etatOu));
    ok('ouverture en mouvement : le film reste sous sa dernière image', etatOu.dessous === '1', JSON.stringify(etatOu));
    await cOu.close();
  }

  // ── Le site de vente en mouvement : la fiche, du trajet au retour du soir ─
  //
  // Sa question du 19 novembre 2026 : « est-ce que les retours du soir, il ne
  // faut pas les mettre sur la même cinématique que Waze, le téléphone, et
  // ensuite on montre les travaux à cocher, et une fois coché, bam, que ça
  // débarque sur le retour du soir. Ça fait peut-être une cinématique de
  // moins. » Il a dit oui : la section « Et aussi » et ses deux cases s'en
  // vont, et le film de la fiche va jusqu'à l'écran du patron.
  //
  // Ce film dure onze secondes et ce qui bouge descend dans le cadre : sur
  // son téléphone (390 × 664), la figure doit tenir entière entre la barre du
  // haut (72 px) et le bouton d'essai (104 px), sans quoi la remarque et
  // « Retour du jour envoyé » se joueraient sous le bouton.
  {
    const cFe = await browser.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
    const page = await cFe.newPage();
    // La page doit être POSÉE avant qu'on y défile : ses polices et ses images
    // arrivent après le premier rendu et déplacent tout de plusieurs centaines
    // de pixels. Défiler trop tôt mettait la figure hors de l'écran, et le
    // film ne partait pas : c'est ce qui a fait échouer la publication du
    // 19 novembre 2026, sur une machine où elles arrivaient plus tard qu'ici.
    await page.goto(`${B}/vente/cause-2.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const pageFiche = await page.evaluate(() => {
      const r = document.getElementById('scene-fiche').getBoundingClientRect();
      return {
        aussi: !!document.querySelector('.aussi'), travaux: !!document.querySelector('[data-film="travaux"]'),
        restes: [...document.images].map((i) => i.getAttribute('src')).filter((s) => /nov-retour\.jpg|nov-travaux-5\.jpg/.test(s)),
        hauteur: Math.round(r.height), largeur: Math.round(r.width), ecran: innerHeight,
      };
    });
    ok('fiche en mouvement : les travaux cochés et le retour du soir ne sont plus rangés à part',
       !pageFiche.aussi && !pageFiche.travaux && pageFiche.restes.length === 0, JSON.stringify(pageFiche));
    ok('fiche en mouvement : la figure tient entière entre la barre du haut et le bouton d\'essai',
       pageFiche.hauteur > 300 && pageFiche.hauteur <= pageFiche.ecran - 72 - 104, JSON.stringify(pageFiche));
    // On l'amène sous la barre du haut, et l'on vérifie qu'elle y est restée.
    let haut = null;
    for (let essai = 0; essai < 4 && (haut === null || Math.abs(haut - 80) > 2); essai++) {
      await page.evaluate(() => scrollTo(0, scrollY + document.getElementById('scene-fiche').getBoundingClientRect().top - 80));
      await page.waitForTimeout(400);
      haut = await page.evaluate(() => Math.round(document.getElementById('scene-fiche').getBoundingClientRect().top));
    }
    ok('fiche en mouvement : la figure reste où on l\'a amenée, sous la barre du haut', haut !== null && Math.abs(haut - 80) <= 2, 'son haut est à ' + haut + ' px');
    const finie = await page.waitForFunction(() => { const f = document.querySelector('#scene-fiche .film-fin'); return f && f.classList.contains('vue'); }, null, { timeout: 30000 }).then(() => true, () => false);
    const filmFiche = await page.evaluate(() => {
      const c = document.getElementById('scene-fiche'), v = c.querySelector('video'), r = c.getBoundingClientRect();
      return v ? { duree: +v.duration.toFixed(2), joue: v.played.length ? +(v.played.end(v.played.length - 1) / v.duration).toFixed(3) : 0, cadre: +(r.width / r.height).toFixed(4), film: +(v.videoWidth / v.videoHeight).toFixed(4) } : null;
    });
    ok('fiche en mouvement : la cinématique entière se joue, du trajet au retour du soir',
       finie && !!filmFiche && filmFiche.duree > 10 && filmFiche.joue > 0.95, JSON.stringify({ finie, haut, film: filmFiche }));
    // Un cadre d'une autre proportion que le film le rognerait sans rien dire.
    ok('fiche en mouvement : le cadre a les proportions du film', !!filmFiche && Math.abs(filmFiche.cadre - filmFiche.film) < 0.004, JSON.stringify(filmFiche));
    await cFe.close();
  }

  // ── L'icône de Cause, sur le bureau du téléphone ─────────────────────────
  //
  // Ses demandes du 17 novembre 2026. Chaque planche attend une lettre, et
  // chaque geste doit y changer quelque chose (CLAUDE.md §3 bis, « chaque
  // geste d'une planche fait quelque chose ») : c'est ici qu'on les touche,
  // pas chez lui. On lit ce qui est PEINT (le dessin posé, la forme, le fond,
  // le filtre), jamais une classe : un bouton qui poserait sa classe sans
  // rien changer à l'écran resterait vert. La capture de l'appli vit dans un
  // autre dossier (vente/images) : un fichier déplacé ouvrirait l'appli sur
  // un écran vide, donc on exige des pixels.
  //
  // Deux planches partagent le même bureau : la deuxième (sept icônes, des
  // lettres) et la troisième (trois dessins, chacun sur trois fonds). Les
  // mêmes contrôles les gardent toutes les deux ; la troisième ajoute le fond.
  const PLANCHES_D_ICONE = [
    { fichier: 'icone-de-cause-2.html', nom: 'icône', lettres: 'ABCDEFG', ensemble: '#sept', papier: 'fond', fonds: [],
      choix: k => 'la ' + k, dit: k => '« ' + k + ' »' },
    // La troisième dit son choix par le NOM du dessin : la lettre I, seule, se lit comme un l ou un 1.
    { fichier: 'icone-de-cause-3.html', nom: 'icône en dessin', lettres: 'HIJ', ensemble: '#ensemble', papier: 'papier', fonds: ['vert', 'or', 'creme'],
      choix: k => ({ H: 'le rouge-gorge', I: 'le casque', J: 'la rosace' })[k], dit: k => '« ' + ({ H: 'le rouge-gorge', I: 'le casque', J: 'la rosace' })[k] + ', fond ' },
  ];
  for (const pl of PLANCHES_D_ICONE) {
    const N = pl.nom, derniere = pl.lettres[pl.lettres.length - 1], milieu = pl.lettres[1];
    const cIc = await browser.newContext({ viewport: { width: 390, height: 664 } });
    const page = await cIc.newPage();
    const errs = []; page.on('pageerror', e => errs.push(N + ' : ' + e.message));
    await page.goto(`${B}/${pl.fichier}`, { waitUntil: 'networkidle' });
    const attendre = (fn) => page.waitForFunction(fn, null, { timeout: 5000 }).then(() => true, () => false);
    const dessin = () => page.evaluate(() => document.querySelector('#grille .notre .tuile').innerHTML);
    const dessins = new Set();
    for (const k of pl.lettres) { await page.click(`[data-choix="${k}"]`); dessins.add(await dessin()); }
    ok(N + ' : chaque lettre pose son dessin sur le bureau', dessins.size === pl.lettres.length, dessins.size + ' dessins');
    ok(N + ' : le bouton du choix suit la lettre', (await page.textContent('#prendre')) === 'Je prends ' + pl.choix(derniere));
    // Le fond de l'icône : chaque pastille repeint la tuile, et le choix le dit.
    if (pl.fonds.length) {
      const peints = new Set();
      for (const f of pl.fonds) { await page.click(`[data-fond="${f}"]`); peints.add(await dessin()); }
      ok(N + ' : chaque fond repeint l\'icône', peints.size === pl.fonds.length, peints.size + ' rendus');
      await page.click('#prendre');
      ok(N + ' : le choix dit le dessin ET le fond', (await page.textContent('#reponse')).includes(pl.dit(derniere) + 'crème »'));
      await page.click(`[data-fond="${pl.fonds[0]}"]`);
      ok(N + ' : changer de fond efface la réponse', (await page.textContent('#reponse')) === '');
    }
    await page.click('[data-forme="android"]');
    ok(N + ' : Android arrondit l\'icône',
       await page.evaluate(() => getComputedStyle(document.querySelector('#grille .notre .tuile')).borderRadius === '50%'));
    await page.click('[data-forme="iphone"]');
    const fond = () => page.evaluate(() => getComputedStyle(document.querySelector('#ecran')).backgroundImage);
    const clair = await fond();
    await page.click(`[data-${pl.papier}="sombre"]`);
    ok(N + ' : Sombre change le fond d\'écran', (await fond()) !== clair);
    await page.click('#soleil');
    ok(N + ' : Plein soleil délave l\'écran',
       await attendre(() => /contrast\(0\.58\)/.test(getComputedStyle(document.querySelector('.peau')).filter)));
    await page.click(pl.ensemble);
    ok(N + ' : ensemble, toutes les icônes de Cause sont sur le bureau', (await page.locator('#grille .notre').count()) === pl.lettres.length);
    const ordre = () => page.evaluate(() => [...document.querySelectorAll('#grille > *')].map(c => c.dataset.cle).join());
    const avant = await ordre();
    await page.click('#melanger');
    ok(N + ' : Mélanger change l\'ordre', (await ordre()) !== avant);
    await page.waitForTimeout(700);
    await page.click(`#grille .notre[data-ouvre="${milieu}"]`);
    ok(N + ' : toucher une icône en fait le choix', (await page.textContent('#prendre')) === 'Je prends ' + pl.choix(milieu));
    ok(N + ' : l\'appli s\'ouvre sur sa capture, avec des pixels', await attendre(() => {
      const i = document.querySelector('.accueil');
      return getComputedStyle(i).display !== 'none' && i.complete && i.naturalWidth > 0;
    }));
    await page.click('#fermer');
    ok(N + ' : « Revenir au bureau » la referme', await attendre(() => document.querySelector('#appli').hidden));
    // Le bureau d'Android est plus haut que celui de l'iPhone (la date, la
    // recherche) : son bas passe sous la barre du bas. Le bouton qui referme
    // l'appli y tombait, caché, et il ne restait qu'à deviner qu'il fallait
    // faire défiler. Trouvé à la relecture du 17 novembre 2026.
    await page.click(pl.ensemble);
    await page.click('[data-forme="android"]');
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#grille .notre');
    await page.waitForTimeout(700);
    const sortie = await page.evaluate(() => {
      const b = document.querySelector('#fermer').getBoundingClientRect();
      return { bas: Math.round(b.bottom), barre: Math.round(document.querySelector('.barre').getBoundingClientRect().top), haut: Math.round(b.top) };
    });
    ok(N + ' : sur Android, « Revenir au bureau » reste au-dessus de la barre',
       sortie.haut >= 0 && sortie.bas <= sortie.barre, JSON.stringify(sortie));
    await page.click('#fermer');
    ok(N + ' : et il referme l\'appli', await attendre(() => document.querySelector('#appli').hidden));
    await page.click('[data-forme="iphone"]');
    await page.click('#prendre');
    ok(N + ' : le choix dit quoi écrire', (await page.textContent('#reponse')).includes(pl.dit(milieu)));
    const largeIc = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(N + ' : rien ne déborde à 390 px', largeIc <= 391, 'largeur ' + largeIc);
    ok(N + ' : aucune erreur de page', errs.length === 0, errs.join(' | '));
    await cIc.close();
  }

  // ── Le fournisseur depuis son devis : chaque rond suit sa ligne ─────────
  //
  // Sa remarque du 20 novembre 2026 : « j'ai décoché les deux, il y avait
  // marqué aucun prix coché, sauf que le dernier restait coché ». Le script
  // de la planche peignait le premier `span[aria-hidden]` de chaque ligne :
  // à partir de la deuxième, c'est le filet qui la sépare de la précédente,
  // et le rond ne bougeait plus. Le compte, lui, était juste : seule l'image
  // mentait. Le contrôle décoche toutes les lignes et regarde chaque rond.
  {
    const cFo = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await cFo.newPage();
    await page.goto(`${B}/fournisseur-depuis-son-devis.html`, { waitUntil: 'domcontentloaded' });
    for (const etat of ['nouveau', 'connu']) {
      await page.click(`.planche-etapes [data-va="${etat}"]`);
      const lignes = page.locator(`[data-planche="${etat}"] [data-atlas="lu-sur-le-devis"] button[aria-pressed]`);
      const n = await lignes.count();
      for (let i = 0; i < n; i++) await lignes.nth(i).click();
      const ronds = await page.evaluate((e) => [...document.querySelectorAll(`[data-planche="${e}"] [data-atlas="lu-sur-le-devis"] button[aria-pressed]`)]
        .map((b) => ({ presse: b.getAttribute('aria-pressed'), plein: /7px/.test((b.querySelector('span[aria-hidden].rounded-full') || {}).style?.boxShadow || '') })), etat);
      ok(`fournisseur depuis son devis (${etat}) : les ${n} lignes décochées ont toutes un rond vide`,
         n > 1 && ronds.every((r) => r.presse === 'false' && !r.plein), JSON.stringify(ronds));
      const bouton = (await page.textContent(`[data-planche="${etat}"] [data-atlas="prendre-les-prix"]`)).trim();
      ok(`fournisseur depuis son devis (${etat}) : le bouton dit qu'aucun prix n'est pris`, /sans les prix|Aucun prix/.test(bouton), bouton);
      await lignes.nth(n - 1).click();
      const dernier = await page.evaluate((e) => { const b = [...document.querySelectorAll(`[data-planche="${e}"] [data-atlas="lu-sur-le-devis"] button[aria-pressed]`)].pop(); return /7px/.test(b.querySelector('span[aria-hidden].rounded-full').style.boxShadow); }, etat);
      ok(`fournisseur depuis son devis (${etat}) : la dernière ligne recochée remplit son rond`, dernier);
    }
    await cFo.close();
  }

  await browser.close();
  console.log(`\n✅ PASS: ${pass}   ❌ FAIL: ${fail}`);
  if (fails.length){ console.log('\nÉchecs :'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
