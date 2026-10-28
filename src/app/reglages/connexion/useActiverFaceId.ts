"use client";

import { useEffect, useState, useTransition } from "react";
import { estAbandon, messageRefusCle, type CleAppareil } from "@/lib/cle-appareil";
import { defiEnregistrementAction, enregistrerCleAction } from "./actions";

/**
 * ACTIVER FACE ID — le geste, écrit une fois.
 *
 * Sorti de `SectionFaceId` le 26 octobre 2026, quand la fin de la porte
 * (`/creer-un-compte/pret`) a proposé Face ID juste avant d'entrer (sa planche,
 * codée ce jour-là). Deux écrans, un seul geste : une seconde copie aurait
 * fini par ne plus traiter les mêmes refus.
 *
 * `onCles` reçoit la liste des appareils une fois l'enregistrement accepté.
 */
export function useActiverFaceId(onCles: (cles: CleAppareil[]) => void) {
  const [disponible, setDisponible] = useState(false);
  const [teste, setTeste] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let vivant = true;
    import("@simplewebauthn/browser")
      .then(async ({ browserSupportsWebAuthn, platformAuthenticatorIsAvailable }) => {
        const ok = browserSupportsWebAuthn() ? await platformAuthenticatorIsAvailable() : false;
        if (vivant) {
          setDisponible(ok);
          setTeste(true);
        }
      })
      .catch(() => {
        if (vivant) setTeste(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  /**
   * Le geste qu'on REPRENDRA une fois l'identité prouvée.
   *
   * Sans cela, l'artisan taperait son mot de passe puis devrait réappuyer sur
   * « Activer » — et sur un chantier, un geste qu'on refait est un geste qu'on
   * abandonne.
   */
  const [preuveDemandee, setPreuveDemandee] = useState<{ motif: string; reprendre: () => void } | null>(
    null
  );

  function activer() {
    setRefus(null);
    setFait(null);
    demarrer(async () => {
      try {
        // **Lu dans le GESTE, jamais pendant le rendu** — c'est ce qui
        // distingue cet appel du défaut d'hydratation que le dépôt interdit
        // (`ARCHITECTURE.md` §68, §81, §177).
        const defi = await defiEnregistrementAction(window.location.origin);
        if (!defi.ok) {
          setRefus(defi.raison);
          return;
        }
        const { startRegistration } = await import("@simplewebauthn/browser");
        const reponse = await startRegistration(defi.options);
        const r = await enregistrerCleAction(JSON.stringify(reponse));
        if (!r.ok) {
          // Le serveur réclame une identité récente : on la demande, puis on
          // reprend le geste tout seul.
          if (r.preuveExigee) {
            setPreuveDemandee({ motif: r.raison, reprendre: activer });
            return;
          }
          setRefus(r.raison);
          return;
        }
        onCles(r.cles);
        setFait("Cet appareil est enregistré. Vous pourrez ouvrir Atlas avec Face ID.");
      } catch (erreur) {
        const nom = erreur instanceof Error ? erreur.name : null;
        // **Fermer la fenêtre du système n'est pas une faute.** Rien à l'écran.
        // La seule exception : `InvalidStateError`, que le navigateur rend quand
        // l'appareil est DÉJÀ enregistré — là, le taire laisserait croire que
        // rien ne s'est passé, et il réappuierait.
        // **Le journal d'abord.** Le navigateur nomme la vraie cause —
        // `SecurityError` quand le domaine ne s'accorde pas — et sans elle on
        // répare une panne imaginée (`AGENTS.md`).
        // Un abandon en avertissement : `console.error` ouvre le cadre rouge de Next.
        (estAbandon(nom) ? console.warn : console.error)("[face-id] activation refusée par le navigateur", nom, erreur);
        if (nom === "InvalidStateError") setRefus(messageRefusCle("deja-enregistree"));
        // **« panne-activation », et non « panne ».** On est DÉJÀ entré ici :
        // « entrez votre mot de passe » demanderait un geste qu'il vient de
        // faire, et se lirait comme une panne d'Atlas.
        else setRefus(estAbandon(nom) ? null : messageRefusCle("panne-activation"));
      }
    });
  }


  return { disponible, teste, refus, setRefus, fait, setFait, enCours, demarrer, activer, preuveDemandee, setPreuveDemandee };
}
