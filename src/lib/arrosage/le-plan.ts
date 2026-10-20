import { calculerPlan } from "./calcul.js";
import { dessinerPlan, type Dessin, type ZoneDessinee } from "./plan-dessine";
import { piecesDuPlan, type LigneCalcul, type Piece } from "./pieces";
import type { ParametresPlan } from "./consignes";
import type { Montage } from "./robinet";
import { nomDeLaZone } from "./zones-du-plan";

/**
 * LE PLAN TEL QUE L'ÉCRAN LE REÇOIT — le calcul, son dessin, ses pièces, et ce
 * que le calcul dit de lui-même.
 *
 * **Une seule fonction pour trois chemins** : la lecture du croquis (serveur),
 * la discussion (serveur), et désormais les gestes de l'écran qui refont le
 * calcul sans photo : la sonde de pluie, la couronne de 50 ou 100 m, une ligne
 * ou deux au goutte-à-goutte. Avant le 18 octobre 2026, cette fonction vivait
 * dans l'action serveur ; l'écran aurait dû recopier ses réserves pour
 * recalculer en place, et deux copies finissent par diverger (`CLAUDE.md` §3).
 *
 * Rien ici ne touche la base ni l'IA : c'est de la règle pure, éprouvable sans
 * serveur, et le navigateur peut la jouer comme le serveur.
 */

export type LePlan = {
  debitDisponible: number;
  secteurs: { nom: string; debit: number; famille: string; part: string | null }[];
  voies: number;
  couleurs: string[];
  /**
   * **La liste qu'il emporte au comptoir — lue sur le tracé quand il existe.**
   *
   * Trois zones, les tés et coudes de chaque réseau tels que le plan les
   * dessine, le tuyau Ø25 mesuré, le té égal du compteur : `pieces.ts`, où
   * l'on explique pourquoi le calcul seul ne suffisait pas. `reference` ne
   * vaut que quand elle a été RELEVÉE sur un document du patron — sinon
   * `null`, et l'écran n'affiche rien (*« tu ne dois surtout pas inventer de
   * prix ni de référence »*, 22 août 2026).
   */
  pieces: Piece[];
  /** Ce que le calcul a compté, ligne à ligne : l'écran pose chaque pièce à sa place à partir de là. */
  materiel: LigneCalcul[];
  /** Les zones avec leurs têtes, telles que le calcul les place : c'est là que l'écran lit la buse d'une tête. */
  dessinDuCalcul: ZoneDessinee[];
  /** Quelle zone est sur quelles vannes. */
  reseauxDeZone: Record<string, number[]>;
  /** Les sorties du goutte-à-goutte, comptées une fois. */
  goutteAGoutte: { sorties: number; tesEgaux: number };
  /**
   * **À PARTIR DE COMBIEN DE MÈTRES IL FAUT DU Ø32** — sa demande du
   * 22 août 2026. Le seuil se compare au mètre ruban sur place ; et depuis
   * le 11 septembre, l'amenée elle-même est calculée sur le croquis, du
   * piquage à la nourrice — la ligne de pièces dit alors Ø25 ou Ø32.
   */
  tuyau: {
    /** Mètres de Ø25 admissibles avant que la perte mange la pression. */
    seuil25: number;
    seuil32: number;
    /** Le débit du réseau le plus gourmand : c'est lui qui dimensionne. */
    debit: number;
    /** Même le Ø32 perd trop : Ø40, ou un réseau de plus. */
    insuffisantMemeEn32: boolean;
    /** Le diamètre RETENU pour l'amenée : le sien s'il l'a choisi, sinon celui que l'outil propose. Au robinet, c'est le départ. */
    diametre: 25 | 32;
    /** Ce que l'outil propose pour l'amenée : Ø25 quand il tient, sinon Ø32. */
    propose: 25 | 32;
  };
  /**
   * Le tuyau de chaque réseau, par son numéro : Ø25, ou Ø32 quand il l'a choisi
   * (sa règle du 20 octobre 2026). Un goutte-à-goutte reste en Ø25 : le calcul
   * ne lui compte aucune perte de ligne, le Ø32 n'y changerait rien.
   */
  diametres: (25 | 32)[];
  /** Le nombre de têtes de chaque réseau, pour dire ce qu'un changement de tuyau a changé. */
  tetes: number[];
  /** Ce qui arrive au pied du DERNIER arroseur, en bar. */
  pressionAuxArroseurs: number;
  /** Ce que le calcul dit de lui-même : la pression, la portée, l'amenée calculée. */
  reserves: string[];
};

