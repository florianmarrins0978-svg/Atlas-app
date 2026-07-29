import { notFound } from "next/navigation";
import {
  statutLabel,
  getStatutAffiche,
  getNextAction,
  getNextActionHref,
  getSecondarySteps,
} from "@/lib/chantier-etat";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantierPourHub } from "@/server/repositories/chantiers";

// Écran connecté à la base réelle. Charge le chantier uniquement dans le
// contexte de l'entreprise active (withEntreprise, via le repository) — un
// chantier inexistant ou appartenant à une autre entreprise produit le même
// résultat (null) et déclenche notFound() dans les deux cas, sans distinction
// observable par l'appelant. Design et comportement strictement identiques à
// la version simulée précédente.
export const dynamic = "force-dynamic";

export default async function FicheChantierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantierPourHub(ctx, id);
  if (!chantier) notFound();

  const statut = getStatutAffiche(chantier);
  const nextAction = getNextAction(chantier);
  const secondarySteps = getSecondarySteps(chantier.id, chantier, nextAction?.key);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-10">
        {/* Retour seul en haut */}
        <div className="px-6 pt-8">
          <a
            href="/"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        {/* Ordre de lecture : statut → nom → client */}
        <div className="px-6 pt-5">
          <span className={smallCaps} style={{ color: colors.rust }}>
            {statutLabel[statut]}
          </span>
          <h1 className="mt-1 text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            {chantier.nom}
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: colors.muted }}>
            {chantier.clientNom ?? "Client non renseigné"} — {chantier.adresseChantier ?? "Adresse non renseignée"}
          </p>
        </div>

        {/* Action principale unique, ou message calme si rien n'est requis */}
        <div className="px-6 pt-7">
          {nextAction ? (
            <PrimaryButton href={getNextActionHref(chantier.id, nextAction)}>{nextAction.label} →</PrimaryButton>
          ) : (
            <div className="rounded-2xl px-5 py-4 text-center" style={{ backgroundColor: colors.card }}>
              <p className="text-[14px]" style={{ color: colors.muted }}>
                Ce chantier est planifié — rien à faire pour l&apos;instant.
              </p>
            </div>
          )}
        </div>

        {/* Étapes secondaires — toujours accessibles, jamais verrouillées */}
        <div className="mt-9 px-6">
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
            Autres étapes
          </p>
          <div style={{ borderTop: `1px solid ${colors.line}` }}>
            {secondarySteps.map((s) => (
              <a
                key={s.key}
                href={s.href}
                className="flex items-center gap-3 py-4"
                style={{ borderBottom: `1px solid ${colors.line}` }}
              >
                <StepIcon done={s.done} />
                <span className="flex-1">
                  <span className="block text-[16px]" style={{ color: colors.ink }}>
                    {s.label}
                  </span>
                  <span className="block text-[13px]" style={{ color: colors.muted }}>
                    {s.meta}
                  </span>
                </span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="2">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.2" className="flex-shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="1.8" className="flex-shrink-0">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
