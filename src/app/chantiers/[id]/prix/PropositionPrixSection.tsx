"use client";

import { useState } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import type { PropositionPrix, OriginePrix } from "@/server/chiffrage/proposition-prix";
import { ligneDejaAuDetail, type LigneDetail } from "@/lib/proposition-au-detail";
import { calculerPropositionPrixAction, appliquerPropositionPrixAction } from "./actions";
import { enEuros } from "@/lib/euros";


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
      // Toutes les lignes, pas seulement la première : un chantier avec fente
      // en produit deux, et n'en afficher qu'une ferait croire que l'autre
      // s'est perdue.
      for (const ligne of r.lignes) onLigneAjoutee(ligne);
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
  //
  // **Une proposition peut valoir plusieurs lignes** (le travail principal, la
  // fente). Elle n'est « déjà au détail » que si TOUTES y sont : sinon le
  // patron se retrouverait avec la principale écrite, la fente absente, et un
  // bouton grisé qui l'empêcherait de la rattraper.
  const libelleVise =
    origine === "tarifs_ambigus"
      ? (proposition.tarifsCandidats.find((c) => c.tarifId === tarifChoisi)?.intitule ?? null)
      : null;
  const dejaAuDetail =
    origine === "tarifs_ambigus"
      ? ligneDejaAuDetail(libelleVise, lignesDetail)
      : proposition.lignes.length > 0 &&
          proposition.lignes.every((l) => ligneDejaAuDetail(l.libelle, lignesDetail))
        ? ligneDejaAuDetail(proposition.lignes[0].libelle, lignesDetail)
        : null;

  const peutAppliquer =
    origine === "tarif" || origine === "chiffrage" || (origine === "tarifs_ambigus" && tarifChoisi !== null);

  return (
    <div
      className="mx-[26px] mt-7 flex flex-col gap-3 px-[15px] py-4"
      style={{ backgroundColor: colors.card, borderRadius: 4 }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={libelleCaps} style={{ color: colors.muted }}>
          Proposition
        </span>
        {/* D'où vient ce prix : une provenance se lit, elle ne se touche pas.
            En gris, donc — la couleur d'attente ne se pose que sur ce qui
            réclame un geste du patron, et lire ne l'est pas. */}
        <span className={`text-right ${libelleCaps}`} style={{ color: colors.muted }}>
          {LIBELLE_ORIGINE[origine]}
        </span>
      </div>

      {proposition.prixPropose !== null && (
        <p
          className="text-[28px] leading-none"
          style={{
            color: colors.ink,
            fontFamily: font.display,
            letterSpacing: "-0.018em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {enEuros(proposition.prixPropose)}
          <span className={`ml-2 ${libelleCaps}`} style={{ color: colors.muted }}>
            HT
          </span>
        </p>
      )}

      {/* **La ventilation, visible avant d'appuyer.** Le patron doit voir que
          la fente fait sa propre ligne, et à combien, AVANT de l'ajouter au
          détail : c'est le défaut qu'il a signalé trois fois, et il ne se
          constate pas sur un total. */}
      {proposition.lignes.length > 1 && (
        <ul className="flex flex-col gap-1.5 px-3 py-2.5" style={{ backgroundColor: colors.cream, borderRadius: 4 }}>
          {proposition.lignes.map((l, i) => (
            <li key={i} className={`flex items-baseline justify-between gap-3 ${texteSituation}`}>
              <span className="whitespace-pre-line" style={{ color: colors.ink }}>
                {l.libelle}
              </span>
              {/* « prix à poser » attend un geste du patron : c'est l'un des
                  rares endroits où l'or dit quelque chose. */}
              <span
                className="shrink-0"
                style={{
                  color: Number(l.montant) > 0 ? colors.ink : colors.or,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {Number(l.montant) > 0 ? enEuros(l.montant) : "prix à poser"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className={texteSituation} style={{ color: colors.ink }}>
        {explication.origine}
      </p>

      {/* Choix entre plusieurs tarifs — jamais présélectionné. */}
      {origine === "tarifs_ambigus" && (
        <div className="flex flex-col gap-2">
          {proposition.tarifsCandidats.map((c) => (
            <label
              key={c.tarifId}
              className="flex items-center gap-2.5 px-3 py-2.5 text-[14px]"
              style={{ backgroundColor: colors.cream, color: colors.ink, borderRadius: 4 }}
            >
              <input
                type="radio"
                name="tarif-candidat"
                value={c.tarifId}
                checked={tarifChoisi === c.tarifId}
                onChange={() => setTarifChoisi(c.tarifId)}
              />
              <span className="flex-1">{c.intitule}</span>
              <span style={{ color: colors.muted, fontVariantNumeric: "tabular-nums" }}>
                {c.prix} €{c.unite ? ` / ${c.unite}` : ""}
              </span>
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setDetailOuvert((v) => !v)}
        className={`self-start ${libelleCaps}`}
        style={{ color: colors.rust }}
      >
        {detailOuvert ? "Masquer le détail" : "Voir le détail"}
      </button>

      {detailOuvert && (
        <div className="flex flex-col gap-3.5 p-3" style={{ backgroundColor: colors.cream, borderRadius: 4 }}>
          <BlocExplication titre="Éléments pris en compte" lignes={explication.elementsPrisEnCompte} />
          <BlocExplication titre="Calcul" lignes={explication.calcul} />
          {/* Ces deux-là, et elles seules, réclament un geste du patron : elles
              portent donc l'or. Les intertitres voisins restent gris. */}
          {explication.donneesManquantes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={libelleCaps} style={{ color: colors.or }}>
                À compléter
              </span>
              {explication.donneesManquantes.map((d, i) => (
                <p key={i} className={texteSituation} style={{ color: colors.muted }}>
                  {d}
                </p>
              ))}
            </div>
          )}
          {explication.ambiguites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={libelleCaps} style={{ color: colors.or }}>
                À confirmer
              </span>
              {explication.ambiguites.map((a, i) => (
                <p key={i} className={texteSituation} style={{ color: colors.muted }}>
                  {a}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {erreur && (
        <p className={texteSituation} style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {/* Dire pourquoi le bouton ne répond plus. Un bouton grisé sans phrase se
          lit comme une panne — et ici, c'est au contraire la seule chose qui
          empêche le devis de doubler. */}
      {dejaAuDetail && (
        <p className={texteSituation} style={{ color: colors.muted }}>
          Déjà au détail : « {dejaAuDetail.libelle} » à {enEuros(dejaAuDetail.montant)}.
          Pour la changer, modifiez la ligne ci-dessous plutôt que d&apos;en ajouter une seconde.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {origine !== "aucun" && (
          <button
            type="button"
            onClick={appliquer}
            disabled={enCours || dejaAuDetail !== null || !peutAppliquer}
            className={`rounded-full py-3.5 disabled:opacity-40 ${libelleCaps}`}
            style={{ backgroundColor: colors.rustTint, color: colors.rust, minHeight: 48 }}
          >
            {dejaAuDetail ? "Déjà au détail" : enCours ? "Ajout…" : "Ajouter au détail"}
          </button>
        )}
        <button
          type="button"
          onClick={recalculer}
          disabled={enCours}
          // `self-start` : sans lui, ce bouton s'étire sur toute la largeur de
          // la colonne et son libellé se retrouve centré — seul de l'écran,
          // alors que « Voir le détail » juste au-dessus est aligné à gauche.
          className={`self-start disabled:opacity-40 ${libelleCaps}`}
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
    <div className="flex flex-col gap-1.5">
      <span className={libelleCaps} style={{ color: colors.muted }}>
        {titre}
      </span>
      {lignes.map((l, i) => (
        <p key={i} className={texteSituation} style={{ color: colors.ink }}>
          <span style={{ color: colors.muted }}>{l.libelle} — </span>
          {l.detail}
        </p>
      ))}
    </div>
  );
}
