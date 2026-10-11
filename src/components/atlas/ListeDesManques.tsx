/**
 * Ce qui manque pour que le document parte en règle, chaque ligne avec la porte
 * qui le règle — son choix 1A du 3 octobre 2026.
 *
 * **Un refus nomme sa raison ET le geste qui le débloque** (`CLAUDE.md`) :
 * « il manque votre SIRET » sans lien l'enverrait chercher Réglages à travers
 * trois écrans, au moment précis où il voulait envoyer.
 *
 * La liste vient de `src/lib/mentions-manquantes.ts`, la même règle que le
 * refus du serveur : l'écran ne décide de rien.
 */
import Link from "next/link";
import { colors } from "@/lib/design-tokens";
import type { Manque } from "@/lib/mentions-manquantes";

export default function ListeDesManques({
  manques,
  lienEntreprise,
  lienClient,
}: {
  manques: readonly Manque[];
  lienEntreprise: string;
  lienClient: string;
}) {
  if (manques.length === 0) return null;
  return (
    <ul className="mb-4 flex flex-col" data-atlas="mentions-manquantes">
      {manques.map((m) => (
        <li
          key={m.cle}
          className="flex items-center justify-between gap-3 py-3 text-[15px]"
          style={{ borderTop: `1px solid ${colors.line}`, color: colors.ink }}
        >
          <span>{m.libelle}</span>
          {/* Ce qui se saisit sur la pièce même n'a pas de porte : le champ est
              juste au-dessus. */}
          {m.ou !== "piece" && (
            <Link
              href={m.ou === "entreprise" ? lienEntreprise : lienClient}
              data-atlas={`completer-${m.cle}`}
              className="shrink-0 text-[14px] font-semibold"
              style={{ color: colors.orTexte }}
            >
              Compléter
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
