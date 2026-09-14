import {
  composerDocument,
  PALETTE_DOCUMENT,
  PIED_DOCUMENT,
  type DonneesDocument,
  type LigneDocument,
  type TraceDocument,
  type LogoDocument,
} from "./document-commun";
import { jourNumerique } from "../../lib/jour";
import {
  lireConditions,
  lignesConditionsDevis,
  type ConditionsLues,
} from "@/lib/conditions-documents";
import type { Allure } from "@/lib/allure-documents";
import { LIBELLE_MAIN_DOEUVRE } from "@/lib/main-doeuvre-devis";
import { TITRE_CONDITIONS_GENERALES, paragraphesConditionsGenerales } from "@/lib/conditions-generales";
import {
  echeancierDevis,
  libelleLigneAcompte,
  phrasesAcomptes,
  type AcompteDevis,
} from "@/lib/acomptes-devis";

// Le devis, à l'image du modèle d'Arborea (`appli/devis-modele.html`).
//
// Pourquoi ce fichier est si court : la mise en page vit dans
// `document-commun.ts`, partagée avec la facture. Le modèle du patron donne aux
// deux pièces exactement la même feuille — en-tête, titre centré, colonnes
// émetteur/client, tableau réglé, totaux, notes, modalités, pied. Les copier
// aurait produit deux implémentations qui divergent (`CLAUDE.md` §3), et
// l'écart se serait vu sur ce que le client garde.
//
// Ne reste ici que ce qui appartient au devis : ses références d'en-tête, sa
// durée de validité, sa mention légale, et son cadre de signature.

export type LigneDevisPdf = LigneDocument;

export type DevisPdfData = DonneesDocument & {
  numeroCommercial: string;
  numeroVersion: number;
  statut: "brouillon" | "envoye";
  dateEmission: string;
  /** Recopiée à la création. `null` : aucune durée ne s'imprime. */
  validiteJours?: number | null;
  /**
   * Les cinq autres conditions, recopiées elles aussi (migration 0064).
   *
   * **Elles n'arrivaient nulle part avant le 25 août 2026**, et c'est le patron
   * qui l'a vu : *« les autres qui sont en ON doivent-ils être visibles sur le
   * devis ? car je ne vois rien »*. `lignesConditionsDevis` composait déjà les
   * phrases ; seul l'aperçu des Réglages l'appelait.
   *
   * Absentes (`undefined`) sur les devis d'avant la migration : rien de plus ne
   * s'imprime, et ces documents-là sortent identiques à eux-mêmes.
   */
  conditionsReglees?: ConditionsLues | null;
  /**
   * Les acomptes posés sur le devis, en taux CUMULÉS (migration 0088).
   *
   * Le papier en tire deux choses par la règle commune : les lignes sous le
   * total — chaque acompte avec ce qui tombe ce jour-là, puis « Reste à régler
   * après acompte » et le montant, *« chez le client il faut marquer reste à
   * régler après acompte et le montant »* — et les phrases des notes.
   * Absents ou vides : la feuille sort comme avant, et la phrase du réglage
   * reste dans les notes.
   */
  acomptes?: readonly AcompteDevis[] | null;
  /**
   * « dont main d'œuvre HT » (migration 0090) — la lecture B du 12 septembre
   * 2026 : nommée sous le total HT, jamais comptée, les totaux ne bougent pas.
   * Absente ou nulle : pas de ligne.
   */
  mainDoeuvreHt?: string | null;
  /** Son titre, s'il en a donné un (migration 0092). Vide : rien ne s'imprime. */
  titre?: string | null;
};

/**
 * La durée de validité vient du DEVIS, plus d'une constante.
 *
 * Elle était écrite en dur — « 30 jours », la même pour tous les artisans, et
 * aucun écran ne la montrait. Un couvreur qui tient ses prix quinze jours
 * envoyait donc un devis qui l'engageait trente (`ARCHITECTURE.md` §102).
 *
 * **Elle est recopiée dans le devis à sa création**, comme l'identité : un
 * document garde ce qu'il portait. Les devis d'avant la migration 0040 valent
 * 30, ce que la constante écrivait — ils ne changent pas.
 */
function libelleValiditeDevis(jours: number | null | undefined): string | null {
  if (jours === null || jours === undefined) return null;
  return `${jours} jour${jours > 1 ? "s" : ""}`;
}

