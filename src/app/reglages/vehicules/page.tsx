import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { jourEtMois, jourIso } from "@/lib/jour";
import {
  CHAMPS_VEHICULE,
  NOM_CONTROLE,
  documentsManquants,
  rappelsDesVehicules,
  type ValeursVehicule,
} from "@/lib/vehicules";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { documentsDuVehicule, listerVehicules } from "@/server/repositories/vehicules";
import ListeVehicules from "./ListeVehicules";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * Les véhicules de l'entreprise — sa planche du 14 octobre 2026, la troisième.
 *
 * **Tout le monde lit, le patron seul change** (`REGLAGES_A_TOUS`), comme
 * l'organigramme. Le patron voit la liste et ce qui approche ; les autres
 * voient, par camion, ce qu'il faut au constat : « En cas d'accident ».
 *
 * **La ligne dit aussi ce qui manque** (planche du 26 octobre 2026) : « À
 * ajouter : l'assurance », que seule la fiche disait. La même règle que la
 * fiche (`documentsManquants`), jamais une seconde.
 */
export default async function VehiculesPage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const [patron, liste] = await Promise.all([estProprietaire(ctx), listerVehicules(ctx)]);
  const rappels = rappelsDesVehicules(
    liste.map((v) => ({ id: v.id, ...(Object.fromEntries(CHAMPS_VEHICULE.map((c) => [c, v[c]])) as ValeursVehicule) })),
    jourIso(new Date())
  );

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran allure="soignee" titre="Véhicules" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <ListeVehicules
          patron={patron}
          vehicules={liste.map((v) => {
            const pire = rappels.find((r) => r.vehiculeId === v.id);
            const presents = documentsDuVehicule(v).map((d) => d.nature);
            return {
              id: v.id,
              nom: v.nom,
              plaque: v.plaque,
              etat: pire
                ? { texte: `${NOM_CONTROLE[pire.controle]} avant le ${jourEtMois(pire.avant)}`, ton: pire.echeance.ton }
                : null,
              assureur: v.assureur,
              numeroContrat: v.numeroContrat,
              assistance: v.assistance,
              // Le procès-verbal ne sert pas au constat : le salarié n'en a que faire.
              documents: presents.filter((n) => patron || n !== "controle_technique"),
              manquants: patron ? documentsManquants(presents) : [],
            };
          })}
        />
      </div>
    </div>
  );
}
