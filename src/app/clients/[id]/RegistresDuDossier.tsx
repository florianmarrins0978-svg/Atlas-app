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
    barre.style.width = `${bouton.offsetWidth}px`;
    barre.style.transform = `translateX(${bouton.offsetLeft}px)`;
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
      <div className="px-[26px] pt-[10px]">
        <div className="relative flex gap-[26px]" role="tablist" aria-label="Le dossier">
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
              // 9,5 px et 0,28 em : la voix des libellés (`libelleCaps`), la
              // même que « En cours » sur l'accueil.
              //
              // **44 px de haut, et le mot posé EN BAS.** Le libellé mesure une
              // douzaine de pixels : un onglet à sa taille faisait 24 px de
              // cible, et la suite l'a refusé avant lui — « on les rate au
              // doigt ». La hauteur est prise au-dessus du mot, si bien que le
              // trait d'or reste collé sous lui.
              className="flex min-h-[44px] items-end pb-3 text-[9.5px] font-medium uppercase"
              style={{
                color: i === actif ? colors.ink : colors.muted,
                letterSpacing: "0.28em",
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
            className="pointer-events-none absolute bottom-0 left-0 block h-[1.5px]"
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
          className="px-[26px]"
        >
          {r.pieces.length === 0 ? (
            <p className="pt-5 text-[13px] leading-[1.5]" style={{ color: colors.muted }}>
              {r.rien}
            </p>
          ) : (
            r.pieces.map((piece) => <PieceDuDossier key={piece.id} piece={piece} />)
          )}
        </div>
      ))}
    </>
  );
}
