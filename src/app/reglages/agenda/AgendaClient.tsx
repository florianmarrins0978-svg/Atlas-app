"use client";

import { useState, useTransition } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { agendaPrisEnCompte, titreEtatAgenda } from "@/lib/agenda-externe";
import type { EtatAgenda } from "@/server/repositories/agendas-externes";
import {
  basculerAgendaAction,
  debrancherAgendaAction,
  demarrerRaccordementAction,
  enregistrerIdentifiantsAction,
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
  identifiants: {
    ton: "bien",
    texte: "Vos identifiants sont enregistrés. Il reste à autoriser Atlas chez Google, avec le bouton ci-dessous.",
  },
};

export default function AgendaClient({ etat, issue }: { etat: EtatAgenda; issue: string | null }) {
  const [enCours, demarrer] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const retour = issue ? MESSAGES_RETOUR[issue] ?? null : null;

  // La saisie des identifiants s'ouvre d'elle-même tant que rien n'est
  // configuré : c'est le seul geste utile à ce moment-là, et le cacher derrière
  // un dépliant ferait chercher.
  const [saisieOuverte, setSaisieOuverte] = useState(!etat.configure);
  const [clientId, setClientId] = useState(etat.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [redirection, setRedirection] = useState(
    etat.redirection ?? (typeof window !== "undefined" ? `${window.location.origin}/api/agenda/google/retour` : "")
  );
  const [motifRefus, setMotifRefus] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const enregistrerIdentifiants = () => {
    setMotifRefus(null);
    setEnregistre(false);
    demarrer(async () => {
      const r = await enregistrerIdentifiantsAction({ clientId, clientSecret, redirection });
      if (r.ok) {
        setEnregistre(true);
        setClientSecret("");
        // La page se recharge pour que l'état vienne du serveur, jamais d'une
        // supposition de l'écran sur ce qui a été écrit.
        window.location.href = "/reglages/agenda?issue=identifiants";
      } else {
        setMotifRefus(r.motif);
      }
    });
  };

  return (
    <div className="px-6 pt-6">
      {retour && (
        <p
          role="status"
          className="mb-5 rounded-[4px] px-4 py-3 text-[14px] leading-snug"
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
        className="rounded-[4px] px-5 py-5"
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
            Il faut d&apos;abord créer des identifiants Google pour cette application, puis les coller
            ci-dessous. C&apos;est gratuit, mais cela demande un compte Google et l&apos;acceptation de
            conditions — donc vous, personne d&apos;autre.
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
            className="mt-4 rounded-[4px] px-4 py-3 text-[13px] leading-snug"
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

      {/* --- Ses identifiants Google -------------------------------------- */}
      {/*
        **Saisis ICI plutôt que posés sur le serveur, et c'est sa demande.**
        La veille, le raccordement attendait des variables d'environnement : il
        créait son projet chez Google, obtenait ses identifiants, et devait
        ensuite les faire poser par quelqu'un. Le point restait bloqué chez moi
        alors qu'il avait fait sa part.
      */}
      <div className="mt-5">
        {!saisieOuverte && (
          <button
            type="button"
            onClick={() => setSaisieOuverte(true)}
            className="px-1 text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            {etat.configure ? "Changer mes identifiants Google" : "Coller mes identifiants Google"}
          </button>
        )}

        {saisieOuverte && (
          <section className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.rustTint }}>
            <p className="text-[16px]" style={{ fontFamily: font.display, marginBottom: 6 }}>
              Mes identifiants Google
            </p>
            <p className="text-[13px] leading-snug" style={{ color: colors.muted, marginBottom: 14 }}>
              Ils se créent une fois, sur <strong>console.cloud.google.com</strong> : un projet, l&apos;API
              Google Agenda activée, puis un identifiant OAuth de type « application Web ». Collez ensuite
              l&apos;adresse de retour ci-dessous <strong>à l&apos;identique</strong> dans la console — Google
              refuse au moindre écart.
            </p>

            <Champ
              libelle="Identifiant client"
              valeur={clientId}
              onChange={setClientId}
              exemple="1234-abcd.apps.googleusercontent.com"
            />
            <Champ
              libelle="Secret client"
              valeur={clientSecret}
              onChange={setClientSecret}
              exemple={etat.configure ? "(déjà enregistré — laissez vide pour le garder)" : "GOCSPX-…"}
              masque
            />
            <Champ
              libelle="Adresse de retour"
              valeur={redirection}
              onChange={setRedirection}
              exemple="https://…/api/agenda/google/retour"
            />

            {motifRefus && (
              <p
                role="alert"
                className="mt-3 rounded-[4px] px-4 py-3 text-[13px] leading-snug"
                style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}
              >
                {motifRefus}
              </p>
            )}
            {enregistre && !motifRefus && (
              <p className="mt-3 text-[13px]" style={{ color: colors.rust }}>
                Enregistré.
              </p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={enCours}
                onClick={enregistrerIdentifiants}
                className="rounded-full px-5 py-3 text-[15px] font-medium"
                style={{ backgroundColor: colors.rust, color: surPlein, opacity: enCours ? 0.6 : 1 }}
              >
                Enregistrer
              </button>
              {etat.configure && (
                <button
                  type="button"
                  onClick={() => setSaisieOuverte(false)}
                  className="px-4 py-2 text-[14px] font-medium"
                  style={{ color: colors.muted }}
                >
                  Annuler
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* --- Les commandes ------------------------------------------------ */}
      {etat.configure && (
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            disabled={enCours}
            onClick={() => demarrer(() => void demarrerRaccordementAction())}
            className="rounded-full px-5 py-3 text-[15px] font-medium"
            style={{ backgroundColor: colors.rust, color: surPlein, opacity: enCours ? 0.6 : 1 }}
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
            <div className="rounded-[4px] px-4 py-4" style={{ backgroundColor: colors.rustTint, borderLeft: `3px solid ${colors.alert}` }}>
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
                  style={{ backgroundColor: colors.alert, color: surPlein }}
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

/**
 * Une case de saisie, avec son libellé et un exemple.
 *
 * Le secret est masqué à la frappe : ces écrans se remplissent souvent à deux,
 * ou en visio avec quelqu'un qui aide.
 */
function Champ({
  libelle,
  valeur,
  onChange,
  exemple,
  masque = false,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  exemple: string;
  masque?: boolean;
}) {
  return (
    <label className="mb-3 block">
      <span className="block text-[13px]" style={{ color: colors.muted, marginBottom: 4 }}>
        {libelle}
      </span>
      <input
        type={masque ? "password" : "text"}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={exemple}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-[4px] px-4 py-3 text-[15px]"
        style={{ backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
      />
    </label>
  );
}
