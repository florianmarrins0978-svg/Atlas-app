"use client";

import { useState } from "react";
import Link from "next/link";
import { colors, libelleCaps } from "@/lib/design-tokens";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import AjoutDePhotos from "@/components/atlas/AjoutDePhotos";
import { supprimerPhotoAction } from "./actions";

type Photo = { id: string; storageKey: string };

export default function PhotosClient({
  chantierId,
  initialPhotos,
}: {
  chantierId: string;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [ouverte, setOuverte] = useState<string | null>(null);

  // **Le panneau « Supprimer cette photo ? » a disparu, et c'est le cœur du
  // geste retenu le 10 août 2026** : la sécurité passe d'une confirmation
  // AVANT à une réversibilité APRÈS. Garder les deux ferait demander deux fois.
  //
  // La photo a un fichier derrière elle, et `supprimerPhoto` le met en file de
  // purge dans la même transaction. L'appel n'a donc lieu qu'à la FERMETURE du
  // tiroir : d'ici là, « Annuler » rend la photo, fichier compris.
  const retraits = useRetraits({
    valider: async (id) => {
      try {
        await supprimerPhotoAction(id);
        setPhotos((p) => p.filter((ph) => ph.id !== id));
      } catch {
        // Déjà répercutée visuellement ; une resynchronisation complète en cas
        // d'échec réseau est laissée à un lot ultérieur.
      }
    },
  });
  const visibles = photos.filter((p) => !retraits.estRetire(p.id));
  const [enCours, setEnCours] = useState(false);
  const [choixOuvert, setChoixOuvert] = useState(false);
  // Le mécanisme d'ajout — les deux champs, la feuille de choix, l'envoi — vit
  // dans `AjoutDePhotos` depuis le 11 août 2026 : la pellicule de la fiche
  // chantier l'ouvre elle aussi, et le recopier aurait fait diverger les deux au
  // premier correctif. Cet écran garde ce qui lui appartient : son bouton pleine
  // largeur, la grille des vignettes, la visionneuse et le retrait.
  //
  // **Un seul bouton, et le choix au moment d'appuyer.** Le patron, le 6 août
  // 2026 : « ça fait trop de boutons. Ou alors tu mets juste une case "ajouter
  // des photos" et quand on clique dessus, il y a un message qui demande si on
  // veut prendre une photo ou aller chercher dans la bibliothèque. »

  return (
    <>
      <p
        // Une étiquette de code, pas un libellé : un contrôle accroché au texte
        // casse à la refonte suivante sans qu'aucun défaut n'existe.
        data-atlas="compte-photos"
        className="px-[26px] pt-4 text-[9.5px] font-medium uppercase"
        style={{ color: colors.muted, letterSpacing: "0.28em" }}
      >
        {/* Le décompte suit le retrait : « 6 photos » au-dessus de cinq
            vignettes ferait douter que le retrait ait eu lieu. */}
        {visibles.length > 0
          ? `${visibles.length} photo${visibles.length > 1 ? "s" : ""}`
          : "Aucune photo pour l'instant"}
      </p>

      <div className="px-[26px] pt-6">
        <PrimaryButton onClick={() => setChoixOuvert(true)} disabled={enCours}>
          <CameraIcon /> {enCours ? "Ajout en cours…" : "Ajouter une photo"}
        </PrimaryButton>
      </div>

      {visibles.length > 0 ? (
        <div className="mt-6 grid grid-cols-3 gap-2.5 px-[26px]">
          {visibles.map((p) => (
            <button
              key={p.id}
              onClick={() => setOuverte(p.id)}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-[4px]"
              style={{ backgroundColor: colors.card, boxShadow: "0 1px 2px rgba(28,27,23,0.04), 0 4px 12px rgba(28,27,23,0.03)" }}
              aria-label="Voir la photo"
            >
              {/* Conservé en <img> : next/image réécrit l'attribut src via
                  /_next/image, ce qui romprait la correspondance exacte de src
                  attendue avec la visionneuse plein écran (comportement
                  vérifié par test e2e) — object-cover préserve le cadrage sans
                  déformation. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fichiers/${p.storageKey}`} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-7 px-[26px] text-center text-[14px]" style={{ color: colors.muted }}>
          Ajoutez une première photo pour garder une mémoire visuelle du chantier.
        </p>
      )}

      {/* **Enchaîner, plutôt que revenir en arrière.**
          Le patron, le 7 août 2026 : « lorsque j'ai ajouté ma photo, je dois
          avoir une petite touche discrète et élégante pour passer à l'étape
          suivante (la note vocale) sans avoir à faire machine arrière ».
          Le parcours réel est celui-là : il photographie l'arbre, puis il
          dicte. Le renvoyer à la fiche du chantier pour rouvrir un autre écran
          lui coûte deux appuis, sur place, avec des gants.

          Discrète : un lien, pas un second bouton plein. L'action principale de
          cet écran reste d'ajouter des photos — on propose la suite, on ne la
          met pas en avant. N'apparaît qu'une fois une photo présente : avant,
          elle n'aurait rien à enchaîner. */}
      {visibles.length > 0 && (
        <div className="mt-7 px-[26px]">
          <Link
            href={`/chantiers/${chantierId}/note-vocale`}
            className="flex items-center justify-center gap-2 rounded-[4px] py-3.5 text-[9.5px] font-medium uppercase"
            style={{
              letterSpacing: "0.28em",
              backgroundColor: colors.rustTint,
              color: colors.rust,
              minHeight: 48,
            }}
          >
            <MicroIcon />
            Passer à la note vocale
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {/* Le tiroir, sous la grille et le lien de suite : il pousse le contenu
          vers le haut au lieu de le recouvrir. */}
      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
        className="mt-7"
      />

      {/* Visionneuse plein écran — seule exception à la palette claire */}
      {ouverte !== null && (
        <div className="fixed inset-0 z-30 flex flex-col" style={{ backgroundColor: colors.ink }}>
          <div className="flex items-center justify-between px-[26px] pt-8">
            <button
              onClick={() => setOuverte(null)}
              aria-label="Fermer"
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F6F1E6" strokeWidth="2.2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
            {/* **Le seul écran où le glissement ne s'applique pas**, et ce
                n'est pas un oubli : une vignette carrée dans une grille de
                trois n'est pas une ligne, et y faire glisser un texte qui
                n'existe pas n'aurait aucun sens. Ce qui est repris, c'est le
                reste du geste — le mot « Retirer », sa couleur, et le tiroir
                qui rattrape. La photo se retire d'où on la regarde. */}
            <button
              onClick={() => {
                const id = ouverte;
                setOuverte(null);
                retraits.retirer(id, "cette photo");
              }}
              aria-label="Retirer cette photo"
              className={`flex h-11 items-center justify-center rounded-full px-4 ${libelleCaps}`}
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: colors.orClair, letterSpacing: "0.26em" }}
            >
              Retirer
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            {/* Conservé en <img> : dimensions intrinsèques inconnues à l'avance
                (photos de tailles arbitraires) dans un conteneur flexible non
                dimensionné — next/image (fill) exige des dimensions connues ou
                un conteneur positionné/dimensionné, incompatible ici avec le
                comportement "s'adapter à la taille réelle de la photo" sans
                changement de comportement. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/fichiers/${photos.find((p) => p.id === ouverte)?.storageKey}`}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>

        </div>
      )}

      <AjoutDePhotos
        chantierId={chantierId}
        ouvert={choixOuvert}
        onFermer={() => setChoixOuvert(false)}
        onAjoutee={(photo) => setPhotos((p) => [...p, photo])}
        onEnCours={setEnCours}
      />
    </>
  );
}

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M8 7l1.4-2.4A1 1 0 0 1 10.26 4h3.48a1 1 0 0 1 .86.6L16 7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.4" />
    </svg>
  );
}

/** Le micro de la note vocale, au même trait que le reste de l'écran. */
function MicroIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
    </svg>
  );
}
