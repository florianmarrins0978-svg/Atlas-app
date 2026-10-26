"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { normaliserUnite } from "@/lib/unites-tarif";
import ImportTarifs from "./ImportTarifs";
import { PastillesUnite } from "@/components/atlas/ChoixUnite";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import Picto from "@/components/atlas/reglages/Picto";
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
 *
 * **La planche soignée du 26 octobre 2026** (`appli/soignee/reglages-tarifs.html`)
 * garde ce dessin et le rend lisible d'un coup d'œil : le nom en serif, le
 * montant en gras, l'unité dessous, et « Ajouter un tarif » devenu une vraie
 * ligne au bout de la liste.
 *
 * `children` est la suite de l'écran (Mes autres prix) : elle passe jusqu'à
 * l'import, qui doit poser son bouton du bas APRÈS elle (`ImportTarifs`).
 */
export default function ReglagesClient({
  initialTarifs,
  children,
}: {
  initialTarifs: Tarif[];
  children: React.ReactNode;
}) {
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
    <>
      <div className="mx-[22px] mt-6">
        {/* **`overflow-clip`, pas `overflow-hidden`** : les deux arrondissent les
            coins, mais `hidden` fait de la plage une zone de défilement à part
            entière. Le navigateur la faisait alors défiler d'abord, et la marge
            qui garde « Fermer » au-dessus de la barre basse se perdait : la ligne
            ouverte s'arrêtait sous la barre, intouchable (13 octobre 2026). */}
        <div className="overflow-clip rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
          {tarifsVisibles.length === 0 ? (
            <p className="pb-[18px] pt-[22px] text-center text-[15.5px]" style={{ color: colors.inkSoft }}>
              Aucun tarif pour l&apos;instant.
            </p>
          ) : (
            <ul>
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

          {/* Ajouter est le geste de tous les jours : une vraie ligne au bout de
              la liste, en or comme les autres ajouts de l'application. **Le doré
              de l'appli (`or`), jamais l'or foncé** : sa consigne du 25 octobre
              2026, répétée sur chaque planche des Réglages soignés. */}
          <button
            type="button"
            onClick={ajouter}
            disabled={ajoutEnCours}
            className="relative flex min-h-[62px] w-full items-center gap-3 text-left text-[17px] font-semibold disabled:opacity-40"
            style={{ color: colors.or }}
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
            <span
              aria-hidden
              className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full"
              style={{ backgroundColor: voile(colors.or, 0.14), color: colors.or }}
            >
              <Picto nom="plus" taille={20} epaisseur={2} />
            </span>
            {ajoutEnCours ? "Ajout…" : "Ajouter un tarif"}
          </button>
        </div>

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
      </div>

      {/* Reprendre ses prix d'un fichier ne sert qu'une fois : dessous, à voix
          basse (planche du 11 octobre 2026, gardée le 26). */}
      <ImportTarifs onImporte={(nouveaux) => setTarifs(nouveaux)}>{children}</ImportTarifs>
    </>
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
    <button type="button" onClick={onOuvrir} className="flex min-h-[66px] w-full items-center gap-[14px] py-3 text-left">
      <span
        className="min-w-0 flex-1 text-[18px] leading-[1.25] [overflow-wrap:anywhere]"
        style={{ fontFamily: font.display, color: tarif.intitule ? colors.ink : colors.inkSoft }}
      >
        {tarif.intitule || "Sans nom"}
      </span>
      <span className="flex-none text-right">
        <span
          className="block whitespace-nowrap text-[17px] font-bold leading-[1.2]"
          style={{ color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
        >
          {enEuros(tarif.prix)}
        </span>
        {unite && (
          <span className="mt-[3px] block whitespace-nowrap text-[14px]" style={{ color: colors.inkSoft }}>
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

  // Le trait doré dit la case où l'on tape (planche du 26 octobre 2026).
  const champ = "block min-h-[50px] w-full rounded-[10px] border-0 px-[14px] py-3 outline-none focus:outline-2 focus:-outline-offset-2";
  const styleChamp = {
    backgroundColor: colors.rustTint,
    color: colors.ink,
    fontSize: "16px",
    boxShadow: `inset 0 0 0 1px ${colors.lineSoft}`,
    outlineColor: colors.or,
  };
  // Les libellés en toutes lettres, comme `LigneReglage` : « Nom » à 14 px se
  // lit, NOM en capitales espacées de 11 px se déchiffre (planche du
  // 26 octobre 2026).
  const libelleChamp = "mb-[7px] block text-[14px] font-semibold";

  return (
    <div
      ref={cadre}
      className="pb-0.5 pt-4"
      // La barre de navigation est posée PAR-DESSUS la page : amener la ligne
      // « au bord de l'écran » cacherait Retirer et Fermer. Ces pixels-là sont
      // sa hauteur, marge comprise.
      style={{ scrollMarginBottom: 96 }}
    >
      <label className="mb-4 block">
        <span className={libelleChamp} style={{ color: colors.inkSoft }}>
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

      <label className="mb-4 block">
        <span className={libelleChamp} style={{ color: colors.inkSoft }}>
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
      <div className="mb-4">
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
          className="min-h-[52px] text-[16px] font-semibold"
          style={{ color: colors.alert }}
        >
          Retirer
        </button>
        {/* Fermer ne fait que replier : chaque champ s'est déjà enregistré en
            le quittant. */}
        <button
          type="button"
          onClick={onFermer}
          className="min-h-[52px] text-[16px] font-semibold"
          style={{ color: colors.rust }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
