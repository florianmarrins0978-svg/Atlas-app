import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { documentsAAccepter, utilisateurExiste } from "@/server/repositories/documents-legaux";
import FormulaireAcceptation from "./formulaire";

export const dynamic = "force-dynamic";

export default async function DocumentsLegauxPage() {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) redirect("/login");

  // **Le compte existe-t-il encore ?** Cet écran est le premier que voit une
  // session périmée — il précède toute entreprise. Sans ce contrôle,
  // l'acceptation partait en base et échouait sur la clé étrangère, en
  // affichant une requête SQL au patron.
  if (!(await utilisateurExiste(utilisateurId))) redirect("/api/session-perimee");

  const documents = await documentsAAccepter(utilisateurId);
  // Plus rien à accepter : cette page n'a aucune raison de rester atteignable.
  if (documents.length === 0) redirect("/");

  return (
    <div className="min-h-dvh bg-[#F4EFE8] px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header>
          <h1
            className="text-[22px] font-semibold text-ink"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            Avant de commencer
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/70">
            Vos clients vous confient leurs coordonnées&nbsp;; vous nous les
            confiez à votre tour. Ces documents disent ce que nous en faisons,
            et ce que nous nous engageons à ne pas en faire.
          </p>
        </header>

        <FormulaireAcceptation documents={documents} />
      </div>
    </div>
  );
}
