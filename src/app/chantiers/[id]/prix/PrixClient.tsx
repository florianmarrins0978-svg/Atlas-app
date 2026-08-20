"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Decimal from "decimal.js";
import { champPlage, colors, font, libelleCaps, styleChampPlage, texteSituation } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import {
  ajouterLignePrixAction,
  modifierLignePrixAction,
  supprimerLignePrixAction,
  validerPrixAction,
} from "./actions";
import PropositionPrixSection from "./PropositionPrixSection";
import type { PropositionPrix } from "@/server/chiffrage/proposition-prix";
import { peutPreparerDevis } from "@/lib/preparation-devis";
import { enEuros } from "@/lib/euros";

type Ligne = { id: string; libelle: string; montant: string };


export default function PrixClient({
  chantierId,
  initialLignes,
  propositionInitiale,
  saisieManuelle = false,
}: {
  chantierId: string;
  initialLignes: Ligne[];
  propositionInitiale: PropositionPrix | null;
  /** Arrivée par « Ou écrire le devis moi-même → » : la proposition part repliée. */
  saisieManuelle?: boolean;
}) {
  const router = useRouter();
  const [propositionVisible, setPropositionVisible] = useState(!saisieManuelle);
  const [lignes, setLignes] = useState<Ligne[]>(initialLignes);
  const [validationEnCours, setValidationEnCours] = useState(false);
  const [erreurValidation, setErreurValidation] = useState<string | null>(null);

  // Le retrait réversible : la ligne n'est que masquée tant que le tiroir est
  // ouvert, et l'écriture attend sa fermeture. L'ancienne mécanique supprimait
  // puis RECRÉAIT une ligne à l'annulation — un identifiant neuf pour la même
  // ligne, ce qui n'est pas la même chose.
  const retraits = useRetraits({
    valider: async (id) => {
      await supprimerLignePrixAction(id);
      setLignes((cur) => cur.filter((l) => l.id !== id));
    },
  });

  // **Le total suit ce qui reste.** Un montant qui ne bouge pas après un
  // retrait fait douter que le retrait ait eu lieu — et ici, c'est le chiffre
  // que le client recevra.
  const visibles = lignes.filter((l) => !retraits.estRetire(l.id));

  // Total exact — jamais de somme via `number`/parseFloat, même côté client
  // pour l'affichage en direct pendant la saisie.
  const total = visibles
    .reduce((acc, l) => acc.plus(new Decimal(l.montant || "0")), new Decimal(0))
    .toFixed(2);

  // La même règle que celle appliquée côté serveur : un écran plus permissif
  // que le serveur laisse le patron devant un bouton qui échoue sans raison.
  const verdict = peutPreparerDevis(visibles);

  async function ajouter() {
    const nouvelle = await ajouterLignePrixAction(chantierId);
    setLignes((cur) => [...cur, { id: nouvelle.id, libelle: nouvelle.libelle, montant: nouvelle.montant }]);
  }

  function modifierLibelle(id: string, libelle: string) {
    setLignes((cur) => cur.map((l) => (l.id === id ? { ...l, libelle } : l)));
  }

  function modifierMontant(id: string, montant: string) {
    setLignes((cur) => cur.map((l) => (l.id === id ? { ...l, montant } : l)));
  }

  async function persisterLibelle(id: string, libelle: string) {
    await modifierLignePrixAction(id, { libelle });
  }

  async function persisterMontant(id: string, montantSaisi: string) {
    // Normalise en chaîne décimale à 2 décimales avant persistance — jamais de
    // float natif transmis ou stocké.
    const decimal = new Decimal(montantSaisi || "0").toFixed(2);
    setLignes((cur) => cur.map((l) => (l.id === id ? { ...l, montant: decimal } : l)));
    await modifierLignePrixAction(id, { montant: decimal });
  }

  async function valider() {
    setValidationEnCours(true);
    setErreurValidation(null);
    try {
      await validerPrixAction(chantierId);
      // Vers le devis, et non plus vers l'écran récapitulatif : celui-ci
      // n'existe plus avant l'envoi (20 août 2026, `ARCHITECTURE.md`).
      router.push(`/chantiers/${chantierId}/devis-complet`);
    } catch {
      // Sans ce message, un refus du serveur ne laissait rien à l'écran : le
      // bouton se réactivait, la page ne bougeait pas, et le patron ne pouvait
      // qu'en conclure que l'application était cassée.
      setErreurValidation(
        "Le devis n'a pas pu être préparé. Vérifiez que chaque ligne porte un montant, puis réessayez."
      );
      setValidationEnCours(false);
    }
  }

  return (
    <>
      {/* Le total — ce qu'on vient lire en premier, et il n'a plus besoin d'une
          boîte pour se voir : la serif de titre suffit. La plage centrée
          d'avant remettait le montant « au-dessus » de la page, exactement ce
          que le patron a écarté en retenant l'écran sans ombres ni cartes.

          Il reste un `<p>` portant l'euro, et le PREMIER de la page : c'est par
          là que `test-devis-doublon-e2e.ts` lit le total pour vérifier qu'un
          retour arrière ne le double pas. */}
      <div className="px-[26px] pt-7">
        <p className={libelleCaps} style={{ color: colors.muted }}>
          Total
        </p>
        <p
          className="mt-3 text-[36px] leading-[1.02]"
          style={{ fontFamily: font.display, letterSpacing: "-0.018em", fontVariantNumeric: "tabular-nums" }}
        >
          {enEuros(total)}
        </p>
        <p className={`mt-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Somme des lignes du détail. C&apos;est cette valeur qui sera reprise dans le devis.
        </p>
      </div>

      {/* Repliée, jamais retirée : le patron qui a choisi d'écrire lui-même doit
          pouvoir changer d'avis sans revenir en arrière. */}
      {propositionVisible ? (
        <PropositionPrixSection
          chantierId={chantierId}
          propositionInitiale={propositionInitiale}
          lignesDetail={lignes}
          onLigneAjoutee={(ligne) => setLignes((cur) => [...cur, ligne])}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPropositionVisible(true)}
          className={`mx-[26px] mt-7 self-start ${libelleCaps}`}
          style={{ color: colors.rust }}
        >
          Voir la proposition de prix →
        </button>
      )}

      <form
        className="mt-8 flex flex-col gap-2 px-[26px]"
        onSubmit={(e) => {
          e.preventDefault();
          valider();
        }}
      >
        <span className={libelleCaps} style={{ color: colors.muted }}>
          Détail
        </span>
        {saisieManuelle && (
          <p className={texteSituation} style={{ color: colors.muted }}>
            Vous écrivez ce devis vous-même. Chaque ligne ci-dessous, avec son montant, est ce que
            votre client recevra.
          </p>
        )}

        {lignes.length > 0 && (
          <div className="flex flex-col gap-1">
            {lignes.map((ligne) => (
              <LigneRetirable
                key={ligne.id}
                libelle={ligne.libelle ? `la ligne ${ligne.libelle}` : "cette ligne"}
                retiree={retraits.estRetire(ligne.id)}
                onRetirer={() =>
                  retraits.retirer(ligne.id, ligne.libelle ? `la ligne ${ligne.libelle}` : "cette ligne")
                }
                hauteurMax={70}
                className="flex items-center gap-2"
              >
                <input
                  value={ligne.libelle}
                  onChange={(e) => modifierLibelle(ligne.id, e.target.value)}
                  onBlur={(e) => persisterLibelle(ligne.id, e.target.value)}
                  className={`min-w-0 flex-1 ${champPlage}`}
                  style={styleChampPlage}
                />
                {/* Les chiffres en chasse fixe : sans cela, deux montants
                    alignés à droite ne s'alignent pas colonne par colonne, et
                    une somme se relit mal. */}
                <input
                  type="number"
                  step="0.01"
                  value={ligne.montant}
                  onChange={(e) => modifierMontant(ligne.id, e.target.value)}
                  onBlur={(e) => persisterMontant(ligne.id, e.target.value)}
                  className="w-[92px] flex-shrink-0 border-0 px-3 py-3 text-right outline-none"
                  style={{ ...styleChampPlage, fontVariantNumeric: "tabular-nums" }}
                />
              </LigneRetirable>
            ))}
          </div>
        )}

        {visibles.length === 0 && (
          <p className={texteSituation} style={{ color: colors.muted }}>
            Aucune ligne pour l&apos;instant.
          </p>
        )}

        <button
          type="button"
          onClick={ajouter}
          className={`self-start ${libelleCaps}`}
          style={{ color: colors.rust }}
        >
          + Ajouter une ligne
        </button>

        <div className="pt-6">
          {/* Un bouton grisé sans explication se lit comme une panne : le
              patron l'a déjà conclu sur l'écran de dictée. On dit donc ce qui
              bloque, et surtout par où sortir.

              Le cheveu d'or à gauche plutôt qu'une plage : ici, quelque chose
              est réellement dû par le patron — c'est le seul emploi que la
              charte reconnaisse à la couleur d'attente. */}
          {!verdict.possible && (
            <div className="mb-5 py-1 pl-[15px]" style={{ borderLeft: `1px solid ${colors.or}` }}>
              <p className="text-[19px] leading-[1.15]" style={{ color: colors.ink, fontFamily: font.display }}>
                {verdict.probleme}
              </p>
              <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
                {verdict.marcheASuivre}
              </p>
              <a href="/reglages" className={`mt-3 inline-block ${libelleCaps}`} style={{ color: colors.rust }}>
                Ouvrir mes tarifs →
              </a>
            </div>
          )}
          <PrimaryButton onClick={valider} disabled={validationEnCours || !verdict.possible}>
            {validationEnCours ? "Validation…" : "Préparer le devis →"}
          </PrimaryButton>
          {erreurValidation && (
            <p role="alert" className={`mt-3 ${texteSituation}`} style={{ color: colors.alert }}>
              {erreurValidation}
            </p>
          )}
        </div>

        {/* Le tiroir vient APRÈS le bouton : il pousse le pied de page vers le
            haut plutôt que de recouvrir « Préparer le devis ». */}
        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
          className="mt-6 !mx-0"
        />
      </form>
    </>
  );
}
