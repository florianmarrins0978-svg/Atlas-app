"use client";

import { useState } from "react";
import { colors, smallCaps, font } from "@/lib/design-tokens";
import type { PropositionExtraction, LigneExtraite } from "@/server/ai/schemas/extraction";
import {
  genererBrouillonAction,
  enregistrerBrouillonAction,
  confirmerBrouillonAction,
} from "./actions";

export type BrouillonInitial = {
  contenu: PropositionExtraction;
  statut: "brouillon" | "confirme";
  modifieParHumain: boolean;
} | null;

type Props = {
  chantierId: string;
  brouillonInitial: BrouillonInitial;
  transcriptionDisponible: boolean;
  onApplique: (prestations: { id: string; libelle: string }[], materiel: { id: string; libelle: string }[]) => void;
};

// Brouillon structuré issu de la dictée. Tout ce qui s'affiche ici est une
// proposition : rien n'entre dans les données du chantier avant la
// confirmation explicite du patron.
export default function BrouillonSection({
  chantierId,
  brouillonInitial,
  transcriptionDisponible,
  onApplique,
}: Props) {
  const [contenu, setContenu] = useState<PropositionExtraction | null>(brouillonInitial?.contenu ?? null);
  const [statut, setStatut] = useState<"brouillon" | "confirme" | null>(brouillonInitial?.statut ?? null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Proposition concurrente : le brouillon a été corrigé à la main, une
  // nouvelle analyse existe, et le patron doit trancher lui-même.
  const [conflit, setConflit] = useState<PropositionExtraction | null>(null);

  async function generer(remplacer = false) {
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await genererBrouillonAction(chantierId, remplacer);
      if (resultat.statut === "conflit") {
        setConflit(resultat.propositionNouvelle);
        return;
      }
      if (resultat.statut === "transcription_absente") {
        setErreur("Aucune transcription disponible pour ce chantier.");
        return;
      }
      if (resultat.statut === "echec") {
        setErreur(resultat.erreur);
        return;
      }
      setContenu(resultat.brouillon.contenu);
      setStatut(resultat.brouillon.statut);
      setConflit(null);
    } catch {
      setErreur("Impossible de générer le brouillon pour l'instant. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  // Chaque correction est persistée : le brouillon doit survivre au
  // rechargement de la page.
  async function persister(nouveau: PropositionExtraction) {
    setContenu(nouveau);
    try {
      const r = await enregistrerBrouillonAction(chantierId, nouveau);
      if (!r.succes) setErreur(r.erreur);
    } catch {
      setErreur("Vos corrections n'ont pas pu être enregistrées. Vérifiez votre connexion.");
    }
  }

  async function confirmer() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await confirmerBrouillonAction(chantierId);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      setStatut("confirme");
      onApplique(
        r.prestationsCreees.map((p) => ({ id: p.id, libelle: p.libelle })),
        r.materielCree.map((m) => ({ id: m.id, libelle: m.libelle }))
      );
    } catch {
      setErreur("La confirmation n'a pas pu aboutir. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  function majLigne(liste: "prestations" | "materiel", index: number, champ: keyof LigneExtraite, valeur: string) {
    if (!contenu) return;
    const lignes = contenu[liste].map((l, i) => (i === index ? { ...l, [champ]: valeur || null } : l));
    setContenu({ ...contenu, [liste]: lignes });
  }

  function retirerLigne(liste: "prestations" | "materiel", index: number) {
    if (!contenu) return;
    persister({ ...contenu, [liste]: contenu[liste].filter((_, i) => i !== index) });
  }

  function majChamp(champ: "dureePrevue" | "tailleEquipe" | "gestionDechets" | "contraintesAcces" | "remarques", valeur: string) {
    if (!contenu) return;
    setContenu({ ...contenu, [champ]: valeur || null });
  }

  if (!transcriptionDisponible && !contenu) {
    return (
      <Carte>
        <span className={smallCaps} style={{ color: colors.muted }}>
          Brouillon
        </span>
        <p className="text-[13px]" style={{ color: colors.muted }}>
          Enregistrez une note vocale et lancez sa transcription pour obtenir un brouillon d&apos;informations.
        </p>
        <a href={`/chantiers/${chantierId}/note-vocale`} className="self-start text-[14px] font-medium" style={{ color: colors.rust }}>
          Aller à la note vocale
        </a>
      </Carte>
    );
  }

  return (
    <Carte>
      <div className="flex items-baseline justify-between">
        <span className={smallCaps} style={{ color: colors.muted }}>
          Brouillon issu de la dictée
        </span>
        {statut === "confirme" && (
          <span className="text-[12px]" style={{ color: colors.rust }}>
            Confirmé
          </span>
        )}
      </div>

      {!contenu && (
        <>
          <p className="text-[13px]" style={{ color: colors.muted }}>
            La transcription est disponible. Générez un brouillon structuré, puis corrigez-le avant de le confirmer.
          </p>
          <button
            type="button"
            onClick={() => generer()}
            disabled={enCours}
            className="self-start text-[14px] font-medium disabled:opacity-40"
            style={{ color: colors.rust }}
          >
            {enCours ? "Analyse en cours…" : "Générer le brouillon"}
          </button>
        </>
      )}

      {contenu && (
        <div className="flex flex-col gap-4">
          <ListeLignes
            titre="Prestations"
            lignes={contenu.prestations}
            lectureSeule={statut === "confirme"}
            onChange={(i, champ, v) => majLigne("prestations", i, champ, v)}
            onCommit={() => persister(contenu)}
            onRetirer={(i) => retirerLigne("prestations", i)}
          />

          <div className="grid grid-cols-2 gap-3">
            <ChampBrouillon
              label="Durée"
              value={contenu.dureePrevue ?? ""}
              lectureSeule={statut === "confirme"}
              onChange={(v) => majChamp("dureePrevue", v)}
              onCommit={() => persister(contenu)}
            />
            <ChampBrouillon
              label="Équipe"
              value={contenu.tailleEquipe ?? ""}
              lectureSeule={statut === "confirme"}
              onChange={(v) => majChamp("tailleEquipe", v)}
              onCommit={() => persister(contenu)}
            />
          </div>

          <ListeLignes
            titre="Matériel"
            lignes={contenu.materiel}
            lectureSeule={statut === "confirme"}
            onChange={(i, champ, v) => majLigne("materiel", i, champ, v)}
            onCommit={() => persister(contenu)}
            onRetirer={(i) => retirerLigne("materiel", i)}
          />

          <ChampBrouillon
            label="Déchets / branchages"
            value={contenu.gestionDechets ?? ""}
            lectureSeule={statut === "confirme"}
            onChange={(v) => majChamp("gestionDechets", v)}
            onCommit={() => persister(contenu)}
          />
          <ChampBrouillon
            label="Contraintes d'accès"
            value={contenu.contraintesAcces ?? ""}
            lectureSeule={statut === "confirme"}
            onChange={(v) => majChamp("contraintesAcces", v)}
            onCommit={() => persister(contenu)}
          />
          <ChampBrouillon
            label="Remarques"
            value={contenu.remarques ?? ""}
            lectureSeule={statut === "confirme"}
            onChange={(v) => majChamp("remarques", v)}
            onCommit={() => persister(contenu)}
          />

          {contenu.ambiguites.length > 0 && (
            <div>
              <span className={smallCaps} style={{ color: colors.rust }}>
                À confirmer
              </span>
              {contenu.ambiguites.map((a, i) => (
                <p key={i} className="text-[13px]" style={{ color: colors.muted }}>
                  {a}
                </p>
              ))}
            </div>
          )}

          {contenu.informationsManquantes.length > 0 && (
            <div>
              <span className={smallCaps} style={{ color: colors.muted }}>
                Non mentionné dans la dictée
              </span>
              {contenu.informationsManquantes.map((m, i) => (
                <p key={i} className="text-[13px]" style={{ color: colors.muted }}>
                  {m}
                </p>
              ))}
            </div>
          )}

          {statut !== "confirme" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={confirmer}
                disabled={enCours}
                className="rounded-2xl py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: colors.rust }}
              >
                {enCours ? "Application…" : "Confirmer et ajouter au chantier"}
              </button>
              <button
                type="button"
                onClick={() => generer()}
                disabled={enCours}
                className="text-[14px] font-medium disabled:opacity-40"
                style={{ color: colors.muted }}
              >
                Régénérer depuis la dictée
              </button>
            </div>
          )}
        </div>
      )}

      {erreur && (
        <p className="text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {conflit && (
        <div className="fixed inset-0 z-40 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <div className="w-full rounded-t-[26px] px-6 pb-9 pt-3" style={{ backgroundColor: colors.cream }}>
            <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
            <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
              Remplacer vos corrections ?
            </p>
            <p className="mb-5 text-center text-[13px]" style={{ color: colors.muted }}>
              Vous avez modifié ce brouillon à la main. Une nouvelle analyse de la dictée est prête : l&apos;appliquer
              effacera vos corrections.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setConflit(null)}
                className="rounded-2xl py-3.5 text-[16px] font-medium"
                style={{ backgroundColor: colors.card, color: colors.ink }}
              >
                Conserver mes corrections
              </button>
              <button
                onClick={() => {
                  setConflit(null);
                  generer(true);
                }}
                className="rounded-2xl py-3.5 text-[15px] font-medium"
                style={{ color: colors.alert }}
              >
                Remplacer par la nouvelle analyse
              </button>
            </div>
          </div>
        </div>
      )}
    </Carte>
  );
}

// `gap-3` et non `gap-2` : les listes de l'écran principal sont repérées par
// `div.flex.flex-col.gap-2`, y compris par les tests de bout en bout. Un
// conteneur du brouillon portant la même signature rendrait ce repère ambigu —
// et ferait passer une proposition pour une donnée validée.
function Carte({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
      {children}
    </div>
  );
}

function ChampBrouillon({
  label,
  value,
  lectureSeule,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  lectureSeule: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        value={value}
        readOnly={lectureSeule}
        placeholder="Non mentionné"
        // Étiquette explicite : l'écran porte aussi des champs « Durée » et
        // « Équipe » pour les données déjà validées — les deux ne doivent jamais
        // être confondus, ni par un lecteur d'écran, ni par un test.
        aria-label={`${label} (brouillon)`}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="rounded-2xl border-0 px-4 py-3 outline-none"
        style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
      />
    </label>
  );
}

function ListeLignes({
  titre,
  lignes,
  lectureSeule,
  onChange,
  onCommit,
  onRetirer,
}: {
  titre: string;
  lignes: LigneExtraite[];
  lectureSeule: boolean;
  onChange: (index: number, champ: keyof LigneExtraite, valeur: string) => void;
  onCommit: () => void;
  onRetirer: (index: number) => void;
}) {
  return (
    // gap-3 : même raison que dans Carte — ne jamais imiter la signature des
    // listes de données validées.
    <div className="flex flex-col gap-3">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {titre}
      </span>
      {lignes.length === 0 && (
        <p className="text-[13px]" style={{ color: colors.muted }}>
          Rien de détecté dans la dictée.
        </p>
      )}
      {lignes.map((ligne, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-2xl p-3" style={{ backgroundColor: colors.cream }}>
          <div className="flex items-center gap-2">
            <input
              value={ligne.libelle}
              readOnly={lectureSeule}
              aria-label={`${titre} ${i + 1}`}
              onChange={(e) => onChange(i, "libelle", e.target.value)}
              onBlur={onCommit}
              className="min-w-0 flex-1 rounded-xl border-0 px-3 py-2 outline-none"
              style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
            />
            {!lectureSeule && (
              <button
                type="button"
                onClick={() => onRetirer(i)}
                aria-label={`Retirer ${ligne.libelle}`}
                className="text-[13px]"
                style={{ color: colors.muted }}
              >
                Retirer
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={ligne.quantite ?? ""}
              readOnly={lectureSeule}
              placeholder="Quantité"
              aria-label={`Quantité ${titre} ${i + 1}`}
              onChange={(e) => onChange(i, "quantite", e.target.value)}
              onBlur={onCommit}
              className="rounded-xl border-0 px-3 py-2 outline-none"
              style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "15px" }}
            />
            <input
              value={ligne.unite ?? ""}
              readOnly={lectureSeule}
              placeholder="Unité"
              aria-label={`Unité ${titre} ${i + 1}`}
              onChange={(e) => onChange(i, "unite", e.target.value)}
              onBlur={onCommit}
              className="rounded-xl border-0 px-3 py-2 outline-none"
              style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "15px" }}
            />
          </div>
          <input
            value={ligne.description ?? ""}
            readOnly={lectureSeule}
            placeholder="Description (facultative)"
            aria-label={`Description ${titre} ${i + 1}`}
            onChange={(e) => onChange(i, "description", e.target.value)}
            onBlur={onCommit}
            className="rounded-xl border-0 px-3 py-2 outline-none"
            style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "15px" }}
          />
          {ligne.aConfirmer && (
            <span className="text-[12px]" style={{ color: colors.rust }}>
              À confirmer
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
