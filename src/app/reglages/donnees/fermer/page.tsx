import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { lireLaFermeture } from "@/server/repositories/fermeture-compte";
import { commentRouvrir, dateDEffacement, dateDeFermeture, jourEnMots } from "@/lib/fermeture-compte";
import { nomFichierSauvegarde } from "@/lib/nom-sauvegarde";
import { garderLaPage } from "@/server/garde-page";
import RubriqueReservee from "../../RubriqueReservee";
import FermerClient from "./FermerClient";

export const dynamic = "force-dynamic";

/**
 * « Fermer mon compte » — sa planche du 5 novembre 2026
 * (`appli/soignee/fermer-mon-compte.html`, choix A) et la question 33 de
 * `docs/QUESTIONS.md`.
 *
 * Les dates se calculent ICI, depuis les règles de `fermeture-compte.ts`, et
 * l'écran ne fait que les dire : celle qu'il lit avant d'appuyer est celle que
 * le geste posera.
 */
export default async function FermerPage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return <RubriqueReservee titre="Fermer mon compte" quoi="Seul le patron ferme le compte de l'entreprise." />;
  }

  const maintenant = new Date();
  const [{ etat, aUneLigneDAbonnement }, abonnement, entreprise] = await Promise.all([
    lireLaFermeture(ctx, maintenant),
    abonnementDeLEntreprise(ctx),
    getEntreprise(ctx),
  ]);

  // Ce que dirait une fermeture demandée maintenant : la fin de ce qui est
  // payé (son choix A), puis trente jours.
  const effetPrevu = dateDeFermeture(abonnement, maintenant);
  const effet = etat.statut === "ouvert" ? effetPrevu : etat.effectiveLe;
  const effacement = etat.statut === "archivee" ? null : dateDEffacement(effet);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran allure="soignee" titre="Fermer mon compte" retour={{ href: "/reglages/donnees", libelle: "Retour à Mes données" }} />
        <FermerClient
          statut={etat.statut}
          commentRouvrir={commentRouvrir(etat, aUneLigneDAbonnement)}
          effetEnMots={jourEnMots(effet)}
          resteOuvert={effet.getTime() > maintenant.getTime()}
          effacementEnMots={effacement ? jourEnMots(effacement) : null}
          nomFichier={nomFichierSauvegarde(entreprise?.nom ?? "Entreprise", maintenant)}
        />
      </div>
    </div>
  );
}
