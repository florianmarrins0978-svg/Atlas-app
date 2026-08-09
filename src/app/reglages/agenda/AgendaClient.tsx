"use client";

import { useState, useTransition } from "react";
import { colors, font } from "@/lib/design-tokens";
import { agendaPrisEnCompte, titreEtatAgenda } from "@/lib/agenda-externe";
import type { EtatAgenda } from "@/server/repositories/agendas-externes";
import {
  basculerAgendaAction,
  debrancherAgendaAction,
  demarrerRaccordementAction,
} from "./actions";

/**
 * Ce que l'écran doit dire, et dans quel ordre.
 *
 * **La règle qui commande tout ici :** l'artisan doit savoir, en une phrase,
 * **si Atlas tient compte de son agenda ou non**. Un raccordement mort en
 * silence est pire que pas de raccordement du tout — il croit être protégé du
 * doublon, et il ne l'est plus.
 */
const MESSAGES_RETOUR: Record<string, { ton: "bien" | "mal"; texte: string }> = {
  relie: { ton: "bien", texte: "Votre agenda est relié. Atlas en tiendra compte dès la prochaine proposition de date." },
  refus: { ton: "mal", texte: "Vous avez annulé chez Google. Rien n'a été relié, et rien n'a changé." },
  etat: {
    ton: "mal",
    texte:
      "Le retour de Google n'a pas pu être vérifié — le lien a peut-être expiré, ou il ne venait pas de vous. Rien n'a été relié : recommencez.",
  },
  non_configure: {
    ton: "mal",
    texte: "Cette installation n'a pas d'identifiants Google. Rien ne peut être relié pour l'instant.",
  },
  echec: { ton: "mal", texte: "Google n'a pas accepté le raccordement. Rien n'a été relié : vous pouvez réessayer." },
};

export default function AgendaClient({ etat, issue }: { etat: EtatAgenda; issue: string | null }) {
  const [enCours, demarrer] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const retour = issue ? MESSAGES_RETOUR[issue] ?? null : null;

  return (
    <div className="px-6 pt-6">
      {retour && (
        <p
          role="status"
          className="mb-5 rounded-2xl px-4 py-3 text-[14px] leading-snug"
          style={{
            backgroundColor: colors.rustTint,
            borderLeft: `3px solid ${retour.ton === "bien" ? colors.sage : colors.alert}`,
            color: colors.ink,
          }}
        >
          {retour.texte}
        </p>
      )}

      {/* --- L'état, en une phrase, avant toute commande ------------------ */}
      <section
        className="rounded-3xl px-5 py-5"
        style={{ backgroundColor: colors.rustTint }}
      >
        <p className="text-[18px] leading-snug" style={{ fontFamily: font.display }}>
          {titreEtatAgenda(etat)}
        </p>

        {etat.compte && (
          <p className="mt-1 text-[14px]" style={{ color: colors.muted }}>
            Compte : {etat.compte}
          </p>
        )}

        {!etat.configure && (
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Il faut d&apos;abord créer des identifiants Google pour cette application. C&apos;est gratuit, mais
            cela demande un compte Google et l&apos;acceptation de conditions — donc vous, personne d&apos;autre.
          </p>
        )}

        {etat.configure && !etat.relie && (
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Sans agenda relié, Atlas propose des dates à partir de vos seuls chantiers. Si vous notez un
            rendez-vous ailleurs, il pourra proposer ce jour-là — et c&apos;est le client qui le choisira.
          </p>
        )}

        {agendaPrisEnCompte(etat) && (
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Atlas lit uniquement <strong>vos créneaux occupés</strong>{" "}— jamais le titre d&apos;un rendez-vous, ni
            qui y participe. Une demi-journée prise dans votre agenda ne sera plus proposée.
          </p>
        )}

        {/* **La panne se voit, elle ne se tait pas.** Sans cette ligne,
            l'artisan croirait son agenda pris en compte alors qu'Atlas est
            revenu, en silence, au comportement qui produisait des doublons. */}
        {etat.derniereErreur && (
          <p
            className="mt-4 rounded-2xl px-4 py-3 text-[13px] leading-snug"
            style={{ backgroundColor: colors.rustTint, borderLeft: `3px solid ${colors.alert}`, color: colors.ink }}
          >
            <strong>Atlas n&apos;arrive plus à lire votre agenda.</strong> En attendant, il propose des dates à
            partir de vos seuls chantiers — donc un doublon reste possible. Rebranchez-le pour repartir.
            <span className="mt-2 block" style={{ color: colors.muted }}>
              Détail : {etat.derniereErreur}
            </span>
          </p>
        )}

        {etat.derniereLectureAt && !etat.derniereErreur && (
          <p className="mt-3 text-[13px]" style={{ color: colors.muted }}>
            Dernière lecture : {new Date(etat.derniereLectureAt).toLocaleString("fr-FR")}
          </p>
        )}
      </section>

      {/* --- Les commandes ------------------------------------------------ */}
      {etat.configure && (
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            disabled={enCours}
            onClick={() => demarrer(() => void demarrerRaccordementAction())}
            className="rounded-full px-5 py-3 text-[15px] font-medium"
            style={{ backgroundColor: colors.rust, color: "#fff", opacity: enCours ? 0.6 : 1 }}
          >
            {etat.relie ? "Rebrancher mon agenda Google" : "Relier mon agenda Google"}
          </button>

          {etat.relie && (
            <button
              type="button"
              disabled={enCours}
              onClick={() => demarrer(() => void basculerAgendaAction(!etat.actif))}
              className="rounded-full px-5 py-3 text-[15px] font-medium"
              style={{ backgroundColor: colors.rustTint, color: colors.rust, opacity: enCours ? 0.6 : 1 }}
            >
              {etat.actif ? "Mettre en pause" : "Reprendre la lecture"}
            </button>
          )}

          {etat.relie && !confirmation && (
            <button
              type="button"
              onClick={() => setConfirmation(true)}
              className="px-5 py-2 text-[14px] font-medium"
              style={{ color: colors.muted }}
            >
              Débrancher et effacer
            </button>
          )}

          {/* Une suppression se confirme. Elle efface des jetons qu'il faudra
              retourner chercher chez Google, et un doigt qui glisse sur un
              téléphone ne doit pas coûter ça. */}
          {etat.relie && confirmation && (
            <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: colors.rustTint, borderLeft: `3px solid ${colors.alert}` }}>
              <p className="text-[14px] leading-snug">
                Atlas oubliera ce raccordement et cessera de lire votre agenda. Vous pourrez le relier à nouveau
                quand vous voudrez.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => demarrer(() => void debrancherAgendaAction())}
                  className="rounded-full px-4 py-2 text-[14px] font-medium"
                  style={{ backgroundColor: colors.alert, color: "#fff" }}
                >
                  Débrancher
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmation(false)}
                  className="px-4 py-2 text-[14px] font-medium"
                  style={{ color: colors.muted }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
