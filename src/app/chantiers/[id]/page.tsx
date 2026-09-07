import { notFound, redirect } from "next/navigation";
import { lienDeReprise } from "@/lib/chantier-etat";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantierPourHub } from "@/server/repositories/chantiers";

// Données réelles, propres à l'entreprise courante : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

/**
 * ─── LA FICHE DU CHANTIER N'EXISTE PLUS — 4 septembre 2026 ──────────────────
 *
 * **Sa décision, prise deux fois.** Le 21 août : *« la fiche chantier, on la
 * supprime pour de bon. »* Puis, le 1er septembre, sa raison : *« toutes ces
 * infos sont déjà sur cette page — on la garde, donc ça fait des doublons si on
 * garde l'autre aussi. »* Ce qu'il refusait n'était pas un écran de trop :
 * c'étaient **deux écrans qui montraient la même chose** — la fiche client
 * porte les photos, la dictée et les coordonnées depuis le 31 août.
 *
 * On lui avait répondu le 31 août qu'elle ne pouvait pas partir : elle portait
 * encore la seule sortie vers la facture. La facture a déménagé sur les
 * chantiers du planning le 4 septembre — son allure C (`ARCHITECTURE.md`
 * §253) —, et cette réponse est devenue périmée le jour même.
 *
 * ─── POURQUOI LA ROUTE SURVIT À L'ÉCRAN ─────────────────────────────────────
 *
 * Huit chemins y menaient, tous redressés. Mais une adresse ne vit pas
 * seulement dans le code : un signet, un lien profond, **une notification déjà
 * partie** la portent encore. Supprimer le dossier rendrait un 404 à quelqu'un
 * qui avait raison de cliquer, et rien ne lui dirait où aller.
 *
 * Ce fichier ne montre donc rien : il **renvoie** là où le travail s'est
 * arrêté, en interrogeant la règle qui sert déjà la liste des chantiers.
 *
 * **`lienDeReprise` NE REND PLUS JAMAIS CETTE ADRESSE, et c'est ce qui rend la
 * redirection possible.** Elle la rendait dans quatre cas — les photos, la
 * dictée, un devis parti sans date, et un chantier planifié par son repli. Les
 * quatre auraient bouclé ici, dont celui du patron. Les corriger était donc
 * l'étape AVANT celle-ci, jamais après (`src/lib/chantier-etat.ts`).
 *
 * **`notFound()` reste, et il n'est pas décoratif** : un chantier d'une autre
 * entreprise rend `null` exactement comme un chantier inexistant — c'est la RLS
 * qui parle, et les deux cas restent indiscernables de l'extérieur.
 */
export default async function ChantierRetireePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantierPourHub(ctx, id);
  if (!chantier) notFound();

  redirect(lienDeReprise(chantier.id, chantier));
}
