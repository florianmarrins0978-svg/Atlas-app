import type { JourIso } from "@/lib/disponibilites";
import type { AbsenceEquipe } from "@/lib/absences-equipe";
import type { Demi } from "@/lib/planning-jour";
import type { FeuilleDuChantier } from "@/server/repositories/devis";
import type { MomentDArrivee } from "@/lib/creneaux-chantier";
import type { EquipesDuChantier } from "@/lib/equipes-par-jour";

/**
 * Une absence, telle que le PLANNING en a besoin.
 *
 * `AbsenceEquipe` — ce que lit le calcul de disponibilité — ne porte que
 * l'équipe et les dates. L'écran, lui, a besoin de deux choses de plus :
 * l'`id` pour retirer la ligne d'un appui, et le `rang` pour écrire le NOM de
 * la personne au lieu d'un numéro.
 */
export type AbsenceDuPlanning = AbsenceEquipe & { id: string; rang: number };

/**
 * La feuille d’un chantier, et combien de retours il a déjà envoyés.
 *
 * **Les deux voyagent ensemble** : la fiche dit « 2 retours envoyés » sous le
 * bandeau fermé, dès l’ouverture — pas seulement dans la session où l’on a
 * appuyé. Un chantier de huit jours en envoie un chaque soir (19 septembre 2026).
 */
export type FeuilleEtRetour = FeuilleDuChantier & { retours: number; dernierRetourLe: string | null };

/**
 * Un chantier tel que le planning le lit — la forme rendue par
 * `listerChantiersPourPlanning`.
 *
 * **Exporté depuis le 22 août 2026** : l'écran d'envoi montre la même journée
 * (`JourneeRegardee`), et une seconde définition aurait divergé au premier
 * champ ajouté.
 */
export type ChantierPlanning = {
  id: string;
  nom: string;
  clientNom: string | null;
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
  /**
   * LES DEMI-JOURNÉES OÙ IL EST POSÉ, quand il ne tient plus en un bloc
   * (migration 0085, sa demande du 10 septembre 2026).
   *
   * **Vide vaut le bloc calculé de `datePlanifiee` + `creneauDebut` + la
   * durée** : rien n'a été recopié à la migration, et lire « aucun créneau »
   * comme « rien d'occupé » viderait le calendrier de tout ce qui est déjà pris.
   */
  creneaux?: readonly { jour: string; moment: "matin" | "apres_midi" }[] | null;
  dureePrevue?: string | null;
  /**
   * Les rangs d'équipe cochés, demi-journée par demi-journée (migration 0058)
   * — et JOUR PAR JOUR depuis la migration 0093 (sa plainte du 15 septembre
   * 2026). **Pour un jour donné, on lit `equipesDuJour(c.equipes, jour)`** ;
   * `matin` / `apres_midi` disent qui vient au moins un jour.
   */
  equipes: EquipesDuChantier;
  /** L'adresse du chantier, telle qu'elle est en base — jamais devinée. */
  adresseChantier?: string | null;
  /**
   * Le pense-bête du chantier, lu et écrit sur la feuille.
   *
   * **Modifiable sur l'objet** (`chantier.note = …` après enregistrement) : la
   * feuille est remontée à chaque changement de chantier, et repeindre toute la
   * liste pour un champ de texte ferait clignoter le planning sous le doigt.
   */
  note?: string | null;
  clientTelephone?: string | null;
  envoiEnvoyeAt: Date | string | null;
  envoiExpireAt: Date | string | null;
  envoiReponse: "acceptee" | "refusee" | null;
  termineAt: Date | string | null;
  factureEnvoyeeAt: Date | string | null;
  /** Un passage de contrat d'entretien, et sa clé, qui dit son mois (0107). */
  contratEntretienId?: string | null;
  contratPassage?: string | null;
};

/**
 * CE QU'UNE FICHE DE JOUR TIENT OUVERT — un seul geste à la fois.
 *
 * `cle` dit DANS QUELLE carte : la fiche du jour est rendue à deux endroits —
 * sous le calendrier et sous une ligne des planifiés — et c'est le même
 * composant, écrit une fois. Sans elle, deux listes s'ouvrent ensemble et l'on
 * coche dans l'une en croyant agir sur l'autre.
 *
 * **Les trois temps de « Ajouter » — 10 septembre 2026.** Sa planche
 * `appli/bloquer-sans-devis.html` : le geste propose d'abord DEUX voies, puis
 * l'une ou l'autre. « Annuler » ramène aux deux voies, à chaque étape.
 */
