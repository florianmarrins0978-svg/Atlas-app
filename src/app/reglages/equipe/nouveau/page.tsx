import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import RubriqueReservee from "../../RubriqueReservee";
import NouveauCompte from "./NouveauCompte";

export const dynamic = "force-dynamic";

/**
 * « NOUVEAU COMPTE » — la proposition B, qu'il a retenue le 26 août 2026.
 *
 * *« B, tu peux coder »*, sur `appli/donner-un-acces.html`.
 *
 * **Pourquoi une ADRESSE à part, et pas un panneau qui s'ouvre.** Sa troisième
 * remarque : *« la démarcation entre vous patron et le compte qu'on est en
 * train d'attribuer n'est pas bien séparée »*. Un panneau, même encadré, reste
 * sous sa propre ligne. Un écran, lui, ne porte plus la liste du tout — il n'y
 * a alors plus rien à confondre, et c'est ce qu'il a choisi contre la carte.
 *
 * **Ce que cela donne en plus, sans qu'il l'ait demandé** : le bouton « retour »
 * du téléphone ramène à la liste, et le geste s'annule sans rien toucher.
 *
 * **La garde est ici ET dans la mise en page.** `GardeAcces` refuse déjà
 * `/reglages/equipe/…` à tout ce qui n'est pas patron ; ce contrôle-ci ne fait
 * pas double emploi, il fait le même travail à un cran plus près des données —
 * le jour où quelqu'un servira cette page autrement, elle se défendra seule.
 */
export default async function NouveauComptePage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Nouveau compte"
        quoi="Donner un accès engage toute l'entreprise : seul le patron peut le faire."
      />
    );
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Équipe"
        titre="Nouveau compte"
        retour={{ href: "/reglages/equipe", libelle: "Retour à l'équipe" }}
      />
      <NouveauCompte />
    </div>
  );
}
