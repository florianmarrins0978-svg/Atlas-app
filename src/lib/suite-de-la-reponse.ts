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
  /**
   * Le devis doit-il être REPRIS avant d'ouvrir cette adresse ?
   *
   * **Corrigé le 13 août 2026, sur sa demande :** *« lorsque je clique sur
   * corriger le devis, je dois arriver directement sur la page du devis pour
   * pouvoir le corriger. Et aujourd'hui, ce n'est pas le cas. »*
   *
   * La veille, « Corriger le devis » menait à l'écran d'envoi — celui qui porte
   * le bouton « Corriger et renvoyer » —, par crainte de reprendre le devis à
   * sa place. La crainte visait juste, mais pas ici : **c'est LUI qui appuie,
   * sur un bouton qui annonce « Corriger le devis ».** Le geste est le sien ;
   * l'en interdire ne le protégeait de rien et lui coûtait un écran de plus,
   * puis un second appui, pour arriver là où il voulait aller d'emblée.
   *
   * Et la reprise ne s'empile pas : un brouillon déjà ouvert est réutilisé tel
   * quel, et une reprise depuis un devis parti garde le même numéro commercial
   * en montant d'une version (`getOuCreerDevisBrouillon`). Appuyer deux fois ne
   * fabrique donc pas deux devis.
   *
   * Reste `false` pour un devis ACCEPTÉ : celui-là s'ouvre figé, tel que le
   * client l'a reçu, et le reprendre remplacerait sans le dire le document sur
   * lequel les deux se sont mis d'accord.
   */
  reprendreAvant: boolean;
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
      reprendreAvant: false,
    };
  }
  if (reponse === "correction") {
    // **Droit au devis, et modifiable.** Sa demande du 13 août 2026 : voir
    // `reprendreAvant` ci-dessus. Le client a dit ce qu'il veut changer ; le
    // patron veut le changer, pas passer par un écran qui le lui propose.
    return {
      href: `/chantiers/${chantierId}/devis-complet`,
      libelle: "Corriger le devis",
      reprendreAvant: true,
    };
  }
  // **Refus et silence : on ne reprend PAS d'office, et c'est délibéré.**
  //
  // Il n'a demandé le raccourci que pour la correction, et les deux situations
  // ne se ressemblent pas : après un refus, la suite n'est pas forcément de
  // refaire le devis — elle peut être d'abandonner le chantier, ou d'appeler le
  // client. Ouvrir une version de plus à chaque coup d'œil sur la carte
  // encombrerait l'historique d'un chantier qui ne repartira jamais. L'écran
  // d'envoi, lui, porte « Reprendre le devis » et laisse le choix.
  return {
    href: `/chantiers/${chantierId}/export`,
    libelle: "Reprendre le devis",
    reprendreAvant: false,
  };
}
