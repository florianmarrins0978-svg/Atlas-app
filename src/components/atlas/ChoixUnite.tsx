"use client";

import { useState } from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { UNITES_PROPOSEES, normaliserUnite, uniteProposee } from "@/lib/unites-tarif";

/**
 * L'unité d'un tarif, à choisir au lieu de la taper.
 *
 * **En pastilles, dans la ligne ouverte du tarif, depuis le 11 octobre 2026.**
 * La planche validée ce jour-là (`appli/mes-tarifs-corrige.html`, version
 * Corrigé) remplace la case « Choisir… » et son bandeau déroulant, posés le
 * 14 août 2026 (`maquettes/atlas-unite-deroulante.html`, forme 1). Les choix ne
 * changent pas : « Aucune », les unités de `UNITES_PROPOSEES` dans leur ordre,
 * puis la ligne libre. Le pourquoi de la liste est dans
 * `src/lib/unites-tarif.ts` ; ce fichier ne porte que le geste.
 *
 * **Le bandeau devait vivre HORS de la carte** parce que la carte était un
 * `LigneRetirable`, qui masque ce qui dépasse. La ligne ouverte n'en est plus
 * un : les pastilles s'y posent sans être tranchées.
 *
 * **La pastille prise se lit à son contour OR sur fond teinté**, comme la
 * civilité (`ChoixCivilite`) : la planche la peignait en vert pin plein, et un
 * aplat de `rust` est réservé à ce qu'on presse pour agir
 * (`scripts/test-boutons-pleins.ts`). Un choix déjà fait n'en est pas un.
 */
export function PastillesUnite({
  valeur,
  onChoisir,
}: {
  valeur: string | null;
  /** Une chaîne vide efface l'unité : le champ est facultatif. */
  onChoisir: (unite: string) => void;
}) {
  const courante = normaliserUnite(valeur ?? "");

  return (
    <div>
      <span className={`mb-1.5 block ${libelleCaps}`} style={{ color: colors.inkSoft }}>
        Unité
      </span>
      <div
        role="group"
        aria-label="Unité du tarif"
        className="flex flex-wrap gap-2"
        // **Empêcher la prise de focus est ce qui protège la frappe libre.**
        // Sans cela, toucher une pastille fait d'abord perdre le focus au champ
        // du bas : son `onBlur` enregistre l'ancienne saisie, et la course avec
        // le choix décide de l'unité qui reste.
        onPointerDown={(e) => e.preventDefault()}
      >
        {/* Rien ne pouvait DÉ-choisir une unité une fois posée, alors que le
            champ est facultatif — et c'est aussi la seule façon honnête de dire
            « ce tarif est repris tel quel ». */}
        <Pastille libelle="Aucune" prise={courante === ""} onClick={() => onChoisir("")} />
        {UNITES_PROPOSEES.map((u) => (
          <Pastille
            key={u.valeur}
            libelle={u.valeur}
            prise={courante === u.valeur}
            onClick={() => onChoisir(u.valeur)}
          />
        ))}
      </div>

      <ChampLibre
        // Remonté par la clé à chaque unité enregistrée : le champ repart de
        // l'unité posée, et se vide quand une pastille est prise. Sans cela, il
        // garderait « stère » sous une pastille « m² » allumée.
        key={courante}
        // Une unité proposée laisse le champ vide, sinon « Une autre unité »
        // afficherait « m² ».
        depart={uniteProposee(courante) ? "" : courante}
        onValider={onChoisir}
      />
    </div>
  );
}

function Pastille({ libelle, prise, onClick }: { libelle: string; prise: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={prise}
      onClick={onClick}
      // Sous le pouce, sur un chantier : jamais moins de 44 px.
      className="min-h-[44px] rounded-full px-[14px] text-[15px]"
      style={{
        backgroundColor: prise ? colors.rustTint : "transparent",
        color: colors.ink,
        boxShadow: `inset 0 0 0 1px ${prise ? colors.or : colors.line}`,
      }}
    >
      {libelle}
    </button>
  );
}

/** La sortie de secours : écrire la sienne, le stère, l'arbre. */
function ChampLibre({ depart, onValider }: { depart: string; onValider: (unite: string) => void }) {
  const [saisie, setSaisie] = useState(depart);

  return (
    <input
      value={saisie}
      onChange={(e) => setSaisie(e.target.value)}
      onBlur={() => {
        // Ne rien enregistrer s'il n'a rien changé : sortir du champ par
        // mégarde ne doit pas réécrire son unité.
        if (normaliserUnite(saisie) !== normaliserUnite(depart)) onValider(saisie);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onValider(saisie);
        }
      }}
      placeholder="Une autre unité"
      aria-label="Une autre unité"
      autoComplete="off"
      className="mt-2.5 block min-h-[48px] w-full rounded-[10px] border-0 px-[14px] py-3 outline-none"
      style={{ backgroundColor: colors.rustTint, color: colors.ink, fontSize: "16px" }}
    />
  );
}
