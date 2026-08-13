import { decouperNumeroDocument } from "@/lib/numero-document";

/**
 * Le numéro d'un devis ou d'une facture, écrit de façon qu'un téléphone n'y
 * voie pas un numéro d'appel.
 *
 * **Pourquoi ce composant existe** — le récit complet est en tête de
 * `src/lib/numero-document.ts` et dans `ARCHITECTURE.md` §68 puis §81. En deux
 * lignes : iOS réécrit nos pages avant React, le numéro devient un lien
 * d'appel sous le doigt du client de l'artisan, et React refabrique tout
 * l'arbre en annonçant « Hydration failed ». L'en-tête `format-detection` du
 * gabarit racine ne protège que Safari ; le patron, lui, ouvre le lien depuis
 * ses SMS, où elle n'est pas lue.
 *
 * ─── LE SEUL POINT QUI COMPTE DANS CE FICHIER ────────────────────────────────
 * **`inline-flex` n'est pas une mise en forme : c'est le correctif.**
 *
 * Un détecteur ne lit pas le DOM, il lit le texte APLATI d'une portion de
 * page — ce que `innerText` rend. Or l'aplatissement ignore les éléments en
 * ligne et n'insère un retour à la ligne qu'aux frontières de bloc. Mesuré
 * dans un navigateur avant d'écrire une seule ligne de ce composant, sur
 * « Devis n° 2026-0007 » :
 *
 *   nu                          → "Devis n° 2026-0007"
 *   deux <span> en ligne        → "Devis n° 2026-0007"   ← la recette qui circule
 *   deux <span> inline-block    → "Devis n° 2026-0007"      ne sert donc à RIEN
 *   parent inline-flex          → "Devis n° \n2026-\n0007"  ← plus rien à détecter
 *
 * La raison tient en un mot : les enfants d'une boîte flexible sont
 * « blockifiés » par CSS, quel que soit leur `display` déclaré — et ce sont les
 * blocs, et eux seuls, qui coupent le texte aplati.
 *
 * **Donc : ne pas remplacer `inline-flex` par un `<span>` ordinaire en croyant
 * simplifier.** Le rendu serait identique au pixel près, et le défaut
 * reviendrait en silence — sur le téléphone du client, jamais ici. Le contrôle
 * `test-detection-automatique-e2e.ts` lit ce texte aplati sur les vraies pages
 * et passe au rouge si la coupure disparaît.
 *
 * **Ce que cela coûte, et c'est assumé** : un numéro copié depuis l'écran
 * emporte les retours à la ligne (« 2026-\n0007 »). C'est le prix exact de ce
 * qui protège — la même coupure sert les deux — et il se paie sur un geste
 * rare, quand le défaut, lui, frappait tous les clients. Le numéro reste intact
 * partout où il compte : dans le PDF, dans le SMS, dans la base.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function NumeroDeDocument({
  valeur,
  className,
}: {
  valeur: string;
  className?: string;
}) {
  return (
    <span className={className ? `inline-flex ${className}` : "inline-flex"}>
      {decouperNumeroDocument(valeur).map((morceau, index) => (
        <span key={index}>{morceau}</span>
      ))}
    </span>
  );
}
