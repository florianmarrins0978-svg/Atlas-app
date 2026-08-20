/**
 * Le moteur : de la photo au résultat, en six étapes dont deux seulement
 * appellent un fournisseur d'IA.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *      1. Réception     — hors d'ici (`actions.ts` : taille, type, EXIF)
 *      2. Observation   — un appel modèle, vocabulaire fermé
 *      3. Rapprochement — code pur (`src/lib/diagnostic-vegetal.ts`)
 *      4. Classement    — facultatif, et verrouillé (rien ne peut s'ajouter)
 *      5. Arbitrage     — code pur : conclure, relancer une fois, ou refuser
 *      6. Rédaction     — RECOPIE de la fiche, jamais une rédaction
 * ───────────────────────────────────────────────────────────────────────────
 *
 * **Ce fichier ne compose aucune phrase.** Tout ce qui s'affiche vient soit
 * d'une colonne de `fiches_phyto`, soit d'une constante de
 * `src/lib/diagnostic-vegetal.ts`. C'est ce qui rend impossible — par
 * construction et non par consigne — qu'une maladie, une gravité ou un
 * traitement inventés atteignent un écran.
 */

import {
  appliquerClassement,
  arbitrer,
  classeurDeterministe,
  mentionsDeSecurite,
  LIBELLE_CONFIANCE,
  LIBELLE_GRAVITE,
  MOTIFS_REFUS,
  rapprocher,
  type Candidat,
  type ClasseurCandidats,
  type Confiance,
  type Observation,
  type ResultatFige,
} from "@/lib/diagnostic-vegetal";
import { logger } from "../logger";
import {
  lireBasePourMoteur,
  lireFicheComplete,
  trouverTaxon,
  versionBase,
} from "../repositories/fiches-phyto";
import { observer, type ObservationBrute } from "./observation";
import type { ImagePourLecture } from "../ai/providers/llm/interface";
import type { Issue, Traces } from "../repositories/diagnostics";

/**
 * Le classeur employé aujourd'hui : celui qui ne fait rien.
 *
 * **La porte est ouverte, le verrou est posé.** Sa demande du 20 août : ne pas
 * empêcher l'ajout ultérieur d'un classement sémantique ou visuel des fiches
 * candidates. Le brancher se fera ici, en une ligne — et `appliquerClassement`
 * garantira, comme aujourd'hui, qu'aucune fiche absente du filtrage
 * déterministe ne puisse apparaître dans le résultat.
 */
const CLASSEUR: ClasseurCandidats = classeurDeterministe;

export type AnalyseFaite = {
  issue: Issue;
  observation: ObservationBrute;
  traces: Traces;
  essence: { taxonId: string | null; certitude: string | null };
  hypotheses: { ficheId: string; score: number; motifs: unknown[] }[];
};

/**
 * Analyser une ou deux photos.
 *
 * **`complementDejaDemande` vient de la BASE, jamais de l'écran.** C'est
 * l'invariant « une seule relance » : le laisser décider par le navigateur
 * permettrait de le remettre à zéro en rechargeant la page, et l'outil
 * deviendrait le questionnaire qu'il a refusé.
 */
