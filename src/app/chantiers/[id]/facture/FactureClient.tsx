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
import ChoixCanal from "@/components/atlas/ChoixCanal";
import TransmettreLaFacture from "./TransmettreLaFacture";
import { terminerChantierAction, emettreFactureAction, preparerLienFactureAction } from "./actions";
import { avecCivilite } from "@/lib/civilite";

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
  dateEcheance: string | null;
  tauxTva: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  lignes: { id: string; libelle: string; montant: string }[];
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
            echeanceLisible: initialFacture.dateEcheance
              ? jourLisible(initialFacture.dateEcheance)
              : null,
            lien: `${origine}/factures/${lien.jeton}`,
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
          {enCours ? "Préparation…" : "Créer la facture →"}
        </PrimaryButton>
      </div>
    );
  }

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
        {initialFacture.dateEcheance && (
          <p className="mt-1 text-[13px]" style={{ color: colors.muted }}>
            À régler avant le {jourLisible(initialFacture.dateEcheance)}
          </p>
        )}
      </div>

      {initialFacture.lignes.length > 0 && (
        <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            Reprise du devis
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
        <Ligne label="Total HT" valeur={initialFacture.totalHt} />
        <Ligne label={`TVA ${Number(initialFacture.tauxTva)} %`} valeur={initialFacture.totalTva} />
        <div className="mt-3 border-t pt-3 text-center" style={{ borderColor: colors.line }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
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
            vérifier (docs/AGENT.md §2.3). */}
        <a
          href={`/api/factures/${initialFacture.id}/pdf`}
          target="_blank"
          rel="noopener"
          className="mt-4 block text-center text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          Voir la facture en PDF →
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
          className="mt-2 block text-center text-[13px]"
          style={{ color: colors.muted }}
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
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.muted }}>
            {regimeTva === "encaissements"
              ? "Elle ne peut plus être modifiée — une correction passerait par un avoir. Elle entrera au relevé de TVA le jour où votre client vous paiera : notez-le dans Ma TVA."
              : "Elle figure au relevé de TVA collectée et ne peut plus être modifiée — une correction passerait par un avoir."}
          </p>

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
              echeanceLisible={
                initialFacture.dateEcheance ? jourLisible(initialFacture.dateEcheance) : null
              }
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

          <p className="text-center text-[12.5px]" style={{ color: colors.muted }}>
            Votre messagerie s&apos;ouvre aussitôt. Rien ne part tant que vous ne l&apos;envoyez pas.
          </p>
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
