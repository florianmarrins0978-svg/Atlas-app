"use client";

import { useMemo } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { grilleDuMois, JOURS_COURTS, MOIS_LONGS } from "@/lib/mois";
import { etatDemi, partDeLaBarre, type EtatDemi } from "@/lib/planning-jour";
import type { JourIso } from "@/server/disponibilites";

/**
 * LE MOIS AVEC SA CHARGE — le calendrier du planning, extrait pour être
 * employé partout où il faut choisir un jour.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce fichier existe, et pourquoi il ne doit pas se dédoubler.**
 *
 * Sa demande du 22 août 2026 : *« lorsqu'on clique sur "Choisir la date" et que
 * le calendrier s'affiche pour proposer une date au client, on devrait avoir le
 * visuel du calendrier qui se trouve dans la catégorie planning, avec la
 * possibilité de cliquer sur les jours pour voir quels chantiers y sont déjà
 * affectés — comme ça on peut savoir si oui ou non on peut rajouter des clients
 * sur les jours. »* Validé sur planche le même jour
 * (`appli/choisir-la-date.html`, planche 91) : *« cette maquette est parfaite,
 * tu peux coder ça trait pour trait, ne change rien »*.
 *
 * L'écran d'envoi montrait jusque-là un calendrier NU : des ronds, et les jours
 * impossibles simplement éteints. Il refusait un jour **sans jamais dire
 * pourquoi ni ce qui s'y trouvait** — impossible de juger si l'on pouvait
 * quand même s'y glisser.
 *
 * **Ce dessin vivait dans `PlanningClient`, et il en sort d'un bloc.** Le
 * recopier aurait donné deux calendriers qui divergent au premier réglage —
 * exactement ce que `CLAUDE.md` §3 interdit, et le prix serait lourd : deux
 * écrans qui se suivent ne peindraient plus la même journée.
 *
 * ─── Quatre choix de sa planche, et aucun n'est décoratif ─────────────────
 *
 *   1. les jours des autres mois DISPARAISSENT — ils ne portaient rien, et six
 *      cases de chiffres gris se lisent quand même ;
 *   2. les cases sont carrées et espacées : le doigt vise 44 px, et l'œil
 *      sépare les semaines sans un seul trait ;
 *   3. le week-end est une colonne TEINTÉE, pas un chiffre pâle — la teinte se
 *      voit du coin de l'œil ;
 *   4. aujourd'hui porte un cercle d'or, et un retour apparaît dès qu'on s'en
 *      éloigne : sans lui, on se perd à trois mois.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Ce qu'une demi-journée porte — la forme rendue par `occupationDemi`. */
export type OccupationLue = { pris: readonly unknown[]; charge: number };

export type Curseur = { annee: number; mois: number };

