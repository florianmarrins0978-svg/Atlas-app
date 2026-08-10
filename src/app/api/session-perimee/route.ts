import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Se débarrasser d'une session dont le compte n'existe plus.
 *
 * **Pourquoi cette route existe.** Le 10 août 2026, le patron a passé sa soirée
 * bloqué par un cookie : le jeu de démonstration avait été refait, l'ancien
 * compte supprimé, et son navigateur portait toujours la session de ce
 * fantôme. L'application le laissait entrer — le cookie est signé, il est
 * valide — puis chaque écriture était refusée : le compte n'existe plus.
 * Il a vu tour à tour « aucune adhésion d'entreprise », puis un `insert` en
 * échec sur les documents légaux, sans que rien ne relie ces messages à leur
 * cause commune.
 *
 * Lui demander de vider ses cookies n'est pas une réponse : c'est lui faire
 * réparer notre défaut, sur six pouces, à vingt-deux heures.
 *
 * Cette route efface les cookies de session et renvoie à l'écran de connexion.
 * Elle ne touche à AUCUNE donnée : c'est le navigateur qu'elle nettoie, pas la
 * base.
 */
export const dynamic = "force-dynamic";

// Auth.js nomme ses cookies différemment derrière HTTPS (`__Secure-`,
// `__Host-`). On efface les deux familles : ne traiter qu'un cas laisserait le
// défaut intact précisément là où le patron le rencontre, c'est-à-dire derrière
// le relais de son espace de travail.
const COOKIES_DE_SESSION = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

export async function GET(requete: Request) {
  const boite = await cookies();
  for (const nom of COOKIES_DE_SESSION) {
    // `delete` ne suffit pas toujours : un cookie posé avec un chemin précis
    // survit à une suppression qui ne le vise pas. On écrase donc aussi la
    // valeur, avec une expiration dans le passé.
    boite.delete(nom);
    boite.set(nom, "", { path: "/", maxAge: 0, expires: new Date(0) });
  }
  const base = new URL(requete.url);
  return NextResponse.redirect(new URL("/login?session=perimee", base.origin), {
    // 303 : la suite est une page à afficher, jamais une action à rejouer.
    status: 303,
  });
}
