"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps, voile } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { montantSaisi, tvaDepuisTtc } from "@/lib/achat-tva";
import { ajouterAchatAction, rangerTicketAction } from "./actions";
import {
  dansLaPeriode,
  libellePeriode,
  periodeContenant,
  periodeTva,
  type PeriodiciteTva,
} from "@/server/periode-tva";
import { ACCEPT_PHOTOS } from "@/lib/exif";

/** Ce que la lecture propose — jamais ce qui est enregistré. */
type TicketLuAffiche = {
  fournisseur: string | null;
  date: string | null;
  totalTtc: number | null;
  tauxTva: number | null;
  tvaDeductible: number | null;
};

/**
 * Les deux façons d'ajouter un achat, et la feuille qui le saisit.
 *
 * *Sa demande du 12 août 2026 : « il faut pouvoir scanner un ticket, mais
 * également l'écrire ».* Retenu sur maquette (`docs/maquettes/37`).
 *
 * **La LISTE des achats n'est plus ici, depuis le 3 septembre 2026.** Elle
 * n'avait aucun état : ni geste, ni saisie, ni rien à écouter. La garder dans
 * ce fichier obligeait à l'envoyer au navigateur pour rien, et surtout à la
 * dessiner juste sous les deux boutons — alors que les boutons ont rejoint la
 * ligne « Déductible » de l'addition, tout en haut. Elle est rendue par le
 * serveur, dans `page.tsx`, à sa place : sous les factures, comme la preuve du
 * second terme.
 *
 * **Écrire n'est pas la roue de secours du scanner** : c'est l'autre moitié du
 * geste. Trois cas où l'objectif ne peut rien — le ticket perdu dont il se
 * souvient, la facture reçue par e-mail qui n'existe pas sur papier, l'achat
 * noté sur un coin de table. D'où deux entrées côte à côte, et non un bouton
 * principal avec un repli discret.
 *
 * **La lecture est branchée depuis le 13 août 2026**, le patron ayant posé ses
 * clés Anthropic et OpenAI. Ce qu'elle rend est une PROPOSITION : les champs
 * arrivent pré-remplis, et c'est la valeur qu'il CONFIRME qui part en base. Un
 * ticket thermique pâlit, se froisse et sort du fond d'une poche ; la lecture
 * se trompera, et un chiffre faux entré tout seul coûterait plus cher que pas
 * de chiffre du tout.
 *
 * **La photo est rangée avant la lecture, et le reste quoi qu'elle donne.**
 * Clé absente, quota dépassé, ticket illisible : le patron garde sa preuve et
 * saisit les montants. Le geste n'est jamais perdu pour une panne qui n'est pas
 * la sienne — et l'écran DIT laquelle, au lieu d'un « réessayez » unique pour
 * trois causes différentes.
 *
 * **Ce qui n'a pas pu être éprouvé ici** : la lecture d'un vrai ticket. Cet
 * environnement n'a aucune clé. La transformation de la réponse en champs, elle,
 * l'est entièrement (`scripts/test-lecture-ticket.ts`).
 */

