// Écrire un numéro de devis ou de facture sans qu'un téléphone y voie un
// numéro d'appel.
//
// **Le 12 août 2026**, iOS transformait « 2026-0003 » en `<a href="tel:…">` sur
// la page publique de la facture, et React répondait « Hydration failed » : le
// navigateur réécrivait le HTML avant que React ne s'installe dessus
// (`ARCHITECTURE.md` §68). Le remède posé ce jour-là — l'en-tête
// `format-detection` du gabarit racine — était le bon, et il n'a pas suffi :
// **le 13 août, le patron ouvre le lien reçu par SMS et reçoit exactement la
// même erreur**, signature `x-apple-data-detectors-type="telephone"` comprise,
// sur un banc qui servait bien le commit portant l'en-tête (fiche d'état du
// 13 août, 14 h 55). Un lien touché depuis Messages ne s'ouvre pas dans Safari
// mais dans une vue intégrée, où la détection est réglée par l'application
// hôte : notre en-tête n'y est pas lue.
//
// Il fallait donc cesser de demander au navigateur de bien vouloir, et faire en
// sorte qu'il n'y ait plus rien à détecter.
//
// **Ce qu'un détecteur regarde n'est pas le DOM, c'est le texte APLATI.** Mesuré
// ici plutôt que supposé (le détail est dans `NumeroDeDocument.tsx`) : entourer
// chaque moitié du numéro d'un `<span>` ne change RIEN à ce texte — il reste
// « 2026-0007 » d'un seul tenant, et la recette qui circule pour ce défaut est
// donc inopérante. Ce module attaque l'autre bout du problème : découper le
// numéro en morceaux dont aucun ne porte assez de chiffres pour ressembler à un
// téléphone, quoi qu'il advienne de leur assemblage.

// Un détecteur d'Apple ne retient une suite de chiffres qu'à partir d'une
// longueur de numéro plausible — sept, la taille d'un numéro local américain.
// C'est le seuil que ce module refuse d'atteindre, et il sert aussi de témoin
// aux contrôles (`ressembleAUnTelephone`).
export const CHIFFRES_MINIMUM_D_UN_TELEPHONE = 7;

// Quatre chiffres par morceau, soit près de trois fois moins que le seuil
// ci-dessus. La marge est délibérée : le seuil réel appartient à un logiciel
// fermé qu'on ne peut pas interroger, et il vaut mieux le manquer largement.
// Quatre tombe en outre pile sur l'année d'un numéro « 2026-0007 » : la coupure
// suit la forme du numéro au lieu de la trancher au hasard.
export const CHIFFRES_MAX_PAR_MORCEAU = 4;

// Ce qu'un numéro de téléphone tolère entre deux chiffres sans cesser d'en être
// un. Le retour à la ligne n'y figure PAS, et c'est tout l'intérêt : c'est lui
// que la mise en forme insère entre les morceaux (voir `NumeroDeDocument`).
const SEPARATEURS_TOLERES_PAR_UN_TELEPHONE = new Set([" ", " ", "-", ".", "/", "(", ")", "+"]);

const estChiffre = (caractere: string) => caractere >= "0" && caractere <= "9";

/**
 * Découpe un numéro de document en morceaux qu'aucun détecteur ne peut prendre
 * pour un téléphone, même en les recollant bout à bout.
 *
 * Le découpage ne retire ni n'ajoute rien : recoller les morceaux redonne le
 * numéro d'origine, caractère pour caractère. C'est ce que vérifie
 * `test-numero-document.ts`, et c'est ce qui autorise à l'employer partout où le
 * numéro s'affiche.
 */
export function decouperNumeroDocument(valeur: string): string[] {
  const morceaux: string[] = [];
  let morceau = "";
  let chiffresDuMorceau = 0;

  for (const caractere of valeur) {
    // La coupure se fait AVANT le chiffre de trop, jamais après : un morceau
    // n'atteint donc jamais le compte qu'on lui refuse.
    if (estChiffre(caractere) && chiffresDuMorceau >= CHIFFRES_MAX_PAR_MORCEAU) {
      morceaux.push(morceau);
      morceau = "";
      chiffresDuMorceau = 0;
    }
    morceau += caractere;
    if (estChiffre(caractere)) chiffresDuMorceau++;
  }

  if (morceau !== "") morceaux.push(morceau);
  return morceaux;
}

/**
 * Ce texte porte-t-il encore une suite de chiffres qu'un téléphone pourrait
 * vouloir appeler ?
 *
 * Sert de témoin aux contrôles — celui de la fonction ci-dessus, et celui qui
 * lit le texte réellement aplati par le navigateur sur les pages du client. Un
 * contrôle qui se contenterait de comparer des chaînes resterait vert le jour
 * où le découpage cesserait de servir à quelque chose.
 */
export function ressembleAUnTelephone(texte: string): boolean {
  let chiffresDeSuite = 0;
  for (const caractere of texte) {
    if (estChiffre(caractere)) {
      chiffresDeSuite++;
      if (chiffresDeSuite >= CHIFFRES_MINIMUM_D_UN_TELEPHONE) return true;
    } else if (!SEPARATEURS_TOLERES_PAR_UN_TELEPHONE.has(caractere)) {
      chiffresDeSuite = 0;
    }
  }
  return false;
}
