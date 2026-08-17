"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { ajouterMot, creerEntree, retirerMot, type Famille } from "@/server/repositories/mots-catalogue";
import { phraseDuRefus } from "@/lib/mots-catalogue";

/**
 * Les gestes de l'écran « Catalogue » — arrangement B, choisi le 17 août 2026.
 *
 * **Chaque action rend un refus en VALEUR, jamais en exception.** Le message
 * d'une exception levée par une action serveur n'arrive jamais jusqu'au patron :
 * Next.js le remplace en production par un identifiant opaque, et son banc sert
 * une version bâtie (`HANDOVER.md`, piège 0 ter). Un refus attendu — un mot
 * qu'Atlas connaît déjà, un mot déjà posé ailleurs — doit se lire sur l'écran,
 * sans quoi il recommencera à l'identique.
 *
 * **Écrire est réservé au propriétaire**, comme la rubrique d'où l'on vient
 * (« Tarifs & catalogue ») : ces mots commandent ce que la dictée comprend, donc
 * ce qui est chiffré. Lire reste ouvert.
 */
export async function ajouterMotAction(famille: Famille, entreeId: string, mot: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "ajouter un mot au catalogue");
  const resultat = await ajouterMot(ctx, { famille, entreeId, mot });
  return resultat.ok
    ? { ok: true as const, mot: resultat.mot }
    : { ok: false as const, phrase: phraseDuRefus(resultat.refus) };
}

export async function creerEntreeAction(famille: Famille, nom: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "créer une entrée de catalogue");
  const resultat = await creerEntree(ctx, { famille, nom });
  return resultat.ok
    ? { ok: true as const, mot: resultat.mot }
    : { ok: false as const, phrase: phraseDuRefus(resultat.refus) };
}

/**
 * Retire un de SES mots.
 *
 * **Ce geste ne figure pas sur la planche 72, et il est pourtant nécessaire :**
 * un mot mal tapé y resterait pour toujours, et il n'aurait aucun moyen de
 * revenir dessus. Rien n'atteint le vocabulaire commun — seuls ses mots à lui
 * sont dans cette table.
 */
export async function retirerMotAction(id: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "retirer un mot du catalogue");
  return retirerMot(ctx, id);
}
