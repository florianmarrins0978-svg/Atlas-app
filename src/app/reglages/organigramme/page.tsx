import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { lireOrganigramme } from "@/server/repositories/organigramme";
import { construireOrganigramme } from "@/lib/organigramme";
import Organigramme from "./Organigramme";

export const dynamic = "force-dynamic";

/**
 * L'organigramme de l'entreprise.
 *
 * *Sa planche du 27 septembre 2026 (`appli/rappels-par-role-et-organigramme.html`)
 * et sa règle :* ***« L'organigramme doit être visible par tout le monde ! »***
 *
 * **Tout le monde lit, le patron seul change.** L'adresse est ouverte à tous les
 * rôles (`REGLAGES_A_TOUS`, `acces-roles.ts`) ; les gestes ne se dessinent que
 * pour le patron, et leurs actions l'exigent au serveur.
 */
export default async function OrganigrammePage() {
  const ctx = await getCurrentCtx();
  const [donnees, patron] = await Promise.all([lireOrganigramme(ctx), estProprietaire(ctx)]);
  const organigramme = construireOrganigramme(donnees.comptes, donnees.salaries, donnees.nombreSalaries);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran surtitre="Réglages" titre="Organigramme" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <Organigramme
          organigramme={organigramme}
          moi={ctx.utilisateurId}
          patron={patron}
          nombreSalaries={donnees.nombreSalaries}
        />
      </div>
    </div>
  );
}
