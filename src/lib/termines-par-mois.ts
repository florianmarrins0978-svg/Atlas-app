// « Terminés » : le fil par mois, et ce qui attend d'être facturé.
//
// **Une règle pure, testable sans base**, parce qu'elle décide de trois choses
// que l'œil ne rattrape pas : dans quel mois tombe un chantier, combien
// attendent d'être facturés, et ce que chaque mois totalise.
//
// **Un chantier non facturé reste DANS SON MOIS.** Le chantier du 20 août est
// un chantier d'août ; le sortir dans un bloc à part casse le fil, qui ne
// raconte plus le temps mais deux listes empilées.

import { nombreEnLettres } from "@/lib/nombre-en-lettres";

/** Ce que l'écran reçoit du dépôt, réduit à ce dont la règle a besoin. */
export type LigneTerminee = {
  id: string;
  nom: string;
  clientNom: string | null;
  datePlanifiee: string | null;
  factureNumero: string | null;
  /** `"emise"` quand la facture est partie chez le client. */
  factureStatut: string | null;
  /** Le total de la facture, quand elle existe. */
  totalTtc: string | null;
  /** Le total du dernier devis envoyé — le montant PRÉVU, pas encaissé. */
  devisTotalTtc: string | null;
};

export type LigneAffichee = LigneTerminee & {
  /** `true` tant qu'aucune facture n'a été émise pour ce chantier. */
  aFacturer: boolean;
  /** Le montant à montrer : celui de la facture, sinon celui du devis. */
  montant: number | null;
};

export type MoisTermine = {
  /** `AAAA-MM` — la clé de tri, jamais affichée telle quelle. */
  cle: string;
  nom: string;
  annee: number;
  /** Ce qui est facturé : le mois se solde avec ça. */
  facturees: LigneAffichee[];
  /** Ce qui attend — l'encart, replié au repos. */
  aFacturer: LigneAffichee[];
  /** Le total des factures du mois. */
  totalFacture: number;
  /** Le total prévu aux devis de ce qui attend. */
  totalPrevu: number;
};

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Le montant en euros, ou `null` quand rien n'est connu.
 *
 * **`null` et non zéro.** Un chantier dont le devis n'a pas de total n'attend
 * pas 0 € : on ne sait pas. Écrire « 0,00 € » à sa place serait inventer un
 * chiffre — et le patron a une vraie facture à 0,00 € dans ses données, qu'on
 * ne doit pas pouvoir confondre avec une absence.
 */
function euros(brut: string | null | undefined): number | null {
  if (brut == null || brut === "") return null;
  const n = Number(brut);
  return Number.isFinite(n) ? n : null;
}

/** Une facture émise, ou seulement préparée ? */
export function estFacture(l: Pick<LigneTerminee, "factureStatut">): boolean {
  return l.factureStatut === "emise";
}

/**
 * Range les chantiers terminés par mois, du plus récent au plus ancien.
 *
 * Un chantier sans date ne peut pas appartenir à un mois : il tombe dans un
 * groupe à part, en tête, plutôt que d'être rangé au hasard.
 */
export function grouperParMois(lignes: readonly LigneTerminee[]): MoisTermine[] {
  const parCle = new Map<string, MoisTermine>();

  for (const l of lignes) {
    const facture = estFacture(l);
    const affichee: LigneAffichee = {
      ...l,
      aFacturer: !facture,
      montant: facture ? euros(l.totalTtc) : euros(l.devisTotalTtc),
    };

    const jour = l.datePlanifiee ?? "";
    const cle = jour.slice(0, 7) || "sans-date";
    let mois = parCle.get(cle);
    if (!mois) {
      const annee = Number(jour.slice(0, 4));
      const indice = Number(jour.slice(5, 7)) - 1;
      mois = {
        cle,
        nom: MOIS[indice] ?? "sans date",
        annee: Number.isFinite(annee) ? annee : 0,
        facturees: [],
        aFacturer: [],
        totalFacture: 0,
        totalPrevu: 0,
      };
      parCle.set(cle, mois);
    }

    if (facture) {
      mois.facturees.push(affichee);
      mois.totalFacture += affichee.montant ?? 0;
    } else {
      mois.aFacturer.push(affichee);
      mois.totalPrevu += affichee.montant ?? 0;
    }
  }

  // Le plus récent en tête — c'est celui que le patron vient regarder en
  // rentrant. « sans-date » passe devant : un chantier qu'on ne sait pas
  // dater ne doit pas se perdre au fond de la liste.
  return [...parCle.values()].sort((a, b) => {
    if (a.cle === "sans-date") return -1;
    if (b.cle === "sans-date") return 1;
    return a.cle < b.cle ? 1 : -1;
  });
}

/**
 * Ce que dit l'encart — ou `null` quand il ne doit PAS exister.
 *
 * **À zéro, l'encart n'existe pas.** Jamais de « 0 », jamais de compte au
 * singulier bancal : le mois n'affiche alors que son total. C'était le défaut
 * de l'ancien écran — « Rien à facturer » s'affichait comme un titre de section
 * suivi de rien, et l'écran avait l'air amputé au lieu d'avoir l'air calme.
 *
 * Le compte s'écrit **en toutes lettres**, comme partout ailleurs.
 */
export function libelleEncart(combien: number): string | null {
  if (combien <= 0) return null;
  const mot = nombreEnLettres(combien);
  return `${mot.charAt(0).toUpperCase()}${mot.slice(1)} à facturer`;
}

/** Le total facturé sur l'ensemble des mois montrés. */
export function totalFacture(mois: readonly MoisTermine[]): number {
  return mois.reduce((somme, m) => somme + m.totalFacture, 0);
}

const EUROS = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * « 1 240,00 € ».
 *
 * **Il vit ici et non dans le composant.** Exporté depuis un fichier
 * « use client », il n'était plus appelable depuis le serveur : la page entière
 * tombait sur « Attempted to call formatEuros() from the server ». Un
 * formateur n'a rien de client — il ne touche ni au DOM ni à l'état.
 */
export function formatEuros(n: number): string {
  return EUROS.format(n);
}
