/**
 * Un devis peut-il PARTIR chez le client ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le patron, le 23 août 2026 :** *« le devis part à zéro euro chez la
 * cliente, alors qu'il y a un arbre à tailler et un à démonter. Rien n'apparaît
 * chez elle. »*
 *
 * Sa cliente avait donc sous les yeux un document qui n'énonçait rien : ni
 * prestation, ni prix — et un bouton « J'accepte ce devis » sous ce vide.
 *
 * **La cause n'est pas une perte de données.** Les lignes du devis viennent des
 * lignes de PRIX (`genererDevis`), jamais des prestations : deux arbres décrits
 * mais jamais chiffrés donnent un devis authentiquement vide. Le document était
 * juste ; c'est de l'avoir laissé PARTIR qui ne l'était pas.
 *
 * **Rien ne s'y opposait.** L'envoi savait refuser un devis absent, un canal
 * non choisi, une coordonnée manquante — jamais un devis sans une ligne.
 *
 * ── POURQUOI ZÉRO LIGNE, ET NON ZÉRO EURO ───────────────────────────────────
 *
 * Un devis à **0,00 €** peut être légitime : un geste commercial, un
 * déplacement offert. Le refuser interdirait au patron quelque chose qu'il a le
 * droit de faire, et c'est exactement le genre de règle inventée que ce dépôt
 * s'interdit (`CLAUDE.md` §4).
 *
 * Un devis **sans une seule ligne**, lui, n'est jamais légitime : il n'y a rien
 * à accepter. C'est donc là que passe la barrière — sur ce qui est écrit, pas
 * sur ce qui est compté.
 */
export type RefusEnvoi = "devis_vide";

export function devisEnvoyable(devis: { nombreLignes: number } | null): RefusEnvoi | null {
  if (!devis) return null; // L'absence de devis a son propre motif, plus ancien.
  return devis.nombreLignes === 0 ? "devis_vide" : null;
}

/**
 * Ce qu'on lui dit, et **ce qu'il doit faire ensuite**.
 *
 * Un refus qui ne nomme pas la porte suivante envoie chercher au hasard — le
 * travers que ce dépôt paie régulièrement (`AGENTS.md`).
 */
export const MOTIF_DEVIS_VIDE =
  "Ce devis ne porte aucune ligne : votre client recevrait un document vide, " +
  "à zéro euro. Posez d'abord vos prix sur ce chantier.";
