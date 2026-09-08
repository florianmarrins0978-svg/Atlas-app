/**
 * COMMENT LE CLIENT NOUS RÈGLE — l'IBAN, l'ordre du chèque, et la consigne du
 * libellé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI SE FIGE, ET CE QUI NE SE FIGE PAS. La distinction est tout ce
 * module**, et elle a été posée le 8 septembre 2026 sur sa question : *« lorsque
 * l'utilisateur modifie son IBAN dans ses réglages ou le nom de sa société, les
 * infos se modifient automatiquement dans le lien que recevra le client ? »*
 *
 * La réponse était **non**, et le défaut était pire que la question : une
 * facture recopie l'identité **du devis** (`instantaneDuDevis`), figée le jour
 * où le devis a été fait. Un devis de janvier facturé en juin partait donc avec
 * l'IBAN de janvier — et si l'artisan avait changé de banque entre-temps, le
 * client virait l'argent sur un compte fermé, sur une facture toute neuve.
 *
 * **CE QUI A ÉTÉ CORRIGÉ N'EST PAS LE FIGEAGE, C'EST SON INSTANT.** La première
 * idée — montrer l'IBAN vivant sur la page du client — était fausse, et c'est
 * la lecture de `factures/[jeton]/pdf/route.ts` qui l'a arrêtée : le PDF servi
 * est le fichier **ARCHIVÉ**, jamais reconstruit. Une page qui aurait affiché
 * l'IBAN d'aujourd'hui à côté d'un PDF portant celui d'hier aurait donné DEUX
 * IBAN au même client, dans le même envoi — pire que le défaut de départ.
 *
 * | | |
 * |---|---|
 * | ce qui vient du **devis** | le client et les prix : c'est ce qui a été accepté |
 * | ce qui vient de l'**entreprise**, lu à la création de la facture | l'émetteur et ses modalités de paiement : une facture est une pièce NEUVE, émise aujourd'hui |
 *
 * Le régime de TVA suivait déjà cette règle depuis la migration 0039 ; ce lot
 * l'étend à l'IBAN, au titulaire du compte et au reste de l'identité
 * (migration 0076). Une fois la facture créée, tout est figé — la page et le PDF
 * archivé lisent alors les mêmes colonnes, et ne peuvent plus se contredire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **PUR, ET SANS BASE.** Les mêmes fonctions servent la page du client et le
 * PDF : deux rédactions de la même phrase finiraient par dire deux choses
 * différentes au même client, sur deux pièces du même envoi (`CLAUDE.md` §3).
 */

export type IdentiteDePaiement = {
  /** L'IBAN (Réglages → Identité), ou celui figé sur la facture. */
  iban: string | null;
  /** Le titulaire du compte, quand il diffère du nom de l'entreprise. */
  titulaireCompte: string | null;
  /** Le nom de l'entreprise — celui de la même source que les deux au-dessus. */
  nomEntreprise: string;
};

export type ModalitesPaiement = {
  /** L'IBAN par groupes de quatre, pour l'œil. `null` s'il n'est pas réglé. */
  ibanLisible: string | null;
  /** Le même sans un seul espace, pour le copier-coller. */
  ibanACopier: string | null;
  /** À qui le chèque est libellé. Jamais vide. */
  ordreDuCheque: string;
};

/**
 * **Un IBAN se relit par paquets de quatre, et c'est pour ça qu'on le regroupe.**
 *
 * Il se saisit comme on veut — avec des espaces, sans, en minuscules. On le
 * normalise avant de le regrouper, sinon « FR76 30006 » rendrait des paquets
 * décalés d'un caractère et personne ne pourrait le comparer à son relevé.
 */
export function ibanEnGroupes(iban: string): string {
  const nu = ibanSansEspace(iban);
  return nu.replace(/(.{4})/g, "$1 ").trim();
}

