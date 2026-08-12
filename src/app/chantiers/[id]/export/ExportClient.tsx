"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import TransmettreAuClient from "./TransmettreAuClient";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { etatEnvoiExplication, etatEnvoiLabel, type EtatEnvoi } from "@/lib/etat-envoi";
import { reprendreDevisAction } from "./actions";
import EnvoiAuClient from "./EnvoiAuClient";
import { enEuros } from "@/lib/euros";


export default function ExportClient({
  chantierId,
  devisId,
  clientId,
  chantierNom,
  adresseChantier,
  clientNom,
  clientTelephone,
  clientEmail,
  entrepriseNom,
  canalClient,
  prestations,
  lignes,
  totalTtc,
  numeroDevis,
  initialEnvoye,
  etatEnvoi,
  messageClient,
  lienEnvoi,
  origine,
}: {
  chantierId: string;
  devisId: string;
  /** Nécessaire pour compléter une coordonnée manquante depuis cet écran. */
  clientId: string | null;
  chantierNom: string;
  adresseChantier: string;
  clientNom: string;
  clientTelephone: string;
  clientEmail: string;
  entrepriseNom: string;
  canalClient: "sms" | "email";
  prestations: string[];
  /** Les lignes du devis lui-même : libellé et montant, telles qu'imprimées. */
  lignes: { libelle: string; montant: string }[];
  totalTtc: string;
  /** Le numéro commercial, pour nommer le fichier téléchargé. */
  numeroDevis: string;
  initialEnvoye: boolean;
  etatEnvoi: EtatEnvoi;
  /** Ce que le client a écrit, mot pour mot. Vide s'il n'a rien dit. */
  messageClient: string | null;
  /** Le lien encore actif, tant que le client n'a pas répondu. */
  lienEnvoi: string | null;
  /** Origine du site, calculée côté serveur — voir le commentaire dans page.tsx. */
  origine: string;
}) {
  const router = useRouter();
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [reprise, setReprise] = useState(false);
  // Aucun fournisseur de SMS ni d'e-mail n'étant branché (docs/AGENT.md §5), le
  // lien est rendu au patron pour qu'il le transmette lui-même — ce qui vaut
  // mieux qu'un envoi qui échouerait en silence.
  const [lienClient, setLienClient] = useState<string | null>(null);
  // **L'avertissement avant de rouvrir un devis que le client a en main.**
  //
  // Vérifié dans le dépôt avant d'écrire cet écran, et ce n'est pas une
  // précaution de façade : `getOuCreerDevisBrouillon` crée une NOUVELLE version
  // dès que la dernière est partie, mais l'envoi déjà fait n'est pas annulé pour
  // autant — la page publique sert `envoi.devis`, c'est-à-dire la version que le
  // client a reçue (`src/app/devis/[jeton]/page.tsx`). Tant qu'une nouvelle
  // n'est pas envoyée, il continue donc de voir l'ancienne ET de pouvoir
  // l'accepter, au prix d'avant.
  //
  // Le patron doit le savoir avant, pas le découvrir après : c'est la règle du
  // dépôt (`CLAUDE.md` §4 — rien ne part et rien ne s'engage sans un geste).
  const [avertissementVisible, setAvertissementVisible] = useState(false);

  function lienComplet(chemin: string) {
    return `${origine}${chemin}`;
  }

  // Déduit des props, jamais gardé en état : une reprise de devis rafraîchit
  // l'écran, et un état figé à l'ouverture continuerait d'annoncer un devis
  // parti alors qu'une nouvelle version attend d'être envoyée.
  const envoye = initialEnvoye || lienClient !== null;
  const nomFichierDevis = `devis-${numeroDevis}.pdf`;

  // Un refus, ou un lien périmé : le devis peut repartir, dans une nouvelle
  // version. Sans ce chemin, un chantier retourné l'était définitivement.
  // Une correction demandée se reprend comme un refus : c'est la même mécanique
  // — une nouvelle version, corrigée, renvoyée — mais avec bien plus de chances
  // d'aboutir, puisque le client a déjà dit ce qu'il voulait.
  const peutReprendre = etatEnvoi === "retourne" || etatEnvoi === "a_corriger" || etatEnvoi === "caduc";
  const lienAMontrer = lienClient ?? lienEnvoi;

  /**
   * Rouvre le devis pour le modifier, puis mène à l'écran qui le porte.
   *
   * `router.push` et non un `<Link>` : il faut d'abord que la nouvelle version
   * existe, sinon l'écran suivant régénérerait le brouillon depuis les lignes de
   * prix courantes et le patron y verrait un devis qu'il n'a pas demandé.
   */
  async function modifierLeDevis() {
    setReprise(true);
    try {
      await reprendreDevisAction(chantierId);
      router.push(`/chantiers/${chantierId}/devis-complet`);
    } finally {
      setReprise(false);
    }
  }

  async function reprendre() {
    setReprise(true);
    try {
      await reprendreDevisAction(chantierId);
      // L'écran est relu : la nouvelle version, ses lignes et ses totaux
      // viennent du serveur, jamais d'une copie reconstituée ici.
      router.refresh();
    } finally {
      setReprise(false);
    }
  }

  return (
    <>
      {/* **DEUX ÉCRANS, PAS UN AVEC DES VARIANTES.**

          Avant l'envoi, le patron VÉRIFIE : il a besoin des lignes, du total, de
          l'aperçu, du rappel du client. Après l'envoi, il ATTEND : il vient voir
          où ça en est et relancer. Le même empilement de cartes servait les
          deux, et c'est ce qui a fait dire au patron, le 12 août, « il y a trop
          d'infos sur cette page » — onze blocs, dont il fallait faire défiler
          pour voir la moitié.

          La mise en page de l'écran d'attente est celle qu'il a désignée dans
          `docs/maquettes/26-le-devis-sur-sa-base.html` — l'idée 5, « le signet
          d'or » : un filet d'or pour l'état, le montant seul au centre, le geste
          en bas sous le pouce. Les mesures viennent de là ; les reprendre de là
          si on y retouche, jamais de mémoire. */}
      {envoye || lienClient ? (
        <EcranDevisParti
          etat={lienClient ? "Devis prêt" : etatEnvoiLabel[etatEnvoi]}
          phrase={lienClient ? `Devis prêt pour ${clientNom}.` : etatEnvoiExplication[etatEnvoi]}
          messageClient={messageClient}
          numeroDevis={numeroDevis}
          totalTtc={totalTtc}
          onModifier={peutReprendre ? null : () => setAvertissementVisible(true)}
          lienPdf={`/api/devis/${devisId}/pdf?telecharger=1`}
          nomFichierPdf={nomFichierDevis}
          transmission={
            lienAMontrer ? (
              <TransmettreAuClient
                clientId={clientId}
                clientNom={clientNom}
                entrepriseNom={entrepriseNom}
                canal={canalClient}
                telephone={clientTelephone}
                email={clientEmail}
                lien={lienComplet(lienAMontrer)}
                lienPdf={`/api/devis/${devisId}/pdf?telecharger=1`}
                nomFichierPdf={nomFichierDevis}
                // `initialEnvoye` et non `envoye` : juste après le premier
                // envoi, l'écran dit « Devis prêt » et le geste est bien un
                // PREMIER envoi. Confondre les deux ferait proposer de
                // « relancer » un client qui n'a encore rien reçu.
                relance={initialEnvoye && !lienClient}
              />
            ) : null
          }
          reprise={
            /* **Deux portes vers la même pièce seraient une de trop.** Quand le
               client a refusé, demandé une correction, ou laissé le lien
               expirer, reprendre le devis EST l'action principale : elle garde
               son bouton plein, et « Modifier mon devis » s'efface. Tant qu'il
               réfléchit encore, c'est l'inverse — relancer est l'action, et
               modifier reste un lien discret. */
            peutReprendre ? (
              <button
                type="button"
                onClick={reprendre}
                disabled={reprise}
                className="mt-4 block w-full rounded-[4px] py-3 text-[15px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: colors.rust }}
              >
                {reprise
                  ? "Reprise…"
                  : etatEnvoi === "a_corriger"
                    ? "Corriger et renvoyer"
                    : "Reprendre le devis"}
              </button>
            ) : null
          }
        />
      ) : (
        // Cette branche-là défile : avant l'envoi, l'écran porte les lignes, le
        // total et l'aperçu, et il peut légitimement dépasser. `atlas-ecran`
        // ayant `overflow: hidden`, sans colonne qui défile le bas serait
        // simplement coupé — et le bouton d'envoi avec lui.
        <div className="atlas-colonne-defile flex flex-col gap-4 px-6 pb-6 pt-6">
          {/* Synthèse — lecture seule, aucune édition sur cet écran */}
          <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
            <Row label="Chantier" value={`${chantierNom} — ${adresseChantier}`} />
            <Row label="Client" value={`${clientNom} — ${clientTelephone}`} last />
          </div>

          {/* Le devis lui-même : ce qui sera imprimé, avec les montants.
              L'écran ne montrait que les *prestations* du chantier — un devis
              écrit entièrement à la main n'en a aucune, et le patron n'y voyait
              qu'un total, sans savoir ce qui partirait chez son client.

              **Elles restent AVANT l'envoi, et disparaissent après**, à sa
              demande du 12 août : c'est avant d'envoyer qu'on vérifie ce qui
              part, pas après. */}
          {lignes.length > 0 && (
            <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
              <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
                Lignes du devis
              </p>
              <ul className="flex flex-col gap-2">
                {lignes.map((l, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 text-[15px]"
                    style={{ color: colors.ink }}
                  >
                    {/* `whitespace-pre-line` : une ligne réunit plusieurs travaux,
                        un par ligne. Sans cela, ils se recolleraient en une phrase
                        — le défaut même qu'on vient de réparer. */}
                    <span className="min-w-0 flex-1 whitespace-pre-line">{l.libelle || "Ligne sans libellé"}</span>
                    <span style={{ color: colors.muted }}>{enEuros(l.montant)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* **Les prestations ne sont affichées QUE s'il n'y a pas de lignes.**
              Retiré le 7 août 2026 : « supprime la ligne prestation sur cette
              page, pas besoin de se répéter, la ligne devis dit la même chose
              avec le prix en plus ». Il avait raison — sur sa capture, les deux
              blocs portaient mot pour mot « Taille de cohabitation d'un charme /
              Broyage sur place ».

              Elles restent le filet quand aucune ligne n'existe encore : un écran
              qui n'annoncerait qu'un total, sans dire de quoi il est fait, serait
              un recul. */}
          {lignes.length === 0 && prestations.length > 0 && (
            <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
              <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
                Prestations
              </p>
              <ul className="flex flex-col gap-1.5">
                {prestations.map((p, i) => (
                  <li key={i} className="text-[15px]" style={{ color: colors.ink }}>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-[4px] px-5 py-5 text-center" style={{ backgroundColor: colors.card }}>
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
              Total
            </p>
            <p
              className="text-[32px] font-semibold leading-none"
              style={{ fontFamily: font.display, color: colors.rust }}
            >
              {enEuros(totalTtc)}
            </p>
          </div>

          {/* Avant l'envoi, on RELIT le document : un onglet neuf est exactement
              ce qu'on veut. Le téléchargement, lui, vit sur l'écran d'attente —
              c'est là qu'on veut déposer le PDF sur son téléphone. */}
          <a
            href={`/api/devis/${devisId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            Aperçu du PDF
          </a>

          <PrimaryButton onClick={() => setConfirmationVisible(true)}>
            Envoyer au client →
          </PrimaryButton>
        </div>
      )}

      {/* **L'avertissement, une seule fois, au moment du clic.**
          Ce qu'il dit est vérifié dans le dépôt, pas supposé : la page publique
          sert `envoi.devis`, donc la version que le client a reçue. Créer une
          nouvelle version n'annule pas l'envoi en cours. */}
      <AvertissementModification
        ouvert={avertissementVisible}
        enCours={reprise}
        onFermer={() => setAvertissementVisible(false)}
        onConfirmer={modifierLeDevis}
      />

      <EnvoiAuClient
        chantierId={chantierId}
        devisId={devisId}
        clientNom={clientNom}
        ouvert={confirmationVisible}
        onFermer={() => setConfirmationVisible(false)}
        onEnvoye={(lien) => {
          setConfirmationVisible(false);
          setLienClient(lien);
        }}
      />
    </>
  );
}

/**
 * « Ce devis est déjà chez votre client. »
 *
 * **Pourquoi cette feuille existe, et pourquoi elle ne peut pas être un
 * simple lien.** Le patron a demandé « Modifier mon devis » sous le total. Or
 * ce devis-là est parti : le rouvrir crée une nouvelle version, et l'envoi déjà
 * fait **reste actif** — la page publique sert `envoi.devis`, la version reçue.
 * Le client continue donc de voir l'ancienne, et peut l'accepter, au prix
 * d'avant, tant qu'une nouvelle n'est pas envoyée.
 *
 * Le taire, c'est laisser le patron croire qu'il a corrigé un prix que son
 * client peut encore accepter à l'ancien. C'est exactement ce que `CLAUDE.md`
 * §4 interdit : rien ne s'engage sans un geste.
 *
 * Une seule fois, courte, et refusable — pas un avertissement qu'on apprend à
 * balayer.
 */
function AvertissementModification({
  ouvert,
  enCours,
  onFermer,
  onConfirmer,
}: {
  ouvert: boolean;
  enCours: boolean;
  onFermer: () => void;
  onConfirmer: () => void;
}) {
  if (!ouvert) return null;
  return (
    <div
      role="dialog"
      aria-label="Modifier un devis déjà envoyé"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(28,28,26,0.34)" }}
    >
      {/* Le voile ferme la feuille : sur un téléphone, viser un petit
          « Annuler » au pouce est plus difficile que de toucher à côté.

          `aria-hidden` et hors du parcours au clavier, comme le voile de
          l'écran des chantiers — sans quoi il annonce un second « Annuler », et
          qui ne voit pas l'écran entend deux fois la même chose sans savoir
          laquelle choisir. La suite l'a signalé avant que quiconque l'entende. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onFermer}
        className="absolute inset-0 h-full w-full"
      />
      <div
        className="relative w-full rounded-t-[16px] px-6 pb-8 pt-6"
        style={{ backgroundColor: colors.cream }}
      >
        <p className="text-[19px]" style={{ fontFamily: font.display, color: colors.ink }}>
          Ce devis est chez votre client
        </p>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: colors.inkSoft }}>
          Le modifier en crée une nouvelle version. Tant que vous ne l&apos;aurez pas
          renvoyée, votre client continuera de voir celle qu&apos;il a reçue — et il
          pourra l&apos;accepter au prix d&apos;avant.
        </p>
        <button
          type="button"
          onClick={onConfirmer}
          disabled={enCours}
          className="mt-6 block w-full rounded-[4px] py-3 text-center text-[15px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: colors.rust }}
        >
          {enCours ? "Ouverture…" : "Modifier quand même"}
        </button>
        <button
          type="button"
          onClick={onFermer}
          className="mt-3 block w-full text-center text-[14px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

/**
 * L'écran d'un devis déjà parti — « le signet d'or ».
 *
 * Retenu par le patron le 12 août 2026 (maquette 26, idée 5), après cinq
 * propositions et une mesure : l'écran d'avant portait onze blocs et débordait
 * de 382 px sur sa dalle.
 *
 * Trois partis pris, tous les trois de lui :
 *
 *   1. **L'état ne s'annonce plus en capitales** — un filet d'or vertical le
 *      marque, comme un signet dans un registre. L'or ne sert qu'à cela sur tout
 *      l'écran, ce qui est le partage des rôles de la charte : le vert porte ce
 *      qu'on FAIT, l'or ce qu'on LIT (`design-tokens.ts`).
 *   2. **Le montant est seul en scène**, centré, sans carte pour le contenir.
 *      Les lignes du devis ont disparu : « garder que le nom du devis, le total ».
 *   3. **Le geste est en bas, sous le pouce.** `mt-auto` le pousse contre la
 *      barre de navigation quel que soit le contenu au-dessus.
 */
function EcranDevisParti({
  etat,
  phrase,
  messageClient,
  numeroDevis,
  totalTtc,
  onModifier,
  lienPdf,
  nomFichierPdf,
  transmission,
  reprise,
}: {
  etat: string;
  phrase: string;
  messageClient: string | null;
  numeroDevis: string;
  totalTtc: string;
  /** `null` quand reprendre le devis est déjà l'action principale de l'écran. */
  onModifier: (() => void) | null;
  lienPdf: string;
  nomFichierPdf: string;
  transmission: ReactNode;
  reprise: ReactNode;
}) {
  return (
    // **Deux zones, et c'est ce qui rend l'écran sûr.** Le haut défile — un
    // client peut écrire un long message, et le couper le rendrait illisible
    // sans que rien ne le dise. Le pied, lui, ne défile pas : le geste reste
    // sous le pouce quoi qu'il arrive au-dessus. Aucune hauteur n'est écrite
    // ici ; `atlas-ecran` la donne (voir `page.tsx`, et les deux tentatives
    // fausses qui l'ont précédée).
    <div data-atlas="devis-parti" className="flex min-h-0 flex-1 flex-col">
      <div className="atlas-colonne-defile px-6 pt-5">
      {/* Le signet : un filet d'or, l'état en encre, la phrase en gris. */}
      <div className="pl-4" style={{ borderLeft: `2px solid ${colors.or}` }}>
        <p className="text-[14px]" style={{ color: colors.ink }}>
          {etat}
        </p>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: colors.muted }}>
          {phrase}
        </p>
      </div>

      {/* Le message du client, tel qu'il l'a écrit. C'est ici que le patron vient
          corriger : le lui faire chercher ailleurs, ou le résumer, reviendrait à
          lui demander de deviner ce qu'il doit changer. */}
      {messageClient && (
        <blockquote
          className="mt-4 whitespace-pre-wrap pl-3 text-[14px] leading-relaxed"
          style={{ borderLeft: `2px solid ${colors.rust}`, color: colors.ink }}
        >
          « {messageClient} »
        </blockquote>
      )}

      <div className="mt-8 text-center">
        <p className="text-[13px]" style={{ color: colors.muted }}>
          Devis nº {numeroDevis}
        </p>
        <p
          className="mt-2 text-[46px] leading-none"
          style={{ fontFamily: font.display, color: colors.rust, letterSpacing: "-0.015em" }}
        >
          {enEuros(totalTtc)}
        </p>
        {/* **Le lien sous le total, en encre et non en gris.** C'est une action :
            une action grise se lit comme une légende, et il ne la trouverait pas. */}
        {onModifier && (
          <button
            type="button"
            onClick={onModifier}
            className="mt-4 text-[14px] font-medium"
            style={{ color: colors.ink }}
          >
            Modifier mon devis ›
          </button>
        )}
      </div>

      </div>

      <div className="px-6 pb-2 pt-5">
        {transmission}
        {/* Quand aucun lien n'est encore actif — un devis caduc, par exemple — il
            n'y a rien à transmettre, mais le PDF reste utile : le patron le garde
            pour ses archives, ou le renvoie à la main. */}
        {!transmission && (
          <a
            href={lienPdf}
            download={nomFichierPdf}
            className="block text-center text-[13px] font-medium"
            style={{ color: colors.ink }}
          >
            Télécharger le PDF
          </a>
        )}
        {reprise}
      </div>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-3 border-b pb-3"} style={{ borderColor: colors.line }}>
      <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
        {label}
      </p>
      <p className="text-[15px]" style={{ color: colors.ink }}>
        {value}
      </p>
    </div>
  );
}
