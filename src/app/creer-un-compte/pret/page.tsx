import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { lireCompte } from "@/server/repositories/compte";
import { listerCles } from "@/server/repositories/cles-appareil";
import { garderLaPage } from "@/server/garde-page";
import { recapitulatifDuCompte } from "@/lib/recapitulatif-compte";
import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import PretClient from "./PretClient";

export const dynamic = "force-dynamic";

/**
 * TOUT EST PRÊT — la dernière pièce de la porte, sa planche du 26 octobre 2026.
 *
 * **Après le code et les conditions, et non plus avant** : l'ancienne fin
 * « Entrer dans Atlas » ouvrait encore les conditions. Ici, plus rien ne se
 * dresse entre le bouton et l'accueil. Les deux gardes du gabarit (le code, les
 * documents légaux) s'appliquent à cette page comme aux autres : on ne peut
 * pas y arriver en sautant une étape.
 *
 * **Le patron seul y passe** : c'est son entreprise qu'elle récapitule. Un
 * compte invité accepte les conditions, puis entre directement.
 */
export default async function PretPage() {
  await garderLaPage();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) redirect("/");

  const [e, compte, cles] = await Promise.all([getEntreprise(ctx), lireCompte(ctx), listerCles(ctx.utilisateurId)]);
  if (!e || !compte) redirect("/");

  const recap = recapitulatifDuCompte(
    {
      nom: e.nom,
      formeJuridique: e.formeJuridique,
      siret: e.siret,
      adresse: e.adresse,
      capitalSocial: e.capitalSocial,
      villeRcs: e.villeRcs,
      regimeTva: e.regimeTva,
      numeroTva: e.numeroTva,
      periodiciteTva: e.periodiciteTva,
      telephone: e.telephone,
      email: e.email,
      iban: e.iban,
      moyensPaiement: e.moyensPaiement,
      assureurDecennale: e.assureurDecennale,
      adresseAssureurDecennale: e.adresseAssureurDecennale,
      couvertureDecennale: e.couvertureDecennale,
      attestationDeposee: !!e.attestationDecennaleCle,
      mediateurNom: e.mediateurNom,
      mediateurCoordonnees: e.mediateurCoordonnees,
      nombreEquipes: e.nombreEquipes,
    },
    { prenom: compte.prenom, nom: compte.nom, email: compte.email }
  );

  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
      <PretClient lignes={recap.lignes} phrase={recap.phrase} dejaFaceId={cles.length > 0} />
    </PorteDeNuit>
  );
}
