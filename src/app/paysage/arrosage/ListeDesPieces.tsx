"use client";

import { colors, font } from "@/lib/design-tokens";
import { quantiteDeLigne, type Groupe, type Ligne } from "@/lib/arrosage/postes";
import { euros, prixDeLigne, totalDeLaListe, type TableDePrix } from "@/lib/arrosage/prix-de-la-liste";
import { datesDesPrix, sousLePrix, type FournisseurDuPlan } from "@/lib/arrosage/prix-du-plan";

/**
 * LA LISTE : la nourrice, puis chaque réseau — *« en premier la nourrice avec la
 * liste des pièces, ensuite réseau 1, la liste des pièces, réseau 2… »*
 * (18 octobre 2026). Pas de gras dans une liste de pièces (21 août) : chaque
 * ligne compte autant que la suivante.
 *
 * **« Modifier ma liste »** : chaque ligne se supprime (elle reste, barrée, avec
 * « Remettre »), une ligne de plusieurs au nombre choisi (elle reste, avec « k en
 * moins »), et chaque groupe reçoit « Ajouter une pièce ».
 *
 * **Ce qu'il supprime sur le plan reste dans la liste, barré de rouge**, sous les
 * autres lignes, et un bloc entier (un réseau, le piquage, la nourrice) se
 * supprime d'un coup ; **le prix d'achat de chaque ligne est à droite, et le
 * total en dessous**, même à zéro (ses demandes du 19 octobre 2026, planche
 * `appli/arrosage-plan.html`).
 *
 * **Les prix sont ceux d'UN fournisseur, celui de la pastille** (`chez`), et
 * chacun dit de qui il vient et la date de son devis : *« savoir de qui
 * viennent les prix, que je ne me fasse pas avoir »* (20 octobre 2026, planche
 * `appli/arrosage-prix-par-fournisseur.html`).
 */
