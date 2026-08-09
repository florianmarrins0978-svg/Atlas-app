import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "../env";

/**
 * Chiffrer un secret avant de l'écrire en base, et le relire.
 *
 * **Pourquoi ce module existe alors que la base est déjà isolée.** Tout ce
 * qu'Atlas stocke est déjà protégé par la RLS : un artisan ne voit pas les
 * chantiers d'un autre. Mais la RLS protège d'un artisan, pas d'une sauvegarde
 * qui traîne, d'un journal de requêtes, ou d'un accès administrateur à la base.
 *
 * Pour un nom de client, ce risque est celui qu'on a accepté partout ailleurs.
 * **Un jeton de rafraîchissement Google n'est pas de la même nature** : il ne
 * décrit pas une donnée, il *ouvre un compte*. Celui qui le lit lit l'agenda
 * entier de l'artisan — ses rendez-vous médicaux, ses vacances, sa vie — et
 * continue de le lire après que l'artisan a fermé Atlas. Un secret qui survit
 * à sa propre application mérite une serrure de plus.
 *
 * **Ce que ce module ne prétend PAS faire.** La clé se dérive d'`AUTH_SECRET`,
 * qui vit dans la configuration du serveur. Quelqu'un qui obtient à la fois la
 * base ET la configuration lit tout. Ce n'est donc pas une protection contre
 * une machine entièrement compromise — c'est une protection contre le cas
 * beaucoup plus courant où **seule la base** fuit : une sauvegarde recopiée,
 * un export oublié, un accès en lecture accordé un peu vite. Le dire vaut mieux
 * que de laisser croire à un coffre-fort.
 */

/** AES-256-GCM : chiffre et authentifie d'un même geste. */
const ALGORITHME = "aes-256-gcm";
/** Marqueur de version, pour qu'un changement de format ne casse rien en silence. */
const PREFIXE = "v1";

/**
 * La clé de chiffrement, dérivée d'`AUTH_SECRET`.
 *
 * Passée par SHA-256 plutôt qu'utilisée telle quelle : `AUTH_SECRET` est une
 * chaîne de longueur arbitraire, et AES-256 exige exactement trente-deux
 * octets. Tronquer conviendrait tant que le secret est assez long, et
 * échouerait le jour où quelqu'un en pose un court — un défaut qui ne se
 * verrait qu'en production, sur une installation neuve.
 *
 * Le sel constant n'ajoute rien contre un attaquant qui connaît le code ; il
 * évite seulement que la même valeur d'`AUTH_SECRET` produise la même clé dans
 * un autre logiciel qui la dériverait de la même façon.
 */
function cle(): Buffer {
  const secret = getEnv().authSecret;
  return createHash("sha256").update(`atlas:agenda:${secret}`).digest();
}

/**
 * Chiffre un secret. Le résultat est du texte, stockable dans une colonne
 * ordinaire, et **jamais deux fois le même** pour une même entrée — le vecteur
 * d'initialisation est tiré au hasard à chaque appel.
 */
export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv(ALGORITHME, cle(), iv);
  const chiffre = Buffer.concat([chiffreur.update(clair, "utf8"), chiffreur.final()]);
  const marque = chiffreur.getAuthTag();
  return [PREFIXE, iv.toString("base64"), marque.toString("base64"), chiffre.toString("base64")].join(".");
}

/**
 * Relit un secret chiffré. Rend `null` plutôt que de jeter.
 *
 * **Le choix compte.** Un jeton illisible — format changé, `AUTH_SECRET`
 * remplacé, ligne tronquée — ne doit pas faire tomber l'écran de réglages ni
 * la préparation d'un envoi. L'appelant traite `null` comme « agenda non
 * relié » : l'artisan voit un bouton pour le rebrancher, ce qui est exactement
 * la bonne action, au lieu d'une page en erreur qui ne dit rien à faire.
 *
 * Ce qu'il ne faut PAS en conclure : que l'absence de jeton est sans
 * conséquence. Sans jeton, Atlas retombe sur les seuls chantiers qu'il connaît
 * — et c'est le comportement d'avant, avec son risque de doublon. L'écran doit
 * donc le dire, pas le taire.
 */
export function dechiffrer(chiffre: string): string | null {
  try {
    const [prefixe, ivB64, marqueB64, corpsB64] = chiffre.split(".");
    if (prefixe !== PREFIXE || !ivB64 || !marqueB64 || !corpsB64) return null;
    const dechiffreur = createDecipheriv(ALGORITHME, cle(), Buffer.from(ivB64, "base64"));
    dechiffreur.setAuthTag(Buffer.from(marqueB64, "base64"));
    return Buffer.concat([
      dechiffreur.update(Buffer.from(corpsB64, "base64")),
      dechiffreur.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
