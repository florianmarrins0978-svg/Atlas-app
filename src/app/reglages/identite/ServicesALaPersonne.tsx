"use client";

import { useId, useState, useTransition } from "react";
import { colors, font, voile } from "@/lib/design-tokens";
import Paquet from "@/components/atlas/reglages/Paquet";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import Picto from "@/components/atlas/reglages/Picto";
import Interrupteur from "@/components/atlas/Interrupteur";
import { LOGOS_ACCEPTES, refusDuLogo } from "@/lib/allure-documents";
import { jourIso } from "@/lib/jour";
import {
  PART_HORS_SAP_MAX,
  ceQuiManqueALaDeclaration,
  numeroSapSaisi,
  phraseDuCompte,
  refusDeLaDateDeDeclaration,
  refusDuNumeroSap,
  type CompteDeLActiviteACote,
  type SaisieServicesALaPersonne,
} from "@/lib/services-a-la-personne";
import {
  deposerLogoServicesALaPersonneAction,
  majServicesALaPersonneAction,
  retirerLogoServicesALaPersonneAction,
} from "./sap-actions";

/** Ce que la base porte, tel que le serveur l'a ENREGISTRÉ : le compte des manques le lit. */
export type EtatServicesALaPersonne = {
  declaree: boolean;
  numero: string | null;
  declareeLe: string | null;
  activiteACote: boolean;
  logoDepose: boolean;
};

/**
 * « SERVICES À LA PERSONNE », dans Mon entreprise, après le médiateur (sa
 * planche du 8 novembre 2026, `appli/soignee/credit-d-impot.html`).
 *
 * Éteinte : une ligne, « Pas de crédit d'impôt pour vos clients. » Allumée :
 * le numéro, la date, le logo, et l'activité à côté avec son compteur. La
 * signature et l'avance immédiate viennent aux lots suivants.
 *
 * **L'état ENREGISTRÉ vit dans Mon entreprise** (`etat`), parce que la carte
 * du haut compte ce qui manque : le numéro et le logo s'y ajoutent, par la
 * même règle que les lignes en ambre (`ceQuiManqueALaDeclaration`). Ce qu'il
 * tape vit ici, jusqu'à ce que le serveur l'accepte : rien ne passe en ambre
 * pendant qu'il écrit (sa règle du 5 octobre 2026 pour la décennale).
 *
 * **Chaque geste s'écrit seul**, l'interrupteur à l'appui, le champ en le
 * quittant ; un refus du serveur remet ce qui était (`FinDeChantierReglage`).
 */
