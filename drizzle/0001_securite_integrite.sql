-- Migration manuelle 0001 : sécurité et intégrité.
-- Rien ici ne peut être déclaré par un DSL d'ORM (Prisma ou Drizzle) — RLS et
-- triggers sont des mécanismes PostgreSQL purs, appliqués directement en SQL.

-- =====================================================================
-- 1. CONTRAINTES CHECK — correction v2.1 §2
-- =====================================================================

ALTER TABLE tarifs
  ADD CONSTRAINT tarifs_prix_non_negatif CHECK (prix >= 0);

ALTER TABLE lignes_prix
  ADD CONSTRAINT lignes_prix_montant_non_negatif CHECK (montant >= 0);

ALTER TABLE lignes_devis
  ADD CONSTRAINT lignes_devis_quantite_non_negative CHECK (quantite >= 0),
  ADD CONSTRAINT lignes_devis_prix_unitaire_non_negatif CHECK (prix_unitaire >= 0),
  ADD CONSTRAINT lignes_devis_montant_non_negatif CHECK (montant >= 0);

ALTER TABLE devis
  ADD CONSTRAINT devis_taux_tva_non_negatif CHECK (taux_tva >= 0),
  ADD CONSTRAINT devis_total_ht_non_negatif CHECK (total_ht >= 0),
  ADD CONSTRAINT devis_total_tva_non_negatif CHECK (total_tva >= 0),
  ADD CONSTRAINT devis_total_ttc_non_negatif CHECK (total_ttc >= 0),
  ADD CONSTRAINT devis_total_ttc_coherent CHECK (total_ttc = total_ht + total_tva);

ALTER TABLE photos
  ADD CONSTRAINT photos_taille_non_negative CHECK (taille_octets >= 0);

ALTER TABLE notes_vocales
  ADD CONSTRAINT notes_vocales_taille_non_negative CHECK (taille_octets >= 0),
  ADD CONSTRAINT notes_vocales_duree_non_negative CHECK (duree_secondes IS NULL OR duree_secondes >= 0);

-- =====================================================================
-- 2. TRIGGERS D'IMMUABILITÉ DES DEVIS ENVOYÉS — demande explicite, point 1
-- =====================================================================
-- Empêche : modification, suppression du devis lui-même, et ajout/modification/
-- suppression de ses lignes, dès que statut = 'envoye'. La transition initiale
-- brouillon -> envoye reste autorisée (OLD.statut vaut encore 'brouillon' à ce moment-là).

CREATE OR REPLACE FUNCTION empecher_modification_devis_envoye() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut = 'envoye' THEN
      RAISE EXCEPTION 'Un devis envoyé ne peut pas être supprimé (id=%)', OLD.id;
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.statut = 'envoye' THEN
      RAISE EXCEPTION 'Un devis envoyé est immuable (id=%)', OLD.id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_devis_immuable
  BEFORE UPDATE OR DELETE ON devis
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_devis_envoye();

CREATE OR REPLACE FUNCTION empecher_modification_lignes_devis_envoye() RETURNS trigger AS $$
DECLARE
  v_statut text;
  v_devis_id uuid;
BEGIN
  v_devis_id := COALESCE(NEW.devis_id, OLD.devis_id);
  SELECT statut INTO v_statut FROM devis WHERE id = v_devis_id;
  IF v_statut = 'envoye' THEN
    RAISE EXCEPTION 'Impossible de modifier les lignes d''un devis envoyé (devis_id=%)', v_devis_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lignes_devis_immuable
  BEFORE INSERT OR UPDATE OR DELETE ON lignes_devis
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_lignes_devis_envoye();

-- =====================================================================
-- 3. ROW LEVEL SECURITY — correction v2.1 §3 (USING + WITH CHECK), stratégie §7
-- =====================================================================
-- Contexte fixé par transaction via set_config('app.entreprise_id', ..., true)
-- (voir src/server/db/with-entreprise.ts). FORCE RLS pour que la politique
-- s'applique même au rôle propriétaire. Fail-closed : si le contexte n'est pas
-- défini, current_setting(..., true) renvoie NULL -> la politique échoue -> 0 ligne.

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (entreprise_id = current_setting(''app.entreprise_id'', true)::uuid) WITH CHECK (entreprise_id = current_setting(''app.entreprise_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;

-- =====================================================================
-- 4. PRIVILÈGES DU RÔLE APPLICATIF
-- =====================================================================
-- atlas_app : lecture/écriture sur les données, jamais de DDL, jamais BYPASSRLS
-- Le rôle applicatif est créé avant les migrations par le bootstrap administratif CI.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atlas_app;
