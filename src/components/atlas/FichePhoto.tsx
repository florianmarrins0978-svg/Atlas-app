"use client";

import { useRef, useState } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import BottomSheet from "./BottomSheet";
import TeteRonde from "./TeteRonde";

type Resultat<T> = ({ ok: true } & T) | { ok: false; raison: string };

/**
 * La fiche d'une photo : la tête en grand, et trois gestes.
 *
 * *Sa réponse B du 27 septembre 2026*, planche `appli/photo-des-salaries.html`,
 * puis *« chaque personne doit pouvoir mettre et changer sa photo de
 * profil »* : la MÊME fiche sert au patron dans Équipe et à chacun dans Mon
 * compte. Seules les deux actions changent, et c'est l'appelant qui les donne.
 *
 * **Deux champs de fichier, et c'est voulu.** « Prendre une photo » porte
 * `capture` et ouvre l'appareil au dos ; « Choisir dans la galerie » ne le
 * porte pas. Un seul champ sans `capture` laisserait iOS proposer les deux,
 * mais Android ouvrirait la galerie seule.
 *
 * **La photo affichée est celle que le serveur a rangée**, jamais l'aperçu
 * local : un fichier refusé (format, taille) ne doit pas paraître posé.
 */
export default function FichePhoto({
  repli,
  nom,
  photo,
  envoyer,
  retirer,
  onPhoto,
  onFermer,
}: {
  repli: string | number;
  nom: string;
  photo: string | null;
  envoyer: (fichier: File) => Promise<Resultat<{ photo: string }>>;
  retirer: () => Promise<Resultat<object>>;
  onPhoto: (cle: string | null) => void;
  onFermer: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const appareil = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);

  async function poser(fichier: File | undefined) {
    if (!fichier) return;
    setEnCours(true);
    setRefus(null);
    const r = await envoyer(fichier);
    setEnCours(false);
    if (r.ok) onPhoto(r.photo);
    else setRefus(r.raison);
  }

  async function oter() {
    setEnCours(true);
    setRefus(null);
    const r = await retirer();
    setEnCours(false);
    if (r.ok) onPhoto(null);
    else setRefus(r.raison);
  }

  return (
    <BottomSheet open onBackdropClick={enCours ? undefined : onFermer}>
      <div data-atlas="fiche-photo" className="flex flex-col items-center">
        <TeteRonde repli={repli} photo={photo} taille={132} />
        <p className="mt-3 text-[22px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
          {nom}
        </p>

        <input
          ref={appareil}
          type="file"
          accept={ACCEPT_PHOTOS}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void poser(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={galerie}
          type="file"
          accept={ACCEPT_PHOTOS}
          className="hidden"
          onChange={(e) => {
            void poser(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={enCours}
          onClick={() => appareil.current?.click()}
          className="atlas-plein mt-5 w-full rounded-full py-[15px] text-[15px]"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
        >
          {enCours ? "Un instant…" : "Prendre une photo"}
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => galerie.current?.click()}
          className="mt-2.5 w-full rounded-full py-[15px] text-[15px]"
          style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          Choisir dans la galerie
        </button>
        {photo ? (
          <button
            type="button"
            data-atlas="retirer-photo"
            disabled={enCours}
            onClick={() => void oter()}
            className="mt-1.5 w-full rounded-full py-3 text-[14.5px]"
            style={{ color: colors.alert }}
          >
            Retirer la photo
          </button>
        ) : null}
        {refus ? (
          <p role="alert" className="mt-3 text-center text-[13px] leading-[1.5]" style={{ color: colors.alert }}>
            {refus}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
