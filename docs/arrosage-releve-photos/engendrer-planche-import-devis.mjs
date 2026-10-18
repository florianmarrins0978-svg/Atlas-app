// Engendre appli/arrosage-import-devis.html : la planche « importer un devis
// fournisseur » (sa demande du 17 octobre 2026). Le devis d'exemple est la liste
// que le calcul rend pour le jardin de la planche du plan ; rien n'y est écrit à
// la main, sauf la ligne de frais de port, qui montre une ligne hors catalogue.
//   node docs/arrosage-releve-photos/engendrer-planche-import-devis.mjs <modèle.html>
import { readFileSync, writeFileSync } from 'node:fs';
const A = 'C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus/';
const modele = process.argv[2];
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
// Ce qui se pose dans le regard : la nourrice que le devis permet.
const NOURRICE = new Set(['clarinette-2v', 'clarinette-3v', 'clarinette-4v', 'union', 'electrovanne-100dv', 'electrovanne-100dv-ff', 'raccord-male25',
  'coude-ff', 'coude-mf', 'mamelon', 'mamelon-droit-1', 'vanne-purge', 'regulateur-ff34', 'te-mmf']);
const total = new Map();
for (const l of lignes) {
  // Les lignes de buse d'une turbine livrée avec ses buses ne s'achètent pas.
  if (/^RA3504-B/.test(l.ref) || !l.q) continue;
  const e = total.get(l.ref) || { cle: l.ref, ref: l.reference || (CAT.referenceDe && CAT.referenceDe(l.ref)) || null, nom: l.nom, q: 0, u: l.u, nourrice: NOURRICE.has(l.ref) };
  e.q += l.q;
  total.set(l.ref, e);
}
// Un devis de fournisseur oublie des pièces : on retire le coude FF et deux
// unions, pour montrer ce que la nourrice grise (sa demande du 18 octobre 2026).
total.delete('coude-ff');
if (total.get('union')) total.get('union').q -= 2;
const devis = [...total.values()].map((e) => ({ ...e, nomCourt: e.nom.replace(/^(Dura|Plasson|Rain Bird|Solem) /, '') }));
devis.push({ cle: null, lu: 'Participation aux frais de port', q: 1, u: 'u' });
const PHOTOS = JSON.parse(readFileSync(A + 'appli/arrosage-plan.html', 'utf8').match(/var PHOTOS = (\{[^\n]*?\});/)[1]);
const liste = CAT.piecesAjoutables.map((x) => ({ ref: x.ref, nom: x.nom }));
const t = readFileSync(modele, 'utf8')
  .replace('/*PHOTOS*/{}', JSON.stringify(PHOTOS))
  .replace('/*DEVIS*/[]', JSON.stringify(devis))
  .replace('/*CATALOGUE*/[]', JSON.stringify(liste));
writeFileSync(A + 'appli/arrosage-import-devis.html', t);
console.log(devis.length, 'lignes ;', p.secteurs.length, 'réseaux');
