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

export async function GET() {
  const boite = await cookies();
  for (const nom of COOKIES_DE_SESSION) {
    // `delete` ne suffit pas toujours : un cookie posé avec un chemin précis
    // survit à une suppression qui ne le vise pas. On écrase donc aussi la
    // valeur, avec une expiration dans le passé.
    boite.delete(nom);
    boite.set(nom, "", { path: "/", maxAge: 0, expires: new Date(0) });
  }
  // **Adresse RELATIVE, et c'est essentiel.** `NextResponse.redirect` exige une
  // adresse absolue, qu'il faut alors fabriquer depuis `request.url` — laquelle
  // vaut l'adresse d'écoute, `http://0.0.0.0:3000`. Constaté à l'essai : le
  // navigateur du patron aurait été renvoyé vers `0.0.0.0`, qui ne mène nulle
  // part. Le remède l'aurait laissé devant une page morte, exactement comme le
  // défaut qu'il répare. Un `Location` relatif est résolu par le navigateur
  // contre l'adresse qu'il a lui-même ouverte : aucun relais ne peut le tromper.
  return new NextResponse(null, {
    // 303 : la suite est une page à afficher, jamais une action à rejouer.
    status: 303,
    headers: { location: "/login?session=perimee" },
  });
}
