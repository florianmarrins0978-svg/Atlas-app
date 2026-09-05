"use client";

import { useState, useTransition } from "react";
import { ordonnerLesCartes } from "@/lib/ordre-notifications";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import { suiteDeLaReponse, type SuiteDeLaReponse } from "@/lib/suite-de-la-reponse";
import {
  marquerReponseVueAction,
  corrigerDevisAction,
  repousserRappelFactureAction,
  marquerRappelVuAction,
} from "./actions";
import type { GenreRappel, GenreAcquittable } from "@/lib/rappels";
import type { NotificationPatron, EnvoiCaduc } from "@/server/repositories/envois-devis";

/** Un rappel, déjà mis en mots par le serveur — voir `src/lib/rappels.ts`. */
export type RappelAffiche = {
  genre: GenreRappel;
  chantierId: string;
  chantierNom: string;
  /** « depuis 8 jours » — formulé au serveur, pour que l'écran n'ait pas à
   *  recalculer un délai et à en donner une seconde version. */
  depuisTexte: string;
  /** Le nombre de jours seul — « 14 » —, pour l'étiquette du rappel qu'il a
   *  retenu (proposition B, 16 août 2026). Même source que `depuisTexte` :
   *  deux calculs du même délai finiraient par se contredire. */
  depuisJours: number;
  /**
   * QUAND cette situation a commencé, en millisecondes.
   *
   * **Sert à ORDONNER, jamais à écrire.** Le délai reste mis en mots au serveur
   * (`depuisTexte`) : deux calculs du même délai finiraient par se contredire à
   * l'écran. Celui-ci ne s'affiche nulle part — il ne fait que ranger.
   *
   * Sans lui, l'accueil ne pouvait pas comparer un rappel à une réponse de
   * client : les deux sortes n'avaient aucune date commune, et l'ordre se
   * décidait par SORTE. Sa demande du 26 août 2026 : *« le plus récent en
   * haut »*.
   */
  quand: number;
  /**
   * Ce que porte le seul rappel d'impayé.
   *
   * **Le montant est ce qu'il cherche**, et c'est le RESTE dû : sur une facture
   * partiellement réglée, afficher le total ferait réclamer une somme déjà
   * encaissée. Le total l'accompagne pour qu'elle ne passe pas pour une petite
   * facture (sa planche du 16 août 2026, écran 1).
   */
  facture?: { id: string; numero: string; resteDu: string; total: string; partielle: boolean };
};

// Ce qu'est devenu un devis parti, porté au patron (docs/AGENT.md §2.2).
//
// Sans cet écran, un refus vivait uniquement en base : le devis « envoyé »
// restait envoyé pour toujours, et le chantier disparaissait doucement du champ
// de vision de son patron. Un lien expiré, lui, ne se signalait nulle part —
// personne n'ayant rien fait, rien ne le rappelait.

