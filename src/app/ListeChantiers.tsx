"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { chantierQuiPorteLaPerle } from "@/lib/perle-attente";
import CarteGlissante from "@/components/atlas/CarteGlissante";
import { supprimerChantierAction } from "./planning/actions";

export type BrinChantier = {
  id: string;
  /** Le nom affiché — sert aussi au libellé de suppression. */
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
 * **Ce qui n'a pas changé, et ne devait pas.** Le glissement vers la gauche
 * découvre toujours la corbeille (le patron, 7 août 2026 : « le slide et la
 * suppression […] je veux la même chose »), et le refus de supprimer un
 * chantier déjà facturé dit toujours pourquoi — sinon le geste paraît
 * simplement cassé.
 */
export default function ListeChantiers({ chantiers }: { chantiers: BrinChantier[] }) {
  const router = useRouter();
  const [retires, setRetires] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  async function supprimer(id: string) {
    setErreur(null);
    // Retiré de l'écran d'abord : sur un téléphone, une carte qui reste en
    // place le temps d'un aller-retour donne l'impression que rien ne s'est
    // passé, et le geste se refait.
    setRetires((r) => [...r, id]);
    const resultat = await supprimerChantierAction(id);
    if (!resultat.succes) {
      setRetires((r) => r.filter((x) => x !== id));
      setErreur(resultat.erreur);
      return;
    }
    router.refresh();
  }

  const visibles = chantiers.filter((c) => !retires.includes(c.id));
  // La règle vit dans une fonction pure : elle se casse sur des listes que le
  // banc ne contient pas (aucune attente, plusieurs, la dernière), et aucune de
  // ces situations ne s'atteint en cliquant.
  const premierEnAttente = chantierQuiPorteLaPerle(visibles);

  return (
    <>
      {erreur && (
        <p role="alert" className="px-[26px] pb-2 text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
      <div className="atlas-tige mx-[26px]">
        {visibles.map((c) => (
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
            <CarteGlissante
              libelleSuppression={`Supprimer le chantier ${c.nom}`}
              onSupprimer={() => supprimer(c.id)}
              fond={colors.cream}
              rayon={0}
            >
              <Link
                href={`/chantiers/${c.id}`}
                className="atlas-brin relative grid grid-cols-[47px_1fr] gap-x-[26px] py-[17px]"
              >
                {/* Le fil, dessiné ligne par ligne. Posé une seule fois SOUS
                    la liste, il disparaissait : la couche qui glisse pour
                    découvrir la corbeille porte le fond de la page et le
                    repeignait. Bout à bout, les segments n'en font qu'un. */}
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
                    {c.jour}
                  </b>
                  <span className="mt-1 block">{c.mois}</span>
                </span>
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
            </CarteGlissante>
          </Fragment>
        ))}
      </div>
    </>
  );
}
