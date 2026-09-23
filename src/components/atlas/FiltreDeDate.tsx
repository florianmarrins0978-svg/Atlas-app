"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { MOIS_LONGS } from "@/lib/mois";
import { avecLaPortee, jourDeLaRoue, porteeDeLaPeriode, type Portee } from "@/lib/periode";

/**
 * LE FILTRE JOUR, MOIS, ANNÉE — les trois mots de la date se touchent, et le
 * chevron ouvre la roue du téléphone.
 *
 * **SON CHOIX DU 23 SEPTEMBRE 2026, la proposition B de la planche**
 * `appli/retours-la-roue-du-jour.html` : *« l'idée c'est de pouvoir filtrer
 * aussi par mois ou par année ou par jour mois année »*. Le titre porte
 * toujours une date entière — « 23 septembre 2026 » — et **le mot souligné
 * d'or dit ce que la liste embrasse**. On touche « septembre » pour le mois,
 * « 2026 » pour l'année, le quantième pour la seule journée.
 *
 * **Ce que ça remplace, et pourquoi la croix est partie.** Jusque-là un jour
 * choisi se rendait par une croix « tout le mois » : elle ne menait qu'à un
 * cran, elle ne s'annonçait pas, et l'année n'avait aucun chemin. Les trois
 * mots montent et descendent dans les deux sens, sans rien ajouter à l'écran
 * — et surtout **aucun bouton de filtre**, sa consigne du 21 septembre :
 * *« enlève tous tes filtres boutons et garde que celui-là »*.
 *
 * **La roue ne change que la DATE.** Choisir un jour dedans, c'est vouloir ce
 * jour : la portée redescend au jour. Élargir, c'est le travail des mots.
 *
 * **ET LE QUANTIÈME SURVIT À L'ÉLARGISSEMENT.** Vu à l'écran le 23 septembre :
 * posé sur le 11 mars, toucher « mars » réécrivait le titre « 1 mars 2026 » —
 * la période ne portant plus que le mois, le jour était reconstruit, et il
 * tombait sur le 1er. Redescendre rendait alors une journée qu'il n'avait pas
 * demandée. Le filtre retient donc le jour sous le doigt, et ne le recalcule
 * que lorsqu'il sort de la période reçue (une autre adresse, un autre écran).
 *
 * Un seul dessin pour les fiches de sécurité, les retours d'intervention, les
 * rapports envoyés et « Terminés » : ce qui change d'un écran à l'autre, c'est
 * ce qu'on fait de la période choisie (`choisir`), jamais la façon de la
 * choisir. C'est sa demande du 23 septembre 2026 — *« partout dans l'appli où
 * il y a ce filtre, remplace-le par la B »*.
 *
 * **`grand`** n'est là que pour « Terminés », où ce nom dit à lui seul où l'on
 * est dans la page (sa proposition A du 2 septembre 2026, 26 px) ; ailleurs il
 * vit sous un titre d'écran qui le dit déjà.
 *
 * **`enVeille`** sert à « Terminés » quand l'œil ne montre que ce qui attend
 * d'être facturé : la liste ignore alors la période, et un filtre qui répond
 * au doigt sans que rien ne bouge fait croire l'écran cassé.
 */
export default function FiltreDeDate({
  periode,
  choisir,
  enVeille = false,
  grand = false,
}: {
  periode: string;
  choisir: (periode: string) => void;
  enVeille?: boolean;
  grand?: boolean;
}) {
  const [jourRetenu, setJourRetenu] = useState(() => jourDeLaRoue(periode));
  // Dérivé au rendu plutôt que recopié par un effet : un effet repeindrait
  // l'ancien jour une fois avant de se corriger, et cela se voit.
  const jour = jourRetenu.startsWith(periode) ? jourRetenu : jourDeLaRoue(periode);
  const portee = porteeDeLaPeriode(periode);
  const [annee, mois, quantieme] = jour.split("-");

  return (
    <div className="mx-[22px] mt-3 flex items-center justify-center gap-1" data-atlas="periode-choisie">
      <Mot actif={portee === "jour"} portee="jour" enVeille={enVeille} grand={grand} onClick={() => choisir(avecLaPortee(jour, "jour"))}>
        {String(Number(quantieme))}
      </Mot>
      <Mot actif={portee === "mois"} portee="mois" enVeille={enVeille} grand={grand} onClick={() => choisir(avecLaPortee(jour, "mois"))}>
        {MOIS_LONGS[Number(mois) - 1]}
      </Mot>
      <Mot actif={portee === "annee"} portee="annee" enVeille={enVeille} grand={grand} onClick={() => choisir(avecLaPortee(jour, "annee"))}>
        {annee}
      </Mot>
      <RoueDuTelephone
        enVeille={enVeille}
        jour={jour}
        choisir={(j) => {
          setJourRetenu(j);
          choisir(j);
        }}
      />
    </div>
  );
}

