"use client";

import { useState, useTransition } from "react";
import { colors, texteSituation } from "@/lib/design-tokens";
import { charte, type NomCharte } from "@/lib/chartes";
import {
  couleurDApparence,
  ETATS_DU_PLANNING,
  RACCOURCIS_DU_PLANNING,
  type CouleursPlanning,
} from "@/lib/couleurs-planning";
import { MOT_ETAT, type EtatDemi } from "@/lib/planning-jour";
import { Couleur } from "@/components/atlas/Couleur";
import { majCouleurPlanningAction } from "./couleurs-actions";

/**
 * « Couleurs », sous la légende du planning, et la feuille qu'il ouvre.
 *
 * **Sa demande du 29 septembre 2026**, planche `appli/couleurs-du-planning.html`
 * validée (« Parfait ») : le même réglage que les couleurs des devis, un
 * nuancier libre et quatre raccourcis dont le premier est la couleur de
 * l'apparence, enregistré au fur et à mesure. Le mois se repeint sous ses
 * doigts : `onChanger` remonte le choix à l'écran, qui repose ses variables.
 */
export default function CouleursDuPlanning({
  couleurs,
  nomCharte,
  onChanger,
}: {
  couleurs: CouleursPlanning;
  nomCharte: NomCharte | null;
  onChanger: (c: CouleursPlanning) => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const apparence = charte(nomCharte);

  function poser(etat: EtatDemi, v: string) {
    onChanger({ ...couleurs, [etat]: v });
    demarrer(async () => {
      const r = await majCouleurPlanningAction(etat, v);
      setRefus(r.ok ? null : r.raison);
      // On réaffiche ce que la base porte : la couleur de l'apparence y est
      // retombée à vide, et une valeur mal formée n'y est pas entrée.
      if (r.ok) onChanger(r.couleurs);
    });
  }

  return (
    <>
      <button
        type="button"
        data-atlas="ouvrir-couleurs"
        onClick={() => setOuverte(true)}
        className="mx-auto mt-2 block min-h-[44px] border-0 bg-transparent px-3 text-[11px] uppercase"
        style={{ letterSpacing: "0.28em", color: colors.or }}
      >
        Couleurs
      </button>

      {ouverte && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOuverte(false)}
            className="fixed inset-0 z-[29]"
            style={{ background: "rgba(0,0,0,0.32)" }}
          />
          <div
            role="dialog"
            aria-label="Couleurs du planning"
            data-atlas="feuille-couleurs"
            className="atlas-colonne-fixe z-[30] rounded-t-[22px] px-5 pb-5 pt-2.5"
            style={{ bottom: "var(--atlas-barre)", background: colors.cream, borderTop: `2px solid ${colors.or}` }}
          >
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setOuverte(false)}
              className="mx-auto mb-4 block h-[22px] w-[60px] border-0 bg-transparent"
            >
              <span className="mx-auto block h-1 w-10 rounded-full" style={{ background: colors.line }} />
            </button>
            {ETATS_DU_PLANNING.map((etat) => {
              const dApparence = couleurDApparence(etat, apparence);
              return (
                <Couleur
                  key={etat}
                  titre={MOT_ETAT[etat]}
                  valeur={couleurs[etat] ?? dApparence}
                  clef={`planning-${etat}`}
                  rapides={[[dApparence, "Celle d'aujourd'hui"], ...RACCOURCIS_DU_PLANNING[etat]]}
                  onChoisir={(v) => poser(etat, v)}
                />
              );
            })}
            <p className={texteSituation} style={{ color: refus ? colors.bordeaux : colors.inkSoft }}>
              {refus ?? "Enregistré au fur et à mesure."}
            </p>
          </div>
        </>
      )}
    </>
  );
}
