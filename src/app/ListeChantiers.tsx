"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import { descenteDeLaPerle } from "@/lib/perle-descente";
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
  /**
   * La ligne en clair sous l'état, ou rien : « Envoyé le lundi 10 août. »
   *
   * Sa demande du 13 août 2026, devant la planche des cinq libellés : *« j'aime
   * bien le D, mais en dessous de "devis envoyé" je veux qu'il y ait marqué la
   * date à laquelle on l'a envoyé »*. Elle n'existe que quand un envoi est
   * réellement enregistré — jamais une date approchée (`chantier-etat.ts`).
   */
  precision?: string | null;
  /** Ce chantier attend-il un geste du patron ? Lui seul porte la couleur. */
  attend: boolean;
  /**
   * Où l'on retombe en touchant cette ligne — **l'écran où le travail s'est
   * arrêté**, pas la fiche.
   *
   * Sa demande du 13 août 2026 : *« si je me suis arrêté à l'étape d'envoyer le
   * devis [...] que ça me renvoie à l'étape où je me suis arrêté ».* Le lien
   * est calculé au serveur (`lienDeReprise`) : l'écran ne décide de rien, il
   * suit — même règle partout, et une seule à corriger le jour venu.
   */
  reprise: string;
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
 * **La perle est le seul point de couleur de l'écran**, et elle se tient à
 * mi-hauteur, toujours : elle désigne le chantier qu'on regarde, pas un état.
 * Une couleur qui ne veut rien dire est une couleur en trop — celle-ci veut
 * dire « voici où vous en êtes ».
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
  const perle = useRef<HTMLSpanElement>(null);

  // **La descente sur le dernier jour, et rien d'autre.** Le maintien à
  // mi-hauteur reste du CSS (`position: sticky`) : le navigateur suit le doigt
  // mieux que nous, y compris pendant l'élan. Ce qu'il ne sait pas faire, c'est
  // faire descendre la perle pendant que le contenu monte — le pourquoi est
  // dans `src/lib/perle-descente.ts`. On ne calcule donc que ce supplément, et
  // on le passe au CSS par une variable plutôt qu'en écrivant une position :
  // si ce code ne tourne pas, la perle reste au milieu, ce qui est encore juste.
  useEffect(() => {
    const point = perle.current;
    const cadre = point?.closest<HTMLElement>(".atlas-fil-defile");
    const tige = point?.parentElement;
    if (!point || !cadre || !tige) return;

    let prevu = 0;
    const placer = () => {
      prevu = 0;
      // La DERNIÈRE ligne encore debout : une ligne retirée se referme à zéro
      // de hauteur avant de disparaître, et viser celle-là ferait plonger la
      // perle sur un chantier qui n'existe plus.
      const lignes = [...tige.querySelectorAll<HTMLElement>(".atlas-ligne")].filter(
        (l) => l.offsetHeight > 0,
      );
      const derniere = lignes[lignes.length - 1];
      if (!derniere) return;
      const boite = cadre.getBoundingClientRect();
      const descente = descenteDeLaPerle({
        milieuDuDernier: derniere.getBoundingClientRect().top + derniere.offsetHeight / 2,
        milieuDuCadre: boite.top + boite.height / 2,
        restantADefiler: cadre.scrollHeight - cadre.clientHeight - cadre.scrollTop,
        // Tout le chemin possible, et pas seulement ce qui reste : sans lui, la
        // plongée démarrait avant le départ sur une liste qui défile à peine.
        hauteurADefiler: cadre.scrollHeight - cadre.clientHeight,
      });
      point.style.setProperty("--atlas-perle-descente", `${Math.round(descente)}px`);
    };

    // Une image par image, jamais plus : le défilement tire des dizaines
    // d'événements par seconde, et mesurer à chacun ferait saccader ce qu'on
    // essaie de rendre fluide.
    const auGeste = () => {
      if (prevu) return;
      prevu = requestAnimationFrame(placer);
    };

    placer();
    cadre.addEventListener("scroll", auGeste, { passive: true });
    window.addEventListener("resize", auGeste);
    // La liste change de hauteur sans que rien ne défile : une ligne retirée se
    // referme, un bandeau tombe, le clavier du téléphone s'ouvre. Sans cela, la
    // perle garderait la descente calculée pour la liste d'avant.
    const veille = new ResizeObserver(auGeste);
    veille.observe(tige);
    veille.observe(cadre);

    return () => {
      if (prevu) cancelAnimationFrame(prevu);
      cadre.removeEventListener("scroll", auGeste);
      window.removeEventListener("resize", auGeste);
      veille.disconnect();
    };
  }, [chantiers]);

  return (
    <div className="atlas-tige mx-[26px]">
      {/* **LA PERLE SUIT LE DOIGT — elle ne désigne plus le chantier qui
          attend.** C'est la version que le patron a retenue sur maquette, et
          l'application avait gardé l'ancienne intention : la perle était posée
          devant le premier chantier en attente, si bien qu'elle apparaissait
          n'importe où — tout en bas de l'écran chez lui, le 11 août 2026, parce
          que c'est là que se trouvait le chantier à corriger.

          Un repère qui change de place à chaque liste ne s'apprend pas. Celui-ci
          est à mi-hauteur : ce qu'il montre, c'est le chantier qu'on regarde.
          Posée en PREMIER enfant du fil, sa position naturelle est le haut —
          au-dessus du point d'accroche — si bien que `sticky` la descend à
          mi-hauteur dès le premier pixel, et l'y maintient.

          **Une seule exception, demandée par le patron :** sur les derniers
          pixels de défilement, elle quitte le milieu et plonge sur le dernier
          jour. C'est la seule chose que `sticky` ne sache pas faire, et c'est le
          rôle de la variable `--atlas-perle-descente` posée plus haut.

          Ce que cela coûte, dit franchement : le chantier dont le devis est
          revenu n'a plus de point de couleur. Il garde son libellé en bronze
          (« Correction demandée »), et c'est le compromis assumé de la maquette
          (`docs/INTEGRER-ORIGINE.md` §3).

          Un fragment, jamais un `div` : la perle doit être fille DIRECTE du
          fil. Enfermée dans un conteneur d'une ligne de haut, elle ne pourrait
          s'accrocher que sur cette ligne-là. */}
      <span className="atlas-perle" aria-hidden="true" ref={perle}>
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
      {chantiers.map((c) => (
        <LigneRetirable
          key={c.id}
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
          <Link href={c.reprise} className="atlas-brin block">
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
            {c.precision && (
              /* En clair, et non en petites capitales : deux lignes espacées
                 à 0.28em se liraient comme un pavé. L'œil doit accrocher
                 l'état, puis lire la date s'il la cherche. */
              <p className="mt-[4px] truncate text-[11.5px]" style={{ color: colors.muted }}>
                {c.precision}
              </p>
            )}
          </Link>
        </LigneRetirable>
      ))}
    </div>
  );
}
