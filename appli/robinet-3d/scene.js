// LA SCÈNE DE LA PILE DU ROBINET : celle de la nourrice (nourrice-3d/scene.js), la pile DEBOUT, et sans
// ombres.
//
// POURQUOI UNE SCÈNE À ELLE. La nourrice est couchée dans son regard : sa scène pose chaque pièce dans le
// plan du sol, et le doigt tourne autour de la verticale. Une pile qui pend d'un robinet, couchée là, se
// tournait comme une aiguille de montre sous le doigt (le glissé faisait pivoter l'image dans son plan),
// et son dos ne se voyait jamais (essayé le 22 novembre 2026). Il faut donc que la pile soit debout dans
// la scène, et que l'éclaté la parcoure de haut en bas : la scène de la nourrice ne sait ni l'un ni
// l'autre, et c'est celle de l'écran du plan, qu'une planche n'a pas à changer.
//
// CE QUI EST REPRIS TEL QUEL : l'HDRI (et la pièce calculée qui l'attend), l'occlusion ambiante, la
// courbe ACES, l'anticrénelage, le cadrage par les coins des pièces, les mouvements qui s'interrompent,
// la qualité qui baisse le temps d'un mouvement, le toucher à un doigt près. CE QUI CHANGE : chaque pièce
// est redressée (son axe Z descend), l'éclaté court sur la verticale, les deux points de vue sont ceux
// d'une pile, et il n'y a pas d'ombres (sa demande du 22 novembre 2026 : « l'éclaté sans ombre »).
//
// Retenue, la pile debout deviendra une option de nourrice-3d/scene.js, et ce fichier disparaîtra.

import * as THREE from "three";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { RoomEnvironment } from "../vendor/three/RoomEnvironment.js";
import { EXRLoader } from "../vendor/three/loaders/EXRLoader.js";
import { EffectComposer } from "../vendor/three/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/postprocessing/RenderPass.js";
import { GTAOPass } from "../vendor/three/postprocessing/GTAOPass.js";
import { OutputPass } from "../vendor/three/postprocessing/OutputPass.js";
import { place } from "../nourrice-3d/composition.js";

// D'où l'on regarde le centre de la pile. De face : un rien au-dessus, comme on se tient devant un
// robinet. De biais : de trois quarts, à droite et au-dessus, pour voir les volumes.
var VUES = { face: [0, 0.1, 1], biais: [0.82, 0.48, 0.95] };
var DUREE = 0.6;   // l'éclaté : environ 0,6 s, comme la nourrice

