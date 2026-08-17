const { chromium } = require('playwright');
const B = 'http://127.0.0.1:8099';
let ok = 0, ko = 0;
function cas(n, c, d){ if (c) { ok++; console.log('  ✓ ' + n); } else { ko++; console.log('  ✗ ' + n + (d ? '\n      ' + d : '')); } }
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // L'écran le plus étroit du parc : 360 px. C'est là que ça casse.
  const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(B + '/arrosage.html', { waitUntil: 'networkidle' });

  cas('aucune erreur JavaScript au chargement', erreurs.length === 0, erreurs.join(' | '));
  const dispo = await page.locator('#debitDispo').textContent();
  cas('le débit se calcule du seau (10 L / 20 s = 1,80)', dispo.trim() === '1,80', 'lu : ' + dispo);

  const secteurs = await page.locator('.sec').count();
  // 9 avec le recouvrement de 80 % qu'il a posé le 17 août : l'écart de pose
  // passe sous la portée, donc il faut plus d'arroseurs, donc un secteur de plus.
  cas('le jardin de départ donne 9 secteurs', secteurs === 9, 'lu : ' + secteurs);

  // LA RÈGLE QU'IL A DONNÉE : le recouvrement décide du nombre d'arroseurs.
  // Sans ce cas, on pourrait la débrancher sans que rien ne rougisse.
  const tetes80 = await page.locator('#plans .tete').count();
  await page.fill('#recouvrement', '100');
  await page.waitForTimeout(150);
  const tetes100 = await page.locator('#plans .tete').count();
  cas('desserrer le recouvrement retire des arroseurs', tetes100 < tetes80,
      tetes100 + ' à 100 % contre ' + tetes80 + ' à 80 %');
  const note = await page.locator('#recouvrementNote').innerText();
  cas('l\'écart de pose est écrit en mètres', /tous les \d+,\d+ m/.test(note), note.slice(0, 90));
  cas('et la règle est annoncée comme PROVISOIRE, puisqu\'il l\'a écartée',
      /PROVISOIRE/.test(note), note.slice(0, 90));
  await page.fill('#recouvrement', '80');
  await page.waitForTimeout(150);

  // LA MARQUE — sa demande du 17 août : Rain Bird par défaut, bandeau déroulant
  // pour en changer. Sans ce cas, le bandeau pourrait ne rien piloter du tout.
  cas('la marque par défaut est Rain Bird',
      (await page.locator('#marque').inputValue()) === 'rainbird',
      'lu : ' + (await page.locator('#marque').inputValue()));
  // Depuis ses buses VAN du 17 août, Rain Bird n'est plus vide : le contrôle
  // vise donc ce qui reste vrai — la marque annonce ce qu'elle a ET ce qui lui
  // manque encore (les turbines, les corps d'arroseur).
  const noteRB = await page.locator('#marqueNote').innerText();
  cas('la marque annonce ses modèles', /\d+ modèles? Rain Bird/.test(noteRB), noteRB.slice(0, 70));
  cas('et ce qui lui manque encore', /Manque encore/.test(noteRB), noteRB.slice(0, 90));
  await page.selectOption('#marque', 'toro');
  await page.waitForTimeout(200);
  const noteToro = await page.locator('#marqueNote').innerText();
  cas('changer de marque change ce qui est annoncé', /Toro/.test(noteToro), noteToro.slice(0, 60));
  cas('et les zones survivent à la bascule', (await page.locator('.zone').count()) > 0);
  const mailMarque = await page.locator('#envoyer').getAttribute('href');
  cas('la marque part dans la demande au fournisseur', /Toro/.test(decodeURIComponent(mailMarque)));
  await page.selectOption('#marque', 'rainbird');
  await page.waitForTimeout(200);

  // La nourrice : tant que sa fiche manque, l'écran le dit au lieu d'inventer.
  const nourrice = await page.locator('#nourrice').innerText();
  cas('la fiche de nourrice manquante est ANNONCÉE', /à renseigner/.test(nourrice), nourrice.slice(0, 70));

  // Et les valeurs provisoires sont signalées, jamais présentées comme acquises.
  const bandeau = await page.locator('#bandeau').innerText();
  cas('les valeurs provisoires sont signalées', /provisoire/.test(bandeau), bandeau.slice(0, 70));

  // Le geste réel : il change le temps de remplissage, tout doit suivre.
  await page.fill('#temps', '40');
  await page.waitForTimeout(120);
  const dispo2 = await page.locator('#debitDispo').textContent();
  const secteurs2 = await page.locator('.sec').count();
  cas('un débit deux fois plus faible se voit', dispo2.trim() === '0,90', 'lu : ' + dispo2);
  cas('et il faut plus de secteurs', secteurs2 > secteurs, secteurs2 + ' contre ' + secteurs);
  await page.fill('#temps', '20');
  await page.waitForTimeout(120);

  // Aucun secteur ne doit dépasser le débit du robinet — l'invariant du métier.
  const debits = await page.locator('.sec-q').allTextContents();
  const dispoN = parseFloat(dispo.replace(',', '.'));
  const trop = debits.map(t => parseFloat(t.replace(',', '.'))).filter(x => x > dispoN);
  cas('aucun secteur au-dessus du robinet', trop.length === 0, trop.join(', '));

  // Le cycle affiché est la somme des durées.
  const mins = (await page.locator('.sec-min').allTextContents()).map(Number);
  const somme = mins.reduce((a, b) => a + b, 0);
  const verdict = await page.locator('#verdict').innerText();
  const m = verdict.match(/(\d+)\s*h\s*(\d+)/);
  cas('le cycle est la somme des secteurs', m && Number(m[1]) * 60 + Number(m[2]) === somme,
      'affiché ' + (m ? m[0] : '—') + ', somme ' + somme);

  // La saison change les durées, JAMAIS le nombre de secteurs (c'est du câblage).
  await page.locator('#saisons button', { hasText: 'Avril' }).click();
  await page.waitForTimeout(120);
  const secteursAvril = await page.locator('.sec').count();
  const minsAvril = (await page.locator('.sec-min').allTextContents()).map(Number);
  cas('changer de saison ne recâble pas', secteursAvril === secteurs, secteursAvril + ' contre ' + secteurs);
  cas('mais les durées baissent en avril', minsAvril.reduce((a,b)=>a+b,0) < somme,
      minsAvril.join(',') + ' contre ' + mins.join(','));
  await page.locator('#saisons button', { hasText: 'Juillet' }).click();
  await page.waitForTimeout(120);

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

  // Le plan se dessine, et sa cote n'est pas rognée.
  const tetes = await page.locator('#plans .tete').count();
  cas('le plan pose des arroseurs', tetes > 0, 'aucune tête');
  const svg = await page.locator('#plans .plan').first().boundingBox();
  cas('le plan n\'est pas une boîte de zéro pixel', svg && svg.width > 100 && svg.height > 60,
      svg ? svg.width + ' × ' + svg.height : 'absent');
  const cotes = page.locator('#plans .plan').first().locator('.cote');
  let rognee = null;
  for (let i = 0; i < await cotes.count(); i++){
    const c = await cotes.nth(i).boundingBox();
    if (!c || c.x < svg.x - 0.5 || c.x + c.width > svg.x + svg.width + 0.5) rognee = await cotes.nth(i).textContent();
  }
  cas('aucune cote rognée par le cadre', rognee === null, 'rognée : ' + rognee);

  // La liste du matériel : des quantités, et AUCUN prix.
  const liste = await page.locator('#materiel').innerText();
  cas('la liste porte des quantités', /Électrovannes/.test(liste) && /Turbines/.test(liste), liste.slice(0, 80));
  cas('aucun prix nulle part sur la page', !/€|\bEUR\b/.test(await page.locator('body').innerText()));
  cas('le disconnecteur est dans la liste', /Disconnecteur/.test(liste));

  // Le mail part avec la liste dedans.
  const href = await page.locator('#envoyer').getAttribute('href');
  cas('le mail au fournisseur porte la liste', href.startsWith('mailto:') && /Electrovannes|%C3%89lectrovannes/.test(href),
      href.slice(0, 90));

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
  for (let i = 0; i < 5; i++){ await page.locator('.retirer').first().click(); await page.waitForTimeout(80); }
  const vide = await page.locator('#secteurs').innerText();
  cas('sans zone, la page le DIT au lieu d\'afficher zéro', /Rien à découper/.test(vide), vide.slice(0, 60));
  cas('toujours aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

  await page.screenshot({ path: '/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/arrosage-vide.png', fullPage: true });
  await nav.close();
  console.log('\n' + (ko === 0 ? '✅' : '❌') + ' ' + ok + ' réussis, ' + ko + ' échoués.');
  process.exit(ko === 0 ? 0 : 1);
})();
