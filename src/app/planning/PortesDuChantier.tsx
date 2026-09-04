"use client";

import Link from "next/link";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { portesDuPlanning, type ChantierPourPortes } from "@/lib/portes-du-planning";

/**
 * ─── LA FEUILLE D'UN CHANTIER, AU PLANNING — son allure C ───────────────────
 *
 * **Sa décision du 1er septembre 2026 :** la fiche du chantier disparaît, et ce
 * qu'elle portait encore — la facture, le devis, le client — va sur les
 * chantiers du planning. **Son choix du 4 septembre, sur les trois allures de
 * `appli/facture-au-planning.html` : « je préfère la C »** — rien au repos, le
 * chevron fait monter une feuille.
 *
 * **Ce que les deux autres coûtaient**, mesuré sur la planche et non supposé :
 * A dépliait les trois portes sous chaque chantier et faisait passer deux
 * journées de 374 à 794 px — le vendredi tombait sous le pli d'un écran qui en
 * fait 664. B posait un bouton plein par chantier, y compris sur une facture
 * déjà partie : elle ne se fait pas, elle se consulte.
 *
 * **Le planning ne bouge pas d'un pixel**, et c'est sa consigne du même jour :
 * *« garde le planning tel quel, il est fini. »* La feuille se pose par-dessus ;
 * la ligne du chantier garde son nom, sa durée dorée, son lieu, sa pastille.
 *
 * **La coquille est `BottomSheet`, pas un dessin de plus.** Six écrans montent
 * déjà une feuille avec cette pièce ; un second dessin du même geste se lirait
 * comme une autre fonction (`CLAUDE.md` §3), et la poignée qui referme — sa
 * demande du 13 août — aurait été à recoder.
 *
 * **Ce qui s'affiche vient d'une règle pure** (`portesDuPlanning`) : un écran ne
 * décide de rien. C'est elle qui sait qu'un chantier à venir n'a pas de facture
 * à créer, et qu'une facture partie n'est plus un geste.
 *
 * **Le nom dit « portes » et non « feuille », et ce n'est pas un détail :**
 * `FeuilleDuChantier` existe déjà dans ce dossier — c'est la feuille de travail
 * d'un chantier (ses tâches), rendue par `repositories/devis`. Deux choses sans
 * rapport sous un même nom finissent importées l'une pour l'autre.
 */
export default function PortesDuChantier({
  chantier,
  aujourdHui,
  onFermer,
}: {
  /** Le chantier dont on a touché le chevron — `null` quand rien n'est ouvert. */
  chantier: (ChantierPourPortes & { nom: string }) | null;
  aujourdHui: string;
  onFermer: () => void;
}) {
  if (!chantier) return null;
  const portes = portesDuPlanning(chantier, aujourdHui);

  return (
    <BottomSheet open onBackdropClick={onFermer}>
      {/* Le nom, et rien d'autre : il vient de le toucher, la feuille n'a pas à
          lui réapprendre où il est. Le reste — durée, lieu, équipe — est resté
          visible sur la ligne, derrière. */}
      <p
        data-atlas="feuille-chantier-nom"
        className="px-1 pb-1 text-[17px]"
        style={{ fontFamily: font.display, color: colors.ink }}
      >
        {chantier.nom}
      </p>

      {portes.map((porte) => (
        <Link
          key={porte.cle}
          href={porte.href}
          onClick={onFermer}
          data-atlas={`porte-${porte.cle}`}
          className={
            porte.geste
              ? // **Le seul aplat de la feuille**, et il n'y en a jamais deux :
                // la règle pure garantit au plus un geste. Deux boutons pleins
                // dans une feuille de trois lignes ne diraient plus lequel est
                // attendu.
                "atlas-plein mt-3 block rounded-full py-4 text-center text-[16px] font-medium no-underline"
              : "flex items-center justify-between gap-3 px-1 py-4 text-[15px] no-underline"
          }
          style={
            porte.geste
              ? // `surPlein` et jamais un crème écrit en clair : sur Nuit et
                // Sylve, l'accent EST l'encre (`CLAUDE.md` §3).
                { backgroundColor: colors.plein, color: surPlein }
              : { color: colors.ink, borderTop: `1px solid ${colors.lineSoft}` }
          }
        >
          <span>{porte.libelle}</span>
          {porte.etat && !porte.geste && (
            <span className="text-[13px]" style={{ color: colors.muted }}>
              {porte.etat}
            </span>
          )}
        </Link>
      ))}
    </BottomSheet>
  );
}
