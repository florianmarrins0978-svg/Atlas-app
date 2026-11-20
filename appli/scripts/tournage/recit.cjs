/* =======================================================================
   LE RÉCIT DU SITE DE VENTE, saisi dans l'appli par ses écrans : l'entreprise
   Les Jardins de Valmorin, celui qui tient le téléphone (Lucas), le client
   Mr. Lemaire, son devis « Création d'un massif », et l'envoi du lien.

   C'est le chantier que toutes les scènes du site suivent (en-tête de
   vente/cause.html) : commune inventée, téléphone dans la tranche que l'Arcep
   réserve à la fiction. Rien n'est écrit en base à la main : chaque champ est
   tapé dans son écran, et relu après rechargement.

   Avant : le jeu d'essai neuf (npm run db:seed sur la base d'essai LOCALE,
   jamais ailleurs : il la vide), et serveur.sh demarrer 2026-11-06T08:00:00+01:00.

     node appli/scripts/tournage/recit.cjs               tout le récit, dans l'ordre
     node appli/scripts/tournage/recit.cjs devis envoi   les étapes nommées

   Étapes : identite, prenom, client, devis, envoi. Après « envoi », garder
   l'état : etat.sh garder envoye (serveur arrêté).
   ======================================================================= */
const { BASE, ouvrir, connecter, voir, lienDuClient, sql } = require('./commun.cjs');

const ENTREPRISE = [
  // [comment trouver le champ, son nom, ce qu'on y tape]
  ['label', "Nom de l'entreprise", 'Les Jardins de Valmorin'],
  ['aria', 'Adresse du siège', '4 chemin des Saules, Valmorin'],
  ['label', 'SIRET', '841 207 395 00027'],
  ['label', 'Numéro de TVA intracommunautaire', 'FR31841207395'],
  ['aria', 'Numéro de téléphone', '2 61 91 45 20'],
  ['label', 'Adresse e-mail', 'contact@jardins-valmorin.fr'],
  ['label', 'Assureur', 'Val Assurances'],
  ['label', 'Adresse de l’assureur', '3 place du Marché, Valmorin'],
  ['label', 'N° de contrat', 'VA 2026 0418'],
  ['label', 'Nom', 'Médiation des métiers du Val'],
  ['label', 'Adresse ou site', '8 rue du Lavoir, Valmorin'],
];
const PRENOM = 'Lucas';
const CLIENT = { nom: 'Lemaire', telephone: '06 39 98 12 34', adresse: '12 allée des Charmilles, Valmorin' };
const DEVIS = {
  titre: "Création d'un massif",
  lignes: [
    ['Arrachage de la haie de thuyas et évacuation', '12', 'ml', '18,00'],
    ['Décompactage et amendement du sol', '15', 'm²', '8,50'],
    ['Fourniture et plantation de vivaces', '30', 'u', '9,50'],
    ['Paillage en écorce de pin', '15', 'm²', '6,00'],
  ],
  total: '862,20',
};
const JOUR = '2026-11-06';                     // le vendredi proposé au client : le jour du récit

const refuser = (quoi) => { throw new Error('REFUS : ' + quoi); };

