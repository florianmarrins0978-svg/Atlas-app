import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { ActionRefuseeError, exigerChantierDansSaPortee } from "@/server/garde-action";
import { genererDevisSansPrix } from "@/server/repositories/devis";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

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
  // **La feuille d'un chantier qui est DANS SA PORTÉE** (audit du 25 octobre
  // 2026, E5) : un salarié réglé sur ses équipes demandait l'adresse d'un autre
  // chantier et recevait son devis sans prix, nom et adresse du client compris.
  // La fiche de sécurité posait déjà cette garde ; la feuille l'avait oubliée.
  // Même réponse qu'un chantier inexistant, comme plus bas.
  try {
    await exigerChantierDansSaPortee(ctx, chantierId, "ouvrir la feuille de chantier");
  } catch (erreur) {
    if (erreur instanceof ActionRefuseeError) {
      return NextResponse.json({ error: "Aucun devis pour ce chantier" }, { status: 404 });
    }
    throw erreur;
  }

  const pdf = await genererDevisSansPrix(ctx, chantierId);
  // Chantier inexistant, sans devis, ou appartenant à une autre entreprise :
  // même réponse pour les trois. Distinguer « il existe mais pas chez vous » de
  // « il n'existe pas » dirait à un curieux qu'il a visé juste.
  if (!pdf) {
    return NextResponse.json({ error: "Aucun devis pour ce chantier" }, { status: 404 });
  }

  // **La règle de remise vient d'un seul endroit — 13 septembre 2026.** Cette
  // route écrivait ses deux en-têtes à la main : la sixième et dernière à le
  // faire, et c'est ainsi qu'une règle corrigée cinq fois sur six laisse
  // revenir le défaut par la porte qu'on n'a pas regardée (`CLAUDE.md` §3).
  //
  // Le geste par défaut reste `inline` : il l'ouvre sur le chantier, au
  // téléphone, pour LIRE. `?telecharger=1` la range, comme partout ailleurs.
  return new NextResponse(new Uint8Array(pdf), {
    headers: enTetesDeRemise({
      telecharger: veutTelecharger(requete.url),
      nom: "feuille-de-chantier.pdf",
      type: "application/pdf",
    }),
  });
}
