import { notFound, redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { jourIso } from "@/lib/jour";
import { CHAMPS_VEHICULE, documentsManquants, phraseDuRappel, rappelsDesVehicules, type ValeursVehicule } from "@/lib/vehicules";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { documentsDuVehicule, getVehicule } from "@/server/repositories/vehicules";
import FicheVehicule from "./FicheVehicule";

export const dynamic = "force-dynamic";

/**
 * La fiche d'un véhicule, côté patron — la troisième planche du 14 octobre
 * 2026 : la prochaine date et ce qui manque en premier, la carte grise tout en
 * bas, parce qu'elle ne change jamais.
 *
 * **Le patron seul y vient** : les autres rôles lisent la liste, sous « En cas
 * d'accident », et n'ont rien à corriger.
 */
export default async function VehiculePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ajouter?: string }>;
}) {
  const ctx = await getCurrentCtx();
  const [{ id }, { ajouter }, patron] = await Promise.all([params, searchParams, estProprietaire(ctx)]);
  if (!patron) redirect("/reglages/vehicules");
  const v = await getVehicule(ctx, id);
  if (!v) notFound();

  const valeurs = Object.fromEntries(CHAMPS_VEHICULE.map((c) => [c, v[c]])) as ValeursVehicule;
  const presents = documentsDuVehicule(v);
  const prochain = rappelsDesVehicules([{ id: v.id, ...valeurs }], jourIso(new Date()))[0];

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran titre={v.nom} retour={{ href: "/reglages/vehicules", libelle: "Retour aux véhicules" }} />
        <FicheVehicule
          id={v.id}
          valeurs={valeurs}
          sources={v.sources}
          documents={presents.map((d) => ({ nature: d.nature, le: jourIso(d.le) }))}
          prochain={prochain ? { phrase: phraseDuRappel(prochain), ton: prochain.echeance.ton } : null}
          manquants={documentsManquants(presents.map((d) => d.nature))}
          ouvrirAjout={ajouter === "controle_technique" ? "proces-verbal" : ajouter === "carte_grise" ? "carte-grise" : null}
        />
      </div>
    </div>
  );
}
