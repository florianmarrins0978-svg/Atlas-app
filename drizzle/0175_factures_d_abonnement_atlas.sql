-- LES FACTURES QU'ATLAS ADRESSE AUX ARTISANS POUR LEUR ABONNEMENT (ses
-- réponses du 5 novembre 2026 : TVA, et Factur-X ; `src/lib/facture-atlas.ts`).
--
-- Atlas fait lui-même sa facture d'abonnement, Stripe ne fait qu'encaisser :
-- une ligne par paiement reçu (`invoice.paid`), son numéro, ses montants,
-- l'identité de l'acheteur au jour du paiement, et le PDF rangé.
--
-- **Ce que la table refuse, et pourquoi** :
--
--   · elle ne se modifie ni ne s'efface (droits retirés plus bas) : une
--     facture émise est une pièce comptable d'ATLAS, gardée dix ans quoi
--     qu'il arrive au compte de l'artisan (RGPD 17.3.b, question 33) ;
--   · `entreprise_id` en RESTRICT, pour la même raison : l'entreprise ne peut
--     pas emporter les factures qu'Atlas lui a faites ;
--   · `facture_prestataire` unique : Stripe répète un crochet tant qu'il n'a
--     pas reçu de 200, et un même paiement ne doit jamais faire deux factures ;
--   · `rang` unique, tiré d'UN compteur (`compteur_factures_atlas`) verrouillé
--     dans la transaction : une suite sans trou. Une SEQUENCE aurait des trous
--     à chaque transaction annulée, et une facture manquante se remarque.
--
-- **Sous RLS** comme le reste : l'artisan ne lit que les siennes. Le crochet
-- n'a pas de session, il pose le contexte depuis l'abonnement qu'il a reconnu.
--
-- **EXPAND SEUL** : deux tables neuves, aucune ligne existante lue ni écrite.
-- Le compteur part à zéro : il n'existe aucune facture d'Atlas à reprendre.

CREATE TABLE IF NOT EXISTS "compteur_factures_atlas" (
  "id" smallint PRIMARY KEY CHECK ("id" = 1),
  "dernier" integer NOT NULL DEFAULT 0 CHECK ("dernier" >= 0)
);
INSERT INTO "compteur_factures_atlas" ("id", "dernier") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
REVOKE ALL ON "compteur_factures_atlas" FROM atlas_app;
GRANT SELECT, UPDATE ON "compteur_factures_atlas" TO atlas_app;

CREATE TABLE IF NOT EXISTS "factures_atlas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE RESTRICT,
  "rang" integer NOT NULL,
  "numero" text NOT NULL,
  "facture_prestataire" text NOT NULL,
  "emise_le" date NOT NULL,
  "periode_debut" date NOT NULL,
  "periode_fin" date NOT NULL,
  "formule" text NOT NULL,
  "total_ht" numeric(10, 2) NOT NULL,
  "total_tva" numeric(10, 2) NOT NULL,
  "total_ttc" numeric(10, 2) NOT NULL,
  "acheteur_nom" text NOT NULL,
  "acheteur_adresse" text,
  "acheteur_siret" text,
  "acheteur_numero_tva" text,
  "pdf_storage_key" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "factures_atlas_rang_uk" UNIQUE ("rang"),
  CONSTRAINT "factures_atlas_numero_uk" UNIQUE ("numero"),
  CONSTRAINT "factures_atlas_prestataire_uk" UNIQUE ("facture_prestataire"),
  CONSTRAINT "factures_atlas_totaux_ck" CHECK ("total_ttc" = "total_ht" + "total_tva")
);
CREATE INDEX IF NOT EXISTS "factures_atlas_entreprise_idx" ON "factures_atlas" ("entreprise_id", "emise_le" DESC);

ALTER TABLE "factures_atlas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "factures_atlas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "factures_atlas_isolation" ON "factures_atlas";
CREATE POLICY "factures_atlas_isolation" ON "factures_atlas"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Les droits par défaut donnent tout à `atlas_app` (0081) : on retire, puis on
-- rend seulement lire et écrire une ligne neuve.
REVOKE ALL ON "factures_atlas" FROM atlas_app;
GRANT SELECT, INSERT ON "factures_atlas" TO atlas_app;
