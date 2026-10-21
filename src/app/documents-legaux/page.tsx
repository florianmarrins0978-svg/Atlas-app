import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptationsDe, documentsAAccepter } from "@/server/repositories/documents-legaux";
import { getCurrentCtxPourActiver } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { getEntreprise } from "@/server/repositories/entreprises";
import { formule, jourEnLettres } from "@/lib/abonnements";
import { moisNonUtilisesDeLaPeriode } from "@/lib/resiliation";
import { nomFichierSauvegarde } from "@/lib/nom-sauvegarde";
import PorteDeNuit, { SERIF } from "@/components/atlas/PorteDeNuit";
import { colors } from "@/lib/design-tokens";
import FormulaireAcceptation, { type OptionRefus } from "./formulaire";

export const dynamic = "force-dynamic";

export default async function DocumentsLegauxPage() {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) redirect("/login");

  // Le compte disparu est traité par `GardeDocumentsLegaux`, dans le layout,
  // et non ici : une redirection lancée depuis une page passe sous la
  // frontière de `loading.tsx`, où l'enveloppe est déjà partie — elle ne peut
  // alors plus être un 307. Le contrôle a bel et bien été écrit ici d'abord,
  // et rendait 200.

  const documents = await documentsAAccepter(utilisateurId);
  // Plus rien à accepter : cette page n'a aucune raison de rester atteignable.
  if (documents.length === 0) redirect("/");

  // Il a déjà accepté une version : ce sont les conditions qui ont changé
  // (planches du 11 et du 18 octobre 2026).
  const dejaClient = (await acceptationsDe(utilisateurId)).length > 0;
  const refus = dejaClient ? await optionDeRefus() : null;

  return (
    /* **Sur la porte de nuit, et non sur la charte de l'intérieur — planche
       `appli/documents-legaux-accepter.html`, 11 octobre 2026.** Cet écran
       vient juste après /creer-un-compte et /verifier-email, posés sur
       `PorteDeNuit` : il redevenait crème pour une seule page, avant d'entrer.
       La porte pose ses propres variables de charte, si bien que les jetons
       `colors.*` de cet écran y suivent la nuit sans rien recopier. */
    <PorteDeNuit className="flex min-h-[100dvh] flex-col px-[22px]">
      <header className="pt-[34px]">
        <h1 className="text-[30px] leading-[1.1] tracking-[-0.01em]" style={SERIF}>
          {dejaClient ? "Les conditions ont changé" : "Avant de commencer"}
        </h1>
        {/* **« Stipulent », et non « disent » — sa correction du 9 septembre
            2026.** Ce n'est pas de l'ornement : cet écran est le seul de
            l'application qui ENGAGE, et « dire » n'engage à rien. Un document
            qui stipule pose une obligation ; c'est le mot du contrat, et
            c'est le registre que la page doit tenir. */}
        <p className="mt-3 text-[14.5px] leading-[1.6]" style={{ color: colors.inkSoft }}>
          Vos clients vous confient leurs coordonnées&nbsp;; vous nous les
          confiez à votre tour. Ces documents stipulent ce que nous en
          faisons, et ce que nous nous engageons à ne pas en faire.
        </p>
      </header>

      <FormulaireAcceptation documents={documents} refus={refus} />
    </PorteDeNuit>
  );
}

/**
 * « Refuser », pour un patron DÉJÀ client — planche du 18 octobre 2026.
 *
 * Un nouvel inscrit n'a rien chez nous : « Se déconnecter » lui suffit. Un
 * patron qui a déjà accepté une version précédente a ses devis et ses
 * factures dedans ; sans cette sortie, refuser l'enfermait dehors avec ses
 * données, alors que l'article 15 et l'export permanent lui promettent le
 * contraire (`docs/A-FAIRE.md` §17). Un salarié, lui, n'emporte ni ne résilie
 * l'entreprise.
 *
 * `getCurrentCtxPourActiver`, et non `getCurrentCtx` : cette page passe avant
 * la double vérification, et l'exiger ici renverrait vers un écran qui
 * renvoie ici. L'action qui résilie, elle, l'exige.
 */
async function optionDeRefus(): Promise<OptionRefus | null> {
  const ctx = await getCurrentCtxPourActiver();
  if (!(await estProprietaire(ctx))) return null;

  const [abonnement, entreprise] = await Promise.all([abonnementDeLEntreprise(ctx), getEntreprise(ctx)]);
  const maintenant = new Date();
  const f = abonnement ? formule(abonnement.formule) : null;
  const fin = abonnement?.periodeFin ?? null;
  const resiliable = abonnement && f && fin && abonnement.statut === "actif" && abonnement.abonnementPrestataire;

  return {
    nomFichier: nomFichierSauvegarde(entreprise?.nom ?? "Entreprise", maintenant),
    resiliation: resiliable
      ? {
          formule: `${f.nom}, ${abonnement.periodicite === "annuelle" ? "à l’année" : "au mois"}`,
          payeJusquAu: jourEnLettres(fin),
          moisNonUtilises: moisNonUtilisesDeLaPeriode(abonnement.periodicite, fin, maintenant),
        }
      : null,
  };
}

