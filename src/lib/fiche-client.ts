import Decimal from "decimal.js";

/**
 * Ce que l'application sait déjà d'un client — la règle, sans base.
 *
 * **D'où ça vient.** Le patron, le 16 août 2026, photo d'un « graphe de
 * connaissances » à l'appui : *« ça peut me servir pour mon appli ? »* La
 * réponse a été non — le dépôt tient déjà sa mémoire, et ses données sont déjà
 * reliées dans une base SQL. Ce qu'il restait à en prendre, et qu'il a retenu
 * (`docs/maquettes/66-ce-que-je-sais-du-client.html`, **arrangement B**) :
 * l'application SAIT qu'un client est venu quatre fois, qu'il doit encore
 * 740 €, qu'on lui fait toujours de l'élagage — **et elle ne le montre nulle
 * part.**
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RIEN N'EST INVENTÉ, ET C'EST LA SEULE RÈGLE QUI COMPTE ICI.
 *
 * Chaque chiffre vient d'une source : les chantiers rattachés au client, les
 * factures émises, les règlements notés, les lignes de prix. **Un client sans
 * facture n'affiche pas « 0 € » comme s'il n'avait rien rapporté** — il affiche
 * qu'il n'y a encore rien eu. La nuance porte tout : « 0 € » se lit comme un
 * mauvais client, « pas encore facturé » se lit comme un chantier en cours
 * (`CLAUDE.md` §4).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `Decimal` PARTOUT. C'est de l'argent, et il le lira sur un téléphone avant de
 * rappeler un client. Le reste du dépôt suit déjà cette règle.
 */

export type ChantierDuClient = {
  id: string;
  nom: string;
  /** Le jour où le chantier a été fait, ou à défaut celui où il est né. */
  jour: string | null;
  /** `null` : aucune facture émise pour ce chantier. */
  totalTtc: string | null;
  /** Ce qui reste à encaisser sur ce chantier. `null` s'il n'y a pas de facture. */
  reste: string | null;
};

export type PrestationRecurrente = {
  libelle: string;
  fois: number;
  /** Le prix moyen pratiqué chez CE client, en euros. */
  prixMoyen: string;
};

export type FicheClient = {
  chantiers: number;
  /** `null` : rien n'a encore été facturé — ce n'est pas « zéro euro ». */
  facture: string | null;
  /** Ce qui reste dû, toutes factures confondues. `null` : rien n'est facturé. */
  du: string | null;
  prestations: PrestationRecurrente[];
  liste: ChantierDuClient[];
};

/** Une ligne de devis, telle que la base la porte. */
export type LigneDuClient = { chantierId: string; libelle: string; montant: string };

/**
 * Regroupe les libellés qui désignent la même prestation.
 *
 * **« Élagage — 3 chênes » et « Élagage d'entretien » sont deux élagages.**
 * Sans ce regroupement, la fiche annoncerait « Élagage — 3 chênes : 1 fois »
 * quatre fois de suite, ce qui n'apprend rien — l'intérêt est justement de voir
 * ce qui REVIENT.
 *
 * **On coupe au premier séparateur, et pas plus.** Un tiret, deux points, une
 * virgule : ce qui suit est presque toujours le détail du chantier (l'essence,
 * le nombre, la longueur). Découper plus finement demanderait de comprendre le
 * métier, et `signatureLecon` le fait déjà ailleurs pour les prix — le refaire
 * ici en moins bien créerait deux vérités.
 */
export function familleDePrestation(libelle: string): string {
  const coupe = libelle.split(/\s[—–-]\s|[:,]/)[0].trim();
  const garde = coupe || libelle.trim();
  // Première lettre en capitale : les libellés sont saisis à la main, et
  // « élagage » et « Élagage » ne doivent pas faire deux familles.
  return garde.charAt(0).toLocaleUpperCase("fr") + garde.slice(1);
}

/** La clé de rapprochement, insensible à la casse et aux accents. */
function cle(libelle: string): string {
  return familleDePrestation(libelle)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Tout ce que la fiche affiche, calculé une fois.
 *
 * **Les prestations sont comptées en CHANTIERS, pas en lignes.** Un devis qui
 * porte « Élagage chêne » et « Élagage frêne » ne fait pas deux visites : dire
 * « 2 fois » sur un seul chantier ferait douter du reste de la fiche.
 */
export function composerFicheClient(
  chantiers: readonly ChantierDuClient[],
  lignes: readonly LigneDuClient[]
): FicheClient {
  const avecFacture = chantiers.filter((c) => c.totalTtc !== null);

  const facture = avecFacture.length
    ? avecFacture
        .reduce((s, c) => s.plus(new Decimal(c.totalTtc!)), new Decimal(0))
        .toFixed(2)
    : null;

  const du = avecFacture.length
    ? avecFacture
        .reduce((s, c) => s.plus(new Decimal(c.reste ?? "0")), new Decimal(0))
        .toFixed(2)
    : null;

  // Une prestation par famille : combien de CHANTIERS l'ont portée, et à quel
  // prix en moyenne.
  const parFamille = new Map<
    string,
    { libelle: string; chantiers: Set<string>; total: Decimal; lignes: number }
  >();
  for (const l of lignes) {
    if (!l.libelle.trim()) continue; // une ligne vide n'est pas une prestation
    const k = cle(l.libelle);
    const vu = parFamille.get(k) ?? {
      libelle: familleDePrestation(l.libelle),
      chantiers: new Set<string>(),
      total: new Decimal(0),
      lignes: 0,
    };
    vu.chantiers.add(l.chantierId);
    vu.total = vu.total.plus(new Decimal(l.montant));
    vu.lignes += 1;
    parFamille.set(k, vu);
  }

  const prestations = [...parFamille.values()]
    .map((v) => ({
      libelle: v.libelle,
      fois: v.chantiers.size,
      prixMoyen: v.total.dividedBy(v.lignes).toFixed(2),
    }))
    // Les plus fréquentes d'abord ; à égalité, la plus chère — c'est celle qui
    // pèse dans la discussion quand le client rappelle.
    .sort((a, b) => b.fois - a.fois || Number(b.prixMoyen) - Number(a.prixMoyen));

  return {
    chantiers: chantiers.length,
    facture,
    du,
    prestations,
    // Le plus récent d'abord : c'est celui dont il se souvient.
    liste: [...chantiers].sort((a, b) => (b.jour ?? "").localeCompare(a.jour ?? "")),
  };
}
