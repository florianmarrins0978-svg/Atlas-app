"use client";

import { useEffect, useRef, useState } from "react";
import { colors } from "@/lib/design-tokens";
import type { PieceDuClient } from "@/lib/documents-du-client";
import PieceDuDossier from "./PieceDuDossier";

/**
 * LE DOSSIER D'UN CLIENT — trois registres, un seul ouvert à la fois.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Retenu par le patron le 2 septembre 2026, sur maquette** — la même qu'il a
 * regardée avant qu'une ligne soit écrite (`CLAUDE.md` §3 bis) : *« c'est très
 * bien, code exactement ce que tu viens de me faire comme maquette »*.
 *
 * **CE QUE ÇA REMPLACE, ET POURQUOI CE N'EST PAS UN CAPRICE.** Sa demande du
 * 20 août posait TROIS COLONNES côte à côte. Sur 390 px, trois colonnes de
 * 118 px laissent ~79 px de texte : « n° 2026-0031 » n'y tient pas, et le
 * dépôt portait déjà un correctif à ce sujet — la vignette avait dû passer
 * AU-DESSUS du numéro et les marges tomber à 16 px pour gagner quelques
 * pixels. On soignait le symptôme.
 *
 * **Ce qui est conservé de sa demande, et c'est l'essentiel :** ses trois
 * catégories, dans son ordre (Devis · Facture · Fiche chantier, arrêté le
 * 20 août au soir), et son tri, du plus récent au plus ancien. Ce qui change
 * est la FORME : un onglet à la fois, et la pièce prend toute la largeur.
 *
 * **Ce que ça coûte, dit franchement :** on ne voit plus les trois catégories
 * d'un seul coup d'œil. Il a été prévenu en ces termes et a tranché.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LES TROIS PANNEAUX SONT TOUS RENDUS**, et un seul est visible. Ce n'est pas
 * une facilité : les suites lisent le dossier entier pour vérifier que chaque
 * registre mène bien à SON genre de document (`test-fiche-client-e2e.ts`), et
 * un panneau démonté à chaque changement d'onglet rejouerait le rendu de ses
 * pièces à chaque appui, sur un écran qu'il ouvre vingt fois par jour.
 *
 * **Le trait d'or GLISSE**, comme celui de la barre du bas — c'est le même
 * mouvement, et le patron l'a déjà retenu en le voyant (« ce G »). Il n'est
 * mesuré qu'après le premier rendu : sans le drapeau `data-pret`, il partirait
 * de zéro et l'on verrait un trait grandir à l'ouverture de l'écran.
 */
/** La même courbe que le marqueur de la barre du bas — ce « G » qu'il a retenu
 *  en le voyant. Le mouvement ne se réinvente pas d'un écran à l'autre. */
const GLISSEMENT =
  "transform 480ms cubic-bezier(0.34,1.4,0.5,1), width 480ms cubic-bezier(0.34,1.4,0.5,1)";

export type Registre = {
  /** Sert d'identifiant d'onglet ; jamais affiché. */
  cle: string;
  /** Ce qui se lit sur l'onglet. */
  libelle: string;
  pieces: PieceDuClient[];
  /**
   * Ce que dit un registre vide — et il DIT pourquoi. « Aucun devis parti »
   * n'est pas « aucune facture émise » : la première se règle en envoyant un
   * devis, la seconde en finissant un chantier. Un registre muet ferait
   * chercher une panne.
   */
  rien: string;
};

export default function RegistresDuDossier({ registres }: { registres: Registre[] }) {
  const [actif, setActif] = useState(0);
  const onglets = useRef<(HTMLButtonElement | null)[]>([]);
  const trait = useRef<HTMLSpanElement>(null);
  const premier = useRef(true);

  useEffect(() => {
    const bouton = onglets.current[actif];
    const barre = trait.current;
    if (!bouton || !barre) return;
    // Le trait fait les deux tiers de son onglet, centré sous le mot : posé
    // sur toute la largeur d'un tiers d'écran, il soulignait du vide.
    barre.style.width = `${Math.round(bouton.offsetWidth * 0.64)}px`;
    barre.style.transform = `translateX(${Math.round(bouton.offsetLeft + bouton.offsetWidth * 0.18)}px)`;
    if (premier.current) {
      // **Le premier placement ne s'anime pas** : il n'y a rien à montrer d'un
      // trait qui rejoint sa place de départ, et on le verrait grandir depuis
      // zéro à chaque ouverture de l'écran.
      //
      // La lecture force le calcul de la mise en page AVANT que la transition
      // soit posée : sans elle, le navigateur regrouperait les deux écritures
      // et animerait quand même.
      void barre.offsetWidth;
      barre.style.transition = GLISSEMENT;
      premier.current = false;
    }
  }, [actif, registres]);

  return (
    <>
      {/* L'air au-dessus des onglets vaut les 42 px de la maquette : les 32 px
          que l'onglet se réserve au-dessus de son mot en font déjà partie. */}
      <div className="px-[22px] pt-4">
        <div
          className="relative flex"
          role="tablist"
          aria-label="Le dossier"
          style={{ boxShadow: `inset 0 -1px 0 ${colors.line}` }}
        >
          {registres.map((r, i) => (
            <button
              key={r.cle}
              ref={(n) => {
                onglets.current[i] = n;
              }}
              type="button"
              role="tab"
              id={`onglet-${r.cle}`}
              aria-selected={i === actif}
              aria-controls={`registre-${r.cle}`}
              data-atlas="registre"
              onClick={() => setActif(i)}
              // **Des mots, plus des petites capitales — 25 octobre 2026**, sur sa
              // planche : 9,5 px espacées étaient le plus petit texte de l'écran
              // pour la seule navigation du dossier. Seize pixels, en bas de
              // casse ; l'onglet ouvert en encre pleine et en gras, les autres en
              // encre douce. Chacun prend une part égale de la largeur.
              //
              // **52 px de haut**, au-delà des 44 du pouce, pour que le trait
              // d'or reste collé sous le mot.
              className="flex min-h-[52px] flex-1 basis-0 items-center justify-center text-[16px]"
              style={{
                color: i === actif ? colors.ink : colors.inkSoft,
                fontWeight: i === actif ? 700 : 600,
                transition: "color 320ms cubic-bezier(0.22,0.61,0.36,1)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {r.libelle}
            </button>
          ))}
          <span
            ref={trait}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 block h-[2px] rounded-[2px]"
            style={{ backgroundColor: colors.or, width: 0, transition: "none" }}
          />
        </div>
      </div>

      {registres.map((r, i) => (
        <div
          key={r.cle}
          id={`registre-${r.cle}`}
          role="tabpanel"
          aria-labelledby={`onglet-${r.cle}`}
          hidden={i !== actif}
          className="px-[22px]"
        >
          {r.pieces.length === 0 ? (
            <p className="py-6 text-center text-[15px] leading-[1.5]" style={{ color: colors.inkSoft }}>
              {r.rien}
            </p>
          ) : (
            r.pieces.map((piece, rang) => <PieceDuDossier key={piece.id} piece={piece} premiere={rang === 0} />)
          )}
        </div>
      ))}
    </>
  );
}
