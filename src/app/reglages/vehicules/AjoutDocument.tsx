"use client";

import { useRef, useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font } from "@/lib/design-tokens";
import {
  NATURES_DOCUMENT_VEHICULE,
  NOM_DOCUMENT_VEHICULE,
  refusDuDocumentVehicule,
  type ChampVehicule,
  type NatureDocumentVehicule,
} from "@/lib/vehicules";
import { ajouterDocumentVehiculeAction, classerDocumentVehiculeAction } from "./actions";
import Picto, { type NomPicto } from "@/components/atlas/reglages/Picto";

/** Ce que la feuille annonce : QUOI ajouter, avant le choix de la source. */
export type QuoiAjouter = { titre: string; sous: string };

export const AJOUTER_UN_DOCUMENT: QuoiAjouter = {
  titre: "Ajoutez un document du véhicule",
  sous: "Carte grise, assurance ou contrôle technique.",
};
export const AJOUTER_LA_CARTE_GRISE: QuoiAjouter = {
  titre: "Ajoutez la carte grise du véhicule",
  sous: "Atlas y lit la plaque, le modèle et le poids.",
};
export const AJOUTER_LE_PROCES_VERBAL: QuoiAjouter = {
  titre: "Ajoutez le nouveau procès‑verbal",
  sous: "Atlas y lit les prochaines dates.",
};

/**
 * LA FEUILLE « AJOUTER UN DOCUMENT » — sa planche du 14 octobre 2026.
 *
 * **Le titre dit QUOI photographier** : sa remarque du même soir, devant
 * « Ajouter un véhicule » qui ouvrait l'appareil photo sans rien dire, *« je
 * ne comprends pas ce qu'il faut que je fasse »*. Le menu de l'iPhone ne porte
 * pas de titre ; c'est pourquoi cette feuille existe, avec ses trois choix
 * (son choix du même soir : Photothèque, Prendre une photo, Choisir un
 * fichier), chacun ouvrant son propre champ de fichier.
 *
 * **Quand Atlas ne reconnaît pas le papier, il DEMANDE** ce que c'est, dans la
 * même feuille ; il ne le range jamais au hasard.
 *
 * **Habillée comme ses voisines** (planche du 26 octobre 2026) : le titre en
 * serif, les trois sources dans une plage avec leur dessin doré.
 */