export default function AchatsTva({
  aujourdHui,
  periodicite,
  annee,
  numero,
}: {
  aujourdHui: string;
  /** Le rythme choisi, pour savoir où tombera la date saisie. */
  periodicite: PeriodiciteTva;
  /** La période REGARDÉE — celle où le ticket tombera, ou pas. */
  annee: number;
  numero: number;
}) {
  const periodeVue = periodeTva(periodicite, annee, numero);
  const router = useRouter();
  const objectif = useRef<HTMLInputElement>(null);

  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [photoCle, setPhotoCle] = useState<string | null>(null);
  /** Ce que la lecture a su faire, ou n'a pas su — dit au patron tel quel. */
  const [lecture, setLecture] = useState<string | null>(null);

  const [fournisseur, setFournisseur] = useState("");
  const [date, setDate] = useState(aujourdHui);
  const [ttc, setTtc] = useState("");
  const [taux, setTaux] = useState("20");
  const [tva, setTva] = useState("");
  // Une fois qu'il a écrit la TVA lui-même, on ne l'écrase plus : son ticket
  // fait foi, pas notre calcul.
  const [tvaEcrite, setTvaEcrite] = useState(false);

  /**
   * Ouvrir la feuille, éventuellement pré-remplie par la lecture.
   *
   * **Ce que la lecture rend est une PROPOSITION, jamais un enregistrement.**
   * Un ticket thermique pâlit et se froisse ; elle se trompera. Le patron voit
   * ce qui a été lu, corrige d'un doigt, et c'est SA valeur qui part en base.
   */
  function ouvrir(cle: string | null, lu?: TicketLuAffiche | null, mot?: string | null) {
    setFournisseur(lu?.fournisseur ?? "");
    setDate(lu?.date ?? aujourdHui);
    setTtc(lu?.totalTtc != null ? String(lu.totalTtc).replace(".", ",") : "");
    setTaux(lu?.tauxTva != null ? String(lu.tauxTva).replace(".", ",") : "20");
    setTva(lu?.tvaDeductible != null ? lu.tvaDeductible.toFixed(2).replace(".", ",") : "");
    // Une TVA venue de la lecture ne doit pas être écrasée par le calcul si le
    // patron corrige ensuite le total : elle vient de son ticket.
    setTvaEcrite(lu?.tvaDeductible != null);
    setRefus(null);
    setLecture(mot ?? null);
    setPhotoCle(cle);
    setOuverte(true);
  }

  /** La TVA se calcule pendant la frappe — la faire calculer de tête sur un
   *  coin de camionnette, c'est la faire écrire fausse. */
  function recalculer(nouveauTtc: string, nouveauTaux: string) {
    if (tvaEcrite) return;
    const calcul = tvaDepuisTtc(montantSaisi(nouveauTtc), montantSaisi(nouveauTaux));
    setTva(calcul === null ? "" : calcul.toFixed(2).replace(".", ","));
  }

  async function photographier(fichier: File) {
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("ticket", fichier);
    const r = await rangerTicketAction(fd);
    setEnCours(false);
    if (!r.ok) {
      setRefus(r.raison);
      setOuverte(true);
      return;
    }
    ouvrir(r.cle, r.lu, r.lecture);
  }

  async function enregistrer() {
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("fournisseur", fournisseur);
    fd.set("dateAchat", date);
    fd.set("totalTtc", ttc);
    fd.set("tauxTva", taux);
    fd.set("tvaDeductible", tva);
    fd.set("saisie", photoCle ? "scan" : "main");
    if (photoCle) fd.set("photoCle", photoCle);
    const r = await ajouterAchatAction(fd);
    setEnCours(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setOuverte(false);

    // **Le défaut du 13 août 2026, et sa réparation.** Le patron a scanné un
    // ticket de gazole du 24 juillet depuis l'écran d'août. L'achat est parti
    // au bon endroit — dans juillet — et a DISPARU de sa vue : le total d'août
    // n'a pas bougé, et il a conclu que rien n'avait été pris. Il avait raison
    // de son point de vue : rien ne lui disait que c'était rangé ailleurs.
    //
    // On l'emmène donc là où l'achat atterrit. Pas un message qu'il faudrait
    // lire puis suivre : l'écran change, et l'achat est sous ses yeux.
    if (!dansLaPeriode(periodeVue, date)) {
      const cible = periodeContenant(periodicite, date);
      if (cible) {
        // **Pas de `router.refresh()` derrière ce `push`.** Les deux se sont
        // annulés : `refresh` redemande au serveur l'adresse COURANTE, et la
        // navigation en cours retombait dessus — l'écran restait sur août, le
        // ticket restait invisible, et le correctif ne corrigeait rien. Vu à la
        // sonde, jamais autrement : la ligne était bien en base, l'écran ne
        // bougeait pas. `push` suffit, la page étant `force-dynamic`.
        router.push(`/termines/tva?annee=${cible.annee}&t=${cible.numero}`);
        return;
      }
    }
    router.refresh();
  }

  /** Où cet achat va tomber — écrit avant de confirmer, jamais après coup. */
  const periodeDeLaSaisie = periodeContenant(periodicite, date);
  const ailleurs = periodeDeLaSaisie !== null && !dansLaPeriode(periodeVue, date);

  const armé = fournisseur.trim() !== "" && montantSaisi(tva) !== null && !enCours;

  return (
    <>
      {/* **Sans `capture`.** L'attribut forcerait l'appareil photo et retirerait
          l'accès à la photothèque : un ticket déjà photographié la veille
          deviendrait inatteignable. Sans lui, le téléphone propose les deux —
          même arbitrage que la pellicule des chantiers (`ARCHITECTURE.md` §60). */}
      <input
        ref={objectif}
        type="file"
        accept={ACCEPT_PHOTOS}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void photographier(f);
        }}
      />

      {/* **LES DEUX GESTES TOUCHENT LA LIGNE « DÉDUCTIBLE » — c'est la
          proposition C du 23 août 2026, poussée jusqu'au bout.**

          Sa remarque de ce jour-là : *« on ne comprend pas trop que scanner ou
          écrire à la main, c'est pour la TVA déductible »*. Trois dosages lui
          ont été dessinés (`docs/maquettes/85-achats-tva-deductible.html`) —
          dire le lien par le titre, par une phrase, ou par la PLACE. Il a
          retenu la place.

          Depuis le 3 septembre 2026, l'écran est une addition : collectée,
          moins déductible, un trait, le reste. Les deux gestes se posent
          **entre la ligne « Déductible » et le trait**, c'est-à-dire à
          l'endroit exact du chiffre qu'ils font monter. Le libellé « Pour faire
          monter la déductible » a donc été retiré : la place le dit, et un
          écran n'explique pas le bouton d'à côté (`CLAUDE.md` §3).

          Et le retour est meilleur qu'avant : après un scan, c'est le montant
          juste au-dessus du doigt qui change — plus besoin d'aller chercher la
          ligne quinze lignes plus bas. */}
      <div className="mt-1 flex gap-2.5" data-atlas="gestes-deductible">
        <button
          type="button"
          onClick={() => objectif.current?.click()}
          disabled={enCours}
          className="flex flex-1 flex-col items-center gap-[7px] rounded-full px-2 py-[13px] text-[12.5px]"
          style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}`, color: colors.ink }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="1.6" aria-hidden="true">
            <path d="M4 8.4V6.2A2.2 2.2 0 0 1 6.2 4h2.2M15.6 4h2.2A2.2 2.2 0 0 1 20 6.2v2.2M20 15.6v2.2a2.2 2.2 0 0 1-2.2 2.2h-2.2M8.4 20H6.2A2.2 2.2 0 0 1 4 17.8v-2.2" strokeLinecap="round" />
            <path d="M4 12h16" strokeLinecap="round" />
          </svg>
          {enCours && !ouverte ? "Envoi…" : "Scanner un ticket"}
        </button>
        <button
          type="button"
          onClick={() => ouvrir(null, null, null)}
          className="flex flex-1 flex-col items-center gap-[7px] rounded-full px-2 py-[13px] text-[12.5px]"
          style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}`, color: colors.ink }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="1.6" aria-hidden="true">
            <path d="M4 20h4.2L19 9.2a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20z" strokeLinejoin="round" />
            <path d="M13.6 6.6l3.8 3.8" strokeLinecap="round" />
          </svg>
          Écrire à la main
        </button>
      </div>

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <p className={`text-center ${libelleCaps}`} style={{ color: colors.or }}>
          {photoCle ? "Ticket photographié" : "Écrire un achat"}
        </p>
        <p
          className="mb-3.5 mt-2 text-center text-[20px]"
          style={{ fontFamily: font.display }}
        >
          {photoCle ? "Ses montants" : "À la main"}
        </p>

        <div className="flex flex-col gap-px overflow-hidden rounded-xl" style={{ backgroundColor: colors.lineSoft }}>
          <Ligne libelle="Où">
            <input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Station, magasin…"
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
            />
          </Ligne>
          <Ligne libelle="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
            />
          </Ligne>
          <Ligne libelle="Total payé">
            <input
              inputMode="decimal"
              value={ttc}
              onChange={(e) => {
                setTtc(e.target.value);
                recalculer(e.target.value, taux);
              }}
              placeholder="0,00 €"
              className="w-full bg-transparent text-right text-[15.5px] tabular-nums outline-none"
            />
          </Ligne>
          <Ligne libelle="Taux">
            <input
              inputMode="decimal"
              value={taux}
              onChange={(e) => {
                setTaux(e.target.value);
                recalculer(ttc, e.target.value);
              }}
              placeholder="20"
              className="w-full bg-transparent text-right text-[15.5px] tabular-nums outline-none"
            />
          </Ligne>
          <Ligne libelle="TVA déductible" accent>
            <input
              inputMode="decimal"
              value={tva}
              onChange={(e) => {
                setTva(e.target.value);
                setTvaEcrite(true);
              }}
              placeholder="calculée"
              className="w-full bg-transparent text-right text-[15.5px] tabular-nums outline-none"
            />
          </Ligne>
        </div>

        <p
          className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]"
          style={{ backgroundColor: voile(colors.or, 0.1), color: colors.or }}
        >
          {photoCle
            ? `${lecture ? `${lecture} ` : "Ticket lu. Vérifiez les montants avant d’ajouter. "}Gardez le papier — la photo ne le remplace pas.`
            : "La TVA se calcule depuis le total et le taux. Si votre ticket en affiche une autre, écrivez la sienne : c’est elle qui fait foi."}
        </p>

        {/* **Dit AVANT l'appui, pas après.** Une date hors de la période
            regardée n'est pas une erreur — un ticket de juillet scanné en août
            est le cas normal. Ce qui serait fautif, c'est de le laisser partir
            sans que le patron sache où il va. */}
        {ailleurs && periodeDeLaSaisie && (
          <p
            className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]"
            style={{ backgroundColor: voile(colors.or, 0.1), color: colors.or }}
          >
            Ce ticket est daté du {new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })} :
            il ira dans <b style={{ color: colors.ink, fontWeight: 500 }}>{libellePeriode(periodeDeLaSaisie)}</b>,
            pas dans {libellePeriode(periodeVue)}. L’écran vous y emmènera.
          </p>
        )}

        {refus && (
          <p role="alert" className="mt-2.5 text-center text-[13px]" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        <button
          type="button"
          onClick={enregistrer}
          disabled={!armé}
          className="atlas-plein mt-3 w-full rounded-full py-[15px] text-[15px]"
          style={{
            backgroundColor: colors.plein,
            color: colors.cream,
            fontFamily: font.display,
            opacity: armé ? 1 : 0.35,
          }}
        >
          {enCours ? "Enregistrement…" : "Ajouter aux achats"}
        </button>
        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="mt-1.5 w-full rounded-full py-3 text-[14.5px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}

function Ligne({
  libelle,
  accent,
  children,
}: {
  libelle: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className="flex items-center justify-between gap-3 px-[15px] py-[13px]"
      style={{ backgroundColor: accent ? colors.rustTint : colors.card }}
    >
      <span className="flex-shrink-0 text-[13px]" style={{ color: accent ? colors.or : colors.muted }}>
        {libelle}
      </span>
      {children}
    </label>
  );
}
