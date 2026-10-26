"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE, NOM_CATEGORIE, ORDRE_CATEGORIES } from "@/lib/couleurs-comptable";
import type { Categorie } from "@/lib/pour-mon-comptable";
import BottomSheet from "@/components/atlas/BottomSheet";
import { delierAction } from "../actions";
import Icone, { type NomIcone } from "../Icone";

export type LigneAffichee = {
  id: string;
  jour: string;
  libelle: string;
  categorie: Categorie;
  montant: string;
  sens: "entree" | "sortie";
  aJustifier: boolean;
  /** `ecart` : une pièce jointe malgré un autre montant, signalée partout. */
  preuve: { genre: "ticket" | "ok" | "perdu" | "manque" | "ecart"; texte: string };
  /** Le fichier qui la justifie, ouvert d'un appui (`/termines/comptable/piece/<ligne>`). */
  piece: { nature: "photo" | "pdf"; quoi: "ticket" | "facture" } | null;
  /** Ce qui a été posé se défait d'un appui : « ce n'est pas le bon ticket ». */
  defaisable: boolean;
};

type Filtre = "tout" | "manque" | Categorie;

/** Le signe de chaque pièce, celui de la planche du 25 octobre 2026. */
const SIGNE: Record<LigneAffichee["preuve"]["genre"], NomIcone> = { ok: "coche", ticket: "photo", perdu: "info", manque: "alerte", ecart: "alerte" };

/**
 * Le relevé, ses filtres et la pièce de chaque ligne — la planche choisie le
 * 25 octobre 2026 (`appli/soignee/termines-comptable.html`, « Le relevé »).
 *
 * Un point de couleur par ligne (la bande de gauche partait : un point suffit),
 * et un signe par pièce. Le filtre « À justifier » compte aussi le virement
 * reçu et le virement sans facture : il s'appelait « Sans ticket ».
 *
 * Toucher une ligne qui a sa pièce l'ouvre (sa demande du 23 octobre : « je
 * dois pouvoir voir la photo du ticket »), avec « Ce n'est pas le bon ticket » :
 * la ligne repasse à justifier (« s'il se trompe, je peux annuler ? »).
 */
