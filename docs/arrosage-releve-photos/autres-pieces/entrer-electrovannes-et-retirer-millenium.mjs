// Sa décision du 18 octobre 2026 au soir : le té égal Millenium (75, 110) et
// l'adaptateur à bride Millenium partent ; les électrovannes prennent les photos
// trouvées, « ça suffira ».
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const S = 'C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/4251adad-43ba-4fe8-814f-173f45a18fa4/scratchpad';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus/';
const RETIRER = ['OPL704075', 'OPL7040110', 'OPL72367560', 'OPL72367580', 'OPL72369060', 'OPL72369080'];
for (const f of ['src/lib/arrosage/catalogue.js', 'appli/arrosage-catalogue.js', 'appli/arrosage-plan-calcul.js', 'appli/arrosage-planche-calcul.js', 'appli/arrosage-schema-calcul.js']) {
  const t = readFileSync(A + f, 'utf8');
  const fin = t.includes('\r\n') ? '\r\n' : '\n';
  const L = t.split(fin);
  const debut = L.findIndex((l) => /^\s*piecesAjoutables: \[/.test(l));
  const r = L.filter((l, i) => i <= debut || !RETIRER.some((ref) => l.includes("{ ref:'" + ref + "'") || l.includes('{ ref: "' + ref + '"')));
  writeFileSync(A + f, r.join(fin));
  console.log(f, L.length - r.length, 'lignes retirées');
}
// La photo trouvée, par référence ; pour le Richdel 9 V et la PGV JT 9 V, rien
// d'autre n'existe que la photo du même corps qu'il a validée.
const E = 'photos-lot-E/';
const PAR = {
  TEVEZP0354: E + 'ev-toro-ezflo-ff-24v-1.jpg', TEVEZP2254: E + 'ev-toro-ezflo-mm-rmd-24v-1.jpg', TEVEZP2354: E + 'ev-toro-ezflo-ff-rmd-24v-1.jpg',
  TEVEZP02649V: E + 'ev-toro-ezflo-mm-9v-1.jpg', TEVTPV100MMBSP: E + 'ev-toro-tpv-mm-1.jpg', TEVP2202354: E + 'ev-toro-p220-1po-1.jpg',
  TEVP2202356: E + 'ev-toro-p220-1po12-1.jpg', TEVP2202358: E + 'ev-toro-p220-2po-1.png', TEVP2202350: E + 'ev-toro-p220-3po-1.jpg',
  REV75DV9V: E + 'ev-rb-75dv-ff-9v-1.jpg', REVPGA1009V: E + 'ev-rb-pga-9v-1.jpg', REVPGA1509V: E + 'ev-rb-pga-9v-1.jpg',
  RPJVP300: E + 'solenoide-rb-9v-lu3100-2.jpg',
};
const ajout = {};
for (const [ref, src] of Object.entries(PAR)) { const nom = src.split('/')[1].replace(/-\d+(\.\w+)$/, '$1'); copyFileSync(S + '/' + src, A + 'appli/arrosage-photos/' + nom); ajout[ref] = nom; }
ajout.AEV1205 = 'ev-richdel-2400mt-ff-24v.png';
ajout.HEV1724 = 'ev-hunter-pgv100jt-ff-9v.png';
for (const page of ['appli/arrosage-plan.html', 'appli/arrosage-vue-eclatee.html']) {
  const h = readFileSync(A + page, 'utf8');
  const re = /var PHOTOS = (\{[^\n]*?\});/;
  const map = JSON.parse(h.match(re)[1]);
  Object.assign(map, ajout);
  writeFileSync(A + page, h.replace(re, 'var PHOTOS = ' + JSON.stringify(map) + ';'));
}
console.log(Object.keys(ajout).length, 'électrovannes avec photo');
