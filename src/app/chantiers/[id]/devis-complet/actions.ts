"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { retenirLecon } from "@/server/repositories/lecons-prix";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";
import { mettreAJourClient } from "@/server/repositories/clients";
import { modifierLignePrix, supprimerLignePrix, ajouterLignePrix, listerLignesPrix } from "@/server/repositories/lignes-prix";
import { noterRetenu } from "@/server/repositories/termes-metier";
import { apprendrePrixGrille } from "@/server/services/apprendre-grille";
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
  const ligne = await modifierLignePrix(ctx, id, data);

  // **C'est ici que l'agent apprend.** Ce que le patron écrit sur son devis est
  // sa décision — pas notre proposition, pas une moyenne, pas un calcul. Rien
  // ne la retenait jusqu'ici : chaque devis repartait de zéro, et il l'avait
  // dit — « si l'appli n'a aucune mémoire, comment l'IA va se souvenir ? »
  //
  // Volontairement APRÈS l'enregistrement, et sans jamais le faire échouer :
  // ne pas savoir tirer une leçon d'une ligne ne doit pas empêcher d'écrire
  // cette ligne. L'apprentissage ne gêne pas le travail.
  await retenirLecon(ctx, id);

  // **Et c'est ici qu'il apprend à LIRE une dictée.**
  //
  // La leçon ci-dessus retient un prix ; celle-ci retient une façon de
  // découper. Le patron, le 7 août 2026, expliquant pourquoi il a écrit
  // 850 + 250 plutôt que 1 000 + 100 : « si le client ne veut pas la fente, il
  // va trouver le reste cher ; et s'il nous prend juste pour la fente, 100 €
  // ce n'est pas assez ». Cet écart-là ne se devine pas — il s'observe.
  //
  // Silencieux et non bloquant, pour la même raison que ci-dessus.
  if (ligne) {
    try {
      const lignes = await listerLignesPrix(ctx, ligne.chantierId);
      await noterRetenu(
        ctx,
        ligne.chantierId,
        lignes.map((l) => ({ libelle: l.libelle, montant: l.montant }))
      );
    } catch {
      // Ne jamais faire échouer une saisie parce qu'on n'a pas su l'observer.
    }

    // **Et c'est ici que sa grille de fendage se remplit.**
    //
    // *« Le mieux, c'est que je fasse plein de devis et que tu enregistres
    // toutes mes modifications, et dans un mois tu sauras les remplir tout
    // seul. »* — le 7 août 2026. Une grille de 48 cases qu'il devrait remplir
    // à l'avance ne serait jamais remplie ; celle-ci se remplit en travaillant.
    try {
      await apprendrePrixGrille(ctx, ligne.chantierId, {
        libelle: ligne.libelle,
        montant: ligne.montant,
      });
    } catch {
      // Même règle : l'apprentissage ne gêne pas le travail.
    }
  }

  return ligne;
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
