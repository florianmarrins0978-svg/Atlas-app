"use client";

import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { parFamilles, type PrestationModele } from "@/lib/prestations-entretien";
import {
  ajouterPrestationAction,
  poserModeleFourniAction,
  renommerFamilleAction,
  renommerPrestationAction,
  retirerPrestationAction,
} from "./actions";

// L'écran où la fiche d'entretien se compose — planche
// `docs/maquettes/64-composer-sa-fiche.html`, retenue le 16 août 2026.
//
// **Un seul modèle**, dans ses mots : « il n'y aura qu'une seule fiche ». Rien
// n'est rangé par client ; à chaque passage, la fiche partira de là.
//
// **Le retrait est réversible** (`useRetraits`, sa règle du 10 août) : la ligne
// se barre, le tiroir propose « Annuler », et rien n'est écrit tant qu'il est
// ouvert. Une croix nue sur une liste qu'il a mis vingt minutes à composer
// serait le geste le plus coûteux de cet écran.

export type PrestationAffichee = { id: string; famille: string; libelle: string };

export default function FicheEntretienClient({
  prestationsInitiales,
  modeleFourni,
}: {
  prestationsInitiales: PrestationAffichee[];
  /** Ce que « Partir du modèle Atlas » poserait — montré avant d'appuyer. */
  modeleFourni: readonly PrestationModele[];
}) {
  const [prestations, setPrestations] = useState(prestationsInitiales);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");

  const retraits = useRetraits({
    valider: async (id) => {
      const r = await retirerPrestationAction(id);
      if (!r.ok) return { succes: false, erreur: r.phrase };
      setPrestations((cur) => cur.filter((p) => p.id !== id));
      return { succes: true };
    },
  });

  const visibles = prestations.filter((p) => !retraits.estRetire(p.id));
  const familles = parFamilles(visibles);

  async function ajouter(famille: string) {
    const libelle = saisie;
    if (!libelle.trim()) {
      setAjoutOuvert(null);
      setSaisie("");
      return;
    }
    const r = await ajouterPrestationAction(famille, libelle);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    setSaisie("");
    setAjoutOuvert(null);
    // **Rechargé depuis le serveur plutôt que deviné ici.** L'ordre d'insertion
    // — à la fin de SA famille — est une règle du dépôt, et la recopier dans
    // l'écran donnerait deux vérités sur la place de la ligne (`CLAUDE.md` §3).
    location.reload();
  }

  async function renommer(id: string, avant: string, apres: string) {
    if (apres.trim() === "" || apres === avant) return;
    const r = await renommerPrestationAction(id, apres);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    setPrestations((cur) => cur.map((p) => (p.id === id ? { ...p, libelle: apres } : p)));
  }

  async function renommerLaFamille(ancienne: string, nouvelle: string) {
    if (nouvelle.trim() === "" || nouvelle === ancienne) return;
    const r = await renommerFamilleAction(ancienne, nouvelle);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setPhrase(null);
    setPrestations((cur) =>
      cur.map((p) => (p.famille === ancienne ? { ...p, famille: nouvelle } : p))
    );
  }

  // ─── La fiche vide : on propose, on ne pose pas ────────────────────────────
  //
  // Semer vingt lignes parce qu'il a ouvert un écran serait écrire en base pour
  // un regard. Il voit donc ce que le modèle contient, et il appuie — ou non.
  if (prestations.length === 0) {
    return (
      <div className="px-6 pb-10">
        <p className="text-[15px] leading-relaxed" style={{ color: colors.muted }}>
          Votre fiche d&apos;entretien est vide. C&apos;est la liste que vous cocherez sur un
          chantier, et dont votre client recevra le rapport.
        </p>

        <div className="mt-5 rounded-[14px] p-5" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            Le modèle Atlas — {modeleFourni.length} prestations
          </p>
          <p className="text-[14px] leading-relaxed" style={{ color: colors.ink }}>
            {modeleFourni.map((p) => p.libelle).join(" · ")}
          </p>
          <p className="mt-3 text-[13px]" style={{ color: colors.muted }}>
            Rien n&apos;est figé : vous retirez, ajoutez et renommez ce que vous voulez ensuite.
          </p>
        </div>

        {phrase && (
          <p
            className="mt-4 text-[14px]"
            style={{ color: colors.rust }}
            role="alert"
            data-refus
          >
            {phrase}
          </p>
        )}

        <div className="mt-5">
          <PrimaryButton
            onClick={async () => {
              const r = await poserModeleFourniAction();
              if (!r.ok) setPhrase(r.phrase);
              else location.reload();
            }}
          >
            Partir du modèle Atlas
          </PrimaryButton>
        </div>

        <button
          type="button"
          className="mt-3 block w-full text-center text-[14px]"
          style={{ color: colors.or }}
          onClick={() => setAjoutOuvert("Divers")}
        >
          Je préfère composer la mienne
        </button>

        {ajoutOuvert && (
          <div className="mt-4">
            <input
              autoFocus
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Tonte et ébarbage"
              aria-label="Nom de la première prestation"
              className="w-full rounded-[10px] px-3 py-3 text-[16px]"
              style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
            />
            <div className="mt-3">
              <PrimaryButton onClick={() => ajouter("Divers")}>Ajouter</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── La fiche composée ─────────────────────────────────────────────────────
  return (
    <div className="px-6 pb-10">
      <p className="text-[14px] leading-relaxed" style={{ color: colors.muted }}>
        {visibles.length} prestation{visibles.length > 1 ? "s" : ""}, rangées par famille. C&apos;est
        cette liste que vous cocherez sur un chantier.
      </p>

      {phrase && (
        <p
            className="mt-4 text-[14px]"
            style={{ color: colors.rust }}
            role="alert"
            data-refus
          >
          {phrase}
        </p>
      )}

      {familles.map((f) => (
        <section key={f.famille} className="mt-6">
          {/* La famille se renomme sur place : c'est son mot, pas une
              nomenclature imposée. */}
          <input
            defaultValue={f.famille}
            aria-label={`Nom de la famille ${f.famille}`}
            data-famille={f.famille}
            onBlur={(e) => renommerLaFamille(f.famille, e.target.value)}
            className={`w-full bg-transparent ${smallCaps}`}
            style={{ color: colors.or, border: "none", padding: 0 }}
          />

          {f.lignes.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 py-1"
              style={{ borderBottom: `1px solid ${colors.line}` }}
            >
              <input
                defaultValue={p.libelle}
                aria-label={`Prestation ${p.libelle}`}
                data-prestation={p.id}
                onBlur={(e) => renommer(p.id, p.libelle, e.target.value)}
                className="min-h-[48px] flex-1 bg-transparent text-[15px]"
                style={{ color: colors.ink, border: "none", padding: 0 }}
              />
              {/* 44 px de côté : la mesure d'un doigt, pas d'un curseur. */}
              <button
                type="button"
                aria-label={`Retirer ${p.libelle}`}
                onClick={() => retraits.retirer(p.id, `« ${p.libelle} »`)}
                className="flex h-11 w-11 flex-none items-center justify-center text-[18px]"
                style={{ color: colors.muted }}
              >
                ×
              </button>
            </div>
          ))}

          {ajoutOuvert === f.famille ? (
            <div className="mt-3">
              <input
                autoFocus
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                placeholder="Nom de la prestation"
                aria-label={`Nouvelle prestation dans ${f.famille}`}
                className="w-full rounded-[10px] px-3 py-3 text-[16px]"
                style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
              />
              <div className="mt-3">
                <PrimaryButton onClick={() => ajouter(f.famille)}>Ajouter à {f.famille}</PrimaryButton>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 min-h-[44px] text-[14px]"
              style={{ color: colors.or }}
              onClick={() => {
                setSaisie("");
                setAjoutOuvert(f.famille);
              }}
            >
              + Ajouter une prestation
            </button>
          )}
        </section>
      ))}

      {/* Une famille neuve naît d'une prestation : une famille vide n'aurait
          rien à cocher, et il faudrait la ramasser plus tard. */}
      {ajoutOuvert === "__neuve__" ? (
        <div className="mt-8">
          <input
            autoFocus
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom de la prestation"
            aria-label="Première prestation de la nouvelle famille"
            className="w-full rounded-[10px] px-3 py-3 text-[16px]"
            style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
          />
          <div className="mt-3">
            <PrimaryButton onClick={() => ajouter("Divers")}>Ajouter dans « Divers »</PrimaryButton>
          </div>
          <p className="mt-2 text-[13px]" style={{ color: colors.muted }}>
            Elle arrivera dans « Divers » — renommez la famille juste au-dessus d&apos;elle.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="mt-8 min-h-[44px] text-[14px]"
          style={{ color: colors.or }}
          onClick={() => {
            setSaisie("");
            setAjoutOuvert("__neuve__");
          }}
        >
          + Ajouter une famille
        </button>
      )}

      <p className="mt-8 text-[13px] leading-relaxed" style={{ color: colors.muted }}>
        Modifier cette fiche ne change <b style={{ color: colors.ink }}>aucun rapport déjà envoyé</b>
        . Ceux-ci sont partis chez vos clients, et ils restent tels quels.
      </p>

      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
      />
    </div>
  );
}