function douceur(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function arrivee(t) { return 1 - Math.pow(1 - t, 4); }

// LE REDRESSEMENT : l'axe Z d'une pièce (du robinet vers le tuyau) devient le bas de la scène, et son
// +Y (ce qui fait face) vient vers celui qui regarde de face.
var REDRESSE = new THREE.Matrix4().makeRotationX(Math.PI / 2);

export function creerScene(toile, o) {
  o = o || {};
  var matieres = o.matieres, fond = new THREE.Color(o.fond != null ? o.fond : 0xdcd9d2);
  var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: false, powerPreference: "high-performance" });
  if (!rendu.capabilities.isWebGL2) { rendu.dispose(); throw new Error("WebGL 2 absent"); }
  rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = o.exposition || 1;

  var scene = new THREE.Scene(); scene.background = fond;
  var racine = new THREE.Group(); scene.add(racine);
  var camera = new THREE.PerspectiveCamera(26, 1, 40, 12000);

  // LA LUMIÈRE D'AMBIANCE, comme la nourrice : la pièce calculée tout de suite, l'HDRI dès qu'elle arrive.
  var pmrem = new THREE.PMREMGenerator(rendu);
  var ambiance = "piece";
  function eclairer(ok) {
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; ambiance = "piece";
    if (!o.hdri) { ok(ambiance); return; }
    new EXRLoader().load(o.hdri, function (texture) {
      var boule = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, toneMapped: false }));
      boule.material.color.setScalar(o.forceAmbiance != null ? o.forceAmbiance : 0.2); boule.rotation.y = o.rotationAmbiance != null ? o.rotationAmbiance : -1.8;
      var studio = new THREE.Scene(); studio.add(boule);
      var ancienne = scene.environment; scene.environment = pmrem.fromScene(studio, 0, 1, 2000).texture;
      ancienne.dispose(); texture.dispose(); boule.geometry.dispose(); boule.material.dispose(); ambiance = "hdri"; demander(); ok(ambiance);
    }, undefined, function () { ok(ambiance); });
  }
  var pret = new Promise(eclairer);
  // Le contexte perdu (un onglet laissé en arrière-plan sur un téléphone) : l'ambiance filtrée est à refaire.
  toile.addEventListener("webglcontextlost", function (e) { e.preventDefault(); });
  toile.addEventListener("webglcontextrestored", function () { eclairer(function () {}); qualite.enCours = -1; demander(); });

  // LA LAMPE donne le sens de la lumière, d'en haut et de l'avant gauche ; elle ne porte pas d'ombre.
  var lampe = new THREE.DirectionalLight(0xfff4e6, o.lampe != null ? o.lampe : 0.5);
  scene.add(lampe); scene.add(lampe.target);
  var contre = new THREE.DirectionalLight(0xfff1e0, o.contre != null ? o.contre : 0.25); scene.add(contre); scene.add(contre.target);

  // LA COMPOSITION DE L'IMAGE : le rendu, l'occlusion ambiante, puis la courbe ACES et l'écran.
  var cible = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  var composition = new EffectComposer(rendu, cible);
  composition.addPass(new RenderPass(scene, camera));
  var ao = new GTAOPass(scene, camera, 1, 1, {});
  ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = o.occlusion != null ? o.occlusion : 1;
  ao.updateGtaoMaterial({ radius: 13, distanceExponent: 1.4, thickness: 1.6, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1.5, rings: 2, samples: 12 });
  composition.addPass(ao);
  composition.addPass(new OutputPass());

  // LE DOIGT TOURNE AUTOUR DE LA PILE. On peut la regarder d'en dessous (le passage du nez, la bouche du
  // raccord), mais pas passer par-dessus ni par-dessous, où la vue se retournerait.
  var commandes = new OrbitControls(camera, toile);
  commandes.enableDamping = true; commandes.dampingFactor = 0.1; commandes.rotateSpeed = 0.9; commandes.zoomSpeed = 0.9;
  commandes.minPolarAngle = 0.12; commandes.maxPolarAngle = Math.PI - 0.12; commandes.screenSpacePanning = true;

  // LES PIÈCES, EN INSTANCES, comme la nourrice.
  var etat = { compo: null, definitions: null, t: 0, vue: "face", lots: [], boite: new THREE.Box3() };
  var M = new THREE.Matrix4(), T = new THREE.Matrix4();
  // La pile n'a pas de pièce retournée bout pour bout : la pose n'en porte jamais (robinet-3d/composition.js).
  function matrice(pose, t, sortie) {
    var p = place(pose, t);
    return sortie.makeTranslation(p[0], -p[1], 0).multiply(REDRESSE);
  }
  function poser(compo, definitions) {
    etat.lots.forEach(function (l) { racine.remove(l.maille); l.maille.dispose(); });
    etat.lots = []; etat.compo = compo; etat.definitions = definitions;
    if (mouvement && mouvement.pieces) mouvement.libre = true;
    var parCle = {};
    compo.pieces.forEach(function (p) { (parCle[p.cle] = parCle[p.cle] || []).push(p); });
    Object.keys(parCle).forEach(function (cle) {
      var d = etat.definitions[cle], poses = parCle[cle];
      d.couches.forEach(function (c) {
        var m = new THREE.InstancedMesh(c.geometrie, matieres[c.matiere] || matieres.pvc, poses.length);
        m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        racine.add(m); etat.lots.push({ maille: m, poses: poses, cle: cle });
      });
    });
    regler(etat.t);
  }
  var boitePiece = new THREE.Box3();
  function boiteA(t, sortie) {
    sortie.makeEmpty();
    etat.compo.pieces.forEach(function (p) {
      matrice(p, t, T);
      etat.definitions[p.cle].couches.forEach(function (c) { boitePiece.copy(c.geometrie.boundingBox).applyMatrix4(T); sortie.union(boitePiece); });
    });
    return sortie;
  }
  function regler(t) {
    etat.t = t;
    etat.lots.forEach(function (l) {
      l.poses.forEach(function (p, i) { l.maille.setMatrixAt(i, matrice(p, t, M)); });
      l.maille.instanceMatrix.needsUpdate = true;
    });
    boiteA(t, etat.boite);
    // La lampe suit la pile : d'en haut, de l'avant gauche ; le contre-jour de l'arrière droite.
    var c = etat.boite.getCenter(new THREE.Vector3()), s = etat.boite.getSize(new THREE.Vector3()), e = s.length() / 2 + 60;
    lampe.position.set(c.x - e * 0.55, c.y + e * 1.3, c.z + e * 1.1); lampe.target.position.copy(c);
    contre.position.set(c.x + e, c.y + e * 0.4, c.z - e); contre.target.position.copy(c);
    demander();
  }

  // CADRER : toute la pile dans l'image, le plus grand possible, depuis une direction donnée.
  function cadrage(direction, t, sortie) {
    var b = boiteA(t, new THREE.Box3()), c = b.getCenter(new THREE.Vector3()), d = b.getSize(new THREE.Vector3()).length() * 1.6;
    var coins = [], essai = camera.clone(), q = new THREE.Vector3(), droite = new THREE.Vector3(), haut = new THREE.Vector3();
    etat.compo.pieces.forEach(function (p) {
      matrice(p, t, T);
      etat.definitions[p.cle].couches.forEach(function (co) {
        var bb = co.geometrie.boundingBox;
        [bb.min.x, bb.max.x].forEach(function (x) { [bb.min.y, bb.max.y].forEach(function (y) { [bb.min.z, bb.max.z].forEach(function (z) { coins.push(new THREE.Vector3(x, y, z).applyMatrix4(T)); }); }); });
      });
    });
    var demi = Math.tan(camera.fov * Math.PI / 360);
    for (var k = 0; k < 8; k++) {
      essai.position.copy(c).addScaledVector(direction, d); essai.up.set(0, 1, 0); essai.lookAt(c); essai.updateMatrixWorld(); essai.updateProjectionMatrix();
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      coins.forEach(function (p) { q.copy(p).project(essai); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
      droite.setFromMatrixColumn(essai.matrixWorld, 0); haut.setFromMatrixColumn(essai.matrixWorld, 1);
      c.addScaledVector(droite, (x0 + x1) / 2 * d * demi * essai.aspect).addScaledVector(haut, (y0 + y1) / 2 * d * demi);
      d *= Math.max((x1 - x0) / 2, (y1 - y0) / 2) / 0.9;
    }
    sortie.cible.copy(c); sortie.distance = d;
    return sortie;
  }
  function directionActuelle() { return camera.position.clone().sub(commandes.target).normalize(); }
  function placerCamera(direction, c) {
    camera.position.copy(c.cible).addScaledVector(direction, c.distance); camera.up.set(0, 1, 0); camera.lookAt(c.cible);
    commandes.target.copy(c.cible); commandes.minDistance = c.distance * 0.12; commandes.maxDistance = c.distance * 2.2;
    camera.near = Math.max(5, c.distance * 0.02); camera.far = c.distance * 6 + 4000; camera.updateProjectionMatrix();
  }

  // LES MOUVEMENTS, un seul à la fois : l'éclaté, ou un changement de point de vue.
  var mouvement = null;
  function lancer(duree, pas, pieces) {
    mouvement = { debut: performance.now(), duree: duree * 1000, pas: pas, pieces: !!pieces, libre: false };
    if (pieces) etat.dureeEclate = mouvement.duree;
    if (reduit || duree <= 0) { var m = mouvement; mouvement = null; m.pas(1, m); }
    demander();
  }
  function eclater(cibleT) {
    var t0 = etat.t, dir = directionActuelle(), c0 = { cible: commandes.target.clone(), distance: camera.position.distanceTo(commandes.target) };
    var c1 = cadrage(dir, cibleT, { cible: new THREE.Vector3(), distance: 1 }), c = { cible: new THREE.Vector3(), distance: 1 };
    etat.cibleT = cibleT;
    lancer(DUREE * Math.abs(cibleT - t0), function (u, m) {
      var k = douceur(u); regler(t0 + (cibleT - t0) * k);
      if (m.libre) return;
      c.cible.lerpVectors(c0.cible, c1.cible, k); c.distance = c0.distance + (c1.distance - c0.distance) * k; placerCamera(dir, c);
    }, true);
  }
  function regarder(vue, anime) {
    etat.vue = vue;
    var dir1 = new THREE.Vector3().fromArray(VUES[vue]).normalize(), t = etat.cibleT != null ? etat.cibleT : etat.t;
    var c1 = cadrage(dir1, t, { cible: new THREE.Vector3(), distance: 1 });
    if (!anime) { if (mouvement && !mouvement.pieces) mouvement = null; placerCamera(dir1, c1); commandes.update(); demander(); return; }
    var dir0 = directionActuelle(), c0 = { cible: commandes.target.clone(), distance: camera.position.distanceTo(commandes.target) };
    var q = new THREE.Quaternion().setFromUnitVectors(dir0, dir1), qi = new THREE.Quaternion(), dir = new THREE.Vector3(), c = { cible: new THREE.Vector3(), distance: 1 };
    lancer(0.5, function (u) {
      var k = arrivee(u); dir.copy(dir0).applyQuaternion(qi.identity().slerp(q, k));
      c.cible.lerpVectors(c0.cible, c1.cible, k); c.distance = c0.distance + (c1.distance - c0.distance) * k; placerCamera(dir, c);
    });
  }

  // LA QUALITÉ : l'image posée toujours entière ; un mouvement qui rame baisse les pixels, puis l'occlusion.
  var qualite = { niveau: 0, enCours: -1, lent: 0 }, largeur = 0, hauteur = 0, densite = 1;
  function appliquerQualite(niveau) {
    if (niveau === qualite.enCours) return;
    qualite.enCours = niveau;
    densite = Math.min(window.devicePixelRatio || 1, niveau === 0 ? 2 : niveau === 1 ? 1.5 : 1.15);
    rendu.setPixelRatio(densite); rendu.setSize(largeur, hauteur, false); composition.setPixelRatio(densite); composition.setSize(largeur, hauteur);
    var k = densite > 1.4 ? 1 / densite * 1.25 : 1;
    ao.setSize(Math.round(largeur * densite * k), Math.round(hauteur * densite * k)); ao.enabled = niveau < 3;
  }
  function taille() {
    var w = toile.clientWidth, h = toile.clientHeight;
    if (!w || !h || (w === largeur && h === hauteur)) return;
    largeur = w; hauteur = h; qualite.enCours = -1; appliquerQualite(0);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (etat.compo && !mouvement) regarderSansBouger();
    demander();
  }
  function regarderSansBouger() {
    var dir = directionActuelle(); placerCamera(dir, cadrage(dir, etat.cibleT != null ? etat.cibleT : etat.t, { cible: new THREE.Vector3(), distance: 1 }));
  }

  // LA BOUCLE : on ne redessine que s'il y a quelque chose de neuf.
  var aDessiner = true, bouge = false, dernier = 0, images = 0, ecoutes = { vue: [], image: [] }, calme = 0, suite = false;
  function demander() { aDessiner = true; }
  commandes.addEventListener("change", function () { aDessiner = true; bouge = true; calme = 0; });
  var prise = null;
  commandes.addEventListener("start", function () {
    prise = camera.position.clone();
    if (mouvement) { if (mouvement.pieces) mouvement.libre = true; else mouvement = null; }
  });
  commandes.addEventListener("change", function () {
    if (prise && etat.vue && camera.position.distanceTo(prise) > camera.position.distanceTo(commandes.target) * 0.01) { etat.vue = ""; ecoutes.vue.forEach(function (f) { f(""); }); }
  });
  commandes.addEventListener("end", function () { prise = null; });

  var arretee = false, prochaine = 0;
  function boucle(maintenant) {
    if (arretee) return;
    prochaine = requestAnimationFrame(boucle);
    var enMouvement = false;
    if (mouvement) {
      var u = Math.max(0, Math.min(1, (maintenant - mouvement.debut) / mouvement.duree)), m = mouvement;
      m.pas(u, m); enMouvement = true; aDessiner = true;
      if (m.libre) commandes.update();
      if (u >= 1 && mouvement === m) mouvement = null;
    } else commandes.update();
    if (bouge) { enMouvement = true; calme++; if (calme > 12) bouge = false; }
    if (!aDessiner) { if (!enMouvement && qualite.enCours !== 0) { appliquerQualite(0); aDessiner = true; } else return; }
    var dt = maintenant - dernier; dernier = maintenant;
    if (enMouvement && suite) {
      if (dt > 42) qualite.lent++; else if (dt < 22) qualite.lent = Math.max(0, qualite.lent - 1);
      if (qualite.lent >= 5 && qualite.niveau < 3) { qualite.niveau++; qualite.lent = 0; }
    }
    suite = enMouvement;
    appliquerQualite(enMouvement ? qualite.niveau : 0);
    aDessiner = false;
    composition.render(); images++;
    ecoutes.image.forEach(function (f) { f(); });
  }

  // TOUCHER LA PILE : le point touché est-il sur une pièce, à un doigt près (la boîte de chaque pièce,
  // vue de l'appareil photo, son contour, et la distance du doigt à ce contour).
  var DOIGT = 18, coin = new THREE.Vector3();
  function contour(pts) {
    pts.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function vire(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var bas = [], haut = [], i;
    for (i = 0; i < pts.length; i++) { while (bas.length >= 2 && vire(bas[bas.length - 2], bas[bas.length - 1], pts[i]) <= 0) bas.pop(); bas.push(pts[i]); }
    for (i = pts.length - 1; i >= 0; i--) { while (haut.length >= 2 && vire(haut[haut.length - 2], haut[haut.length - 1], pts[i]) <= 0) haut.pop(); haut.push(pts[i]); }
    return bas.slice(0, -1).concat(haut.slice(0, -1));
  }
  function distanceAuContour(px, py, c) {
    var dehors = false, mini = Infinity;
    for (var i = 0; i < c.length; i++) {
      var a = c[i], b = c[(i + 1) % c.length], ex = b[0] - a[0], ey = b[1] - a[1];
      if (ex * (py - a[1]) - ey * (px - a[0]) < 0) dehors = true;
      var l = ex * ex + ey * ey, k = l ? Math.max(0, Math.min(1, ((px - a[0]) * ex + (py - a[1]) * ey) / l)) : 0;
      mini = Math.min(mini, Math.hypot(px - a[0] - ex * k, py - a[1] - ey * k));
    }
    return dehors ? mini : 0;
  }
  function touche(x, y) {
    var rect = toile.getBoundingClientRect(), px = x - rect.left, py = y - rect.top;
    camera.updateMatrixWorld();
    return etat.compo.pieces.some(function (p) {
      matrice(p, etat.t, T);
      return etat.definitions[p.cle].couches.some(function (c) {
        var bb = c.geometrie.boundingBox, pts = [];
        for (var i = 0; i < 8; i++) {
          coin.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(T).project(camera);
          pts.push([(coin.x + 1) / 2 * rect.width, (1 - coin.y) / 2 * rect.height]);
        }
        return distanceAuContour(px, py, contour(pts)) <= DOIGT;
      });
    });
  }

  var guetteur = new ResizeObserver(taille); guetteur.observe(toile);
  taille(); prochaine = requestAnimationFrame(boucle);

  function detruire() {
    if (arretee) return;
    arretee = true; cancelAnimationFrame(prochaine); guetteur.disconnect(); commandes.dispose();
    etat.lots.forEach(function (l) { racine.remove(l.maille); l.maille.dispose(); }); etat.lots = [];
    if (scene.environment) scene.environment.dispose();
    pmrem.dispose(); composition.dispose(); ao.dispose(); cible.dispose();
    rendu.dispose(); rendu.forceContextLoss();
  }

  return {
    pret: pret, detruire: detruire, poser: poser, regler: regler, eclater: eclater, regarder: regarder, touche: touche, demander: demander,
    surVue: function (f) { ecoutes.vue.push(f); }, surImage: function (f) { ecoutes.image.push(f); },
    etat: function () {
      var tri = 0; etat.lots.forEach(function (l) { tri += l.maille.count * l.maille.geometry.index.count / 3; });
      return { t: etat.t, vue: etat.vue, ambiance: ambiance, images: images, niveau: qualite.enCours, triangles: tri, pieces: etat.compo ? etat.compo.pieces.length : 0, enMouvement: !!mouvement };
    },
    // Pour les contrôles et l'essai d'une pièce seule : l'appareil photo, ses commandes, le cadrage.
    interne: { camera: camera, commandes: commandes, etat: etat, cadrage: cadrage, matrice: matrice }
  };
}
