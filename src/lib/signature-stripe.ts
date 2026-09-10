/**
 * LA SIGNATURE D'UN ÉVÉNEMENT DE PAIEMENT — la seule chose qui sépare une
 * notification de Stripe d'une requête écrite par n'importe qui.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI CELA COMPTE AUTANT.** L'adresse du crochet est publique : elle
 * doit l'être, puisque Stripe la frappe depuis l'extérieur. Sans vérification,
 * n'importe qui pourrait y poster « abonnement payé » et s'offrir la formule
 * Illimité. La signature est donc la porte, et il n'y en a pas d'autre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI ELLE EST ÉCRITE ICI PLUTÔT QU'IMPORTÉE.**
 *
 * La bibliothèque officielle de Stripe la ferait — au prix d'une dépendance
 * entière pour trois appels REST, dont ce dépôt n'a besoin nulle part ailleurs.
 * Et surtout : **écrite ici, elle s'éprouve sans compte, sans clé et sans
 * réseau** (`scripts/test-signature-stripe.ts`). Une signature qu'on ne peut
 * pas confronter à une contrefaçon ne prouve rien (`CLAUDE.md` §5).
 *
 * Le format est celui que Stripe documente, et il n'a qu'une forme :
 *
 *     Stripe-Signature: t=1757000000,v1=5257a8…,v1=aef3…
 *
 * On signe `t.corps` — le corps EXACT reçu, octet pour octet, jamais un JSON
 * réanalysé puis réécrit : `JSON.parse` suivi de `JSON.stringify` change
 * l'ordre des clés et les espaces, et la signature ne retomberait plus jamais
 * juste. C'est le piège classique de ce contrôle.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Cinq minutes, la tolérance que Stripe recommande contre le rejeu. */
export const TOLERANCE_SECONDES = 300;

export type VerdictSignature =
  | { valide: true; horodatage: number }
  | { valide: false; raison: "entete_absente" | "entete_illisible" | "trop_vieille" | "signature_fausse" };

type EnteteLue = { horodatage: number; signatures: string[] };

/**
 * Découpe l'en-tête. **Une clé inconnue ne fait pas échouer** : Stripe s'est
 * déjà réservé le droit d'en ajouter (`v0` existe pour ses propres essais), et
 * refuser ce qu'on ne connaît pas casserait le jour où une clé apparaît.
 */
function lireEntete(entete: string): EnteteLue | null {
  let horodatage: number | null = null;
  const signatures: string[] = [];

  for (const morceau of entete.split(",")) {
    const separateur = morceau.indexOf("=");
    if (separateur <= 0) continue;
    const cle = morceau.slice(0, separateur).trim();
    const valeur = morceau.slice(separateur + 1).trim();
    if (cle === "t") {
      // Un horodatage non numérique rend l'en-tête illisible : le laisser
      // passer signerait « NaN.corps », qui ne vaut rien mais qui ressemble à
      // une vérification.
      if (!/^\d+$/.test(valeur)) return null;
      horodatage = Number(valeur);
    } else if (cle === "v1") {
      if (/^[0-9a-f]+$/i.test(valeur)) signatures.push(valeur.toLowerCase());
    }
  }

  if (horodatage === null || signatures.length === 0) return null;
  return { horodatage, signatures };
}

/**
 * Comparaison à durée constante, sur des tampons de MÊME longueur.
 *
 * `timingSafeEqual` lève quand les longueurs diffèrent — une exception qui
 * remonterait comme une panne au lieu d'un refus. On compare donc la longueur
 * d'abord, ce qui ne fuite rien : elle est fixe (64 caractères hexadécimaux)
 * pour toute signature réelle.
 */
function memeSignature(attendue: string, recue: string): boolean {
  if (attendue.length !== recue.length) return false;
  return timingSafeEqual(Buffer.from(attendue, "utf8"), Buffer.from(recue, "utf8"));
}

/**
 * @param corps le corps de la requête TEL QU'IL EST ARRIVÉ (`await request.text()`).
 * @param entete la valeur brute de l'en-tête `Stripe-Signature`.
 * @param secret le secret du crochet (`whsec_…`), jamais la clé d'API.
 * @param maintenant passé de l'extérieur : sans lui, le refus « trop vieille »
 *        serait inéprouvable autrement qu'en attendant cinq minutes.
 */
export function verifierSignature(
  corps: string,
  entete: string | null,
  secret: string,
  maintenant: Date
): VerdictSignature {
  if (!entete || entete.trim() === "") return { valide: false, raison: "entete_absente" };

  const lue = lireEntete(entete);
  if (!lue) return { valide: false, raison: "entete_illisible" };

  // **L'âge se vérifie AVANT la signature, et c'est délibéré.** Un événement
  // authentique rejoué trois jours plus tard porte une signature parfaitement
  // valide : c'est l'horodatage, et lui seul, qui l'arrête.
  const ageSecondes = Math.abs(Math.floor(maintenant.getTime() / 1000) - lue.horodatage);
  if (ageSecondes > TOLERANCE_SECONDES) return { valide: false, raison: "trop_vieille" };

  const attendue = createHmac("sha256", secret).update(`${lue.horodatage}.${corps}`, "utf8").digest("hex");
  if (!lue.signatures.some((s) => memeSignature(attendue, s))) {
    return { valide: false, raison: "signature_fausse" };
  }

  return { valide: true, horodatage: lue.horodatage };
}

/**
 * Fabrique un en-tête signé. **Elle sert au contrôle, et elle sert aussi à
 * lui** : le jour où le crochet ne recevra rien, c'est avec cela qu'on saura
 * si le silence vient de Stripe ou d'Atlas, sans attendre un vrai paiement.
 */
export function signerPourEssai(corps: string, secret: string, maintenant: Date): string {
  const t = Math.floor(maintenant.getTime() / 1000);
  const signature = createHmac("sha256", secret).update(`${t}.${corps}`, "utf8").digest("hex");
  return `t=${t},v1=${signature}`;
}
