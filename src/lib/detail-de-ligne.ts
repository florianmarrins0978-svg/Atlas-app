import { Decimal } from "decimal.js";
import { chiffreCanonique } from "./chiffre-saisi";
import { enEuros } from "./euros";
import { quantiteLisible } from "./lignes-du-papier";
import { uniteDeLaLigne } from "./unite-de-ligne";

/**
 * « 120 m² à 6,50 € » : ce qu'une ligne LUE porte en petit sous son nom.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa planche du 2 novembre 2026** (`appli/soignee/facture.html`) : sur la
 * facture comme sur les travaux en plus, chaque ligne dit sa quantité, son
 * unité et son prix sous son nom, le montant à droite. Une seule fonction pour
 * les deux écrans : deux rédactions finiraient par ne plus dire la même chose
 * de la même ligne (`CLAUDE.md` §3).
 *
 * **Le défaut qu'elle corrige au passage, vu en ouvrant l'écran le même jour :**
 * le gazon à 6,50 € en base s'affichait « 0,00 € » sur les travaux en plus.
 * L'écran mettait TOUTES les lignes au format de la case (« 6.50 » devenait
 * « 6,5 », comme il l'aurait tapé), puis passait ce « 6,5 » au formateur des
 * montants de la base, qui ne le lisait pas et rendait zéro sans rien dire.
 * Les chiffres passent donc ici par la lecture unique du dépôt
 * (`chiffreCanonique`) : « 6.50 » comme « 6,5 » valent 6,50, et un prix qu'on
 * ne sait pas lire n'est pas écrit plutôt que d'être écrit faux.
 *
 * **À une quantité de 1, le prix se tait sur la facture** : il EST le montant
 * écrit à droite, et la planche n'écrit que « 1 forfait ». La feuille des
 * travaux en plus, elle, l'écrit toujours (`prixToujours`), comme sa planche :
 * c'est là qu'il relit les prix avant d'en ajouter.
 *
 * La quantité s'écrit comme sur le papier (`quantiteLisible` : « 120 », jamais
 * « 120.00 »), l'unité absente se lit « u » (`uniteDeLaLigne`), et le prix par
 * le formateur de tout le dépôt (`enEuros` : « 1 800,00 € »).
 */
export function detailDeLaLigne(
  ligne: { quantite: string; unite: string | null; prixUnitaire: string },
  { prixToujours = false }: { prixToujours?: boolean } = {}
): string {
  const quantite = chiffreCanonique(ligne.quantite);
  const prix = chiffreCanonique(ligne.prixUnitaire);
  const debut = `${quantite === null ? ligne.quantite.trim() : quantiteLisible(quantite)} ${uniteDeLaLigne(ligne.unite)}`.trim();
  if (prix === null) return debut;
  if (!prixToujours && quantite !== null && new Decimal(quantite).eq(1)) return debut;
  return `${debut} à ${enEuros(prix)}`;
}
