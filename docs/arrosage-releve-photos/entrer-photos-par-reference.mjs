// Une pièce de nourrice dont la photo est déjà validée porte la même photo dans
// la liste des pièces : même pièce, même référence Aqua Plus (18 octobre 2026).
import { readFileSync, writeFileSync } from 'node:fs';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus';
const t = readFileSync(A + '/src/lib/arrosage/catalogue.js', 'utf8');
const par = {};
for (const m of t.matchAll(/'([a-z0-9-]+)': *\{[^}]*aquaplus:'([A-Z0-9_]+)'/g)) par[m[2]] ??= m[1];
// Les BL-IP n'ont pas de référence dans la fiche : leur nom Aqua Plus est le même.
Object.assign(par, { SP1721: 'prog-1', SP1722: 'prog-2', SP1724: 'prog-4', SP1726: 'prog-6' });
for (const page of ['appli/arrosage-plan.html', 'appli/arrosage-vue-eclatee.html']) {
  let h = readFileSync(A + '/' + page, 'utf8');
  const re = /var PHOTOS = (\{[^\n]*?\});/;
  const map = JSON.parse(h.match(re)[1]);
  const ajout = [];
  for (const [ref, cle] of Object.entries(par)) if (!map[ref] && map[cle]) { map[ref] = map[cle]; ajout.push(ref + '=' + map[cle]); }
  writeFileSync(A + '/' + page, h.replace(re, 'var PHOTOS = ' + JSON.stringify(map) + ';'));
  console.log(page, ajout.length, ajout.join(' '));
}
