"use client";

import { useEffect, useState, useTransition } from "react";
import { colors, font, texteSituation } from "@/lib/design-tokens";
import { estAbandon, messageRefusCle } from "@/lib/cle-appareil";
import { connexionParCleAction, defiConnexionAction } from "./actions";

/**
 * « Ouvrir avec Face ID » sur la porte — **sa proposition B**, tranchée le
 * 24 août 2026 sur la planche 94 (`appli/face-id.html`).
 *
 * *« B — ta porte d'aujourd'hui, plus une ligne au-dessus. Rien ne change de
 * place. »* L'adresse, le mot de passe et « Entrer » sont exactement là où ils
 * étaient : cette ligne s'ajoute, elle ne remplace rien.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **ELLE NE S'AFFICHE QUE SI L'APPAREIL SAIT LE FAIRE.** Un bouton qui ne peut
 * pas aboutir est pire qu'un bouton absent : on appuie, rien ne se passe, et on
 * croit l'application cassée. `platformAuthenticatorIsAvailable()` répond pour
 * ce téléphone-ci — un vieil ordinateur de bureau ne verra jamais cette ligne.
 *
 * **Elle s'affiche même si AUCUNE clé n'est encore posée**, et c'est voulu : à
 * cet instant personne ne s'est nommé, donc Atlas ne peut pas savoir si ce
 * compte-là en a une (le lui demander supposerait de faire taper l'adresse, ce
 * qui tue le geste rapide). Si rien ne répond, le téléphone le dit lui-même et
 * l'on retombe sur le mot de passe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **UN ÉCHEC NE DIT RIEN DU MOT DE PASSE, et ne compte aucune tentative.**
 * Fermer la fenêtre d'iOS est un geste ordinaire — on s'est trompé de bouton.
 * Y répondre par un message rouge, c'est accuser quelqu'un qui n'a rien fait,
 * et c'est ainsi qu'on apprend à ne plus lire les messages. `estAbandon`
 * tranche, et rend `null` : l'écran se tait et rend la main au clavier.
 */
export default function LigneFaceId() {
  const [disponible, setDisponible] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let vivant = true;
    // Chargé à la demande : l'écrasante majorité des ouvertures de cette page
    // n'appuiera jamais dessus, et la porte doit rester la plus légère de
    // l'application — c'est le seul écran qu'on voit avant d'être connecté.
    import("@simplewebauthn/browser")
      .then(async ({ browserSupportsWebAuthn, platformAuthenticatorIsAvailable }) => {
        if (!browserSupportsWebAuthn()) return;
        const ok = await platformAuthenticatorIsAvailable();
        if (vivant) setDisponible(ok);
      })
      .catch(() => {
        // Silencieux à dessein : ne pas pouvoir proposer Face ID n'est pas une
        // panne. La porte marche sans lui.
      });
    return () => {
      vivant = false;
    };
  }, []);

  function ouvrir() {
    setRefus(null);
    demarrer(async () => {
      try {
        // Lu dans le geste : l'adresse par laquelle il a ouvert Atlas.
        const defi = await defiConnexionAction(window.location.origin);
        if (!defi.ok) {
          setRefus(messageRefusCle("panne"));
          return;
        }
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const reponse = await startAuthentication(defi.options);
        const r = await connexionParCleAction(JSON.stringify(reponse));
        // `connexionParCleAction` redirige quand elle réussit ; si l'on est
        // encore là, c'est qu'elle a rendu quelque chose.
        if (r?.erreur) setRefus(r.erreur);
      } catch (erreur) {
        /**
         * **LA RÉUSSITE PASSE AUSSI PAR ICI, et c'est le piège.** Une action
         * serveur qui redirige le fait en LEVANT — `connexionParCleAction`
         * envoie vers l'accueil, et cette levée-là arrive dans ce `catch`.
         * Traitée comme une panne, elle affichait « Face ID n'a pas pu
         * aboutir » **au moment même où l'on entrait**, sur le seul écran qu'on
         * voit avant d'être connecté.
         *
         * Elle se relance : c'est Next qui doit la recevoir, pas l'artisan.
         * Trouvé le 26 août 2026 en rendant le défaut bavard (`AGENTS.md`) —
         * aucun test ne le voyait, la navigation ayant lieu quand même.
         */
        if (typeof (erreur as { digest?: unknown })?.digest === "string" &&
            (erreur as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
          throw erreur;
        }
        const nom = erreur instanceof Error ? erreur.name : null;
        console.error("[face-id] ouverture refusée par le navigateur", nom, erreur);
        // **Rien à l'écran quand il a simplement fermé la fenêtre.**
        setRefus(estAbandon(nom) ? null : messageRefusCle("panne"));
      }
    });
  }

  if (!disponible) return null;

  return (
    <div className="mb-[22px]">
      <button
        type="button"
        onClick={ouvrir}
        disabled={enCours}
        // `rounded-full` : sa demande du 12 août 2026, la même forme partout.
        // `test-boutons-arrondis.ts` l'a attrapé — cette ligne était née en
        // 12 px, recopiée de la planche, où aucune règle du produit ne
        // s'applique.
        className="flex w-full items-center gap-3 rounded-full px-[18px] py-[12px] text-left transition-transform active:scale-[0.99] disabled:opacity-60"
        style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}`, minHeight: 56 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.rust}
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
          className="flex-none"
        >
          <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M9 10v1.5M15 10v1.5M12 10v3.2h-1M9 15.6c1.6 1.2 4.4 1.2 6 0" />
        </svg>
        <span style={{ fontFamily: font.body, fontSize: 15, color: colors.ink }}>
          {enCours ? "Ouverture…" : "Ouvrir avec Face ID"}
        </span>
      </button>

      {/* **La place n'est PAS réservée ici, contrairement au refus du mot de
          passe en dessous — et la capture du 24 août a tranché.** Réservée, elle
          creusait un trou de soixante-quinze pixels entre cette ligne et
          « Adresse », sur le seul écran qu'on voit avant d'être connecté.
          La raison de réserver ne s'applique pas : ce message naît SOUS le
          bouton qu'on vient de toucher, jamais sous celui qu'on s'apprête à
          toucher. Rien ne bouge sous le doigt. */}
      {refus && (
        <p className={`mt-2.5 ${texteSituation}`} style={{ color: colors.alert }} role="alert" aria-live="polite">
          {refus}
        </p>
      )}
    </div>
  );
}
