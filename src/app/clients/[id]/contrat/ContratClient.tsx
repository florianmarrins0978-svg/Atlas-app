"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import ChoixCanal from "@/components/atlas/ChoixCanal";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import IconeTrait from "@/components/atlas/IconeTrait";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import { MOIS_ABREGES } from "@/lib/jour";
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

/** « Janv. », « Févr. »… : sa planche du 31 octobre 2026. Douze initiales
 *  faisaient lire J, M et A deux fois. */
const MOIS_DES_CASES = MOIS_ABREGES.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
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
  // **Ce qu'il a choisi, c'est de repartir de CE contrat-là — 3 octobre 2026.**
  // L'écran retenait un simple « en saisie », figé à son ouverture : un
  // brouillon envoyé revenait de la base « envoyé », et la saisie restait
  // affichée comme si rien n'était parti (*« l'appli reste bloquée sur la page
  // d'envoi »*). Retenir l'identifiant laisse l'état du contrat décider : le
  // contrat qui vient de partir n'est pas celui dont il a voulu repartir.
  const [repartiDe, setRepartiDe] = useState<string | null>(null);
  if (contrat && contrat.statut !== "brouillon" && repartiDe !== contrat.id) {
    return <ContratParti {...props} contrat={contrat} repartir={() => setRepartiDe(contrat.id)} />;
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

  // **LE BROUILLON S'ENREGISTRE À CHAQUE GESTE — 29 septembre 2026.** Sa
  // plainte : *« si je quitte, il ne s'enregistre pas dans mes chantiers en
  // cours »*. Rien ne s'écrivait avant « Aperçu du PDF » ou « Envoyer » : tout
  // vivait dans l'écran, et partait avec lui. Comme pour un devis, le brouillon
  // naît au premier vrai geste (une prestation) et suit chaque changement ;
  // l'aperçu et l'envoi passent par le MÊME enregistrement, donc jamais deux
  // créations pour un seul contrat.
  //
  // Les écritures se suivent dans une file : la première crée, les suivantes
  // reprennent son identifiant. Chacune écrit la saisie la plus récente, et
  // celle qui n'a plus rien de neuf à écrire ne part pas.
  const idEnregistre = useRef<string | null>(idDepart);
  const cle = JSON.stringify(saisi);
  const derniereCle = useRef(cle);
  const cleDemandee = useRef(cle);
  const saisieCourante = useRef(saisi);
  const file = useRef<Promise<unknown>>(Promise.resolve());

  function enregistrer(): Promise<{ ok: true; id: string } | { ok: false; refus: string }> {
    // Une écriture tombée (réseau coupé) ne bloque pas la suivante : elle
    // repart de ce que la base a vraiment reçu.
    const ecrire = async () => {
      const s = saisieCourante.current;
      const cleEcrite = JSON.stringify(s);
      if (idEnregistre.current && cleEcrite === derniereCle.current) return { ok: true as const, id: idEnregistre.current };
      const r = await enregistrerContratAction(client.id, idEnregistre.current, s);
      if (r.ok) {
        idEnregistre.current = r.id;
        derniereCle.current = cleEcrite;
      }
      return r;
    };
    const suite = file.current.then(ecrire, ecrire);
    file.current = suite;
    return suite;
  }

  // Une saisie qui ne se relit pas (un prix à moitié tapé) ne part pas : son
  // refus est déjà écrit sous le bouton, et la frappe suivante l'enregistrera.
  useEffect(() => {
    saisieCourante.current = saisi;
    if (cle === cleDemandee.current || !relu.ok) return;
    if (idEnregistre.current === null && saisi.prestations.length === 0) return;
    cleDemandee.current = cle;
    enregistrer().then(
      (r) => setRefus(r.ok ? null : r.refus),
      () => setRefus("Le contrat n'a pas pu être enregistré. Réessayez.")
    );
  });

  function apercu() {
    setRefus(null);
    demarrer(async () => {
      const r = await enregistrer();
      if (!r.ok) {
        setRefus(r.refus);
        return;
      }
      router.push(adresseDeLaVisionneuse(`/api/contrats/${r.id}/pdf`, { surtitre: "Contrat d'entretien", titre: client.nom }));
    });
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
      const r = await enregistrer();
      if (!r.ok) {
        setRefus(r.refus);
        return;
      }
      const e = await envoyerContratAction(client.id, r.id, saisi);
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
    /* **Des plages sur le fond, et non plus une grande carte** — sa planche du
       31 octobre 2026 (`appli/soignee/client-contrat.html`) : Prestations,
       Durée, Facturation, le total et l'envoi, dans le même ordre, chacun sur
       sa plage comme partout dans l'appli. */
    <div className="mx-[22px] mt-[18px] pb-6">
      <Intitule premier>Prestations</Intitule>
      {lignes.length > 0 && (
      <div className="rounded-md px-[18px] py-1" style={{ backgroundColor: colors.card }}>
      {lignes.map((l, rang) => {
        const p = prestationsRelues.find((x) => x.libelle === l.libelle.trim()) ?? null;
        const n = p ? passagesDeLaPrestation(p, periode) : 0;
        const montant = p ? montantDeLaPrestation(p, periode) : null;
        return (
          <div key={l.cle} className={`pt-4 pb-3.5 ${rang > 0 ? "border-t" : ""}`} style={{ borderColor: colors.line }} data-atlas="prestation-contrat">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="m-0 text-[19px] leading-[1.25]" style={{ fontFamily: font.display }}>
                  {l.libelle}
                </p>
                {l.famille && (
                  <p className="m-0 mt-0.5 text-[14px]" style={{ color: colors.inkSoft }}>
                    {l.famille}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`Retirer ${l.libelle}`}
                onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                className="-mt-1.5 -mr-2 grid h-10 w-10 flex-none place-items-center rounded-full text-[22px] leading-none"
                style={{ color: colors.or, background: "none" }}
              >
                −
              </button>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {MOIS_DES_CASES.map((nomCourt, i) => {
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
                    className="min-h-10 rounded-[10px] p-0 text-[14px] font-semibold transition-colors duration-200"
                    style={
                      coche
                        ? { backgroundColor: colors.plein, color: surPlein }
                        : { backgroundColor: colors.cream, color: colors.inkSoft, boxShadow: `inset 0 0 0 1px ${colors.line}` }
                    }
                  >
                    {nomCourt}
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
                  className="min-h-11 w-24 rounded-[10px] border-0 px-2.5 text-right text-[19px] tabular-nums outline-none placeholder:text-[15px] focus:shadow-[inset_0_0_0_2px_var(--atlas-rust)]"
                  style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.display, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                />
                <span className="text-[16px]" style={{ color: colors.inkSoft }}>
                  €
                </span>
              </span>
            </Rangee>
            {/* **Ce qui manque se voit — sa planche du 31 octobre 2026** : une
                prestation sans mois ou sans prix le dit dans une pastille
                ambre, sous ses mois. Le total restait à zéro sans montrer où
                toucher. */}
            <p className="m-0 mt-2 text-right text-[14px]" style={{ color: colors.inkSoft }}>
              {l.mois.length === 0 ? (
                <EtatEcrit ton="ambre">Aucun mois choisi</EtatEcrit>
              ) : n === 0 ? (
                <EtatEcrit ton="ambre">Aucun de ces mois dans la période</EtatEcrit>
              ) : montant === null ? (
                <EtatEcrit ton="ambre">{`${n} passage${n > 1 ? "s" : ""}, prix à chiffrer`}</EtatEcrit>
              ) : (
                `${n} passage${n > 1 ? "s" : ""}, ${enEuros(montant)} HT`
              )}
            </p>
          </div>
        );
      })}
      </div>
      )}

      {/* L'or sur le trait et sur le dessin, le mot en encre : lisible au
          soleil. Le catalogue monte dans une feuille : déplié dans la page, il
          repoussait la durée et l'envoi de deux écrans. */}
      <button
        type="button"
        onClick={() => setAjoutOuvert(true)}
        className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-0 bg-transparent text-[16px] font-semibold"
        style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.65)}` }}
      >
        <span style={{ color: colors.or }}>
          <IconeTrait nom="plus" taille={19} epaisseur={1.8} />
        </span>
        Ajouter une prestation
      </button>
      {refusFiche && (
        <p className="m-0 mt-1 text-[13.5px]" style={{ color: colors.rust }} role="alert">
          {refusFiche}
        </p>
      )}
      <BottomSheet open={ajoutOuvert} onBackdropClick={() => setAjoutOuvert(false)}>
        <div>
          <h2 className="mb-3 text-[26px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
            Ajouter une prestation
          </h2>
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
              <p className="m-0 mt-5 mb-1 text-[13px] font-semibold uppercase tracking-[0.1em]" style={{ color: colors.or }}>
                {f.famille}
              </p>
              {f.lignes.map((p, i) => (
                <button
                  key={p.libelle}
                  type="button"
                  disabled={pris.has(p.libelle)}
                  onClick={() => ajouter(f.famille, p.libelle)}
                  className={`flex min-h-[52px] w-full items-center justify-between gap-3 border-0 bg-transparent text-left text-[17px] leading-tight ${i > 0 ? "border-t" : ""}`}
                  style={{
                    borderColor: colors.line,
                    color: pris.has(p.libelle) ? colors.inkSoft : colors.ink,
                    fontFamily: font.display,
                  }}
                >
                  {p.libelle}
                  {/* Déjà dans le contrat : la coche verte au lieu du plus. */}
                  <span style={{ color: pris.has(p.libelle) ? colors.carteVertTexte : colors.or }}>
                    <IconeTrait nom={pris.has(p.libelle) ? "coche" : "plus"} taille={22} epaisseur={1.8} />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </BottomSheet>

      <Intitule>Durée</Intitule>
      <div className="rounded-md px-[18px] pt-1 pb-3" style={{ backgroundColor: colors.card }}>
        <Rangee libelle={null} texte="Début">
          <span className="flex gap-1.5">
            <select
              aria-label="Mois de début"
              value={mois}
              onChange={(e) => setDebut(`${annee}-${e.target.value.padStart(2, "0")}-01`)}
              className="min-h-11 rounded-[10px] border-0 px-3 text-[16px]"
              style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
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
              className="min-h-11 rounded-[10px] border-0 px-3 text-[16px]"
              style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
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
        <p className="m-0 mt-1 text-[14.5px]" style={{ color: colors.inkSoft }}>
          {periodeEnLettres(periode)}.
        </p>
        <Rangee libelle={null} texte="Reconduit à la fin">
          <Interrupteur allume={reconduit} basculer={() => setReconduit((r) => !r)} nom="Reconduit à la fin" />
        </Rangee>
      </div>

      <div>
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
          <div className="mt-2.5 rounded-md px-[18px] pt-1 pb-3.5" style={{ backgroundColor: colors.card }}>
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

      {/* **Le TTC en grand, le reste en une ligne** — sa planche du
          31 octobre 2026 : quatre lignes de totaux se lisaient comme une
          facture, pour un seul chiffre qu'il annonce à son client. */}
      <section className="mt-6 rounded-md p-[18px]" style={{ backgroundColor: colors.card }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[18px] leading-tight" style={{ fontFamily: font.display }}>
            Total TTC
          </span>
          <span className="whitespace-nowrap text-[30px] leading-none tabular-nums" style={{ fontFamily: font.display, letterSpacing: "-0.01em" }}>
            {enEuros(totaux.totalTtc)}
          </span>
        </div>
        <p className="m-0 mt-1.5 text-[14.5px] leading-[1.45] tabular-nums" style={{ color: colors.inkSoft }}>
          {totaux.passages} passage{totaux.passages > 1 ? "s" : ""}. {enEuros(totaux.totalHt)} HT et {enEuros(totaux.totalTva)} de TVA
          à {Number(taux).toLocaleString("fr-FR")}&nbsp;%.
        </p>
        <button
          type="button"
          onClick={apercu}
          disabled={enCours || lignes.length === 0}
          className="mt-1.5 inline-flex min-h-12 items-center gap-1.5 border-0 bg-transparent px-1 text-[16px] font-semibold disabled:opacity-45"
          style={{ color: colors.rust }}
        >
          <IconeTrait nom="document" taille={19} epaisseur={1.8} />
          Aperçu du PDF
        </button>
      </section>

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
    <div className="mx-[22px] mt-[18px] pb-6" data-atlas="contrat-parti">
      {/* **Où il en est, dans une pastille** — sa planche du 31 octobre 2026 :
          en attente en ambre, accepté en vert. Un point ET un mot, jamais la
          couleur seule. */}
      <section className="rounded-md p-[18px]" style={{ backgroundColor: colors.card }}>
        <p className="m-0 text-[20px] leading-[1.25]" style={{ fontFamily: font.display }}>
          {etat}
        </p>
        <p className="m-0 mt-2">
          {contrat.statut === "envoye" ? (
            <EtatEcrit ton="ambre">En attente de sa réponse</EtatEcrit>
          ) : contrat.statut === "accepte" ? (
            <span className="text-[14.5px] leading-[1.45]" style={{ color: colors.carteVertTexte }}>
              Ses passages arrivent dans « Sans date » le 20 du mois d&apos;avant.
            </span>
          ) : (
            <EtatEcrit>Rien n&apos;arrive au planning</EtatEcrit>
          )}
        </p>
      </section>
      <section className="mt-3 rounded-md px-[18px] py-1" style={{ backgroundColor: colors.card }}>
        {contrat.prestations.map((p, rang) => {
          const n = passagesDeLaPrestation(p, contrat.periode);
          return (
            <div
              key={p.libelle}
              className={`flex items-baseline justify-between gap-3 py-[13px] ${rang > 0 ? "border-t" : ""}`}
              style={{ borderColor: colors.line }}
            >
              <span className="min-w-0 text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
                {p.libelle}
              </span>
              <span className="flex-none whitespace-nowrap text-[16px]" style={{ color: colors.inkSoft }}>
                {n} passage{n > 1 ? "s" : ""}
              </span>
            </div>
          );
        })}
      </section>
      <section className="mt-3 rounded-md p-[18px]" style={{ backgroundColor: colors.card }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[18px] leading-tight" style={{ fontFamily: font.display }}>
            Total TTC
          </span>
          <span className="whitespace-nowrap text-[30px] leading-none tabular-nums" style={{ fontFamily: font.display, letterSpacing: "-0.01em" }}>
            {enEuros(totaux.totalTtc)}
          </span>
        </div>
        <p className="m-0 mt-1.5 text-[14.5px] leading-[1.45] tabular-nums" style={{ color: colors.inkSoft }}>
          {enEuros(totaux.totalHt)} HT. {periodeEnLettres(contrat.periode)}.
        </p>
      </section>
      <Link
        href={adresseDeLaVisionneuse(`/api/contrats/${contrat.id}/pdf`, { surtitre: "Contrat d'entretien", titre: etat })}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold no-underline"
        style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
      >
        <IconeTrait nom="document" taille={19} epaisseur={1.8} />
        Voir le contrat en PDF
      </Link>
      <button
        type="button"
        onClick={repartir}
        className="mx-auto mt-2.5 flex min-h-12 items-center gap-1.5 border-0 bg-transparent px-1 text-[16px] font-semibold"
        style={{ color: colors.rust }}
      >
        <span style={{ color: colors.or }}>
          <IconeTrait nom="plus" taille={19} epaisseur={1.8} />
        </span>
        Nouveau contrat
      </button>
    </div>
  );
}

/** Le mot de rangement d'une partie, en or comme sur la planche. */
function Intitule({ premier = false, children }: { premier?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`m-0 ${premier ? "mt-1" : "mt-7"} mb-2.5 text-[13px] font-semibold uppercase tracking-[0.12em]`}
      style={{ color: colors.or }}
    >
      {children}
    </p>
  );
}

function Rangee({ libelle, texte, children }: { libelle: string | null; texte?: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 flex min-h-11 items-center justify-between gap-2.5">
      {libelle !== null ? (
        <span className="text-[15px] font-semibold leading-[1.2]" style={{ color: colors.inkSoft }}>
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
  const style = { boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink };
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label={`Un ${p.quoi} de moins`} disabled={p.auPlancher} onClick={p.moins} className="h-11 w-11 rounded-full border-0 bg-transparent text-[20px] disabled:opacity-40" style={style}>
        −
      </button>
      <output className="min-w-8 text-center text-[22px] leading-none" style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums lining-nums" }}>
        {p.valeur}
      </output>
      <button type="button" aria-label={`Un ${p.quoi} de plus`} disabled={p.auPlafond} onClick={p.plus} className="h-11 w-11 rounded-full border-0 bg-transparent text-[20px] disabled:opacity-40" style={style}>
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
