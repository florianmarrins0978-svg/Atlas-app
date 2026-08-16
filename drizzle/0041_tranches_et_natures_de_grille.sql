-- Ses tranches et ses travaux, au lieu des nôtres.
--
-- **Sa demande, le 14 août 2026**, capture de l'écran « Mes prix » à l'appui :
-- *« je dois pouvoir ajouter ou retirer des cases. »*
--
-- Jusqu'ici les 82 cases naissaient de constantes écrites dans
-- `src/lib/grille-prix.ts` : huit tranches de diamètre, six de hauteur, trois
-- façons d'abattre, cinq natures de travail. Elles avaient été relevées sur SES
-- devis du 8 août — mais figées depuis, et le jour où il taille des haies de
-- deux mètres ou abat des platanes de 1,20 m, la grille ne sait plus le suivre.
--
-- =========================================================================
-- Ce que ces deux tables ne remplacent PAS
-- =========================================================================
--
-- Elles ne sèment rien. Une entreprise qui n'a jamais touché à ses tranches
-- n'a **aucune ligne ici**, et ce sont les valeurs de départ du code qui
-- servent. Les écrire à la migration les aurait figées une seconde fois : le
-- jour où l'on corrige une borne d'origine, il aurait fallu une migration de
-- plus pour la porter à ceux qui n'y avaient jamais touché.
--
-- Les lignes n'apparaissent qu'au **premier geste** du patron sur un axe : à ce
-- moment-là on recopie les tranches de départ, puis on applique son geste. À
-- partir de là, ce sont les siennes qui font foi, et le dépôt ne s'en mêle plus.
--
-- =========================================================================
-- Retirer n'efface JAMAIS un prix — la règle du lot
-- =========================================================================
--
-- Une tranche retirée porte `retiree_le` ; sa ligne reste. Trois raisons, et la
-- troisième est la plus chère :
--
--   1. **« Annuler » doit pouvoir tout rendre.** C'est le geste de toute
--      l'application depuis le 10 août (`useRetraits`), et un retrait qui
--      supprime la ligne ne se défait pas ;
--   2. **les prix restent en place.** `grille_prix` garde ses cases : une clé
--      qu'aucune tranche ne reconnaît est simplement ignorée à la lecture
--      (`lireGrillePrix`), jamais supprimée. Remettre la tranche fait revenir
--      les prix tels quels ;
--   3. **la clé ne peut pas être réemployée pour autre chose.** Si la ligne
--      partait, une tranche neuve pourrait reprendre `d90` et hériter du prix
--      d'une tranche qui n'était pas la sienne. Un prix de 1 400 € posé pour
--      « plus de 90 cm » se retrouverait sur des troncs de 90 à 120 cm sans que
--      personne ne l'ait décidé.

-- =========================================================================
-- Les tranches d'un axe
-- =========================================================================

CREATE TABLE "tranches_grille" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- Lequel des trois axes. Le mot est celui du code (`NomAxe`) : les faire
  -- diverger obligerait à traduire dans les deux sens, et une traduction finit
  -- toujours par oublier un cas.
  "axe" text NOT NULL CHECK ("axe" IN ('diametre', 'hauteur', 'technique')),

  -- La clé écrite dans `grille_prix.cellule`. **Elle ne change jamais** : c'est
  -- elle qui rattache un prix à sa case. Le libellé, lui, peut être corrigé.
  "cle" text NOT NULL CHECK (length("cle") BETWEEN 1 AND 40),

  -- Les bornes, en cm ou en m selon l'axe. Borne basse EXCLUE, borne haute
  -- INCLUSE — c'est ainsi qu'on lit une grille en français, et les valeurs
  -- rondes (40, 50, 60) sont précisément celles qu'un artisan annonce.
  -- `a` vaut NULL pour la dernière tranche, ouverte : « plus de 90 cm ».
  --
  -- Une façon d'abattre n'a pas de bornes : elle porte 0 et NULL, et c'est son
  -- libellé qui dit tout. Mêler les deux dans une table plutôt que d'en faire
  -- deux évite d'écrire deux fois le même retrait réversible.
  "de" numeric(10, 2) NOT NULL DEFAULT 0 CHECK ("de" >= 0),
  "a" numeric(10, 2) CHECK ("a" IS NULL OR "a" > "de"),

  "libelle" text NOT NULL CHECK (length("libelle") BETWEEN 1 AND 80),

  -- L'ordre d'affichage. Les tranches se lisent de la plus petite à la plus
  -- grande ; les façons d'abattre, dans l'ordre où il les a posées.
  "rang" integer NOT NULL DEFAULT 0,

  -- Retirée, pas supprimée. Voir l'en-tête.
  "retiree_le" timestamptz,

  "created_at" timestamptz NOT NULL DEFAULT now(),

  -- Une clé ne désigne qu'une tranche par axe et par entreprise, retirée ou
  -- non : c'est ce qui empêche un prix de changer de case dans son dos.
  CONSTRAINT "tranches_grille_cle_uk" UNIQUE ("entreprise_id", "axe", "cle")
);

