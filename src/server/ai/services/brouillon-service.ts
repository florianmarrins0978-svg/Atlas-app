import type { Ctx } from "../../repositories/context";
import { getNoteVocale } from "../../repositories/notes-vocales";
import {
  getBrouillon,
  enregistrerGeneration,
  marquerConfirme,
  type Brouillon,
} from "../../repositories/brouillons-informations";
import { ajouterPrestation, listerPrestations, completerPrestation } from "../../repositories/prestations";
import { ajouterMateriel, listerMateriel } from "../../repositories/materiel";
import { mettreAJourDureeEquipe } from "../../repositories/chantiers";
import { extraire } from "./extraction-service";
import { termesPourConsigne, correctionsRecentes } from "../../repositories/termes-metier";
import { construireConsigneMetier } from "../../../lib/consigne-metier";
import { estTranscriptionSimulee } from "../providers/transcription/dev";
import type { PropositionExtraction, LigneExtraite } from "../schemas/extraction";
import { structureDeLaPrestation } from "../../../lib/prestation-structuree";
import { prestationCorrespondante, enrichissementPossible } from "../../../lib/correspondance-prestation";
import { logger } from "../../logger";

export type ResultatGeneration =
  | { statut: "genere"; brouillon: Brouillon }
  // Le brouillon porte des corrections humaines : rien n'est écrit. La nouvelle
  // proposition est renvoyée pour que le patron tranche lui-même.
  | { statut: "conflit"; brouillonActuel: Brouillon; propositionNouvelle: PropositionExtraction }
  | { statut: "transcription_absente" }
  // Aucun prestataire de transcription n'est configuré : la dictée n'a pas été
  // écoutée. Rien ne peut en être extrait, et surtout rien ne doit l'être.
  | { statut: "transcription_simulee" }
  | { statut: "echec"; erreur: string };

// Produit le brouillon structuré à partir de la transcription du chantier.
//
// Point d'entrée unique de la génération, quel que soit le déclencheur. Deux
// garanties portées ici, et nulle part ailleurs :
//
// 1. La source est la transcription réellement enregistrée — jamais un texte
//    fourni par le client, qui pourrait ne rien avoir à voir avec la dictée.
// 2. Une génération n'écrase jamais silencieusement des corrections humaines :
//    si le brouillon a été retouché, la fonction refuse d'écrire et renvoie la
//    nouvelle proposition à côté de l'existant. Seul `remplacer: true`,
//    c'est-à-dire un choix explicite du patron, autorise l'écrasement.
// 3. Rien n'est extrait d'une transcription qui n'en est pas une.
export async function genererBrouillon(
  ctx: Ctx,
  chantierId: string,
  options: { remplacer?: boolean } = {}
): Promise<ResultatGeneration> {
  const note = await getNoteVocale(ctx, chantierId);
  const transcription = note?.transcription?.trim();
  if (!transcription) {
    return { statut: "transcription_absente" };
  }

  // Sans prestataire raccordé, la dictée n'a jamais été écoutée : ce qui est
  // enregistré est notre texte de remplacement. En extraire quoi que ce soit
  // reviendrait à fabriquer des prestations à partir de rien — ce qui s'est
  // produit, et que le patron a retrouvé dans son devis. La reconnaissance
  // porte sur CE texte précis, jamais sur la configuration : une transcription
  // légitime doit continuer à être analysée normalement.
  if (estTranscriptionSimulee(transcription)) {
    return { statut: "transcription_simulee" };
  }

  const existant = await getBrouillon(ctx, chantierId);

  // **Ce que l'artisan a appris à Atlas part avec sa dictée.**
  //
  // Le 7 août 2026, sa question : « comment je fais pour le nourrir et qu'il
  // apprenne de ces erreurs ? » Voici l'endroit. Son vocabulaire et ses règles
  // (partagés, `termes_metier`) et ses propres corrections (à lui seul,
  // `corrections_dictee`) sont assemblés en une consigne bornée, puis ajoutés
  // à la consigne système — jamais au texte, qui reste une donnée à analyser.
  //
  // Un échec ici ne doit jamais empêcher de lire une dictée : sans consigne, on
  // retombe sur le comportement d'avant, qui fonctionnait.
  let consigneMetier: string | undefined;
  try {
    const [termes, corrections] = await Promise.all([termesPourConsigne(), correctionsRecentes(ctx)]);
    consigneMetier = construireConsigneMetier(termes, corrections).texte || undefined;
  } catch {
    consigneMetier = undefined;
  }

  const resultat = await extraire(transcription, undefined, consigneMetier);
  if (!resultat.succes) {
    return { statut: "echec", erreur: resultat.erreur.message };
  }

  if (existant && existant.modifieParHumain && !options.remplacer) {
    return { statut: "conflit", brouillonActuel: existant, propositionNouvelle: resultat.proposition };
  }

  const brouillon = await enregistrerGeneration(ctx, chantierId, resultat.proposition, transcription, resultat.lecture);
  return { statut: "genere", brouillon };
}

