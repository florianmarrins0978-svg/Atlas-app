"use server";

import { revalidatePath } from "next/cache";
import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { getClient, mettreAJourClient } from "@/server/repositories/clients";
import type { Civilite } from "@/lib/civilite";

/**
 * ─── MODIFIER UN CLIENT DEPUIS SA PROPRE FICHE ──────────────────────────────
 *
 * **Sa demande du 14 septembre 2026 :** *« je veux pouvoir modifier un client
 * si par exemple il change d'adresse ou de numéro »*, puis, devant les trois
 * places proposées (`appli/modifier-un-client.html`) : *« la A »* — une ligne
 * sous ses coordonnées, là où l'on s'aperçoit qu'elles sont fausses.
 *
 * **Ce que cela ajoute, et ce que cela ne remplace pas.** Le chemin d'avant
 * reste : depuis un chantier, `reprendreChantierAction` enregistre la fiche
 * client comme avant. Celui-ci en ouvre un second, pour le cas qu'aucun ne
 * couvrait — un client SANS chantier en cours n'était modifiable nulle part.
 *
 * **CE QUI DIFFÈRE DE L'AUTRE PORTE, et c'est tout son intérêt :** ici, rien
 * du chantier. L'écran du chantier porte l'adresse des TRAVAUX, et le client
 * reprend celle-ci quand il n'en a pas à lui — un confort à la création qui
 * devient un piège quand on vient corriger : changer l'une changeait l'autre
 * sans le dire. Cette action n'écrit que le client.
 *
 * **UN REFUS SE REND EN VALEUR, JAMAIS EN EXCEPTION** (`AGENTS.md`, piège
 * 0 ter) : le message d'une exception levée par une action serveur n'atteint
 * jamais son écran — Next.js le remplace en production par un identifiant
 * opaque, et son banc sert une version bâtie.
 */
export type SesCoordonnees = {
  nom: string;
  civilite: Civilite | null;
  telephone: string;
  email: string;
  adresse: string;
};

export type ResultatCoordonnees = { ok: true } | { ok: false; raison: string };

export async function enregistrerSesCoordonneesAction(
  clientId: string,
  data: SesCoordonnees
): Promise<ResultatCoordonnees> {
  const ctx = await getCurrentCtx();
  // Le même écran que la fiche qu'il vient de quitter : qui peut la lire peut
  // la corriger. Un second droit inventé ici se serait mis à diverger de la
  // règle des rôles (`acces-roles.ts`).
  await exigerEcran(ctx, "/clients", "modifier les coordonnées d'un client");

  // **Le nom seul est obligatoire**, et c'est la règle de l'autre porte :
  // sans lui, la fiche perdrait ce par quoi il la reconnaît. Le reste peut
  // être vide — un client sans e-mail existe.
  const nom = data.nom.trim();
  if (nom.length === 0) {
    return { ok: false, raison: "Le nom ne peut pas être vide." };
  }

  const existant = await getClient(ctx, clientId);
  if (!existant) {
    return { ok: false, raison: "Ce client n'existe plus." };
  }

  const modifie = await mettreAJourClient(ctx, clientId, {
    nom,
    civilite: data.civilite ?? null,
    telephone: data.telephone.trim() || null,
    email: data.email.trim() || null,
    adresse: data.adresse.trim() || null,
  });

  // **`mettreAJourClient` rend `null` quand rien n'a été touché**, et ce n'est
  // pas un détail : la mise à jour est filtrée sur l'entreprise. Zéro ligne
  // veut dire « pas à vous » — le taire aurait rendu un écran qui annonce
  // enregistré sur une fiche inchangée.
  if (!modifie) {
    return { ok: false, raison: "Ces coordonnées n'ont pas pu être enregistrées." };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true };
}
