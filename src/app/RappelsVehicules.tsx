import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { NOM_CONTROLE, phraseDeLEcheance, type Echeance, type RappelVehicule } from "@/lib/vehicules";

const TEINTE: Record<Echeance["ton"], string> = { calme: colors.muted, proche: colors.or, depasse: colors.alert };

/**
 * Les rappels des contrôles des véhicules, sur l'accueil du patron — sa
 * demande du 14 octobre 2026 : *« les rappels au bon moment pour les choses
 * importantes »*. Deux mois avant, doré à quinze jours, rouge une fois dépassé
 * (`echeance`, `src/lib/vehicules.ts`).
 *
 * **Pas de « J'ai vu »**, et c'est voulu : un contrôle technique oublié se découvre au
 * bord de la route, sur un camion immobilisé. La carte s'en va quand le nouveau
 * procès-verbal est ajouté, ou la nouvelle date tapée — c'est-à-dire quand la
 * situation a vraiment changé.
 *
 * La carte reprend l'allure de celles des notifications, pour qu'il les lise
 * comme une seule pile.
 */
export default function RappelsVehicules({ rappels }: { rappels: RappelVehicule[] }) {
  if (rappels.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-3 px-6">
      {rappels.map((r) => {
        const urgent = r.echeance.ton !== "calme";
        return (
          <div
            key={`${r.vehiculeId}-${r.controle}`}
            data-atlas="rappel-vehicule"
            data-atlas-ton={r.echeance.ton}
            className="rounded-[18px] px-5 py-4"
            style={{ backgroundColor: urgent ? colors.rustTint : colors.card }}
          >
            <p className={smallCaps} style={{ color: urgent ? colors.rust : colors.muted, marginBottom: 6 }}>
              {NOM_CONTROLE[r.controle]}
            </p>
            <p className="text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
              {r.vehiculeNom}
            </p>
            <p
              className="mt-1 text-[13px]"
              style={{ color: TEINTE[r.echeance.ton], fontWeight: r.echeance.ton === "depasse" ? 600 : 400 }}
            >
              {phraseDeLEcheance(r)}
            </p>
            <div className="-mx-2 mt-2 flex items-center gap-2">
              <Link
                href={`/reglages/vehicules/${r.vehiculeId}?ajouter=controle_technique`}
                className="inline-flex min-h-[44px] items-center px-2 text-[14px] font-medium"
                style={{ color: colors.rust }}
              >
                Ajouter le procès‑verbal
              </Link>
              <Link
                href={`/reglages/vehicules/${r.vehiculeId}`}
                className="inline-flex min-h-[44px] items-center px-2 text-[14px]"
                style={{ color: colors.inkSoft }}
              >
                Taper la date
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
