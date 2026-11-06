/**
 * HIVERNER L'ARROSAGE — les règles, sans base ni écran.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **Sa demande du 5 novembre 2026**, mot pour mot : *« Tous les clients où on
 * a facturé un arrosage automatique, il faudrait mettre une petite pastille à
 * côté du nom. Hiverner l'arrosage par exemple, à partir du mois de novembre
 * […] ça nous éviterait de les oublier. »* Planche
 * `appli/soignee/hiverner-l-arrosage.html`, sa réponse « la B » le 6 novembre ;
 * puis, le même jour : *« pour les contrats d'entretien, souvent, on fait
 * l'hivernage. Atlas demande s'il y a un arrosage automatique et si on fait
 * l'hivernage. »*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **ATLAS NE DEVINE PAS QUI A UN ARROSAGE.** Une ligne de facture n'est qu'un
 * texte : « arrosage de reprise » sur une plantation n'est pas un réseau, et
 * « 9 turbines et 2 électrovannes » en est un sans le mot. Une goutte posée
 * sur le mauvais client s'apprend à être ignorée. Le mot « arrosage » ne sert
 * donc qu'à POSER LA QUESTION ; la réponse, c'est lui qui la donne, une fois.
 *
 * **Deux questions, l'une après l'autre** : a-t-il un arrosage automatique,
 * puis faites-vous son hivernage. La goutte ne vaut que pour les deux « oui » :
 * un client dont l'hivernage est fait par un autre n'a rien à oublier chez nous.
 *
 * **« Non » ne se redemande pas** (décision du 6 novembre 2026, plus simple que
 * la planche qui disait « pour cette facture ») : un client à qui l'on a
 * répondu non ne revoit plus la question. La case de ses coordonnées le
 * change.
 *
 * **LA SAISON : du 1er novembre à la fin février**, à l'heure de Paris (le
 * jour se reçoit déjà compté là, `jourIso`). Hors saison, rien ne paraît : une
 * goutte en juillet dirait « à hiverner » sur un réseau qui arrose.
 */
import { creneauxPoses, type Creneau, type JourIso } from "./disponibilites";
import type { QuandPoser } from "./planning-jour";
import { jourLisibleCourt, estWeekEndIso } from "./mois";
import { jourEtMois } from "./jour";

/** Ce que porte un chantier posé depuis « Le prévoir », et que le planning lit comme travaux. */
export const TRAVAUX_DE_L_HIVERNAGE = "Hivernage de l’arrosage";

/** Ce que l'on sait de son arrosage. `null` : jamais demandé. */
export type FaitsDArrosage = {
  arrosageAutomatique: boolean | null;
  hivernageParNous: boolean | null;
  /** Le jour où l'hivernage a été fait (« C'est fait »). */
  hiverneLe: JourIso | null;
};

/**
 * Le 1er novembre qui ouvre la saison de ce jour, ou `null` hors saison.
 *
 * Janvier et février appartiennent à la saison ouverte l'année d'avant : un
 * hivernage fait le 20 décembre vaut encore le 10 février.
 */
export function debutDeLaSaison(jour: JourIso): JourIso | null {
  const [annee, mois] = jour.split("-").map(Number);
  if (!annee || !mois) return null;
  if (mois >= 11) return `${annee}-11-01`;
  if (mois <= 2) return `${annee - 1}-11-01`;
  return null;
}

/** Le dernier jour de la saison ouverte ce jour-là (le 28 ou le 29 février), ou `null` hors saison. */
export function finDeLaSaison(jour: JourIso): JourIso | null {
  const debut = debutDeLaSaison(jour);
  if (!debut) return null;
  const annee = Number(debut.slice(0, 4)) + 1;
  const dernier = new Date(Date.UTC(annee, 2, 0)).getUTCDate();
  return `${annee}-02-${String(dernier).padStart(2, "0")}`;
}

/**
 * UNE LIGNE PARLE-T-ELLE D'ARROSAGE ? Casse et accents ignorés.
 *
 * Elle ne décide de rien : elle fait seulement POSER la question sur la fiche
 * du client. C'est pourquoi un mot suffit, et qu'il ne faut pas en ajouter.
 */
export function parleDArrosage(libelle: string): boolean {
  return libelle
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .includes("arrosage");
}

/**
 * CE CLIENT EST-IL À HIVERNER CE JOUR-LÀ ? C'est ce qui fait porter la goutte.
 *
 * Il faut les deux « oui », la saison, et aucun hivernage noté depuis le
 * 1er novembre qui l'ouvre. **Un hivernage PRÉVU ne compte pas** : prévu n'est
 * pas fait, et c'est l'oubli que la goutte évite.
 */
