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
    // Le vert du Solem BL-NR : son écrou d'entrée et la pièce de sa face.
    vert: plastique(0x3d9a5e, 0.48, 0.5, fin, 1.3, { clearcoat: 0.1, clearcoatRoughness: 0.5 }),
    // Le gris de la bague du raccord femelle Plasson 25 x 3/4" (sa photo : plus soutenu que la bague
    // blanc cassé du raccord mâle de la nourrice).
    grisPlasson: plastique(0xbcbdba, 0.5, 0.5, fin, 1),
    // Le corps de fonderie de son robinet, laiton brut sablé ; ses parties tournées restent `laiton`.
    laitonBrut: metalBrut(0xc6a14f, 0.5, 0.9, 5),
    // Le corps de la double sortie : laiton nickelé, sablé, mat.
    nickelSable: metalBrut(0xc4c2bb, 0.52, 1, 6)
  });
}
