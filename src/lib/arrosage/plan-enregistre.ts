/**
 * UN PLAN ENREGISTRÉ, FIGÉ — sa demande du 21 novembre 2026, planche
 * `appli/arrosage-dossiers.html`, `ARCHITECTURE.md` §599.
 *
 * *« Si un artisan me reproche un réseau qui ne se lève pas, ni lui ni moi ne
 * pouvons montrer ce que Cause lui a rendu. »* Un plan enregistré garde ce
 * qu'il a saisi, ce que le calcul a rendu, et une empreinte.
 *
 * **LE PLAN DE L'ÉCRAN ET LE PLAN ENREGISTRÉ SORTENT DES MÊMES FONCTIONS.**
 * `calculer` puis `composer` : l'écran les appelle (deux temps, pour ne pas
 * refaire le calcul hydraulique à chaque pièce retouchée), le serveur les
 * rappelle à l'enregistrement. Deux implémentations finiraient par diverger
 * (`CLAUDE.md` §3), et la trace mentirait le jour où elles divergent.
 *
 * **LE SERVEUR NE CROIT PAS LE PLAN QU'ON LUI ENVOIE** : il reçoit la saisie,
 * refait le plan, et compare son empreinte à celle de l'écran. Un plan reçu
 * tout fait ferait de la trace ce qu'elle doit réfuter : un plan que Cause n'a
 * jamais calculé (un envoi bricolé, ou une page restée ouverte sur un code
 * ancien).
 */
import { cotesDuPlanTiennentDebout, type ParametresPlan } from "./consignes";
import { calculerEtDessiner, montageDuPlan, type LePlan } from "./le-plan";
import type { Dessin } from "./plan-dessine";
import { composerLesPostes, groupeNourrice, groupesDeLaListe, sommeDesGroupes, type Groupe, type Postes, type Robinet } from "./postes";
import { totalDeLaListe } from "./prix-de-la-liste";
import { RETOUCHES_VIERGES, type Retouches } from "./retouches";

/** Ce qu'il a saisi, et qui suffit à refaire le plan. */
export type SaisieDuPlan = {
  parametres: ParametresPlan;
  /** Les pièces changées, supprimées, ajoutées au nombre choisi : elles ne vivent que dans l'écran. */
  retouches: Retouches;
  /** Les réserves de la LECTURE (le croquis, la mesure, le trajet du regard), qui ne bougent pas avec le calcul. */
  reservesDuCroquis: string[];
  /** Pourquoi le plan n'est pas dessiné, ou `null`. */
  sansDessin: string | null;
  /** Ce que l'IA a lu sur la photo, tel qu'elle l'a rendu, avant ses corrections ; `null` pour un plan dessiné. */
  lecture: unknown;
};

/** Le premier temps : le calcul hydraulique et son dessin, qui ne dépendent que des paramètres. */
export function calculer(saisie: Pick<SaisieDuPlan, "parametres" | "sansDessin">): { plan: LePlan; dessin: Dessin | null } {
  const { plan, dessin } = calculerEtDessiner(saisie.parametres, saisie.sansDessin);
  return { plan, dessin };
}

/** Le robinet du plan, tel que l'écran le déduit des paramètres ; au compteur, aucun. */
export function robinetDuPlan(parametres: ParametresPlan): Robinet | null {
  if (parametres.compteur === "oui") return null;
  return { montage: montageDuPlan(parametres), double: parametres.robinet?.double ?? false, depart: parametres.robinet?.depart ?? null };
}

/** Le second temps : les pièces, la nourrice, la liste et les réserves, tels que l'écran les montre. */
export function composer(
  calcule: { plan: LePlan; dessin: Dessin | null },
  saisie: Pick<SaisieDuPlan, "parametres" | "retouches" | "reservesDuCroquis">
): PlanFige {
  const { plan, dessin } = calcule;
  const compteur = saisie.parametres.compteur === "oui";
  const amenee = saisie.parametres.amenee > 0 ? saisie.parametres.amenee : null;
  const robinet = robinetDuPlan(saisie.parametres);
  const postes = composerLesPostes({ plan, dessin, compteur, amenee, robinet, retouches: saisie.retouches });
  return {
    plan,
    dessin,
    postes,
    nourrice: groupeNourrice(plan, postes, saisie.retouches),
    groupes: groupesDeLaListe(plan, postes, saisie.retouches, compteur, robinet),
    // Celles du calcul d'abord, celles du croquis ensuite : l'ordre de l'écran.
    reserves: [...plan.reserves, ...saisie.reservesDuCroquis],
  };
}

/** Tout ce que l'écran montre d'un plan, et rien qui se recalcule pour le revoir. */
export type PlanFige = {
  plan: LePlan;
  dessin: Dessin | null;
  postes: Postes;
  nourrice: ReturnType<typeof groupeNourrice>;
  groupes: Groupe[];
  reserves: string[];
};

