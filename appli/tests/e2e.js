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

    // Le panneau des secteurs a été retiré le 17 août sur sa demande ; le
    // découpage, lui, tourne toujours et décide de tout le reste.
    const secteurs = await page.evaluate(() => decouper().secteurs.length);
    ok('arrosage : le jardin de départ se découpe', secteurs >= 6);

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

    // La saison change les durées, jamais le câblage : c'est ce qui décide de
    // l'heure de départ, et un cycle qui déborde envoie arroser en plein soleil.
    const cycle = await page.evaluate(() => {
      const lire = () => { const d = decouper();
        return { n: d.secteurs.length, min: d.secteurs.reduce((a, s) => a + s.minutes, 0) }; };
      const avant = etat.saison;
      etat.saison = 'juillet'; const juillet = lire();
      etat.saison = 'avril';   const avril = lire();
      etat.saison = avant;     recalculer(true);
      return { juillet, avril };
    });
    await page.waitForTimeout(120);
    ok('arrosage : les durées existent et baissent en avril',
       cycle.juillet.min > 0 && cycle.avril.min < cycle.juillet.min);
    ok('arrosage : changer de saison ne recâble pas', cycle.avril.n === cycle.juillet.n);

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

    // **Deux SBE par arroseur, pas un** — sa planche du 17 août sur le réseau
    // latéral : un raccord en bas (toujours 3/4", sur la tuyauterie) et un en
    // haut (au diamètre du corps). En manquer un sous-compte une pièce que
    // chaque arroseur porte réellement.
    ok('arrosage : le SBE du bas (raccord de ligne) est compté', /bas, sur la ligne/.test(materiel));
    ok('arrosage : le SBE du haut (raccord au corps) est compté', /haut, au corps/.test(materiel));
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
    ok('arrosage : une fiche de nourrice enregistrée s’affiche',
       /Clarinette/.test(fiche) && /Électrovanne/.test(fiche) && !/à renseigner/.test(fiche));
    // Ses pièces se retrouvent aussi dans la liste chiffrable — pas dupliquées,
    // pas oubliées : c'est ELLES qui remplacent les lignes génériques.
    const materiel2 = await page.$eval('#materiel', el => el.innerText);
    ok('arrosage : les pièces de la fiche entrent dans la liste chiffrable',
       /Clarinette/.test(materiel2) && !/Électrovannes 24 V/.test(materiel2));

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

  await browser.close();
  console.log(`\n✅ PASS: ${pass}   ❌ FAIL: ${fail}`);
  if (fails.length){ console.log('\nÉchecs :'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