export default function ServicesALaPersonne({
  etat,
  onEtat,
  compte,
}: {
  etat: EtatServicesALaPersonne;
  onEtat: (partiel: Partial<EtatServicesALaPersonne>) => void;
  /** Le compte de l'année, lu par la page : il ne se montre qu'avec l'activité à côté. */
  compte: CompteDeLActiviteACote;
}) {
  const [numero, setNumero] = useState(etat.numero ?? "");
  const [date, setDate] = useState(etat.declareeLe ?? "");
  const [refus, setRefus] = useState<{ ou: "numero" | "date" | "general"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const idNumero = useId();
  const idDate = useId();
  const manque = ceQuiManqueALaDeclaration({ declaree: etat.declaree, numero: etat.numero, logoDepose: etat.logoDepose });

  function enregistrer(saisie: SaisieServicesALaPersonne, apres: Partial<EtatServicesALaPersonne>, avant: Partial<EtatServicesALaPersonne>, ou: "numero" | "date" | "general") {
    onEtat(apres);
    setRefus(null);
    demarrer(async () => {
      const r = await majServicesALaPersonneAction(saisie);
      if (!r.ok) {
        onEtat(avant);
        setRefus({ ou, texte: r.raison });
      }
    });
  }

  function quitterLeNumero(saisi: string) {
    const propre = numeroSapSaisi(saisi);
    if (propre === (etat.numero ?? "")) {
      // Revenu au numéro enregistré : le refus d'avant ne vaut plus.
      if (refus?.ou === "numero") setRefus(null);
      return;
    }
    const refusLocal = refusDuNumeroSap(saisi);
    if (refusLocal) {
      setRefus({ ou: "numero", texte: refusLocal });
      return;
    }
    setNumero(propre);
    enregistrer({ numero: saisi }, { numero: propre === "" ? null : propre }, { numero: etat.numero }, "numero");
  }

  function quitterLaDate(saisie: string) {
    if (saisie === (etat.declareeLe ?? "")) {
      if (refus?.ou === "date") setRefus(null);
      return;
    }
    const refusLocal = refusDeLaDateDeDeclaration(saisie, jourIso(new Date()));
    if (refusLocal) {
      setRefus({ ou: "date", texte: refusLocal });
      return;
    }
    enregistrer({ declareeLe: saisie }, { declareeLe: saisie === "" ? null : saisie }, { declareeLe: etat.declareeLe }, "date");
  }

  return (
    <Paquet titre="Services à la personne" dataAtlas="services-a-la-personne">
      <LigneBascule
        titre="Mon entreprise est déclarée sur NOVA"
        dit={etat.declaree ? "Vos clients particuliers récupèrent la moitié." : "Pas de crédit d'impôt pour vos clients."}
        actif={etat.declaree}
        enCours={enCours}
        repere="sap-declaree"
        onChange={(v) => enregistrer({ declaree: v }, { declaree: v }, { declaree: etat.declaree }, "general")}
      />

      {etat.declaree && (
        <>
          <LigneReglage
            libelle="N° de déclaration"
            htmlFor={idNumero}
            dataAtlas="sap-numero"
            manque={manque.numero && refus?.ou !== "numero"}
            sous={
              refus?.ou === "numero" ? (
                <span style={{ color: colors.carteRougeTexte, fontWeight: 600 }}>{refus.texte}</span>
              ) : manque.numero ? (
                "Sans lui, rien ne s'imprime."
              ) : undefined
            }
          >
            <input
              id={idNumero}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={numero}
              placeholder="SAP123456789"
              onChange={(e) => setNumero(e.target.value)}
              onBlur={(e) => quitterLeNumero(e.currentTarget.value)}
              style={{ ...styleValeurReglage, fontVariantNumeric: "tabular-nums lining-nums" }}
            />
          </LigneReglage>

          <LigneReglage
            libelle="Déclarée le"
            htmlFor={idDate}
            dataAtlas="sap-declaree-le"
            sous={
              refus?.ou === "date" ? (
                <span style={{ color: colors.carteRougeTexte, fontWeight: 600 }}>{refus.texte}</span>
              ) : undefined
            }
          >
            <input
              id={idDate}
              type="date"
              value={date}
              max={jourIso(new Date())}
              onChange={(e) => setDate(e.target.value)}
              onBlur={(e) => quitterLaDate(e.currentTarget.value)}
              style={{ ...styleValeurReglage, fontVariantNumeric: "tabular-nums lining-nums" }}
            />
          </LigneReglage>

          <LogoDesServicesALaPersonne depose={etat.logoDepose} onDepose={(v) => onEtat({ logoDepose: v })} />

          <LigneBascule
            titre="Une activité à côté"
            dit={etat.activiteACote ? "Création, clients professionnels." : "Seulement des services à la personne."}
            actif={etat.activiteACote}
            enCours={enCours}
            repere="sap-activite-a-cote"
            onChange={(v) => enregistrer({ activiteACote: v }, { activiteACote: v }, { activiteACote: etat.activiteACote }, "general")}
          >
            {etat.activiteACote && <CompteDeLActiviteACote compte={compte} />}
          </LigneBascule>
        </>
      )}

      {refus?.ou === "general" && (
        <p role="alert" className="pb-3.5 text-[14px] leading-[1.5]" style={{ color: colors.carteRougeTexte }}>
          {refus.texte}
        </p>
      )}
    </Paquet>
  );
}

/**
 * Une ligne d'interrupteur : le titre en serif, ce qu'il fait dessous, la
 * bascule au bout du pouce, et ce qui en dépend juste sous elle.
 */
function LigneBascule({
  titre,
  dit,
  actif,
  enCours,
  repere,
  onChange,
  children,
}: {
  titre: string;
  dit: string;
  actif: boolean;
  enCours: boolean;
  repere: string;
  onChange: (actif: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative py-3">
      {/* Le filet se pose au-dessus de chaque ligne ; le paquet rogne le premier. */}
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <div className="flex min-h-[40px] items-center gap-3.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
            {titre}
          </span>
          <span className="mt-0.5 block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {dit}
          </span>
        </span>
        <Interrupteur actif={actif} libelle={titre} repere={repere} enCours={enCours} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}

/**
 * Le compte de l'année : la part, ses deux montants pour se recomposer à la
 * main, la jauge rapportée aux 30 %, et la borne. Passé, la part et la jauge
 * prennent le rouge, la couleur d'une perte : la déclaration se retire.
 */
function CompteDeLActiviteACote({ compte }: { compte: CompteDeLActiviteACote }) {
  const couleur = compte.depasse ? teintesDuTon("rouge").texte : colors.or;
  return (
    <div className="mt-3" data-atlas="compteur-activite-a-cote">
      <div className="flex items-baseline justify-between gap-3">
        <b
          className="text-[24px] font-normal leading-none"
          style={{ fontFamily: font.display, color: compte.depasse ? couleur : colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
        >
          {compte.pourcent}&nbsp;%
        </b>
        <span className="text-right text-[14px]" style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}>
          {phraseDuCompte(compte)}
        </span>
      </div>
      <span
        aria-hidden="true"
        className="mt-2.5 block h-2 overflow-hidden rounded-[4px]"
        style={{ backgroundColor: voile(colors.ink, 0.1) }}
      >
        <span className="block h-full rounded-[4px]" style={{ width: `${compte.jauge}%`, backgroundColor: couleur }} />
      </span>
      <span className="mt-1.5 block text-[13.5px]" style={{ color: colors.inkSoft }}>
        {PART_HORS_SAP_MAX}&nbsp;% au plus.
      </span>
    </div>
  );
}

/**
 * Le logo des services à la personne : « Déposé », ou « À déposer » en ambre
 * avec sa raison, sur la planche. Le même geste que l'attestation décennale,
 * le format de son logo (`refusDuLogo`).
 */
function LogoDesServicesALaPersonne({ depose, onDepose }: { depose: boolean; onDepose: (depose: boolean) => void }) {
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const idFichier = useId();
  return (
    <LigneReglage libelle="Logo des services à la personne" dataAtlas="sap-logo">
      <input
        id={idFichier}
        type="file"
        accept={LOGOS_ACCEPTES.join(",")}
        className="hidden"
        data-atlas="sap-logo-fichier"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const r = refusDuLogo(f.type, f.size);
          if (r) {
            setRefus(r);
            return;
          }
          setRefus(null);
          const formulaire = new FormData();
          formulaire.append("fichier", f);
          demarrer(async () => {
            const resultat = await deposerLogoServicesALaPersonneAction(formulaire);
            if (resultat.ok) onDepose(true);
            else setRefus(resultat.raison);
          });
        }}
      />
      <span className="mt-1.5 flex items-center gap-3">
        <PastilleIcone ton={depose ? "vert" : "ambre"}>
          <Picto nom={depose ? "coche" : "alerte"} taille={22} />
        </PastilleIcone>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
            {depose ? "Déposé" : "À déposer"}
          </span>
          <span className="block text-[13.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {depose ? "Sur vos devis et vos factures" : "Obligatoire. Il se télécharge sur NOVA."}
          </span>
        </span>
        {depose ? (
          <button
            type="button"
            data-atlas="sap-logo-retirer"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const resultat = await retirerLogoServicesALaPersonneAction();
                if (resultat.ok) onDepose(false);
                else setRefus(resultat.raison);
              })
            }
            className="min-h-[44px] flex-none px-0.5 text-[15px] font-semibold"
            style={{ color: colors.or }}
          >
            Retirer
          </button>
        ) : (
          <label
            htmlFor={idFichier}
            data-atlas="sap-logo-deposer"
            className="inline-flex min-h-[44px] flex-none cursor-pointer items-center px-0.5 text-[15px] font-semibold"
            style={{ color: colors.or }}
          >
            {enCours ? "Envoi…" : "Déposer"}
          </label>
        )}
      </span>
      {refus && (
        <span className="mt-1 block text-[13.5px] font-semibold leading-[1.4]" style={{ color: colors.carteRougeTexte }}>
          {refus}
        </span>
      )}
    </LigneReglage>
  );
}
