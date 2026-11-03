"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import TitreDeCarte from "@/components/atlas/TitreDeCarte";
import { NOM_CONTROLE, phraseDeLEcheance, type Echeance, type RappelVehicule } from "@/lib/vehicules";
import { couleurDuGeste, couleursDuTon, type TonCarte } from "@/lib/ton-des-cartes";
import { marquerRappelVehiculeVuAction } from "./reglages/vehicules/actions";

/**
 * L'échéance dans les familles de l'accueil (sa planche du 23 octobre 2026).
 * Dépassé coûte une amende et un camion immobilisé : rouge. À quinze jours,
 * c'est à lui d'agir : ambre, l'or qu'il avait déjà pour ce moment-là. Deux
 * mois avant, pour mémoire.
 */
const FAMILLE: Record<Echeance["ton"], TonCarte> = { calme: "blanc", proche: "ambre", depasse: "rouge" };

/**
 * Une carte, pour CETTE échéance : la même carte revenue en rouge, ou posée sur
 * une nouvelle date, n'est plus celle qu'il a fait partir.
 */
function cleDuRappel(r: RappelVehicule): string {
  return `${r.vehiculeId}-${r.controle}-${r.avant}`;
}

/**
 * Les rappels des contrôles des véhicules, sur l'accueil du patron — sa
 * demande du 14 octobre 2026 : *« les rappels au bon moment pour les choses
 * importantes »*. Deux mois avant, ambre à quinze jours, rouge une fois dépassé
 * (`echeance`, `src/lib/vehicules.ts`).
 *
 * **« J'ai vu », depuis le 3 novembre 2026.** Ces cartes n'en portaient pas, de
 * peur qu'un contrôle oublié se découvre au bord de la route. Sa réponse, devant
 * celle de l'Amarok : *« c'est bien le rappel, mais j'ai aucun moyen de
 * l'enlever. Il faut qu'il y ait une petite case J'ai vu, je peux cliquer pour
 * l'enlever. »* Rappelé de ce risque, il a choisi : « J'ai vu » fait partir la
 * carte tout de suite ; si le contrôle n'est toujours pas fait à l'échéance,
 * elle revient en rouge, et sans « J'ai vu » cette fois. Elle part alors au
 * procès-verbal ajouté ou à la date tapée. L'écran ne décide de rien : ce qui
 * revient, et ce qui se range, vient du serveur (`rappelsDeLAccueil`,
 * `vuPossible`), qui rejoue la règle au geste (`refusDuVu`).
 *
 * La carte reprend l'allure de celles des notifications, pour qu'il les lise
 * comme une seule pile ; « J'ai vu » est le leur (`CarteAttestation`).
 */
export default function RappelsVehicules({ rappels }: { rappels: RappelVehicule[] }) {
  // Partie de l'écran dès l'appui, sans attendre le serveur : il a fait son
  // geste, la laisser sous ses yeux le ferait douter.
  const [parties, setParties] = useState<string[]>([]);
  /** Ce que le serveur a refusé, sous la carte qui revient : jamais un geste avalé (`AGENTS.md`). */
  const [refus, setRefus] = useState<{ cle: string; message: string } | null>(null);
  const [, demarrer] = useTransition();

  const visibles = rappels.filter((r) => !(r.vuPossible && parties.includes(cleDuRappel(r))));
  if (visibles.length === 0) return null;

  function vu(r: RappelVehicule) {
    const cle = cleDuRappel(r);
    setRefus(null);
    setParties((p) => [...p, cle]);
    demarrer(async () => {
      const reponse = await marquerRappelVehiculeVuAction(r.vehiculeId, r.controle, r.avant);
      if (!reponse.ok) {
        setParties((p) => p.filter((c) => c !== cle));
        setRefus({ cle, message: reponse.raison });
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 px-6">
      {visibles.map((r) => {
        const ton = FAMILLE[r.echeance.ton];
        const couleurs = couleursDuTon(ton);
        const cle = cleDuRappel(r);
        return (
          <div
            key={cle}
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
              {r.vuPossible && (
                <button
                  type="button"
                  data-atlas="j-ai-vu-vehicule"
                  onClick={() => vu(r)}
                  className="inline-flex min-h-[48px] items-center px-2 text-[16px] font-medium"
                  style={{ color: colors.inkSoft }}
                >
                  J’ai vu
                </button>
              )}
            </div>
            {refus?.cle === cle && (
              <p
                data-atlas="refus-vehicule"
                className="mt-3 rounded-lg px-3 py-2 text-[13px]"
                style={{ backgroundColor: colors.rustTint, color: colors.rust }}
              >
                {refus.message}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
