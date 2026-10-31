import { enEuros } from "./euros";
import { jourDeLaLigne, type TraceDuClient } from "./documents-du-client";

/**
 * CE QUE DIT LA LIGNE D'UN CLIENT, sur Vos clients soignée (sa planche
 * `appli/soignee/clients.html`, retenue le 29 octobre 2026).
 *
 * Des mots, et seulement des mots : l'écran les pose, il n'en décide aucun
 * (`CLAUDE.md` §3). Éprouvé par `scripts/test-ligne-du-client.ts`.
 */

/**
 * « Facture du 17 oct. » : la dernière pièce partie, sur sa propre ligne.
 *
 * Elle disait « Facture 17 oct. » collée à l'adresse ; la planche lui donne
 * une ligne à elle, et le « du » s'y lit comme une phrase. `null` : rien n'est
 * encore parti, la ligne se tait plutôt que d'annoncer un manque.
 */
export function phraseDeLaDerniere(trace: TraceDuClient | null, aujourdHui: string): string | null {
  return trace ? `${trace.quoi} du ${jourDeLaLigne(trace.jour, aujourdHui)}` : null;
}

/**
 * « 312,00 € dus », d'un seul tenant. `null` quand rien n'est dû : un « 0 € »
 * en face de chaque nom se lirait comme un mauvais payeur.
 */
export function resteDuDeLaLigne(du: string | number | null): string | null {
  if (du === null || !(Number(du) > 0)) return null;
  return `${enEuros(du)} dus`;
}

/**
 * Les initiales d'un client, « MA » pour Mme Aubry : la règle de l'import d'un
 * tableau (`ImporterTableau`), qui les montrait la première. Une seule règle
 * pour deux écrans, sinon le même client aurait deux visages.
 */
export function initialesDuClient(nom: string): string {
  const mots = nom.replace(/\bet\b/g, "").split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  return (mots.length === 1 ? mots[0][0] : mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

/** Le nombre sous le nom d'une porte : « Aucun », ou le chiffre. */
export function compteDeLaPorte(n: number): string {
  return n === 0 ? "Aucun" : n.toLocaleString("fr-FR").replace(/ /g, " ");
}
