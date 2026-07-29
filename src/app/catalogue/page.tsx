import ScreenHeader from "@/components/ScreenHeader";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerCataloguePrestations } from "@/server/repositories/catalogue-prestations";
import { listerCatalogueMateriels } from "@/server/repositories/catalogue-materiels";
import { listerHistoriquePrix } from "@/server/repositories/historique-prix";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const ctx = await getCurrentCtx();
  const prestations = await listerCataloguePrestations();
  const materiels = await listerCatalogueMateriels();

  const prestationsAvecHistorique = await Promise.all(
    prestations.map(async (p) => ({
      ...p,
      historique: await listerHistoriquePrix(ctx, p.id),
    }))
  );

  return (
    <div>
      <ScreenHeader title="Catalogue" />
      <div className="p-4">
        <p className="mb-3 text-xs text-ink/40">
          Base de connaissance partagée : prestations et matériels reconnus par Atlas, avec l&apos;historique des
          prix pratiqués par votre entreprise.
        </p>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">Prestations</p>
        {prestationsAvecHistorique.length === 0 ? (
          <p className="mb-4 text-xs text-ink/40">Aucune prestation dans le catalogue pour l&apos;instant.</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {prestationsAvecHistorique.map((p) => (
              <li key={p.id} className="rounded-md border border-line bg-card px-4 py-3">
                <p className="text-sm font-semibold text-ink">{p.nomCanonique}</p>
                {p.synonymes.length > 0 && (
                  <p className="mt-1 text-xs text-ink/50">Synonymes : {p.synonymes.join(", ")}</p>
                )}
                {p.variantes.length > 0 && (
                  <p className="text-xs text-ink/50">Variantes : {p.variantes.join(", ")}</p>
                )}
                {p.historique.length > 0 ? (
                  <p className="mt-1 text-xs text-ink/70">
                    Dernier prix pratiqué : {p.historique[0].prix} € ({new Date(p.historique[0].constateLe).toLocaleDateString("fr-FR")})
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink/40">Aucun prix encore constaté par votre entreprise.</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">Matériels</p>
        {materiels.length === 0 ? (
          <p className="text-xs text-ink/40">Aucun matériel dans le catalogue pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {materiels.map((m) => (
              <li key={m.id} className="rounded-md border border-line bg-card px-4 py-3">
                <p className="text-sm font-semibold text-ink">{m.nomCanonique}</p>
                {m.variantes.length > 0 && <p className="mt-1 text-xs text-ink/50">Variantes : {m.variantes.join(", ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
