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
import { mettreAJourEnTeteDevis, getDevisPourChantier } from "@/server/repositories/devis";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier, verifierTypeAudio } from "@/server/upload-limits";
import { lireRetouchesDictees } from "@/server/ai/services/retouches-devis-service";
import type { Changement } from "@/lib/retouches-devis";
import type { Civilite } from "@/lib/civilite";

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
  data: { nom?: string; civilite?: Civilite | null; adresse?: string; telephone?: string; email?: string }
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

/**
 * Dicter des corrections dans le devis — l'écoute, et rien de plus.
 *
 * Le patron, le 15 août 2026 : *« supprime-moi la deuxième ligne, modifie-moi
 * le prix de la taille de haie […] Je vais pouvoir lui parler comme ça et
 * qu'elle comprenne. »*
 *
 * **Cette action ne modifie AUCUNE ligne.** Elle rend ce qu'elle a compris ;
 * l'écran le montre, le patron décoche ce qui ne va pas, puis applique
 * (`appliquerRetouchesAction`). Ces lignes sont le devis que son client
 * recevra : rien n'y entre sans son geste (`CLAUDE.md` §4).
 *
 * **Les lignes sont relues en base, pas reçues du navigateur.** Une dictée
 * interprétée contre une liste que l'écran a envoyée tomberait sur des rangs
 * périmés dès qu'une autre session — ou son propre onglet resté ouvert —
 * aurait bougé le devis entre-temps.
 */
export async function dicterRetouchesDevisAction(chantierId: string, formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) throw new Error("Aucun enregistrement reçu.");

  const taille = verifierTailleFichier(fichier);
  if (!taille.ok) throw new Error(taille.message);
  const type = verifierTypeAudio(fichier.type);
  if (!type.ok) throw new Error(type.message);

  const ctx = await getCurrentCtx();
  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) throw new Error(limite.message);

  const lignes = await listerLignesPrix(ctx, chantierId);
  // La réduction en cours fait partie du contexte : sans elle, « enlève la
  // remise » ne veut rien dire pour le modèle.
  // **`getDevisPourChantier` et non `chargerDevisPourEcran`** : celui-ci rend
  // `null` sur un brouillon, par construction — il sert à relire un devis déjà
  // ENVOYÉ. Or c'est le brouillon qu'on corrige. Défaut trouvé par
  // `test-reduction-parcours-db.ts`, jamais par le typage.
  const devisEnCours = await getDevisPourChantier(ctx, chantierId);
  const octets = Buffer.from(await fichier.arrayBuffer());
  return lireRetouchesDictees(
    octets,
    fichier.type || "audio/webm",
    lignes.map((l) => ({ id: l.id, libelle: l.libelle, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
    devisEnCours?.reductionPourcent ?? null
  );
}

/**
 * Appliquer les changements qu'il a cochés, et eux seuls.
 *
 * Chaque changement repasse par l'action qui lui correspond — `majLigneAction`
 * pour un prix, `retirerLigneAction` pour un retrait : c'est ce qui fait que
 * **l'agent apprend d'une correction dictée comme d'une correction tapée**. Une
 * voie parallèle qui écrirait directement en base priverait la mémoire des prix
 * de tout ce qui passe par la voix.
 *
 * Rend les lignes telles qu'elles sont après coup, pour que l'écran affiche la
 * vérité de la base plutôt que celle qu'il espérait.
 */
export async function appliquerRetouchesAction(chantierId: string, changements: Changement[]) {
  for (const c of changements) {
    switch (c.type) {
      case "reduction": {
        // **Elle ne touche aucune ligne** : c'est l'en-tête du devis qui la
        // porte, et `mettreAJourEnTeteDevis` recalcule les totaux au passage.
        const ctxR = await getCurrentCtx();
        const devisEnCours = await getDevisPourChantier(ctxR, chantierId);
        if (devisEnCours) {
          await mettreAJourEnTeteDevis(ctxR, devisEnCours.id, { reductionPourcent: c.pourcent });
        }
        break;
      }
      case "prix":
        await majLigneAction(c.ligneId, { prixUnitaire: c.prixUnitaire });
        break;
      case "quantite":
        await majLigneAction(c.ligneId, { quantite: c.quantite });
        break;
      case "libelle":
        await majLigneAction(c.ligneId, { libelle: c.libelle });
        break;
      case "retirer":
        await retirerLigneAction(c.ligneId);
        break;
      case "ajouter": {
        const ctx = await getCurrentCtx();
        // **Un ajout sans prix arrive à zéro, et l'écran le dit.** Poser un
        // montant « probable » ici serait inventer un prix sur un document qui
        // part chez un client — le refus le plus ancien du produit.
        const prix = c.prixUnitaire ?? "0";
        const quantite = c.quantite ?? "1";
        await ajouterLignePrix(ctx, chantierId, c.libelle, montantDeLaLigne(quantite, prix), {
          quantite,
          prixUnitaire: prix,
        });
        break;
      }
    }
  }

  const ctx = await getCurrentCtx();
  const lignes = await listerLignesPrix(ctx, chantierId);
  return lignes.map((l) => ({
    id: l.id,
    libelle: l.libelle,
    quantite: l.quantite,
    prixUnitaire: l.prixUnitaire,
    montant: l.montant,
  }));
}

function montantDeLaLigne(quantite: string, prixUnitaire: string): string {
  const total = Number(quantite) * Number(prixUnitaire);
  return Number.isFinite(total) ? total.toFixed(2) : "0.00";
}

// Le taux de TVA et les conditions vivent sur le devis lui-même : ce ne sont
// pas des caractéristiques de l'entreprise ni du chantier, mais de CE document.
export async function majEnTeteDevisAction(
  devisId: string,
  data: { tauxTva?: string; conditionsPaiement?: string; reductionPourcent?: string | null }
) {
  const ctx = await getCurrentCtx();
  const devisModifie = await mettreAJourEnTeteDevis(ctx, devisId, data);
  if (devisModifie?.chantierId) revalidatePath(`/chantiers/${devisModifie.chantierId}/export`);
  return devisModifie;
}