export async function analyser(
  images: ImagePourLecture[],
  options: { complementDejaDemande: boolean; maintenant?: Date }
): Promise<AnalyseFaite> {
  const maintenant = options.maintenant ?? new Date();

  // ── 2. Observation ───────────────────────────────────────────────────────
  const vue = await observer(images);
  if (!vue.ok) {
    return {
      // **Un refus du fournisseur n'est PAS un « inconclusif ».** Le second dit
      // « la base ne sait pas », le premier dit « personne n'a regardé ». Les
      // confondre enverrait chercher un défaut dans les fiches alors qu'il est
      // dans la configuration (`AGENTS.md`).
      issue: { type: "echoue", phrase: vue.raison },
      observation: { partie: null, signes: [], essence: null, qualitePhoto: "moyenne", reserves: [] },
      traces: { moteur: "aucun", modele: "aucun", versionBase: "non lue" },
      essence: { taxonId: null, certitude: null },
      hypotheses: [],
    };
  }

  const brute = vue.observation;
  const traces: Traces = { moteur: vue.moteur, modele: vue.modele, versionBase: await versionBase() };

  // ── L'essence, résolue en taxon — ou laissée inconnue ─────────────────────
  //
  // Rien n'est deviné : un nom que la base ne porte pas laisse `taxonId` à
  // `null`, le rapprochement travaille sans, et la confiance en tient compte.
  // Une essence approchée serait pire qu'aucune — elle exclurait la bonne fiche
  // par exclusion d'hôte, sans le moindre message.
  const taxon = brute.essence ? await trouverTaxon(brute.essence.nomScientifique, brute.essence.nomCommun) : null;

  const observation: Observation = {
    partie: brute.partie,
    signes: brute.signes,
    essence: brute.essence
      ? { taxonId: taxon?.id ?? null, port: brute.essence.port, certitude: brute.essence.certitude }
      : null,
    qualitePhoto: brute.qualitePhoto,
  };
  const essence = { taxonId: taxon?.id ?? null, certitude: brute.essence?.certitude ?? null };

  // ── 3. Rapprochement, puis 4. Classement ─────────────────────────────────
  const base = await lireBasePourMoteur();
  const deterministes = rapprocher(observation, base.fiches, maintenant.getMonth() + 1);

  const classes = await CLASSEUR.classer(observation, deterministes);
  const { candidats, intrus } = appliquerClassement(deterministes, classes);
  if (intrus.length > 0) {
    // Aujourd'hui impossible — le classeur par défaut ne fait rien. Le jour où
    // un classeur sémantique sera branché, ceci est la trace qui dira qu'il a
    // tenté d'inventer une fiche, plutôt que de le découvrir à l'écran.
    logger.error("Diagnostic végétal : un classeur a proposé des fiches hors du filtrage", {
      classeur: CLASSEUR.nom,
      intrus,
    });
  }

  const hypotheses = candidats.slice(0, 10).map((c) => ({
    ficheId: c.fiche.id,
    score: c.score,
    motifs: c.motifs,
  }));

  // ── 5. Arbitrage ─────────────────────────────────────────────────────────
  const verdict = arbitrer(candidats, observation, base.confusions, {
    complementDejaDemande: options.complementDejaDemande,
    baseVide: base.vide,
  });

  if (verdict.issue === "refus") {
    return {
      issue: { type: "inconclusif", motif: verdict.motif, phrase: MOTIFS_REFUS[verdict.motif] },
      observation: brute,
      traces,
      essence,
      hypotheses,
    };
  }

  if (verdict.issue === "complement") {
    return {
      issue: { type: "complement", consigne: verdict.consigne, partie: verdict.partie },
      observation: brute,
      traces,
      essence,
      hypotheses,
    };
  }

  // ── 6. Rédaction — c'est-à-dire une RECOPIE ──────────────────────────────
  const resultat = await composerResultat(verdict.candidat, verdict.confiance);
  if (!resultat) {
    // La fiche a disparu entre le rapprochement et la lecture. Improbable, mais
    // afficher un titre vide serait pire que de le dire.
    return {
      issue: { type: "inconclusif", motif: "aucune_piste", phrase: MOTIFS_REFUS.aucune_piste },
      observation: brute,
      traces,
      essence,
      hypotheses,
    };
  }

  return {
    issue: { type: "rendu", ficheId: verdict.candidat.fiche.id, confiance: verdict.confiance, resultat },
    observation: brute,
    traces,
    essence,
    hypotheses,
  };
}

/**
 * Composer ce que l'écran affichera — **rien qu'en recopiant**.
 *
 * Chaque champ vient d'une colonne de la fiche, ou d'une constante de
 * `diagnostic-vegetal.ts` pour les libellés et les mentions de sécurité. Rien
 * n'est reformulé, rien n'est résumé : un modèle qui « améliorerait » la
 * conduite à tenir la changerait, et c'est précisément la ligne qu'un artisan
 * va suivre sur un arbre.
 *
 * **Exportée, et pas seulement pour la commodité.** Les suites navigateur
 * doivent poser un diagnostic déjà rendu pour photographier l'écran ; elles
 * recopiaient jusque-là ce bloc à la main, ce qui est précisément la règle
 * dupliquée entre l'affichage et la vérification que `CLAUDE.md` §3 interdit —
 * une fiche réelle affichée autrement que la suite ne l'écrit, et la suite
 * reste verte. La même fonction sert désormais aux deux.
 */
export async function composerResultat(candidat: Candidat, confiance: Confiance): Promise<ResultatFige | null> {
  const complet = await lireFicheComplete(candidat.fiche.id);
  if (!complet) return null;
  const { fiche, sources } = complet;

  return {
    ficheCode: fiche.code,
    nom: fiche.nomCommun,
    nomScientifique: fiche.nomScientifique,
    confiance,
    confianceLibelle: LIBELLE_CONFIANCE[confiance],
    explication: fiche.explicationCourte,
    gravite: fiche.gravite,
    graviteLibelle: LIBELLE_GRAVITE[fiche.gravite],
    conduite: fiche.conduiteRecommandee,
    mentions: mentionsDeSecurite({
      gravite: fiche.gravite,
      impactMecanique: fiche.impactMecanique,
      impactMecaniqueNote: fiche.impactMecaniqueNote,
      risqueHumainAnimal: fiche.risqueHumainAnimal,
      risqueHumainAnimalNote: fiche.risqueHumainAnimalNote,
      statutReglementaire: fiche.statutReglementaire,
      referenceReglementaire: fiche.referenceReglementaire,
    }),
    details: {
      categorie: fiche.categorie,
      agentCausal: fiche.agentCausal,
      agentType: fiche.agentType,
      partiesAtteintes: fiche.partiesAtteintes,
      prevention: fiche.prevention,
      gestion: fiche.gestion,
      traitement: fiche.traitement,
      sources: sources.map((s) => ({
        organisme: s.organisme,
        titre: s.titre,
        url: s.url,
        consulteeLe: s.consulteeLe,
        champs: s.champs,
      })),
      versionFiche: fiche.version,
      sourcesAJourLe: fiche.sourcesAJourLe,
    },
  };
}