CREATE INDEX "tranches_grille_axe_idx" ON "tranches_grille" ("entreprise_id", "axe", "rang");

ALTER TABLE "tranches_grille" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tranches_grille" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tranches_grille_isolation" ON "tranches_grille"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "tranches_grille" TO atlas_app;

-- =========================================================================
-- Les natures de travail
-- =========================================================================

CREATE TABLE "natures_grille" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- `abattage`, `fendage`… pour les cinq d'origine ; `perso_<nom>` pour les
  -- siennes. Le préfixe n'est pas décoratif : il empêche qu'un travail nommé
  -- « abattage » à la main vienne se poser sur la grille dont le chiffrage se
  -- sert, et y écrase des prix.
  "cle" text NOT NULL CHECK (length("cle") BETWEEN 1 AND 60),

  "titre" text NOT NULL CHECK (length("titre") BETWEEN 1 AND 80),
  "aide" text NOT NULL DEFAULT '',
  "axe_libelle" text NOT NULL DEFAULT '',

  -- Comment les cases se fabriquent. Les mêmes quatre mots que `FormeGrille`.
  "forme" text NOT NULL
    CHECK ("forme" IN ('une-case', 'un-axe', 'technique-diametre', 'hauteur-diametre')),

  -- Pour une grille à une seule case : ce que le patron lit au-dessus du champ.
  "libelle_unique" text,

  "rang" integer NOT NULL DEFAULT 0,
  "retiree_le" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "natures_grille_cle_uk" UNIQUE ("entreprise_id", "cle")
);

CREATE INDEX "natures_grille_rang_idx" ON "natures_grille" ("entreprise_id", "rang");

ALTER TABLE "natures_grille" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "natures_grille" FORCE ROW LEVEL SECURITY;

CREATE POLICY "natures_grille_isolation" ON "natures_grille"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "natures_grille" TO atlas_app;

-- =========================================================================
-- `grille_prix.nature` cesse d'être une liste fermée
-- =========================================================================
--
-- Elle n'acceptait que les cinq natures d'origine. Un travail ajouté par le
-- patron serait refusé par la base — et le refus tomberait au moment où il pose
-- son premier prix, pas au moment où il crée le travail : l'erreur accuserait
-- le prix, qui n'y serait pour rien.
--
-- La contrainte devient une contrainte de FORME, pas de contenu : une clé non
-- vide, courte, sans caractère qui ferait d'elle autre chose qu'un identifiant.
-- Ce qui protège vraiment la table reste ailleurs, et n'a pas bougé : une clé
-- de case inconnue n'écrit nulle part (`poserPrixGrille`).

ALTER TABLE "grille_prix" DROP CONSTRAINT IF EXISTS "grille_prix_nature_check";

ALTER TABLE "grille_prix"
  ADD CONSTRAINT "grille_prix_nature_forme"
  CHECK ("nature" ~ '^[a-z0-9_]{1,60}$');
