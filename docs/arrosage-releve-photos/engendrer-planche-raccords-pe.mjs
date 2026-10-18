import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
const S = 'C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/4251adad-43ba-4fe8-814f-173f45a18fa4/scratchpad';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus';
const { CATALOGUE } = await import('file:///' + A + '/src/lib/arrosage/catalogue.js');
const pe = CATALOGUE.piecesAjoutables.filter((p) => p.categorie === 'raccord PE' && !/MILLENIUM/.test(p.nom));
// [groupe, clé, nom, motif des références qu'elle couvre]
const FORMES = [
  ['manchon', 'pe-manchon', 'Manchon', /^OPL7010/],
  ['manchon', 'pe-manchon-reduit', 'Manchon réduit', /^OPL7110/],
  ['manchon', 'pe-manchon-reparation', 'Manchon de réparation', /^OPL7610/],
  ['manchon', 'pe-bouchon', 'Bouchon mâle', /^OPL7120/],
  ['manchon', 'pe-manchon-plass4', 'Manchon PLASS4', /^OD7701/],
  ['te', 'pe-te-reparation', 'Té 90° de réparation', /^OPL7045/],
  ['te', 'pe-te-filete', 'Té 90° fileté', /^OPL7840/],
  ['te', 'pe-te-45', 'Té 45°', /^OPL7640/],
  ['te', 'pe-te-reduit', 'Té 90° réduit', /^OPL7340/],
  ['coude', 'pe-coude-90', 'Coude 90°', /^OPL7050/],
  ['coude', 'pe-coude-45', 'Coude 45°', /^OPL7460/],
  ['coude', 'pe-coude-filete', 'Coude fileté', /^OPL7850/],
  ['bride', 'pe-raccord-bride', 'Raccord à bride', /^OPL7220/],
  ['bride', 'pe-adaptateur-bride', 'Adaptateur à bride', /^OPL7236/],
  ['bride', 'pe-set-reduction', 'Set de réduction', /^OPL7930/],
];
const dossier = S + '/photos-pe';
const fichiers = existsSync(dossier) ? readdirSync(dossier).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)) : [];
const manifeste = existsSync(dossier + '/manifeste.json') ? JSON.parse(readFileSync(dossier + '/manifeste.json', 'utf8')) : [];
mkdirSync(S + '/valider-pe/photos', { recursive: true });
const photos = [];
for (const [groupe, cle, nom, motif] of FORMES) {
  const refs = pe.filter((p) => motif.test(p.ref));
  const diametres = [...new Set(refs.map((p) => p.nom.replace(/^\D*/, '').replace(/\s.*$/, '')))];
  const ref = refs.length + ' référence' + (refs.length > 1 ? 's' : '') + ', du ' + diametres[0] + ' au ' + diametres[diametres.length - 1];
  const siens = fichiers.filter((f) => f.replace(/-\d+\.\w+$/, '') === cle).sort();
  if (!siens.length) { const m = manifeste.find((x) => x.ref === cle) || {}; photos.push({ cle, groupe, ref, nom, fichier: null, doute: m.doute || '' }); continue; }
  siens.forEach((f, i) => {
    const m = manifeste.find((x) => x.fichier === f) || {};
    copyFileSync(dossier + '/' + f, S + '/valider-pe/photos/' + f);
    photos.push({ cle: f.replace(/\.\w+$/, ''), groupe, ref, nom, rang: i + 1, fichier: 'photos/' + f, site: m.site || '',
                  doute: (m.doute || '').replace(/\s*·\s*/g, '. ').replace(/\s+—\s+/g, ', ') });
  });
}
const t = readFileSync(S + '/valider-pe/modele.html', 'utf8').replace('/*PHOTOS*/[]', JSON.stringify(photos));
writeFileSync(S + '/valider-pe/photos-raccords-pe.html', t);
const pub = {}; photos.filter((p) => p.fichier).forEach((p) => { pub[p.fichier] = S + '/valider-pe/' + p.fichier; });
writeFileSync(S + '/valider-pe/fichiers.json', JSON.stringify(pub));
console.log(photos.filter((p) => p.fichier).length, 'photos,', photos.filter((p) => !p.fichier).length, 'à trouver');