export type OuvertDansLaCarte =
  | { quoi: "equipe"; cle: string; chantierId: string; demi: Demi }
  // **`demi` a disparu d'ici le 3 septembre 2026, et c'est un nettoyage, pas
  // une perte.** Il n'existait que pour empêcher la liste des trois moments de
  // s'ouvrir dans les DEUX lignes d'un chantier à la journée — six boutons pour
  // un seul geste.
  // ─── LES DEUX TEMPS DE « DÉPLACER » — 17 septembre 2026 ─────────────────
  //
  // **Sa demande :** *« lorsque je clique sur déplacer ça me fait apparaître le
  // planning et je sélectionne un jour et le matin ou l'aprem ou journée pour
  // réellement déplacer mon client, parce que là c'est trop de clics à faire »*.
  // Puis, sur la planche : *« je choisis la deux, le planning au-dessus, et la
  // A : on déplace que la demi-journée du jour sélectionné »*.
  //
  // `jourSource` est porté par l'état, pas relu de la carte : pendant le geste
  // il change de mois, et la carte du jour de départ n'est plus à l'écran.
  | { quoi: "deplacer"; cle: string; chantierId: string; jourSource: JourIso }
  | {
      quoi: "deplacer-quand";
      cle: string;
      chantierId: string;
      jourSource: JourIso;
      vers: JourIso;
    }
  // **« ajout-quand » a disparu le 9 septembre 2026** : un second temps qui
  // demandait « Matin, Après-midi ou Journée » après avoir touché le nom du
  // chantier. La durée étant déjà en base, la question n'ajoutait rien et
  // écrasait ce que le devis avait fixé (voir `poser`).
  | { quoi: "ajout-voies"; cle: string }
  | { quoi: "ajout-qui"; cle: string }
  | { quoi: "ajout-client"; cle: string }
  // **Le client qui n'arrive pas à choisir ses dates** — son choix B du
  // 7 octobre 2026 : on le pose, puis l'on dit comment il signe.
  | { quoi: "ajout-signature"; cle: string; chantierId: string }
  // **Un devis expiré qui revient** — sa demande du 7 octobre 2026 : sa porte
  // à part, puis le choix (relire, renvoyer, poser), puis comment il signe.
  | { quoi: "ajout-expire"; cle: string }
  | { quoi: "ajout-relance"; cle: string; chantierId: string; etape: "choix" | "signe" }
  // **La banque, une livraison, une formation** — sa réponse du 10 septembre
  // 2026 à la question que sa propre correction avait ouverte.
  | { quoi: "ajout-temps"; cle: string };

export type GestesCarte = {
  /** Le retour d'aujourd'hui est-il encore attendu sur ce chantier ? */
  retourAEnvoyer: (chantierId: string, jour: JourIso) => boolean;
  /**
   * Cette personne a-t-elle le droit de MODIFIER le planning ?
   *
   * Faux pour un salarié : la carte du jour ne montre alors ni pastille
   * d'équipe, ni « Déplacer », ni « Retirer », ni « Ajouter un chantier ».
   * Elle continue de montrer le jour, les chantiers, qui part et la feuille.
   */
  ecriture: boolean;
  /**
   * **À une seule équipe, aucune pastille.** Il n'y a personne à désigner :
   * écrire un nom d'organisation à un artisan qui travaille seul lui
   * inventerait une organisation qu'il n'a pas — le patron l'a interdit le
   * 10 août 2026 (`src/lib/equipes.ts`). La planche 84 en montre deux ; elle ne
   * dit rien du cas où il n'y en a aucun, et c'est la règle d'avant qui tranche.
   *
   * **C'est le compteur des SALARIÉS depuis le 26 août 2026**, et non celui des
   * équipes : les deux se sont séparés, et c'est le nombre de gens qui décide
   * s'il y a quelqu'un à cocher.
   */
  nombreSalaries: number;
  ouvert: OuvertDansLaCarte | null;
  setOuvert: (o: GestesCarte["ouvert"]) => void;
  feuille: { chantierId: string; cle: string } | null;
  setFeuille: (f: { chantierId: string; cle: string } | null) => void;
  sansDate: ChantierPlanning[];
  /**
   * UN CLIENT VIENT D'ÊTRE POSÉ SUR CE JOUR — le chantier naît ici.
   *
   * Il n'existait pas avant le geste : l'écran ne peut pas le retrouver dans sa
   * liste pour le mettre à jour, il l'AJOUTE. C'est ce qui distingue cette voie
   * de « Poser », qui déplace un chantier déjà là.
   */
  poserUnClient: (chantier: ChantierPlanning) => void;
  /**
   * Ceux dont le devis attend la réponse du client — son choix B du
   * 7 octobre 2026 : on peut les poser à sa place, quand il n'arrive pas à
   * choisir ses dates.
   */
  attenteClient: ChantierPlanning[];
  poserALaPlace: (
    chantierId: string,
    jour: JourIso,
    signature: { maniere: "lien" } | { maniere: "papier"; demarrageAnticipe: boolean }
  ) => Promise<string | null>;
  /** Les devis expirés sans réponse — leur porte « Devis expiré » (7 octobre 2026). */
  devisExpires: ChantierPlanning[];
  relancerLeDevisExpire: (
    chantierId: string,
    jour: JourIso,
    signature: { maniere: "lien" } | { maniere: "papier"; demarrageAnticipe: boolean }
  ) => Promise<string | null>;
  relireLeDevisExpire: (chantierId: string, jour: JourIso) => Promise<string | null>;
  /** Les demi-journées rendues qui attendent une place — voir le tiroir du bas. */
  morceaux: { chantier: ChantierPlanning; combien: number }[];
  /** Le chantier dont une demi-journée attend une place, s'il en tient une. */
  morceauEnMain: string | null;
  onPrendreMorceau: (chantierId: string) => void;
  /**
   * CE QUI N'A PAS PU PARTIR — écrit en tête de la journée, ou rien.
   *
   * **Un geste sans effet et sans message est un défaut muet** (`AGENTS.md`) :
   * sa panne du 11 septembre 2026, où sa page avait survécu à son serveur et
   * où plus rien ne répondait, en silence.
   */
  refus: string | null;
  nomEquipe: (rang: number) => string;
  tetesDe: (rangs: readonly number[]) => { rang: number; photo: string }[];
  lignesEquipes: { rang: number; nom?: string | null }[];
  occupationDe: (jour: JourIso, demi: Demi) => { pris: readonly ChantierPlanning[]; charge: number };
  chantiersDuJour: (jour: JourIso) => ChantierPlanning[];
  basculerEquipe: (chantierId: string, jour: JourIso, demi: Demi, rang: number) => void;
  /**
   * DÉPLACER CE QUE LE JOUR PORTE — le geste vit DANS la fiche (17 sept. 2026).
   *
   * La carte le rend elle-même, sous les demi-journées, comme sur la planche
   * qu'il a retenue. Le même bloc est monté une seconde fois sous le calendrier,
   * pour le seul cas où le mois tourné a emporté la fiche.
   */
  deplacerLeJour: (
    chantierId: string,
    jourSource: JourIso,
    vers: JourIso,
    moment: MomentDArrivee
  ) => void;
  /** Reposer le morceau tenu au doigt sur la demi-journée touchée. */
  reposer: (chantierId: string, jour: JourIso, demi: Demi) => void;
  retirerDuJour: (chantierId: string) => void;
  /** Ouvre la question avant de supprimer — la B de sa planche du 7 octobre 2026. */
  demanderSuppression: (c: ChantierPlanning) => void;
  poser: (chantierId: string, jour: JourIso) => void;
  taches: Record<string, FeuilleEtRetour>;
  travauxChanges: (chantierId: string, liste: string[]) => void;
};

