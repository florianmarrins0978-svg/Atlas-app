-- Migration 0002 : durcit les politiques RLS pour qu'une absence de contexte
-- (jamais défini, ou réinitialisé à '' par PostgreSQL après une transaction
-- précédente sur une connexion mutualisée) se traduise par 0 ligne visible,
-- jamais par une erreur de cast ::uuid. Le comportement de sécurité (fail-closed,
-- aucune fuite) était déjà correct ; seule l'ergonomie de l'échec est corrigée.

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
        USING (
          current_setting('app.entreprise_id', true) IS NOT NULL
          AND current_setting('app.entreprise_id', true) <> ''
          AND entreprise_id = current_setting('app.entreprise_id', true)::uuid
        )
        WITH CHECK (
          current_setting('app.entreprise_id', true) IS NOT NULL
          AND current_setting('app.entreprise_id', true) <> ''
          AND entreprise_id = current_setting('app.entreprise_id', true)::uuid
        )
    $policy$, t);
  END LOOP;
END $$;
