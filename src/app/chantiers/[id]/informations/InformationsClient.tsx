"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { champPlage, colors, libelleCaps, styleChampPlage, texteSituation } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
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
  const [validationEnCours, setValidationEnCours] = useState(false);

  // Un seul tiroir pour l'écran, alors qu'il porte DEUX listes : c'est ce que
  // le patron a retenu — un tiroir par écran, pas un par rubrique. Le crochet
  // retrouve seul de quelle liste vient l'identifiant.
  const retraits = useRetraits({
    valider: async (id) => {
      const estPrestation = prestations.some((p) => p.id === id);
      await (estPrestation ? supprimerPrestationAction(id) : supprimerMaterielAction(id));
      const setItems = estPrestation ? setPrestations : setMateriel;
      setItems((cur) => cur.filter((i) => i.id !== id));
    },
  });

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

  return (
    <>
      {/* 26 px, et huit d'écart entre les rubriques — les mesures de l'écran
          retenu, portées ici sans être réinventées (`TODO.md` §7). */}
      <form
        className="mt-8 flex flex-col gap-8 px-[26px]"
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
          estRetire={retraits.estRetire}
          onRetirer={retraits.retirer}
          onAdd={() => ajouter("prestations")}
          onChange={(id, v) => modifier("prestations", id, v)}
          onBlurCommit={(id, v) => persisterModification("prestations", id, v)}
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
          estRetire={retraits.estRetire}
          onRetirer={retraits.retirer}
          onAdd={() => ajouter("materiel")}
          onChange={(id, v) => modifier("materiel", id, v)}
          onBlurCommit={(id, v) => persisterModification("materiel", id, v)}
        />

        <div className="flex flex-col gap-4">
          <PrimaryButton onClick={valider} disabled={validationEnCours}>
            {/* **Sans flèche** — sa demande du 25 août 2026. Elle promettait un
                écran de plus ; l'appui, lui, valide les informations. */}
            {validationEnCours ? "Validation…" : "Valider et calculer le prix"}
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
          {/* **La phrase grise qui vivait ici est RETIRÉE** — sa demande du
              25 août 2026 : *« supprimer "vous saisissez chaque ligne" »*. Elle
              décrivait le mécanisme du lien juste au-dessus, et son libellé le
              dit déjà.

              **Le lien, lui, RESTE.** Il a demandé, dans le même message : *« ce
              bouton ouvre le devis ? Si oui la phrase en-dessous est obsolète »*.
              La réponse est non — « Valider et calculer le prix » ouvre l'écran
              PRIX, la proposition de montants. Ce lien-ci saute cette étape et
              va au devis écrit à la main : c'est la sortie de secours qu'il a
              lui-même demandée le 3 août 2026, *« je dois pouvoir cliquer sur
              mon devis et le remplir manuellement si je le souhaite »*.

              **La marge basse déménage ici, et elle n'est pas cosmétique** : la
              bulle de l'assistant est fixée en bas à droite, et sans elle le
              dernier élément finit dessous une fois la page déroulée à fond. Une
              pile de notifications avait déjà poussé du contenu hors de l'écran
              — trouvé sur une capture, pas par un test. */}
          <a
            href={`/chantiers/${chantierId}/devis-complet`}
            className={`block pb-10 text-center ${libelleCaps}`}
            style={{ color: colors.rust }}
          >
            Ou écrire le devis moi-même →
          </a>
        </div>

        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
          className="!mx-0"
        />
      </form>
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
    <label className="flex flex-col gap-2">
      <span className={libelleCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlurCommit}
        className={`w-full ${champPlage}`}
        style={styleChampPlage}
      />
    </label>
  );
}

function ListeTextes({
  label,
  items,
  estRetire,
  onAdd,
  onChange,
  onBlurCommit,
  onRetirer,
  addLabel,
  emptyMessage,
}: {
  label: string;
  items: Ligne[];
  estRetire: (id: string) => boolean;
  onAdd: () => void;
  onChange: (id: string, value: string) => void;
  onBlurCommit: (id: string, value: string) => void;
  onRetirer: (id: string, libelle: string) => void;
  addLabel: string;
  emptyMessage: string;
}) {
  const visibles = items.filter((i) => !estRetire(i.id));
  return (
    // `flex flex-col gap-2` est un REPÈRE, pas une mesure : les suites de bout
    // en bout désignent une rubrique par cette signature plus le libellé qu'elle
    // porte (`test-informations-e2e.ts`). Les lignes, elles, se serrent à 4 px
    // dans un conteneur intérieur — l'écart de la maquette entre deux plages.
    <div className="flex flex-col gap-2">
      <span className={libelleCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      {items.length > 0 && (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <LigneRetirable
              key={item.id}
              libelle={item.libelle ? `« ${item.libelle} »` : `cette ligne de ${label.toLowerCase()}`}
              retiree={estRetire(item.id)}
              onRetirer={() =>
                onRetirer(item.id, item.libelle ? `« ${item.libelle} »` : `cette ligne de ${label.toLowerCase()}`)
              }
              hauteurMax={70}
              className="flex items-center"
            >
              <input
                value={item.libelle}
                onChange={(e) => onChange(item.id, e.target.value)}
                onBlur={(e) => onBlurCommit(item.id, e.target.value)}
                className={`w-full ${champPlage}`}
                style={styleChampPlage}
              />
            </LigneRetirable>
          ))}
        </div>
      )}
      {visibles.length === 0 && (
        <p className={texteSituation} style={{ color: colors.muted }}>
          {emptyMessage}
        </p>
      )}
      <button
        type="button"
        onClick={onAdd}
        className={`self-start ${libelleCaps}`}
        style={{ color: colors.rust }}
      >
        {addLabel}
      </button>
    </div>
  );
}
