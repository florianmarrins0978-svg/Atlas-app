import { notFound } from "next/navigation";

/**
 * LES MAQUETTES `/design/*` N'EXISTENT PAS EN PRODUCTION — constat F12.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE C'EST, ET CE QUE CE N'EST PAS.**
 *
 * Ce n'est pas une fuite de données : ces douze pages ne lisent aucune base,
 * elles affichent `src/lib/mock-data.ts` — un chantier inventé, « Rénovation
 * salle de bain ». Le middleware exige déjà une session pour les atteindre
 * (`src/middleware.ts` : tout ce qui n'est pas dans `chemins-publics.ts` est
 * fermé). Le dire compte : une alerte qui exagère s'apprend à être ignorée.
 *
 * Ce qu'on retire, c'est de la SURFACE. Ces pages sont **gelées** depuis le
 * 1er août 2026 — découplées du produit, plus personne ne les relit, et elles
 * ne suivent plus les corrections apportées aux écrans réels. Une page que
 * personne ne relit est exactement celle qui portera le prochain défaut, et
 * elle n'a aucune raison d'être servie à un artisan.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI UNE MISE EN PAGE, ET NON DOUZE GARDES.**
 *
 * Douze gardes recopiées, c'est douze occasions d'en oublier une — et la
 * treizième page, écrite dans six mois, n'en aurait aucune. Ici la propriété
 * tient par construction : tout ce qui vit sous `src/app/design/` passe par ce
 * fichier, aujourd'hui comme demain.
 *
 * **`notFound()` plutôt qu'un refus.** Une page qui répond « accès refusé »
 * confirme qu'elle existe. Celle-ci n'a rien à confirmer : en production, elle
 * n'existe pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LE BANC D'ESSAI EST TRAITÉ COMME LA PRODUCTION, ET C'EST DÉLIBÉRÉ.**
 *
 * Ailleurs dans ce dépôt, un banc est distingué d'une production (`profil-banc.ts`,
 * `horsProductionReelle()`) parce qu'il sert une version bâtie et répond
 * pourtant `production` à son `NODE_ENV`. Ici, on ne fait PAS l'exception :
 * le banc du patron est ouvert sur l'internet — le 6 août 2026, ses parents s'y
 * sont connectés —, et rien ne s'y regarde qui justifierait d'y servir des
 * maquettes gelées. Les planches qu'il doit voir vivent dans `appli/`, publiées
 * par `pages.yml` (`CLAUDE.md` §3 bis).
 *
 * Ce qui continue de fonctionner : `next dev`, donc les captures d'écran
 * (`scripts/screenshot-*.mjs`, `screenshots-design-directions.mjs`) et la
 * batterie navigateur, qui démarre son serveur en mode développement.
 */
export default function MaquettesLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
