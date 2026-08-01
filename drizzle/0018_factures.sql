-- Factures et relevé de TVA collectée (docs/AGENT.md §2.3).
--
-- Une facture naît d'un devis accepté et d'un chantier réalisé. Elle est bâtie
-- en brouillon au moment où le patron déclare la fin du chantier, puis figée à
-- l'émission — comme le devis, et pour la même raison : une facture fausse ne
-- se modifie pas, elle se corrige par un avoir.
--
-- Rappel de docs/AGENT.md §6 : Atlas PRÉPARE la facture, il ne l'émet pas au
-- sens légal. L'émission conforme revient à l'outil comptable.

CREATE TABLE "factures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,
  -- Le devis d'origine. Non nullable : une facture sans devis serait une
  -- facture dont personne ne peut retrouver ce qui avait été convenu.
  "devis_id" uuid NOT NULL,

  "numero_commercial" text NOT NULL,
  "statut" text NOT NULL DEFAULT 'brouillon'
    CHECK ("statut" IN ('brouillon', 'emise')),

  -- Instantané figé, même principe que le devis : la facture ne doit rien
  -- devoir à l'état courant de l'entreprise ou du client. Une adresse corrigée
  -- l'an prochain ne doit pas réécrire une pièce déjà partie.
  "entreprise_nom" text NOT NULL,
  "entreprise_adresse" text,
  "entreprise_siret" text,
  "entreprise_email" text,
  "entreprise_telephone" text,
  "entreprise_iban" text,

  "client_nom" text,
  "client_adresse" text,
  "client_telephone" text,
  "client_email" text,

  "adresse_chantier" text,

  "date_emission" date NOT NULL,
  "date_echeance" date,
  "conditions_paiement" text,
  "devise" char(3) NOT NULL DEFAULT 'EUR',

  "taux_tva" numeric(5,2) NOT NULL DEFAULT 20.00,
  "total_ht" numeric(10,2) NOT NULL,
  "total_tva" numeric(10,2) NOT NULL,
  "total_ttc" numeric(10,2) NOT NULL,

  "pdf_storage_key" text,
  "pdf_checksum" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id"),
  "emise_le" timestamptz,

  -- Un chantier ne donne qu'une facture. Corriger une facture émise passe par
  -- un avoir, pas par une seconde facture qui doublerait la TVA collectée.
  CONSTRAINT "factures_chantier_uk" UNIQUE ("chantier_id"),
  CONSTRAINT "factures_id_entreprise_uk" UNIQUE ("id", "entreprise_id"),
  CONSTRAINT "factures_entreprise_numero_uk" UNIQUE ("entreprise_id", "numero_commercial"),

  -- Cohérence : une facture émise porte sa date d'émission.
  CONSTRAINT "factures_emission_datee" CHECK (
    "statut" <> 'emise' OR "emise_le" IS NOT NULL
  ),

  CONSTRAINT "factures_chantier_entreprise_fk"
    FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE RESTRICT,
  CONSTRAINT "factures_devis_entreprise_fk"
    FOREIGN KEY ("devis_id", "entreprise_id")
    REFERENCES "devis"("id", "entreprise_id") ON DELETE RESTRICT
);

CREATE TABLE "lignes_facture" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL,
  "facture_id" uuid NOT NULL,
  "libelle" text NOT NULL,
  "quantite" numeric(10,2) NOT NULL DEFAULT 1,
  "prix_unitaire" numeric(10,2) NOT NULL,
  "montant" numeric(10,2) NOT NULL,
  "ordre" integer NOT NULL DEFAULT 0,

  CONSTRAINT "lignes_facture_facture_entreprise_fk"
    FOREIGN KEY ("facture_id", "entreprise_id")
    REFERENCES "factures"("id", "entreprise_id") ON DELETE CASCADE
);

CREATE INDEX "lignes_facture_facture_idx" ON "lignes_facture" ("facture_id");

-- Sert le relevé de TVA collectée : les factures émises d'une période.
CREATE INDEX "factures_entreprise_emission_idx"
  ON "factures" ("entreprise_id", "date_emission")
  WHERE "statut" = 'emise';


-- --- Immuabilité d'une facture émise ---------------------------------------
-- Le relevé de TVA n'est pas une table : il est calculé à partir des factures
-- émises. C'est ce qui garantit qu'il ne peut pas diverger de ce qui a été
-- facturé — mais cela ne vaut que si une facture émise ne bouge plus. D'où ces
-- deux triggers, calqués sur ceux du devis (0001_securite_integrite.sql).

CREATE OR REPLACE FUNCTION empecher_modification_facture_emise() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut = 'emise' THEN
      RAISE EXCEPTION 'Une facture émise ne peut pas être supprimée (id=%)', OLD.id;
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.statut = 'emise' THEN
      RAISE EXCEPTION 'Une facture émise est immuable (id=%)', OLD.id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_facture_immuable
  BEFORE UPDATE OR DELETE ON "factures"
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_facture_emise();

CREATE OR REPLACE FUNCTION empecher_modification_lignes_facture_emise() RETURNS trigger AS $$
DECLARE
  v_statut text;
  v_facture_id uuid;
BEGIN
  v_facture_id := COALESCE(NEW.facture_id, OLD.facture_id);
  SELECT statut INTO v_statut FROM factures WHERE id = v_facture_id;
  IF v_statut = 'emise' THEN
    RAISE EXCEPTION 'Impossible de modifier les lignes d''une facture émise (facture_id=%)', v_facture_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lignes_facture_immuable
  BEFORE INSERT OR UPDATE OR DELETE ON "lignes_facture"
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_lignes_facture_emise();


-- --- Isolation --------------------------------------------------------------

ALTER TABLE "factures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "factures" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lignes_facture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lignes_facture" FORCE ROW LEVEL SECURITY;

CREATE POLICY "factures_isolation" ON "factures"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

CREATE POLICY "lignes_facture_isolation" ON "lignes_facture"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON "factures" TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "lignes_facture" TO atlas_app;


-- Numérotation propre aux factures : une suite de numéros de devis et une suite
-- de numéros de factures ne se mélangent pas.
ALTER TABLE "entreprise_compteurs"
  ADD COLUMN "prochain_numero_facture" integer NOT NULL DEFAULT 1;
