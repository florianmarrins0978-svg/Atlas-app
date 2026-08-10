"use client";

import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import ImportTarifs from "./ImportTarifs";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import {
  creerTarifAction,
  modifierTarifAction,
  supprimerTarifAction,
  mettreAJourNombreEquipesAction,
} from "./actions";

type Tarif = { id: string; intitule: string; prix: string; unite: string | null };
type Champ = "intitule" | "prix" | "unite";

export default function ReglagesClient({
  initialTarifs,
  initialNombreEquipes,
}: {
  initialTarifs: Tarif[];
  initialNombreEquipes: number;
}) {
  const [tarifs, setTarifs] = useState<Tarif[]>(initialTarifs);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [nombreEquipes, setNombreEquipes] = useState(initialNombreEquipes);

  async function changerEquipes(valeur: number) {
    // Borné ici comme au serveur : à zéro équipe, plus aucun jour ne serait
    // proposable et rien à l'écran ne l'expliquerait.
    const borne = Math.min(20, Math.max(1, valeur));
    setNombreEquipes(borne);
    const r = await mettreAJourNombreEquipesAction(borne);
    setNombreEquipes(r.nombreEquipes);
  }

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

  // Le retrait réversible, comme partout. Un tarif effacé par erreur ne se
  // retrouve pas : c'est une valeur que le patron a saisie à la main, et rien
  // ne la reconstitue. Le bouton « Supprimer » nu ne laissait aucun retour.
  const retraits = useRetraits({
    valider: async (id) => {
      await supprimerTarifAction(id);
      setTarifs((cur) => cur.filter((t) => t.id !== id));
    },
  });
  const tarifsVisibles = tarifs.filter((t) => !retraits.estRetire(t.id));

  return (
    <div className="px-6 pt-5">
      {/* Le nombre d'équipes commande le planning : il décide combien de
          chantiers peuvent tomber le même jour. Il vit ici plutôt que sur
          l'écran d'envoi parce qu'il change une ou deux fois par an, pas à
          chaque devis. */}
      <div className="mb-7 flex flex-col gap-2 rounded-[4px] p-4" style={{ backgroundColor: colors.card }}>
        <span className={smallCaps} style={{ color: colors.muted }}>
          Mes équipes
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Une équipe de moins"
            onClick={() => changerEquipes(nombreEquipes - 1)}
            disabled={nombreEquipes <= 1}
            className="h-10 w-10 flex-shrink-0 rounded-full text-[20px] font-medium disabled:opacity-30"
            style={{ backgroundColor: colors.rustTint, color: colors.rust }}
          >
            −
          </button>
          <span className="min-w-[9ch] text-center text-[17px]" style={{ color: colors.ink }}>
            {nombreEquipes} équipe{nombreEquipes > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            aria-label="Une équipe de plus"
            onClick={() => changerEquipes(nombreEquipes + 1)}
            disabled={nombreEquipes >= 20}
            className="h-10 w-10 flex-shrink-0 rounded-full text-[20px] font-medium disabled:opacity-30"
            style={{ backgroundColor: colors.rustTint, color: colors.rust }}
          >
            +
          </button>
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: colors.muted }}>
          {nombreEquipes === 1
            ? "Un seul chantier à la fois : un jour déjà pris n'est plus proposé à vos clients."
            : `Jusqu'à ${nombreEquipes} chantiers en même temps. Un jour reste proposé tant que vos ${nombreEquipes} équipes ne sont pas toutes prises.`}
        </p>
      </div>

      {/* Le prix d'un chantier peut aussi être calculé à partir des paramètres
          de chiffrage quand aucun tarif ne correspond : ne pas laisser croire
          que ces tarifs sont la seule source possible. */}
      <p className="text-[13px]" style={{ color: colors.muted }}>
        Vos tarifs servent en priorité au calcul du prix d&apos;un chantier. Sans tarif correspondant, le prix est
        calculé à partir de vos paramètres de chiffrage.
      </p>

      {/* Reprendre une liste de prix déjà écrite ailleurs, plutôt que la
          retaper ligne à ligne. Placé JUSTE avant la liste : c'est là qu'il
          constate qu'elle est vide, et donc là que la question se pose. */}
      <ImportTarifs onImporte={(nouveaux) => setTarifs(nouveaux)} />

      {tarifsVisibles.length === 0 && (
        <p className="mt-5 text-[13px]" style={{ color: colors.muted }}>
          Aucun tarif pour l&apos;instant.
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {tarifs.map((t) => (
          <li key={t.id}>
          <LigneRetirable
            libelle={t.intitule ? `le tarif « ${t.intitule} »` : "ce tarif"}
            retiree={retraits.estRetire(t.id)}
            onRetirer={() => retraits.retirer(t.id, t.intitule ? `le tarif « ${t.intitule} »` : "ce tarif")}
            // Un tarif porte trois champs sur deux rangées : 190 px suffisent,
            // les 170 par défaut le tronqueraient au repos.
            hauteurMax={200}
            plage={{ fond: colors.card }}
            className="flex"
          >
          <div className="flex w-full flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <input
                value={t.intitule}
                placeholder="Intitulé (ex. Élagage)"
                aria-label="Intitulé du tarif"
                onChange={(e) => modifierLocal(t.id, "intitule", e.target.value)}
                onBlur={(e) => persister(t.id, "intitule", e.target.value)}
                className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
                style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
              />
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
                  className="rounded-[4px] border-0 px-3 py-2.5 text-right outline-none"
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
                  className="rounded-[4px] border-0 px-3 py-2.5 outline-none"
                  style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
                />
              </label>
            </div>
          </div>
          </LigneRetirable>
          </li>
        ))}
      </ul>

      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
        className="mt-3 !mx-0"
      />

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
