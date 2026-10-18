// Engendre appli/arrosage-prix-fournisseurs.html : la planche des prix
// d'achat par fournisseur (sa demande du 18 octobre 2026). La liste du plan est
// celle que le calcul rend pour le jardin de la planche du plan ; aucun prix.
//   node docs/arrosage-releve-photos/engendrer-planche-prix-fournisseurs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus/';
const g = {};
new Function('window', readFileSync(A + 'appli/arrosage-plan-calcul.js', 'utf8') + ';this.C=CALCUL').call(g, g);
const C = g.C, CAT = C.CATALOGUE;
const p = C.calculerPlan({ seau: 10, temps: 18, pression: 3, compteur: 'oui', couronne: 50, sonde: false, zones: [
  { id: 1, type: 'gazon', nom: 'Pelouse arrière', x: 0, y: 0, L: 12, l: 12 },
  { id: 2, type: 'gazon', nom: 'Pelouse avant', x: 14, y: 0, L: 8, l: 8 },
  { id: 3, type: 'massif', nom: 'Massif', x: 14, y: 10, L: 20, l: 2.4, sortieGoutte: 'boucle' },
  { id: 4, type: 'gazon', nom: 'Couloir', x: 0, y: 14, L: 10, l: 2, materiel: 'tuyere' }] });
const d = C.dessinerPlan(p.dessin, { x: 13, y: 6 }, p.couleurs);
const lignes = C.piecesDuPlan(p.materiel, d.dessin, { compteur: true, seuil25: p.amenee.longueurMax25, amenee: null, goutte: p.goutteAGoutte, grillage: false });
const total = new Map();
for (const l of lignes) {
  // Les lignes de buse d'une turbine livrée avec ses buses ne s'achètent pas.
  if (/^RA3504-B/.test(l.ref) || !l.q) continue;
  const e = total.get(l.ref) || { cle: l.ref, ref: l.reference || (CAT.referenceDe && CAT.referenceDe(l.ref)) || null, nom: l.nom, q: 0, u: l.u };
  e.q += l.q;
  total.set(l.ref, e);
}
const PHOTOS = JSON.parse(readFileSync(A + 'appli/arrosage-plan.html', 'utf8').match(/var PHOTOS = (\{[^\n]*?\});/)[1]);
const t = readFileSync(A + 'docs/arrosage-releve-photos/modele-planche-prix-fournisseurs.html', 'utf8')
  .replace('/*PHOTOS*/{}', JSON.stringify(PHOTOS))
  .replace('/*LIGNES*/[]', JSON.stringify([...total.values()]));
writeFileSync(A + 'appli/arrosage-prix-fournisseurs.html', t);
console.log(total.size, 'lignes');