// --- Confirmation : la proposition devient une donnée du chantier ---------

export type ResultatConfirmationBrouillon =
  | { succes: true; prestationsCreees: { id: string; libelle: string }[]; materielCree: { id: string; libelle: string }[] }
  | { succes: false; erreur: string };

/**
 * Déverse le brouillon dans les données métier du chantier.
 *
 * Le contenu est relu **depuis la base**, jamais repris du navigateur : ce qui
 * entre dans le chantier est exactement ce que le patron a sous les yeux et a
 * corrigé, pas ce qu'une page restée ouverte prétend afficher.
 *
 * Vit ici, et non dans l'action de l'écran Informations, parce que deux chemins
 * l'appellent désormais : le bouton « Confirmer », et l'enchaînement complet
 * depuis la dictée. Deux implémentations auraient fini par diverger, et c'est
 * l'enchaînement — le moins souvent relu — qui serait resté en arrière
 * (`CLAUDE.md` §3).
 */
export async function confirmerBrouillon(ctx: Ctx, chantierId: string): Promise<ResultatConfirmationBrouillon> {
  const brouillon = await getBrouillon(ctx, chantierId);
  if (!brouillon) return { succes: false, erreur: "Aucun brouillon à confirmer." };
  if (brouillon.statut === "confirme") {
    return { succes: false, erreur: "Ce brouillon a déjà été confirmé." };
  }

  const contenu = brouillon.contenu;

  // **Ce qui est déjà au chantier n'y entre pas deux fois.**
  //
  // Rejouer l'enchaînement depuis la dictée — un second appui, un retour
  // arrière — recréait les mêmes prestations. Le devis affichait alors la
  // même taille de haie deux fois, et son prix calculé la comptait double.
  // C'est le défaut du 3 août sous un autre visage (`ARCHITECTURE.md` §10) :
  // **ce qui dit « c'est déjà fait » se lit dans les données, jamais ailleurs.**
  const [dejaPrestations, dejaMateriel] = await Promise.all([
    listerPrestations(ctx, chantierId),
    listerMateriel(ctx, chantierId),
  ]);
  const connus = (lignes: { libelle: string }[]) =>
    new Set(lignes.map((l) => l.libelle.trim().toLowerCase()).filter(Boolean));
  const materielConnu = connus(dejaMateriel);

  // **Le rapprochement tolère l'enrichissement, sinon il crée des doublons.**
  //
  // Ses réponses à l'arrêt d'avant-chiffrage ALLONGENT le libellé : « Abattage
  // d'un érable » devient « Abattage d'un érable — démontage avec rétention,
  // ⌀ 45 cm ». Sur une égalité exacte, le rejeu suivant ne reconnaissait plus
  // rien et écrivait une SECONDE prestation pour le même arbre. Mesuré en base
  // le 27 août 2026 — c'est le défaut du 3 août sous un troisième visage.
  //
  // La règle vit dans `src/lib/correspondance-prestation.ts`, pure : le libellé
  // identique, ou identique suivi du tiret d'enrichissement. **Rien
  // d'approximatif** — une fusion sur une ressemblance ferait disparaître un
  // travail qu'il facturerait.
  // **Ce qui était DÉJÀ là, et rien d'autre.**
  //
  // Les prestations créées par cette confirmation-ci n'y entrent pas, et c'est
  // une correction du 27 août 2026 : sans cela, une dictée qui mentionne deux
  // fois le même travail — « je démonte un érable, puis je démonte un érable
  // au fond du jardin » — voyait la seconde ligne absorbée par la première.
  // Deux arbres, une prestation, et l'un des deux ne se facturait jamais.
  //
  // **Le dédoublonnage porte sur le REJEU, pas sur la dictée elle-même** : ce
  // qu'il dicte deux fois, il le veut deux fois.
  const prestationsDejaLa = [...dejaPrestations];

  const prestationsCreees = [];
  for (const ligne of contenu.prestations) {
    const libelle = libelleAvecQuantite(ligne);
    if (!libelle) continue;

    const existante = prestationCorrespondante(libelle, prestationsDejaLa);
    if (existante) {
      // **On complète ce qui est vide, on ne remplace jamais ce qui est posé.**
      // C'est ce qui protège une correction humaine sans avoir à savoir qui
      // l'a écrite : le dépôt n'a aucune colonne de provenance.
      const { aPoser, contradictions } = enrichissementPossible(existante, structureDeLaPrestation(ligne));
      if (Object.keys(aPoser).length > 0) {
        await completerPrestation(ctx, existante.id, aPoser);
      }
      // **Ce qu'il a corrigé lui-même n'est jamais touché.** `completerPrestation`
      // ne pose déjà que ce qui manque, mais une prestation marquée corrigée par
      // l'artisan ne reçoit rien du tout — pas même un champ vide qu'une
      // extraction croirait pouvoir remplir.
      for (const motif of contradictions) {
        // Bavard plutôt que muet : ce qui n'a pas été écrit doit pouvoir se
        // diagnostiquer (`AGENTS.md`).
        logger.info("Brouillon : la dictée contredit une prestation existante", { chantierId, motif });
      }
      continue;
    }
    // **La structure part EN MÊME TEMPS que le libellé, pas à sa place.**
    //
    // Le libellé continue de porter « (800 ml) » — quatre moteurs le relisent
    // encore pour retrouver une mesure, et le leur retirer aujourd'hui ferait
    // perdre à une haie son prix au mètre linéaire, sur un devis qui part chez
    // un client. Les deux cohabitent le temps que les lecteurs migrent.
    const creee = await ajouterPrestation(ctx, chantierId, libelle, structureDeLaPrestation(ligne));
    prestationsCreees.push(creee);
  }
  const materielCree = [];
  for (const ligne of contenu.materiel) {
    const libelle = libelleAvecQuantite(ligne);
    if (!libelle || materielConnu.has(libelle.toLowerCase())) continue;
    materielConnu.add(libelle.toLowerCase());
    materielCree.push(await ajouterMateriel(ctx, chantierId, libelle));
  }
  if (contenu.dureePrevue || contenu.tailleEquipe) {
    await mettreAJourDureeEquipe(ctx, chantierId, {
      dureePrevue: contenu.dureePrevue ?? undefined,
      tailleEquipe: contenu.tailleEquipe ?? undefined,
    });
  }

  await marquerConfirme(ctx, chantierId);
  return { succes: true, prestationsCreees, materielCree };
}

