import { formeApresLeNom, nomAvecForme } from "./formes-juridiques";
import { lignesMentionsLegales, positionEffective, type PositionMentionsLegales } from "./mentions-legales";

/** Ce que l'en-tête lit de l'entreprise, tel que le document l'a figé. */
export type DonneesEnTete = {
  nom: string;
  formeJuridique?: string | null;
  capitalSocial?: string | null;
  villeRcs?: string | null;
  siret?: string | null;
  numeroRm?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  numeroTva?: string | null;
  position?: PositionMentionsLegales | null;
};

/** Une ligne sous le nom. `mention` : forme juridique, capital ou RCS d'une société. */
export type LigneEnTete = { texte: string; mention: boolean };

export type EnTeteDocument = {
  /** Le nom tel qu'il s'imprime : « Atelier Démo EI » pour une entreprise individuelle. */
  nom: string;
  /** « EI » quand il s'ajoute au nom : la seule mention d'une entreprise individuelle (R526-27). */
  formeApresLeNom: string | null;
  lignes: LigneEnTete[];
};

/**
 * « SIRET 123 456 789 00012, RM 33 » — son choix B du 9 octobre 2026
 * (`appli/numero-rm.html`) : la mention du répertoire des métiers sur la ligne
 * du SIRET, après une virgule. Elle s'imprime telle qu'il l'a écrite, parce
 * qu'aucun texte trouvé ne dit laquelle un artisan doit porter depuis le RNE.
 * Sans SIRET, elle garde sa ligne plutôt que de disparaître avec lui.
 */
function ligneSiret(siret: string | null | undefined, numeroRm: string | null | undefined): string | null {
  const rm = numeroRm?.trim();
  if (!siret) return rm || null;
  return rm ? `SIRET ${siret}, ${rm}` : `SIRET ${siret}`;
}

function coordonnees(...textes: (string | null | undefined)[]): LigneEnTete[] {
  return textes.filter((t): t is string => !!t).map((texte) => ({ texte, mention: false }));
}

/**
 * L'EN-TÊTE DU DEVIS ET DE LA FACTURE, ligne par ligne, dans l'ordre du papier.
 *
 * **Une seule fonction pour le papier et pour l'écran** (26 octobre 2026). Le
 * PDF l'imprime (`document-commun.ts`) ; « Sur vos papiers », dans Mon
 * entreprise, en dessine la miniature avec un repère doré sur les mentions
 * (planche `appli/soignee/reglages-identite.html`). Deux ordres écrits à part
 * finiraient par lui montrer un devis que son client ne reçoit pas, et c'est
 * exactement ce que « En bas, avec le SIRET » a fait jusqu'au 26 octobre : le
 * réglage existait, et les deux choix donnaient le même papier.
 *
 * **Une ligne par information**, sa demande du 25 août 2026 (*« une ligne par
 * information »*) : l'adresse, le téléphone et l'e-mail ne se partagent plus
 * une ligne.
 *
 * **Une case vide n'imprime rien**, ligne par ligne, comme partout dans
 * l'identité de l'entreprise : jamais une étiquette suivie de rien.
 */
export function enTeteDuDocument(d: DonneesEnTete): EnTeteDocument {
  // **La forme juridique, le capital et le RCS d'une société se glissent selon
  // SON choix** (migration 0072) : sous le nom, ou avec le reste des
  // coordonnées. Plus jamais nulle part : ils sont obligatoires (choix 4A du
  // 3 octobre 2026, `positionEffective`).
  const position = positionEffective(d.position);
  const mentions = lignesMentionsLegales({
    formeJuridique: d.formeJuridique,
    capitalSocial: d.capitalSocial,
    villeRcs: d.villeRcs,
    siret: d.siret,
  }).map((texte) => ({ texte, mention: true }));

  return {
    nom: nomAvecForme(d.nom, d.formeJuridique),
    formeApresLeNom: formeApresLeNom(d.nom, d.formeJuridique),
    lignes: [
      ...(position === "sous_nom" ? mentions : []),
      ...coordonnees(d.adresse, d.telephone, d.email),
      // **« En bas, avec le SIRET » descend VRAIMENT près du SIRET** (sa
      // réponse du 26 octobre 2026, « je le garde ») : entre l'e-mail et lui.
      ...(position === "bas" ? mentions : []),
      ...coordonnees(ligneSiret(d.siret, d.numeroRm), d.numeroTva ? `TVA intracommunautaire ${d.numeroTva}` : null),
    ],
  };
}
