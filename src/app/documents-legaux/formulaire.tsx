"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { accepterDocumentsAction } from "./actions";
import { deconnexionAction } from "@/app/login/actions";
import type { DocumentAAccepter } from "@/server/repositories/documents-legaux";
import { colors } from "@/lib/design-tokens";
import { phraseDAcceptation } from "@/lib/acceptation-documents";
import { NUIT, SERIF } from "@/components/atlas/PorteDeNuit";
import { rendreMarkdownSimple } from "@/components/atlas/rendreMarkdownSimple";
import FeuilleRefus from "./FeuilleRefus";

/**
 * Ce que « Refuser » peut offrir à un patron déjà client : `null` pour un
 * nouvel inscrit ou un salarié, qui gardent « Se déconnecter ».
 */
export type OptionRefus = {
  nomFichier: string;
  /** `null` sans abonnement payé en cours : rien à résilier, l'export seul. */
  resiliation: { formule: string; payeJusquAu: string; moisNonUtilises: number } | null;
};

// **Accepter en un geste, comme Apple — planche du 17 octobre 2026**
// (`appli/documents-legaux-un-geste.html`). Les cases sont parties : une phrase
// dit ce que vaut « Accepter », chaque document s'ouvre en entier AVANT, et un
// seul bouton engage. Ce qui fonde ce choix, sources comprises, est dans
// `docs/A-FAIRE.md` §17 : un écrit électronique suffit au contrat de
// sous-traitance (RGPD art. 28.9), et entre professionnels aucune case n'est
// exigée (CJUE, C‑358/21). Ce qui reste exigé, et que cet écran tient : chaque
// document nommé à part, lisible avant, et une acceptation expresse.
export default function FormulaireAcceptation({
  documents,
  refus,
}: {
  documents: DocumentAAccepter[];
  refus: OptionRefus | null;
}) {
  const [etat, action, enCours] = useActionState(accepterDocumentsAction, undefined);
  const [lu, setLu] = useState<DocumentAAccepter | null>(null);
  const [refuser, setRefuser] = useState(false);
  const [sortieEnCours, demarrerSortie] = useTransition();
  const routeur = useRouter();
  const occupe = enCours || sortieEnCours;

  // Une version publiée pendant qu'il lisait : la page se recharge et montre la
  // nouvelle liste, plutôt que de lui faire accepter ce qu'il n'a pas vu.
  useEffect(() => {
    if (etat?.relire) routeur.refresh();
  }, [etat, routeur]);

  function sortir() {
    // Pas de `catch` : l'action se termine par une redirection qui remonte
    // jusqu'au routeur ; l'avaler laisserait l'écran en place, cookie effacé.
    demarrerSortie(async () => {
      await deconnexionAction("entree");
    });
  }

  return (
    <form action={action} className="mt-6 flex flex-1 flex-col">
      {/* Ce qu'il a sous les yeux, renvoyé tel quel : le serveur refuse si sa
          propre liste a changé (`memesDocuments`). */}
      {documents.map((doc) => (
        <input key={doc.id} type="hidden" name="affiche" value={doc.id} />
      ))}

      <section
        className="overflow-hidden rounded-[20px]"
        style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      >
        <p className="px-[18px] pb-4 pt-[18px] text-[15px] leading-[1.55]" style={{ color: colors.ink }}>
          {phraseDAcceptation(documents.length)}
        </p>
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => setLu(doc)}
            className="flex min-h-[64px] w-full items-center gap-3 px-[18px] py-[10px] text-left"
            style={{ borderTop: `1px solid ${colors.line}`, color: colors.ink }}
          >
            <span className="flex-1 text-[16px] leading-[1.3]">
              {doc.titre}
              <span className="mt-[3px] block text-[12.5px]" style={{ color: colors.inkSoft }}>
                Version {doc.version}
              </span>
            </span>
            {/* Ce chevron ouvre le texte : il porte une fonction, il ne décore
                pas (`CLAUDE.md` §3). */}
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
              className="shrink-0"
              style={{ color: colors.muted }}
            >
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        ))}
      </section>

      {/* « Accepter » reste sous le pouce. Le fond reprend le bas de la porte,
          pour que la carte passe dessous sans se lire au travers. */}
      <div
        className="atlas-bas-sans-barre sticky bottom-0 mt-auto pt-3"
        style={{ background: `linear-gradient(to bottom, transparent, ${NUIT.cream} 14px)` }}
      >
        <p role="alert" className="mx-[2px] mb-1 min-h-[21px] text-[13.5px] leading-[21px]" style={{ color: colors.alert }}>
          {etat?.erreur ?? ""}
        </p>

        <button
          type="submit"
          disabled={occupe}
          className="w-full rounded-full py-4 text-[17px] leading-none transition-transform active:scale-[0.985] disabled:opacity-60"
          style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
        >
          {enCours ? "Enregistrement…" : "Accepter"}
        </button>

        {/* **On accepte, ou l'on s'en va — sa décision du 11 octobre 2026.**
            Un patron déjà client a ses données dedans : « Refuser », aussi
            visible qu'« Accepter », le mène à ses données puis à la
            résiliation remboursée (planche du 18 octobre). Un nouvel inscrit
            garde « Se déconnecter ». */}
        {refus ? (
          <button
            type="button"
            onClick={() => setRefuser(true)}
            disabled={occupe}
            data-atlas="refuser"
            className="mt-2 min-h-[52px] w-full rounded-full text-[16px] disabled:opacity-60"
            style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
          >
            Refuser
          </button>
        ) : (
          <button
            type="button"
            onClick={sortir}
            disabled={occupe}
            className="mt-1 min-h-[44px] w-full bg-transparent text-[14px] disabled:opacity-60"
            style={{ color: colors.muted }}
          >
            Se déconnecter
          </button>
        )}
      </div>

      {refuser && refus && <FeuilleRefus refus={refus} fermer={() => setRefuser(false)} sortir={sortir} />}

      {lu && (
        // Le texte entier, sur tout l'écran, comme chez Apple : un cadre de
        // vingt lignes qui défile se lit mal et se lit moins.
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lu.titre}
          className="atlas-colonne-fixe inset-y-0 z-50 flex flex-col"
          style={{ background: NUIT.cream }}
        >
          <header
            className="flex shrink-0 items-center justify-between gap-3 px-[18px] pb-3 pt-[18px]"
            style={{ borderBottom: `1px solid ${colors.line}` }}
          >
            <h2 className="text-[19px] leading-[1.25]" style={{ ...SERIF, color: colors.ink }}>
              {lu.titre}
            </h2>
            <button
              type="button"
              onClick={() => setLu(null)}
              autoFocus
              className="min-h-[44px] shrink-0 px-1 text-[15px]"
              style={{ color: colors.ink }}
            >
              Fermer
            </button>
          </header>
          <div
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] pb-6 pt-4 text-[14px] leading-[1.6] [&_blockquote]:border-line [&_h4]:text-[15px] [&_h4]:text-ink [&_strong]:font-semibold [&_strong]:text-ink"
            style={{ color: colors.inkSoft }}
          >
            {rendreMarkdownSimple(lu.contenu, { joindreLesLignes: true })}
          </div>
        </div>
      )}
    </form>
  );
}
