"use client";

import { useState, useTransition } from "react";
import { colors, font } from "@/lib/design-tokens";
import type { Fournisseur } from "@/lib/fournisseurs-connexion";
import { entrerAvecAction } from "./actions";

/**
 * GOOGLE ET APPLE, CÔTE À CÔTE — écran 3 de `appli/la-porte-en-plein-air.html`.
 *
 * Sa demande du 10 septembre 2026 : *« je veux pouvoir me connecter avec Google
 * ou Apple »*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE COMPOSANT NE DÉCIDE PAS QUI S'AFFICHE.** Il dessine ce qu'on lui donne.
 * La liste se calcule au serveur, où vivent les clés (`page.tsx`) — un écran ne
 * peut pas lire l'environnement.
 *
 * **Depuis le 11 septembre 2026, les deux marques sont toujours là** : sa
 * décision, prise en connaissance du coût. Une marque dont les clés manquent se
 * dessine comme les autres et REFUSE à l'appui, en disant ce qui manque
 * (`entrerAvecAction`). C'est le refus qui porte la vérité, pas un bouton gris.
 *
 * **Les logos sont recopiés de la planche, chemin pour chemin.** Ils portent
 * les couleurs des deux marques, qui ne suivent aucune charte : un Google
 * repeint en vert n'est plus un Google, et c'est ce que les deux maisons
 * interdisent dans leurs règles d'usage. C'est la seule exception admise à
 * « aucune couleur écrite en clair » (`CLAUDE.md` §3), et elle s'arrête aux
 * deux marques — tout le reste du bouton vient des jetons.
 */

function Logo({ nom }: { nom: string }) {
  if (nom === "google") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" className="flex-none">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
      </svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="flex-none">
      <path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-4-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5.6-.9.9-1.7 1.2-2.6-2.7-1-2.4-4-2.4-4.1Z" />
      <path d="M14.3 4.3c.7-.9 1.2-2.1 1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3.1-1.5Z" />
    </svg>
  );
}

export default function BoutonsFournisseurs({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  if (fournisseurs.length === 0) return null;

  return (
    <>
      <div className="flex gap-[10px]">
        {fournisseurs.map((f) => (
          <button
            key={f.nom}
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                setRefus(null);
                const r = await entrerAvecAction(f.nom);
                if (r?.erreur) setRefus(r.erreur);
              })
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-full px-2 py-[14px] text-[14.5px] font-medium transition-transform active:scale-[0.985] disabled:opacity-60"
            /**
             * **Une marque non branchée se dessine PAREIL.** Elle ne se grise
             * pas : un bouton éteint sur le seul écran d'avant la connexion se
             * lit comme une application en panne, et c'est justement ce qu'il
             * ne voulait plus voir. Ce qui dit la vérité, c'est la RÉPONSE à
             * l'appui — une phrase qui nomme ce qui manque et ce qui marche.
             */
            style={{
              backgroundColor: colors.card,
              color: colors.ink,
              boxShadow: `inset 0 0 0 1px ${colors.line}`,
              fontFamily: font.body,
            }}
          >
            <Logo nom={f.nom} />
            {f.libelle}
          </button>
        ))}
      </div>

      {/* La place n'est pas réservée : ce message naît SOUS le bouton qu'on
          vient de toucher, jamais sous celui qu'on s'apprête à toucher. Rien ne
          bouge sous le doigt — même raisonnement que `LigneFaceId`. */}
      {refus && (
        <p className="mt-2.5 text-[13px] leading-[19px]" style={{ color: colors.alert }} role="alert" aria-live="polite">
          {refus}
        </p>
      )}

      <div className="my-[14px] flex items-center gap-3 text-[13px]" style={{ color: colors.muted }} aria-hidden="true">
        <span className="h-px flex-1" style={{ backgroundColor: colors.line }} />
        ou
        <span className="h-px flex-1" style={{ backgroundColor: colors.line }} />
      </div>
    </>
  );
}
