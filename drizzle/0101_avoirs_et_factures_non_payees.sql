-- LES AVOIRS, ET LES FACTURES QU'IL NE SERA PAS PAYÉ.
--
-- Ses décisions du 24 septembre 2026, prises sur trois planches
-- (`appli/avoir.html`, `appli/il-ne-paiera-pas.html`,
-- `appli/mise-en-demeure.html`) ; le détail est dans TODO.md, entrée
-- « L'AVOIR ».
--
-- **UN AVOIR EST UNE FACTURE RECTIFICATIVE** (CGI art. 289 I-5 ; BOFiP
-- BOI-TVA-DECLA-30-20-20-20, §220 et §260, lus à la source ce jour-là) : il vise
-- la facture initiale par son numéro et sa date, porte ses propres mentions, le
-- HT et la TVA de la réduction, et le HT et la TVA qui restent dus. Il a donc sa
-- table, sa suite de numéros, et il ne se modifie JAMAIS : la facture ne bouge
-- pas, c'est l'avoir qui la corrige.
--
-- **SES LIGNES VIVENT DANS UNE COLONNE jsonb, pas dans une table.** Une table de
-- lignes aurait demandé son propre verrou, et un verrou sur des INSERT ne sait
-- pas distinguer « la ligne posée avec l'avoir » de « la ligne ajoutée un mois
-- plus tard ». Une colonne de la ligne verrouillée se verrouille avec elle.
--
-- **« IL NE ME PAIERA PAS » VIT DANS SA TABLE, pas sur la facture.** Une
-- facture émise est immuable (`trg_facture_immuable`, 0018) ; et le BOFiP le dit
-- pour l'impayé (§310) : *« la facture initiale ne doit pas être modifiée »*. La
-- déclaration se retire quand il paie : c'est une ligne qui s'efface, pas une
-- facture qui se réécrit.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : deux tables neuves et
-- deux colonnes à valeur par défaut. Aucun code servi ne les lit encore ; aucune
-- ligne existante ne change, donc rien à éprouver sur une base habitée ni sous
-- FORCE RLS (aucun UPDATE ici).

-- ─── La suite des avoirs ─────────────────────────────────────────────────────
-- Une suite à part, préfixe « A » : admise par le BOFiP si elle est tenue, et
-- elle évite qu'un avoir prenne un numéro dans la suite des factures, qui
-- aurait alors un trou.
ALTER TABLE entreprise_compteurs
  ADD COLUMN IF NOT EXISTS prochain_numero_avoir integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS annee_avoir integer DEFAULT EXTRACT(YEAR FROM now())::int;

-- ─── Les avoirs ──────────────────────────────────────────────────────────────
CREATE TABLE "avoirs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "facture_id" uuid NOT NULL,
  "numero" text NOT NULL,
  "date_emission" date NOT NULL,
  -- La désignation de ce qui est corrigé : la loi la demande (§220).
  "motif" text NOT NULL CHECK (length(btrim("motif")) > 0),
  -- La ligne de la facture que l'avoir vise ; NULL = toute la facture. Sa
  -- réponse « la B » : il choisit la ligne, Atlas ne répartit jamais.
  "ligne_facture_id" uuid,
  -- Les montants de la RÉDUCTION, positifs. Le signe « - » est une écriture.
  "total_ht" numeric(12, 2) NOT NULL CHECK ("total_ht" > 0),
  "total_tva" numeric(12, 2) NOT NULL CHECK ("total_tva" >= 0),
  "total_ttc" numeric(12, 2) NOT NULL CHECK ("total_ttc" > 0),
  "lignes" jsonb NOT NULL,
  "pdf_storage_key" text NOT NULL,
  "pdf_checksum" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "avoirs_ttc_somme_ck" CHECK ("total_ttc" = "total_ht" + "total_tva"),
  CONSTRAINT "avoirs_facture_entreprise_fk"
    FOREIGN KEY ("facture_id", "entreprise_id") REFERENCES "factures"("id", "entreprise_id"),
  CONSTRAINT "avoirs_entreprise_numero_uk" UNIQUE ("entreprise_id", "numero"),
  CONSTRAINT "avoirs_id_entreprise_uk" UNIQUE ("id", "entreprise_id")
);

CREATE INDEX "avoirs_facture_idx" ON "avoirs" ("facture_id");
CREATE INDEX "avoirs_entreprise_date_idx" ON "avoirs" ("entreprise_id", "date_emission");

CREATE OR REPLACE FUNCTION empecher_modification_avoir() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Un avoir est immuable : il ne se modifie ni ne se supprime (id=%)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_avoir_immuable
  BEFORE UPDATE OR DELETE ON "avoirs"
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_avoir();

ALTER TABLE "avoirs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "avoirs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "avoirs_isolation" ON "avoirs"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- Ni UPDATE ni DELETE : le verrou les refuserait, autant ne pas les accorder.
GRANT SELECT, INSERT ON "avoirs" TO atlas_app;

-- ─── Les factures qu'il ne sera pas payé ─────────────────────────────────────
CREATE TABLE "factures_non_payees" (
  "facture_id" uuid PRIMARY KEY,
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "declaree_le" timestamptz NOT NULL DEFAULT now(),
  "declaree_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "factures_non_payees_facture_entreprise_fk"
    FOREIGN KEY ("facture_id", "entreprise_id") REFERENCES "factures"("id", "entreprise_id")
);

ALTER TABLE "factures_non_payees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "factures_non_payees" FORCE ROW LEVEL SECURITY;
CREATE POLICY "factures_non_payees_isolation" ON "factures_non_payees"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, DELETE ON "factures_non_payees" TO atlas_app;
