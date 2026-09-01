"use client";

import { useEffect, useState } from "react";
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
  ajouterTravailSupplementaireAction,
  retirerTravailSupplementaireAction,
} from "./actions";
import { tauxLisible } from "@/lib/ventilation-tva";
import { avecCivilite } from "@/lib/civilite";
import { ECHEANCE_MAX_JOURS } from "@/lib/echeance-facture";
import { jourIso } from "@/lib/jour";

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
  tauxTva: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  lignes: {
    id: string;
    libelle: string;
    montant: string;
    quantite: string;
    unite: string | null;
    prixUnitaire: string;
    /** Ce qui vient du devis, ce qui s'est ajouté à l'arrêt 3 (migration 0073). */
    origine: "devis" | "supplement";
    tauxTva: string;
  }[];
  /**
   * Un socle par taux employé — calculé au serveur par `ventilerTva`, la même
   * fonction que le PDF. Deux calculs finiraient par se contredire sous les
   * yeux du client (`CLAUDE.md` §3).
   */
  socles: { tauxTva: string; ht: string; tva: string }[];
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
}: {
  chantierId: string;
  initialFacture: FacturePourEcran | null;
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
  /**
   * L'échéance : celle du serveur, sauf si CET écran l'a corrigée.
   *
   * **Elle apparaissait avec un écran de retard — trouvé le 1ᵉʳ septembre 2026
   * sur une CAPTURE, et par aucun test.** Cet écran est monté AVANT que la
   * facture existe : « Créer la facture » naît sur la face vide, où
   * `initialFacture` vaut `null`. Un `useState(initialFacture?.dateEcheance)`
   * figeait donc `null`, et `router.refresh()` — qui renouvelle pourtant les
   * props — ne réveille pas un état déjà initialisé : le champ « À régler avant
   * le … » restait invisible jusqu'à un rechargement complet, alors que la base
   * portait bien la date.
   *
   * D'où une valeur DÉRIVÉE plutôt qu'un état miroir : rien à resynchroniser,
   * et pas d'effet qui rappelle `setState` (ce que le lint refuse, à raison).
   */
  const [echeanceCorrigee, setEcheanceCorrigee] = useState<string | null>(null);
  const dateEcheance = echeanceCorrigee ?? initialFacture?.dateEcheance ?? null;
  const [refusEcheance, setRefusEcheance] = useState<string | null>(null);
  const [echeanceEnCours, setEcheanceEnCours] = useState(false);

  async function changerEcheance(valeur: string) {
    if (!initialFacture) return;
    setEcheanceEnCours(true);
    setRefusEcheance(null);
    try {
      const r = await majEcheanceFactureAction(initialFacture.id, valeur);
      // On affiche ce que la BASE porte : une saisie hors bornes y est retombée.
      if (r.succes) setEcheanceCorrigee(r.dateEcheance);
      else setRefusEcheance(r.erreur);
    } finally {
      setEcheanceEnCours(false);
    }
  }

  /**
   * LES TRAVAUX EN PLUS — son idée du 31 août 2026, sa forme du 1ᵉʳ septembre.
   *
   * *« Depuis cette page, avant d'envoyer la facture, il faut pouvoir la
   * modifier en stipulant que c'est du TS. »* Puis, la forme choisie sur la
   * planche : *« code la mienne, déroule sous le bouton »* — le formulaire
   * s'ouvre SOUS le bouton, et non sur un écran à part.
   *
   * **Le taux se choisit à la ligne** (sa question du même message) : un devis
   * à 10 % peut recevoir une terrasse à 20 %, et l'article 268 bis du CGI taxe
   * en entier au taux le plus élevé une facture qui ne ventile pas ses taux.
   */
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  const [tsLibelle, setTsLibelle] = useState("");
  const [tsQuantite, setTsQuantite] = useState("1");
  const [tsUnite, setTsUnite] = useState("");
  const [tsPrix, setTsPrix] = useState("");
  const [tsTaux, setTsTaux] = useState(initialFacture?.tauxTva ?? "20.00");
  const [tsEnCours, setTsEnCours] = useState(false);
  const [tsRefus, setTsRefus] = useState<string | null>(null);

  async function ajouterTs() {
    if (!initialFacture) return;
    setTsEnCours(true);
    setTsRefus(null);
    try {
      const r = await ajouterTravailSupplementaireAction(initialFacture.id, {
        libelle: tsLibelle,
        quantite: tsQuantite,
        unite: tsUnite.trim() || null,
        prixUnitaire: tsPrix,
        tauxTva: tsTaux,
      });
      if (!r.succes) {
        setTsRefus(r.erreur);
        return;
      }
      setTsLibelle("");
      setTsQuantite("1");
      setTsUnite("");
      setTsPrix("");
      // Elle se referme : déroulée, elle pousse le total et le bouton d'envoi
      // hors de l'écran — c'est lui qui l'a relevé avant de choisir cette forme.
      setSaisieOuverte(false);
      // L'écran se relit au serveur plutôt que de recopier les totaux ici :
      // une seconde addition dans le navigateur finirait par diverger de la
      // facture qui part.
      router.refresh();
    } catch {
      setTsRefus("La ligne n'a pas pu être ajoutée.");
    } finally {
      setTsEnCours(false);
    }
  }

  async function retirerTs(ligneId: string) {
    setTsEnCours(true);
    setTsRefus(null);
    try {
      const r = await retirerTravailSupplementaireAction(ligneId);
      if (!r.succes) setTsRefus(r.erreur);
      else router.refresh();
    } catch {
      setTsRefus("La ligne n'a pas pu être retirée.");
    } finally {
      setTsEnCours(false);
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

  // **Deux familles, une seule liste en base** (migration 0073) : ce qui vient
  // du devis, et ce qui s'est ajouté avant l'envoi.
  const lignesDuDevis = initialFacture.lignes.filter((l) => l.origine !== "supplement");
  const lignesEnPlus = initialFacture.lignes.filter((l) => l.origine === "supplement");
  const socles = initialFacture.socles ?? [];

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

      {lignesDuDevis.length > 0 && (
        <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            Reprise du devis
          </p>
          <ul className="flex flex-col gap-2">
            {lignesDuDevis.map((l) => (
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

      {/* ── LES TRAVAUX EN PLUS ────────────────────────────────────────────
          Un bloc À PART, jamais fondu dans les lignes du devis : le client
          retrouve au centime le prix qu'il avait accepté. Fondu, il lit un
          total qui ne correspond plus au devis, et il appelle. */}
      {lignesEnPlus.length > 0 && (
        <div data-atlas="bloc-ts" className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: couleursDocument.accent, marginBottom: 10 }}>
            Travaux supplémentaires
          </p>
          <ul className="flex flex-col gap-3">
            {lignesEnPlus.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="min-w-0 whitespace-pre-line break-words" style={{ color: colors.ink }}>
                  {l.libelle}
                  {/* La quantité, l'unité et le taux SOUS le libellé : une
                      facture doit porter le décompte de chaque prestation, et
                      c'est ici qu'il se relit avant de partir. */}
                  <span className="mt-0.5 block text-[12px]" style={{ color: colors.muted }}>
                    {Number(l.quantite)} {l.unite ?? ""} × {formatEuros.format(Number(l.prixUnitaire))} · TVA{" "}
                    {tauxLisible(l.tauxTva)} %
                  </span>
                </span>
                <span className="flex flex-shrink-0 items-baseline gap-3">
                  <span style={{ color: colors.muted }}>{formatEuros.format(Number(l.montant))}</span>
                  {!emise && (
                    <button
                      type="button"
                      data-atlas="retirer-ts"
                      disabled={tsEnCours}
                      onClick={() => retirerTs(l.id)}
                      aria-label={`Retirer ${l.libelle}`}
                      className="px-1 text-[16px] leading-none"
                      style={{ color: colors.muted }}
                    >
                      ×
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
        <Ligne label="Total HT" valeur={initialFacture.totalHt} />
        {/* **Une ligne de TVA par taux dès qu'il y en a deux** — sa question du
            1ᵉʳ septembre. Le socle est rappelé : « TVA 20 % » seul ne dit pas
            sur quoi elle porte, et c'est ce qu'on vérifie quand deux taux se
            côtoient. Un seul taux : la ligne est exactement celle d'avant. */}
        {socles.length > 1 ? (
          socles.map((socle) => (
            <Ligne
              key={socle.tauxTva}
              label={`TVA ${tauxLisible(socle.tauxTva)} % sur ${formatEuros.format(Number(socle.ht))}`}
              valeur={socle.tva}
            />
          ))
        ) : (
          <Ligne label={`TVA ${tauxLisible(initialFacture.tauxTva)} %`} valeur={initialFacture.totalTva} />
        )}
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
            {formatEuros.format(Number(initialFacture.totalTtc))}
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
          <p className="text-center text-[14px]" style={{ color: colors.muted }}>
            Rien n&apos;a changé depuis le devis ?
          </p>

      {/* ── AJOUTER DES TRAVAUX EN PLUS ────────────────────────────────────
          Sa phrase « Rien n'a changé depuis le devis ? » était déjà là, sans
          réponse possible : elle devient le geste. Le formulaire se DÉROULE
          sous le bouton — sa forme, choisie le 1ᵉʳ septembre.

          Rien de tout cela une fois la facture arrêtée : elle est partie chez
          le client et inscrite au relevé. Le dépôt refuse de toute façon ;
          l'écran n'est qu'une politesse. */}
      {!emise && (
        <div>
          <button
            type="button"
            data-atlas="ouvrir-ts"
            onClick={() => setSaisieOuverte((v) => !v)}
            className="mt-3 block w-full rounded-full px-5 py-3.5 text-[15px]"
            style={{
              fontFamily: font.display,
              color: colors.ink,
              border: `1px solid ${colors.line}`,
              backgroundColor: "transparent",
            }}
          >
            Ajouter des travaux supplémentaires
          </button>

          {saisieOuverte && (
            <div className="mt-4 flex flex-col gap-2">
              <input
                type="text"
                data-atlas="ts-libelle"
                value={tsLibelle}
                onChange={(e) => setTsLibelle(e.target.value)}
                placeholder="Ce qui a été fait en plus"
                // 16 px : sous ce seuil, iOS zoome à la mise au point.
                className="rounded-[4px] px-3 py-3"
                style={{ fontSize: 16, backgroundColor: colors.cream, color: colors.ink, border: `1px solid ${colors.line}` }}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  data-atlas="ts-quantite"
                  value={tsQuantite}
                  onChange={(e) => setTsQuantite(e.target.value)}
                  placeholder="Quantité"
                  className="w-1/4 rounded-[4px] px-3 py-3"
                  style={{ fontSize: 16, backgroundColor: colors.cream, color: colors.ink, border: `1px solid ${colors.line}` }}
                />
                <input
                  type="text"
                  data-atlas="ts-unite"
                  value={tsUnite}
                  onChange={(e) => setTsUnite(e.target.value)}
                  placeholder="Unité"
                  className="w-1/4 rounded-[4px] px-3 py-3"
                  style={{ fontSize: 16, backgroundColor: colors.cream, color: colors.ink, border: `1px solid ${colors.line}` }}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  data-atlas="ts-prix"
                  value={tsPrix}
                  onChange={(e) => setTsPrix(e.target.value)}
                  placeholder="Prix unitaire €"
                  className="w-1/2 rounded-[4px] px-3 py-3"
                  style={{ fontSize: 16, backgroundColor: colors.cream, color: colors.ink, border: `1px solid ${colors.line}` }}
                />
              </div>
              {/* **Le taux de CETTE ligne** : un devis à 10 % peut recevoir une
                  terrasse à 20 %. Trois touches plutôt qu'un champ libre — ce
                  sont les trois seuls taux d'un paysagiste, et un taux tapé de
                  travers part chez le client et dans la déclaration. */}
              <div className="flex gap-2">
                {["20.00", "10.00", "5.50"].map((taux) => (
                  <button
                    key={taux}
                    type="button"
                    data-atlas={`ts-taux-${tauxLisible(taux)}`}
                    aria-pressed={tsTaux === taux}
                    onClick={() => setTsTaux(taux)}
                    className="flex-1 rounded-full py-3 text-[14px]"
                    style={{
                      color: tsTaux === taux ? colors.ink : colors.muted,
                      backgroundColor: tsTaux === taux ? colors.cream : "transparent",
                      border: `1px solid ${tsTaux === taux ? couleursDocument.accent : colors.line}`,
                    }}
                  >
                    TVA {tauxLisible(taux)} %
                  </button>
                ))}
              </div>
              {tsRefus && (
                <p role="alert" data-atlas="ts-refus" className="text-[13px]" style={{ color: colors.alert }}>
                  {tsRefus}
                </p>
              )}
              <PrimaryButton disabled={tsEnCours} onClick={ajouterTs}>
                {tsEnCours ? "Ajout…" : "Ajouter à la facture"}
              </PrimaryButton>
            </div>
          )}
        </div>
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

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between text-[15px]">
      <span style={{ color: colors.muted }}>{label}</span>
      <span style={{ color: colors.ink }}>{formatEuros.format(Number(valeur))}</span>
    </div>
  );
}
