import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const S = 'C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/4251adad-43ba-4fe8-814f-173f45a18fa4/scratchpad';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus';
const { CATALOGUE } = await import('file:///' + A + '/src/lib/arrosage/catalogue.js');
const choix = JSON.parse(readFileSync(S + '/choix-pe.json', 'utf8'));
// Sa photo retenue par forme : la première qu'il a validée.
const RETENUE = {
  'pe-manchon': 'photos-pe-25/pe-manchon-1.jpg', 'pe-manchon-reduit': 'photos-pe-25/pe-manchon-reduit-1.jpg',
  'pe-manchon-reparation': 'photos-pe-25/pe-manchon-reparation-1.jpg', 'pe-bouchon': 'photos-pe-25/pe-bouchon-1.jpg',
  'pe-manchon-plass4': 'photos-pe/pe-manchon-plass4-1.jpg', 'pe-te-reparation': 'photos-pe-25/pe-te-reparation-1.jpg',
  'pe-te-filete': 'photos-pe-25/pe-te-filete-1.jpg', 'pe-te-45': 'photos-pe/pe-te-45-1.jpg', 'pe-te-reduit': 'photos-pe-25/pe-te-reduit-1.jpg',
  'pe-coude-90': 'photos-pe-25/pe-coude-90-1.jpg', 'pe-coude-45': 'photos-pe-25/pe-coude-45-1.jpg', 'pe-coude-filete': 'photos-pe-25/pe-coude-filete-1.jpg',
  'pe-raccord-bride': 'photos-pe-25/pe-raccord-bride-1.jpg', 'pe-adaptateur-bride': 'photos-pe/pe-adaptateur-bride-1.jpg',
  'pe-set-reduction': 'photos-pe/pe-set-reduction-1.jpg',
};
// La clé de la planche que la photo retenue porte : elle doit être un « oui ».
const CLE = (f) => f.split('/')[1].replace(/\.\w+$/, '').replace(/^(pe-.*)-(\d)$/, (m, a, b) => f.startsWith('photos-pe-25') ? a + '-25-' + b : m);
const MOTIF = { 'pe-manchon': /^OPL7010/, 'pe-manchon-reduit': /^OPL7110/, 'pe-manchon-reparation': /^OPL7610/, 'pe-bouchon': /^OPL7120/,
  'pe-manchon-plass4': /^OD7701/, 'pe-te-reparation': /^OPL7045/, 'pe-te-filete': /^OPL7840/, 'pe-te-45': /^OPL7640/, 'pe-te-reduit': /^OPL7340/,
  'pe-coude-90': /^OPL7050/, 'pe-coude-45': /^OPL7460/, 'pe-coude-filete': /^OPL7850/, 'pe-raccord-bride': /^OPL7220/,
  'pe-adaptateur-bride': /^OPL7236/, 'pe-set-reduction': /^OPL7930/ };
// Les cinq formes déjà validées sur la première planche (choix-du-patron.json).
const DEJA = [[/^OPL7040/, 'te-25-25-25.jpg'], [/^OPL7140/, 'te-taraude-25-34-25.jpg'], [/^OPL7150/, 'coude-taraude-25-34.jpg'],
  [/^OPL7020/, 'raccord-male25.jpg'], [/^OPL7030/, 'OPL70302520.jpg']];
const pe = CATALOGUE.piecesAjoutables.filter((p) => p.categorie === 'raccord PE' && !/MILLENIUM/.test(p.nom));
const ajout = {};
for (const [forme, f] of Object.entries(RETENUE)) {
  if (choix[CLE(f)] !== 'oui') throw new Error(forme + ' : la photo retenue ' + CLE(f) + ' n\'est pas un oui');
  const nom = forme + '.jpg';
  copyFileSync(S + '/' + f, A + '/appli/arrosage-photos/' + nom);
  pe.filter((p) => MOTIF[forme].test(p.ref)).forEach((p) => { ajout[p.ref] = nom; });
}
for (const [m, nom] of DEJA) pe.filter((p) => m.test(p.ref)).forEach((p) => { ajout[p.ref] = nom; });
const sans = pe.filter((p) => !ajout[p.ref]);
console.log(Object.keys(ajout).length, 'références avec photo ;', sans.length, 'sans :', sans.map((p) => p.ref + ' ' + p.nom).join(', '));
for (const page of ['appli/arrosage-plan.html', 'appli/arrosage-vue-eclatee.html']) {
  let t = readFileSync(A + '/' + page, 'utf8');
  const re = /var PHOTOS = (\{[^\n]*?\});/;
  const m = t.match(re); if (!m) throw new Error(page);
  const map = JSON.parse(m[1]);
  for (const [k, v] of Object.entries(ajout)) if (!(k in map)) map[k] = v;
  t = t.replace(re, 'var PHOTOS = ' + JSON.stringify(map) + ';');
  writeFileSync(A + '/' + page, t);
}
