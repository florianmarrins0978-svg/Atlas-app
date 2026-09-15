import { notFound } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { getClient } from "@/server/repositories/clients";
import { detacherCivilite } from "@/lib/civilite";
import SesCoordonnees from "./SesCoordonnees";

// Les données d'un client, propres à l'entreprise : jamais de pré-rendu.
export const dynamic = "force-dynamic";

/**
 * L'écran que la porte « Modifier ses coordonnées » ouvre (sa réponse « la A »,
 * 14 septembre 2026). Le pourquoi vit dans `actions.ts` et `SesCoordonnees.tsx`.
 *
 * **La flèche ramène à SA fiche**, et pas à la liste : on n'arrive ici que de
 * là. Le journal de navigation (`journal-de-navigation.ts`) corrigera de
 * lui-même le jour où une seconde porte s'ouvrira.
 */
export default async function SesCoordonneesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const client = await getClient(ctx, id);
  if (!client) notFound();

  // **La civilité se DÉTACHE du nom, elle ne s'y ajoute pas.** Les fiches
  // d'avant la colonne `civilite` portent « M. Bernard » dans le nom : sans ce
  // découpage, la pastille resterait éteinte et « M. » se retrouverait recopié
  // devant lui à l'affichage — « M. M. Bernard ». La règle vit dans `lib`, et
  // c'est celle que la dictée emploie déjà.
  const lu = detacherCivilite(client.nom);

  return (
    <SesCoordonnees
      clientId={client.id}
      depart={{
        nom: lu.nom,
        civilite: client.civilite ?? lu.civilite,
        telephone: client.telephone ?? "",
        email: client.email ?? "",
        adresse: client.adresse ?? "",
      }}
      retour={{ href: `/clients/${client.id}`, libelle: "Retour à sa fiche" }}
    />
  );
}
