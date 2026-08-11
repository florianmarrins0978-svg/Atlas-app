"use client";

import { useRef, type ChangeEvent, type RefObject } from "react";
import { colors, font } from "@/lib/design-tokens";
import BottomSheet from "./BottomSheet";
import { ajouterPhotoAction } from "@/app/chantiers/[id]/photos/actions";

export type PhotoAjoutee = { id: string; storageKey: string };

/**
 * Ajouter une photo : le choix, les deux champs, et l'envoi.
 *
 * **Pourquoi cette pièce existe séparément.** Le mécanisme vivait entier dans
 * l'écran Photos, et la case « + » de la pellicule de la fiche n'était qu'un
 * LIEN vers cet écran. Le patron, le 11 août 2026 : *« quand je clique sur
 * l'encadré avec le plus là des photos, ça me ramène encore sur cette
 * page-là. »* Ajouter une photo depuis la fiche demandait donc de changer
 * d'écran d'abord — sur un chantier, avec des gants, c'est un appui de trop.
 *
 * Le recopier dans la fiche aurait été pire : `CLAUDE.md` §3 interdit la règle
 * dupliquée, et il y a ici bien plus qu'une règle — deux champs dont l'un
 * IMPOSE l'appareil photo, l'ordre de fermeture de la feuille, la boucle
 * d'envoi qui survit à un fichier en échec. Deux copies auraient divergé au
 * premier correctif.
 *
 * Cette pièce ne porte PAS son déclencheur : l'écran Photos l'ouvre depuis un
 * bouton pleine largeur, la fiche depuis la case « + » de la pellicule. Chacun
 * garde son dessin, tous deux partagent le mécanisme.
 */
export default function AjoutDePhotos({
  chantierId,
  ouvert,
  onFermer,
  onAjoutee,
  onEnCours,
}: {
  chantierId: string;
  ouvert: boolean;
  onFermer: () => void;
  /** Appelé pour CHAQUE photo arrivée, dans l'ordre où elles arrivent. */
  onAjoutee: (photo: PhotoAjoutee) => void;
  /** L'envoi commence, l'envoi finit — de quoi griser un bouton. */
  onEnCours?: (enCours: boolean) => void;
}) {
  // **Deux champs distincts, et c'est délibéré.**
  //
  // Le patron, le 6 août 2026 : *« lorsque je clique sur ajouter des photos, je
  // peux simplement prendre une photo. J'ai besoin de pouvoir accéder aux
  // photos que j'ai déjà prises. Il faut bien évidemment pouvoir faire les
  // deux. »*
  //
  // L'attribut `capture` n'est pas une préférence : sur un iPhone, il **impose**
  // l'appareil photo et retire l'accès à la pellicule. Un artisan qui a
  // photographié le chantier le matin ne pouvait rien joindre l'après-midi. Le
  // retirer tout court échangerait un défaut contre l'autre — le sélecteur
  // s'ouvrirait alors sur la photothèque, et prendre une photo demanderait deux
  // appuis de plus.
  const champAppareilPhoto = useRef<HTMLInputElement>(null);
  const champPellicule = useRef<HTMLInputElement>(null);

  async function onFichiersChoisis(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = ""; // permet de resélectionner le même fichier ensuite
    if (fichiers.length === 0) return;
    onEnCours?.(true);
    for (const fichier of fichiers) {
      const fd = new FormData();
      fd.set("fichier", fichier);
      try {
        const { id, storageKey } = await ajouterPhotoAction(chantierId, fd);
        onAjoutee({ id, storageKey });
      } catch {
        // Une photo en échec parmi plusieurs n'interrompt pas les autres.
      }
    }
    onEnCours?.(false);
  }

  function choisir(champ: RefObject<HTMLInputElement | null>) {
    // La feuille se referme AVANT d'ouvrir le sélecteur : sur iPhone, elle
    // resterait sinon affichée derrière l'appareil photo, et se retrouverait au
    // premier plan au retour, par-dessus la photo qu'on vient de prendre.
    onFermer();
    champ.current?.click();
  }

  return (
    <>
      <input
        ref={champAppareilPhoto}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        aria-label="Prendre une photo"
        onChange={onFichiersChoisis}
      />
      {/* Sans `capture`, et c'est tout ce qui les distingue : ce champ-ci ouvre
          la photothèque du téléphone. */}
      <input
        ref={champPellicule}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Choisir dans mes photos"
        onChange={onFichiersChoisis}
      />

      {/* Le choix, au moment où il se pose — et pas avant.
          Première version : deux boutons côte à côte. Le patron, le 6 août
          2026 : « ça fait trop de boutons. Ou alors tu mets juste une case
          "ajouter des photos" et quand on clique dessus, il y a un message qui
          demande si on veut prendre une photo ou aller chercher dans la
          bibliothèque. » */}
      <BottomSheet open={ouvert} onBackdropClick={onFermer}>
        <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
          Ajouter une photo
        </p>
        <p className="mb-5 text-center text-[13px]" style={{ color: colors.muted }}>
          Prise maintenant, ou déjà dans votre téléphone.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => choisir(champAppareilPhoto)}
            className="rounded-[4px] py-3.5 text-[15px] font-medium"
            style={{ backgroundColor: colors.rust, color: colors.cream }}
          >
            Prendre une photo
          </button>
          <button
            type="button"
            onClick={() => choisir(champPellicule)}
            className="rounded-[4px] py-3.5 text-[15px] font-medium"
            style={{ backgroundColor: colors.card, color: colors.ink }}
          >
            Choisir dans ma bibliothèque
          </button>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-[4px] py-3.5 text-[15px]"
            style={{ color: colors.muted }}
          >
            Annuler
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
