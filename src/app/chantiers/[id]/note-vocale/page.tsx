import { notFound, redirect } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { garderLaPage } from "@/server/garde-page";

// Données réelles, propres à l'entreprise courante : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

/**
 * ─── L'ÉCRAN NOTE VOCALE N'EXISTE PLUS — 3 novembre 2026 ────────────────────
 *
 * **Son accord, le jour où il a choisi « Réessayer » sur la planche « Le
 * chantier »** (`appli/soignee/chantier.html?ecran=note`). Deux enregistreurs
 * vivaient pour une même note : l'anneau de la fiche client, qu'il emploie, et
 * cet écran, que seuls des liens de secours ouvraient encore. Le dernier geste
 * qui manquait à la fiche, reprendre une dictée qui a échoué, y est codé
 * (`DevisDepuisDictee`, « Réessayer ») ; « Reprendre, j'avais oublié quelque
 * chose » vit sur le devis, au micro du haut (`DicterDansLeDevis`) ; et
 * « Ajouter un fichier audio » part avec l'écran, avec son accord. La
 * réécoute de la note part aussi : elle n'existait qu'ici.
 *
 * **L'adresse survit, comme celle de la fiche du chantier** (`../page.tsx`) :
 * un signet ou un lien déjà parti la porte encore, et un 404 punirait celui
 * qui avait raison de cliquer. Elle renvoie donc là où l'on dicte.
 *
 * **`notFound()` n'est pas décoratif** : un chantier d'une autre entreprise
 * rend `null` exactement comme un chantier inexistant (c'est la RLS qui parle),
 * et les deux restent indiscernables de l'extérieur.
 */
export default async function NoteVocaleRetireePage({ params }: { params: Promise<{ id: string }> }) {
  await garderLaPage();
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  redirect(`/chantiers/${chantier.id}/coordonnees`);
}
