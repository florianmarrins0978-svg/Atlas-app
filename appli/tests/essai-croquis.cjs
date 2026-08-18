/* ═══ LE CROQUIS AU PLAN — ce que ce contrôle garde ═════════════════════════

   Sa demande du 18 août : « une fois que j'ai envoyé la photo, il y a l'encart
   où on choisit la marque, et tout ce qu'il y a en dessous tu peux le
   supprimer. Ensuite tu me fais le plan en couleur avec les différents réseaux
   [...] et la liste des pièces à acheter. »

   **Trois défauts ont été trouvés SUR L'ÉCRAN et non par les suites d'alors**
   — la sixième fois dans ce dépôt (`CLAUDE.md` §5). Chacun a sa garde ici :

   1. `corpsCourant` était resté dans `arrosage.html` à l'extraction du calcul.
      Toute page AUTRE que celle-là partait en `ReferenceError` dès qu'un
      jardin posait une tuyère — et l'écran rendait « la liste se remplit dès
      qu'un jardin est lu », c'est-à-dire un vide qui ressemble à un état
      normal. Les 73 et les 105 suites étaient vertes : aucune ne demandait la
      liste d'un jardin MIXTE. → « la liste sort pour chaque jardin ».
   2. Le tuyau se dessinait une ligne par rangée : une rangée qui ne portait
      qu'une tête de ce réseau n'en avait aucune, et l'arroseur flottait, relié
      à rien. → « aucun arroseur n'est laissé sans tuyau ».
   3. La bande du goutte-à-goutte était grise : le dessin montrait deux
      couleurs quand la nourrice en annonçait trois, sans dire où passait la
      troisième voie. → « la légende nomme autant de réseaux que la nourrice a
      de voies ».

   **Aucun de ces contrôles ne regarde un écran** : ils interrogent le calcul
   et le tracé. Un contrôle accroché à un identifiant meurt au premier
   remaniement de la page — et il en a déjà demandé deux. */

const { chromium } = require('playwright');

const B = process.env.BASE_URL || 'http://127.0.0.1:8099';
let ok = 0, ko = 0;
function cas(n, c, d){ if (c) { ok++; console.log('  ✓ ' + n); } else { ko++; console.log('  ✗ ' + n + (d ? '\n      ' + d : '')); } }

/* Chaque tête est-elle POSÉE SUR le tuyau de son réseau ? On parcourt le
   chemin SVG point par point plutôt que de relire le code qui l'a écrit : un
   contrôle qui refait le calcul du dessin ne prouve que sa propre copie. */
const ORPHELINS = `(() => {
  const svg = document.querySelector('#plan svg');
  if (!svg) return { plan: false };
  const tuyaux = Array.from(svg.querySelectorAll('path.tuyau'));
  const tetes = Array.from(svg.querySelectorAll('circle.tete'));
  const orphelins = [];
  tetes.forEach(t => {
    const x = +t.getAttribute('cx'), y = +t.getAttribute('cy'), c = t.getAttribute('stroke');
    const sien = tuyaux.filter(p => p.getAttribute('stroke') === c);
    const dessus = sien.some(p => {
      const L = p.getTotalLength();
      for (let s = 0; s <= L; s += 1) {
        const q = p.getPointAtLength(s);
        if (Math.abs(q.x - x) < 1.2 && Math.abs(q.y - y) < 1.2) return true;
      }
      return false;
    });
    if (!dessus) orphelins.push(Math.round(x) + ',' + Math.round(y) + ' (' + c + ')');
  });
  return { plan: true, tetes: tetes.length, tuyaux: tuyaux.length, orphelins };
})()`;

