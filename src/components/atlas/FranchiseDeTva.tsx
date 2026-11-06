"use client";

/**
 * LE PLAFOND DE LA FRANCHISE, à l'écran — sa planche du 5 novembre 2026
 * (`appli/soignee/franchise-plafond.html`), A ET B le 6 novembre.
 *
 *   A : la ligne de Terminés, muette loin du plafond (`LigneDeLaFranchise`) ;
 *   B : le compteur toujours dans Votre TVA (`CompteurDeLaFranchise`) ;
 *   la feuille du compte, ouverte par l'un comme par l'autre ;
 *   l'arrêt de la facture qui passe le plafond majoré (`ArretDuPlafond`).
 *
 * **Ce fichier ne décide de rien** : l'état, le ton, la part de la jauge et la
 * phrase sortent de `src/lib/franchise-plafond.ts`. Les mots sont ceux de la
 * planche qu'il a validée, au mot près.
 */
import { useState } from "react";
import BottomSheet from "./BottomSheet";
import IconeTrait from "./IconeTrait";
import PrimaryButton from "./PrimaryButton";
import PlageTon, { teintesDuTon } from "./reglages/PlageTon";
import { colors, font, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import {
  eurosEntiers,
  ligneSurTermines,
  phraseDuCompte,
  PLAFOND_CENTIMES,
  PLAFOND_MAJORE_CENTIMES,
  tonDuCompte,
  type ArretDuPlafond as Arret,
  type CompteDeLaFranchise,
} from "@/lib/franchise-plafond";

const enEurosDe = (centimes: number) => enEuros(centimes / 100);
const passe = (c: CompteDeLaFranchise) => c.etat === "passe" || c.etat === "majore_passe";

/** La jauge : le plein prend la couleur du texte qui l'entoure. */
function Jauge({ pourcent }: { pourcent: number }) {
  return (
    <span className="block h-2 overflow-hidden rounded-[4px]" style={{ backgroundColor: voile(colors.ink, 0.1) }} aria-hidden="true">
      <span className="block h-full rounded-[4px]" style={{ width: `${pourcent}%`, backgroundColor: "currentColor" }} />
    </span>
  );
}

function Rang({ nom, prix, total = false }: { nom: string; prix: string; total?: boolean }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3.5 py-2.5"
      style={{
        boxShadow: `inset 0 1px 0 ${total ? colors.line : colors.lineSoft}`,
        fontFamily: total ? font.display : undefined,
        fontSize: total ? 20 : 16.5,
      }}
    >
      <span className="min-w-0 flex-1" style={{ color: colors.ink }}>{nom}</span>
      <span className="whitespace-nowrap" style={{ color: colors.ink, fontVariantNumeric: "tabular-nums" }}>{prix}</span>
    </div>
  );
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n < 2 ? un : plusieurs}`;

/** La feuille du compte : chaque ligne se recompte à la main. */
export function FeuilleDuCompte({ compte, ouverte, onFermer }: { compte: CompteDeLaFranchise; ouverte: boolean; onFermer: () => void }) {
  const phrase = phraseDuCompte(compte);
  return (
    <BottomSheet open={ouverte} onBackdropClick={onFermer}>
      <div data-atlas="compte-de-la-franchise">
        <h2 className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          Franchise de TVA en {compte.annee}
        </h2>
        <Rang nom={pluriel(compte.factures.nombre, "facture envoyée", "factures envoyées")} prix={enEurosDe(compte.factures.centimes)} />
        {compte.importees.nombre > 0 && (
          <Rang nom={pluriel(compte.importees.nombre, "facture importée", "factures importées")} prix={enEurosDe(compte.importees.centimes)} />
        )}
        {compte.avoirs.nombre > 0 && (
          <Rang nom={pluriel(compte.avoirs.nombre, "avoir", "avoirs")} prix={`moins ${enEurosDe(compte.avoirs.centimes)}`} />
        )}
        <Rang nom="Total" prix={enEurosDe(compte.totalCentimes)} total />
        <div className="mt-3.5 text-[16px]" style={{ color: colors.inkSoft }}>
          <div className="flex justify-between py-1.5"><span>Plafond</span><span>{eurosEntiers(PLAFOND_CENTIMES)}</span></div>
          <div className="flex justify-between py-1.5"><span>Plafond majoré</span><span>{eurosEntiers(PLAFOND_MAJORE_CENTIMES)}</span></div>
        </div>
        <div className="mt-3.5">
          <PlageTon ton={phrase.ton}>{phrase.texte}</PlageTon>
        </div>
        <p className="mt-3 text-[13.5px]" style={{ color: colors.inkSoft }}>En HT, sur les factures envoyées.</p>
        <button type="button" onClick={onFermer} className="mt-2 flex min-h-12 w-full items-center justify-center text-[15px] font-semibold" style={{ color: colors.inkSoft }}>
          Fermer
        </button>
      </div>
    </BottomSheet>
  );
}

/** A : la ligne de Terminés, sous les deux cases. Rien loin du plafond. */
export function LigneDeLaFranchise({ compte }: { compte: CompteDeLaFranchise }) {
  const [ouverte, setOuverte] = useState(false);
  if (!ligneSurTermines(compte)) return null;
  const { fond, texte } = teintesDuTon(tonDuCompte(compte));
  return (
    <>
      <button
        type="button"
        data-atlas="ligne-franchise"
        onClick={() => setOuverte(true)}
        className="mt-2.5 block w-full rounded-[4px] px-4 pb-4 pt-3.5 text-left"
        style={{ backgroundColor: fond, color: texte }}
      >
        <span className="flex items-center justify-between gap-2.5 text-[15.5px] font-bold">
          {passe(compte) ? "Plafond de la franchise passé" : "Franchise de TVA"}
          <IconeTrait nom="suivant" taille={20} epaisseur={2} />
        </span>
        <span className="mb-2.5 mt-1.5 block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}>
          {eurosEntiers(compte.totalCentimes)} sur {eurosEntiers(PLAFOND_CENTIMES)} cette année
        </span>
        <Jauge pourcent={compte.pourcent} />
      </button>
      <FeuilleDuCompte compte={compte} ouverte={ouverte} onFermer={() => setOuverte(false)} />
    </>
  );
}

/** B : le compteur de Votre TVA, sous Franchise en base, toute l'année. */
export function CompteurDeLaFranchise({ compte }: { compte: CompteDeLaFranchise }) {
  const [ouverte, setOuverte] = useState(false);
  const ton = tonDuCompte(compte);
  // Loin du plafond, la jauge prend l'or de l'appli ; tout près et passé, le ton de la ligne de Terminés.
  const couleur = ton === "or" ? colors.or : teintesDuTon(ton).texte;
  return (
    <div className="mt-2.5 rounded-[6px] px-[18px] pb-2 pt-3.5" style={{ backgroundColor: colors.card }} data-atlas="compteur-franchise">
      <span className="block text-[13.5px]" style={{ color: colors.inkSoft }}>
        {passe(compte) ? "Cette année, plafond passé" : "Cette année"}
      </span>
      <span className="mb-3 mt-1 block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}>
        <b className="text-[24px] font-normal" style={{ color: ton === "or" ? colors.ink : couleur }}>{eurosEntiers(compte.totalCentimes)}</b> sur {eurosEntiers(PLAFOND_CENTIMES)}
      </span>
      <span className="block" style={{ color: couleur }}>
        <Jauge pourcent={compte.pourcent} />
      </span>
      <button type="button" onClick={() => setOuverte(true)} className="mt-1.5 inline-flex min-h-12 items-center text-[15px] font-semibold" style={{ color: colors.or }}>
        Voir le compte
      </button>
      <FeuilleDuCompte compte={compte} ouverte={ouverte} onFermer={() => setOuverte(false)} />
    </div>
  );
}

/**
 * L'arrêt de la facture qui passe le plafond majoré. Il DEMANDE : « L'envoyer
 * sans TVA » la fait partir comme aujourd'hui, mention 293 B.
 */
export function ArretDuPlafond({ arret, onSansTva, onFermer }: { arret: Arret; onSansTva: () => void; onFermer: () => void }) {
  const [compteOuvert, setCompteOuvert] = useState(false);
  const rouge = teintesDuTon("rouge");
  return (
    <>
      <BottomSheet open={!compteOuvert} onBackdropClick={onFermer}>
        <div data-atlas="arret-du-plafond">
          <h2 className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
            {arret.dejaPasse ? "Le plafond majoré est passé" : "Cette facture passe le plafond"}
          </h2>
          <div className="rounded-[10px] p-4 text-center text-[14.5px]" style={{ backgroundColor: rouge.fond, color: rouge.texte }}>
            <p>Avec elle, cette année</p>
            <p className="my-1.5 text-[34px] leading-[1.1]" style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}>
              {enEurosDe(arret.avecElleCentimes)}
            </p>
            <p>Plafond majoré {eurosEntiers(PLAFOND_MAJORE_CENTIMES)}</p>
          </div>
          <p className="mx-0.5 mb-[18px] mt-4 text-[16px] leading-[1.45]" style={{ color: colors.ink }}>
            Votre comptable vous dit si la TVA est due.
          </p>
          <PrimaryButton pleineLargeur href="/reglages/identite" repere="passer-en-assujettie">
            Passer en Assujettie
          </PrimaryButton>
          <div className="mt-2.5">
            <PrimaryButton pleineLargeur secondaire onClick={() => setCompteOuvert(true)}>
              Voir le compte
            </PrimaryButton>
          </div>
          <button
            type="button"
            data-atlas="envoyer-sans-tva"
            onClick={onSansTva}
            className="mt-2 flex min-h-12 w-full items-center justify-center text-[15px] font-semibold"
            style={{ color: colors.inkSoft }}
          >
            L&apos;envoyer sans TVA
          </button>
        </div>
      </BottomSheet>
      <FeuilleDuCompte compte={arret.compte} ouverte={compteOuvert} onFermer={() => setCompteOuvert(false)} />
    </>
  );
}
