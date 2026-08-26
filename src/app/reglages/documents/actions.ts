"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise, getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise, type ConditionsLues } from "@/lib/conditions-documents";
import { refusDuMessage, MESSAGE_PAR_DEFAUT } from "@/lib/message-client";
import { normaliserAllure, refusDuLogo, type Allure } from "@/lib/allure-documents";
import { FORMAT_PAR_DEFAUT } from "@/lib/numero-documents";
import { lireAllureDevis } from "@/server/ai/services/lire-allure-devis";
import { enregistrerObjet, supprimerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { logger } from "@/server/logger";

/**
 * Enregistre les conditions imprimées sur le devis.
 *
 * **Le refus se rend en VALEUR DE RETOUR, jamais en exception.** Le message
 * d'une exception levée par une action serveur n'arrive jamais jusqu'au patron
 * — Next.js le remplace en production par un identifiant opaque, et son banc
 * sert une version bâtie (`AGENTS.md`). Il lirait « une erreur est survenue »
 * sans aucun moyen de comprendre.
 *
 * **Elle rend les conditions RELUES en base**, jamais celles qu'on lui a
 * demandé d'écrire : c'est ce qui permet à l'écran d'afficher une valeur bornée
 * plutôt que la saisie aberrante qu'il vient de taper.
 */
export async function majConditionsAction(
  saisie: ConditionsLues,
  /**
   * Son message au client, s'il l'a touché (sa demande du 23 août 2026).
   *
   * **Il passe par la MÊME action, et donc par le même bouton.** Deux
   * enregistrements sur un seul écran, c'est un réglage sur deux qui se perd :
   * il en touche un, appuie sur l'autre bouton, et croit avoir tout posé.
   */
  messageClient?: string
): Promise<
  | { ok: true; conditions: ConditionsLues; messageClient: string | null }
  | { ok: false; raison: string }
> {
  const ctx = await getCurrentCtx();
  try {
    // Ces conditions engagent l'entreprise sur un document que le client garde :
    // elles appartiennent au patron (`docs/QUESTIONS.md` §10).
    await exigerProprietaire(ctx, "modifier les conditions des documents");
    // **Le refus du message est rendu ICI, en clair.** `mettreAJourEntreprise`
    // ignore en silence un message sans lien — c'est ce qu'il faut au plus près
    // de la base —, mais un silence à cet endroit lui laisserait croire que
    // c'est enregistré. On le dit avec ses mots, et sans lever (`AGENTS.md`).
    if (messageClient !== undefined) {
      const refus = refusDuMessage(messageClient.trim() || MESSAGE_PAR_DEFAUT);
      if (refus) return { ok: false, raison: refus };
    }
    await mettreAJourEntreprise(ctx, { conditions: saisie, messageClient });
    const e = await getEntreprise(ctx);
    const c = conditionsDepuisEntreprise(e);
    return {
      ok: true,
      conditions: {
        validiteJours: c.validiteJours,
        acomptePourcent: c.acomptePourcent,
        delaiPaiementJours: c.delaiPaiementJours,
        moyensPaiement: c.moyensPaiement,
        rappelerPenalites: c.rappelerPenalites,
        textePied: c.textePied,
      },
      messageClient: e.messageClient ?? null,
    };
  } catch (err) {
    // **Une panne imprévue se journalise AVANT d'être rendue.** Sans cela, le
    // patron lit « ça n'a pas été enregistré » et personne ne peut savoir
    // pourquoi — c'est le défaut muet du 11 août (`AGENTS.md`).
    logger.error("Enregistrement des conditions impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      raison: "Ces conditions n'ont pas pu être enregistrées. Réessayez dans un instant.",
    };
  }
}

/**
 * Enregistre L'ALLURE de ses documents — typographie, fond, accent.
 *
 * **Séparée de celle des conditions, et c'est voulu.** Les conditions engagent
 * l'entreprise ; l'allure ne fait que peindre. Les mêler obligerait à
 * réenregistrer des conditions pour changer une couleur, et une erreur sur
 * l'une ferait perdre l'autre.
 *
 * **Elle rend l'allure RELUE en base**, jamais celle qu'on lui a demandé
 * d'écrire : une couleur mal formée retombe sur le défaut, et l'écran doit
 * montrer ce qui s'imprimera, pas ce qu'il a tapé.
 */
export async function majAllureAction(
  saisie: Allure | null
): Promise<{ ok: true; allure: Allure } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "modifier l'allure des documents");
    await mettreAJourEntreprise(ctx, { allure: saisie });
    const e = await getEntreprise(ctx);
    return {
      ok: true,
      allure: normaliserAllure({
        typographie: e?.docTypographie ?? undefined,
        fond: e?.docFond ?? undefined,
        accent: e?.docAccent ?? undefined,
      }),
    };
  } catch (err) {
    logger.error("Enregistrement de l'allure impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      raison: "Cette allure n'a pas pu être enregistrée. Réessayez dans un instant.",
    };
  }
}

