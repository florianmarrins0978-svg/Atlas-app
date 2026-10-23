import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { ouvrirSession } from "@/server/banque/enable-banking";
import { enregistrerLiaison } from "@/server/repositories/banque";
import { lireLaBanque } from "@/server/banque/lecture";
import { adressePublique } from "@/server/agenda/adresse-publique";
import { DUREE_DE_L_ACCORD_JOURS, TEMOIN_ETAT_BANQUE } from "@/app/reglages/banque/temoin";

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

  // **En base, et non plus dans un témoin du navigateur** : l'accueil et Ma
  // TVA doivent pouvoir lire la banque sans que l'écran Ma banque soit ouvert,
  // et depuis n'importe lequel de ses appareils.
  const maintenant = new Date();
  await enregistrerLiaison(ctx, {
    session: r.session,
    comptes: r.comptes,
    banque: r.banque,
    accordJusquAu: new Date(maintenant.getTime() + DUREE_DE_L_ACCORD_JOURS * 24 * 3600 * 1000),
  });
  // Le patron est devant son écran : c'est le moment où la banque permet de
  // lire sans compter. Les virements des trente derniers jours arrivent donc
  // tout de suite ; une panne ici n'empêche pas la liaison d'être faite.
  await lireLaBanque(ctx, { maintenant, forcer: true });
  return versBanque("relie");
}
