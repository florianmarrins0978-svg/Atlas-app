"use client";

import { useActionState, useState, useTransition } from "react";
import { accepterDocumentsAction } from "./actions";
import { deconnexionAction } from "@/app/login/actions";
import type { DocumentAAccepter } from "@/server/repositories/documents-legaux";
import { colors } from "@/lib/design-tokens";
import { NUIT, SERIF } from "@/components/atlas/PorteDeNuit";
import { rendreMarkdownSimple } from "@/components/atlas/rendreMarkdownSimple";

// Condition 2 de docs/RGPD.md §8 : une acceptation EXPLICITE. Concrètement,
// une case par document, jamais pré-cochée, jamais une case unique valant pour
// tout, et le texte lisible AVANT de cocher (chaque document est déplié sur
// place, sans quitter l'écran ni ouvrir un lien qu'on découvrirait après).
//
// **Le dessin est celui de la planche `appli/documents-legaux-accepter.html`,
// validée le 11 octobre 2026** : la carte de la porte, « Lire le texte » en
// rangée qu'on touche au pouce, la case dessinée et la rangée entière qui la
// coche, « Continuer » qui reste en bas pendant que les cartes défilent.
export default function FormulaireAcceptation({ documents }: { documents: DocumentAAccepter[] }) {
  const [etat, action, enCours] = useActionState(accepterDocumentsAction, undefined);
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  // **Tenues ici, et non par le navigateur** : après un refus, React remet le
  // formulaire à zéro, et les cases déjà cochées se décochaient. On ne
  // redemande pas un accord déjà donné ; on ne le présume pas davantage, le
  // départ est toujours `false`.
  const [coches, setCoches] = useState<Record<string, boolean>>({});
  const [sortieEnCours, demarrerSortie] = useTransition();
  const occupe = enCours || sortieEnCours;

  function sortir() {
    // Pas de `catch` : l'action se termine par une redirection qui remonte
    // jusqu'au routeur ; l'avaler laisserait l'écran en place, cookie effacé.
    demarrerSortie(async () => {
      await deconnexionAction("entree");
    });
  }

  return (
    <form action={action} className="mt-6 flex flex-1 flex-col">
      <div className="flex flex-col gap-3">
        {documents.map((doc) => {
          const ouvert = ouverts[doc.id] ?? false;
          const coche = coches[doc.id] ?? false;
          return (
            <section
              key={doc.id}
              className="overflow-hidden rounded-[20px]"
              style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              <div className="px-[18px] pt-[18px]">
                <h2 className="text-[20px] leading-[1.2]" style={{ ...SERIF, color: colors.ink }}>
                  {doc.titre}
                </h2>
                <p className="mt-[5px] text-[12.5px]" style={{ color: colors.inkSoft }}>
                  Version {doc.version}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOuverts((o) => ({ ...o, [doc.id]: !ouvert }))}
                aria-expanded={ouvert}
                className="mt-1 flex min-h-[44px] w-full items-center justify-between px-[18px] text-left text-[15px]"
                style={{ color: colors.ink }}
              >
                {ouvert ? "Replier le texte" : "Lire le texte"}
                {/* Le chevron dit si c'est ouvert : il montre un état, il ne
                    décore pas (`CLAUDE.md` §3). */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 transition-transform duration-200"
                  style={{ color: colors.muted, transform: ouvert ? "rotate(180deg)" : undefined }}
                >
                  <path d="m5 9 7 7 7-7" />
                </svg>
              </button>

              {ouvert && (
                <div
                  className="mx-3 flex max-h-80 flex-col gap-3 overflow-y-auto rounded-[14px] p-4 text-[14px] leading-[1.6] [&_blockquote]:border-line [&_h4]:text-[15px] [&_h4]:text-ink [&_strong]:font-semibold [&_strong]:text-ink"
                  style={{ background: colors.cream, color: colors.inkSoft }}
                >
                  {rendreMarkdownSimple(doc.contenu, { joindreLesLignes: true })}
                </div>
              )}

              <label
                className="mt-[6px] flex min-h-[60px] cursor-pointer items-center gap-[14px] px-[18px] pb-1 text-[15.5px] has-[:focus-visible]:outline-2"
                style={{ borderTop: `1px solid ${colors.line}`, color: colors.ink, outlineColor: colors.or, outlineOffset: -2 }}
              >
                <span className="relative grid h-[26px] w-[26px] shrink-0 place-items-center">
                  {/* Jamais `defaultChecked` ni coche de départ : une case
                      pré-cochée ne recueille aucun consentement, elle le
                      présume. Le vrai champ est posé sur la case dessinée :
                      c'est lui que le pouce touche, et lui que le formulaire
                      envoie. */}
                  <input
                    type="checkbox"
                    name={`accepte_${doc.id}`}
                    value="oui"
                    checked={coche}
                    onChange={(e) => setCoches((c) => ({ ...c, [doc.id]: e.target.checked }))}
                    className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none grid h-full w-full place-items-center rounded-[8px]"
                    style={coche ? { background: colors.ink } : { boxShadow: `inset 0 0 0 1.6px ${colors.muted}` }}
                  >
                    {coche && (
                      <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke={colors.cream} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1.5 5.5l4 4 7-8" />
                      </svg>
                    )}
                  </span>
                </span>
                J&apos;ai lu et j&apos;accepte
              </label>
            </section>
          );
        })}
      </div>

      {/* « Continuer » reste sous le pouce : ouvrir un texte le poussait hors
          de vue. Le fond reprend le bas de la porte, pour que les cartes
          passent dessous sans se lire au travers. */}
      <div
        className="atlas-bas-sans-barre sticky bottom-0 mt-auto pt-3"
        style={{ background: `linear-gradient(to bottom, transparent, ${NUIT.cream} 14px)` }}
      >
        <p role="alert" className="mx-[2px] mb-1 min-h-[21px] text-[13.5px] leading-[21px]" style={{ color: colors.alert }}>
          {etat?.erreur ?? ""}
        </p>

        {/* **Le vert des boutons, 4 septembre 2026** : ce bouton-ci portait la
            terre cuite de la page du client, écrite en clair. Sur la porte,
            c'est sa capsule serif claire, la même que « Continuer » sur le
            code juste avant (`SaisieDuCode`). */}
        <button
          type="submit"
          disabled={occupe}
          className="w-full rounded-full py-4 text-[17px] leading-none transition-transform active:scale-[0.985] disabled:opacity-60"
          style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
        >
          {enCours ? "Enregistrement…" : "Continuer"}
        </button>

        {/* **La seule sortie, sa décision du 11 octobre 2026 : on accepte, ou
            l'on s'en va.** Pas de « Retour » : rien n'entre dans l'application
            sans accepter. La même action que « Retour » sur l'écran du code. */}
        <button
          type="button"
          onClick={sortir}
          disabled={occupe}
          className="mt-1 min-h-[44px] w-full bg-transparent text-[14px] disabled:opacity-60"
          style={{ color: colors.muted }}
        >
          Se déconnecter
        </button>

        {/* **RETIRÉ le 9 septembre 2026, à sa demande** : *« la phrase sous
            continuer, supprime-la »*. Elle disait que la date, l'heure et la
            version sont conservées : elle expliquait le mécanisme de l'écran
            au lieu de le laisser faire. Ce qu'elle annonçait n'a pas disparu
            pour autant : l'horodatage, l'adresse et l'appareil sont toujours
            enregistrés (`enregistrerAcceptations`). */}
      </div>
    </form>
  );
}