(async () => {
  const nav = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
      (require('fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined),
  });
  // Son écran le plus étroit : 360 px. C'est là que le débordement se voit.
  const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(B + '/arrosage-croquis.html', { waitUntil: 'networkidle' });

  cas('aucune erreur JavaScript au chargement', erreurs.length === 0, erreurs.join(' | '));

  // ── LA PAGE NE DOIT PAS ÉCRASER SON JARDIN ────────────────────────────────
  // Elle emprunte le même calcul que l'outil ; si elle empruntait aussi sa
  // clé de sauvegarde, l'essayer effacerait le jardin qu'il a saisi.
  cas('la maquette garde sa propre mémoire, pas celle de l\'outil',
      await page.evaluate(() => CLE_ETAT !== 'atlas-arrosage' && !!CLE_ETAT),
      'clé lue : ' + await page.evaluate(() => CLE_ETAT));

  const jardins = await page.locator('#exemples button').count();
  cas('la maquette propose des jardins à essayer', jardins >= 2, jardins + ' proposé(s)');

  for (let i = 0; i < jardins; i++) {
    const nom = (await page.locator('#exemples button').nth(i).innerText()).trim();
    await page.locator('#exemples button').nth(i).click();
    await page.waitForTimeout(250);

    // 1. La liste SORT. Le défaut du 18 août rendait une liste vide sans un mot.
    const liste = await page.evaluate(() => {
      try { return { n: listeMateriel(decouper()).length, err: null }; }
      catch (e) { return { n: 0, err: e.message }; }
    });
    cas(nom + ' : la liste des pièces sort', liste.n > 0, liste.err || 'aucune ligne');

    // 2. Aucun arroseur n'est laissé sans tuyau.
    const m = await page.evaluate(ORPHELINS);
    cas(nom + ' : le plan est dessiné', m.plan === true);
    cas(nom + ' : il y a des arroseurs à relier', m.plan && m.tetes > 0,
        'aucune tête — le contrôle suivant ne mesurerait rien');
    cas(nom + ' : aucun arroseur n\'est laissé sans tuyau',
        m.plan && m.tetes > 0 && m.orphelins.length === 0,
        m.orphelins ? m.orphelins.join(' | ') : '');

    // 3. La légende nomme autant de réseaux que la nourrice a de voies.
    //    Le dessin et le compte doivent raconter la MÊME installation : c'est
    //    la divergence que le §3 du dépôt interdit, en version dessinée.
    const accord = await page.evaluate(() => {
      const voies = decouper().secteurs.length;
      const nommes = Array.from(document.querySelectorAll('#legende span'))
        .map(s => (s.textContent.match(/Réseau (\d+)/) || [])[1])
        .filter(Boolean);
      return { voies, nommes: Array.from(new Set(nommes)).length };
    });
    cas(nom + ' : la légende nomme autant de réseaux que la nourrice a de voies',
        accord.voies > 0 && accord.nommes === accord.voies,
        accord.nommes + ' nommé(s) pour ' + accord.voies + ' voie(s)');

    // 4. Rien n'est écrit à la main dans les casiers. Sa colère du 17 août
    //    portait exactement là-dessus : « le dura rectangle, tu as mélangé une
    //    pièce avec le regard ». Les casiers RANGENT, ils ne composent pas.
    const invente = await page.evaluate(() => {
      const vraies = listeMateriel(decouper()).map(l => l.nom);
      return Array.from(document.querySelectorAll('#casiers .l .n'))
        .map(e => e.textContent.trim())
        .filter(t => !vraies.some(v => t === v || t.indexOf(v) === 0));
    });
    // Le casier du PE porte deux lignes de longueur À MESURER, qui ne sortent
    // pas du catalogue et le disent : elles sont admises, comptées à part.
    const horsCatalogue = invente.filter(t => !/mesurer|couronne/.test(t));
    cas(nom + ' : aucune pièce n\'est inventée dans les casiers',
        horsCatalogue.length === 0, horsCatalogue.join(' | '));

    // 5. **Une désignation, rien de plus.** Sa consigne du 18 août : les lignes
    //    du réseau enterré portaient « (départ/milieu de ligne) », « (fin de
    //    ligne) », « (jonction, non taraudé) » — *« ce sont des données pour
    //    toi [...] pour l'utilisateur, il n'a pas besoin de ces infos-là ».*
    //    Il commande sur la désignation du catalogue : ce qui s'y ajoute est
    //    une invitation à chercher une pièce qui n'existe pas sous ce nom.
    const commentees = await page.evaluate(() => {
      const dessous = CATALOGUE.piecesReseau;
      return listeMateriel(decouper())
        .filter(l => dessous[l.ref])
        .filter(l => l.nom !== dessous[l.ref].nom)
        .map(l => l.nom + '  ≠  ' + dessous[l.ref].nom);
    });
    cas(nom + ' : le réseau enterré porte la désignation du catalogue, rien de plus',
        commentees.length === 0, commentees.join(' | '));

    // 6. **Un produit, une ligne.** Les deux coudes SBE se distinguaient par
    //    « (haut, au corps) » et « (bas, sur la ligne) ». Retirer ces mentions
    //    — sa consigne — aurait donné DEUX lignes identiques dès qu'un corps
    //    est en 3/4" (les grosses turbines), ce qui se lit comme un défaut de
    //    comptage. Les emplois s'additionnent désormais par référence ; ce
    //    contrôle garde l'invariant, y compris pour les pièces à venir.
    const doubles = await page.evaluate(() => {
      const vus = {}, deuxFois = [];
      listeMateriel(decouper()).forEach(l => {
        if (!l.ref) return;
        if (vus[l.ref]) deuxFois.push(l.ref + ' : « ' + vus[l.ref] + ' » et « ' + l.nom + ' »');
        vus[l.ref] = l.nom;
      });
      return deuxFois;
    });
    cas(nom + ' : une référence n\'apparaît qu\'une fois dans la liste',
        doubles.length === 0, doubles.join(' | '));

    // 7. Rien ne déborde de son écran.
    const debord = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    cas(nom + ' : rien ne déborde à 360 px', debord <= 0, debord + ' px de trop');
  }

  // ── LE CAS OÙ LES DEUX SBE SONT LE MÊME PRODUIT ──────────────────────────
  //
  // **Sans ce passage, le contrôle « une référence n'apparaît qu'une fois » ne
  // pouvait pas rougir.** Les trois jardins d'exemple posent des corps en 1/2"
  // (3504, SRM, PGJ) : le SBE du haut est un 050, celui du bas un 075, deux
  // références. Le cas à garder est celui du corps en **3/4"** — les grosses
  // turbines —, où les deux emplois sont LE MÊME PRODUIT et où retirer les
  // mentions « (haut, au corps) / (bas, sur la ligne) », qu'il a demandé le
  // 18 août, donnerait deux lignes identiques.
  //
  // On le PROVOQUE, avec une pelouse assez grande pour qu'une PGP soit posée.
  // Un contrôle qui ne rencontre jamais son cas ne mesure rien — le piège du
  // 15 août, en version « jamais atteint ».
  const gros = await page.evaluate(() => {
    etat.marque = 'hunter';
    etat.zones = [{ id: 1, nom: 'Grande pelouse', type: 'gazon', L: 40, l: 30, materiel: 'auto' }];
    const p = poser(etat.zones[0]);
    const c = p.m && p.m.type === 'turbine' ? CATALOGUE.corpsDeLaBuse(p.m.buse) : null;
    const lignes = listeMateriel(decouper());
    const vus = {}, deuxFois = [];
    lignes.forEach(l => {
      if (!l.ref) return;
      if (vus[l.ref]) deuxFois.push(l.ref + ' : « ' + vus[l.ref] + ' » et « ' + l.nom + ' »');
      vus[l.ref] = l.nom;
    });
    return {
      corps: c ? c.ref + ' en ' + c.filetage : 'aucun',
      enTroisQuarts: !!(c && c.filetage === '3/4'),
      deuxFois,
      sbe: lignes.filter(l => /SBE/.test(l.nom)).map(l => l.q + ' × ' + l.nom),
    };
  });
  // **Et l'on refuse de conclure si le cas n'a pas été atteint.** Le jour où le
  // catalogue n'aurait plus un seul corps en 3/4", le contrôle suivant
  // passerait au vert sans avoir rien éprouvé — et personne ne le saurait.
  cas('une grande pelouse pose bien un corps en 3/4" — le cas est atteint',
      gros.enTroisQuarts, 'corps posé : ' + gros.corps);
  cas('et les deux emplois du SBE ne font qu\'UNE ligne',
      gros.enTroisQuarts && gros.deuxFois.length === 0,
      gros.deuxFois.join(' | ') + '  —  lu : ' + gros.sbe.join(' / '));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(250);

  cas('toujours aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

  await nav.close();
  console.log('\n' + (ko === 0 ? '✅' : '❌') + ' ' + ok + ' réussis, ' + ko + ' échoués.');
  process.exit(ko === 0 ? 0 : 1);
})();