/** Ce qui s'affiche, quelle qu'en soit l'origine. */
type Carte = {
  envoiId: string;
  /** Le montant dû, sur le seul rappel d'impayé. `sur` : le total, quand un
   *  acompte est déjà arrivé — sans quoi la facture passerait pour petite. */
  montant?: { du: string; sur: string | null };
  /** L'identifiant de la facture à repousser, sur ce même rappel. */
  repousser?: string;
  /**
   * Un RAPPEL, pas une nouvelle.
   *
   * Une réponse de client s'acquitte pour de bon : elle est lue, elle ne revient
   * jamais. Un rappel décrit une situation qui dure — « J'ai vu » le fait taire
   * le temps de son délai réglé, puis il revient si rien n'a bougé (`vu`
   * ci-dessous).
   */
  rappel?: boolean;
  /**
   * De quoi acquitter un rappel — sa demande du 30 août 2026.
   *
   * *« Pour chaque notification je dois pouvoir cliquer sur vu pour les faire
   * disparaître ; pourquoi certaines n'ont pas cette fonction ? »* Trois des
   * quatre rappels n'avaient aucun geste : la carte restait sous les yeux
   * jusqu'à ce que la situation cesse, et la pile grossissait sans qu'il puisse
   * la ranger.
   *
   * Absent sur la facture impayée : celle-là se tait par `repousser`, son
   * moteur d'origine — deux mécaniques pour une idée se contrediraient.
   */
  vu?: { genre: GenreAcquittable; chantierId: string };
  chantierId: string;
  chantierNom: string;
  /**
   * QUAND cette carte est apparue dans son monde, en millisecondes.
   *
   * **C'est ce qui range l'accueil depuis le 26 août 2026** — sa demande, une
   * capture à l'appui : *« je viens de recevoir un devis retourné, il devrait
   * apparaître en premier. Le plus récent en haut. »*
   *
   * Il ne s'affiche nulle part : le délai reste mis en mots au serveur.
   */
  quand: number;
  /** Réclame l'attention (fond teinté) plutôt que d'informer. */
  urgent: boolean;
  titre: string;
  texte: string;
  /**
   * Ce que le client a écrit, mot pour mot.
   *
   * Il était enregistré depuis le premier jour et **n'apparaissait sur aucun
   * écran**. Le patron lisait « le client n'a pas donné suite » sans jamais
   * savoir qu'il avait écrit « le devis comprend une faute ». Le message est
   * donc DANS la carte, pas derrière une pastille : c'est la seule chose qui
   * lui dise quoi faire, et un geste de plus pour la lire, c'est un geste de
   * trop.
   */
  messageClient?: string | null;
  /**
   * Où mène la carte, et ce que le lien annonce.
   *
   * **Les quatre cartes menaient toutes à la fiche du chantier**, alors qu'elles
   * n'appellent pas le même geste — et que leur propre texte disait déjà le
   * contraire (« le devis peut être repris et renvoyé »). Le patron l'a relevé
   * le 12 août 2026. La règle vit dans `src/lib/suite-de-la-reponse.ts`, pas
   * ici : elle est éprouvable sans navigateur.
   */
  suite: SuiteDeLaReponse;
};

/**
 * Combien de réponses s'affichent avant qu'on propose de déplier.
 *
 * Au-delà, la pile de cartes repousse les chantiers hors de l'écran : le patron
 * ouvre son application pour voir son travail, pas pour faire défiler des
 * alertes. Les autres ne sont pas cachées — elles sont annoncées et à un appui.
 */
const VISIBLES_PAR_DEFAUT = 2;

function versCarte(n: NotificationPatron): Carte {
  const refus = n.reponse === "refusee";
  const correction = n.reponse === "correction";

  const titre = correction ? "Correction demandée" : refus ? "Devis retourné" : "Autre date proposée";
  const texte = correction
    ? "Le client veut ce devis corrigé avant de l'accepter."
    : refus
      ? "Le client n'a pas donné suite. Le devis peut être repris et renvoyé."
      : n.dateRetenue
        ? `Le client a accepté, et retenu le ${jourLisible(n.dateRetenue)}.`
        : "Le client a accepté sur une date qu'il a proposée lui-même.";

  return {
    envoiId: n.envoiId,
    chantierId: n.chantierId,
    chantierNom: n.chantierNom,
    // **L'instant où le CLIENT a répondu**, pas celui où le devis est parti :
    // c'est la nouvelle qui vient d'arriver chez lui.
    //
    // **Sans date, la carte passe en TÊTE et non à la fin.** `responduAt` est
    // posé en même temps que la réponse elle-même — il ne manque jamais en
    // pratique. S'il manquait quand même, la ranger comme très ancienne
    // l'enverrait derrière « N autres devis à regarder », c'est-à-dire nulle
    // part : une réponse de client ne se perd pas pour une date absente.
    quand: n.responduAt ? n.responduAt.getTime() : Number.MAX_SAFE_INTEGER,
    // Une correction attend un geste autant qu'un refus — davantage, même :
    // le chantier est presque acquis, il ne tient qu'à une reprise.
    urgent: refus || correction,
    titre,
    texte,
    messageClient: n.precisionClient,
    suite: suiteDeLaReponse(n.chantierId, n.reponse),
  };
}

function caducVersCarte(e: EnvoiCaduc): Carte {
  return {
    envoiId: e.envoiId,
    chantierId: e.chantierId,
    chantierNom: e.chantierNom,
    // **L'instant de l'EXPIRATION**, pas celui de l'envoi : c'est l'expiration
    // qui est la nouvelle. Trier sur l'envoi mettrait en tête un devis parti
    // hier dont le lien court encore.
    quand: e.expireAt.getTime(),
    urgent: true,
    titre: "Devis caduc",
    texte:
      "Le lien a expiré sans réponse. Le client n'a rien dit — ni oui, ni non. " +
      "Le devis peut être repris et renvoyé.",
    // Personne n'a répondu : le silence appelle la même reprise qu'un refus.
    suite: suiteDeLaReponse(e.chantierId, null),
  };
}

