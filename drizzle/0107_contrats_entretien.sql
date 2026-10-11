-- LES CONTRATS D'ENTRETIEN.
--
-- Sa demande du 26 septembre 2026, après la comparaison avec Extrabat, et ses
-- planches 128 et 129 (`appli/contrat-d-entretien-vert.html`, la retenue) : un
-- contrat pour un client porte des prestations, chacune avec ses mois, son
-- nombre de passages par mois et son prix du passage ; une période (un mois de
-- début, une durée) ; une facturation, A (chaque mois) ou B (après chaque
-- passage). Il part chez le client comme un devis, qui l'accepte par un lien.
-- Accepté, ses passages arrivent dans « Sans date » le 20 du mois d'avant.
--
-- **LES PRESTATIONS VIVENT DANS UNE COLONNE jsonb, pas dans une table.** Même
-- raison que les lignes d'un avoir (0101) : un contrat envoyé ne se modifie
-- plus, et ses lignes doivent se figer AVEC lui. Leur forme est tenue par une
-- seule fonction, `relireContrat` (`src/lib/contrats-entretien.ts`), à
-- l'écriture comme à la lecture.
--
-- **UN PASSAGE EST UN CHANTIER.** Il se pose au planning, se termine, se
-- facture : tout ce que l'application sait déjà faire d'un chantier. Deux
-- colonnes le rattachent à son contrat, et l'index unique sur (contrat,
-- passage) rend l'arrivée IDEMPOTENTE : deux ouvertures du planning au même
-- instant ne posent jamais un passage deux fois.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une table neuve et
-- deux colonnes nullables. Aucune ligne existante ne change, aucun UPDATE,
-- donc rien à éprouver sur une base habitée ni sous FORCE RLS. Un code ancien
-- servi sur ce schéma ignore simplement ce qu'il ne lit pas.

CREATE TABLE "contrats_entretien" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL,

  -- Brouillon tant qu'il n'est pas parti ; puis la réponse du client.
  "statut" text NOT NULL DEFAULT 'brouillon'
    CHECK ("statut" IN ('brouillon', 'envoye', 'accepte', 'refuse')),

  -- Le premier jour du premier mois : un contrat commence toujours un 1er.
  "debut" date NOT NULL CHECK (EXTRACT(DAY FROM "debut") = 1),
  "duree_mois" integer NOT NULL CHECK ("duree_mois" BETWEEN 1 AND 36),
  "reconduit" boolean NOT NULL DEFAULT true,

  "facturation" text NOT NULL DEFAULT 'passage' CHECK ("facturation" IN ('passage', 'mois')),
  -- L'automatisme n'existe qu'en B : la base le refuse en A, comme la relecture.
  "avec_compte_rendu" boolean NOT NULL DEFAULT false,
  CONSTRAINT "contrats_entretien_automatisme_ck" CHECK (NOT "avec_compte_rendu" OR "facturation" = 'passage'),

  "prestations" jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Le taux pris dans ses réglages à la création, recopié : un contrat ne
  -- change pas de TVA parce que le réglage a bougé après sa signature.
  "taux_tva" numeric(5, 2) NOT NULL,

  -- L'envoi : le jeton du lien, l'empreinte de ce qui est parti, l'heure.
  "jeton" text UNIQUE,
  "empreinte" char(64),
  "envoye_le" timestamptz,
  CONSTRAINT "contrats_entretien_envoi_ck" CHECK (
    "statut" = 'brouillon'
    OR ("jeton" IS NOT NULL AND "empreinte" IS NOT NULL AND "envoye_le" IS NOT NULL)
  ),

  -- La réponse : ce qui prouve l'accord, sans signature à la main (la même
  -- preuve que l'acceptation d'un devis : l'empreinte, l'heure, d'où).
  "repondu_le" timestamptz,
  "reponse_adresse_ip" text,
  "reponse_agent" text,
  CONSTRAINT "contrats_entretien_reponse_ck" CHECK (
    "statut" NOT IN ('accepte', 'refuse') OR "repondu_le" IS NOT NULL
  ),

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,

  CONSTRAINT "contrats_entretien_client_entreprise_fk"
    FOREIGN KEY ("client_id", "entreprise_id") REFERENCES "clients"("id", "entreprise_id"),
  CONSTRAINT "contrats_entretien_id_entreprise_uk" UNIQUE ("id", "entreprise_id")
);

CREATE INDEX "contrats_entretien_client_idx" ON "contrats_entretien" ("entreprise_id", "client_id");
CREATE INDEX "contrats_entretien_statut_idx" ON "contrats_entretien" ("entreprise_id", "statut");

ALTER TABLE "contrats_entretien" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contrats_entretien" FORCE ROW LEVEL SECURITY;

CREATE POLICY "contrats_entretien_isolation" ON "contrats_entretien"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- **La lecture publique, strictement limitée à un jeton exact** posé par le
-- code juste avant la requête (`app.jeton_contrat`) : la mécanique du devis
-- (0015) et du compte rendu (0055). Le client n'a pas de compte, donc pas de
-- contexte d'entreprise ; sans le jeton, aucune ligne. Sa RÉPONSE s'écrit
-- ensuite sous le contexte de l'entreprise lue, comme celle d'un devis.
CREATE POLICY "contrats_entretien_lecture_par_jeton" ON "contrats_entretien"
  FOR SELECT
  USING ("jeton" = NULLIF(current_setting('app.jeton_contrat', true), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON "contrats_entretien" TO atlas_app;

-- ─── Le passage, rattaché à son contrat ─────────────────────────────────
-- `contrat_passage` est la clé « prestation-année-mois-rang » calculée par
-- `passagesArrives` : c'est elle que l'index unique tient, et elle seule.
ALTER TABLE "chantiers"
  ADD COLUMN IF NOT EXISTS "contrat_entretien_id" uuid,
  ADD COLUMN IF NOT EXISTS "contrat_passage" text;

ALTER TABLE "chantiers"
  ADD CONSTRAINT "chantiers_contrat_entretien_fk"
    FOREIGN KEY ("contrat_entretien_id", "entreprise_id")
    REFERENCES "contrats_entretien"("id", "entreprise_id"),
  ADD CONSTRAINT "chantiers_contrat_passage_ck"
    CHECK (("contrat_entretien_id" IS NULL) = ("contrat_passage" IS NULL));

CREATE UNIQUE INDEX "chantiers_contrat_passage_uk"
  ON "chantiers" ("contrat_entretien_id", "contrat_passage")
  WHERE "contrat_entretien_id" IS NOT NULL;
