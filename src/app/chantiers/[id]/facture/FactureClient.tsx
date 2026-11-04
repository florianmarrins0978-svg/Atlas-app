"use client";

import { destinataireLisible } from "@/lib/numero-lisible";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps, voile } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";
import AvisNumeroTva from "@/components/atlas/AvisNumeroTva";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import IconeTrait from "@/components/atlas/IconeTrait";
import PastilleAjout from "@/components/atlas/PastilleAjout";
import { DEBUT_NUMERO_TVA, numeroTvaVide } from "@/lib/autoliquidation";
import { jourEtMois, jourLisible } from "@/lib/jour";
import { enEuros } from "@/lib/euros";
import { detailDeLaLigne } from "@/lib/detail-de-ligne";
import { LIBELLE_MAIN_DOEUVRE } from "@/lib/main-doeuvre-devis";
import { visionneuseDeLaFacture } from "@/lib/visionneuse-pdf";
import { composerMessageFacture, lienTransmission, type CanalClient } from "@/lib/message-client";
import { useRetourDeMessagerie, marquerDepartMessagerie } from "@/lib/depart-messagerie";
import { ouvrirAdresse } from "@/lib/ouvrir-messagerie";
import { adressePourLeClient, ouvrableParLeClient, phraseAdresseLocale } from "@/lib/adresse-du-client";
import ChoixCanal from "@/components/atlas/ChoixCanal";
import TransmettreLaFacture from "./TransmettreLaFacture";
import ReglementsRecus from "./ReglementsRecus";
import { majTitreFactureAction } from "./actions";
import { empreinteDesReglements, estAcquittee, type PromesseDuDevis } from "@/lib/acomptes-facture";
import type { ReglementEnregistre } from "@/server/repositories/paiements-facture";
import {
  terminerChantierAction,
  emettreFactureAction,
  preparerLienFactureAction,
  majEcheanceFactureAction,
  reprendreLeDevisAction,
  majDateTravauxFactureAction,
  majAutoliquidationFactureAction,
  majTvaClientFactureAction,
  majReferencesChorusFactureAction,
} from "./actions";
import ListeDesManques from "@/components/atlas/ListeDesManques";
import type { Manque } from "@/lib/mentions-manquantes";
import { estUneEntreprise, estUnClientPublic, type CiviliteClient } from "@/lib/civilite";
import { peutPreparerLaPiece } from "@/lib/preparation-devis";
import { echeanceMaxJours, lignesChorus, referenceChorusLue } from "@/lib/facture-publique";
import { jourIso } from "@/lib/jour";
import { libelleReduction, lignesParBloc, tauxLisible, totauxAvecReduction } from "@/lib/reduction-devis";
import type { EtatDeReprise } from "@/lib/facture-face-au-devis";
import { coordonneeDeCetEnvoi, peutTaperSaCoordonnee, type SituationDeLEnvoi } from "@/lib/coordonnee-de-cet-envoi";

// Arrêt 3 (docs/AGENT.md §2.3). Cet écran EST le contrôle : les montants du
// devis sont déjà là, il n'y a rien à saisir. Franchissable en un geste quand
// rien n'a bougé — mais franchi par le patron, jamais par l'application.
//
// **Les montants passent par `enEuros`, le formateur du dépôt** — sa planche
// du 2 novembre 2026 (`appli/soignee/facture.html`) relevait « Total HT
// 1772,00 € » : la copie d'`Intl` qui vivait ici gardait l'espace fine des
// milliers, que la police de l'écran ne dessine pas. Une seule façon d'écrire
// un euro (`src/lib/euros.ts`).

export type FacturePourEcran = {
  id: string;
  numeroCommercial: string;
  statut: "brouillon" | "emise";
  clientNom: string | null;
  /** Recopiée sur la facture à son établissement (migration 0038). */
  clientCivilite: CiviliteClient | null;
  /** La date de la facture — borne basse de l'échéance modifiable. */
  dateEmission: string;
  dateEcheance: string | null;
  /** La date des travaux, proposée d'après le planning (migration 0118). */
  dateTravaux: string | null;
  /** Sous-traitance du bâtiment, sans TVA (`src/lib/autoliquidation.ts`). */
  autoliquidation: boolean;
  clientNumeroTva: string | null;
  /** Recopié du devis : l'avis sur la clé du n° TVA le compare au SIREN. */
  clientSiret: string | null;
  /** Pour Chorus Pro, sur la facture d'un client public (migration 0137). */
  clientNumeroEngagement: string | null;
  clientCodeService: string | null;
  /** Le devis dont ces lignes viennent — le PDF le nomme, l'écran doit le nommer aussi. */
  numeroDevis: string | null;
  versionDevis: number | null;
  /**
   * **`null` : elle a été faite SANS devis** (migration 0086).
   *
   * Ce n'est pas la même chose qu'un `numeroDevis` absent, et les confondre
   * était le défaut : une facture née d'un devis qu'on n'arrive pas à relire
   * porte quand même « Reprise du devis » — c'est vrai, on ne sait juste pas
   * lequel. Une facture directe, elle, ne reprend RIEN, et l'écrire ferait
   * chercher au client un document qui n'existe pas.
   */
  devisId: string | null;
  tauxTva: string;
  /** Le prix accordé au client, recopié du devis. `null` : aucun. */
  reductionPourcent: string | null;
  /** Le même papier que le devis (migration 0092) : la main d'œuvre nommée, le titre. */
  mainDoeuvreHt: string | null;
  titre: string | null;
  /** Ce que le devis a promis : ses acomptes nomment et chiffrent chaque règlement reçu. */
  promesseDuDevis: PromesseDuDevis;
  reglements: ReglementEnregistre[];
  /**
   * **Les totaux ne sont PLUS transmis, et c'est délibéré.**
   *
   * Ils se recalculent ici par `totauxAvecReduction` — l'appel exact que fait
   * `emettreFacture` juste avant de figer la pièce. L'écran montre donc ce qui
   * PARTIRA, jamais une colonne de base qui aurait pu prendre du retard sur ses
   * lignes. Une seule règle pour l'affichage et pour l'émission (`CLAUDE.md` §3).
   */
  lignes: {
    id: string;
    libelle: string;
    montant: string;
    /** Sous le nom, en petit : « 120 m² à 6,50 € » (sa planche du 2 novembre 2026). */
    quantite: string;
    unite: string | null;
    prixUnitaire: string;
    tauxTva: string | null;
    /**
     * **Un travail ajouté APRÈS le devis (migration 0082).** Sans lui, l'écran
     * rangeait un supplément sous « Reprise du devis » : le patron l'a vu le
     * 10 septembre 2026 — *« ça n'apparaît nulle part, le client pense
     * simplement que j'ai rajouté une ligne »*.
     */
    supplement: boolean | null;
  }[];
};

/**
 * Les lignes de l'écran, dans une seule carte : le devis, puis les travaux en
 * plus, chacun marqué « En plus » (sa planche du 2 novembre 2026).
 *
 * **Le TRI vient de `lignesParBloc`, celui du papier** — c'est lui qui garantit
 * que le devis passe toujours en premier, quel que soit l'ordre en base. Les
 * deux cartes d'avant (« Reprise du devis », puis « Travaux supplémentaires »)
 * se rejoignent : la marque sur chaque ligne dit ce que le titre disait, et le
 * PDF garde ses deux blocs, où le client les lit.
 */
function lignesDeLEcran<T extends { tauxTva: string | null; supplement: boolean | null }>(
  lignes: T[],
  tauxDuDocument: string
): T[] {
  return lignesParBloc(lignes, tauxDuDocument).flatMap((groupe) => groupe.lignes);
}

