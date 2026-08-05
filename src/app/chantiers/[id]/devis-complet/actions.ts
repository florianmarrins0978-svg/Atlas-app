"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";
import { mettreAJourClient } from "@/server/repositories/clients";
import { modifierLignePrix, supprimerLignePrix, ajouterLignePrix } from "@/server/repositories/lignes-prix";
import { mettreAJourAdresseChantier } from "@/server/repositories/chantiers";
import { mettreAJourEnTeteDevis } from "@/server/repositories/devis";

// Le devis écrit à la main : chaque champ du document part vers SA source.
//
// **Pourquoi il n'existe pas de « table du devis à la main ».** Le devis est un
// instantané, régénéré depuis l'entreprise, le client, le chantier et les
// lignes de prix (`getOuCreerDevisBrouillon`). Écrire ailleurs créerait une
// seconde vérité, et le document imprimé finirait par contredire l'écran.
// Chaque champ modifie donc la donnée dont il est l'image.

export async function majEmetteurAction(data: {
  nom?: string;
  adresse?: string;
  siret?: string;
  telephone?: string;
  email?: string;
  iban?: string;
}) {
  const ctx = await getCurrentCtx();
  await mettreAJourEntreprise(ctx, data);
}

export async function majClientDuDevisAction(
  clientId: string,
  data: { nom?: string; adresse?: string; telephone?: string; email?: string }
) {
  const ctx = await getCurrentCtx();
  await mettreAJourClient(ctx, clientId, data);
}

export async function majAdresseChantierAction(chantierId: string, adresse: string) {
  const ctx = await getCurrentCtx();
  await mettreAJourAdresseChantier(ctx, chantierId, adresse);
}

export async function majLigneAction(
  id: string,
  data: { libelle?: string; quantite?: string; prixUnitaire?: string }
) {
  const ctx = await getCurrentCtx();
  return modifierLignePrix(ctx, id, data);
}

export async function ajouterLigneAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return ajouterLignePrix(ctx, chantierId, "", "0.00");
}

export async function retirerLigneAction(id: string) {
  const ctx = await getCurrentCtx();
  return supprimerLignePrix(ctx, id);
}

// Le taux de TVA et les conditions vivent sur le devis lui-même : ce ne sont
// pas des caractéristiques de l'entreprise ni du chantier, mais de CE document.
export async function majEnTeteDevisAction(
  devisId: string,
  data: { tauxTva?: string; conditionsPaiement?: string }
) {
  const ctx = await getCurrentCtx();
  const devisModifie = await mettreAJourEnTeteDevis(ctx, devisId, data);
  if (devisModifie?.chantierId) revalidatePath(`/chantiers/${devisModifie.chantierId}/export`);
  return devisModifie;
}
