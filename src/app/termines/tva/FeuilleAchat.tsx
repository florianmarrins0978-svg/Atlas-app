"use client";

import { useState } from "react";
import { colors, font, libelleCaps, voile } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import {
  factureRepasExigee,
  LIBELLE_NATURE,
  montantSaisi,
  NATURES_ACHAT,
  recuperation,
  tvaDepuisTtc,
  type NatureAchat,
  type RepasAchat,
  type VehiculeAchat,
} from "@/lib/achat-tva";
import type { LigneImprimee } from "@/lib/ticket-imprime";
import PreuvesRepas from "./PreuvesRepas";
import { ajouterAchatAction } from "./actions";

/** Ce que la lecture propose — jamais ce qui est enregistré. */
export type TicketLuAffiche = {
  fournisseur: string | null;
  date: string | null;
  totalTtc: number | null;
  tauxTva: number | null;
  tvaDeductible: number | null;
  nature: NatureAchat | null;
  lignes: LigneImprimee[] | null;
};

/** Ce avec quoi la feuille s'ouvre : une photo rangée et ce qu'on en a lu, ou rien. */
export type DepartDeLaFeuille = {
  photoCle: string | null;
  lu: TicketLuAffiche | null;
  /** Ce que la lecture a su faire, ou n'a pas su — dit au patron tel quel. */
  lecture: string | null;
  refus: string | null;
};

/**
 * LA FEUILLE QUI SAISIT UN ACHAT — sortie d'`AchatsTva.tsx` le 24 octobre 2026
 * (lot 5 de « Pour mon comptable ») pour s'ouvrir aussi depuis une ligne du
 * Check up. Une seule feuille, deux endroits : deux copies de la règle du
 * repas d'affaires ou du véhicule finiraient par diverger (`CLAUDE.md` §3).
 *
 * **Ce que la lecture rend est une PROPOSITION, jamais un enregistrement.**
 * Un ticket thermique pâlit et se froisse ; elle se trompera. Le patron voit
 * ce qui a été lu, corrige d'un doigt, et c'est SA valeur qui part en base.
 *
 * Elle s'ouvre neuve à chaque fois : le parent la remonte (sa `key`) plutôt
 * que de remettre ses champs un à un.
 */
