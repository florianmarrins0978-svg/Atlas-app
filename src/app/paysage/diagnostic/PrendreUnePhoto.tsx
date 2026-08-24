"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors } from "@/lib/design-tokens";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import { analyserPhotoAction, ajouterComplementAction } from "./actions";

/**
 * Le seul geste de l'écran d'entrée : appuyer, photographier, attendre.
 *
 * **Le téléphone propose les DEUX : prendre une photo, ou en choisir une.**
 * L'écran portait `capture="environment"`, qui ouvre l'appareil arrière et ne
 * laisse pas le choix. Ce n'était pas ce qu'il voulait — sa règle du 21 août
 * 2026, posée pour le croquis d'arrosage et valable ici : *« soit je peux
 * mettre une photo de ma bibliothèque, soit prendre une photo »*.
 *
 * Le retirer ne coûte rien : l'appareil reste le premier choix du menu. Le
 * garder, en revanche, interdisait une photo prise la veille chez le client —
 * un feuillage qui jaunit se photographie quand on le voit, pas quand on ouvre
 * Atlas.
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
        // **La constante partagée, jamais la liste recopiée.** Elle valait
        // exactement la même chose ici — et c'est bien le danger : le jour où
        // la liste bouge dans `src/lib/exif.ts`, cet écran resterait seul en
        // arrière sans que rien ne le dise (`CLAUDE.md` §3).
        accept={ACCEPT_PHOTOS}
        // **PAS de `capture` — la même règle que pour le croquis d'arrosage**,
        // posée le 21 août 2026 : « soit je peux mettre une photo de ma
        // bibliothèque, soit prendre une photo ».
        //
        // Il l'a demandé pour le croquis ; le diagnostic portait le même
        // attribut, donc le même défaut. Le retirer ne coûte RIEN — l'appareil
        // reste proposé dans le menu du téléphone —, tandis que le garder
        // interdit une photo prise la veille chez le client. Un feuillage qui
        // jaunit se photographie quand on le voit, pas quand on ouvre Atlas.
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
