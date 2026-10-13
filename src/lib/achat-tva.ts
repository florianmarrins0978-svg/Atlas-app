// Un achat, sa TVA, et ce qu'il reste à payer.
//
// **Sa demande du 12 août 2026 :** *« je veux également qu'on puisse intégrer
// la TVA due, donc les essences, les tronçonneuses »*. Jusque-là l'application
// ne connaissait que la TVA collectée — ce que ses clients lui versent — et
// l'écran ne pouvait donc pas répondre à la seule question qui l'intéresse :
// combien reste-t-il à payer.
//
// Retenu sur maquette (`docs/maquettes/37`), après quatre corrections de sa
// main.
//
// **Révisé le 13 octobre 2026 : il décide désormais de la PART récupérée, sur
// une nature que le patron confirme.** Le fichier disait jusque-là qu'il ne
// jugerait jamais, faute de source. Les sources ont été lues (BOFiP, voir
// `recuperation`), et ne pas juger avait un coût réel : tout achat comptait en
// entier, si bien qu'un hôtel ou un repas perso faisait baisser la TVA à
// payer. Sa demande : *« chaque entrée et chaque sortie doit être notée, mais si
// c'est une catégorie où il ne récupère pas la TVA, elle ne doit pas être
// comptabilisée »*. Planche : `appli/tva-ticket-carburant.html`.
//
// Ce qui reste hors d'atteinte, faute de texte officiel lu, et qu'Atlas ne
// tranche donc pas : l'alcool d'un repas, le repas pris seul, le gazole non
// routier des machines. Son comptable (`TODO.md`).

/** Deux façons pour un achat d'entrer : l'objectif, ou le clavier. */
export type SaisieAchat = "scan" | "main";

/**
 * La TVA contenue dans un total qui la comprend déjà.
 *
 * **Le piège, et il coûte cher :** la TVA d'un ticket de 120 € à 20 % n'est pas
 * 120 × 0,20 = 24 €, mais 20 €. Le total est TTC : la taxe est dedans, pas
 * dessus. Se tromper d'un cinquième sur chaque ticket fausse le relevé d'un
 * bout à l'autre de l'année, et rien à l'écran ne le dirait.
 *
 * Rend `null` sur tout ce qui n'est pas calculable — un total absent, un taux
 * nul ou négatif. On n'invente pas un montant à partir de rien.
 */
export function tvaDepuisTtc(totalTtc: number | null, tauxPourCent: number | null): number | null {
  if (totalTtc === null || tauxPourCent === null) return null;
  if (!Number.isFinite(totalTtc) || !Number.isFinite(tauxPourCent)) return null;
  if (tauxPourCent <= 0 || totalTtc < 0) return null;
  const tva = totalTtc - totalTtc / (1 + tauxPourCent / 100);
  // Deux décimales : c'est la monnaie, et une TVA à quatorze chiffres après la
  // virgule ne se recopie pas sur une déclaration.
  return Math.round(tva * 100) / 100;
}

/**
 * Ce qu'il reste à payer : collectée moins déductible.
 *
 * **Peut être négatif, et c'est un état normal** — un mois où l'on achète une
 * machine sans facturer grand-chose donne un crédit de TVA. L'écran doit
 * pouvoir l'écrire ; le borner à zéro cacherait précisément le mois où le
 * patron a le plus besoin de savoir.
 */
export function tvaDue(collectee: number, deductible: number): number {
  return Math.round((collectee - deductible) * 100) / 100;
}

/**
 * Un montant écrit à la main, tel qu'il arrive du clavier.
 *
 * Accepte la virgule autant que le point, l'euro collé au chiffre, et les
 * espaces des milliers : le patron tape « 1 234,50 € » sans y penser, et un
 * champ qui refuse sa façon d'écrire est un champ qu'il abandonne.
 *
 * Rend `null` sur ce qui n'est pas un nombre — jamais zéro, qui serait un
 * montant, donc un mensonge.
 */