/**
 * Un rappel réglé dans « Notifications » — un devis qui dort, une facture qui
 * n'est pas partie.
 *
 * **Il ne mène pas au même endroit selon son genre**, et c'est la même règle
 * que pour les réponses : une carte qui mène ailleurs que là où est le geste
 * fait chercher (`suite-de-la-reponse.ts`, relevé par le patron le 12 août).
 */
function rappelVersCarte(r: RappelAffiche): Carte {
  const sansDevis = r.genre === "chantier-sans-devis";
  const devis = r.genre === "devis-sans-reponse";
  const impayee = r.genre === "facture-impayee";
  if (impayee && r.facture) {
    return {
      envoiId: `rappel-${r.genre}-${r.facture.id}`,
      chantierId: r.chantierId,
      chantierNom: r.chantierNom,
      quand: r.quand,
      // **Il ne crie pas.** Le fond teinté reste au devis jamais parti, seul
      // cas où RIEN n'est encore parti au client. Une facture impayée décrit un
      // travail fait qui attend son règlement — comme les deux autres.
      urgent: false,
      rappel: true,
      titre: "Facture impayée",
      texte: `Échéance dépassée ${r.depuisTexte}.`,
      montant: r.facture.partielle
        ? { du: r.facture.resteDu, sur: r.facture.total }
        : { du: r.facture.resteDu, sur: null },
      // **« J'ai vu » ne classe rien ici non plus** : il espace le rappel du
      // rythme réglé, et la facture reste dans l'endroit en attente. Le mot est
      // celui des autres cartes depuis le 30 août 2026 — un même geste ne
      // s'appelle pas « Plus tard » ici et « J'ai vu » trois lignes plus bas —,
      // mais la mécanique reste la sienne (migration 0051).
      repousser: r.facture.id,
      suite: {
        href: `/termines/tva`,
        // Le geste attendu est de SOLDER, et il se fait à l'endroit en attente.
        libelle: r.facture.partielle ? "Noter un règlement" : "Marquer payée",
        reprendreAvant: false,
      },
    };
  }
  return {
    // Aucun envoi derrière un rappel : la clé se fabrique, et elle porte le
    // genre — un même chantier peut dormir sur son devis un mois, puis sur sa
    // facture le mois suivant.
    envoiId: `rappel-${r.genre}-${r.chantierId}`,
    chantierId: r.chantierId,
    chantierNom: r.chantierNom,
    quand: r.quand,
    // Acquittable : ces trois-là visent un chantier, et c'est lui qu'on retient
    // (`rappels_vus`). Le genre voyage avec, car un même chantier peut dormir
    // sur son devis un mois, puis sur sa facture le mois suivant.
    vu: { genre: r.genre as GenreAcquittable, chantierId: r.chantierId },
    // **Les deux rappels d'origine ne crient pas.** Le fond teinté était
    // réservé à ce qui appelle une décision : un refus, un lien mort. Un rappel
    // de confort qui crierait aussi fort ferait baisser le volume des autres.
    //
    // **Celui du devis jamais parti fait exception, et c'est SA décision** du
    // 16 août 2026 — la proposition B, devant les deux tons dessinés : *« la B
    // et 4 »*. Sa raison, écrite sur la planche : au quatorzième jour, ça ne
    // doit pas se rater. Et il est le seul des trois où RIEN n'est encore
    // parti au client : les deux autres décrivent un travail déjà fait qui
    // attend, celui-ci un travail pas commencé.
    urgent: sansDevis,
    rappel: true,
    titre: sansDevis
      // **Le compte des jours DANS l'étiquette**, avant le nom — l'autre moitié
      // de la proposition B. Le nombre se lit avant qu'on ait lu le chantier.
      ? `Devis en attente · ${r.depuisJours} jour${r.depuisJours > 1 ? "s" : ""}`
      : devis
        ? "Devis sans réponse"
        : "À facturer",
    texte: sansDevis
      ? `Chantier ouvert ${r.depuisTexte}, et aucun devis n'est parti.`
      : devis
        ? `Parti ${r.depuisTexte}, sans un mot du client. Vous pouvez le relancer vous-même.`
        : `Chantier terminé ${r.depuisTexte}, et aucune facture n'est partie.`,
    suite: {
      // **CHAQUE RAPPEL MÈNE OÙ SON LIBELLÉ LE DIT — 4 septembre 2026.**
      //
      // Les deux premiers menaient à la fiche du chantier, pour ne pas choisir
      // entre dicter, chiffrer et rédiger à la main. Cette fiche est retirée
      // (`ARCHITECTURE.md` §254), et les trois chemins n'y étaient plus depuis
      // longtemps : la chaîne va de la dictée au devis d'un seul tenant.
      //
      //   · « Faire le devis » : le devis. Il s'y dicte ET s'y écrit à la main,
      //     donc rien n'est choisi à sa place ;
      //   · « Ouvrir le chantier » — un devis parti sans réponse : `/export`,
      //     qui porte le lien du client et la relance. C'est la règle du
      //     20 août 2026, parti → export, pas une nouvelle.
      href: sansDevis
        ? `/chantiers/${r.chantierId}/devis-complet`
        : devis
          ? `/chantiers/${r.chantierId}/export`
          : `/chantiers/${r.chantierId}/facture`,
      libelle: sansDevis ? "Faire le devis" : devis ? "Ouvrir le chantier" : "Créer la facture",
      reprendreAvant: false,
    },
  };
}