/** Ce que `calculerPlan` rend, pour ce que cette fonction en lit. */
type Calcule = {
  debitDisponible: number;
  secteurs: LePlan["secteurs"];
  voies: number;
  couleurs: string[];
  materiel: LigneCalcul[];
  dessin: ZoneDessinee[];
  reseauxDeZone: Record<string, number[]>;
  goutteAGoutte: { sorties: number; tesEgaux: number };
  amenee: { longueurMax25: number; longueurMax32: number; debit: number; insuffisantMemeEn32: boolean; diametre: 25 | 32; propose: 25 | 32 };
  pressionAuxArroseurs: number;
  pressionTropBasse: boolean;
  pressionRaffinee: boolean;
  perteReseau: number;
  perteAmenee: number;
  porteeEstimee: boolean;
  pression: number;
  manquants: string[];
};

/**
 * Le calcul, son dessin, et ce que le calcul dit de lui-même.
 *
 * `sansDessin` : la raison pour laquelle le croquis ne permet pas de
 * reconstituer l'agencement, ou `null`. Le plan existe alors sans dessin : ses
 * trois éléments obligatoires sont les métrés, le piquage et la nourrice, pas
 * le dessin (sa correction du 23 août 2026).
 */
export function calculerEtDessiner(parametres: ParametresPlan, sansDessin: string | null) {
  const plan = calculerPlan(parametres as never) as unknown as Calcule;
  let dessin: Dessin | null = null;
  const reservesDuDessin: string[] = [];
  // **AU NEZ DE ROBINET, LES RÉSEAUX PARTENT DU ROBINET** (son montage 1 du
  // 18 octobre 2026) : il n'y a pas de nourrice, le départ est le piquage lu
  // sur le croquis. Le calcul lui-même ne change pas : il garde l'amenée et le
  // trajet du regard tels que le croquis les a donnés.
  const nez = montageDuPlan(parametres) === "nez";
  const depart = nez ? parametres.piquage ?? null : parametres.nourrice;
  if (sansDessin) {
    reservesDuDessin.push(sansDessin);
  } else if (nez && !depart) {
    reservesDuDessin.push("Le croquis ne situe pas le robinet : le plan est calculé, mais il n’est pas dessiné.");
  } else {
    const dessine = dessinerPlan(
      plan.dessin,
      // **La nourrice EN MÈTRES**, sur le même repère que les zones. Lui passer
      // la fraction lue dessinerait un jardin d'un mètre de large : le défaut
      // aurait été muet, puisque tout resterait cohérent entre soi.
      depart,
      plan.couleurs
    );
    // Si le tracé lui-même n'aboutit pas, c'est le dessin qui manque, pas le
    // plan. Seule l'absence de nourrice retire tout (`croquis-complet.ts`).
    if (dessine.ok) {
      dessin = dessine.dessin;
      reservesDuDessin.push(...dessine.reserves);
    } else {
      reservesDuDessin.push(`${dessine.raison} Le plan est calculé, mais il n’est pas dessiné.`);
    }
  }
  return { dessin, parametres, plan: lePlan(plan, dessin, parametres, reservesDuDessin) };
}

/**
 * Le montage qui vaut pour ce plan : au compteur, toujours la nourrice ; sur un
 * robinet, celui qu'il a choisi, et le nez de robinet tant qu'il n'a rien dit
 * (c'est le premier montage de sa planche).
 */
export function montageDuPlan(parametres: Pick<ParametresPlan, "compteur" | "robinet">): Montage {
  if (parametres.compteur === "oui") return "nourrice";
  return parametres.robinet?.montage ?? "nez";
}

