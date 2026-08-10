import { notFound } from "next/navigation";
import Link from "next/link";
import {
  statutLabel,
  getStatutAffiche,
  getNextAction,
  getNextActionHref,
  getSecondarySteps,
} from "@/lib/chantier-etat";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantierPourHub } from "@/server/repositories/chantiers";
import { jourLisible } from "@/lib/jour";

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
        {/* Retour à gauche ; à droite, la sortie du chantier planifié. */}
        <div className="flex items-center justify-between px-6 pt-8">
          <Link
            href="/"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          {/* « Pourquoi n'y ai-je pas accès ??? » — sa question du 3 août 2026.
              La clôture n'existait que dans l'onglet Terminés, où un chantier
              n'entre qu'une fois sa date d'intervention passée. Le sien était
              prévu dans deux jours : la facture était donc injoignable, sans
              que rien ne dise ni où ni quand elle le deviendrait.

              Aucune barrière de date ici, et c'est délibéré : un chantier se
              finit parfois plus tôt que prévu, et c'est le patron qui sait
              quand il est fait, pas le calendrier. Le geste reste sans danger —
              `terminerChantier` est idempotente, exige un devis réellement
              envoyé, et n'émet rien : elle bâtit la facture qu'il vérifiera
              (arrêt 3, `docs/AGENT.md` §2.3). */}
          {chantier.datePlanifiee && (
            <Link
              href={`/chantiers/${chantier.id}/facture`}
              className="rounded-full px-4 py-2 text-[14px] font-medium"
              style={{ backgroundColor: colors.rustTint, color: colors.rust }}
            >
              Fin de chantier →
            </Link>
          )}
        </div>

        {/* Ordre de lecture : statut → nom → client. Même grammaire que les
            autres écrans depuis le 10 août 2026 — le surtitre porte l'état,
            qui est ce qu'on vient lire en premier. */}
        <EnTeteEcran
          surtitre={statutLabel[statut]}
          titre={chantier.nom}
          precision={`${chantier.clientNom ?? "Client non renseigné"} · ${chantier.adresseChantier ?? "Adresse non renseignée"}`}
        />

        {/* Action principale unique, ou message calme si rien n'est requis */}
        <div className="px-6 pt-7">
          {nextAction ? (
            <>
              <PrimaryButton href={getNextActionHref(chantier.id, nextAction)}>{nextAction.label} →</PrimaryButton>
              {/* La sortie de secours, à hauteur de la fiche.
                  Le patron, le 4 août : « je ne peux toujours pas rédiger mon
                  devis seulement à la main si je le souhaite ». Elle existait —
                  mais uniquement au bas de l'écran Informations, c'est-à-dire
                  après avoir traversé photos et dictée. Et les étapes affichaient
                  « Prix — en attente des informations », qui se lit comme un
                  verrou alors que rien n'est verrouillé.

                  Elle disparaît une fois le devis parti : rédiger à la main un
                  devis déjà chez le client n'a plus de sens, et le rouvrir passe
                  par « Corriger et renvoyer ». */}
              {!chantier.devisEnvoyeAt && (
                <a
                  href={`/chantiers/${chantier.id}/devis-complet`}
                  className="mt-3 block text-center text-[14px] font-medium"
                  style={{ color: colors.rust }}
                >
                  Ou rédiger le devis à la main →
                </a>
              )}
            </>
          ) : (
            <div className="rounded-[4px] px-5 py-4 text-center" style={{ backgroundColor: colors.card }}>
              {/* « Rien à faire pour l'instant » était vrai et inutile : il ne
                  disait ni quand, ni quoi ensuite. Un écran qui ne dit pas où
                  l'on va se lit comme une application en panne. */}
              <p className="text-[14px]" style={{ color: colors.muted }}>
                {chantier.datePlanifiee
                  ? `Intervention prévue le ${jourLisible(chantier.datePlanifiee)}.`
                  : "Ce chantier est planifié."}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: colors.muted }}>
                Une fois le chantier fait, touchez{" "}
                <strong style={{ color: colors.rust }}>Fin de chantier</strong>, en haut : vous vérifierez la
                facture avant qu&apos;elle n&apos;existe pour votre client.
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
