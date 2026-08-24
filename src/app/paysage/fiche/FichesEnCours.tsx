"use client";

import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { jourLisible } from "@/lib/jour";
import LignePassage, { type PassageListe } from "./LignePassage";
import { supprimerFicheAction } from "./actions";

/**
 * Les fiches en cours, et **le geste qui les retire**.
 *
 * **Sa demande du 24 août 2026** : *« Je ne peux pas supprimer les fiches en
 * cours. Il faut pouvoir les supprimer. »* Elles s'empilaient sur l'écran qu'il
 * ouvre chaque matin — une fiche ouverte sur le mauvais jour, une autre pour un
 * jardin qu'il n'a finalement pas fait — sans aucune issue.
 *
 * **Le geste n'est pas inventé ici : c'est le SIEN, celui du 10 août 2026.**
 * La ligne disparaît tout de suite, le tiroir propose « Annuler », et rien
 * n'est écrit tant qu'il est ouvert (`useRetraits`). C'est la mécanique des
 * huit autres endroits qui suppriment dans Atlas — lui en donner une neuvième,
 * différente, sur l'écran qu'il ouvre le plus, serait lui faire apprendre deux
 * fois la même chose.
 *
 * **Seuls les brouillons passent par ici.** Un rapport parti vit chez le client
 * dans un SMS : le supprimer changerait son lien en page morte. Le dépôt refuse
 * (`supprimerPassage`), et l'écran ne propose donc rien qui serait refusé.
 */
export default function FichesEnCours({ brouillons }: { brouillons: PassageListe[] }) {
  const [phrase, setPhrase] = useState<string | null>(null);
  /**
   * Ce que le serveur a bel et bien effacé.
   *
   * **Sans cette liste, la fiche REVIENDRAIT à l'écran l'instant d'après.** Les
   * brouillons arrivent du serveur en propriété ; `useRetraits` ne les masque
   * que tant que le tiroir est ouvert, et il se ferme au moment même où
   * l'écriture part. Entre cette fermeture et le repeint de la page par le
   * serveur, la ligne supprimée n'est plus masquée par personne — elle
   * réapparaît, puis disparaît. Un clignotement sur une suppression, c'est le
   * doute : a-t-il effacé, ou non ?
   *
   * Elle ne retient que les identifiants dont la suppression a RÉUSSI : un
   * refus doit ramener la ligne, c'est tout l'intérêt du refus.
   */
  const [effacees, setEffacees] = useState<string[]>([]);

  const retraits = useRetraits({
    valider: async (id) => {
      const r = await supprimerFicheAction(id);
      if (!r.ok) {
        setPhrase(r.phrase);
        return { succes: false, erreur: r.phrase };
      }
      setEffacees((cur) => [...cur, id]);
      return { succes: true };
    },
  });

  const visibles = brouillons.filter((p) => !retraits.estRetire(p.id) && !effacees.includes(p.id));

  // **LE TITRE PART AVEC SA DERNIÈRE LIGNE, et il l'a fallu.** La capture prise
  // pendant le délai d'annulation montrait « EN COURS » suivi de rien : un
  // écran qui paraît cassé à l'instant précis où il vient de toucher une croix,
  // et où il se demande s'il a effacé plus que prévu. Le tiroir, lui, reste —
  // c'est lui qui dit ce qui s'est passé, et il porte « Annuler ».
  //
  // Trouvé en REGARDANT une capture, comme les cinq défauts précédents de ce
  // dépôt (`CLAUDE.md` §5) : aucune suite ne rougissait.
  return (
    <>
      {visibles.length > 0 && (
        <section className="mx-[26px] mt-[28px]">
          <h2 className={smallCaps} style={{ color: colors.muted }}>
            En cours
          </h2>

          <div className="mt-[10px]">
            {visibles.map((p) => (
              <LignePassage
                key={p.id}
                passage={p}
                action={
                  // 44 px de côté : la mesure d'un doigt, pas d'un curseur.
                  <button
                    type="button"
                    data-supprimer-fiche={p.id}
                    aria-label={`Supprimer la fiche ${p.clientNom ?? "sans client"} du ${jourLisible(p.jour)}`}
                    onClick={() => {
                      setPhrase(null);
                      retraits.retirer(p.id, `la fiche ${p.clientNom ?? "sans client"}`);
                    }}
                    className="ml-[10px] flex h-11 w-11 flex-none items-center justify-center text-[18px]"
                    style={{ color: colors.muted }}
                  >
                    ×
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* **Le refus du serveur, s'il y en a un.** La ligne est revenue dans la
          liste au-dessus ; sans cette phrase, elle réapparaîtrait sans un mot
          et il croirait la croix cassée. */}
      {phrase && (
        <p
          className="mx-[26px] mt-[12px] text-[13.5px]"
          style={{ color: colors.rust }}
          role="alert"
          data-refus
        >
          {phrase}
        </p>
      )}

      {/* Hors de la section, et non dedans : le tiroir porte déjà la marge de
          26 px de l'écran, et l'imbriquer la doublerait — « Annuler » ne
          s'alignerait plus sur rien. */}
      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
      />
    </>
  );
}
