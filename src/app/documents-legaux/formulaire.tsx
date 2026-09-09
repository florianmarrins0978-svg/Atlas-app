"use client";

import { useActionState, useState } from "react";
import { accepterDocumentsAction } from "./actions";
import type { DocumentAAccepter } from "@/server/repositories/documents-legaux";
import { colors, surPlein } from "@/lib/design-tokens";

// Condition 2 de docs/RGPD.md §8 : une acceptation EXPLICITE. Concrètement —
// une case par document, jamais pré-cochée, jamais une case unique valant pour
// tout, et le texte lisible AVANT de cocher (chaque document est déplié sur
// place, sans quitter l'écran ni ouvrir un lien qu'on découvrirait après).
export default function FormulaireAcceptation({ documents }: { documents: DocumentAAccepter[] }) {
  const [etat, action, enCours] = useActionState(accepterDocumentsAction, undefined);
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});

  return (
    <form action={action} className="flex flex-col gap-4">
      {documents.map((doc) => {
        const ouvert = ouverts[doc.id] ?? false;
        return (
          <section key={doc.id} className="rounded-[4px] bg-card p-5 shadow-sm">
            <h2
              className="text-[17px] font-semibold text-ink"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {doc.titre}
            </h2>
            <p className="mt-1 text-[12px] text-ink/50">Version {doc.version}</p>

            <button
              type="button"
              onClick={() => setOuverts((o) => ({ ...o, [doc.id]: !ouvert }))}
              aria-expanded={ouvert}
              className="mt-3 text-[14px] font-medium text-accent underline underline-offset-2"
            >
              {ouvert ? "Replier le texte" : "Lire le texte"}
            </button>

            {ouvert && (
              <div className="mt-3 max-h-80 overflow-y-auto rounded-[4px] border border-line bg-paper p-4">
                <pre className="whitespace-pre-wrap font-body text-[13px] leading-relaxed text-ink/80">
                  {doc.contenu}
                </pre>
              </div>
            )}

            <label className="mt-4 flex items-start gap-3 text-[14px] text-ink">
              {/* Jamais `defaultChecked` : une case pré-cochée ne recueille aucun
                  consentement, elle le présume. */}
              <input
                type="checkbox"
                name={`accepte_${doc.id}`}
                value="oui"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-line"
              />
              <span>
                J&apos;ai lu et j&apos;accepte&nbsp;: <strong>{doc.titre}</strong>
              </span>
            </label>
          </section>
        );
      })}

      {etat?.erreur && (
        <p role="alert" className="text-[13px] text-red-600">
          {etat.erreur}
        </p>
      )}

      {/* **Le vert des boutons — 4 septembre 2026.** Ce bouton-ci n'était même
          pas vert : il portait la terre cuite de la page du client, écrite en
          clair, sur un écran qui est le SIEN. Le balayage du 3 septembre ne
          pouvait pas le voir — il ne cherchait que `colors.rust`. */}
      <button
        type="submit"
        disabled={enCours}
        className="atlas-plein rounded-full py-3 text-[15px] font-medium disabled:opacity-50"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        {enCours ? "Enregistrement…" : "Continuer"}
      </button>

      {/* **RETIRÉ le 9 septembre 2026, à sa demande** : *« la phrase sous
          continuer, supprime-la »*. Elle disait que la date, l'heure et la
          version sont conservées — c'est-à-dire qu'elle expliquait le
          mécanisme de l'écran au lieu de le laisser faire. Sa consigne du
          25 août : « le moins de mots possible ».

          **Ce qu'elle annonçait n'a pas disparu pour autant** : l'horodatage,
          l'adresse et l'appareil sont toujours enregistrés
          (`enregistrerAcceptations`), et c'est toujours ce qui donne sa valeur
          à l'accord. Ce qui est parti, c'est le commentaire — pas la preuve. */}
    </form>
  );
}