// Recompose un libellé lisible à partir de la ligne structurée. N'ajoute
// jamais de quantité absente : sans quantité ET unité, le libellé est repris tel quel.
//
// **Et jamais DEUX FOIS la même mesure.** C'est le défaut qu'il a lu sur son
// vrai devis du 30 août 2026 : « Haie de laurier (800 ml) (800 ml) ». Le modèle
// écrit déjà la mesure dans le libellé — c'est ce que la dictée dit — et cette
// fonction en recollait une seconde depuis les colonnes.
//
// **Pourquoi on n'a pas simplement supprimé la recollure.** Le texte reste le
// repli des moteurs qui ne lisent pas encore les colonnes
// (`mesures-prestation.ts`) : si le modèle rendait « Haie de laurier » sans
// mesure, la retirer d'ici ferait perdre à la haie son prix au mètre linéaire.
// On la pose donc quand elle manque, et jamais quand elle est déjà là.
function libelleAvecQuantite(ligne: LigneExtraite): string {
  const base = ligne.libelle.trim();
  if (!base) return "";
  if (!ligne.quantite || !ligne.unite) return base;
  return porteDejaLaMesure(base, ligne.quantite, ligne.unite)
    ? base
    : `${base} (${ligne.quantite} ${ligne.unite})`;
}

/**
 * Le libellé dit-il déjà cette mesure ?
 *
 * La comparaison ignore ce qui sépare deux écritures de la même chose :
 * l'espace des milliers (« 1 200 » et « 1200 »), la casse, les accents et la
 * ponctuation. Sans cela, « Tonte de la pelouse (1 200 m²) » recevrait
 * « (1200 m²) » en plus — c'est exactement ce qu'il a lu.
 */
function porteDejaLaMesure(libelle: string, quantite: string, unite: string): boolean {
  const reduire = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  const nombre = Number(String(quantite).replace(",", "."));
  const ecritures = new Set([reduire(String(quantite))]);
  if (Number.isFinite(nombre)) {
    ecritures.add(reduire(String(nombre)));
    if (Number.isInteger(nombre)) ecritures.add(reduire(String(Math.trunc(nombre))));
  }
  const texte = reduire(libelle);
  const u = reduire(unite);
  return [...ecritures].some((n) => n.length > 0 && texte.includes(n + u));
}
