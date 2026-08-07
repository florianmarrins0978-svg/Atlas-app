import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { verifierLimite } from "@/server/rate-limit";
import { LIMITES } from "@/server/rate-limit/types";
import { chercherAdresses } from "@/server/adresses/base-adresse-nationale";

// La liste d'adresses proposée pendant la frappe.
//
// **Réservée à quelqu'un de connecté, et comptée.** Sans cela, l'adresse
// publique du banc d'essai deviendrait un relais ouvert vers un service public :
// n'importe qui pourrait s'en servir pour interroger la Base Adresse Nationale
// en se faisant passer pour nous, et c'est nous qui serions coupés.
//
// Une route, pas une action serveur : une frappe déclenche une requête tous les
// quelques dixièmes de seconde, et les actions serveur sont sérialisées par
// Next.js — la liste arriverait en retard sur ce qui est tapé.

export const dynamic = "force-dynamic";

export async function GET(requete: Request) {
  const ctx = await getCurrentCtx();

  // Par entreprise, comme le reste : un compte qui s'emballe ne doit pas couper
  // l'aide à la saisie de tous les autres.
  const limite = await verifierLimite(`adresses:${ctx.entrepriseId}`, LIMITES.rechercheAdresse);
  if (!limite.autorise) {
    // 200 et une liste vide, délibérément : le champ redevient un champ
    // ordinaire et la saisie continue. Une erreur ici ferait clignoter un
    // message rouge sous les doigts de quelqu'un qui tape simplement vite.
    return NextResponse.json({ suggestions: [] });
  }

  const saisie = new URL(requete.url).searchParams.get("q") ?? "";
  const resultat = await chercherAdresses(saisie);

  return NextResponse.json(
    { suggestions: resultat.ok ? resultat.suggestions : [] },
    // Rien ne se met en cache : deux frappes voisines ne donnent pas la même
    // liste, et une liste figée serait pire que pas de liste.
    { headers: { "Cache-Control": "no-store" } }
  );
}
