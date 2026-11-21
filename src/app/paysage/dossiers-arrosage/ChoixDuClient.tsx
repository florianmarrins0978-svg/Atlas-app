"use client";

import { useEffect, useMemo, useState } from "react";
import { colors } from "@/lib/design-tokens";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
import { sesClientsAction } from "./actions";

/**
 * RELIER UN DOSSIER À UNE FICHE QUI EXISTE — facultatif (sa réponse 1, le
 * 21 novembre 2026) : l'outil sert en visite de devis, avant que le client
 * existe. Choisir un client remplit le nom du dossier ; le toucher de nouveau
 * le délie. La barre est celle de l'appli (`ChampRecherche`), sa règle.
 */
export default function ChoixDuClient({
  choisi,
  onChoisi,
}: {
  choisi: { id: string; nom: string } | null;
  onChoisi: (c: { id: string; nom: string } | null) => void;
}) {
  const [clients, setClients] = useState<{ id: string; nom: string }[] | null>(null);
  const [cherche, setCherche] = useState("");
  useEffect(() => {
    let vivant = true;
    sesClientsAction().then((c) => vivant && setClients(c));
    return () => {
      vivant = false;
    };
  }, []);
  const trouves = useMemo(() => {
    const q = cherche.trim().toLowerCase();
    return (clients ?? []).filter((c) => q === "" || c.nom.toLowerCase().includes(q)).slice(0, 6);
  }, [clients, cherche]);

  return (
    <div data-atlas="choix-du-client">
      <p className="mb-[6px] mt-[18px] text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        Sa fiche client
      </p>
      <ChampRecherche valeur={cherche} onChange={setCherche} placeholder="Le nom du client" ariaLabel="Chercher un client" dataAtlas="chercher-client" />
      <div className="mt-1" role="radiogroup" aria-label="Sa fiche client">
        {trouves.map((c) => {
          const oui = choisi?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={oui}
              data-atlas="client-du-dossier"
              onClick={() => onChoisi(oui ? null : c)}
              className="flex min-h-[48px] w-full items-center gap-3 border-0 bg-transparent px-1 text-left text-[16px]"
              style={{ color: oui ? colors.orTexte : colors.ink, fontWeight: oui ? 600 : 400, borderBottom: `1px solid ${colors.line}` }}
            >
              <span className="min-w-0 flex-1">{c.nom}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-[6px] text-[13.5px]" style={{ color: colors.muted }}>
        Facultatif. Le nom se remplit tout seul.
      </p>
    </div>
  );
}
