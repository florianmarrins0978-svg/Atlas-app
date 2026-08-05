import type { Ctx } from "../repositories/context";
import { genererBrouillon, confirmerBrouillon } from "../ai/services/brouillon-service";
import { getBrouillon } from "../repositories/brouillons-informations";
import { marquerInformationsVerifiees, marquerPrixValide } from "../repositories/chantiers";
import { listerLignesPrix } from "../repositories/lignes-prix";
import { getOuCreerDevisBrouillon } from "../repositories/devis";
import { preparerPropositionPrix, type OriginePrix } from "../chiffrage/proposition-prix";
import { appliquerPropositionPrix } from "../chiffrage/appliquer-proposition";
import { peutPreparerDevis } from "../../lib/preparation-devis";
import type { LectureDictee, PropositionExtraction } from "../ai/schemas/extraction";

// **De la dictée au devis, en un seul geste.**
//
// Le patron, le 4 août 2026 : « toujours pas de devis créé tout seul à partir
// de la note vocale ! Problème qui traîne. » Il a raison, et le produit lui
// donnait raison depuis le début : `docs/AGENT.md` §2 décrit l'agent qui
// « transcrit, structure, cherche les tarifs, RÉDIGE LE DEVIS », avec **un seul
// arrêt** — le patron vérifie et valide le devis.
//
// Ce qui existait : chaque maillon, séparément, et éprouvé. Ce qui manquait :
// la chaîne. Le patron devait enchaîner à la main « Générer le brouillon »,
// « Confirmer », « Valider et calculer le prix », « Ajouter au détail »,
// « Préparer le devis » — cinq gestes sur quatre écrans, dont aucun ne menait
// au suivant. Un devis à 0,00 € l'attendait au bout s'il en oubliait un.
//
// Ce que cette fonction ne fait PAS, et ne fera jamais :
//
// - **Elle n'envoie rien.** L'arrêt avant l'envoi est intact : le devis est
//   préparé, le patron le relit, et c'est lui qui décide qu'il parte.
// - **Elle n'invente aucun prix.** Sans tarif correspondant et sans durée ni
//   équipe pour calculer, aucune ligne n'est écrite : le rapport dit pourquoi,
//   en français, et ce qu'il faut faire. Un devis à un montant inventé serait
//   pire que pas de devis du tout.
// - **Elle n'écrase aucune correction humaine.** Un brouillon retouché arrête
//   la chaîne et rend la main au patron, exactement comme le bouton « Générer ».

export type PrixDuDevis = {
  origine: OriginePrix;
  libelle: string;
  montant: string;
};

export type RapportDevisDepuisDictee = {
  /** Comprise par un modèle, ou recopiée mot à mot faute de fournisseur. */
  lecture: LectureDictee;
  prestations: string[];
  materiel: string[];
  dureePrevue: string | null;
  tailleEquipe: string | null;
  /** La ligne de prix écrite au détail, s'il a été possible d'en proposer une. */
  prix: PrixDuDevis | null;
  /** Pourquoi aucun prix n'a pu être proposé — en français, avec la suite à donner. */
  prixImpossible: string | null;
  /** Ambiguïtés et informations absentes de la dictée, à relire avant d'envoyer. */
  aVerifier: string[];
  totalHt: string;
  devisId: string;
};

export type ResultatDevisDepuisDictee =
  | { statut: "transcription_absente" }
  | { statut: "transcription_simulee" }
  | { statut: "conflit"; propositionNouvelle: PropositionExtraction }
  | { statut: "echec"; erreur: string }
  | { statut: "prepare"; rapport: RapportDevisDepuisDictee };