export default function Releve({ lignes }: { lignes: LigneAffichee[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [ouverte, setOuverte] = useState<LigneAffichee | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  // Les couleurs sont celles des dépenses : un virement reçu n'a pas de filtre à lui.
  const presentes = useMemo(() => ORDRE_CATEGORIES.filter((c) => lignes.some((l) => l.sens === "sortie" && l.categorie === c)), [lignes]);
  const visibles = lignes.filter((l) => (filtre === "tout" ? true : filtre === "manque" ? l.aJustifier : l.sens === "sortie" && l.categorie === filtre));

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

  const filtres: { cle: Filtre; nom: string; point: string | null }[] = [
    { cle: "tout", nom: "Tout", point: null },
    { cle: "manque", nom: "À justifier", point: colors.alert },
    ...presentes.map((c) => ({ cle: c as Filtre, nom: c === "virement" ? "Virement" : NOM_CATEGORIE[c], point: COULEUR_CATEGORIE[c] })),
  ];

  return (
    <>
      <div className="mt-3.5 flex gap-2 overflow-x-auto px-6 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Filtrer">
        {filtres.map((f) => (
          <button
            key={f.cle}
            type="button"
            aria-pressed={filtre === f.cle}
            onClick={() => setFiltre(f.cle)}
            className={`inline-flex min-h-[44px] flex-none items-center gap-[7px] rounded-full px-[15px] text-[15px] ${filtre === f.cle ? "font-semibold" : ""}`}
            style={{ boxShadow: `inset 0 0 0 ${filtre === f.cle ? 2 : 1}px ${filtre === f.cle ? colors.ink : colors.line}`, color: filtre === f.cle ? colors.ink : colors.inkSoft }}
            data-atlas={f.cle === "manque" ? "filtre-a-justifier" : undefined}
          >
            {f.point && <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.point }} />}
            {f.nom}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="mx-6 mt-6 text-[15.5px]" style={{ color: colors.inkSoft }}>
          {lignes.length === 0 ? "Aucune ligne de banque sur cette période." : "Rien ne manque."}
        </p>
      ) : (
        <ul className="mx-6 mt-1" data-atlas="releve">
          {visibles.map((l, i) => {
            const nouveauJour = i === 0 || visibles[i - 1].jour !== l.jour;
            const contenu = (
              <>
                <span className="mt-1.5 inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[l.categorie] }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium [overflow-wrap:anywhere]">{l.libelle}</span>
                  <span className="mt-px block text-[14px]" style={{ color: colors.inkSoft }}>
                    {NOM_CATEGORIE[l.categorie]}
                  </span>
                  <span
                    className={`mt-[5px] flex items-start gap-1.5 text-[14.5px] leading-[1.35] ${l.preuve.genre === "perdu" ? "italic" : ""} ${["ticket", "manque", "ecart"].includes(l.preuve.genre) ? "font-semibold" : ""}`}
                    style={{
                      color:
                        l.preuve.genre === "manque"
                          ? colors.alert
                          : l.preuve.genre === "ecart"
                            ? colors.carteAmbreTexte
                            : l.preuve.genre === "ticket"
                              ? colors.rust
                              : colors.inkSoft,
                    }}
                    data-genre={l.preuve.genre}
                  >
                    <span className="mt-px" style={l.preuve.genre === "ok" ? { color: colors.carteVertTexte } : undefined}>
                      <Icone nom={SIGNE[l.preuve.genre]} taille={17} epaisseur={2} />
                    </span>
                    <span>{l.preuve.texte}</span>
                  </span>
                </span>
                <span className="flex-none whitespace-nowrap text-[17px] leading-[1.3] tabular-nums" style={{ fontFamily: font.display, color: l.sens === "entree" ? colors.montantEntree : colors.montantSortie }}>
                  {l.montant}
                </span>
              </>
            );
            const pas = nouveauJour ? "pt-1.5" : "pt-3";
            return (
              <li key={l.id}>
                {nouveauJour && (
                  <h3 className="mb-0.5 mt-[22px] text-[15px] font-bold" style={{ color: colors.ink, fontFamily: font.body }}>
                    {l.jour}
                  </h3>
                )}
                {l.piece ? (
                  <button type="button" onClick={() => setOuverte(l)} className={`flex w-full items-start gap-3 pb-3 text-left ${pas}`} style={nouveauJour ? undefined : { boxShadow: `inset 0 1px 0 ${colors.line}` }} data-atlas="ligne-avec-ticket">
                    {contenu}
                  </button>
                ) : (
                  <div className={`flex items-start gap-3 pb-3 ${pas}`} style={nouveauJour ? undefined : { boxShadow: `inset 0 1px 0 ${colors.line}` }} data-atlas="ligne-du-releve">
                    {contenu}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <BottomSheet open={ouverte !== null && ouverte.piece !== null} onBackdropClick={() => setOuverte(null)}>
        {ouverte?.piece && (
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={ouverte.piece.quoi === "ticket" ? "Photo du ticket" : "La facture"} data-atlas="photo-du-ticket">
            <p className="text-[22px] leading-[1.25]" style={{ fontFamily: font.display }}>
              {ouverte.libelle}
            </p>
            <p className="mt-1 text-[15px]" style={{ color: colors.inkSoft }}>
              {ouverte.jour}, {ouverte.montant}
            </p>
            {ouverte.piece.nature === "photo" ? (
              <div className="mt-3.5 flex justify-center rounded-[18px] px-3 py-5" style={{ backgroundColor: colors.rustTint }}>
                {/* eslint-plugin-next préfère <Image> ; une photo privée servie par une
                    route qui relit la RLS ne passe pas par l'optimiseur d'images. */}
                <img src={`/termines/comptable/piece/${ouverte.id}`} alt={ouverte.piece.quoi === "ticket" ? "Photo du ticket" : "Photo de la facture"} className="max-h-[52vh] w-auto max-w-full rounded-md" />
              </div>
            ) : (
              <a href={`/termines/comptable/piece/${ouverte.id}`} target="_blank" rel="noreferrer" className="mt-3.5 inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-[16px] font-medium" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}>
                <Icone nom="document" taille={21} />
                Ouvrir la facture
              </a>
            )}
            <p className="mb-3 mt-3.5 text-center text-[15px]" style={{ color: colors.inkSoft }}>
              {ouverte.preuve.texte}
            </p>
            {ouverte.defaisable && (
              <button type="button" disabled={enCours} onClick={() => defaire(ouverte)} className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-[16px] font-medium disabled:opacity-60" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.card, color: colors.ink }} data-atlas="pas-le-bon-ticket">
                <Icone nom="annuler" taille={21} />
                {ouverte.piece.quoi === "ticket" ? "Ce n’est pas le bon ticket" : "Ce n’est pas la bonne facture"}
              </button>
            )}
            {refus && (
              <p role="alert" className="mt-3 rounded-[12px] px-3.5 py-2.5 text-center text-[14px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
                {refus}
              </p>
            )}
            <button type="button" onClick={() => setOuverte(null)} className="mt-0.5 min-h-[48px] w-full text-[16px] font-medium" style={{ color: colors.inkSoft }}>
              Fermer
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