/** L'IBAN nu — ce qu'on met dans le presse-papier, et ce qu'une banque attend. */
export function ibanSansEspace(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/**
 * À l'ordre de QUI.
 *
 * **Le titulaire l'emporte sur le nom de l'entreprise, et ce n'est pas un
 * détail.** `entreprises.titulaire_compte` existe précisément parce qu'un compte
 * peut être ouvert à un autre nom que l'enseigne — le commentaire du schéma le
 * dit : « un IBAN à un nom différent de l'entreprise inquiète au lieu de
 * rassurer ». Un chèque libellé à l'enseigne quand le compte est au nom propre
 * se fait refuser au guichet.
 *
 * Vide ou blanc, il ne compte pas : une chaîne d'espaces n'est pas un nom.
 */
export function ordreDuCheque(id: IdentiteDePaiement): string {
  const titulaire = (id.titulaireCompte ?? "").trim();
  return titulaire !== "" ? titulaire : id.nomEntreprise.trim();
}

/**
 * Les modalités d'une FACTURE, lues sur ses colonnes figées.
 *
 * **Le passage obligé de la page du client et du PDF.** Les deux partent des
 * mêmes trois colonnes ; les laisser les recombiner chacune de son côté serait
 * la duplication que `CLAUDE.md` §3 interdit, et l'écart s'appellerait « deux
 * IBAN pour un même envoi ». La forme est structurelle, sans rien de Drizzle :
 * ce module doit rester éprouvable sans base.
 */
export function modalitesDeLaFacture(f: {
  entrepriseIban: string | null;
  entrepriseTitulaireCompte: string | null;
  entrepriseNom: string;
}): ModalitesPaiement {
  return modalitesDePaiement({
    iban: f.entrepriseIban,
    titulaireCompte: f.entrepriseTitulaireCompte,
    nomEntreprise: f.entrepriseNom,
  });
}

/** Les trois valeurs prêtes à écrire, à partir d'une identité déjà réunie. */
export function modalitesDePaiement(id: IdentiteDePaiement): ModalitesPaiement {
  const brut = (id.iban ?? "").trim();
  const nu = brut === "" ? null : ibanSansEspace(brut);
  return {
    ibanLisible: nu ? ibanEnGroupes(nu) : null,
    ibanACopier: nu,
    ordreDuCheque: ordreDuCheque(id),
  };
}

/**
 * LA CONSIGNE DU LIBELLÉ — sa demande du 8 septembre 2026 : *« une phrase bien
 * écrite pour dire que pour nous régler il faut impérativement mettre le numéro
 * de facture dans le libellé »*.
 *
 * **Elle dit ce qui arrive si on ne le fait pas, et c'est ce qui la rend
 * obéie.** « Merci d'indiquer le numéro » se lit comme une politesse et
 * s'oublie ; « sans ce numéro, votre règlement ne peut pas être rattaché »
 * donne la raison, et un client qui comprend la raison la respecte.
 *
 * Coupée en deux pour la page, entière pour le PDF : l'écran met le numéro en
 * gras au milieu de la phrase, le papier ne le peut pas. **Un seul texte pour
 * les deux** — c'est le point de tout ce module.
 */
export const LIBELLE_AVANT = "Par virement, indiquez";
export const LIBELLE_APRES =
  "dans le libellé. Sans ce numéro, votre règlement ne peut pas être rattaché à cette facture.";

export function consigneDuLibelle(numeroFacture: string): string {
  return `${LIBELLE_AVANT} ${numeroFacture} ${LIBELLE_APRES}`;
}

/**
 * LA PHRASE DU CHÈQUE, avec DEUX POINTS — et ce n'est pas une coquetterie.
 *
 * « À l'ordre d'Atlas » demanderait de deviner l'élision au nom près : on écrit
 * « d'Atlas » mais « de Dupont Paysage », « d'Élagage du Val » mais « de
 * Herbier » — et le h aspiré n'est décidable par aucune règle mécanique. Les
 * deux points suppriment la question quel que soit le nom réglé, et ne coûtent
 * rien à la lecture.
 */
export function phraseDuCheque(ordre: string): string {
  return `Par chèque, à l'ordre de : ${ordre}.`;
}
