"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { ceQueLaSuppressionEfface, quandEnregistre } from "@/lib/arrosage/mots-des-dossiers";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import { oublierCetEcran } from "@/components/atlas/journal-navigateur";
import { Feuille } from "../arrosage/FeuillePiece";
import ChoixDuClient from "./ChoixDuClient";
import { renommerDossierAction, supprimerDossierAction } from "./actions";

type Dossier = {
  id: string;
  nom: string;
  client: { id: string; nom: string } | null;
  versions: { id: string; version: number; resume: string; avecPhoto: boolean; le: string }[];
};

/**
 * Un dossier ouvert — sa planche du 21 novembre 2026. Une version par
 * enregistrement, jamais écrasée ; une version ne se supprime pas seule, le
 * dossier entier, oui (`ARCHITECTURE.md` §599).
 *
 * **Supprimer, c'est oublier** (sa réponse 2) : la feuille le dit en deux
 * phrases, sans mécanisme, avant qu'il appuie.
 */
export default function DossierOuvert({ dossier }: { dossier: Dossier }) {
  const [feuille, setFeuille] = useState<"renommer" | "supprimer" | null>(null);
  const maintenant = new Date();
  return (
    <div className="pb-[120px]" data-atlas="dossier-ouvert">
      {dossier.client && (
        <p className="mx-[26px] mt-1">
          <Link href={`/clients/${dossier.client.id}`} className="inline-flex min-h-[40px] items-center text-[15px] font-semibold" style={{ color: colors.orTexte }} data-atlas="fiche-du-client">
            Fiche de {dossier.client.nom}
          </Link>
        </p>
      )}
      {dossier.versions.length > 0 ? (
        <nav aria-label="Les plans du dossier" className="mx-4 mt-[14px] overflow-hidden" style={{ backgroundColor: colors.card, borderRadius: 4 }}>
          {dossier.versions.map((v, i) => (
            <Link
              key={v.id}
              href={`/paysage/dossiers-arrosage/${dossier.id}/${v.id}`}
              data-atlas={`version-${v.version}`}
              className="relative flex min-h-[64px] w-full items-center gap-[14px] py-[10px] pl-[18px] pr-[18px] text-left"
            >
              {i > 0 && <span aria-hidden="true" className="absolute right-0 top-0 h-px" style={{ left: 18, backgroundColor: colors.line }} />}
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                  {quandEnregistre(new Date(v.le), maintenant)}
                </span>
                <span className="mt-[3px] block text-[14px]" style={{ color: colors.inkSoft }}>
                  {v.resume}
                </span>
              </span>
              <span aria-hidden="true" className="h-2 w-2 rotate-45" style={{ flex: "none", borderRight: `1.5px solid ${colors.chevron}`, borderTop: `1.5px solid ${colors.chevron}` }} />
            </Link>
          ))}
        </nav>
      ) : (
        <p className="mx-[26px] mt-[14px] text-[14px]" style={{ color: colors.muted }}>
          Aucun plan encore : faites le plan, puis « Enregistrer dans un dossier ».
        </p>
      )}
      <div className="mx-[22px] mt-[26px] flex flex-col items-start">
        <button type="button" onClick={() => setFeuille("renommer")} data-atlas="renommer-dossier" className="min-h-[48px] border-0 bg-transparent px-1 text-[16px] font-semibold" style={{ color: colors.ink }}>
          Renommer
        </button>
        <button type="button" onClick={() => setFeuille("supprimer")} data-atlas="supprimer-dossier" className="min-h-[48px] border-0 bg-transparent px-1 text-[16px] font-semibold" style={{ color: colors.alert }}>
          Supprimer le dossier
        </button>
      </div>
      {feuille === "renommer" && <Renommer dossier={dossier} onFermer={() => setFeuille(null)} />}
      {feuille === "supprimer" && <Supprimer dossier={dossier} onFermer={() => setFeuille(null)} />}
    </div>
  );
}

function Renommer({ dossier, onFermer }: { dossier: Dossier; onFermer: () => void }) {
  const router = useRouter();
  const [nom, setNom] = useState(dossier.nom);
  const [client, setClient] = useState(dossier.client);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  function garder() {
    const f = new FormData();
    f.set("nom", nom);
    if (client) f.set("clientId", client.id);
    demarrer(async () => {
      const r = await renommerDossierAction(dossier.id, f);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      onFermer();
      router.refresh();
    });
  }
  return (
    <Feuille titre="Renommer" repere="feuille-renommer" onFermer={onFermer}>
      <label className="mb-[6px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor="nouveau-nom">
        Nom du dossier
      </label>
      <input
        id="nouveau-nom"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        maxLength={120}
        className="block w-full rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
        style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      />
      <ChoixDuClient choisi={client} onChoisi={setClient} />
      {refus && (
        <p className="mt-3 text-[14.5px] font-semibold" style={{ color: colors.alert }} role="alert">
          {refus}
        </p>
      )}
      <button
        type="button"
        onClick={garder}
        disabled={enCours}
        data-atlas="garder-le-nom"
        className="atlas-plein mt-[14px] flex min-h-[56px] w-full items-center justify-center rounded-full border-0 text-[17px] font-semibold"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        {enCours ? <PointsQuiSoufflent /> : "Garder ce nom"}
      </button>
    </Feuille>
  );
}

function Supprimer({ dossier, onFermer }: { dossier: Dossier; onFermer: () => void }) {
  const router = useRouter();
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  function supprimer() {
    demarrer(async () => {
      const r = await supprimerDossierAction(dossier.id);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      // **Le dossier et ses plans sortent DU JOURNAL avant qu'on les quitte**,
      // comme une fiche client effacée (`SupprimerCeClient.tsx`) : la flèche de
      // « Mes dossiers » ramenait sinon sur ce dossier, qui ne mène plus à rien.
      const ici = `/paysage/dossiers-arrosage/${dossier.id}`;
      for (const v of dossier.versions) oublierCetEcran(`${ici}/${v.id}`);
      oublierCetEcran(ici);
      router.replace("/paysage/dossiers-arrosage");
      router.refresh();
    });
  }
  return (
    <Feuille titre="Supprimer ce dossier ?" repere="feuille-supprimer" onFermer={onFermer} garder>
      <p className="text-[16px] leading-[1.5]" style={{ color: colors.ink }}>
        {ceQueLaSuppressionEfface({ plans: dossier.versions.length, photo: dossier.versions.some((v) => v.avecPhoto), client: dossier.client !== null })}
      </p>
      <p className="mt-3 text-[14.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
        Le calcul, sans rien qui désigne votre client, reste gardé 5 ans : la trace de ce que Cause a rendu.
      </p>
      {refus && (
        <p className="mt-3 text-[14.5px] font-semibold" style={{ color: colors.alert }} role="alert">
          {refus}
        </p>
      )}
      <button
        type="button"
        onClick={supprimer}
        disabled={enCours}
        data-atlas="confirmer-la-suppression"
        className="atlas-plein mt-[18px] flex min-h-[56px] w-full items-center justify-center rounded-full border-0 text-[17px] font-semibold"
        style={{ backgroundColor: colors.alert, color: surPlein }}
      >
        {enCours ? <PointsQuiSoufflent /> : "Supprimer"}
      </button>
    </Feuille>
  );
}
