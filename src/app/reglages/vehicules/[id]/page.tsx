import { notFound, redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { jourIso, moisDuJour } from "@/lib/jour";
import {
  CHAMPS_VEHICULE,
  NOM_CONTROLE,
  phraseDeLEcheance,
  rappelsDesVehicules,
  type ValeursVehicule,
} from "@/lib/vehicules";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { documentsDuVehicule, getVehicule } from "@/server/repositories/vehicules";
import FicheVehicule from "./FicheVehicule";
import Plaque from "../Plaque";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * La fiche d'un véhicule, côté patron — la troisième planche du 14 octobre
 * 2026 : la prochaine date et ce qui manque en premier, la carte grise tout en
 * bas, parce qu'elle ne change jamais.
 *
 * **Le patron seul y vient** : les autres rôles lisent la liste, sous « En cas
 * d'accident », et n'ont rien à corriger.
 *
 * **Sa planche du 26 octobre 2026** (`appli/soignee/reglages-vehicules.html`) :
 * la plaque et le modèle sous le nom, la prochaine date sur un carré, puis les
 * trois papiers, toujours nommés. Le carré porte le mois en toutes lettres
 * (`moisDuJour`), la seule table de mois du dépôt.
 */
export default async function VehiculePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ajouter?: string }>;
}) {
  await garderLaPage();
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
        <EnTeteEcran
          allure="soignee"
          titre={v.nom}
          precision={
            v.plaque || v.modele ? (
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {v.plaque && <Plaque texte={v.plaque} />}
                {v.modele}
              </span>
            ) : undefined
          }
          retour={{ href: "/reglages/vehicules", libelle: "Retour aux véhicules" }}
        />
        <FicheVehicule
          id={v.id}
          valeurs={valeurs}
          sources={v.sources}
          documents={presents.map((d) => ({ nature: d.nature, le: jourIso(d.le) }))}
          prochain={
            prochain
              ? {
                  quoi: NOM_CONTROLE[prochain.controle],
                  jour: Number(prochain.avant.slice(8, 10)),
                  mois: moisDuJour(prochain.avant) ?? "",
                  phrase: phraseDeLEcheance(prochain),
                  ton: prochain.echeance.ton,
                }
              : null
          }
          ouvrirAjout={ajouter === "controle_technique" ? "proces-verbal" : ajouter === "carte_grise" ? "carte-grise" : null}
        />
      </div>
    </div>
  );
}
