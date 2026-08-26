"use client";

import { useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { MAX_SALARIES, phraseDesSalaries, salariesAffiches } from "@/lib/equipes";
import { mettreAJourNombreSalariesAction, nommerEquipeAction } from "./actions";
import CompteurRond from "./CompteurRond";

/**
 * « Vos salariés » — combien ils sont, et comment ils s'appellent.
 *
 * *Sa demande du 26 août 2026, arrêtée sur la planche 97
 * (`appli/salaries-et-equipes.html`), à laquelle il a répondu **A**.*
 *
 *   *« Il faut avoir un curseur + ou − qui définit le nombre de salariés que
 *     possède l'entreprise et pouvoir affilier des noms. Ceux-là permettront
 *     d'ajouter ces noms au chantier, et plus les équipes A ou B. »*
 *
 * **La règle tient en une phrase : on n'invente jamais un nom, et on ne laisse
 * jamais deux lignes indiscernables.** À zéro salarié il n'y a personne à
 * distinguer — le bloc des noms n'existe pas, et le planning n'écrira rien. Dès
 * un, chaque ligne porte son champ, et un champ vide affiche déjà en gris ce
 * qui sera écrit à sa place.
 *
 * **Le bloc des noms disparaît à zéro, il ne se grise pas.** Le laisser serait
 * un piège : le patron y écrirait un prénom qui n'apparaîtrait nulle part.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE LA PLANCHE 97 LUI A MONTRÉ, ET QU'IL A CHOISI QUAND MÊME.** Un
 * curseur à côté d'une liste de noms crée deux vérités sur la même question :
 * le curseur dit 3, il a écrit 2 noms. La proposition C supprimait le curseur ;
 * il a retenu la A, qui le garde — c'est son appel, et il a été posé.
 *
 * **Ce qui reste de la C, parce qu'il ne faut pas qu'il le découvre au chantier :**
 * l'écart est ÉCRIT sous le compteur. Un salarié annoncé sans nom apparaît
 * quand même sur les chantiers, sous son rang — « Salarié 3 » —, sans quoi
 * ceux qui n'ont pas encore tapé les prénoms de leurs gars ne pourraient plus
 * attribuer un seul chantier.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function VosSalaries({
  initialNombreSalaries,
  initialNoms,
}: {
  initialNombreSalaries: number;
  /** Ce que la base porte, par rang. Un rang absent est un cas ordinaire. */
  initialNoms: { rang: number; nom: string | null }[];
}) {
  const [nombre, setNombre] = useState(initialNombreSalaries);
  // Les noms vivent ici par RANG, pas par identifiant : l'écran montre des
  // lignes qui n'existent pas encore en base, et exiger un identifiant
  // obligerait à créer vingt lignes vides d'avance.
  const [noms, setNoms] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialNoms.map((e) => [e.rang, e.nom ?? ""]))
  );

  async function changerNombre(valeur: number) {
    // Borné ici comme au serveur. **Le plancher est zéro**, contrairement aux
    // équipes : un artisan seul n'a personne à cocher.
    const borne = Math.min(MAX_SALARIES, Math.max(0, valeur));
    if (borne === nombre) return;
    setNombre(borne);
    const r = await mettreAJourNombreSalariesAction(borne);
    setNombre(r.nombreSalaries);
  }

  const lignes = salariesAffiches(
    Object.entries(noms).map(([rang, nom]) => ({ rang: Number(rang), nom })),
    nombre
  );
  const sansNom = lignes.filter((e) => !(noms[e.rang] ?? "").trim()).length;

  return (
    <section
      className="mt-[30px] px-[26px] pt-[26px]"
      style={{ borderTop: `1px solid ${colors.line}` }}
      data-atlas="vos-salaries"
    >
      <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        Vos salariés
      </p>

      <CompteurRond
        valeur={nombre}
        plancher={0}
        plafond={MAX_SALARIES}
        libelleMoins="Un salarié de moins"
        libellePlus="Un salarié de plus"
        onChanger={changerNombre}
      />

      <p className="mt-2 text-center text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
        {phraseDesSalaries(nombre)}
      </p>

      {nombre > 0 ? (
        <div className="mt-[26px]">
          {lignes.map((e) => (
            <LigneNom
              key={e.rang}
              rang={e.rang}
              valeur={noms[e.rang] ?? ""}
              onEcrire={(v) => setNoms((cur) => ({ ...cur, [e.rang]: v }))}
              onPoser={(v) => nommerEquipeAction(e.rang, v)}
            />
          ))}
          {/* **L'écart est écrit, et seulement quand il existe.** C'est ce que
              la planche 97 lui a fait toucher du doigt : un compteur qui annonce
              plus de gens qu'il n'y a de noms. Une phrase permanente sous la
              liste serait du bruit ; celle-ci ne parle que lorsqu'il y a
              quelque chose à dire (`CLAUDE.md` §4 ter). */}
          {sansNom > 0 ? (
            <p className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
              {sansNom === 1 ? "Un salarié n'a pas de nom" : `${sansNom} salariés n'ont pas de nom`} :
              <span style={{ color: colors.ink }}>
                {" "}
                le chantier les montrera sous leur numéro
              </span>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Une ligne : le rang, puis le champ qui occupe tout le reste.
 *
 * **Le champ fait 17 px, jamais moins.** En dessous de 16, Safari zoome à la
 * mise au point et l'écran saute sous le doigt — le patron le vit à chaque
 * saisie sur son téléphone.
 *
 * Le placeholder EST le repli : ce qui sera écrit à sa place est sous les yeux
 * avant d'être subi.
 */
function LigneNom({
  rang,
  valeur,
  onEcrire,
  onPoser,
}: {
  rang: number;
  valeur: string;
  onEcrire: (v: string) => void;
  onPoser: (v: string) => Promise<unknown>;
}) {
  const [aLaMain, setALaMain] = useState(false);
  return (
    <label
      className="flex items-center gap-3.5 py-[13px]"
      style={{
        borderBottom: `1px solid ${aLaMain ? colors.or : colors.line}`,
        transition: "border-color .26s",
      }}
    >
      <span
        className="w-5 flex-none text-center"
        style={{
          color: colors.or,
          fontFamily: font.display,
          fontSize: 15,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
        aria-hidden="true"
      >
        {rang}
      </span>
      <input
        type="text"
        value={valeur}
        placeholder={`Salarié ${rang}`}
        aria-label={`Nom du salarié ${rang}`}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint={rang >= MAX_SALARIES ? "done" : "next"}
        onChange={(e) => onEcrire(e.target.value)}
        onFocus={() => setALaMain(true)}
        onBlur={(e) => {
          setALaMain(false);
          void onPoser(e.target.value);
        }}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
        style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.3, color: colors.ink }}
      />
    </label>
  );
}
