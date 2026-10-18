import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
const S = 'C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/4251adad-43ba-4fe8-814f-173f45a18fa4/scratchpad';
const CATS = [['raccord PE', 'Raccords PE Millenium'], ['raccord polypro', 'Raccords polypro'], ['collier', 'Colliers de prise en charge'], ['robinetterie', 'Robinetterie'], ['tube PE', 'Tubes PE'],
  ['electrovanne', 'Électrovannes et pièces Dura'], ['regard', 'Regards'], ["accessoire d'arroseur", "Accessoires d'arroseur"],
  ['raccord goutte-à-goutte', 'Raccords goutte-à-goutte'], ['goutte-à-goutte', 'Goutte-à-goutte'], ['électricité', 'Électricité'],
  ['programmateur', 'Programmateurs'], ['accessoire de programmation', 'Accessoires de programmation']];
const ECARTEES = {
  'ev-toro-ezflo-ff-24v': 'La seule photo trouvée est celle de la version avec réglage de débit, étiquette effacée par le vendeur.',
  'ev-toro-ezflo-mm-rmd-24v': 'La seule photo trouvée est celle de la version sans réglage de débit, étiquette retouchée par le vendeur.',
  'ev-toro-ezflo-mm-9v': 'La seule photo trouvée est sans doute la version avec réglage de débit.',
  'micro-jet-360': 'La seule photo trouvée montre un autre jet, de 5 à 7,5 m de portée.',
  'micro-jet-180': 'La seule photo trouvée montre un autre jet, de 5 à 7,5 m de portée.',
  'micro-jet-90': 'La seule photo trouvée montre un autre jet, de 5 à 7,5 m de portée.',
  'micro-jet-rotatif': 'La seule photo trouvée montre un jet fixe, pas rotatif.',
  'micro-tube-4x6': 'La seule photo trouvée montre du 4 x 7, pas du 4 x 6.',
  'prise-eau-4x6': 'La seule photo trouvée montre une jonction, pas une prise d’eau.',
  'cable-r2v-7g15': 'La seule photo trouvée montre un câble blindé, pas un RO2V.',
};
// Une seconde photo qui n'est pas la pièce (un dessin, un autre modèle) part ; la première reste.
const DESSINS = ['vari-aquila-spike-180-2.jpg', 'rb-wr2-rc-2.jpg'];
const photos = [], fichiers = {};
for (const lot of ['E', 'F']) {
  const d = S + '/photos-lot-' + lot;
  if (!existsSync(d + '/manifeste.json')) continue;
  const pieces = JSON.parse(readFileSync(d + '/pieces.json', 'utf8'));
  const cat = Object.fromEntries(pieces.map((p) => [p.ref, p.categorie]));
  const man = JSON.parse(readFileSync(d + '/manifeste.json', 'utf8'));
  const rang = {};
  for (const m of man) {
    // Sa décision du 18 octobre au soir : les électrovannes prennent les photos
    // trouvées sans passer par la planche, et les deux formes Millenium sont supprimées.
    if (cat[(m.refs || [])[0]] === 'electrovanne' || /^pe-mil-(te-90-75|adaptateur-bride)$|^vanne-1-4-tour/.test(m.forme)) continue;
    const groupe = cat[(m.refs || [])[0]] || 'autre';
    const n = (m.refs || []).length;
    const servir = n > 1 ? 'Servira à ' + n + ' références.' : 'Une référence : ' + (m.refs || [''])[0] + '.';
    const brut = !m.montre ? (m.nom || m.forme) : /\d/.test(m.montre) || !m.nom ? m.montre : m.nom + ', ' + m.montre.charAt(0).toLowerCase() + m.montre.slice(1); let nom = brut.charAt(0).toUpperCase() + brut.slice(1);
    if (m.nom && m.montre && m.montre.toLowerCase().startsWith(m.nom.toLowerCase())) nom = m.montre.charAt(0).toUpperCase() + m.montre.slice(1);
    // Il doit lire la taille dans le nom : la visée, quand la photo ne la porte pas en clair.
    // Seulement quand le nom ne porte AUCUNE taille : « Té égal 90, 75 » ferait croire à un 75.
    if (!/\d/.test(nom.replace(/\d+\s?°/g, '')) && /\d/.test(m.vise || '')) nom += ', ' + m.vise;
    // Le nom dit déjà la taille montrée : une phrase qui la redit en rouge est du bruit (sa remarque du 18 octobre).
    const doute = (m.doute || '').split(/(?<=\.)\s+/).filter((s) => !/dans la liste|taille de repli|Pas de 1" trouvé/.test(s)).join(' ').replace(/\s*·\s*/g, '. ').replace(/\s+—\s+/g, ', ');
    // Sa règle du 18 octobre : on ne lui montre pas une autre pièce ni une autre taille.
    if (m.fichier && (/^Ce n'est pas la bonne/.test(m.doute || '') || ECARTEES[m.forme] || DESSINS.includes(m.fichier))) { if (DESSINS.includes(m.fichier)) continue; m.fichier = null; m.doute = ECARTEES[m.forme] || 'Aucune photo de la bonne pièce trouvée.'; }
    if (!m.fichier) { photos.push({ cle: lot + '-' + m.forme, groupe, nom: m.nom || m.forme, ref: servir, fichier: null, doute: m.doute || '' }); continue; }
    rang[m.forme] = (rang[m.forme] || 0) + 1;
    mkdirSync(S + '/valider-lots2/photos/' + lot, { recursive: true });
    copyFileSync(d + '/' + m.fichier, S + '/valider-lots2/photos/' + lot + '/' + m.fichier);
    const f = 'photos/' + lot + '/' + m.fichier;
    fichiers[f] = 'valider-lots2/' + f;
    photos.push({ cle: lot + '-' + m.fichier.replace(/\.\w+$/, ''), groupe, nom, ref: servir, rang: rang[m.forme], fichier: f, site: m.site || '', doute });
  }
}
let t = readFileSync(S + '/valider-pe/modele.html', 'utf8')
  .replace(/<title>[^<]*<\/title>/, '<title>Photos des dernières pièces</title>')
  .replace(/<h1>[^<]*<\/h1>/, '<h1>Photos des dernières pièces</h1>')
  .replace(/<p class="chapeau">[^<]*<\/p>/, '<p class="chapeau">Une photo par forme ou par modèle. Validée, elle sert à toutes les références de la forme.</p>')
  .replace(/var GROUPES = .*/, 'var GROUPES = ' + JSON.stringify(CATS) + ';')
  .replace('/*PHOTOS*/[]', JSON.stringify(photos));
writeFileSync(S + '/valider-lots2/photos-dernieres-pieces.html', t);
writeFileSync(S + '/valider-lots2/fichiers.json', JSON.stringify(fichiers));
console.log(photos.filter((p) => p.fichier).length, 'photos,', photos.filter((p) => !p.fichier).length, 'formes sans photo');
