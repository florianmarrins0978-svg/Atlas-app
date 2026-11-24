import {
  JOURS_ESSAI,
  formule,
  jourEnLettres,
  jourEtMoisEnLettres,
  modulesConnus,
  montantDu,
  type FormuleCode,
  type ModuleCode,
  type Periodicite,
} from "./abonnements";
import { ttcEnCentimes } from "./changement-de-formule";
import { enEuros, enEurosEntiers } from "./euros";

// L'ESSAI AVEC LA CARTE — le modèle A, sa validation du 23 novembre 2026, et
// ses décisions du 24 (planche `appli/soignee/essai-avec-carte.html`) :
//
//   · après les conditions, « Votre essai » : la formule choisie, 0 € aujourd'hui,
//     la date du premier prélèvement, et le chemin pour résilier ;
//   · « Ajouter ma carte » ouvre le paiement du prestataire, quinze jours
//     d'essai, rien de débité avant ;
//   · sans carte, l'appli reste FERMÉE (*« Oui appli fermée ! »*), sur « Il
//     manque votre carte », avec la visite guidée pour qui hésite.
//
// **Une seule règle pour l'écran et pour l'action** (`CLAUDE.md` §3) : ce que
// la feuille annonce est ce que le prestataire débitera.

/** Ce que l'appli sait de l'abonnement pour décider de la carte (migration 0199). */
export type AbonnementPourLaCarte = {
  carteRequise: boolean;
  abonnementPrestataire: string | null;
  essaiDejaPris: boolean;
};

/**
 * La carte reste à poser : le compte est né quand le paiement était branché,
 * et aucun abonnement n'existe encore chez le prestataire. Un compte d'avant
 * le 24 novembre 2026 n'a jamais `carteRequise` : il n'est jamais fermé.
 */
export function doitPoserSaCarte(a: AbonnementPourLaCarte | null | undefined): boolean {
  return !!a && a.carteRequise && !a.abonnementPrestataire;
}

/**
 * Les jours d'essai que le paiement accorde : quinze, sauf pour une entreprise
 * dont le SIREN a déjà eu le sien (migration 0195), qui paie dès la carte posée.
 */
export function joursDEssaiAuPaiement(a: Pick<AbonnementPourLaCarte, "essaiDejaPris">): number {
  return a.essaiDejaPris ? 0 : JOURS_ESSAI;
}

export type ChoixDeLEssai = { formule: FormuleCode; periodicite: Periodicite; modules: readonly ModuleCode[] };

/**
 * **CE QUE « VOTRE ESSAI » PROPOSE QUAND RIEN N'A ÉTÉ CHOISI** — la formule la
 * moins chère, au mois, sans outils. Le site ne transmet pas encore son choix
 * à l'appli ; on ne présente donc jamais à l'artisan un prix plus haut que
 * celui qu'il aurait pu choisir. « Changer » mène aux trois formules
 * (Réglages, Abonnement), et rien n'est débité avant la fin de l'essai.
 */
export const CHOIX_PAR_DEFAUT: ChoixDeLEssai = { formule: "artisan", periodicite: "mensuelle", modules: [] };

export type ResumeDeLEssai = {
  formule: string;
  /** La formule seule, en euros HT, sur sa période. */
  prixFormule: number;
  modules: { nom: string; prix: number }[];
  /** Le jour du premier prélèvement ; aujourd'hui quand il n'y a pas d'essai. */
  premierPrelevement: Date;
  essai: boolean;
  montantHT: number;
  montantTTCCentimes: number;
  rythme: "par mois" | "par an";
};

/** Ce que « Votre essai » affiche, et que le paiement débitera. */
export function resumeDeLEssai(choix: ChoixDeLEssai, jours: number, maintenant: Date): ResumeDeLEssai | null {
  const f = formule(choix.formule);
  if (!f) return null;
  const annuel = choix.periodicite === "annuelle";
  const montantHT = montantDu(f, choix.periodicite, choix.modules);
  return {
    formule: f.nom,
    prixFormule: annuel ? f.prixAnnuel : f.prixMensuel,
    modules: modulesConnus(choix.modules).map((m) => ({ nom: m.nom, prix: annuel ? m.prixAnnuel : m.prixMensuel })),
    premierPrelevement: new Date(maintenant.getTime() + Math.max(0, jours) * 24 * 60 * 60 * 1000),
    essai: jours > 0,
    montantHT,
    montantTTCCentimes: ttcEnCentimes(montantHT),
    rythme: annuel ? "par an" : "par mois",
  };
}

