"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
import FiltreDeDate from "@/components/atlas/FiltreDeDate";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { grouperEnBandes } from "@/lib/bandes-clients";
import { morceauxSurlignes } from "@/lib/recherche-client";
import { titreDeLaPeriode, porteeDeLaPeriode } from "@/lib/periode";
import {
  UNITES_ACHAT,
  ceQuiLaTrouve,
  dateesAMontrer,
  ligneDeMarge,
  lignesAMontrer,
  lireAdresseMail,
  lireMarge,
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
          <mark key={i} style={{ backgroundColor: "color-mix(in srgb, var(--atlas-or) 24%, transparent)", color: "inherit", borderRadius: 2 }}>
            {m.texte}
          </mark>
        ) : (
          <span key={i}>{m.texte}</span>
        )
      )}
    </>
  );
}

/** Les lignes d'une liste rangée, sous leur lettre ; aucune lettre pendant une recherche. */
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
        <div key={g.bande + iBande}>
          {!cherche && (
            <p className={`${iBande === 0 ? "mt-[10px]" : "mt-[24px]"} mb-[2px] ${libelleCaps}`} style={{ color: colors.muted }}>
              {g.bande}
            </p>
          )}
          {g.clients.map((l) => (
            <div key={l.id}>{ligne(l)}</div>
          ))}
        </div>
      ))}
    </>
  );
}

