/* =======================================================================
   Le paraphe « Lemaire » du site de vente : quatre traits, un par levée de
   plume (le L, « emaire » et son trait de sortie, le point du i, le
   soulignement), dessinés pour le film du 18 novembre 2026, puis penchés
   comme une main qui va vite. Il ne dit rien de plus qu'un paraphe.

   Ici ils deviennent des points, pour être tracés à la souris sur la vraie
   toile de l'appli (tourner-signature.mjs).
   ======================================================================= */
const TRAITS = [
  'M74 46C69 33 54 32 55 49C56 68 66 88 60 104C56 115 41 114 40 103C40 94 52 93 65 100C78 107 91 106 101 98',
  'M101 98C109 92 113 82 107 80C100 78 97 92 103 99C109 105 119 100 123 92C125 86 129 84 131 90L132 101C133 90 139 84 143 90L144 101C145 90 151 84 155 90C157 96 157 102 161 101C171 100 175 86 167 84C159 82 155 96 163 100C169 103 175 94 177 88L178 98C179 103 184 101 187 96L191 86L192 98C193 103 198 101 201 96L205 86C209 82 213 90 219 86L220 98C222 104 233 100 237 92C239 86 233 82 229 88C225 96 233 104 245 101C263 96 281 80 301 62',
  'M191 75L192.500 76.500',
  'M38 126C110 115 212 113 308 121',
];
const PENCHE = Math.tan(-11 * Math.PI / 180), DECALE = 19.4;
/**
 * Dans la page : chaque trait devient une fonction « part de sa longueur, point de la toile »
 * (window.PARAPHE.point), à l'échelle et au décalage voulus. Rend les longueurs des traits, et
 * la part du deuxième trait où finissent les lettres et où commence le trait de sortie.
 */
async function poserLeParaphe(page, { echelle = 1, dx = 0, dy = 0 } = {}) {
  await page.evaluate(({ TRAITS, PENCHE, DECALE, echelle, dx, dy }) => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden'); document.body.appendChild(svg);
    const chemins = TRAITS.map((d) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.appendChild(p); return p; });
    const longueurs = chemins.map((p) => p.getTotalLength());
    const lettres = document.createElementNS(NS, 'path'); lettres.setAttribute('d', TRAITS[1].slice(0, TRAITS[1].lastIndexOf('C'))); svg.appendChild(lettres);
    window.PARAPHE = { longueurs, sortieDuTrait2: lettres.getTotalLength() / longueurs[1], outil: svg, point(i, part) { const q = chemins[i].getPointAtLength(longueurs[i] * part); return [(q.x + PENCHE * q.y + DECALE) * echelle + dx, q.y * echelle + dy]; } };
  }, { TRAITS, PENCHE, DECALE, echelle, dx, dy });
  return page.evaluate(() => ({ longueurs: window.PARAPHE.longueurs, sortieDuTrait2: window.PARAPHE.sortieDuTrait2 }));
}
module.exports = { TRAITS, poserLeParaphe };
