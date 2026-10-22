"use server";

import { revalidatePath } from "next/cache";
import { patronQuiImporte } from "@/server/import/garde";
import { annulerRangement, getEnvoi, nommerPiece, piecesAVerifier, rangerEnvoi } from "@/server/repositories/pieces-importees";
import { logger } from "@/server/logger";

// Relire, ranger, annuler. **Un refus se rend, il ne se lève pas** : le message
// d'une exception levée par une action serveur n'arrive jamais jusqu'à l'écran
// (`AGENTS.md`, « rendre le défaut bavard »).

type Refus = { ok: false; raison: string };
const INTROUVABLE: Refus = { ok: false, raison: "Cet envoi n'existe plus." };

export type PieceAVerifier = {
  id: string;
  genre: "devis" | "facture" | null;
  numero: string | null;
  jour: string | null;
  montantTtc: string | null;
};

export async function piecesAVerifierAction(envoiId: string): Promise<{ ok: true; pieces: PieceAVerifier[] } | Refus> {
  const ctx = await patronQuiImporte();
  if (!ctx || !(await getEnvoi(ctx, envoiId))) return INTROUVABLE;
  const pieces = await piecesAVerifier(ctx, envoiId);
  return {
    ok: true,
    pieces: pieces.map((p) => ({ id: p.id, genre: p.genre, numero: p.numero, jour: p.jour, montantTtc: p.montantTtc })),
  };
}

/**
 * Les noms qu'il a tapés, puis le rangement de tout ce qui est prêt. Un nom se
 * relit ici : l'écran ne fixe ni sa longueur ni son genre.
 */
export async function rangerAction(
  envoiId: string,
  noms: { id: string; nom: string; genre: "devis" | "facture" | null }[]
): Promise<{ ok: true; rangees: number } | Refus> {
  const ctx = await patronQuiImporte();
  if (!ctx || !(await getEnvoi(ctx, envoiId))) return INTROUVABLE;
  try {
    for (const n of noms.slice(0, 2000)) {
      const nom = typeof n.nom === "string" ? n.nom.replace(/\s+/g, " ").trim().slice(0, 120) : "";
      const genre = n.genre === "devis" || n.genre === "facture" ? n.genre : null;
      if (nom) await nommerPiece(ctx, n.id, nom, genre);
    }
    const { rangees } = await rangerEnvoi(ctx, envoiId);
    revalidatePath("/clients");
    return { ok: true, rangees };
  } catch (err) {
    logger.error("Rangement des pièces importées impossible", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "Les pièces n’ont pas pu être rangées. Réessayez." };
  }
}

export async function annulerRangementAction(envoiId: string): Promise<{ ok: true } | Refus> {
  const ctx = await patronQuiImporte();
  if (!ctx) return INTROUVABLE;
  try {
    if (!(await annulerRangement(ctx, envoiId))) return INTROUVABLE;
    revalidatePath("/clients");
    return { ok: true };
  } catch (err) {
    logger.error("Annulation d'un rangement impossible", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "Le rangement n’a pas pu être annulé. Réessayez." };
  }
}
