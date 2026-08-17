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
  // 8 depuis SA règle de pose du 17 août : on écarte au maximum dans sa limite
  // au lieu de resserrer à 80 % de la portée, donc moins d'arroseurs.
  // 10 depuis que le CHOIX DE BUSE obéit à sa règle d'écart : la turbine de 9 m
  // ne pave pas une pelouse de 12 m de large sans descendre sous sa portée, donc
  // l'outil passe en tuyères — plus d'arroseurs, plus de débit, plus de secteurs.
  cas('le jardin de départ donne 10 secteurs', secteurs === 10, 'lu : ' + secteurs);

  // SA RÈGLE DE POSE (17 août) : l'écart ne descend JAMAIS sous la portée, et
  // ne dépasse jamais 1,2 × la portée. C'est ce qui décide du nombre
  // d'arroseurs, donc du prix — et l'outil faisait exactement l'inverse avant.
  const resume = await page.locator('.zone-res').nth(1).innerText();
  const mEcart = resume.match(/un tous les (\d+,\d+) m/);
  const mRec = resume.match(/recouvrement (\d+) %/);
  cas('l\'écart de pose est chiffré en mètres', !!mEcart, resume.slice(0, 90));
  const ecart = mEcart ? parseFloat(mEcart[1].replace(',', '.')) : 0;
  cas('l\'écart ne descend pas sous la portée de la buse retenue',
      ecart >= 3.6 - 0.01, 'écart lu : ' + ecart);
  cas('et ne dépasse pas 1,2 × la portée', ecart <= 3.6 * 1.2 + 0.01, 'écart lu : ' + ecart);
  cas('le recouvrement obtenu tient ses 80 %',
      mRec && Number(mRec[1]) >= 80, resume.slice(0, 90));
  cas('la pose est annoncée (carré ou quinconce)',
      /en quinconce|en carré/.test(resume), resume.slice(0, 90));

  // **Le quinconce retire un arroseur, il ne le déplace pas.** Signalé le
  // 17 août : le plan mettait un arroseur en trop (repérable sur une capture),
  // parce que la rangée décalée gardait TOUS ses points au lieu d'en perdre un
  // — l'ancien calcul aurait donné 12 têtes sur cette pelouse, la règle en
  // demande 11.
  const zone0 = await page.locator('.zone-res').first().innerText();
  const combien = zone0.match(/^(\d+)\s/);
  cas('le quinconce compte UN arroseur de moins que la grille carrée',
      combien && Number(combien[1]) === 11, zone0.slice(0, 90));
  const tetesPlan = await page.locator('#plans .plan').first().locator('.tete').count();
  cas('et le plan dessine EXACTEMENT ce nombre-là',
      tetesPlan === 11, 'têtes dessinées : ' + tetesPlan);

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
  cas('la liste porte des quantités',
      /Électrovannes/.test(liste) && /(Tuyères|Turbines)/.test(liste), liste.slice(0, 80));
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
