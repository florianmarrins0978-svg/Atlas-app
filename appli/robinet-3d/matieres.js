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
    // LES HUIT AUTRES COMBINAISONS (ses photos du 22 novembre 2026, docs/robinet-3d-photos/). Les
    // premières teintes, prises telles quelles sur les photos, sortaient deux à trois fois trop sombres
    // sous l'éclairage de la scène (relevé par les revues, pixel à pixel) : elles sont réglées sur le
    // RENDU, comparé à la photo, et non sur la seule photo.
    // Le vert vif du Rain Bird, sa coque.
    vertRainBird: plastique(0x3aad6e, 0.42, 0.4, fin, 1.7, { clearcoat: 0.2, clearcoatRoughness: 0.4 }),
    // Le vert sapin du Buddy, et le gris clair de sa face et de ses boutons.
    vertBuddy: plastique(0x30594a, 0.5, 0.4, fin, 2.2, { clearcoat: 0.15, clearcoatRoughness: 0.45 }),
    grisBuddy: plastique(0xe2e2dc, 0.46, 0.4, fin, 1.7),
    // L'écran à cristaux liquides des deux : un gris clair un peu vert sous une vitre, sans chiffre
    // (aucun texte sur les pièces, comme la nourrice).
    ecran: plastique(0xc4c8bb, 0.6, 0.1, fin, 1.3, { clearcoat: 1, clearcoatRoughness: 0.08 }),
    // Le jonc argenté du Rain Bird, autour de son cadran et de son écran : un plastique peint, satiné.
    // L'inox et l'acier de la nourrice y sortaient sombres et grenus.
    argent: new THREE.MeshPhysicalMaterial({ color: 0xdfe1e3, roughness: 0.32, metalness: 0.65, roughnessMap: fin, envMapIntensity: 3.2, clearcoat: 0.3, clearcoatRoughness: 0.2 }),
    // Le blanc des cadrans (leur secteur, leurs filets) : celui de la nourrice sortait gris clair.
    // Il ne sert, sur cette planche, qu'aux cadrans du Rain Bird et du Buddy.
    blanc: plastique(0xf1f1ec, 0.42, 0.3, fin, 1.8),
    // Le gris anthracite de l'embout Palaplast MID6362 (sa photo : 47, 49, 54 au milieu du corps). Plus
    // clair, il sortait gris souris dans l'éclaté ; plus bleu, froid à côté de la photo.
    grisPalaplast: plastique(0x4a4a4d, 0.5, 0.5, fin, 2.2)
  });
}
