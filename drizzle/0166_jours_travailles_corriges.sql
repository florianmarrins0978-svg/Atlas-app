-- LES JOURS TRAVAILLÉS CORRIGÉS À LA MAIN (sa planche du 5 novembre 2026,
-- la A : `appli/soignee/jours-travailles.html`).
--
-- **Le calcul ne s'écrit pas** : il se refait à chaque ouverture, sur les
-- jours ouvrés, les fériés et les absences (`src/lib/jours-travailles.ts`).
-- Seul ce que le patron a CHANGÉ s'écrit ici, un salarié et un mois par
-- ligne : le nombre de jours saisi, son motif (congé, maladie… quand il
-- baisse ; samedi, férié… quand il monte), et ses corrections par zone de
-- déplacement (`src/lib/zones-deplacement.ts`, une clé par case : « z0 »,
-- « hors »).
--
-- **Le salarié se désigne par son RANG**, comme ses absences et son nom
-- (`nommerEquipe`) : la ligne d'équipe n'existe pas toujours en base, et
-- l'exiger forcerait à écrire vingt lignes vides d'avance.
--
-- **Une table neuve** : rien d'existant n'est relu ni écrit, rien à éprouver
-- sur une base habitée. Isolée par entreprise, sous FORCE RLS comme
-- `absences_equipe` (migration 0044).

CREATE TABLE IF NOT EXISTS "jours_travailles_corriges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "rang" integer NOT NULL,
  "mois" text NOT NULL,
  "jours" numeric(4, 1),
  "motif" text,
  "zones" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "jours_travailles_corriges_uk" UNIQUE ("entreprise_id", "rang", "mois"),
  CONSTRAINT "jours_travailles_corriges_rang_ck" CHECK ("rang" BETWEEN 1 AND 20),
  CONSTRAINT "jours_travailles_corriges_mois_ck" CHECK ("mois" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Par demi-journée, entre 0 et 31 : la règle de `joursSaisisLus`.
  CONSTRAINT "jours_travailles_corriges_jours_ck"
    CHECK ("jours" IS NULL OR ("jours" >= 0 AND "jours" <= 31 AND "jours" * 2 = trunc("jours" * 2))),
  CONSTRAINT "jours_travailles_corriges_motif_ck"
    CHECK ("motif" IS NULL OR "motif" IN ('conge', 'maladie', 'sans_solde', 'autre', 'samedi', 'ferie', 'autre_plus')),
  CONSTRAINT "jours_travailles_corriges_zones_ck" CHECK ("zones" IS NULL OR jsonb_typeof("zones") = 'object')
);

ALTER TABLE "jours_travailles_corriges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jours_travailles_corriges" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jours_travailles_corriges' AND policyname = 'jours_travailles_corriges_isolation') THEN
    CREATE POLICY "jours_travailles_corriges_isolation" ON "jours_travailles_corriges"
      USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
      WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "jours_travailles_corriges" TO atlas_app;
