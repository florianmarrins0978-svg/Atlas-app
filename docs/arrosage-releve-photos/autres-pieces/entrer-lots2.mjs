// Ses choix sur la dernière planche (18 octobre 2026) : chaque photo validée va à
// toutes les références de sa forme ; les électrovannes ont déjà la leur.
import { readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
const S = 'C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/4251adad-43ba-4fe8-814f-173f45a18fa4/scratchpad';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus/';
const choix = {};
for (const f of readdirSync(S + '/choix-lots2/choix')) { const d = JSON.parse(readFileSync(S + '/choix-lots2/choix/' + f, 'utf8')); choix[d.id || f.replace('.json', '')] = (d.data || d).choix; }
console.log('oui', Object.values(choix).filter((v) => v === 'oui').length, 'non', Object.values(choix).filter((v) => v === 'non').length);
const ajout = {};
for (const lot of ['E', 'F']) {
  const pieces = JSON.parse(readFileSync(S + '/photos-lot-' + lot + '/pieces.json', 'utf8'));
  const cat = Object.fromEntries(pieces.map((p) => [p.ref, p.categorie]));
  for (const m of JSON.parse(readFileSync(S + '/photos-lot-' + lot + '/manifeste.json', 'utf8'))) {
    if (!m.fichier || cat[m.refs[0]] === 'electrovanne') continue;
    if (choix[lot + '-' + m.fichier.replace(/\.\w+$/, '')] !== 'oui') continue;
    const nom = m.fichier.replace(/-\d+(\.\w+)$/, '$1');
    copyFileSync(S + '/photos-lot-' + lot + '/' + m.fichier, A + 'appli/arrosage-photos/' + nom);
    for (const r of m.refs) ajout[r] ??= nom;
  }
}
for (const page of ['appli/arrosage-plan.html', 'appli/arrosage-vue-eclatee.html']) {
  const h = readFileSync(A + page, 'utf8');
  const re = /var PHOTOS = (\{[^\n]*?\});/;
  const map = JSON.parse(h.match(re)[1]);
  let n = 0;
  for (const [r, v] of Object.entries(ajout)) if (!map[r]) { map[r] = v; n++; }
  writeFileSync(A + page, h.replace(re, 'var PHOTOS = ' + JSON.stringify(map) + ';'));
  console.log(page, n, 'photos entrées');
}
writeFileSync(A + 'docs/arrosage-releve-photos/autres-pieces/choix-dernieres-pieces.json', JSON.stringify(choix, null, 1));
