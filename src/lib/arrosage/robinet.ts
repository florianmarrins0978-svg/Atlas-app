import { CATALOGUE } from "./catalogue.js";

/**
 * LE MONTAGE AU ROBINET — ses deux montages du 18 octobre 2026, et les pièces
 * qu'il a validées pour les tenir (planche `appli/arrosage-plan-robinet.html`,
 * validée le 18 octobre au soir : *« tu peux coder »*).
 *
 * *« Tu me refais une planche à côté en simulant le fait qu'on se repique sur
 * un robinet. »* Deux montages, les siens :
 *
 * 1. **un programmateur en nez de robinet**, et alors PAS de nourrice : la
 *    ligne part du robinet ;
 * 2. **pas de programmateur au robinet**, la nourrice reste, et le départ est le
 *    nez de robinet.
 *
 * Sous le robinet, une **double sortie proposée** au client, jamais imposée :
 * une sortie pour l'arrosage, l'autre reste au client. Puis le raccord du
 * tuyau qui part, et le tuyau : **Ø16 rigide ou souple seulement quand tout est
 * en goutte-à-goutte** (*« dès qu'il y a des arroseurs, ça sera forcément du 25
 * ou du 32 »*), sinon le diamètre que le calcul donne à l'amenée ; l'outil
 * choisit, il peut changer.
 *
 * **Ces pièces ne sont PAS au calcul** : elles ne changent ni le débit ni la
 * pression ; elles entrent dans la liste du départ, et chacune se change ou se
 * supprime comme les autres. Les noms sont ceux du catalogue Aqua Plus 2026,
 * mot pour mot, lus au catalogue et jamais recopiés ici (`CLAUDE.md` §4 bis) ;
 * la double sortie, qui n'y est pas, porte le nom et la référence Aqua Plus
 * qu'il a donnés avec SA photo (*« avec cette photo et le nom, n'importe quel
 * fournisseur sait de quoi on parle »*).
 *
 * **Plus de réseaux que de voies au nez de robinet : on le garde et on prévient**
 * (`.claude/rules/arrosage.md`). Le Solem BL-NR n'a qu'une voie ; le manque se
 * dit sous le programmateur, en nombre de voies, et c'est lui qui décide.
 */

export type Montage = "nez" | "nourrice";
/** Le tuyau qui part du robinet : Ø16 rigide, Ø16 souple, Ø25 ou Ø32. */
export type Depart = 16 | "16s" | 25 | 32;

export type PieceDuRobinet = {
  ref: string;
  nom: string;
  /** La photo de la pile, dans `arrosage-robinet-photos/`, debout, telle que la planche la montre. */
  photo: string;
  /**
   * Où tombe le filetage sur la photo, en fraction de sa largeur, mesuré sur la
   * photo : ce point se pose sur l'axe commun de la pile (*« aligne-moi tous les
   * raccords »*, 18 octobre 2026). Centrer les photos ne suffisait pas.
   */
  axe: number;
  /** La hauteur de la photo dans la pile, en pixels, celle de la planche. */
  hauteur: number;
  /** Vrai quand aucune référence n'a été relevée : l'écran écrit « Réf. du fournisseur ». */
  sansReference?: boolean;
};

type Cat = {
  pieceAjoutable(ref: string): { ref: string; nom: string } | null;
  raccords16Rigide: { ref: string; nom: string }[];
};
const CAT = CATALOGUE as unknown as Cat;

/** Le nom du catalogue, et rien d'autre : une référence qui en sort fait tomber le module, pas mentir l'écran. */
function nomAuCatalogue(ref: string): string {
  const p = CAT.pieceAjoutable(ref) ?? CAT.raccords16Rigide.find((x) => x.ref === ref) ?? null;
  if (!p) throw new Error(`robinet.ts : « ${ref} » n'est plus au catalogue`);
  return p.nom;
}

export const DOSSIER_PHOTOS_ROBINET = "/arrosage-robinet-photos/";