const ETAPES = {
  /** Réglages, Mon entreprise : chaque champ s'écrit en quittant la ligne. */
  async identite(page) {
    await page.goto(BASE + '/reglages/identite', { waitUntil: 'networkidle' });
    for (const [par, nom, valeur] of ENTREPRISE) {
      const champ = par === 'label' ? page.getByLabel(nom, { exact: true }) : page.locator(`input[aria-label="${nom}"]`);
      if ((await champ.count()) !== 1) refuser('le champ « ' + nom + ' » est introuvable ou en double sur Mon entreprise');
      await champ.scrollIntoViewIfNeeded(); await champ.click(); await champ.fill('');
      await champ.pressSequentially(valeur, { delay: 12 });
      await page.keyboard.press('Tab'); await page.waitForTimeout(700);
      const alerte = (await page.locator('[role="alert"]').allInnerTexts()).join(' ').trim();
      if (alerte) refuser('après « ' + nom + ' », l\'écran dit : ' + alerte.replace(/\s+/g, ' '));
    }
    await page.waitForTimeout(1200); await page.reload({ waitUntil: 'networkidle' });
    const papier = (await page.locator('[data-atlas="apercu-du-papier"]').innerText()).replace(/\s+/g, ' ');
    if (!papier.includes('Les Jardins de Valmorin EI') || !papier.includes('02 61 91 45 20')) refuser('l\'en-tête du papier ne porte pas l\'entreprise du récit : ' + papier);
    console.log('identité : ' + papier);
  },
  /** Réglages, Mon compte : c'est ce prénom que le retour d'intervention nomme. */
  async prenom(page) {
    await page.goto(BASE + '/reglages/compte', { waitUntil: 'networkidle' });
    const champ = page.getByLabel('Prénom', { exact: true });
    await champ.click(); await champ.fill(''); await champ.pressSequentially(PRENOM, { delay: 20 }); await page.keyboard.press('Tab');
    await page.waitForTimeout(1500); await page.reload({ waitUntil: 'networkidle' });
    const relu = await page.getByLabel('Prénom', { exact: true }).inputValue();
    if (relu !== PRENOM) refuser('le prénom relu est « ' + relu + ' »');
    console.log('prénom : ' + relu);
  },
  /** La fiche client, puis « Je rédige à la main » : le chantier naît là. */
  async client(page) {
    await page.goto(BASE + '/chantiers/nouveau', { waitUntil: 'networkidle' });
    await page.click('[data-atlas="civilite-mr"]');
    await page.locator('input[aria-label="Nom du client"]').pressSequentially(CLIENT.nom, { delay: 15 });
    await page.locator('input[aria-label="Téléphone"]').pressSequentially(CLIENT.telephone, { delay: 15 });
    await page.locator('input[aria-label="Adresse du chantier"]').pressSequentially(CLIENT.adresse, { delay: 10 });
    await page.keyboard.press('Tab'); await page.waitForTimeout(600);
    await page.click('[data-atlas="action-ecrire"]');
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet/, { timeout: 30000 });
    console.log('client : ' + page.url());
  },
  /** L'écran du devis : le titre et les quatre lignes, puis relecture. */
  async devis(page) {
    const chantier = sql(`select c.id from chantiers c join clients k on k.id = c.client_id where k.nom = '${CLIENT.nom}' order by c.created_at desc limit 1`);
    if (!chantier) refuser('pas de chantier pour ' + CLIENT.nom + ' : jouer l\'étape client d\'abord');
    await page.goto(BASE + '/chantiers/' + chantier + '/devis-complet', { waitUntil: 'networkidle' });
    const taper = async (champ, texte) => { await champ.scrollIntoViewIfNeeded(); await champ.click(); await champ.fill(''); await champ.pressSequentially(texte, { delay: 10 }); await page.keyboard.press('Tab'); await page.waitForTimeout(450); };
    await taper(page.locator('[data-atlas="titre-devis"]'), DEVIS.titre);
    for (let i = 0; i < DEVIS.lignes.length; i++) {
      const n = i + 1, [quoi, quantite, unite, prix] = DEVIS.lignes[i];
      if ((await page.locator(`[aria-label="Description ${n}"]`).count()) === 0) { await page.getByRole('button', { name: '+ Ajouter une ligne' }).click(); await page.waitForTimeout(500); }
      await taper(page.locator(`[aria-label="Description ${n}"]`), quoi);
      await taper(page.locator(`[aria-label="Quantité ${n}"]`), quantite);
      await taper(page.locator(`[aria-label="Unité ${n}"]`), unite);
      await taper(page.locator(`[aria-label="Prix unitaire ${n}"]`), prix);
    }
    await page.waitForTimeout(2500); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const total = ((await page.locator('body').innerText()).replace(/\s+/g, ' ').match(/Total TTC ([\d  ,]+) €/) || [])[1];
    if (total !== DEVIS.total) refuser('le total relu est « ' + total + ' », on attendait ' + DEVIS.total);
    console.log('devis : ' + DEVIS.lignes.length + ' lignes, ' + total + ' € TTC');
  },
  /**
   * « Choisir la date », le seul vendredi du récit, « Envoyer le devis ».
   * L'appli retient d'elle-même le premier jour ouvré : on le rend avant de
   * choisir le nôtre, sans quoi le client se voit proposer deux dates.
   */
  async envoi(page) {
    const chantier = sql(`select c.id from chantiers c join clients k on k.id = c.client_id where k.nom = '${CLIENT.nom}' order by c.created_at desc limit 1`);
    await page.goto(BASE + '/chantiers/' + chantier + '/devis-complet', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Choisir la date' }).click();
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 15000 }); await page.waitForTimeout(700);
    const retenus = () => page.evaluate(() => [...document.querySelectorAll('[data-jour][data-etat="retenu"]')].map((e) => e.getAttribute('data-jour')));
    for (const j of await retenus()) if (j !== JOUR) { await page.locator(`[data-jour="${j}"]`).last().click(); await page.waitForTimeout(500); }
    if (!(await retenus()).includes(JOUR)) { await page.locator(`[data-jour="${JOUR}"]`).last().click(); await page.waitForTimeout(500); }
    const choisis = await retenus();
    if (choisis.join() !== JOUR) refuser('les jours retenus sont ' + JSON.stringify(choisis) + ', on voulait le seul ' + JOUR);
    await page.getByRole('button', { name: 'Envoyer le devis' }).click();
    // L'envoi par SMS ouvre d'abord un lien « sms: », que ce navigateur abandonne : on n'attend donc pas
    // une navigation (elle se dirait avortée), on regarde l'adresse jusqu'au retour à l'accueil.
    await page.waitForFunction(() => location.pathname === '/', null, { timeout: 30000 }); await page.waitForTimeout(1500);
    const lien = lienDuClient(CLIENT.nom);
    console.log('envoi : le lien du client est /devis/' + lien.jeton);
  },
};

(async () => {
  const demandees = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ETAPES);
  for (const e of demandees) if (!ETAPES[e]) refuser('étape inconnue : ' + e + ' (identite, prenom, client, devis, envoi)');
  const { nav, contexte, page, pannes, etat } = await ouvrir();
  try {
    await connecter(page, contexte, etat);
    for (const e of demandees) { await ETAPES[e](page); await voir(page, 'recit-' + e); }
    if (pannes.length) refuser('l\'appli a signalé : ' + pannes.join(' ; '));
  } finally { await nav.close(); }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
