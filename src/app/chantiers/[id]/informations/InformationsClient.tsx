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
} from "./actions";
import BrouillonSection, { type BrouillonInitial } from "./BrouillonSection";
import BandeDuree from "../BandeDuree";
import { dureeEnDemiJournees, libelleDuree } from "@/server/disponibilites";

type Ligne = { id: string; libelle: string };
type NomListe = "prestations" | "materiel";

export default function InformationsClient({
  chantierId,
  initialPrestations,
  initialMateriel,
  initialDuree,
  initialEquipe,
  brouillonInitial,
  transcriptionDisponible,
  dicteeNonTranscrite,
}: {
  chantierId: string;
  initialPrestations: Ligne[];
  initialMateriel: Ligne[];
  initialDuree: string;
  initialEquipe: string;
  brouillonInitial: BrouillonInitial;
  transcriptionDisponible: boolean;
  dicteeNonTranscrite: boolean;
}) {
  const router = useRouter();
  const [prestations, setPrestations] = useState<Ligne[]>(initialPrestations);
  const [materiel, setMateriel] = useState<Ligne[]>(initialMateriel);
  const [duree, setDuree] = useState(initialDuree);
  // La bande ne connaît que des demi-journées ; la donnée, elle, reste du texte.
  // `dureeEnDemiJournees` est la MÊME lecture que celle du planning : deux
  // interprétations d'« 1,5 jour » finiraient par se contredire.
  //
  // `null` quand rien n'a été dit : la bande affiche « non précisé ». Y montrer
  // une durée par défaut ferait entrer un chiffre que personne n'a donné, et il
  // ressortirait dans le prix.
  const dureeDemiJournees = dureeEnDemiJournees(duree);
  const [equipe, setEquipe] = useState(initialEquipe);
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

  // Le brouillon confirmé alimente les listes réelles sans rechargement — les
  // lignes créées sont celles renvoyées par le serveur, jamais reconstruites ici.
  function integrerBrouillonApplique(
    nouvellesPrestations: { id: string; libelle: string }[],
    nouveauMateriel: { id: string; libelle: string }[]
  ) {
    setPrestations((cur) => [...cur, ...nouvellesPrestations]);
    setMateriel((cur) => [...cur, ...nouveauMateriel]);
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
        <BrouillonSection
          chantierId={chantierId}
          brouillonInitial={brouillonInitial}
          transcriptionDisponible={transcriptionDisponible}
          dicteeNonTranscrite={dicteeNonTranscrite}
          onApplique={integrerBrouillonApplique}
        />

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

        {/* La durée se choisit à la molette, ici comme à l'envoi.
            Le patron, le 4 août : « la durée du chantier, ½ journée plus bande
            déroulante max 100 jours, elle a disparu !!!! » Elle n'avait pas
            disparu — elle n'était que sur l'écran d'envoi, c'est-à-dire au bout
            du parcours, alors que c'est ici qu'on décrit le chantier.

            Ce qui est enregistré reste du TEXTE (« 2 jours »), lu par le
            chiffrage et par la planification : la molette ne change pas la
            donnée, seulement la façon de la saisir. Une durée écrite à la main
            par une version antérieure — ou dictée — continue donc d'être
            comprise, et se retrouve sélectionnée dans la bande. */}
        <BandeDuree
          label="Ce chantier prend"
          valeur={dureeDemiJournees}
          onChange={(dj) => {
            const texte = libelleDuree(dj);
            setDuree(texte);
            void mettreAJourDureeEquipeAction(chantierId, { dureePrevue: texte });
          }}
          aide="Sert à calculer le prix, et à savoir quels jours vous pouvez proposer au client."
        />

        <Field
          label="Équipe"
          value={equipe}
          onChange={setEquipe}
          onBlurCommit={() => mettreAJourDureeEquipeAction(chantierId, { tailleEquipe: equipe })}
        />

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

        <div className="flex flex-col gap-3">
          <PrimaryButton onClick={valider} disabled={validationEnCours}>
            {validationEnCours ? "Validation…" : "Valider et calculer le prix →"}
          </PrimaryButton>

          {/* La sortie de secours, demandée par le patron le 3 août 2026 après
              qu'une dictée eut été mal découpée : « je dois pouvoir cliquer sur
              mon devis et le remplir manuellement si je le souhaite ».

              Elle ne valide pas les informations, et c'est délibéré : il quitte
              cet écran sans le trancher. Le marquer vérifié afficherait sur la
              fiche du chantier une étape franchie qui ne l'a pas été.

              Le lien vise l'écran Prix, qui EST le devis en cours de rédaction :
              ses lignes et ses montants sont ce que le client recevra. `saisie=
              manuelle` y replie la proposition automatique — sans la supprimer,
              car il doit pouvoir la rappeler. */}
          <a
            href={`/chantiers/${chantierId}/devis-complet`}
            className="text-center text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            Ou écrire le devis moi-même →
          </a>
          {/* La marge basse n'est pas cosmétique : la bulle de l'assistant est
              fixée en bas à droite, et sans elle cette phrase finit dessous une
              fois la page déroulée à fond. Une pile de notifications avait déjà
              poussé du contenu hors de l'écran — trouvé sur une capture, pas
              par un test. */}
          <p className="-mt-1 pb-10 text-center text-[12px] leading-relaxed" style={{ color: colors.muted }}>
            Vous saisissez chaque ligne et son montant, sans passer par la proposition de prix.
          </p>
        </div>
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