export const ROBINET: {
  double: PieceDuRobinet;
  programmateur: PieceDuRobinet & { voies: number };
  raccord: Record<Depart, PieceDuRobinet>;
} = {
  // SA photo et SA référence Aqua Plus (18 octobre 2026) ; la sortie gauche est à 8 % de la photo.
  double: { ref: "BRO3493", nom: 'robinet 2 voies entrée 3/4" - 2 sorties 3/4"', photo: "BRO3493.jpg", axe: 0.08, hauteur: 66 },
  // Aqua Plus p. 26 ; une voie. La sortie est à 38 % de la photo.
  programmateur: { ref: "SP1151", nom: nomAuCatalogue("SP1151"), photo: "SP1151.png", axe: 0.38, hauteur: 90, voies: 1 },
  // Le Plasson à bague blanche ne prend que le PE 25 ou 32 (sa correction du
  // 18 octobre 2026) : le Ø16 souple part par l'embout Palaplast taraudé, le Ø16
  // rigide par le raccord taraudé à compression Plasson de sa gamme, sans référence.
  raccord: {
    "16s": { ref: "MID6362", nom: nomAuCatalogue("MID6362"), photo: "MID6362-debout.png", axe: 0.5, hauteur: 70 },
    16: { ref: "plasson16-raccord-taraude", nom: nomAuCatalogue("plasson16-raccord-taraude"), photo: "plasson-16-rigide-debout.png", axe: 0.545, hauteur: 70, sansReference: true },
    25: { ref: "OPL70302520", nom: nomAuCatalogue("OPL70302520"), photo: "OPL703016.png", axe: 0.49, hauteur: 70 },
    32: { ref: "OPL70303220", nom: nomAuCatalogue("OPL70303220"), photo: "OPL703016.png", axe: 0.49, hauteur: 70 },
  },
};

/** Ce que le calcul rend, pour ce que ce module en lit. */
type PlanPourLeDepart = { secteurs: { famille: string }[]; tuyau: { diametre: 25 | 32 } };

/** Vrai quand tout le jardin est en goutte-à-goutte : le seul cas où le Ø16 part du robinet. */
export function toutEnGoutteAGoutte(plan: Pick<PlanPourLeDepart, "secteurs">): boolean {
  return plan.secteurs.length > 0 && plan.secteurs.every((s) => s.famille === "Goutte-à-goutte");
}

/** Les départs qu'on peut lui proposer : Ø25 ou Ø32 dès qu'il y a des arroseurs. */
export function departsPossibles(plan: Pick<PlanPourLeDepart, "secteurs">): Depart[] {
  return toutEnGoutteAGoutte(plan) ? [16, "16s", 25, 32] : [25, 32];
}

/** Le départ que l'outil choisit : Ø16 rigide pour du goutte-à-goutte seul, sinon le diamètre que le calcul donne à l'amenée. */
export function departDeLOutil(plan: PlanPourLeDepart): Depart {
  if (toutEnGoutteAGoutte(plan)) return 16;
  return plan.tuyau.diametre === 32 ? 32 : 25;
}

/** Le départ retenu : le sien s'il en a choisi un encore possible, sinon celui de l'outil. */
export function departRetenu(plan: PlanPourLeDepart, choisi: Depart | null): Depart {
  return choisi !== null && departsPossibles(plan).includes(choisi) ? choisi : departDeLOutil(plan);
}

export function libelleDepart(d: Depart): string {
  return d === 16 ? "Ø16 rigide" : d === "16s" ? "Ø16 souple" : `Ø${d}`;
}

/** Le nom du tuyau qui part, tel que la liste l'écrit. */
export function nomDuTuyau(d: Depart): string {
  return d === 16 ? "PEBD rigide Ø16" : d === "16s" ? "Ø16 souple" : `PEHD Ø${d}`;
}

/** Au nez de robinet : combien de voies manquent au programmateur pour ce jardin, zéro quand il en a assez. */
export function voiesManquantes(plan: Pick<PlanPourLeDepart, "secteurs">, montage: Montage): number {
  if (montage !== "nez") return 0;
  return Math.max(0, plan.secteurs.length - ROBINET.programmateur.voies);
}

/** La phrase du manque, sous le programmateur, là où il regarde. */
export function phraseDuManque(plan: Pick<PlanPourLeDepart, "secteurs">, montage: Montage): string | null {
  const manque = voiesManquantes(plan, montage);
  if (!manque) return null;
  return `Il manque ${manque} voie${manque > 1 ? "s" : ""} : il en a ${ROBINET.programmateur.voies}, ce jardin demande ${plan.secteurs.length} réseaux.`;
}
