"use client";

import { useActionState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { lireLeCroquis, type EtatPlan } from "./actions";

/**
 * L'écran « Plan d'arrosage » — deux gestes, et le plan sort.
 *
 * **Sa demande du 20 août 2026**, en trois temps, chacun plus court que le
 * précédent :
 *
 *   1. *« Garde le piquage se fait… avec le bandeau déroulant. Ensuite : le
 *      croquis et ses métrés, avec la possibilité de mettre la photo. Je veux
 *      rien d'autre. »*
 *   2. *« Le titre plan d'arrosage, et en dessous le piquage — tout ce qu'il y a
 *      entre les deux, tu me le supprimes. Tous les autres mots, tu me les
 *      supprimes. Et je ne veux pas qu'il y ait marqué un et deux. »*
 *   3. *« Remets la mesure du débit, mais minimaliste, sans mots qui servent à
 *      rien. »*
 *
 * **Ce qui reste à l'écran : un titre, un déroulant, trois cases, un bouton.**
 * La maquette qui l'a arrêté est `appli/arrosage-simple.html`, et un contrôle y
 * compte les mots pour qu'il n'en regagne pas (`CLAUDE.md` §3 bis).
 *
 * **Le débit s'affiche dès qu'il est calculable, et rien avant.** Trois cases
 * vides n'annoncent pas « 0,00 m³/h » — un zéro se lirait comme une mesure, et
 * c'est la règle du dépôt sur les montants absents (`CLAUDE.md` §4).
 */
export default function ArrosageClient({ iaPrete }: { iaPrete: boolean }) {
  const [etat, agir, enCours] = useActionState<EtatPlan, FormData>(lireLeCroquis, { etat: "vide" });

  return (
    <form action={agir} className="pb-[86px]">
      {/* Le titre vient de `EnTeteEcran`, comme sur tous les autres écrans. */}

      {/* ─── Le piquage, et la mesure ─────────────────────────────────────── */}
      <div className="mx-[22px] mt-2 rounded-[14px] px-[17px] py-[18px]" style={{ backgroundColor: colors.card }}>
        <label className={`block ${libelleCaps}`} style={{ color: colors.or }} htmlFor="piquage">
          Le piquage se fait…
        </label>
        {/* 16 px au moins : en dessous, iOS agrandit la page à la mise au point. */}
        <select
          id="piquage"
          name="piquage"
          defaultValue="compteur"
          className="mt-[7px] block w-full appearance-none rounded-[11px] border-0 px-[14px] py-[15px] text-[16px]"
          style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}`, minHeight: 52 }}
        >
          <option value="compteur">Juste après le compteur d’eau</option>
          <option value="ailleurs">Ailleurs (robinet de jardin, nourrice existante…)</option>
          <option value="puits">Sur un puits ou une cuve</option>
        </select>

        {/* Trois cases, trois mots. Il a demandé « minimaliste, sans mots qui
            servent à rien » — « Litres », « Secondes », « Bar » suffisent à
            savoir quoi mettre dedans. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { nom: "litres", mot: "Litres", defaut: "10" },
            { nom: "secondes", mot: "Secondes", defaut: "20" },
            { nom: "bar", mot: "Bar", defaut: "3" },
          ].map((c) => (
            <span key={c.nom} className="min-w-0">
              <label className={`block ${libelleCaps}`} style={{ color: colors.muted }} htmlFor={c.nom}>
                {c.mot}
              </label>
              <input
                id={c.nom}
                name={c.nom}
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                defaultValue={c.defaut}
                className="mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[10px] py-3 text-[16px]"
                style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              />
            </span>
          ))}
        </div>
      </div>

      {/* ─── Le croquis ───────────────────────────────────────────────────── */}
      <div className="mx-[22px] mt-5 rounded-[14px] px-[17px] py-[18px]" style={{ backgroundColor: colors.card }}>
        <h2 style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>
          Le croquis et ses métrés
        </h2>

        {/* 64 px de haut : c'est un bouton qu'il touche dehors, avec des gants. */}
        <label
          htmlFor="croquis"
          data-atlas="ajouter-croquis"
          className="mt-[14px] flex min-h-[64px] cursor-pointer items-center justify-center gap-2.5 rounded-[12px] text-[11px] font-semibold uppercase"
          style={{ border: `1.5px dashed ${colors.line}`, backgroundColor: colors.cream, color: colors.inkSoft, letterSpacing: "0.18em" }}
        >
          {enCours ? "Lecture du croquis…" : "Ajouter la photo du croquis"}
        </label>
        {/* `capture` ouvre l'appareil photo du téléphone plutôt que la pellicule :
            le croquis est sous ses yeux, il le photographie. */}
        <input id="croquis" name="croquis" type="file" accept="image/*" capture="environment" hidden />
        <button type="submit" data-atlas="lire-croquis" className="sr-only">
          Lire le croquis
        </button>
      </div>

      {/* **L'IA absente se DIT, et avant le geste.** Sans clé, la lecture ne
          rendra rien : le laisser photographier pour rien serait le troisième
          bouton qui ne répond pas. */}
      {!iaPrete && (
        <p
          data-atlas="alerte"
          className="mx-[22px] mt-4 text-[13px] leading-relaxed"
          style={{ color: colors.alert }}
        >
          Aucune clé d’IA n’est posée sur ce serveur : le croquis ne sera pas lu.
        </p>
      )}

      {etat.etat === "refus" && (
        <p
          data-atlas="alerte"
          className="mx-[22px] mt-4 text-[13px] leading-relaxed"
          style={{ color: colors.alert }}
        >
          {etat.raison}
        </p>
      )}

      {etat.etat === "lu" && <Plan etat={etat} />}
    </form>
  );
}

/** Le plan, une fois le croquis lu : les réseaux, puis le détail des pièces. */
function Plan({ etat }: { etat: Extract<EtatPlan, { etat: "lu" }> }) {
  const { plan, reserves } = etat;

  return (
    <div data-atlas="plan-arrosage">
      <p className={`mx-[22px] mt-7 ${libelleCaps}`} style={{ color: colors.muted }}>
        {plan.secteurs.length} réseau{plan.secteurs.length > 1 ? "x" : ""}
        {plan.debitDisponible > 0 ? ` · ${plan.debitDisponible.toFixed(2).replace(".", ",")} m³/h` : ""}
      </p>

      {plan.secteurs.map((s, i) => (
        <div
          key={`${s.nom}-${i}`}
          className="mx-[22px] mt-3 rounded-[12px] px-4 py-[14px]"
          style={{ backgroundColor: colors.card }}
        >
          <p className="flex items-center gap-2.5">
            <span
              className="block h-[11px] w-[11px] flex-none rounded-[3px]"
              style={{ backgroundColor: plan.couleurs[i] ?? colors.rust }}
            />
            <span className="min-w-0 flex-1 truncate" style={{ fontFamily: font.display, fontSize: 17.5 }}>
              {s.nom}
            </span>
            <span className="flex-none text-[12.5px] tabular-nums" style={{ color: colors.muted }}>
              {s.debit.toFixed(2).replace(".", ",")} m³/h
            </span>
          </p>
          {s.part && (
            <p className="mt-1 text-[12.5px]" style={{ color: colors.muted }}>
              {s.part}
            </p>
          )}
        </div>
      ))}

      <p className={`mx-[22px] mt-7 ${libelleCaps}`} style={{ color: colors.muted }}>
        Le détail des pièces
      </p>
      <div className="mx-[22px] mt-2 rounded-[12px] px-4 py-1" style={{ backgroundColor: colors.card }}>
        {plan.materiel.map((m, i) => (
          <p
            key={`${m.nom}-${i}`}
            className="flex items-baseline gap-3 py-[9px] text-[14.5px]"
            style={i === 0 ? undefined : { borderTop: `1px solid ${colors.line}` }}
          >
            <span className="w-[42px] flex-none text-[13.5px] font-semibold tabular-nums" style={{ color: colors.or }}>
              {m.q} {m.u}
            </span>
            <span className="min-w-0 flex-1">{m.nom}</span>
            {/* **La référence, quand elle existe.** C'est elle qui part chez le
                fournisseur ; une ligne sans référence est une ligne à mesurer ou
                à assembler, et le silence vaut mieux qu'une référence inventée. */}
            {m.ref && (
              <span className="flex-none text-[11.5px]" style={{ color: colors.muted }}>
                {m.ref}
              </span>
            )}
          </p>
        ))}
      </div>

      {/* **Ce que la lecture n'a pas su lire se DIT.** Un plan qui tait ses
          trous fait acheter de travers, et c'est le paysagiste qui revient
          poser les pièces manquantes (`CLAUDE.md` §4). */}
      {reserves.length > 0 && (
        <ul className="mx-[22px] mt-5 list-none p-0">
          {reserves.map((r, i) => (
            <li key={i} className="mt-1.5 text-[13px] leading-relaxed" style={{ color: colors.alert }}>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
