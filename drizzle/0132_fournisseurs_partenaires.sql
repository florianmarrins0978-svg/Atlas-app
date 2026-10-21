-- MES FOURNISSEURS ET MES PARTENAIRES — sa planche du 18 et du 19 octobre 2026
-- (`appli/reglages-fournisseurs-partenaires.html`, publiée et validée).
--
-- Ce qu'il PAIE, tenu à part de ce qu'il VEND (`tarifs`). Ses règles, à ne pas
-- rouvrir :
--   * son prix de vente passe toujours en premier, puis prix d'achat × marge,
--     puis « à chiffrer », jamais zéro (`src/lib/prix-achat.ts`) ;
--   * deux marges générales, le matériel (fournisseurs) et la main d'œuvre
--     (partenaires), en COEFFICIENT, et une marge propre possible par société ;
--   * une marge au-dessus de × 3 est une faute de frappe (« 20 » pour 20 %) :
--     refusée ici aussi, pas seulement à l'écran.
--
-- Chaque société a trois parties : ses prix, les devis qu'elle m'a faits (le
-- fichier gardé), les demandes que je lui ai envoyées.
--
-- Expand seul : cinq tables neuves, aucune ligne existante touchée, aucune
-- contrainte posée sur une table habitée. Le code d'avant les ignore.
--
-- **Une société ne se rattache qu'à SA entreprise.** Les clés étrangères
-- portent le couple (société, entreprise) : une clé étrangère seule se vérifie
-- hors RLS, et laisserait une entreprise ranger un prix sous la société d'une
-- autre.

CREATE TABLE IF NOT EXISTS "societes_achat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "rubrique" text NOT NULL CHECK ("rubrique" IN ('fournisseur', 'partenaire')),
  "nom" text NOT NULL CHECK (length(btrim("nom")) > 0),
  "marge" numeric(5, 2) CHECK ("marge" IS NULL OR ("marge" > 0 AND "marge" <= 3)),
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "societes_achat_id_entreprise_uk" UNIQUE ("id", "entreprise_id")
);
CREATE INDEX IF NOT EXISTS "societes_achat_entreprise_idx" ON "societes_achat" ("entreprise_id", "rubrique") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "devis_recus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "societe_id" uuid NOT NULL,
  "nom" text NOT NULL CHECK (length(btrim("nom")) > 0),
  "fichier_cle" text NOT NULL,
  "fichier_nom" text,
  "nature" text NOT NULL CHECK ("nature" IN ('photo', 'pdf')),
  "recu_le" date NOT NULL DEFAULT CURRENT_DATE,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "devis_recus_id_entreprise_uk" UNIQUE ("id", "entreprise_id"),
  CONSTRAINT "devis_recus_societe_fk" FOREIGN KEY ("societe_id", "entreprise_id")
    REFERENCES "societes_achat"("id", "entreprise_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "devis_recus_societe_idx" ON "devis_recus" ("societe_id") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "prix_achat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "societe_id" uuid NOT NULL,
  "nom" text NOT NULL CHECK (length(btrim("nom")) > 0),
  -- La référence du fournisseur quand elle est imprimée (« RA3504 ») : c'est
  -- elle qui rapproche ce prix d'une pièce du plan d'arrosage, jamais le nom.
  "reference" text,
  "unite" text NOT NULL,
  "prix_ht" numeric(12, 2) NOT NULL CHECK ("prix_ht" >= 0),
  "releve_le" date NOT NULL DEFAULT CURRENT_DATE,
  -- « Tapé le 19/10/2026 », « Lu sur le devis « Haie Durand » du 12/10/2026 ».
  "source" text NOT NULL,
  "devis_recu_id" uuid,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "prix_achat_societe_fk" FOREIGN KEY ("societe_id", "entreprise_id")
    REFERENCES "societes_achat"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "prix_achat_devis_fk" FOREIGN KEY ("devis_recu_id", "entreprise_id")
    REFERENCES "devis_recus"("id", "entreprise_id")
);
CREATE INDEX IF NOT EXISTS "prix_achat_societe_idx" ON "prix_achat" ("societe_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "prix_achat_entreprise_idx" ON "prix_achat" ("entreprise_id") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "demandes_envoyees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "societe_id" uuid NOT NULL,
  "titre" text NOT NULL CHECK (length(btrim("titre")) > 0),
  "origine" text NOT NULL CHECK ("origine" IN ('devis', 'arrosage')),
  -- Les lignes telles qu'elles sont parties : désignation, référence, quantité.
  "lignes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "envoyee_le" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "demandes_envoyees_societe_fk" FOREIGN KEY ("societe_id", "entreprise_id")
    REFERENCES "societes_achat"("id", "entreprise_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "demandes_envoyees_societe_idx" ON "demandes_envoyees" ("societe_id");

-- Les deux marges générales. Vides tant qu'il ne les a pas données : rien ne
-- s'ajoute d'office, la ligne reste à chiffrer.
CREATE TABLE IF NOT EXISTS "marges_achat" (
  "entreprise_id" uuid PRIMARY KEY REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "materiel" numeric(5, 2) CHECK ("materiel" IS NULL OR ("materiel" > 0 AND "materiel" <= 3)),
  "main_oeuvre" numeric(5, 2) CHECK ("main_oeuvre" IS NULL OR ("main_oeuvre" > 0 AND "main_oeuvre" <= 3)),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "societes_achat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "societes_achat" FORCE ROW LEVEL SECURITY;
CREATE POLICY "societes_achat_isolation" ON "societes_achat"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "societes_achat" TO atlas_app;

ALTER TABLE "devis_recus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "devis_recus" FORCE ROW LEVEL SECURITY;
CREATE POLICY "devis_recus_isolation" ON "devis_recus"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "devis_recus" TO atlas_app;

ALTER TABLE "prix_achat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prix_achat" FORCE ROW LEVEL SECURITY;
CREATE POLICY "prix_achat_isolation" ON "prix_achat"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "prix_achat" TO atlas_app;

ALTER TABLE "demandes_envoyees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demandes_envoyees" FORCE ROW LEVEL SECURITY;
CREATE POLICY "demandes_envoyees_isolation" ON "demandes_envoyees"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "demandes_envoyees" TO atlas_app;

ALTER TABLE "marges_achat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marges_achat" FORCE ROW LEVEL SECURITY;
CREATE POLICY "marges_achat_isolation" ON "marges_achat"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "marges_achat" TO atlas_app;


COMMENT ON TABLE "societes_achat" IS 'Ses fournisseurs et ses partenaires, et la marge propre de chacun (19 octobre 2026).';
COMMENT ON TABLE "prix_achat" IS 'Ce qu''il paie chez un fournisseur ou un partenaire, à part de ses prix de vente (19 octobre 2026).';
COMMENT ON TABLE "devis_recus" IS 'Les devis reçus de ses fournisseurs et partenaires, leur fichier gardé (19 octobre 2026).';
COMMENT ON TABLE "demandes_envoyees" IS 'Les listes qu''il a envoyées à un fournisseur, depuis un devis ou le plan d''arrosage (19 octobre 2026).';
COMMENT ON TABLE "marges_achat" IS 'Ses deux marges générales, en coefficient : le matériel, la main d''œuvre (19 octobre 2026).';
