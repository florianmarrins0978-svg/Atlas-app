import type { Ctx } from "../repositories/context";
import { genererBrouillon, confirmerBrouillon } from "../ai/services/brouillon-service";
import { lancerTranscription } from "../ai/services/transcription-service";
import { getBrouillon } from "../repositories/brouillons-informations";
import { marquerInformationsVerifiees, marquerPrixValide } from "../repositories/chantiers";
import {
  listerLignesPrix,
  ajouterLignePrix,
  lierPrestationsALaLigne,
  prestationsDuLibelle,
} from "../repositories/lignes-prix";
import { noterPropositionDictee } from "../repositories/termes-metier";
import { getNoteVocale } from "../repositories/notes-vocales";
import { getOuCreerDevisBrouillon } from "../repositories/devis";
import { preparerPropositionPrix, type OriginePrix } from "../chiffrage/proposition-prix";
import { appliquerPropositionPrix } from "../chiffrage/appliquer-proposition";
import { peutPreparerDevis } from "../../lib/preparation-devis";
import { listerPrecisions, enregistrerPrecisions, type Precision } from "../repositories/precisions-chantier";
import { listerPrestations, renommerPrestation, completerPrestation } from "../repositories/prestations";
import { structureDepuisPrecisions } from "../../lib/prestation-structuree";
import { libelleEnrichi, questionsAvantChiffrage, type QuestionChiffrage } from "../../lib/questions-chiffrage";
import { lireGrilles } from "../repositories/grilles-reglables";
import { lignesVendables } from "../../lib/lignes-vendables";
import { quantiteCommerciale } from "../../lib/quantite-commerciale";
import type { LectureDictee, PropositionExtraction } from "../ai/schemas/extraction";
import { logger } from "../logger";

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

/**
 * **On mesure ce que la chaîne coûte, parce que personne ne le savait.**
 *
 * Le patron, le 12 août 2026 : *« entre le moment où je clique mon devis et le
 * moment où le devis apparaît, il s'est passé plus de six minutes. »* Le
 * raisonnement disait que c'était impossible — chaque appel à un modèle est
 * borné à trente secondes — mais **personne ne l'avait mesuré chez lui**, et
 * raisonner à distance sur une machine qu'on ne voit pas a déjà coûté cher à ce
 * dépôt (`AGENTS.md`).
 *
 * Cette enveloppe coûte deux `Date.now()` et clôt la question la prochaine
 * fois : si la chaîne met vraiment des minutes, le journal le dira, avec le
 * statut obtenu — et l'on saura quel maillon accuser au lieu de le deviner.
 *
 * Elle journalise **aussi quand la chaîne échoue** : une panne lente est
 * exactement le cas où la durée renseigne le plus.
 */
