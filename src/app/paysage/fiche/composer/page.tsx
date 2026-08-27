import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { listerPrestations } from "@/server/repositories/prestations-entretien";
import { MODELE_FOURNI } from "@/lib/prestations-entretien";
import RubriqueReservee from "../../../reglages/RubriqueReservee";
import ComposerMaFiche from "./ComposerMaFiche";

export const dynamic = "force-dynamic";

/**
 * « Composer ma fiche » — les prestations qu'il coche sur un chantier.
 *
 * **Sa demande du 16 août 2026** : *« il faut un endroit où l'utilisateur
 * pourra créer cette fiche. On peut mettre déjà cette fiche en modèle, mais
 * également il pourra la modifier, donc retirer ou ajouter des cases s'il le
 * souhaite. »*
 *
 * **Un seul modèle**, dans ses mots : « il n'y aura qu'une seule fiche ». Rien
 * n'est rangé par client — à chaque passage, la fiche partira de là et
 * s'ajustera.
 *
 * **ELLE A QUITTÉ LES RÉGLAGES LE 26 AOÛT 2026**, et c'est lui qui l'a demandé :
 * *« est-ce qu'on peut la déplacer dans la fiche de chantier, dans la catégorie
 * Paysage ? Et comme ça on ne la voit plus dans la catégorie Réglages. »* Il
 * avait d'abord fallu lui montrer que les deux écrans n'en font pas un
 * (`appli/deux-fiches.html`) : celui-ci tient LA LISTE, l'autre la fiche d'un
 * jour qui en naît. La liste est donc rangée sous celui qui s'en sert.
 *
 * **Réservé au propriétaire**, comme avant : cette liste commande ce que TOUS
 * les chantiers d'entretien de l'entreprise afficheront. Le déplacement ne l'a
 * pas ouverte aux salariés — l'écran de Paysage le savait déjà.
 */
export default async function ComposerMaFichePage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Composer ma fiche"
        quoi="Cette liste commande ce que tous les chantiers d'entretien de l'entreprise afficheront."
      />
    );
  }

  const prestations = await listerPrestations(ctx);

  return (
    <main className="min-h-dvh">
      <EnTeteEcran
        titre="Composer ma fiche"
        retour={{ href: "/paysage/fiche", libelle: "Retour à la fiche de chantier" }}
      />
      <ComposerMaFiche
        prestationsInitiales={prestations.map((p) => ({
          id: p.id,
          famille: p.famille,
          libelle: p.libelle,
        }))}
        modeleFourni={MODELE_FOURNI}
      />
    </main>
  );
}