export function montantSaisi(texte: string | null | undefined): number | null {
  if (texte === null || texte === undefined) return null;
  const propre = texte
    .replace(/ /g, " ")
    .replace(/[^\d,.\-]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (propre === "" || propre === "-" || propre === ".") return null;
  const n = Number(propre);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Ce qu'il faut au minimum pour enregistrer un achat.
 *
 * **Le fournisseur et la TVA, rien d'autre.** Le total et le taux sont utiles
 * mais pas indispensables : un ticket qui n'affiche que « TVA 3,20 € » se
 * saisit tel quel. Exiger davantage reviendrait à refuser l'achat plutôt qu'à
 * l'enregistrer incomplet — et un achat refusé est un achat perdu.
 */
export function achatComplet(fournisseur: string, tvaDeductible: number | null): boolean {
  return fournisseur.trim() !== "" && tvaDeductible !== null && tvaDeductible >= 0;
}

// ─── Ce qui se récupère ──────────────────────────────────────────────────────

/** Ce qu'est un achat. Une ligne sans nature est un achat d'avant le
 *  13 octobre 2026 : elle compte comme elle comptait, rien n'est réécrit. */
export const NATURES_ACHAT = ["carburant", "materiel", "repas", "hotel", "transport", "autre"] as const;
export type NatureAchat = (typeof NATURES_ACHAT)[number];

/** Le mot de la puce, celui qu'il touche. */
export const LIBELLE_NATURE: Record<NatureAchat, string> = {
  carburant: "Carburant",
  materiel: "Matériel",
  repas: "Repas",
  hotel: "Hôtel",
  transport: "Train, taxi",
  autre: "Autre",
};

export type VehiculeAchat = "utilitaire" | "voiture";
export type RepasAchat = "affaires" | "perso";

export function estNatureAchat(v: unknown): v is NatureAchat {
  return typeof v === "string" && (NATURES_ACHAT as readonly string[]).includes(v);
}

/**
 * Ce qu'est l'achat, dit en mots pour la liste : « Carburant d'une voiture »,
 * « Repas d'affaires avec M. Durand ». `null` pour un achat d'avant le
 * 13 octobre 2026, qui n'a pas de nature : on ne lui en invente pas.
 *
 * Des phrases, ni point médian ni tiret (`CLAUDE.md` §3).
 */
export function natureEnMots(a: {
  nature: NatureAchat | null;
  vehicule: VehiculeAchat | null;
  repas: RepasAchat | null;
  avecQui: string | null;
}): string | null {
  if (a.nature === null) return null;
  if (a.nature === "carburant") {
    if (a.vehicule === "utilitaire") return "Carburant d’un utilitaire";
    if (a.vehicule === "voiture") return "Carburant d’une voiture";
    return "Carburant";
  }
  if (a.nature === "repas") {
    if (a.repas === "perso") return "Repas perso";
    if (a.repas === "affaires") {
      const qui = a.avecQui?.trim();
      return qui ? `Repas d’affaires avec ${qui}` : "Repas d’affaires";
    }
    return "Repas";
  }
  return LIBELLE_NATURE[a.nature];
}

/** Jusqu'où la note du restaurant suffit (BOI-TVA-DECLA-30-20-20 § 140). */
export const SEUIL_NOTE_REPAS_HT = 150;

/**
 * Faut-il une vraie facture plutôt que la note ?
 *
 * **Le seuil se lit sur le HT, jamais sur le total payé** : 150 € HT à 10 %
 * font 165 € TTC. Un HT qu'on ne peut pas calculer ne se suppose pas sous le
 * seuil : c'est la pièce la plus exigeante qu'on demande alors.
 */
export function factureRepasExigee(totalTtc: number | null, tauxPourCent: number | null): boolean {
  if (totalTtc === null || tauxPourCent === null || !(tauxPourCent > 0)) return true;
  // Au centime : 165,00 € à 10 % font 150,00 € HT, qui est AU seuil, pas
  // au delà ; un flottant de 150,0000001 exigerait une facture à tort.
  const ht = Math.round((totalTtc / (1 + tauxPourCent / 100)) * 100) / 100;
  return ht > SEUIL_NOTE_REPAS_HT;
}

export type AchatARecuperer = {
  nature: NatureAchat;
  vehicule: VehiculeAchat | null;
  repas: RepasAchat | null;
  avecQui: string | null;
  pourquoi: string | null;
  /** La mention de l'entreprise sur la note, ou la facture à son nom au delà
   *  du seuil : il la coche, Atlas ne la voit pas. */
  justificatif: boolean;
  totalTtc: number | null;
  tauxTva: number | null;
  /** La TVA écrite sur le ticket, celle qu'il a payée. */
  tvaTicket: number;
};

/**
 * La TVA qui compte, et ce qui manque pour qu'elle compte.
 *
 * | | |
 * |---|---|
 * | carburant d'un utilitaire | 100 % |
 * | carburant d'une voiture | 80 % (essence et gazole alignés depuis 2022) |
 * | matériel, autre | 100 %, comme avant |
 * | hôtel, train, taxi, repas perso | 0 % : noté, jamais compté |
 * | repas d'affaires | 100 % **seulement** avec ses trois preuves |
 *
 * **Le repas d'affaires** — sa consigne du 13 octobre 2026, *« qu'on ne puisse
 * pas nous reprocher quoi que ce soit »*. BOI-TVA-DECLA-30-20-20 § 150 : la
 * déduction est subordonnée à l'identification du client sur la note (§ 140 :
 * une facture complète au delà de 150 € HT). Et pour un contrôle, avec qui et
 * pourquoi. Il en manque une : le repas est noté, sa TVA ne compte pas, et
 * `manques` le dit pour qu'il complète.
 *
 * **Un choix absent n'est jamais supposé** : un carburant sans véhicule, un
 * repas sans « affaires » ni « perso », rendent zéro et nomment ce qui manque.
 * L'écran coche Utilitaire et Perso d'avance ; ce n'est pas à la règle de le
 * faire à sa place.
 */
export function recuperation(a: AchatARecuperer): { tvaRecuperee: number; manques: string[] } {
  const manques: string[] = [];
  let part = 0;

  switch (a.nature) {
    case "carburant":
      if (a.vehicule === "utilitaire") part = 1;
      else if (a.vehicule === "voiture") part = 0.8;
      else manques.push("le véhicule");
      break;
    case "materiel":
    case "autre":
      part = 1;
      break;
    case "hotel":
    case "transport":
      part = 0;
      break;
    case "repas":
      if (a.repas === "perso") break;
      if (a.repas !== "affaires") {
        manques.push("affaires ou perso");
        break;
      }
      if (!a.avecQui?.trim()) manques.push("avec qui");
      if (!a.pourquoi?.trim()) manques.push("pourquoi");
      if (!a.justificatif) {
        manques.push(
          factureRepasExigee(a.totalTtc, a.tauxTva)
            ? "la facture au nom de l’entreprise"
            : "le nom de l’entreprise sur la note"
        );
      }
      if (manques.length === 0) part = 1;
      break;
  }

  return { tvaRecuperee: Math.round(a.tvaTicket * part * 100) / 100, manques };
}
