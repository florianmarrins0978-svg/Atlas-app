import { FUSEAU_DU_PATRON, jourEtMois, jourIso } from "./jour";
import type { AccordEnMots } from "./accord-bancaire";

/**
 * MA BANQUE, EN MOTS : règles pures de l'écran soigné (`appli/soignee/
 * reglages-banque.html`), sa demande du 1er novembre 2026, « code ça ».
 *
 * L'écran ne décide de rien : il pose chaque pastille et, à côté d'elle, ce
 * que rend ce fichier. Le sommaire des Réglages lit la même ligne de la banque
 * (`situationDeLaBanque`), pour qu'elle ne s'écrive pas deux fois.
 */

/**
 * Quand la banque a été lue : le jour, et l'heure de son atelier.
 *
 * **Le jour se compare en JOURS de son fuseau** (`jourIso`), jamais en
 * vingt-quatre heures : lue à 23 h 50, relue à 0 h 10, c'est « hier ».
 */
export function quandLaBanqueAEteLue(luLe: Date, maintenant: Date): { jour: string; heure: string } {
  const lu = jourIso(luLe);
  const aujourdHui = jourIso(maintenant);
  const jour = lu === aujourdHui ? "aujourd'hui" : lu === veille(aujourdHui) ? "hier" : `le ${jourEtMois(lu)}`;
  return { jour, heure: heureDeLAtelier(luLe) };
}

/**
 * « 20 h 24 », « 8 h 05 » : l'écriture de l'heure du dépôt
 * (`pdf/fiche-securite-pdf.ts`), dans le fuseau de l'atelier.
 */
function heureDeLAtelier(instant: Date): string {
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_DU_PATRON,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const h = Number(parties.find((p) => p.type === "hour")?.value ?? "0");
  const m = parties.find((p) => p.type === "minute")?.value ?? "00";
  return `${h} h ${m}`;
}

/** La veille d'un jour « AAAA-MM-JJ », comptée sur le calendrier et non en heures. */
function veille(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j - 1)).toISOString().slice(0, 10);
}

/**
 * La pastille de la lecture : « Lue » en vert, « Pas lue » en rouge, et ce qui
 * s'écrit à côté (sa demande du 1er novembre, « fais pareil pour pas lue »).
 *
 * **Le refus GARDÉ en base compte autant que celui de la lecture en cours.**
 * `luLe` est posé AVANT l'appel à la banque (`marquerBanqueLue`), pour que les
 * relectures de l'accueil ne brûlent pas les lectures permises. Après un refus,
 * une page rouverte dans la demi-heure ne relit pas : sans `refusGarde`, elle
 * affichait « Lue » à l'heure de la tentative ratée. Vu le 1er novembre en
 * éprouvant l'écran, le cas même qui l'avait fait douter ce soir-là.
 *
 * **Accord terminé : rien.** Sa pastille dit déjà pourquoi la banque ne se lit
 * plus ; un « Pas lue » de plus redirait la même chose en rouge.
 */
export function etatDeLaLecture(
  p: { luLe: Date | null; refusDeCetteLecture: string | null; refusGarde: string | null; accordTermine: boolean },
  maintenant: Date
): { ton: "vert" | "rouge"; etat: string; quand: string | null; raison: string | null } | null {
  if (p.accordTermine) return null;
  const quand = p.luLe ? quandLaBanqueAEteLue(p.luLe, maintenant) : null;
  const refus = p.refusDeCetteLecture ?? p.refusGarde;
  if (refus) {
    // « Pas lue » + l'heure entière ne tient pas sur la ligne à 360 px :
    // aujourd'hui, l'heure suffit.
    const date = quand ? (quand.jour === "aujourd'hui" ? `à ${quand.heure}` : `${quand.jour} à ${quand.heure}`) : null;
    return { ton: "rouge", etat: "Pas lue", quand: date, raison: refus };
  }
  return quand ? { ton: "vert", etat: "Lue", quand: `${quand.jour} à ${quand.heure}`, raison: null } : null;
}