/**
 * Options d'impression du devis.
 *
 * **`sansChiffrage` — le devis rendu SANS un seul prix**, sa décision du
 * 21 août 2026 : *« le salarié ne doit pas avoir accès au prix. Est-ce que tu
 * peux me faire un PDF du devis sans les prix, ou est-ce que le plus simple
 * c'est de créer une fiche prestations sous le client ? [...] je pense que le
 * plus simple, ça serait de mettre le devis en PDF sans les prix. »*
 *
 * **C'est le bon choix, et pour une raison de fond :** une fiche
 * « prestations » saisie à côté serait une SECONDE liste de ce qui est à faire.
 * Le devis change — une ligne ajoutée au téléphone, une quantité corrigée — et
 * les deux divergent en silence ; l'équipe part alors avec la version d'avant.
 * Ici la feuille n'est pas un document de plus : c'est le devis lui-même, rendu
 * sans ses colonnes de prix. Rien à tenir à jour, rien qui puisse mentir.
 *
 * Le mécanisme existait déjà — la fiche de chantier du 20 août s'en sert
 * (`document-commun.ts`, `sansChiffrage`). Le rebâtir aurait fait deux mises en
 * page qui divergent sur les feuilles d'un même artisan.
 */
export type OptionsDevisPdf = {
  sansChiffrage?: boolean;
  /**
   * L'allure réglée par le patron (23 août 2026). Absente : le devis d'avant.
   *
   * **Elle ne sert PAS la feuille de chantier**, et c'est sa décision : le
   * réglage porte sur « le devis et la facture seulement ». Or la feuille sort
   * d'ici, par `sansChiffrage` — d'où le filtre plus bas, qui est la règle et
   * pas une précaution.
   */
  allure?: Allure | null;
  /** Son logo, lu par le dépôt. Suit exactement le sort de l'allure. */
  logo?: LogoDocument | null;
};

/**
 * Le bloc « NOTES / CONDITIONS » : SON texte d'abord, les conditions réglées
 * dessous.
 *
 * **Pourquoi cet ordre, et pas l'inverse.** Ce qu'il a écrit à la main parle de
 * CE chantier — l'accès par le portail de gauche, la cour à dégager la veille.
 * C'est ce que le client doit lire en premier ; les conditions de paiement sont
 * les mêmes sur tous ses devis.
 *
 * **Et rien ne se perd.** Le champ libre n'est ni remplacé ni réécrit : les
 * lignes réglées s'ajoutent dessous. Quand il n'a rien écrit, le bloc ne porte
 * qu'elles — ce qui est exactement la proposition A de la planche 60, sans
 * qu'il ait eu à choisir entre les deux.
 *
 * **Le montant de l'acompte s'écrit ICI parce que le total y est connu.** Dans
 * l'aperçu des Réglages il ne l'est pas, et `lignesConditionsDevis` le tait
 * plutôt que d'inventer un chiffre — un montant supposé à cet endroit finirait
 * imprimé chez un client (`CLAUDE.md` §4).
 */
/**
 * Deux voix dans le même bloc : SON texte, en maigre, puis les conditions
 * réglées, **en gras** — sa demande du 12 septembre 2026 : *« le bloc Notes /
 * conditions en gras : mode de règlement, acompte, solde, moyens de paiement,
 * retard »*. Le gras porte sur ce qui engage et se calcule ; ce qu'il a tapé
 * à la main reste ce qu'il est, une note.
 */
function blocNotes(data: DevisPdfData, sansPrix: boolean): { sien: string | null; reglees: string[] } {
  const sien = data.conditionsPaiement?.trim() || null;
  // **Aucune condition sur la feuille de chantier.** Elle part chez un salarié,
  // sans un prix : « acompte de 30 % » y serait un montant, et le document
  // cesserait d'être ce qu'il annonce. C'est la règle que suit déjà l'IBAN.
  if (sansPrix) return { sien, reglees: [] };

  const reglees = lignesConditionsDevis(
    lireConditions(data.conditionsReglees),
    Number(data.totalTtc),
    // Les acomptes posés remplacent la phrase du réglage ; sans eux, elle reste.
    phrasesAcomptes(echeancierDevis(data.acomptes ?? [], data.totalTtc))
  );
  return { sien, reglees };
}

/**
 * Les conditions générales, après le bon pour accord — sa demande du
 * 12 septembre 2026. Sur une feuille de chantier, rien : elle ne s'accepte pas.
 * Vides (il a tout effacé), rien non plus, pas même le titre.
 */
function annexeConditionsGenerales(data: DevisPdfData, sansPrix: boolean) {
  // Un devis d'avant la 0064 n'a pas de conditions figées du tout : il sort
  // identique à lui-même, sans annexe — la règle de `conditionsReglees`.
  if (sansPrix || !data.conditionsReglees) return null;
  const paragraphes = paragraphesConditionsGenerales(lireConditions(data.conditionsReglees).conditionsGenerales);
  return paragraphes.length ? { titre: TITRE_CONDITIONS_GENERALES, paragraphes } : null;
}

/**
 * Les lignes SOUS le total TTC : chaque acompte avec ce qui tombe ce jour-là,
 * puis le reste à régler. Rien quand le devis n'en porte aucun — la feuille
 * d'avant sort à l'identique.
 */
/**
 * Sous le Total TTC : chaque acompte en gris, puis « Reste à régler » dans la
 * fonte du total — sa planche du 14 septembre 2026.
 */
