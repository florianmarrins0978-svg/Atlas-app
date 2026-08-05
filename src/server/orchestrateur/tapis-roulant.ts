import type { Ctx } from "../repositories/context";
import { genererBrouillon, confirmerBrouillon } from "../ai/services/brouillon-service";
import { getBrouillon } from "../repositories/brouillons-informations";
import { listerLignesPrix } from "../repositories/lignes-prix";
import { appliquerProposition } from "../chiffrage/proposition-prix";
import { getOuCreerDevisBrouillon } from "../repositories/devis";

// Le tapis roulant : de la dictée au devis, d'un seul geste.
//
// **Pourquoi il existe.** Toutes les briques du parcours étaient écrites —
// transcription, extraction, rapprochement du catalogue, historique des prix,
// chiffrage, devis — mais rien ne les enchaînait. Le patron passait d'écran en
// écran à la main, et `docs/AGENT.md` §5 nommait déjà le manque :
// « Enchaînement complet — à faire. Aujourd'hui l'agent répond et propose ; il
// ne pilote pas encore le parcours de bout en bout. »
//
// **Ce qu'il fait, et où il s'arrête.** Il va jusqu'au devis en brouillon, et
// pas un pas plus loin. Il ne valide pas le prix, ne crée aucune date, n'envoie
// rien : c'est l'ARRÊT 1 de `docs/AGENT.md` §2, le moment où le patron engage
// sa parole. Un tapis qui franchirait cet arrêt ne serait plus un assistant.
//
// **Il n'invente rien.** Chaque maillon est exactement la fonction qu'appelle
// déjà l'écran correspondant — jamais une seconde implémentation. Ce qui
// manque reste manquant et **remonte dans `trous`**, pour être signalé à
// l'écran plutôt que comblé par une supposition (`docs/AGENT.md` §3).

export type NomEtape =
  | "extraction"
  | "confirmation"
  | "chiffrage"
  | "devis";

export type Etape = {
  nom: NomEtape;
  /** Ce que le patron doit comprendre de cette étape, en une phrase. */
  libelle: string;
  statut: "reussie" | "sans_effet" | "arretee";
  detail?: string;
};

/** Ce qui manque ou mérite un coup d'œil — jamais comblé, toujours dit. */
export type Trou = {
  categorie: "information_manquante" | "ambiguite" | "prix_absent" | "choix_a_faire";
  message: string;
};

export type ResultatTapis = {
  /**
   * `devis_pret` : il y a un devis à regarder — même incomplet, même troué.
   * `arrete` : le tapis n'a pas pu aller jusqu'au devis, et `raison` le dit.
   */
  statut: "devis_pret" | "arrete";
  raison?: string;
  etapes: Etape[];
  trous: Trou[];
  devisId?: string;
};

function arret(etapes: Etape[], trous: Trou[], raison: string): ResultatTapis {
  return { statut: "arrete", raison, etapes, trous };
}

