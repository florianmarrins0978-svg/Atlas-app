import { lireRapportParJeton } from "@/server/repositories/passages-entretien";
import { colors } from "@/lib/design-tokens";
import { EcranDeRetour } from "@/components/atlas/LettreDuClient";
import RapportEntretien from "@/components/atlas/RapportEntretien";
import { garderLaPage } from "@/server/garde-page";

// Le compte rendu de passage, tel que le CLIENT le reçoit.
//
// **Ce qu'il remplace : une signature.** Sa question du 16 août 2026 — *« pour
// les signatures, on peut faire des signatures électroniques ? »* — puis son
// constat : *« s'il n'est pas là, on ne peut pas le faire signer. »* C'est le
// cas ordinaire d'un entretien : on tond pendant que le client est au travail.
// La preuve est donc l'horodatage et l'empreinte du contenu, comme pour
// l'acceptation d'un devis — plus solide qu'un trait au doigt, et qui n'exige
// personne sur place.
//
// **La date d'envoi n'y est plus** (22 septembre 2026) : *« ça, c'est à garder
// seulement pour l'utilisateur dans l'appli »*. Elle vit sur sa fiche, et ne
// quitte donc plus le serveur pour la page du client.
//
// **Seul ce qui a été FAIT s'affiche** (sa décision « B ») — et le tri est fait
// en base : ce qui n'a pas été fait n'arrive même pas dans ce HTML.
//
// `force-dynamic` est impératif : une mise en cache exposerait le rapport d'un
// client à un autre visiteur.
export const dynamic = "force-dynamic";

// Un compte rendu de passage n'a rien à faire dans un moteur de recherche.
export const metadata = { robots: { index: false, follow: false } };

export default async function PageRapportClient({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  await garderLaPage();
  const { jeton } = await params;
  const rapport = await lireRapportParJeton(jeton);

  // Lien inconnu et rapport effacé donnent le même message : distinguer les
  // deux apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!rapport) {
    return (
      <EcranDeRetour
        signe="sablier"
        ton="or"
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  return (
    <div className="min-h-dvh px-[18px] pt-4 pb-8" style={{ backgroundColor: colors.cream }}>
      <RapportEntretien rapport={rapport} />
    </div>
  );
}