function lignesApresTotal(data: DevisPdfData): { libelle: string; montant: string; style?: "doux" | "grand" }[] {
  const echeancier = echeancierDevis(data.acomptes ?? [], data.totalTtc);
  if (!echeancier.lignes.length) return [];
  return [
    ...echeancier.lignes.map((l) => ({ libelle: libelleLigneAcompte(l), montant: l.montant, style: "doux" as const })),
    { libelle: "Reste à régler", montant: echeancier.reste, style: "grand" as const },
  ];
}

export async function composerDevisPdf(
  data: DevisPdfData,
  options: OptionsDevisPdf = {}
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  const sansPrix = Boolean(options.sansChiffrage);
  const notes = blocNotes(data, sansPrix);
  return composerDocument({ ...data, conditionsPaiement: notes.sien }, {
    sansChiffrage: options.sansChiffrage,
    // Les conditions réglées, en gras, sous ses notes.
    notesEnGras: notes.reglees,
    // « dont main d'œuvre HT », sous le total HT, sans rien changer aux totaux.
    sousLeTotalHt: data.mainDoeuvreHt
      ? [{ libelle: LIBELLE_MAIN_DOEUVRE, montant: data.mainDoeuvreHt }]
      : [],
    // L'échéancier sous le total ; `sansChiffrage` le saute avec les totaux.
    apresTotal: lignesApresTotal(data),
    // Ses conditions générales, après le bon pour accord.
    annexe: annexeConditionsGenerales(data, sansPrix),
    // **Sa décision du 23 août : le devis et la facture SEULEMENT.** La feuille
    // de chantier sort de la même fabrique, avec `sansChiffrage` — sans ce
    // filtre, elle aurait pris l'allure réglée pour les documents du client
    // alors qu'elle est interne, et il ne l'aurait pas demandé.
    allure: sansPrix ? null : options.allure,
    // **Le logo suit la même règle que l'allure, et pour la même raison.** La
    // feuille de chantier est interne : elle n'a pas à porter la marque qu'on
    // met sur ce que le client garde, et il ne l'a pas demandé.
    logo: sansPrix ? null : options.logo,
    // **Sans les prix, ce n'est plus un devis : c'est la feuille de travail.**
    // Garder le titre « DEVIS » sur un document qu'un salarié emporte ferait
    // croire à un devis amputé — et le client à qui on le montrerait par erreur
    // y verrait un engagement sans montant.
    //
    // Le brouillon, lui, le dit : un devis non envoyé qui ne le signale pas peut
    // être transmis par erreur, alors qu'il n'engage rien.
    titre: sansPrix
      ? "FEUILLE DE CHANTIER"
      : data.statut === "brouillon"
        ? "DEVIS (BROUILLON)"
        : "DEVIS",
    // Le numéro à droite du titre, plus dans les références (sa planche).
    numero: data.numeroCommercial + (data.numeroVersion > 1 ? ` — v${data.numeroVersion}` : ""),
    titreLibre: sansPrix ? null : data.titre,
    references: [
      // Jour/mois/année : personne, en France, ne lit « 2026-08-04 » sur un
      // devis. Le format ISO reste celui de la base, jamais celui du papier.
      ["Date", jourNumerique(data.dateEmission)],
      // Absente quand l'artisan l'a retirée : une ligne « Validité : — » ferait
      // croire à une donnée perdue.
      ...(libelleValiditeDevis(data.validiteJours)
        ? ([["Validité", libelleValiditeDevis(data.validiteJours) as string]] as [string, string][])
        : []),
    ],
    titreNotes: "NOTES / CONDITIONS",
    // **Ni « bon pour accord » ni cadre à signer sur la feuille de travail.**
    // Elle ne s'accepte pas : elle se lit sur le chantier. Lui laisser la
    // mention du devis en ferait un document qu'un client pourrait signer, sans
    // qu'aucun montant n'y figure.
    mentionLegale: (d) =>
      sansPrix
        ? `Feuille de travail établie par ${d.entrepriseNom} d'après le devis ` +
          "correspondant. Elle ne vaut ni devis ni facture, et n'appelle aucun paiement."
        : `Devis établi par ${d.entrepriseNom}, valable selon la durée indiquée ci-dessus. ` +
          "Bon pour accord précédé de la mention manuscrite, daté et signé par le client.",
    cadreSignature: !sansPrix,
  });
}

export async function genererPdfDevis(
  data: DevisPdfData,
  options: OptionsDevisPdf = {}
): Promise<Uint8Array> {
  return (await composerDevisPdf(data, options)).pdf;
}

// Réexportés pour ne pas casser les contrôles et les appelants existants.
export type { TraceDocument as TraceDevis, TexteTrace, TraitTrace, CadreTrace } from "./document-commun";
export const PIED_DEVIS = PIED_DOCUMENT;
export const PALETTE_DEVIS = PALETTE_DOCUMENT;
