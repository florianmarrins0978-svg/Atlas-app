"use client";

import { useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { MAX_EQUIPES, equipesAffichees, lettreDeRepli, phraseDuCompteur } from "@/lib/equipes";
import { mettreAJourNombreEquipesAction, nommerEquipeAction } from "./actions";

/**
 * « Vos équipes » — combien elles sont, et comment elles s'appellent.
 *
 * *Demandé par le patron le 10 août 2026, arrêté sur maquette
 * (`maquettes/atlas-equipes.html`, `docs/INTEGRER-ORIGINE.md` §6 ter).*
 *
 * **La règle tient en une phrase : on n'invente jamais un nom, et on ne laisse
 * jamais deux lignes indiscernables.** À une équipe il n'y a personne à
 * distinguer — le bloc des noms n'existe pas, et le planning n'écrira rien. À
 * deux, chaque ligne porte son champ, et un champ vide affiche déjà en gris ce
 * qui sera écrit à sa place.
 *
 * **Le bloc des noms disparaît à une équipe, il ne se grise pas.** Le laisser
 * serait un piège : le patron y écrirait un prénom qui n'apparaîtrait nulle
 * part.
 */
export default function VosEquipes({
  initialNombreEquipes,
  initialNoms,
}: {
  initialNombreEquipes: number;
  /** Ce que la base porte, par rang. Un rang absent est un cas ordinaire. */
  initialNoms: { rang: number; nom: string | null }[];
}) {
  const [nombre, setNombre] = useState(initialNombreEquipes);
  // Les noms vivent ici par RANG, pas par identifiant : l'écran montre des
  // lignes qui n'existent pas encore en base, et exiger un identifiant
  // obligerait à créer vingt lignes vides d'avance.
  const [noms, setNoms] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialNoms.map((e) => [e.rang, e.nom ?? ""]))
  );

  async function changerNombre(valeur: number) {
    // Borné ici comme au serveur : à zéro équipe, plus aucun jour ne serait
    // proposable et rien à l'écran ne l'expliquerait.
    const borne = Math.min(MAX_EQUIPES, Math.max(1, valeur));
    if (borne === nombre) return;
    setNombre(borne);
    const r = await mettreAJourNombreEquipesAction(borne);
    setNombre(r.nombreEquipes);
  }

  const lignes = equipesAffichees(
    Object.entries(noms).map(([rang, nom]) => ({ rang: Number(rang), nom })),
    nombre
  );

  return (
    <section className="mt-7 px-[26px]">
      {/* **PAS DE FILET À CÔTÉ DE L'INTERTITRE — retiré le 25 août 2026**, à sa
          demande : *« ça aussi tu peux retirer »*, capture de l'écran Équipe à
          l'appui. Il venait de faire retirer le trait sous les titres ; celui-ci
          était de la même famille, et il l'a vu du même œil.

          **Les filets qui SÉPARENT les blocs restent** — *« ceux qui séparent
          les blocs, laisse-les »*. Ne pas les confondre : ceux-là disent que
          deux choses sont distinctes ; celui-ci n'ornait qu'un mot. */}
      <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        Combien partent en même temps
      </p>

      {/* Le compteur. Deux ronds cerclés d'un filet, le nombre en serif entre
          eux. **La borne se voit avant d'être rencontrée** : le − est inerte à
          1, le + à 20 — grisés, et non absents, sinon le compteur se
          décentrerait en atteignant sa borne. */}
      <div className="flex items-center justify-center gap-[30px] pb-1 pt-3.5">
        <BoutonPas
          signe="−"
          libelle="Une équipe de moins"
          inerte={nombre <= 1}
          onAppui={() => changerNombre(nombre - 1)}
        />
        <span
          className="min-w-[2ch] text-center"
          style={{
            fontFamily: font.display,
            fontSize: 52,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
            color: colors.ink,
          }}
          aria-live="polite"
        >
          {nombre}
        </span>
        <BoutonPas
          signe="+"
          libelle="Une équipe de plus"
          inerte={nombre >= MAX_EQUIPES}
          onAppui={() => changerNombre(nombre + 1)}
        />
      </div>

      {/* Une seule phrase, qui change avec le compteur. **Aucun mot de
          métier** : « chantiers de front » a été soumis au patron et rejeté —
          « pour moi rien ». Elle dit ce que le réglage CHANGE. */}
      <p className="mt-2 text-center text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
        {phraseDuCompteur(nombre)}
      </p>

      {nombre > 1 ? (
        <div className="mt-[30px]">
          <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
            Leurs noms
          </p>
          {lignes.map((e) => (
            <LigneNom
              key={e.rang}
              rang={e.rang}
              valeur={noms[e.rang] ?? ""}
              onEcrire={(v) => setNoms((cur) => ({ ...cur, [e.rang]: v }))}
              onPoser={(v) => nommerEquipeAction(e.rang, v)}
            />
          ))}
          {/* RIEN sous la dernière ligne, et c'est voulu : le champ vide montre
              déjà ce qui sera écrit à sa place. Une phrase qui l'expliquerait
              raconterait ce qui est sous les yeux. */}
        </div>
      ) : (
        // Seul : le bloc entier s'efface plutôt que de proposer un champ dont
        // la valeur ne serait jamais lue.
        <p
          className="mt-[30px] pt-[18px] text-[13px] leading-[1.7]"
          style={{ color: colors.muted, borderTop: `1px solid ${colors.line}` }}
        >
          Seul, rien à nommer : <span style={{ color: colors.ink }}>le planning n&apos;écrira aucune équipe</span>.
        </p>
      )}
    </section>
  );
}

/** Un rond de 46 px cerclé d'un filet — pas de fond, comme la maquette. */
function BoutonPas({
  signe,
  libelle,
  inerte,
  onAppui,
}: {
  signe: string;
  libelle: string;
  inerte: boolean;
  onAppui: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      disabled={inerte}
      onClick={onAppui}
      className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full"
      style={{
        boxShadow: `inset 0 0 0 1px ${colors.line}`,
        fontFamily: font.display,
        fontSize: 21,
        lineHeight: 1,
        color: inerte ? colors.muted : colors.ink,
        opacity: inerte ? 0.32 : 1,
        WebkitTapHighlightColor: "transparent",
        transition: "box-shadow .24s, color .24s, opacity .24s",
      }}
    >
      {signe}
    </button>
  );
}

/**
 * Une ligne : la lettre de repli, puis le champ qui occupe tout le reste.
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
  const lettre = lettreDeRepli(rang) ?? "";
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
        style={{ color: colors.or, fontFamily: font.display, fontSize: 15, lineHeight: 1 }}
        aria-hidden="true"
      >
        {lettre}
      </span>
      <input
        type="text"
        value={valeur}
        placeholder={`Équipe ${lettre}`}
        aria-label={`Nom de l'équipe ${lettre}`}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint={rang >= MAX_EQUIPES ? "done" : "next"}
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
