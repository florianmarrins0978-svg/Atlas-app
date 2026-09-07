"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
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
import { ligneAttendSonPrix, peutPreparerDevis } from "@/lib/preparation-devis";
import { montantEcrivable } from "@/lib/montant-ecrivable";
import { enEuros, enMontant } from "@/lib/euros";

type Ligne = {
  id: string;
  libelle: string;
  montant: string;
  /** Le travail est identifié, son prix ne l'est pas (migration 0070). */
  aChiffrer?: boolean | null;
};


export default function PrixClient({
  chantierId,
  initialLignes,
  propositionInitiale,
  saisieManuelle = false,
}: {
  chantierId: string;
  initialLignes: Ligne[];
  propositionInitiale: PropositionPrix | null;
  /** Arrivée par « Écrire le devis » : la proposition part repliée. */
  saisieManuelle?: boolean;
}) {
  const router = useRouter();
  const [propositionVisible, setPropositionVisible] = useState(!saisieManuelle);
  const [lignes, setLignes] = useState<Ligne[]>(initialLignes);
  const [validationEnCours, setValidationEnCours] = useState(false);
  const [erreurValidation, setErreurValidation] = useState<string | null>(null);

  // **Ce qu'il est en train de TAPER, séparé de ce qui est enregistré.**
  //
  // La ligne garde son montant sous la forme que la base attend (« 1240.00 ») ;
  // la case, elle, montre le montant comme il l'écrit (« 1 240,00 »). Sans ces
  // deux états, il faudrait choisir : ou bien la case reformate sous ses doigts
  // au milieu d'une frappe, ou bien elle affiche à un artisan un nombre à
  // l'anglaise. Une entrée disparaît dès qu'elle est enregistrée — la valeur
  // affichée redevient alors celle de la ligne, reformatée.
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  // Le refus d'un montant, ligne par ligne, sous la case où il a été tapé.
  const [refusMontant, setRefusMontant] = useState<Record<string, string>>({});

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

  /**
   * Le montant que porte cette ligne **à cet instant** — sa frappe si elle est
   * lisible, sinon ce qui est enregistré.
   *
   * Le total, le verdict et l'écran lisent tous cette valeur : sans elle, le
   * total attendrait qu'il quitte la case pour bouger, et un chiffre en retard
   * sur ce qu'on voit à l'écran est exactement ce que le §3 interdit.
   */
  function montantEffectif(ligne: Ligne): string {
    const frappe = saisies[ligne.id];
    if (frappe === undefined) return ligne.montant;
    if (frappe.trim() === "") return "0.00";
    const lu = montantEcrivable(frappe);
    return lu.ok ? lu.montant : ligne.montant;
  }

  const aJour = visibles.map((l) => ({ ...l, montant: montantEffectif(l) }));

  // Total exact — jamais de somme via `number`/parseFloat, même côté client
  // pour l'affichage en direct pendant la saisie.
  const total = aJour
    .reduce((acc, l) => acc.plus(new Decimal(l.montant || "0")), new Decimal(0))
    .toFixed(2);

  // La même règle que celle appliquée côté serveur : un écran plus permissif
  // que le serveur laisse le patron devant un bouton qui échoue sans raison.
  const verdict = peutPreparerDevis(aJour);

  // **Combien de lignes attendent encore, comptées par la règle partagée.**
  // `ligneAttendSonPrix` est celle que le serveur, le PDF et l'envoi emploient
  // (`preparation-devis.ts`) : recompter ici « aChiffrer et montant nul »
  // aurait fait une quatrième lecture de la même question, et c'est déjà ce
  // qui avait produit le devis dont le total ne correspondait pas aux lignes.
  const enAttente = aJour.filter(ligneAttendSonPrix);

  async function ajouter() {
    const nouvelle = await ajouterLignePrixAction(chantierId);
    setLignes((cur) => [
      ...cur,
      { id: nouvelle.id, libelle: nouvelle.libelle, montant: nouvelle.montant, aChiffrer: nouvelle.aChiffrer },
    ]);
  }

  function modifierLibelle(id: string, libelle: string) {
    setLignes((cur) => cur.map((l) => (l.id === id ? { ...l, libelle } : l)));
  }

  async function persisterLibelle(id: string, libelle: string) {
    await modifierLignePrixAction(id, { libelle });
  }

  /**
   * Enregistre le montant, ou dit pourquoi il ne s'enregistre pas.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * **LA CASE AVALAIT SA VIRGULE, ET N'EN DISAIT RIEN — 4 septembre 2026.**
   *
   * Elle était un `<input type="number">`, lu par `new Decimal(saisi || "0")`.
   * Un champ numérique **rejette la virgule** : sur un clavier français, taper
   * « 1 400,50 » rend une valeur VIDE, `"" || "0"` vaut zéro, et la ligne
   * partait à **0,00 € sans un mot** — sur le seul écran où il engage de
   * l'argent.
   *
   * C'est la même famille que le défaut corrigé sur le devis le 30 août
   * (`CHANGELOG.md`, « Un prix tapé sur le devis pouvait partir à ZÉRO »), et
   * le devis avait déjà la bonne réponse à côté : un champ de TEXTE avec
   * `inputMode="decimal"`, qui garde ce qu'on tape.
   *
   * **La règle de lecture ne s'écrit pas ici.** `montantEcrivable` existe
   * depuis le 29 août, refuse ce qui n'est pas un nombre, le négatif, la
   * troisième décimale et ce qu'une colonne `numeric(10,2)` ne peut pas
   * contenir — et **nomme le montant en cause**. Le dépôt en portait déjà deux
   * (`montantSaisi`, pour la TVA) ; en écrire une troisième pour l'écran des
   * prix aurait été la faute que le §3 interdit.
   * ═══════════════════════════════════════════════════════════════════════
   */
  async function persisterMontant(id: string, valeurDuChamp: string) {
    // La valeur vient du CHAMP, jamais d'un rendu : le DOM porte déjà ce qui a
    // été tapé, et c'est la seule source qui ne puisse pas être en retard
    // (`CHANGELOG.md`, 30 août 2026).
    const texte = valeurDuChamp.trim();

    // Une case vidée n'est pas une erreur : c'est une ligne qui redevient sans
    // prix. Elle s'enregistre à zéro, et le drapeau « à chiffrer » qu'elle
    // portait éventuellement reste — c'est lui qui empêchera le devis de partir.
    if (texte === "") {
      setRefusMontant((cur) => sans(cur, id));
      setSaisies((cur) => sans(cur, id));
      setLignes((cur) => cur.map((l) => (l.id === id ? { ...l, montant: "0.00" } : l)));
      await modifierLignePrixAction(id, { montant: "0.00" });
      return;
    }

    const lu = montantEcrivable(texte);
    if (!lu.ok) {
      // **On garde ce qu'il a tapé.** Reformater ou vider la case effacerait
      // sous ses yeux le chiffre qu'il vient d'écrire, et il ne saurait plus
      // ce qu'il corrige.
      setRefusMontant((cur) => ({ ...cur, [id]: lu.raison }));
      return;
    }

    setRefusMontant((cur) => sans(cur, id));
    setSaisies((cur) => sans(cur, id));
    // **Poser un prix éteint « à chiffrer ».** Le serveur le fait aussi
    // (`modifierLignePrix`) ; l'écran ne doit pas continuer à refuser le devis
    // après qu'il a fait exactement ce qu'on lui demandait.
    const chiffree = Number(lu.montant) > 0;
    setLignes((cur) =>
      cur.map((l) => (l.id === id ? { ...l, montant: lu.montant, aChiffrer: chiffree ? false : l.aChiffrer } : l))
    );
    await modifierLignePrixAction(id, { montant: lu.montant });
  }

  /**
   * Le geste qui débloque : le doigt arrive sur la première case en attente.
   *
   * **Le refus offrait « Ouvrir mes tarifs » dans ses TROIS cas**, y compris
   * quand deux lignes attendaient leur prix trois centimètres plus haut : le
   * seul geste proposé quittait l'écran où se trouve la réparation. La porte
   * suit désormais la raison.
   *
   * Le champ se retrouve par le DOM, comme sur l'écran du devis
   * (`data-prix-ligne`) : tenir une table de références React à travers les
   * retraits et les ajouts aurait demandé un état de plus pour une question à
   * laquelle la page répond déjà.
   */
  function poserLesMontants() {
    const premiere = enAttente[0] ?? aJour.find((l) => !(Number(l.montant || "0") > 0));
    if (!premiere) return;
    const champ = document.querySelector<HTMLInputElement>(`[data-prix-ligne="${premiere.id}"]`);
    if (!champ) return;
    champ.scrollIntoView({ block: "center", behavior: "smooth" });
    champ.focus();
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
          Voir la proposition de prix
        </button>
      )}

      <form
        className="mt-8 flex flex-col gap-2 px-[26px]"
        onSubmit={(e) => {
          e.preventDefault();
          valider();
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className={libelleCaps} style={{ color: colors.muted }}>
            Détail
          </span>
          {/* **Combien de lignes attendent encore, sans avoir à défiler.**
              Le drapeau « à chiffrer » vivait dans l'état de cet écran depuis
              la migration 0070 et n'était dessiné nulle part : une ligne sans
              prix ressemblait trait pour trait à une ligne qu'on n'avait pas
              remplie. */}
          {enAttente.length > 0 && (
            <span className={`text-right ${libelleCaps}`} style={{ color: colors.orTexte }}>
              {enAttente.length === 1 ? "1 attend son prix" : `${enAttente.length} attendent leur prix`}
            </span>
          )}
        </div>
        {saisieManuelle && (
          <p className={texteSituation} style={{ color: colors.muted }}>
            Vous écrivez ce devis vous-même. Chaque ligne ci-dessous, avec son montant, est ce que
            votre client recevra.
          </p>
        )}

        {lignes.length > 0 && (
          <div className="flex flex-col gap-1">
            {lignes.map((ligne) => {
              const retiree = retraits.estRetire(ligne.id);
              const attend = ligneAttendSonPrix({ ...ligne, montant: montantEffectif(ligne) });
              const refus = refusMontant[ligne.id];
              // **L'allure retenue par le patron le 5 septembre 2026, sur
              // planche** (`appli/ligne-qui-attend-son-prix.html`, la B) : le
              // mot dans la case, ET les deux plages de la ligne passées à
              // l'or. Il a écarté la A, qui ne teintait rien — celle-ci se
              // retrouve **en défilant**, sans lire, et c'est ce qui compte sur
              // un devis qui porte dix lignes.
              //
              // La teinte passe par une classe et non par un style en ligne :
              // `color-mix` n'existe pas avant iOS 16.2, et une couleur
              // inconnue posée en ligne ferait DISPARAÎTRE la plage au lieu de
              // la laisser ordinaire (`globals.css`, `.atlas-plage-attente`).
              const plage = attend
                ? { color: colors.ink, fontSize: "16px", borderRadius: 4 }
                : styleChampPlage;
              const classePlage = attend ? "atlas-plage-attente" : "";
              return (
                <Fragment key={ligne.id}>
                  <LigneRetirable
                    libelle={ligne.libelle ? `la ligne ${ligne.libelle}` : "cette ligne"}
                    retiree={retiree}
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
                      aria-label="Description de la ligne"
                      className={`min-w-0 flex-1 ${champPlage} ${classePlage}`}
                      style={plage}
                    />
                    {/* **Un champ de TEXTE, pas un champ numérique** — voir
                        `persisterMontant`. `inputMode="decimal"` sort le pavé
                        de chiffres du téléphone sans lui interdire sa virgule.

                        Les chiffres en chasse fixe : sans cela, deux montants
                        alignés à droite ne s'alignent pas colonne par colonne,
                        et une somme se relit mal. */}
                    <input
                      type="text"
                      inputMode="decimal"
                      data-prix-ligne={ligne.id}
                      aria-label="Montant de la ligne, en euros"
                      placeholder={attend ? "à chiffrer" : ""}
                      value={saisies[ligne.id] ?? (attend ? "" : enMontant(ligne.montant))}
                      onChange={(e) => setSaisies((cur) => ({ ...cur, [ligne.id]: e.target.value }))}
                      onBlur={(e) => persisterMontant(ligne.id, e.currentTarget.value)}
                      className={`w-[108px] flex-shrink-0 border-0 px-3 py-3 text-right outline-none ${classePlage}`}
                      style={{ ...plage, fontVariantNumeric: "tabular-nums" }}
                    />
                  </LigneRetirable>
                  {refus && !retiree && (
                    <p role="alert" className={`pl-1 ${texteSituation}`} style={{ color: colors.alert }}>
                      {refus}
                    </p>
                  )}
                </Fragment>
              );
            })}
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
              {/* **La porte suit la raison du refus.** Réglages n'a de sens que
                  s'il n'y a aucune ligne : c'est là qu'un tarif enregistré fera
                  chiffrer ce genre de prestation tout seul la prochaine fois.
                  Dès qu'une ligne existe, ce qui manque est un montant, et il
                  se pose ici — l'envoyer aux réglages lui faisait quitter
                  l'écran de la réparation. */}
              {visibles.length === 0 ? (
                <a href="/reglages" className={`mt-3 inline-block ${libelleCaps}`} style={{ color: colors.rust }}>
                  Ouvrir mes tarifs
                </a>
              ) : (
                <button
                  type="button"
                  onClick={poserLesMontants}
                  className={`mt-3 block ${libelleCaps}`}
                  style={{ color: colors.rust }}
                >
                  Poser les montants
                </button>
              )}
            </div>
          )}
          <PrimaryButton onClick={valider} disabled={validationEnCours || !verdict.possible}>
            {validationEnCours ? "Validation…" : "Préparer le devis"}
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

/** Retire une clé sans muter — l'entrée disparaît, elle ne devient pas vide. */
function sans(table: Record<string, string>, cle: string): Record<string, string> {
  if (!(cle in table)) return table;
  const copie = { ...table };
  delete copie[cle];
  return copie;
}
