import type { Ctx } from "../../repositories/context";
import { getNoteVocale } from "../../repositories/notes-vocales";
import {
  getBrouillon,
  enregistrerGeneration,
  marquerConfirme,
  type Brouillon,
} from "../../repositories/brouillons-informations";
import { ajouterPrestation } from "../../repositories/prestations";
import { ajouterMateriel } from "../../repositories/materiel";
import { mettreAJourDureeEquipe } from "../../repositories/chantiers";
import { extraire } from "./extraction-service";
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

  const resultat = await extraire(transcription);
  if (!resultat.succes) {
    return { statut: "echec", erreur: resultat.erreur.message };
  }

  if (existant && existant.modifieParHumain && !options.remplacer) {
    return { statut: "conflit", brouillonActuel: existant, propositionNouvelle: resultat.proposition };
  }

  const brouillon = await enregistrerGeneration(ctx, chantierId, resultat.proposition, transcription);
  return { statut: "genere", brouillon };
}

// Recompose un libellé lisible à partir de la ligne structurée. N'ajoute
// jamais de quantité absente : sans quantité ET unité, le libellé est repris
// tel quel — c'est la règle « ne déduis jamais une quantité d'un pluriel »,
// appliquée au moment de l'écriture.
export function libelleAvecQuantite(ligne: LigneExtraite): string {
  const base = ligne.libelle.trim();
  if (!base) return "";
  if (ligne.quantite && ligne.unite) return `${base} (${ligne.quantite} ${ligne.unite})`;
  return base;
}

/** Ce qui a réellement été écrit — l'écran s'en sert pour compléter sa liste
 *  sans recharger la page, et le tapis roulant pour dire ce qu'il a produit. */
export type LigneCreee = { id: string; libelle: string };

export type ResultatConfirmationBrouillon =
  | { statut: "confirme"; prestationsCreees: LigneCreee[]; materielCree: LigneCreee[] }
  | { statut: "absent" }
  | { statut: "deja_confirme" };

// Déverse le brouillon dans les données métier du chantier.
//
// **Vit ici, et non dans un fichier d'actions, parce que deux appelants en ont
// besoin** : l'écran Informations, quand le patron confirme lui-même, et le
// tapis roulant, qui enchaîne la dictée jusqu'au devis sans lui. Deux
// implémentations de cette règle finiraient par diverger — et c'est celle qui
// décide ce qui entre dans un devis.
//
// Le contenu est TOUJOURS relu depuis la base, jamais reçu du navigateur : ce
// qui est appliqué est ce que l'extraction a réellement produit, pas ce qu'une
// page prétend qu'elle a produit.
export async function confirmerBrouillon(ctx: Ctx, chantierId: string): Promise<ResultatConfirmationBrouillon> {
  const brouillon = await getBrouillon(ctx, chantierId);
  if (!brouillon) return { statut: "absent" };
  if (brouillon.statut === "confirme") return { statut: "deja_confirme" };

  const contenu = brouillon.contenu;

  const prestationsCreees: LigneCreee[] = [];
  for (const ligne of contenu.prestations) {
    const libelle = libelleAvecQuantite(ligne);
    if (libelle) {
      const creee = await ajouterPrestation(ctx, chantierId, libelle);
      prestationsCreees.push({ id: creee.id, libelle: creee.libelle });
    }
  }

  const materielCree: LigneCreee[] = [];
  for (const ligne of contenu.materiel) {
    const libelle = libelleAvecQuantite(ligne);
    if (libelle) {
      const cree = await ajouterMateriel(ctx, chantierId, libelle);
      materielCree.push({ id: cree.id, libelle: cree.libelle });
    }
  }

  if (contenu.dureePrevue || contenu.tailleEquipe) {
    await mettreAJourDureeEquipe(ctx, chantierId, {
      dureePrevue: contenu.dureePrevue ?? undefined,
      tailleEquipe: contenu.tailleEquipe ?? undefined,
    });
  }

  await marquerConfirme(ctx, chantierId);
  return { statut: "confirme", prestationsCreees, materielCree };
}
