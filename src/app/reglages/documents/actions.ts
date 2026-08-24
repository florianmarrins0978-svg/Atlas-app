"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise, getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise, type ConditionsLues } from "@/lib/conditions-documents";
import { refusDuMessage, MESSAGE_PAR_DEFAUT } from "@/lib/message-client";
import { normaliserAllure, refusDuLogo, type Allure } from "@/lib/allure-documents";
import { enregistrerObjet, supprimerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
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

    const avant = await getEntreprise(ctx);
    const octets = Buffer.from(await fichier.arrayBuffer());
    const objet = await enregistrerObjet(
      `entreprises/${ctx.entrepriseId}/logo`,
      octets,
      fichier.type === "image/png" ? ".png" : ".jpg",
      fichier.type
    );
    await mettreAJourEntreprise(ctx, {
      logo: { storageKey: objet.storageKey, mime: fichier.type },
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
