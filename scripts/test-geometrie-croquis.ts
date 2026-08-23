import assert from "node:assert/strict";
import {
  echelleDuCroquis,
  distanceRegardVersZone,
  trajetLePlusLong,
  ECART_MAX_ENTRE_ZONES,
  poserSurLeTerrain,
  echelleTolerante,
  type ZonePositionnee,
} from "../src/lib/arrosage/geometrie-croquis";

// LES PROPORTIONS DU CROQUIS — sa demande du 22 août 2026 : « oui fais-le lire
// les proportions ».
//
// **Ce que cette suite défend, et pourquoi ça compte.** La distance du regard
// au premier arroseur était le dernier morceau non compté du calcul de
// pression. Je lui avais dit qu'aucune saisie ne la donnait ; il a répondu
// qu'il n'avait pas à la donner, puisque le croquis porte la nourrice, les
// zones et leurs cotes. Il avait raison.
//
// **Le risque de ce calcul, c'est l'ÉCHELLE.** Une échelle lue de travers ne
// fait pas rougir un test de forme : elle rend une distance plausible et
// fausse, donc une perte de charge fausse, donc une pression fausse, donc le
// mauvais nombre d'arroseurs. Tout ce qui suit tourne autour de ça.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

console.log("=== Les proportions du croquis ===\n");

/** Une pelouse de 16 × 6 m qui occupe 0,40 × 0,15 du croquis : 40 m par unité. */
const PELOUSE: ZonePositionnee = {
  position: { x: 0.3, y: 0.3 },
  largeurFraction: 0.4,
  hauteurFraction: 0.15,
  L: 16,
  l: 6,
};

// ── 1. L'échelle se déduit des cotes ────────────────────────────────────────
{
  const e = echelleDuCroquis([PELOUSE]);
  dire(
    e.ok && Math.abs(e.metresParFraction - 40) < 0.001,
    e.ok ? `une pelouse de 16 m sur 0,40 du croquis : ${e.metresParFraction} m par unité` : "échelle refusée",
  );

  // **Chaque zone donne DEUX estimations** — une par côté. Une zone dessinée de
  // travers dans un sens se corrige par l'autre.
  dire(e.ok && e.surCombienDeZones === 2, "une zone cotée en L et l donne deux estimations, pas une");
}

// ── 2. La médiane, pas la moyenne ───────────────────────────────────────────
//
// **Une valeur aberrante ne doit pas déplacer le résultat.** Un modèle qui se
// trompe sur une zone tirerait une moyenne vers son erreur ; la médiane
// l'ignore. Ici deux zones à 40 et une à 60 : la médiane vaut 40.
{
  const petite: ZonePositionnee = { position: { x: 0.8, y: 0.8 }, largeurFraction: 0.1, hauteurFraction: 0.1, L: 6, l: 4 };
  const e = echelleDuCroquis([PELOUSE, petite]);
  dire(e.ok && e.metresParFraction === 40, e.ok ? `médiane retenue : ${e.metresParFraction} m` : "refusée");
}

// ── 3. Elle REFUSE quand les zones se contredisent ──────────────────────────
//
// C'est le contrôle qui compte : un croquis qui n'est pas à l'échelle produit
// des distances inventées. On rend une raison, pas une moyenne.
{
  const incoherente: ZonePositionnee = {
    position: { x: 0.7, y: 0.7 }, largeurFraction: 0.1, hauteurFraction: 0.1, L: 40, l: 40,
  };
  const e = echelleDuCroquis([PELOUSE, incoherente]);
  dire(!e.ok, e.ok ? "acceptée à tort" : `refusée : ${e.raison}`);

  // Et juste sous la limite, elle accepte — sinon elle refuserait tous les
  // croquis à main levée, et un contrôle qui parle à tort s'apprend à être
  // ignoré.
  const limite: ZonePositionnee = {
    position: { x: 0.7, y: 0.7 },
    largeurFraction: 0.1,
    hauteurFraction: 0.1,
    L: 40 * ECART_MAX_ENTRE_ZONES * 0.1 * 0.99,
    l: null,
  };
  const eLimite = echelleDuCroquis([PELOUSE, limite]);
  dire(eLimite.ok, `juste sous le double d'écart, l'échelle est acceptée`);
}

