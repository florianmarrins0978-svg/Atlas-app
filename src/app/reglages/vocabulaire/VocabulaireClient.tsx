"use client";

import ChoixEnMots from "@/components/atlas/reglages/ChoixEnMots";
import { useState } from "react";
import Paquet from "@/components/atlas/reglages/Paquet";
import { colors, font, surPlein } from "@/lib/design-tokens";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import Picto from "@/components/atlas/reglages/Picto";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { creerTermeAction, modifierTermeAction, supprimerTermeAction } from "./actions";

type Terme = {
  id: string;
  nature: "mot" | "regle";
  intitule: string;
  definition: string;
  consigne: string | null;
  ordre: number;
  actif: boolean;
};

/**
 * Saisir le vocabulaire et les règles du métier.
 *
 * **Trois champs, et le troisième est celui qui travaille.** Une définition
 * explique ce qu'un mot veut dire ; une consigne dit ce qu'Atlas doit en FAIRE.
 * Sans elle, le modèle comprend « fendre en 50 » et le range quand même dans la
 * gestion des déchets — c'est exactement ce qui a fait disparaître cette ligne
 * du devis du 7 août 2026.
 *
 * L'écran affiche cette différence plutôt que de la supposer connue : le patron
 * écrit ici une fois ce qu'il aurait sinon corrigé cent fois.
 */
