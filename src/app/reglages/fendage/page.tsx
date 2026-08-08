import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireGrilleFendage } from "@/server/repositories/grille-fendage";
import GrilleFendageClient from "./GrilleFendageClient";

export const dynamic = "force-dynamic";

/**
 * « Mes prix de fendage » — la grille hauteur × diamètre.
 *
 * Le patron, le 8 août 2026 : *« pour la fente, ils devraient demander la
 * hauteur de l'arbre et son diamètre, et on crée une liste de prix en fonction
 * de la hauteur et du diamètre, comme ça il n'invente rien. »* Puis : *« par
 * contre il faut faire plus de tranche. »* — d'où 8 diamètres × 6 hauteurs.
 *
 * **Visible par l'entreprise, pas réservée à l'éditeur.** Ce ne sont pas des
 * mots de métier partagés (`/reglages/vocabulaire`), ce sont SES prix de vente :
 * chaque artisan aura les siens, et l'isolation par entreprise le garantit
 * (`docs/QUESTIONS.md` §10).
 */
export default async function GrilleFendagePage() {
  const ctx = await getCurrentCtx();
  const cases = await lireGrilleFendage(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <div className="px-6 pt-8">
          <Link
            href="/reglages"
            aria-label="Retour aux réglages"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Mes prix
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Fendre le bois
          </h1>
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Le prix de la fente selon la hauteur de l&apos;arbre et le diamètre du tronc. Atlas y prend le montant
            au lieu de l&apos;inventer — et <strong>une case vide reste une question</strong>, jamais une estimation.
          </p>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Vous n&apos;avez pas à la remplir d&apos;avance : chaque prix de fente que vous écrivez sur un devis vient
            se ranger tout seul dans la bonne case.
          </p>
        </div>

        <GrilleFendageClient
          initiales={cases.map((c) => ({ cle: c.cellule.cle, prix: c.prix, origine: c.origine }))}
        />
      </div>
    </div>
  );
}
