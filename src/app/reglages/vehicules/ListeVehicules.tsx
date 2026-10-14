"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import { NOM_DOCUMENT_VEHICULE, type Echeance, type NatureDocumentVehicule } from "@/lib/vehicules";
import AjoutDocument, { AJOUTER_LA_CARTE_GRISE } from "./AjoutDocument";

type VehiculeDeLaListe = {
  id: string;
  nom: string;
  plaque: string | null;
  etat: { texte: string; ton: Echeance["ton"] } | null;
  assureur: string | null;
  numeroContrat: string | null;
  assistance: string | null;
  documents: NatureDocumentVehicule[];
};

const TEINTE: Record<Echeance["ton"], string> = { calme: colors.muted, proche: colors.or, depasse: colors.alert };

function Plaque({ texte }: { texte: string }) {
  return (
    <span
      className="inline-block rounded-[4px] border px-1.5 text-[12.5px] font-semibold tracking-[0.04em]"
      style={{ borderColor: colors.line, color: colors.ink, fontFamily: "ui-monospace, Menlo, monospace" }}
    >
      {texte}
    </span>
  );
}

/**
 * La liste des véhicules (patron), ou « En cas d'accident » (tous les autres).
 *
 * **Un véhicule naît de sa carte grise** : « Ajouter un véhicule » ouvre la
 * feuille titrée « Ajoutez la carte grise du véhicule » — sa remarque du
 * 14 octobre 2026, sans titre on ne comprenait pas quoi photographier.
 */
export default function ListeVehicules({ patron, vehicules }: { patron: boolean; vehicules: VehiculeDeLaListe[] }) {
  const router = useRouter();
  const [ajout, setAjout] = useState(false);

  if (!patron) {
    const lisibles = vehicules.filter((v) => v.assureur || v.numeroContrat || v.assistance || v.documents.length > 0);
    if (lisibles.length === 0) {
      return (
        <p className="px-6 text-[15px]" style={{ color: colors.muted }}>
          Aucun véhicule pour l’instant.
        </p>
      );
    }
    return (
      <div className="px-6">
        {lisibles.map((v) => (
          <section key={v.id} data-atlas="vehicule-accident" className="mb-9 mt-5">
            <p className={`flex items-center gap-2 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
              {v.nom}
              {v.plaque && <Plaque texte={v.plaque} />}
            </p>
            <p className="mt-1" style={{ fontFamily: font.display, fontSize: 20, color: colors.ink }}>
              En cas d’accident
            </p>
            {[
              ["Assureur", v.assureur],
              ["Numéro de contrat", v.numeroContrat],
            ].map(([etiquette, valeur]) => (
              <p key={etiquette} className="flex justify-between gap-3 border-b py-3 text-[15px]" style={{ borderColor: colors.line }}>
                <span style={{ color: colors.inkSoft }}>{etiquette}</span>
                <span style={{ color: valeur ? colors.ink : colors.muted }}>{valeur ?? "pas encore lu"}</span>
              </p>
            ))}
            {v.assistance && (
              <a
                href={`tel:${v.assistance.replace(/[^\d+]/g, "")}`}
                data-atlas="appeler-assistance"
                className="atlas-plein mt-4 block w-full rounded-full py-3.5 text-center text-[15px] font-medium"
                style={{ backgroundColor: colors.plein, color: surPlein }}
              >
                Appeler l’assistance
              </a>
            )}
            {v.documents.map((n) => (
              <a
                key={n}
                href={`/reglages/vehicules/${v.id}/document/${n}`}
                target="_blank"
                rel="noopener"
                className="flex items-center justify-between border-b py-3"
                style={{ borderColor: colors.line }}
              >
                <span>
                  <span className="block text-[15px]" style={{ color: colors.ink }}>
                    {NOM_DOCUMENT_VEHICULE[n]}
                  </span>
                  {n === "carte_grise" && (
                    <span className="block text-[12.5px]" style={{ color: colors.muted }}>
                      copie, l’originale est dans le véhicule
                    </span>
                  )}
                </span>
                <span className="text-[14px] font-medium" style={{ color: colors.rust }}>
                  Voir
                </span>
              </a>
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="px-6">
      {vehicules.map((v) => (
        <Link
          key={v.id}
          href={`/reglages/vehicules/${v.id}`}
          data-atlas="vehicule"
          className="flex items-center justify-between gap-3 border-b py-3.5"
          style={{ borderColor: colors.line }}
        >
          <span className="min-w-0">
            <span className="block text-[16px] font-medium" style={{ color: colors.ink }}>
              {v.nom}
            </span>
            <span className="mt-0.5 block text-[13px]" style={{ color: colors.muted }}>
              {v.plaque ? <Plaque texte={v.plaque} /> : "Plaque à lire"}
            </span>
          </span>
          <span
            className="max-w-[48%] text-right text-[12.5px] leading-snug"
            style={{ color: v.etat ? TEINTE[v.etat.ton] : colors.muted, fontWeight: v.etat?.ton === "depasse" ? 600 : 400 }}
          >
            {v.etat ? v.etat.texte : v.plaque ? "À jour" : ""}
          </span>
        </Link>
      ))}
      <button
        type="button"
        data-atlas="ajouter-vehicule"
        onClick={() => setAjout(true)}
        className="mt-3 min-h-[44px] text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        + Ajouter un véhicule
      </button>
      <AjoutDocument
        ouverte={ajout}
        quoi={AJOUTER_LA_CARTE_GRISE}
        vehiculeId={null}
        onFermer={() => setAjout(false)}
        onRange={(r) => {
          setAjout(false);
          router.push(`/reglages/vehicules/${r.vehiculeId}`);
        }}
      />
    </div>
  );
}
