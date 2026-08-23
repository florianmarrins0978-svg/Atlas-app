import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { genererDevisSansPrix } from "@/server/repositories/devis";

// **La feuille de chantier : le devis, sans un seul prix.**
//
// Sa décision du 21 août 2026 : *« le salarié ne doit pas avoir accès au prix
// [...] je pense que le plus simple, ça serait de mettre le devis en PDF sans
// les prix »*. Le raisonnement — pourquoi le devis lui-même plutôt qu'une liste
// de prestations saisie à côté — est dans `devis-pdf.ts`.
//
// **`chantierId` et non `id`** : les routes voisines de ce dossier emploient
// déjà ce nom, et Next.js refuse deux noms différents pour le même segment
// dynamique. L'oublier ne casse pas cette route-là : **le serveur entier refuse
// de démarrer** (voir la fiche de chantier, même dossier).
//
// **Toujours régénéré, jamais servi depuis le stockage** : le PDF figé à
// l'envoi porte tous les prix, et le rendre ici serait exactement ce qu'on
// cherche à éviter.
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ chantierId: string }> }
) {
  const { chantierId } = await params;
  const ctx = await getCurrentCtx();

  const pdf = await genererDevisSansPrix(ctx, chantierId);
  // Chantier inexistant, sans devis, ou appartenant à une autre entreprise :
  // même réponse pour les trois. Distinguer « il existe mais pas chez vous » de
  // « il n'existe pas » dirait à un curieux qu'il a visé juste.
  if (!pdf) {
    return NextResponse.json({ error: "Aucun devis pour ce chantier" }, { status: 404 });
  }

  // `inline` : il l'ouvre sur le chantier, au téléphone, pour LIRE. Le
  // téléchargement forcé l'obligerait à ressortir de l'application pour trouver
  // le fichier (`src/app/api/devis/[id]/pdf/route.ts`, 7 août 2026).
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="feuille-de-chantier.pdf"`,
    },
  });
}
