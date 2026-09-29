"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import ChoixCanal from "@/components/atlas/ChoixCanal";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { MOIS_LONGS } from "@/lib/mois";
import { enEuros } from "@/lib/euros";
import { memeLibelle, parFamilles } from "@/lib/prestations-entretien";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import { canalPourJoindre, composerMessageContrat, lienTransmission, type CanalClient } from "@/lib/message-client";
import { ouvrirAdresse } from "@/lib/ouvrir-messagerie";
import { adressePourLeClient, ouvrableParLeClient, phraseAdresseLocale } from "@/lib/adresse-du-client";
import { useAdressePourLeClient } from "@/lib/use-adresse-client";
import { avecCivilite, type CiviliteChoisie } from "@/lib/civilite";
import {
  MAX_DUREE_MOIS,
  MAX_PASSAGES_PAR_MOIS,
  ceQuiManque,
  mensualites,
  montantDeLaPrestation,
  passagesDeLaPrestation,
  periodeEnLettres,
  relireContrat,
  totauxDuContrat,
  type ContratSaisi,
  type FacturationContrat,
  type PrestationContrat,
} from "@/lib/contrats-entretien";
import { ajouterPrestationAction } from "@/app/paysage/fiche/composer/actions";
import { enregistrerContratAction, envoyerContratAction } from "./actions";

/**
 * L'ÉCRAN DU CONTRAT, tel que sa planche 129 le montre : chaque prestation
 * avec ses mois, son nombre de passages au + et au −, son prix du passage ;
 * la durée (début et nombre de mois) ; la facturation A ou B en or, B
 * d'office ; l'interrupteur « avec le compte rendu », en B seulement.
 *
 * **Aucun calcul ici** : totaux, passages, mensualités et ce qui manque
 * viennent de `src/lib/contrats-entretien.ts`, les mêmes fonctions que le
 * serveur rejoue en enregistrant (`CLAUDE.md` §3).
 */

type ContratRecu = {
  id: string;
  statut: "brouillon" | "envoye" | "accepte" | "refuse";
  prestations: PrestationContrat[];
  periode: { debut: string; dureeMois: number };
  reconduit: boolean;
  facturation: FacturationContrat;
  avecCompteRendu: boolean;
  tauxTva: string;
  jeton: string | null;
  envoyeLe: string | null;
  reponduLe: string | null;
};

type Props = {
  client: {
    id: string;
    nom: string;
    civilite: CiviliteChoisie | null;
    telephone: string | null;
    email: string | null;
    canal: CanalClient | null;
  };
  entrepriseNom: string;
  origine: string;
  modele: { famille: string; libelle: string }[];
  /** Propriétaire, formule avec la fiche : ce qu'il écrit ici entre dans sa fiche. */
  ficheModifiable: boolean;
  contrat: ContratRecu | null;
  aujourdhui: string;
};

const INITIALES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
/** Le taux de la maquette tant que le contrat n'existe pas : le serveur pose celui des réglages. */
const TAUX_AFFICHE_PAR_DEFAUT = "20.00";

function premierDuMoisSuivant(aujourdhui: string): string {
  const a = Number(aujourdhui.slice(0, 4));
  const m = Number(aujourdhui.slice(5, 7));
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
}

function jourDit(iso: string): string {
  const j = Number(iso.slice(8, 10));
  return `${j === 1 ? "1er" : j} ${MOIS_LONGS[Number(iso.slice(5, 7)) - 1]}`;
}

type Ligne = PrestationContrat & { cle: number; prixSaisi: string };

export default function ContratClient(props: Props) {
  const { contrat } = props;
  const [modifier, setModifier] = useState(!contrat || contrat.statut === "brouillon");
  if (contrat && contrat.statut !== "brouillon" && !modifier) {
    return <ContratParti {...props} contrat={contrat} repartir={() => setModifier(true)} />;
  }
  return (
    <Editeur
      {...props}
      // Repartir d'un contrat parti en fait un NOUVEAU : l'ancien reste tel
      // que le client l'a lu.
      depart={contrat}
      idDepart={contrat && contrat.statut === "brouillon" ? contrat.id : null}
    />
  );
}

