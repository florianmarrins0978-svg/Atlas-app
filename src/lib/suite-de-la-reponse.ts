/**
 * Où mène la carte, quand le client a répondu.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 12 août 2026 :** *« si le chantier il est accepté par le
 * client, il faut qu'à la place de "ouvrir le chantier", on puisse ouvrir le
 * devis — et le devis validé, pas le devis en construction. Par contre, si le
 * devis n'est pas validé par le client et il nous revient pour une
 * modification, il faut que dans ce cas-là on puisse ouvrir le devis, mais pour
 * pouvoir le modifier. »*
 *
 * Toutes les cartes menaient à la fiche du chantier — le même lien pour quatre
 * situations qui n'appellent pas le même geste. **La carte dit déjà quoi faire
 * (« le devis peut être repris et renvoyé ») et menait ailleurs.**
 *
 * Deux destinations, et le choix n'est pas une préférence : c'est ce que
 * l'application permet.
 *
 * - **Accepté** — le devis est parti et ne se modifie plus (trigger
 *   `empecher_modification_devis_envoye`). `devis-complet` l'affiche alors
 *   figé : c'est exactement « le devis validé », le document tel que le client
 *   l'a reçu, et non le brouillon.
 * - **Correction, refus, lien périmé** — le devis parti est immuable lui aussi.
 *   Le modifier suppose de le REPRENDRE, ce qui ouvre une nouvelle version, et
 *   c'est un geste que le patron décide (`docs/AGENT.md`). On mène donc à
 *   l'écran qui le porte — « Corriger et renvoyer », « Reprendre le devis » —
 *   et non à un document qui refuserait la première frappe sans qu'il comprenne
 *   pourquoi.
 *
 * **Ce qu'on ne fait surtout pas : reprendre à sa place.** L'emmener sur un
 * devis déjà rendu modifiable lui économiserait un appui, au prix d'une
 * nouvelle version créée sans qu'il l'ait voulu — et il n'aurait aucun moyen de
 * savoir que l'ancienne a été remplacée.
 */
export type ReponseClient = "acceptee" | "refusee" | "correction" | null;

export type SuiteDeLaReponse = {
  /** Où mène le lien de la carte. */
  href: string;
  /** Ce qu'il annonce — le geste, jamais l'écran. */
  libelle: string;
};

/**
 * @param reponse La réponse du client, ou `null` pour un lien périmé sans
 *   réponse — le silence appelle la même reprise qu'un refus.
 */
export function suiteDeLaReponse(chantierId: string, reponse: ReponseClient): SuiteDeLaReponse {
  if (reponse === "acceptee") {
    return {
      href: `/chantiers/${chantierId}/devis-complet`,
      libelle: "Ouvrir le devis validé",
    };
  }
  if (reponse === "correction") {
    return {
      href: `/chantiers/${chantierId}/export`,
      libelle: "Corriger le devis",
    };
  }
  // Refus et silence : le devis se reprend, et la carte le disait déjà.
  return {
    href: `/chantiers/${chantierId}/export`,
    libelle: "Reprendre le devis",
  };
}
