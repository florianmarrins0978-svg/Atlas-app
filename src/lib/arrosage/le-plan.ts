import { calculerPlan } from "./calcul.js";
import { dessinerPlan, type Dessin, type ZoneDessinee } from "./plan-dessine";
import { piecesDuPlan, type LigneCalcul, type Piece } from "./pieces";
import type { ParametresPlan } from "./consignes";

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
  };
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
  amenee: { longueurMax25: number; longueurMax32: number; debit: number; insuffisantMemeEn32: boolean };
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
  if (sansDessin) {
    reservesDuDessin.push(sansDessin);
  } else {
    const dessine = dessinerPlan(
      plan.dessin,
      // **La nourrice EN MÈTRES**, sur le même repère que les zones. Lui passer
      // la fraction lue dessinerait un jardin d'un mètre de large : le défaut
      // aurait été muet, puisque tout resterait cohérent entre soi.
      parametres.nourrice,
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
    },
    pressionAuxArroseurs: plan.pressionAuxArroseurs,
    reserves,
  };
}