// ── 4. Sans cote OU sans place, on ne conclut pas ───────────────────────────
{
  const sansPlace: ZonePositionnee = { position: null, largeurFraction: null, hauteurFraction: null, L: 16, l: 6 };
  dire(!echelleDuCroquis([sansPlace]).ok, "une zone cotée mais sans place ne donne pas d'échelle");

  const sansCote: ZonePositionnee = { position: { x: 0.3, y: 0.3 }, largeurFraction: 0.4, hauteurFraction: 0.15, L: null, l: null };
  dire(!echelleDuCroquis([sansCote]).ok, "une zone placée mais sans cote ne donne pas d'échelle");
}

// ── 5. La distance se mesure en MANHATTAN, jusqu'au BORD ────────────────────
//
// Un tuyau suit les axes — une diagonale sous-estimerait le tuyau à acheter ET
// la perte qu'il subit, dans le mauvais sens des deux. Et elle vise le bord :
// la longueur DANS la zone est déjà comptée par la ligne d'arroseurs, la
// compter deux fois gonflerait la perte et resserrerait la pose sans raison.
{
  // Regard à gauche de la pelouse (centre x=0,3, demi-largeur 0,2 → bord à 0,1).
  const d = distanceRegardVersZone({ x: 0.0, y: 0.3 }, PELOUSE, 40);
  dire(d !== null && Math.abs(d - 4) < 0.001, `regard à 0,1 du bord : ${d?.toFixed(1)} m (4 attendu)`);

  // Regard AU-DESSUS de la zone : distance nulle, pas négative.
  const dedans = distanceRegardVersZone({ x: 0.3, y: 0.3 }, PELOUSE, 40);
  dire(dedans === 0, `regard sur la zone : ${dedans} m`);

  // **En diagonale, les deux écarts s'ADDITIONNENT.** Regard en (0 ; 0,05),
  // bord de la pelouse à 0,1 en x et 0,175 en y : 0,275 d'écart total, soit
  // 11 m à 40 m par unité. À vol d'oiseau on ne trouverait que 8,06 m — un
  // quart de tuyau en moins que ce qu'il faut acheter, et un quart de perte de
  // charge en moins que ce qu'il subira.
  //
  // **Ce contrôle a rougi sur MON erreur, pas sur le code** : j'avais écrit 8 m
  // en lisant les demi-côtés de travers. Le refaire à la main était le seul
  // moyen de trancher, et c'est ce que vaut une valeur figée dans une suite.
  const diago = distanceRegardVersZone({ x: 0.0, y: 0.05 }, PELOUSE, 40);
  dire(
    diago !== null && Math.abs(diago - 11) < 0.001,
    `en diagonale : ${diago?.toFixed(2)} m (11 en Manhattan, 8,06 à vol d'oiseau)`,
  );
}

// ── 6. Le trajet retenu est LE PLUS LONG ────────────────────────────────────
//
// Toutes les zones sont dimensionnées sur la même pression : elle doit être
// celle du point le plus mal servi. Une moyenne donnerait un plan qui tient en
// moyenne, c'est-à-dire un plan qui ne tient pas au bout du jardin.
{
  const loin: ZonePositionnee = { position: { x: 0.9, y: 0.9 }, largeurFraction: 0.1, hauteurFraction: 0.1, L: 4, l: 4 };
  const t = trajetLePlusLong({ x: 0.0, y: 0.0 }, [PELOUSE, loin]);
  const proche = distanceRegardVersZone({ x: 0, y: 0 }, PELOUSE, 40) ?? 0;
  dire(
    t.ok && t.metres > proche,
    t.ok ? `le plus long trajet retenu : ${t.metres} m (la pelouse proche est à ${proche.toFixed(1)})` : "refusé",
  );
}

// ── 7. Sans nourrice, aucun trajet — et surtout aucune supposition ──────────
//
// `CLAUDE.md` §4 bis : la nourrice se lit sur le croquis, jamais ne se déduit.
// La poser au point d'eau « pour dépanner » ferait creuser au mauvais endroit,
// et une tranchée ne se déplace pas.
{
  const t = trajetLePlusLong(null, [PELOUSE]);
  dire(!t.ok, t.ok ? "un trajet a été rendu sans nourrice" : `refusé : ${t.raison}`);
  dire(
    !t.ok && /nourrice/.test(t.raison),
    "et la raison nomme la nourrice — pas « données insuffisantes »",
  );
}

