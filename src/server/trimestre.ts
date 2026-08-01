// Découpage en trimestres civils — la maille du relevé de TVA (docs/AGENT.md §2.3).
//
// Fonctions pures, sans accès base : c'est ce qui permet de les vérifier sans
// monter une facture. Le calcul se fait en UTC de bout en bout, comme partout
// où l'application manipule des jours (voir src/lib/jour.ts) : passer par le
// fuseau local décalerait le 1er janvier au 31 décembre pour tout l'ouest de
// Greenwich, et rangerait une facture dans le mauvais trimestre.

export type Trimestre = {
  annee: number;
  /** 1 à 4. */
  numero: number;
  /** Premier jour inclus, au format AAAA-MM-JJ. */
  debut: string;
  /** Dernier jour inclus, au format AAAA-MM-JJ. */
  fin: string;
};

function jourIso(annee: number, moisZeroBase: number, jour: number) {
  return new Date(Date.UTC(annee, moisZeroBase, jour)).toISOString().slice(0, 10);
}

export function trimestre(annee: number, numero: number): Trimestre {
  const n = Math.min(4, Math.max(1, Math.trunc(numero)));
  const premierMois = (n - 1) * 3;
  return {
    annee,
    numero: n,
    debut: jourIso(annee, premierMois, 1),
    // Le jour 0 du mois suivant est le dernier du mois courant — ce qui évite
    // d'avoir à connaître les longueurs de mois et les années bissextiles.
    fin: jourIso(annee, premierMois + 3, 0),
  };
}

export function trimestreCourant(maintenant: Date = new Date()): Trimestre {
  return trimestre(maintenant.getUTCFullYear(), Math.floor(maintenant.getUTCMonth() / 3) + 1);
}

export function trimestrePrecedent(t: Trimestre): Trimestre {
  return t.numero === 1 ? trimestre(t.annee - 1, 4) : trimestre(t.annee, t.numero - 1);
}

export function trimestreSuivant(t: Trimestre): Trimestre {
  return t.numero === 4 ? trimestre(t.annee + 1, 1) : trimestre(t.annee, t.numero + 1);
}

export function libelleTrimestre(t: Trimestre): string {
  return `${t.numero === 1 ? "1er" : `${t.numero}e`} trimestre ${t.annee}`;
}