export default function FactureClient({
  chantierId,
  initialFacture,
  origine,
  entrepriseNom,
  modeleMessage,
  clientId,
  clientTelephone,
  clientEmail,
  canalClient,
  situationEnvoi,
  jetonDejaPrepare = null,
  jetonAcquittePrepare = null,
  regimeTva,
  enFranchise,
  reprise,
  avoirs,
  envoyeeLe,
  suite,
}: {
  /**
   * Le jour où le lien du client a été préparé, donc où la messagerie s'est
   * ouverte avec lui (`dernierEnvoiFacture`) : la pastille « Envoyée le » de
   * sa planche du 2 novembre 2026. `null` : arrêtée sans être partie.
   */
  envoyeeLe: string | null;
  /**
   * Ce qui suit une facture partie, rendu au serveur (`SuiteDeLaFacture`) :
   * « Mon client ne me paie pas », puis « Il m'a payé ». Il se pose ICI, sous
   * « arrêtée », et non plus sous l'écran entier : sa planche les met avec le
   * reste de ce qu'il fait d'une facture envoyée, au-dessus du renvoi.
   */
  suite?: React.ReactNode;
  enFranchise: boolean;
  /** Ses avoirs (§413), lus parmi les règlements ; vide tant qu'elle n'est pas partie. */
  avoirs: readonly { id: string; numero: string; dateEmission: string; totalTtc: string }[];
  chantierId: string;
  initialFacture: FacturePourEcran | null;
  /**
   * La facture reprend-elle encore le devis qui fait foi ?
   *
   * Calculée au serveur par une fonction pure (`src/lib/facture-face-au-devis.ts`).
   * L'écran ne décide de rien : il montre ce qu'elle dit, et porte le geste.
   */
  reprise: EtatDeReprise;
  /** Adresse complète du site, bâtie côté serveur : un chemin seul ne s'ouvre nulle part. */
  origine: string;
  entrepriseNom: string;
  /**
   * Son gabarit de message, écrit dans « Devis & factures ». `null` : Atlas.
   *
   * **`modeleMessage`, jamais `messageClient`** : ce nom est pris ailleurs dans
   * l'application, où il désigne le mot laissé par le CLIENT — l'inverse.
   */
  modeleMessage: string | null;
  clientId: string | null;
  clientTelephone: string | null;
  clientEmail: string | null;
  canalClient: CanalClient | null;
  /**
   * Son client est-il supprimé, sa facture déjà partie ? Lu au serveur
   * (`situationDeLEnvoi`), par la lecture qu'il rejoue en écrivant le lien.
   * `null` : pas encore de facture.
   */
  situationEnvoi: SituationDeLEnvoi | null;
  /**
   * Le lien du client, s'il a déjà été préparé.
   *
   * Depuis le geste unique du 22 août 2026, l'envoi le fabrique en même temps
   * qu'il arrête la facture. Sans cette valeur, l'écran d'après redemanderait de
   * le préparer — un second appui pour refaire ce qui vient d'être fait.
   */
  jetonDejaPrepare?: string | null;
  /** Le lien d'exemplaire acquitté qui vaut encore, s'il y en a un (`jetonAcquitteVivant`). */
  jetonAcquittePrepare?: string | null;
  /**
   * Quand la TVA devient exigible chez cette entreprise (migration 0045).
   *
   * **La phrase qui suit l'émission en dépend, et ce n'est pas cosmétique.**
   * Aux encaissements, une facture arrêtée ne figure PAS au relevé : elle
   * attend son règlement. Lui dire l'inverse — ce que cet écran faisait — lui
   * ferait chercher dans son relevé un montant qui n'y est pas, et douter de
   * l'application au lieu de noter son paiement.
   */
  regimeTva: "encaissements" | "debits";
}) {
  const router = useRouter();
  useRetourDeMessagerie("/");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [emise, setEmise] = useState(initialFacture?.statut === "emise");
  // **Les règlements vivent ICI, pas seulement dans leur bloc** : l'envoi en
  // dépend. Une facture soldée part en exemplaire acquitté (23 octobre 2026),
  // et le lien préparé pour d'autres règlements ne vaut plus dès qu'ils
  // bougent : il imprimerait une autre date, un autre moyen.
  const [reglements, setReglements] = useState(initialFacture?.reglements ?? []);
  const [jetonAcquitte, setJetonAcquitte] = useState(jetonAcquittePrepare);
  // « Renvoyer par SMS ou e-mail », sous « Il m'a payé » (sa planche du
  // 2 novembre 2026) : le renvoi se déplie d'un appui, il ne prend plus la
  // place du geste qui reste à faire.
  const [renvoiOuvert, setRenvoiOuvert] = useState(false);

  // Le titre qu'il donne, comme sur le devis (sa planche du 14 septembre 2026).
  //
  // **La main d'œuvre, elle, ne se SAISIT plus ici — 21 septembre 2026.** Sa
  // correction : « + Main d'œuvre » vit sur la page où il remplit la facture,
  // exactement la place qu'il a sur le devis. Cet écran-là est l'arrêt 3 : il
  // montre ce qui partira, il ne le compose pas. Il la LIT donc, figée.
  const [titre, setTitre] = useState(initialFacture?.titre ?? "");

  // L'échéance — proposée par défaut à la création (son délai de paiement, ou
  // 30 jours), et modifiable ICI tant que la facture n'est pas arrêtée. Sa
  // demande du 25 août : « qu'il puisse la modifier », et si elle part sans
  // qu'il y touche, elle part quand même avec une VRAIE date, jamais un vide.
  const [dateEcheance, setDateEcheance] = useState<string | null>(initialFacture?.dateEcheance ?? null);
  const [refusEcheance, setRefusEcheance] = useState<string | null>(null);
  const [echeanceEnCours, setEcheanceEnCours] = useState(false);

  // La date des travaux (son choix 6A) : proposée d'après le planning, il la
  // change ici tant que la facture n'est pas partie.
  const [dateTravaux, setDateTravaux] = useState<string | null>(initialFacture?.dateTravaux ?? null);
  const [refusTravaux, setRefusTravaux] = useState<string | null>(null);

  async function changerDateTravaux(valeur: string) {
    if (!initialFacture) return;
    setRefusTravaux(null);
    const r = await majDateTravauxFactureAction(initialFacture.id, valeur);
    if (r.succes) setDateTravaux(r.dateTravaux);
    else setRefusTravaux(r.erreur);
  }

  // Sous-traitance, sans TVA (son bouton du 3 octobre 2026). Les taux changent
  // EN BASE : l'écran se relit, et les totaux suivent par le même calcul.
  const [sousTraitance, setSousTraitance] = useState(initialFacture?.autoliquidation ?? false);
  const [tvaClient, setTvaClient] = useState(initialFacture?.clientNumeroTva || DEBUT_NUMERO_TVA);
  const [refusSousTraitance, setRefusSousTraitance] = useState<string | null>(null);
  const [sousTraitanceEnCours, setSousTraitanceEnCours] = useState(false);
  const [manques, setManques] = useState<Manque[]>([]);

  async function basculerSousTraitance() {
    if (!initialFacture) return;
    setSousTraitanceEnCours(true);
    setRefusSousTraitance(null);
    try {
      const r = await majAutoliquidationFactureAction(initialFacture.id, !sousTraitance);
      if (!r.succes) {
        setRefusSousTraitance(r.erreur);
        return;
      }
      setSousTraitance(r.autoliquidation);
      setTvaClient(r.clientNumeroTva ?? "");
      router.refresh();
    } finally {
      setSousTraitanceEnCours(false);
    }
  }

  async function enregistrerTvaClient(valeur: string) {
    // « FR » laissé seul n'est pas une saisie : le refuser ferait croire à une faute.
    if (!initialFacture || numeroTvaVide(valeur) || valeur.trim() === (initialFacture.clientNumeroTva ?? "")) return;
    setRefusSousTraitance(null);
    const r = await majTvaClientFactureAction(initialFacture.id, valeur);
    if (r.succes) setTvaClient(r.clientNumeroTva);
    else setRefusSousTraitance(r.erreur);
  }

  // Une mairie, un département : sa facture se dépose sur Chorus Pro (ses
  // choix du 22 octobre 2026). La même règle que le dépôt (`civilite.ts`).
  const clientPublic = estUnClientPublic(initialFacture?.clientNom, initialFacture?.clientCivilite);
  const [numeroEngagement, setNumeroEngagement] = useState(initialFacture?.clientNumeroEngagement ?? "");
  const [codeService, setCodeService] = useState(initialFacture?.clientCodeService ?? "");
  const [refusChorus, setRefusChorus] = useState<string | null>(null);

  async function enregistrerChorus() {
    if (!initialFacture) return;
    setRefusChorus(null);
    const r = await majReferencesChorusFactureAction(initialFacture.id, { numeroEngagement, codeService });
    if (!r.succes) setRefusChorus(r.erreur);
  }

  async function changerEcheance(valeur: string) {
    if (!initialFacture) return;
    setEcheanceEnCours(true);
    setRefusEcheance(null);
    try {
      const r = await majEcheanceFactureAction(initialFacture.id, valeur);
      // On affiche ce que la BASE porte : une saisie hors bornes y est retombée.
      if (r.succes) setDateEcheance(r.dateEcheance);
      else setRefusEcheance(r.erreur);
    } finally {
      setEcheanceEnCours(false);
    }
  }

  // Le canal convenu avec le client ; à défaut, celui dont on a la coordonnée.
  // Ce n'est qu'un DÉPART : depuis le 12 août, l'écran offre l'autre voie sans
  // rien demander (`TransmettreLaFacture`). Auparavant ce choix était définitif,
  // et un client sans portable ne pouvait pas être facturé du tout.
  const canal: CanalClient = canalClient ?? (clientTelephone ? "sms" : "email");

  /**
   * Le canal de CET envoi — choisi sur l'écran, à côté du bouton.
   *
   * **Sa demande du 22 août 2026** (planche 84, proposition B) : *« au-dessus du
   * bouton, remettre le petit encart, soit SMS soit e-mail, et l'utilisateur
   * choisit »*. Il part de l'accord passé avec le client, et se corrige d'un
   * doigt sans quitter l'écran.
   */
  const [canalEnvoi, setCanalEnvoi] = useState<CanalClient>(canal);

  /**
   * **Son client supprimé, sa facture pas encore partie : il tape la
   * coordonnée** (sa demande du 3 novembre 2026, son choix « pour cet envoi
   * seulement », `appli/soignee/facture.html`, état « Client supprimé »). La
   * fiche n'en a plus, et rien ne s'y écrit : ce qu'il tape part avec CET
   * envoi, et le serveur le rejuge avant l'arrêt puis avant le lien. La case
   * suit le canal : changer de canal la vide.
   */
  const saisissable = situationEnvoi !== null && peutTaperSaCoordonnee(situationEnvoi);
  const [saisie, setSaisie] = useState("");
  const tapee = situationEnvoi && saisissable ? coordonneeDeCetEnvoi(situationEnvoi, canalEnvoi, saisie) : null;
  const destinataire = tapee
    ? tapee.ok
      ? tapee.destinataire
      : ""
    : ((canalEnvoi === "sms" ? clientTelephone : clientEmail) ?? "");

  function choisirCanal(c: CanalClient) {
    if (c !== canalEnvoi) setSaisie("");
    setCanalEnvoi(c);
  }

  const [repriseEnCours, setRepriseEnCours] = useState(false);

  /**
   * Reprend le dernier devis envoyé sur la facture encore en brouillon.
   *
   * Le geste que le refus juste au-dessus désigne : sans lui, l'écran dirait
   * « votre facture ne suit plus votre devis » sans offrir la moindre issue.
   */
  async function reprendreLeDevis() {
    if (!initialFacture) return;
    setRepriseEnCours(true);
    setErreur(null);
    try {
      const r = await reprendreLeDevisAction(initialFacture.id);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      // Les lignes et les montants viennent d'être réécrits côté serveur : on
      // relit l'écran plutôt que d'en reconstruire une copie ici.
      router.refresh();
    } catch {
      setErreur("Le devis n'a pas pu être repris.");
    } finally {
      setRepriseEnCours(false);
    }
  }

  async function terminer() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await terminerChantierAction(chantierId);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      // La facture vient d'être bâtie côté serveur : on relit l'écran plutôt
      // que d'en reconstruire une copie ici, qui pourrait s'en écarter.
      router.refresh();
    } catch {
      setErreur("La facture n'a pas pu être préparée.");
    } finally {
      setEnCours(false);
    }
  }

  /**
   * **UN SEUL GESTE : arrêter la facture, et ouvrir sa messagerie.**
   *
   * Le patron, le 22 août 2026, capture à l'appui : *« quand je clique sur
   * confirmer le départ de la facture, ça me l'arrête. Après, je clique pour
   * l'envoyer. Ensuite, je dois recliquer pour ouvrir l'application SMS. Ça
   * fait beaucoup trop de clics. »* Il en comptait trois ; il en reste un.
   * Retenu sur planche (`docs/maquettes/84-envoyer-la-facture.html`,
   * proposition B).
   *
   * ── L'ORDRE N'EST PAS UN DÉTAIL ──────────────────────────────────────────
   *
   * La messagerie s'ouvre **avant** de rafraîchir l'écran. Un navigateur peut
   * refuser une navigation vers `sms:` qui ne suit pas le doigt d'assez près,
   * et iOS la refuse **sans un mot** ; rafraîchir d'abord, c'est perdre le
   * geste. C'est le même ordre que l'envoi du devis, pour la même raison.
   *
   * ── CE QUI RESTE DERRIÈRE, ET POURQUOI ───────────────────────────────────
   *
   * Si l'ouverture est refusée, l'écran d'après porte toujours
   * `TransmettreLaFacture` — le message tout prêt, avec son bouton. La facture
   * est alors arrêtée sans être partie, et **c'est exactement ce que la
   * proposition A taisait** : le mot « envoyer » ne dit pas l'arrêt. D'où les
   * deux lignes sous le bouton, qui le disent.
   */
  /**
   * Arrête la facture d'une mairie avant d'en remettre le PDF : celui qu'on
   * dépose sur Chorus Pro doit porter son numéro définitif, jamais
   * « brouillon ». Les refus sont ceux de l'envoi, dits aux mêmes endroits.
   */
  async function arreterPourChorus(): Promise<boolean> {
    if (!initialFacture) return false;
    setEnCours(true);
    setErreur(null);
    setManques([]);
    try {
      // Ce qu'il vient de taper part avec elle, même s'il n'a pas quitté la case.
      await enregistrerChorus();
      const emission = await emettreFactureAction(initialFacture.id);
      if (!emission.succes) {
        if (emission.manques?.length) {
          setManques(emission.manques);
          setErreur("Il manque une mention obligatoire.");
        } else {
          setErreur(emission.erreur);
        }
        return false;
      }
      setEmise(true);
      return true;
    } catch {
      setErreur("La facture n'a pas pu être arrêtée.");
      return false;
    } finally {
      setEnCours(false);
    }
  }

  async function envoyerLaFacture() {
    if (!initialFacture) return;
    setEnCours(true);
    setErreur(null);
    try {
      setManques([]);
      const emission = await emettreFactureAction(
        initialFacture.id,
        saisissable ? { canal: canalEnvoi, saisie } : null
      );
      if (!emission.succes) {
        // Ce qui manque se LISTE, chaque ligne avec sa porte (son choix 1A) ;
        // la phrase seule l'enverrait chercher Réglages sans lien.
        if (emission.manques?.length) {
          setManques(emission.manques);
          setErreur("Il manque une mention obligatoire.");
        } else {
          setErreur(emission.erreur);
        }
        return;
      }
      setEmise(true);

      const lien = await preparerLienFactureAction(initialFacture.id, canalEnvoi, saisissable ? saisie : null);
      if (!lien.succes) {
        // **La facture EST arrêtée, et il doit le savoir.** Taire l'émission
        // parce que le lien a manqué lui ferait croire que rien n'a eu lieu —
        // et il rappuierait sur un bouton qui a déjà engagé sa comptabilité.
        setErreur(
          `Facture arrêtée, mais le lien n'a pas pu être préparé. ${lien.erreur} ` +
            `Le message tout prêt vous attend ci-dessous.`
        );
        router.refresh();
        return;
      }

      // **LE MESSAGE MORT NE PART PAS — posé le 24 août 2026.** Le lien prend
      // l'adresse par laquelle Atlas est ouvert ; celle d'une redirection de
      // port ne désigne que sa machine, et son client reçoit « Connexion au
      // serveur impossible » (`ARCHITECTURE.md` §169).
      //
      // **La facture est déjà ARRÊTÉE ici**, et c'est tout le sens du refus :
      // on ne défait pas son émission — elle a engagé sa comptabilité — on
      // barre le seul message qui n'arriverait nulle part. L'écran d'après
      // porte `TransmettreLaFacture`, qui redit la même chose sous le bouton.
      // L'adresse du navigateur d'abord : derrière le tunnel de son espace de
      // travail, le serveur ne voit que `localhost` (`adressePourLeClient`).
      const adresse = adressePourLeClient(origine);
      if (!ouvrableParLeClient(adresse)) {
        setErreur(phraseAdresseLocale("votre facture"));
        router.refresh();
        return;
      }

      marquerDepartMessagerie("facture", initialFacture.clientNom ?? "");
      ouvrirAdresse(
        lienTransmission({
          canal: canalEnvoi,
          destinataire,
          message: composerMessageFacture({
            clientCivilite: initialFacture.clientCivilite,
            clientNom: initialFacture.clientNom ?? "",
            entrepriseNom,
            modele: modeleMessage,
            numeroFacture: initialFacture.numeroCommercial,
            echeanceLisible: dateEcheance ? jourLisible(dateEcheance) : null,
            lien: `${adresse}/factures/${lien.jeton}`,
          }),
        }),
        canalEnvoi
      );

      // Après l'ouverture, jamais avant : l'écran repasse alors sur sa face
      // « arrêtée », qui porte le message tout prêt si la messagerie a refusé.
      router.refresh();
    } catch {
      setErreur("La facture n'a pas pu être envoyée.");
    } finally {
      setEnCours(false);
    }
  }


  if (!initialFacture) {
    return (
      <div className="mt-5 flex flex-col gap-3 px-[22px]">
        <div className="rounded-[6px] px-5 py-6" style={{ backgroundColor: colors.card }}>
          <p className="text-center text-[15px]" style={{ color: colors.ink }}>
            Le chantier est réalisé ?
          </p>
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.muted }}>
            La facture sera préparée à partir du devis. Rien ne part avant votre
            confirmation.
          </p>
        </div>
        {erreur && (
          <p role="alert" className="text-center text-[13px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}
        <PrimaryButton pleineLargeur disabled={enCours} onClick={terminer}>
          {enCours ? "Préparation…" : "Créer la facture"}
        </PrimaryButton>
      </div>
    );
  }

  // **LE MÊME CALCUL QUE L'ÉMISSION, appelé et non réécrit.** `emettreFacture`
  // fige la pièce sur `totauxAvecReduction(lignes, tauxTva, reductionPourcent)` :
  // l'écran de l'arrêt doit montrer ce chiffre-là, et pas une colonne de base
  // qui aurait pu prendre du retard sur ses propres lignes.
  const totaux = totauxAvecReduction(
    initialFacture.lignes,
    initialFacture.tauxTva,
    initialFacture.reductionPourcent
  );
  const libelleRemise = libelleReduction(totaux.reductionPourcent);
  // **« dont main d'œuvre HT » se LIT comme les autres lignes du total** — sa
  // planche du 2 novembre 2026 relevait « 380 € » sans ses centimes : la case
  // figée de la feuille (`LigneMainDoeuvre`) montrait la valeur comme il
  // l'aurait tapée. Ici il ne tape rien (21 septembre 2026), il vérifie : le
  // montant s'écrit donc comme tous les montants, par `enEuros`.
  const ligneMainDoeuvre =
    initialFacture.mainDoeuvreHt === null ? null : (
      <Ligne label={LIBELLE_MAIN_DOEUVRE} valeur={initialFacture.mainDoeuvreHt} repere="montant-main-doeuvre" />
    );

  /**
   * Cette facture a-t-elle de quoi partir ?
   *
   * **La même règle que le devis**, nommée pour la pièce qu'on regarde — c'est
   * ce qui lui évite de lire le mot « devis » sur ce qu'il facture (sa règle du
   * 11 septembre). Les lignes de l'écran portent déjà ce qu'elle demande : un
   * libellé et un montant.
   */
  const verdictEnvoi = peutPreparerLaPiece(initialFacture.lignes, "facture");

  // La borne haute du sélecteur : un an après la facture (au-delà, c'est
  // l'année mal tapée). La borne basse est la date de la facture elle-même.
  const maxEcheance = jourIso(
    new Date(Date.parse(`${initialFacture.dateEmission}T00:00:00Z`) + echeanceMaxJours(clientPublic) * 86_400_000)
  );

  const sansDevis = initialFacture.devisId === null;
  const lignesAffichees = lignesDeLEcran(initialFacture.lignes, initialFacture.tauxTva);
  /** Tout est réglé : c'est l'exemplaire acquitté qui part (23 octobre 2026). */
  const acquittee = estAcquittee(totaux.totalTtc, reglements);
  /**
   * Le renvoi se déplie d'office quand c'est LUI qui reste à faire : la facture
   * arrêtée n'est jamais partie (le lien n'a pas pu se préparer, et c'est ce
   * bloc qui le rattrape), ou elle est soldée et l'exemplaire acquitté attend.
   * Le reste du temps, « Il m'a payé » est le geste, et le renvoi passe dessous.
   */
  const renvoiVisible = renvoiOuvert || !jetonDejaPrepare || acquittee;

  return (
    <div className="mt-5 flex flex-col gap-3 px-[22px]">
      {/* ─── LA PIÈCE — sa planche du 2 novembre 2026 ─────────────────────────
          Le numéro en grand, en serif ; le titre en italique dessous, comme sur
          le papier ; puis l'échéance et l'état en pastilles, un point ET un mot
          (`EtatEcrit`). Le client n'est plus répété ici : il est sous le titre
          de l'écran, avec sa civilité. */}
      <section className="rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }} data-atlas="piece-facture">
        <p className="text-[22px] leading-[1.2]" style={{ color: colors.ink, fontFamily: font.display }}>
          <NumeroDeDocument valeur={initialFacture.numeroCommercial} />
        </p>
        {/* Son titre — « Aménagement du jardin » —, en italique comme sur le
            papier. Jamais d'office : vide, rien ne s'imprime. */}
        {(!emise || titre) && (
          <input
            value={titre}
            readOnly={emise}
            placeholder="Titre (optionnel)"
            aria-label="Titre de la facture"
            data-atlas="titre-facture"
            onChange={(e) => setTitre(e.target.value)}
            onBlur={(e) => void majTitreFactureAction(initialFacture.id, e.currentTarget.value)}
            className="mt-0.5 block w-full border-0 bg-transparent p-0 italic outline-none focus:bg-[var(--voile-champ)]"
            style={{ color: colors.inkSoft, fontFamily: font.display, fontSize: "18px", lineHeight: 1.3 }}
          />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* L'ÉCHÉANCE — proposée, et modifiable tant que la facture n'est pas
              arrêtée (sa demande du 25 août). Émise, elle est partie chez le
              client et inscrite au relevé : on la fige.

              **Au brouillon, la pastille EST le champ** : le sélecteur de date,
              transparent, la couvre exactement, et le crayon dit qu'elle se
              touche. Le natif garde ce qu'il sait faire (le calendrier d'iOS,
              les bornes) ; la pastille dit la date comme une phrase. */}
          {dateEcheance &&
            (emise ? (
              <EtatEcrit ton="ambre">À régler avant le {jourLisible(dateEcheance)}</EtatEcrit>
            ) : (
              <label className="relative inline-flex">
                <EtatEcrit ton="ambre">
                  À régler avant le {jourLisible(dateEcheance)}
                  <IconeTrait nom="crayon" taille={13} />
                </EtatEcrit>
                <input
                  type="date"
                  data-atlas="echeance-facture"
                  aria-label="À régler avant le"
                  value={dateEcheance}
                  min={initialFacture.dateEmission}
                  max={maxEcheance}
                  disabled={echeanceEnCours}
                  onChange={(e) => {
                    if (e.target.value) changerEcheance(e.target.value);
                  }}
                  onClick={ouvrirLeCalendrier}
                  // 16 px : sous ce seuil, iOS zoome à l'ouverture du sélecteur.
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  style={{ fontSize: 16 }}
                />
              </label>
            ))}
          {/* L'ÉTAT : « Envoyée le » quand le lien du client est parti avec sa
              messagerie, « Brouillon » avant. Arrêtée sans être partie (le lien
              n'a pas pu se préparer), elle le dit, en gris : c'est le bloc du
              renvoi, plus bas, qui le rattrape. */}
          {emise ? (
            envoyeeLe ? (
              <EtatEcrit ton="vert" dataAtlas="etat-facture">
                Envoyée le {jourEtMois(envoyeeLe)}
              </EtatEcrit>
            ) : (
              <EtatEcrit dataAtlas="etat-facture">Pas encore envoyée</EtatEcrit>
            )
          ) : (
            <EtatEcrit ton="bleu" dataAtlas="etat-facture">
              Brouillon
            </EtatEcrit>
          )}
        </div>
        {refusEcheance && (
          <p role="alert" data-atlas="echeance-refus" className="mt-1.5 text-[12px]" style={{ color: colors.alert }}>
            {refusEcheance}
          </p>
        )}
        {/* LA DATE DES TRAVAUX — mention de la pièce (242 nonies A), proposée
            d'après le planning, modifiable tant qu'elle n'est pas partie : la
            phrase est le champ, comme la pastille de l'échéance. */}
        {dateTravaux &&
          (emise ? (
            <p className="mt-2 text-[13px]" style={{ color: colors.inkSoft }}>
              Travaux réalisés le {jourLisible(dateTravaux)}
            </p>
          ) : (
            <label className="relative mt-2 inline-flex items-center gap-1.5 text-[13px]" style={{ color: colors.inkSoft }}>
              Travaux réalisés le {jourLisible(dateTravaux)}
              <IconeTrait nom="crayon" taille={13} />
              <input
                type="date"
                data-atlas="date-travaux-facture"
                aria-label="Travaux réalisés le"
                value={dateTravaux}
                onChange={(e) => {
                  if (e.target.value) void changerDateTravaux(e.target.value);
                }}
                onClick={ouvrirLeCalendrier}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                style={{ fontSize: 16 }}
              />
            </label>
          ))}
        {refusTravaux && (
          <p role="alert" className="mt-1 text-[12px]" style={{ color: colors.alert }}>
            {refusTravaux}
          </p>
        )}
        {/* ─── POUR CHORUS PRO — ses choix du 22 octobre 2026
            (`appli/facture-mairie-chorus.html`). Le numéro d'engagement est
            celui de SON bon de commande ; le code service vient de la fiche et
            se change ici pour elle seule. Vide est permis : certaines mairies
            n'en donnent pas, et une ligne grise le rappelle sans rien bloquer. */}
        {clientPublic &&
          (emise ? (
            lignesChorus({ numeroEngagement, codeService }).map((l) => (
              <p key={l} className="mt-1.5 text-[13px]" style={{ color: colors.muted }}>
                {l}
              </p>
            ))
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={smallCaps} style={{ color: colors.muted }}>
                  N° d’engagement
                </span>
                <input
                  type="text"
                  data-atlas="numero-engagement"
                  className="atlas-case"
                  placeholder="Sur son bon de commande"
                  value={numeroEngagement}
                  onChange={(e) => setNumeroEngagement(e.target.value)}
                  onBlur={() => void enregistrerChorus()}
                  style={{ color: colors.ink }}
                />
                {referenceChorusLue(numeroEngagement) === "" && (
                  <span className="text-[12.5px]" style={{ color: colors.muted }}>
                    Vide : Chorus Pro peut la refuser.
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={smallCaps} style={{ color: colors.muted }}>
                  Code service
                </span>
                <input
                  type="text"
                  data-atlas="code-service-facture"
                  className="atlas-case"
                  value={codeService}
                  onChange={(e) => setCodeService(e.target.value)}
                  onBlur={() => void enregistrerChorus()}
                  style={{ color: colors.ink }}
                />
              </label>
              {refusChorus && (
                <p role="alert" className="text-[12px]" style={{ color: colors.alert }}>
                  {refusChorus}
                </p>
              )}
            </div>
          ))}
      </section>

      {/* ── LA FACTURE NE SUIT PLUS LE DEVIS ────────────────────────────────
          **Le défaut le plus cher de cet écran, et il était muet.** Une facture
          bâtie à la fin du chantier garde les lignes du devis d'alors ; un devis
          corrigé et renvoyé ensuite ne l'atteignait jamais. Il confirmait donc
          l'ancien prix, sur le seul écran qui engage son argent.

          **Ce bloc passe AVANT les montants**, et c'est tout son sens : lu après,
          il arriverait une fois le total déjà cru. */}
      {!reprise.aJour && (
        <div
          className="py-1 pl-[13px]"
          style={{ borderLeft: `1px solid ${colors.alert}` }}
          data-atlas="facture-en-retard-sur-le-devis"
        >
          <p className="text-[13px] leading-[1.4]" style={{ color: colors.ink }}>
            Le devis <NumeroDeDocument valeur={reprise.numeroCommercial} /> v
            {reprise.numeroVersion} est parti depuis. Cette facture porte encore
            les montants d&apos;avant.
          </p>
          <div className="mt-2">
            <PrimaryButton pleineLargeur
              secondaire
              disabled={repriseEnCours}
              onClick={reprendreLeDevis}
              repere="reprendre-le-devis"
            >
              {repriseEnCours ? "Reprise…" : "Reprendre ce devis"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── LES LIGNES, DANS UNE SEULE CARTE — sa planche du 2 novembre 2026 ──
          **Les travaux en plus rejoignent les lignes du devis**, chacun marqué
          « En plus ». C'est toujours ce que demandait sa capture du 10 septembre
          — *« sinon le client pense simplement que j'ai rajouté une ligne »* — :
          la marque le dit sur la ligne même, et le PDF garde ses deux blocs
          (`lignesParBloc`, le même tri qu'ici).

          **Chaque ligne dit sa quantité et son prix en petit dessous**
          (`detailDeLaLigne`, la même règle que sur les travaux en plus).

          **Le devis se NOMME, version comprise.** Le papier écrit « Établie à
          partir du devis n° … » depuis toujours ; et les deux versions d'un devis
          portent le même numéro commercial (capture du 4 septembre) : sans le
          « v », « Reprise du devis 2026-000003 » côtoyait « Le devis 2026-000003
          est parti depuis ». Rien au-dessus d'une facture faite sans devis
          (migration 0086) : elle ne reprend rien, et cet écran se photographie. */}
      {(lignesAffichees.length > 0 || (!emise && reprise.aJour)) && (
        <section className="rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }} data-atlas="lignes-de-la-facture">
          {!sansDevis && lignesAffichees.length > 0 && (
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.inkSoft }}>
              Reprise du devis
              {initialFacture.numeroDevis && (
                <>
                  {" "}
                  <NumeroDeDocument valeur={initialFacture.numeroDevis} />
                  {initialFacture.versionDevis ? ` v${initialFacture.versionDevis}` : ""}
                </>
              )}
            </p>
          )}
          <ul>
            {lignesAffichees.map((l, i) => (
              <li
                key={l.id}
                data-atlas="ligne-de-facture"
                className="flex items-baseline justify-between gap-[14px] py-2.5"
                style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.lineSoft}` } : undefined}
              >
                {/* **Les travaux réunis s'empilent, un par ligne.** Depuis que le
                    devis sépare ses prestations par un retour à la ligne (7 août,
                    `src/lib/lignes-vendables.ts`), un `truncate` affichait
                    « Abattage d'un chêne mort Br… » : c'est à cet écran-là que
                    le patron vérifie avant que la facture parte (arrêt 3), et lui
                    cacher la moitié de ce qu'il facture est exactement ce qu'il ne
                    faut pas faire. */}
                <span className="min-w-0 flex-1 text-[16px] leading-[1.4]" style={{ color: colors.ink }}>
                  <span data-atlas="libelle-de-ligne" className="whitespace-pre-line break-words">
                    {l.libelle}
                  </span>
                  {l.supplement && (
                    <span
                      data-atlas="en-plus"
                      className="ml-1.5 inline-block rounded-[10px] px-2 py-px align-[2px] text-[12.5px] font-semibold leading-[1.3]"
                      style={{ color: colors.or, boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.55)}` }}
                    >
                      En plus
                    </span>
                  )}
                  <small className="mt-0.5 block text-[14px] tabular-nums" style={{ color: colors.inkSoft }}>
                    {detailDeLaLigne(l)}
                  </small>
                </span>
                <span className="flex-none whitespace-nowrap text-[16px] tabular-nums" style={{ color: colors.ink }}>
                  {enEuros(l.montant)}
                </span>
              </li>
            ))}
          </ul>
          {/* ─── LES TRAVAUX EN PLUS, SOUS LES LIGNES — sa planche du 2 novembre
              2026. **Le bouton flottant d'avant couvrait la dernière ligne et
              l'interrupteur** pendant qu'on faisait défiler la page (sa capture
              du même jour) : il devient une pastille, à la place de ce qu'elle
              complète, et plus rien ne passe dessous.

              **Le geste ne s'offre que sur un BROUILLON**, et la page qu'il
              ouvre refuse d'elle-même si la facture est partie : une facture
              arrêtée est inscrite au relevé de TVA, elle ne se complète plus.
              Il se tait aussi quand un devis plus récent est parti : le bandeau
              du dessus dit déjà quoi faire (capture du 4 septembre).

              **Le mot change avec la pièce.** Sur une facture née d'un devis, ce
              qu'on ajoute EST un travail en plus. Sur une facture directe, il n'y
              a pas de supplément : il y a les lignes, et c'est le seul endroit où
              on les saisit (planche du 10 septembre 2026, point 1). */}
          {!emise && reprise.aJour && (
            <div className={lignesAffichees.length > 0 ? "mt-4" : ""}>
              <PastilleAjout
                libelle={sansDevis ? "Remplir la facture" : "Travaux en plus"}
                icone="plus"
                or
                onClick={() => router.push(`/chantiers/${chantierId}/facture/travaux-supplementaires`)}
                repere="ajouter-travaux-supplementaires"
              />
            </div>
          )}
        </section>
      )}

      {/* ── SOUS-TRAITANCE, SANS TVA ─────────────────────────────────────
          Son bouton du 3 octobre 2026, dans son cadre doré. Ne s'offre ni en
          franchise (déjà sans TVA), ni sur une facture partie, et **plus sur
          une facture née d'un devis** (4 octobre 2026) : elle suit le devis,
          coché ou non. Reste celle faite sans devis, pour une entreprise. */}
      {!emise &&
        !enFranchise &&
        initialFacture.devisId === null &&
        estUneEntreprise(initialFacture.clientNom, initialFacture.clientCivilite) && (
        <div
          className="rounded-[4px] px-5 py-4"
          data-atlas="carte-sous-traitance"
          style={{ backgroundColor: colors.card, boxShadow: `0 0 0 2px ${colors.or}`, borderRadius: 14 }}
        >
          <div className="flex items-center justify-between gap-3 text-[15px]" style={{ color: colors.ink }}>
            <span>
              Sous-traitance, sans TVA
              <small className="block text-[12.5px]" style={{ color: colors.muted }}>
                Seulement si vous êtes sous-traitant d’une autre entreprise.
              </small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={sousTraitance}
              aria-label="Sous-traitance, sans TVA"
              data-atlas="sous-traitance"
              disabled={sousTraitanceEnCours}
              onClick={() => void basculerSousTraitance()}
              className="relative h-7 w-[46px] flex-none rounded-full"
              style={{ backgroundColor: sousTraitance ? colors.rust : colors.line }}
            >
              <span
                className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left]"
                style={{ left: sousTraitance ? 21 : 3, backgroundColor: colors.card }}
              />
            </button>
          </div>
          {sousTraitance && (
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: colors.muted }}>
                N° TVA de l’entreprise qui vous sous-traite
              </span>
              <input
                type="text"
                data-atlas="tva-client"
                className="atlas-case"
                placeholder="FR suivi de 11 chiffres"
                value={tvaClient}
                onChange={(e) => setTvaClient(e.target.value)}
                onBlur={(e) => void enregistrerTvaClient(e.currentTarget.value)}
                style={{ color: colors.ink }}
              />
              <AvisNumeroTva
                siret={initialFacture?.clientSiret ?? ""}
                numeroTva={tvaClient}
                onMettre={(juste) => {
                  setTvaClient(juste);
                  void enregistrerTvaClient(juste);
                }}
              />
            </label>
          )}
          {refusSousTraitance && (
            <p role="alert" className="mt-2 text-[12px]" style={{ color: colors.alert }}>
              {refusSousTraitance}
            </p>
          )}
        </div>
      )}

      <section className="rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }} data-atlas="totaux-facture">
        {/* ── LE TOTAL SE RECOMPOSE À LA MAIN, LIGNE À LIGNE ─────────────────
            **Deux choses manquaient ici, et le papier les imprimait toutes les
            deux.** Le prix accordé au client : la somme des lignes au-dessus ne
            faisait alors pas le Total HT écrit ici, et rien ne disait pourquoi.
            Et les taux : chaque ligne porte le sien depuis la migration 0073,
            l'écran n'en annonçait qu'un.

            Un total qu'on ne peut pas refaire de tête est un total qu'on cesse
            de croire — et c'est LUI qui le défend devant son client. Les
            libellés et l'ordre sont ceux du papier (`document-commun.ts`), tirés
            de la même fonction : deux rédactions du même prix accordé finiraient
            par se contredire. */}
        {/* « dont main d'œuvre HT » sous le PREMIER Total HT écrit — brut avec
            une remise, net sans —, à la même place que sur le devis. */}
        {libelleRemise ? (
          <>
            <Ligne label="Total HT" valeur={totaux.brutHt} />
            {ligneMainDoeuvre}
            <Ligne label={libelleRemise} valeur={totaux.reductionMontant ?? "0"} retire />
            <Ligne label="Total HT après remise" valeur={totaux.totalHt} />
          </>
        ) : (
          <>
            <Ligne label="Total HT" valeur={totaux.totalHt} />
            {ligneMainDoeuvre}
          </>
        )}
        {initialFacture.autoliquidation ? (
          <Ligne label="TVA, autoliquidation" valeur="0" />
        ) : (
          totaux.parTaux.map((categorie) => (
            <Ligne
              key={categorie.taux}
              label={`TVA ${tauxLisible(categorie.taux)} %`}
              valeur={categorie.tva}
            />
          ))
        )}
        {/* ─── LE TOTAL TTC, AU MILIEU, EN OR — sa planche du 2 novembre 2026 :
            « en plus gros », puis « trop gros, juste milieu » : 46 px (40 au
            départ, 54 de trop). L'or remplace la terre cuite des documents :
            c'est le chiffre de l'écran qu'il lit en premier, et la planche le
            pose dans l'or de l'application, ici comme sur les travaux en plus.

            **L'intitulé reste à l'encre, pas en gris** — sa demande du 24 août
            2026, capture à l'appui : c'est l'intitulé du montant qu'il vérifie ;
            en gris, il passait pour une mention de bas de page. La planche le
            dessinait en gris ; sa demande d'août l'emporte. */}
        <div className="mt-2.5 pt-3.5 text-center" style={{ boxShadow: `inset 0 1px 0 ${colors.line}` }}>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.ink }}>
            {initialFacture.autoliquidation ? "Total à payer" : "Total TTC"}
          </p>
          <p
            data-atlas="total-ttc-facture"
            className="mt-1.5 text-[46px] leading-none tabular-nums"
            style={{ fontFamily: font.display, color: colors.or, letterSpacing: "-0.02em" }}
          >
            {enEuros(totaux.totalTtc)}
          </p>
        </div>
        {/* ─── « VOIR LE PDF » ET « TÉLÉCHARGER », EN PASTILLES ────────────────
            Sans ce geste, la facture existe sans que personne puisse la
            regarder : le patron valide un montant sans avoir vu la pièce que son
            client recevra (docs/AGENT.md §2.3).

            **Dans l'application, pas dans un onglet de Safari** — sa capture du
            11 septembre 2026 : *« quand j'ouvre le pdf pour voir la facture j'ai
            pas de touche retour »*. La visionneuse porte l'en-tête et sa flèche
            (`src/lib/visionneuse-pdf.ts`).

            **Ouvrir n'est pas garder** (10 août 2026) : « Télécharger » remet le
            fichier à la feuille de partage (`BoutonTelechargerDocument`, depuis
            le 12 septembre : un lien laissait l'iPhone PEINDRE le fichier au lieu
            de le ranger). Le nom du fichier porte le numéro et l'état
            (`nomDuFichier`) ; la pastille, elle, ne dit plus que « Télécharger »,
            comme sa planche. Elle emprunte le dessin de `PastilleAjout` : c'est
            son propre bouton qui va chercher le fichier, elle ne peut pas en
            être une. */}
        <div className="mt-4 flex flex-wrap items-start justify-center gap-2">
          <PastilleAjout
            libelle="Voir le PDF"
            icone="oeil"
            onClick={() => router.push(visionneuseDeLaFacture(initialFacture))}
            repere="voir-facture"
          />
          <div className="flex flex-col items-center">
            <BoutonTelechargerDocument
              fichier={`/api/factures/${initialFacture.id}/pdf`}
              nom={nomDuFichier(initialFacture, emise)}
              dataAtlas="telecharger-facture"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full pl-3 pr-4 text-[14.5px] font-semibold active:scale-[0.98]"
              style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
            >
              <IconeTrait nom="telecharger" taille={17} />
              Télécharger
            </BoutonTelechargerDocument>
          </div>
        </div>
      </section>

      {/* Les règlements reçus et le net à payer — **en lecture**. Sa correction
          du 21 septembre 2026 : « + Règlement reçu » vit là où il REMPLIT la
          facture, comme les acomptes du devis. Ici, il vérifie avant d'envoyer ;
          il ne compose plus.

          **L'ACQUITTEMENT, LUI, REVIENT — 22 septembre 2026.** *« Depuis
          terminé, à facturer […] il doit y avoir sous net à payer un bouton on
          off facture acquitté. J'ai essayé de cliquer dessus depuis la facture
          mais impossible. »* Il était parti avec les deux « + » la veille, et
          c'était une erreur de rangement : saisir un règlement est une
          composition, solder est un CONSTAT — celui qu'il fait sur l'écran où
          « À facturer » le mène, juste avant d'envoyer.

          **ET SUR LA FACTURE PARTIE AUSSI — 23 octobre 2026.** *« Lorsque
          j'ai déjà envoyé la facture au client et que son assurance veut une
          facture acquittée, il faut pouvoir lui renvoyer la même facture avec
          la mention acquittée. »* Arrêtée, elle est au relevé de TVA : le solde
          passe alors par la porte de Terminés, avec le moyen qu'il touche
          (`basculerAcquittee`), et l'envoi devient « Envoyer la facture
          acquittée » (`appli/facture-acquittee.html`). */}
      <ReglementsRecus
        factureId={initialFacture.id}
        avoirs={avoirs}
        totalTtc={totaux.totalTtc}
        promesseDuDevis={initialFacture.promesseDuDevis}
        initiaux={initialFacture.reglements}
        fige
        emise={emise}
        auChangement={(r) => {
          setReglements(r);
          setJetonAcquitte(null);
        }}
      />

      {erreur && (
        <p role="alert" className="text-center text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
      <ListeDesManques
        manques={manques}
        lienEntreprise="/reglages/identite"
        lienClient={`/chantiers/${chantierId}/coordonnees`}
      />

      {emise ? (
        <section className="mt-3 flex flex-col items-center text-center" data-atlas="facture-arretee">
          <p className="text-[13px]" style={{ color: colors.inkSoft }}>
            Facture <NumeroDeDocument valeur={initialFacture.numeroCommercial} /> arrêtée.
          </p>
          {/* **Le paragraphe qui vivait ici est RETIRÉ** — sa demande du
              24 août 2026 : *« tout ce qui est en gris sous facture F2026,
              supprime »*. Il expliquait l'avoir et le relevé de TVA ; c'est un
              mécanisme, et sa règle est claire (`CLAUDE.md` §3 ter). Le reste,
              il le retrouve dans « Ma TVA ».

              **Ne pas le remettre au prochain doute** : une suite qui le
              réclamerait serait à corriger, pas l'écran (`CLAUDE.md` §5 bis). */}

          {/* « Mon client ne me paie pas », puis « Il m'a payé » : rendus au
              serveur, qui sait si elle est encore due (`SuiteDeLaFacture`). */}
          {suite}

          {/* ─── LE RENVOI, SOUS LE GESTE QUI RESTE — sa planche du 2 novembre
              2026 : *« Envoyée, le bouton plein devient « Il m'a payé » : c'est
              le geste qui reste à faire. Renvoyer passe dessous. »* Un appui
              sur « Renvoyer par SMS ou e-mail » déplie le message tout prêt,
              par le canal de sa fiche ou par l'autre (`TransmettreLaFacture`,
              tout ce qu'il savait faire reste : la coordonnée qui manque, le
              lien pas encore prêt, l'exemplaire acquitté).

              **« Arrêtée » n'est pas « partie ».** Quand le lien n'a pas pu se
              préparer, le bloc est déplié d'office, avec « Votre client ne l'a
              pas encore reçue » : c'est le seul départ réel, Atlas prépare le
              message et le patron l'expédie depuis sa messagerie
              (`docs/A-FAIRE.md` §5). Soldée, il se déplie aussi : l'exemplaire
              acquitté est alors ce qui reste à envoyer. */}
          {clientPublic ? (
            // **Une mairie : le PDF à déposer, pas un message** (22 octobre
            // 2026). C'est ce qui reste quand la feuille de partage n'a pas
            // suivi l'appui qui l'a arrêtée.
            <div className="mt-4 flex flex-col items-center">
              <BoutonTelechargerDocument
                fichier={`/api/factures/${initialFacture.id}/pdf`}
                nom={nomDuFichier(initialFacture, true)}
                dataAtlas="telecharger-pour-chorus"
                className="atlas-plein inline-flex items-center justify-center gap-2 px-9 py-[13px] text-[17px]"
                style={{ borderRadius: 9999, fontFamily: font.display, backgroundColor: colors.plein, color: colors.card }}
              >
                Télécharger pour Chorus Pro
              </BoutonTelechargerDocument>
              <p className="mt-1.5 text-center text-[12.5px]" style={{ color: colors.muted }}>
                Puis déposez-la sur chorus-pro.gouv.fr
              </p>
            </div>
          ) : renvoiVisible ? (
            <div className="mt-4 w-full">
              <TransmettreLaFacture
                factureId={initialFacture.id}
                clientId={clientId}
                clientNom={initialFacture.clientNom ?? ""}
                clientCivilite={initialFacture.clientCivilite}
                entrepriseNom={entrepriseNom}
                modeleMessage={modeleMessage}
                numeroFacture={initialFacture.numeroCommercial}
                echeanceLisible={dateEcheance ? jourLisible(dateEcheance) : null}
                canal={canalEnvoi}
                jetonInitial={jetonDejaPrepare}
                telephone={clientTelephone ?? ""}
                email={clientEmail ?? ""}
                origine={origine}
                acquittee={acquittee}
                jetonAcquitteInitial={jetonAcquitte}
                // Encore due, « Il m'a payé » est le bouton plein de l'écran :
                // le message tout prêt passe en capsule creuse sous lui.
                secondaire={!acquittee}
                // Un exemplaire préparé pour d'autres règlements ne doit pas
                // survivre dans l'état du composant : la clé le fait repartir.
                key={acquittee ? empreinteDesReglements(reglements) : "origine"}
              />
            </div>
          ) : (
            <button
              type="button"
              data-atlas="renvoyer-la-facture"
              onClick={() => setRenvoiOuvert(true)}
              className="mt-2 inline-flex min-h-[48px] items-center px-1 text-[16px] font-semibold"
              style={{ color: colors.rust }}
            >
              Renvoyer par SMS ou e-mail
            </button>
          )}
        </section>
      ) : (
        <>
          {/* **L'encart du canal, à la forme de la fiche client — sa demande du
              22 août 2026 :** *« le choix SMS ou e-mail, mais de la même forme
              que sur la page fiche client »*. C'est la MÊME capsule, extraite
              pour l'occasion (`ChoixCanal`) : deux dessins du même geste
              auraient divergé au premier ajustement.

              **Un canal sans coordonnée reste inerte, et c'est sa règle :**
              *« refuse l'envoi : ça veut dire qu'il communique avec le client
              par SMS, donc il enverra par SMS »*. Aucun champ de saisie ici —
              il a écarté l'idée.

              **Sauf pour un client supprimé** (sa demande du 3 novembre 2026) :
              sa fiche n'a plus aucune coordonnée, et sa facture ne pouvait plus
              partir. Les deux canaux s'offrent, et la case prend la place de
              « Aucune coordonnée pour ce canal. ». */}
          {/* ─── LE MÊME RÉGLAGE QUE SUR LA FICHE CLIENT — 9 septembre 2026 ──
              Sa remarque, capture à l'appui : *« pour envoyer le message SMS ou
              e-mail, dans la fiche client c'est un trait en dessous, pas une
              bulle ; mets la même chose ici »*.

              **Les deux écrans avaient DIVERGÉ, et c'est daté.** Sa demande du
              22 août posait déjà la règle — *« le choix SMS ou e-mail, mais de
              la même forme que sur la page fiche client »* — et cet écran l'a
              tenue jusqu'au 4 septembre. Ce jour-là, la planche « A — Épurée »
              a fait de l'envoi un RÉGLAGE sur la fiche client : une ligne, deux
              mots, un trait d'or sous celui qui est retenu. La facture est
              restée aux capsules, et l'on s'est retrouvé avec deux dessins du
              même geste — ce que `CLAUDE.md` §3 interdit nommément.

              **La question s'en va avec les capsules.** « Comment lui envoyer
              sa facture ? » était une phrase qui expliquait le bouton d'à côté
              (§3, « le moins de mots possible ») ; « Envoi » suffit, et c'est
              le mot qu'il lit déjà sur l'autre écran. */}
          {/* **Pour une mairie, ni SMS ni e-mail** (22 octobre 2026) : ils ne
              valent pas facture pour elle, seul le dépôt sur Chorus Pro compte. */}
          {!clientPublic && (
          <>
          <fieldset
            aria-label="Comment lui envoyer sa facture ?"
            data-atlas="envoi-canal"
            className="mt-2.5 flex min-h-[34px] items-center justify-between gap-3 pt-2"
            style={{ borderTop: `1px solid ${colors.lineSoft}` }}
          >
            <span className={smallCaps} style={{ color: colors.muted }}>
              Envoi
            </span>
            <span className="flex gap-1">
              <ChoixCanal
                apparence="reglage"
                libelle="SMS"
                actif={canalEnvoi === "sms"}
                disponible={saisissable || Boolean(clientTelephone)}
                onClick={() => choisirCanal("sms")}
              />
              <ChoixCanal
                apparence="reglage"
                libelle="E-mail"
                actif={canalEnvoi === "email"}
                disponible={saisissable || Boolean(clientEmail)}
                onClick={() => choisirCanal("email")}
              />
            </span>
          </fieldset>
          {saisissable ? (
            <>
              {/* La case de « Renvoyer » (`TransmettreLaFacture`), sur le fond
                  de la carte : posée à même la page, la crème de sa case s'y
                  confondrait. Son nom au-dessus, comme sur sa planche. */}
              <label className="block" data-atlas="case-de-cet-envoi">
                <span className="mb-1.5 block text-[13px]" style={{ color: colors.inkSoft }}>
                  {canalEnvoi === "sms" ? "Son numéro" : "Son e-mail"}
                </span>
                <input
                  type={canalEnvoi === "sms" ? "tel" : "email"}
                  inputMode={canalEnvoi === "sms" ? "tel" : "email"}
                  autoComplete="off"
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  placeholder={canalEnvoi === "sms" ? "06 12 34 56 78" : "son.adresse@exemple.fr"}
                  data-atlas="coordonnee-de-cet-envoi"
                  className="w-full rounded-[4px] border-0 px-4 py-3 outline-none"
                  style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
                />
              </label>
              {/* Une case vide se tait (le bouton reste éteint) ; une forme
                  fausse se dit sous elle, comme sur la fiche d'un chantier. */}
              {tapee && !tapee.ok && tapee.motif === "forme" && (
                <p role="alert" data-atlas="refus-de-cet-envoi" className="-mt-1 text-[12px]" style={{ color: colors.alert }}>
                  {tapee.raison}
                </p>
              )}
            </>
          ) : (
            <p className="text-center text-[12.5px]" style={{ color: colors.muted }}>
              {destinataire
                ? `${canalEnvoi === "sms" ? "Au" : "À"} ${destinataireLisible(canalEnvoi, destinataire)}`
                : "Aucune coordonnée pour ce canal."}
            </p>
          )}
          </>
          )}

          {/* ─── UNE FACTURE VIDE NE PART PAS — 11 septembre 2026 ────────────
              **Le trou qu'ouvrait la facture sans devis.** Une facture née d'un
              devis arrive avec ses lignes ; une facture directe naît VIDE, et
              rien n'empêchait de l'envoyer telle quelle — son client aurait reçu
              une pièce comptable à 0,00 €, immuable, à corriger par un avoir.

              **La règle est celle du devis, appelée et non réécrite**
              (`peutPreparerLaPiece`) : aucune ligne, un total nul, une ligne qui
              attend encore son prix. Elle a été généralisée plutôt que recopiée
              — deux rédactions auraient divergé, et c'est celle de la facture,
              la plus récente, qu'on aurait oublié de corriger (`CLAUDE.md` §3).

              **Le refus NOMME son geste**, et le bouton doré juste au-dessus
              l'exécute : un bouton grisé sans un mot se lit comme une
              application en panne, et c'est déjà arrivé sur l'écran de dictée. */}
          {!verdictEnvoi.possible && (
            <div
              className="py-1 pl-[13px]"
              style={{ borderLeft: `1px solid ${colors.or}` }}
              data-atlas="facture-pas-prete"
            >
              <p className="text-[13px] leading-[1.4]" style={{ color: colors.ink }}>
                {verdictEnvoi.probleme}
              </p>
              <p className="mt-[3px] text-[12px]" style={{ color: colors.muted }}>
                {verdictEnvoi.marcheASuivre}
              </p>
            </div>
          )}

          {/* **Sans flèche**, et le mot dit l'envoi : *« arrêter la facture, tu
              mets envoyer la facture sans la flèche »*. */}
          {clientPublic ? (
            // **Un seul appui, comme l'envoi** : il arrête la facture, puis
            // remet son PDF définitif à déposer sur chorus-pro.gouv.fr. Il ne
            // dépend d'aucun téléphone : une mairie sans coordonnée laissait
            // le bouton d'envoi éteint, et la facture ne s'arrêtait jamais.
            <div className="flex flex-col items-center">
              <BoutonTelechargerDocument
                fichier={`/api/factures/${initialFacture.id}/pdf`}
                nom={nomDuFichier(initialFacture, true)}
                dataAtlas="telecharger-pour-chorus"
                disabled={enCours || !verdictEnvoi.possible}
                avant={arreterPourChorus}
                onFini={() => router.refresh()}
                className="atlas-plein inline-flex items-center justify-center gap-2 px-9 py-[13px] text-[17px] disabled:opacity-50"
                style={{ borderRadius: 9999, fontFamily: font.display, backgroundColor: colors.plein, color: colors.card }}
              >
                Télécharger pour Chorus Pro
              </BoutonTelechargerDocument>
              <p className="mt-1.5 text-center text-[12.5px]" style={{ color: colors.muted }}>
                Puis déposez-la sur chorus-pro.gouv.fr
              </p>
            </div>
          ) : (
          <PrimaryButton pleineLargeur
            disabled={enCours || !destinataire || !verdictEnvoi.possible}
            onClick={envoyerLaFacture}
            // **Un repère stable, pour que le contrôle accuse le bon coupable.**
            // Attendu par son LIBELLÉ, il mourait sur un délai dépassé dès que le
            // mot changeait — un rouge qui n'apprend rien. Repéré ainsi, la suite
            // trouve le bouton, puis dit ce qui cloche dans ce qu'il porte.
            repere="envoyer-la-facture"
          >
            {enCours ? "Envoi…" : "Envoyer la facture"}
          </PrimaryButton>
          )}

          {/* **CE QUE LE BOUTON ENGAGE, dit sous lui — proposition B.**

              Le libellé qu'il a choisi parle d'envoi ; l'appui, lui, ARRÊTE la
              facture, et c'est sans retour. Deux gestes séparés le lui
              rappelaient ; avec un seul, ces deux lignes sont tout ce qui
              reste. Il ne les relira pas deux fois — elles seront là le jour où
              il se demandera pourquoi sa facture ne se modifie plus. */}
          <div className="py-1 pl-[13px]" style={{ borderLeft: `1px solid ${colors.or}` }}>
            <p className="text-[13px] leading-[1.4]" style={{ color: colors.ink }}>
              {clientPublic ? "En la téléchargeant" : "En l'envoyant"}, vous l&apos;arrêtez :{" "}
              {regimeTva === "encaissements"
                ? "elle ne se modifie plus, et entrera au relevé de TVA le jour où votre client vous paiera."
                : "elle entre dans votre TVA et ne se modifie plus."}
            </p>
            <p className="mt-[3px] text-[12px]" style={{ color: colors.muted }}>
              Une correction passerait par un avoir.
            </p>
          </div>

          {/* **« Votre messagerie s'ouvre aussitôt » a été RETIRÉ le 25 août
              2026**, à sa demande, capture à l'appui : *« supprime le message
              en gris »*.

              Elle avait sa raison le 22 août, quand les trois appuis sont
              devenus un : il fallait dire que le geste ouvrait la messagerie
              sans rien envoyer. Depuis, il l'a fait des dizaines de fois — la
              phrase n'apprenait plus rien et poussait vers le bas
              l'avertissement qui, lui, compte : la facture s'arrête.

              **Ne pas la remettre au motif qu'elle rassure.** L'encadré doré
              au-dessus dit déjà ce que le geste engage, et c'est le seul qui
              doive être lu. */}
        </>
      )}
    </div>
  );
}