// ── 8. Un trajet aberrant ne se rend pas ────────────────────────────────────
//
// Au-delà de 200 m, ce n'est plus un jardin de particulier : c'est une échelle
// lue de travers. La perte de charge qu'on en tirerait condamnerait le plan
// pour rien — et un refus qui parle à tort coûte autant qu'un silence.
{
  const immense: ZonePositionnee = {
    position: { x: 0.95, y: 0.95 }, largeurFraction: 0.02, hauteurFraction: 0.02, L: 20, l: 20,
  };
  const t = trajetLePlusLong({ x: 0, y: 0 }, [immense]);
  dire(!t.ok, t.ok ? `un trajet de ${t.metres} m a été rendu` : `refusé : ${t.raison}`);
}

// ── POSER LE CROQUIS SUR LE TERRAIN — le passage aux mètres ─────────────────
//
// **C'est la jonction entre la lecture et le DESSIN**, ajoutée le 23 août 2026.
// Le tracé et le contour travaillent en mètres ; la lecture ne rend que des
// fractions. Un seul chemin les convertit — deux finiraient par poser la même
// pelouse à deux endroits (`CLAUDE.md` §3).
//
// **Le défaut que ces cas attrapent est MUET.** Une conversion oubliée passe la
// fraction telle quelle : le plan reste cohérent avec lui-même, simplement
// dessiné sur un jardin d'un mètre de large. Aucun total ne bouge, aucune
// alerte ne parle — seule une mesure sur le résultat le voit.
{
  // Son jardin du 21 août : une pelouse de 12 × 12 et une bande de 8 × 4
  // collée à sa droite, dessinées dans un cadre où une unité de fraction vaut
  // vingt mètres.
  //
  // **Le jeu d'essai est lui-même à l'échelle, et ce n'est pas un détail** : la
  // première version ne l'était pas — des fractions posées au jugé —, et le
  // contrôle de chevauchement l'a attrapée. Il avait raison : un jeu d'essai
  // incohérent fait accuser le code à sa place.
  const CROQUIS = [
    { position: { x: 0.3, y: 0.3 }, largeurFraction: 0.6, hauteurFraction: 0.6, L: 12, l: 12 },
    { position: { x: 0.8, y: 0.1 }, largeurFraction: 0.4, hauteurFraction: 0.2, L: 8, l: 4 },
  ];

  const pose = poserSurLeTerrain({ x: 0, y: 0.2 }, CROQUIS);
  dire(pose.ok, pose.ok ? "le croquis se pose sur le terrain" : `refusé : ${pose.raison}`);
  if (pose.ok) {
    const [a, b] = pose.terrain.zones;
    // **Les CÔTÉS viennent des cotes lues, jamais du rectangle dessiné.** Un
    // trait tracé de travers ne doit pas changer un métré.
    dire(a.L === 12 && a.l === 12 && b.L === 8 && b.l === 4, "les cotes traversent intactes");
    // Le repère est ramené à zéro sur le coin haut-gauche de ce qui est montré.
    dire(
      Math.min(a.x, b.x, pose.terrain.nourrice?.x ?? 0) === 0,
      `l'origine est ramenée à zéro (x mini : ${Math.min(a.x, b.x, pose.terrain.nourrice?.x ?? 0)})`,
    );
    // **Et surtout : on est bien en MÈTRES.** Une fraction laissée telle quelle
    // donnerait un terrain large de moins de deux unités.
    const large = Math.max(a.x + a.L, b.x + b.L);
    dire(large > 15, `le terrain fait ${large.toFixed(1)} m de large — pas une fraction`);
    // La seconde zone est à DROITE de la première, comme sur le dessin.
    dire(b.x > a.x, `la bande est à droite de la pelouse (${b.x} contre ${a.x})`);
    // **ET ELLES NE SE CHEVAUCHENT PAS.** C'est le contrôle qui attrape une
    // conversion oubliée : les cotes viennent des mètres et les places de la
    // fraction ; mélanger les deux repères fait rentrer une pelouse de douze
    // mètres dans un dessin qui en fait un — les zones se marchent dessus, et
    // le contour du terrain devient un bloc au lieu d'un L.
    dire(
      b.x >= a.x + a.L - 0.01,
      `les deux zones ne se chevauchent pas (la bande commence à ${b.x} m, la pelouse finit à ${a.x + a.L} m)`,
    );
    dire(pose.terrain.nourrice !== null, "la nourrice est posée, elle aussi, en mètres");
  }

  // **Sans nourrice dessinée, le terrain se pose quand même** — c'est le
  // DESSIN qui refuse ensuite, pas la conversion. Les deux refus au même
  // endroit rendraient le message moins précis.
  const sansRegard = poserSurLeTerrain(null, CROQUIS);
  dire(
    sansRegard.ok && sansRegard.terrain.nourrice === null,
    "sans nourrice dessinée, les zones se posent et le regard reste absent",
  );

  // **Un croquis hors d'échelle N'EST PLUS REFUSÉ ICI** — sa correction du
  // 23 août 2026. Il est posé d'après ses cotes, et l'écart se DIT.
  // La sévère, elle, continue de refuser : voir le bloc suivant.
  const detraque = poserSurLeTerrain({ x: 0, y: 0 }, [
    { position: { x: 0.25, y: 0.5 }, largeurFraction: 0.5, hauteurFraction: 0.5, L: 12, l: 12 },
    { position: { x: 0.75, y: 0.5 }, largeurFraction: 0.5, hauteurFraction: 0.5, L: 60, l: 60 },
  ]);
  dire(detraque.ok, detraque.ok ? "un croquis hors d'échelle se pose quand même" : `refusé : ${detraque.raison}`);
  dire(
    detraque.ok && detraque.terrain.reserve !== null,
    "et l'écart se DIT au lieu de bloquer le plan",
  );
}

