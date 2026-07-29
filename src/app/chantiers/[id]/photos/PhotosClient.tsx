"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { colors, font } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function declencherAjout() {
    fileInputRef.current?.click();
  }

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

  return (
    <>
      <p className="px-6 text-[14px]" style={{ marginTop: "6px", color: colors.muted }}>
        {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Aucune photo pour l'instant"}
      </p>

      <div className="px-6 pt-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={onFichiersChoisis}
        />
        <PrimaryButton onClick={declencherAjout} disabled={enCours}>
          <CameraIcon /> {enCours ? "Ajout en cours…" : "Ajouter une photo"}
        </PrimaryButton>
      </div>

      {photos.length > 0 ? (
        <div className="mt-7 grid grid-cols-3 gap-3 px-6">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setOuverte(p.id)}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl"
              style={{ backgroundColor: colors.card, boxShadow: "0 1px 2px rgba(28,27,23,0.04), 0 4px 12px rgba(28,27,23,0.03)" }}
              aria-label="Voir la photo"
            >
              {/* object-cover préserve le cadrage sans déformation */}
              <img src={`/api/fichiers/${p.storageKey}`} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-7 px-6 text-center text-[14px]" style={{ color: colors.muted }}>
          Ajoutez une première photo pour garder une mémoire visuelle du chantier.
        </p>
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
                    className="rounded-2xl py-3.5 text-[16px] font-medium"
                    style={{ backgroundColor: colors.card, color: colors.ink }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmerSuppression}
                    className="rounded-2xl py-3.5 text-[15px] font-medium"
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
