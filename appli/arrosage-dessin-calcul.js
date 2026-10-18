var CROQUIS = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../../AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/a534a784-4632-483a-988b-e2b3d17c1aef/scratchpad/entree-dessin.ts
  var entree_dessin_exports = {};
  __export(entree_dessin_exports, {
    LIBELLES: () => LIBELLES,
    echelleDuCroquis: () => echelleDuCroquis,
    etatDuCroquis: () => etatDuCroquis,
    longueurDeLAmenee: () => longueurDeLAmenee,
    trajetLePlusLong: () => trajetLePlusLong
  });

  // src/lib/arrosage/geometrie-croquis.ts
  var ECART_MAX_ENTRE_ZONES = 2;
  var FRACTION_MINIMALE = 0.02;
  function mediane(valeurs) {
    const triees = [...valeurs].sort((a, b) => a - b);
    const milieu = Math.floor(triees.length / 2);
    return triees.length % 2 === 1 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
  }
  function estimationsDEchelle(zones) {
    const estimations = [];
    for (const z of zones) {
      if (z.L !== null && z.L > 0 && z.largeurFraction !== null && z.largeurFraction >= FRACTION_MINIMALE) {
        estimations.push(z.L / z.largeurFraction);
      }
      if (z.l !== null && z.l > 0 && z.hauteurFraction !== null && z.hauteurFraction >= FRACTION_MINIMALE) {
        estimations.push(z.l / z.hauteurFraction);
      }
      const dessine = Math.max(z.largeurFraction ?? 0, z.hauteurFraction ?? 0);
      if (z.ml != null && z.ml > 0 && dessine >= FRACTION_MINIMALE) {
        estimations.push(z.ml / dessine);
      }
    }
    return estimations;
  }
  function echelleDuCroquis(zones) {
    const estimations = estimationsDEchelle(zones);
    if (estimations.length === 0) {
      return {
        ok: false,
        raison: "aucune zone du croquis ne porte \xE0 la fois ses cotes et sa place : l'\xE9chelle ne se d\xE9duit pas"
      };
    }
    const mini = Math.min(...estimations);
    const maxi = Math.max(...estimations);
    if (maxi > mini * ECART_MAX_ENTRE_ZONES) {
      return {
        ok: false,
        raison: `le croquis n'est pas \xE0 l'\xE9chelle : selon les zones, un m\xEAme trait vaut de ${Math.round(mini)} \xE0 ${Math.round(maxi)} m, et les distances ne s'en d\xE9duisent pas`
      };
    }
    return { ok: true, metresParFraction: mediane(estimations), surCombienDeZones: estimations.length };
  }
  function distanceRegardVersZone(regard, zone, metresParFraction) {
    if (!zone.position || !(metresParFraction > 0)) return null;
    const demiLargeur = (zone.largeurFraction ?? 0) / 2;
    const demiHauteur = (zone.hauteurFraction ?? 0) / 2;
    const dx = Math.max(0, Math.abs(regard.x - zone.position.x) - demiLargeur);
    const dy = Math.max(0, Math.abs(regard.y - zone.position.y) - demiHauteur);
    return (dx + dy) * metresParFraction;
  }
  function longueurDeLAmenee(piquage, regard, zones) {
    if (!piquage) return { ok: false, raison: "le croquis ne montre pas o\xF9 le piquage se fait" };
    if (!regard) return { ok: false, raison: "le croquis ne montre pas o\xF9 la nourrice est pos\xE9e" };
    const echelle = echelleDuCroquis(zones);
    if (!echelle.ok) return { ok: false, raison: echelle.raison };
    const metres = (Math.abs(piquage.x - regard.x) + Math.abs(piquage.y - regard.y)) * echelle.metresParFraction;
    if (metres > 200) {
      return { ok: false, raison: `l'amen\xE9e calcul\xE9e (${Math.round(metres)} m) n'est pas vraisemblable` };
    }
    return { ok: true, metres: Math.round(metres * 10) / 10 };
  }
  function trajetLePlusLong(regard, zones) {
    if (!regard) {
      return {
        ok: false,
        raison: "le croquis ne montre pas o\xF9 la nourrice est pos\xE9e"
      };
    }
    const echelle = echelleDuCroquis(zones);
    if (!echelle.ok) return { ok: false, raison: echelle.raison };
    let plusLong = 0;
    let mesurees = 0;
    for (const z of zones) {
      const d = distanceRegardVersZone(regard, z, echelle.metresParFraction);
      if (d === null) continue;
      mesurees++;
      if (d > plusLong) plusLong = d;
    }
    if (mesurees === 0) {
      return { ok: false, raison: "aucune zone du croquis n'a de place lisible" };
    }
    if (plusLong > 200) {
      return {
        ok: false,
        raison: `le trajet lu jusqu'au jardin (${Math.round(plusLong)} m) n'est pas vraisemblable`
      };
    }
    return { ok: true, metres: Math.round(plusLong * 10) / 10, estimee: true };
  }

  // src/lib/arrosage/croquis-complet.ts
  function etatDuCroquis(croquis) {
    const manque = [];
    if (croquis.zonesMesurees === 0) manque.push("metres");
    if (!croquis.piquage) manque.push("piquage");
    if (!croquis.nourrice) manque.push("nourrice");
    return {
      complet: manque.length === 0,
      manque,
      lu: {
        zonesMesurees: croquis.zonesMesurees,
        nourrice: croquis.nourrice,
        piquage: croquis.piquage,
        branchement: croquis.branchement === "compteur" ? "compteur" : "ailleurs"
      }
    };
  }
  var LIBELLES = {
    nourrice: {
      titre: "Pas de plan : il manque la nourrice.",
      geste: "Dessinez son emplacement d\xE9finitif sur le croquis, puis reprenez la photo."
    },
    metres: {
      titre: "Pas de plan : il manque les m\xE9tr\xE9s.",
      geste: "\xC9crivez la longueur et la largeur de chaque partie du jardin, puis reprenez la photo."
    },
    piquage: {
      titre: "Pas de plan : il manque le piquage.",
      geste: "Marquez sur le croquis l\u2019endroit o\xF9 l\u2019arrosage se branche sur l\u2019eau, puis reprenez la photo."
    }
  };
  return __toCommonJS(entree_dessin_exports);
})();
