"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE, NOM_CATEGORIE, ORDRE_CATEGORIES } from "@/lib/couleurs-comptable";
import type { Categorie } from "@/lib/pour-mon-comptable";
import { delierAction } from "../actions";

export type LigneAffichee = {
  id: string;
  jour: string;
  libelle: string;
  categorie: Categorie;
  montant: string;
  sens: "entree" | "sortie";
  aJustifier: boolean;
  preuve: { genre: "ticket"; texte: string; ticketId: string | null } | { genre: "ok" | "perdu" | "manque"; texte: string };
  /** Une sortie justifiée se défait d'un appui : « ce n'est pas le bon ticket ». */
  defaisable: boolean;
};

type Filtre = "tout" | "manque" | Categorie;

/**
 * Le relevé, ses filtres et la photo du ticket — écran 3 de la planche.
 *
 * Toucher une ligne qui a son ticket ouvre la photo en plein écran (sa demande
 * du 23 octobre : « je dois pouvoir voir la photo du ticket »), avec « Ce
 * n'est pas le bon ticket » : la ligne repasse sans ticket (« s'il se trompe,
 * je peux annuler ? »).
 */
export default function Releve({ lignes }: { lignes: LigneAffichee[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [ouverte, setOuverte] = useState<LigneAffichee | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  const presentes = useMemo(() => ORDRE_CATEGORIES.filter((c) => lignes.some((l) => l.categorie === c)), [lignes]);
  const visibles = lignes.filter((l) => (filtre === "tout" ? true : filtre === "manque" ? l.aJustifier : l.categorie === filtre));

  function defaire(l: LigneAffichee) {
    setRefus(null);
    demarrer(async () => {
      const r = await delierAction(l.id);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setOuverte(null);
      router.refresh();
    });
  }

  const pastille = (actif: boolean) => ({
    border: `1px solid ${actif ? colors.ink : colors.line}`,
    backgroundColor: colors.card,
    color: actif ? colors.ink : colors.inkSoft,
  });

  return (
    <>
      <div className="mt-4 flex gap-1.5 overflow-x-auto px-6 pb-1" role="group" aria-label="Filtrer">
        <button type="button" aria-pressed={filtre === "tout"} onClick={() => setFiltre("tout")} className="min-h-[40px] flex-none rounded-full px-3 text-[13px]" style={pastille(filtre === "tout")}>
          Tout
        </button>
        <button type="button" aria-pressed={filtre === "manque"} onClick={() => setFiltre("manque")} className="inline-flex min-h-[40px] flex-none items-center gap-1.5 rounded-full px-3 text-[13px]" style={pastille(filtre === "manque")} data-atlas="filtre-sans-ticket">
          <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.alert }} />
          Sans ticket
        </button>
        {presentes.map((c) => (
          <button key={c} type="button" aria-pressed={filtre === c} onClick={() => setFiltre(c)} className="inline-flex min-h-[40px] flex-none items-center gap-1.5 rounded-full px-3 text-[13px]" style={pastille(filtre === c)}>
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[c] }} />
            {c === "virement" ? "Virement" : NOM_CATEGORIE[c]}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="mx-6 mt-6 text-[15px]" style={{ color: colors.rust }}>
          {lignes.length === 0 ? "Aucune ligne de banque sur cette période." : "Rien ne manque."}
        </p>
      ) : (
        <ul className="mx-6 mt-3" data-atlas="releve">
          {visibles.map((l, i) => {
            const nouveauJour = i === 0 || visibles[i - 1].jour !== l.jour;
            const touchable = l.preuve.genre === "ticket" && l.preuve.ticketId !== null;
            const contenu = (
              <>
                <span className="w-1 flex-none self-stretch rounded-sm" style={{ backgroundColor: COULEUR_CATEGORIE[l.categorie] }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{l.libelle}</span>
                  <span className="block text-[12.5px]" style={{ color: COULEUR_CATEGORIE[l.categorie] }}>
                    {NOM_CATEGORIE[l.categorie]}
                  </span>
                  <span
                    className={`mt-1 block text-[12.5px] ${l.preuve.genre === "manque" ? "font-medium" : ""} ${l.preuve.genre === "perdu" ? "italic" : ""}`}
                    style={{ color: l.preuve.genre === "manque" ? colors.alert : l.preuve.genre === "perdu" ? colors.muted : touchable ? colors.rust : colors.inkSoft }}
                  >
                    {l.preuve.texte}
                  </span>
                </span>
                <span className="flex-none text-[16px] tabular-nums" style={{ fontFamily: font.display, color: l.sens === "entree" ? colors.montantEntree : colors.montantSortie }}>
                  {l.montant}
                </span>
              </>
            );
            return (
              <li key={l.id}>
                {nouveauJour && (
                  <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: colors.muted }}>
                    {l.jour}
                  </p>
                )}
                {touchable ? (
                  <button type="button" onClick={() => setOuverte(l)} className="flex w-full items-start gap-3 py-3 text-left" style={{ borderTop: nouveauJour ? "none" : `1px solid ${colors.lineSoft}` }} data-atlas="ligne-avec-ticket">
                    {contenu}
                  </button>
                ) : (
                  <div className="flex items-start gap-3 py-3" style={{ borderTop: nouveauJour ? "none" : `1px solid ${colors.lineSoft}` }} data-atlas="ligne-du-releve">
                    {contenu}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {ouverte && ouverte.preuve.genre === "ticket" && ouverte.preuve.ticketId && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-auto px-5 pb-6 pt-4" style={{ backgroundColor: colors.cream }} role="dialog" aria-modal="true" aria-label="Photo du ticket" data-atlas="photo-du-ticket">
          <button type="button" onClick={() => setOuverte(null)} className="min-h-[44px] self-start text-[15px]" style={{ color: colors.inkSoft }}>
            Fermer
          </button>
          <p className="mt-1 text-[18px] leading-[1.3]" style={{ fontFamily: font.display }}>
            {ouverte.libelle}
          </p>
          <p className="text-[13px]" style={{ color: colors.muted }}>
            {ouverte.jour}, {ouverte.montant}
          </p>
          {/* eslint-plugin-next préfère <Image> ; une photo privée servie par une
              route qui relit la RLS ne passe pas par l'optimiseur d'images. */}
          <img src={`/termines/comptable/ticket/${ouverte.preuve.ticketId}`} alt="Photo du ticket" className="mx-auto mt-4 max-h-[62vh] w-auto max-w-full rounded-md" style={{ border: `1px solid ${colors.line}` }} />
          <p className="mt-4 text-center text-[13px]" style={{ color: colors.muted }}>
            {ouverte.preuve.texte}
          </p>
          {ouverte.defaisable && (
            <div className="mt-2 flex justify-center">
              <button type="button" disabled={enCours} onClick={() => defaire(ouverte)} className="min-h-[44px] rounded-full px-5 text-[14px] font-medium disabled:opacity-60" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }} data-atlas="pas-le-bon-ticket">
                Ce n’est pas le bon ticket
              </button>
            </div>
          )}
          {refus && (
            <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-center text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
              {refus}
            </p>
          )}
        </div>
      )}
    </>
  );
}
