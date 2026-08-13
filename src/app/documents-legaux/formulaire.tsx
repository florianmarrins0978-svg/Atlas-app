"use client";

import { useActionState, useState } from "react";
import { accepterDocumentsAction } from "./actions";
import type { DocumentAAccepter } from "@/server/repositories/documents-legaux";

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
          <section key={doc.id} className="rounded-[4px] bg-white p-5 shadow-sm">
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
              className="mt-3 text-[14px] font-medium text-[#B5502F] underline underline-offset-2"
            >
              {ouvert ? "Replier le texte" : "Lire le texte"}
            </button>

            {ouvert && (
              <div className="mt-3 max-h-80 overflow-y-auto rounded-[4px] border border-black/10 bg-[#FAF8F4] p-4">
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
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-black/20"
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

      <button
        type="submit"
        disabled={enCours}
        className="rounded-full bg-[#B5502F] py-3 text-[15px] font-medium text-white disabled:opacity-50"
      >
        {enCours ? "Enregistrement…" : "Continuer"}
      </button>

      <p className="text-center text-[12px] leading-relaxed text-ink/50">
        La date, l&apos;heure et la version exacte de ce que vous acceptez sont
        conservées — c&apos;est ce qui donne sa valeur à votre accord.
      </p>
    </form>
  );
}
