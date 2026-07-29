"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import UndoToast from "@/components/atlas/UndoToast";
import { AnimatedRow } from "@/components/atlas/AnimatedRow";
import {
  ajouterPrestationAction,
  modifierPrestationAction,
  supprimerPrestationAction,
  ajouterMaterielAction,
  modifierMaterielAction,
  supprimerMaterielAction,
  mettreAJourDureeEquipeAction,
  validerInformationsAction,
  extraireInformationsAction,
  appliquerExtractionAction,
} from "./actions";
import type { PropositionExtraction } from "@/server/ai/schemas/extraction";

type Ligne = { id: string; libelle: string };
type NomListe = "prestations" | "materiel";

export default function InformationsClient({
  chantierId,
  initialPrestations,
  initialMateriel,
  initialDuree,
  initialEquipe,
}: {
  chantierId: string;
  initialPrestations: Ligne[];
  initialMateriel: Ligne[];
  initialDuree: string;
  initialEquipe: string;
}) {
  const router = useRouter();
  const [prestations, setPrestations] = useState<Ligne[]>(initialPrestations);
  const [materiel, setMateriel] = useState<Ligne[]>(initialMateriel);
  const [duree, setDuree] = useState(initialDuree);
  const [equipe, setEquipe] = useState(initialEquipe);
  const [texteLibre, setTexteLibre] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreurAnalyse, setErreurAnalyse] = useState<string | null>(null);
  const [proposition, setProposition] = useState<PropositionExtraction | null>(null);
  const [prestationsCochees, setPrestationsCochees] = useState<boolean[]>([]);
  const [materielCoche, setMaterielCoche] = useState<boolean[]>([]);
  const [applicationEnCours, setApplicationEnCours] = useState(false);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ liste: NomListe; item: Ligne; index: number } | null>(null);
  const [validationEnCours, setValidationEnCours] = useState(false);

  function listeEtSetter(nom: NomListe) {
    return nom === "prestations" ? ([prestations, setPrestations] as const) : ([materiel, setMateriel] as const);
  }

  async function ajouter(nom: NomListe) {
    const action = nom === "prestations" ? ajouterPrestationAction : ajouterMaterielAction;
    const nouvelle = await action(chantierId, "");
    const [, setItems] = listeEtSetter(nom);
    setItems((cur) => [...cur, { id: nouvelle.id, libelle: nouvelle.libelle }]);
  }

  function modifier(nom: NomListe, id: string, libelle: string) {
    const [, setItems] = listeEtSetter(nom);
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, libelle } : i)));
  }

  async function persisterModification(nom: NomListe, id: string, libelle: string) {
    const action = nom === "prestations" ? modifierPrestationAction : modifierMaterielAction;
    await action(id, libelle);
  }

  function retirer(nom: NomListe, id: string) {
    setLeavingIds((s) => new Set(s).add(id));
    setTimeout(async () => {
      const [items, setItems] = listeEtSetter(nom);
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) return;
      const item = items[index];
      setItems(items.filter((i) => i.id !== id));
      setLeavingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setToast({ liste: nom, item, index });
      const action = nom === "prestations" ? supprimerPrestationAction : supprimerMaterielAction;
      await action(id);
    }, 180);
  }

  async function annulerSuppression() {
    if (!toast) return;
    const { liste, item } = toast;
    setToast(null);
    // Une prestation/un matériel supprimé se recrée facilement (donnée métier
    // recréable, cf. règle validée) : l'annulation réinsère une nouvelle ligne
    // avec le même libellé plutôt que de restaurer l'ancien id supprimé côté base.
    const action = liste === "prestations" ? ajouterPrestationAction : ajouterMaterielAction;
    const recreee = await action(chantierId, item.libelle);
    const [, setItems] = listeEtSetter(liste);
    setItems((cur) => [...cur, { id: recreee.id, libelle: recreee.libelle }]);
  }

  async function analyser() {
    if (!texteLibre.trim()) return;
    setAnalyseEnCours(true);
    setErreurAnalyse(null);
    setProposition(null);
    try {
      const resultat = await extraireInformationsAction(texteLibre.trim());
      if (!resultat.succes) {
        setErreurAnalyse(resultat.erreur);
        return;
      }
      setProposition(resultat.proposition);
      setPrestationsCochees(resultat.proposition.prestations.map(() => true));
      setMaterielCoche(resultat.proposition.materiel.map(() => true));
    } catch {
      setErreurAnalyse("Impossible d'analyser ce texte pour l'instant.");
    } finally {
      setAnalyseEnCours(false);
    }
  }

  function annulerProposition() {
    setProposition(null);
    setErreurAnalyse(null);
  }

  async function confirmerProposition() {
    if (!proposition) return;
    setApplicationEnCours(true);
    try {
      const prestationsRetenues = proposition.prestations.filter((_, i) => prestationsCochees[i]);
      const materielRetenu = proposition.materiel.filter((_, i) => materielCoche[i]);
      const { prestationsCreees, materielCree } = await appliquerExtractionAction(chantierId, {
        prestations: prestationsRetenues,
        materiel: materielRetenu,
        dureePrevue: proposition.dureePrevue ?? undefined,
        tailleEquipe: proposition.tailleEquipe ?? undefined,
      });
      setPrestations((cur) => [...cur, ...prestationsCreees.map((p) => ({ id: p.id, libelle: p.libelle }))]);
      setMateriel((cur) => [...cur, ...materielCree.map((m) => ({ id: m.id, libelle: m.libelle }))]);
      if (proposition.dureePrevue) setDuree(proposition.dureePrevue);
      if (proposition.tailleEquipe) setEquipe(proposition.tailleEquipe);
      setProposition(null);
      setTexteLibre("");
    } finally {
      setApplicationEnCours(false);
    }
  }

  async function valider() {
    setValidationEnCours(true);
    try {
      await validerInformationsAction(chantierId);
      router.push(`/chantiers/${chantierId}/prix`);
    } catch {
      setValidationEnCours(false);
    }
  }

  const toastVisible = toast !== null;
  const toastMessage = toast?.liste === "prestations" ? "Prestation supprimée" : "Matériel supprimé";

  return (
    <>
      <form
        className="mt-7 flex flex-col gap-7 px-6"
        onSubmit={(e) => {
          e.preventDefault();
          valider();
        }}
      >
        {/* Analyse IA (lot IA-01) — proposition uniquement, jamais appliquée sans confirmation */}
        <div className="flex flex-col gap-2 rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
          <span className={smallCaps} style={{ color: colors.muted }}>
            Analyser un texte
          </span>
          <textarea
            value={texteLibre}
            onChange={(e) => setTexteLibre(e.target.value)}
            placeholder="Collez ou saisissez un texte décrivant le chantier…"
            rows={3}
            className="rounded-2xl border-0 px-4 py-3 outline-none"
            style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "15px" }}
          />
          <button
            type="button"
            onClick={analyser}
            disabled={analyseEnCours || !texteLibre.trim()}
            className="self-start text-[14px] font-medium disabled:opacity-40"
            style={{ color: colors.rust }}
          >
            {analyseEnCours ? "Analyse en cours…" : "Analyser"}
          </button>
          {erreurAnalyse && (
            <p className="text-[13px]" style={{ color: colors.alert }}>
              {erreurAnalyse}
            </p>
          )}

          {proposition && (
            <div className="mt-2 flex flex-col gap-3 rounded-2xl p-3" style={{ backgroundColor: colors.cream }}>
              <p className="text-[13px] font-medium" style={{ color: colors.ink }}>
                Informations détectées — vérifiez avant d&apos;appliquer :
              </p>

              {proposition.prestations.length > 0 && (
                <div>
                  <span className={smallCaps} style={{ color: colors.muted }}>
                    Prestations
                  </span>
                  {proposition.prestations.map((p, i) => (
                    <label key={i} className="mt-1 flex items-center gap-2 text-[14px]" style={{ color: colors.ink }}>
                      <input
                        type="checkbox"
                        checked={prestationsCochees[i] ?? true}
                        onChange={(e) =>
                          setPrestationsCochees((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              )}

              {proposition.materiel.length > 0 && (
                <div>
                  <span className={smallCaps} style={{ color: colors.muted }}>
                    Matériel
                  </span>
                  {proposition.materiel.map((m, i) => (
                    <label key={i} className="mt-1 flex items-center gap-2 text-[14px]" style={{ color: colors.ink }}>
                      <input
                        type="checkbox"
                        checked={materielCoche[i] ?? true}
                        onChange={(e) => setMaterielCoche((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              )}

              {(proposition.dureePrevue || proposition.tailleEquipe) && (
                <p className="text-[14px]" style={{ color: colors.ink }}>
                  {proposition.dureePrevue && <>Durée : {proposition.dureePrevue}. </>}
                  {proposition.tailleEquipe && <>Équipe : {proposition.tailleEquipe}.</>}
                </p>
              )}

              {proposition.ambiguites.length > 0 && (
                <div>
                  <span className={smallCaps} style={{ color: colors.rust }}>
                    Ambiguïtés à vérifier
                  </span>
                  {proposition.ambiguites.map((a, i) => (
                    <p key={i} className="text-[13px]" style={{ color: colors.muted }}>
                      {a}
                    </p>
                  ))}
                </div>
              )}

              {proposition.informationsManquantes.length > 0 && (
                <div>
                  <span className={smallCaps} style={{ color: colors.muted }}>
                    Non détecté
                  </span>
                  {proposition.informationsManquantes.map((m, i) => (
                    <p key={i} className="text-[13px]" style={{ color: colors.muted }}>
                      {m}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmerProposition}
                  disabled={applicationEnCours}
                  className="flex-1 rounded-2xl py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: colors.rust }}
                >
                  {applicationEnCours ? "Application…" : "Confirmer et appliquer"}
                </button>
                <button
                  type="button"
                  onClick={annulerProposition}
                  className="flex-1 rounded-2xl py-2.5 text-[14px] font-medium"
                  style={{ color: colors.muted }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        <ListeTextes
          label="Prestations"
          emptyMessage="Aucune prestation pour l'instant."
          addLabel="+ Ajouter une prestation"
          items={prestations}
          leavingIds={leavingIds}
          onAdd={() => ajouter("prestations")}
          onChange={(id, v) => modifier("prestations", id, v)}
          onBlurCommit={(id, v) => persisterModification("prestations", id, v)}
          onRemove={(id) => retirer("prestations", id)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Durée"
            value={duree}
            onChange={setDuree}
            onBlurCommit={() => mettreAJourDureeEquipeAction(chantierId, { dureePrevue: duree })}
          />
          <Field
            label="Équipe"
            value={equipe}
            onChange={setEquipe}
            onBlurCommit={() => mettreAJourDureeEquipeAction(chantierId, { tailleEquipe: equipe })}
          />
        </div>

        <ListeTextes
          label="Matériel"
          emptyMessage="Aucun matériel pour l'instant."
          addLabel="+ Ajouter un matériel"
          items={materiel}
          leavingIds={leavingIds}
          onAdd={() => ajouter("materiel")}
          onChange={(id, v) => modifier("materiel", id, v)}
          onBlurCommit={(id, v) => persisterModification("materiel", id, v)}
          onRemove={(id) => retirer("materiel", id)}
        />

        <PrimaryButton onClick={valider} disabled={validationEnCours}>
          {validationEnCours ? "Validation…" : "Valider et calculer le prix →"}
        </PrimaryButton>
      </form>

      <UndoToast open={toastVisible} message={toastMessage} onUndo={annulerSuppression} onDismiss={() => setToast(null)} />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlurCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlurCommit: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlurCommit}
        className="rounded-2xl border-0 px-4 py-3 outline-none"
        style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
      />
    </label>
  );
}

function ListeTextes({
  label,
  items,
  leavingIds,
  onAdd,
  onChange,
  onBlurCommit,
  onRemove,
  addLabel,
  emptyMessage,
}: {
  label: string;
  items: Ligne[];
  leavingIds: Set<string>;
  onAdd: () => void;
  onChange: (id: string, value: string) => void;
  onBlurCommit: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  addLabel: string;
  emptyMessage: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      {items.map((item) => (
        <AnimatedRow key={item.id} leaving={leavingIds.has(item.id)} onRemove={() => onRemove(item.id)}>
          <input
            value={item.libelle}
            onChange={(e) => onChange(item.id, e.target.value)}
            onBlur={(e) => onBlurCommit(item.id, e.target.value)}
            className="w-full rounded-2xl border-0 px-4 py-3 outline-none"
            style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
          />
        </AnimatedRow>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="self-start text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        {addLabel}
      </button>
      {items.length === 0 && (
        <p className="text-[13px]" style={{ color: colors.muted }}>
          {emptyMessage}
        </p>
      )}
    </div>
  );
}
