import type { Ctx } from "../repositories/context";
import { creerDocument, ajouterFragments } from "../repositories/documents";
import { getDevisPourChantier, getLignesDevis } from "../repositories/devis";
import { getNoteVocale } from "../repositories/notes-vocales";
import { listerPhotos } from "../repositories/photos";
import { getChantier } from "../repositories/chantiers";
import { decouperTexte } from "./chunking";

// Chaque fonction ingère UNE source réelle existante vers la base
// documentaire. Aucun contenu n'est jamais inventé : si la source est vide ou
// absente, aucun document n'est créé. Pas de déduplication à ce stade (MVP) —
// ré-ingérer une même source crée un nouveau document, à éviter côté appelant.

export async function ingererDevis(ctx: Ctx, chantierId: string) {
  const devis = await getDevisPourChantier(ctx, chantierId);
  if (!devis) return null;

  const lignes = await getLignesDevis(ctx, devis.id);
  const chantier = await getChantier(ctx, chantierId);

  const texte = [
    `Devis ${devis.numeroCommercial} (version ${devis.numeroVersion}, statut ${devis.statut}) pour le chantier ${chantier?.nom ?? ""}.`,
    ...lignes.map((l) => `${l.libelle} : ${l.montant} €.`),
    `Total HT ${devis.totalHt} €, TVA ${devis.totalTva} €, total TTC ${devis.totalTtc} €.`,
  ].join(" ");

  const document = await creerDocument(ctx, {
    chantierId,
    typeDocument: "devis",
    titre: `Devis ${devis.numeroCommercial}`,
    sourceReferenceId: devis.id,
  });
  if (!document) return null;

  const fragments = decouperTexte(texte).map((contenu, i) => ({ position: i, contenu }));
  await ajouterFragments(ctx, document.id, fragments);
  return document;
}

export async function ingererTranscription(ctx: Ctx, chantierId: string) {
  const note = await getNoteVocale(ctx, chantierId);
  if (!note || note.transcriptionStatut !== "reussie" || !note.transcription) return null;

  const chantier = await getChantier(ctx, chantierId);
  const document = await creerDocument(ctx, {
    chantierId,
    typeDocument: "transcription",
    titre: `Note vocale — ${chantier?.nom ?? "chantier"}`,
    sourceReferenceId: note.id,
  });
  if (!document) return null;

  const fragments = decouperTexte(note.transcription).map((contenu, i) => ({ position: i, contenu }));
  await ajouterFragments(ctx, document.id, fragments);
  return document;
}

// Photos : jamais d'analyse d'image (hors périmètre). Seules les métadonnées
// réellement enregistrées deviennent un texte recherchable.
export async function ingererPhotosMetadonnees(ctx: Ctx, chantierId: string) {
  const photos = await listerPhotos(ctx, chantierId);
  if (photos.length === 0) return null;

  const chantier = await getChantier(ctx, chantierId);
  const document = await creerDocument(ctx, {
    chantierId,
    typeDocument: "photo",
    titre: `Photos — ${chantier?.nom ?? "chantier"}`,
  });
  if (!document) return null;

  const fragments = photos.map((p, i) => ({
    position: i,
    contenu: `Photo ${p.nomOriginal ?? p.id} ajoutée le ${new Date(p.createdAt).toLocaleDateString("fr-FR")} (${p.mimeType}).`,
  }));
  await ajouterFragments(ctx, document.id, fragments);
  return document;
}
