"use client";

import { useEffect, useRef, useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import { UNITES_PROPOSEES, normaliserUnite, uniteProposee } from "@/lib/unites-tarif";

/**
 * L'unité d'un tarif, à choisir au lieu de la taper.
 *
 * Le dessin retenu par le patron le 14 août 2026 :
 * `maquettes/atlas-unite-deroulante.html`, forme 1. Le pourquoi de la liste est
 * dans `src/lib/unites-tarif.ts` ; ce fichier ne porte que le geste.
 *
 * **Deux pièces, et cette séparation EST la correction.** La maquette dessinait
 * un panneau en surimpression, posé sur la carte du tarif. Impossible ici : la
 * carte vit dans un `LigneRetirable`, dont l'enveloppe masque ce qui dépasse
 * (`.atlas-ligne {overflow:hidden}`) pour pouvoir se refermer au retrait, et
 * dont la colonne du texte est une zone qui défile (`.atlas-glisse
 * {overflow-x:auto}`). Un bandeau posé là-dedans serait **tranché aux deux
 * bords** — et les dernières unités deviendraient inatteignables sans qu'aucun
 * type ne bronche.
 *
 * `CaseUnite` vit donc DANS la carte, et `BandeauUnites` juste EN DESSOUS,
 * hors de l'enveloppe. Relever la hauteur de repli de la ligne aurait été
 * l'autre voie : elle a été essayée et écartée, parce que cette hauteur
 * s'anime (0,44 s après 0,2 s d'attente) — le bandeau se serait dévoilé par le
 * haut, une demi-seconde après le doigt.
 */
export function CaseUnite({
  valeur,
  ouvert,
  onBasculer,
}: {
  valeur: string | null;
  ouvert: boolean;
  onBasculer: () => void;
}) {
  const courante = normaliserUnite(valeur ?? "");
  return (
    <div className="flex flex-col gap-1">
      <span className={smallCaps} style={{ color: colors.muted }}>
        Unité (facultatif)
      </span>
      <button
        type="button"
        onClick={onBasculer}
        aria-label="Unité du tarif"
        aria-expanded={ouvert}
        aria-haspopup="listbox"
        className="flex items-center justify-between gap-2 rounded-[4px] border-0 px-3 py-2.5 text-left outline-none"
        style={{
          backgroundColor: colors.cream,
          color: courante ? colors.ink : colors.muted,
          fontSize: "16px",
        }}
      >
        <span className="min-w-0 truncate">{courante || "Choisir…"}</span>
        <span
          aria-hidden
          className="text-[12px] transition-transform"
          style={{ color: colors.muted, transform: ouvert ? "rotate(180deg)" : undefined }}
        >
          ▾
        </span>
      </button>
    </div>
  );
}

/**
 * Le bandeau lui-même — à poser sous la carte, jamais dedans (voir ci-dessus).
 *
 * Il prend toute la largeur : à la largeur de sa demi-colonne, « jour/homme —
 * main d'œuvre » se casse en deux lignes et la liste devient un mur.
 */
export function BandeauUnites({
  valeur,
  onChoisir,
}: {
  valeur: string | null;
  /** Une chaîne vide efface l'unité : le champ est facultatif. */
  onChoisir: (unite: string) => void;
}) {
  const courante = normaliserUnite(valeur ?? "");
  const cadre = useRef<HTMLDivElement>(null);

  // **Sans cela, toucher la case ne montre rien.** Un tarif se règle en bas de
  // la liste aussi souvent qu'en haut, et le bandeau s'ouvre alors sous le bord
  // de l'écran : le geste paraît sans effet. Vu sur une capture, jamais par un
  // test — les contrôles, eux, atteignent ce qui est hors champ.
  useEffect(() => {
    cadre.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  return (
    <div
      ref={cadre}
      className="mt-1 overflow-hidden rounded-[4px]"
      style={{
        backgroundColor: colors.card,
        boxShadow: `inset 0 0 0 1px ${colors.line}`,
        // La barre de navigation est posée PAR-DESSUS la page : amener le
        // bandeau « au bord de l'écran » cachait sa dernière ligne — celle qui
        // sert justement à écrire son unité à soi. Ces pixels-là sont sa
        // hauteur, marge de sécurité comprise.
        scrollMarginBottom: 96,
      }}
    >
      <div
        role="listbox"
        aria-label="Unités proposées"
        // **Empêcher la prise de focus est ce qui protège la frappe libre.**
        // Sans cela, toucher une ligne fait d'abord perdre le focus au champ du
        // bas : son `onBlur` enregistre l'ancienne saisie, et la course avec le
        // choix décide de l'unité qui reste.
        onPointerDown={(e) => e.preventDefault()}
      >
        {/* Rien ne pouvait DÉ-choisir une unité une fois posée, alors que le
            champ est facultatif — et c'est aussi la seule façon honnête de dire
            « ce tarif est repris tel quel ». */}
        <Ligne
          libelle="Aucune unité"
          quoi="le tarif est repris tel quel"
          choisie={courante === ""}
          onClick={() => onChoisir("")}
        />
        {UNITES_PROPOSEES.map((u) => (
          <Ligne
            key={u.valeur}
            libelle={u.valeur}
            quoi={u.quoi}
            choisie={courante === u.valeur}
            onClick={() => onChoisir(u.valeur)}
          />
        ))}
      </div>

      <ChampLibre
        // Remontée telle quelle quand elle n'est pas dans la liste : c'est là
        // qu'il la corrige. Une unité proposée laisse le champ vide, sinon la
        // ligne « Une autre unité ? » afficherait « m² ».
        depart={uniteProposee(courante) ? "" : courante}
        onValider={onChoisir}
      />
    </div>
  );
}

function Ligne({
  libelle,
  quoi,
  choisie,
  onClick,
}: {
  libelle: string;
  quoi: string | null;
  choisie: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={choisie}
      onClick={onClick}
      // Un rang de liste sous le pouce, sur un chantier : jamais moins de 44 px.
      className="flex w-full items-center justify-between gap-2.5 px-3.5 py-3 text-left"
      style={{ borderBottom: `1px solid ${colors.line}`, color: colors.ink, fontSize: "15.5px" }}
    >
      <span className="min-w-0">
        {libelle}
        {quoi && (
          <span className="text-[12.5px]" style={{ color: colors.muted }}>
            {" — "}
            {quoi}
          </span>
        )}
      </span>
      <span aria-hidden style={{ color: colors.rust, opacity: choisie ? 1 : 0 }}>
        ✓
      </span>
    </button>
  );
}

/**
 * La sortie de secours : écrire la sienne.
 *
 * Sa saisie vit ici et nulle part ailleurs — le bandeau se démonte à la
 * fermeture, donc le champ repart de l'unité enregistrée à chaque ouverture
 * sans qu'on ait à le remettre à zéro à la main.
 */
function ChampLibre({ depart, onValider }: { depart: string; onValider: (unite: string) => void }) {
  const [saisie, setSaisie] = useState(depart);

  return (
    <div className="px-3.5 py-3" style={{ backgroundColor: colors.cream }}>
      <label className="block text-[12.5px]" style={{ color: colors.muted }}>
        Une autre unité ?
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onBlur={() => {
            // Ne rien enregistrer s'il n'a rien changé : sortir du champ par
            // mégarde ne doit ni réécrire son unité ni refermer le bandeau.
            if (normaliserUnite(saisie) !== normaliserUnite(depart)) onValider(saisie);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onValider(saisie);
            }
          }}
          placeholder="stère, arbre, forfait déplacement…"
          aria-label="Une autre unité"
          autoComplete="off"
          className="mt-1.5 w-full rounded-[4px] border-0 px-3 py-2.5 outline-none"
          style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
        />
      </label>
    </div>
  );
}
