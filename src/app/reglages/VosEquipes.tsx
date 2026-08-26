"use client";

import { useState } from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { MAX_EQUIPES, phraseDuCompteur } from "@/lib/equipes";
import { mettreAJourNombreEquipesAction } from "./actions";
import CompteurRond from "./CompteurRond";

/**
 * « Chantiers menés en même temps » — la CAPACITÉ du planning, et rien d'autre.
 *
 * *Demandé par le patron le 10 août 2026, arrêté sur maquette
 * (`maquettes/atlas-equipes.html`, `docs/INTEGRER-ORIGINE.md` §6 ter).*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LES NOMS NE SONT PLUS ICI — sa demande du 26 août 2026** (planche 97,
 * réponse **A**) : *« il faut avoir un curseur + ou − qui définit le nombre de
 * salariés que possède l'entreprise et pouvoir affilier des noms […]. Néanmoins
 * les équipes doivent toujours servir à définir le niveau de remplissage du
 * planning : 2 équipes = 2 chantiers par jour, comme avant, ça ne bouge pas. »*
 *
 * Ce compteur ne fait donc plus qu'un métier : dire combien de chantiers
 * tiennent dans une journée. Les gens, et leurs noms, sont dans `VosSalaries`.
 *
 * **Ce que la séparation débloque, et qui était impossible :** quatre salariés
 * pour un seul chantier à la fois. Tant qu'un seul chiffre portait les deux,
 * monter l'effectif ouvrait des journées qu'il ne pouvait pas tenir.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function VosEquipes({
  initialNombreEquipes,
}: {
  initialNombreEquipes: number;
}) {
  const [nombre, setNombre] = useState(initialNombreEquipes);

  async function changerNombre(valeur: number) {
    // Borné ici comme au serveur : à zéro équipe, plus aucun jour ne serait
    // proposable et rien à l'écran ne l'expliquerait.
    const borne = Math.min(MAX_EQUIPES, Math.max(1, valeur));
    if (borne === nombre) return;
    setNombre(borne);
    const r = await mettreAJourNombreEquipesAction(borne);
    setNombre(r.nombreEquipes);
  }

  return (
    <section className="mt-7 px-[26px]">
      {/* **PAS DE FILET À CÔTÉ DE L'INTERTITRE — retiré le 25 août 2026**, à sa
          demande : *« ça aussi tu peux retirer »*, capture de l'écran Équipe à
          l'appui. Il venait de faire retirer le trait sous les titres ; celui-ci
          était de la même famille, et il l'a vu du même œil.

          **Les filets qui SÉPARENT les blocs restent** — *« ceux qui séparent
          les blocs, laisse-les »*. Ne pas les confondre : ceux-là disent que
          deux choses sont distinctes ; celui-ci n'ornait qu'un mot. */}
      <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        Chantiers menés en même temps
      </p>

      <CompteurRond
        valeur={nombre}
        plancher={1}
        plafond={MAX_EQUIPES}
        libelleMoins="Une équipe de moins"
        libellePlus="Une équipe de plus"
        onChanger={changerNombre}
      />

      {/* Une seule phrase, et **le chiffre y bouge avec le compteur** — sa
          dictée du 26 août : *« en dessous en gris marque 2 chantiers par
          jour ; le chiffre bouge en fonction du nombre d'équipes »*. Elle dit
          ce que le réglage PRODUIT, pas comment il s'appelle. */}
      <p className="mt-2 text-center text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
        {phraseDuCompteur(nombre)}
      </p>
    </section>
  );
}
