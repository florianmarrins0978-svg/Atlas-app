-- Migration 0003 : la migration 0002 (garde IS NOT NULL / <> '' combinée par AND)
-- s'est révélée insuffisante — PostgreSQL peut évaluer le cast ::uuid indépendamment
-- de l'ordre du AND (notamment lorsqu'un index existe sur entreprise_id, le planificateur
-- peut construire la condition d'index à partir du cast avant d'appliquer les gardes).
-- Le motif NULLIF est structurellement sûr : le cast ne s'applique jamais à la
-- chaîne vide, quel que soit le plan choisi, car NULLIF intercepte le cas avant
-- même que l'expression de cast ne reçoive une valeur invalide.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'entreprise_compteurs', 'membres_entreprise', 'clients', 'chantiers',
    'prestations', 'materiel', 'notes_vocales', 'photos', 'tarifs',
    'lignes_prix', 'devis', 'lignes_devis'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($policy$
      CREATE POLICY tenant_isolation ON %I
        USING (entreprise_id = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
        WITH CHECK (entreprise_id = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    $policy$, t);
  END LOOP;
END $$;
