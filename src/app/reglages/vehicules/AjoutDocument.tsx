"use client";

import { useRef, useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, texteSituation } from "@/lib/design-tokens";
import {
  NATURES_DOCUMENT_VEHICULE,
  NOM_DOCUMENT_VEHICULE,
  refusDuDocumentVehicule,
  type ChampVehicule,
  type NatureDocumentVehicule,
} from "@/lib/vehicules";
import { ajouterDocumentVehiculeAction, classerDocumentVehiculeAction } from "./actions";

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

  const ligne = "block w-full border-b py-4 text-left text-[16px] disabled:opacity-50";

  return (
    <BottomSheet open={ouverte} onBackdropClick={fermer}>
      <div data-atlas="ajout-document-vehicule">
        {champ(phototheque, "image/jpeg,image/png")}
        {champ(appareil, "image/jpeg,image/png", "environment")}
        {champ(fichiers, "application/pdf,image/jpeg,image/png")}

        {enCours ? (
          <p className="py-8 text-center text-[15px]" style={{ color: colors.inkSoft }} data-atlas="lecture-en-cours">
            Atlas lit le document
          </p>
        ) : aClasser ? (
          <>
            <p style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.2, color: colors.ink }}>
              Quel est ce document ?
            </p>
            <p className={`mb-2 mt-1 ${texteSituation}`} style={{ color: colors.inkSoft }}>
              Atlas ne l’a pas reconnu. Il est rangé, les cases se remplissent à la main.
            </p>
            {NATURES_DOCUMENT_VEHICULE.map((n) => (
              <button
                key={n}
                type="button"
                data-atlas={`classer-${n}`}
                onClick={() => classer(n)}
                className={ligne}
                style={{ borderColor: colors.line, color: colors.ink }}
              >
                {NOM_DOCUMENT_VEHICULE[n]}
              </button>
            ))}
          </>
        ) : (
          <>
            <p style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.2, color: colors.ink }}>{quoi.titre}</p>
            <p className={`mb-2 mt-1 ${texteSituation}`} style={{ color: colors.inkSoft }}>
              {quoi.sous}
            </p>
            <button type="button" onClick={() => phototheque.current?.click()} className={ligne} style={{ borderColor: colors.line, color: colors.ink }}>
              Photothèque
            </button>
            <button type="button" onClick={() => appareil.current?.click()} className={ligne} style={{ borderColor: colors.line, color: colors.ink }}>
              Prendre une photo
            </button>
            <button type="button" onClick={() => fichiers.current?.click()} className={ligne} style={{ borderColor: colors.line, color: colors.ink }}>
              Choisir un fichier
            </button>
            <button type="button" onClick={fermer} className="block w-full py-4 text-center text-[16px]" style={{ color: colors.inkSoft }}>
              Annuler
            </button>
          </>
        )}

        {refus && (
          <p className={`mt-3 ${texteSituation}`} style={{ color: colors.alert }} data-atlas="refus-document-vehicule">
            {refus}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
