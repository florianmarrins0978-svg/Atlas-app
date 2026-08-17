-- Ses mots à lui, par-dessus le vocabulaire de tout le monde.
--
-- **Sa question du 17 août 2026**, capture de l'écran « Catalogue » à l'appui,
-- et c'était la SECONDE fois : *« À quoi sert cette page ?? On peut rien
-- modifier rajouter »*. Arrangement **B** de la planche
-- `docs/maquettes/68-mes-mots-au-catalogue.html`.
--
-- **Pourquoi une table à part, et pas deux colonnes de plus sur le catalogue.**
-- `catalogue_prestations` et `catalogue_materiels` sont PARTAGÉS entre toutes
-- les entreprises (migration 0007) : aucune colonne `entreprise_id`, aucune
-- RLS. Y écrire depuis son téléphone changerait le vocabulaire de tous les
-- autres artisans, sans qu'ils l'aient demandé ni qu'ils puissent le corriger.
-- Ses mots vivent donc ici, isolés comme le reste de ses données, et se
-- superposent au commun À LA LECTURE.
--
-- **Une seule table pour quatre formes**, et c'est ce qui la rend lisible :
--
--   1. un mot posé sur une prestation d'Atlas  → `prestation_id` renseigné ;
--   2. un mot posé sur un matériel d'Atlas     → `materiel_id` renseigné ;
--   3. SON entrée à lui                        → les trois renvois à NULL,
--                                                `mot` porte alors le nom ;
--   4. un mot posé sur son entrée à lui        → `parent_id` renseigné.
--
-- **Le mot n'est jamais retiré du vocabulaire commun.** Il n'y a ici que des
-- ajouts : retirer « sapin » d'« Élagage » le retirerait chez tout le monde.
-- C'est écrit sur la planche, et l'écran ne propose pas le geste.
CREATE TABLE "mots_catalogue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- « prestation » ou « materiel ». Redondante avec les renvois pour les formes
  -- 1 et 2, indispensable pour les formes 3 et 4 — une entrée à lui n'a aucun
  -- renvoi qui dirait de quelle famille elle est.
  "famille" text NOT NULL CHECK ("famille" IN ('prestation', 'materiel')),

  -- Le mot écrit, ou le nom de son entrée à lui.
  "mot" text NOT NULL,

  "prestation_id" uuid REFERENCES "catalogue_prestations"("id") ON DELETE CASCADE,
  "materiel_id" uuid REFERENCES "catalogue_materiels"("id") ON DELETE CASCADE,
  "parent_id" uuid REFERENCES "mots_catalogue"("id") ON DELETE CASCADE,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- Un mot s'accroche à UNE chose, ou à rien. Deux renvois à la fois
  -- rendraient un écran où le même mot apparaît sous deux entrées, et une
  -- dictée qui hésite entre les deux.
  CONSTRAINT "mots_catalogue_un_seul_ancrage"
    CHECK (num_nonnulls("prestation_id", "materiel_id", "parent_id") <= 1),

  -- La famille doit s'accorder avec l'ancrage, sinon un mot de matériel
  -- pourrait s'accrocher à une prestation et disparaître de l'écran des
  -- matériels tout en restant compté dedans.
  CONSTRAINT "mots_catalogue_famille_accordee"
    CHECK (
      ("prestation_id" IS NULL OR "famille" = 'prestation')
      AND ("materiel_id" IS NULL OR "famille" = 'materiel')
    )
);

-- **Le même mot deux fois chez lui n'aide personne, et nuit à la dictée.**
-- « écimage » sous « Élagage » ET sous « Taille de haie » ferait hésiter le
-- rapprochement au lieu de l'aider. La casse est ignorée : « Écimage » et
-- « écimage » sont le même mot. Les accents, eux, ne le sont pas — une
-- comparaison insensible aux accents demanderait une extension que ce dépôt
-- n'installe pas ; l'indulgence sur les accents est faite à l'écriture.
CREATE UNIQUE INDEX "mots_catalogue_mot_uk"
  ON "mots_catalogue" ("entreprise_id", "famille", lower("mot"));

CREATE INDEX "mots_catalogue_entreprise_idx"
  ON "mots_catalogue" ("entreprise_id", "famille");

ALTER TABLE "mots_catalogue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mots_catalogue" FORCE ROW LEVEL SECURITY;

CREATE POLICY "mots_catalogue_isolation" ON "mots_catalogue"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "mots_catalogue" TO atlas_app;
