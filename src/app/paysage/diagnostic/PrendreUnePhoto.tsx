"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors } from "@/lib/design-tokens";
import { analyserPhotoAction, ajouterComplementAction } from "./actions";

/**
 * Le seul geste de l'écran d'entrée : appuyer, photographier, attendre.
 *
 * **`capture="environment"` ouvre l'appareil arrière du téléphone**, pas la
 * bibliothèque de photos. C'est ce qui fait la différence entre « prendre une
 * photo » et « choisir une photo » — et le parcours qu'il a demandé est le
 * premier : *ouvrir la rubrique, prendre une photo, attendre, obtenir une
 * réponse*. Sur un ordinateur, l'attribut est ignoré et le sélecteur de
 * fichiers s'ouvre : rien n'est perdu.
 *
 * **L'attente est DITE, et c'est le point délicat de cet écran.** Un appel de
 * vision prend plusieurs secondes ; sans un mot, il appuie une seconde fois, et
 * deux analyses partent pour une seule photo. Le bouton se désarme et se nomme
 * autrement — c'est ce qui a manqué à la dictée le 12 août.
 */
export default function PrendreUnePhoto({
  diagnosticId,
  libelle,
}: {
  /** Absent : c'est la première photo. Présent : la photo complémentaire. */
  diagnosticId?: string;
  libelle: string;
}) {
  const entree = useRef<HTMLInputElement>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const router = useRouter();

  return (
    <div data-atlas="prendre-photo">
      <input
        ref={entree}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          // Remettre l'entrée à zéro AVANT de partir : sans cela, reprendre
          // deux fois la même photo ne déclenche rien — le navigateur
          // n'émettant pas `change` pour une valeur identique.
          e.target.value = "";
          if (!fichier) return;
          setPhrase(null);
          demarrer(async () => {
            const donnees = new FormData();
            donnees.set("photo", fichier);
            const r = diagnosticId
              ? await ajouterComplementAction(diagnosticId, donnees)
              : await analyserPhotoAction(donnees);
            if (!r.ok) {
              setPhrase(r.phrase);
              return;
            }
            router.push(`/paysage/diagnostic/${r.id}`);
            router.refresh();
          });
        }}
      />

      <PrimaryButton
        repere="prendre-photo-diagnostic"
        disabled={enCours}
        onClick={() => entree.current?.click()}
      >
        {enCours ? "Analyse en cours…" : libelle}
      </PrimaryButton>

      {phrase && (
        <p className="mt-[12px] text-center text-[12.5px]" style={{ color: colors.alert }}>
          {phrase}
        </p>
      )}
    </div>
  );
}
