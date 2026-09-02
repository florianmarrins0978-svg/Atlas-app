"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import TransmettreAuClient from "./TransmettreAuClient";
import { etatEnvoiExplication, etatEnvoiLabel, type EtatEnvoi } from "@/lib/etat-envoi";
import { reprendreDevisAction } from "./actions";
import { enEuros } from "@/lib/euros";
import { type Civilite } from "@/lib/civilite";


export default function ExportClient({
  chantierId,
  devisId,
  clientId,
  clientNom,
  clientCivilite,
  clientTelephone,
  clientEmail,
  entrepriseNom,
  modeleMessage,
  canalClient,
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
  clientNom: string;
  /** Ce qu'il a choisi au-dessus du nom, recopié sur le devis. */
  clientCivilite: Civilite | null;
  clientTelephone: string;
  clientEmail: string;
  entrepriseNom: string;
  /** Son gabarit de message, ou `null` pour celui d'Atlas. */
  modeleMessage: string | null;
  canalClient: "sms" | "email";
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
  const [reprise, setReprise] = useState(false);
  // Aucun fournisseur de SMS ni d'e-mail n'étant branché (docs/AGENT.md §5), le
  // lien est rendu au patron pour qu'il le transmette lui-même — ce qui vaut
  // mieux qu'un envoi qui échouerait en silence.
  /**
   * **« Ça vient de partir » — un état que le serveur ne peut pas deviner.**
   *
   * Jusqu'au 20 août 2026, l'envoi avait lieu SUR cet écran : le lien revenait
   * dans un état local, et sa présence disait « à l'instant ». L'envoi part
   * désormais du devis (`docs/maquettes/82`), et l'on arrive ici par une
   * navigation — l'état local est donc vide, quoi qu'il vienne de se passer.
   *
   * Sans ce drapeau, l'écran annoncerait « En attente de réponse » une seconde
   * après l'envoi, là où il disait « Devis prêt pour Mr. Martins. ». C'est vrai,
   * et c'est froid : il vient d'appuyer, il veut savoir que c'est parti.
   *
   * Porté par l'adresse plutôt que par un état : une navigation ne transporte
   * rien d'autre. Mais l'adresse, elle, SURVIT au rechargement — et c'est ce
   * qu'a attrapé `test-devis-e2e.ts` : rechargée, la page reprenait « Devis
   * prêt pour … » alors que la deuxième fois, ce n'est plus « à l'instant ».
   *
   * Le drapeau se CONSOMME donc dès l'arrivée : la mention reste pour cette
   * visite-ci, et l'adresse est nettoyée derrière elle. Un rechargement, un
   * retour par l'historique, un signet rouvert plus tard tombent alors sur
   * l'état réel du devis parti.
   */
  // **Plus de « ça vient de partir » sur cet écran — sa demande du 21 août 2026.**
  //
  // *« Juste derrière, il y a cette page-là qui s'affiche et je n'ai pas besoin
  // qu'elle s'affiche […] une fois que le devis est envoyé, on retourne
  // directement sur l'accueil. »* On n'arrive donc plus JAMAIS ici dans la
  // seconde qui suit l'appui : cet écran ne se voit qu'en y revenant, plus tard,
  // par la carte du chantier.
  //
  // Tout ce qui distinguait « à l'instant » du reste part avec — le drapeau
  // `?envoye=1`, la mention « Devis prêt pour … », l'état « Devis prêt ». Ces
  // branches ne pouvaient plus s'atteindre, et un code mort trompe la session
  // suivante, qui le corrige ou s'interroge.
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
  const envoye = initialEnvoye;
  const nomFichierDevis = `devis-${numeroDevis}.pdf`;

  // Un refus, ou un lien périmé : le devis peut repartir, dans une nouvelle
  // version. Sans ce chemin, un chantier retourné l'était définitivement.
  // Une correction demandée se reprend comme un refus : c'est la même mécanique
  // — une nouvelle version, corrigée, renvoyée — mais avec bien plus de chances
  // d'aboutir, puisque le client a déjà dit ce qu'il voulait.
  //
  // **`!lienClient` n'est pas une précaution, c'est la correction du 13 août.**
  // Sa capture montrait « Ouvrir le SMS tout prêt » ET « Corriger et renvoyer »
  // l'un sous l'autre, tous deux pleins, sur un devis qu'il venait de corriger
  // et d'envoyer — l'écran lui proposait de corriger ce qu'il venait de
  // corriger. La cause : `etatEnvoi` vient du serveur et n'était pas recalculé
  // après l'envoi, l'écran restait donc sur l'état d'avant.
  //
  // La règle qu'il a retenue (maquette 40, proposition B) : **un seul bouton à
  // chaque instant**, celui du moment. Avant l'envoi, reprendre EST le geste ;
  // après, c'est transmettre. Jamais les deux.
  const peutReprendre =
    etatEnvoi === "retourne" || etatEnvoi === "a_corriger" || etatEnvoi === "caduc";
  const lienAMontrer = lienEnvoi;

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
          `docs/maquettes/34-le-devis-sur-sa-base.html` — l'idée 5, « le signet
          d'or » : un filet d'or pour l'état, le montant seul au centre, le geste
          en bas sous le pouce. Les mesures viennent de là ; les reprendre de là
          si on y retouche, jamais de mémoire. */}
      {envoye ? (
        <EcranDevisParti
          etat={etatEnvoiLabel[etatEnvoi]}
          // La même civilité que la synthèse ci-dessous : lire « Mr. Martins »
          // avant l'envoi et « Martins » juste après ferait douter qu'il
          // s'agisse du même client. Le message qui part chez le client
          // l'aborde de la même façon depuis le 13 août au soir
          // (`src/lib/message-client.ts`).
          phrase={etatEnvoiExplication[etatEnvoi]}
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
                clientCivilite={clientCivilite}
                entrepriseNom={entrepriseNom}
                modeleMessage={modeleMessage}
                canal={canalClient}
                telephone={clientTelephone}
                email={clientEmail}
                lien={lienComplet(lienAMontrer)}
                // `initialEnvoye` et non `envoye` : juste après le premier
                // envoi, l'écran dit « Devis prêt » et le geste est bien un
                // PREMIER envoi. Confondre les deux ferait proposer de
                // « relancer » un client qui n'a encore rien reçu.
                relance={initialEnvoye}
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
                className="atlas-plein mt-4 block w-full rounded-full py-3 text-[15px] font-medium text-white disabled:opacity-50"
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
      ) : null}

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

{/* **La feuille d'envoi n'est plus ici** — elle vit sur le devis depuis le
          20 août 2026 (`docs/maquettes/82`). La garder montée sur cet écran
          aurait donné deux portes vers la même pièce, et deux calendriers à
          tenir d'accord.

          **Et ce qui suivait l'envoi l'a suivie** : l'ouverture de sa
          messagerie, arrivée sur `main` le 18 août, part désormais du devis
          elle aussi (`src/lib/ouvrir-messagerie.ts`). Elle n'est pas recopiée —
          elle a été SORTIE d'ici, pour n'exister qu'une fois. */}
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
          className="atlas-plein mt-6 block w-full rounded-full py-3 text-center text-[15px] font-medium text-white disabled:opacity-50"
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
 * Retenu par le patron le 12 août 2026 (maquette 34, idée 5), après cinq
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
            Modifier mon devis
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

