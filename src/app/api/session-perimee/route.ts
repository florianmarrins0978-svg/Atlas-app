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
  /**
   * **UN SITE TIERS NE DOIT PAS POUVOIR DÉCONNECTER LE PATRON — constat F2.**
   *
   * Cette route efface six cookies sur un simple `GET`. Une page étrangère qui
   * pose `<img src="https://atlas…/api/session-perimee">` la déclenche donc en
   * silence : le navigateur envoie les cookies, le serveur répond avec des
   * `Set-Cookie` vides, et le patron se retrouve dehors sans avoir rien fait.
   * Ce n'est pas un vol de données — c'est une nuisance, et elle est gratuite.
   *
   * ── POURQUOI `Sec-Fetch-Site` ET NON `Sec-Fetch-Dest` ────────────────────
   *
   * `Dest: document` aurait paru plus simple, et **cela aurait cassé un vrai
   * parcours** : quatre des cinq appels légitimes viennent d'un `redirect()`
   * côté serveur (`session-ctx.ts`, `GardeDocumentsLegaux`,
   * `documents-legaux/actions.ts`). Suivi depuis une action serveur, le routeur
   * de Next va le chercher en `fetch` — `Dest` vaut alors `empty`, et la session
   * périmée ne s'effacerait plus. C'est le piège du cookie mort que rien
   * n'efface, payé une soirée le 10 août 2026.
   *
   * `Sec-Fetch-Site`, lui, dit d'où vient la demande, quel que soit son moyen.
   * Tous les appels d'Atlas sont de **même origine** ; seule une page étrangère
   * vaut `cross-site`.
   *
   * ── L'ABSENCE DE L'EN-TÊTE LAISSE PASSER, ET C'EST RAISONNÉ ──────────────
   *
   * Un navigateur ne permet pas de la retirer : elle est posée par lui, jamais
   * par la page. Ce qui n'en envoie pas est un client sans navigateur — donc
   * sans cookie à effacer. Refuser dans ce cas priverait un vieux navigateur du
   * remède sans gêner personne d'autre.
   */
  const provenance = requete.headers.get("sec-fetch-site");
  if (provenance === "cross-site") {
    return new NextResponse(null, { status: 403 });
  }

  const boite = await cookies();
  for (const nom of COOKIES_DE_SESSION) {
    // **`__Secure-` et `__Host-` EXIGENT l'attribut `Secure` — sans lui, le
    // navigateur REFUSE l'effacement, en silence.**
    //
    // C'est le défaut du 10 août 2026 au soir, et il était pire que celui qu'il
    // réparait : le patron a vu son application tourner en rond,
    // `/login → /api/session-perimee → /login`, sans fin. Derrière le relais de
    // son espace, tout est en HTTPS : Auth.js nomme donc son cookie
    // `__Secure-authjs.session-token`. L'effacement partait sans `Secure`, le
    // navigateur le jetait — la règle des préfixes le lui impose — et le fantôme
    // survivait à chaque tour. Vu à `curl`, l'en-tête paraissait pourtant
    // parfait : c'est le NAVIGATEUR qui refusait, pas le serveur qui oubliait.
    //
    // L'inverse est vrai aussi : poser `Secure` sur les noms sans préfixe les
    // rendrait inopérants en clair, c'est-à-dire sur le banc local. On aligne
    // donc l'attribut sur le nom, jamais sur une supposition d'environnement.
    const exigeSecure = nom.startsWith("__Secure-") || nom.startsWith("__Host-");
    // `delete` ne suffit pas toujours : un cookie posé avec un chemin précis
    // survit à une suppression qui ne le vise pas. On écrase donc aussi la
    // valeur, avec une expiration dans le passé.
    boite.delete(nom);
    boite.set(nom, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      secure: exigeSecure,
      sameSite: "lax",
    });
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
