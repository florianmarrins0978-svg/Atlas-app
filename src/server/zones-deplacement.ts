// Régler les zones de déplacement de l'entreprise, et situer le siège d'où
// elles partent.
//
// **Le siège se situe ici, une fois, quand le réglage s'écrit** : le compte de
// chaque mois lit ensuite le point rangé, sans appeler la Base Adresse
// Nationale à chaque ouverture. Une adresse changée depuis se resitue au
// réglage suivant, et l'écran dit le siège qu'il a pris.

import { chercherAdresses } from "@/server/adresses/base-adresse-nationale";
import { ecrireReglageZones, lireReglageZones } from "@/server/repositories/jours-travailles";
import { CONVENTIONS, TEINTES_ZONES, zonesLues, type Convention, type ReglageZones, type TeinteZones } from "@/lib/zones-deplacement";
import type { Ctx } from "@/server/repositories/context";

/**
 * Écrire le réglage venu de l'écran, relu : une convention connue, des zones
 * qui se lisent, une teinte connue. Rend le réglage écrit, ou `null` quand
 * l'entrée ne se lit pas (rien n'est alors écrit).
 *
 * **Une panne du service d'adresses ne fait pas perdre le réglage** : les
 * zones s'écrivent, sans siège situé, et l'écran le dit. Le siège se resitue
 * au prochain enregistrement.
 */
export async function reglerLesZones(
  ctx: Ctx,
  entree: { convention: unknown; zones: unknown; teinte: unknown }
): Promise<ReglageZones | null> {
  if (!(CONVENTIONS as readonly unknown[]).includes(entree.convention)) return null;
  const convention = entree.convention as Convention;
  const zones = convention === "aucune" ? [] : zonesLues(entree.zones);
  if (zones === null) return null;
  const teinte: TeinteZones = (TEINTES_ZONES as readonly unknown[]).includes(entree.teinte) ? (entree.teinte as TeinteZones) : "turquoise";

  const { reglage: avant, adresse } = await lireReglageZones(ctx);
  let depart = avant?.depart ?? null;
  if (convention !== "aucune" && (!depart || depart.adresse !== (adresse ?? ""))) depart = await situerLeSiege(adresse);

  const reglage: ReglageZones = { convention, zones, teinte, depart };
  await ecrireReglageZones(ctx, reglage);
  return reglage;
}

async function situerLeSiege(adresse: string | null): Promise<ReglageZones["depart"]> {
  if (!adresse?.trim()) return null;
  const r = await chercherAdresses(adresse);
  const premiere = r.ok ? r.suggestions.find((s) => s.latitude !== null && s.longitude !== null) : undefined;
  if (!premiere || premiere.latitude === null || premiere.longitude === null) return null;
  return { latitude: premiere.latitude, longitude: premiere.longitude, adresse };
}
