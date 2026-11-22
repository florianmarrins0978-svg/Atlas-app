// LES MATIÈRES DE LA NOURRICE EN 3D. Des matières physiques : la lumière y répond comme sur la pièce
// (un PVC satiné ne brille pas comme un laiton), et chacune porte un grain très fin, sans quoi une
// surface parfaitement lisse fait image de synthèse.
//
// Les teintes sont relevées sur ses photos (appli/arrosage-photos/, suffixe « -dessus ») : le PVC gris
// clair qu'il a gardé pour ses images (médiane 141, 143, 149), le noir des électrovannes, le blanc cassé
// de la bague Plasson, le rouge de la manette.

import * as THREE from "three";

// Un grain : du bruit doux, qui se répète sans raccord. `taille` règle sa finesse (en points de bruit
// par carreau), `graine` le rend différent d'une matière à l'autre.
function grain(taille, graine) {
  var n = 128, d = new Uint8Array(n * n * 4), g = taille, v = new Float32Array(g * g), s = graine || 1;
  function hasard() { s = (s * 16807) % 2147483647; return s / 2147483647; }
  for (var i = 0; i < g * g; i++) v[i] = hasard();
  function lisse(t) { return t * t * (3 - 2 * t); }
  for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
    var fx = x / n * g, fy = y / n * g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = lisse(fx - x0), ty = lisse(fy - y0);
    var a = v[(y0 % g) * g + x0 % g], b = v[(y0 % g) * g + (x0 + 1) % g], c = v[((y0 + 1) % g) * g + x0 % g], e = v[((y0 + 1) % g) * g + (x0 + 1) % g];
    var h = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty, o = (y * n + x) * 4, k = Math.round(h * 255);
    d[o] = k; d[o + 1] = k; d[o + 2] = k; d[o + 3] = 255;
  }
  var t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

// La force du relief d'un grain : très peu, il doit se deviner dans les reflets, pas se voir.
var RELIEF = 0.06;

export function creerMatieres() {
  var fin = grain(64, 7), moyen = grain(24, 31);
  // `reflet` : la part de l'ambiance qu'une matière renvoie. Le studio de l'HDRI est sombre autour de
  // ses deux sources ; réglé pour que le PVC gris reste gris, il laissait les noirs sans un reflet et
  // le nickel presque noir. Un noir et un métal prennent donc plus de l'ambiance qu'un gris clair.
  function plastique(couleur, rugosite, relief, texture, reflet, plus) {
    return new THREE.MeshPhysicalMaterial(Object.assign({ color: couleur, roughness: rugosite, metalness: 0, ior: 1.52, bumpMap: texture || fin, bumpScale: relief * RELIEF, envMapIntensity: reflet || 1 }, plus || {}));
  }
  // Un métal : son grain est dans sa rugosité (des reflets qui frémissent), pas dans un relief, qui
  // dessinait un quadrillage sur les plats d'un six pans.
  function metal(couleur, rugosite, reflet) {
    return new THREE.MeshPhysicalMaterial({ color: couleur, roughness: rugosite, metalness: 1, roughnessMap: fin, envMapIntensity: reflet });
  }
  return {
    // Le PVC gris clair des pièces Dura : légèrement satiné.
    pvc: plastique(0xa1a09f, 0.4, 0.5, fin, 1, { clearcoat: 0.12, clearcoatRoughness: 0.5 }),
    // Le joint qu'on voit entre un écrou union et son corps.
    joint: plastique(0x18191a, 0.75, 0.3, fin, 2),
    // Le plastique noir mat chargé de verre des électrovannes et du régulateur : un grain plus marqué.
    noir: plastique(0x2b2c2e, 0.55, 1.1, moyen, 3),
    // Le corps noir du raccord Plasson : un polypropylène plus lisse.
    noirLisse: plastique(0x222325, 0.4, 0.4, fin, 3),
    // Sa bague, d'un blanc cassé.
    blanc: plastique(0xdcdcd8, 0.5, 0.5, fin, 0.9),
    laiton: metal(0xc8a55a, 0.34, 5),
    // Le laiton nickelé du corps de la vanne (sa photo : un corps satiné, argenté).
    nickel: metal(0xc9c6bd, 0.42, 6),
    inox: metal(0xd2d4d6, 0.3, 5),
    // Le chrome mat de la tige et de la clé de purge.
    acier: metal(0xb9bcc0, 0.36, 5),
    // La manette de la vanne : une gaine rouge brillante.
    rouge: plastique(0xc4161c, 0.32, 0.25, fin, 1.6, { clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    // La pastille rouge du dessus de la bobine 9V.
    rougeBobine: plastique(0xc8283a, 0.5, 0.4, fin, 1.4),
    jaune: plastique(0xe4c41c, 0.55, 0.2, fin, 1.2),
    filRouge: plastique(0xc4161c, 0.4, 0.15, fin, 1.6),
    filNoir: plastique(0x121212, 0.45, 0.15, fin, 3),
    cuivre: metal(0xc87a50, 0.4, 5),
    // Le PEHD : un noir mat, ses bandes bleues.
    pehd: plastique(0x1c1d1f, 0.6, 0.6, moyen, 1.8),
    bleu: plastique(0x1565c0, 0.5, 0.4, fin, 1.2),
    // Le fond d'une empreinte, d'un trou : un noir qui ne renvoie rien.
    creux: new THREE.MeshPhysicalMaterial({ color: 0x08080a, roughness: 0.95, metalness: 0 })
  };
}
