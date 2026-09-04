"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps, couleursDocument } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { jourLisible } from "@/lib/jour";
import { composerMessageFacture, lienTransmission, type CanalClient } from "@/lib/message-client";
import { useRetourDeMessagerie, marquerDepartMessagerie } from "@/lib/depart-messagerie";
import { ouvrirAdresse } from "@/lib/ouvrir-messagerie";
import { adressePourLeClient, ouvrableParLeClient, phraseAdresseLocale } from "@/lib/adresse-du-client";
import ChoixCanal from "@/components/atlas/ChoixCanal";
import TransmettreLaFacture from "./TransmettreLaFacture";
import {
  terminerChantierAction,
  emettreFactureAction,
  preparerLienFactureAction,
  majEcheanceFactureAction,
  reprendreLeDevisAction,
} from "./actions";
import { avecCivilite } from "@/lib/civilite";
import { ECHEANCE_MAX_JOURS } from "@/lib/echeance-facture";
import { jourIso } from "@/lib/jour";
import { libelleReduction, tauxLisible, totauxAvecReduction } from "@/lib/reduction-devis";
import type { EtatDeReprise } from "@/lib/facture-face-au-devis";

// Arrêt 3 (docs/AGENT.md §2.3). Cet écran EST le contrôle : les montants du
// devis sont déjà là, il n'y a rien à saisir. Franchissable en un geste quand
// rien n'a bougé — mais franchi par le patron, jamais par l'application.

const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type FacturePourEcran = {
  id: string;
  numeroCommercial: string;
  statut: "brouillon" | "emise";
  clientNom: string | null;
  /** Recopiée sur la facture à son établissement (migration 0038). */
  clientCivilite: "mr" | "mme" | null;
  /** La date de la facture — borne basse de l'échéance modifiable. */
  dateEmission: string;
  dateEcheance: string | null;
  /** Le devis dont ces lignes viennent — le PDF le nomme, l'écran doit le nommer aussi. */
  numeroDevis: string | null;
  versionDevis: number | null;
  tauxTva: string;
  /** Le prix accordé au client, recopié du devis. `null` : aucun. */
  reductionPourcent: string | null;
  /**
   * **Les totaux ne sont PLUS transmis, et c'est délibéré.**
   *
   * Ils se recalculent ici par `totauxAvecReduction` — l'appel exact que fait
   * `emettreFacture` juste avant de figer la pièce. L'écran montre donc ce qui
   * PARTIRA, jamais une colonne de base qui aurait pu prendre du retard sur ses
   * lignes. Une seule règle pour l'affichage et pour l'émission (`CLAUDE.md` §3).
   */
  lignes: { id: string; libelle: string; montant: string; tauxTva: string | null }[];
};

