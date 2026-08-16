"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import { suiteDeLaReponse, type SuiteDeLaReponse } from "@/lib/suite-de-la-reponse";
import { marquerReponseVueAction, corrigerDevisAction } from "./actions";
import type { NotificationPatron, EnvoiCaduc } from "@/server/repositories/envois-devis";

/** Un rappel, déjà mis en mots par le serveur — voir `src/lib/rappels.ts`. */
export type RappelAffiche = {
  genre: "chantier-sans-devis" | "devis-sans-reponse" | "chantier-non-facture";
  chantierId: string;
  chantierNom: string;
  /** « depuis 8 jours » — formulé au serveur, pour que l'écran n'ait pas à
   *  recalculer un délai et à en donner une seconde version. */
  depuisTexte: string;
  /** Le nombre de jours seul — « 14 » —, pour l'étiquette du rappel qu'il a
   *  retenu (proposition B, 16 août 2026). Même source que `depuisTexte` :
   *  deux calculs du même délai finiraient par se contredire. */
  depuisJours: number;
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
  /**
   * Un RAPPEL, pas une nouvelle — et cela change deux choses.
   *
   * Une réponse de client s'acquitte : le patron l'a lue, elle disparaît. Un
   * rappel, lui, n'a rien à acquitter — il décrit une situation qui dure, et il
   * s'en va quand elle cesse : le client répond, la facture part. Lui donner
   * « J'ai vu » ferait croire qu'on peut le classer sans rien faire, et le
   * chantier retomberait dans l'oubli qu'on cherchait justement à éviter.
   */
  rappel?: boolean;
  chantierId: string;
  chantierNom: string;
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
  return {
    // Aucun envoi derrière un rappel : la clé se fabrique, et elle porte le
    // genre — un même chantier peut dormir sur son devis un mois, puis sur sa
    // facture le mois suivant.
    envoiId: `rappel-${r.genre}-${r.chantierId}`,
    chantierId: r.chantierId,
    chantierNom: r.chantierNom,
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
      // **Le chantier, pas le devis vierge.** De la fiche il dicte, il chiffre,
      // ou il écrit le devis à la main — trois chemins, et c'est lui qui sait
      // lequel. L'envoyer d'office sur `devis-complet` choisirait à sa place.
      href: devis || sansDevis ? `/chantiers/${r.chantierId}` : `/chantiers/${r.chantierId}/facture`,
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

  // **LES RAPPELS D'ABORD — sa décision du 16 août 2026, « fait la B ».**
  //
  // La règle d'avant disait l'inverse : *« les réponses d'abord, quelqu'un a agi,
  // cela prime sur un silence »*. Elle se défendait, et elle avait un défaut que
  // seule une photo a montré : l'accueil ne pose que VISIBLES_PAR_DEFAUT cartes,
  // et **dès deux réponses en attente**, un rappel passait derrière « N autres
  // devis à regarder ». Un rappel qu'il faut déplier n'est plus un rappel.
  //
  // Trois dispositions lui ont été PHOTOGRAPHIÉES sur la même scène — deux
  // réponses de clients plus son rappel (`scripts/capture-rang-trois-cas.sh`).
  // Il a retenu B. La troisième — montrer trois cartes au lieu de deux — a été
  // écartée par l'image elle-même : la troisième tombe sous le bord de l'écran.
  //
  // **Ce que ce choix coûte, et il l'a accepté en connaissance de cause :** une
  // acceptation ou un refus peut désormais attendre derrière un rappel. Ce qu'il
  // gagne : ce qu'il doit FAIRE passe avant ce qu'on lui a répondu.
  const cartes = [
    ...rappels.map(rappelVersCarte),
    ...initiales.map(versCarte),
    ...caducs.map(caducVersCarte),
  ];
  const restantes = cartes.filter((n) => !masquees.includes(n.envoiId));
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
              {/* Rien à acquitter sur un rappel : il s'en va quand la
                  situation cesse, pas quand on la regarde. */}
              {!n.rappel && (
                <button
                  type="button"
                  onClick={() => marquerVue(n.envoiId)}
                  className="text-[14px] font-medium"
                  style={{ color: colors.muted }}
                >
                  J&apos;ai vu
                </button>
              )}
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
