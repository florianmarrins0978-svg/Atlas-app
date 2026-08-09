import type { Ctx } from "../../repositories/context";
import { getNoteVocale } from "../../repositories/notes-vocales";
import {
  getBrouillon,
  enregistrerGeneration,
  marquerConfirme,
  type Brouillon,
} from "../../repositories/brouillons-informations";
import { ajouterPrestation, listerPrestations } from "../../repositories/prestations";
import { ajouterMateriel, listerMateriel } from "../../repositories/materiel";
import { mettreAJourDureeEquipe } from "../../repositories/chantiers";
import { extraire } from "./extraction-service";
import { termesPourConsigne, correctionsRecentes } from "../../repositories/termes-metier";
import { construireConsigneMetier } from "../../../lib/consigne-metier";
import { estTranscriptionSimulee } from "../providers/transcription/dev";
import type { PropositionExtraction, LigneExtraite } from "../schemas/extraction";

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
  const prestationsConnues = connus(dejaPrestations);
  const materielConnu = connus(dejaMateriel);

  const prestationsCreees = [];
  for (const ligne of contenu.prestations) {
    const libelle = libelleAvecQuantite(ligne);
    if (!libelle || prestationsConnues.has(libelle.toLowerCase())) continue;
    prestationsConnues.add(libelle.toLowerCase());
    prestationsCreees.push(await ajouterPrestation(ctx, chantierId, libelle));
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
function libelleAvecQuantite(ligne: LigneExtraite): string {
  const base = ligne.libelle.trim();
  if (!base) return "";
  if (ligne.quantite && ligne.unite) return `${base} (${ligne.quantite} ${ligne.unite})`;
  return base;
}
