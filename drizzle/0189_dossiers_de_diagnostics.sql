-- Ranger un diagnostic dans un dossier, avec une note (20 novembre 2026).
--
-- Sa demande : « qu'il puisse l'enregistrer dans l'application sous un dossier
-- et pouvoir se faire des annotations, pour qu'il ne soit pas obligé à chaque
-- fois de rechercher un champignon ou une maladie qu'il a déjà vu ». Ses
-- réponses sur la planche (`appli/soignee/diagnostic-dossiers.html`) : le
-- dossier d'un chantier ne se montre PAS sur la fiche du chantier, et la note
-- s'écrit au clavier seulement.
--
-- **Un chantier est déjà un dossier** : `diagnostics.chantier_id` existe depuis
-- 0056. Ce qui manque, ce sont les dossiers à lui (« Mes observations ») et la
-- note. EXPAND SEUL : une table neuve, trois colonnes NULL, aucune ligne
-- existante réécrite. L'ancien code ignore tout cela et continue de servir.

CREATE TABLE "dossiers_diagnostic" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "nom" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- La règle de longueur vit dans `src/lib/dossiers-diagnostic.ts` ; la base
  -- la tient aussi, pour qu'elle ne dépende pas du seul écran.
  CONSTRAINT "dossiers_diagnostic_nom_ck" CHECK (length(btrim("nom")) BETWEEN 1 AND 60),
  -- Le renvoi composé de `diagnostics` (id, entreprise) a besoin de cette clé :
  -- c'est elle qui interdit, en base, de ranger un diagnostic dans le dossier
  -- d'une autre entreprise.
  CONSTRAINT "dossiers_diagnostic_id_entreprise_uk" UNIQUE ("id", "entreprise_id")
);

-- Deux dossiers du même nom se confondraient dans la feuille : un seul par
-- entreprise, sans égard à la casse ni aux espaces autour.
CREATE UNIQUE INDEX "dossiers_diagnostic_nom_uk"
  ON "dossiers_diagnostic" ("entreprise_id", lower(btrim("nom")));

ALTER TABLE "dossiers_diagnostic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dossiers_diagnostic" FORCE ROW LEVEL SECURITY;

CREATE POLICY "dossiers_diagnostic_isolation" ON "dossiers_diagnostic"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "dossiers_diagnostic" TO atlas_app;

-- ── Le diagnostic : son dossier, sa note, le jour où il a été rangé ────────

ALTER TABLE "diagnostics" ADD COLUMN "dossier_id" uuid;
ALTER TABLE "diagnostics" ADD COLUMN "note" text;
-- Nul pour un diagnostic rattaché à un chantier avant ce jour : l'écran dit
-- alors « Rangée dans X. » sans date, plutôt que d'en inventer une.
ALTER TABLE "diagnostics" ADD COLUMN "range_le" timestamptz;

-- `SET NULL ("dossier_id")` désigne la colonne, pour la même raison qu'en 0056 :
-- sans la liste, PostgreSQL annulerait aussi `entreprise_id`, qui est NOT NULL.
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_dossier_entreprise_fk"
  FOREIGN KEY ("dossier_id", "entreprise_id")
  REFERENCES "dossiers_diagnostic"("id", "entreprise_id") ON DELETE SET NULL ("dossier_id");

-- UNE place par photo : un chantier OU un dossier à lui, jamais les deux. Les
-- lignes existantes la respectent toutes, `dossier_id` venant de naître NULL.
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_une_seule_place_ck"
  CHECK ("chantier_id" IS NULL OR "dossier_id" IS NULL);

ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_note_ck"
  CHECK ("note" IS NULL OR length("note") <= 2000);

CREATE INDEX "diagnostics_dossier_idx" ON "diagnostics" ("entreprise_id", "dossier_id");