/** Ce que le calcul rend à l'écran — la même forme, que le plan soit dessiné ou non. */
function lePlan(plan: Calcule, dessin: Dessin | null, parametres: ParametresPlan, reservesDuDessin: string[]): LePlan {
  const reserves: string[] = [];
  const bar = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
  // **CE QUI ARRIVE AU DERNIER ARROSEUR, ET CE QUI N'EST PAS COMPTÉ.** Le
  // calcul retire l'amenée, l'électrovanne, la ligne, ses raccords et l'antenne
  // Ø16 — mais PAS le trajet du regard jusqu'à la première tête quand le
  // croquis ne l'a pas donné. La pression annoncée est alors un plafond.
  if (plan.pressionTropBasse) {
    reserves.push(
      `Il ne resterait que ${bar(plan.pressionAuxArroseurs)} bar au dernier arroseur : trop peu pour ` +
        "qu'il se lève correctement. Raccourcissez les lignes, ajoutez une vanne, ou piquez plus en amont."
    );
  } else if (plan.pressionRaffinee) {
    reserves.push(
      `${bar(plan.pressionAuxArroseurs)} bar au dernier arroseur, ${bar(plan.perteReseau, 2)} bar perdus ` +
        `dans le réseau, ${bar(plan.perteAmenee, 2)} dans l’amenée` +
        (parametres.regardVersZone > 0 ? `, trajet du regard ${parametres.regardVersZone.toFixed(0)} m lu sur le croquis` : "") +
        "."
    );
  }
  // **L'amenée est CALCULÉE sur le croquis** (sa règle du 11 septembre 2026),
  // et son chiffre s'écrit à côté de la perte qu'elle coûte. Zéro quand elle
  // n'a pas pu l'être — la réserve du croquis le dit alors, plus haut.
  if ((plan.pressionRaffinee || plan.pressionTropBasse) && parametres.amenee > 0) {
    reserves.push(`Amenée de ${bar(parametres.amenee, 1)} m, du piquage à la nourrice, calculée sur le croquis.`);
  }
  // **Une portée réduite est une ESTIMATION, et elle se dit.** Le débit des
  // buses est ramené à la pression du chantier par la loi de l'orifice — de la
  // physique. La portée, elle, suit un exposant tiré des tables des
  // constructeurs et non de ses catalogues à lui (`CLAUDE.md` §4).
  if (plan.porteeEstimee) {
    reserves.push(
      `${String(plan.pression).replace(".", ",")} bar : les portées sont réduites par rapport au ` +
        "catalogue, donné à plus forte pression. Estimation à confirmer sur place."
    );
  }
  reserves.push(...reservesDuDessin);
  // **Ce que le Ø32 laisse au jugement** : les pièces du réseau passent en 32,
  // mais la sortie de la vanne et le té du compteur restent celles de la
  // nourrice et du piquage, en 25. Le passage de l'un à l'autre n'est pas
  // relevé : il se dit, il ne s'invente pas (`CLAUDE.md` §4).
  // **Une zone ajoutée à la main et pas encore glissée** est posée sous les
  // autres : elle compte dans les réseaux et les arroseurs, mais son tuyau et
  // sa tranchée sont mesurés à une place qui n'est pas la sienne.
  for (const z of parametres.zones.filter((x) => x.aPlacer)) {
    reserves.push(`« ${nomDeLaZone(z)} » est posée sous les autres en attendant : glissez-la à sa place, son tuyau et sa tranchée en dépendent.`);
  }
  const diametres = diametresDesReseaux(plan, parametres);
  if (diametres.includes(32) || plan.amenee.diametre === 32) {
    reserves.push("Tuyau en Ø32 : le passage du Ø25 au Ø32, à la vanne ou au piquage, n’est pas compté dans la liste.");
  }
  // **Ce qui manque au catalogue se dit, jamais ne se comble** (16 octobre
  // 2026) : une zone sans matériel de la marque, une nourrice sans fiche.
  reserves.push(...plan.manquants);

  return {
    debitDisponible: plan.debitDisponible,
    secteurs: plan.secteurs,
    voies: plan.voies,
    couleurs: plan.couleurs,
    pieces: piecesDuPlan(plan.materiel, dessin, {
      compteur: parametres.compteur === "oui",
      seuil25: plan.amenee.longueurMax25,
      amenee: parametres.amenee > 0 ? parametres.amenee : null,
      goutte: plan.goutteAGoutte,
      diametres,
      diametreAmenee: plan.amenee.diametre,
    }),
    materiel: plan.materiel,
    dessinDuCalcul: plan.dessin,
    reseauxDeZone: plan.reseauxDeZone,
    goutteAGoutte: plan.goutteAGoutte,
    tuyau: {
      seuil25: plan.amenee.longueurMax25,
      seuil32: plan.amenee.longueurMax32,
      debit: plan.amenee.debit,
      insuffisantMemeEn32: plan.amenee.insuffisantMemeEn32,
      diametre: plan.amenee.diametre,
      propose: plan.amenee.propose,
    },
    diametres,
    tetes: plan.secteurs.map((s) => (s as { points?: unknown[] }).points?.length ?? 0),
    pressionAuxArroseurs: plan.pressionAuxArroseurs,
    reserves,
  };
}

/** Le tuyau de chaque réseau : le Ø32 seulement là où il l'a choisi, et sur un réseau qui a des têtes. */
function diametresDesReseaux(plan: Calcule, parametres: ParametresPlan): (25 | 32)[] {
  const choix = parametres.diametres?.reseaux ?? {};
  return plan.secteurs.map((s, i) => (choix[i] === 32 && s.famille !== "Goutte-à-goutte" ? 32 : 25));
}
