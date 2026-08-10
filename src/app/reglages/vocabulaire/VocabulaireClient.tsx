"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
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

  async function retirer(terme: Terme) {
    setTermes((t) => t.filter((x) => x.id !== terme.id));
    try {
      await supprimerTermeAction(terme.id);
    } catch {
      setTermes((t) => [...t, terme]);
    }
  }

  const regles = termes.filter((t) => t.nature === "regle");
  const mots = termes.filter((t) => t.nature === "mot");

  return (
    <div className="px-6 pt-8">
      {/* --- Ajouter -------------------------------------------------------- */}
      <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
        <p className={smallCaps} style={{ color: colors.rust, marginBottom: 12 }}>
          Ajouter
        </p>

        <div className="mb-4 flex gap-2">
          <ChoixNature libelle="Un mot" actif={nature === "mot"} onClick={() => setNature("mot")} />
          <ChoixNature libelle="Une règle" actif={nature === "regle"} onClick={() => setNature("regle")} />
        </div>

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
        {/* Le champ qui fait le travail — d'où l'explication au-dessus. */}
        <Champ
          label="Ce qu'Atlas doit en faire (le plus utile)"
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
          className="mt-2 w-full rounded-[4px] py-3 text-[15px] font-medium disabled:opacity-40"
          style={{ backgroundColor: colors.rust, color: colors.cream }}
        >
          {enCours ? "Ajout…" : "Ajouter"}
        </button>
        {erreur && (
          <p role="alert" className="mt-2 text-[13px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}
      </div>

      <Section titre="Mes règles" sousTitre="Elles priment sur les habitudes du modèle." termes={regles} onBasculer={basculer} onRetirer={retirer} />
      <Section titre="Mes mots" sousTitre="Le vocabulaire du métier, et son traitement." termes={mots} onBasculer={basculer} onRetirer={retirer} />
    </div>
  );
}

function Section({
  titre,
  sousTitre,
  termes,
  onBasculer,
  onRetirer,
}: {
  titre: string;
  sousTitre: string;
  termes: Terme[];
  onBasculer: (t: Terme) => void;
  onRetirer: (t: Terme) => void;
}) {
  return (
    <section className="pt-8">
      <p className={smallCaps} style={{ color: colors.muted, marginBottom: 2 }}>
        {titre}
      </p>
      <p className="text-[13px]" style={{ color: colors.muted, marginBottom: 10 }}>
        {sousTitre}
      </p>
      {termes.length === 0 ? (
        <p className="text-[14px]" style={{ color: colors.muted }}>
          Rien pour l&apos;instant.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {termes.map((t) => (
            <div
              key={t.id}
              className="rounded-[4px] px-5 py-4"
              style={{ backgroundColor: colors.card, opacity: t.actif ? 1 : 0.5 }}
            >
              <p className="text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
                {t.intitule}
              </p>
              <p className="mt-1 text-[14px] leading-snug" style={{ color: colors.inkSoft }}>
                {t.definition}
              </p>
              {t.consigne && (
                <p className="mt-2 text-[13px] leading-snug" style={{ color: colors.rust }}>
                  → {t.consigne}
                </p>
              )}
              <div className="mt-3 flex gap-4">
                <button type="button" onClick={() => onBasculer(t)} className="text-[13px] font-medium" style={{ color: colors.rust }}>
                  {t.actif ? "Mettre de côté" : "Remettre en service"}
                </button>
                <button type="button" onClick={() => onRetirer(t)} className="text-[13px] font-medium" style={{ color: colors.alert }}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChoixNature({ libelle, actif, onClick }: { libelle: string; actif: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className="flex-1 rounded-[4px] py-2.5 text-[14px] font-medium"
      style={{ backgroundColor: actif ? colors.rustTint : colors.cream, color: actif ? colors.rust : colors.muted }}
    >
      {libelle}
    </button>
  );
}

function Champ({
  label,
  placeholder,
  value,
  onChange,
  long,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  long?: boolean;
}) {
  const style = {
    backgroundColor: colors.cream,
    color: colors.ink,
    fontFamily: font.body,
    // 16 px au moins : en dessous, iOS Safari zoome tout seul à la mise au point.
    fontSize: "16px",
  } as const;
  return (
    <label className="mb-3 flex flex-col gap-1.5">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      {long ? (
        <textarea
          rows={2}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-[4px] border-0 px-4 py-3 outline-none"
          style={style}
        />
      ) : (
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-[4px] border-0 px-4 py-3 outline-none"
          style={style}
        />
      )}
    </label>
  );
}
