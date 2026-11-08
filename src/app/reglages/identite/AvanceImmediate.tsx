"use client";

import { useState, useTransition } from "react";
import { colors, font } from "@/lib/design-tokens";
import { jourEtMois } from "@/lib/jour";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import Picto from "@/components/atlas/reglages/Picto";
import BottomSheet from "@/components/atlas/BottomSheet";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import ChampDeFeuille from "@/components/atlas/ChampDeFeuille";
import { codesSaisisLus } from "@/lib/urssaf/branchement";
import { delierLUrssafAction, relierLUrssafAction } from "./urssaf-actions";

/** Ce que l'écran sait de la liaison : son jour (`AAAA-MM-JJ`), et si elle est à refaire. Jamais un code. */
export type EtatLiaisonUrssaf = { relieeLe: string; aRefaire: boolean } | null;

/**
 * « AVANCE IMMÉDIATE », dans Mon entreprise, sous les services à la personne
 * (sa planche du 8 novembre 2026, écran « Mon entreprise », lot 3).
 *
 * Pas reliée : une ligne, puis « Relier l'Urssaf », qui ouvre la feuille des
 * quatre codes. Reliée : « Depuis le 8 novembre. » et « Délier ». **L'écran ne
 * sait que la date** : les codes partent au serveur, qui les vérifie chez
 * l'Urssaf AVANT de les garder, chiffrés, et ne les rend jamais.
 *
 * Elle ne paraît que pour une entreprise déclarée : Mon entreprise ne la monte
 * qu'avec l'interrupteur allumé.
 */
export default function AvanceImmediate({ initiale }: { initiale: EtatLiaisonUrssaf }) {
  const [liaison, setLiaison] = useState(initiale);
  const [ouverte, setOuverte] = useState(false);
  const [codes, setCodes] = useState({ clientId: "", clientSecret: "", idTiersFacturation: "", codeNature: "" });
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const reliee = liaison !== null && !liaison.aRefaire;
  const complets = codesSaisisLus(codes).ok;

  function relier() {
    setRefus(null);
    demarrer(async () => {
      const r = await relierLUrssafAction(codes);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      // Les codes ne restent pas dans l'écran une fois gardés par le serveur.
      setCodes({ clientId: "", clientSecret: "", idTiersFacturation: "", codeNature: "" });
      setLiaison({ relieeLe: r.relieeLe, aRefaire: false });
      setOuverte(false);
    });
  }

  function delier() {
    setRefus(null);
    demarrer(async () => {
      const r = await delierLUrssafAction();
      if (r.ok) setLiaison(null);
      else setRefus(r.raison);
    });
  }

  return (
    <>
      <Paquet titre="Avance immédiate" dataAtlas="avance-immediate">
        <div className="flex items-center gap-3.5 pb-3 pt-4">
          <PastilleIcone ton={reliee ? "vert" : liaison?.aRefaire ? "ambre" : undefined}>
            <Picto nom={reliee ? "coche" : liaison?.aRefaire ? "alerte" : "banque"} taille={22} />
          </PastilleIcone>
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
              {reliee ? "L'Urssaf est reliée" : liaison?.aRefaire ? "La liaison est à refaire" : "L'Urssaf n'est pas reliée"}
            </span>
            <span className="mt-0.5 block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
              {reliee && liaison
                ? `Depuis le ${jourEtMois(liaison.relieeLe)}.`
                : "Vos clients ne paient que la moitié, l'Urssaf vous verse toute la facture."}
            </span>
          </span>
        </div>
        <div className="pb-4">
          {reliee ? (
            <button
              type="button"
              data-atlas="delier-urssaf"
              disabled={enCours}
              onClick={delier}
              className="min-h-[44px] px-0.5 text-[15px] font-semibold"
              style={{ color: colors.inkSoft }}
            >
              Délier
            </button>
          ) : (
            <PrimaryButton pleineLargeur repere="relier-urssaf" onClick={() => setOuverte(true)}>
              Relier l&apos;Urssaf
            </PrimaryButton>
          )}
          {refus && !ouverte && (
            <p role="alert" className="mt-2 text-[13.5px] font-semibold" style={{ color: colors.carteRougeTexte }}>
              {refus}
            </p>
          )}
        </div>
      </Paquet>

      <BottomSheet open={ouverte} onBackdropClick={enCours ? undefined : () => setOuverte(false)}>
        <h2 className="text-[24px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
          Relier l&apos;Urssaf
        </h2>
        <p className="mt-1 text-[14px]" style={{ color: colors.inkSoft }}>
          Donnés par l&apos;Urssaf après votre demande.
        </p>
        <ChampDeFeuille
          libelle="Identifiant"
          valeur={codes.clientId}
          onChange={(v) => setCodes((c) => ({ ...c, clientId: v }))}
          repere="urssaf-identifiant"
        />
        <ChampDeFeuille
          libelle="Clé secrète"
          type="password"
          valeur={codes.clientSecret}
          onChange={(v) => setCodes((c) => ({ ...c, clientSecret: v }))}
          repere="urssaf-cle-secrete"
          autoComplete="new-password"
        />
        <ChampDeFeuille
          libelle="Identifiant Urssaf de l'entreprise"
          valeur={codes.idTiersFacturation}
          onChange={(v) => setCodes((c) => ({ ...c, idTiersFacturation: v }))}
          repere="urssaf-id-tiers"
        />
        <ChampDeFeuille
          libelle="Code de la nature"
          valeur={codes.codeNature}
          onChange={(v) => setCodes((c) => ({ ...c, codeNature: v }))}
          repere="urssaf-code-nature"
        />
        {refus && (
          <p role="alert" data-atlas="refus-urssaf" className="mt-3 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.carteRougeTexte }}>
            {refus}
          </p>
        )}
        <div className="mt-6">
          <PrimaryButton pleineLargeur repere="relier-urssaf-confirmer" disabled={enCours || !complets} onClick={relier}>
            {enCours ? "Vérification…" : "Relier"}
          </PrimaryButton>
        </div>
      </BottomSheet>
    </>
  );
}
