import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { liaisonEnTemoin, ouvrirSession } from "@/server/banque/enable-banking";
import { adressePublique } from "@/server/agenda/adresse-publique";
import { TEMOIN_ETAT_BANQUE, TEMOIN_LIAISON_BANQUE } from "@/app/reglages/banque/temoin";

/**
 * Le retour du site de la banque, une fois que le patron a dit oui.
 *
 * Même garde que le retour de Google (`api/agenda/google/retour`), pour la
 * même raison : tout ce qui arrive ici vient du navigateur, donc de n'importe
 * qui. Le patron, le témoin anti-rejeu, puis seulement l'échange du code. Le
 * témoin s'efface dans tous les cas : un anti-rejeu qui resterait valable
 * après usage ne protégerait plus de rien.
 */
export async function GET(requete: NextRequest) {
  const versBanque = (issue: string, raison?: string) =>
    NextResponse.redirect(
      new URL(
        `/reglages/banque?issue=${issue}${raison ? `&raison=${encodeURIComponent(raison)}` : ""}`,
        adressePublique(requete.headers)
      )
    );

  const boite = await cookies();
  const attendu = boite.get(TEMOIN_ETAT_BANQUE)?.value ?? "";
  boite.delete(TEMOIN_ETAT_BANQUE);

  const params = requete.nextUrl.searchParams;
  // Il a annulé chez sa banque : ce n'est pas une panne.
  if (params.get("error")) return versBanque("annule");

  const code = params.get("code") ?? "";
  const etat = params.get("state") ?? "";
  if (!code || !etat || !attendu || etat !== attendu) return versBanque("etat");

  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "relier une banque");

  const r = await ouvrirSession(code);
  if (!r.ok) return versBanque("refus", r.raison);

  boite.set(TEMOIN_LIAISON_BANQUE, liaisonEnTemoin({ session: r.session, comptes: r.comptes, banque: r.banque }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 90 * 24 * 3600, // La durée de l'accord demandé à la banque.
  });
  return versBanque("relie");
}
