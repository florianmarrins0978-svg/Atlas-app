"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { demanderAccord } from "@/server/banque/enable-banking";
import { adresseDeRetour, retourConfigure } from "@/server/paiement/retour";
import { supprimerLiaison } from "@/server/repositories/banque";
import { TEMOIN_ETAT_BANQUE } from "./temoin";

/**
 * Envoie le patron donner son accord sur le site de sa banque.
 *
 * **Rien n'est gardé à ce stade** : tant qu'il n'a pas dit oui chez sa banque,
 * rien n'est relié. Le refus d'Enable Banking revient à l'écran par l'adresse,
 * avec sa phrase : une exception levée ici lui arriverait en identifiant opaque.
 */
export async function relierBanqueAction(formulaire: FormData): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "relier une banque");

  const banque = String(formulaire.get("banque") ?? "").trim();
  // **La porte « particulier » par défaut — ce que son essai du 23 octobre
  // 2026 a appris.** La porte « Affaires » du Crédit Mutuel menait à l'entrée
  // des grandes entreprises (carte à puce), qui refusait son identifiant ; celle
  // des particuliers l'a accepté, compte pro compris. L'accès entreprise reste
  // possible, par le lien discret de l'écran.
  const typeDeCompte = formulaire.get("entreprise") === "oui" ? "business" : "personal";
  if (!banque) redirect("/reglages/banque?issue=banque");
  // L'adresse de retour ne se déduit jamais de la requête (`paiement/retour.ts`) :
  // sans `ATLAS_URL_PUBLIQUE`, on ne part pas.
  if (!retourConfigure()) redirect("/reglages/banque?issue=adresse");

  const etat = randomBytes(32).toString("base64url");
  const r = await demanderAccord({ banque, etat, retour: adresseDeRetour("/api/banque/retour"), typeDeCompte });
  if (!r.ok) redirect(`/reglages/banque?issue=refus&raison=${encodeURIComponent(r.raison)}`);

  const boite = await cookies();
  boite.set(TEMOIN_ETAT_BANQUE, etat, {
    httpOnly: true,
    sameSite: "lax", // `lax` : le retour vient du site de la banque.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 900, // Le temps de se connecter et de valider dans l'appli de la banque.
  });
  redirect(r.adresse);
}

/**
 * Oublie l'accès. Chez la banque, il s'éteint de lui-même à sa date. Les
 * virements déjà lus restent, avec leurs réponses (`supprimerLiaison`).
 */
export async function delierBanqueAction(): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "délier une banque");
  await supprimerLiaison(ctx);
  redirect("/reglages/banque");
}
