// Données fictives uniquement — aucune connexion à un service réel à ce stade.
// Sert à visualiser le parcours de navigation avant tout développement métier.
// Écrans réels : ce fichier n'est plus utilisé que par les maquettes /design/*.
//
// --- Pourquoi un type de statut PROPRE aux maquettes ---
//
// Les maquettes de `/design/*` sont **gelées** : elles montrent une étape du
// travail de conception, pas l'application d'aujourd'hui. Elles étaient
// pourtant typées sur le `ChantierStatut` vivant, si bien que chaque nouvel
// état du produit — « en attente de réponse », « à relancer », « facturé » —
// cassait cinq fichiers que personne ne consulte, et tentait d'aller élargir
// des tables de correspondance décoratives au lieu d'avancer.
//
// Pire : cette contrainte pousse insidieusement à ne PAS ajouter d'état au
// produit pour s'éviter la corvée. Un outil de conception ne doit jamais peser
// sur les décisions du produit.
//
// Le lien est donc coupé. Ce type-ci ne bougera plus.

export type ChantierStatut = "brouillon" | "a_verifier" | "verifie" | "devis_envoye" | "planifie";

export const statutLabel: Record<ChantierStatut, string> = {
  brouillon: "Brouillon",
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  devis_envoye: "Devis envoyé",
  planifie: "Planifié",
};

export type Chantier = {
  id: string;
  ref: string;
  nom: string;
  adresseChantier: string;
  client: {
    nom: string;
    telephone: string;
    adresse?: string;
  };
  statut: ChantierStatut;
  photos: number;
  aUneNoteVocale: boolean;
  dateCreation: string;
  // Indicateurs d'avancement réels — seule source utilisée pour déterminer
  // l'action principale de la fiche chantier (src/lib/chantier-etat.ts).
  // Ne jamais en déduire un état qui n'a pas été explicitement enregistré.
  informationsVerifiees: boolean;
  prixCalcule: boolean;
  devisGenere: boolean;
  devisEnvoye: boolean;
  planifie: boolean;
  datePlanifiee?: string; // ISO (YYYY-MM-DD) — renseignée uniquement si planifie est vrai
};

export const mockChantiers: Chantier[] = [
  {
    id: "1",
    ref: "CH-0042",
    nom: "Rénovation salle de bain",
    adresseChantier: "12 rue des Lilas, Nantes",
    client: { nom: "M. Bernard", telephone: "06 12 34 56 78" },
    statut: "a_verifier",
    photos: 6,
    aUneNoteVocale: true,
    dateCreation: "2026-07-24",
    informationsVerifiees: false,
    prixCalcule: false,
    devisGenere: false,
    devisEnvoye: false,
    planifie: false,
  },
  {
    id: "2",
    ref: "CH-0041",
    nom: "Terrasse bois",
    adresseChantier: "5 allée des Tilleuls, Nantes",
    client: { nom: "Mme Costa", telephone: "06 98 76 54 32" },
    statut: "verifie",
    photos: 3,
    aUneNoteVocale: true,
    dateCreation: "2026-07-22",
    informationsVerifiees: true,
    prixCalcule: false,
    devisGenere: false,
    devisEnvoye: false,
    planifie: false,
  },
  {
    id: "3",
    ref: "CH-0040",
    nom: "Reprise de toiture",
    adresseChantier: "8 impasse du Moulin, Rezé",
    client: { nom: "M. Faucher", telephone: "07 11 22 33 44" },
    statut: "devis_envoye",
    photos: 9,
    aUneNoteVocale: true,
    dateCreation: "2026-07-18",
    informationsVerifiees: true,
    prixCalcule: true,
    devisGenere: true,
    devisEnvoye: true,
    planifie: false,
  },
  {
    id: "4",
    ref: "CH-0043",
    nom: "Pose de clôture",
    adresseChantier: "2 route de Vertou, Vertou",
    client: { nom: "Mme Aubry", telephone: "06 55 44 33 22" },
    statut: "brouillon",
    photos: 0,
    aUneNoteVocale: false,
    dateCreation: "2026-07-26",
    informationsVerifiees: false,
    prixCalcule: false,
    devisGenere: false,
    devisEnvoye: false,
    planifie: false,
  },
];

// **QUATRE EXPORTS RETIRÉS LE 5 SEPTEMBRE 2026 — audit de santé.**
//
// `getChantierById`, `mockInformationsStructurees` et `mockTarifs` n'avaient
// aucun appelant : cherchés par nom dans `src/`, `scripts/`, `drizzle/` et
// `appli/`, imports directs comme indirects. Ils servaient les maquettes
// `/design/*` d'avant leur découplage du 1er août 2026 ; ce que ces planches
// emploient encore, c'est `mockChantiers` et `ChantierStatut`, rien d'autre.
//
// `mockChantiersTest` (69 lignes) est parti avec eux, et **c'est l'ordre qui
// importe** : il n'était atteignable que par `getChantierById`. Un dépôt qui
// retire une fonction sans regarder ce qu'elle SEULE tenait laisse derrière
// elle une donnée que plus rien n'atteint et que personne n'ose toucher.
//
// **Ce fichier reste, et il n'est pas du code mort :**
// `scripts/test-maquettes-hors-production.ts` s'en sert comme MARQUE — un
// écran du produit qui l'importerait montrerait un chantier qui n'existe pas,
// et la suite le refuse. Le vider serait donc retirer un garde-fou.
