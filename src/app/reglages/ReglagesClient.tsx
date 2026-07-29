"use client";

import { useState } from "react";
import { creerTarifAction, modifierTarifAction, supprimerTarifAction } from "./actions";

type Tarif = { id: string; intitule: string; prix: string };

export default function ReglagesClient({ initialTarifs }: { initialTarifs: Tarif[] }) {
  const [tarifs, setTarifs] = useState<Tarif[]>(initialTarifs);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  function modifierLocal(id: string, champ: "intitule" | "prix", valeur: string) {
    setTarifs((cur) => cur.map((t) => (t.id === id ? { ...t, [champ]: valeur } : t)));
  }

  async function persister(id: string, champ: "intitule" | "prix", valeur: string) {
    await modifierTarifAction(id, { [champ]: valeur });
  }

  async function ajouter() {
    setAjoutEnCours(true);
    try {
      const nouveau = await creerTarifAction("", "0");
      setTarifs((cur) => [...cur, { id: nouveau.id, intitule: nouveau.intitule, prix: nouveau.prix }]);
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function supprimer(id: string) {
    setTarifs((cur) => cur.filter((t) => t.id !== id));
    await supprimerTarifAction(id);
  }

  return (
    <div>
      <div className="p-4">
        <p className="mb-3 text-xs text-ink/40">
          Ces tarifs sont les seuls utilisés pour calculer le prix d&apos;un chantier.
        </p>

        {tarifs.length === 0 ? (
          <p className="text-xs text-ink/40">Aucun tarif pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tarifs.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-card px-4 py-3"
              >
                <input
                  value={t.intitule}
                  onChange={(e) => modifierLocal(t.id, "intitule", e.target.value)}
                  onBlur={(e) => persister(t.id, "intitule", e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink/80 outline-none"
                />
                <input
                  value={t.prix}
                  onChange={(e) => modifierLocal(t.id, "prix", e.target.value)}
                  onBlur={(e) => persister(t.id, "prix", e.target.value)}
                  className="ref-tag w-20 flex-shrink-0 border-0 bg-transparent text-right text-sm font-semibold text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={() => supprimer(t.id)}
                  aria-label="Supprimer ce tarif"
                  className="flex-shrink-0 text-ink/30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={ajouter}
          disabled={ajoutEnCours}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-line py-3 text-ink/60"
        >
          <span>＋</span>
          <span className="font-display font-semibold">Ajouter un tarif</span>
        </button>
      </div>
    </div>
  );
}