export default function FactureClient({
  chantierId,
  initialFacture,
  origine,
  entrepriseNom,
  modeleMessage,
  clientId,
  clientTelephone,
  clientEmail,
  canalClient,
  jetonDejaPrepare = null,
  regimeTva,
  reprise,
}: {
  chantierId: string;
  initialFacture: FacturePourEcran | null;
  /**
   * La facture reprend-elle encore le devis qui fait foi ?
   *
   * Calculée au serveur par une fonction pure (`src/lib/facture-face-au-devis.ts`).
   * L'écran ne décide de rien : il montre ce qu'elle dit, et porte le geste.
   */
  reprise: EtatDeReprise;
  /** Adresse complète du site, bâtie côté serveur : un chemin seul ne s'ouvre nulle part. */
  origine: string;
  entrepriseNom: string;
  /**
   * Son gabarit de message, écrit dans « Devis & factures ». `null` : Atlas.
   *
   * **`modeleMessage`, jamais `messageClient`** : ce nom est pris ailleurs dans
   * l'application, où il désigne le mot laissé par le CLIENT — l'inverse.
   */
  modeleMessage: string | null;
  clientId: string | null;
  clientTelephone: string | null;
  clientEmail: string | null;
  canalClient: CanalClient | null;
  /**
   * Le lien du client, s'il a déjà été préparé.
   *
   * Depuis le geste unique du 22 août 2026, l'envoi le fabrique en même temps
   * qu'il arrête la facture. Sans cette valeur, l'écran d'après redemanderait de
   * le préparer — un second appui pour refaire ce qui vient d'être fait.
   */
  jetonDejaPrepare?: string | null;
  /**
   * Quand la TVA devient exigible chez cette entreprise (migration 0045).
   *
   * **La phrase qui suit l'émission en dépend, et ce n'est pas cosmétique.**
   * Aux encaissements, une facture arrêtée ne figure PAS au relevé : elle
   * attend son règlement. Lui dire l'inverse — ce que cet écran faisait — lui
   * ferait chercher dans son relevé un montant qui n'y est pas, et douter de
   * l'application au lieu de noter son paiement.
   */
  regimeTva: "encaissements" | "debits";
}) {
  const router = useRouter();
  useRetourDeMessagerie();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [emise, setEmise] = useState(initialFacture?.statut === "emise");

  // L'échéance — proposée par défaut à la création (son délai de paiement, ou
  // 30 jours), et modifiable ICI tant que la facture n'est pas arrêtée. Sa
  // demande du 25 août : « qu'il puisse la modifier », et si elle part sans
  // qu'il y touche, elle part quand même avec une VRAIE date, jamais un vide.
  const [dateEcheance, setDateEcheance] = useState<string | null>(initialFacture?.dateEcheance ?? null);
  const [refusEcheance, setRefusEcheance] = useState<string | null>(null);
  const [echeanceEnCours, setEcheanceEnCours] = useState(false);

  async function changerEcheance(valeur: string) {
    if (!initialFacture) return;
    setEcheanceEnCours(true);
    setRefusEcheance(null);
    try {
      const r = await majEcheanceFactureAction(initialFacture.id, valeur);
      // On affiche ce que la BASE porte : une saisie hors bornes y est retombée.
      if (r.succes) setDateEcheance(r.dateEcheance);
      else setRefusEcheance(r.erreur);
    } finally {
      setEcheanceEnCours(false);
    }
  }

  // Le canal convenu avec le client ; à défaut, celui dont on a la coordonnée.
  // Ce n'est qu'un DÉPART : depuis le 12 août, l'écran offre l'autre voie sans
  // rien demander (`TransmettreLaFacture`). Auparavant ce choix était définitif,
  // et un client sans portable ne pouvait pas être facturé du tout.
  const canal: CanalClient = canalClient ?? (clientTelephone ? "sms" : "email");

  /**
   * Le canal de CET envoi — choisi sur l'écran, à côté du bouton.
   *
   * **Sa demande du 22 août 2026** (planche 84, proposition B) : *« au-dessus du
   * bouton, remettre le petit encart, soit SMS soit e-mail, et l'utilisateur
   * choisit »*. Il part de l'accord passé avec le client, et se corrige d'un
   * doigt sans quitter l'écran.
   */
  const [canalEnvoi, setCanalEnvoi] = useState<CanalClient>(canal);
  const destinataire = (canalEnvoi === "sms" ? clientTelephone : clientEmail) ?? "";

  const [repriseEnCours, setRepriseEnCours] = useState(false);

  /**
   * Reprend le dernier devis envoyé sur la facture encore en brouillon.
   *
   * Le geste que le refus juste au-dessus désigne : sans lui, l'écran dirait
   * « votre facture ne suit plus votre devis » sans offrir la moindre issue.
   */
  async function reprendreLeDevis() {
    if (!initialFacture) return;
    setRepriseEnCours(true);
    setErreur(null);
    try {
      const r = await reprendreLeDevisAction(initialFacture.id);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      // Les lignes et les montants viennent d'être réécrits côté serveur : on
      // relit l'écran plutôt que d'en reconstruire une copie ici.
      router.refresh();
    } catch {
      setErreur("Le devis n'a pas pu être repris.");
    } finally {
      setRepriseEnCours(false);
    }
  }

  async function terminer() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await terminerChantierAction(chantierId);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      // La facture vient d'être bâtie côté serveur : on relit l'écran plutôt
      // que d'en reconstruire une copie ici, qui pourrait s'en écarter.
      router.refresh();
    } catch {
      setErreur("La facture n'a pas pu être préparée.");
    } finally {
      setEnCours(false);
    }
  }

  /**
   * **UN SEUL GESTE : arrêter la facture, et ouvrir sa messagerie.**
   *
   * Le patron, le 22 août 2026, capture à l'appui : *« quand je clique sur
   * confirmer le départ de la facture, ça me l'arrête. Après, je clique pour
   * l'envoyer. Ensuite, je dois recliquer pour ouvrir l'application SMS. Ça
   * fait beaucoup trop de clics. »* Il en comptait trois ; il en reste un.
   * Retenu sur planche (`docs/maquettes/84-envoyer-la-facture.html`,
   * proposition B).
   *
   * ── L'ORDRE N'EST PAS UN DÉTAIL ──────────────────────────────────────────
   *
   * La messagerie s'ouvre **avant** de rafraîchir l'écran. Un navigateur peut
   * refuser une navigation vers `sms:` qui ne suit pas le doigt d'assez près,
   * et iOS la refuse **sans un mot** ; rafraîchir d'abord, c'est perdre le
   * geste. C'est le même ordre que l'envoi du devis, pour la même raison.
   *
   * ── CE QUI RESTE DERRIÈRE, ET POURQUOI ───────────────────────────────────
   *
   * Si l'ouverture est refusée, l'écran d'après porte toujours
   * `TransmettreLaFacture` — le message tout prêt, avec son bouton. La facture
   * est alors arrêtée sans être partie, et **c'est exactement ce que la
   * proposition A taisait** : le mot « envoyer » ne dit pas l'arrêt. D'où les
   * deux lignes sous le bouton, qui le disent.
   */
  async function envoyerLaFacture() {
    if (!initialFacture) return;
    setEnCours(true);
    setErreur(null);
    try {
      const emission = await emettreFactureAction(initialFacture.id);
      if (!emission.succes) {
        setErreur(emission.erreur);
        return;
      }
      setEmise(true);

      const lien = await preparerLienFactureAction(initialFacture.id, canalEnvoi);
      if (!lien.succes) {
        // **La facture EST arrêtée, et il doit le savoir.** Taire l'émission
        // parce que le lien a manqué lui ferait croire que rien n'a eu lieu —
        // et il rappuierait sur un bouton qui a déjà engagé sa comptabilité.
        setErreur(
          `Facture arrêtée, mais le lien n'a pas pu être préparé — ${lien.erreur} ` +
            `Le message tout prêt vous attend ci-dessous.`
        );
        router.refresh();
        return;
      }

      // **LE MESSAGE MORT NE PART PAS — posé le 24 août 2026.** Le lien prend
      // l'adresse par laquelle Atlas est ouvert ; celle d'une redirection de
      // port ne désigne que sa machine, et son client reçoit « Connexion au
      // serveur impossible » (`ARCHITECTURE.md` §169).
      //
      // **La facture est déjà ARRÊTÉE ici**, et c'est tout le sens du refus :
      // on ne défait pas son émission — elle a engagé sa comptabilité — on
      // barre le seul message qui n'arriverait nulle part. L'écran d'après
      // porte `TransmettreLaFacture`, qui redit la même chose sous le bouton.
      // L'adresse du navigateur d'abord : derrière le tunnel de son espace de
      // travail, le serveur ne voit que `localhost` (`adressePourLeClient`).
      const adresse = adressePourLeClient(origine);
      if (!ouvrableParLeClient(adresse)) {
        setErreur(phraseAdresseLocale("votre facture"));
        router.refresh();
        return;
      }

      marquerDepartMessagerie("facture", initialFacture.clientNom ?? "");
      ouvrirAdresse(
        lienTransmission({
          canal: canalEnvoi,
          destinataire,
          message: composerMessageFacture({
            clientCivilite: initialFacture.clientCivilite,
            clientNom: initialFacture.clientNom ?? "",
            entrepriseNom,
            modele: modeleMessage,
            numeroFacture: initialFacture.numeroCommercial,
            echeanceLisible: dateEcheance ? jourLisible(dateEcheance) : null,
            lien: `${adresse}/factures/${lien.jeton}`,
          }),
        }),
        canalEnvoi
      );

      // Après l'ouverture, jamais avant : l'écran repasse alors sur sa face
      // « arrêtée », qui porte le message tout prêt si la messagerie a refusé.
      router.refresh();
    } catch {
      setErreur("La facture n'a pas pu être envoyée.");
    } finally {
      setEnCours(false);
    }
  }


  if (!initialFacture) {
    return (
      <div className="mt-6 flex flex-col gap-4 px-6">
        <div className="rounded-[4px] px-5 py-6" style={{ backgroundColor: colors.card }}>
          <p className="text-center text-[15px]" style={{ color: colors.ink }}>
            Le chantier est réalisé ?
          </p>
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.muted }}>
            La facture sera préparée à partir du devis. Rien ne part avant votre
            confirmation.
          </p>
        </div>
        {erreur && (
          <p role="alert" className="text-center text-[13px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}
        <PrimaryButton disabled={enCours} onClick={terminer}>
          {enCours ? "Préparation…" : "Créer la facture"}
        </PrimaryButton>
      </div>
    );
  }

  // **LE MÊME CALCUL QUE L'ÉMISSION, appelé et non réécrit.** `emettreFacture`
  // fige la pièce sur `totauxAvecReduction(lignes, tauxTva, reductionPourcent)` :
  // l'écran de l'arrêt doit montrer ce chiffre-là, et pas une colonne de base
  // qui aurait pu prendre du retard sur ses propres lignes.
  const totaux = totauxAvecReduction(
    initialFacture.lignes,
    initialFacture.tauxTva,
    initialFacture.reductionPourcent
  );
  const libelleRemise = libelleReduction(totaux.reductionPourcent);

  // La borne haute du sélecteur : un an après la facture (au-delà, c'est
  // l'année mal tapée). La borne basse est la date de la facture elle-même.
  const maxEcheance = jourIso(
    new Date(Date.parse(`${initialFacture.dateEmission}T00:00:00Z`) + ECHEANCE_MAX_JOURS * 86_400_000)
  );

  return (
    <div className="mt-6 flex flex-col gap-4 px-6">
      <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
        <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
          Facture
        </p>
        <p className="text-[15px]" style={{ color: colors.ink }}>
          <NumeroDeDocument valeur={initialFacture.numeroCommercial} /> —{" "}
          {avecCivilite(initialFacture.clientNom, initialFacture.clientCivilite) || "Client non renseigné"}
        </p>
        {/* L'ÉCHÉANCE — proposée, et modifiable tant que la facture n'est pas
            arrêtée (sa demande du 25 août). Émise, elle est partie chez le
            client et inscrite au relevé : on la fige. */}
        {dateEcheance && (
          <div className="mt-1.5">
            {emise ? (
              <p className="text-[13px]" style={{ color: colors.muted }}>
                À régler avant le {jourLisible(dateEcheance)}
              </p>
            ) : (
              <>
                <label className="flex flex-wrap items-center gap-2 text-[13px]" style={{ color: colors.muted }}>
                  À régler avant le
                  <input
                    type="date"
                    data-atlas="echeance-facture"
                    value={dateEcheance}
                    min={initialFacture.dateEmission}
                    max={maxEcheance}
                    disabled={echeanceEnCours}
                    onChange={(e) => {
                      if (e.target.value) changerEcheance(e.target.value);
                    }}
                    // 16 px : sous ce seuil, iOS zoome à l'ouverture du sélecteur.
                    className="rounded-[4px] px-2 py-1"
                    style={{
                      fontSize: 16,
                      backgroundColor: colors.cream,
                      color: colors.ink,
                      border: `1px solid ${refusEcheance ? colors.alert : colors.line}`,
                    }}
                  />
                </label>
                {refusEcheance && (
                  <p role="alert" data-atlas="echeance-refus" className="mt-1 text-[12px]" style={{ color: colors.alert }}>
                    {refusEcheance}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── LA FACTURE NE SUIT PLUS LE DEVIS ────────────────────────────────
          **Le défaut le plus cher de cet écran, et il était muet.** Une facture
          bâtie à la fin du chantier garde les lignes du devis d'alors ; un devis
          corrigé et renvoyé ensuite ne l'atteignait jamais. Il confirmait donc
          l'ancien prix, sur le seul écran qui engage son argent.

          **Ce bloc passe AVANT les montants**, et c'est tout son sens : lu après,
          il arriverait une fois le total déjà cru. */}
      {!reprise.aJour && (
        <div
          className="py-1 pl-[13px]"
          style={{ borderLeft: `1px solid ${colors.alert}` }}
          data-atlas="facture-en-retard-sur-le-devis"
        >
          <p className="text-[13px] leading-[1.4]" style={{ color: colors.ink }}>
            Le devis <NumeroDeDocument valeur={reprise.numeroCommercial} /> v
            {reprise.numeroVersion} est parti depuis. Cette facture porte encore
            les montants d&apos;avant.
          </p>
          <div className="mt-2">
            <PrimaryButton
              secondaire
              disabled={repriseEnCours}
              onClick={reprendreLeDevis}
              repere="reprendre-le-devis"
            >
              {repriseEnCours ? "Reprise…" : "Reprendre ce devis"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {initialFacture.lignes.length > 0 && (
        <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          {/* **Le devis se NOMME.** Le papier écrit « Établie à partir du devis
              n° … » depuis toujours ; l'écran disait « Reprise du devis » sans
              dire lequel — c'est-à-dire sans rien dire du tout le jour où il y
              en a deux. */}
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            {initialFacture.numeroDevis ? (
              <>
                Reprise du devis <NumeroDeDocument valeur={initialFacture.numeroDevis} />
                {/* **La version s'écrit TOUJOURS, même la première.** Vu sur la
                    capture du 4 septembre : les deux versions d'un devis portent
                    le MÊME numéro commercial, si bien que l'écran affichait
                    « Reprise du devis 2026-000003 » juste au-dessus de « Le devis
                    2026-000003 est parti depuis ». Deux fois le même numéro, l'un
                    dit périmé et l'autre pas : c'est illisible. Trois caractères
                    lèvent toute l'ambiguïté. */}
                {initialFacture.versionDevis ? ` v${initialFacture.versionDevis}` : ""}
              </>
            ) : (
              "Reprise du devis"
            )}
          </p>
          <ul className="flex flex-col gap-2">
            {initialFacture.lignes.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-4 text-[15px]">
                {/* **Les travaux réunis s'empilent, un par ligne.** Depuis que
                    le devis sépare ses prestations par un retour à la ligne
                    (7 août, `src/lib/lignes-vendables.ts`), un `truncate`
                    affichait « Abattage d'un chêne mort Br… » : les lignes
                    fondues en une seule, puis coupées. Et c'est à cet écran-là
                    que le patron est censé vérifier avant que la facture parte
                    (arrêt 3) — lui cacher la moitié de ce qu'il facture est
                    exactement ce qu'il ne faut pas faire. Le PDF du client,
                    lui, a toujours respecté les retours à la ligne. */}
                <span className="min-w-0 whitespace-pre-line break-words" style={{ color: colors.ink }}>
                  {l.libelle}
                </span>
                <span className="flex-shrink-0" style={{ color: colors.muted }}>
                  {formatEuros.format(Number(l.montant))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
        {/* ── LE TOTAL SE RECOMPOSE À LA MAIN, LIGNE À LIGNE ─────────────────
            **Deux choses manquaient ici, et le papier les imprimait toutes les
            deux.** Le prix accordé au client : la somme des lignes au-dessus ne
            faisait alors pas le Total HT écrit ici, et rien ne disait pourquoi.
            Et les taux : chaque ligne porte le sien depuis la migration 0073,
            l'écran n'en annonçait qu'un.

            Un total qu'on ne peut pas refaire de tête est un total qu'on cesse
            de croire — et c'est LUI qui le défend devant son client. Les
            libellés et l'ordre sont ceux du papier (`document-commun.ts`), tirés
            de la même fonction : deux rédactions du même prix accordé finiraient
            par se contredire. */}
        {libelleRemise ? (
          <>
            <Ligne label="Total HT" valeur={totaux.brutHt} />
            <Ligne label={libelleRemise} valeur={totaux.reductionMontant ?? "0"} retire />
            <Ligne label="Total HT après remise" valeur={totaux.totalHt} />
          </>
        ) : (
          <Ligne label="Total HT" valeur={totaux.totalHt} />
        )}
        {totaux.parTaux.map((categorie) => (
          <Ligne
            key={categorie.taux}
            label={`TVA ${tauxLisible(categorie.taux)} %`}
            valeur={categorie.tva}
          />
        ))}
        <div className="mt-3 border-t pt-3 text-center" style={{ borderColor: colors.line }}>
          {/* **En noir, pas en gris** — sa demande du 24 août 2026, capture à
              l'appui. C'est l'intitulé du montant qu'il vérifie ; en gris, il
              passait pour une mention de bas de page. */}
          <p className={smallCaps} style={{ color: colors.ink, marginBottom: 6 }}>
            Total TTC
          </p>
          <p
            className="text-[32px] font-semibold leading-none"
            // Le montant que le client verra sur sa facture porte la teinte
            // des documents, pas l'accent de l'application : le patron a
            // demandé « terre cuite pour le devis, idem pour la facture ».
            style={{ fontFamily: font.display, color: couleursDocument.accent }}
          >
            {formatEuros.format(Number(totaux.totalTtc))}
          </p>
        </div>

        {/* Sans ce lien, la facture existe sans que personne puisse la
            regarder : le patron valide un montant sans avoir vu la pièce que
            son client recevra. C'est justement ce que l'arrêt 3 lui demande de
            vérifier (docs/AGENT.md §2.3).

            **Sans flèche, mais SOULIGNÉ** — sa demande du 24 août 2026 :
            *« enlève la petite flèche, mais un petit plus pour qu'on comprenne
            que c'est cliquable »*. La flèche partie, il ne restait qu'une ligne
            de texte teintée : rien ne disait qu'on pouvait appuyer dessus. Le
            soulignement se lit comme un lien partout, sans ajouter un signe de
            plus à l'écran. */}
        <a
          href={`/api/factures/${initialFacture.id}/pdf`}
          target="_blank"
          rel="noopener"
          className="mt-4 block text-center text-[14px] font-medium underline underline-offset-4"
          style={{ color: colors.rust }}
        >
          Voir la facture en PDF
        </a>

        {/* **Ouvrir n'est pas garder.** Le patron, le 10 août 2026 : il ne
            pouvait que regarder la facture, jamais la ranger sur son téléphone
            ou son ordinateur (`TODO.md` §8). Le nom du fichier porte le numéro
            — « F2026-0001.pdf », pas « facture.pdf » : il en aura des centaines
            dans le même dossier, et « facture (17).pdf » ne se retrouve pas.
            L'attribut `download` ne suffit pas seul (iOS l'ignore selon les
            versions) : la route répond `Content-Disposition: attachment` sur
            `?telecharger=1`, et c'est elle qui fait foi. */}
        <a
          href={`/api/factures/${initialFacture.id}/pdf?telecharger=1`}
          download={nomDuFichier(initialFacture, emise)}
          data-atlas="telecharger-facture"
          className="mt-2 block text-center text-[13px] underline underline-offset-4"
          style={{ color: colors.ink }}
        >
          Télécharger ({nomDuFichier(initialFacture, emise)})
        </a>
      </div>

      {erreur && (
        <p role="alert" className="text-center text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {emise ? (
        <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className="text-center text-[15px]" style={{ color: colors.ink }}>
            Facture <NumeroDeDocument valeur={initialFacture.numeroCommercial} /> arrêtée.
          </p>
          {/* **Le paragraphe qui vivait ici est RETIRÉ** — sa demande du
              24 août 2026 : *« tout ce qui est en gris sous facture F2026,
              supprime »*. Il expliquait l'avoir et le relevé de TVA ; c'est un
              mécanisme, et sa règle est claire (`CLAUDE.md` §3 ter). Ce qui
              compte pour lui à cet instant tient dans la ligne au-dessus : la
              facture est arrêtée. Le reste, il le retrouve dans « Ma TVA ».

              **Ne pas le remettre au prochain doute** : une suite qui le
              réclamerait serait à corriger, pas l'écran (`CLAUDE.md` §5 bis). */}

          {/* **« Arrêtée » n'est pas « partie ».**
              Le patron a lu « facture arrêtée » et compris que son client
              l'avait reçue. Rien ne la portait jusqu'à lui. Ce qui suit est le
              seul départ réel : Atlas prépare le message, le patron l'expédie
              depuis sa propre messagerie (`docs/A-FAIRE.md` §5). */}
          <div className="mt-5" style={{ borderTop: `1px solid ${colors.lineSoft}`, paddingTop: 16 }}>
            <TransmettreLaFacture
              factureId={initialFacture.id}
              clientId={clientId}
              clientNom={initialFacture.clientNom ?? ""}
              clientCivilite={initialFacture.clientCivilite}
              entrepriseNom={entrepriseNom}
              modeleMessage={modeleMessage}
              numeroFacture={initialFacture.numeroCommercial}
              echeanceLisible={dateEcheance ? jourLisible(dateEcheance) : null}
              canal={canalEnvoi}
              jetonInitial={jetonDejaPrepare}
              telephone={clientTelephone ?? ""}
              email={clientEmail ?? ""}
              origine={origine}
            />
          </div>
        </div>
      ) : (
        <>
          {/* **La question se tait quand la réponse est déjà écrite.** Vu sur
              la capture du 4 septembre : le bandeau du dessus annonce qu'un
              devis plus récent est parti, et l'écran demandait quatre blocs
              plus bas « Rien n'a changé depuis le devis ? ». Un écran qui se
              contredit lui-même fait douter de tout ce qu'il affiche. */}
          {reprise.aJour && (
            <p className="text-center text-[14px]" style={{ color: colors.muted }}>
              Rien n&apos;a changé depuis le devis ?
            </p>
          )}

          {/* **L'encart du canal, à la forme de la fiche client — sa demande du
              22 août 2026 :** *« le choix SMS ou e-mail, mais de la même forme
              que sur la page fiche client »*. C'est la MÊME capsule, extraite
              pour l'occasion (`ChoixCanal`) : deux dessins du même geste
              auraient divergé au premier ajustement.

              **Un canal sans coordonnée reste inerte, et c'est sa règle :**
              *« refuse l'envoi : ça veut dire qu'il communique avec le client
              par SMS, donc il enverra par SMS »*. Aucun champ de saisie ici —
              il a écarté l'idée. */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className={smallCaps} style={{ color: colors.muted }}>
              Comment lui envoyer sa facture ?
            </legend>
            <div className="flex gap-2">
              <ChoixCanal
                libelle="Par SMS"
                actif={canalEnvoi === "sms"}
                disponible={Boolean(clientTelephone)}
                onClick={() => setCanalEnvoi("sms")}
              />
              <ChoixCanal
                libelle="Par e-mail"
                actif={canalEnvoi === "email"}
                disponible={Boolean(clientEmail)}
                onClick={() => setCanalEnvoi("email")}
              />
            </div>
            <p className="text-center text-[12.5px]" style={{ color: colors.muted }}>
              {destinataire
                ? `${canalEnvoi === "sms" ? "Au" : "À"} ${destinataire}`
                : "Aucune coordonnée pour ce canal."}
            </p>
          </fieldset>

          {/* **Sans flèche**, et le mot dit l'envoi : *« arrêter la facture, tu
              mets envoyer la facture sans la flèche »*. */}
          <PrimaryButton
            disabled={enCours || !destinataire}
            onClick={envoyerLaFacture}
            // **Un repère stable, pour que le contrôle accuse le bon coupable.**
            // Attendu par son LIBELLÉ, il mourait sur un délai dépassé dès que le
            // mot changeait — un rouge qui n'apprend rien. Repéré ainsi, la suite
            // trouve le bouton, puis dit ce qui cloche dans ce qu'il porte.
            repere="envoyer-la-facture"
          >
            {enCours ? "Envoi…" : "Envoyer la facture"}
          </PrimaryButton>

          {/* **CE QUE LE BOUTON ENGAGE, dit sous lui — proposition B.**

              Le libellé qu'il a choisi parle d'envoi ; l'appui, lui, ARRÊTE la
              facture, et c'est sans retour. Deux gestes séparés le lui
              rappelaient ; avec un seul, ces deux lignes sont tout ce qui
              reste. Il ne les relira pas deux fois — elles seront là le jour où
              il se demandera pourquoi sa facture ne se modifie plus. */}
          <div className="py-1 pl-[13px]" style={{ borderLeft: `1px solid ${colors.or}` }}>
            <p className="text-[13px] leading-[1.4]" style={{ color: colors.ink }}>
              En l&apos;envoyant, vous l&apos;arrêtez :{" "}
              {regimeTva === "encaissements"
                ? "elle ne se modifie plus, et entrera au relevé de TVA le jour où votre client vous paiera."
                : "elle entre dans votre TVA et ne se modifie plus."}
            </p>
            <p className="mt-[3px] text-[12px]" style={{ color: colors.muted }}>
              Une correction passerait par un avoir.
            </p>
          </div>

          {/* **« Votre messagerie s'ouvre aussitôt » a été RETIRÉ le 25 août
              2026**, à sa demande, capture à l'appui : *« supprime le message
              en gris »*.

              Elle avait sa raison le 22 août, quand les trois appuis sont
              devenus un : il fallait dire que le geste ouvrait la messagerie
              sans rien envoyer. Depuis, il l'a fait des dizaines de fois — la
              phrase n'apprenait plus rien et poussait vers le bas
              l'avertissement qui, lui, compte : la facture s'arrête.

              **Ne pas la remettre au motif qu'elle rassure.** L'encadré doré
              au-dessus dit déjà ce que le geste engage, et c'est le seul qui
              doive être lu. */}
        </>
      )}
    </div>
  );
}

/**
 * Le nom du fichier que le patron retrouvera dans son dossier.
 *
 * Il dit le NUMÉRO et l'ÉTAT : deux fichiers de la même facture peuvent
 * cohabiter — celui qu'il a regardé avant d'arrêter, et celui que son client a
 * reçu — et rien d'autre ne dirait lequel est lequel. Le même mot est écrit à
 * l'écran, pour qu'il sache avant d'appuyer ce qu'il va trouver après.
 *
 * La règle est ici ET dans la route (`api/factures/[id]/pdf`), et c'est la
 * seule duplication assumée : l'attribut `download` du navigateur ne traverse
 * pas jusqu'au serveur, et l'en-tête du serveur ne remonte pas jusqu'au
 * libellé. Deux suites les comparent (`test-facture-au-client-e2e.ts`,
 * `capture-facture.mts`) — sans quoi elles divergeraient en silence.
 *
 * **Et elles ont divergé, au premier jet.** L'état venait d'`initialFacture`,
 * qui est le rendu du serveur à l'ARRIVÉE sur l'écran : après l'arrêt de la
 * facture, sans rechargement, il annonçait encore un brouillon pendant que le
 * serveur servait la pièce définitive. Le patron aurait cherché
 * « F2026-0001-brouillon.pdf » dans un dossier qui contient
 * « F2026-0001.pdf ». On lit donc `emise`, l'état vivant de l'écran.
 */
function nomDuFichier(f: FacturePourEcran, emise: boolean): string {
  return emise ? `${f.numeroCommercial}.pdf` : `${f.numeroCommercial}-brouillon.pdf`;
}

/**
 * Une ligne de total.
 *
 * `retire` écrit le montant en négatif — le prix accordé au client, et lui seul.
 * Le signe est devant le montant comme sur le papier : sans lui, la remise se lit
 * comme un ajout, et la soustraction imprimée dessous devient incompréhensible.
 *
 * L'espacement et le `flex-shrink-0` ne sont pas cosmétiques : « Prix accordé au
 * client 15 % » et son montant se disputent les 390 px de son téléphone.
 */
function Ligne({
  label,
  valeur,
  retire = false,
}: {
  label: string;
  valeur: string;
  retire?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[15px]">
      <span style={{ color: colors.muted }}>{label}</span>
      <span className="flex-shrink-0" style={{ color: colors.ink }}>
        {retire ? `- ${formatEuros.format(Number(valeur))}` : formatEuros.format(Number(valeur))}
      </span>
    </div>
  );
}
