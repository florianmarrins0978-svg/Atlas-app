"use client";

import { colors } from "@/lib/design-tokens";
import { quantiteDeLigne, type Groupe, type Ligne } from "@/lib/arrosage/postes";

/**
 * LA LISTE : la nourrice, puis chaque réseau — *« en premier la nourrice avec la
 * liste des pièces, ensuite réseau 1, la liste des pièces, réseau 2… »*
 * (18 octobre 2026). Pas de gras dans une liste de pièces (21 août) : chaque
 * ligne compte autant que la suivante.
 *
 * **« Modifier ma liste »** : chaque ligne se supprime (elle reste, barrée, avec
 * « Remettre »), une ligne de plusieurs au nombre choisi (elle reste, avec « k en
 * moins »), et chaque groupe reçoit « Ajouter une pièce ».
 */
export default function ListeDesPieces({
  groupes,
  modifier,
  onRetirer,
  onRemettre,
  onAjouter,
}: {
  groupes: Groupe[];
  modifier: boolean;
  onRetirer: (titre: string, ref: string, ligne: Ligne) => void;
  onRemettre: (titre: string, ref: string) => void;
  onAjouter: (titre: string) => void;
}) {
  return (
    <div data-atlas="liste-des-pieces">
      {groupes.map((g) => (
        <div key={g.titre} data-atlas="groupe" data-titre={g.titre}>
          <p className="mb-0 mt-4 flex items-center gap-2 text-[14px] font-semibold">
            {g.couleur && <span className="block h-[10px] w-[10px] flex-none rounded-[3px]" style={{ backgroundColor: g.couleur }} />}
            {g.titre}
          </p>
          <div className="mt-2 rounded-[12px] px-[14px] py-[2px]" style={{ backgroundColor: colors.card }}>
            {Object.entries(g.lignes).map(([ref, e], i) => (
              <LigneDeListe key={ref} e={e} premiere={i === 0} otee={false} modifier={modifier} onRetirer={() => onRetirer(g.titre, ref, e)} onRemettre={() => onRemettre(g.titre, ref)} />
            ))}
            {modifier &&
              Object.entries(g.retirees).map(([ref, e]) => (
                <LigneDeListe key={`otee-${ref}`} e={e} premiere={false} otee modifier onRetirer={() => undefined} onRemettre={() => onRemettre(g.titre, ref)} />
              ))}
            {modifier && (
              <button
                type="button"
                onClick={() => onAjouter(g.titre)}
                className="mb-2 mt-1.5 block min-h-[40px] w-full rounded-full bg-transparent text-[14px]"
                style={{ border: `1.5px dashed ${colors.line}`, color: colors.ink }}
              >
                Ajouter une pièce
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LigneDeListe({ e, premiere, otee, modifier, onRetirer, onRemettre }: { e: Ligne; premiere: boolean; otee: boolean; modifier: boolean; onRetirer: () => void; onRemettre: () => void }) {
  const barre = otee ? { color: colors.muted, textDecoration: "line-through" } : undefined;
  return (
    <div className="flex items-baseline gap-3 py-[9px] text-[14px]" style={premiere ? undefined : { borderTop: `1px solid ${colors.line}` }} data-atlas="ligne" data-otee={otee || undefined}>
      <span className="w-[58px] flex-none font-semibold tabular-nums" style={{ color: otee ? colors.muted : colors.orTexte, ...barre }}>
        {quantiteDeLigne(e)}
      </span>
      <span className="min-w-0 flex-1" style={barre}>
        {e.nom}
        {e.enMoins ? `, ${e.enMoins} en moins` : ""}
      </span>
      {modifier && (otee || e.enMoins) && (
        <button type="button" onClick={onRemettre} className="flex-none border-0 bg-transparent pl-1.5 text-[13px] underline" style={{ color: colors.ink }}>
          Remettre
        </button>
      )}
      {modifier && !otee && (
        <button type="button" onClick={onRetirer} className="flex-none border-0 bg-transparent pl-1.5 text-[13px] underline" style={{ color: colors.alert }}>
          Supprimer
        </button>
      )}
    </div>
  );
}
