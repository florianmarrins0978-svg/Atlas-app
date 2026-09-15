import { Decimal } from "decimal.js";
import { chiffreCanonique } from "./chiffre-saisi";

/**
 * CE QU'UNE LIGNE PÈSE : sa quantité fois son prix unitaire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette fonction existe — sa demande du 13 septembre 2026 :**
 * *« vérifie tous les calculs ; si les lignes ne s'additionnent pas ou mal,
 * c'est hyper grave et ça ne doit jamais arriver »*.
 *
 * Elle était écrite **deux fois** : une fois dans le dépôt des lignes de devis
 * (`lignes-prix.ts`), une fois dans celui des factures — dont le commentaire
 * affirmait pourtant *« la même règle que le devis, appelée et non réécrite »*.
 * Elle l'était. Deux implémentations de la même règle finissent toujours par
 * diverger (`CLAUDE.md` §3), et celle-ci décide de ce que le client paie.
 *
 * **`Decimal`, jamais les nombres du langage.** `0.1 + 0.2` y fait
 * `0.30000000000000004` : sur trois lignes et une TVA, le total du devis cesse
 * de tomber juste, et c'est le genre d'écart qu'on ne voit qu'au moment où le
 * client le relève.
 *
 * **Deux décimales, et arrondies une seule fois — à la fin.** Arrondir la
 * quantité ou le prix d'abord ferait payer l'arrondi deux fois.
 *
 * **Une valeur absente vaut zéro, elle n'invente rien.** Une ligne sans prix
 * pèse 0 € et le dit ; c'est l'écran qui la marque « à chiffrer », et l'envoi
 * qui la refuse (`lignes-prix.ts`).
 *
 * **Et « 2,50 » se lit 2,50** — la virgule du clavier français passe par la
 * même lecture que le dépôt (`chiffre-saisi.ts`, 15 septembre 2026) : ce que
 * l'écran affiche en tapant est ce que la base enregistrera.
 *
 * Éprouvée sans base ni réseau — `scripts/test-montant-de-ligne.ts`.
 */
export function montantDeLaLigne(quantite: string | null | undefined, prixUnitaire: string | null | undefined): string {
  return new Decimal(chiffreCanonique(quantite) ?? "0").times(chiffreCanonique(prixUnitaire) ?? "0").toFixed(2);
}
