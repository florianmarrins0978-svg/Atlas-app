// **À qui appartient le montant d'une ligne de devis ?**
//
// Une ligne de devis peut porter plusieurs travaux. Son montant, lui, est un
// seul nombre. Deux mécanismes du produit s'en servent pour APPRENDRE :
// `apprendrePrixGrille` range ce montant dans une case de la grille du patron,
// et `retenirLecon` le retient comme le prix d'un genre de chantier.
//
// Les deux ont besoin de la même certitude : **ce montant est-il celui du
// travail auquel on s'apprête à l'attribuer, et de lui seul ?**
//
// ─── Ce que ça a coûté de ne pas le demander ────────────────────────────────
//
// Le 26 août 2026, le patron dicte depuis son iPhone : une tonte de 1 200 m² et
// le démontage d'un érable en rétention. Le découpage les réunit sur une seule
// ligne (`lignes-vendables.ts` : tout ce qui n'a pas de grille tombe dans
// `principal`). Il pose un prix sur cette ligne, et le classement se fait au
// premier mot reconnu — « démont » répond.
//
// Sa case d'abattage passe alors de 800 € à 1 500 €, **tonte comprise**. Le
// chiffre revient ensuite tout seul sur chaque démontage suivant, avec
// l'autorité de sa grille, et rien ne le dit à l'écran. Mesuré, pas supposé :
// `scripts/test-dictee-devis-identite-db.ts`.
//
// ─── Le vocabulaire ne vit plus ici ─────────────────────────────────────────
//
// Ce module portait sa propre liste de sept travaux, recopiée de deux autres
// modules — dont aucun ne connaissait la tonte. Elle est dans
// `natures-prestation.ts` désormais, avec les cinq autres qui la doublaient.
//
// Et depuis le 27 août 2026, la question se pose d'abord sur les PRESTATIONS
// que la ligne vend (`prixAttribuableDes`), pas sur le texte de son libellé :
// la ligne sait ce qu'elle vend depuis la migration 0069. La lecture du libellé
// reste, pour les lignes d'avant.
//
// ─── Ce que ce module N'EST PAS ─────────────────────────────────────────────
//
// Ce n'est pas le découpage du devis, et il ne le remplace pas. La vraie
// correction — une nature par prestation, et un lien entre la ligne commerciale
// et les prestations qu'elle porte — vient après. Ici on ferme seulement la
// porte par laquelle un montant faux entre dans une mémoire qui ne s'efface
// pas.
//
// ─── Et surtout : il ne doit RIEN casser de ce qui marche ───────────────────
//
// Le devis que le patron a écrit lui-même le 5 août compte une ligne
// « abattage, broyage, évacuation » à 600 €. **Ces 600 € SONT son prix
// d'abattage** — c'est sa règle, écrite dans `lignes-vendables.ts` : *« l'abattage,
// le broyage et l'évacuation, c'est sur une ligne »*. Un garde-fou qui refuserait
// cette ligne-là arrêterait l'apprentissage sur son cas le plus courant, et
// dégraderait l'application au lieu de la réparer.
//
// D'où la distinction ci-dessous entre un travail qui **se vend seul** et un
// travail qui **accompagne** — elle n'est pas inventée : elle est reprise mot
// pour mot de ses décisions des 7 et 8 août 2026.

import { membresDuLibelle } from "./lignes-vendables";
import { nature, naturesDuLibelle } from "./natures-prestation";

export type Attribution =
  /** Le montant appartient à ce travail, et à lui seul. */
  | { attribuable: true; nature: string }
  /** Il ne lui appartient pas — et le motif dit pourquoi, pour le journal. */
  | { attribuable: false; motif: string };

/** Un travail de la ligne, tel qu'on le connaît — par sa colonne ou par son texte. */
export type TravailDeLaLigne = {
  libelle: string;
  /** Sa nature en COLONNE. Absente, elle est relue du libellé (mécanisme historique). */
  nature?: string | null;
};

