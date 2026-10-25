import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import TitreDeCarte from "@/components/atlas/TitreDeCarte";
import { NOM_CONTROLE, phraseDeLEcheance, type Echeance, type RappelVehicule } from "@/lib/vehicules";
import { couleurDuGeste, couleursDuTon, type TonCarte } from "@/lib/ton-des-cartes";

/**
 * L'échéance dans les familles de l'accueil (sa planche du 23 octobre 2026).
 * Dépassé coûte une amende et un camion immobilisé : rouge. À quinze jours,
 * c'est à lui d'agir : ambre, l'or qu'il avait déjà pour ce moment-là. Deux
 * mois avant, pour mémoire.
 */
const FAMILLE: Record<Echeance["ton"], TonCarte> = { calme: "blanc", proche: "ambre", depasse: "rouge" };

/**
 * Les rappels des contrôles des véhicules, sur l'accueil du patron — sa
 * demande du 14 octobre 2026 : *« les rappels au bon moment pour les choses
 * importantes »*. Deux mois avant, ambre à quinze jours, rouge une fois dépassé
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
        const ton = FAMILLE[r.echeance.ton];
        const couleurs = couleursDuTon(ton);
        return (
          <div
            key={`${r.vehiculeId}-${r.controle}`}
            data-atlas="rappel-vehicule"
            data-atlas-ton={ton}
            className="rounded-[18px] px-5 pb-1 pt-3.5"
            style={{ backgroundColor: couleurs.fond }}
          >
            <TitreDeCarte ton={ton}>{NOM_CONTROLE[r.controle]}</TitreDeCarte>
            <p className="mt-1 text-[20px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
              {r.vehiculeNom}
            </p>
            <p
              className="mt-1 text-[15px] leading-[1.45]"
              style={{ color: couleurs.texte, fontWeight: r.echeance.ton === "depasse" ? 600 : 400 }}
            >
              {phraseDeLEcheance(r)}
            </p>
            <div className="-mx-2 mt-1 flex flex-wrap items-center gap-x-3">
              <Link
                href={`/reglages/vehicules/${r.vehiculeId}?ajouter=controle_technique`}
                className="inline-flex min-h-[48px] items-center px-2 text-[16px] font-bold"
                style={{ color: couleurDuGeste(ton) }}
              >
                Ajouter le procès‑verbal
              </Link>
              <Link
                href={`/reglages/vehicules/${r.vehiculeId}`}
                className="inline-flex min-h-[48px] items-center px-2 text-[16px] font-medium"
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