export default function ListeDesPieces({
  groupes,
  modifier,
  blocsRetires,
  prix,
  chez,
  onRetirer,
  onRemettre,
  onAjouter,
  onBloc,
}: {
  groupes: Groupe[];
  modifier: boolean;
  blocsRetires: Record<string, true>;
  prix: TableDePrix;
  /** Le fournisseur de la pastille ; sans lui (aucun fournisseur), « sans prix ». */
  chez?: FournisseurDuPlan;
  onRetirer: (titre: string, ref: string, ligne: Ligne) => void;
  onRemettre: (titre: string, ref: string) => void;
  onAjouter: (titre: string) => void;
  /** Supprimer ou remettre un bloc entier : un réseau (`"2"`), `"amenee"`, `"nourrice"`. */
  onBloc: (bloc: string, supprimer: boolean) => void;
}) {
  const t = totalDeLaListe(groupes, prix);
  // Aucun prix relevé : « 0,00 € » se lirait comme une liste gratuite, et la
  // phrase « N sans prix sur N » redirait la même chose en plus long (planche
  // soignée du 26 octobre 2026).
  const aucunPrix = t.pieces > 0 && t.sansPrix === t.pieces;
  return (
    <div data-atlas="liste-des-pieces">
      {groupes.map((g) => {
        const blocOte = g.bloc !== undefined && Boolean(blocsRetires[g.bloc]);
        return (
          <div key={g.titre} data-atlas="groupe" data-titre={g.titre} data-otee={blocOte || undefined}>
            <p
              className="mb-0 mt-4 flex items-center gap-2 text-[14px] font-semibold"
              style={blocOte ? { color: colors.muted, textDecoration: "line-through", textDecorationColor: colors.alert, textDecorationThickness: 2 } : undefined}
            >
              {g.couleur && <span className="block h-[10px] w-[10px] flex-none rounded-[3px]" style={{ backgroundColor: g.couleur }} />}
              {g.titre}
            </p>
            <div className="mt-2 rounded-[12px] px-[14px] py-[2px]" style={{ backgroundColor: colors.card }}>
              {Object.entries(g.lignes).map(([ref, e], i) => (
                <LigneDeListe key={ref} e={e} prix={prixDeLigne(ref, e, prix)} chez={chez} unitaire={chez?.prix[ref]} premiere={i === 0} etat="" modifier={modifier} onRetirer={() => onRetirer(g.titre, ref, e)} onRemettre={() => onRemettre(g.titre, ref)} />
              ))}
              {/* Ce qu'il a supprimé sur le plan : barré, toujours visible, sans prix. */}
              {Object.entries(g.barrees).map(([ref, e], i) => (
                <LigneDeListe key={`barree-${ref}`} e={e} prix={null} premiere={i === 0 && !Object.keys(g.lignes).length} etat="barree" modifier={false} onRetirer={() => undefined} onRemettre={() => undefined} />
              ))}
              {modifier &&
                Object.entries(g.retirees).map(([ref, e]) => (
                  <LigneDeListe key={`otee-${ref}`} e={e} prix={null} premiere={false} etat="otee" modifier onRetirer={() => undefined} onRemettre={() => onRemettre(g.titre, ref)} />
                ))}
              {modifier && (
                <button
                  type="button"
                  onClick={() => onAjouter(g.titre)}
                  className="mb-2 mt-1.5 block min-h-[40px] w-full rounded-full bg-transparent text-[14px]"
                  style={{ border: `1.5px dashed ${colors.line}`, color: colors.ink }}
                >
                  Ajouter une pièce
                </button>
              )}
              {modifier && g.bloc !== undefined && (
                <button
                  type="button"
                  onClick={() => onBloc(g.bloc as string, !blocOte)}
                  data-atlas="supprimer-bloc"
                  data-bloc={g.bloc}
                  className="mb-2 mt-1.5 block min-h-[40px] w-full rounded-full bg-transparent text-[14px]"
                  style={{ border: `1.5px dashed ${colors.line}`, color: blocOte ? colors.ink : colors.alert }}
                >
                  {blocOte ? "Remettre " : "Supprimer "}
                  {g.bloc === "amenee" ? "le piquage" : g.bloc === "nourrice" ? "la nourrice" : `le réseau ${Number(g.bloc) + 1}`}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* LE TOTAL, même à zéro : indicatif, hors taxes, sur ses prix d'achat.
          « La C », son choix du 19 octobre 2026 (planche arrosage-total-de-la-liste.html) :
          le montant en or sur la carte, un liseré d'or clair, le nombre de pièces dans une pastille verte. */}
      <div
        className="mt-[14px] flex items-center gap-[14px] rounded-[16px] px-[18px] py-4"
        style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1.5px ${colors.orClair}, 0 6px 16px ${colors.lineSoft}` }}
        data-atlas="total-de-la-liste"
        aria-live="polite"
      >
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase" style={{ letterSpacing: "0.22em", color: colors.muted }}>Total indicatif, hors taxes</span>
          <span className="mt-1 block tabular-nums" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 32, lineHeight: 1.05, color: aucunPrix ? colors.muted : colors.orTexte }}>
            {aucunPrix ? "Aucun prix" : euros(t.total)}
          </span>
          {chez && (
            <span className="mt-[6px] block text-[12.5px]" style={{ color: colors.muted }} data-atlas="dates-des-prix">
              {datesDesPrix(chez)}
            </span>
          )}
        </div>
        <div className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-full text-center" style={{ backgroundColor: colors.plein, color: colors.card, lineHeight: 1.05 }}>
          <b className="text-[20px] font-semibold tabular-nums">{t.pieces}</b>
          <span className="text-[10.5px]">pièce{t.pieces > 1 ? "s" : ""}</span>
        </div>
      </div>
      {t.sansPrix > 0 && !aucunPrix && (
        <p className="mt-[10px] text-[13.5px]" style={{ color: colors.alert }} data-atlas="pieces-sans-prix">
          {t.sansPrix} pièce{t.sansPrix > 1 ? "s" : ""} sans prix{chez ? ` chez ${chez.nom}` : ""} sur {t.pieces}, le total ne les compte pas.
        </p>
      )}
    </div>
  );
}

function LigneDeListe({
  e,
  prix,
  chez,
  unitaire,
  premiere,
  etat,
  modifier,
  onRetirer,
  onRemettre,
}: {
  e: Ligne;
  prix: number | null;
  chez?: FournisseurDuPlan;
  /** Le prix unitaire chez lui, d'où vient le montant. */
  unitaire?: { prixHt: string; releveLe: string };
  premiere: boolean;
  /** `otee` : retirée de la liste ; `barree` : supprimée sur le plan. */
  etat: "" | "otee" | "barree";
  modifier: boolean;
  onRetirer: () => void;
  onRemettre: () => void;
}) {
  const barre = etat === "otee"
    ? { color: colors.muted, textDecoration: "line-through" }
    : etat === "barree"
      ? { color: colors.muted, textDecoration: "line-through", textDecorationColor: colors.alert, textDecorationThickness: 2 }
      : undefined;
  return (
    <div className="flex items-baseline gap-3 py-[9px] text-[14px]" style={premiere ? undefined : { borderTop: `1px solid ${colors.line}` }} data-atlas="ligne" data-otee={etat === "otee" || undefined} data-barree={etat === "barree" || undefined}>
      <span className="w-[58px] flex-none font-semibold tabular-nums" style={{ color: etat ? colors.muted : colors.orTexte, ...barre }}>
        {quantiteDeLigne(e)}
      </span>
      <span className="min-w-0 flex-1" style={barre}>
        {e.nom}
        {e.enMoins ? `, ${e.enMoins} en moins` : ""}
      </span>
      {!etat && (
        <span
          className={`${chez ? "w-[86px]" : "w-[76px]"} flex-none text-right tabular-nums`}
          style={{ color: prix !== null ? colors.ink : chez && e.q ? colors.alert : colors.muted, fontSize: prix === null && chez && e.q ? 12.5 : undefined }}
          data-atlas="prix-de-ligne"
        >
          {/* Une longueur à mesurer n'a pas de prix, quel que soit le fournisseur. */}
          {prix !== null ? euros(prix) : chez && e.q ? `pas de prix chez ${chez.nom}` : "sans prix"}
          {prix !== null && chez && unitaire && (
            <small className="block text-[11.5px]" style={{ color: colors.muted }} data-atlas="source-du-prix">
              {sousLePrix(chez.nom, unitaire.prixHt, e.u, unitaire.releveLe)}
            </small>
          )}
        </span>
      )}
      {modifier && (etat === "otee" || e.enMoins) && (
        <button type="button" onClick={onRemettre} className="flex-none border-0 bg-transparent pl-1.5 text-[13px] underline" style={{ color: colors.ink }}>
          Remettre
        </button>
      )}
      {modifier && !etat && (
        <button type="button" onClick={onRetirer} className="flex-none border-0 bg-transparent pl-1.5 text-[13px] underline" style={{ color: colors.alert }}>
          Supprimer
        </button>
      )}
    </div>
  );
}
