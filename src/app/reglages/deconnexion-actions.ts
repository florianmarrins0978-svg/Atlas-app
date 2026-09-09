"use server";

import { signOut } from "@/auth";

/**
 * SE DÉCONNECTER DE CET APPAREIL — sa demande du 9 septembre 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE GESTE N'EXISTAIT PAS**, et c'est la question qui l'a fait naître : *« si
 * je clique sur me déconnecter dans les réglages, est-ce que ça me remet à la
 * page de connexion ? »* Il n'y avait aucun « me déconnecter » dans les
 * Réglages — seulement « Me déconnecter partout », au bas de l'écran « Mot de
 * passe », qui ferme AUSSI la tablette et retire Face ID de tous les appareils.
 *
 * ─── POURQUOI `signOut` ET NON `/api/session-perimee` ───────────────────────
 *
 * La route existante efface bien les cookies, et la tentation était forte de
 * la réemployer. Deux raisons de ne pas le faire :
 *
 * 1. **Son nom ment.** Elle existe pour une session dont le COMPTE a disparu
 *    (le 10 août 2026, un cookie fantôme après un jeu de démonstration refait),
 *    et elle renvoie sur `/login?session=perimee`. Rien de tout cela n'est vrai
 *    d'un patron qui sort volontairement.
 * 2. **Elle tient sa propre liste de noms de cookies** — six, avec les préfixes
 *    `__Secure-` et `__Host-`. La recopier ici en ferait une seconde, et deux
 *    listes finissent toujours par diverger (`CLAUDE.md` §3). `signOut` d'Auth.js
 *    efface le cookie qu'Auth.js a lui-même posé, quel que soit son nom.
 *
 * ─── RIEN À FERMER CÔTÉ SERVEUR, ET CE N'EST PAS UN OUBLI ───────────────────
 *
 * La session vit dans un jeton signé (`session: { strategy: "jwt" }`,
 * `src/auth.ts`) : il n'y a aucune ligne de session en base à supprimer. Le
 * cookie parti, ce navigateur n'a plus rien à présenter.
 *
 * **La preuve récente de M11 reste, et c'est raisonné.** Elle est attachée au
 * `sessionId`, un UUID tiré à chaque authentification réelle
 * (`marquerSession`) : la prochaine session en portera un autre et n'en
 * profitera jamais. L'effacer voudrait dire appeler `effacerPreuves`, qui
 * travaille sur TOUT l'utilisateur — donc couper la ré-authentification de sa
 * tablette parce qu'il a fermé son téléphone. Elle expire seule en dix minutes,
 * et `purgerPreuvesPerimees` fait le ménage.
 *
 * ─── CE QUI RESTE SUR L'APPAREIL, DÉLIBÉRÉMENT ──────────────────────────────
 *
 * **Face ID.** C'est toute la différence avec « Me déconnecter partout », qui,
 * lui, retire les clés — sans quoi l'appareil qu'on voulait couper rouvrirait
 * Atlas d'un regard, `signIn("cle-appareil")` ouvrant une session sans mot de
 * passe. Ici, on ne coupe rien à distance : on sort d'un appareil qu'on tient.
 *
 * ─── AUCUN `try/catch` AUTOUR DE CET APPEL ──────────────────────────────────
 *
 * `signOut({ redirectTo })` lève délibérément le `NEXT_REDIRECT` que Next.js
 * attrape pour naviguer. L'entourer d'un `catch` avalerait la redirection : le
 * cookie serait effacé et l'écran resterait là, chaque geste suivant refusé —
 * exactement le piège du cookie mort payé une soirée le 10 août 2026.
 */
export async function seDeconnecterAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