/**
 * UN MOT DE LA DATE — celui qui commande est souligné d'or.
 *
 * **44 px de haut, la mesure du pouce.** Trois mots côte à côte sur un écran
 * sale, c'est déjà serré ; les rendre plus courts les rendrait intouchables.
 */
function Mot({
  actif,
  portee,
  enVeille,
  grand,
  onClick,
  children,
}: {
  actif: boolean;
  portee: Portee;
  enVeille: boolean;
  grand: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={enVeille}
      aria-pressed={actif}
      data-atlas={`portee-${portee}`}
      className="flex min-h-11 items-center px-[3px] leading-[1.2]"
      style={{
        fontFamily: font.display,
        fontSize: grand ? 26 : 20,
        color: enVeille ? colors.muted : actif ? colors.orTexte : colors.ink,
        // En veille, plus de trait : il désignerait une portée qui ne commande
        // rien. Le gris dit « ceci dort », le trait dirait « ceci décide ».
        boxShadow: actif && !enVeille ? `inset 0 -2px 0 ${colors.or}` : "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

/**
 * LE CHEVRON QUI OUVRE LA ROUE — le champ le couvre, invisible.
 *
 * `fontSize: 16` : en dessous, iOS agrandit la page à l'ouverture de la roue.
 */
function RoueDuTelephone({
  jour,
  enVeille,
  choisir,
}: {
  jour: string;
  enVeille: boolean;
  choisir: (jour: string) => void;
}) {
  return (
    <label className="relative flex min-h-11 w-8 cursor-pointer items-center justify-center" data-atlas="ouvrir-la-roue">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: enVeille ? colors.line : colors.or }}>
        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <input
        type="date"
        aria-label="Choisir un jour"
        value={jour}
        disabled={enVeille}
        onChange={(e) => {
          if (e.target.value) choisir(e.target.value);
        }}
        className="absolute inset-0 h-full w-full opacity-0"
        style={{ fontSize: 16 }}
      />
    </label>
  );
}

/**
 * UNE DATE ÉCRITE EN TITRE, qui ouvre la roue du téléphone au toucher.
 *
 * Sortie du filtre le 22 septembre 2026, quand le jour du passage de la fiche
 * de chantier a pris la même typographie (*« met la même typographie que
 * septembre 2026 mais rajoute le jour »*) : deux copies du dessin finiraient
 * par ne plus se ressembler.
 */
export function TitreAvecRoue({
  titre,
  jour,
  choisir,
  dataAtlas,
}: {
  titre: string;
  /** Le jour `AAAA-MM-JJ` sur lequel la roue s'ouvre. */
  jour: string;
  choisir: (jour: string) => void;
  dataAtlas: string;
}) {
  return (
    <label className="relative flex min-h-12 cursor-pointer items-center justify-center gap-2" data-atlas={dataAtlas}>
      <span className="text-[20px] leading-[1.2]" style={{ fontFamily: font.display }}>{titre}</span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: colors.or }}><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <input
        type="date"
        aria-label="Choisir un jour"
        value={jour}
        onChange={(e) => {
          if (e.target.value) choisir(e.target.value);
        }}
        className="absolute inset-0 h-full w-full opacity-0"
        style={{ fontSize: 16 }}
      />
    </label>
  );
}
