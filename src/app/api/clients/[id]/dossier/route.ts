import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { getRole } from "@/server/autorisation";
import { chargerFicheClient } from "@/server/repositories/fiche-client";
import { sourcesDuDossier } from "@/server/repositories/dossier-client";
import { getEntreprise } from "@/server/repositories/entreprises";
import { lireRapportParJeton } from "@/server/repositories/passages-entretien";
import { genererPdfRapportEntretien } from "@/server/pdf/rapport-entretien-pdf";
import { lireObjet } from "@/server/storage";
import { logger } from "@/server/logger";
import { ecrireArchiveZip, type EntreeArchive } from "@/lib/archive-zip";
import { enTetesDeRemise } from "@/lib/remise-de-fichier";
import { jourIso } from "@/lib/jour";
import {
  cheminsDuDossier,
  nomDuDossierClient,
  piecesOuvertes,
  type PieceDuDossier,
} from "@/lib/dossier-du-client";

// « Tout télécharger » sur la fiche d'un client — sa demande du 22 octobre
// 2026, planche `appli/telecharger-un-client.html`, sa réponse « la A, et tout
// en PDF ».
//
// **Une adresse, pas une action serveur**, comme « Télécharger mes données » :
// un fichier n'a pas à traverser le mécanisme qui a coûté vingt échanges
// (« Invalid Server Actions request. », `CLAUDE.md` §5).
//
// **Ni preuve récente, ni réservé au patron**, à l'inverse de l'export complet :
// le fichier ne porte que des pièces que la personne ouvre déjà une à une
// depuis la même fiche (`piecesOuvertes`). Il ne donne rien de plus, il évite
// seulement dix appuis.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();

  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  const role = await getRole(ctx);
  // Client inexistant ou d'une autre entreprise : la même réponse, pour ne pas
  // dire à un curieux qu'il a visé juste.
  const fiche = role ? await chargerFicheClient(ctx, id) : null;
  if (!role || !fiche) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const { devis, factures, fiches, avoirs } = fiche.pieces;
  const pieces = piecesOuvertes(role, [
    ...devis.map((piece) => ({ registre: "devis" as const, piece })),
    ...factures.map((piece) => ({ registre: "factures" as const, piece })),
    ...fiches.map((piece) => ({ registre: "fiches" as const, piece })),
    ...avoirs.map((piece) => ({ registre: "avoirs" as const, piece })),
  ]);
  const chemins = cheminsDuDossier(pieces);
  const client = fiche.client;
  const [sources, entreprise] = await Promise.all([sourcesDuDossier(ctx, pieces), getEntreprise(ctx)]);

  async function octetsDe(p: PieceDuDossier): Promise<Uint8Array | null> {
    const source = sources.get(p.piece.id);
    if (!source) return null;
    if ("cle" in source) return new Uint8Array(await lireObjet(source.cle));
    const rapport = await lireRapportParJeton(source.jeton);
    if (!rapport) return null;
    return genererPdfRapportEntretien({
      rapport,
      entrepriseAdresse: entreprise?.adresse ?? null,
      entrepriseSiret: entreprise?.siret ?? null,
      entrepriseTelephone: entreprise?.telephone ?? null,
      entrepriseEmail: entreprise?.email ?? null,
      // Sans montant, un IBAN inviterait à payer une somme que personne n'a écrite.
      entrepriseIban: null,
      clientAdresse: client.adresse ?? null,
      clientTelephone: client.telephone ?? null,
    });
  }

  const maintenant = new Date();

  async function* entrees(): AsyncGenerator<EntreeArchive> {
    const absents: string[] = [];
    for (const [rang, p] of pieces.entries()) {
      // **Une pièce qui manque n'arrête pas le dossier, et elle se DIT.** Le
      // reste part ; le fichier « A lire.txt » nomme ce qui n'a pas pu suivre.
      // Un dossier qui se tairait laisserait croire qu'il est complet, et c'est
      // celui qu'on garde dix ans.
      try {
        const octets = await octetsDe(p);
        if (octets) yield { nom: chemins[rang], contenu: octets };
        else absents.push(chemins[rang]);
      } catch (err) {
        logger.error("Pièce absente du dossier d'un client", {
          chemin: chemins[rang],
          erreur: err instanceof Error ? err.message : String(err),
        });
        absents.push(chemins[rang]);
      }
    }
    if (absents.length > 0) {
      yield {
        nom: "A lire.txt",
        contenu: new TextEncoder().encode(
          "Ces pièces apparaissent sur la fiche du client, mais leur fichier n'a pas été retrouvé.\n" +
            "Aucune n'a été refaite à la place de l'original.\n\n" +
            absents.join("\n") +
            "\n"
        ),
      };
    }
  }

  // Construit UNE fois, hors du flux : dans `pull`, il repartirait de zéro à
  // chaque morceau demandé (`api/mes-donnees`).
  const archive = ecrireArchiveZip(entrees(), maintenant);
  const flux = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await archive.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await archive.return(undefined);
    },
  });

  return new NextResponse(flux, {
    headers: {
      ...enTetesDeRemise({
        telecharger: true,
        nom: nomDuDossierClient(client.nom, jourIso(maintenant)),
        type: "application/zip",
      }),
      "Cache-Control": "no-store",
    },
  });
}