/**
 * « Je ne suis pas là ce jour-là » — le raccourci du 6 septembre 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE COMPOSANT NE FAIT PAS, ET C'EST L'ESSENTIEL.** Il ne décide RIEN
 * de la disponibilité. Fermer un jour écrit une absence d'un jour — la même
 * ligne que l'écran des Réglages —, et c'est `fusionnerAbsences` qui, comme
 * depuis le 14 août, retire la place. Les trois chemins la voient déjà :
 * l'écran d'envoi, l'envoi, et la revérification quand le client répond.
 *
 * **Une seconde façon de fermer un jour aurait divergé de la première**
 * (`CLAUDE.md` §3), et c'est la disponibilité qui l'aurait payé : un jour
 * fermé ici mais ouvert là-bas part chez un client.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **SANS SALARIÉ, UN SEUL APPUI.** Sa correction du 6 septembre : *« c'est pas
 * les équipes, c'est le nom des salariés qu'il faut mettre »*. Quand il
 * travaille seul, il n'y a personne à désigner : une ligne, un appui, le jour
 * se ferme. La question « qui ? » ne s'ouvre que s'il a quelqu'un — la poser à
 * un artisan seul serait un geste de plus pour rien.
 *
 * **RIEN DE CACHÉ** (`PRODUCT.md`) : pas d'appui long, pas de glissement. Une
 * ligne visible dans la carte qu'il ouvre déjà en touchant un jour.
 *
 * **UN JOUR PASSÉ NE SE FERME PAS** : l'appelant ne rend ce bloc que sur un
 * jour à venir, par le même drapeau `ecriture` que le reste de la carte.
 */
/**
 * Les deux façons de restreindre une absence — la journée entière n'y est pas.
 *
 * **Son choix D2, le 8 septembre 2026, et c'est une mesure.** Trois pastilles
 * plus le mot « Quand » faisaient 440 px pour 354 disponibles : la ligne se
 * repliait dès qu'un écran était un peu plus étroit que le sien, et une
 * troisième pastille « La journée » ne tient pas davantage dans l'application
 * que sur la planche — vérifié à l'écran, pas supposé.
 *
 * **Toucher un nom pose la journée entière, tout de suite.** C'est le cas
 * courant, et il reste à un appui, exactement comme avant ce lot. Les deux
 * pastilles ci-dessous ne servent qu'à RESTREINDRE ce qui vient d'être posé —
 * le jour où ça compte.
 */
export type MomentEntier = "matin" | "apres_midi" | "journee";
