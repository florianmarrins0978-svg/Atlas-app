"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { MAX_EQUIPES, phraseDuCompteur } from "@/lib/equipes";
import { MOT_ETAT } from "@/lib/planning-jour";
import { fondDeLEtat } from "@/components/atlas/MoisCharge";
import { mettreAJourNombreEquipesAction } from "./actions";
import CompteurRond from "./CompteurRond";

/**
 * « Combien de chantiers par jour ? » — la CAPACITÉ du planning, et rien d'autre.
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
  const phrase = phraseDuCompteur(nombre);

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
      {/* **LE TITRE POSE LA QUESTION — sa réponse A du 8 septembre 2026**, sur
          la planche `appli/deux-compteurs-de-l-equipe.html`.

          **Ce que la capture a montré, et qu'aucune décision ne couvrait :**
          deux compteurs se suivaient, au dessin identique, affichant le même
          chiffre — « 2 » chantiers, « 2 » salariés. L'un dit ce que le planning
          accepte, l'autre qui part sur le chantier, et rien à l'œil ne les
          séparait. Sa décision du 6 septembre visait un autre écran : celui-là
          avait été refait par ses deux demandes du 26 août.

          **En minuscules et en serif, pas en capitales espacées.** Une question
          posée en `libelleCaps` se lit comme une étiquette, pas comme une
          question — et c'est précisément ce qu'on essaie de retirer ici. */}
      <p className="mb-1.5 text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
        Combien de chantiers par jour&nbsp;?
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
          ce que le réglage PRODUIT, pas comment il s'appelle.

          **ET ELLE MONTRE LA COULEUR — sa demande du 31 août 2026** (planche
          99, réponse A) : *« écrit deux chantiers par jour, planning complet,
          et met le petit carré vert foncé avec écrit "complet" du planning »*,
          ici et pas ailleurs — *« c'est sur cette page que doit se faire la
          modification »*.

          **Le carré vient de `fondDeLEtat`, le mot de `MOT_ETAT`** : ce sont
          ceux du calendrier, pas leurs sosies. Un vert écrit en clair ici
          serait illisible sur Nuit et Sylve, et un « complet » recopié
          finirait un jour par ne plus être le mot de la légende.

          **Le carré est décoratif, le mot porte le sens** : `aria-hidden` sur
          l'un, rien sur l'autre — une couleur ne se lit pas à voix haute. */}
      {/* **LE CARRÉ EST PASSÉ APRÈS LE MOT — sa correction du 8 septembre
          2026 :** *« deux chantiers par jour pour un planning complet, et là tu
          mets le carré vert foncé »*. Il fermait la phrase entre le mot et son
          point ; il la ferme maintenant tout court. */}
      <p className="mt-2 text-center text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
        {phrase.avant}{" "}
        <span style={{ color: colors.inkSoft }}>{MOT_ETAT.plein}</span>{" "}
        <span
          data-atlas="carre-complet"
          aria-hidden="true"
          className="inline-block h-[11px] w-[11px] rounded-[3px] align-[-1px]"
          style={{ backgroundColor: fondDeLEtat("plein") }}
        />
        {phrase.apres}
      </p>
    </section>
  );
}
