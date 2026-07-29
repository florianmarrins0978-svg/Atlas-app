import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { catalogueMateriels } from "../db/schema";

export async function rechercherMaterielCatalogue(motCle: string) {
  const mot = motCle.trim().toLowerCase();
  if (!mot) return [];
  const tous = await db
    .select()
    .from(catalogueMateriels)
    .where(eq(catalogueMateriels.actif, true))
    .orderBy(catalogueMateriels.nomCanonique, catalogueMateriels.id);
  return tous.filter(
    (m) =>
      m.nomCanonique.toLowerCase().includes(mot) ||
      mot.includes(m.nomCanonique.toLowerCase()) ||
      m.variantes.some((v) => v.toLowerCase().includes(mot) || mot.includes(v.toLowerCase()))
  );
}

export async function listerCatalogueMateriels() {
  return db
    .select()
    .from(catalogueMateriels)
    .where(eq(catalogueMateriels.actif, true))
    .orderBy(catalogueMateriels.nomCanonique);
}

export async function creerMaterielCatalogue(data: {
  nomCanonique: string;
  variantes?: string[];
  categorie?: string;
  unite?: string;
}) {
  const [row] = await db
    .insert(catalogueMateriels)
    .values({
      nomCanonique: data.nomCanonique,
      variantes: data.variantes ?? [],
      categorie: data.categorie,
      unite: data.unite,
    })
    .onConflictDoNothing({ target: catalogueMateriels.nomCanonique })
    .returning();
  if (row) return row;
  const [existante] = await db
    .select()
    .from(catalogueMateriels)
    .where(eq(catalogueMateriels.nomCanonique, data.nomCanonique))
    .limit(1);
  return existante;
}
