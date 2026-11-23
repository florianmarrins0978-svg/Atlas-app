"use client";

import { useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { formule, jourEnLettres, moisAbrege, montantDu } from "@/lib/abonnements";
import { changementDeFormule, prochaineEcheance, ttcEnCentimes, type Choix } from "@/lib/changement-de-formule";
import { enEuros, enEurosEntiers } from "@/lib/euros";
import { changerDeFormuleAction } from "./actions";
import { CarreDeDate } from "./EtatDeLAbonnement";

/**
 * LA FEUILLE QUI DIT LE MONTANT AVANT DE VALIDER — sa planche du 23 novembre
 * 2026 (`appli/soignee/changer-de-formule.html`), après avoir vu qu'un seul
 * appui changeait la formule sans rien dire ni rien débiter.
 *
 * **Un relevé, deux rangs** : ce qui part aujourd'hui, en gros chiffres à
 * droite comme les prix des cartes (0 € à la descente) ; puis l'échéance,
 * dans le carré doré que l'état donne déjà aux dates. Une phrase dessous dit
 * ce qui n'est pas remboursé, ou ce qu'il garde jusque-là. Si des comptes
 * partent avec la descente, une plage ambre le dit au-dessus de « Confirmer ».
 *
 * **Le montant vient de `changementDeFormule`**, la règle que l'action
 * applique ensuite : la feuille ne peut pas annoncer autre chose que ce qui
 * sera débité.
 *
 * **Le paiement refusé** laisse la formule et le dit dans la feuille (sa
 * demande : *« la formule ne change pas, et une ligne le dit »*) : la somme se
 * barre, la plage rouge le dit, et « Confirmer » devient « Changer de carte ».
 */
export default function ConfirmerLeChangement({
  actuel,
  voulu,
  echeance,
  comptesQuiPartent,
  fermer,
  changerDeCarte,
}: {
  actuel: Choix;
  voulu: Choix;
  /** La fin de la période payée, en ISO, ou rien si le prestataire ne l'a pas dite. */
  echeance: string | null;
  /** Les accès qui partiraient avec cette formule (`lesComptesQuiPartent`). */
  comptesQuiPartent: number;
  fermer: () => void;
  changerDeCarte: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [paiementRefuse, setPaiementRefuse] = useState(false);
  const [enCours, demarrer] = useTransition();

  const a = formule(actuel.formule);
  const v = formule(voulu.formule);
  if (!a || !v) return null;

  const changement = changementDeFormule(actuel, voulu);
  const prochaine = prochaineEcheance(changement, voulu, echeance ? new Date(echeance) : null, new Date());
  const debitHT = changement.genre === "tout-de-suite" ? changement.debitHT : 0;
  const memeFormule = actuel.formule === voulu.formule;
  const titre = memeFormule ? (voulu.periodicite === "annuelle" ? "Passer à l’année" : "Passer au mois") : `Passer à ${v.nom}`;
  const rythme = voulu.periodicite === "annuelle" ? "par an" : "par mois";
  const suivant =
    changement.genre === "tout-de-suite" ? "Prochain paiement" : memeFormule ? "Le paiement au mois commence" : `${v.nom} commence`;
  const note =
    changement.genre === "a-l-echeance"
      ? memeFormule
        ? "Jusque-là, vous gardez le paiement à l’année."
        : `Jusque-là, vous gardez ${a.nom}.`
      : changement.genre === "tout-de-suite" && changement.facon === "monter-a-l-annee"
        ? `La différence avec ${a.nom}, pour l’année en cours.`
        : memeFormule
          ? "Les jours restants du mois ne sont pas remboursés."
          : `Les jours restants ${de(a.nom)} ne sont pas remboursés.`;
  const comptes = changement.genre === "a-l-echeance" ? comptesQuiPartent : 0;

  function confirmer() {
    setMessage(null);
    demarrer(async () => {
      const r = await changerDeFormuleAction(voulu.formule, voulu.periodicite);
      if (r.ok) {
        window.location.reload();
        return;
      }
      setMessage(r.message);
      setPaiementRefuse(r.paiementRefuse === true);
    });
  }

  const barre = paiementRefuse ? { textDecoration: "line-through", color: colors.inkSoft } : undefined;

  return (
    <BottomSheet open onBackdropClick={enCours ? undefined : fermer}>
      <div role="dialog" aria-modal="true" aria-label={titre} data-atlas="changer-de-formule">
        <h2 className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
          {titre}
        </h2>

        <div data-atlas="releve-du-changement" className="rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
          <div className="flex items-center gap-3.5 py-[17px]">
            <span className="min-w-0 flex-1 text-[16px] leading-[1.35]" style={{ color: colors.ink }}>
              Débité aujourd’hui
            </span>
            <span className="inline-grid justify-items-end gap-y-[5px] whitespace-nowrap" data-atlas="debite-aujourd-hui">
              <span style={barre}>
                <span
                  className="text-[36px] leading-none"
                  style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums lining-nums", letterSpacing: "-0.01em" }}
                >
                  {enEurosEntiers(debitHT)}
                </span>
                {debitHT > 0 && (
                  <span className="ml-[5px] text-[14px]" style={{ color: colors.inkSoft }}>
                    HT
                  </span>
                )}
              </span>
              {debitHT > 0 && (
                <span className="text-[14.5px] leading-[1.2]" style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums lining-nums", ...barre }}>
                  {enEuros(ttcEnCentimes(debitHT) / 100)} TTC
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3.5 py-[17px]" style={{ boxShadow: `inset 0 1px 0 ${colors.lineSoft}` }}>
            {prochaine && <CarreDeDate chiffre={prochaine.getUTCDate()} dessous={moisAbrege(prochaine)} />}
            <span className="min-w-0 flex-1">
              <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                {suivant}
              </span>
              <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                {enEurosEntiers(montantDu(v, voulu.periodicite))} HT {rythme}
              </span>
            </span>
          </div>
        </div>

        <p className="mx-0.5 mt-3.5 text-[15.5px] leading-[1.45]" style={{ color: colors.ink }}>
          {note}
        </p>

        {comptes > 0 && prochaine && (
          <div className="mt-4">
            <PlageTon ton="ambre" dataAtlas="comptes-supprimes">
              <b className="font-semibold">
                {comptes === 1
                  ? `Le ${jourEnLettres(prochaine)}, l’autre compte de l’entreprise sera supprimé.`
                  : `Le ${jourEnLettres(prochaine)}, les ${comptes} autres comptes de l’entreprise seront supprimés.`}
              </b>{" "}
              {comptes === 1 ? "Ses devis et factures restent dans l’entreprise." : "Leurs devis et factures restent dans l’entreprise."}
            </PlageTon>
          </div>
        )}

        {message && (
          <div className="mt-4" role="alert">
            <PlageTon ton="rouge">{message}</PlageTon>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={paiementRefuse ? changerDeCarte : confirmer}
            disabled={enCours}
            data-atlas={paiementRefuse ? "changer-de-carte" : "confirmer"}
            className="atlas-plein min-h-[56px] w-full rounded-full px-[22px] text-[17px] font-semibold disabled:cursor-default"
            style={{ backgroundColor: colors.plein, color: surPlein, opacity: enCours ? 0.6 : 1 }}
          >
            {paiementRefuse ? "Changer de carte" : enCours ? "Un instant…" : "Confirmer"}
          </button>
          <button
            type="button"
            onClick={fermer}
            disabled={enCours}
            className="min-h-[48px] w-full text-[16px] font-semibold disabled:opacity-60"
            style={{ color: colors.inkSoft }}
          >
            Annuler
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** « d’Artisan », « de Cause » : l'élision devant une voyelle, ou un h. */
function de(nom: string): string {
  return /^[aeiouyhàâéèêëîïôûù]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}