/**
 * Enregistre le format des numéros de devis et de factures.
 *
 * **Elle rend le format RELU en base**, comme `majAllureAction` : une clef
 * inconnue y est restée celle d'avant, et l'écran doit montrer ce qui
 * s'imprimera réellement — pas ce qu'on vient de lui demander.
 *
 * *Ce que le format change ne se rattrape pas :* les documents déjà émis
 * gardent leur numéro, et la suite reprend à partir de là.
 */
export async function majFormatNumeroAction(
  clef: string
): Promise<{ ok: true; format: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "modifier le format des numéros");
    await mettreAJourEntreprise(ctx, { formatNumero: clef });
    const e = await getEntreprise(ctx);
    return { ok: true, format: e?.formatNumero ?? FORMAT_PAR_DEFAUT };
  } catch (err) {
    logger.error("Enregistrement du format de numéro impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      raison: "Ce format n'a pas pu être enregistré. Réessayez dans un instant.",
    };
  }
}

/**
 * Pose son logo — l'image d'abord, la ligne ensuite.
 *
 * **L'ancien fichier est supprimé APRÈS que le nouveau soit écrit en base.**
 * L'inverse — effacer puis écrire — laisse, si l'écriture tombe, une entreprise
 * qui pointe vers une image qui n'existe plus : le devis partirait sans logo et
 * personne ne saurait pourquoi.
 */
export async function poserLogoAction(
  formData: FormData
): Promise<{ ok: true; logo: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "changer le logo des documents");
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucune image reçue." };

    // **Le refus vient de la même fonction que l'écran** (`refusDuLogo`) : un
    // format que le PDF ne sait pas embarquer doit être dit ici, pendant qu'il
    // peut encore en choisir un autre — pas découvert sur le devis du client.
    const refus = refusDuLogo(fichier.type, fichier.size);
    if (refus) return { ok: false, raison: refus };

    const limite = await verifierLimite(
      `televersement:${ctx.entrepriseId}`,
      LIMITES.televersementFichier
    );
    if (!limite.autorise) return { ok: false, raison: limite.message };

    /**
     * **LE LOGO EST NETTOYÉ, LUI AUSSI — et il partait le plus loin de tous.**
     *
     * Trouvé le 24 août 2026 en recensant les chemins d'image pour M3 : ce
     * chemin-ci n'était dans aucun des six points du brief, et c'est celui qui
     * expose le plus. Un logo choisi dans la photothèque — une enseigne
     * photographiée au téléphone, ce que fait un artisan — porte les
     * coordonnées GPS de l'endroit où la photo a été prise. Et ce fichier est
     * **embarqué dans chaque devis et chaque facture** envoyés aux clients :
     * les métadonnées voyageaient avec, chez des tiers, indéfiniment.
     *
     * `refusDuLogo` reste AVANT : son message parle du PDF (« ce format ne
     * s'imprime pas sur un devis »), ce que la porte commune ne saurait pas
     * dire. Elle vient ensuite, pour nettoyer et pour refuser un fichier qui
     * n'est pas ce qu'il prétend être.
     */
    const prete = await preparerPhotoEntrante(fichier, "logo d'entreprise");
    if (!prete.ok) return { ok: false, raison: prete.raison };

    const avant = await getEntreprise(ctx);
    const objet = await enregistrerObjet(
      `entreprises/${ctx.entrepriseId}/logo`,
      prete.photo.octets,
      prete.photo.extension,
      prete.photo.mimeType
    );
    await mettreAJourEntreprise(ctx, {
      logo: { storageKey: objet.storageKey, mime: prete.photo.mimeType },
    });
    if (avant?.logoStorageKey) await supprimerObjet(avant.logoStorageKey);
    return { ok: true, logo: objet.storageKey };
  } catch (err) {
    logger.error("Enregistrement du logo impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Cette image n'a pas pu être enregistrée. Réessayez." };
  }
}

/**
 * Reprendre l'allure d'un devis PHOTOGRAPHIÉ — sa demande du 25 août 2026.
 *
 * **Ce qui est repris, et ce qui ne l'est pas** (tranché sur la maquette
 * `appli/photographier-mon-devis.html`) : les couleurs, la police reconnue et
 * les mentions/conditions. Jamais les lignes ni les prix. Le logo non plus — on
 * ne le découpe pas d'une photo —, et l'action le DIT dans sa réserve.
 *
 * **On ne remplace que ce qui a été LU.** Un champ que la lecture n'a pas su
 * tirer (`null`) laisse la valeur d'avant : photographier un devis ne doit pas
 * effacer une couleur qu'il avait posée à la main et que la photo n'a pas vue.
 *
 * **La photo est nettoyée comme le logo** (`preparerPhotoEntrante`) : un devis
 * photographié porte les coordonnées GPS du lieu de la prise, et ce fichier ne
 * doit pas traîner. Le refus se rend en valeur, jamais en exception
 * (`AGENTS.md`).
 */
