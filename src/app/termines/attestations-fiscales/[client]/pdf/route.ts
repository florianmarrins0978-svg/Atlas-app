import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { papierDeLAttestation } from "@/server/repositories/attestations-fiscales";
import { composerAttestationFiscale } from "@/server/pdf/attestation-fiscale-pdf";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";
import { anneeDesAttestations } from "@/lib/attestation-fiscale";
import { jourIso } from "@/lib/jour";

/**
 * LE PDF DE L'ATTESTATION FISCALE D'UN CLIENT : ce qui se relit dans la
 * visionneuse, et ce que la feuille de partage envoie.
 *
 * **Composé à la demande, daté du jour, jamais archivé**, comme la mise en
 * demeure : ce qui est parti se reconnaît à son empreinte
 * (`attestations_fiscales_envoyees`). **À compléter, il ne se compose pas** :
 * un papier fiscal sans adresse ou sans durée partirait chez le client, et la
 * feuille de l'écran dit ce qui manque.
 *
 * La porte est celle de Terminés (`exigerOuverture`, `acces-roles.ts`) : un
 * rôle qui ne voit pas la facturation ne lit pas ce que ses clients ont payé.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ client: string }> }) {
  const { client } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  const annee = anneeDesAttestations(jourIso(new Date()));
  if (annee === null) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const lu = await papierDeLAttestation(ctx, annee, client);
  if (!lu) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (lu.attestation.etat === "a_completer") {
    console.error("[attestation fiscale] à compléter", { clientId: client, manques: lu.attestation.manques });
    return NextResponse.json({ error: lu.attestation.manques[0] }, { status: 409 });
  }

  const { octets } = await composerAttestationFiscale(lu.contenu, lu.logo);
  return new NextResponse(new Uint8Array(octets), {
    headers: {
      ...enTetesDeRemise({
        telecharger: veutTelecharger(req.url),
        nom: `Attestation fiscale ${annee}, ${lu.attestation.client.nom}.pdf`,
        type: "application/pdf",
      }),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
