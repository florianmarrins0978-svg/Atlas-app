import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { abonnementDeLEntreprise, enregistrerLAbonnement } from "@/server/repositories/abonnements";
import { lireLaSessionDePaiement, paiementConfigure } from "@/server/paiement/stripe";
import { retourConfigure } from "@/server/paiement/retour";
import { etatAffiche, formuleChoisie } from "@/lib/abonnements";
import { logger } from "@/server/logger";
import AbonnementClient from "./AbonnementClient";

export const dynamic = "force-dynamic";

/**
 * « Abonnement » — les trois formules, et où en est la sienne.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CET ÉCRAN NE FAIT PAS.** Il ne bloque rien. Une entreprise sans
 * abonnement se sert d'Atlas exactement comme avant : aucun écran ne se ferme,
 * aucun plafond ne s'applique (`src/lib/abonnements.ts`, `placePourUnFabricant`).
 * Couper l'application de ceux qui s'en servent déjà, le jour où l'offre naît,
 * serait la pire façon de la lancer — et ce n'est pas une décision de code.
 *
 * Ce qui se ferme, c'est l'ESSAI terminé (lecture seule, `withEntreprise`) et,
 * à « Artisan », les absences et les retours (`fonctionOuverte`) — deux
 * décisions de lui, du 10 septembre 2026.
 *
 * **Réservé au propriétaire** : ce qui engage l'entreprise ne s'ouvre pas à un
 * commercial (`docs/QUESTIONS.md` §10).
 */
export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ paiement?: string }>;
}) {
  const ctx = await getCurrentCtx();

  if (!(await estProprietaire(ctx))) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran
          surtitre="Mon entreprise"
          titre="Abonnement"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />
        <p className="mx-[26px] mt-8 text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
          L&apos;abonnement appartient au patron de l&apos;entreprise.
        </p>
      </div>
    );
  }

  const { paiement } = await searchParams;

  /**
   * ─── LE RETOUR DU PAIEMENT ─────────────────────────────────────────────
   *
   * **Pourquoi l'enregistrement se fait ICI et pas seulement dans le crochet.**
   * Le crochet peut n'être pas encore configuré, ou arriver quelques secondes
   * plus tard. Le patron, lui, revient tout de suite : sans cette lecture, il
   * lirait « Aucun abonnement » juste après avoir payé — et il rappuierait.
   *
   * **Ce n'est pas une seconde règle** : les deux chemins écrivent la même
   * ligne par la même fonction, et un second passage écrase le même état.
   *
   * **L'entreprise est VÉRIFIÉE.** Sans cette comparaison, coller dans la
   * barre d'adresse l'identifiant de session d'un autre y accrocherait son
   * abonnement — l'écran est réservé au patron, mais il y a plus d'un patron.
   */
  if (paiement && paiement !== "abandon") {
    const lu = await lireLaSessionDePaiement(paiement);
    if (lu.ok && lu.entrepriseId === ctx.entrepriseId) {
      await enregistrerLAbonnement(ctx, lu.etat);
    } else if (lu.ok) {
      logger.warn("Retour de paiement pour une autre entreprise", { entrepriseId: ctx.entrepriseId });
    }
    // On repart sans le paramètre : sans quoi un rafraîchissement — ou le
    // bouton « précédent » — relancerait la lecture à chaque fois.
    redirect("/reglages/abonnement");
  }

  const abonnement = await abonnementDeLEntreprise(ctx);
  const etat = etatAffiche(abonnement, new Date());

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Mon entreprise"
        titre="Abonnement"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />

      <section className="mx-[26px] mt-[26px]">
        <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          Votre abonnement
        </p>
        <p style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.2, color: etat.ton === "attention" ? colors.alert : colors.ink }}>
          {etat.titre}
        </p>
        {etat.detail && (
          <p className={`mt-1 ${texteSituation}`} style={{ color: colors.inkSoft }}>
            {etat.detail}
          </p>
        )}
      </section>

      {/* Pendant l'essai, aucune formule n'est « actuelle » : il S'ABONNE, il ne
          change pas — il n'y a pas d'abonnement Stripe à faire évoluer au prorata. */}
      <AbonnementClient
        formuleActuelle={formuleChoisie(abonnement)}
        periodiciteActuelle={formuleChoisie(abonnement) ? abonnement!.periodicite : null}
        paiementBranche={paiementConfigure() && retourConfigure()}
      />

      {/* **Le mot « factures » désigne deux choses opposées**, et la confusion
          se paierait par un appel affolé un soir de trimestre. */}
      <p
        className={`mx-[26px] mt-[30px] border-t pb-24 pt-[18px] ${texteSituation}`}
        style={{ borderColor: colors.line, color: colors.inkSoft }}
      >
        <b style={{ color: colors.ink, fontWeight: 500 }}>Attention au mot.</b> Ici, « factures » désigne
        celles qu&apos;Atlas vous envoie. Celles de vos clients sont dans « Terminés ».
      </p>
    </div>
  );
}
