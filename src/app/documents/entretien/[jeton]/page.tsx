import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import RapportEntretien from "@/components/atlas/RapportEntretien";
import { colors, font } from "@/lib/design-tokens";
import { lireRapportParJeton } from "@/server/repositories/passages-entretien";

// Un rapport ne se met jamais en cache : il appartient à un seul client.
export const dynamic = "force-dynamic";

/**
 * Le rapport envoyé, relu DANS l'application — sa capture du 24 septembre
 * 2026 : *« j'ai aucun moyen de faire retour ! »*. Le pourquoi est dans
 * `src/lib/rapport-dans-l-appli.ts`.
 *
 * **La même lecture que la page du client**, par le même jeton : ce qu'il
 * relit ici est exactement ce que son client a reçu, durée masquée comprise.
 * L'écran demande un compte (il n'est pas dans `chemins-publics.ts`) ; le
 * jeton, lui, reste la seule clé du rapport, comme chez le client.
 */
export default async function RapportDansLAppliPage({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const rapport = await lireRapportParJeton(jeton);
  if (!rapport) notFound();

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          titre="Rapport envoyé"
          // Le repli, quand aucun écran ne précède : la liste où il se range.
          retour={{ href: "/paysage/fiche", libelle: "Retour aux fiches" }}
        />
        <div className="mt-6 px-5">
          <RapportEntretien rapport={rapport} />
        </div>
      </div>
    </div>
  );
}
