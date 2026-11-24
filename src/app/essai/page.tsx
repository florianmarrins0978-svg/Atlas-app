import { redirect } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { abonnementDeLEntreprise, enregistrerLAbonnement } from "@/server/repositories/abonnements";
import { lireLaSessionDePaiement } from "@/server/paiement/stripe";
import { garderLaPage } from "@/server/garde-page";
import { logger } from "@/server/logger";
import {
  doitPoserSaCarte,
  joursDEssaiAuPaiement,
  ligneDeLaFormule,
  lignesDeLEssai,
  phraseArreter,
  phraseSansCarte,
  resumeDeLEssai,
} from "@/lib/essai-avec-carte";
import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import EssaiClient from "./EssaiClient";

export const dynamic = "force-dynamic";

/**
 * VOTRE ESSAI, PUIS « IL MANQUE VOTRE CARTE » — le modèle A, sa planche du
 * 24 novembre 2026 (`appli/soignee/essai-avec-carte.html`).
 *
 * **Après les conditions, c'est ici qu'il arrive** (`?debut=1`) : la formule,
 * 0 € aujourd'hui, la date du premier prélèvement, et le chemin pour résilier.
 * **Ensuite, tant que la carte manque, tout écran y renvoie** (`garderLaPage`,
 * sa réponse : *« Oui appli fermée ! »*), sous « Il manque votre carte ».
 *
 * **Ce qui n'a plus lieu d'être ici renvoie à l'accueil** : une entreprise
 * dont la carte est posée, ou qui ne l'a jamais eue à poser.
 */
export default async function EssaiPage({ searchParams }: { searchParams: Promise<{ paiement?: string; debut?: string }> }) {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement || !doitPoserSaCarte(abonnement)) redirect("/");

  const { paiement, debut } = await searchParams;

  /**
   * LE RETOUR DU PAIEMENT, et la session retenue. **La même lecture que
   * Réglages, Abonnement** (`reglages/abonnement/page.tsx`) : la session est
   * relue chez le prestataire, son entreprise comparée à la sienne, et la
   * ligne écrite par `enregistrerLAbonnement`. La session retenue se relit
   * aussi sans retour : il a pu payer puis fermer l'onglet.
   */
  const session = paiement && paiement !== "abandon" ? paiement : abonnement.sessionDeCarte;
  if (session) {
    const lu = await lireLaSessionDePaiement(session);
    if (lu.ok && lu.entrepriseId === ctx.entrepriseId) {
      await enregistrerLAbonnement(ctx, lu.etat);
      redirect("/creer-un-compte/pret");
    }
    if (lu.ok) logger.warn("Retour de paiement pour une autre entreprise", { entrepriseId: ctx.entrepriseId });
  }
  // On repart sans le paramètre : un rafraîchissement relancerait la lecture.
  if (paiement) redirect("/essai");

  // Un salarié invité avant la carte : c'est l'entreprise qui attend, pas lui.
  if (!(await estProprietaire(ctx))) {
    return (
      <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
        <EssaiClient pour="salarie" />
      </PorteDeNuit>
    );
  }

  const jours = joursDEssaiAuPaiement(abonnement);
  const resume = resumeDeLEssai(abonnement, jours, new Date());
  if (!resume) {
    logger.error("Votre essai : formule inconnue", { entrepriseId: ctx.entrepriseId, formule: abonnement.formule });
    redirect("/reglages/abonnement");
  }

  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
      <EssaiClient
        pour="patron"
        debut={debut === "1"}
        essai={resume.essai}
        jours={jours}
        lignes={lignesDeLEssai(resume)}
        ligneSansCarte={ligneDeLaFormule(resume)}
        arreter={resume.essai ? phraseArreter(resume.premierPrelevement) : null}
        sansCarte={phraseSansCarte(jours)}
        choix={{ formule: abonnement.formule, periodicite: abonnement.periodicite, modules: abonnement.modules }}
      />
    </PorteDeNuit>
  );
}