/** Sous le relevé de « Votre essai » : comment arrêter, pour ne rien payer. */
export function phraseArreter(premierPrelevement: Date): string {
  return `Arrêtez avant le ${jourEtMoisEnLettres(premierPrelevement)} : vous ne payez rien. Il suffit de toucher « Résilier » dans Réglages, Abonnement.`;
}

/** Sous le titre de « Il manque votre carte » : ce qui se passe, et comment arrêter. */
export function phraseSansCarte(jours: number): string {
  if (jours <= 0) return "Votre entreprise a déjà eu son essai : l’abonnement commence dès que la carte est enregistrée.";
  return `Votre essai démarre dès qu’elle est enregistrée. Rien n’est débité avant ${jours} jours. Pour arrêter avant et ne rien payer, touchez « Résilier » dans Réglages, Abonnement.`;
}

/** « 39 € », ou « 70,80 € » quand le montant a des centimes. */
function montant(euros: number): string {
  return Number.isInteger(euros) ? enEurosEntiers(euros) : enEuros(euros);
}

export type LigneDeLEssai = { intitule: string; valeur: string; sous: string | null; changer?: true };

/**
 * LE RELEVÉ DE « VOTRE ESSAI », ligne à ligne, dans l'ordre de la planche :
 * la formule (qui se change), les outils ajoutés, aujourd'hui, le premier
 * prélèvement. Sans essai (le SIREN l'a déjà eu), « Aujourd'hui » porte ce qui
 * est débité tout de suite, et il n'y a pas de premier prélèvement à venir.
 */
export function lignesDeLEssai(r: ResumeDeLEssai): LigneDeLEssai[] {
  const par = r.rythme;
  const chaque = r.rythme === "par an" ? "chaque année" : "chaque mois";
  const total = `${montant(r.montantHT)} HT ${par}, soit ${montant(r.montantTTCCentimes / 100)} TTC`;
  return [
    { intitule: "Votre formule", valeur: r.formule, sous: `${montant(r.prixFormule)} HT ${par}`, changer: true },
    ...r.modules.map((m) => ({ intitule: `${m.nom.charAt(0).toUpperCase()}${m.nom.slice(1)}`, valeur: "Ajoutés", sous: `${montant(m.prix)} HT ${par}` })),
    r.essai
      ? { intitule: "Aujourd’hui", valeur: "0 €", sous: null }
      : { intitule: "Aujourd’hui", valeur: `${montant(r.montantTTCCentimes / 100)} TTC`, sous: `Puis ${chaque}` },
    ...(r.essai
      ? [{ intitule: "Premier prélèvement", valeur: `Le ${jourEnLettres(r.premierPrelevement)}`, sous: `${total}, puis ${chaque}` }]
      : []),
  ];
}

/** La ligne de « Il manque votre carte » : la formule avec ses outils, et son total. */
export function ligneDeLaFormule(r: ResumeDeLEssai): LigneDeLEssai {
  return {
    intitule: "Votre formule",
    valeur: r.modules.length > 0 ? `${r.formule} avec les outils` : r.formule,
    sous: `${montant(r.montantHT)} HT ${r.rythme}`,
  };
}

/**
 * La première ligne de « C'est fait », une fois la carte posée : l'essai que
 * tient le prestataire, et ce qui suit. `null` hors essai.
 */
export function ligneDeLEssaiPose(
  a: { formule: FormuleCode; periodicite: Periodicite; modules: readonly ModuleCode[]; essaiJusquAu: Date | null },
  maintenant: Date
): LigneDeLEssai | null {
  if (!a.essaiJusquAu || a.essaiJusquAu <= maintenant) return null;
  const f = formule(a.formule);
  if (!f) return null;
  const rythme = a.periodicite === "annuelle" ? "par an" : "par mois";
  return {
    intitule: "Votre essai",
    valeur: `Jusqu’au ${jourEtMoisEnLettres(a.essaiJusquAu)}`,
    sous: `Carte enregistrée. Puis ${montant(montantDu(f, a.periodicite, a.modules))} HT ${rythme}.`,
  };
}
