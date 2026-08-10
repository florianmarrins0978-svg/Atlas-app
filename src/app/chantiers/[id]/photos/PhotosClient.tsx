"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import BottomSheet from "@/components/atlas/BottomSheet";
import { ajouterPhotoAction, supprimerPhotoAction } from "./actions";

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
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [choixOuvert, setChoixOuvert] = useState(false);
  // **Un seul bouton, et le choix au moment d'appuyer.**
  //
  // Première version : deux boutons côte à côte. Le patron, le 6 août 2026 :
  // « ça fait trop de boutons. Ou alors tu mets juste une case "ajouter des
  // photos" et quand on clique dessus, il y a un message qui demande si on veut
  // prendre une photo ou aller chercher dans la bibliothèque. » Un écran de
  // chantier doit se lire d'un coup d'œil : deux boutons pour une seule
  // intention, c'est une décision qu'on impose avant même qu'elle se pose.
  //
  // **Deux entrées restent nécessaires en dessous, et c'est délibéré.**
  //
  // Le patron, le 6 août 2026 : « lorsque je clique sur ajouter des photos, je
  // peux simplement prendre une photo. J'ai besoin de pouvoir accéder aux
  // photos que j'ai déjà prises. Il faut bien évidemment pouvoir faire les
  // deux. »
  //
  // L'attribut `capture` d'un champ de fichier n'est pas une préférence : sur
  // un iPhone, il **impose** l'appareil photo et retire purement et simplement
  // l'accès à la pellicule. Un artisan qui a photographié le chantier le matin
  // ne pouvait donc rien joindre l'après-midi.
  //
  // Le retirer tout court aurait échangé un défaut contre l'autre : le
  // sélecteur de fichiers s'ouvre alors sur la photothèque, et prendre une
  // photo demande deux appuis de plus, sur un chantier, avec des gants. D'où
  // deux champs distincts, et deux boutons qui disent lequel fait quoi.
  const champAppareilPhoto = useRef<HTMLInputElement>(null);
  const champPellicule = useRef<HTMLInputElement>(null);

  async function onFichiersChoisis(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = ""; // permet de resélectionner le même fichier ensuite
    if (fichiers.length === 0) return;
    setEnCours(true);
    for (const fichier of fichiers) {
      const fd = new FormData();
      fd.set("fichier", fichier);
      try {
        const { id, storageKey } = await ajouterPhotoAction(chantierId, fd);
        setPhotos((p) => [...p, { id, storageKey }]);
      } catch {
        // Une photo en échec parmi plusieurs n'interrompt pas les autres.
      }
    }
    setEnCours(false);
  }

  async function confirmerSuppression() {
    if (!ouverte) return;
    const id = ouverte;
    setConfirmationVisible(false);
    setOuverte(null);
    setPhotos((p) => p.filter((ph) => ph.id !== id));
    try {
      await supprimerPhotoAction(id);
    } catch {
      // La suppression est déjà répercutée visuellement ; une resynchronisation
      // complète en cas d'échec réseau est laissée à un lot ultérieur.
    }
  }

  function choisir(champ: React.RefObject<HTMLInputElement | null>) {
    // La feuille se referme AVANT d'ouvrir le sélecteur : sur iPhone, elle
    // resterait sinon affichée derrière l'appareil photo, et se retrouverait au
    // premier plan au retour, par-dessus la photo qu'on vient de prendre.
    setChoixOuvert(false);
    champ.current?.click();
  }

  return (
    <>
      <p className="px-6 text-[14px]" style={{ marginTop: "6px", color: colors.muted }}>
        {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Aucune photo pour l'instant"}
      </p>

      <div className="px-6 pt-6">
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
        {/* Sans `capture`, et c'est tout ce qui les distingue : ce champ-ci
            ouvre la photothèque du téléphone. */}
        <input
          ref={champPellicule}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Choisir dans mes photos"
          onChange={onFichiersChoisis}
        />
        <PrimaryButton onClick={() => setChoixOuvert(true)} disabled={enCours}>
          <CameraIcon /> {enCours ? "Ajout en cours…" : "Ajouter une photo"}
        </PrimaryButton>
      </div>

      {photos.length > 0 ? (
        <div className="mt-7 grid grid-cols-3 gap-3 px-6">
          {photos.map((p) => (
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
        <p className="mt-7 px-6 text-center text-[14px]" style={{ color: colors.muted }}>
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
      {photos.length > 0 && (
        <div className="mt-7 px-6">
          <Link
            href={`/chantiers/${chantierId}/note-vocale`}
            className="flex items-center justify-center gap-2 rounded-[4px] py-3 text-[15px] font-medium"
            style={{ backgroundColor: colors.rustTint, color: colors.rust, minHeight: 48 }}
          >
            <MicroIcon />
            Passer à la note vocale
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {/* Visionneuse plein écran — seule exception à la palette claire */}
      {ouverte !== null && (
        <div className="fixed inset-0 z-30 flex flex-col" style={{ backgroundColor: colors.ink }}>
          <div className="flex items-center justify-between px-6 pt-8">
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
            <button
              onClick={() => setConfirmationVisible(true)}
              aria-label="Supprimer cette photo"
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F6F1E6" strokeWidth="2">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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

          {/* Confirmation de suppression — sheet légère, jamais l'action visuellement dominante */}
          {confirmationVisible && (
            <div className="fixed inset-0 z-40 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
              <div className="w-full rounded-t-[26px] px-6 pb-9 pt-3" style={{ backgroundColor: colors.cream }}>
                <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
                <p className="mb-5 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
                  Supprimer cette photo ?
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => setConfirmationVisible(false)}
                    className="rounded-[4px] py-3.5 text-[16px] font-medium"
                    style={{ backgroundColor: colors.card, color: colors.ink }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmerSuppression}
                    className="rounded-[4px] py-3.5 text-[15px] font-medium"
                    style={{ color: colors.alert }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Le choix, au moment où il se pose — et pas avant. */}
      <BottomSheet open={choixOuvert} onBackdropClick={() => setChoixOuvert(false)}>
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
            onClick={() => setChoixOuvert(false)}
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