export default function Notifications({
  initiales,
  caducs,
  rappels = [],
}: {
  initiales: NotificationPatron[];
  caducs: EnvoiCaduc[];
  /** Réglés dans « Notifications » — vide quand les deux sont éteints. */
  rappels?: RappelAffiche[];
}) {
  // Retirée à l'écran dès l'appui, sans attendre le serveur : le patron a fait
  // son geste, lui laisser la carte sous les yeux le ferait douter.
  const [masquees, setMasquees] = useState<string[]>([]);
  const [toutVoir, setToutVoir] = useState(false);
  const [, demarrer] = useTransition();
  const router = useRouter();
  /** Le chantier dont la reprise est en cours, pour ne pas la lancer deux fois. */
  const [enCours, setEnCours] = useState<string | null>(null);
  /**
   * Ce que le serveur a refusé, dit en toutes lettres.
   *
   * **Jamais un `catch {}`.** Le 11 août 2026, « Impossible d'enregistrer la
   * note pour l'instant » ne pouvait être expliqué par personne : quatre refus
   * possibles, et l'écran les jetait tous. Un refus attendu se rend en valeur
   * et s'affiche (`AGENTS.md`).
   */
  const [refus, setRefus] = useState<{ chantierId: string; message: string } | null>(null);

  // **LE PLUS RÉCENT EN HAUT, ET RIEN D'AUTRE — sa demande du 26 août 2026.**
  //
  // *« Je viens de recevoir un devis retourné, il devrait apparaître en premier.
  // L'ordre doit être dernier arrivé en tête de liste. »* Sur sa capture, la
  // nouvelle du jour était deuxième, sous un rappel vieux de treize jours.
  //
  // **Deux arrangements par SORTE l'ont précédée, et chacun avait son défaut.**
  // D'abord les réponses devant : dès deux réponses en attente, son rappel
  // passait derrière « N autres devis à regarder ». Puis les rappels devant
  // avec une place garantie (16 août) : trois chantiers sans devis suffisaient
  // à masquer toutes les réponses, d'où la place réservée.
  //
  // **La date répond aux deux, et par la règle plutôt que par l'exception :**
  // une réponse qui vient d'arriver est la plus récente, donc la première. Ce
  // que le tressage obtenait en réservant, l'ordre chronologique l'obtient tout
  // seul — et il s'explique en une phrase, ce qu'aucun tressage ne faisait.
  //
  // **La règle vit dans `src/lib/ordre-notifications.ts`**, pure et éprouvée
  // sur les cas limites : ici on ne fait que lui donner les deux sortes.
  //
  // **On range APRÈS avoir retiré les cartes acquittées** : ranger d'abord
  // ferait compter une réponse que le patron vient de marquer « J'ai vu ».
  const lesRappels = rappels.map(rappelVersCarte).filter((n) => !masquees.includes(n.envoiId));
  const lesReponses = [...initiales.map(versCarte), ...caducs.map(caducVersCarte)].filter(
    (n) => !masquees.includes(n.envoiId)
  );
  const restantes = ordonnerLesCartes(lesRappels, lesReponses);
  if (restantes.length === 0) return null;

  const visibles = toutVoir ? restantes : restantes.slice(0, VISIBLES_PAR_DEFAUT);
  const enPlus = restantes.length - visibles.length;

  function marquerVue(envoiId: string) {
    setMasquees((v) => [...v, envoiId]);
    demarrer(() => {
      void marquerReponseVueAction(envoiId);
    });
  }

  /**
   * « Corriger le devis » : rouvrir le document, puis y aller.
   *
   * **Sa demande du 13 août 2026** — arriver directement sur le devis, prêt à
   * être corrigé. Un devis parti étant immuable, il faut le reprendre AVANT
   * d'ouvrir la page, sans quoi il tomberait sur un document qui refuse la
   * première frappe.
   *
   * L'attente est montrée, et ce n'est pas de la décoration : la reprise
   * traverse le réseau, et un bouton qui ne répond pas se presse deux fois.
   */
  /**
   * Repousser le rappel d'une facture.
   *
   * La carte disparaît tout de suite : le doigt a fait son geste, et la laisser
   * sous les yeux le ferait douter. Sur refus, elle revient avec le message —
   * jamais un `catch {}` muet (`AGENTS.md`).
   */
  function repousser(carte: Carte) {
    if (!carte.repousser || enCours) return;
    setEnCours(carte.repousser);
    setRefus(null);
    setMasquees((v) => [...v, carte.envoiId]);
    demarrer(async () => {
      const r = await repousserRappelFactureAction(carte.repousser!);
      setEnCours(null);
      if (!r.ok) {
        setMasquees((v) => v.filter((id) => id !== carte.envoiId));
        setRefus({ chantierId: carte.chantierId, message: r.raison });
      }
    });
  }

  /**
   * « J'ai vu » sur un rappel — sa demande du 30 août 2026.
   *
   * La carte part de l'écran tout de suite : le doigt a fait son geste. Sur
   * refus, elle revient AVEC le message — jamais un `catch {}` muet, sans quoi
   * il croirait le geste passé alors que rien n'est écrit (`AGENTS.md`).
   */
  function marquerRappel(carte: Carte) {
    if (!carte.vu || enCours) return;
    setEnCours(carte.envoiId);
    setRefus(null);
    setMasquees((v) => [...v, carte.envoiId]);
    demarrer(async () => {
      const r = await marquerRappelVuAction(carte.vu!.genre, carte.vu!.chantierId);
      setEnCours(null);
      if (!r.ok) {
        setMasquees((v) => v.filter((id) => id !== carte.envoiId));
        setRefus({ chantierId: carte.chantierId, message: r.raison });
      }
    });
  }

  function corriger(carte: Carte) {
    if (enCours) return;
    setEnCours(carte.chantierId);
    setRefus(null);
    demarrer(async () => {
      const r = await corrigerDevisAction(carte.chantierId);
      if (!r.ok) {
        setEnCours(null);
        setRefus({ chantierId: carte.chantierId, message: r.message });
        return;
      }
      router.push(carte.suite.href);
    });
  }

  return (
    <div className="mt-7 flex flex-col gap-3 px-6">
      {visibles.map((n) => {
        return (
          <div
            key={n.envoiId}
            // **Une étiquette de code, pas un libellé.** Le nom du chantier
            // apparaît AUSSI dans la liste en dessous : une suite qui vise le
            // nom attrape la ligne de la liste et croit lire la carte. Vécu le
            // 12 août 2026, sur le contrôle de ce lien même.
            data-atlas="carte-reponse"
            // Le TON, lisible de l'extérieur : sa proposition B ne se prouve
            // qu'à la couleur RENDUE, et un booléen dans le code n'en dit rien
            // (`test-devis-qui-tarde-e2e`).
            data-atlas-ton={n.urgent ? "teinte" : "nu"}
            data-chantier={n.chantierId}
            className="rounded-[18px] px-5 py-4"
            style={{ backgroundColor: n.urgent ? colors.rustTint : colors.card }}
          >
            <p className={smallCaps} style={{ color: n.urgent ? colors.rust : colors.muted, marginBottom: 6 }}>
              {n.titre}
            </p>
            <p className="text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
              {n.chantierNom}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: colors.muted }}>
              {n.texte}
            </p>

            {/* **Le montant est ce qu'il cherche, et il est écrit gros.** Sur
                une facture partiellement réglée c'est le RESTE dû — réclamer le
                total ferait redemander une somme déjà encaissée —, et le total
                l'accompagne pour qu'elle ne passe pas pour une petite facture. */}
            {n.montant && (
              <p className="mt-2" style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2, color: colors.ink }}>
                {n.montant.du}
                {n.montant.sur && (
                  <span className="ml-2 text-[12.5px]" style={{ fontFamily: font.body, color: colors.muted }}>
                    restant sur {n.montant.sur}
                  </span>
                )}
              </p>
            )}

            {/* Le message du client, tel qu'il l'a écrit — jamais résumé, jamais
                reformulé. C'est une citation : les guillemets et le filet de
                gauche disent que ces mots ne sont pas ceux de l'application. */}
            {n.messageClient && (
              <blockquote
                className="mt-3 whitespace-pre-wrap pl-3 text-[14px] leading-relaxed"
                style={{ borderLeft: `2px solid ${colors.rust}`, color: colors.ink }}
              >
                « {n.messageClient} »
              </blockquote>
            )}

            <div className="mt-3 flex items-center gap-4">
              {/* **Le lien mène là où est le geste**, et l'annonce. Voir
                  `suite-de-la-reponse.ts` : un devis accepté s'ouvre figé, tel
                  que le client l'a reçu ; un devis à corriger mène à l'écran
                  qui sait le reprendre — le document, lui, refuserait la
                  première frappe sans dire pourquoi. */}
              {n.suite.reprendreAvant ? (
                // Un bouton, et non un lien : il y a un geste avant l'écran —
                // rouvrir le devis. Un lien mènerait à un document figé.
                <button
                  type="button"
                  onClick={() => corriger(n)}
                  disabled={enCours !== null}
                  className="text-[14px] font-medium disabled:opacity-60"
                  style={{ color: colors.rust }}
                >
                  {enCours === n.chantierId ? "Ouverture…" : n.suite.libelle}
                </button>
              ) : (
                <Link
                  href={n.suite.href}
                  className="text-[14px] font-medium"
                  style={{ color: colors.rust }}
                >
                  {n.suite.libelle}
                </Link>
              )}
              {/* **« Plus tard » n'est pas « J'ai vu ».** Il ne classe rien :
                  il espace le rappel du rythme réglé dans « Notifications », et
                  la facture reste dans l'endroit en attente. C'est le seul
                  moteur du rythme — sans geste, la carte RESTE, parce qu'une
                  carte qui s'endort seule peut passer un jour où il n'ouvre pas
                  l'application. */}
              {/* **« J'AI VU » SUR CHAQUE CARTE — sa demande du 30 août 2026**,
                  capture à l'appui : « pourquoi certaines n'ont pas cette
                  fonction ? Mets la fonction pour toutes ».

                  **Un seul mot, parce que c'est un seul geste** : la carte
                  s'en va. Ce qui se passe derrière diffère, et cela ne regarde
                  pas son doigt — une réponse de client est acquittée pour de
                  bon ; un rappel se tait le temps de son délai réglé, puis
                  revient si la situation n'a pas bougé. Nommer le même geste
                  « Plus tard » ici et « J'ai vu » deux cartes plus bas ferait
                  chercher la différence là où il n'y en a pas. */}
              <button
                type="button"
                data-atlas="j-ai-vu"
                onClick={() => (n.repousser ? repousser(n) : n.vu ? marquerRappel(n) : marquerVue(n.envoiId))}
                disabled={enCours !== null}
                className="text-[14px] font-medium disabled:opacity-60"
                style={{ color: colors.muted }}
              >
                J&apos;ai vu
              </button>
            </div>

            {/* Le refus se lit ici, sous le geste qui l'a provoqué — et il dit
                quoi faire à la place. Un message ailleurs se cherche ; un
                message absent se devine. */}
            {refus?.chantierId === n.chantierId && (
              <p
                className="mt-3 rounded-lg px-3 py-2 text-[13px]"
                style={{ backgroundColor: colors.rustTint, color: colors.rust }}
              >
                {refus.message}
              </p>
            )}
          </div>
        );
      })}

      {enPlus > 0 && (
        <button
          type="button"
          onClick={() => setToutVoir(true)}
          className="text-center text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          {enPlus === 1 ? "1 autre devis à regarder" : `${enPlus} autres devis à regarder`}
        </button>
      )}
    </div>
  );
}
