"use client";

import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import { creerTarifAction, modifierTarifAction, supprimerTarifAction } from "./actions";

type Tarif = { id: string; intitule: string; prix: string; unite: string | null };
type Champ = "intitule" | "prix" | "unite";

export default function ReglagesClient({ initialTarifs }: { initialTarifs: Tarif[] }) {
  const [tarifs, setTarifs] = useState<Tarif[]>(initialTarifs);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  function modifierLocal(id: string, champ: Champ, valeur: string) {
    setTarifs((cur) => cur.map((t) => (t.id === id ? { ...t, [champ]: valeur } : t)));
  }

  async function persister(id: string, champ: Champ, valeur: string) {
    await modifierTarifAction(id, { [champ]: valeur });
  }

  async function ajouter() {
    setAjoutEnCours(true);
    try {
      const nouveau = await creerTarifAction("", "0");
      setTarifs((cur) => [...cur, { id: nouveau.id, intitule: nouveau.intitule, prix: nouveau.prix, unite: nouveau.unite }]);
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function supprimer(id: string) {
    setTarifs((cur) => cur.filter((t) => t.id !== id));
    await supprimerTarifAction(id);
  }

  return (
    <div className="px-6 pt-5">
      {/* Le prix d'un chantier peut aussi être calculé à partir des paramètres
          de chiffrage quand aucun tarif ne correspond : ne pas laisser croire
          que ces tarifs sont la seule source possible. */}
      <p className="text-[13px]" style={{ color: colors.muted }}>
        Vos tarifs servent en priorité au calcul du prix d&apos;un chantier. Sans tarif correspondant, le prix est
        calculé à partir de vos paramètres de chiffrage.
      </p>

      {tarifs.length === 0 && (
        <p className="mt-5 text-[13px]" style={{ color: colors.muted }}>
          Aucun tarif pour l&apos;instant.
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {tarifs.map((t) => (
          <li key={t.id} className="flex flex-col gap-2 rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
            <div className="flex items-center gap-2">
              <input
                value={t.intitule}
                placeholder="Intitulé (ex. Élagage)"
                aria-label="Intitulé du tarif"
                onChange={(e) => modifierLocal(t.id, "intitule", e.target.value)}
                onBlur={(e) => persister(t.id, "intitule", e.target.value)}
                className="min-w-0 flex-1 rounded-xl border-0 px-3 py-2.5 outline-none"
                style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
              />
              <button
                type="button"
                onClick={() => supprimer(t.id)}
                aria-label="Supprimer ce tarif"
                className="flex-shrink-0 text-[13px]"
                style={{ color: colors.muted }}
              >
                Supprimer
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className={smallCaps} style={{ color: colors.muted }}>
                  Prix (€)
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={t.prix}
                  aria-label="Prix du tarif"
                  onChange={(e) => modifierLocal(t.id, "prix", e.target.value)}
                  onBlur={(e) => persister(t.id, "prix", e.target.value)}
                  className="rounded-xl border-0 px-3 py-2.5 text-right outline-none"
                  style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
                />
              </label>
              {/* L'unité est ce qui autorise la multiplication par une quantité
                  confirmée lors du calcul du prix : sans elle, le tarif est
                  toujours repris tel quel. */}
              <label className="flex flex-col gap-1">
                <span className={smallCaps} style={{ color: colors.muted }}>
                  Unité (facultatif)
                </span>
                <input
                  value={t.unite ?? ""}
                  placeholder="m², heure…"
                  aria-label="Unité du tarif"
                  onChange={(e) => modifierLocal(t.id, "unite", e.target.value)}
                  onBlur={(e) => persister(t.id, "unite", e.target.value)}
                  className="rounded-xl border-0 px-3 py-2.5 outline-none"
                  style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={ajouter}
        disabled={ajoutEnCours}
        className="mt-4 self-start text-[14px] font-medium disabled:opacity-40"
        style={{ color: colors.rust }}
      >
        {ajoutEnCours ? "Ajout…" : "+ Ajouter un tarif"}
      </button>
    </div>
  );
}
