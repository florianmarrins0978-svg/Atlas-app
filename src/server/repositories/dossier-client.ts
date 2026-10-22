import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { avoirs, devis, factures, passagesEntretien } from "../db/schema";
import type { Ctx } from "./context";
import type { PieceDuDossier } from "@/lib/dossier-du-client";

/**
 * D'où sort chaque pièce du dossier d'un client, pour « Tout télécharger ».
 *
 * **Le fichier figé, jamais un PDF refait.** Un devis envoyé, une facture
 * émise, un avoir sont archivés au moment du départ (`pdfStorageKey`) : c'est
 * ce fichier-là que le client a reçu, et c'est lui qu'on remet. Un fichier
 * absent reste absent (la route le dit), plutôt qu'être recomposé avec des
 * coordonnées qui ont pu changer depuis.
 *
 * **Une fiche d'entretien n'a pas de fichier** : on rend son jeton, et la route
 * relit le rapport par la porte du client (`lireRapportParJeton`).
 *
 * Les mêmes conditions que la fiche (`chargerFicheClient`) sont reposées ici :
 * un identifiant d'une autre entreprise ou un brouillon ne rend rien, même si
 * l'appelant venait à en passer un.
 */
export type SourceDeLaPiece = { cle: string } | { jeton: string } | null;

export async function sourcesDuDossier(
  ctx: Ctx,
  pieces: readonly PieceDuDossier[]
): Promise<Map<string, SourceDeLaPiece>> {
  const ids = (registre: PieceDuDossier["registre"]) =>
    pieces.filter((p) => p.registre === registre).map((p) => p.piece.id);
  const [idsDevis, idsFactures, idsAvoirs, idsFiches] = [
    ids("devis"),
    ids("factures"),
    ids("avoirs"),
    ids("fiches"),
  ];

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const sources = new Map<string, SourceDeLaPiece>();
    // L'une après l'autre : une transaction n'a qu'une connexion, et des
    // requêtes lancées ensemble sur elle s'empilent sans aller plus vite.
    const d = idsDevis.length
      ? await tx
          .select({ id: devis.id, cle: devis.pdfStorageKey })
          .from(devis)
          .where(and(inArray(devis.id, idsDevis), eq(devis.statut, "envoye")))
      : [];
    const f = idsFactures.length
      ? await tx
          .select({ id: factures.id, cle: factures.pdfStorageKey })
          .from(factures)
          .where(and(inArray(factures.id, idsFactures), eq(factures.statut, "emise")))
      : [];
    const a = idsAvoirs.length
      ? await tx.select({ id: avoirs.id, cle: avoirs.pdfStorageKey }).from(avoirs).where(inArray(avoirs.id, idsAvoirs))
      : [];
    const p = idsFiches.length
      ? await tx
          .select({ id: passagesEntretien.id, jeton: passagesEntretien.jeton })
          .from(passagesEntretien)
          .where(and(inArray(passagesEntretien.id, idsFiches), isNotNull(passagesEntretien.envoyeLe)))
      : [];
    for (const r of [...d, ...f, ...a]) sources.set(r.id, r.cle ? { cle: r.cle } : null);
    for (const r of p) sources.set(r.id, r.jeton ? { jeton: r.jeton } : null);
    return sources;
  });
}