/**
 * Le nom du fichier que le patron retrouvera dans son dossier.
 *
 * Il dit le NUMÉRO et l'ÉTAT : deux fichiers de la même facture peuvent
 * cohabiter — celui qu'il a regardé avant d'arrêter, et celui que son client a
 * reçu — et rien d'autre ne dirait lequel est lequel. La pastille ne dit plus
 * que « Télécharger » depuis sa planche du 2 novembre 2026 ; le nom, lui, est
 * celui que le fichier prend en descendant.
 *
 * La règle est ici ET dans la route (`api/factures/[id]/pdf`), et c'est la
 * seule duplication assumée : la route annonce le nom, celui-ci ne sert que si
 * elle ne l'annonce pas (`BoutonTelechargerDocument`). Les suites comparent le
 * nom descendu au numéro de la facture (`test-facture-au-client-e2e.ts`,
 * `test-telecharger-document-e2e.ts`) — sans quoi ils divergeraient en silence.
 *
 * **Et elles ont divergé, au premier jet.** L'état venait d'`initialFacture`,
 * qui est le rendu du serveur à l'ARRIVÉE sur l'écran : après l'arrêt de la
 * facture, sans rechargement, il annonçait encore un brouillon pendant que le
 * serveur servait la pièce définitive. Le patron aurait cherché
 * « F2026-0001-brouillon.pdf » dans un dossier qui contient
 * « F2026-0001.pdf ». On lit donc `emise`, l'état vivant de l'écran.
 */
