import type { Ctx } from "../repositories/context";
import {
  ajouterLignePrix,
  listerLignesPrix,
  lierPrestationsALaLigne,
  prestationsDuLibelle,
} from "../repositories/lignes-prix";
import { getTarif } from "../repositories/tarifs";
import { preparerPropositionPrix } from "./proposition-prix";
import { ligneDejaAuDetail } from "../../lib/proposition-au-detail";

export type LigneEcrite = { id: string; libelle: string; montant: string };

export type ResultatApplicationPrix =
  | {
      succes: true;
      /** La première ligne écrite — conservée pour les appelants qui n'en attendent qu'une. */
      ligne: LigneEcrite;
      /** Toutes les lignes écrites : le chantier peut en compter plusieurs. */
      lignes: LigneEcrite[];
    }
  | { succes: false; erreur: string };

/**
 * Porte la proposition de prix au détail du chantier.
 *
 * **Le montant n'est jamais repris de ce que le navigateur affiche** : la
 * proposition est recalculée ici, à partir des données en base, et c'est ce
 * résultat-là qui est écrit. Un détail falsifié côté client n'a donc aucun effet.
 *
 * Vit dans un service, et non dans l'action de l'écran Prix, parce que deux
 * chemins l'appellent : le bouton « Ajouter au détail », et l'enchaînement
 * complet depuis la dictée. Une seconde implémentation aurait rouvert le défaut
 * du 3 août — un devis doublé — sur le chemin le moins souvent relu.
 */
export async function appliquerPropositionPrix(
  ctx: Ctx,
  chantierId: string,
  tarifIdChoisi?: string
): Promise<ResultatApplicationPrix> {
  const proposition = await preparerPropositionPrix(ctx, chantierId);
  if (!proposition) return { succes: false, erreur: "Chantier introuvable." };

  // Le détail réel, relu en base : c'est lui qui dit si cette proposition y est
  // déjà, et non un drapeau du navigateur — celui-ci mourait au premier retour
  // arrière, et un seul appui de plus doublait le devis. L'écran grise
  // désormais le bouton, mais un écran ne protège rien : deux appuis rapides,
  // ou une page laissée ouverte pendant qu'on ajoute la ligne ailleurs,
  // arriveraient quand même ici. **La même fonction** que l'écran (`CLAUDE.md`
  // §3) — jamais une seconde version de la règle.
  const detailActuel = await listerLignesPrix(ctx, chantierId);
  function refuserSiDoublon(libelle: string | null) {
    const deja = ligneDejaAuDetail(libelle, detailActuel);
    return deja
      ? {
          succes: false as const,
          erreur: `« ${deja.libelle} » figure déjà au détail (${deja.montant} €). Modifiez cette ligne plutôt que d'en ajouter une seconde.`,
        }
      : null;
  }

  // Cas ambigu : le patron a tranché en désignant un tarif. On relit le prix
  // ACTUEL de ce tarif en base, et on vérifie qu'il faisait bien partie des
  // candidats — un id transmis au hasard ne doit rien pouvoir appliquer.
  if (proposition.origine === "tarifs_ambigus") {
    if (!tarifIdChoisi) {
      return { succes: false, erreur: "Plusieurs tarifs correspondent : choisissez celui à appliquer." };
    }
    const candidat = proposition.tarifsCandidats.find((c) => c.tarifId === tarifIdChoisi);
    if (!candidat) {
      return { succes: false, erreur: "Ce tarif ne fait pas partie des tarifs proposés pour ce chantier." };
    }
    const tarifActuel = await getTarif(ctx, candidat.tarifId);
    if (!tarifActuel) {
      return { succes: false, erreur: "Ce tarif n'existe plus." };
    }
    const doublon = refuserSiDoublon(tarifActuel.intitule);
    if (doublon) return doublon;
    const ligne = await ajouterLignePrix(ctx, chantierId, tarifActuel.intitule, tarifActuel.prix);
    const ecrite = { id: ligne.id, libelle: ligne.libelle, montant: ligne.montant };
    return { succes: true, ligne: ecrite, lignes: [ecrite] };
  }

  if (proposition.prixPropose === null || proposition.lignes.length === 0) {
    return { succes: false, erreur: "Aucun prix ne peut être proposé en l'état." };
  }

  // **Plusieurs lignes, et le doublon se vérifie ligne par ligne.**
  //
  // Le patron rejoue souvent l'enchaînement, et le refus global d'autrefois
  // suffisait quand une proposition ne valait qu'une ligne. Depuis qu'un
  // chantier peut en produire deux — le travail principal et la fente —, un
  // contrôle global laisserait passer le cas mixte : la principale déjà au
  // détail, la fente pas encore. On refuse donc chaque ligne séparément, et
  // l'ensemble ne devient un échec que si RIEN n'a pu être écrit.
  const ecrites: LigneEcrite[] = [];
  const refusees: string[] = [];
  for (const proposee of proposition.lignes) {
    const doublon = refuserSiDoublon(proposee.libelle);
    if (doublon) {
      refusees.push(doublon.erreur);
      continue;
    }
    // **« À chiffrer » n'est pas « 0 € ».** Le montant reste à zéro en base —
    // la facturation n'accepte pas de NULL —, mais le drapeau dit que ce zéro
    // n'est pas un prix, et le devis ne partira pas tant qu'il est levé.
    const ligne = await ajouterLignePrix(ctx, chantierId, proposee.libelle, proposee.montant ?? "0", {
      quantite: proposee.quantite,
      unite: proposee.unite,
      prixUnitaire: proposee.prixUnitaire,
      aChiffrer: proposee.montant === null,
    });

    // **On note quelles prestations cette ligne vend.** Sans ce lien, une ligne
    // et ses travaux ne se connaissent que par leur texte — et c'est de là que
    // vient la case d'abattage passée de 800 € à 1 500 € le 26 août 2026.
    //
    // **Les identifiants viennent du découpage lui-même** depuis le 27 août :
    // la ligne SAIT ce qu'elle vend, au lieu qu'on le redéduise de son libellé.
    // Le rapprochement par texte ne sert plus que de filet pour les chemins qui
    // ne passent pas par le découpage (un tarif nommé, par exemple).
    //
    // Jamais bloquant : un lien qu'on ne sait pas écrire ne doit pas empêcher
    // un devis d'exister. C'est la règle de l'apprentissage, et elle vaut ici.
    try {
      const ids =
        proposee.prestationIds.length > 0
          ? proposee.prestationIds
          : await prestationsDuLibelle(ctx, chantierId, ligne.libelle);
      await lierPrestationsALaLigne(ctx, ligne.id, ids);
    } catch {
      // Volontairement silencieux : voir ci-dessus.
    }
    // Le détail relu en début de fonction ne connaît pas les lignes qu'on vient
    // d'écrire : sans cet ajout, deux lignes au même libellé passeraient toutes
    // les deux dans la même boucle.
    detailActuel.push({ ...ligne });
    ecrites.push({ id: ligne.id, libelle: ligne.libelle, montant: ligne.montant });
  }

  if (ecrites.length === 0) {
    return { succes: false, erreur: refusees[0] ?? "Aucun prix ne peut être proposé en l'état." };
  }

  return { succes: true, ligne: ecrites[0], lignes: ecrites };
}
