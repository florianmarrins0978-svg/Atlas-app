"use client";

import { useState } from "react";
import {
  etatDuJour,
  grilleDuMois,
  libelleMois,
  moisDansFenetre,
  moisDuJour,
  moisPrecedent,
  moisSuivant,
  type JourIso,
  type MoisAffiche,
} from "@/lib/calendrier";

/**
 * Un mois, en grille, où les jours pris ne se touchent pas.
 *
 * **Sa demande du 8 août 2026** : *« passe au calendrier pour le choix des dates
 * à proposer au client, mais également qu'il ait accès au calendrier pour
 * pouvoir proposer une date, avec un système pour qu'il n'ait pas accès aux
 * dates déjà prises par un autre client. »*
 *
 * **Ce que le sélecteur du téléphone ne savait pas faire.** `<input type="date">`
 * accepte une fenêtre (`min`, `max`) mais **ne sait pas griser des jours au
 * milieu**. Le client pouvait donc choisir un jour déjà pris et ne l'apprenait
 * qu'après coup, par un message d'erreur. Un client qui bute sur un refus
 * rappelle, ou renonce.
 *
 * **Le même composant des deux côtés**, et c'est délibéré : le patron choisit
 * une ou deux dates à proposer, le client en choisit une. Deux calendriers
 * écrits séparément finiraient par ne pas griser les mêmes jours — et l'écart se
 * verrait chez le client, jamais ici (`CLAUDE.md` §3).
 *
 * Ce composant ne décide de rien : tout vient de `src/lib/calendrier.ts`,
 * éprouvé sans navigateur.
 */
export default function Calendrier({
  debut,
  fin,
  occupes,
  retenus,
  onBasculer,
  aujourdHui,
  libelleOccupe = "déjà pris",
}: {
  /** Premier jour recevable, inclus. */
  debut: JourIso;
  /** Dernier jour recevable, inclus. */
  fin: JourIso;
  /** Les jours pris par d'autres chantiers — **des dates, rien d'autre**. */
  occupes: readonly JourIso[];
  retenus: readonly JourIso[];
  onBasculer: (jour: JourIso) => void;
  /** Pour souligner le jour même. Passé en propriété : le serveur et le
   *  navigateur ne sont pas toujours le même jour, et un rendu qui diverge
   *  déclenche un avertissement d'hydratation. */
  aujourdHui: JourIso;
  /** Ce qu'entend une personne qui n'utilise pas ses yeux, sur un jour pris. */
  libelleOccupe?: string;
}) {
  const [mois, setMois] = useState<MoisAffiche>(() =>
    moisDuJour(retenus[0] ?? (aujourdHui >= debut && aujourdHui <= fin ? aujourdHui : debut))
  );

  const precedent = moisPrecedent(mois);
  const suivant = moisSuivant(mois);
  const peutReculer = moisDansFenetre(precedent, debut, fin);
  const peutAvancer = moisDansFenetre(suivant, debut, fin);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => peutReculer && setMois(precedent)}
          disabled={!peutReculer}
          aria-label={`Mois précédent : ${libelleMois(precedent)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] disabled:opacity-25"
        >
          ‹
        </button>
        {/* `aria-live` : au clavier, changer de mois sans que rien ne soit
            annoncé donne l'impression que le bouton n'a pas répondu. */}
        <span aria-live="polite" className="text-[15px] font-medium capitalize">
          {libelleMois(mois)}
        </span>
        <button
          type="button"
          onClick={() => peutAvancer && setMois(suivant)}
          disabled={!peutAvancer}
          aria-label={`Mois suivant : ${libelleMois(suivant)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((initiale, i) => (
          // Les initiales se répètent (M, M) : `aria-hidden` évite de les faire
          // lire, et l'intitulé complet de chaque jour vit sur son bouton.
          <span key={i} aria-hidden className="pb-1 text-[11px] uppercase opacity-45">
            {initiale}
          </span>
        ))}

        {grilleDuMois(mois.annee, mois.mois)
          .flat()
          .map((c) => {
            const etat = etatDuJour(c.jour, { debut, fin, occupes, retenus });
            const inactif = etat === "occupe" || etat === "hors_fenetre" || !c.duMois;
            const numero = Number(c.jour.slice(8));
            const lisible = new Date(c.jour + "T00:00:00Z").toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            });

            return (
              <button
                key={c.jour}
                type="button"
                // Un repère stable pour les contrôles : viser « mardi 12 août »
                // les rendrait dépendants de la langue et du fuseau, et un
                // contrôle qui échoue pour cette raison-là accuse à tort.
                data-jour={c.jour}
                data-etat={c.duMois ? etat : "hors_mois"}
                // Un jour hors du mois affiché reste dans le DOM pour tenir la
                // grille, mais il ne se touche pas et ne se lit pas.
                aria-hidden={!c.duMois}
                tabIndex={inactif ? -1 : 0}
                disabled={inactif}
                aria-pressed={etat === "retenu"}
                aria-label={etat === "occupe" ? `${lisible} — ${libelleOccupe}` : lisible}
                onClick={() => !inactif && onBasculer(c.jour)}
                className="flex h-11 items-center justify-center rounded-xl text-[15px] transition-colors"
                style={
                  !c.duMois
                    ? { opacity: 0.18 }
                    : etat === "retenu"
                      ? { backgroundColor: "#2F3B2F", color: "#FAF7F2", fontWeight: 600 }
                      : etat === "occupe"
                        ? // Barré ET estompé : la couleur seule ne se voit pas de
                          // tous les yeux, et une case simplement pâle se lit
                          // comme « libre mais discret ».
                          { opacity: 0.32, textDecoration: "line-through" }
                        : etat === "hors_fenetre"
                          ? { opacity: 0.22 }
                          : c.jour === aujourdHui
                            ? { backgroundColor: "rgba(181,80,47,0.14)", fontWeight: 600 }
                            : { backgroundColor: "rgba(0,0,0,0.035)" }
                }
              >
                {numero}
              </button>
            );
          })}
      </div>

      {occupes.length > 0 && (
        <p className="mt-2 text-[12px] opacity-55">
          Les jours barrés sont déjà pris et ne peuvent pas être choisis.
        </p>
      )}
    </div>
  );
}
