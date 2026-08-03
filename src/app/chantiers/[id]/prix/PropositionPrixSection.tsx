"use client";

import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import type { PropositionPrix, OriginePrix } from "@/server/chiffrage/proposition-prix";
import { ligneDejaAuDetail, type LigneDetail } from "@/lib/proposition-au-detail";
import { calculerPropositionPrixAction, appliquerPropositionPrixAction } from "./actions";

const formatEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

// Libellé court de l'origine. Aucune formulation ne doit laisser croire que
// l'application décide du prix : elle retrouve un tarif, ou calcule à partir de
// paramètres saisis par l'entreprise.
const LIBELLE_ORIGINE: Record<OriginePrix, string> = {
  tarif: "Tarif de l'entreprise",
  chiffrage: "Calculé depuis vos paramètres",
  tarifs_ambigus: "Plusieurs tarifs possibles",
  aucun: "Aucun prix proposable",
};

export default function PropositionPrixSection({
  chantierId,
  propositionInitiale,
  lignesDetail,
  onLigneAjoutee,
}: {
  chantierId: string;
  propositionInitiale: PropositionPrix | null;
  /** Le détail courant du devis — d'où l'on déduit si la proposition y est déjà. */
  lignesDetail: readonly LigneDetail[];
  onLigneAjoutee: (ligne: { id: string; libelle: string; montant: string }) => void;
}) {
  const [proposition, setProposition] = useState<PropositionPrix | null>(propositionInitiale);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tarifChoisi, setTarifChoisi] = useState<string | null>(null);
  const [detailOuvert, setDetailOuvert] = useState(false);

  async function recalculer() {
    setEnCours(true);
    setErreur(null);
    try {
      const maj = await calculerPropositionPrixAction(chantierId);
      setProposition(maj);
      setTarifChoisi(null);
    } catch {
      setErreur("Le calcul n'a pas pu être relancé. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  async function appliquer() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await appliquerPropositionPrixAction(chantierId, tarifChoisi ?? undefined);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      onLigneAjoutee(r.ligne);
    } catch {
      setErreur("Cette proposition n'a pas pu être ajoutée. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  if (!proposition) return null;

  const { explication, origine } = proposition;

  // Déduit du détail, jamais mémorisé dans le navigateur. L'ancien drapeau
  // `appliquee` mourait au premier retour arrière : l'écran reproposait alors
  // une ligne déjà là, et un seul appui doublait le devis (voir
  // `src/lib/proposition-au-detail.ts`).
  //
  // Pour un choix entre plusieurs tarifs, c'est le tarif désigné qu'on cherche
  // dans le détail : les autres candidats restent proposables.
  const libelleVise =
    origine === "tarifs_ambigus"
      ? (proposition.tarifsCandidats.find((c) => c.tarifId === tarifChoisi)?.intitule ?? null)
      : proposition.libelle;
  const dejaAuDetail = ligneDejaAuDetail(libelleVise, lignesDetail);

  const peutAppliquer =
    origine === "tarif" || origine === "chiffrage" || (origine === "tarifs_ambigus" && tarifChoisi !== null);

  return (
    <div className="mx-6 mt-5 flex flex-col gap-3 rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
      <div className="flex items-baseline justify-between">
        <span className={smallCaps} style={{ color: colors.muted }}>
          Proposition
        </span>
        <span className="text-[12px]" style={{ color: colors.rust }}>
          {LIBELLE_ORIGINE[origine]}
        </span>
      </div>

      {proposition.prixPropose !== null && (
        <p className="text-[28px] font-semibold leading-none" style={{ color: colors.ink }}>
          {formatEuros.format(Number(proposition.prixPropose))}
          <span className="ml-2 text-[13px] font-normal" style={{ color: colors.muted }}>
            HT
          </span>
        </p>
      )}

      <p className="text-[13px]" style={{ color: colors.ink }}>
        {explication.origine}
      </p>

      {/* Choix entre plusieurs tarifs — jamais présélectionné. */}
      {origine === "tarifs_ambigus" && (
        <div className="flex flex-col gap-2">
          {proposition.tarifsCandidats.map((c) => (
            <label
              key={c.tarifId}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-[14px]"
              style={{ backgroundColor: colors.cream, color: colors.ink }}
            >
              <input
                type="radio"
                name="tarif-candidat"
                value={c.tarifId}
                checked={tarifChoisi === c.tarifId}
                onChange={() => setTarifChoisi(c.tarifId)}
              />
              <span className="flex-1">{c.intitule}</span>
              <span style={{ color: colors.muted }}>
                {c.prix} €{c.unite ? ` / ${c.unite}` : ""}
              </span>
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setDetailOuvert((v) => !v)}
        className="self-start text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        {detailOuvert ? "Masquer le détail" : "Voir le détail"}
      </button>

      {detailOuvert && (
        <div className="flex flex-col gap-3 rounded-2xl p-3" style={{ backgroundColor: colors.cream }}>
          <BlocExplication titre="Éléments pris en compte" lignes={explication.elementsPrisEnCompte} />
          <BlocExplication titre="Calcul" lignes={explication.calcul} />
          {explication.donneesManquantes.length > 0 && (
            <div>
              <span className={smallCaps} style={{ color: colors.rust }}>
                À compléter
              </span>
              {explication.donneesManquantes.map((d, i) => (
                <p key={i} className="text-[13px]" style={{ color: colors.muted }}>
                  {d}
                </p>
              ))}
            </div>
          )}
          {explication.ambiguites.length > 0 && (
            <div>
              <span className={smallCaps} style={{ color: colors.rust }}>
                À confirmer
              </span>
              {explication.ambiguites.map((a, i) => (
                <p key={i} className="text-[13px]" style={{ color: colors.muted }}>
                  {a}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {erreur && (
        <p className="text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {/* Dire pourquoi le bouton ne répond plus. Un bouton grisé sans phrase se
          lit comme une panne — et ici, c'est au contraire la seule chose qui
          empêche le devis de doubler. */}
      {dejaAuDetail && (
        <p className="text-[13px]" style={{ color: colors.muted }}>
          Déjà au détail : « {dejaAuDetail.libelle} » à {formatEuros.format(Number(dejaAuDetail.montant))}.
          Pour la changer, modifiez la ligne ci-dessous plutôt que d&apos;en ajouter une seconde.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {origine !== "aucun" && (
          <button
            type="button"
            onClick={appliquer}
            disabled={enCours || dejaAuDetail !== null || !peutAppliquer}
            className="rounded-2xl py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: colors.rust }}
          >
            {dejaAuDetail ? "Déjà au détail" : enCours ? "Ajout…" : "Ajouter au détail"}
          </button>
        )}
        <button
          type="button"
          onClick={recalculer}
          disabled={enCours}
          className="text-[14px] font-medium disabled:opacity-40"
          style={{ color: colors.muted }}
        >
          Relancer le calcul
        </button>
      </div>
    </div>
  );
}

function BlocExplication({ titre, lignes }: { titre: string; lignes: { libelle: string; detail: string }[] }) {
  if (lignes.length === 0) return null;
  return (
    <div>
      <span className={smallCaps} style={{ color: colors.muted }}>
        {titre}
      </span>
      {lignes.map((l, i) => (
        <p key={i} className="text-[13px]" style={{ color: colors.ink }}>
          <span style={{ color: colors.muted }}>{l.libelle} — </span>
          {l.detail}
        </p>
      ))}
    </div>
  );
}
