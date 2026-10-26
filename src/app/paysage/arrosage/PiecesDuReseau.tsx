"use client";

import { colors, font, voile } from "@/lib/design-tokens";
import type { Maillon, Poste, ReseauPostes } from "@/lib/arrosage/postes";
import type { Retouches } from "@/lib/arrosage/retouches";
import Vignette, { OMBRE_VIGNETTE } from "./Vignette";
import BoutonAjouter from "./BoutonAjouter";

/**
 * LES PIÈCES D'UN RÉSEAU, SUR LE PLAN DU JARDIN — sa demande du 18 octobre
 * 2026 : *« si le jardin c'est un carré, tu remets le plan avec un carré et les
 * pièces au bon endroit »*. Le plan est recadré sur le réseau ; chaque tête
 * porte son té ou son coude taraudé et son arroseur, à sa place. Le té égal se
 * pose SUR le croisement, l'arroseur à gauche du trait et le té taraudé à
 * droite, juste dessous (validé le même jour, « j'aime bien »).
 *
 * **Sous le plan, la chaîne d'une tête — « la B »** : les pièces dans l'ordre
 * où elles se montent, un « + » là où ça se visse, une double flèche là où le
 * PEBD s'emboîte. La toucher change ou supprime la pièce sur les têtes du
 * réseau, au nombre choisi.
 *
 * **Un goutte-à-goutte n'a pas de tête** : un rail, du coude taraudé de la
 * sortie au bouchon, avec ses couronnes de tube et leurs jonctions ; au-dessus,
 * une ligne ou deux en circuit fermé, et la couronne de 50 ou 100 m.
 */