export default function VocabulaireClient({ initiaux }: { initiaux: Terme[] }) {
  const [termes, setTermes] = useState<Terme[]>(initiaux);
  const [nature, setNature] = useState<"mot" | "regle">("mot");
  const [intitule, setIntitule] = useState("");
  const [definition, setDefinition] = useState("");
  const [consigne, setConsigne] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ajouter() {
    if (!intitule.trim() || !definition.trim()) {
      setErreur("Il faut au moins un intitulé et une définition.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const terme = await creerTermeAction({ nature, intitule, definition, consigne });
      if (terme) setTermes((t) => [...t, terme as Terme]);
      setIntitule("");
      setDefinition("");
      setConsigne("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'ajout n'a pas abouti.");
    } finally {
      setEnCours(false);
    }
  }

  async function basculer(terme: Terme) {
    const actif = !terme.actif;
    setTermes((t) => t.map((x) => (x.id === terme.id ? { ...x, actif } : x)));
    try {
      await modifierTermeAction(terme.id, { actif });
    } catch {
      setTermes((t) => t.map((x) => (x.id === terme.id ? { ...x, actif: terme.actif } : x)));
    }
  }

  // **Supprimer passe par le tiroir, avec Annuler** (planche des Réglages
  // soignés, 26 octobre 2026), comme tous les écrans qui retirent : un mot
  // effacé d'un doigt ne revenait plus, et sa consigne était souvent la
  // phrase la plus longue à réécrire. Rien n'est écrit tant que le tiroir
  // est ouvert.
  const retraits = useRetraits({
    valider: async (id) => {
      try {
        await supprimerTermeAction(id);
      } catch {
        return { succes: false, erreur: "Ce mot n'a pas pu être supprimé. Réessayez." };
      }
      setTermes((t) => t.filter((x) => x.id !== id));
      return { succes: true };
    },
  });

  const visibles = termes.filter((t) => !retraits.estRetire(t.id));
  const regles = visibles.filter((t) => t.nature === "regle");
  const mots = visibles.filter((t) => t.nature === "mot");
  const retirer = (t: Terme) => retraits.retirer(t.id, t.intitule);

  return (
    <div>
      {/* --- Ajouter --------------------------------------------------------
          **Allure des Réglages soignés, 26 octobre 2026** : un paquet au titre
          doré, le choix « Un mot / Une règle » en deux mots qui glissent, les
          libellés en clair à 14,5 px au lieu de petites capitales de 11 px. */}
      <Paquet titre="Ajouter">
        <div className="py-[18px]">
          <ChoixEnMots
            libelle="Ajouter un mot ou une règle"
            options={[
              { valeur: "mot", libelle: "Un mot" },
              { valeur: "regle", libelle: "Une règle" },
            ]}
            valeur={nature}
            onChoix={setNature}
          />

          <Champ
            label={nature === "mot" ? "Le mot" : "La règle, en une phrase"}
            placeholder={nature === "mot" ? "charpentière champignonnée" : "Chaque ligne doit pouvoir se vendre seule"}
            value={intitule}
            onChange={setIntitule}
          />
          <Champ
            label="Ce que ça veut dire"
            placeholder={
              nature === "mot"
                ? "Branche maîtresse atteinte par un champignon."
                : "Une prestation détachable porte son propre déplacement."
            }
            value={definition}
            onChange={setDefinition}
            long
          />
          {/* Le champ qui fait le travail — d'où la précision à côté du libellé. */}
          <Champ
            label="Ce qu'Atlas doit en faire"
            precision="(le plus utile)"
            placeholder={
              nature === "mot"
                ? "C'est une suppression, pas une taille. Ligne à part sur le devis."
                : "Alléger la ligne principale, charger la détachable. Jamais au prorata du temps."
            }
            value={consigne}
            onChange={setConsigne}
            long
          />

          <button
            type="button"
            onClick={ajouter}
            disabled={enCours}
            className="atlas-plein mt-4 min-h-[56px] w-full rounded-full text-[17px] font-semibold disabled:opacity-40"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            {enCours ? "Ajout…" : "Ajouter"}
          </button>
          {erreur && (
            <p role="alert" className="mt-2 text-[14px]" style={{ color: colors.alert }}>
              {erreur}
            </p>
          )}
        </div>
      </Paquet>

      <Section titre="Mes règles" sousTitre="Elles priment sur les habitudes du modèle." termes={regles} refuses={retraits.refuses} onBasculer={basculer} onRetirer={retirer} />
      <Section titre="Mes mots" sousTitre="Le vocabulaire du métier, et son traitement." termes={mots} refuses={retraits.refuses} onBasculer={basculer} onRetirer={retirer} />
      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
        compteARebours={retraits.compteARebours}
        situation={retraits.nombre > 1 ? "Supprimés à l'instant" : "Supprimé à l'instant"}
        className="mt-3 mx-[22px]!"
      />
    </div>
  );
}

function Section({
  titre,
  sousTitre,
  termes,
  refuses,
  onBasculer,
  onRetirer,
}: {
  titre: string;
  sousTitre: string;
  termes: Terme[];
  /** Ce que le serveur a refusé de supprimer : le mot est revenu, et dit pourquoi. */
  refuses: Record<string, string>;
  onBasculer: (t: Terme) => void;
  onRetirer: (t: Terme) => void;
}) {
  return (
    <Paquet titre={titre} sansPlage>
      <p className="mx-0.5 -mt-1 mb-2.5 text-[14.5px]" style={{ color: colors.inkSoft }}>
        {sousTitre}
      </p>
      <div className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
        {termes.length === 0 ? (
          <p className="py-4 text-[15px]" style={{ color: colors.inkSoft }}>
            Rien pour l&apos;instant.
          </p>
        ) : (
          termes.map((t) => (
            <div key={t.id} className="relative pb-1.5 pt-4">
              <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
              {/* **Mis de côté se DIT, il ne fait plus que pâlir** (planche du
                  26 octobre 2026) : un mot à moitié transparent se lisait comme
                  un défaut d'affichage. Les gestes, eux, restent pleins : ils
                  servent justement à le remettre. */}
              <p className="flex items-baseline justify-between gap-2.5">
                <span
                  className="text-[18.5px] leading-[1.3]"
                  style={{ fontFamily: font.display, color: colors.ink, opacity: t.actif ? 1 : 0.55 }}
                >
                  {t.intitule}
                </span>
                {!t.actif && <EtatEcrit>Mis de côté</EtatEcrit>}
              </p>
              <p className="mt-1 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft, opacity: t.actif ? 1 : 0.55 }}>
                {t.definition}
              </p>
              {t.consigne && (
                <p
                  className="mt-2.5 flex items-start gap-2 text-[15px] leading-[1.45]"
                  style={{ color: colors.ink, opacity: t.actif ? 1 : 0.55 }}
                >
                  <span className="mt-px" style={{ color: colors.or }}>
                    <Picto nom="etincelle" taille={19} />
                  </span>
                  <span>{t.consigne}</span>
                </p>
              )}
              <div className="flex gap-[18px]">
                <button
                  type="button"
                  onClick={() => onBasculer(t)}
                  className="min-h-[48px] px-1 text-[16px] font-semibold"
                  style={{ color: colors.or }}
                >
                  {t.actif ? "Mettre de côté" : "Remettre en service"}
                </button>
                <button
                  type="button"
                  onClick={() => onRetirer(t)}
                  className="min-h-[48px] px-1 text-[16px] font-semibold"
                  style={{ color: colors.alert }}
                >
                  Supprimer
                </button>
              </div>
              {refuses[t.id] && (
                <p role="alert" className="pb-2 text-[14.5px]" style={{ color: colors.alert }}>
                  {refuses[t.id]}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </Paquet>
  );
}

function Champ({
  label,
  precision,
  placeholder,
  value,
  onChange,
  long,
}: {
  label: string;
  /** Un mot de plus, plus discret, à côté du libellé : « (le plus utile) ». */
  precision?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  long?: boolean;
}) {
  const style = {
    backgroundColor: colors.card,
    color: colors.ink,
    fontFamily: font.body,
    // 16 px au moins : en dessous, iOS Safari zoome tout seul à la mise au point.
    fontSize: "16px",
    boxShadow: `inset 0 0 0 1px ${colors.lineSoft}`,
  } as const;
  return (
    <label className="mt-4 flex flex-col gap-[7px]">
      <span className="text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        {label}
        {precision && <small className="ml-1 text-[13px] font-medium">{precision}</small>}
      </span>
      {long ? (
        <textarea
          rows={2}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[84px] rounded-[6px] border-0 px-[15px] py-3.5 outline-none"
          style={style}
        />
      ) : (
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[52px] rounded-[6px] border-0 px-[15px] py-3.5 outline-none"
          style={style}
        />
      )}
    </label>
  );
}
