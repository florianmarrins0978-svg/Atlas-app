import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { cataloguePrestations } from "../db/schema";

// Catalogue PARTAGÉ entre toutes les sociétés — aucune donnée d'entreprise ici,
// donc aucun withEntreprise/RLS (voir migration 0007). Toute écriture reste
// soumise à confirmation utilisateur au niveau de l'appelant (Server Action).

export async function rechercherPrestationCatalogue(motCle: string) {
  const mot = motCle.trim().toLowerCase();
  if (!mot) return [];
  // Remédiation (déterminisme) : sans ORDER BY, Postgres ne garantit aucun
  // ordre stable entre deux exécutions. Tri par nom canonique puis id, seul
  // départage garanti stable même en cas d'égalité de nom.
  const toutes = await db
    .select()
    .from(cataloguePrestations)
    .where(eq(cataloguePrestations.actif, true))
    .orderBy(cataloguePrestations.nomCanonique, cataloguePrestations.id);
  return toutes.filter(
    (p) =>
      p.nomCanonique.toLowerCase().includes(mot) ||
      mot.includes(p.nomCanonique.toLowerCase()) ||
      p.variantes.some((v) => v.toLowerCase().includes(mot) || mot.includes(v.toLowerCase())) ||
      p.synonymes.some((s) => s.toLowerCase().includes(mot) || mot.includes(s.toLowerCase()))
  );
}

export async function getPrestationCatalogue(id: string) {
  const rows = await db.select().from(cataloguePrestations).where(eq(cataloguePrestations.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listerCataloguePrestations() {
  return db
    .select()
    .from(cataloguePrestations)
    .where(eq(cataloguePrestations.actif, true))
    .orderBy(cataloguePrestations.nomCanonique);
}

// Création — toujours déclenchée après confirmation explicite de
// l'utilisateur (jamais automatique). Idempotent sur le nom canonique.
export async function creerPrestationCatalogue(data: {
  nomCanonique: string;
  variantes?: string[];
  synonymes?: string[];
  description?: string;
  categorie?: string;
  unite?: string;
}) {
  const [row] = await db
    .insert(cataloguePrestations)
    .values({
      nomCanonique: data.nomCanonique,
      variantes: data.variantes ?? [],
      synonymes: data.synonymes ?? [],
      description: data.description,
      categorie: data.categorie,
      unite: data.unite,
    })
    .onConflictDoNothing({ target: cataloguePrestations.nomCanonique })
    .returning();
  if (row) return row;
  // Nom déjà existant : renvoie l'entrée existante plutôt que d'échouer.
  const [existante] = await db
    .select()
    .from(cataloguePrestations)
    .where(eq(cataloguePrestations.nomCanonique, data.nomCanonique))
    .limit(1);
  return existante;
}