export async function preparerDevisDepuisDictee(
  ctx: Ctx,
  chantierId: string,
  options: { remplacer?: boolean } = {}
): Promise<ResultatDevisDepuisDictee> {
  const debut = Date.now();
  try {
    const resultat = await executerChaineDevis(ctx, chantierId, options);
    logger.info("Devis depuis dictée : chaîne terminée", {
      chantierId,
      statut: resultat.statut,
      dureeMs: Date.now() - debut,
    });
    return resultat;
  } catch (err) {
    logger.error("Devis depuis dictée : la chaîne a échoué", {
      chantierId,
      dureeMs: Date.now() - debut,
      motif: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function executerChaineDevis(
  ctx: Ctx,
  chantierId: string,
  options: { remplacer?: boolean } = {}
): Promise<ResultatDevisDepuisDictee> {
  // --- 1. La dictée devient une proposition structurée ---------------------
  let generation = await genererBrouillon(ctx, chantierId, { remplacer: options.remplacer });

  // **La chaîne transcrit elle-même, plutôt que de renvoyer le patron le faire.**
  //
  // Le patron, le 11 août 2026, en décrivant le geste qu'il voulait : *« ça
  // enverrait automatiquement toute la transcription sur la page du devis »*,
  // et *« en une touche, on fait tout ça »*.
  //
  // C'était le seul maillon manquant. Tout le reste de cette chaîne existait
  // et était éprouvé, mais elle exigeait une transcription DÉJÀ faite — si bien
  // qu'elle ne pouvait vivre que sur l'écran Transcription, à quatre écrans de
  // l'endroit où il venait de parler. Le geste unique qu'il réclamait butait
  // sur une étape qu'il fallait aller déclencher ailleurs.
  //
  // **On ne réessaie qu'UNE fois**, et seulement s'il y a un son à transcrire :
  // sans note, ou après la purge de l'audio (`docs/RGPD.md` §4), il n'y a rien
  // à reprendre et le dire vaut mieux que boucler.
  if (generation.statut === "transcription_absente") {
    const note = await getNoteVocale(ctx, chantierId);
    if (!note?.storageKey) return { statut: "transcription_absente" };
    await lancerTranscription(ctx, chantierId);
    generation = await genererBrouillon(ctx, chantierId, { remplacer: options.remplacer });
  }
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
  // Ses façons d'abattre à lui : une question qui proposerait les trois
  // d'origine laisserait sa quatrième rangée vide pour toujours.
  const { axes } = await lireGrilles(ctx);

  // **On interroge les PRESTATIONS EN BASE quand elles existent, pas le
  // brouillon.** Sa règle du 31 août 2026 : *« une question n'est posée que si
  // l'information est réellement absente des données structurées de LA
  // prestation concernée. »*
  //
  // Le brouillon ne porte que ce que le modèle a rendu : ni `methode`, ni
  // `caracteristiques`. Décider sur lui, c'est décider sans regarder les
  // colonnes — et redemander une technique et un diamètre déjà connus. Le
  // brouillon reste le repli, pour l'instant qui précède la confirmation.
  const enBase = await listerPrestations(ctx, chantierId);
  const surQuoi = enBase.length > 0 ? enBase : prestations;

  return questionsAvantChiffrage(surQuoi, new Set(deja.map((p) => p.sujet)), axes.techniques);
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

  // **On poursuit même s'il reste des questions sans réponse.** L'arrêt est une
  // offre, jamais une barrière : appuyer sur « Continuer » EST sa décision, et
  // il connaît son métier mieux que ces règles.
  //
  // La première version reposait la question au lieu de chiffrer. L'écran
  // l'emmenait alors au devis quand même — un devis SANS AUCUNE LIGNE, parce
  // que le chiffrage n'avait jamais tourné. Passer outre l'arrêt lui coûtait
  // son devis : le pire des deux mondes, et invisible depuis le code seul.
  return poursuivreJusquAuDevis(ctx, chantierId);
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
      // `renommerPrestation`, et non `modifierPrestation` : ce report est
      // automatique, et ne doit pas marquer la ligne « corrigée par l'artisan ».
      await renommerPrestation(ctx, prestation.id, enrichi);
    }

    // **Et la même précision entre AUSSI dans ses colonnes, pas seulement dans
    // le texte.** C'est la seule source sûre de la méthode et des mesures : le
    // contrat d'extraction ne les demande pas au modèle, mais le patron les a
    // saisies lui-même à l'arrêt qui vaut de l'argent. On déplace une donnée
    // certaine, on n'en fabrique aucune.
    //
    // Le libellé continue de les porter en toutes lettres — « ⌀ 45 cm » est
    // relu par `mesures-arbre.ts` pour trouver la case de sa grille, et le lui
    // retirer avant que ce lecteur sache lire la colonne casserait le chiffrage
    // en silence.
    const siennes = precisions.filter(
      (p) => p.libellePrestation.trim().toLowerCase() === entree[0]
    );
    await completerPrestation(ctx, prestation.id, structureDepuisPrecisions(siennes));
  }
}

async function poursuivreJusquAuDevis(
  ctx: Ctx,
  chantierId: string
): Promise<ResultatDevisDepuisDictee> {
  const brouillon = await getBrouillon(ctx, chantierId);
  const contenu = brouillon?.contenu;

  // Ce qu'il a laissé sans réponse ressort sur le devis plutôt que de
  // disparaître : c'est la seconde moitié de sa règle — ce qui n'a pas été
  // demandé, ou pas obtenu, se **signale**.
  const sansReponse = await questionsRestantes(ctx, chantierId, contenu?.prestations ?? []);

  return chiffrerEtPreparer(ctx, chantierId, {
    aSignaler: sansReponse.map((q) => `${q.libellePrestation} : ${q.question.toLowerCase()} — sans réponse`),
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
    /** Questions de prix laissées sans réponse — portées au devis, pas oubliées. */
    aSignaler?: string[];
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
      // **Le rapport annonce le TOTAL, et nomme toutes les lignes.** Depuis que
      // la fente se détache du reste, n'en montrer qu'une ferait croire au
      // patron que l'autre n'a pas été écrite — et le total affiché ne
      // correspondrait pas à son devis.
      const total = application.lignes.reduce((s, l) => s + Number(l.montant), 0);
      prix = {
        origine: proposition.origine,
        libelle: application.lignes.map((l) => l.libelle).join("\n"),
        montant: total.toFixed(2),
      };
    } else {
      // Le cas courant : la ligne y était déjà (le patron rejoue l'enchaînement).
      // Ce n'est pas un échec du devis, seulement une ligne non ajoutée.
      prixImpossible = application.erreur;
    }
  }

  // --- 3 bis. Sans prix, le travail s'écrit quand même ---------------------
  //
  // **Le défaut du 7 août 2026, et le mot du patron : « le devis ne comporte
  // aucune ligne, gros bug ».** Il dicte « taille d'allégement sur marronnier,
  // suppression des grosses charpentières champignonnées, broyage des déchets,
  // évacuation du gros bois », arrive sur son devis — et le document est vide.
  //
  // Le refus de chiffrer était juste : il n'avait dit ni durée ni équipe, et
  // inventer un prix est ce que ce produit ne fera jamais (`docs/AGENT.md` §3).
  // Mais **refuser un prix n'est pas refuser le travail.** Le devis aurait dû
  // porter ses quatre prestations, prix à compléter — il n'avait plus qu'à les
  // remplir. À la place, sa dictée avait disparu.
  //
  // **Les lignes sortent « à chiffrer », plus à 0 €** (migration 0070). Un zéro
  // affiché comme un montant se lit « gratuit » : c'est une décision là où il
  // n'y a qu'une ignorance, et le devis pouvait partir ainsi. Le travail reste
  // visible, la quantité dictée aussi, et le devis attend son prix.
  if (prixImpossible && (await listerLignesPrix(ctx, chantierId)).length === 0) {
    // **Le même découpage que lorsqu'un prix existe.** Une ligne par prestation
    // dictée était le premier réflexe, et il était faux : le patron aurait vu
    // « abattage », « broyage », « évacuation » sur trois lignes séparées, puis
    // aurait dû les réunir à la main — l'inverse exact de sa règle.
    const prestations = await listerPrestations(ctx, chantierId);
    const aEcrire = lignesVendables(prestations).lignes;
    for (const vendable of aEcrire) {
      // La quantité PHYSIQUE survit même sans prix : une haie de 800 ml qu'on
      // ne sait pas chiffrer reste une haie de 800 ml, et c'est ce qu'il
      // regardera pour poser son montant.
      const q = quantiteCommerciale(vendable.prestations);
      const ligne = await ajouterLignePrix(ctx, chantierId, vendable.libelle, "0", {
        quantite: q.quantite,
        unite: q.unite,
        prixUnitaire: "0",
        aChiffrer: true,
      });
      // Le même lien que sur une ligne chiffrée : ces prestations-là sont bien
      // vendues par cette ligne, même si son prix reste à poser. Les
      // identifiants viennent du découpage — plus du rapprochement par texte.
      try {
        const ids = vendable.prestations.map((p) => p.id).filter((id): id is string => !!id);
        await lierPrestationsALaLigne(
          ctx,
          ligne.id,
          ids.length > 0 ? ids : await prestationsDuLibelle(ctx, chantierId, vendable.libelle)
        );
      } catch {
        // Jamais bloquant — un devis vaut mieux qu'un lien.
      }
    }
    if (aEcrire.length > 0) {
      prixImpossible =
        `${prixImpossible} En attendant, vos ${aEcrire.length} prestation${aEcrire.length > 1 ? "s sont inscrites" : " est inscrite"} ` +
        "sur le devis : il ne reste qu'à poser les prix.";
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

  // **La photographie de ce qu'Atlas a proposé, avant toute retouche.**
  //
  // Le patron, le 7 août 2026 : « comment je fais pour le nourrir et qu'il
  // apprenne de ces erreurs ? » Sans cette photographie, on saurait plus tard ce
  // qu'il a écrit — jamais ce qu'il a CHANGÉ. Or c'est l'écart qui enseigne :
  // « proposé 1 020 € sur une ligne → retenu 850 € + 250 € sur deux lignes ».
  //
  // Jamais bloquant : ne pas savoir retenir une leçon ne doit pas empêcher de
  // préparer un devis. L'apprentissage ne gêne pas le travail.
  try {
    const note = await getNoteVocale(ctx, chantierId);
    await noterPropositionDictee(
      ctx,
      chantierId,
      note?.transcription ?? "",
      lignes.map((l) => ({ libelle: l.libelle, montant: l.montant }))
    );
  } catch {
    // Volontairement silencieux : voir ci-dessus.
  }

  const aVerifier = [
    ...(vues.aSignaler ?? []),
    ...(contenu?.ambiguites ?? []),
    ...(contenu?.informationsManquantes ?? []),
  ];

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