export default function FeuilleAchat({
  ouverte,
  onFermer,
  depart,
  aujourdHui,
  mouvementId,
  avantLeBouton,
  onEnregistre,
}: {
  ouverte: boolean;
  onFermer: () => void;
  depart: DepartDeLaFeuille;
  aujourdHui: string;
  /** La ligne de banque que ce ticket justifie, quand il est pris depuis le Check up. */
  mouvementId?: string;
  /** Ce qui se dit sous la saisie selon la date (la période où l'achat tombera). */
  avantLeBouton?: (date: string) => React.ReactNode;
  onEnregistre: (date: string) => void;
}) {
  const { photoCle, lu } = depart;
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(depart.refus);

  const [fournisseur, setFournisseur] = useState(lu?.fournisseur ?? "");
  const [date, setDate] = useState(lu?.date ?? aujourdHui);
  const [ttc, setTtc] = useState(lu?.totalTtc != null ? String(lu.totalTtc).replace(".", ",") : "");
  const [taux, setTaux] = useState(lu?.tauxTva != null ? String(lu.tauxTva).replace(".", ",") : "20");
  const [tva, setTva] = useState(lu?.tvaDeductible != null ? lu.tvaDeductible.toFixed(2).replace(".", ",") : "");
  // Une TVA venue de la lecture, ou écrite par lui, ne s'écrase plus par le
  // calcul : son ticket fait foi.
  const [tvaEcrite, setTvaEcrite] = useState(lu?.tvaDeductible != null);

  // **Ce qu'est l'achat — sa demande du 13 octobre 2026.** Tout se note ; seul
  // ce qui se récupère compte (`recuperation`, `src/lib/achat-tva.ts`).
  // Utilitaire et Perso sont cochés d'avance : *« 99 % du temps ce sera ça »*.
  // La lecture PROPOSE la nature ; sans elle, aucune puce n'est cochée.
  const [nature, setNature] = useState<NatureAchat | null>(lu?.nature ?? null);
  const [vehicule, setVehicule] = useState<VehiculeAchat>("utilitaire");
  const [repas, setRepas] = useState<RepasAchat>("perso");
  const [avecQui, setAvecQui] = useState("");
  const [pourquoi, setPourquoi] = useState("");
  const [justificatif, setJustificatif] = useState(false);

  /** La TVA se calcule pendant la frappe — la faire calculer de tête sur un
   *  coin de camionnette, c'est la faire écrire fausse. */
  function recalculer(nouveauTtc: string, nouveauTaux: string) {
    // La pièce exigée d'un repas change au seuil de 150 € HT : la coche donnée
    // pour la note ne vaut pas pour une facture, elle se décoche.
    if (
      factureRepasExigee(montantSaisi(ttc), montantSaisi(taux)) !==
      factureRepasExigee(montantSaisi(nouveauTtc), montantSaisi(nouveauTaux))
    ) {
      setJustificatif(false);
    }
    if (tvaEcrite) return;
    const calcul = tvaDepuisTtc(montantSaisi(nouveauTtc), montantSaisi(nouveauTaux));
    setTva(calcul === null ? "" : calcul.toFixed(2).replace(".", ","));
  }

  async function enregistrer() {
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("fournisseur", fournisseur);
    fd.set("dateAchat", date);
    fd.set("totalTtc", ttc);
    fd.set("tauxTva", taux);
    fd.set("tvaTicket", tva);
    if (nature) fd.set("nature", nature);
    if (nature === "carburant") fd.set("vehicule", vehicule);
    if (nature === "repas") {
      fd.set("repas", repas);
      if (repas === "affaires") {
        fd.set("avecQui", avecQui);
        fd.set("pourquoi", pourquoi);
        if (justificatif) fd.set("justificatif", "oui");
      }
    }
    fd.set("saisie", photoCle ? "scan" : "main");
    if (photoCle) fd.set("photoCle", photoCle);
    if (lu?.lignes) fd.set("lignes", JSON.stringify(lu.lignes));
    if (mouvementId) fd.set("mouvementId", mouvementId);
    const r = await ajouterAchatAction(fd);
    setEnCours(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    onEnregistre(date);
  }

  // Ce qui comptera, calculé par la MÊME règle que le dépôt : l'écran l'annonce
  // avant l'appui, le serveur le recalcule, et les deux ne peuvent pas diverger.
  const tvaTicket = montantSaisi(tva);
  const affaires = nature === "repas" && repas === "affaires";
  const compte =
    nature && tvaTicket !== null
      ? recuperation({
          nature,
          vehicule: nature === "carburant" ? vehicule : null,
          repas: nature === "repas" ? repas : null,
          avecQui,
          pourquoi,
          justificatif,
          totalTtc: montantSaisi(ttc),
          tauxTva: montantSaisi(taux),
          tvaTicket,
        })
      : null;

  const armé = fournisseur.trim() !== "" && tvaTicket !== null && nature !== null && !enCours;

  return (
    <BottomSheet open={ouverte} onBackdropClick={onFermer}>
      <p className={`text-center ${libelleCaps}`} style={{ color: colors.or }}>
        {photoCle ? "Ticket photographié" : "Écrire un achat"}
      </p>
      <p className="mb-3.5 mt-2 text-center text-[20px]" style={{ fontFamily: font.display }}>
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-right text-[15.5px] outline-none" />
        </Ligne>
        <div className="px-[15px] pb-3.5 pt-[13px]" style={{ backgroundColor: colors.card }}>
          <span className="mb-2 block text-[13px]" style={{ color: colors.muted }}>
            Quoi
          </span>
          <div className="flex flex-wrap gap-1.5" data-atlas="nature-achat">
            {NATURES_ACHAT.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={nature === n}
                data-nature={n}
                onClick={() => setNature(n)}
                className="min-h-10 rounded-full px-[13px] py-2 text-[13.5px]"
                style={
                  nature === n
                    ? { backgroundColor: colors.ink, color: colors.cream, border: `1px solid ${colors.ink}` }
                    : { color: colors.inkSoft, border: `1px solid ${colors.line}` }
                }
              >
                {LIBELLE_NATURE[n]}
              </button>
            ))}
          </div>
        </div>

        {nature === "carburant" && (
          <EnDeux
            libelle="Véhicule"
            marque="vehicule-achat"
            choix={[
              ["utilitaire", "Utilitaire"],
              ["voiture", "Voiture (VP)"],
            ]}
            valeur={vehicule}
            onChoix={setVehicule}
          />
        )}
        {nature === "repas" && (
          <EnDeux
            libelle="Repas"
            marque="repas-achat"
            choix={[
              ["affaires", "D’affaires"],
              ["perso", "Perso"],
            ]}
            valeur={repas}
            onChoix={setRepas}
          />
        )}
        {affaires && (
          <PreuvesRepas
            avecQui={avecQui}
            pourquoi={pourquoi}
            justificatif={justificatif}
            totalTtc={montantSaisi(ttc)}
            tauxTva={montantSaisi(taux)}
            onAvecQui={setAvecQui}
            onPourquoi={setPourquoi}
            onJustificatif={setJustificatif}
          />
        )}

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
        <Ligne libelle="TVA du ticket">
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
        <div className="flex items-center justify-between gap-3 px-[15px] py-[13px]" style={{ backgroundColor: colors.rustTint }} data-atlas="tva-recuperee">
          <span className="flex-shrink-0 text-[13px]" style={{ color: colors.or }}>
            TVA récupérée
          </span>
          <span className="text-[16px] tabular-nums" style={compte && compte.tvaRecuperee > 0 ? { color: colors.or, fontFamily: font.display } : { color: colors.muted }}>
            {compte === null
              ? ""
              : compte.manques.length > 0
                ? "Pas encore"
                : compte.tvaRecuperee > 0
                  ? compte.tvaRecuperee.toFixed(2).replace(".", ",") + " €"
                  : "Non récupérable"}
          </span>
        </div>
      </div>

      {/* Ce que la règle a décidé, dit en une phrase quand ce n'est pas
          « tout compte ». Rien quand tout compte : il n'y a rien à dire. */}
      {compte && (compte.manques.length > 0 || compte.tvaRecuperee < (tvaTicket ?? 0)) && (
        <p className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]" style={{ backgroundColor: colors.rustTint, color: colors.inkSoft }} data-atlas="mot-recuperation">
          {compte.manques.length > 0
            ? `Il manque ${enPhrase(compte.manques)}.${affaires ? " Le repas est noté, sa TVA ne compte pas encore." : ""}`
            : compte.tvaRecuperee > 0
              ? "Voiture : 80 % de la TVA du carburant."
              : "Noté, mais pas compté dans la TVA déductible."}
        </p>
      )}

      <p className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]" style={{ backgroundColor: voile(colors.or, 0.1), color: colors.or }}>
        {photoCle
          ? `${depart.lecture ? `${depart.lecture} ` : "Ticket lu. Vérifiez les montants avant d’ajouter. "}Gardez le papier, la photo ne le remplace pas.`
          : "La TVA se calcule depuis le total et le taux. Si votre ticket en affiche une autre, écrivez la sienne : c’est elle qui fait foi."}
      </p>

      {avantLeBouton?.(date)}

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
        style={{ backgroundColor: colors.plein, color: colors.cream, fontFamily: font.display, opacity: armé ? 1 : 0.35 }}
        data-atlas="ajouter-aux-achats"
      >
        {enCours ? "Enregistrement…" : "Ajouter aux achats"}
      </button>
      <button type="button" onClick={onFermer} className="mt-1.5 w-full rounded-full py-3 text-[14.5px]" style={{ color: colors.muted }}>
        Annuler
      </button>
    </BottomSheet>
  );
}

