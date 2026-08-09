import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { adresseDuCompte, configurationGoogle, echangerCode } from "@/server/agenda/google";
import { enregistrerRaccordement } from "@/server/repositories/agendas-externes";
import { TEMOIN_ETAT_AGENDA } from "@/app/reglages/agenda/temoin";

/**
 * Le retour de chez Google, une fois que l'artisan a dit oui.
 *
 * **Ce chemin ne fait confiance à rien de ce qu'il reçoit.** Tout arrive par
 * l'adresse, c'est-à-dire depuis le navigateur, c'est-à-dire depuis n'importe
 * qui. Trois vérifications avant d'écrire quoi que ce soit :
 *
 *   1. **une session, et le propriétaire de l'entreprise.** Sans elle, on ne
 *      saurait même pas à qui rattacher l'agenda ;
 *   2. **le témoin anti-rejeu.** Sans lui, quelqu'un pourrait faire ouvrir à
 *      l'artisan une adresse de retour portant SON code d'autorisation à lui —
 *      et l'agenda d'un inconnu se retrouverait branché sur l'Atlas de
 *      l'artisan, à lire ses disponibilités ;
 *   3. **l'absence d'erreur renvoyée par Google**, qui arrive quand l'artisan
 *      refuse, et qu'il ne faut pas confondre avec une panne.
 *
 * Le témoin est effacé dans tous les cas, réussite comprise : un jeton
 * d'anti-rejeu qui resterait valable après usage ne protégerait plus de grand
 * chose.
 */
export async function GET(requete: NextRequest) {
  const boite = await cookies();
  const attendu = boite.get(TEMOIN_ETAT_AGENDA)?.value ?? "";
  boite.delete(TEMOIN_ETAT_AGENDA);

  const params = requete.nextUrl.searchParams;

  // L'artisan a cliqué « Annuler » chez Google. Ce n'est pas une panne, et le
  // lui présenter comme telle l'inquiéterait pour rien.
  const refus = params.get("error");
  if (refus) return versReglages("refus");

  const code = params.get("code") ?? "";
  const etat = params.get("state") ?? "";
  if (!code || !etat || !attendu || etat !== attendu) return versReglages("etat");

  const config = configurationGoogle();
  if (!config) return versReglages("non_configure");

  try {
    const ctx = await getCurrentCtx();
    await exigerProprietaire(ctx, "relier un agenda");
    const jetons = await echangerCode(config, code);
    // L'adresse du compte est un confort — savoir LEQUEL est branché. Elle ne
    // doit pas faire échouer le raccordement si Google ne la rend pas.
    const compte = await adresseDuCompte(jetons.acces);
    await enregistrerRaccordement(ctx, jetons, compte);
    return versReglages("relie");
  } catch {
    // Le détail part dans `derniere_erreur` quand la panne survient à la
    // lecture ; ici, l'échange lui-même a raté et il n'y a pas encore de ligne
    // où l'écrire. L'écran dit ce qui s'est passé et propose de recommencer —
    // c'est la seule action utile.
    return versReglages("echec");
  }
}

function versReglages(issue: string) {
  const base = process.env.NEXTAUTH_URL ?? process.env.ATLAS_URL_PUBLIQUE ?? "http://localhost:3000";
  return NextResponse.redirect(new URL(`/reglages/agenda?issue=${issue}`, base));
}
