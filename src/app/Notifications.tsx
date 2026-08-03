"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import { marquerReponseVueAction } from "./actions";
import type { NotificationPatron, EnvoiCaduc } from "@/server/repositories/envois-devis";

// Ce qu'est devenu un devis parti, porté au patron (docs/AGENT.md §2.2).
//
// Sans cet écran, un refus vivait uniquement en base : le devis « envoyé »
// restait envoyé pour toujours, et le chantier disparaissait doucement du champ
// de vision de son patron. Un lien expiré, lui, ne se signalait nulle part —
// personne n'ayant rien fait, rien ne le rappelait.

/** Ce qui s'affiche, quelle qu'en soit l'origine. */
type Carte = {
  envoiId: string;
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
  };
}

export default function Notifications({
  initiales,
  caducs,
}: {
  initiales: NotificationPatron[];
  caducs: EnvoiCaduc[];
}) {
  // Retirée à l'écran dès l'appui, sans attendre le serveur : le patron a fait
  // son geste, lui laisser la carte sous les yeux le ferait douter.
  const [masquees, setMasquees] = useState<string[]>([]);
  const [toutVoir, setToutVoir] = useState(false);
  const [, demarrer] = useTransition();

  // Les réponses d'abord : quelqu'un a agi, cela prime sur un silence.
  const cartes = [...initiales.map(versCarte), ...caducs.map(caducVersCarte)];
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

  return (
    <div className="mt-7 flex flex-col gap-3 px-6">
      {visibles.map((n) => {
        return (
          <div
            key={n.envoiId}
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
              <Link
                href={`/chantiers/${n.chantierId}`}
                className="text-[14px] font-medium"
                style={{ color: colors.rust }}
              >
                Ouvrir le chantier
              </Link>
              <button
                type="button"
                onClick={() => marquerVue(n.envoiId)}
                className="text-[14px] font-medium"
                style={{ color: colors.muted }}
              >
                J&apos;ai vu
              </button>
            </div>
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
