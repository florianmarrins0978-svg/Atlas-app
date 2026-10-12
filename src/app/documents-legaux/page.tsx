import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { documentsAAccepter } from "@/server/repositories/documents-legaux";
import PorteDeNuit, { SERIF } from "@/components/atlas/PorteDeNuit";
import { colors } from "@/lib/design-tokens";
import FormulaireAcceptation from "./formulaire";

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
          Avant de commencer
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

      <FormulaireAcceptation documents={documents} />
    </PorteDeNuit>
  );
}
