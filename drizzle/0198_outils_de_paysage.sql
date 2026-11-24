-- LES OUTILS DE PAYSAGE DEVIENNENT UN MODULE ; UN PLAN ET UN DIAGNOSTIC OFFERTS.
--
-- **Numérotée 0198 le 24 novembre 2026** : écrite 0187 sur sa branche, numéro
-- pris depuis sur `main` (`0187_hommes_de_sa_ligne`) ; 0194 à 0197 le sont par
-- les lots du SIREN et du changement de formule.
--
-- Ses décisions du 18 et du 19 novembre 2026 (`docs/abonnement-module-paysage.md`,
-- planches `appli/soignee/abonnement-module-paysage.html` et
-- `appli/soignee/paysage-plan-offert.html`) : le plan d'arrosage, le diagnostic
-- végétal et les fiches de chantier s'ajoutent à n'importe quelle formule pour
-- 6 € HT par mois ; et un plan d'arrosage et un diagnostic sont offerts, une
-- seule fois par entreprise, essai compris.
--
-- **EXPAND SEULEMENT** (`.claude/rules/deployment-safety.md`) : deux colonnes (l'une
-- avec sa valeur par défaut, l'autre NULL) et une table neuve. L'ancien code les ignore et
-- continue de servir tel quel ; rien n'est retiré.
--
-- **AUCUNE LIGNE EXISTANTE N'EST RÉÉCRITE.** `ADD COLUMN … DEFAULT '{}'` pose la
-- valeur sans `UPDATE`, donc sans que la RLS forcée d'`abonnements` ait à voir
-- les lignes (la panne du 13 septembre, `.claude/rules/migrations.md`). La
-- contrainte qui suit est vérifiée par PostgreSQL sur toutes les lignes, RLS
-- ou pas : elles valent toutes `{}`, qu'elle accepte.

-- Les modules souscrits. Une liste et non un booléen : sa phrase du
-- 18 novembre, « et par la suite, si on rajoute des modules ».
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "modules" text[] NOT NULL DEFAULT '{}'::text[];

-- La base refuse un module que le code ne connaît pas (`MODULES`,
-- `src/lib/abonnements.ts`) : un module inconnu ne se facture pas, et il ne
-- doit pas non plus ouvrir quoi que ce soit.
ALTER TABLE "abonnements" DROP CONSTRAINT IF EXISTS "abonnements_modules_ck";
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_modules_ck" CHECK ("modules" <@ ARRAY['paysage']::text[]);

-- LES MODULES QUI COMMENCENT À L'ÉCHÉANCE, avec la formule prévue de la
-- migration 0197 (réunion des deux lots, 24 novembre 2026) : retirer les
-- outils est une descente, ils restent jusqu'à l'échéance. NULL tant que rien
-- n'est prévu, comme `formule_prevue`, et posée avec elle.
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "modules_prevus" text[];
ALTER TABLE "abonnements" DROP CONSTRAINT IF EXISTS "abonnements_modules_prevus_ck";
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_modules_prevus_ck"
  CHECK ("modules_prevus" IS NULL OR ("formule_prevue" IS NOT NULL AND "modules_prevus" <@ ARRAY['paysage']::text[]));

-- L'OFFRE PRISE, une ligne par outil et par entreprise, posée quand le plan sort
-- ou que le diagnostic rend son résultat, jamais avant. La clé primaire rend la
-- prise atomique : deux envois simultanés ne prennent pas deux fois l'offre.
--
-- **Le jeton** ouvre les retouches du plan offert pendant 24 heures
-- (`retoucheDuPlanOfferte`) : le plan n'est pas rangé, chaque retouche le refait.
CREATE TABLE IF NOT EXISTS "offres_prises" (
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "outil" text NOT NULL,
  "jeton" uuid NOT NULL DEFAULT gen_random_uuid(),
  "prise_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "offres_prises_pk" PRIMARY KEY ("entreprise_id", "outil"),
  CONSTRAINT "offres_prises_outil_ck" CHECK ("outil" IN ('arrosage', 'diagnostic'))
);

-- **Sous RLS** comme le reste : une entreprise ne voit et ne prend que ses offres.
ALTER TABLE "offres_prises" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offres_prises" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offres_prises_isolation" ON "offres_prises";
CREATE POLICY "offres_prises_isolation" ON "offres_prises"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Les droits par défaut donnent tout à `atlas_app` (0081) : on retire, puis on
-- rend lire, prendre, et RENDRE (un diagnostic dont l'analyse échoue rend
-- l'offre : il n'a rien eu). Changer une offre n'a pas d'usage.
REVOKE ALL ON "offres_prises" FROM atlas_app;
GRANT SELECT, INSERT, DELETE ON "offres_prises" TO atlas_app;