// ── UN CROQUIS À MAIN LEVÉE SE LIT QUAND MÊME (23 août 2026) ────────────────
//
// **Sa correction, et elle est juste :** *« il n'arrive pas à me lire mon
// croquis sous prétexte qu'il n'est pas à l'échelle... les utilisateurs ne vont
// pas s'amuser à faire des croquis à l'échelle à chaque fois. Là, il y a tous
// les métrés. »*
//
// **Les COTES commandent, le dessin ne fait qu'ordonner.** Un croquis à main
// levée dit avec certitude qui est à gauche de qui ; il ne dit rien de fiable
// sur les longueurs — c'est justement pour cela qu'on y écrit les métrés.
{
  // Son croquis du 23 août : un terrain de 25 × 20, une haie de 25 m le long du
  // haut, un retour de 5 × 10. Les proportions sont celles d'un dessin fait à
  // la main — la haie est tracée trop épaisse, le retour trop court.
  const AMAIN = [
    { position: { x: 0.4, y: 0.5 }, largeurFraction: 0.7, hauteurFraction: 0.6, L: 25, l: 20 },
    { position: { x: 0.4, y: 0.2 }, largeurFraction: 0.7, hauteurFraction: 0.05, L: null, l: null, ml: 25 },
    { position: { x: 0.85, y: 0.45 }, largeurFraction: 0.2, hauteurFraction: 0.5, L: 5, l: 10 },
  ];

  // Un dessin à main levée reste **à peu près** juste : les deux règles
  // concluent, et il n'y a rien à signaler. C'est le cas courant.
  const souple = echelleTolerante(AMAIN);
  dire(souple.ok, souple.ok ? `la tolérante conclut : ${Math.round(souple.metresParFraction)} m par unité` : `refusé : ${souple.raison}`);
  dire(echelleDuCroquis(AMAIN).ok, "un dessin à peu près juste passe même la règle sévère");

  // ── LÀ OÙ LES DEUX RÈGLES SE SÉPARENT ─────────────────────────────────────
  //
  // Un croquis franchement hors d'échelle. **La sévère refuse**, et elle a
  // raison : c'est elle qui nourrit le trajet du regard, donc le calcul de
  // pression, donc l'espacement des arroseurs — un chiffre faux y coûte un plan
  // faux. **La tolérante conclut**, parce que ce qu'elle sert est un DESSIN.
  const TORDU = [
    { position: { x: 0.25, y: 0.5 }, largeurFraction: 0.5, hauteurFraction: 0.5, L: 12, l: 12 },
    { position: { x: 0.75, y: 0.5 }, largeurFraction: 0.5, hauteurFraction: 0.5, L: 60, l: 60 },
  ];
  const severe = echelleDuCroquis(TORDU);
  dire(!severe.ok, severe.ok ? "la sévère a conclu sur un croquis hors d'échelle" : `la sévère refuse : ${severe.raison}`);
  const tordu = echelleTolerante(TORDU);
  dire(tordu.ok, tordu.ok ? `la tolérante conclut malgré tout (${Math.round(tordu.metresParFraction)} m par unité)` : `refusé : ${tordu.raison}`);

  const pose = poserSurLeTerrain({ x: 0.95, y: 0.6 }, AMAIN);
  dire(pose.ok, pose.ok ? "son croquis à main levée se pose sur le terrain" : `refusé : ${pose.raison}`);
  if (pose.ok) {
    dire(
      pose.terrain.zones[0].L === 25 && pose.terrain.zones[0].l === 20,
      "les cotes traversent intactes — c'est le dessin qui plie, jamais les métrés",
    );
    dire(pose.terrain.nourrice !== null, "la nourrice est posée");
    // **Un dessin à peu près juste ne DIT rien** : une réserve posée à chaque
    // croquis s'apprend à être ignorée, et ne servirait plus le jour où elle
    // compte vraiment.
    dire(
      pose.terrain.reserve === null,
      `rien à signaler sur un dessin à peu près juste (${pose.terrain.reserve ?? "aucune réserve"})`,
    );
  }

  // **C'est le croquis TORDU qui se signale.** Une réserve, jamais un refus :
  // les métrés sont justes, c'est l'agencement qui suit un dessin approximatif.
  const poseTordue = poserSurLeTerrain({ x: 0, y: 0 }, TORDU);
  if (poseTordue.ok) {
    dire(
      poseTordue.terrain.reserve !== null && /vérifier/.test(poseTordue.terrain.reserve),
      `l'agencement hors d'échelle est signalé (${poseTordue.terrain.reserve ?? "aucune réserve"})`,
    );
  }

  // **LA HAIE SEULE SUFFIT À DONNER L'ÉCHELLE** (23 août 2026). Sur son
  // croquis, elle longe tout le haut du terrain et porte sa longueur — 25 m.
  // Le cas est réel : une pelouse dont la lecture n'a pas rendu les proportions
  // laisserait, sans elle, un croquis muet où tout est pourtant coté.
  const parLaHaie = [
    { position: { x: 0.4, y: 0.5 }, largeurFraction: null, hauteurFraction: null, L: 25, l: 20 },
    { position: { x: 0.4, y: 0.2 }, largeurFraction: 0.5, hauteurFraction: 0.04, L: null, l: null, ml: 25 },
  ];
  const parHaie = echelleTolerante(parLaHaie);
  dire(
    parHaie.ok && !parHaie.approchee,
    parHaie.ok
      ? `la haie donne l'échelle à elle seule : ${Math.round(parHaie.metresParFraction)} m par unité` +
        (parHaie.approchee ? " — mais elle est tombée sur le dernier recours" : "")
      : `refusé : ${parHaie.raison}`,
  );
  // 25 m sur la moitié du dessin : cinquante mètres par unité, et pas la valeur
  // grossière du dernier recours (la plus grande cote sur toute l'étendue).
  dire(
    parHaie.ok && Math.abs(parHaie.metresParFraction - 50) < 1,
    parHaie.ok ? `et c'est bien SA longueur qui la donne (${parHaie.metresParFraction.toFixed(1)})` : "",
  );

  // **LE CAS QUI L'A BLOQUÉ : aucune proportion de zone lue.** La lecture n'a
  // rendu que des cotes et des places, sans les tailles dessinées — et l'ancien
  // message accusait ses cotes, c'est-à-dire le mauvais coupable.
  const sansProportions = [
    { position: { x: 0.4, y: 0.5 }, largeurFraction: null, hauteurFraction: null, L: 25, l: 20 },
    { position: { x: 0.85, y: 0.45 }, largeurFraction: null, hauteurFraction: null, L: 5, l: 10 },
  ];
  const dernierRecours = poserSurLeTerrain({ x: 0.95, y: 0.6 }, sansProportions);
  dire(
    dernierRecours.ok,
    dernierRecours.ok
      ? "sans proportions lues, le terrain se pose quand même — sur la plus grande cote"
      : `refusé : ${dernierRecours.raison}`,
  );
  if (dernierRecours.ok) {
    dire(
      dernierRecours.terrain.reserve !== null && /à l’estime/.test(dernierRecours.terrain.reserve),
      "et l'on dit que les zones sont placées à l'estime",
    );
  }

  // **Ce qui reste refusé, et doit l'être** : un croquis qui ne situe RIEN. Là,
  // il n'y a pas d'agencement à reconstituer, seulement à inventer.
  const nullePart = poserSurLeTerrain(null, [
    { position: null, largeurFraction: null, hauteurFraction: null, L: 25, l: 20 },
  ]);
  dire(!nullePart.ok, nullePart.ok ? "un croquis sans aucune place a été posé" : `refusé : ${nullePart.raison}`);
  dire(
    !nullePart.ok && !/cote/.test(nullePart.raison),
    `et le refus n'accuse PAS les cotes, qui sont là (« ${nullePart.ok ? "" : nullePart.raison} »)`,
  );
}

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
