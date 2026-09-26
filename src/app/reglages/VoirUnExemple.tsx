import Link from "next/link";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";

/**
 * « Voir un exemple » — sa planche du 26 septembre 2026
 * (`appli/apercu-du-document.html`), et sa réponse : *« il faut qu'il soit en
 * A et B »*. Sous le sommaire de « Devis & factures », et en bas de « Mon
 * entreprise », là où il vient de remplir le SIRET, les mentions et la TVA.
 *
 * **UN SEUL bouton, monté deux fois.** Deux boutons écrits à part finiraient
 * par ouvrir deux choses différentes ; celui-ci ouvre la même facture
 * d'exemple, dans la visionneuse de l'application (flèche retour comprise),
 * jamais dans un onglet du navigateur qui n'a rien derrière lui.
 */
export default function VoirUnExemple() {
  return (
    <Link
      href={adresseDeLaVisionneuse("/api/factures/exemple/pdf", { surtitre: "Exemple", titre: "La facture" })}
      data-atlas="voir-un-exemple"
      className="atlas-plein mx-[26px] mt-6 flex min-h-[54px] items-center justify-center rounded-full text-[18px] no-underline"
      style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
    >
      Voir un exemple
    </Link>
  );
}