export async function preparerDevisDepuisDictee(
  ctx: Ctx,
  chantierId: string,
  options: { remplacer?: boolean } = {}
): Promise<ResultatDevisDepuisDictee> {
  // --- 1. La dictée devient une proposition structurée ---------------------
  const generation = await genererBrouillon(ctx, chantierId, { remplacer: options.remplacer });
  if (generation.statut === "transcription_absente") return { statut: "transcription_absente" };
  if (generation.statut === "transcription_simulee") return { statut: "transcription_simulee" };
  if (generation.statut === "conflit") {
    return { statut: "conflit", propositionNouvelle: generation.propositionNouvelle };
  }
  if (generation.statut === "echec") return { statut: "echec", erreur: generation.erreur };

  // --- 2. La proposition devient les données du chantier -------------------
  // Un brouillon déjà confirmé n'est pas réappliqué : la génération ci-dessus
  // vient de le remettre à l'état « brouillon », mais un rejeu concurrent
  // pourrait l'avoir devancé. On relit alors ce qui existe, plutôt que de
  // doubler les prestations du patron.
  const confirmation = await confirmerBrouillon(ctx, chantierId);
  const brouillon = await getBrouillon(ctx, chantierId);
  const contenu = brouillon?.contenu;

  const prestations = confirmation.succes
    ? confirmation.prestationsCreees.map((p) => p.libelle)
    : (contenu?.prestations.map((l) => l.libelle) ?? []);
  const materiel = confirmation.succes
    ? confirmation.materielCree.map((m) => m.libelle)
    : (contenu?.materiel.map((l) => l.libelle) ?? []);

  await marquerInformationsVerifiees(ctx, chantierId);

  // --- 3. Le prix ----------------------------------------------------------
  // La proposition est calculée à partir des données qui viennent d'être
  // écrites : tarif correspondant s'il en existe un, sinon chiffrage à partir
  // de la durée et de l'équipe dictées.
  const proposition = await preparerPropositionPrix(ctx, chantierId);
  let prix: PrixDuDevis | null = null;
  let prixImpossible: string | null = null;

  if (!proposition) {
    prixImpossible = "Le chantier est introuvable : aucun prix n'a pu être calculé.";
  } else if (proposition.origine === "tarifs_ambigus") {
    // Choisir à sa place serait choisir son prix. On s'arrête, on le dit.
    const noms = proposition.tarifsCandidats.map((t) => `« ${t.intitule} » (${t.prix} €)`).join(", ");
    prixImpossible =
      `Plusieurs de vos tarifs correspondent à ce chantier : ${noms}. ` +
      "Le choix vous revient — ouvrez l'écran Prix pour désigner celui à appliquer.";
  } else if (proposition.prixPropose === null || !proposition.libelle) {
    prixImpossible =
      "Aucun de vos tarifs ne correspond, et la dictée ne dit ni la durée ni le nombre d'hommes : " +
      "le prix ne peut pas être calculé sans l'inventer. Complétez la durée et l'équipe sur l'écran " +
      "Informations, ou enregistrez un tarif pour ce type de prestation.";
  } else {
    const application = await appliquerPropositionPrix(ctx, chantierId);
    if (application.succes) {
      prix = {
        origine: proposition.origine,
        libelle: application.ligne.libelle,
        montant: application.ligne.montant,
      };
    } else {
      // Le cas courant : la ligne y était déjà (le patron rejoue l'enchaînement).
      // Ce n'est pas un échec du devis, seulement une ligne non ajoutée.
      prixImpossible = application.erreur;
    }
  }

  // --- 4. Le devis ---------------------------------------------------------
  const lignes = await listerLignesPrix(ctx, chantierId);
  // La même fonction que l'écran Prix : un devis sans ligne exploitable ne se
  // déclare pas « prêt », et son jalon de prix n'est pas posé.
  if (peutPreparerDevis(lignes).possible) {
    await marquerPrixValide(ctx, chantierId);
  }
  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);

  const aVerifier = [...(contenu?.ambiguites ?? []), ...(contenu?.informationsManquantes ?? [])];

  return {
    statut: "prepare",
    rapport: {
      lecture: brouillon?.lecture ?? "modele",
      prestations,
      materiel,
      dureePrevue: contenu?.dureePrevue ?? null,
      tailleEquipe: contenu?.tailleEquipe ?? null,
      prix,
      prixImpossible,
      aVerifier,
      totalHt: devis.totalHt,
      devisId: devis.id,
    },
  };
}
