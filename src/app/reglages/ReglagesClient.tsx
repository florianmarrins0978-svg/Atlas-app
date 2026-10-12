"use client";

import { useEffect, useRef, useState } from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { normaliserUnite } from "@/lib/unites-tarif";
import ImportTarifs from "./ImportTarifs";
import { PastillesUnite } from "@/components/atlas/ChoixUnite";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import {
  creerTarifAction,
  modifierTarifAction,
  supprimerTarifAction,
} from "./actions";

type Tarif = { id: string; intitule: string; prix: string; unite: string | null };
type Champ = "intitule" | "prix" | "unite";

/**
 * Ses tarifs, une ligne chacun.
 *
 * **Le dessin validé le 11 octobre 2026** (`appli/mes-tarifs-corrige.html`,
 * version Corrigé) : chaque tarif tenait dans une carte de quatre cases, et
 * quatre tarifs ne se lisaient plus d'un coup. Une ligne porte le nom à gauche,
 * le prix à droite, l'unité dessous ; on la touche pour la modifier, elle
 * s'ouvre sur place. Rien de ce qui s'enregistre ne change : chaque champ part
 * quand on le quitte, par la même action qu'avant.
 */
export default function ReglagesClient({ initialTarifs }: { initialTarifs: Tarif[] }) {
  const [tarifs, setTarifs] = useState<Tarif[]>(initialTarifs);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  // Une seule ligne ouverte à la fois : deux formulaires dépliés l'un sous
  // l'autre redonneraient le mur de cases que la planche a défait.
  const [ouvert, setOuvert] = useState<string | null>(null);

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
      // Un tarif neuf n'a ni nom ni prix : replié, il ne serait qu'une ligne
      // vide à « 0,00 € » qu'il faudrait encore toucher.
      setOuvert(nouveau.id);
    } finally {
      setAjoutEnCours(false);
    }
  }

  // Le retrait réversible, comme partout. Un tarif effacé par erreur ne se
  // retrouve pas : c'est une valeur que le patron a saisie à la main, et rien
  // ne la reconstitue.
  const retraits = useRetraits({
    valider: async (id) => {
      await supprimerTarifAction(id);
      setTarifs((cur) => cur.filter((t) => t.id !== id));
    },
  });
  const tarifsVisibles = tarifs.filter((t) => !retraits.estRetire(t.id));

  return (
    // Aucun retrait horizontal ici : la rubrique qui l'accueille pose déjà les
    // 26 px de la charte.
    <div>
      {tarifsVisibles.length === 0 ? (
        <p className="text-[14px]" style={{ color: colors.inkSoft }}>
          Aucun tarif pour l&apos;instant.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[16px]" style={{ backgroundColor: colors.card }}>
          {tarifsVisibles.map((t, i) => {
            const libelle = t.intitule ? `le tarif « ${t.intitule} »` : "ce tarif";
            return (
              <li
                key={t.id}
                data-atlas="tarif"
                style={i === 0 ? undefined : { borderTop: `1px solid ${colors.line}` }}
              >
                {ouvert === t.id ? (
                  <LigneOuverte
                    tarif={t}
                    onModifier={(champ, valeur) => modifierLocal(t.id, champ, valeur)}
                    onEnregistrer={(champ, valeur) => void persister(t.id, champ, valeur)}
                    onRetirer={() => {
                      setOuvert(null);
                      retraits.retirer(t.id, libelle);
                    }}
                    libelle={libelle}
                    onFermer={() => setOuvert(null)}
                  />
                ) : (
                  <LigneRepliee tarif={t} onOuvrir={() => setOuvert(t.id)} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
        // `mx-0!`, et non `!mx-0` : en Tailwind 4 le modificateur s'écrit en
        // SUFFIXE. Écrite à la mode de la version 3, la classe ne faisait rien
        // — le tiroir gardait les 26 px de marge du composant et se décalait de
        // la liste qu'il commente.
        className="mt-3 mx-0!"
      />

      {/* Ajouter est le geste de tous les jours, en or comme les autres ajouts
          de l'application ; reprendre ses prix d'un fichier ne sert qu'une
          fois, et passe dessous, à voix basse (planche du 11 octobre 2026). */}
      <div className="mt-2 flex flex-col">
        <button
          type="button"
          onClick={ajouter}
          disabled={ajoutEnCours}
          className="min-h-[48px] self-start text-[14px] disabled:opacity-40"
          style={{ color: colors.or }}
        >
          {ajoutEnCours ? "Ajout…" : "+ Ajouter un tarif"}
        </button>
        <ImportTarifs onImporte={(nouveaux) => setTarifs(nouveaux)} />
      </div>
    </div>
  );
}

/**
 * Le tarif replié : le nom à gauche, le prix à droite, l'unité dessous.
 *
 * **« par m² », et non « le m² »** : une unité libre (le stère, l'arbre) n'a
 * pas de genre qu'on puisse lire dans la donnée, et la règle du 22 septembre
 * 2026 interdit de le deviner. Sans unité, le prix est écrit seul : « Choisir… »
 * disait une case à remplir là où il n'y a rien à faire.
 */
function LigneRepliee({ tarif, onOuvrir }: { tarif: Tarif; onOuvrir: () => void }) {
  const unite = normaliserUnite(tarif.unite ?? "");
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="flex min-h-[62px] w-full items-center gap-[14px] px-[18px] py-3 text-left"
    >
      <span
        className="min-w-0 flex-1 text-[16px] leading-[1.3]"
        style={{ color: tarif.intitule ? colors.ink : colors.inkSoft }}
      >
        {tarif.intitule || "Sans nom"}
      </span>
      <span className="flex-none text-right">
        <span
          className="block whitespace-nowrap text-[16px] font-medium leading-[1.2] tabular-nums"
          style={{ color: colors.ink }}
        >
          {enEuros(tarif.prix)}
        </span>
        {unite && (
          <span className="mt-0.5 block whitespace-nowrap text-[12.5px]" style={{ color: colors.inkSoft }}>
            par {unite}
          </span>
        )}
      </span>
    </button>
  );
}

/** Le tarif ouvert sur place : nom, prix, unité, puis Retirer et Fermer. */
function LigneOuverte({
  tarif,
  libelle,
  onModifier,
  onEnregistrer,
  onRetirer,
  onFermer,
}: {
  tarif: Tarif;
  libelle: string;
  onModifier: (champ: Champ, valeur: string) => void;
  onEnregistrer: (champ: Champ, valeur: string) => void;
  onRetirer: () => void;
  onFermer: () => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);

  // **Sans cela, toucher une ligne du bas ne montre rien.** La ligne s'ouvre
  // sous le bord de l'écran, et le geste paraît sans effet. Hérité du bandeau
  // d'unités qu'elle remplace, où ce défaut avait été vu sur une capture.
  useEffect(() => {
    cadre.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const champ = "block min-h-[48px] w-full rounded-[10px] border-0 px-[14px] py-3 outline-none";
  const styleChamp = { backgroundColor: colors.rustTint, color: colors.ink, fontSize: "16px" };

  return (
    <div
      ref={cadre}
      className="px-[18px] pt-4"
      // La barre de navigation est posée PAR-DESSUS la page : amener la ligne
      // « au bord de l'écran » cacherait Retirer et Fermer. Ces pixels-là sont
      // sa hauteur, marge comprise.
      style={{ scrollMarginBottom: 96 }}
    >
      <label className="mb-[14px] block">
        <span className={`mb-1.5 block ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          Nom
        </span>
        <input
          value={tarif.intitule}
          aria-label="Nom du tarif"
          autoComplete="off"
          onChange={(e) => onModifier("intitule", e.target.value)}
          onBlur={(e) => onEnregistrer("intitule", e.target.value)}
          className={champ}
          style={styleChamp}
        />
      </label>

      <label className="mb-[14px] block">
        <span className={`mb-1.5 block ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          Prix
        </span>
        <span className="relative block w-[60%]">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={tarif.prix}
            aria-label="Prix du tarif"
            onChange={(e) => onModifier("prix", e.target.value)}
            onBlur={(e) => onEnregistrer("prix", e.target.value)}
            className={`${champ} pr-[34px] text-right tabular-nums`}
            style={styleChamp}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[16px]"
            style={{ color: colors.inkSoft }}
          >
            €
          </span>
        </span>
      </label>

      {/* L'unité est ce qui autorise la multiplication par une quantité
          confirmée lors du calcul du prix : sans elle, le tarif est toujours
          repris tel quel. Et comme le rapprochement se fait à la lettre près,
          elle se CHOISIT depuis le 14 août 2026 (`src/lib/unites-tarif.ts`). */}
      <div className="mb-[14px]">
        <PastillesUnite
          valeur={tarif.unite}
          onChoisir={(unite) => {
            onModifier("unite", unite);
            onEnregistrer("unite", unite);
          }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between" style={{ borderTop: `1px solid ${colors.line}` }}>
        <button
          type="button"
          onClick={onRetirer}
          aria-label={`Retirer ${libelle}`}
          className={`min-h-[48px] ${libelleCaps}`}
          style={{ color: colors.alert }}
        >
          Retirer
        </button>
        {/* Fermer ne fait que replier : chaque champ s'est déjà enregistré en
            le quittant. */}
        <button
          type="button"
          onClick={onFermer}
          className="min-h-[48px] text-[15px] font-medium"
          style={{ color: colors.rust }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