export default function PiecesDuReseau({
  r,
  retouches,
  onPiece,
  onChaine,
  onAjouter,
  onSortie,
  onCouronne,
}: {
  r: ReseauPostes;
  retouches: Retouches;
  onPiece: (poste: Poste) => void;
  onChaine: (maillon: Maillon, nomPropose: string) => void;
  onAjouter: (ou: string) => void;
  onSortie: (v: "ligne" | "boucle") => void;
  onCouronne: (v: 50 | 100) => void;
}) {
  const style = { "--couleur": r.couleur } as React.CSSProperties;
  return (
    <div className="mt-7 first-of-type:mt-0" style={style} data-atlas="pieces-reseau" data-reseau={r.i}>
      <p className="mb-1 flex min-h-[40px] items-center gap-2.5">
        <span className="block h-[12px] w-[12px] flex-none rounded-[3px]" style={{ backgroundColor: r.couleur }} />
        <b style={{ fontFamily: font.display, fontWeight: 400, fontSize: 20, lineHeight: 1.2 }}>Réseau {r.i + 1}</b>
        <span className="min-w-0 text-[14.5px]" style={{ color: colors.inkSoft }}>{r.nom}</span>
      </p>

      {r.goutte && (
        <>
          {/* Ligne ou boucle, posé AU-DESSUS du réseau qu'il change, pour voir les pièces changer juste dessous. */}
          <Chips valeur={retouches.sortie} choix={[["ligne", "Une seule ligne"], ["boucle", "Deux, en circuit fermé"]]} onChoix={onSortie} libelle="Une ligne ou un circuit fermé" />
          <Chips valeur={retouches.couronne} choix={[[50, "Couronnes de 50 m"], [100, "De 100 m"]]} onChoix={onCouronne} libelle="Couronnes" />
        </>
      )}

      {/* Le PEHD se pose SOUS le titre du réseau, pas en travers du rail. */}
      <div className="mt-[10px] flex items-center gap-2.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
        <Vignette poste={r.pe} taille={44} sansNom onClick={() => onPiece(r.pe)} />
        <span>PEHD Ø25, {r.metres}</span>
      </div>

      {r.plan ? (
        <div className="mt-[10px] rounded-[6px] p-3" style={{ backgroundColor: colors.card }} data-atlas="plan-des-pieces">
          <div className="relative">
            <svg viewBox={`0 0 ${r.plan.largeur} ${r.plan.hauteur}`} className="block h-auto w-full" aria-hidden="true">
              {r.plan.contours.map((pts, i) => (
                <polygon key={i} points={pts} fill={colors.plein} fillOpacity={0.14} stroke={colors.ink} strokeOpacity={0.4} strokeWidth={0.45} />
              ))}
              {r.plan.traits.map((t, i) => (
                <line key={`t${i}`} {...t} stroke={r.couleur} strokeWidth={1.2} strokeLinecap="round" />
              ))}
              {r.plan.antennes.map((a, i) => (
                <line key={`a${i}`} {...a} stroke={r.couleur} strokeWidth={0.6} />
              ))}
            </svg>
            {r.plan.poses.map((p, i) => (
              <div key={i}>
                {p.egal && (
                  <div className="absolute flex gap-[2px]" style={{ left: `${p.gauche}%`, top: `${p.haut}%`, transform: "translate(-50%,-50%)" }}>
                    <Vignette poste={p.egal} taille={32} sansNom surPlanEgal onClick={() => onPiece(p.egal as Poste)} />
                  </div>
                )}
                {p.pieces.length > 0 && (
                  <div className="absolute flex gap-[2px]" style={{ left: `${p.gauche}%`, top: `${p.haut}%`, transform: "translate(-50%,-50%)", marginTop: p.egal ? 36 : 0 }}>
                    {p.pieces.map((x) => (
                      <Vignette key={x.cle} poste={x} taille={32} sansNom onClick={() => onPiece(x)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* « Une petite ligne sous chaque plan avec le nombre de pièces du réseau » : lue sur ce qui est posé, jamais un second calcul. */}
          {r.compteDuPlan && (
            <p className="mx-[2px] mt-[10px] text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
              {r.compteDuPlan}
            </p>
          )}
          {r.chaine && <Chaine maillons={r.chaine} onChaine={onChaine} />}
          {r.ajoutees.length > 0 && (
            <div className="mt-3 flex flex-wrap items-start gap-1.5">
              {r.ajoutees.map((x) => (
                <Vignette key={x.cle} poste={x} taille={54} onClick={() => onPiece(x)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative mt-[10px] rounded-[6px] py-4 pl-7 pr-[10px]" style={{ backgroundColor: colors.card }} data-atlas="rail-goutte">
          <span aria-hidden="true" className="absolute bottom-[18px] left-[14px] top-[18px] w-[5px] rounded-[3px]" style={{ backgroundColor: r.couleur }} />
          <div className="flex flex-wrap items-start gap-1.5">
            {[...r.rail, ...r.ajoutees].map((x) => (
              <Vignette key={x.cle} poste={x} taille={54} onClick={() => onPiece(x)} />
            ))}
          </div>
        </div>
      )}

      <BoutonAjouter libelle={`Ajouter une pièce au réseau ${r.i + 1}`} onClick={() => onAjouter(`r${r.i}`)} />
    </div>
  );
}

/** La chaîne d'une tête : « + » là où ça se visse, double flèche là où le PEBD s'emboîte. */
function Chaine({ maillons, onChaine }: { maillons: Maillon[]; onChaine: (m: Maillon, nomPropose: string) => void }) {
  const liens = ["+", "⟷", "⟷", "+"];
  return (
    <div className="mt-[10px] flex items-start gap-[3px]" aria-label="Les pièces d’une tête, dans l’ordre où elles se montent" data-atlas="chaine">
      {maillons.map((m, i) => (
        <div key={m.type} className="contents">
          <button
            type="button"
            data-atlas="maillon"
            data-type={m.type}
            onClick={() => onChaine(m, m.libelle)}
            className="flex min-w-0 flex-1 flex-col items-center border-0 bg-transparent p-0 text-center"
            style={{ font: "inherit", color: "inherit" }}
          >
            <span
              className="relative flex h-[44px] w-[44px] items-center justify-center rounded-[9px]"
              style={{ backgroundColor: colors.card, boxShadow: OMBRE_VIGNETTE, opacity: m.etat === "retiree" ? 0.35 : 1, filter: m.etat === "retiree" ? "grayscale(1)" : undefined }}
            >
              {m.photo && (
                // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, une photo de pièce, servie telle quelle
                <img src={m.photo} alt="" style={{ maxWidth: 40, maxHeight: 40, mixBlendMode: "multiply" }} />
              )}
              {m.pied && (
                // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, la buse au pied de sa tuyère
                <img src={m.pied} alt="" className="absolute" style={{ right: -5, bottom: -5, width: "55%", borderRadius: 5, backgroundColor: colors.card }} />
              )}
            </span>
            <small className="mt-1" style={{ fontSize: 12.5, lineHeight: 1.3, color: m.etat === "retiree" ? colors.alert : m.etat === "changee" ? colors.orTexte : colors.inkSoft, textDecoration: m.etat === "retiree" ? "line-through" : undefined }}>
              {m.libelle}
            </small>
          </button>
          {i < liens.length && (
            liens[i] === "+" ? (
              <b className="mt-3 flex-none text-[17px]" style={{ color: colors.inkSoft }}>+</b>
            ) : (
              <svg className="mt-[17px] flex-none" width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
                <path d="M1 6H15M1 6l4-4M1 6l4 4M15 6l-4-4M15 6l-4 4" stroke={colors.inkSoft} strokeWidth="1.6" fill="none" />
              </svg>
            )
          )}
        </div>
      ))}
    </div>
  );
}

/** Une rangée de choix, un seul pressé : celle de la planche, pour le goutte-à-goutte comme pour le montage au robinet. */
export function Chips<T extends string | number>({ valeur, choix, onChoix, libelle }: { valeur: T; choix: [T, string][]; onChoix: (v: T) => void; libelle: string }) {
  return (
    // Un choix posé côte à côte sur un fond voilé, la case choisie en carte : le `.choix` de la planche soignée,
    // en capsules (sa règle du 12 août 2026, la même forme pour tous les boutons ; la planche les dessinait à 9 px).
    <div className="mt-3 flex flex-wrap gap-1 rounded-[26px] p-1" style={{ backgroundColor: voile(colors.ink, 0.06) }} role="group" aria-label={libelle}>
      {choix.map(([v, texte]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={valeur === v}
          onClick={() => onChoix(v)}
          className="min-h-[44px] flex-1 rounded-full border-0 px-[10px] text-[15px] font-semibold leading-tight"
          style={valeur === v ? { backgroundColor: colors.card, color: colors.ink, boxShadow: `0 1px 2px ${voile(colors.ink, 0.14)}` } : { backgroundColor: "transparent", color: colors.inkSoft }}
        >
          {texte}
        </button>
      ))}
    </div>
  );
}