export function figerLePlan(saisie: SaisieDuPlan): PlanFige {
  return composer(calculer(saisie), saisie);
}

/**
 * L'EMPREINTE DIT SI DEUX PLANS SONT LE MÊME — sur ce qui se COMMANDE et se
 * POSE : chaque ligne de la liste (référence, nom, quantité au centième,
 * unité), et le nombre de réseaux et de têtes.
 *
 * **Pas sur les chiffres intermédiaires du calcul**, et c'est délibéré : le
 * moteur JavaScript d'un iPhone et celui du serveur ne rendent pas
 * `Math.pow` ou `Math.sqrt` au dernier chiffre près. Une empreinte prise sur
 * une pression à seize décimales refuserait son enregistrement pour rien, et
 * il ne comprendrait jamais pourquoi.
 */
export function empreinteDuPlan(f: PlanFige): string {
  const lignes = sommeDesGroupes(f.groupes).map((l) => `${l.ref}|${l.nom}|${Math.round(l.q * 100) / 100}|${l.u}`);
  const forme = [`reseaux:${f.plan.secteurs.length}`, `tetes:${f.plan.tetes}`, ...lignes].join("\n");
  return hacher(forme);
}

/**
 * Un hachage de 53 bits (cyrb53), le même au navigateur et au serveur, sans
 * dépendance. Il ne protège rien d'un adversaire : il dit seulement si deux
 * listes sont la même, ce qui est tout ce qu'on lui demande.
 */
function hacher(texte: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

function virgule(x: number): string {
  return (Math.round(x * 10) / 10).toString().replace(".", ",");
}

/** « 4 réseaux, 83 m de tranchée, 45 pièces » : les mots et les chiffres de l'écran du plan. */
export function resumeDuPlan(f: PlanFige): string {
  const n = f.plan.secteurs.length;
  const pieces = totalDeLaListe(f.groupes, {}).pieces;
  return [
    `${n} réseau${n > 1 ? "x" : ""}`,
    ...(f.dessin ? [`${virgule(f.dessin.metresTranchee)} m de tranchée`] : []),
    `${pieces} pièce${pieces > 1 ? "s" : ""}`,
  ].join(", ");
}

export function versionSuivante(versions: readonly number[]): number {
  return versions.length ? Math.max(...versions) + 1 : 1;
}

/** Au-delà, ce n'est plus la saisie d'un jardin : c'est un envoi qui a dérapé. */
const SAISIE_MAX_CARACTERES = 300_000;
const RESERVES_MAX = 60;
const RESERVE_MAX_CARACTERES = 600;

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * **CE QUI ARRIVE DU TÉLÉPHONE SE RELIT** : une saisie bancale est refusée en
 * le disant, jamais complétée par une valeur d'office (`CLAUDE.md` §4 quater :
 * un `??` devant une valeur absente fabrique un plan plausible qui n'a pas été
 * saisi). Les retouches doivent porter chacune de leurs clés : une clé absente
 * ferait composer d'autres pièces que celles de l'écran.
 */
export function lireLaSaisie(brut: unknown): { ok: true; saisie: SaisieDuPlan } | { ok: false; raison: string } {
  const illisible = { ok: false as const, raison: "Ce plan n’est pas lisible. Rechargez la page, puis enregistrez-le de nouveau." };
  if (!estObjet(brut)) return illisible;
  if (JSON.stringify(brut).length > SAISIE_MAX_CARACTERES) return { ok: false, raison: "Ce plan est trop lourd pour être enregistré." };
  const { parametres, retouches, reservesDuCroquis, sansDessin } = brut;
  if (!estObjet(parametres) || !Array.isArray(parametres.zones)) return illisible;
  const cotes = cotesDuPlanTiennentDebout(parametres as ParametresPlan);
  if (!cotes.ok) return { ok: false, raison: cotes.raison };
  if (!estObjet(retouches)) return illisible;
  for (const [cle, vierge] of Object.entries(RETOUCHES_VIERGES)) {
    const v = retouches[cle];
    const memeForme = Array.isArray(vierge) ? Array.isArray(v) : estObjet(vierge) ? estObjet(v) : typeof v === typeof vierge;
    if (!memeForme) return illisible;
  }
  if (!Array.isArray(reservesDuCroquis) || reservesDuCroquis.length > RESERVES_MAX) return illisible;
  if (!reservesDuCroquis.every((r) => typeof r === "string" && r.length <= RESERVE_MAX_CARACTERES)) return illisible;
  if (sansDessin !== null && typeof sansDessin !== "string") return illisible;
  return { ok: true, saisie: brut as unknown as SaisieDuPlan };
}
