"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { resumeDuDossier } from "@/lib/arrosage/mots-des-dossiers";
import TuileIcone from "@/components/atlas/TuileIcone";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import { Feuille } from "../arrosage/FeuillePiece";
import Icone from "../arrosage/Icones";
import ChoixDuClient from "./ChoixDuClient";
import { creerDossierAction, type DossierPourLaFeuille } from "./actions";

/**
 * La liste de ses dossiers, le plus récent en tête, et « Nouveau dossier » :
 * sa planche du 21 novembre 2026. Les lignes reprennent celles de Paysage
 * (une tuile, un nom, ce qu'il y a dedans).
 */
export default function MesDossiers({ dossiers }: { dossiers: DossierPourLaFeuille[] }) {
  const [ouverte, setOuverte] = useState(false);
  const maintenant = new Date();
  return (
    <div className="pb-[120px]" data-atlas="mes-dossiers-ecran">
      <div className="mx-[22px] mt-2">
        <button
          type="button"
          onClick={() => setOuverte(true)}
          data-atlas="nouveau-dossier"
          className="mt-[10px] flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full bg-transparent text-[17px] font-semibold"
          style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
        >
          <Icone nom="plus" />
          Nouveau dossier
        </button>
      </div>
      {dossiers.length > 0 ? (
        <nav aria-label="Mes dossiers" className="mx-4 mt-[18px] overflow-hidden" style={{ backgroundColor: colors.card, borderRadius: 4 }}>
          {dossiers.map((d, i) => (
            <Link
              key={d.id}
              href={`/paysage/dossiers-arrosage/${d.id}`}
              data-atlas="ligne-dossier"
              className="relative flex min-h-[64px] w-full items-center gap-[14px] py-[10px] pl-[14px] pr-[18px] text-left"
            >
              {i > 0 && <span aria-hidden="true" className="absolute right-0 top-0 h-px" style={{ left: 68, backgroundColor: colors.line }} />}
              <TuileIcone>
                <Icone nom="dossier" />
              </TuileIcone>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                  {d.nom}
                </span>
                {d.client && (
                  <span className="mt-[3px] block text-[14px]" style={{ color: colors.inkSoft }}>
                    Fiche de {d.client}
                  </span>
                )}
                <span className="mt-[3px] block text-[14px]" style={{ color: colors.inkSoft }}>
                  {resumeDuDossier(d.plans, d.dernier ? new Date(d.dernier) : null, maintenant)}
                </span>
              </span>
              <span aria-hidden="true" className="h-2 w-2 rotate-45" style={{ flex: "none", borderRight: `1.5px solid ${colors.chevron}`, borderTop: `1.5px solid ${colors.chevron}` }} />
            </Link>
          ))}
        </nav>
      ) : (
        <p className="mx-[26px] mt-[22px] text-[15px]" style={{ color: colors.inkSoft }} data-atlas="aucun-dossier">
          Aucun dossier encore.
        </p>
      )}
      {ouverte && <NouveauDossier onFermer={() => setOuverte(false)} />}
    </div>
  );
}

function NouveauDossier({ onFermer }: { onFermer: () => void }) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [client, setClient] = useState<{ id: string; nom: string } | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  function creer() {
    const f = new FormData();
    f.set("nom", nom);
    if (client) f.set("clientId", client.id);
    demarrer(async () => {
      const r = await creerDossierAction(f);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      onFermer();
      router.refresh();
    });
  }
  return (
    <Feuille titre="Nouveau dossier" repere="feuille-nouveau-dossier" onFermer={onFermer}>
      <ChoixDuClient
        choisi={client}
        onChoisi={(c) => {
          setClient(c);
          if (c) setNom(`Plan d’arrosage de ${c.nom}`);
        }}
      />
      <label className="mb-[6px] mt-[18px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor="nom-du-dossier">
        Nom du dossier
      </label>
      <input
        id="nom-du-dossier"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Plan d’arrosage de…"
        maxLength={120}
        className="block w-full rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
        style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      />
      {refus && (
        <p className="mt-3 text-[14.5px] font-semibold" style={{ color: colors.alert }} role="alert">
          {refus}
        </p>
      )}
      <button
        type="button"
        onClick={creer}
        disabled={enCours}
        data-atlas="creer-dossier"
        className="atlas-plein mt-[14px] flex min-h-[56px] w-full items-center justify-center rounded-full border-0 text-[17px] font-semibold"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        {enCours ? <PointsQuiSoufflent /> : "Créer le dossier"}
      </button>
    </Feuille>
  );
}
