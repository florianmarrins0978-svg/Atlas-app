import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { estProprietaire } from "@/server/autorisation";
import { genererPdfFactureExemple } from "@/server/repositories/factures";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

// La facture d'exemple des Réglages — sa planche du 26 septembre 2026,
// `appli/apercu-du-document.html`, « A et B » : le même bouton sous « Devis &
// factures » et en bas de « Mon entreprise ».
//
// **Réservée au propriétaire, comme les deux écrans qui y mènent.** Ils
// refusent un non-propriétaire avant de lire quoi que ce soit ; une adresse
// d'API se tape, et elle doit refuser pareil — par le même « Introuvable »
// que les autres routes, qui ne dit pas à un curieux qu'il a visé juste.
//
// **Rien ne s'écrit** : ni facture, ni fichier, ni numéro (`genererPdfFactureExemple`).
export async function GET(req: Request) {
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await estProprietaire(ctx))) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const pdf = await genererPdfFactureExemple(ctx);
  return new NextResponse(new Uint8Array(pdf), {
    headers: enTetesDeRemise({
      telecharger: veutTelecharger(req.url),
      nom: "facture-exemple.pdf",
      type: "application/pdf",
    }),
  });
}