export function aHiverner(faits: FaitsDArrosage, jour: JourIso): boolean {
  if (faits.arrosageAutomatique !== true || faits.hivernageParNous !== true) return false;
  const debut = debutDeLaSaison(jour);
  if (!debut) return false;
  return !(faits.hiverneLe && faits.hiverneLe >= debut && faits.hiverneLe <= jour);
}

/** « 1 arrosage à hiverner », « 2 arrosages à hiverner » : la ligne qui les rassemble. */
export function compteDesArrosages(n: number): string {
  return n === 1 ? "1 arrosage à hiverner" : `${n} arrosages à hiverner`;
}

/** Un hivernage posé au planning, tel que la fiche le lit. */
export type HivernagePose = { chantierId: string; jour: JourIso; moment: QuandPoser };

/**
 * Le moment d'un chantier posé, lu de son départ et de sa durée — les deux
 * colonnes que `poserUnClientAction` écrit.
 */
export function momentDuChantierPose(creneauDebut: string | null, dureeDemiJournees: number | null): QuandPoser {
  if ((dureeDemiJournees ?? 1) >= 2) return "journee";
  return creneauDebut === "apres_midi" ? "apres_midi" : "matin";
}

/**
 * L'HIVERNAGE PRÉVU QUE LA FICHE ANNONCE : dans la saison, le plus proche à
 * venir ; s'il n'y en a plus, le dernier passé (posé, pas encore noté fait).
 */
export function hivernagePrevu(poses: readonly HivernagePose[], jour: JourIso): HivernagePose | null {
  const debut = debutDeLaSaison(jour);
  const fin = finDeLaSaison(jour);
  if (!debut || !fin) return null;
  const saison = poses.filter((p) => p.jour >= debut && p.jour <= fin).sort((a, b) => a.jour.localeCompare(b.jour));
  return saison.find((p) => p.jour >= jour) ?? saison[saison.length - 1] ?? null;
}

/** « le matin », « l’après-midi », « toute la journée ». */
export function momentEnMots(moment: QuandPoser): string {
  return moment === "matin" ? "le matin" : moment === "apres_midi" ? "l’après-midi" : "toute la journée";
}

/** « Prévu le jeudi 12 novembre, le matin ». */
export function phraseDuPrevu(pose: { jour: JourIso; moment: QuandPoser }): string {
  return `Prévu le ${jourLisibleCourt(pose.jour).toLocaleLowerCase("fr")}, ${momentEnMots(pose.moment)}`;
}

/** Ce que la fiche du client dit de son arrosage. `null` : rien. */
export type CeQueLaFicheDit =
  | { genre: "question-arrosage"; pourquoi: string }
  | { genre: "question-hivernage" }
  | { genre: "a-hiverner"; prevu: HivernagePose | null }
  | { genre: "hiverne"; le: JourIso }
  | null;

/**
 * CE QUE LA FICHE DIT, dans l'ordre où les choses se savent.
 *
 * 1. L'arrosage jamais demandé : la question, seulement si une facture en
 *    parle ou s'il a un contrat d'entretien accepté. **La facture passe
 *    d'abord** : « Sa facture du 10 octobre parle d'arrosage » dit d'où vient
 *    la question, quand le contrat ne fait que la rendre probable.
 * 2. Un arrosage, l'hivernage jamais demandé : la seconde question, toujours.
 * 3. Les deux « oui » : à hiverner en saison, ou hiverné cette saison.
 *
 * Les deux questions ne dépendent pas de la saison : elles posent un fait,
 * qui servira l'hiver venu.
 */
export function ceQueLaFicheDit(
  entree: {
    faits: FaitsDArrosage;
    /** Le jour de sa plus récente facture dont une ligne parle d'arrosage. */
    factureQuiParle: JourIso | null;
    /** Un contrat d'entretien qu'il a accepté. */
    aUnContrat: boolean;
    poses: readonly HivernagePose[];
  },
  jour: JourIso
): CeQueLaFicheDit {
  const { faits } = entree;
  if (faits.arrosageAutomatique === null) {
    if (entree.factureQuiParle) {
      return { genre: "question-arrosage", pourquoi: `Sa facture du ${dateDeLaFacture(entree.factureQuiParle, jour)} parle d’arrosage.` };
    }
    if (entree.aUnContrat) return { genre: "question-arrosage", pourquoi: "Il a un contrat d’entretien." };
    return null;
  }
  if (faits.arrosageAutomatique === false) return null;
  if (faits.hivernageParNous === null) return { genre: "question-hivernage" };
  if (faits.hivernageParNous === false) return null;
  if (aHiverner(faits, jour)) return { genre: "a-hiverner", prevu: hivernagePrevu(entree.poses, jour) };
  const debut = debutDeLaSaison(jour);
  if (debut && faits.hiverneLe && faits.hiverneLe >= debut) return { genre: "hiverne", le: faits.hiverneLe };
  return null;
}

