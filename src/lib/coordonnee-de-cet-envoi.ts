import { adresseEnvoyable } from "./donner-un-acces";
import { telephoneLu } from "./numero-telephone";
import type { CanalClient } from "./message-client";

/**
 * ─── LA COORDONNÉE TAPÉE POUR UN SEUL ENVOI ────────────────────────────────
 *
 * **Sa demande du 3 novembre 2026**, capture à l'appui d'une facture dont le
 * client est supprimé : *« J'ai supprimé le client, mais je ne l'ai pas encore
 * facturé. Donc là, je ne peux plus lui envoyer la facture. […] il faut que je
 * puisse écrire les coordonnées pour lui envoyer la facture. »* Son choix, entre
 * deux : **« Pour cet envoi seulement »** (`appli/soignee/facture.html`, état
 * « Client supprimé »).
 *
 * La suppression vide la fiche de tout ce qui sert à le recontacter et la sort
 * de sa liste (`effacerClient`, §542) ; sa facture en brouillon reste, avec son
 * numéro. Sans cette règle, elle ne pouvait plus partir : les deux canaux
 * restaient inertes, faute de coordonnée.
 *
 * **Ce qu'il tape sert à CET envoi, et à rien d'autre** : la fiche reste
 * supprimée, hors de sa liste ; la coordonnée ne vit que sur la trace de
 * l'envoi (`envois_factures.destinataire`, migration 0160).
 *
 * **Une seule règle, deux emplois** (`CLAUDE.md` §3) : elle allume « Envoyer la
 * facture » et choisit la case à l'écran ; le serveur la rejoue avant d'arrêter
 * la facture, puis dans la transaction qui prépare son lien. Les lectures sont
 * celles de la fiche : `telephoneLu` pour le numéro, `adresseEnvoyable` pour
 * l'adresse. Une troisième aurait accepté ici ce qu'une autre case refuse.
 */

/** Ce que la règle lit de la facture : le serveur dans sa transaction, l'écran par sa page. */
export type SituationDeLEnvoi = {
  /** Sa fiche est supprimée (`clients.deleted_at`) : elle n'a plus ni e-mail ni numéro. */
  clientSupprime: boolean;
  /**
   * Le lien de la facture a déjà été préparé : elle est partie. Elle se renvoie
   * alors par « Renvoyer par SMS ou e-mail », sur le lien qui existe.
   */
  partie: boolean;
};

export type CoordonneeDeCetEnvoi =
  | { ok: true; destinataire: string }
  | {
      ok: false;
      /**
       * `vide` n'est pas une faute : l'écran ne dit rien sous une case vide, le
       * bouton reste seulement éteint. `forme` se dit sous la case.
       */
      motif: "client-vivant" | "partie" | "vide" | "forme";
      raison: string;
    };

/** La case s'offre-t-elle ? Un client supprimé, une facture pas encore partie. */
export function peutTaperSaCoordonnee(s: SituationDeLEnvoi): boolean {
  return s.clientSupprime && !s.partie;
}

/** Ce qui part vraiment, ou pourquoi rien ne part. */
export function coordonneeDeCetEnvoi(s: SituationDeLEnvoi, canal: CanalClient, saisie: string): CoordonneeDeCetEnvoi {
  if (!s.clientSupprime) {
    return {
      ok: false,
      motif: "client-vivant",
      raison: "Ce client a sa fiche : ses coordonnées se notent sur elle.",
    };
  }
  if (s.partie) {
    return {
      ok: false,
      motif: "partie",
      raison: "Cette facture est déjà partie : renvoyez-la par « Renvoyer par SMS ou e-mail ».",
    };
  }
  if (saisie.trim() === "") {
    return { ok: false, motif: "vide", raison: canal === "sms" ? "Tapez son numéro." : "Tapez son e-mail." };
  }
  if (canal === "sms") {
    // Les chiffres, comme la fiche les enregistre : le lien `sms:` les compose.
    const numero = telephoneLu(saisie);
    return numero
      ? { ok: true, destinataire: numero }
      : { ok: false, motif: "forme", raison: "Le téléphone a 10 chiffres." };
  }
  const adresse = saisie.trim();
  return adresseEnvoyable(adresse)
    ? { ok: true, destinataire: adresse }
    : { ok: false, motif: "forme", raison: "Une adresse e-mail a la forme nom@exemple.fr." };
}
