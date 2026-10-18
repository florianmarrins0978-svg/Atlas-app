import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
const S = 'C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/4251adad-43ba-4fe8-814f-173f45a18fa4/scratchpad';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus';
const { CATALOGUE } = await import('file:///' + A + '/src/lib/arrosage/catalogue.js');
const pe = CATALOGUE.piecesAjoutables.filter((p) => p.categorie === 'raccord PE' && !/MILLENIUM/.test(p.nom));
// [groupe, clé, nom, motif, la taille visée, pourquoi pas en 25]
const FORMES = [
  ['manchon', 'pe-manchon', 'Manchon', /^OPL7010/, '25 x 25'],
  ['manchon', 'pe-manchon-reduit', 'Manchon réduit', /^OPL7110/, '25 x 20'],
  ['manchon', 'pe-manchon-reparation', 'Manchon de réparation', /^OPL7610/, '25'],
  ['manchon', 'pe-bouchon', 'Bouchon mâle', /^OPL7120/, '25'],
  ['manchon', 'pe-manchon-plass4', 'Manchon PLASS4', /^OD7701/, '25 x (15 - 22)'],
  ['te', 'pe-te-reparation', 'Té 90° de réparation', /^OPL7045/, '25 x 25 x 25'],
  ['te', 'pe-te-filete', 'Té 90° fileté', /^OPL7840/, '25 x 3/4" x 25'],
  ['te', 'pe-te-45', 'Té 45°', /^OPL7640/, '63 x 63 x 63'],
  ['te', 'pe-te-reduit', 'Té 90° réduit', /^OPL7340/, '25 x 20 x 25'],
  ['coude', 'pe-coude-90', 'Coude 90°', /^OPL7050/, '25 x 25'],
  ['coude', 'pe-coude-45', 'Coude 45°', /^OPL7460/, '32 x 32'],
  ['coude', 'pe-coude-filete', 'Coude fileté', /^OPL7850/, '25 x 3/4"'],
  ['bride', 'pe-raccord-bride', 'Raccord à bride', /^OPL7220/, '50 DN 40'],
  ['bride', 'pe-adaptateur-bride', 'Adaptateur à bride', /^OPL7236/, '50 DN 40'],
  ['bride', 'pe-set-reduction', 'Set de réduction', /^OPL7930/, '25 x 20'],
];
// Les formes sans photo en 25 gardent la photo de la première passe ; on dit ce qu'elle montre.
const ANCIENNES = {
  'pe-te-45': { taille: '63 x 63 x 63', doute: '' },
  'pe-adaptateur-bride': { taille: '75', doute: 'Aucune photo du 50 trouvée. Celle-ci montre un 75.' },
  'pe-set-reduction': { taille: '25 x 20', doute: 'Aucune photo de la bague seule trouvée. Elle est sur la photo, avec deux autres pièces.' },
  'pe-manchon-plass4': { taille: '32 x (27 - 35)', doute: 'Aucune photo du 25 trouvée. Celle-ci montre un 32.' },
};
const diam = (n) => (n.replace(/\d+°/g, '').replace(/PLASS4/, '').match(/\d+/) || [''])[0];
const neuf = JSON.parse(readFileSync(S + '/photos-pe-25/manifeste.json', 'utf8'));
const vieux = readdirSync(S + '/photos-pe').filter((f) => /\.jpe?g$|\.png$|\.webp$/i.test(f));
mkdirSync(S + '/valider-pe/photos/25', { recursive: true });
const photos = [];
for (const [groupe, cle, nom, motif, vise] of FORMES) {
  const refs = pe.filter((p) => motif.test(p.ref));
  const d = [...new Set(refs.map((p) => diam(p.nom)))].map(Number).sort((a, b) => a - b);
  const sert = refs.length > 1 ? 'Servira du ' + d[0] + ' au ' + d[d.length - 1] + ', ' + refs.length + ' références.' : 'Une seule référence.';
  const siens = neuf.filter((x) => x.ref === cle && x.fichier);
  if (siens.length) {
    siens.forEach((m, i) => {
      copyFileSync(S + '/photos-pe-25/' + m.fichier, S + '/valider-pe/photos/25/' + m.fichier);
      photos.push({ cle: cle + '-25-' + (i + 1), groupe, nom: nom + ' ' + m.taille, ref: sert, rang: i + 1, fichier: 'photos/25/' + m.fichier, site: m.site,
        doute: m.taille === vise ? '' : 'Photo en ' + m.taille + ', pas en ' + vise + '.' });
    });
  } else {
    const a = ANCIENNES[cle];
    vieux.filter((f) => f.replace(/-\d+\.\w+$/, '') === cle).sort().forEach((f, i) => {
      photos.push({ cle: f.replace(/\.\w+$/, ''), groupe, nom: nom + ' ' + a.taille, ref: sert, rang: i + 1, fichier: 'photos/' + f, site: '', doute: a.doute });
    });
  }
}
const t = readFileSync(S + '/valider-pe/modele.html', 'utf8').replace('/*PHOTOS*/[]', JSON.stringify(photos));
writeFileSync(S + '/valider-pe/photos-raccords-pe.html', t);
const garde = new Set(photos.map((p) => p.fichier));
const pub = {};
photos.forEach((p) => { pub[p.fichier] = 'valider-pe/' + p.fichier; });
readdirSync(S + '/valider-pe/photos').filter((f) => f.includes('.')).forEach((f) => { if (!garde.has('photos/' + f)) pub['photos/' + f] = null; });
writeFileSync(S + '/valider-pe/fichiers.json', JSON.stringify(pub, null, 1));
for (const p of photos) console.log(p.cle, '|', p.nom, '|', p.ref, '|', p.doute);