function Editeur({
  client,
  entrepriseNom,
  origine: origineServeur,
  modele: modeleRecu,
  ficheModifiable,
  depart,
  idDepart,
  aujourdhui,
}: Props & { depart: ContratRecu | null; idDepart: string | null }) {
  const router = useRouter();
  const origine = useAdressePourLeClient(origineServeur);
  const [enCours, demarrer] = useTransition();
  const [id, setId] = useState<string | null>(idDepart);
  const [refus, setRefus] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    (depart?.prestations ?? []).map((p, i) => ({
      ...p,
      cle: i,
      prixSaisi: p.prixPassageHt === null ? "" : p.prixPassageHt.replace(".", ","),
    }))
  );
  const [cleSuivante, setCleSuivante] = useState(lignes.length);
  const [debut, setDebut] = useState(depart?.periode.debut ?? premierDuMoisSuivant(aujourdhui));
  const [dureeMois, setDureeMois] = useState(depart?.periode.dureeMois ?? 12);
  const [reconduit, setReconduit] = useState(depart?.reconduit ?? true);
  const [facturation, setFacturation] = useState<FacturationContrat>(depart?.facturation ?? "passage");
  const [avecCompteRendu, setAvecCompteRendu] = useState(depart?.avecCompteRendu ?? false);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [libre, setLibre] = useState("");
  // **Ce qu'il écrit ici entre dans SA FICHE, dans la famille qu'il touche** —
  // sa demande du 29 septembre 2026, planche `appli/contrat-prestation-dans-
  // ma-fiche.html`. Jamais de famille « Autres » d'office : il avait refusé ce
  // rangement par défaut le 24 août (« Divers », `ComposerMaFiche.tsx`).
  const [modele, setModele] = useState(modeleRecu);
  const [familleChoisie, setFamilleChoisie] = useState<string | null>(null);
  const [nouvelleFamille, setNouvelleFamille] = useState(false);
  const [nomFamille, setNomFamille] = useState("");
  const [refusFiche, setRefusFiche] = useState<string | null>(null);
  const [canal, setCanal] = useState<CanalClient | null>(canalPourJoindre(client));

  const periode = { debut, dureeMois };
  // Le prix tapé passe par la même relecture que le serveur : ce que l'écran
  // additionne est ce qui s'enregistrera.
  const saisi: ContratSaisi = {
    prestations: lignes.map((l) => ({
      libelle: l.libelle,
      famille: l.famille,
      mois: l.mois,
      foisParMois: l.foisParMois,
      prixPassageHt: l.prixSaisi.trim() === "" ? null : l.prixSaisi,
    })),
    debut,
    dureeMois,
    reconduit,
    facturation,
    avecCompteRendu,
  };
  const relu = relireContrat(saisi);
  const prestationsRelues = relu.ok ? relu.contrat.prestations : [];
  const taux = depart?.tauxTva ?? TAUX_AFFICHE_PAR_DEFAUT;
  const totaux = totauxDuContrat(prestationsRelues, periode, taux);
  const manque = relu.ok ? ceQuiManque(prestationsRelues, periode) : relu.refus;

  const mensuel = mensualites(totaux.totalHt, dureeMois);
  const montants = prestationsRelues.flatMap((p) =>
    p.prixPassageHt === null ? [] : Array<string>(passagesDeLaPrestation(p, periode)).fill(p.prixPassageHt)
  );
  const nombres = montants.map(Number);

  function changer(cle: number, modif: Partial<Ligne>) {
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...modif } : l)));
  }
  function ajouter(famille: string | null, libelle: string) {
    setLignes((ls) => [...ls, { libelle, famille, mois: [], foisParMois: 1, prixPassageHt: null, cle: cleSuivante, prixSaisi: "" }]);
    setCleSuivante((c) => c + 1);
    setAjoutOuvert(false);
    setLibre("");
    setFamilleChoisie(null);
    setNouvelleFamille(false);
    setNomFamille("");
  }

  const familles = useMemo(() => parFamilles(modele), [modele]);

  // Déjà dans sa fiche, à la casse et aux accents près (`memeLibelle`, la
  // règle du dépôt) : elle garde sa famille, et la fiche n'a pas de doublon.
  const dejaDansLaFiche = libre.trim() ? modele.find((p) => memeLibelle(p.libelle, libre.trim())) : undefined;
  const choisirFamille = ficheModifiable && libre.trim() !== "" && !dejaDansLaFiche;
  const familleVisee = nouvelleFamille ? nomFamille.trim() : familleChoisie;

  function ajouterLibre() {
    const libelle = libre.trim();
    if (!libelle) return;
    if (dejaDansLaFiche) return ajouter(dejaDansLaFiche.famille, dejaDansLaFiche.libelle);
    if (!ficheModifiable) return ajouter(null, libelle);
    if (!familleVisee) return;
    // L'orthographe déjà en place l'emporte, comme `ajouterPrestation` la
    // retient : le contrat et la fiche disent la même famille.
    const famille = familles.find((f) => memeLibelle(f.famille, familleVisee))?.famille ?? familleVisee;
    ajouter(famille, libelle);
    setRefusFiche(null);
    demarrer(async () => {
      // Le contrat la garde quoi que la fiche réponde : il l'a écrite pour ce
      // client. Un refus de la fiche (pleine, par exemple) se dit, il ne
      // retire rien.
      const r = await ajouterPrestationAction(famille, libelle);
      if (!r.ok) {
        setRefusFiche(r.phrase);
        return;
      }
      setModele((m) => {
        const apres = m.map((p) => p.famille).lastIndexOf(famille) + 1 || m.length;
        return [...m.slice(0, apres), { famille, libelle }, ...m.slice(apres)];
      });
    });
  }

  function enregistrer(ensuite: (idEnregistre: string) => void) {
    setRefus(null);
    demarrer(async () => {
      const r = await enregistrerContratAction(client.id, id, saisi);
      if (!r.ok) {
        setRefus(r.refus);
        return;
      }
      setId(r.id);
      ensuite(r.id);
    });
  }

  function apercu() {
    enregistrer((idEnregistre) =>
      router.push(
        adresseDeLaVisionneuse(`/api/contrats/${idEnregistre}/pdf`, { surtitre: "Contrat d'entretien", titre: client.nom })
      )
    );
  }

  function envoyer() {
    if (!canal) return;
    const destinataire = canal === "sms" ? client.telephone : client.email;
    // **Le lien ne part pas s'il ne mène nulle part** : la leçon du compte rendu
    // (24 août 2026), une adresse locale ouverte sur le téléphone du client.
    const adresse = adressePourLeClient(origine);
    if (!ouvrableParLeClient(adresse)) {
      setRefus(phraseAdresseLocale("votre contrat"));
      return;
    }
    setRefus(null);
    demarrer(async () => {
      let idEnvoi = id;
      if (!idEnvoi) {
        const r = await enregistrerContratAction(client.id, null, saisi);
        if (!r.ok) {
          setRefus(r.refus);
          return;
        }
        idEnvoi = r.id;
        setId(r.id);
      }
      const e = await envoyerContratAction(client.id, idEnvoi, saisi);
      if (!e.ok) {
        setRefus(e.refus);
        return;
      }
      const message = composerMessageContrat({
        clientNom: client.nom,
        clientCivilite: client.civilite ?? undefined,
        entrepriseNom,
        lien: `${adresse}/contrat/${e.jeton}`,
      });
      ouvrirAdresse(lienTransmission({ canal, destinataire, message }), canal);
      router.refresh();
    });
  }

  const pris = new Set(lignes.map((l) => l.libelle));
  const [annee, mois] = [Number(debut.slice(0, 4)), Number(debut.slice(5, 7))];
  const anneeCourante = Number(aujourdhui.slice(0, 4));

  return (
    <div className="mx-[10px] mt-[18px] rounded-[10px] px-4 pb-6 pt-5" style={{ backgroundColor: colors.card }}>
      <Intitule>Prestations</Intitule>
      {lignes.map((l) => {
        const p = prestationsRelues.find((x) => x.libelle === l.libelle.trim()) ?? null;
        const n = p ? passagesDeLaPrestation(p, periode) : 0;
        const montant = p ? montantDeLaPrestation(p, periode) : null;
        return (
          <div key={l.cle} className="py-4" style={{ borderBottom: `1px solid ${colors.lineSoft}` }} data-atlas="prestation-contrat">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="m-0 text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
                  {l.libelle}
                </p>
                {l.famille && (
                  <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: colors.muted }}>
                    {l.famille}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`Retirer ${l.libelle}`}
                onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                className="h-7 w-7 flex-none rounded-full text-[15px] leading-none"
                style={{ border: `1px solid ${colors.or}`, color: colors.or, background: "none" }}
              >
                −
              </button>
            </div>
            <div className="mt-3 grid grid-cols-12 gap-[3px]">
              {INITIALES.map((initiale, i) => {
                const m = i + 1;
                const coche = l.mois.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={coche}
                    aria-label={MOIS_LONGS[i]}
                    onClick={() =>
                      changer(l.cle, {
                        mois: coche ? l.mois.filter((x) => x !== m) : [...l.mois, m].sort((a, b) => a - b),
                      })
                    }
                    className="h-[34px] rounded-[6px] p-0 text-[12px] font-semibold"
                    style={
                      coche
                        ? { backgroundColor: colors.plein, color: surPlein }
                        : { backgroundColor: colors.cream, color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }
                    }
                  >
                    {initiale}
                  </button>
                );
              })}
            </div>
            <Rangee libelle="Passages par mois">
              <Compteur
                valeur={String(l.foisParMois)}
                moins={() => changer(l.cle, { foisParMois: Math.max(1, l.foisParMois - 1) })}
                plus={() => changer(l.cle, { foisParMois: Math.min(MAX_PASSAGES_PAR_MOIS, l.foisParMois + 1) })}
                auPlancher={l.foisParMois <= 1}
                auPlafond={l.foisParMois >= MAX_PASSAGES_PAR_MOIS}
                quoi="passage"
              />
            </Rangee>
            <Rangee libelle="Prix du passage HT">
              <span className="flex items-center gap-1">
                <input
                  inputMode="decimal"
                  value={l.prixSaisi}
                  placeholder="à chiffrer"
                  aria-label={`Prix du passage de ${l.libelle}`}
                  onChange={(e) => changer(l.cle, { prixSaisi: e.target.value })}
                  className="w-[84px] border-0 bg-transparent px-0.5 py-1 text-right text-[16px] outline-none"
                  style={{ borderBottom: `1px solid ${colors.lineSoft}`, color: colors.ink }}
                />
                <span className="text-[14px]" style={{ color: colors.inkSoft }}>
                  €
                </span>
              </span>
            </Rangee>
            <p className="m-0 mt-2.5 text-right text-[13.5px]" style={{ color: n === 0 || montant === null ? colors.or : colors.inkSoft }}>
              {l.mois.length === 0
                ? "Aucun mois choisi"
                : n === 0
                  ? "Aucun de ces mois dans la période"
                  : montant === null
                    ? `${n} passage${n > 1 ? "s" : ""}, prix à chiffrer`
                    : `${n} passage${n > 1 ? "s" : ""}, ${enEuros(montant)} HT`}
            </p>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setAjoutOuvert((o) => !o)}
        className="mt-3.5 min-h-9 border-0 bg-transparent p-0 text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        + Ajouter une prestation
      </button>
      {refusFiche && (
        <p className="m-0 mt-1 text-[13.5px]" style={{ color: colors.rust }} role="alert">
          {refusFiche}
        </p>
      )}
      {ajoutOuvert && (
        <div className="mt-2 rounded-[8px] px-3 pb-2.5 pt-1.5" style={{ backgroundColor: colors.rustTint }}>
          <form
            className="my-2.5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ajouterLibre();
            }}
          >
            <input
              value={libre}
              maxLength={60}
              onChange={(e) => setLibre(e.target.value)}
              placeholder="Écrire une prestation"
              aria-label="Écrire une prestation"
              className="h-[42px] min-w-0 flex-1 rounded-[8px] border-0 px-3 text-[16px] outline-none"
              style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            />
            <button
              type="submit"
              disabled={!libre.trim() || (choisirFamille && !familleVisee)}
              className="h-[42px] flex-none rounded-full px-4 text-[14.5px] disabled:opacity-45"
              style={{ backgroundColor: colors.plein, color: surPlein }}
            >
              Ajouter
            </button>
          </form>
          {choisirFamille && (
            <div className="mb-2" data-atlas="famille-de-la-fiche">
              <p className="m-0 mb-2 text-[13.5px]" style={{ color: colors.inkSoft }}>
                Dans quelle famille de votre fiche ?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {familles.map((f) => {
                  const choisie = !nouvelleFamille && familleChoisie === f.famille;
                  return (
                    <button
                      key={f.famille}
                      type="button"
                      aria-pressed={choisie}
                      onClick={() => {
                        setNouvelleFamille(false);
                        setFamilleChoisie(f.famille);
                      }}
                      className="min-h-9 rounded-full border-0 px-[13px] text-[14px]"
                      style={
                        choisie
                          ? { backgroundColor: colors.plein, color: surPlein }
                          : { backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }
                      }
                    >
                      {f.famille}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={nouvelleFamille}
                  onClick={() => {
                    setNouvelleFamille(true);
                    setFamilleChoisie(null);
                  }}
                  className="min-h-9 rounded-full border-0 px-[13px] text-[14px]"
                  style={
                    nouvelleFamille
                      ? { backgroundColor: colors.plein, color: surPlein }
                      : { backgroundColor: colors.card, color: colors.orTexte, boxShadow: `inset 0 0 0 1px ${colors.line}` }
                  }
                >
                  + Nouvelle famille
                </button>
              </div>
              {nouvelleFamille && (
                <input
                  autoFocus
                  value={nomFamille}
                  maxLength={60}
                  onChange={(e) => setNomFamille(e.target.value)}
                  placeholder="Nom de la famille"
                  aria-label="Nom de la nouvelle famille"
                  className="mt-2 block h-[42px] w-full rounded-[8px] border-0 px-3 text-[16px] outline-none"
                  style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                />
              )}
            </div>
          )}
          {familles.map((f) => (
            <div key={f.famille}>
              <p className="m-0 mb-1 mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
                {f.famille}
              </p>
              {f.lignes.map((p) => (
                <button
                  key={p.libelle}
                  type="button"
                  disabled={pris.has(p.libelle)}
                  onClick={() => ajouter(f.famille, p.libelle)}
                  className="block w-full border-0 bg-transparent py-[9px] text-left text-[15px]"
                  style={{
                    borderBottom: `1px solid ${colors.lineSoft}`,
                    color: pris.has(p.libelle) ? colors.muted : colors.ink,
                  }}
                >
                  {p.libelle}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-[26px]">
        <Intitule>Durée</Intitule>
        <Rangee libelle={null} texte="Début">
          <span className="flex gap-1.5">
            <select
              aria-label="Mois de début"
              value={mois}
              onChange={(e) => setDebut(`${annee}-${e.target.value.padStart(2, "0")}-01`)}
              className="h-[38px] rounded-[8px] border-0 px-2 text-[15px]"
              style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              {MOIS_LONGS.map((nom, i) => (
                <option key={nom} value={i + 1}>
                  {nom}
                </option>
              ))}
            </select>
            <select
              aria-label="Année de début"
              value={annee}
              onChange={(e) => setDebut(`${e.target.value}-${String(mois).padStart(2, "0")}-01`)}
              className="h-[38px] rounded-[8px] border-0 px-2 text-[15px]"
              style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              {[anneeCourante - 1, anneeCourante, anneeCourante + 1, anneeCourante + 2].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </span>
        </Rangee>
        <Rangee libelle={null} texte="Durée">
          <Compteur
            valeur={`${dureeMois} mois`}
            moins={() => setDureeMois((d) => Math.max(1, d - 1))}
            plus={() => setDureeMois((d) => Math.min(MAX_DUREE_MOIS, d + 1))}
            auPlancher={dureeMois <= 1}
            auPlafond={dureeMois >= MAX_DUREE_MOIS}
            quoi="mois"
          />
        </Rangee>
        <p className="m-0 mt-0.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
          {periodeEnLettres(periode)}.
        </p>
        <Rangee libelle={null} texte="Reconduit à la fin">
          <Interrupteur allume={reconduit} basculer={() => setReconduit((r) => !r)} nom="Reconduit à la fin" />
        </Rangee>
      </div>

      <div className="mt-[26px]">
        <Intitule>Facturation</Intitule>
        <div className="flex flex-col gap-2">
          <ChoixFacturation
            lettre="A"
            titre="Chaque mois, le même montant"
            actif={facturation === "mois"}
            choisir={() => {
              setFacturation("mois");
              setAvecCompteRendu(false);
            }}
            consequence={
              totaux.totalHt === "0.00"
                ? "Rien à facturer."
                : mensuel.montant === mensuel.derniere
                  ? `${mensuel.nombre} facture${mensuel.nombre > 1 ? "s" : ""} de ${enEuros(mensuel.montant)} HT, le 1er de chaque mois.`
                  : `${mensuel.nombre - 1} factures de ${enEuros(mensuel.montant)} HT et une de ${enEuros(mensuel.derniere)}, le 1er de chaque mois.`
            }
          />
          <ChoixFacturation
            lettre="B"
            titre="Après chaque passage"
            actif={facturation === "passage"}
            choisir={() => setFacturation("passage")}
            consequence={
              nombres.length === 0
                ? "Rien à facturer."
                : Math.min(...nombres) === Math.max(...nombres)
                  ? `${nombres.length} factures de ${enEuros(montants[0])} HT, le jour du compte rendu.`
                  : `${nombres.length} factures, de ${enEuros(String(Math.min(...nombres)))} à ${enEuros(String(Math.max(...nombres)))} HT, le jour du compte rendu.`
            }
          />
        </div>
        {facturation === "passage" && (
          <div className="mt-3">
            <Rangee libelle={null} texte="Envoyer la facture avec le compte rendu">
              <Interrupteur
                allume={avecCompteRendu}
                basculer={() => setAvecCompteRendu((a) => !a)}
                nom="Envoyer la facture avec le compte rendu"
              />
            </Rangee>
            <p className="m-0 text-[13.5px]" style={{ color: colors.inkSoft }}>
              {avecCompteRendu
                ? "Un seul geste : le compte rendu part, la facture part avec."
                : "Vous l'envoyez vous-même après chaque passage."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-[26px]">
        <Total libelle="Passages" valeur={String(totaux.passages)} />
        <Total libelle="Total HT du contrat" valeur={enEuros(totaux.totalHt)} />
        <Total libelle={`TVA ${Number(taux).toLocaleString("fr-FR")} %`} valeur={enEuros(totaux.totalTva)} />
        <div className="mt-1.5 flex items-center justify-between pt-2.5" style={{ borderTop: `2px solid ${colors.ink}` }}>
          <b className="text-[17px] font-semibold">Total TTC</b>
          <span className="text-[20px] font-semibold" style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}>
            {enEuros(totaux.totalTtc)}
          </span>
        </div>
      </div>

      <div className="mt-[30px] pt-5 text-center" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
        <button
          type="button"
          onClick={apercu}
          disabled={enCours || lignes.length === 0}
          className="border-0 bg-transparent p-2 text-[14px] font-medium disabled:opacity-45"
          style={{ color: colors.rust }}
        >
          Aperçu du PDF
        </button>
      </div>

      {/* **En fin de feuille, pas collé en bas** : la barre d'onglets est posée
          par-dessus la page, et un bouton collant se glissait dessous. */}
      <div className="mt-4 pt-2.5">
        <div className="mb-2.5 flex justify-center gap-4">
          <ChoixCanal libelle="Par SMS" actif={canal === "sms"} disponible={Boolean(client.telephone?.trim())} onClick={() => setCanal("sms")} apparence="reglage" />
          <ChoixCanal libelle="Par e-mail" actif={canal === "email"} disponible={Boolean(client.email?.trim())} onClick={() => setCanal("email")} apparence="reglage" />
        </div>
        <button
          type="button"
          onClick={envoyer}
          disabled={enCours || manque !== null || !canal}
          className="atlas-plein block min-h-[52px] w-full rounded-full border-0 text-[17px] disabled:opacity-45"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
          data-atlas="envoyer-contrat"
        >
          {enCours ? "Un instant" : `Envoyer à ${avecCivilite(client.nom, client.civilite ?? undefined)}`}
        </button>
        {(refus ?? manque ?? (!canal ? "Ajoutez son téléphone ou son e-mail sur sa fiche." : null)) && (
          <p className="m-0 mt-1.5 text-center text-[13px]" style={{ color: colors.alert }}>
            {refus ?? manque ?? "Ajoutez son téléphone ou son e-mail sur sa fiche."}
          </p>
        )}
      </div>
    </div>
  );
}

/** Le contrat parti : il se relit, il ne se modifie plus. */
function ContratParti({ contrat, repartir }: Props & { contrat: ContratRecu; repartir: () => void }) {
  const totaux = totauxDuContrat(contrat.prestations, contrat.periode, contrat.tauxTva);
  const etat =
    contrat.statut === "accepte"
      ? `Accepté le ${jourDit((contrat.reponduLe ?? "").slice(0, 10))}`
      : contrat.statut === "refuse"
        ? `Refusé le ${jourDit((contrat.reponduLe ?? "").slice(0, 10))}`
        : `Envoyé le ${jourDit((contrat.envoyeLe ?? "").slice(0, 10))}`;
  return (
    <div className="mx-[10px] mt-[18px] rounded-[10px] px-4 pb-6 pt-5" style={{ backgroundColor: colors.card }} data-atlas="contrat-parti">
      <p className="m-0 text-[20px] leading-[1.25]" style={{ fontFamily: font.display }}>
        {etat}
      </p>
      <p className="m-0 mt-1 text-[13.5px]" style={{ color: contrat.statut === "envoye" ? colors.orTexte : colors.inkSoft }}>
        {contrat.statut === "envoye"
          ? "En attente de sa réponse."
          : contrat.statut === "accepte"
            ? "Ses passages arrivent dans « Sans date » le 20 du mois d'avant."
            : "Rien n'arrive au planning."}
      </p>
      <div className="mt-5">
        {contrat.prestations.map((p) => {
          const n = passagesDeLaPrestation(p, contrat.periode);
          return (
            <div key={p.libelle} className="flex items-baseline justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${colors.lineSoft}` }}>
              <span className="min-w-0 text-[15px]">{p.libelle}</span>
              <span className="flex-none text-[13.5px]" style={{ color: colors.inkSoft }}>
                {n} passage{n > 1 ? "s" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="m-0 mt-3 text-[13.5px]" style={{ color: colors.inkSoft }}>
        {periodeEnLettres(contrat.periode)}.
      </p>
      <div className="mt-4">
        <Total libelle="Total HT du contrat" valeur={enEuros(totaux.totalHt)} />
        <Total libelle="Total TTC" valeur={enEuros(totaux.totalTtc)} />
      </div>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href={adresseDeLaVisionneuse(`/api/contrats/${contrat.id}/pdf`, { surtitre: "Contrat d'entretien", titre: etat })}
          className="text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          Voir le contrat en PDF
        </Link>
        <button type="button" onClick={repartir} className="border-0 bg-transparent p-2 text-[14px] font-medium" style={{ color: colors.or }}>
          + Nouveau contrat
        </button>
      </div>
    </div>
  );
}

function Intitule({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
      {children}
    </p>
  );
}

function Rangee({ libelle, texte, children }: { libelle: string | null; texte?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 flex min-h-[38px] items-center justify-between gap-2.5">
      {libelle !== null ? (
        <span className="text-[11px] font-semibold uppercase leading-[1.2] tracking-[0.1em]" style={{ color: colors.muted }}>
          {libelle}
        </span>
      ) : (
        <span className="text-[15px]">{texte}</span>
      )}
      {children}
    </div>
  );
}

function Compteur(p: {
  valeur: string;
  moins: () => void;
  plus: () => void;
  auPlancher: boolean;
  auPlafond: boolean;
  quoi: string;
}) {
  const style = { backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.ink };
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`Un ${p.quoi} de moins`} disabled={p.auPlancher} onClick={p.moins} className="h-9 w-9 rounded-full border-0 text-[19px] disabled:opacity-50" style={style}>
        −
      </button>
      <output className="min-w-8 text-center text-[17px] font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {p.valeur}
      </output>
      <button type="button" aria-label={`Un ${p.quoi} de plus`} disabled={p.auPlafond} onClick={p.plus} className="h-9 w-9 rounded-full border-0 text-[19px] disabled:opacity-50" style={style}>
        +
      </button>
    </div>
  );
}

function Interrupteur({ allume, basculer, nom }: { allume: boolean; basculer: () => void; nom: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={allume}
      aria-label={nom}
      onClick={basculer}
      className="relative h-7 w-12 flex-none rounded-full border-0"
      style={{ backgroundColor: allume ? colors.plein : colors.line }}
    >
      <span
        className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left]"
        style={{ left: allume ? 23 : 3, backgroundColor: colors.card }}
      />
    </button>
  );
}

function ChoixFacturation(p: { lettre: string; titre: string; actif: boolean; choisir: () => void; consequence: string }) {
  return (
    <button
      type="button"
      aria-pressed={p.actif}
      onClick={p.choisir}
      data-atlas="choix-facturation"
      className="rounded-[10px] border-0 px-3.5 py-3 text-left"
      style={{
        backgroundColor: colors.card,
        boxShadow: `inset 0 0 0 ${p.actif ? "1.5px" : "1px"} ${p.actif ? colors.or : colors.line}`,
        color: colors.ink,
      }}
    >
      <span className="block text-[15px] font-medium leading-[1.3]">
        <span className="mr-1.5 font-semibold" style={{ color: colors.or }}>
          {p.lettre}
        </span>
        {p.titre}
      </span>
      <span className="mt-1 block text-[13.5px]" style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}>
        {p.consequence}
      </span>
    </button>
  );
}

function Total({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-2.5 py-1.5 text-[15px]" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span>{libelle}</span>
      <span>{valeur}</span>
    </div>
  );
}
