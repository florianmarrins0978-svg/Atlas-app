"use client";

import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
import FiltreDeDate from "@/components/atlas/FiltreDeDate";
import { rapportsAMontrer } from "@/lib/passage-entretien";
import { moisEnCours, titreDeLaPeriode } from "@/lib/periode";
import LignePassage, { type PassageListe } from "./LignePassage";

/**
 * « Rapports envoyés », et de quoi les retrouver.
 *
 * **Sa demande du 22 septembre 2026 :** *« faut pouvoir filtrer par nom de
 * client et que ça nous sorte toutes les fiches liées au client, et un filtre
 * par jour mois année »*. Rien d'inventé : le filtre de date est celui des
 * fiches de sécurité et des retours (`FiltreDeDate`), le champ celui de toute
 * l'application (`ChampRecherche`), et la règle suit leur contrat
 * (`rapportsAMontrer`) — le mois en cours à l'ouverture, un nom tapé
 * par-dessus.
 */
export default function RapportsEnvoyes({ rapports }: { rapports: PassageListe[] }) {
  const [periode, setPeriode] = useState(() => moisEnCours());
  const [saisie, setSaisie] = useState("");
  const montres = rapportsAMontrer(rapports, { periode, saisie });

  return (
    <section className="mx-[26px] mt-[28px]" data-atlas="rapports-envoyes">
      <h2 className={smallCaps} style={{ color: colors.muted }}>
        Rapports envoyés
      </h2>

      <FiltreDeDate periode={periode} choisir={setPeriode} />

      <ChampRecherche
        valeur={saisie}
        onChange={setSaisie}
        placeholder="Un nom de client"
        ariaLabel="Chercher un client"
        dataAtlas="chercher-un-rapport"
        className="mt-3"
      />

      {montres.length === 0 ? (
        <p className="mt-7 text-center text-[13.5px] leading-[1.65]" style={{ color: colors.muted }}>
          {saisie.trim()
            ? `Aucun rapport pour « ${saisie.trim()} ».`
            : periode.length === 10
              ? `Aucun rapport envoyé le ${titreDeLaPeriode(periode)}.`
              : `Aucun rapport envoyé en ${titreDeLaPeriode(periode).toLowerCase()}.`}
        </p>
      ) : (
        <div className="mt-[10px]">
          {montres.map((p) => (
            <LignePassage key={p.id} passage={p} />
          ))}
        </div>
      )}
    </section>
  );
}
