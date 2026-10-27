import Link from "next/link";
import { colors, surPlein } from "@/lib/design-tokens";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * Ce que « Voir un exemple » ouvre : la facture d'exemple, dans la visionneuse
 * de l'application (flèche retour comprise), jamais dans un onglet du
 * navigateur qui n'a rien derrière lui.
 *
 * **Exportée pour l'aperçu du papier** de Mon entreprise, qu'un appui ouvre
 * aussi (planche du 26 octobre 2026) : deux adresses écrites à part finiraient
 * par ouvrir deux choses différentes.
 */
export const ADRESSE_DE_L_EXEMPLE = adresseDeLaVisionneuse("/api/factures/exemple/pdf", {
  surtitre: "Exemple",
  titre: "La facture",
});

/**
 * « Voir un exemple » — sa planche du 26 septembre 2026
 * (`appli/apercu-du-document.html`), et sa réponse : *« il faut qu'il soit en
 * A et B »*. Sur « Devis & factures », et sur « Mon entreprise », là où il
 * vient de remplir le SIRET, les mentions et la TVA.
 *
 * **UN SEUL bouton, monté deux fois.** Deux boutons écrits à part finiraient
 * par ouvrir deux choses différentes.
 *
 * **Collé au-dessus de la barre, aux bouts ronds** (planches soignées du 25 et
 * du 26 octobre 2026) : chaque écran le pose dans son `ActionBas`, sous le
 * pouce, au lieu de le laisser attendre au bout de cinq écrans. Il ne porte
 * donc plus de marge à lui : c'est `ActionBas` qui le place.
 */
export default function VoirUnExemple() {
  return (
    <Link
      href={ADRESSE_DE_L_EXEMPLE}
      data-atlas="voir-un-exemple"
      className="atlas-plein flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold no-underline"
      style={{ backgroundColor: colors.plein, color: surPlein }}
    >
      <Picto nom="oeil" taille={22} />
      Voir un exemple
    </Link>
  );
}