export async function reprendreAllurePhotoAction(
  formData: FormData
): Promise<
  | { ok: true; repris: string[]; reserve: string | null; allure: Allure; conditions: ConditionsLues }
  | { ok: false; raison: string }
> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "reprendre l'allure d'un document photographié");

    const fichier = formData.get("fichier");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucune image reçue." };

    const limite = await verifierLimite(
      `televersement:${ctx.entrepriseId}`,
      LIMITES.televersementFichier
    );
    if (!limite.autorise) return { ok: false, raison: limite.message };

    const prete = await preparerPhotoEntrante(fichier, "photo d'un devis");
    if (!prete.ok) return { ok: false, raison: prete.raison };

    const lu = await lireAllureDevis(prete.photo.octets.toString("base64"), prete.photo.mimeType);
    if (!lu.ok) return { ok: false, raison: lu.raison };

    // **On fusionne : le lu prime, l'existant comble.** Un champ non lu (`null`)
    // ne doit pas écraser ce qu'il avait posé.
    const e = await getEntreprise(ctx);
    const actuelle = normaliserAllure({
      typographie: e?.docTypographie ?? undefined,
      fond: e?.docFond ?? undefined,
      accent: e?.docAccent ?? undefined,
    });
    const allure: Allure = {
      typographie: lu.allure.typographie ?? actuelle.typographie,
      fond: lu.allure.fond ?? actuelle.fond,
      accent: lu.allure.accent ?? actuelle.accent,
    };

    const actuelles = conditionsDepuisEntreprise(e);
    const cl = lu.allure.conditions;
    const conditions: ConditionsLues = {
      validiteJours: cl.validiteJours ?? actuelles.validiteJours,
      acomptePourcent: cl.acomptePourcent ?? actuelles.acomptePourcent,
      delaiPaiementJours: cl.delaiPaiementJours ?? actuelles.delaiPaiementJours,
      moyensPaiement: cl.moyensPaiement ?? actuelles.moyensPaiement,
      rappelerPenalites: cl.rappelerPenalites ?? actuelles.rappelerPenalites,
      textePied: cl.textePied ?? actuelles.textePied,
    };

    await mettreAJourEntreprise(ctx, { allure, conditions });

    // **On relit la base, jamais ce qu'on vient de demander.** Une couleur mal
    // formée y est retombée sur le défaut, et l'écran doit montrer ce qui
    // s'imprimera — c'est la règle des deux autres actions de cet écran.
    const apres = await getEntreprise(ctx);
    const allureRelue = normaliserAllure({
      typographie: apres?.docTypographie ?? undefined,
      fond: apres?.docFond ?? undefined,
      accent: apres?.docAccent ?? undefined,
    });
    const cRelues = conditionsDepuisEntreprise(apres);
    const conditionsRelues: ConditionsLues = {
      validiteJours: cRelues.validiteJours,
      acomptePourcent: cRelues.acomptePourcent,
      delaiPaiementJours: cRelues.delaiPaiementJours,
      moyensPaiement: cRelues.moyensPaiement,
      rappelerPenalites: cRelues.rappelerPenalites,
      textePied: cRelues.textePied,
    };

    // Ce qui a réellement été repris — pour que l'écran le montre, et ne
    // laisse pas croire qu'il a pris ce que la photo n'a pas vu.
    const repris: string[] = [];
    if (lu.allure.fond !== null || lu.allure.accent !== null) repris.push("vos couleurs");
    if (lu.allure.typographie !== null) repris.push("votre police");
    const aDesConditions =
      cl.validiteJours !== null ||
      cl.acomptePourcent !== null ||
      cl.delaiPaiementJours !== null ||
      cl.moyensPaiement !== null ||
      cl.rappelerPenalites !== null ||
      cl.textePied !== null;
    if (aDesConditions) repris.push("vos mentions");

    return { ok: true, repris, reserve: lu.allure.reserve, allure: allureRelue, conditions: conditionsRelues };
  } catch (err) {
    logger.error("Reprise de l'allure depuis une photo impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      raison: "Cette photo n'a pas pu être lue. Réessayez dans un instant.",
    };
  }
}

/** Retire son logo. Le fichier part avec la ligne : rien ne le lit plus. */
export async function retirerLogoAction(): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "retirer le logo des documents");
    const avant = await getEntreprise(ctx);
    await mettreAJourEntreprise(ctx, { logo: null });
    if (avant?.logoStorageKey) await supprimerObjet(avant.logoStorageKey);
    return { ok: true };
  } catch (err) {
    logger.error("Retrait du logo impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Ce logo n'a pas pu être retiré. Réessayez." };
  }
}