/** « a, b et c » : ce qui manque se lit comme une phrase. */
function enPhrase(liste: string[]): string {
  return liste.length < 2 ? liste.join("") : `${liste.slice(0, -1).join(", ")} et ${liste[liste.length - 1]}`;
}

/**
 * Deux choix sur une ligne, l'un coché d'avance : le véhicule, le repas.
 *
 * *Sa demande : « véhicule utilitaire coché direct, et un bouton à côté pour
 * noter VP si c'est le cas pour ce ticket »*. Pas un réglage : un geste par
 * ticket, là où il le fait.
 */
function EnDeux<T extends string>({
  libelle,
  marque,
  choix,
  valeur,
  onChoix,
}: {
  libelle: string;
  marque: string;
  choix: [T, string][];
  valeur: T;
  onChoix: (v: T) => void;
}) {
  return (
    <div className="px-[15px] pb-[13px] pt-[11px]" style={{ backgroundColor: colors.card }}>
      <span className="mb-2 block text-[13px]" style={{ color: colors.muted }}>
        {libelle}
      </span>
      <div className="flex rounded-full p-[3px]" style={{ border: `1px solid ${colors.line}` }} data-atlas={marque}>
        {choix.map(([v, mot]) => (
          <button
            key={v}
            type="button"
            aria-pressed={valeur === v}
            data-choix={v}
            onClick={() => onChoix(v)}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-[7px] rounded-full px-2 py-2.5 text-[14px]"
            style={valeur === v ? { backgroundColor: colors.plein, color: colors.cream } : { color: colors.inkSoft }}
          >
            {valeur === v && (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {mot}
          </button>
        ))}
      </div>
    </div>
  );
}

function Ligne({ libelle, accent, children }: { libelle: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 px-[15px] py-[13px]" style={{ backgroundColor: accent ? colors.rustTint : colors.card }}>
      <span className="flex-shrink-0 text-[13px]" style={{ color: accent ? colors.or : colors.muted }}>
        {libelle}
      </span>
      {children}
    </label>
  );
}
