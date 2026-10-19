"use client";

import { useEffect, useRef, useState } from "react";
import { colors, surPlein } from "@/lib/design-tokens";
import type { LigneDemandeEnvoyee } from "@/server/db/schema";
import { enregistrerLaDemandeAction, prixDesFournisseursAction } from "./actions-fournisseurs";

/**
 * LA LISTE ENVOYÉE S'ENREGISTRE CHEZ LE FOURNISSEUR — sa demande du 19 octobre
 * 2026 : *« quand j'envoie ma liste de pièces à Aqua Plus, il faut que ma
 * liste s'enregistre dans une catégorie »*. Elle part dans Réglages, sur la
 * fiche du fournisseur, « Demandes envoyées », dès qu'il copie ou envoie.
 *
 * Il choisit chez qui ; un seul fournisseur se choisit tout seul. Pour un autre
 * rôle que le patron, rien ne s'affiche et rien ne s'enregistre.
 */
export default function EnregistrerLaDemande({ titre, lignes, parti }: { titre: string; lignes: LigneDemandeEnvoyee[]; parti: number }) {
  const [fournisseurs, setFournisseurs] = useState<{ id: string; nom: string }[] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const deja = useRef(0);
  useEffect(() => {
    prixDesFournisseursAction().then(
      (d) => {
        setFournisseurs(d?.fournisseurs ?? null);
        if (d?.fournisseurs.length === 1) setChoisi(d.fournisseurs[0].id);
      },
      () => setFournisseurs(null)
    );
  }, []);
  useEffect(() => {
    if (!parti || parti === deja.current || !choisi) return;
    deja.current = parti;
    enregistrerLaDemandeAction(choisi, titre, lignes).then((r) =>
      setNote(r.ok ? `Enregistrée chez ${r.nom}, dans Réglages, Demandes envoyées, le ${new Date().toLocaleDateString("fr-FR")}.` : r.raison)
    );
  }, [parti, choisi, titre, lignes]);

  if (!fournisseurs || fournisseurs.length === 0) return null;
  return (
    <div className="mt-3" data-atlas="enregistrer-chez">
      <div className="flex flex-wrap gap-[6px]" role="group" aria-label="Chez">
        {fournisseurs.map((f) => {
          const appuye = f.id === choisi;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={appuye}
              onClick={() => setChoisi(f.id)}
              className={`rounded-full border px-3 py-2 text-[13.5px] ${appuye ? "atlas-plein" : ""}`}
              style={appuye ? { backgroundColor: colors.plein, borderColor: colors.plein, color: surPlein } : { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }}
            >
              {f.nom}
            </button>
          );
        })}
      </div>
      {note && (
        <p className="mt-3 text-[13px]" style={{ color: colors.muted }} data-atlas="demande-enregistree">
          {note}
        </p>
      )}
    </div>
  );
}
