"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { NOM_DOCUMENT_VEHICULE, type Echeance, type NatureDocumentVehicule } from "@/lib/vehicules";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import AjoutDocument, { AJOUTER_LA_CARTE_GRISE } from "./AjoutDocument";
import Picto from "@/components/atlas/reglages/Picto";
import Plaque from "./Plaque";
import { encreDuTon, tonDuVehicule } from "./etat";

type VehiculeDeLaListe = {
  id: string;
  nom: string;
  plaque: string | null;
  etat: { texte: string; ton: Echeance["ton"] } | null;
  assureur: string | null;
  numeroContrat: string | null;
  assistance: string | null;
  documents: NatureDocumentVehicule[];
  /** « la carte grise », « l'assurance » : ce que la fiche réclame encore. Vide chez le salarié. */
  manquants: string[];
};

/**
 * La liste des véhicules (patron), ou « En cas d'accident » (tous les autres).
 *
 * **Un véhicule naît de sa carte grise** : « Ajouter un véhicule » ouvre la
 * feuille titrée « Ajoutez la carte grise du véhicule » — sa remarque du
 * 14 octobre 2026, sans titre on ne comprenait pas quoi photographier.
 *
 * **Chaque camion dit son état par sa couleur** (planche du 26 octobre 2026,
 * `appli/soignee/reglages-vehicules.html`) : le camion devant le nom prend le
 * ton de son échéance, et la phrase garde ses mots, « Contrôle technique avant
 * le 5 novembre ». « Ajouter un véhicule » devient le bouton plein, au-dessus
 * de la barre.
 */
export default function ListeVehicules({ patron, vehicules }: { patron: boolean; vehicules: VehiculeDeLaListe[] }) {
  const router = useRouter();
  const [ajout, setAjout] = useState(false);

  if (!patron) {
    const lisibles = vehicules.filter((v) => v.assureur || v.numeroContrat || v.assistance || v.documents.length > 0);
    if (lisibles.length === 0) return <Vide />;
    return (
      <div className="mx-[22px] mt-7">
        {lisibles.map((v) => (
          <section
            key={v.id}
            data-atlas="vehicule-accident"
            className="mb-3.5 rounded-[6px] p-[18px]"
            style={{ backgroundColor: colors.card }}
          >
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <PastilleIcone>
                <Picto nom="vehicule" />
              </PastilleIcone>
              <span className="text-[18px] font-semibold leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                {v.nom}
              </span>
              {v.plaque && <Plaque texte={v.plaque} />}
            </p>
            <p className="mt-3.5 text-[20px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
              En cas d’accident
            </p>
            {[
              ["Assureur", v.assureur],
              ["Numéro de contrat", v.numeroContrat],
            ].map(([etiquette, valeur]) => (
              <p
                key={etiquette}
                className="flex items-baseline justify-between gap-3 py-[13px] text-[15.5px]"
                style={{ borderTop: `1px solid ${colors.line}` }}
              >
                <span style={{ color: colors.inkSoft }}>{etiquette}</span>
                {valeur ? (
                  <span className="text-right text-[17px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
                    {valeur}
                  </span>
                ) : (
                  <span className="text-right text-[15px]" style={{ color: colors.inkSoft }}>
                    pas encore lu
                  </span>
                )}
              </p>
            ))}
            {/* **Vert clair, et plus plein** (planche du 26 octobre 2026) : il y
                en a un par camion, et un écran ne porte qu'un bouton plein. Le
                vert est celui de ce qui marche : l'aide qui répond. */}
            {v.assistance && (
              <a
                href={`tel:${v.assistance.replace(/[^\d+]/g, "")}`}
                data-atlas="appeler-assistance"
                className="mt-1.5 flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold"
                style={{ backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }}
              >
                <Picto nom="telephone" />
                Appeler l’assistance
              </a>
            )}
            {v.documents.length > 0 && (
              <div className="mt-2">
                {v.documents.map((n, i) => (
                  <a
                    key={n}
                    href={`/reglages/vehicules/${v.id}/document/${n}`}
                    target="_blank"
                    rel="noopener"
                    className="flex min-h-[68px] items-center gap-3.5 py-3"
                    style={{ borderTop: i > 0 ? `1px solid ${colors.line}` : undefined }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                        {NOM_DOCUMENT_VEHICULE[n]}
                      </span>
                      {n === "carte_grise" && (
                        <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
                          copie, l’originale est dans le véhicule
                        </span>
                      )}
                    </span>
                    <span className="flex-none text-[16px] font-semibold" style={{ color: colors.or }}>
                      Voir
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    );
  }

  return (
    <>
      {vehicules.length === 0 ? (
        <Vide>Ajoutez la carte grise : Atlas y lit la plaque, le modèle et le poids.</Vide>
      ) : (
        <div className="mx-[22px] mt-7 overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
          {vehicules.map((v, i) => {
            const ton = tonDuVehicule(v.etat?.ton ?? null, v.plaque);
            return (
              <Link
                key={v.id}
                href={`/reglages/vehicules/${v.id}`}
                data-atlas="vehicule"
                className="flex min-h-[68px] items-center gap-3.5 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${colors.line}` : undefined }}
              >
                {/* Le camion au ton de son état ; sans rien de lu, l'ambre de ce
                    qui reste à faire. L'or de la pastille sans ton est celui des
                    quinze jours. */}
                <PastilleIcone ton={ton === null ? "ambre" : ton === "or" ? undefined : ton}>
                  <Picto nom="vehicule" />
                </PastilleIcone>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      className="text-[18px] font-semibold leading-[1.25]"
                      style={{ fontFamily: font.display, color: colors.ink }}
                    >
                      {v.nom}
                    </span>
                    {v.plaque ? (
                      <Plaque texte={v.plaque} />
                    ) : (
                      <span className="text-[14px]" style={{ color: colors.inkSoft }}>
                        Plaque à lire
                      </span>
                    )}
                  </span>
                  {ton && (
                    <span
                      className="relative mt-1 block pl-[15px] text-[15px] font-semibold leading-[1.4]"
                      style={{ color: encreDuTon(ton) }}
                    >
                      <span
                        aria-hidden
                        className="absolute left-0 top-[7px] h-2 w-2 rounded-full"
                        style={{ backgroundColor: "currentColor" }}
                      />
                      {v.etat ? v.etat.texte : "À jour"}
                    </span>
                  )}
                  {v.manquants.length > 0 && (
                    <span className="mt-[3px] block text-[14px] leading-[1.4]" style={{ color: colors.carteAmbreTexte }}>
                      À ajouter : {v.manquants.join(", ")}.
                    </span>
                  )}
                </span>
                <span className="flex-none" style={{ color: colors.or }}>
                  <Picto nom="suivant" taille={20} epaisseur={2} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <ActionBas>
        <button
          type="button"
          data-atlas="ajouter-vehicule"
          onClick={() => setAjout(true)}
          className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          <Picto nom="plus" />
          Ajouter un véhicule
        </button>
      </ActionBas>
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
    </>
  );
}

/** Aucun véhicule : le camion, une phrase, et ce qu'il faut faire quand il y a un geste. */
function Vide({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-[22px] px-2 pb-6 pt-11 text-center">
      <span className="mx-auto mb-3.5 block w-fit" style={{ color: colors.or }}>
        <Picto nom="vehicule" taille={40} epaisseur={1.4} />
      </span>
      <p className="text-[22px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
        Aucun véhicule pour l’instant.
      </p>
      {children && (
        <p className="mx-auto mt-2 max-w-[26em] text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          {children}
        </p>
      )}
    </div>
  );
}
