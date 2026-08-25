const { chromium } = require('playwright');
const { writeFileSync } = require('fs');
const zlib = require('zlib');
/* Une photo d'essai ENGENDRÉE ICI, plutôt qu'un fichier à côté : un contrôle
   qui dépend d'un binaire déposé à la main se met à rougir le jour où
   quelqu'un range le dépôt. */
const CROQUIS_ESSAI = '/tmp/croquis-essai-suite.png';
(function engendrerCroquis(){
  const w = 1200, h = 900;
  const lignes = [];
  for (let y = 0; y < h; y++){
    const l = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++){ l[1 + x*3] = 200; l[2 + x*3] = 210; l[3 + x*3] = 190; }
    lignes.push(l);
  }
  const morceau = (type, data) => {
    const c = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(c) : require('zlib').crc32(c));
    return Buffer.concat([len, c, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(CROQUIS_ESSAI, Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    morceau('IHDR', ihdr),
    morceau('IDAT', zlib.deflateSync(Buffer.concat(lignes))),
    morceau('IEND', Buffer.alloc(0))
  ]));
})();
// **L'adresse vient de l'environnement.** Elle était écrite en dur : la suite
// ne pouvait donc pas être jouée par la publication, qui sert sur 8080. Une
// suite qu'on ne peut jouer qu'à la main est une suite qu'on oublie.
const B = process.env.BASE_URL || 'http://127.0.0.1:8099';
let ok = 0, ko = 0;
function cas(n, c, d){ if (c) { ok++; console.log('  ✓ ' + n); } else { ko++; console.log('  ✗ ' + n + (d ? '\n      ' + d : '')); } }
(async () => {
  const CHEMIN = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const exe = process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
              (require('fs').existsSync(CHEMIN) ? CHEMIN : undefined);
  const nav = await chromium.launch(exe ? { executablePath: exe } : {});
  // L'écran le plus étroit du parc : 360 px. C'est là que ça casse.
  const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(B + '/arrosage.html', { waitUntil: 'networkidle' });

  cas('aucune erreur JavaScript au chargement', erreurs.length === 0, erreurs.join(' | '));
  const dispo = await page.locator('#debitDispo').textContent();
  cas('le débit se calcule du seau (10 L / 20 s = 1,80)', dispo.trim() === '1,80', 'lu : ' + dispo);

  const secteurs = await page.evaluate(() => decouper().secteurs.length);
  // 9 avec le recouvrement de 80 % qu'il a posé le 17 août : l'écart de pose
  // passe sous la portée, donc il faut plus d'arroseurs, donc un secteur de plus.
  // 8 depuis SA règle de pose du 17 août : on écarte au maximum dans sa limite
  // au lieu de resserrer à 80 % de la portée, donc moins d'arroseurs.
  // 10 depuis que le CHOIX DE BUSE obéit à sa règle d'écart : la turbine de 9 m
  // ne pave pas une pelouse de 12 m de large sans descendre sous sa portée, donc
  // l'outil passe en tuyères — plus d'arroseurs, plus de débit, plus de secteurs.
  // 7 depuis SA RÈGLE DU 17 AOÛT sur le débit des turbines (« c'est les mêmes
  // données que pour 90 ou 180 degrés ») : les six familles de turbines
  // deviennent posables, la pelouse arrière prend une 3504 au lieu de tuyères,
  // et son débit tombe de 3,4 à 1,76 m³/h — d'où trois secteurs de moins.
  // **Ce nombre est un TÉMOIN, pas une cible** : il bougera encore à chaque
  // catalogue. Ce qu'il garde, c'est qu'un changement de données se VOIE.
  // 6 depuis SA RÈGLE DU 17 AOÛT sur les tuyères (« uniquement pour les petits
  // espaces, 4 m grand max ») : la pelouse avant, forcée en tuyères jusque-là,
  // passe en turbines — moins de têtes, bien moins de débit. Un couloir de
  // 10 × 2 m, son propre exemple, entre dans le jardin pour que les tuyères
  // restent montrées là où elles ont leur place.
  // 7 depuis que la PLUVIOMÉTRIE entre dans la clé de groupe : les deux
  // pelouses, toutes deux en turbines mais avec des buses différentes (5,9 et
  // 6,1 mm/h), ne partagent plus une vanne. Sa règle « ça ne se mélange
  // jamais », appliquée à la lettre — le plan les coloriait de la même
  // couleur, c'est ainsi que le défaut s'est vu.
  // 6 depuis le 24 août 2026 (commit « Viser le moins de VANNES, et cesser de
  // resserrer sous la portée »). Le « 5 » d'avant venait d'un quinconce qui se
  // resserrait SOUS la portée pour retirer une tête — ce que sa règle du
  // 17 août interdit (« jamais moins que la portée »). Le damier ne se resserre
  // plus : quand il ne couvre pas à cet écart-là, on garde la grille alignée,
  // qui pose une tête de plus ici, mais honnêtement. Six est la pose qui tient
  // sans tricher.
  cas('le jardin de départ donne 6 secteurs', secteurs === 6, 'lu : ' + secteurs);

  // **UN SECTEUR, UN MATÉRIEL** — et ce contrôle a CHANGÉ DE RÈGLE le 23 août
  // 2026, parce que le patron a changé la sienne.
  //
  // Il exigeait « une seule pluviométrie par vanne », sa règle du 17 août
  // (« ça ne se mélange jamais »). Le 23, il l'a retirée : *« ne prends pas en
  // compte la pluviométrie »*. Deux turbines de buses différentes partagent
  // désormais une vanne, et c'est lui qui arbitre à l'arrosage
  // (`arrosage-calcul.js`, la clé de groupe).
  //
  // **Le contrôle a donc rougi sur du code JUSTE, et il a barré la publication
  // de la page pendant deux jours** — c'est-à-dire qu'il a coûté au patron
  // l'accès à toutes ses maquettes, pour réclamer ce qu'il avait fait enlever
  // (`CLAUDE.md` §5 bis : on adapte le contrôle, on ne rétablit pas la règle).
  //
  // **Ce qui sépare toujours, en revanche, c'est le MATÉRIEL.** Une turbine et
  // une tuyère ne s'ouvrent jamais ensemble : l'une verse environ trois fois
  // plus vite, et la même durée d'ouverture noie l'une ou assoiffe l'autre.
  // Cette règle-là n'a pas bougé, et c'est elle qu'on garde ici.
  const melange = await page.evaluate(() => {
    const d = decouper();
    const parVanne = {};
    etat.zones.filter(z => TYPES[z.type].forme === 'surface').forEach(z => {
      const p = poser(z);
      p.points.forEach(pt => {
        const i = d.reseauDuPoint[z.id + ':' + pt.x.toFixed(3) + ':' + pt.y.toFixed(3)];
        if (i == null) return;
        (parVanne[i] = parVanne[i] || new Set()).add(p.cle);
      });
    });
    return { vannes: Object.keys(parVanne).length,
             fautives: Object.keys(parVanne).filter(k => parVanne[k].size > 1).length };
  });
  cas('des vannes a eprouver', melange.vannes >= 2, JSON.stringify(melange));
  cas('aucune vanne ne melange turbine et tuyere',
      melange.fautives === 0, JSON.stringify(melange));

  // SA RÈGLE DE POSE (17 août) : l'écart ne descend JAMAIS sous la portée, et
  // ne dépasse jamais 1,2 × la portée. C'est ce qui décide du nombre
  // d'arroseurs, donc du prix — et l'outil faisait exactement l'inverse avant.
  //
  // **Éprouvé sur TOUTES les zones et contre LEUR portée réelle**, au lieu
  // d'une seule zone et d'un 3,6 écrit en dur. La version en dur a rougi le
  // jour où le jardin d'exemple a changé de buse — elle ne gardait pas la
  // règle, elle gardait un jardin.
  const poses = await page.evaluate(() => etat.zones
    .filter(z => TYPES[z.type].forme === 'surface')
    .map(z => { const p = poser(z);
      return p.m ? { zone: z.nom, portee: p.m.portee, ex: p.ecartX, ey: p.ecartY, serre: p.tropSerre } : null; })
    .filter(Boolean));
  cas('des poses à éprouver, sur plusieurs zones', poses.length >= 2, JSON.stringify(poses));
  const horsRegle = poses.filter(p => !p.serre &&
    (p.ex < p.portee - 0.01 || p.ey < p.portee - 0.01 ||
     p.ex > p.portee * 1.2 + 0.01 || p.ey > p.portee * 1.2 + 0.01));
  cas('sur CHAQUE zone, l\'écart tient entre la portée et 1,2 × la portée',
      horsRegle.length === 0, JSON.stringify(horsRegle));

  const resume = await page.locator('.zone-res').nth(1).innerText();
  const mEcart = resume.match(/un tous les (\d+,\d+) m/);
  const mRec = resume.match(/recouvrement (\d+) %/);
  cas('l\'écart de pose est chiffré en mètres', !!mEcart, resume.slice(0, 90));
  cas('le recouvrement obtenu tient ses 80 %',
      mRec && Number(mRec[1]) >= 80, resume.slice(0, 90));
  cas('la pose est annoncée (carré ou quinconce)',
      /en quinconce|en carré/.test(resume), resume.slice(0, 90));

  // ── LE QUINCONCE N'EST RETENU QUE S'IL RETIRE DES TÊTES ────────────────
  //
  // **Ce contrôle a changé de règle le 24 août 2026, avec le calcul.** Il
  // exigeait que la pelouse soit TOUJOURS en quinconce et TOUJOURS moins dense
  // que l'aligné. Or le quinconce ne se resserre plus sous la portée (sa règle
  // du 17 août) : quand le damier ne couvre pas à cet écart-là, on garde la
  // grille alignée. La pelouse de départ tombe justement dans ce cas — quinconce
  // et aligné y posent le même nombre de têtes —, et exiger le quinconce rendait
  // rouge une pose devenue juste.
  //
  // **La règle, elle, ne bouge pas et se dit en deux temps :** la pose retenue
  // ne compte JAMAIS plus de têtes que la grille alignée, et le quinconce n'est
  // retenu QUE quand il en retire — sinon l'aligné. Et il couvre (plus bas) :
  // sans quoi « moins d'arroseurs » se satisferait d'un jardin à sec.
  const quinc = await page.evaluate(() => {
    const z = etat.zones.filter(x => TYPES[x.type].forme === 'surface')[0];
    const p = poser(z);
    const L = Number(z.L), l = Number(z.l);
    const alignes = pointsDeLaPose(p.nx, p.ny, p.ecartX, p.ecartY, false);
    return {
      nombre: p.nombre, points: p.points.length, quinconce: p.quinconce,
      alignes: alignes.length, portee: p.m.portee,
      couvre: couvreTout(p.points, p.m.portee, L, l),
    };
  });
  cas('la pose ne compte jamais plus de têtes que la grille alignée',
      quinc.nombre > 0 && quinc.nombre <= quinc.alignes, JSON.stringify(quinc));
  cas('le quinconce n’est retenu QUE quand il retire des têtes',
      !quinc.quinconce || quinc.nombre < quinc.alignes, JSON.stringify(quinc));
  // Et il arrose tout : c'est ce qui interdit d'économiser une tête de trop.
  cas('et il arrose quand même toute la pelouse', quinc.couvre === true,
      JSON.stringify(quinc));
  // L'invariant du 17 août, qui n'a pas bougé : la liste de points et le
  // nombre annoncé sont UNE SEULE chose. C'est leur divergence qui avait
  // produit l'arroseur en trop, repéré sur une capture et par aucun test.
  cas('le nombre annoncé est EXACTEMENT la liste de points',
      quinc.points === quinc.nombre && quinc.nombre > 0,
      JSON.stringify(quinc));

  // **LA NOURRICE — LES DEUX CAS, sur un jardin CHOISI et non sur l'exemple.**
  // Ce cas a rougi deux fois de suite en une soirée, chaque fois parce qu'une
  // de ses règles changeait le nombre de voies du jardin d'exemple : au-dessus
  // de six, l'écran annonce le manque ; en dessous, il sert sa fiche. Les deux
  // comportements sont justes — c'est le contrôle qui visait mal. On éprouve
  // donc chacun sur un jardin bâti pour lui.
  const fiches = await page.evaluate(() => {
    const avant = JSON.parse(JSON.stringify(etat.zones));
    // Un jardin volontairement petit : une pelouse et un massif, donc deux
    // voies dont une en goutte-à-goutte — sa fiche 2 voies existe.
    etat.zones = [ { id:1, nom:'Pelouse', type:'gazon', L:'10', l:'8', materiel:'auto' },
                   { id:2, nom:'Massif',  type:'massif', L:'6', l:'1.6', materiel:'gaine' } ];
    recalculer(true);
    const petit = { voies: decouper().secteurs.length,
                    texte: document.getElementById('nourrice').innerText };
    // Et un jardin trop grand pour ses six fiches : l'écran doit le DIRE.
    //
    // **On GROSSIT le jardin jusqu'à dépasser six voies au lieu d'écrire un
    // nombre de zones en dur.** Huit zones suffisaient jusqu'au 18 août ; le
    // quinconce de son croquis a fait tomber le débit, et huit zones ne font
    // plus que six voies — le contrôle éprouvait alors le cas d'À CÔTÉ, en
    // vert, sans que rien ne le dise. C'est le piège du 15 août dans sa
    // version « cas jamais atteint », et il s'évite en visant la CONDITION.
    let grand = null;
    for (let n = 8; n <= 40; n += 2){
      etat.zones = [];
      for (let i = 1; i <= n; i++)
        etat.zones.push({ id:i, nom:'Zone '+i, type:'gazon', L:'10', l:'8', materiel:'auto' });
      recalculer(true);
      const v = decouper().secteurs.length;
      if (v > 6){ grand = { zones:n, voies:v, texte: document.getElementById('nourrice').innerText }; break; }
    }
    if (!grand) grand = { zones:0, voies:0, texte:'' };   // le cas n'a pas été atteint
    etat.zones = avant; recalculer(true);
    return { petit: petit, grand: grand };
  });
  await page.waitForTimeout(120);
  cas('le petit jardin tient bien dans ses fiches (≤ 6 voies)',
      fiches.petit.voies >= 1 && fiches.petit.voies <= 6, JSON.stringify(fiches.petit.voies));
  // **Ce contrôle exigeait le mot « Clarinette », et il est devenu faux le
  // 18 août** : le quinconce a fait tomber ce jardin à deux voies, et sa fiche
  // 2 voies se monte sans clarinette — un té, deux coudes. Le mot n'était
  // qu'un indice de « c'est bien une vraie fiche » ; la RÈGLE, elle, est que
  // sa fiche REMPLACE les lignes génériques au lieu de s'y ajouter.
  cas('alors la fiche servie est la SIENNE, pas une composée',
      /votre fiche/i.test(fiches.petit.texte) &&
      !/Électrovannes 24 V|Regards de vannes/.test(fiches.petit.texte),
      fiches.petit.texte.slice(0, 160));
  cas('et sa modification goutte-a-goutte y est appliquee',
      /100 DV 1" FF/.test(fiches.petit.texte) && /Regulateur|Régulateur/.test(fiches.petit.texte),
      fiches.petit.texte.slice(0, 260));
  // Le cas doit avoir été ATTEINT : sans cela le contrôle suivant ne mesure rien.
  cas('un jardin assez grand pour dépasser six voies a bien été construit',
      fiches.grand.zones > 0,
      'aucun jardin jusqu\'à 40 zones ne dépasse six voies — le contrôle suivant n\'éprouve rien');
  cas('le grand jardin depasse bien ses six fiches',
      fiches.grand.voies > 6, 'voies : ' + fiches.grand.voies);
  cas('et alors le manque est ANNONCE, jamais comble par une nourrice inventee',
      /à renseigner/.test(fiches.grand.texte), fiches.grand.texte.slice(0, 120));

  // Et les valeurs provisoires sont signalées, jamais présentées comme acquises.
  const bandeau = await page.locator('#bandeau').innerText();
  cas('les valeurs provisoires sont signalées', /provisoire/.test(bandeau), bandeau.slice(0, 70));

  // ── LE DÉBIT DES TURBINES NE DÉPEND PAS DE L'ARC — sa règle du 17 août ────
  // « Les débits, portées qui sont dans le tableau sont donnés pour les
  //   arroseurs en 360 degrés ; c'est les mêmes données que pour 90 ou 180. »
  //
  // Deux choses à tenir ensemble, et c'est leur COUPLE qui compte : une
  // turbine porte le même débit aux trois angles, une tuyère VAN garde des
  // valeurs DIFFÉRENTES par angle. Ne garder que la première laisserait
  // passer un « on uniformise tout », qui écraserait les vraies valeurs des
  // VAN ; ne garder que la seconde laisserait revenir la division par l'arc.
  const angles = await page.evaluate(() => {
    const t = CATALOGUE.buses.filter(b => b.pourType === 'turbine' && b.debit[360] != null);
    const mauvaises = t.filter(b => b.debit[90] !== b.debit[360] || b.debit[180] !== b.debit[360]);
    const van6 = CATALOGUE.buses.filter(b => b.ref === 'RBT630')[0]
              || CATALOGUE.buses.filter(b => /-VAN$/.test(b.nom) && b.debit[90] != null)[0];
    return { turbines: t.length, mauvaises: mauvaises.map(b => b.nom),
             posables: CATALOGUE.busesDe('hunter', 'turbine').length,
             van: van6 && { nom: van6.nom, q: van6.debit[90], t: van6.debit[360] } };
  });
  // **Un contrôle qui mesure ZÉRO ne mesure rien** (§5) : sans ce premier cas,
  // un catalogue vidé de ses turbines rendrait « aucune mauvaise » en vert.
  cas('des turbines sont bien au catalogue, avec un débit',
      angles.turbines >= 20, 'lues : ' + angles.turbines);
  cas('sa règle : une turbine porte le MÊME débit à 90, 180 et 360',
      angles.mauvaises.length === 0, 'fautives : ' + angles.mauvaises.join(', '));
  cas('et les turbines sont désormais POSABLES (elles étaient écartées)',
      angles.posables >= 20, 'posables : ' + angles.posables);
  // Le pendant, qui protège les tuyères : leur tableau donne un chiffre PAR
  // ANGLE, et il est lu tel quel — la 6-VAN n'est pas proportionnelle.
  cas('mais une tuyère VAN garde ses valeurs par angle, non uniformisées',
      angles.van && angles.van.q !== angles.van.t, JSON.stringify(angles.van));

  // Le geste réel : il change le temps de remplissage, tout doit suivre.
  await page.fill('#temps', '40');
  await page.waitForTimeout(120);
  const dispo2 = await page.locator('#debitDispo').textContent();
  const secteurs2 = await page.evaluate(() => decouper().secteurs.length);
  cas('un débit deux fois plus faible se voit', dispo2.trim() === '0,90', 'lu : ' + dispo2);
  cas('et il faut plus de secteurs', secteurs2 > secteurs, secteurs2 + ' contre ' + secteurs);
  await page.fill('#temps', '20');
  await page.waitForTimeout(120);

  // Aucun secteur ne doit dépasser le débit du robinet — l'invariant du métier.
  const dispoN = parseFloat(dispo.replace(',', '.'));
  const trop = (await page.evaluate(() => decouper().secteurs.map(s => s.debit)))
    .filter(x => x > dispoN + 1e-9);
  cas('aucun secteur au-dessus du robinet', trop.length === 0, trop.join(', '));

  // ── QUEL ARROSEUR SUR QUELLE VANNE — sa demande du 17 août (« un petit plan
  //    avec le nombre de réseaux, avec des couleurs différentes ») ───────────
  // Le découpage ne comptait que des secteurs ; il dit maintenant lesquels des
  // arroseurs y sont, et le plan les colorie d'après CETTE liste — jamais un
  // second calcul à côté, qui finirait par diverger (§3, déjà payé sur le
  // quinconce).
  const reseaux = await page.evaluate(() => {
    // **ON AGRANDIT LA PELOUSE JUSQU'À CE QU'UNE VANNE NE SUFFISE PLUS.**
    // Le jardin d'exemple coupait en plusieurs réseaux jusqu'au 18 août ; le
    // quinconce de son croquis a fait tomber le débit, et chaque zone tient
    // désormais sur une seule vanne. Le contrôle passait alors à côté de ce
    // qu'il garde — la coupe d'une zone entre plusieurs vannes — sans que rien
    // ne le dise. On vise donc la CONDITION, pas une taille écrite en dur.
    const avant = JSON.parse(JSON.stringify(etat.zones));
    let atteint = 0;
    for (let cote = 20; cote <= 60; cote += 5){
      etat.zones = [{ id:1, nom:'Grande pelouse', type:'gazon',
                      L:String(cote), l:String(Math.round(cote*0.7)), materiel:'auto' }];
      if (decouper().secteurs.length >= 3){ atteint = cote; break; }
    }
    const d = decouper();
    const surfaces = etat.zones.filter(z => TYPES[z.type].forme === 'surface');
    let points = 0, sansReseau = 0, contigus = 0, coupes = 0;
    const parSecteur = {};
    surfaces.forEach(z => {
      const p = poser(z);
      let precedent = null;
      p.points.forEach(pt => {
        points++;
        const i = d.reseauDuPoint[z.id + ':' + pt.x.toFixed(3) + ':' + pt.y.toFixed(3)];
        if (i == null) { sansReseau++; return; }
        parSecteur[i] = (parSecteur[i] || 0) + (pt.debit || 0);
        // Dans l'ordre de pose, le numéro de réseau ne doit qu'AVANCER : une
        // vanne dessert une bande d'un seul tenant. S'il revenait en arrière,
        // le plan montrerait un arroseur sur deux, impossible à poser.
        if (precedent != null && i < precedent) coupes++;
        if (precedent != null && i !== precedent) contigus++;
        precedent = i;
      });
    });
    etat.zones = avant;
    return { points, sansReseau, retoursEnArriere: coupes, changements: contigus,
             atteint: atteint, limite: d.limite,
             debitsCalcules: Object.keys(parSecteur).map(k => +parSecteur[k].toFixed(3)),
             debitsAnnonces: d.secteurs.map(s => +s.debit.toFixed(3)) };
  });
  // Le cas qui empêche de mesurer zéro : sans arroseurs, tout le reste serait
  // vert sans rien prouver.
  // Le seuil était de 10 arroseurs : il visait le jardin d'exemple d'alors.
  // Ce qu'il empêche n'a pas changé — mesurer une répartition sur zéro tête —
  // et la pelouse est désormais construite pour tenir sur PLUSIEURS vannes,
  // ce que le contrôle d'à côté vérifie. Deux têtes suffisent donc à prouver
  // qu'il y a de la matière ; en exiger dix redeviendrait un nombre en dur.
  cas('la pelouse d\'épreuve a bien des arroseurs à répartir',
      reseaux.points >= 2, 'points : ' + reseaux.points);
  cas('chaque arroseur sait sur quelle vanne il est',
      reseaux.sansReseau === 0, 'orphelins : ' + reseaux.sansReseau);
  cas('une vanne dessert une bande d\'un seul tenant (jamais un arroseur sur deux)',
      reseaux.retoursEnArriere === 0, 'retours en arrière : ' + reseaux.retoursEnArriere);
  // Le cas doit avoir été atteint, sinon rien de ce qui suit n'a de sens.
  cas('une pelouse assez grande pour tenir sur PLUSIEURS vannes a été construite',
      reseaux.atteint > 0,
      'aucune pelouse jusqu\'à 60 m ne demande trois vannes — le contrôle suivant n\'éprouve rien');
  cas('une zone trop grande se coupe bien en plusieurs réseaux',
      reseaux.changements >= 2, 'changements de réseau : ' + reseaux.changements);
  // **Le débit ANNONCÉ pour un secteur est celui de ses arroseurs réels.** Une
  // version antérieure divisait le total en parts égales : l'écran annonçait
  // deux secteurs à 0,88 quand la coupe en mettait 7 d'un côté et 4 de
  // l'autre. Le plan démentait la liste, exactement la divergence que le §3
  // interdit.
  const memeDebits = reseaux.debitsCalcules.every(v =>
    reseaux.debitsAnnonces.some(a => Math.abs(a - v) < 0.005));
  cas('le débit annoncé d\'un secteur est celui de SES arroseurs',
      memeDebits, 'calculés ' + reseaux.debitsCalcules.join(', ') +
                  ' | annoncés ' + reseaux.debitsAnnonces.join(', '));
  cas('et aucune vanne ne dépasse la limite du robinet',
      reseaux.debitsCalcules.every(v => v <= reseaux.limite + 0.005),
      'limite ' + reseaux.limite + ' | ' + reseaux.debitsCalcules.join(', '));

  // Le coloriage a disparu avec le plan (17 août) ; l'AFFECTATION, elle, sert
  // toujours — c'est elle qui donne le nombre d'électrovannes et la fiche de
  // nourrice. Elle est éprouvée juste au-dessus, par ses invariants.

  // ── LA SAISON : le calcul survit à la disparition de son écran ────────────
  // La section « découpage en secteurs » a été retirée le 17 août sur sa
  // demande, et le sélecteur de saison est parti avec elle. Le CALCUL, lui,
  // reste : c'est lui qui donne les durées, et elles décident du cycle de
  // nuit. On l'éprouve donc par l'état plutôt que par des boutons — un
  // contrôle garde une règle, pas un écran.
  const saisons = await page.evaluate(() => {
    const lire = () => { const d = decouper();
      return { n: d.secteurs.length, min: d.secteurs.reduce((a, s) => a + s.minutes, 0) }; };
    const avant = etat.saison;
    etat.saison = 'juillet'; const juillet = lire();
    etat.saison = 'avril';   const avril = lire();
    etat.saison = avant;     recalculer(true);
    return { juillet, avril };
  });
  await page.waitForTimeout(120);
  cas('des durées à comparer', saisons.juillet.min > 0, JSON.stringify(saisons));
  cas('changer de saison ne recâble pas',
      saisons.avril.n === saisons.juillet.n, JSON.stringify(saisons));
  cas('mais les durées baissent en avril',
      saisons.avril.min < saisons.juillet.min, JSON.stringify(saisons));

  // Ajouter une zone : le geste central.
  const avant = await page.locator('.zone').count();
  await page.locator('[data-ajout="potager"]').click();
  await page.waitForTimeout(150);
  cas('ajouter une zone l\'ajoute', (await page.locator('.zone').count()) === avant + 1);

  // Et la retirer.
  await page.locator('.retirer').last().click();
  await page.waitForTimeout(150);
  cas('retirer une zone la retire', (await page.locator('.zone').count()) === avant);

  // Taper un nom ne doit pas voler le curseur — le défaut classique.
  const champNom = page.locator('.zone .zone-tete input').first();
  await champNom.click();
  await champNom.fill('');
  await champNom.type('Pelouse du fond', { delay: 25 });
  cas('le nom se tape en entier sans perdre le curseur',
      (await champNom.inputValue()) === 'Pelouse du fond', 'lu : ' + (await champNom.inputValue()));

  // « Le plan pose des arroseurs » et « aucune cote rognée » ne gardaient que
  // le DESSIN, retiré le 17 août. Ce qu'ils protégeaient vraiment — qu'une
  // zone mesurée donne bien des têtes — est éprouvé par le calcul.
  const posees = await page.evaluate(() => etat.zones
    .filter(z => TYPES[z.type].forme === 'surface')
    .reduce((n, z) => n + poser(z).nombre, 0));
  cas('une zone mesurée donne bien des arroseurs', posees > 0, 'posés : ' + posees);

  // La liste du matériel : des quantités, et AUCUN prix.
  const liste = await page.locator('#materiel').innerText();
  // « Électrovanne » sans « s » : depuis que ses fiches de nourrice servent, la
  // ligne porte la vraie référence (« Électrovanne 100 DV 1" MM 9V ») et non
  // plus le générique « Électrovannes 24 V ». Le motif couvre les deux.
  cas('la liste porte des quantités',
      /Électrovanne/.test(liste) && /(Tuyères|Turbines)/.test(liste), liste.slice(0, 120));
  cas('aucun prix nulle part sur la page', !/€|\bEUR\b/.test(await page.locator('body').innerText()));
  // **LE DISCONNECTEUR NE DOIT PLUS Y ÊTRE — sa décision du 18 août :** *« tu
  // peux le supprimer à tout jamais, je n'en mets jamais. »* Ce contrôle
  // exigeait exactement l'inverse jusqu'à ce jour-là. Il est retourné plutôt
  // que supprimé : sans lui, la pièce reviendrait au premier « il en faut un,
  // c'est obligatoire sur l'eau potable » — un raisonnement juste en général
  // et faux pour lui, et personne ne saurait que la question a été tranchée.
  cas('le disconnecteur n\'est plus dans la liste', !/Disconnecteur/.test(liste),
      (liste.match(/[^\n]*Disconnecteur[^\n]*/) || [''])[0]);

  // ── LES TUYÈRES SONT POUR LES PETITS ESPACES — sa règle du 17 août ───────
  // « Inférieur à 3,50 m, 4 m grand max. Sinon on passe en 3504 ou plus gros.
  //   Un carré de 12 × 10, c'est que des arroseurs, pas de tuyères. Les
  //   tuyères c'est un carré de 3 × 3, ou un long couloir de 10 × 2. »
  // Le seuil était à 8 m : une pelouse de 12 × 8 partait en tuyères, donc en
  // pluviométrie triple, beaucoup plus de têtes et beaucoup plus de débit.
  // **On éprouve SES TROIS EXEMPLES**, pas des cas inventés — c'est le petit
  // côté qui décide, et le couloir de 10 × 2 le prouve : long, mais étroit.
  const seuil = await page.evaluate(() => {
    // On garde SON jardin de côté et on le remet : vider `localStorage`
    // effacerait le nom qu'il a tapé plus haut dans cette suite, et le
    // contrôle « la saisie survit à un rechargement » rougirait pour une
    // raison qui n'est pas la sienne.
    const avant = JSON.parse(JSON.stringify(etat.zones));
    const essai = (L, l) => {
      etat.zones = [{ id: 1, nom: 'essai', type: 'gazon', L: String(L), l: String(l), materiel: 'auto' }];
      const p = poser(etat.zones[0]);
      return p.m ? p.m.type : null;
    };
    const r = { carre12x10: essai(12, 10), couloir10x2: essai(10, 2), carre3x3: essai(3, 3),
                pelouse12x8: essai(12, 8), carre4x4: essai(4, 4), carre5x5: essai(5, 5) };
    etat.zones = avant; recalculer(true);
    return r;
  });
  await page.waitForTimeout(150);
  // Ses trois exemples, mot pour mot.
  cas('son carré de 12 × 10 : que des turbines, aucune tuyère',
      seuil.carre12x10 === 'turbine', JSON.stringify(seuil));
  cas('son couloir de 10 × 2 : des tuyères, malgré ses 10 m de long',
      seuil.couloir10x2 === 'tuyere', JSON.stringify(seuil));
  cas('son carré de 3 × 3 : des tuyères', seuil.carre3x3 === 'tuyere', JSON.stringify(seuil));
  // Et la frontière elle-même : 4 m est le « grand max », au-delà on bascule.
  cas('4 m de petit côté tient encore en tuyères (son « grand max »)',
      seuil.carre4x4 === 'tuyere', JSON.stringify(seuil));
  cas('au-delà de 4 m, on passe en turbines',
      seuil.carre5x5 === 'turbine' && seuil.pelouse12x8 === 'turbine', JSON.stringify(seuil));

  // ── Ø25 PAR DÉFAUT, Ø32 SEULEMENT SI LE CALCUL LE DÉMONTRE ───────────────
  // Sa règle du 17 août. Le Ø32 doit se MÉRITER : il coûte plus cher et se
  // pose moins bien. On éprouve donc les DEUX verdicts — un contrôle qui ne
  // verrait jamais le Ø32 ne prouverait pas que le calcul sait basculer.
  const tuyau = await page.evaluate(() => {
    const lire = (L) => { etat.amenee = L; const a = amenee(decouper());
      return { d: a.diametre, perte: +a.perte25.toFixed(3), exigee: a.exigee, source: a.source, debit: +a.debit.toFixed(3) }; };
    const court = lire(30), long = lire(150);
    etat.amenee = 30;
    return { court, long };
  });
  cas('le calcul a de quoi trancher (un débit, une pression exigée)',
      tuyau.court.debit > 0 && tuyau.court.exigee > 0, JSON.stringify(tuyau.court));
  cas('amenée courte : Ø25, on n\'y touche pas',
      tuyau.court.d === 25, JSON.stringify(tuyau.court));
  cas('amenée longue : le Ø25 ne passe plus, on bascule en Ø32',
      tuyau.long.d === 32, JSON.stringify(tuyau.long));
  // La perte doit CROÎTRE avec la longueur — sans quoi le calcul ne calcule
  // rien et les deux verdicts ci-dessus seraient un hasard.
  cas('et la perte de charge croît bien avec la longueur',
      tuyau.long.perte > tuyau.court.perte * 2,
      tuyau.court.perte + ' bar à 30 m, ' + tuyau.long.perte + ' bar à 150 m');

  // ── UN CORPS DE SA FAMILLE, ET UN SBE À SON DIAMÈTRE ─────────────────────
  // **Ce cas naît d'un défaut que les 39 autres n'ont pas vu**, et qu'une
  // capture a montré : le jour où les turbines sont devenues posables, la
  // liste comptait un corps de TUYÈRE pour les 22 arroseurs — dont 11
  // turbines — et 22 SBE en 1/2" quand une turbine se raccorde en 3/4". Tout
  // était vert. On éprouve donc un jardin qui MÊLE les deux familles, avec
  // une turbine en 3/4" : c'est le seul cas où l'erreur se voit.
  const familles = await page.evaluate(() => {
    window.__avant = { zones: JSON.parse(JSON.stringify(etat.zones)), marque: etat.marque };
    etat.marque = 'hunter';
    etat.zones = [ { id:1, nom:'Grande pelouse', type:'gazon', L:'30', l:'22', materiel:'turbine' },
                   { id:2, nom:'Petite bande',   type:'gazon', L:'8',  l:'4',  materiel:'tuyere' } ];
    recalculer(true);
    const l = listeMateriel(decouper());
    const n = etat.zones.map(z => poser(z).nombre);
    const q = (re) => l.filter(x => re.test(x.nom)).reduce((s, x) => s + x.q, 0);
    const corpsTurb = l.filter(x => /^Turbine /.test(x.nom))[0];
    const corpsTuy  = l.filter(x => /^Tuyère /.test(x.nom))[0];
    // **CE CONTRÔLE LISAIT UNE ÉTIQUETTE, IL LIT DÉSORMAIS LA QUANTITÉ.**
    // Il comptait « SBE 075 (haut » et « (bas, sur la ligne) » — des mentions
    // que le patron a fait retirer le 18 août (*« ce sont des données pour toi
    // [...] l'utilisateur n'a pas besoin de ces infos-là »*), et les deux
    // emplois d'une même référence se sont fondus en une ligne. Un contrôle
    // accroché à un libellé meurt au premier changement de libellé : celui-ci
    // vérifie maintenant la RÈGLE, en totaux par diamètre.
    //
    // La règle, inchangée : un SBE en haut au diamètre du corps de chaque
    // famille, plus un SBE 3/4" en bas par arroseur, toutes familles
    // confondues. Le 3/4" porte donc les deux emplois quand le corps est en
    // 3/4" — c'est précisément le cas de ce jardin d'épreuve.
    return { nTurb:n[0], nTuy:n[1],
             corpsTurb: corpsTurb && corpsTurb.q, corpsTuy: corpsTuy && corpsTuy.q,
             sbe34: q(/SBE 075/), sbe12: q(/SBE 050/) };
  });
  // Le cas qui empêche de mesurer zéro : sans deux familles réellement posées,
  // tout ce qui suit vaudrait 0 === 0, en vert, sans rien prouver.
  cas('le jardin d\'épreuve mêle bien turbines ET tuyères',
      familles.nTurb > 0 && familles.nTuy > 0, JSON.stringify(familles));
  cas('chaque famille reçoit le corps de SA série, pas celui de l\'autre',
      familles.corpsTurb === familles.nTurb && familles.corpsTuy === familles.nTuy,
      JSON.stringify(familles));
  // Le SBE du haut suit le diamètre de CHAQUE corps : 1/2" sous les tuyères.
  cas('le SBE en 1/2" ne sert qu\'aux corps de tuyère',
      familles.sbe12 === familles.nTuy, JSON.stringify(familles));
  // Et le 3/4" porte les deux emplois : le haut des turbines, plus le bas de
  // TOUS les arroseurs — ce raccord-là ne dépend pas du corps.
  cas('le SBE en 3/4" porte le haut des turbines ET le bas de tous les arroseurs',
      familles.sbe34 === familles.nTurb + familles.nTurb + familles.nTuy,
      JSON.stringify(familles));
  // Et la convention de référence qui apparie buse et corps de turbine doit
  // tenir pour TOUTES les buses posables — sans quoi un corps manquerait en
  // silence dans la liste, et le chantier s'arrêterait à la pose.
  const apparies = await page.evaluate(() =>
    CATALOGUE.buses.filter(b => b.pourType === 'turbine' && b.debit[360] != null)
      .filter(b => !CATALOGUE.corpsDeLaBuse(b)).map(b => b.ref));
  cas('chaque buse de turbine posable trouve son corps',
      apparies.length === 0, 'sans corps : ' + apparies.join(', '));

  // On remet SON jardin — celui qu'il a saisi plus haut dans cette suite, avec
  // le nom tapé à la main. Vider `localStorage` l'effacerait, et le contrôle
  // « la saisie survit à un rechargement » deviendrait rouge pour une raison
  // qui n'est pas la sienne.
  await page.evaluate(() => {
    etat.zones = window.__avant.zones; etat.marque = window.__avant.marque;
    recalculer(true);
  });
  await page.waitForTimeout(150);

  // ── LA RÈGLE DES TÉS, ÉPROUVÉE PAR LUI SUR UN TRACÉ LIBRE (planche 74) ────
  // « N arroseurs sur un réseau, c'est N − 1 tés » — un réseau part d'UNE
  // ligne et finit sur N bouts, chaque té ajoute un bout. Ni la forme du
  // terrain ni l'ordre de raccordement n'y changent rien.
  //
  // Ce contrôle vaut plus que le compte du jour : il tient la formule de
  // `listeMateriel()` par SON INVARIANT, et non par les nombres d'un jardin
  // d'exemple qui bougeront au prochain catalogue. Un jour où quelqu'un
  // écrira `ny` jonctions au lieu de `ny − 1` — l'erreur exacte que sa
  // correction du 17 août visait — la somme cessera de tomber juste, et
  // c'est ici que ça se verra.
  const reseau = await page.evaluate(() => {
    const d = decouper();
    const l = listeMateriel(d);
    const q = (ref) => { const x = l.filter(y => y.ref === ref)[0]; return x ? x.q : 0; };
    // Un secteur peut porter plusieurs zones ; c'est bien par ZONE qu'un
    // réseau part du regard, donc c'est par zone que se compte le « − 1 ».
    let arroseurs = 0, reseaux = 0;
    etat.zones.forEach(z => { const p = poser(z); if (p.nombre && p.ny){ arroseurs += p.nombre; reseaux++; } });
    return { tes: q('te-taraude-25-34-25'), jonctions: q('te-25-25-25'),
             coudes: q('coude-taraude-25-34'), arroseurs, reseaux };
  });
  cas('le réseau latéral est bien compté (des tés, pas zéro)',
      reseau.tes > 0 && reseau.arroseurs > 0, JSON.stringify(reseau));
  // **Un contrôle qui mesure ZÉRO ne mesure rien** (règle du §5 du dépôt) :
  // sans la ligne ci-dessus, un jardin sans arroseur rendrait 0 === 0 en vert.
  cas('sa règle des tés : N arroseurs ⇒ N − 1 tés par réseau',
      reseau.tes + reseau.jonctions === reseau.arroseurs - reseau.reseaux,
      JSON.stringify(reseau) + ' — attendu ' + (reseau.arroseurs - reseau.reseaux));
  // Et le pendant : chaque arroseur porte un té OU un coude, jamais les deux,
  // jamais rien. Les jonctions, elles, n'alimentent aucun arroseur.
  cas('chaque arroseur porte un té ou un coude, et rien d\'autre',
      reseau.tes + reseau.coudes === reseau.arroseurs, JSON.stringify(reseau));

  // Le mail part avec la liste dedans.
  const href = await page.locator('#envoyer').getAttribute('href');
  // Même raison qu'au-dessus : depuis ses fiches de nourrice, la ligne porte la
  // référence réelle (« Électrovanne 100 DV ») et non le générique au pluriel.
  cas('le mail au fournisseur porte la liste',
      href.startsWith('mailto:') && /Electrovanne|%C3%89lectrovanne/.test(href),
      href.slice(0, 120));

  // Rien ne doit déborder à 360 px.
  const large = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  cas('rien ne déborde en largeur à 360 px', large);

  // Ce qu'il a saisi survit à un rechargement.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  cas('la saisie survit à un rechargement',
      (await page.locator('.zone .zone-tete input').first().inputValue()) === 'Pelouse du fond');

  // Et le cas dégradé : un jardin vide ne doit pas mentir.
  await page.evaluate(() => { localStorage.removeItem('atlas-arrosage'); });
  await page.reload({ waitUntil: 'networkidle' });
  // On retire JUSQU'À CE QU'IL N'EN RESTE PLUS, au lieu de compter cinq clics :
  // le jardin d'exemple a gagné une zone le 17 août, et une boucle à compte
  // fixe en laissait une derrière elle.
  for (let garde = 0; (await page.locator('.retirer').count()) > 0 && garde < 30; garde++){
    await page.locator('.retirer').first().click(); await page.waitForTimeout(80);
  }
  // Les panneaux des secteurs puis du plan ont été retirés les uns après les
  // autres le 17 août ; la règle, elle, tient toujours : sans zone, la page
  // DIT qu'elle attend, au lieu d'afficher des zéros qu'on prendrait pour un
  // résultat. On la lit là où elle parle désormais — la liste.
  const videListe = await page.locator('#materiel').innerText();
  cas('sans zone, la page le DIT au lieu d\'afficher zéro',
      /se remplit dès/.test(videListe), videListe.slice(0, 90));
  // ── LE CROQUIS — sa demande du 17 août : « la 2, ça doit être la photo du
  //    croquis qu'on ajoute » ─────────────────────────────────────────────────
  // On éprouve le PARCOURS ENTIER, du choix du fichier au rechargement : une
  // photo qui s'affiche mais ne survit pas serait pire qu'absente, puisqu'il
  // la croirait gardée. Et la page dit ce qu'elle NE SAIT PAS faire — lire les
  // cotes — plutôt que de le laisser supposer.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  cas('sans photo, la page en propose une', /ajouter la photo/i.test(
      await page.locator('#croquisLibelle').innerText()));
  cas('aucune photo affichée au départ', (await page.locator('.croquis-vue img').count()) === 0);
  await page.setInputFiles('#croquisFichier', CROQUIS_ESSAI);
  await page.waitForTimeout(900);
  cas('la photo du croquis s\'affiche', (await page.locator('.croquis-vue img').count()) === 1);
  cas('et la page DIT qu\'elle ne lit pas encore les cotes',
      /ne se lisent pas encore/.test(await page.locator('#croquisNote').innerText()));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  cas('la photo survit à un rechargement',
      (await page.locator('.croquis-vue img').count()) === 1);
  await page.locator('.croquis-vue button').click();
  await page.waitForTimeout(200);
  cas('et elle se retire', (await page.locator('.croquis-vue img').count()) === 0);

  // ── UNE SAUVEGARDE D'AVANT NE DOIT RIEN PERDRE, NI RIEN LAISSER VIDE ─────
  // **Le piège s'est refermé le 17 août**, et sur lui seul : `charger() ||
  // défauts` sautait tout l'objet de défauts dès qu'une sauvegarde existait,
  // donc chaque champ ajouté après sa première visite lui arrivait vide. La
  // page d'un nouveau venu était juste, la sienne non — le pire des deux, car
  // rien ne le disait. On éprouve donc le cas RÉEL : un jardin enregistré
  // AVANT les réglages du jour.
  await page.evaluate(() => localStorage.setItem('atlas-arrosage', JSON.stringify({
    seau: 10, temps: 20, pression: 3, saison: 'juillet', compteur: 'oui',
    corps: null, marque: null, pe32: 60, pe25: 120, sonde: false,
    zones: [{ id: 1, nom: 'Jardin d\'avant', type: 'gazon', L: 20, l: 14, materiel: 'auto' }]
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  cas('un jardin enregistré AVANT garde son nom',
      (await page.locator('.zone .zone-tete input').first().inputValue()) === 'Jardin d\'avant');
  cas('et il se pose toujours',
      (await page.evaluate(() => poser(etat.zones[0]).nombre)) > 0);
  // Le cœur du cas : un réglage AJOUTÉ depuis prend sa valeur, au lieu d'être vide.
  const amenee = await page.locator('[data-tuyau="amenee"]').inputValue();
  cas('un réglage ajouté depuis n\'arrive pas VIDE',
      amenee !== '' && Number(amenee) > 0, 'lu : ' + JSON.stringify(amenee));
  // Et une clé disparue du produit ne traîne pas.
  cas('un réglage retiré du produit ne traîne pas',
      await page.evaluate(() => etat.pe32 === undefined));

  cas('toujours aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

  await page.screenshot({ path: '/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/arrosage-vide.png', fullPage: true });
  await nav.close();
  console.log('\n' + (ko === 0 ? '✅' : '❌') + ' ' + ok + ' réussis, ' + ko + ' échoués.');
  process.exit(ko === 0 ? 0 : 1);
})();
