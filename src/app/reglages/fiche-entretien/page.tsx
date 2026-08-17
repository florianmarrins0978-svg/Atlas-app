import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { listerPrestations } from "@/server/repositories/prestations-entretien";
import { MODELE_FOURNI } from "@/lib/prestations-entretien";
import RubriqueReservee from "../RubriqueReservee";
import FicheEntretienClient from "./FicheEntretienClient";

export const dynamic = "force-dynamic";

/**
 * « Fiche d'entretien » — les prestations qu'il coche sur un chantier.
 *
 * **Sa demande du 16 août 2026** : *« dans les réglages, il faut créer une
 * nouvelle case ou le ranger quelque part, un endroit où l'utilisateur pourra
 * créer cette fiche. Donc on peut mettre déjà cette fiche en modèle, mais
 * également il pourra la modifier, donc retirer ou ajouter des cases s'il le
 * souhaite. »*
 *
 * **Un seul modèle**, dans ses mots : « il n'y aura qu'une seule fiche ». Rien
 * n'est rangé par client — à chaque passage, la fiche partira de là et
 * s'ajustera. Planche : `docs/maquettes/64-composer-sa-fiche.html`.
 *
 * **Réservé au propriétaire**, comme les équipes et les tarifs : cette liste
 * commande ce que TOUS les chantiers de l'entreprise afficheront.
 */
export default async function FicheEntretienPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Fiche d'entretien"
        quoi="Cette liste commande ce que tous les chantiers d'entretien de l'entreprise afficheront."
      />
    );
  }

  const prestations = await listerPrestations(ctx);

  return (
    <main className="min-h-dvh">
      <EnTeteEcran
        titre="Fiche d'entretien"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <FicheEntretienClient
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
