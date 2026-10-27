-- LES CRÉDITS IA DU MOIS : ce que chaque entreprise a dépensé chez les
-- fournisseurs d'IA, mois par mois (audit de sécurité du 25 octobre 2026, E13).
--
-- Sa décision du 26 octobre 2026 : un plafond par formule, et l'IA se coupe
-- quand il est atteint (`src/lib/credits-ia.ts`). Cette table porte le compteur ;
-- le plafond, lui, se calcule à la lecture, depuis la formule.
--
-- Une ligne par entreprise et par mois, en micro-euros ESTIMÉS (jamais la
-- facture du fournisseur). Le mois suivant commence une ligne neuve : rien à
-- remettre à zéro, et l'historique reste lisible.
--
-- Expand seul : une table neuve que l'ancien code ignore, aucune donnée écrite
-- (.claude/rules/deployment-safety.md, .claude/rules/migrations.md).

CREATE TABLE IF NOT EXISTS "consommation_ia" (
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- Le premier jour du mois.
  "mois" date NOT NULL,
  "microeuros" bigint NOT NULL DEFAULT 0,
  "mis_a_jour_le" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("entreprise_id", "mois"),
  CONSTRAINT "consommation_ia_mois_entier" CHECK (extract(day FROM "mois") = 1),
  CONSTRAINT "consommation_ia_positive" CHECK ("microeuros" >= 0)
);

ALTER TABLE "consommation_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consommation_ia" FORCE ROW LEVEL SECURITY;
CREATE POLICY "consommation_ia_isolation" ON "consommation_ia"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Lire et ajouter : jamais effacer ni faire baisser. Remettre le compteur à zéro
-- rendrait l'IA à un compte coupé, et une injection SQL ne doit pas le pouvoir.
-- L'UPDATE reste (c'est ainsi qu'on ajoute), le déclencheur refuse qu'il baisse.
REVOKE ALL ON "consommation_ia" FROM atlas_app;
GRANT SELECT, INSERT, UPDATE ON "consommation_ia" TO atlas_app;

CREATE OR REPLACE FUNCTION "consommation_ia_ne_baisse_pas"() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW."microeuros" < OLD."microeuros" OR NEW."entreprise_id" <> OLD."entreprise_id" OR NEW."mois" <> OLD."mois" THEN
    RAISE EXCEPTION 'consommation_ia : le compteur ne baisse pas et ne change pas de ligne';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "consommation_ia_ne_baisse_pas" ON "consommation_ia";
CREATE TRIGGER "consommation_ia_ne_baisse_pas" BEFORE UPDATE ON "consommation_ia"
  FOR EACH ROW EXECUTE FUNCTION "consommation_ia_ne_baisse_pas"();
