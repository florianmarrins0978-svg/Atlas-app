// LES MATIÈRES DE LA PILE DU ROBINET : celles de la nourrice (nourrice-3d/matieres.js), telles quelles,
// et les quelques-unes que ses pièces à elle demandent. Elles prennent le grain des matières de la
// nourrice (leurs textures de relief et de rugosité), pour que les deux 3D aient la même main.
//
// Les teintes sont relevées sur ses photos du 22 novembre 2026 (docs/robinet-3d-photos/).

import * as THREE from "three";

export function ajouterMatieres(m) {
  var fin = m.noirLisse.bumpMap, moyen = m.noir.bumpMap;
  function plastique(couleur, rugosite, relief, texture, reflet, plus) {
    return new THREE.MeshPhysicalMaterial(Object.assign({ color: couleur, roughness: rugosite, metalness: 0, ior: 1.52, bumpMap: texture, bumpScale: relief * 0.06, envMapIntensity: reflet }, plus || {}));
  }
  // Un métal de fonderie : son grain se voit (le corps du robinet, celui de la double sortie sont
  // sablés, piqués), donc il porte un relief en plus de sa rugosité.
  // Le relief prend le grain FIN : sur un métal, le grain moyen faisait des taches sombres qui
  // scintillaient sous l'HDRI (essayé le 22 novembre 2026), loin du sablé régulier de ses photos.
  function metalBrut(couleur, rugosite, relief, reflet) {
    return new THREE.MeshPhysicalMaterial({ color: couleur, roughness: rugosite, metalness: 1, roughnessMap: fin, bumpMap: fin, bumpScale: relief * 0.06, envMapIntensity: reflet });
  }
  return Object.assign(m, {
    // Le vert du Solem BL-NR, son écrou d'entrée et la pièce de sa face : le vert sauge de sa photo
    // (98, 159, 122). Plus foncé, il sortait vert bouteille sous la courbe ACES (relevé à la revue).
    vert: plastique(0x6aa883, 0.5, 0.5, fin, 1.2, { clearcoat: 0.1, clearcoatRoughness: 0.5 }),
    // Le gris de la bague du raccord femelle Plasson 25 x 3/4" : un gris chaud, plus soutenu que la
    // bague blanc cassé du raccord mâle de la nourrice (le premier réglage sortait froid et sombre).
    grisPlasson: plastique(0xcac8c1, 0.5, 0.5, fin, 1),
    // Le corps de fonderie de son robinet, laiton brut sablé ; ses parties tournées restent `laiton`.
    laitonBrut: metalBrut(0xcfae66, 0.52, 0.7, 5),
    // Le corps de la double sortie : laiton nickelé, sablé, mat, d'un gris clair.
    nickelSable: metalBrut(0xd0cec8, 0.56, 0.6, 6),
    // CES DEUX-LÀ REMPLACENT celles de la nourrice, sur cette planche seulement (l'objet des matières
    // est neuf à chaque page). Le laiton tourné de ses photos est satiné et plus pâle que le laiton
    // miroir des raccords de la nourrice ; la pastille des manettes est jaune citron, pas olive.
    laiton: new THREE.MeshPhysicalMaterial({ color: 0xd9bb78, roughness: 0.4, metalness: 1, roughnessMap: fin, envMapIntensity: 4.2 }),
    jaune: plastique(0xf2e43a, 0.42, 0.2, fin, 1.3, { clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    // LES HUIT AUTRES COMBINAISONS (ses photos du 22 novembre 2026, docs/robinet-3d-photos/).
    // Le vert vif du Rain Bird, sa coque et son cadre.
    vertRainBird: plastique(0x21a058, 0.42, 0.4, fin, 1.2, { clearcoat: 0.2, clearcoatRoughness: 0.4 }),
    // Le vert sapin du Buddy, et le gris clair de sa face.
    vertBuddy: plastique(0x2f5d47, 0.45, 0.4, fin, 1.3, { clearcoat: 0.15, clearcoatRoughness: 0.45 }),
    grisBuddy: plastique(0xc7c8c3, 0.48, 0.4, fin, 1),
    // L'écran à cristaux liquides des deux : un gris verdâtre sous une vitre, sans chiffre (aucun
    // texte sur les pièces, comme la nourrice).
    ecran: plastique(0xa7ab9d, 0.6, 0.1, fin, 0.8, { clearcoat: 1, clearcoatRoughness: 0.08 }),
    // Le gris anthracite de l'embout Palaplast MID6362.
    grisPalaplast: plastique(0x4c4e51, 0.5, 0.5, fin, 2.2)
  });
}