/** « 10 octobre », ou « 12 mai 2025 » quand ce n'est pas l'année de ce jour. */
function dateDeLaFacture(facture: JourIso, jour: JourIso): string {
  const annee = facture.slice(0, 4);
  return annee === jour.slice(0, 4) ? jourEtMois(facture) : `${jourEtMois(facture)} ${annee}`;
}

/** « Hiverné le 3 novembre ». */
export function phraseDuFait(le: JourIso): string {
  return `Hiverné le ${jourEtMois(le)}`;
}

/**
 * UN JOUR QUE « LE PRÉVOIR » PERMET DE CHOISIR : aujourd'hui ou après, en
 * semaine, et dans la saison ouverte ce jour-là.
 *
 * **Les fériés ne sont pas retirés** : l'application n'en connaît aucun
 * aujourd'hui (la planche des jours fériés n'est pas codée). Le jour où elle
 * les connaîtra, ils se retirent ici, et nulle part ailleurs.
 */
export function jourChoisissable(jour: JourIso, aujourdHui: JourIso): boolean {
  const fin = finDeLaSaison(aujourdHui);
  if (!fin) return false;
  return jour >= aujourdHui && jour <= fin && !estWeekEndIso(jour);
}

/** Les mois que la feuille de « Le prévoir » feuillette : de ce mois-ci à février. */
export function moisDuPrevoir(aujourdHui: JourIso): { annee: number; mois: number }[] {
  const fin = finDeLaSaison(aujourdHui);
  if (!fin) return [];
  const liste: { annee: number; mois: number }[] = [];
  let annee = Number(aujourdHui.slice(0, 4));
  let mois = Number(aujourdHui.slice(5, 7)) - 1;
  const finAnnee = Number(fin.slice(0, 4));
  while (annee < finAnnee || (annee === finAnnee && mois <= 1)) {
    liste.push({ annee, mois });
    mois += 1;
    if (mois > 11) {
      mois = 0;
      annee += 1;
    }
  }
  return liste;
}

/**
 * CE QUI EST DÉJÀ POSÉ À CE MOMENT-LÀ, en mots : « M. Lefèvre »,
 * « M. Lefèvre l’après-midi ». `null` : libre.
 *
 * Il ne refuse rien : le planning n'a pas de limite par jour (sa décision du
 * 21 août 2026). Il évite seulement de poser deux chantiers au même moment
 * sans le voir.
 */
export function ceQuiEstPose(matin: readonly string[], apres: readonly string[], moment: QuandPoser): string | null {
  const dire = (noms: readonly string[]) => [...new Set(noms)].join(", ");
  if (moment === "matin") return matin.length ? dire(matin) : null;
  if (moment === "apres_midi") return apres.length ? dire(apres) : null;
  if (!matin.length && !apres.length) return null;
  const memes = dire(matin) === dire(apres);
  if (memes) return `${dire(matin)} toute la journée`;
  return [matin.length ? `${dire(matin)} le matin` : null, apres.length ? `${dire(apres)} l’après-midi` : null]
    .filter(Boolean)
    .join(", ");
}

/** Une ligne du planning, ce qu'il faut pour savoir où elle est posée et qui elle nomme. */
export type ChantierDuPlanningLu = {
  nom: string;
  clientNom: string | null;
  datePlanifiee: string | null;
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
  creneaux?: readonly Creneau[] | null;
};

/**
 * CE QUE LE PLANNING PORTE DÉJÀ, demi-journée par demi-journée, entre deux
 * jours : la clé est celle du planning, `2026-11-12:matin`, la valeur les noms.
 *
 * **Les lignes sont celles que la personne VOIT au planning**
 * (`contextePlanning`, son tamis compris) et la règle des places est la sienne
 * (`creneauxPoses`) : une seconde lecture montrerait libre un matin que le
 * planning dit pris, ou nommerait un chantier qu'elle n'a pas le droit de voir.
 */
export function cePlanningPorte(
  lignes: readonly ChantierDuPlanningLu[],
  debut: JourIso,
  fin: JourIso
): Record<string, string[]> {
  const porte: Record<string, string[]> = {};
  for (const c of lignes) {
    if (!c.datePlanifiee) continue;
    const places = creneauxPoses({
      jour: c.datePlanifiee,
      moment: c.creneauDebut === "apres_midi" ? "apres_midi" : "matin",
      dureeDemiJournees: c.dureeDemiJournees,
      creneaux: c.creneaux,
    });
    for (const p of places) {
      if (p.jour < debut || p.jour > fin) continue;
      const cle = `${p.jour}:${p.moment}`;
      (porte[cle] ??= []).push(c.clientNom ?? c.nom);
    }
  }
  return porte;
}
