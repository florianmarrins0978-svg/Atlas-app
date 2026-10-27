"use client";

import ChoixEnMots from "@/components/atlas/reglages/ChoixEnMots";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
import FiltreDeDate from "@/components/atlas/FiltreDeDate";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import PlageTon, { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { grouperEnBandes } from "@/lib/bandes-clients";
import { morceauxSurlignes } from "@/lib/recherche-client";
import { titreDeLaPeriode, porteeDeLaPeriode } from "@/lib/periode";
import {
  UNITES_ACHAT,
  ceQuiLaTrouve,
  dateesAMontrer,
  initialesDeLaSociete,
  ligneDeMarge,
  lignesAMontrer,
  lireAdresseMail,
  lireMarge,
  margeQuiVaut,
  phraseDeLaMargePropre,
  resumeDeLaSociete,
  societesAMontrer,
  type RubriqueAchat,
} from "@/lib/prix-achat";
import { detailDeLaLigneLue, rapprocherDuPrix, type LigneDevisLue, type PrixConnu } from "@/lib/devis-fournisseur-lu";
import {
  accepterLignesDuDevisAction,
  ajouterPrixAction,
  creerSocieteAction,
  deposerDevisRecuAction,
  reglerMargeGeneraleAction,
  reglerContactAction,
  reglerMargeSocieteAction,
  retirerPrixAction,
} from "./actions";
import Picto from "@/components/atlas/reglages/Picto";

export type SocieteVue = {
  id: string;
  nom: string;
  marge: string | null;
  email: string | null;
  prix: { id: string; nom: string; reference: string | null; unite: string; prixHt: string; prixAvant: string | null; source: string }[];
  devis: Recu[];
  /** Les factures reçues, sa planche du 23 octobre 2026 (`appli/fournisseur-factures.html`, B). */
  factures: Recu[];
  demandes: { id: string; nom: string; jour: string; envoyeeLe: string; lignes: number }[];
};

type Recu = {
  id: string;
  nom: string;
  jour: string;
  recuLe: string;
  nature: "photo" | "pdf" | "tableur";
  fichierNom: string | null;
  totalTtc: string | null;
};

type Marges = { materiel: string | null; mainOeuvre: string | null };
type Partie = "prix" | "devis" | "factures" | "demandes";

const virgule = (m: string | null) => (m === null ? "" : m.replace(".", ","));

/** Ce qui a été tapé, surligné comme dans la liste des clients. */
function Surligne({ texte, saisie }: { texte: string; saisie: string }) {
  return (
    <>
      {morceauxSurlignes(texte, saisie).map((m, i) =>
        m.trouve ? (
          <mark key={i} style={{ backgroundColor: voile(colors.or, 0.3), color: "inherit", borderRadius: 3 }}>
            {m.texte}
          </mark>
        ) : (
          <span key={i}>{m.texte}</span>
        )
      )}
    </>
  );
}

/** Le filet au-dessus d'une ligne : un trait droit, posé, qui ne suit aucun arrondi. */
function Filet({ depuis = 0 }: { depuis?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 h-px"
      style={{ left: depuis, backgroundColor: colors.line }}
    />
  );
}

/**
 * Les lignes d'une liste rangée, sous leur lettre en serif, comme les clients ;
 * aucune lettre pendant une recherche.
 */
function EnBandes<T extends { id: string; nom: string }>({
  lignes,
  saisie,
  ligne,
}: {
  lignes: T[];
  saisie: string;
  ligne: (l: T) => React.ReactNode;
}) {
  const cherche = saisie.trim().length > 0;
  return (
    <>
      {grouperEnBandes(lignes).map((g, iBande) => (
        <div key={g.bande + iBande} className="relative">
          {iBande > 0 && <Filet />}
          {!cherche && (
            <p className="pb-[2px] pt-3.5 text-[17px] leading-none" style={{ fontFamily: font.display, color: colors.inkSoft }}>
              {g.bande}
            </p>
          )}
          {g.clients.map((l, i) => (
            <div key={l.id} className="relative">
              {i > 0 && <Filet />}
              {ligne(l)}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}


/**
 * La marge, sur sa bande dorée : le mot, le signe × devant la case, et sous
 * eux la faute de frappe ou ce que la marge vaut. L'or est la couleur d'un
 * chiffre à retenir (`PlageTon`).
 */
function BandeDeMarge({
  libelle,
  valeur,
  onChange,
  onQuitter,
  ariaLabel,
  dataAtlas,
  alerte,
  alerteAtlas,
  phrase,
  className,
}: {
  libelle: string;
  valeur: string;
  onChange: (valeur: string) => void;
  onQuitter: (valeur: string) => void;
  ariaLabel: string;
  dataAtlas: string;
  alerte: string | null;
  alerteAtlas?: string;
  phrase?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <PlageTon ton="or">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5">
          <label htmlFor={id} className="text-[16px] font-semibold leading-[1.3]" style={{ color: colors.ink }}>
            {libelle}
          </label>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="text-[22px] leading-none" style={{ fontFamily: font.display, color: colors.inkSoft }}>
              ×
            </span>
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              value={valeur}
              onChange={(e) => onChange(e.target.value)}
              onBlur={(e) => onQuitter(e.currentTarget.value)}
              aria-label={ariaLabel}
              data-atlas={dataAtlas}
              // Le trait doré dit où l'on tape : il remplace l'anneau noir du
              // navigateur, sans le retirer à qui navigue au clavier.
              className="h-[50px] w-[82px] rounded-[10px] border-0 px-3 text-right text-[20px] focus:outline-2 focus:-outline-offset-2"
              style={{
                backgroundColor: colors.card,
                color: colors.ink,
                fontFamily: font.display,
                fontVariantNumeric: "tabular-nums lining-nums",
                boxShadow: `inset 0 0 0 1px ${colors.line}`,
                outlineColor: colors.or,
              }}
            />
          </span>
          {alerte && (
            <p className="col-span-2 mt-1.5 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.alert }} data-atlas={alerteAtlas}>
              {alerte}
            </p>
          )}
          {phrase && (
            <p className="col-span-2 mt-1 text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
              {phrase}
            </p>
          )}
        </div>
      </PlageTon>
    </div>
  );
}

/** Le chevron doré du sommaire : la ligne entière s'ouvre. */
function Chevron() {
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 flex-none rotate-45"
      style={{ borderRight: `1.5px solid ${colors.or}`, borderTop: `1.5px solid ${colors.or}` }}
    />
  );
}

/** Une phrase seule au milieu de la liste : rien à montrer, et pourquoi. */
function Rien({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-[22px] text-center text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
      {children}
    </p>
  );
}

const plageListe = "mt-2.5 rounded-[6px] px-4 py-[2px]";
const caseSaisie = "min-h-[52px] min-w-0 rounded-[6px] border-0 px-[15px] py-3 text-[16px] focus:outline-2 focus:-outline-offset-2";
const styleCase = {
  backgroundColor: colors.card,
  color: colors.ink,
  boxShadow: `inset 0 0 0 1px ${colors.lineSoft}`,
  outlineColor: colors.rust,
};
const boutonCreux = "flex min-h-[52px] items-center justify-center gap-2.5 rounded-full px-5 text-[17px] font-semibold";
const styleCreux = { color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` };
const boutonPlein =
  "atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-[22px] text-[17px] font-semibold disabled:opacity-50";
const stylePlein = { backgroundColor: colors.plein, color: surPlein };

/**
 * « CE QUE JE PAIE » — sa planche du 18 et du 19 octobre 2026, au mot et à la
 * place près (`appli/reglages-fournisseurs-partenaires.html`).
 *
 * **La recherche et le rangement sont ceux de la liste des clients**
 * (`ChampRecherche`, `filtrerClientsParNom`, `rangerParNom`, `lettreDuClient`),
 * sa demande du 19 octobre : *« reprends le filtre qu'on utilise, triés par
 * ordre alphabétique comme pour nos clients »*. Le filtre de date est
 * `FiltreDeDate`, **aucun bouton de filtre**.
 *
 * **La planche soignée du 26 octobre 2026** (`appli/soignee/reglages-fournisseurs.html`)
 * garde tout cela et déplace un seul geste : **la marge passe en tête**, sur
 * une bande dorée. Sous la liste, elle descendait hors de l'écran dès une
 * dizaine de fournisseurs. Chaque société prend ses initiales et sa marge en
 * pastille ; la recherche se cache tant qu'il n'y a personne à chercher.
 *
 * **La planche portait aussi « Je dicte »** : c'était la démonstration du
 * devis qui prend ses prix ici. Dans l'application, ce devis est celui qu'il
 * dicte déjà (`proposition-prix.ts`) ; l'écran des réglages ne le refait pas.
 */
export default function FournisseursPartenaires({
  fournisseurs,
  partenaires,
  marges,
  mois,
}: {
  fournisseurs: SocieteVue[];
  partenaires: SocieteVue[];
  marges: Marges;
  /** Le mois en cours, posé au serveur : l'horloge du téléphone peut différer. */
  mois: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [rubrique, setRubrique] = useState<RubriqueAchat>("fournisseur");
  const [saisie, setSaisie] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [margeTapee, setMargeTapee] = useState<Record<"materiel" | "mainOeuvre", string>>({
    materiel: virgule(marges.materiel),
    mainOeuvre: virgule(marges.mainOeuvre),
  });
  const [ouverte, setOuverte] = useState<string | null>(null);

  const societes = rubrique === "fournisseur" ? fournisseurs : partenaires;
  const laquelle = rubrique === "fournisseur" ? "materiel" : "mainOeuvre";
  const generale = marges[laquelle];
  const cherchables = useMemo(
    () =>
      societes.map((s) => ({
        ...s,
        contenu: [...s.prix.map((p) => p.nom), ...s.devis.map((d) => d.nom), ...s.factures.map((d) => d.nom), ...s.demandes.map((d) => d.nom)],
      })),
    [societes]
  );
  const montrees = useMemo(() => societesAMontrer(cherchables, saisie), [cherchables, saisie]);
  const fiche = societes.find((s) => s.id === ouverte) ?? null;

  // La faute de frappe se dit pendant qu'il tape, avant même de quitter la case.
  const lueGenerale = lireMarge(margeTapee[laquelle]);

  const enregistrerGenerale = (valeur: string) => {
    if (!lireMarge(valeur).ok) return;
    demarrer(async () => {
      const r = await reglerMargeGeneraleAction(laquelle, valeur);
      if (!r.ok) setRefus(r.raison);
      else {
        setRefus(null);
        router.refresh();
      }
    });
  };

  const ajouterSociete = () => {
    const nom = nouveau.trim();
    if (!nom) return;
    demarrer(async () => {
      const r = await creerSocieteAction(rubrique, nom);
      if (!r.ok) setRefus(r.raison);
      else {
        setRefus(null);
        setNouveau("");
        router.refresh();
      }
    });
  };

  return (
    <div className="px-[22px]" data-atlas="fournisseurs-partenaires">
      <ChoixEnMots
        className="mt-[18px]"
        libelle="Rubrique"
        options={[
          { valeur: "fournisseur", libelle: "Mes fournisseurs", dataAtlas: "rubrique-fournisseur" },
          { valeur: "partenaire", libelle: "Mes partenaires", dataAtlas: "rubrique-partenaire" },
        ]}
        valeur={rubrique}
        onChoix={(r) => {
          setRubrique(r);
          setSaisie("");
        }}
      />

      {/* Une marge par onglet, sa remarque du 19 octobre 2026 : le matériel chez
          les fournisseurs, la main d'œuvre chez les partenaires. Sous elle, plus
          de texte gris (« retire le texte grisé ») : seule la faute de frappe. */}
      <BandeDeMarge
        className="mt-3.5"
        libelle={rubrique === "fournisseur" ? "Ma marge sur le matériel" : "Ma marge sur la main d’œuvre"}
        valeur={margeTapee[laquelle]}
        onChange={(v) => setMargeTapee({ ...margeTapee, [laquelle]: v })}
        onQuitter={enregistrerGenerale}
        ariaLabel={rubrique === "fournisseur" ? "Marge sur le matériel" : "Marge sur la main d’œuvre"}
        dataAtlas="marge-generale"
        alerte={lueGenerale.ok ? null : lueGenerale.raison}
        alerteAtlas="conseil-marge"
      />

      {/* Personne à chercher sur un compte neuf : la recherche attend la première société. */}
      {societes.length > 0 && (
        <div className="sticky top-0 z-[5] -mx-[22px] px-[22px] pb-1 pt-2.5" style={{ backgroundColor: colors.cream }}>
          <ChampRecherche
            valeur={saisie}
            onChange={setSaisie}
            placeholder={rubrique === "fournisseur" ? "Chercher un fournisseur" : "Chercher un partenaire"}
            ariaLabel="Chercher"
            dataAtlas="chercher-societe"
          />
        </div>
      )}

      <div data-atlas="societes">
        {societes.length === 0 ? (
          <div className="mt-3.5 rounded-[6px] px-[18px] pb-[22px] pt-[26px] text-center" style={{ backgroundColor: colors.card }}>
            <span className="mx-auto mb-2.5 flex w-fit" style={{ color: colors.or }}>
              <Picto nom="carton" taille={36} epaisseur={1.5} />
            </span>
            <p className="mx-auto max-w-[18em] text-[15.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
              {rubrique === "fournisseur"
                ? "Aucun fournisseur. Ajoutez la société chez qui vous achetez."
                : "Aucun partenaire. Ajoutez la société avec qui vous travaillez."}
            </p>
          </div>
        ) : montrees.length === 0 ? (
          <Rien>
            {rubrique === "fournisseur" ? "Aucun fournisseur" : "Aucun partenaire"} ne s’appelle « {saisie.trim()} ».
          </Rien>
        ) : (
          <div className={plageListe} style={{ backgroundColor: colors.card }}>
            <EnBandes
              lignes={montrees}
              saisie={saisie}
              ligne={(s) => {
                const aussi = ceQuiLaTrouve(s, saisie);
                const aDonner = margeQuiVaut(s.marge, generale) === null;
                return (
                  <button
                    type="button"
                    data-atlas="societe"
                    onClick={() => setOuverte(s.id)}
                    className="flex min-h-[76px] w-full items-center gap-3 pb-3 pt-2.5 text-left"
                  >
                    {/* Ses initiales, comme un client : on reconnaît la société avant de lire son nom. */}
                    <span
                      aria-hidden
                      className="grid h-11 w-11 flex-none place-items-center rounded-full text-[17px] leading-none"
                      style={{ fontFamily: font.display, backgroundColor: colors.rustTint, color: colors.rust }}
                    >
                      {initialesDeLaSociete(s.nom)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-[18.5px] leading-[1.25] [overflow-wrap:anywhere]"
                        style={{ fontFamily: font.display, color: colors.ink }}
                      >
                        <Surligne texte={s.nom} saisie={saisie} />
                      </span>
                      <span className="mt-0.5 block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                        {aussi.length > 0
                          ? aussi.map((t, i) => (
                              <span key={i}>
                                {i > 0 && ", "}
                                <Surligne texte={t} saisie={saisie} />
                              </span>
                            ))
                          : resumeDeLaSociete({ prix: s.prix.length, devis: s.devis.length, demandes: s.demandes.length })}
                      </span>
                      {/* Sa marge en pastille dorée ; celle qui manque en ambre, ce qui reste à faire. */}
                      <span className="mt-[7px] block">
                        <PastilleDeMarge aDonner={aDonner}>{ligneDeMarge(s.marge, generale)}</PastilleDeMarge>
                      </span>
                    </span>
                    <Chevron />
                  </button>
                );
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2.5">
        <input
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          placeholder={rubrique === "fournisseur" ? "Un autre fournisseur" : "Une société partenaire"}
          aria-label="Nom"
          autoComplete="off"
          data-atlas="nom-nouvelle-societe"
          className={`flex-1 ${caseSaisie}`}
          style={styleCase}
        />
        <button
          type="button"
          onClick={ajouterSociete}
          disabled={enCours}
          data-atlas="ajouter-societe"
          className={`flex-none ${boutonCreux}`}
          style={styleCreux}
        >
          Ajouter
        </button>
      </div>

      {refus && (
        <p className="mx-[2px] mt-2 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.alert }} data-atlas="refus-fournisseurs">
          {refus}
        </p>
      )}

      {fiche && (
        <Fiche
          key={fiche.id}
          societe={fiche}
          rubrique={rubrique}
          generale={generale}
          mois={mois}
          onFermer={() => setOuverte(null)}
        />
      )}
    </div>
  );
}

/** La marge d'une société, en pastille : un point ET un mot, jamais la couleur seule. */
function PastilleDeMarge({ aDonner, children }: { aDonner: boolean; children: React.ReactNode }) {
  const ambre = teintesDuTon("ambre");
  return (
    <span
      data-atlas="marge-societe"
      className="inline-flex min-h-[28px] items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] text-[13.5px] font-semibold leading-none"
      style={
        aDonner
          ? { backgroundColor: ambre.fond, color: ambre.texte }
          : { color: colors.or, boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.6)}` }
      }
    >
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: aDonner ? ambre.texte : colors.or }} />
      {children}
    </span>
  );
}

/**
 * La fiche d'un fournisseur ou d'un partenaire : sa marge et son adresse en
 * tête (planche soignée du 26 octobre 2026), puis ses prix, ses devis, ses
 * factures, mes demandes.
 */
function Fiche({
  societe,
  rubrique,
  generale,
  mois,
  onFermer,
}: {
  societe: SocieteVue;
  rubrique: RubriqueAchat;
  generale: string | null;
  mois: string;
  onFermer: () => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  // La lecture d'un document a sa propre attente : régler la marge pendant
  // ce temps n'affiche pas « Atlas lit le devis », et l'inverse non plus.
  const [lectureEnCours, demarrerLecture] = useTransition();
  const [partie, setPartie] = useState<Partie>("prix");
  const [saisie, setSaisie] = useState("");
  const [periode, setPeriode] = useState(mois);
  const [margeTapee, setMargeTapee] = useState(virgule(societe.marge));
  const [alerteMarge, setAlerteMarge] = useState<string | null>(null);
  const [adresse, setAdresse] = useState(societe.email ?? "");
  const [alerteAdresse, setAlerteAdresse] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [article, setArticle] = useState({ nom: "", unite: UNITES_ACHAT[rubrique][0], prix: "" });
  const [nomDevis, setNomDevis] = useState("");
  const [vu, setVu] = useState<string | null>(null);
  const [lu, setLu] = useState<{
    devisId: string;
    lignes: LigneDevisLue[];
    ecartees: number;
    totalHt: string | null;
    totalTtc: string | null;
    gardees: boolean[];
  } | null>(null);
  const [luRien, setLuRien] = useState(false);
  const appareil = useRef<HTMLInputElement>(null);
  const fichiers = useRef<HTMLInputElement>(null);
  const idAdresse = useId();

  // **Retirer un prix d'achat se rattrape, comme un tarif** (planche soignée du
  // 26 octobre 2026) : il partait sans retour. Le prix tapé à la main ne se
  // reconstitue pas, et c'est lui qui chiffre le devis dicté après ses tarifs.
  // La mécanique est celle de tous les écrans qui retirent (`useRetraits`) :
  // rien n'est écrit tant que le tiroir est ouvert.
  const retraits = useRetraits({
    valider: async (id) => {
      const r = await retirerPrixAction(id);
      return r.ok ? { succes: true } : { succes: false, erreur: r.raison };
    },
  });

  const apres = (r: { ok: true } | { ok: false; raison: string }) => {
    if (!r.ok) setRefus(r.raison);
    else {
      setRefus(null);
      router.refresh();
    }
  };

  const enregistrerMarge = (valeur: string) => {
    const l = lireMarge(valeur);
    if (!l.ok) {
      setAlerteMarge(l.raison);
      return;
    }
    setAlerteMarge(null);
    demarrer(async () => {
      const r = await reglerMargeSocieteAction(societe.id, valeur);
      if (!r.ok) setAlerteMarge(r.raison);
      else router.refresh();
    });
  };

  const enregistrerAdresse = (valeur: string) => {
    const l = lireAdresseMail(valeur);
    if (!l.ok) {
      setAlerteAdresse(l.raison);
      return;
    }
    setAlerteAdresse(null);
    if (l.email === societe.email) return;
    demarrer(async () => {
      const r = await reglerContactAction(societe.id, { email: valeur });
      if (!r.ok) setAlerteAdresse(r.raison);
      else router.refresh();
    });
  };

  const deposer = (f: File | undefined) => {
    if (!f) return;
    const donnees = new FormData();
    donnees.set("fichier", f);
    donnees.set("societeId", societe.id);
    donnees.set("nom", nomDevis);
    donnees.set("genre", partie === "factures" ? "facture" : "devis");
    setLuRien(false);
    demarrerLecture(async () => {
      const r = await deposerDevisRecuAction(donnees);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setRefus(null);
      setNomDevis("");
      if (r.lu && r.lu.lignes.length > 0) setLu({ devisId: r.devisId, ...r.lu, gardees: r.lu.lignes.map(() => true) });
      else setLuRien(true);
      router.refresh();
    });
  };

  const champ = (ref: React.RefObject<HTMLInputElement | null>, accept: string, capture?: "environment") => (
    <input
      ref={ref}
      type="file"
      accept={accept}
      capture={capture}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        deposer(f);
      }}
    />
  );

  const vide = (quoi: string) => (
    <Rien>
      {quoi} ne s’appelle « {saisie.trim()} ».
    </Rien>
  );
  const enLettres = (p: string) =>
    porteeDeLaPeriode(p) === "jour" ? `le ${titreDeLaPeriode(p).toLowerCase()}` : `en ${titreDeLaPeriode(p).toLowerCase()}`;

  const restants = societe.prix.filter((p) => !retraits.estRetire(p.id));
  const prix = lignesAMontrer(restants, saisie);
  const facture = partie === "factures";
  const tousRecus = facture ? societe.factures : societe.devis;
  const recus = dateesAMontrer(tousRecus, { saisie, periode });
  const demandes = dateesAMontrer(societe.demandes, { saisie, periode });

  return (
    <BottomSheet open onBackdropClick={onFermer}>
      <div data-atlas="fiche-societe" className="min-h-[70svh]">
        <div className="mt-1 flex items-center gap-3">
          <h2 className="min-w-0 flex-1 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
            {societe.nom}
          </h2>
          <button type="button" onClick={onFermer} className="min-h-[44px] flex-none text-[16px] font-semibold" style={{ color: colors.rust }}>
            Fermer
          </button>
        </div>

        {/* Sa marge, en tête de sa fiche : la générale tant qu'on n'en donne pas d'autre. */}
        <BandeDeMarge
          className="mt-3.5"
          libelle={`Ma marge chez ${societe.nom}`}
          valeur={margeTapee}
          onChange={setMargeTapee}
          onQuitter={enregistrerMarge}
          ariaLabel={`Marge chez ${societe.nom}`}
          dataAtlas="marge-propre"
          alerte={alerteMarge}
          phrase={phraseDeLaMargePropre(societe.marge, generale)}
        />

        {/* Où part sa liste du plan d'arrosage : sa planche du 20 octobre 2026. */}
        {rubrique === "fournisseur" && (
          <div className="mt-2.5 overflow-hidden rounded-[6px] px-4" style={{ backgroundColor: colors.card }}>
            <LigneReglage libelle="Adresse mail" htmlFor={idAdresse}>
              <input
                id={idAdresse}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                onBlur={(e) => enregistrerAdresse(e.currentTarget.value)}
                placeholder="commande@…"
                aria-label={`Adresse mail de ${societe.nom}`}
                data-atlas="adresse-mail"
                style={styleValeurReglage}
              />
              {alerteAdresse && (
                <p className="mt-1 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.alert }} data-atlas="refus-adresse">
                  {alerteAdresse}
                </p>
              )}
            </LigneReglage>
          </div>
        )}

        <ChoixEnMots
          className="mt-4"
          libelle="Partie de la fiche"
          options={[
            { valeur: "prix", libelle: "Prix", dataAtlas: "partie-prix" },
            { valeur: "devis", libelle: "Devis", dataAtlas: "partie-devis" },
            { valeur: "factures", libelle: "Factures", dataAtlas: "partie-factures" },
            { valeur: "demandes", libelle: "Demandes", dataAtlas: "partie-demandes" },
          ]}
          valeur={partie}
          onChoix={(p) => {
            setPartie(p);
            setSaisie("");
            // Ce qui a été lu sur un devis ne s'affiche pas sous les factures.
            setLu(null);
            setLuRien(false);
            setVu(null);
          }}
        />

        {partie !== "prix" && (
          <div className="-mx-[22px] mt-2">
            <FiltreDeDate periode={periode} choisir={setPeriode} />
          </div>
        )}

        <ChampRecherche
          valeur={saisie}
          onChange={setSaisie}
          placeholder={
            partie === "prix"
              ? rubrique === "fournisseur"
                ? "Chercher une fourniture"
                : "Chercher une prestation"
              : partie === "devis"
                ? "Chercher un devis"
                : partie === "factures"
                  ? "Chercher une facture"
                  : "Chercher une demande"
          }
          ariaLabel="Chercher dans la fiche"
          dataAtlas="chercher-fiche"
          className="mt-2.5"
        />

        {partie === "prix" && (
          <>
            {restants.length === 0 ? (
              <Rien>
                {rubrique === "fournisseur"
                  ? "Aucune fourniture encore. Ajoutez-en, ou prenez un de ses devis en photo."
                  : "Aucun prix de main d’œuvre encore."}
              </Rien>
            ) : prix.length === 0 ? (
              vide(rubrique === "fournisseur" ? "Aucune fourniture" : "Aucune prestation")
            ) : (
              <div className={plageListe} style={{ backgroundColor: colors.card }}>
                <EnBandes
                  lignes={prix}
                  saisie={saisie}
                  ligne={(p) => {
                    const libelle = `le prix « ${p.nom} »`;
                    const refusRetrait = retraits.refuses[p.id];
                    return (
                      <div className="flex items-start gap-3 py-3" data-atlas="prix-achat">
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-[17.5px] leading-[1.3] [overflow-wrap:anywhere]"
                            style={{ fontFamily: font.display, color: colors.ink }}
                          >
                            <Surligne texte={p.nom} saisie={saisie} />
                          </span>
                          <small className="mt-[3px] block text-[13.5px] leading-[1.35]" style={{ color: colors.inkSoft }}>
                            {p.source}
                          </small>
                          {refusRetrait && (
                            <small role="alert" className="mt-1 block text-[13.5px] font-semibold leading-[1.35]" style={{ color: colors.alert }}>
                              {refusRetrait}
                            </small>
                          )}
                        </span>
                        {/* « 8,00 € par sac », l'ancien barré devant : l'écriture de Mes tarifs. */}
                        <span className="flex flex-none flex-col items-end text-right">
                          <span
                            className="whitespace-nowrap text-[16.5px] font-bold leading-[1.25]"
                            style={{ color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
                          >
                            {p.prixAvant && (
                              <s className="mr-1.5 text-[14px] font-normal" style={{ color: colors.inkSoft }} data-atlas="prix-avant">
                                {enEuros(p.prixAvant)}
                              </s>
                            )}
                            {enEuros(p.prixHt)}
                          </span>
                          <small className="mt-0.5 whitespace-nowrap text-[14px]" style={{ color: colors.inkSoft }}>
                            par {p.unite}
                          </small>
                          <button
                            type="button"
                            onClick={() => retraits.retirer(p.id, libelle)}
                            aria-label={`Retirer ${libelle}`}
                            className="mt-0.5 min-h-[40px] pl-2.5 text-[15px] font-semibold"
                            style={{ color: colors.alert }}
                          >
                            Retirer
                          </button>
                        </span>
                      </div>
                    );
                  }}
                />
              </div>
            )}
            <TiroirDesRetires
              dernier={retraits.dernier}
              nombre={retraits.nombre}
              onAnnuler={retraits.annuler}
              // `mx-0!` : le tiroir porte la marge des écrans pleine largeur ;
              // dans la feuille, il s'aligne sur la liste qu'il commente.
              className="mt-3 mx-0!"
            />
            <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_96px_92px] gap-2">
              <input
                value={article.nom}
                onChange={(e) => setArticle({ ...article, nom: e.target.value })}
                placeholder={rubrique === "fournisseur" ? "Fourniture" : "Prestation"}
                aria-label="Nom"
                autoComplete="off"
                data-atlas="article-nom"
                className={`${caseSaisie} px-3`}
                style={styleCase}
              />
              <select
                value={article.unite}
                onChange={(e) => setArticle({ ...article, unite: e.target.value })}
                aria-label="Unité"
                className={`${caseSaisie} px-3`}
                style={styleCase}
              >
                {UNITES_ACHAT[rubrique].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <input
                value={article.prix}
                onChange={(e) => setArticle({ ...article, prix: e.target.value })}
                inputMode="decimal"
                placeholder="Prix HT"
                aria-label="Prix HT"
                autoComplete="off"
                data-atlas="article-prix"
                className={`${caseSaisie} px-3 text-right`}
                style={styleCase}
              />
            </div>
            <button
              type="button"
              disabled={enCours}
              data-atlas="ajouter-prix"
              onClick={() =>
                demarrer(async () => {
                  const r = await ajouterPrixAction(societe.id, article);
                  apres(r);
                  if (r.ok) setArticle({ nom: "", unite: article.unite, prix: "" });
                })
              }
              className={`mt-2.5 w-full ${boutonCreux}`}
              style={styleCreux}
            >
              Ajouter ce prix
            </button>
          </>
        )}

        {(partie === "devis" || facture) && (
          <>
            {champ(appareil, "image/jpeg,image/png", "environment")}
            {champ(fichiers, "application/pdf,image/jpeg,image/png,.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            {/* **Un seul bouton plein à la fois** (planche soignée du 26 octobre
                2026) : tant qu'Atlas lit, puis tant que sa lecture attend une
                réponse, les gestes de photo s'effacent devant « Ajouter ces
                prix ». */}
            {!lectureEnCours && !lu && (
              <>
                {/* Un nom pour le document : c'est lui qui le range de A à Z et le fait trouver. */}
                <input
                  value={nomDevis}
                  onChange={(e) => setNomDevis(e.target.value)}
                  placeholder={facture ? "Nom de la facture, chantier ou client" : "Nom du devis, chantier ou client"}
                  aria-label={facture ? "Nom de la facture" : "Nom du devis"}
                  autoComplete="off"
                  data-atlas={facture ? "nom-facture" : "nom-devis"}
                  className={`mt-3 block w-full ${caseSaisie}`}
                  style={styleCase}
                />
                <div className="mt-2.5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => appareil.current?.click()}
                    data-atlas={facture ? "photo-facture" : "photo-devis"}
                    className={boutonPlein}
                    style={stylePlein}
                  >
                    <Picto nom="photo" />
                    {facture ? "Prendre une facture en photo" : "Prendre un devis en photo"}
                  </button>
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => fichiers.current?.click()}
                    data-atlas={facture ? "fichier-facture" : "fichier-devis"}
                    className={`w-full ${boutonCreux}`}
                    style={styleCreux}
                  >
                    <Picto nom="document" />
                    PDF, photo ou Excel
                  </button>
                </div>
              </>
            )}

            {lectureEnCours && (
              <p className="mx-[2px] mt-3.5 flex items-center gap-2.5 text-[15px]" style={{ color: colors.inkSoft }} data-atlas="lecture-devis">
                <span style={{ color: colors.or }}>
                  <PointsQuiSoufflent />
                </span>
                {facture ? "Atlas lit la facture" : "Atlas lit le devis"}
              </p>
            )}
            {luRien && (
              <p className="mx-[2px] mt-3 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                {facture ? "Facture gardée." : "Devis gardé."} Atlas n’a pas pu en lire les prix : tapez-les dans « Prix ».
              </p>
            )}
            {lu && (
              <LuSurLeDevis
                lu={lu}
                facture={facture ? { connus: societe.prix, rubrique } : null}
                enCours={enCours}
                cocher={(i) => setLu({ ...lu, gardees: lu.gardees.map((g, k) => (k === i ? !g : g)) })}
                prendre={() =>
                  demarrer(async () => {
                    const r = await accepterLignesDuDevisAction(
                      lu.devisId,
                      lu.lignes.filter((_, i) => lu.gardees[i])
                    );
                    if (r.ok) setLu(null);
                    apres(r.ok ? { ok: true } : r);
                  })
                }
                laisser={() => setLu(null)}
              />
            )}

            {tousRecus.length === 0 ? (
              <Rien>
                {facture ? "Aucune facture reçue" : "Aucun devis reçu"} de {societe.nom}.
              </Rien>
            ) : recus.length === 0 ? (
              saisie.trim() ? (
                vide(facture ? "Aucune facture" : "Aucun devis")
              ) : (
                <Rien>
                  {facture ? "Aucune facture reçue" : "Aucun devis reçu"} {enLettres(periode)}.
                </Rien>
              )
            ) : (
              <div className={plageListe} style={{ backgroundColor: colors.card }}>
                <EnBandes
                  lignes={recus}
                  saisie={saisie}
                  ligne={(d) => (
                    <div className="flex min-h-[66px] items-center gap-3 py-2.5" data-atlas={facture ? "facture-recue" : "devis-recu"}>
                      {d.nature === "photo" ? (
                        <Image
                          src={`/reglages/fournisseurs/devis/${d.id}`}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="h-11 w-11 flex-none rounded-[6px] object-cover"
                        />
                      ) : (
                        <PastilleIcone>
                          <Picto nom="document" taille={22} />
                        </PastilleIcone>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17.5px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
                          <Surligne texte={d.nom} saisie={saisie} />
                        </span>
                        <small className="mt-0.5 block text-[14px] leading-[1.35]" style={{ color: colors.inkSoft }}>
                          {facture
                            ? `Reçue le ${d.recuLe}${d.totalTtc ? `, ${enEuros(d.totalTtc)} TTC` : ""}`
                            : `Reçu le ${d.recuLe}, ${d.nature === "photo" ? "Photo" : d.fichierNom ?? "PDF"}`}
                        </small>
                      </span>
                      {d.nature === "photo" ? (
                        <button
                          type="button"
                          onClick={() => setVu(vu === d.id ? null : d.id)}
                          className="min-h-[44px] flex-none pl-2 text-[15.5px] font-semibold"
                          style={{ color: colors.or }}
                        >
                          Voir
                        </button>
                      ) : (
                        <a
                          href={`/reglages/fournisseurs/devis/${d.id}`}
                          target="_blank"
                          rel="noopener"
                          className="flex min-h-[44px] flex-none items-center pl-2 text-[15.5px] font-semibold"
                          style={{ color: colors.or }}
                        >
                          Voir
                        </a>
                      )}
                    </div>
                  )}
                />
              </div>
            )}
            {vu && (
              <div className="mt-3 overflow-hidden rounded-[6px]" style={{ backgroundColor: colors.card }}>
                <Image src={`/reglages/fournisseurs/devis/${vu}`} alt={facture ? "La facture" : "Le devis"} width={860} height={680} unoptimized className="block h-auto max-h-[340px] w-full bg-white object-contain" />
              </div>
            )}
          </>
        )}

        {partie === "demandes" &&
          (societe.demandes.length === 0 ? (
            <Rien>
              Aucune demande envoyée à {societe.nom}. Les listes que vous lui envoyez depuis un devis ou le plan d’arrosage s’enregistrent ici, avec leur date.
            </Rien>
          ) : demandes.length === 0 ? (
            saisie.trim() ? (
              vide("Aucune demande")
            ) : (
              <Rien>Aucune demande envoyée {enLettres(periode)}.</Rien>
            )
          ) : (
            <div className={plageListe} style={{ backgroundColor: colors.card }}>
              <EnBandes
                lignes={demandes}
                saisie={saisie}
                ligne={(d) => (
                  <div className="flex min-h-[66px] items-center gap-3 py-2.5" data-atlas="demande-envoyee">
                    <PastilleIcone>
                      <Picto nom="envoyer" taille={22} />
                    </PastilleIcone>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17.5px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
                        <Surligne texte={d.nom} saisie={saisie} />
                      </span>
                      <small className="mt-0.5 block text-[14px] leading-[1.35]" style={{ color: colors.inkSoft }}>
                        Envoyée le {d.envoyeeLe}, {d.lignes} ligne{d.lignes > 1 ? "s" : ""}
                      </small>
                    </span>
                  </div>
                )}
              />
            </div>
          ))}

        {refus && (
          <p className="mx-[2px] mt-3 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.alert }} data-atlas="refus-fiche">
            {refus}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

/**
 * Ce qu'Atlas a lu sur le devis, **rien n'est enregistré avant son appui**,
 * comme `ImportTarifs.tsx`. Chaque ligne se décoche d'un rond doré ; une hausse
 * se dit en rouge, l'ancien prix barré dessous.
 */
function LuSurLeDevis({
  lu,
  facture,
  enCours,
  cocher,
  prendre,
  laisser,
}: {
  lu: { lignes: LigneDevisLue[]; ecartees: number; totalHt: string | null; totalTtc: string | null; gardees: boolean[] };
  /** Une facture se confronte à ses prix : l'ancien montré barré, la hausse en couleur. */
  facture: { connus: PrixConnu[]; rubrique: RubriqueAchat } | null;
  enCours: boolean;
  cocher: (i: number) => void;
  prendre: () => void;
  laisser: () => void;
}) {
  const n = lu.gardees.filter(Boolean).length;
  return (
    <div className="mt-3 rounded-[6px] px-4 pb-3 pt-1" style={{ backgroundColor: colors.card }} data-atlas="lu-sur-le-devis">
      {lu.lignes.map((l, i) => {
        const r = facture ? rapprocherDuPrix(l, facture.connus) : null;
        const detail = facture && r ? detailDeLaLigneLue(l.reference, r, facture.rubrique) : l.reference ? `réf. ${l.reference}` : null;
        const hausse = r?.etat === "plus cher";
        return (
          <button
            key={i}
            type="button"
            aria-pressed={lu.gardees[i]}
            onClick={() => cocher(i)}
            className="relative flex min-h-[62px] w-full items-center gap-3 py-2.5 text-left"
          >
            {i > 0 && <Filet depuis={34} />}
            <CocheRonde pris={lu.gardees[i]} />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
                {l.designation}
              </span>
              {detail && (
                <small
                  className="mt-0.5 block text-[13.5px]"
                  style={hausse ? { color: colors.carteRougeTexte, fontWeight: 600 } : { color: colors.inkSoft }}
                >
                  {detail}
                </small>
              )}
            </span>
            <span
              className="flex-none whitespace-nowrap text-right text-[16px] font-bold"
              style={{ color: hausse ? colors.carteRougeTexte : colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              {enEuros(l.prixHt)} par {l.unite}
              {r && (r.etat === "plus cher" || r.etat === "moins cher") && (
                <s className="block text-[13.5px] font-normal" style={{ color: colors.inkSoft }}>
                  {enEuros(r.ancien.prixHt)}
                </s>
              )}
            </span>
          </button>
        );
      })}
      {lu.ecartees > 0 && (
        <p className="relative mt-1 pt-2 text-[14px] font-semibold" style={{ color: colors.carteAmbreTexte }}>
          <Filet />
          {lu.ecartees} ligne{lu.ecartees > 1 ? "s" : ""} sans prix lisible, à taper.
        </p>
      )}
      {facture && (lu.totalHt || lu.totalTtc) && (
        <p
          className="relative mt-2 flex flex-wrap justify-between gap-x-3 gap-y-0.5 pt-2.5 text-[14.5px]"
          style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}
          data-atlas="total-facture"
        >
          <Filet />
          <span>Total de la facture</span>
          <span className="ml-auto whitespace-nowrap text-right font-semibold" style={{ color: colors.ink }}>
            {[lu.totalHt && `${enEuros(lu.totalHt)} HT`, lu.totalTtc && `${enEuros(lu.totalTtc)} TTC`].filter(Boolean).join(", ")}
          </span>
        </p>
      )}
      {/* « Ajouter ces 3 prix » et non plus « Mettre 3 prix dans « Mes prix » » :
          la partie de la fiche s'appelle Prix, et « Mes prix » est l'écran des
          grilles de vente, sous Tarifs & catalogue (planche du 26 octobre 2026). */}
      <button
        type="button"
        disabled={enCours || n === 0}
        onClick={prendre}
        data-atlas="prendre-les-prix"
        className={`mt-3 ${boutonPlein}`}
        style={stylePlein}
      >
        <Picto nom="coche" />
        {n > 1 ? `Ajouter ces ${n} prix` : n === 1 ? "Ajouter ce prix" : "Aucun prix coché"}
      </button>
      <button
        type="button"
        onClick={laisser}
        className="flex min-h-[48px] w-full items-center justify-center text-[16px] font-semibold"
        style={{ color: colors.inkSoft }}
      >
        {facture ? "Garder la facture sans les prix" : "Laisser"}
      </button>
    </div>
  );
}
