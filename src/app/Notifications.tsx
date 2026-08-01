"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import { marquerReponseVueAction } from "./actions";
import type { NotificationPatron } from "@/server/repositories/envois-devis";

// Ce que le client a répondu, porté au patron (docs/AGENT.md §2.2).
//
// Sans cet écran, un refus vivait uniquement en base : le devis « envoyé »
// restait envoyé pour toujours, et le chantier disparaissait doucement du champ
// de vision de son patron.

/**
 * Combien de réponses s'affichent avant qu'on propose de déplier.
 *
 * Au-delà, la pile de cartes repousse les chantiers hors de l'écran : le patron
 * ouvre son application pour voir son travail, pas pour faire défiler des
 * alertes. Les autres ne sont pas cachées — elles sont annoncées et à un appui.
 */
const VISIBLES_PAR_DEFAUT = 2;

export default function Notifications({ initiales }: { initiales: NotificationPatron[] }) {
  // Retirée à l'écran dès l'appui, sans attendre le serveur : le patron a fait
  // son geste, lui laisser la carte sous les yeux le ferait douter.
  const [masquees, setMasquees] = useState<string[]>([]);
  const [toutVoir, setToutVoir] = useState(false);
  const [, demarrer] = useTransition();

  const restantes = initiales.filter((n) => !masquees.includes(n.envoiId));
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
        const refus = n.reponse === "refusee";
        return (
          <div
            key={n.envoiId}
            className="rounded-[18px] px-5 py-4"
            style={{ backgroundColor: refus ? colors.rustTint : colors.card }}
          >
            <p className={smallCaps} style={{ color: refus ? colors.rust : colors.muted, marginBottom: 6 }}>
              {refus ? "Devis retourné" : "Autre date proposée"}
            </p>
            <p className="text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
              {n.chantierNom}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: colors.muted }}>
              {refus
                ? "Le client n'a pas donné suite. Le devis peut être repris et renvoyé."
                : n.dateRetenue
                  ? `Le client a accepté, et retenu le ${jourLisible(n.dateRetenue)}.`
                  : "Le client a accepté sur une date qu'il a proposée lui-même."}
            </p>

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
          {enPlus === 1 ? "1 autre réponse" : `${enPlus} autres réponses`}
        </button>
      )}
    </div>
  );
}