/**
 * Le montant de cette ligne peut-il être attribué à un seul travail ?
 *
 * **La version qui compte** : elle travaille sur les prestations que la ligne
 * vend réellement (`lignes_prix_prestations`, migration 0069), et lit leur
 * nature en colonne plutôt que de relire leur libellé.
 *
 * Fonction pure : ni base, ni réseau, ni date.
 *
 * **Le doute refuse.** Un travail qu'on ne reconnaît pas, posé à côté d'un
 * travail qu'on reconnaît, suffit à rendre le montant inattribuable : on ne
 * sait pas quelle part lui revient, et supposer que c'est zéro serait inventer.
 * Sa règle vaut ici comme ailleurs — une leçon absente coûte moins cher qu'une
 * leçon fausse, parce que la fausse se présente avec l'autorité de
 * l'expérience.
 */
export function prixAttribuableDes(travaux: readonly TravailDeLaLigne[]): Attribution {
  const lus = travaux
    .map((t) => ({
      texte: t.libelle.trim(),
      // **Un membre qui porte DEUX travaux vendables à lui seul est déjà un
      // doute.** « Abattage et dessouchage » écrit sur une même ligne de texte
      // ne dit pas quelle part revient à quoi, et le premier motif qui répond
      // gagnerait — c'est le défaut qu'on répare, sous un autre visage. On les
      // relève donc TOUS, jamais le premier.
      natures: t.nature?.trim() ? [t.nature.trim()] : naturesDuLibelle(t.libelle),
    }))
    .filter((m) => m.texte.length > 0);

  if (lus.length === 0) return { attribuable: false, motif: "Ligne sans libellé." };

  const toutes = new Set(lus.flatMap((m) => m.natures));

  // Un accessoire n'est un accessoire que s'il accompagne quelqu'un. Seul, il
  // EST le chantier — et son apprentissage doit continuer.
  const porteuses = [...toutes].filter((cle) => !(nature(cle)?.accessoire && toutes.size > 1));

  if (porteuses.length === 0) {
    return {
      attribuable: false,
      motif: `Aucun travail chiffrable reconnu dans « ${resume(lus[0].texte)} ».`,
    };
  }

  if (porteuses.length > 1) {
    // **Le motif nomme les travaux, pas seulement leurs natures.** C'est ce
    // qu'on lit dans le journal quand la grille du patron n'a pas bougé et
    // qu'on cherche pourquoi : « deux travaux » ne se diagnostique pas.
    const nommes = porteuses.map((cle) => {
      const membre = lus.find((m) => m.natures.includes(cle));
      return `« ${resume(membre?.texte ?? cle)} » (${cle})`;
    });
    return {
      attribuable: false,
      motif:
        `La ligne porte ${porteuses.length} travaux qui se vendent séparément : ` +
        `${nommes.join(", ")}. Son montant n'appartient à aucun d'eux en propre.`,
    };
  }

  const retenue = porteuses[0];

  // **Un travail non reconnu à côté d'un travail reconnu suffit à refuser.**
  // C'est exactement le cas du 26 août : « Tonte de la pelouse (1200 m²) »
  // n'était reconnue par aucun vocabulaire du produit, et elle voyageait sur la
  // ligne du démontage. Le montant couvre les deux ; l'attribuer au démontage
  // seul, c'est écrire la tonte dans le prix d'abattage.
  const inconnus = lus.filter((m) => m.natures.length === 0);
  if (inconnus.length > 0) {
    return {
      attribuable: false,
      motif:
        `La ligne porte un travail que le produit ne sait pas nommer ` +
        `(« ${resume(inconnus[0].texte)} ») à côté d'un ${retenue} : ` +
        "on ne sait pas quelle part du montant revient à chacun.",
    };
  }

  return { attribuable: true, nature: retenue };
}

/**
 * La même question, posée sur le seul libellé d'une ligne — **mécanisme
 * historique**.
 *
 * À employer quand la ligne ne connaît pas ses prestations : les lignes écrites
 * avant la migration 0069, et celles qui ne passent pas par le découpage (un
 * tarif nommé, une ligne ajoutée à la main).
 *
 * @param libelle Le libellé de la ligne de devis, tel qu'il est en base. Les
 *   travaux réunis y sont séparés par des retours à la ligne — c'est le
 *   séparateur qu'a choisi le patron le 8 août, et `lignes-vendables.ts` l'écrit.
 */
export function prixAttribuable(libelle: string): Attribution {
  return prixAttribuableDes(membresDuLibelle(libelle).map((texte) => ({ libelle: texte })));
}

function resume(texte: string, max = 60): string {
  const propre = texte.trim().replace(/\s+/g, " ");
  return propre.length <= max ? propre : `${propre.slice(0, max - 1)}…`;
}