export async function deriverDicteeVersDevis(ctx: Ctx, chantierId: string): Promise<ResultatTapis> {
  const etapes: Etape[] = [];
  const trous: Trou[] = [];

  // --- 1. Extraction : la dictée devient un brouillon structuré -------------
  //
  // `genererBrouillon` porte déjà les deux refus qui comptent : pas de
  // transcription, et surtout pas d'extraction depuis une transcription
  // simulée — ce qui avait rempli un vrai devis de phrases fabriquées.
  const generation = await genererBrouillon(ctx, chantierId);

  switch (generation.statut) {
    case "transcription_absente":
      return arret(etapes, trous, "Aucune dictée n'a encore été enregistrée sur ce chantier.");
    case "transcription_simulee":
      return arret(
        etapes,
        trous,
        "La dictée n'a jamais été écoutée : aucun prestataire de transcription n'est branché. Voir Réglages."
      );
    case "echec":
      return arret(etapes, trous, `La dictée n'a pas pu être analysée : ${generation.erreur}`);
    case "conflit":
      // Le brouillon porte des corrections du patron. Le tapis ne les écrase
      // jamais de sa propre initiative — c'est son travail, pas le nôtre.
      return arret(
        etapes,
        trous,
        "Vous avez corrigé ce brouillon à la main. Reprenez depuis l'écran Informations pour décider quoi garder."
      );
  }

  etapes.push({
    nom: "extraction",
    libelle: "La dictée a été comprise",
    statut: "reussie",
    detail: `${generation.brouillon.contenu.prestations.length} prestation(s), ${generation.brouillon.contenu.materiel.length} matériel(s).`,
  });

  // Ce que l'extraction a explicitement signalé comme incertain ou absent
  // remonte tel quel : c'est elle qui a écouté, pas nous.
  for (const manque of generation.brouillon.contenu.informationsManquantes) {
    trous.push({ categorie: "information_manquante", message: manque });
  }
  for (const ambigu of generation.brouillon.contenu.ambiguites) {
    trous.push({ categorie: "ambiguite", message: ambigu });
  }

  // --- 2. Confirmation : le brouillon devient les données du chantier -------
  const confirmation = await confirmerBrouillon(ctx, chantierId);
  if (confirmation.statut === "absent") {
    return arret(etapes, trous, "Le brouillon a disparu entre son écriture et sa confirmation.");
  }

  if (confirmation.statut === "deja_confirme") {
    // Le tapis a déjà tourné, ou le patron a confirmé lui-même. Ce n'est pas
    // une erreur : on continue vers le prix avec ce qui est en place.
    etapes.push({
      nom: "confirmation",
      libelle: "Les informations étaient déjà en place",
      statut: "sans_effet",
    });
  } else {
    etapes.push({
      nom: "confirmation",
      libelle: "Les informations ont été portées au chantier",
      statut: "reussie",
      detail: `${confirmation.prestationsCreees.length} prestation(s), ${confirmation.materielCree.length} matériel(s).`,
    });
  }

  // --- 3. Chiffrage --------------------------------------------------------
  //
  // Une seule proposition est appliquée : c'est ce que sait faire le chiffrage
  // aujourd'hui. Ne pas faire semblant d'en poser plusieurs.
  const lignesAvant = await listerLignesPrix(ctx, chantierId);
  const chiffrage = await appliquerProposition(ctx, chantierId);

  if (chiffrage.succes) {
    etapes.push({
      nom: "chiffrage",
      libelle: "Un prix a été proposé depuis vos tarifs",
      statut: "reussie",
      detail: `${chiffrage.ligne.libelle} — ${chiffrage.ligne.montant} €`,
    });
  } else if (chiffrage.ambigu) {
    // Deux tarifs plausibles : l'agent n'en choisit jamais un (AGENT.md §3).
    etapes.push({ nom: "chiffrage", libelle: "Le prix demande votre arbitrage", statut: "arretee", detail: chiffrage.erreur });
    trous.push({ categorie: "choix_a_faire", message: chiffrage.erreur });
  } else {
    // Le cas ordinaire quand la prestation n'est pas dans la grille. Ce n'est
    // pas un échec du tapis : c'est un trou, et il se dit.
    etapes.push({ nom: "chiffrage", libelle: "Aucun prix n'a pu être proposé", statut: "sans_effet", detail: chiffrage.erreur });
    trous.push({ categorie: "prix_absent", message: chiffrage.erreur });
  }

  // --- 4. Devis ------------------------------------------------------------
  //
  // Un devis sans la moindre ligne de prix n'est pas un devis : mieux vaut le
  // dire que d'ouvrir un document vide au patron.
  const lignesApres = await listerLignesPrix(ctx, chantierId);
  if (lignesApres.length === 0) {
    return arret(
      etapes,
      trous,
      "Aucune ligne de prix : il n'y a pas encore de devis à préparer. Complétez le prix depuis l'écran Prix."
    );
  }

  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
  etapes.push({
    nom: "devis",
    libelle: lignesAvant.length === lignesApres.length ? "Le devis a été remis à jour" : "Le devis a été préparé",
    statut: "reussie",
    detail: `${lignesApres.length} ligne(s).`,
  });

  return { statut: "devis_pret", etapes, trous, devisId: devis.id };
}

/**
 * Résume le résultat en une phrase, pour une notification ou un bandeau.
 * Fonction pure : c'est la même phrase partout, jamais reformulée à l'écran.
 */
export function resumerTapis(resultat: ResultatTapis): string {
  if (resultat.statut === "arrete") {
    return resultat.raison ?? "Le devis n'a pas pu être préparé.";
  }
  if (resultat.trous.length === 0) {
    return "Votre devis est prêt à être vérifié.";
  }
  const n = resultat.trous.length;
  return `Votre devis est prêt, avec ${n} point${n > 1 ? "s" : ""} à vérifier.`;
}

/** Vrai si le brouillon d'extraction existe déjà — sert à proposer, ou non, de relancer le tapis. */
export async function tapisDejaPasse(ctx: Ctx, chantierId: string): Promise<boolean> {
  const brouillon = await getBrouillon(ctx, chantierId);
  return brouillon?.statut === "confirme";
}
