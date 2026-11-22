// LA SCÈNE DE LA NOURRICE EN 3D : la lumière, les ombres, l'occlusion ambiante, l'appareil photo, et
// les pièces dessinées en instances.
//
// CE QUI FAIT LE RENDU.
//   La lumière d'ambiance vient d'une HDRI libre (CC0, appli/vendor/hdri/) ; si elle ne se charge pas,
//   une pièce éclairée calculée par three (RoomEnvironment) la remplace.
//   Une lampe porte des ombres douces ; sous les pièces, une ombre de contact (la profondeur vue d'en
//   dessous, floutée) les pose au fond du regard.
//   L'occlusion ambiante (GTAO) creuse les filets, les cannelures et les jonctions.
//   L'image se compose en haute dynamique, se ramène à l'écran par la courbe ACES, et l'anticrénelage
//   est celui du tampon de rendu (MSAA).
//
// CE QUI LE GARDE FLUIDE SUR UN TÉLÉPHONE.
//   La densité de pixels est plafonnée à 2. Les pièces pareilles se dessinent en une fois (instances).
//   Rien ne se redessine tant que rien ne bouge. Et si l'appareil peine pendant un mouvement, la
//   qualité baisse le temps du mouvement, puis l'image posée revient à la qualité entière.

import * as THREE from "three";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { RoomEnvironment } from "../vendor/three/RoomEnvironment.js";
import { EXRLoader } from "../vendor/three/loaders/EXRLoader.js";
import { EffectComposer } from "../vendor/three/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/postprocessing/RenderPass.js";
import { GTAOPass } from "../vendor/three/postprocessing/GTAOPass.js";
import { OutputPass } from "../vendor/three/postprocessing/OutputPass.js";
import { place } from "./composition.js";
import { centreDuBout, GAZ } from "./formes.js";

// Les points de vue : d'où l'on regarde le centre de la nourrice.
var VUES = { biais: [-0.38, 1, 0.74], dessus: [0, 1, 0.0006], face: [0, 0.34, 1] };
var DUREE = 0.6;   // l'éclaté : environ 0,6 s

function douceur(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }   // départ et arrivée en douceur
function arrivee(t) { return 1 - Math.pow(1 - t, 4); }

