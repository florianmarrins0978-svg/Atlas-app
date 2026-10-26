import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import Paquet from "@/components/atlas/reglages/Paquet";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { abonnementDeLEntreprise, enregistrerLAbonnement } from "@/server/repositories/abonnements";
import { lireLaSessionDePaiement, paiementConfigure } from "@/server/paiement/stripe";
import { retourConfigure } from "@/server/paiement/retour";
import { etatAffiche, formuleChoisie } from "@/lib/abonnements";
import { logger } from "@/server/logger";
import AbonnementClient from "./AbonnementClient";
import EtatDeLAbonnement from "./EtatDeLAbonnement";
import Picto from "@/components/atlas/reglages/Picto";
import { garderLaPage } from "@/server/garde-page";

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
  await garderLaPage();
  const ctx = await getCurrentCtx();

  if (!(await estProprietaire(ctx))) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran allure="soignee" titre="Abonnement" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <div className="px-[30px] pb-6 pt-14 text-center">
          <span className="inline-block" style={{ color: colors.or }}>
            <Picto nom="cadenas" taille={40} epaisseur={1.4} />
          </span>
          <p className="mt-3.5 text-[22px] leading-[1.25]" style={{ fontFamily: font.display }}>
            L&apos;abonnement appartient au patron de l&apos;entreprise.
          </p>
        </div>
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
      <EnTeteEcran allure="soignee" titre="Abonnement" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />

      <Paquet titre="Votre abonnement" sansPlage>
        <EtatDeLAbonnement etat={etat} />
      </Paquet>

      {/* Pendant l'essai, aucune formule n'est « actuelle » : il S'ABONNE, il ne
          change pas — il n'y a pas d'abonnement Stripe à faire évoluer au prorata. */}
      <AbonnementClient
        formuleActuelle={formuleChoisie(abonnement)}
        periodiciteActuelle={formuleChoisie(abonnement) ? abonnement!.periodicite : null}
        annulationDemandee={abonnement?.annulationDemandee ?? false}
        paiementBranche={paiementConfigure() && retourConfigure()}
      />
    </div>
  );
}
