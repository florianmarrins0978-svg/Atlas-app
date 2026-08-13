"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";

/**
 * L'identité de l'entreprise, écrite depuis les réglages.
 *
 * **Le manque que ça comble, et il était bloquant.** Jusqu'au 13 août 2026,
 * l'identité ne se saisissait QUE depuis « le devis écrit à la main »
 * (`chantiers/[id]/devis-complet/`) — donc au milieu de la rédaction d'un devis.
 * Un artisan qui suivait le parcours normal — dicter, chiffrer, envoyer — n'avait
 * jamais l'occasion de saisir son SIRET, et **son premier devis partait sans
 * SIRET, sans adresse et sans IBAN, sans un mot** (`ARCHITECTURE.md` §81).
 *
 * **Réservé au propriétaire.** Ces champs identifient l'entreprise et portent
 * ses coordonnées bancaires : un salarié ou un commercial n'a rien à y faire
 * (`docs/QUESTIONS.md` §10).
 *
 * **Le retour est une valeur, jamais une exception.** Le message d'une erreur
 * levée par une action serveur n'arrive jamais jusqu'au patron — Next.js le
 * remplace en production par un identifiant opaque, et son banc sert une version
 * bâtie (`HANDOVER.md`, piège 0 ter). Un refus attendu se rend donc en valeur.
 */
export type ResultatIdentite = { ok: true } | { ok: false; raison: string };

export async function majIdentiteAction(data: {
  nom?: string;
  formeJuridique?: string;
  adresse?: string;
  siret?: string;
  telephone?: string;
  email?: string;
  iban?: string;
  titulaireCompte?: string;
  numeroTva?: string;
  regimeTva?: "assujettie" | "franchise";
}): Promise<ResultatIdentite> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "modifier l'identité de l'entreprise");
  } catch {
    return { ok: false, raison: "Seul le patron peut modifier ces informations." };
  }

  // Le nom est le seul champ qui ne peut pas être vidé : il porte l'en-tête de
  // chaque document, et une pièce sans émetteur n'est pas une pièce.
  if (data.nom !== undefined && data.nom.trim() === "") {
    return { ok: false, raison: "Le nom de l'entreprise ne peut pas être vide." };
  }

  try {
    await mettreAJourEntreprise(ctx, data);
    return { ok: true };
  } catch (erreur) {
    // Journalisé AVANT de rendre : sans cela le défaut serait muet, et c'est le
    // piège que `AGENTS.md` nomme — « devant un défaut muet, la première
    // livraison n'est pas un correctif, c'est de rendre le défaut bavard ».
    console.error("[reglages/identite] écriture refusée", erreur);
    return { ok: false, raison: "L'enregistrement n'a pas abouti. Réessayez." };
  }
}