function nomDuFichier(f: FacturePourEcran, emise: boolean): string {
  return emise ? `${f.numeroCommercial}.pdf` : `${f.numeroCommercial}-brouillon.pdf`;
}

/**
 * Une ligne de total.
 *
 * `retire` écrit le montant en négatif — le prix accordé au client, et lui seul.
 * Le signe est devant le montant comme sur le papier : sans lui, la remise se lit
 * comme un ajout, et la soustraction imprimée dessous devient incompréhensible.
 *
 * L'espacement et le `flex-shrink-0` ne sont pas cosmétiques : « Prix accordé au
 * client 15 % » et son montant se disputent les 390 px de son téléphone. Le
 * libellé et le montant dans le même gris, en chiffres de même largeur : sa
 * planche du 2 novembre 2026 laisse le Total TTC seul en vedette.
 */
function Ligne({
  label,
  valeur,
  retire = false,
  repere,
}: {
  label: string;
  valeur: string;
  retire?: boolean;
  /** Repère de suite, posé sur le montant. */
  repere?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[15.5px]" style={{ color: colors.inkSoft }}>
      <span>{label}</span>
      <span data-atlas={repere} className="flex-shrink-0 whitespace-nowrap tabular-nums">
        {retire ? `- ${enEuros(valeur)}` : enEuros(valeur)}
      </span>
    </div>
  );
}

/**
 * Le calendrier s'ouvre au premier appui, sur l'ordinateur aussi.
 *
 * Le sélecteur de date est transparent sous sa phrase : sur iPhone, le toucher
 * ouvre déjà la roue ; sur un ordinateur, cliquer dans un champ de date ne fait
 * que poser le curseur dans ses chiffres, invisibles ici. `showPicker` ouvre le
 * calendrier dans les deux cas ; un navigateur qui ne le connaît pas garde son
 * geste natif.
 */
function ouvrirLeCalendrier(e: React.MouseEvent<HTMLInputElement>) {
  if ("showPicker" in e.currentTarget) e.currentTarget.showPicker();
}
