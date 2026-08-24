"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import {
  brouillonVierge,
  cocherLigne,
  figerPassage,
  majPassage,
  nommerClient,
  ouvrirPassage,
  supprimerPassage,
} from "@/server/repositories/passages-entretien";
import { PHRASE_REFUS_PASSAGE, type LignePassage } from "@/lib/passage-entretien";

/** Une ligne telle que l'écran l'affiche — la règle pure, plus son identifiant. */
type LignePassageAffichee = LignePassage & { id: string };

// Les gestes de la fiche de chantier.
//
// **Les refus se RENDENT, ils ne lèvent jamais** (`HANDOVER.md`, piège 0 ter) :
// l'exception d'une action serveur n'arrive pas jusqu'au patron — Next.js la
// remplace en production par un identifiant opaque, et son banc sert une
// version bâtie. Une action qui lèverait lui donnerait « Une erreur est
// survenue » sur un chantier, et rien d'autre.
//
// **Pas de garde « propriétaire » ici, contrairement aux réglages** — et c'est
// délibéré : la fiche est ce que remplit CELUI QUI EST SUR LE CHANTIER. Le
// modèle, lui, reste réservé au propriétaire : il commande tous les chantiers.

export type Resultat = { ok: true } | { ok: false; phrase: string };

/**
 * Ouvre une fiche — ou **rouvre celle du jour que personne n'a touchée**.
 *
 * La reprise n'est pas une commodité : sans elle, deux appuis sur « Ouvrir »
 * laisseraient deux fiches identiques, et il cocherait la moitié de chaque sans
 * savoir laquelle envoyer.
 *
 * **Mais elle ne vaut que pour une fiche VIERGE**, et c'est la seule chose à
 * retenir ici : il fait quatre ou cinq jardins dans une journée. Rendre « la
 * fiche du jour » lui rendrait celle du jardin précédent — client nommé, cases
 * cochées. Le détail est sur `brouillonVierge`.
 */
export async function ouvrirFicheAction(jour: string): Promise<Resultat> {
  const ctx = await getCurrentCtx();

  const enCours = await brouillonVierge(ctx, jour);
  if (enCours) redirect(`/paysage/fiche/${enCours}`);

  const r = await ouvrirPassage(ctx, jour);
  if (!r.ok) return { ok: false, phrase: PHRASE_REFUS_PASSAGE[r.refus] };
  revalidatePath("/paysage/fiche");
  redirect(`/paysage/fiche/${r.id}`);
}

export async function cocherLigneAction(
  passageId: string,
  ligneId: string,
  faite: boolean
): Promise<Resultat> {
  const ctx = await getCurrentCtx();
  const r = await cocherLigne(ctx, passageId, ligneId, faite);
  if (!r.ok) return { ok: false, phrase: PHRASE_REFUS_PASSAGE[r.refus] };
  return { ok: true };
}

export async function majPassageAction(
  passageId: string,
  champs: { minutes?: number | null; tempsVisible?: boolean; observations?: string | null }
): Promise<Resultat> {
  const ctx = await getCurrentCtx();
  const r = await majPassage(ctx, passageId, champs);
  if (!r.ok) return { ok: false, phrase: PHRASE_REFUS_PASSAGE[r.refus] };
  return { ok: true };
}

/**
 * Nomme le client — le pont demandé le 17 août.
 *
 * **Rend les lignes qui restent**, et pas un simple `ok` : la fiche se replie,
 * et l'écran doit montrer le résultat sans recharger. Le lui faire recalculer
 * de son côté donnerait deux vérités sur ce qui est à l'écran.
 */
export async function nommerClientAction(
  passageId: string,
  clientId: string
): Promise<
  | { ok: true; retirees: number; lignes: LignePassageAffichee[] }
  | { ok: false; phrase: string }
> {
  const ctx = await getCurrentCtx();
  const r = await nommerClient(ctx, passageId, clientId);
  if (!r.ok) return { ok: false, phrase: PHRASE_REFUS_PASSAGE[r.refus] };
  revalidatePath(`/paysage/fiche/${passageId}`);
  return { ok: true, retirees: r.retirees, lignes: r.lignes };
}

/**
 * Supprime une fiche en cours.
 *
 * **Sa demande du 24 août 2026** : *« Je ne peux pas supprimer les fiches en
 * cours. Il faut pouvoir les supprimer. »*
 *
 * **Appelée à la FERMETURE du tiroir, pas au geste** (`useRetraits`, sa règle
 * du 10 août) : tant qu'« Annuler » est à l'écran, rien n'est écrit. Une
 * suppression écrite au moment de l'appui rendrait ce bouton menteur — et une
 * annulation qui ne rend rien est pire que pas d'annulation.
 */
export async function supprimerFicheAction(passageId: string): Promise<Resultat> {
  const ctx = await getCurrentCtx();
  const r = await supprimerPassage(ctx, passageId);
  if (!r.ok) return { ok: false, phrase: PHRASE_REFUS_PASSAGE[r.refus] };
  revalidatePath("/paysage/fiche");
  return { ok: true };
}

/**
 * Fige le rapport et rend son adresse publique.
 *
 * **N'envoie rien** : le message part de SA messagerie et de SON numéro — sa
 * décision du 3 août (`docs/A-FAIRE.md` §5). L'écran ouvre ensuite le SMS ou
 * le courriel avec le lien que cette action vient de créer.
 */
export async function envoyerFicheAction(
  passageId: string
): Promise<{ ok: true; lien: string } | { ok: false; phrase: string }> {
  const ctx = await getCurrentCtx();
  const r = await figerPassage(ctx, passageId);
  if (!r.ok) return { ok: false, phrase: r.phrase };
  revalidatePath("/paysage/fiche");
  return { ok: true, lien: `/entretien/${r.jeton}` };
}
