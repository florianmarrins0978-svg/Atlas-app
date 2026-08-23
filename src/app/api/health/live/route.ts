import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * L'en-tête par lequel Atlas SIGNE ses réponses.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi une signature, et ce que son absence a coûté.**
 *
 * Le 23 août 2026, le patron ouvre Atlas depuis son téléphone : son navigateur
 * lui propose de TÉLÉCHARGER un fichier. Sa fiche d'état annonce alors
 * *« réponse 404 d'ATLAS lui-même — le port est bien ouvert, c'est
 * l'application qui refuse »*, et envoie donc lire le journal du serveur.
 *
 * **Or ce verdict était une DEVINETTE.** `_verdict-port.mjs` tranchait sur
 * l'absence du mot « github » dans l'en-tête `Server` de la réponse. Un refus du
 * relais arrivé nu — sans en-tête, sans type, ce qui est précisément ce qu'il a
 * reçu — était donc mis au compte d'Atlas. La fiche accusait le mauvais
 * coupable, exactement le travers qu'elle avait été écrite pour éviter
 * (`AGENTS.md` : *une erreur qui envoie chercher au mauvais endroit coûte plus
 * cher que pas d'erreur du tout*), et deux hypothèses fausses ont été livrées
 * au patron avant qu'on ne le voie.
 *
 * **Une signature ne se devine pas.** Le relais de GitHub ne peut pas
 * l'inventer : si cet en-tête est là, c'est qu'Atlas a répondu ; s'il manque,
 * c'est que la requête n'est jamais arrivée jusqu'à lui. Le diagnostic cesse
 * d'être une lecture d'indices pour devenir une constatation.
 *
 * Posée sur `live` et non sur une route dédiée : c'est déjà celle que le
 * diagnostic interroge, et une seconde route n'aurait fait qu'un endroit de
 * plus où l'oubli est possible.
 */
export const EN_TETE_SIGNATURE = "x-atlas-vivant";

// Liveness : le process répond, un point c'est tout. Jamais d'accès base —
// une base indisponible ne doit jamais faire redémarrer un process
// applicatif par ailleurs sain (c'est le rôle de /api/health/ready).
export async function GET() {
  return NextResponse.json(
    { statut: "vivant" },
    { status: 200, headers: { [EN_TETE_SIGNATURE]: "1" } }
  );
}