/**
 * Ce qui s'écrit à côté de la pastille de l'accord, sa retouche du
 * 1er novembre : « la temporalité du renouvellement doit se situer à côté de
 * la pastille ». Court, pour tenir sur la ligne de la pastille dès 360 px.
 *
 * `null` quand l'accord est terminé : la pastille le dit seule, et
 * `accord.consequence` dit la suite dessous.
 */
export function echeanceDeLAccord(accord: AccordEnMots): string | null {
  if (accord.joursRestants <= 0) return null;
  if (accord.joursRestants === 1) return "demain";
  return `dans ${accord.joursRestants} jours`;
}

/**
 * Le nom d'un virement reçu, et le libellé de la banque à écrire dessous.
 *
 * **Le payeur d'abord**, quand la banque le donne. Sinon, le libellé EST le
 * nom : il ne se redit pas dessous, et il perd « VIR », « VIR INST » ou
 * « VIR SEPA » devant, qui disent seulement que c'est un virement (sa planche
 * du 1er novembre). Rien ne s'invente : ce qui reste est ce que la banque a
 * écrit.
 */
export function nomDuVirement(payeur: string | null, libelle: string): { nom: string; libelleDessous: string | null } {
  const brut = libelle.trim();
  if (payeur?.trim()) return { nom: payeur.trim(), libelleDessous: brut || null };
  const sansMotDeVirement = brut.replace(/^VIR(?:EMENT)?(?:\s+(?:INST|SEPA))?\s+/i, "").trim();
  return { nom: sansMotDeVirement || brut || "Sans nom", libelleDessous: null };
}

/** Les lignes du relevé d'une période, comptées par sens, et leurs sommes en centimes. */
export type CompteDuReleve = { entrees: number; centimesEntrees: number; sorties: number; centimesSorties: number };

/**
 * Le compte du relevé que Ma banque affiche, depuis le début du dossier en
 * cours. **En centimes entiers** : additionner des euros à virgule finit par
 * afficher 141,29 € pour 141,30 €.
 */
export function compteDuReleve(lignes: readonly { sens: "entree" | "sortie"; montant: string }[]): CompteDuReleve {
  const compte: CompteDuReleve = { entrees: 0, centimesEntrees: 0, sorties: 0, centimesSorties: 0 };
  for (const l of lignes) {
    const centimes = Math.round(Number(l.montant) * 100);
    if (!Number.isFinite(centimes)) continue;
    if (l.sens === "entree") {
      compte.entrees += 1;
      compte.centimesEntrees += centimes;
    } else {
      compte.sorties += 1;
      compte.centimesSorties += centimes;
    }
  }
  return compte;
}

/**
 * La ligne de Ma banque dans le sommaire des Réglages : « Crédit Mutuel, lue
 * aujourd'hui ». Le jour seul, sans l'heure : le sommaire montre, Ma banque
 * détaille.
 */
export function situationDeLaBanque(banque: string | null, luLe: Date | null, maintenant: Date): string {
  const nom = banque?.trim() || "Votre banque";
  return luLe ? `${nom}, lue ${quandLaBanqueAEteLue(luLe, maintenant).jour}` : nom;
}

/**
 * Le jour d'avant lequel la banque ne donne plus rien, sa remarque du
 * 1er novembre devant « La banque ne rend que 90 jours » : *« ça veut rien
 * dire »*. L'année s'écrit seulement si ce n'est pas la nôtre.
 */
export function lignesDAvant(debut: string, maintenant: Date): string {
  const annee = debut.slice(0, 4);
  return annee === jourIso(maintenant).slice(0, 4)
    ? `Votre banque ne donne pas les lignes d'avant le ${jourEtMois(debut)}.`
    : `Votre banque ne donne pas les lignes d'avant le ${jourEtMois(debut)} ${annee}.`;
}