export default function MoisCharge({
  curseur,
  setCurseur,
  aujourdHui,
  jourTouche,
  onToucherJour,
  occupationDe,
  jourRetenu,
  jourRetenus,
  reperePrefixe = "",
}: {
  curseur: Curseur;
  setCurseur: (maj: (c: Curseur) => Curseur) => void;
  aujourdHui: JourIso;
  /** Le jour REGARDÉ — celui dont la fiche s'ouvre dessous. */
  jourTouche: JourIso | null;
  onToucherJour: (jour: JourIso) => void;
  occupationDe: (jour: JourIso, demi: "matin" | "apres_midi") => OccupationLue;
  /**
   * Les jours RETENUS, peints en plein.
   *
   * **Distinct de `jourTouche`, et c'est tout le sujet sur l'écran d'envoi :**
   * on regarde une journée pour savoir qui y est déjà, on en retient une pour
   * la proposer au client. Confondre les deux ferait proposer un jour qu'on
   * voulait seulement consulter — sur un devis, cela part chez quelqu'un.
   */
  jourRetenu?: JourIso | null;
  jourRetenus?: readonly JourIso[];
  /** Préfixe des repères `data-atlas`, quand deux mois cohabitent sur un écran. */
  reperePrefixe?: string;
}) {
  const cases = useMemo(() => grilleDuMois(curseur.annee, curseur.mois), [curseur]);
  const retenus = useMemo(
    () => new Set([...(jourRetenus ?? []), ...(jourRetenu ? [jourRetenu] : [])]),
    [jourRetenus, jourRetenu]
  );

  const dAujourdHui = new Date(`${aujourdHui}T12:00:00Z`);
  const surLeMois =
    dAujourdHui.getUTCFullYear() === curseur.annee && dAujourdHui.getUTCMonth() === curseur.mois;

  return (
    <div>
      <div className="flex items-center justify-between gap-2.5">
        <Fleche
          libelle="Mois précédent"
          signe="‹"
          onClick={() =>
            setCurseur((c) => (c.mois === 0 ? { annee: c.annee - 1, mois: 11 } : { ...c, mois: c.mois - 1 }))
          }
        />
        <div className="flex-1 text-center">
          <b
            data-atlas={`${reperePrefixe}mois-titre`}
            className="block text-[15px] font-bold leading-[1.2]"
            style={{ color: colors.ink }}
          >
            {MOIS_LONGS[curseur.mois]} {curseur.annee}
          </b>
        </div>
        <Fleche
          libelle="Mois suivant"
          signe="›"
          onClick={() =>
            setCurseur((c) => (c.mois === 11 ? { annee: c.annee + 1, mois: 0 } : { ...c, mois: c.mois + 1 }))
          }
        />
      </div>

      <div
        className="mb-1.5 mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase"
        style={{ letterSpacing: "0.1em", color: colors.muted }}
        aria-hidden="true"
      >
        {JOURS_COURTS.map((j, i) => (
          <span key={`${j}-${i}`} style={i >= 5 ? { color: voile(colors.ink, 0.3) } : undefined}>
            {j}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" data-atlas={`${reperePrefixe}grille-mois`}>
        {cases.map((c) =>
          c.horsMois ? (
            <span key={c.jour} data-atlas="creux" style={{ aspectRatio: "1 / 1.06" }} />
          ) : (
            <button
              key={c.jour}
              type="button"
              data-jour={c.jour}
              // **L'état de la case, lisible par une suite.** Il ne dit pas si
              // le serveur acceptera ce jour — lui seul le sait — mais ce que
              // la case EST : retenue pour le client, un week-end, un jour
              // passé, ou une journée qu'on peut aller regarder.
              //
              // **« week-end » DÉCRIT, il n'interdit pas.** Sa règle du 23 août
              // 2026 : *« le samedi et le dimanche, l'utilisateur doit pouvoir
              // le proposer ; s'il a des salariés qui font des extras, il doit
              // pouvoir sélectionner ces deux jours »*. La case reste donc
              // touchable — elle l'était déjà — et seule sa teinte le distingue
              // d'un mardi.
              data-etat={
                retenus.has(c.jour)
                  ? "retenu"
                  : c.weekEnd
                    ? "week-end"
                    : c.jour < aujourdHui
                      ? "passe"
                      : "regardable"
              }
              aria-pressed={c.jour === jourTouche}
              // **L'état reste ANNONCÉ, même s'il ne s'écrit plus.** La planche
              // a retiré les mots de la case — c'est la couleur qui parle —,
              // mais une couleur ne se lit pas à voix haute.
              aria-label={`${c.numero} ${MOIS_LONGS[curseur.mois]} — matin : ${ditLaBarre(
                occupationDe(c.jour, "matin")
              )}, après-midi : ${ditLaBarre(occupationDe(c.jour, "apres_midi"))}`}
              onClick={() => onToucherJour(c.jour)}
              className="flex flex-col items-center justify-center gap-1 rounded-[10px] border-0 p-0"
              style={{
                aspectRatio: "1 / 1.06",
                background: retenus.has(c.jour)
                  ? colors.rust
                  : c.jour === jourTouche
                    ? colors.rustTint
                    : c.weekEnd
                      ? voile(colors.ink, 0.035)
                      : "transparent",
                boxShadow:
                  c.jour === jourTouche
                    ? `inset 0 0 0 1.5px ${colors.ink}`
                    : c.jour === aujourdHui
                      ? `inset 0 0 0 1.5px ${colors.or}`
                      : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                className="text-[17px] leading-none"
                style={{
                  fontFamily: font.display,
                  color: retenus.has(c.jour)
                    ? surPlein
                    : c.jour === aujourdHui
                      ? colors.or
                      : c.weekEnd
                        ? voile(colors.ink, 0.42)
                        : colors.ink,
                  fontWeight: c.jour === aujourdHui ? 600 : 400,
                }}
              >
                {c.numero}
              </span>
              <MarqueDuJour
                matin={occupationDe(c.jour, "matin")}
                apres={occupationDe(c.jour, "apres_midi")}
                cache={c.weekEnd}
                surFondPlein={retenus.has(c.jour)}
              />
            </button>
          )
        )}
      </div>

      {/* Le retour n'existe QUE si l'on s'est éloigné : un bouton toujours là
          se lit comme une action à faire. */}
      {!surLeMois && (
        <button
          type="button"
          data-atlas={`${reperePrefixe}retour-aujourdhui`}
          onClick={() =>
            setCurseur(() => ({
              annee: dAujourdHui.getUTCFullYear(),
              mois: dAujourdHui.getUTCMonth(),
            }))
          }
          className="mx-auto mt-3 block border-0 bg-transparent text-[11px] font-semibold uppercase"
          style={{ letterSpacing: "0.18em", color: colors.or }}
        >
          ← Aujourd’hui
        </button>
      )}

      <Legende />
    </div>
  );
}

/** Ce que dit une barre, en toutes lettres — pour qui n'emploie pas ses yeux. */
function ditLaBarre(o: OccupationLue): string {
  const etat = etatDemi(o);
  if (etat === "libre") return "libre";
  if (etat === "plein") return "complet";
  if (etat === "dela") return `${Math.round(o.charge * 100)} % de vos équipes`;
  return `${o.pris.length} chantier${o.pris.length > 1 ? "s" : ""}`;
}

export function fondDeLEtat(etat: EtatDemi): string {
  if (etat === "dispo") return colors.vertPale;
  if (etat === "plein") return colors.rust;
  if (etat === "dela") return colors.bordeaux;
  return "transparent";
}

/**
 * Les deux barres sous le chiffre : le matin dessus, l'après-midi dessous.
 *
 * **Sa question du 21 août : « comment tu vas faire s'il y a dix équipes ? »**
 * Trois états ne tenaient pas : avec dix équipes, « il reste de la place »
 * couvre une équipe prise comme neuf. La barre se REMPLIT donc à la
 * proportion — deux prises sur dix, c'est un cinquième de barre.
 */
export function MarqueDuJour({
  matin,
  apres,
  cache,
  surFondPlein = false,
}: {
  matin: OccupationLue;
  apres: OccupationLue;
  cache?: boolean;
  /** Sur un jour retenu, peint en vert plein : le creux des barres s'éclaircit. */
  surFondPlein?: boolean;
}) {
  const barre = (o: OccupationLue, quoi: string) => {
    const etat = etatDemi(o);
    return (
      <i
        key={quoi}
        data-demi={quoi}
        data-etat={etat}
        className="flex h-[6px] overflow-hidden rounded-[2px]"
        style={
          surFondPlein
            ? { background: voile(surPlein, 0.22) }
            : { background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }
        }
      >
        <span
          data-atlas="seg"
          className="h-full"
          style={{ width: `${partDeLaBarre(o.charge)}%`, background: fondDeLEtat(etat) }}
        />
      </i>
    );
  };
  return (
    <span
      data-atlas="marque"
      className="flex w-[24px] flex-col gap-[2.5px]"
      style={{ visibility: cache ? "hidden" : "visible" }}
    >
      {barre(matin, "matin")}
      {barre(apres, "apres_midi")}
    </span>
  );
}

function Fleche({ libelle, signe, onClick }: { libelle: string; signe: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={libelle}
      onClick={onClick}
      className="h-[42px] w-[42px] flex-shrink-0 cursor-pointer rounded-full text-[19px] leading-none"
      style={{
        border: `1px solid ${colors.line}`,
        background: colors.card,
        color: colors.ink,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {signe}
    </button>
  );
}

/**
 * La légende : quatre états, puis la POSITION.
 *
 * **Les deux derniers rectangles sont vides tous les deux** — sa correction du
 * 21 août : *« le rectangle du matin, mets-le blanc comme celui de
 * l'après-midi »*. Rempli, le premier se lisait comme un cinquième état, juste
 * après « au-delà » ; il ne dit rien de la charge, seulement où est le matin.
 */
export function Legende() {
  const carre = (etat: EtatDemi) => (
    <i
      data-atlas="carre"
      data-etat={etat}
      className="block h-[10px] w-[10px] flex-shrink-0 rounded-[3px]"
      style={
        etat === "libre"
          ? { background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }
          : { background: fondDeLEtat(etat) }
      }
    />
  );
  const mots: [EtatDemi, string][] = [
    ["libre", "rien"],
    ["dispo", "incomplet"],
    ["plein", "complet"],
    ["dela", "au-delà"],
  ];
  return (
    <div
      data-atlas="legende"
      className="mt-3.5 flex flex-nowrap items-center justify-center gap-1.5 text-[9px]"
      style={{ color: colors.muted }}
    >
      {mots.map(([etat, mot]) => (
        <span key={etat} className="flex flex-shrink-0 items-center gap-[5px] whitespace-nowrap">
          {carre(etat)} {mot}
        </span>
      ))}
      <span
        data-atlas="legende-position"
        className="flex flex-shrink-0 items-center gap-[7px] whitespace-nowrap"
      >
        <span className="flex w-[24px] flex-shrink-0 flex-col gap-[2.5px] self-stretch">
          {["matin", "apres_midi"].map((d) => (
            <i
              key={d}
              className="flex h-[6px] rounded-[2px]"
              style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            />
          ))}
        </span>
        <span className="flex flex-col gap-[2.5px] leading-none">
          <b className="flex h-[6px] items-center text-[9.5px] font-semibold" style={{ color: colors.inkSoft }}>
            matin
          </b>
          <b className="flex h-[6px] items-center text-[9.5px] font-semibold" style={{ color: colors.inkSoft }}>
            après-midi
          </b>
        </span>
      </span>
    </div>
  );
}