export default function AjoutDocument({
  ouverte,
  quoi,
  vehiculeId,
  onFermer,
  onRange,
}: {
  ouverte: boolean;
  quoi: QuoiAjouter;
  /** Absent : le papier crée le véhicule (« Ajouter un véhicule »). */
  vehiculeId: string | null;
  onFermer: () => void;
  onRange: (r: { vehiculeId: string; message: string; remplis: ChampVehicule[] }) => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);
  const [aClasser, setAClasser] = useState<{ vehiculeId: string; cle: string } | null>(null);
  const phototheque = useRef<HTMLInputElement>(null);
  const appareil = useRef<HTMLInputElement>(null);
  const fichiers = useRef<HTMLInputElement>(null);

  const fermer = () => {
    if (enCours) return;
    setRefus(null);
    setAClasser(null);
    onFermer();
  };

  const envoyer = (f: File | undefined) => {
    if (!f) return;
    const r = refusDuDocumentVehicule(f.type, f.size);
    if (r) {
      setRefus(r);
      return;
    }
    setRefus(null);
    const formulaire = new FormData();
    formulaire.append("fichier", f);
    if (vehiculeId) formulaire.append("vehiculeId", vehiculeId);
    demarrer(async () => {
      const resultat = await ajouterDocumentVehiculeAction(formulaire);
      if (resultat.ok === true) {
        onRange({ vehiculeId: resultat.vehiculeId, message: resultat.message, remplis: resultat.remplis });
      } else if (resultat.ok === "a-classer") {
        setAClasser({ vehiculeId: resultat.vehiculeId, cle: resultat.cle });
      } else setRefus(resultat.raison);
    });
  };

  const classer = (nature: NatureDocumentVehicule) => {
    if (!aClasser) return;
    demarrer(async () => {
      const resultat = await classerDocumentVehiculeAction(aClasser.vehiculeId, aClasser.cle, nature);
      if (resultat.ok) {
        const id = aClasser.vehiculeId;
        setAClasser(null);
        onRange({ vehiculeId: id, message: resultat.message, remplis: [] });
      } else setRefus(resultat.raison);
    });
  };

  const champ = (ref: React.RefObject<HTMLInputElement | null>, accept: string, capture?: "environment") => (
    <input
      ref={ref}
      type="file"
      accept={accept}
      capture={capture}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        envoyer(f);
      }}
    />
  );

  const plage = (enfants: React.ReactNode) => (
    <div className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
      {enfants}
    </div>
  );
  const titre = (texte: string) => (
    <p className="mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
      {texte}
    </p>
  );
  const sous = (texte: string) => (
    <p className="mb-3.5 mt-2 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
      {texte}
    </p>
  );

  return (
    <BottomSheet open={ouverte} onBackdropClick={fermer}>
      <div data-atlas="ajout-document-vehicule">
        {champ(phototheque, "image/jpeg,image/png")}
        {champ(appareil, "image/jpeg,image/png", "environment")}
        {champ(fichiers, "application/pdf,image/jpeg,image/png")}

        {enCours ? (
          <p
            className="flex flex-col items-center pb-9 pt-7 text-center text-[16px]"
            style={{ color: colors.inkSoft }}
            data-atlas="lecture-en-cours"
          >
            <span className="mb-3 motion-safe:animate-spin [animation-duration:1.4s]" style={{ color: colors.or }}>
              <Picto nom="etincelle" taille={34} />
            </span>
            Atlas lit le document
          </p>
        ) : aClasser ? (
          <>
            {titre("Quel est ce document ?")}
            {sous("Atlas ne l’a pas reconnu. Il est rangé, les cases se remplissent à la main.")}
            {plage(
              NATURES_DOCUMENT_VEHICULE.map((n) => (
                <LigneDeFeuille key={n} repere={`classer-${n}`} onClick={() => classer(n)}>
                  {NOM_DOCUMENT_VEHICULE[n]}
                </LigneDeFeuille>
              ))
            )}
          </>
        ) : (
          <>
            {titre(quoi.titre)}
            {sous(quoi.sous)}
            {plage(
              <>
                <LigneDeFeuille dessin="photo" onClick={() => phototheque.current?.click()}>
                  Photothèque
                </LigneDeFeuille>
                <LigneDeFeuille dessin="scanner" onClick={() => appareil.current?.click()}>
                  Prendre une photo
                </LigneDeFeuille>
                <LigneDeFeuille dessin="document" onClick={() => fichiers.current?.click()}>
                  Choisir un fichier
                </LigneDeFeuille>
              </>
            )}
            <button
              type="button"
              onClick={fermer}
              className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-full text-[16px] font-semibold"
              style={{ color: colors.inkSoft }}
            >
              Annuler
            </button>
          </>
        )}

        {refus && (
          <p className="mt-3 text-[14px] leading-[1.5]" style={{ color: colors.alert }} data-atlas="refus-document-vehicule">
            {refus}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

/** Une source ou un genre de papier : une ligne de la plage, 60 px sous le doigt. */
function LigneDeFeuille({
  dessin,
  repere,
  onClick,
  children,
}: {
  dessin?: NomPicto;
  repere?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-atlas={repere}
      onClick={onClick}
      className="relative flex min-h-[60px] w-full items-center gap-3.5 px-0.5 text-left text-[17px] disabled:opacity-50"
      style={{ color: colors.ink }}
    >
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      {dessin && (
        <span style={{ color: colors.or }}>
          <Picto nom={dessin} />
        </span>
      )}
      {children}
    </button>
  );
}
