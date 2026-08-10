"use client";

import { Fragment } from "react";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import { chantierQuiPorteLaPerle } from "@/lib/perle-attente";
import LigneRetirable from "@/components/atlas/LigneRetirable";

/**
 * La date et le fil, à gauche — ce qui ne glisse pas.
 *
 * Séparé du corps de la ligne parce que c'est exactement la distinction que le
 * geste demande : la colonne de gauche est un repère, elle ne bouge pas.
 */
export function JourDuBrin({ jour, mois }: { jour: string; mois: string }) {
  return (
    <>
      {/* Le fil, dessiné ligne par ligne. Posé une seule fois SOUS la liste, il
          disparaissait derrière la couche qui glissait. Bout à bout, les
          segments n'en font qu'un — et depuis que seul le texte glisse, plus
          rien ne passe devant lui. */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 top-0 w-px"
        style={{ left: 47, backgroundColor: colors.line }}
      />
      <span
        className="row-span-3 pr-[13px] text-right text-[9.5px] font-medium uppercase"
        style={{ color: colors.muted, letterSpacing: "0.28em", fontVariantNumeric: "tabular-nums" }}
      >
        <b className="block text-[19px] font-normal leading-none" style={{ color: colors.ink, fontFamily: font.display }}>
          {jour}
        </b>
        <span className="mt-1 block">{mois}</span>
      </span>
    </>
  );
}

export type BrinChantier = {
  id: string;
  /** Le nom affiché — sert aussi au libellé de retrait. */
  nom: string;
  /** Le quantième, sur deux chiffres : « 26 ». */
  jour: string;
  /** Le mois abrégé, sous le quantième : « juil. ». */
  mois: string;
  lieu: string;
  /** L'état et le nombre de photos, sur une ligne : « Brouillon · 3 photos ». */
  etat: string;
  /** Ce chantier attend-il un geste du patron ? Lui seul porte la couleur. */
  attend: boolean;
  /**
   * Compte-t-il dans « Huit en cours » ? Tous les chantiers de la liste n'y
   * entrent pas — un chantier au planning s'affiche sans être compté. Sans ce
   * drapeau, le décompte ne pourrait pas suivre un retrait sans redemander la
   * page au serveur, et il resterait faux le temps du tiroir.
   */
  enCours: boolean;
  /**
   * Présent, ce chantier refuse d'être retiré et le glissement découvre ce
   * motif. Un chantier facturé est le seul cas : sa facture figure au relevé de
   * TVA. Il ne devrait pas apparaître ici — il vit sous « Terminés » — mais le
   * refus est porté par la donnée plutôt que par l'écran, pour qu'il tienne
   * partout où la liste sera reprise.
   */
  refusRetrait?: string;
};

/**
 * La liste des chantiers, posée sur un fil — et le geste qui en retire un.
 *
 * **Le fil, retenu par le patron le 10 août 2026.** Plus aucune carte : un
 * trait vertical traverse la liste et porte les jours, comme une tige. Une
 * liste de chantiers n'est pas un tableau de bord ; ce qui doit se voir, c'est
 * la suite des jours, pas le contenant.
 *
 * **La perle est le seul point de couleur de l'écran**, et elle ne se pose que
 * sur le PREMIER chantier qui attend une réponse. Une couleur qui ne veut rien
 * dire est une couleur en trop : c'est la règle de charte née de la maquette 12
 * et elle vaut partout ailleurs.
 *
 * **Le retrait a changé de mécanique le 10 août 2026, au soir.** La corbeille
 * rouge qui se découvrait sous la carte a cédé la place au geste retenu : le
 * texte glisse, « Retirer » se découvre, la ligne tombe, et un tiroir la
 * retient en bas de l'écran. Ce qui n'a pas changé : le glissement reste le
 * geste, et la ligne reste un LIEN — ouvrir un chantier est ce qu'on fait cent
 * fois par jour, contre un retrait de temps en temps.
 *
 * Cet écran ne décide de rien du retrait : il dit quelles lignes sont retirées
 * et laisse `EcranChantiers` tenir le tiroir, parce que le tiroir appartient à
 * l'écran entier et non à la liste.
 */
export default function ListeChantiers({
  chantiers,
  estRetire,
  onRetirer,
}: {
  chantiers: BrinChantier[];
  estRetire: (id: string) => boolean;
  onRetirer: (id: string, libelle: string) => void;
}) {
  // La règle vit dans une fonction pure : elle se casse sur des listes que le
  // banc ne contient pas (aucune attente, plusieurs, la dernière), et aucune de
  // ces situations ne s'atteint en cliquant.
  //
  // Elle ne voit que ce qui RESTE : la perle posée devant une ligne en train de
  // tomber descendrait avec elle, puis sauterait.
  const visibles = chantiers.filter((c) => !estRetire(c.id));
  const premierEnAttente = chantierQuiPorteLaPerle(visibles);

  return (
    <div className="atlas-tige mx-[26px]">
      {chantiers.map((c) => (
        // Un fragment, jamais un `div` : la perle doit être fille DIRECTE du
        // fil. Collée dans un conteneur d'une ligne de haut, elle ne peut
        // s'accrocher que sur cette ligne-là — elle passerait sans jamais
        // s'arrêter à mi-hauteur.
        <Fragment key={c.id}>
          {c.id === premierEnAttente && (
            <span className="atlas-perle" aria-hidden="true">
              <span
                className="absolute block h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: 47,
                  top: 23,
                  backgroundColor: colors.or,
                  boxShadow: `0 0 0 4px ${colors.cream}`,
                }}
              />
            </span>
          )}
          <LigneRetirable
            libelle={`le chantier ${c.nom}`}
            retiree={estRetire(c.id)}
            onRetirer={() => onRetirer(c.id, `le chantier ${c.nom}`)}
            refus={c.refusRetrait}
            avant={<JourDuBrin jour={c.jour} mois={c.mois} />}
            className="relative grid grid-cols-[47px_1fr] gap-x-[26px] py-[17px]"
          >
            {/* Ce qui glisse : le nom, le lieu, l'état. Le fil et la date
                restent en place — une ligne qui part d'un bloc coupe le nom en
                plein mot et laisse le fil traverser les lettres. */}
            <Link href={`/chantiers/${c.id}`} className="atlas-brin block">
              <h2 className="truncate text-[19px] font-normal leading-[1.15]" style={{ fontFamily: font.display }}>
                {c.nom}
              </h2>
              <p className="mt-[3px] truncate text-[11.5px]" style={{ color: colors.muted }}>
                {c.lieu}
              </p>
              <p
                className="mt-[7px] text-[9.5px] font-medium uppercase"
                style={{ color: c.attend ? colors.or : colors.muted, letterSpacing: "0.28em" }}
              >
                {c.etat}
              </p>
            </Link>
          </LigneRetirable>
        </Fragment>
      ))}
    </div>
  );
}
