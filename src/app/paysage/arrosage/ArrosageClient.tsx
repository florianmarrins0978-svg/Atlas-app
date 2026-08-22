"use client";

import { useActionState, useRef, useState } from "react";
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
export default function ArrosageClient({
  iaPrete,
  motifIA,
}: {
  iaPrete: boolean;
  /** Pourquoi la lecture ne se fera pas, en français. `null` quand elle se fera. */
  motifIA: string | null;
}) {
  const [etat, agir, enCours] = useActionState<EtatPlan, FormData>(lireLeCroquis, { etat: "vide" });
  /**
   * **Les mesures n'apparaissent QUE si le piquage n'est pas au compteur.**
   *
   * *Sa correction du 20 août au soir, sur capture :* « quand je choisis le
   * piquage, qu'il se fait après le compteur d'eau, rien ne doit s'afficher. Il
   * ne doit pas y avoir marqué dix litres, vingt, trois bars. Or, quand je
   * choisis piquage après robinet, là un encart doit s'ouvrir. »
   *
   * Et il a raison sur le fond : après le compteur, la pression du réseau de
   * ville est connue — c'est ailleurs qu'elle ne l'est pas.
   */
  const [piquage, setPiquage] = useState("compteur");
  const formulaire = useRef<HTMLFormElement>(null);

  /**
   * **La photo choisie PART toute seule.**
   *
   * *Sa correction du 20 août au soir :* « quand je clique sur croquis et que
   * j'ajoute une photo, rien ne se passe ».
   *
   * Il avait raison, et c'était un défaut de parcours, pas de code : le bouton
   * ouvrait bien l'appareil, mais rien ne soumettait le formulaire ensuite. Il
   * aurait fallu toucher un second bouton — que l'écran ne montrait pas, à sa
   * demande. **Ma suite ne l'a pas vu parce qu'elle ne posait jamais de
   * photo** : elle vérifiait que le bouton existe, jamais que le geste aboutit
   * (`AGENTS.md` — parcourir en entier ce qu'on transmet).
   */
  function photoChoisie(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) formulaire.current?.requestSubmit();
  }

  return (
    <form ref={formulaire} action={agir} className="pb-[86px]">
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
          value={piquage}
          onChange={(e) => setPiquage(e.target.value)}
          className="mt-[7px] block w-full appearance-none rounded-[11px] border-0 px-[14px] py-[15px] text-[16px]"
          style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}`, minHeight: 52 }}
        >
          <option value="compteur">Juste après le compteur d’eau</option>
          {/* Le puits et la cuve sont retirés sur sa demande du 20 août au soir :
              « tu peux retirer le piquage sur une pompe ».

              **Le libellé dit « Robinet de jardin », la valeur reste
              `ailleurs`** — sa dernière correction du même soir. Le mot est ce
              qu'il lit ; la valeur porte la RÈGLE (ici : mesurer plutôt que
              supposer). Les renommer ensemble obligerait à toucher
              `mesure-debit.ts` et sa suite pour un mot d'écran. */}
          <option value="ailleurs">Robinet de jardin</option>
        </select>

        {/* **Deux façons de connaître le débit, et il n'en fait qu'une.** Le
            seau donne le débit directement ; le manomètre donne la pression, et
            le débit s'en déduit. Le seau vaut 10 L — c'est ce qu'il a dit, et
            un seau de maçon en fait dix : le demander serait une case de plus
            pour une réponse toujours pareille.

            Rien n'est prérempli : une valeur posée d'avance se prend pour une
            mesure, et il calculerait sur un chiffre que personne n'a relevé
            (`CLAUDE.md` §4). */}
        {/* **DEUX MESURES, DEUX ENCARTS — sa correction du 21 août :** « la
            mesure au seau ne doit pas rentrer dans le kit débit/pression ».
            Elle avait raison de le gêner : ce sont deux gestes, deux outils et
            deux fiabilités. Les ranger sous un même titre laissait croire que
            le seau se relève AVEC le kit, et qu'un chiffre tiré du seau vaut
            celui du manomètre.

            **L'ordre suit le geste sur le chantier** : le seau se fait à mains
            nues, tout de suite ; le kit se visse et se lit. Le premier donne le
            DÉBIT — la seule grandeur qu'aucune pression ne donne. Les deux
            suivants disent ce qui arrivera aux arroseurs (la dynamique décide,
            sous 2,5 bar ils sortent mal) et d'où vient le manque (l'écart avec
            la statique accuse la conduite, pas le réseau).

            Rien n'est prérempli — une valeur posée d'avance se prend pour une
            mesure (`CLAUDE.md` §4). */}
        {piquage !== "compteur" && (
          <div data-atlas="mesures" className="mt-4">
            <div data-atlas="seau">
              <p className={`block ${libelleCaps}`} style={{ color: colors.or }}>
                Mesure au seau
              </p>
              <label className={`mt-3 block ${libelleCaps}`} style={{ color: colors.muted }} htmlFor="secondes">
                Un seau de 10 L rempli en… secondes
              </label>
              <input
                id="secondes"
                name="secondes"
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                placeholder="20"
                className="mt-[5px] block w-full rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
                style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              />
              {/* **Le seau se dédouane, et il dit QUOI FAIRE À LA PLACE.** Sa
                  correction du 21 août : « peu précis, ordre de grandeur, ça ne
                  va rien dire — qu'on comprenne tout de suite qu'en gros ce
                  n'est pas une bonne idée de calculer au seau pour son arrosage
                  automatique ».

                  Une réserve qui qualifie le chiffre (« approximatif ») se lit
                  comme une nuance et se franchit sans y penser. Une réserve qui
                  DÉCONSEILLE le geste et désigne l'outil juste ferme la
                  question — c'est la différence entre un avertissement qu'on
                  ignore et un avertissement qui change ce qu'on fait. */}
              <p className="mt-[6px] text-[13px]" style={{ color: colors.muted }}>
                Trop approximatif pour calculer un arrosage : prenez le kit.
              </p>
            </div>

            <div data-atlas="kit" className="mt-5">
              <p className={`block ${libelleCaps}`} style={{ color: colors.or }}>
                Kit débit / pression, buse 5
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <span className="min-w-0">
                  <label className={`block ${libelleCaps}`} style={{ color: colors.muted }} htmlFor="barStatique">
                    Bar statique
                  </label>
                  <input
                    id="barStatique"
                    name="barStatique"
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    step="any"
                    placeholder="3,5"
                    className="mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
                    style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                  />
                </span>
                <span className="min-w-0">
                  <label className={`block ${libelleCaps}`} style={{ color: colors.muted }} htmlFor="barDynamique">
                    Bar dynamique
                  </label>
                  <input
                    id="barDynamique"
                    name="barDynamique"
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    step="any"
                    placeholder="3"
                    className="mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
                    style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                  />
                </span>
              </div>
            </div>
          </div>
        )}
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
        <input
          id="croquis"
          name="croquis"
          type="file"
          accept="image/*"
          // **PAS de `capture` — sa demande du 21 août 2026 :** « soit je peux
          // mettre une photo de ma bibliothèque, soit prendre une photo ; le
          // même schéma que pour ajouter des photos à la fiche client ».
          //
          // `capture="environment"` n'est pas une préférence, c'est un ORDRE :
          // le téléphone saute directement à l'appareil et le menu ne s'ouvre
          // jamais. Un croquis se dessine souvent la veille, au bureau — le
          // forcer à le rephotographier depuis son écran est une photo de photo,
          // floue et de travers, que le modèle lira mal.
          //
          // La pellicule du chantier (`Pellicule.tsx`) ne porte pas non plus cet
          // attribut, et c'est bien pour ça que son menu s'ouvre là-bas.
          hidden
          onChange={photoChoisie}
        />
      </div>

      {/* **L'IA indisponible se DIT, et avant le geste.** Sans lecture, le
          laisser photographier pour rien serait le troisième bouton qui ne
          répond pas.

          **Le motif vient du serveur, il n'est pas rédigé ici** — corrigé le
          21 août 2026. L'écran affirmait « aucune clé d'IA n'est posée sur ce
          serveur » quelle que soit la cause : c'est faux quand la clé est là
          mais que le fournisseur choisi ne sait pas lire une image, et cela
          envoie coller une clé qui ne changera rien (`CLAUDE.md` §5). */}
      {!iaPrete && motifIA && (
        <p
          data-atlas="alerte"
          className="mx-[22px] mt-4 text-[13px] leading-relaxed"
          style={{ color: colors.alert }}
        >
          {motifIA} Le croquis ne sera pas lu.
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

/** Deux décimales, virgule française — un chiffre à l'anglaise se relit mal. */
function virgule(x: number) {
  return x.toFixed(2).replace(".", ",");
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

      {/* **LE SEUIL DU Ø32 — sa demande du 22 août 2026.** Ses fournisseurs
          savent lui dire à partir de combien de mètres le Ø25 ne tient plus ;
          l'outil le dit maintenant aussi, et il le dit AVANT la tranchée.

          **Une ligne, pas un paragraphe** (`CLAUDE.md` §3 ter) : le mètre
          ruban est dans sa poche, le raisonnement est dans le dépôt. */}
      {plan.tuyau.debit > 0 && (
        <p
          className="mx-[22px] mt-3 text-[13px] leading-relaxed"
          style={{ color: plan.tuyau.insuffisantMemeEn32 ? colors.alert : colors.muted }}
          data-atlas="seuil-tuyau"
        >
          {plan.tuyau.insuffisantMemeEn32
            ? `${virgule(plan.tuyau.debit)} m³/h sur un réseau : même le Ø32 est trop juste.`
            : plan.tuyau.seuil25 > 0
              ? `Ø25 jusqu’à ${Math.floor(plan.tuyau.seuil25)} m, Ø32 au-delà.`
              : `Ø32 d’office : ${virgule(plan.tuyau.debit)} m³/h passent trop vite en Ø25.`}
        </p>
      )}

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
