/**
 * Mode d'emploi : Où se trouve chaque écran : les onglets du bas, et où dorment devis, factures et fiches.
 *
 * Chaque fiche se prouve contre le code (`scripts/test-mode-emploi.ts`) : la
 * règle, la recherche et le pourquoi vivent dans `src/lib/mode-emploi.ts`.
 */
import type { FicheModeEmploi } from "../mode-emploi";

export const FICHES_LIEUX: FicheModeEmploi[] = [
  // --- Où se trouve quoi (sa demande du 24 septembre 2026) ------------------
  //
  // *« S'il cherche une touche ou l'endroit où on range les devis, facture,
  // avoir, fiche de sécurité, fiche d'intervention, n'importe quoi, il DOIT
  // pouvoir lui répondre. »* Les fiches plus bas disent comment FAIRE ; aucune
  // ne disait où les choses sont RANGÉES, et « où sont mes factures » rendait
  // la création d'une facture.
  {
    id: "ecran-chantiers",
    ecran: "Chantiers",
    ou: "« Chantiers », premier onglet de la barre du bas",
    intitule: "Trouver les chantiers en cours",
    motsCles: ["chantiers", "cours", "accueil", "liste", "devis", "attente", "trouver", "sont", "retrouver"],
    geste: "Touchez « Chantiers » dans la barre du bas : tous les chantiers en cours, devis compris.",
    source: "src/components/atlas/AtlasBottomNav.tsx",
    preuves: ['label: "Chantiers"'],
    lieu: true,
  },
  {
    id: "ecran-planning",
    ecran: "Planning",
    ou: "« Planning », dans la barre du bas",
    intitule: "Ouvrir le planning, le calendrier",
    motsCles: ["planning", "calendrier", "agenda", "jour", "semaine", "trouver", "sont"],
    geste: "Touchez « Planning » dans la barre du bas.",
    source: "src/components/atlas/AtlasBottomNav.tsx",
    preuves: ['label: "Planning"'],
    lieu: true,
  },
  {
    id: "ecran-termines",
    ecran: "Terminés",
    ou: "« Terminés », dans la barre du bas",
    intitule: "Retrouver les chantiers terminés, mois par mois",
    motsCles: ["termine", "termines", "fini", "finis", "finit", "passe", "anciens", "mois", "sont", "trouver"],
    geste:
      "Touchez « Terminés » dans la barre du bas : les chantiers finis, facturés ou non. " +
      "Les chevrons changent de mois.",
    source: "src/components/atlas/AtlasBottomNav.tsx",
    preuves: ['label: "Terminés"'],
    ailleurs: [{ source: "src/app/termines/ListeTermines.tsx", preuves: ['"Mois précédent"'] }],
    lieu: true,
  },
  {
    id: "ecran-paysage",
    ecran: "Paysage",
    ou: "« Paysage », dans la barre du bas",
    intitule: "Trouver les outils du métier : arrosage, fiche de chantier, diagnostic, fiches de sécurité",
    motsCles: ["paysage", "outils", "outil", "arrosage", "diagnostic", "metier", "sont", "trouver"],
    geste:
      "Touchez « Paysage » dans la barre du bas : Plan d'arrosage automatique, Fiche de chantier, " +
      "Diagnostic végétal et Fiches de sécurité.",
    source: "src/app/paysage/page.tsx",
    preuves: ["Plan d'arrosage automatique", "Fiche de chantier", "Diagnostic végétal", "Fiches de sécurité"],
    ailleurs: [{ source: "src/components/atlas/AtlasBottomNav.tsx", preuves: ['label: "Paysage"'] }],
    lieu: true,
  },
  {
    id: "ecran-reglages",
    ecran: "Réglages",
    ou: "« Réglages », dernier onglet de la barre du bas",
    intitule: "Ouvrir les réglages",
    motsCles: ["reglages", "reglage", "parametres", "parametre", "configurer", "options", "sont", "trouver"],
    geste: "Touchez « Réglages » dans la barre du bas.",
    source: "src/components/atlas/AtlasBottomNav.tsx",
    preuves: ['label: "Réglages"'],
    lieu: true,
  },
  {
    id: "ou-devis",
    ecran: "Vos clients",
    ou: "« Chantiers » dans la barre du bas, puis « Vos clients »",
    intitule: "Retrouver ses devis, en cours ou déjà envoyés",
    motsCles: ["devis", "sont", "range", "ranger", "rangement", "retrouver", "trouver", "envoye", "envoyes", "anciens", "archive"],
    geste:
      "Un devis en cours est sur sa ligne, dans « Chantiers ». Ceux qui sont partis : " +
      "« Chantiers », puis « Vos clients », touchez le nom, onglet « Devis ».",
    source: "src/app/clients/[id]/page.tsx",
    preuves: ['libelle: "Devis"', "Aucun devis parti"],
    ailleurs: [{ source: "src/app/EcranChantiers.tsx", preuves: ['href="/clients"', "Vos clients"] }],
    lieu: true,
  },
  {
    id: "ou-factures",
    ecran: "Terminés",
    ou: "« Terminés », dans la barre du bas",
    intitule: "Retrouver ses factures",
    motsCles: ["factures", "facture", "sont", "range", "ranger", "retrouver", "trouver", "envoyee", "envoyees", "anciennes", "archive"],
    geste:
      "Touchez « Terminés » dans la barre du bas, puis la ligne du chantier : sa facture s'ouvre. " +
      "Par client : « Chantiers », « Vos clients », touchez le nom, onglet « Factures ».",
    source: "src/app/termines/ListeTermines.tsx",
    preuves: ["/facture`", "ligne-terminee"],
    ailleurs: [{ source: "src/app/clients/[id]/page.tsx", preuves: ['libelle: "Factures"', "Aucune facture émise"] }],
    lieu: true,
  },
  {
    id: "ou-fiches-envoyees",
    ecran: "Vos clients",
    ou: "« Chantiers » dans la barre du bas, puis « Vos clients »",
    intitule: "Retrouver les fiches de chantier envoyées à un client",
    motsCles: ["fiches", "fiche", "chantier", "envoyee", "envoyees", "sont", "retrouver", "trouver", "range", "client"],
    geste: "« Chantiers », puis « Vos clients », touchez le nom, onglet « Fiches ».",
    source: "src/app/clients/[id]/page.tsx",
    preuves: ['libelle: "Fiches"', "Aucune fiche envoyée"],
    lieu: true,
  },
];