export function creerScene(toile, o) {
  o = o || {};
  var matieres = o.matieres, fond = new THREE.Color(o.fond != null ? o.fond : 0xdcd9d2);
  var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: false, powerPreference: "high-performance" });
  if (!rendu.capabilities.isWebGL2) { rendu.dispose(); throw new Error("WebGL 2 absent"); }
  rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = o.exposition || 1;
  rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFSoftShadowMap; rendu.shadowMap.autoUpdate = false;

  var scene = new THREE.Scene(); scene.background = fond;
  var racine = new THREE.Group(); scene.add(racine);
  var camera = new THREE.PerspectiveCamera(26, 1, 40, 12000);

  // LA LUMIÈRE D'AMBIANCE. La pièce calculée sert tout de suite ; l'HDRI la remplace dès qu'elle arrive.
  var pmrem = new THREE.PMREMGenerator(rendu);
  var ambiance = "piece";
  function eclairer(ok) {
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; ambiance = "piece";
    if (!o.hdri) { ok(ambiance); return; }
    new EXRLoader().load(o.hdri, function (texture) {
      // L'image est tendue dans une boule, tournée pour que sa grande source éclaire la nourrice par
      // le haut et l'avant gauche, puis filtrée pour les reflets. `forceAmbiance` règle sa puissance.
      var boule = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, toneMapped: false }));
      boule.material.color.setScalar(o.forceAmbiance != null ? o.forceAmbiance : 0.2); boule.rotation.y = o.rotationAmbiance != null ? o.rotationAmbiance : -1.8;
      var studio = new THREE.Scene(); studio.add(boule);
      var ancienne = scene.environment; scene.environment = pmrem.fromScene(studio, 0, 1, 2000).texture;
      ancienne.dispose(); texture.dispose(); boule.geometry.dispose(); boule.material.dispose(); ambiance = "hdri"; demander(); ok(ambiance);
    }, undefined, function () { ok(ambiance); });
  }
  var pret = new Promise(eclairer);
  // LE CONTEXTE PERDU. Un téléphone reprend la mémoire graphique d'un onglet laissé en arrière-plan ; au
  // retour, three refait ses tampons tout seul, mais ce qui avait été CALCULÉ dedans (l'ambiance
  // filtrée, les ombres) est vide. On le refait, et on redessine.
  toile.addEventListener("webglcontextlost", function (e) { e.preventDefault(); });
  toile.addEventListener("webglcontextrestored", function () {
    eclairer(function () {}); etat.ombrePerimee = true; etat.contactPerime = true; qualite.enCours = -1; demander();
  });

  // LA LAMPE : elle donne le sens de la lumière et porte les ombres.
  var lampe = new THREE.DirectionalLight(0xfff4e6, o.lampe != null ? o.lampe : 0.5);
  lampe.castShadow = true; lampe.shadow.mapSize.set(2048, 2048); lampe.shadow.bias = -0.0002; lampe.shadow.normalBias = 0.6;
  scene.add(lampe); scene.add(lampe.target);
  var contre = new THREE.DirectionalLight(0xfff1e0, o.contre != null ? o.contre : 0.25); scene.add(contre); scene.add(contre.target);

  // LE FOND DU REGARD : un plan qui ne montre que les ombres, puis l'ombre de contact au-dessus de lui.
  var sol = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.26, color: 0x1a1612 }));
  sol.rotation.x = -Math.PI / 2; sol.receiveShadow = true; sol.scale.setScalar(20000); scene.add(sol);

  var CONTACT = 512, HAUTEUR = 110;   // les pièces à moins de 11 cm du fond y posent leur ombre
  var cibleContact = new THREE.WebGLRenderTarget(CONTACT, CONTACT), cibleFlou = new THREE.WebGLRenderTarget(CONTACT, CONTACT);
  cibleContact.texture.generateMipmaps = false; cibleFlou.texture.generateMipmaps = false;
  var planContact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cibleContact.texture, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false }));
  planContact.rotation.x = -Math.PI / 2; planContact.scale.y = -1; planContact.renderOrder = 2; scene.add(planContact);
  var dessous = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, HAUTEUR);
  dessous.rotation.x = Math.PI / 2;   // elle regarde vers le haut
  var matiereProfondeur = new THREE.MeshDepthMaterial();
  matiereProfondeur.userData.noirceur = { value: 1.25 };
  matiereProfondeur.onBeforeCompile = function (sh) {
    sh.uniforms.noirceur = matiereProfondeur.userData.noirceur;
    sh.fragmentShader = "uniform float noirceur;\n" + sh.fragmentShader.replace("gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
      "gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 1.6 ) * noirceur );");
  };
  matiereProfondeur.depthTest = false; matiereProfondeur.depthWrite = false; matiereProfondeur.side = THREE.DoubleSide;
  matiereProfondeur.blending = THREE.CustomBlending; matiereProfondeur.blendEquation = THREE.MaxEquation;
  matiereProfondeur.blendSrc = THREE.OneFactor; matiereProfondeur.blendDst = THREE.OneFactor;
  var flou = new THREE.ShaderMaterial({
    uniforms: { carte: { value: null }, pas: { value: new THREE.Vector2() } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy * 2.0, 0.0, 1.0 ); }",
    fragmentShader: "uniform sampler2D carte; uniform vec2 pas; varying vec2 vUv; void main() { vec4 s = vec4( 0.0 );" +
      " s += texture2D( carte, vUv - 4.0 * pas ) * 0.051; s += texture2D( carte, vUv - 3.0 * pas ) * 0.0918; s += texture2D( carte, vUv - 2.0 * pas ) * 0.12245;" +
      " s += texture2D( carte, vUv - pas ) * 0.1531; s += texture2D( carte, vUv ) * 0.1633; s += texture2D( carte, vUv + pas ) * 0.1531;" +
      " s += texture2D( carte, vUv + 2.0 * pas ) * 0.12245; s += texture2D( carte, vUv + 3.0 * pas ) * 0.0918; s += texture2D( carte, vUv + 4.0 * pas ) * 0.051; gl_FragColor = s; }",
    depthTest: false, depthWrite: false
  });
  var carreFlou = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flou), cameraFlou = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  carreFlou.frustumCulled = false;

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

  var commandes = new OrbitControls(camera, toile);
  commandes.enableDamping = true; commandes.dampingFactor = 0.1; commandes.rotateSpeed = 0.9; commandes.zoomSpeed = 0.9;
  commandes.maxPolarAngle = Math.PI / 2 - 0.03; commandes.screenSpacePanning = true;

  // LES PIÈCES, EN INSTANCES. Une couche (une matière d'un modèle de pièce) se dessine une seule fois
  // pour toutes les pièces de ce modèle ; une pièce retournée bout pour bout reste le même modèle.
  var etat = { compo: null, definitions: null, t: 0, vue: "biais", lots: [], boite: new THREE.Box3(), bas: 0 };
  var M = new THREE.Matrix4(), demiTour = new THREE.Matrix4().makeRotationY(Math.PI), T = new THREE.Matrix4();
  function matrice(pose, t, sortie) {
    var p = place(pose, t);
    if (pose.retourne) { sortie.makeTranslation(p[0], 0, p[1] + pose.L).multiply(demiTour); } else sortie.makeTranslation(p[0], 0, p[1]);
    return sortie;
  }
  // `definitions` : les pièces de cette composition (la page en tient deux jeux, un fin et un plus léger
  // pour les grandes nourrices).
  function poser(compo, definitions) {
    etat.lots.forEach(function (l) { racine.remove(l.maille); l.maille.dispose(); });
    etat.lots = []; etat.compo = compo; etat.definitions = definitions;
    // La fiche change en plein éclaté : les pièces finissent leur trajet, mais le cadre visé était celui
    // de l'ancienne fiche. On le lâche, celui qui pose la nouvelle fiche recadre.
    if (mouvement && mouvement.pieces) mouvement.libre = true;
    var parCle = {};
    compo.pieces.forEach(function (p) { (parCle[p.cle] = parCle[p.cle] || []).push(p); });
    Object.keys(parCle).forEach(function (cle) {
      var d = etat.definitions[cle], poses = parCle[cle];
      d.couches.forEach(function (c) {
        var m = new THREE.InstancedMesh(c.geometrie, matieres[c.matiere] || matieres.pvc, poses.length);
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        racine.add(m); etat.lots.push({ maille: m, poses: poses, cle: cle });
      });
    });
    // Le fond du regard : juste sous le point le plus bas, quelle que soit la composition.
    var bas = Infinity;
    Object.keys(parCle).forEach(function (cle) { etat.definitions[cle].couches.forEach(function (c) { bas = Math.min(bas, c.geometrie.boundingBox.min.y); }); });
    etat.bas = bas - 1.2; sol.position.y = etat.bas; planContact.position.y = etat.bas + 0.15;
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
    // La lampe et son ombre suivent la nourrice, tout comme l'ombre de contact.
    var c = etat.boite.getCenter(new THREE.Vector3()), s = etat.boite.getSize(new THREE.Vector3()), e = Math.hypot(s.x, s.z) / 2 + 60;
    lampe.position.set(c.x - e * 0.55, etat.bas + e * 1.9, c.z + e * 0.5); lampe.target.position.set(c.x, etat.bas, c.z);
    contre.position.set(c.x + e, etat.bas + e, c.z - e); contre.target.position.copy(lampe.target.position);
    var sc = lampe.shadow.camera; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = e * 0.2; sc.far = e * 4; sc.updateProjectionMatrix();
    etat.ombrePerimee = true;
    var lx = s.x + 160, lz = s.z + 160;
    planContact.position.x = c.x; planContact.position.z = c.z; planContact.scale.set(lx, -lz, 1);
    dessous.position.set(c.x, etat.bas, c.z); dessous.left = -lx / 2; dessous.right = lx / 2; dessous.top = lz / 2; dessous.bottom = -lz / 2; dessous.updateProjectionMatrix();
    etat.contactLarge = [lx, lz]; etat.contactPerime = true;
    demander();
  }
  function ombreDeContact() {
    var fondAvant = scene.background, clair = rendu.getClearAlpha();
    scene.background = null; sol.visible = false; planContact.visible = false; scene.overrideMaterial = matiereProfondeur;
    rendu.setClearAlpha(0); rendu.setRenderTarget(cibleContact); rendu.clear(); rendu.render(scene, dessous);
    scene.overrideMaterial = null;
    // Deux passes de flou, large puis fine : l'ombre s'étale sous la pièce et s'éteint en s'éloignant.
    // Le pas du flou est en millimètres, pour que l'ombre garde la même mollesse quelle que soit la
    // taille de la nourrice.
    [[8, 0], [0, 8], [2.5, 0], [0, 2.5]].forEach(function (p, i) {
      var source = i % 2 === 0 ? cibleContact : cibleFlou, dest = i % 2 === 0 ? cibleFlou : cibleContact;
      flou.uniforms.carte.value = source.texture; flou.uniforms.pas.value.set(p[0] / etat.contactLarge[0], p[1] / etat.contactLarge[1]);
      rendu.setRenderTarget(dest); rendu.clear(); rendu.render(carreFlou, cameraFlou);
    });
    rendu.setRenderTarget(null); rendu.setClearAlpha(clair);
    scene.background = fondAvant; sol.visible = true; planContact.visible = true; etat.contactPerime = false;
  }

  // CADRER : toute la nourrice dans l'image, le plus grand possible, depuis une direction donnée.
  function cadrage(direction, t, sortie) {
    var b = boiteA(t, new THREE.Box3()), c = b.getCenter(new THREE.Vector3()), d = b.getSize(new THREE.Vector3()).length() * 1.6;
    // Les coins de la boîte de chaque pièce, pas ceux de la boîte d'ensemble : une nourrice vue de
    // biais laisse de grands coins vides, et l'ensemble paraîtrait deux fois trop petit.
    var coins = [], essai = camera.clone(), q = new THREE.Vector3(), droite = new THREE.Vector3(), haut = new THREE.Vector3();
    etat.compo.pieces.forEach(function (p) {
      matrice(p, t, T);
      etat.definitions[p.cle].couches.forEach(function (co) {
        var bb = co.geometrie.boundingBox;
        [bb.min.x, bb.max.x].forEach(function (x) { [bb.min.y, bb.max.y].forEach(function (y) { [bb.min.z, bb.max.z].forEach(function (z) { coins.push(new THREE.Vector3(x, y, z).applyMatrix4(T)); }); }); });
      });
    });
    var demi = Math.tan(camera.fov * Math.PI / 360);
    // La perspective rapproche ce qui est devant : on recentre et on corrige la distance jusqu'à ce
    // que tout tienne, au plus grand, avec une marge.
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
    camera.near = Math.max(20, c.distance * 0.02); camera.far = c.distance * 6 + 4000; camera.updateProjectionMatrix();
  }

  // LES MOUVEMENTS. Un seul à la fois : l'éclaté (les pièces et le cadre ensemble) ou un changement de
  // point de vue. Chacun part de ce qu'on voit, et se laisse interrompre par le suivant.
  var mouvement = null;
  function lancer(duree, pas, pieces) {
    mouvement = { debut: performance.now(), duree: duree * 1000, pas: pas, pieces: !!pieces, libre: false };
    if (pieces) etat.dureeEclate = mouvement.duree;
    // Mouvements réduits demandés au système : on arrive tout de suite, sans trajet.
    if (reduit || duree <= 0) { var m = mouvement; mouvement = null; m.pas(1, m); }
    demander();
  }
  function eclater(cible) {
    var t0 = etat.t, dir = directionActuelle(), c0 = { cible: commandes.target.clone(), distance: camera.position.distanceTo(commandes.target) };
    var c1 = cadrage(dir, cible, { cible: new THREE.Vector3(), distance: 1 }), c = { cible: new THREE.Vector3(), distance: 1 };
    etat.cibleT = cible;
    // Le cadre suit les pièces, sauf si le doigt a repris la main entre-temps : alors seules les pièces bougent.
    lancer(DUREE * Math.abs(cible - t0), function (u, m) {
      var k = douceur(u); regler(t0 + (cible - t0) * k);
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

  // LA QUALITÉ. Niveau 0 : tout. Si un mouvement rame, le niveau monte pour la durée des mouvements
  // (moins de pixels, puis l'occlusion ambiante coupée) ; l'image posée revient toujours au niveau 0.
  var qualite = { niveau: 0, enCours: -1, lent: 0 }, largeur = 0, hauteur = 0, densite = 1;
  function appliquerQualite(niveau) {
    if (niveau === qualite.enCours) return;
    qualite.enCours = niveau;
    densite = Math.min(window.devicePixelRatio || 1, niveau === 0 ? 2 : niveau === 1 ? 1.5 : 1.15);
    rendu.setPixelRatio(densite); rendu.setSize(largeur, hauteur, false); composition.setPixelRatio(densite); composition.setSize(largeur, hauteur);
    // L'occlusion ambiante se calcule à la taille de l'écran en points, pas en pixels : deux fois
    // moins de travail sur un écran dense, pour une ombre qui est floue par nature.
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
  // L'écran a changé de forme : on garde la direction du regard, on recadre.
  function regarderSansBouger() {
    var dir = directionActuelle(); placerCamera(dir, cadrage(dir, etat.cibleT != null ? etat.cibleT : etat.t, { cible: new THREE.Vector3(), distance: 1 }));
  }

  // LA BOUCLE : on ne redessine que s'il y a quelque chose de neuf.
  var aDessiner = true, bouge = false, dernier = 0, images = 0, ecoutes = { vue: [], image: [] }, calme = 0, suite = false;
  function demander() { aDessiner = true; }
  commandes.addEventListener("change", function () { aDessiner = true; bouge = true; calme = 0; });
  // Tourner à la main défait le point de vue choisi : son bouton ne reste pas allumé à tort. Un simple
  // toucher ne tourne rien, et ne le défait donc pas.
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
    // Le temps d'une image ne se juge qu'entre deux images d'un même mouvement : la première suit un
    // repos, et son délai ne dit rien de l'appareil.
    if (enMouvement && suite) {
      if (dt > 42) qualite.lent++; else if (dt < 22) qualite.lent = Math.max(0, qualite.lent - 1);
      if (qualite.lent >= 5 && qualite.niveau < 3) { qualite.niveau++; qualite.lent = 0; }
    }
    suite = enMouvement;
    appliquerQualite(enMouvement ? qualite.niveau : 0);
    aDessiner = false;
    // Les ombres ne se refont que si les pièces ont bougé. Sur un appareil qui peine, pendant un
    // mouvement, une image sur deux seulement : ce sont deux passes de géométrie de moins, et une ombre
    // floue en retard d'une image ne se voit pas. L'image posée les rattrape toujours.
    var sauter = enMouvement && qualite.enCours >= 1 && images % 2 === 1;
    if (etat.ombrePerimee && !sauter) { rendu.shadowMap.needsUpdate = true; etat.ombrePerimee = false; }
    if (etat.contactPerime && !sauter) ombreDeContact();
    if (etat.ombrePerimee || etat.contactPerime) aDessiner = true;
    composition.render(); images++;
    ecoutes.image.forEach(function (f) { f(); });
  }

  // TOUCHER LA NOURRICE : le point touché est-il sur une pièce, à un doigt près ? Chaque pièce est prise
  // dans sa boîte, vue de l'appareil photo : huit coins projetés, leur contour, et la distance du doigt
  // à ce contour. Une boule autour de la pièce aurait compté un collecteur d'un demi-mètre pour toute la vue.
  var DOIGT = 18, coin = new THREE.Vector3();
  function contour(pts) {   // l'enveloppe convexe de quelques points de l'écran, dans le sens direct
    pts.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function vire(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var bas = [], haut = [], i;
    for (i = 0; i < pts.length; i++) { while (bas.length >= 2 && vire(bas[bas.length - 2], bas[bas.length - 1], pts[i]) <= 0) bas.pop(); bas.push(pts[i]); }
    for (i = pts.length - 1; i >= 0; i--) { while (haut.length >= 2 && vire(haut[haut.length - 2], haut[haut.length - 1], pts[i]) <= 0) haut.pop(); haut.push(pts[i]); }
    return bas.slice(0, -1).concat(haut.slice(0, -1));
  }
  function distanceAuContour(px, py, c) {   // 0 dedans, sinon la distance au bord le plus proche
    var dehors = false, mini = Infinity;
    for (var i = 0; i < c.length; i++) {
      var a = c[i], b = c[(i + 1) % c.length], ex = b[0] - a[0], ey = b[1] - a[1];
      if (ex * (py - a[1]) - ey * (px - a[0]) < 0) dehors = true;
      var l = ex * ex + ey * ey, k = l ? Math.max(0, Math.min(1, ((px - a[0]) * ex + (py - a[1]) * ey) / l)) : 0;
      mini = Math.min(mini, Math.hypot(px - a[0] - ex * k, py - a[1] - ey * k));
    }
    return dehors ? mini : 0;
  }
  // OÙ EST CHAQUE PIÈCE À L'ÉCRAN, en pixels de la vue : la boîte de la pièce (toutes ses couches), vue de
  // l'appareil photo, à l'instant de l'éclaté où elle est. Les numéros s'y accrochent ; la scène, elle, ne
  // dessine rien de plus.
  var boiteEcran = new THREE.Box3();
  function ecran() {
    if (!etat.compo) return [];
    var rect = toile.getBoundingClientRect();
    camera.updateMatrixWorld();
    return etat.compo.pieces.map(function (p) {
      matrice(p, etat.t, T);
      boiteEcran.makeEmpty();
      etat.definitions[p.cle].couches.forEach(function (c) { boiteEcran.union(c.geometrie.boundingBox); });
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, bb = boiteEcran;
      for (var i = 0; i < 8; i++) {
        coin.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(T).project(camera);
        var x = (coin.x + 1) / 2 * rect.width, y = (1 - coin.y) / 2 * rect.height;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      bb.getCenter(coin).applyMatrix4(T).project(camera);
      return { indice: p.indice, cle: p.cle, x: (coin.x + 1) / 2 * rect.width, y: (1 - coin.y) / 2 * rect.height, gauche: x0, droite: x1, haut: y0, bas: y1 };
    });
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

  // MESURER DANS LA SCÈNE : chaque bout de chaque pièce, relu dans la géométrie qu'on dessine et dans la
  // matrice de son instance, comparé à l'axe où il doit être. Rend le plus grand écart, en millimètres.
  var centresLocaux = new WeakMap();
  function boutsDe(cle) {
    var d = etat.definitions[cle], liste = [];
    if (centresLocaux.has(d)) return centresLocaux.get(d);
    function rayon(b) { return b.gaz === "pe25" ? 12.5 : GAZ[b.gaz].d / 2 + (b.genre === "femelle" ? 2 : 0); }
    if (d.haut) {
      [["haut", d.haut], ["bas", d.bas]].forEach(function (x) { liste.push({ nom: x[0], axe: "z", local: centreDuBout(d.couches, "z", x[1].z, rayon(x[1])), attendu: [0, 0, x[1].z] }); });
    } else {
      [["gauche", d.gauche], ["droite", d.droite]].forEach(function (x) { if (x[1]) liste.push({ nom: x[0], axe: "x", local: centreDuBout(d.couches, "x", x[1].x, rayon(x[1])), attendu: [x[1].x, 0, 0] }); });
      d.branches.forEach(function (b, i) { liste.push({ nom: "branche " + (i + 1), axe: "z", branche: i, local: centreDuBout(d.couches, "z", b.z, rayon(b), [b.x, 0, 0]), attendu: [b.x, 0, b.z] }); });
    }
    centresLocaux.set(d, liste); return liste;
  }
  function mesurer() {
    var pire = 0, ou = "", manquants = [], lignes = [], v = new THREE.Vector3(), lu = new THREE.Matrix4();
    etat.lots.forEach(function (l) {
      if (l.maille !== etat.lots.filter(function (x) { return x.cle === l.cle; })[0].maille) return;   // une couche par modèle suffit
      l.poses.forEach(function (p, i) {
        l.maille.getMatrixAt(i, lu);
        boutsDe(p.cle).forEach(function (b) {
          if (!b.local) { manquants.push(p.cle + " " + b.nom); return; }
          v.fromArray(b.local).applyMatrix4(lu);
          var ecart;
          if (p.rang === "colonne") { var col = etat.compo.colonnes[p.colonne], ax = col.xMonte + (col.xEclate - col.xMonte) * etat.t; ecart = Math.hypot(v.x - ax, v.y); }
          else if (b.axe === "x") ecart = Math.hypot(v.y, v.z);
          else {   // la branche d'une pièce de la rangée : sur l'axe de sa colonne
            var cols = etat.compo.colonnes.filter(function (c) { return c.parent === p.indice; }), cb = cols[b.branche], axb = cb.xMonte + (cb.xEclate - cb.xMonte) * etat.t;
            ecart = Math.hypot(v.x - axb, v.y);
          }
          lignes.push({ piece: p.cle, indice: p.indice, bout: b.nom, colonne: p.colonne, ecart: ecart, x: v.x, z: v.z });
          if (ecart > pire) { pire = ecart; ou = p.cle + " " + b.nom; }
        });
      });
    });
    return { pire: pire, ou: ou, bouts: lignes.length, manquants: manquants, lignes: lignes };
  }

  var guetteur = new ResizeObserver(taille); guetteur.observe(toile);
  taille(); prochaine = requestAnimationFrame(boucle);

  // DÉFAIRE LA SCÈNE. Une page qui ne vit qu'une fois n'en a pas besoin ; un écran de l'appli, si : quitté
  // puis rouvert, il laisserait tourner la boucle et garderait un contexte WebGL par visite, et le
  // téléphone en refuse au-delà d'une quinzaine.
  function detruire() {
    if (arretee) return;
    arretee = true; cancelAnimationFrame(prochaine); guetteur.disconnect(); commandes.dispose();
    etat.lots.forEach(function (l) { racine.remove(l.maille); l.maille.dispose(); }); etat.lots = [];
    if (scene.environment) scene.environment.dispose();
    pmrem.dispose(); composition.dispose(); ao.dispose(); cible.dispose(); cibleContact.dispose(); cibleFlou.dispose();
    rendu.dispose(); rendu.forceContextLoss();
  }

  return {
    pret: pret, detruire: detruire, poser: poser, regler: regler, eclater: eclater, regarder: regarder, recadrer: function () { if (!mouvement || mouvement.pieces) { regarderSansBouger(); commandes.update(); demander(); } }, touche: touche, ecran: ecran, mesurer: mesurer, demander: demander,
    surVue: function (f) { ecoutes.vue.push(f); }, surImage: function (f) { ecoutes.image.push(f); },
    etat: function () {
      var tri = 0; etat.lots.forEach(function (l) { tri += l.maille.count * l.maille.geometry.index.count / 3; });
      return { t: etat.t, vue: etat.vue, ambiance: ambiance, images: images, niveau: qualite.enCours, densite: densite, triangles: tri, lots: etat.lots.length, pieces: etat.compo ? etat.compo.pieces.length : 0, enMouvement: !!mouvement, dureeEclate: etat.dureeEclate, appels: rendu.info.render.calls };
    },
    // Pour les contrôles : l'appareil photo, ses commandes, l'occlusion ambiante, l'état, le cadrage.
    interne: { camera: camera, commandes: commandes, ao: ao, etat: etat, cadrage: cadrage }
  };
}