const boutonCreux = "min-h-[46px] rounded-full border px-4 text-[15px]";
const casePleine = "rounded-[10px] border-0 px-3 py-3 text-[16px]";

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
    <div className="px-[16px]" data-atlas="fournisseurs-partenaires">
      <div className="mt-3 flex gap-[6px]" role="group" aria-label="Rubrique">
        {(["fournisseur", "partenaire"] as const).map((r) => {
          const appuye = r === rubrique;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={appuye}
              data-atlas={`rubrique-${r}`}
              onClick={() => {
                setRubrique(r);
                setSaisie("");
              }}
              className={`min-h-[44px] flex-1 rounded-full border px-2 text-[14px] ${appuye ? "atlas-plein" : ""}`}
              style={
                appuye
                  ? { backgroundColor: colors.plein, borderColor: colors.plein, color: surPlein }
                  : { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }
              }
            >
              {r === "fournisseur" ? "Mes fournisseurs" : "Mes partenaires"}
            </button>
          );
        })}
      </div>

      <div className="sticky top-0 z-[5] -mx-[16px] mt-[6px] px-[16px] pb-[10px] pt-[14px]" style={{ backgroundColor: colors.cream }}>
        <ChampRecherche
          valeur={saisie}
          onChange={setSaisie}
          placeholder={rubrique === "fournisseur" ? "Chercher un fournisseur" : "Chercher un partenaire"}
          ariaLabel="Chercher"
          dataAtlas="chercher-societe"
        />
      </div>

      <div data-atlas="societes">
        {societes.length === 0 ? (
          <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
            {rubrique === "fournisseur"
              ? "Aucun fournisseur. Ajoutez la société chez qui vous achetez."
              : "Aucun partenaire. Ajoutez la société avec qui vous travaillez."}
          </p>
        ) : montrees.length === 0 ? (
          <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
            {rubrique === "fournisseur" ? "Aucun fournisseur" : "Aucun partenaire"} ne s’appelle « {saisie.trim()} ».
          </p>
        ) : (
          <EnBandes
            lignes={montrees}
            saisie={saisie}
            ligne={(s) => {
              const aussi = ceQuiLaTrouve(s, saisie);
              return (
                <button
                  type="button"
                  data-atlas="societe"
                  onClick={() => setOuverte(s.id)}
                  className="flex min-h-[64px] w-full items-center gap-[14px] border-b py-[13px] text-left"
                  style={{ borderColor: colors.line }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17.5px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                      <Surligne texte={s.nom} saisie={saisie} />
                    </span>
                    <span className="mt-[3px] block text-[12.5px]" style={{ color: colors.inkSoft }}>
                      {aussi.length > 0
                        ? aussi.map((t, i) => (
                            <span key={i}>
                              {i > 0 && ", "}
                              <Surligne texte={t} saisie={saisie} />
                            </span>
                          ))
                        : resumeDeLaSociete({ prix: s.prix.length, devis: s.devis.length, demandes: s.demandes.length })}
                    </span>
                    <span className="mt-[3px] block text-[12.5px]" style={{ color: colors.orTexte }} data-atlas="marge-societe">
                      {ligneDeMarge(s.marge, generale)}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 flex-none rotate-45"
                    style={{ borderRight: `1.5px solid ${colors.chevron}`, borderTop: `1.5px solid ${colors.chevron}` }}
                  />
                </button>
              );
            }}
          />
        )}
      </div>

      <div className="mt-[10px] flex gap-2">
        <input
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          placeholder={rubrique === "fournisseur" ? "Un autre fournisseur" : "Une société partenaire"}
          aria-label="Nom"
          data-atlas="nom-nouvelle-societe"
          className={`min-w-0 flex-1 ${casePleine}`}
          style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        />
        <button
          type="button"
          onClick={ajouterSociete}
          disabled={enCours}
          data-atlas="ajouter-societe"
          className={`flex-none ${boutonCreux}`}
          style={{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }}
        >
          Ajouter
        </button>
      </div>

      {/* Une marge par onglet, sa remarque du 19 octobre 2026 : le matériel chez
          les fournisseurs, la main d'œuvre chez les partenaires. Sous elle, plus
          de texte gris (« retire le texte grisé ») : seule la faute de frappe. */}
      <label className="mt-[10px] flex items-center gap-[10px] rounded-[12px] px-[14px] py-[12px] text-[15px]" style={{ backgroundColor: colors.card }}>
        <span className="flex-1">
          {rubrique === "fournisseur" ? "Ma marge sur le matériel" : "Ma marge sur la main d’œuvre"}
          {!lueGenerale.ok && (
            <small className="mt-[2px] block text-[13px]" style={{ color: colors.alert }} data-atlas="conseil-marge">
              {lueGenerale.raison}
            </small>
          )}
        </span>
        <input
          inputMode="decimal"
          value={margeTapee[laquelle]}
          onChange={(e) => setMargeTapee({ ...margeTapee, [laquelle]: e.target.value })}
          onBlur={(e) => enregistrerGenerale(e.currentTarget.value)}
          aria-label={rubrique === "fournisseur" ? "Marge sur le matériel" : "Marge sur la main d’œuvre"}
          data-atlas="marge-generale"
          className="w-[84px] rounded-[9px] border-0 p-[10px] text-right text-[16px]"
          style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        />
      </label>

      {refus && (
        <p className="mt-3 text-[13px]" style={{ color: colors.alert }} data-atlas="refus-fournisseurs">
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

/** La fiche d'un fournisseur ou d'un partenaire : ses prix, ses devis, ses factures, mes demandes. */
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
    demarrer(async () => {
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
    <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
      {quoi} ne s’appelle « {saisie.trim()} ».
    </p>
  );
  const enLettres = (p: string) =>
    porteeDeLaPeriode(p) === "jour" ? `le ${titreDeLaPeriode(p).toLowerCase()}` : `en ${titreDeLaPeriode(p).toLowerCase()}`;
  const liste = "mt-[10px] rounded-[12px] px-[14px] py-[2px]";
  const ligne = "flex items-center gap-2 border-t py-[10px] text-[14.5px] first:border-t-0";

  const prix = lignesAMontrer(societe.prix, saisie);
  const facture = partie === "factures";
  const tousRecus = facture ? societe.factures : societe.devis;
  const recus = dateesAMontrer(tousRecus, { saisie, periode });
  const demandes = dateesAMontrer(societe.demandes, { saisie, periode });

  return (
    <BottomSheet open onBackdropClick={onFermer}>
      <div data-atlas="fiche-societe" className="min-h-[70svh]">
        <div className="flex items-center">
          <h2 className="flex-1 text-[22px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
            {societe.nom}
          </h2>
          <button type="button" onClick={onFermer} className="text-[14px] underline" style={{ color: colors.inkSoft }}>
            Fermer
          </button>
        </div>

        <div className="mt-3 flex gap-[6px]" role="group" aria-label="Partie de la fiche">
          {(
            [
              ["prix", "Prix"],
              ["devis", "Devis"],
              ["factures", "Factures"],
              ["demandes", "Demandes"],
            ] as const
          ).map(([p, nom]) => {
            const appuye = p === partie;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={appuye}
                data-atlas={`partie-${p}`}
                onClick={() => {
                  setPartie(p);
                  setSaisie("");
                  // Ce qui a été lu sur un devis ne s'affiche pas sous les factures.
                  setLu(null);
                  setLuRien(false);
                  setVu(null);
                }}
                className={`min-h-[44px] flex-1 rounded-full border px-1 text-[14px] ${appuye ? "atlas-plein" : ""}`}
                style={
                  appuye
                    ? { backgroundColor: colors.plein, borderColor: colors.plein, color: surPlein }
                    : { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }
                }
              >
                {nom}
              </button>
            );
          })}
        </div>

        {partie !== "prix" && (
          <div className="-mx-[22px]">
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
          className="mt-3"
        />

        {/* Sa marge, écrite en tête de sa fiche : la générale tant qu'on n'en donne pas d'autre. */}
        <label className="mt-[14px] flex items-center gap-[10px] rounded-[12px] px-[14px] py-[12px] text-[15px]" style={{ backgroundColor: colors.card }}>
          <span className="flex-1">
            Ma marge chez {societe.nom}
            <small className="mt-[2px] block text-[13px]" style={{ color: alerteMarge ? colors.alert : colors.muted }}>
              {alerteMarge ? `${alerteMarge} ` : ""}
              {phraseDeLaMargePropre(societe.marge, generale)}
            </small>
          </span>
          <input
            inputMode="decimal"
            value={margeTapee}
            onChange={(e) => setMargeTapee(e.target.value)}
            onBlur={(e) => enregistrerMarge(e.currentTarget.value)}
            aria-label={`Marge chez ${societe.nom}`}
            data-atlas="marge-propre"
            className="w-[84px] rounded-[9px] border-0 p-[10px] text-right text-[16px]"
            style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          />
        </label>

        {/* Où part sa liste du plan d'arrosage : sa planche du 20 octobre 2026. */}
        {rubrique === "fournisseur" && (
          <label className="mt-[8px] flex flex-col gap-[6px] rounded-[12px] px-[14px] py-[12px] text-[15px]" style={{ backgroundColor: colors.card }}>
            <span>
              Adresse mail
              {alerteAdresse && (
                <small className="mt-[2px] block text-[13px]" style={{ color: colors.alert }} data-atlas="refus-adresse">
                  {alerteAdresse}
                </small>
              )}
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              onBlur={(e) => enregistrerAdresse(e.currentTarget.value)}
              placeholder="commande@…"
              aria-label={`Adresse mail de ${societe.nom}`}
              data-atlas="adresse-mail"
              className="w-full rounded-[9px] border-0 p-[10px] text-[16px]"
              style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            />
          </label>
        )}

        {partie === "prix" && (
          <>
            {societe.prix.length === 0 ? (
              <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
                {rubrique === "fournisseur"
                  ? "Aucune fourniture encore. Ajoutez-en, ou prenez un de ses devis en photo."
                  : "Aucun prix de main d’œuvre encore."}
              </p>
            ) : prix.length === 0 ? (
              vide(rubrique === "fournisseur" ? "Aucune fourniture" : "Aucune prestation")
            ) : (
              <div className={liste} style={{ backgroundColor: colors.card }}>
                <EnBandes
                  lignes={prix}
                  saisie={saisie}
                  ligne={(p) => (
                    <div className={ligne} style={{ borderColor: colors.line }} data-atlas="prix-achat">
                      <span className="min-w-0 flex-1">
                        <Surligne texte={p.nom} saisie={saisie} />
                        <small className="block text-[12.5px]" style={{ color: colors.muted }}>
                          {p.source}
                        </small>
                      </span>
                      <span className="flex-none text-right tabular-nums">
                        {enEuros(p.prixHt)} / {p.unite}
                        {p.prixAvant && (
                          <small className="block text-[12.5px] line-through" style={{ color: colors.muted }} data-atlas="prix-avant">
                            {enEuros(p.prixAvant)}
                          </small>
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={enCours}
                        onClick={() => demarrer(async () => apres(await retirerPrixAction(p.id)))}
                        className="flex-none pl-[6px] text-[13px] underline"
                        style={{ color: colors.alert }}
                      >
                        Retirer
                      </button>
                    </div>
                  )}
                />
              </div>
            )}
            <div className="mt-3 grid grid-cols-[1fr_96px_80px] gap-[6px]">
              <input
                value={article.nom}
                onChange={(e) => setArticle({ ...article, nom: e.target.value })}
                placeholder={rubrique === "fournisseur" ? "Fourniture" : "Prestation"}
                aria-label="Nom"
                data-atlas="article-nom"
                className="min-w-0 rounded-[9px] border-0 p-[10px] text-[16px]"
                style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              />
              <select
                value={article.unite}
                onChange={(e) => setArticle({ ...article, unite: e.target.value })}
                aria-label="Unité"
                className="min-w-0 rounded-[9px] border-0 p-[10px] text-[16px]"
                style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
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
                data-atlas="article-prix"
                className="min-w-0 rounded-[9px] border-0 p-[10px] text-right text-[16px]"
                style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
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
              className={`mt-[10px] w-full ${boutonCreux}`}
              style={{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }}
            >
              Ajouter ce prix
            </button>
          </>
        )}

        {(partie === "devis" || facture) && (
          <>
            {champ(appareil, "image/jpeg,image/png", "environment")}
            {champ(fichiers, "application/pdf,image/jpeg,image/png,.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            {/* Un nom pour le document : c'est lui qui le range de A à Z et le fait trouver. */}
            <input
              value={nomDevis}
              onChange={(e) => setNomDevis(e.target.value)}
              placeholder={facture ? "Nom de la facture, chantier ou client" : "Nom du devis, chantier ou client"}
              aria-label={facture ? "Nom de la facture" : "Nom du devis"}
              data-atlas={facture ? "nom-facture" : "nom-devis"}
              className={`mt-3 block w-full ${casePleine}`}
              style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            />
            <button
              type="button"
              disabled={enCours}
              onClick={() => appareil.current?.click()}
              data-atlas={facture ? "photo-facture" : "photo-devis"}
              className="atlas-plein mt-[10px] flex min-h-[52px] w-full items-center justify-center rounded-full text-[16px]"
              style={{ backgroundColor: colors.plein, color: surPlein }}
            >
              {facture ? "Prendre une facture en photo" : "Prendre un devis en photo"}
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => fichiers.current?.click()}
              data-atlas={facture ? "fichier-facture" : "fichier-devis"}
              className="mt-[10px] flex min-h-[52px] w-full items-center justify-center rounded-full border text-[16px]"
              style={{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }}
            >
              PDF, photo ou Excel
            </button>

            {enCours && (
              <p className="mt-3 text-[14px]" style={{ color: colors.inkSoft }} data-atlas="lecture-devis">
                {facture ? "Atlas lit la facture" : "Atlas lit le devis"}
              </p>
            )}
            {luRien && (
              <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
                {facture ? "Facture gardée." : "Devis gardé."} Atlas n’a pas pu en lire les prix : tapez-les dans « Mes prix ».
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
              <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
                {facture ? "Aucune facture reçue" : "Aucun devis reçu"} de {societe.nom}.
              </p>
            ) : recus.length === 0 ? (
              saisie.trim() ? (
                vide(facture ? "Aucune facture" : "Aucun devis")
              ) : (
                <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
                  {facture ? "Aucune facture reçue" : "Aucun devis reçu"} {enLettres(periode)}.
                </p>
              )
            ) : (
              <div className={liste} style={{ backgroundColor: colors.card }}>
                <EnBandes
                  lignes={recus}
                  saisie={saisie}
                  ligne={(d) => (
                    <div className={ligne} style={{ borderColor: colors.line }} data-atlas={facture ? "facture-recue" : "devis-recu"}>
                      {d.nature === "photo" && (
                        <Image src={`/reglages/fournisseurs/devis/${d.id}`} alt="" width={44} height={44} unoptimized className="h-11 w-11 flex-none rounded-[8px] object-cover" />
                      )}
                      <span className="min-w-0 flex-1">
                        <Surligne texte={d.nom} saisie={saisie} />
                        <small className="block text-[12.5px]" style={{ color: colors.muted }}>
                          {facture
                            ? `Reçue le ${d.recuLe}${d.totalTtc ? `, ${enEuros(d.totalTtc)} TTC` : ""}`
                            : `Reçu le ${d.recuLe}, ${d.nature === "photo" ? "Photo" : d.fichierNom ?? "PDF"}`}
                        </small>
                      </span>
                      {d.nature === "photo" ? (
                        <button type="button" onClick={() => setVu(vu === d.id ? null : d.id)} className="flex-none pl-[6px] text-[13px] underline" style={{ color: colors.inkSoft }}>
                          Voir
                        </button>
                      ) : (
                        <a href={`/reglages/fournisseurs/devis/${d.id}`} target="_blank" rel="noopener" className="flex-none pl-[6px] text-[13px] underline" style={{ color: colors.inkSoft }}>
                          Voir
                        </a>
                      )}
                    </div>
                  )}
                />
              </div>
            )}
            {vu && (
              <div className="mt-3 overflow-hidden rounded-[12px]" style={{ backgroundColor: colors.card }}>
                <Image src={`/reglages/fournisseurs/devis/${vu}`} alt={facture ? "La facture" : "Le devis"} width={860} height={680} unoptimized className="block h-auto max-h-[340px] w-full bg-white object-contain" />
              </div>
            )}
          </>
        )}

        {partie === "demandes" &&
          (societe.demandes.length === 0 ? (
            <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
              Aucune demande envoyée à {societe.nom}. Les listes que vous lui envoyez depuis un devis ou le plan d’arrosage s’enregistrent ici, avec leur date.
            </p>
          ) : demandes.length === 0 ? (
            saisie.trim() ? (
              vide("Aucune demande")
            ) : (
              <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
                Aucune demande envoyée {enLettres(periode)}.
              </p>
            )
          ) : (
            <div className={liste} style={{ backgroundColor: colors.card }}>
              <EnBandes
                lignes={demandes}
                saisie={saisie}
                ligne={(d) => (
                  <div className={ligne} style={{ borderColor: colors.line }} data-atlas="demande-envoyee">
                    <span className="min-w-0 flex-1">
                      <Surligne texte={d.nom} saisie={saisie} />
                      <small className="block text-[12.5px]" style={{ color: colors.muted }}>
                        Envoyée le {d.envoyeeLe}, {d.lignes} ligne{d.lignes > 1 ? "s" : ""}
                      </small>
                    </span>
                  </div>
                )}
              />
            </div>
          ))}

        {refus && (
          <p className="mt-3 text-[13px]" style={{ color: colors.alert }} data-atlas="refus-fiche">
            {refus}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

/**
 * Ce qu'Atlas a lu sur le devis, **rien n'est enregistré avant son appui**,
 * comme `ImportTarifs.tsx`. Chaque ligne se décoche.
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
    <div className="mt-3 rounded-[12px] px-[14px] py-[8px]" style={{ backgroundColor: colors.card }} data-atlas="lu-sur-le-devis">
      {lu.lignes.map((l, i) => {
        const r = facture ? rapprocherDuPrix(l, facture.connus) : null;
        const detail = facture && r ? detailDeLaLigneLue(l.reference, r, facture.rubrique) : l.reference ? `réf. ${l.reference}` : null;
        return (
          <label key={i} className="flex items-center gap-2 border-t py-[10px] text-[14.5px] first:border-t-0" style={{ borderColor: colors.line }}>
            <input type="checkbox" checked={lu.gardees[i]} onChange={() => cocher(i)} className="h-5 w-5 flex-none" />
            <span className="min-w-0 flex-1">
              {l.designation}
              {detail && (
                <small className="block text-[12.5px]" style={{ color: colors.muted }}>
                  {detail}
                </small>
              )}
            </span>
            <span className="flex-none text-right tabular-nums">
              <span style={r?.etat === "plus cher" ? { color: colors.alert } : undefined}>
                {enEuros(l.prixHt)} / {l.unite}
              </span>
              {r && (r.etat === "plus cher" || r.etat === "moins cher") && (
                <small className="block text-[12.5px] line-through" style={{ color: colors.muted }}>
                  {enEuros(r.ancien.prixHt)}
                </small>
              )}
            </span>
          </label>
        );
      })}
      {lu.ecartees > 0 && (
        <p className="py-[6px] text-[13px]" style={{ color: colors.muted }}>
          {lu.ecartees} ligne{lu.ecartees > 1 ? "s" : ""} sans prix lisible, à taper.
        </p>
      )}
      {facture && (lu.totalHt || lu.totalTtc) && (
        <p className="flex justify-between gap-3 py-[6px] text-[14px] tabular-nums" style={{ color: colors.inkSoft }} data-atlas="total-facture">
          <span>Total de la facture</span>
          <span className="text-right">
            {[lu.totalHt && `${enEuros(lu.totalHt)} HT`, lu.totalTtc && `${enEuros(lu.totalTtc)} TTC`].filter(Boolean).join(", ")}
          </span>
        </p>
      )}
      <button
        type="button"
        disabled={enCours || n === 0}
        onClick={prendre}
        data-atlas="prendre-les-prix"
        className="atlas-plein mt-2 flex min-h-[52px] w-full items-center justify-center rounded-full text-[16px] disabled:opacity-50"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        Mettre {n} prix dans « Mes prix »
      </button>
      <button type="button" onClick={laisser} className="block w-full py-3 text-center text-[15px]" style={{ color: colors.inkSoft }}>
        {facture ? "Garder la facture sans les prix" : "Laisser"}
      </button>
    </div>
  );
}
