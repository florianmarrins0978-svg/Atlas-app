"use client";

import { useState, useTransition } from "react";
import { colors } from "@/lib/design-tokens";
import { NUIT, SERIF } from "@/components/atlas/PorteDeNuit";
import { RAISONS_DEPART, TEXTE_DEPART_MAX, type RaisonDepart } from "@/lib/resiliation";
import BoutonTelecharger from "@/app/reglages/donnees/BoutonTelecharger";
import { refuserEtResilierAction, type ResultatRefus } from "./actions";
import type { OptionRefus } from "./formulaire";

// « Refuser la nouvelle version » — planche du 18 octobre 2026, téléphone 2
// (`appli/documents-legaux-un-geste.html`). Trois temps, dans la même feuille :
// ses données d'abord, puis la résiliation avec ce qui sera rendu, puis ce qui
// a été fait. Rien n'est caché derrière un second écran à trouver.
export default function FeuilleRefus({
  refus,
  fermer,
  sortir,
}: {
  refus: OptionRefus;
  fermer: () => void;
  sortir: () => void;
}) {
  const [etape, setEtape] = useState<"choix" | "confirmer">("choix");
  const [raison, setRaison] = useState<RaisonDepart | null>(null);
  const [texte, setTexte] = useState("");
  const [resultat, setResultat] = useState<ResultatRefus | null>(null);
  const [enCours, demarrer] = useTransition();
  const r = refus.resiliation;

  function resilier() {
    demarrer(async () => {
      setResultat(await refuserEtResilierAction(raison, texte));
    });
  }

  const fait = resultat?.ok ? resultat : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Refuser la nouvelle version"
      data-atlas="feuille-refus"
      className="atlas-colonne-fixe inset-y-0 z-50 flex flex-col"
      style={{ background: NUIT.cream }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-[18px] pb-3 pt-[18px]"
        style={{ borderBottom: `1px solid ${colors.line}` }}
      >
        <h2 className="text-[19px] leading-[1.25]" style={{ ...SERIF, color: colors.ink }}>
          {fait ? "Abonnement résilié" : etape === "confirmer" ? "Résilier maintenant ?" : "Refuser la nouvelle version"}
        </h2>
        {!fait && (
          <button
            type="button"
            onClick={etape === "confirmer" ? () => setEtape("choix") : fermer}
            disabled={enCours}
            className="min-h-[44px] shrink-0 px-1 text-[15px]"
            style={{ color: colors.ink }}
          >
            {etape === "confirmer" ? "Annuler" : "Fermer"}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-[22px] pb-6 pt-5 text-[15px] leading-[1.55]" style={{ color: colors.inkSoft }}>
        {fait ? (
          <>
            <p data-atlas="refus-fait">
              {fait.remboursementEchoue
                ? "Le remboursement n’a pas pu partir tout seul : il vous sera fait à la main."
                : fait.rembourseCentimes > 0
                  ? `${euros(fait.rembourseCentimes)} TTC remboursés sur la carte qui a servi à payer, pour ${fait.moisNonUtilises} mois non utilisés.`
                  : "Aucun mois entier à rembourser : le mois en cours a servi."}
            </p>
            <p className="mt-3">Vos données restent à vous.</p>
            <div className="mt-5">
              <BoutonTelecharger nomFichier={refus.nomFichier} />
            </div>
          </>
        ) : etape === "choix" ? (
          <>
            <p>
              {r
                ? "Vos données restent à vous. Récupérez-les, puis résiliez : les mois payés et non utilisés vous sont remboursés."
                : "Vos données restent à vous. Récupérez-les avant de partir."}
            </p>
            <div className="mt-5">
              <BoutonTelecharger nomFichier={refus.nomFichier} />
            </div>
            {r && (
              <button
                type="button"
                onClick={() => setEtape("confirmer")}
                data-atlas="refus-resilier"
                className="mt-3 min-h-[52px] w-full rounded-full text-[16px]"
                style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
              >
                Résilier et être remboursé
              </button>
            )}
          </>
        ) : (
          r && (
            <>
              <div className="overflow-hidden rounded-[16px]" style={{ background: colors.card }}>
                <Ligne libelle="Formule" valeur={r.formule} />
                <Ligne libelle="Payé jusqu’au" valeur={r.payeJusquAu} />
                <Ligne libelle="Mois non utilisés" valeur={String(r.moisNonUtilises)} />
              </div>
              <p className="mt-3">Remboursés sur la carte qui a servi à payer, au prix réellement payé.</p>

              <p className="mt-6" style={{ color: colors.ink }}>
                Pourquoi partez-vous&nbsp;? <span className="text-[13px]" style={{ color: colors.inkSoft }}>Facultatif</span>
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {RAISONS_DEPART.map((x) => {
                  const choisie = raison === x.code;
                  return (
                    <button
                      key={x.code}
                      type="button"
                      aria-pressed={choisie}
                      onClick={() => setRaison(choisie ? null : x.code)}
                      className="min-h-[44px] rounded-full px-[14px] text-[14px]"
                      style={{
                        background: choisie ? colors.ink : "transparent",
                        color: choisie ? NUIT.cream : colors.ink,
                        border: `1px solid ${choisie ? colors.ink : colors.line}`,
                      }}
                    >
                      {x.libelle}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                maxLength={TEXTE_DEPART_MAX}
                rows={3}
                placeholder="Dites-nous en plus"
                aria-label="Dites-nous en plus"
                className="mt-3 w-full resize-none rounded-[14px] px-4 py-3 text-[15px] leading-[1.45]"
                style={{ background: colors.card, border: `1px solid ${colors.line}`, color: colors.ink }}
              />
              {resultat && !resultat.ok && (
                <p role="alert" className="mt-4 text-[13.5px]" style={{ color: colors.alert }}>
                  {resultat.message}
                </p>
              )}
            </>
          )
        )}
      </div>

      <div className="atlas-bas-sans-barre shrink-0 px-[22px] pb-6 pt-3">
        {etape === "confirmer" && !fait ? (
          <button
            type="button"
            onClick={resilier}
            disabled={enCours}
            data-atlas="refus-confirmer"
            className="w-full rounded-full py-4 text-[17px] leading-none disabled:opacity-60"
            style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
          >
            {enCours ? "Un instant…" : "Résilier et être remboursé"}
          </button>
        ) : (
          <button
            type="button"
            onClick={sortir}
            className="min-h-[44px] w-full text-[14px]"
            style={{ color: colors.muted }}
          >
            Se déconnecter
          </button>
        )}
      </div>
    </div>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div
      className="flex justify-between gap-3 px-[18px] py-[13px] text-[15px] first:border-t-0"
      style={{ borderTop: `1px solid ${colors.line}`, color: colors.ink }}
    >
      <span>{libelle}</span>
      <b className="font-medium">{valeur}</b>
    </div>
  );
}

function euros(centimes: number): string {
  return `${(centimes / 100).toLocaleString("fr-FR", { minimumFractionDigits: centimes % 100 ? 2 : 0 })} €`;
}
