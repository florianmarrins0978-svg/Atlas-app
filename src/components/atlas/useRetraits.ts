"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Le retrait réversible — la mécanique commune aux huit endroits qui suppriment.
 *
 * **Ce que ce crochet déplace.** La sécurité passait par une confirmation
 * AVANT (« Supprimer cette photo ? ») ; elle passe par une réversibilité
 * APRÈS. C'est le geste que le patron a retenu le 10 août 2026, et il ne tient
 * qu'à une condition : **rien n'est écrit tant que le tiroir est ouvert**.
 *
 * La ligne disparaît de l'écran tout de suite ; l'écriture destructrice attend
 * la fermeture du tiroir. Ce n'est pas un détail de confort : la photo et la
 * note vocale mettent leur fichier en file de purge DANS la même transaction
 * que la suppression (`fichiers_a_purger`). Appeler le serveur au moment du
 * geste rendrait « Annuler » menteur — la ligne reviendrait, le fichier non.
 * Une annulation qui ne rend rien est pire que pas d'annulation.
 *
 * **Ce que l'écran garde pour lui.** Il ne retire jamais l'élément de son état :
 * il le masque, en demandant `estRetire(id)`. Annuler n'est alors qu'un oubli,
 * et non une recréation — l'ancienne mécanique effaçait puis réinsérait une
 * ligne neuve, avec un identifiant neuf, ce qui n'est pas la même chose.
 *
 * **Trois sorties, et il en faut trois.** Le minuteur, le départ de la page
 * (`pagehide`), et le démontage. Sans les deux dernières, quitter l'écran
 * pendant le délai annulerait le retrait en silence : le patron reviendrait
 * sur une ligne qu'il croit supprimée.
 */

export type Retrait = { id: string; libelle: string };

export type ResultatValidation = { succes: boolean; erreur?: string } | void;

export function useRetraits({
  valider,
  delaiMs = 6000,
}: {
  /**
   * L'écriture destructrice, appelée une fois par élément à la fermeture du
   * tiroir. Peut refuser — un chantier facturé le fait —, et le refus ramène
   * la ligne avec son motif plutôt que de la laisser disparaître à tort.
   */
  valider: (id: string) => Promise<ResultatValidation>;
  delaiMs?: number;
}) {
  const [enAttente, setEnAttente] = useState<Retrait[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Ce que la validation a refusé : la ligne revient, et dit pourquoi. */
  const [refuses, setRefuses] = useState<Record<string, string>>({});

  // Le minuteur et la pile vivent aussi en référence : les sorties de secours
  // (départ de page, démontage) s'exécutent hors rendu et ne peuvent pas lire
  // un état React.
  //
  // Les deux références se synchronisent dans un effet, jamais pendant le
  // rendu ni dans une fonction de mise à jour : celles-ci doivent rester pures,
  // React se réservant le droit de les rejouer.
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enAttenteRef = useRef<Retrait[]>([]);
  const validerRef = useRef(valider);
  useEffect(() => {
    validerRef.current = valider;
    enAttenteRef.current = enAttente;
  });

  const ecrire = useCallback(async (aEcrire: Retrait[]) => {
    for (const r of aEcrire) {
      try {
        const resultat = await validerRef.current(r.id);
        if (resultat && resultat.succes === false) {
          // Le serveur a refusé : la ligne revient. Ne pas la laisser
          // disparaître de l'écran alors qu'elle existe toujours en base
          // serait le pire des deux mondes.
          setRefuses((cur) => ({ ...cur, [r.id]: resultat.erreur ?? "Ce retrait a été refusé." }));
        }
      } catch {
        setRefuses((cur) => ({
          ...cur,
          [r.id]: "Ce retrait n'a pas pu être enregistré. Il reste en place.",
        }));
      }
    }
  }, []);

  /** Ferme le tiroir et rend les retraits définitifs. */
  const fermer = useCallback(() => {
    if (minuteur.current) {
      clearTimeout(minuteur.current);
      minuteur.current = null;
    }
    const aEcrire = enAttenteRef.current;
    if (aEcrire.length === 0) return;
    enAttenteRef.current = [];
    setEnAttente([]);
    void ecrire(aEcrire);
  }, [ecrire]);

  const armer = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(fermer, delaiMs);
  }, [fermer, delaiMs]);

  const retirer = useCallback(
    (id: string, libelle: string) => {
      setErreur(null);
      setRefuses((cur) => {
        if (!(id in cur)) return cur;
        const suite = { ...cur };
        delete suite[id];
        return suite;
      });
      setEnAttente((cur) => [...cur.filter((r) => r.id !== id), { id, libelle }]);
      armer();
    },
    [armer]
  );

  /**
   * Annule **le dernier** retrait, et lui seul.
   *
   * Un « Annuler » unique visant toujours la même ligne rendrait la première
   * quand on retire la deuxième : l'annulation supprimerait. C'est pourquoi le
   * tiroir porte l'identifiant du dernier retrait, et non un libellé général.
   */
  const annuler = useCallback(() => {
    setEnAttente((cur) => cur.slice(0, -1));
  }, []);

  // Le tiroir vidé — par « Annuler » sur le dernier — n'a plus rien à écrire :
  // le minuteur doit s'éteindre, sinon il ferme un tiroir déjà fermé et, pire,
  // un retrait ultérieur hériterait d'un délai déjà entamé.
  useEffect(() => {
    if (enAttente.length === 0 && minuteur.current) {
      clearTimeout(minuteur.current);
      minuteur.current = null;
    }
  }, [enAttente.length]);

  const estRetire = useCallback((id: string) => enAttente.some((r) => r.id === id), [enAttente]);

  // Quitter l'écran vaut fermeture du tiroir. Sans cela, un retrait suivi d'un
  // départ immédiat ne s'écrirait jamais — et le patron retrouverait la ligne.
  // `pagehide` plutôt que `beforeunload` : c'est le seul que Safari mobile
  // déclenche vraiment quand l'application passe en arrière-plan.
  useEffect(() => {
    const partir = () => fermer();
    window.addEventListener("pagehide", partir);
    return () => {
      window.removeEventListener("pagehide", partir);
      fermer();
    };
  }, [fermer]);

  const dernier = enAttente.length > 0 ? enAttente[enAttente.length - 1] : null;

  return {
    /** Marque une ligne comme retirée. Rien n'est encore écrit. */
    retirer,
    /** Défait le dernier retrait — celui que le tiroir désigne. */
    annuler,
    /** Rend les retraits définitifs sans attendre le minuteur. */
    fermer,
    estRetire,
    /** Le retrait que le tiroir désigne, ou `null` quand il est fermé. */
    dernier,
    nombre: enAttente.length,
    /** Motif d'un refus du serveur, par identifiant. La ligne est revenue. */
    refuses,
    erreur,
    setErreur,
  };
}
