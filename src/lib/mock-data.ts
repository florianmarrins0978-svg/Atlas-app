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

// Chantiers de test — ne s'affichent pas dans la liste principale, servent uniquement
// à vérifier chaque état possible de l'action principale de la fiche chantier.
export const mockChantiersTest: Chantier[] = [
  {
    id: "t-note",
    ref: "CH-TEST-1",
    nom: "Photos prises, note à faire (test)",
    adresseChantier: "Adresse de test",
    client: { nom: "Client test", telephone: "00 00 00 00 00" },
    statut: "a_verifier",
    photos: 4,
    aUneNoteVocale: false,
    dateCreation: "2026-07-20",
    informationsVerifiees: false,
    prixCalcule: false,
    devisGenere: false,
    devisEnvoye: false,
    planifie: false,
  },
  {
    id: "t-devis-preparer",
    ref: "CH-TEST-2",
    nom: "Prix calculé, devis à préparer (test)",
    adresseChantier: "Adresse de test",
    client: { nom: "Client test", telephone: "00 00 00 00 00" },
    statut: "verifie",
    photos: 5,
    aUneNoteVocale: true,
    dateCreation: "2026-07-20",
    informationsVerifiees: true,
    prixCalcule: true,
    devisGenere: false,
    devisEnvoye: false,
    planifie: false,
  },
  {
    id: "t-devis-consulter",
    ref: "CH-TEST-3",
    nom: "Devis généré, non envoyé (test)",
    adresseChantier: "Adresse de test",
    client: { nom: "Client test", telephone: "00 00 00 00 00" },
    statut: "verifie",
    photos: 5,
    aUneNoteVocale: true,
    dateCreation: "2026-07-20",
    informationsVerifiees: true,
    prixCalcule: true,
    devisGenere: true,
    devisEnvoye: false,
    planifie: false,
  },
  {
    id: "t-planifie",
    ref: "CH-TEST-4",
    nom: "Chantier planifié (test)",
    adresseChantier: "Adresse de test",
    client: { nom: "Client test", telephone: "00 00 00 00 00" },
    statut: "planifie",
    photos: 5,
    aUneNoteVocale: true,
    dateCreation: "2026-07-20",
    informationsVerifiees: true,
    prixCalcule: true,
    devisGenere: true,
    devisEnvoye: true,
    planifie: true,
  },
];

// Utilisé par la fiche chantier — cherche d'abord dans les chantiers réels,
// puis dans les fixtures de test (jamais affichées dans la liste principale).
export function getChantierById(id: string): Chantier | undefined {
  return mockChantiers.find((c) => c.id === id) ?? mockChantiersTest.find((c) => c.id === id);
}

export const mockInformationsStructurees = {
  prestations: ["Dépose ancien carrelage", "Pose faïence murale", "Remplacement robinetterie"],
  duree: "2 jours",
  equipe: "2 hommes",
  materiel: ["Carrelage 60x60 (fourni client)", "Colle flex", "Joint gris anthracite"],
  transcriptionBrute:
    "Alors pour la salle de bain de monsieur Bernard, on va devoir déposer l'ancien carrelage complètement, " +
    "poser la nouvelle faïence sur les murs, et changer la robinetterie qui est vraiment vétuste. Je pense " +
    "deux jours de travail avec deux gars sur le chantier. Le client fournit son carrelage, nous on prend " +
    "la colle flex et le joint gris anthracite.",
};

export const mockTarifs = [
  { intitule: "Main d'œuvre (jour/homme)", prix: "280 €" },
  { intitule: "Dépose carrelage (m²)", prix: "18 €" },
  { intitule: "Pose faïence (m²)", prix: "45 €" },
  { intitule: "Forfait déplacement", prix: "35 €" },
];

