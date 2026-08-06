import type { Ctx } from "../repositories/context";
import { genererBrouillon, confirmerBrouillon } from "../ai/services/brouillon-service";
import { getBrouillon } from "../repositories/brouillons-informations";
import { marquerInformationsVerifiees, marquerPrixValide } from "../repositories/chantiers";
import { listerLignesPrix } from "../repositories/lignes-prix";
import { getOuCreerDevisBrouillon } from "../repositories/devis";
import { preparerPropositionPrix, type OriginePrix } from "../chiffrage/proposition-prix";
import { appliquerPropositionPrix } from "../chiffrage/appliquer-proposition";
import { peutPreparerDevis } from "../../lib/preparation-devis";
import { listerPrecisions, enregistrerPrecisions, type Precision } from "../repositories/precisions-chantier";
import { listerPrestations, modifierPrestation } from "../repositories/prestations";
import { libelleEnrichi, questionsAvantChiffrage, type QuestionChiffrage } from "../../lib/questions-chiffrage";
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
  /**
   * L'arrêt d'avant-chiffrage : il manque ce qui **fait le prix**.
   *
   * Règle confirmée par le patron le 6 août 2026 : ce qui change le prix se
   * demande avant de chiffrer, le reste se signale sur le devis
   * (`docs/EXEMPLE-DICTEE.md` §7). Sur sa dictée du chêne mort, ces deux
   * questions valent 800 € d'écart.
   */
  | { statut: "questions"; questions: QuestionChiffrage[] }
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

  // --- 2 bis. L'arrêt d'avant-chiffrage ------------------------------------
  //
  // Ici, et pas ailleurs : les prestations sont écrites — donc rien de ce qui
  // précède n'est perdu s'il s'arrête là — et rien n'est encore chiffré.
  //
  // Ce qu'on demande vaut de l'argent, et rien d'autre. Sa dictée du chêne
  // mort ne dit ni la technique ni le diamètre, les deux seules choses qui
  // font passer l'abattage de 600 à 1 400 € : chiffrer sans demander serait se
  // tromper du simple au double, et une mention en bas de devis ne rattrape
  // pas 800 €.
  const questions = await questionsRestantes(ctx, chantierId, contenu?.prestations ?? []);
  if (questions.length > 0) return { statut: "questions", questions };

  return chiffrerEtPreparer(ctx, chantierId, { contenu, lecture: brouillon?.lecture ?? "modele", prestations, materiel });
}

/**
 * Les questions encore sans réponse sur ce chantier.
 *
 * Les réponses déjà données sont relues depuis la base : c'est ce qui empêche
 * l'arrêt de se rouvrir tout seul après avoir été franchi, y compris si la
 * dictée est relue plus tard.
 */
async function questionsRestantes(
  ctx: Ctx,
  chantierId: string,
  prestations: { libelle: string; description?: string | null; quantite?: string | null; unite?: string | null }[]
): Promise<QuestionChiffrage[]> {
  const deja = await listerPrecisions(ctx, chantierId);
  return questionsAvantChiffrage(prestations, new Set(deja.map((p) => p.sujet)));
}

/**
 * Reprend la chaîne après que le patron a répondu, **sans relire la dictée**.
 *
 * Repasser par la génération du brouillon rappellerait le modèle — il paierait
 * une seconde lecture pour rien — et pourrait produire une lecture légèrement
 * différente, donc renuméroter les questions et lui reposer celles auxquelles
 * il vient de répondre. Les prestations sont déjà en base : on repart de là.
 */
export async function enregistrerPrecisionsEtReprendre(
  ctx: Ctx,
  chantierId: string,
  reponses: Precision[]
): Promise<ResultatDevisDepuisDictee> {
  await enregistrerPrecisions(ctx, chantierId, reponses);
  await ecrirePrecisionsSurLesPrestations(ctx, chantierId);
  return reprendreDevisApresPrecisions(ctx, chantierId);
}

/**
 * Reporte les réponses sur le libellé des prestations déjà enregistrées.
 *
 * **Sans ce report, l'arrêt n'aurait servi à rien de visible.** Le patron
 * répondrait « démontage avec rétention », et relirait une fiche de chantier
 * qui dit encore « Abattage d'un chêne mort », sans trace de ce qui vient
 * d'être décidé.
 *
 * **Portée exacte, à ne pas surestimer :** cela enrichit la PRESTATION, celle
 * qu'il relit sur l'écran Informations. La ligne du devis, elle, porte
 * l'intitulé du tarif appliqué et ne reprend pas ce libellé — et le montant ne
 * bouge pas davantage, faute de mémoire reliant technique et prix
 * (`docs/EXEMPLE-DICTEE.md` §9c, `TODO.md` §0 ter).
 *
 * Le rapprochement se fait sur le **libellé au moment de la question**, pas sur
 * le rang : une relecture de la dictée peut réordonner les lignes, et un report
 * fondé sur la position collerait alors la technique d'un arbre sur un autre.
 */
async function ecrirePrecisionsSurLesPrestations(ctx: Ctx, chantierId: string): Promise<void> {
  const precisions = await listerPrecisions(ctx, chantierId);
  if (precisions.length === 0) return;

  const parPrestation = new Map<string, string[]>();
  for (const p of precisions) {
    const cle = p.libellePrestation.trim().toLowerCase();
    parPrestation.set(cle, [...(parPrestation.get(cle) ?? []), p.lisible]);
  }

  for (const prestation of await listerPrestations(ctx, chantierId)) {
    // Le libellé en base a pu déjà être enrichi lors d'un passage précédent :
    // on retrouve alors la prestation par son début, jamais par égalité stricte.
    const actuel = prestation.libelle.trim().toLowerCase();
    const entree = [...parPrestation.entries()].find(([cle]) => actuel === cle || actuel.startsWith(`${cle} —`));
    if (!entree) continue;

    const enrichi = libelleEnrichi(prestation.libelle, entree[1]);
    if (enrichi !== prestation.libelle) {
      await modifierPrestation(ctx, prestation.id, enrichi);
    }
  }
}

export async function reprendreDevisApresPrecisions(
  ctx: Ctx,
  chantierId: string
): Promise<ResultatDevisDepuisDictee> {
  const brouillon = await getBrouillon(ctx, chantierId);
  const contenu = brouillon?.contenu;

  const questions = await questionsRestantes(ctx, chantierId, contenu?.prestations ?? []);
  if (questions.length > 0) return { statut: "questions", questions };

  return chiffrerEtPreparer(ctx, chantierId, {
    contenu,
    lecture: brouillon?.lecture ?? "modele",
    prestations: contenu?.prestations.map((l) => l.libelle) ?? [],
    materiel: contenu?.materiel.map((l) => l.libelle) ?? [],
  });
}

async function chiffrerEtPreparer(
  ctx: Ctx,
  chantierId: string,
  vues: {
    contenu: PropositionExtraction | undefined;
    lecture: LectureDictee;
    prestations: string[];
    materiel: string[];
  }
): Promise<ResultatDevisDepuisDictee> {
  const { contenu, prestations, materiel } = vues;

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
      lecture: vues.lecture,
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
