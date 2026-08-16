-- La fiche d'entretien : le modèle, et rien que le modèle.
--
-- **Sa demande du 16 août 2026**, captures d'une autre application à l'appui :
-- des fiches de chantier pour les paysagistes en contrat d'entretien — cocher
-- ce qui a été fait, puis envoyer au client.
--
-- **Sa décision sur le rangement, dans ses mots** : « ça sera un modèle à chaque
-- fois qu'on pré-remplira et qu'on enverra aux clients. Donc au final, chaque
-- client aura sa fiche parce que ça ne sera jamais la même — mais il n'y aura
-- qu'une seule fiche. »
--
-- **UN SEUL MODÈLE PAR ENTREPRISE, donc, et AUCUNE fiche rangée par client.**
-- C'est ce que cette table porte, et c'est tout ce qu'elle porte. Le passage —
-- ce qui a été coché ce jour-là, le temps passé, le rapport envoyé — viendra
-- dans une migration à lui : le mélanger ici ferait porter à une même table
-- deux durées de vie très différentes (un modèle qui évolue, un rapport qui ne
-- doit JAMAIS changer une fois parti chez le client).
--
-- **La famille est une colonne de texte, pas une table.** Elle se renomme en
-- écrivant sur les lignes concernées. Une table de familles aurait apporté une
-- jointure, un ordre à tenir et des familles vides à ramasser — pour un mot que
-- le patron change trois fois par an.
--
-- **L'ordre est un entier explicite**, jamais l'ordre d'insertion : il range ses
-- gestes dans l'ordre où il les fait sur le chantier — la pelouse d'abord, les
-- déchets à la fin —, et une ligne ajoutée après coup doit pouvoir se glisser au
-- milieu.
CREATE TABLE "prestations_entretien" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- « Pelouse », « Tailles »… Le mot du patron, jamais une nomenclature imposée.
  "famille" text NOT NULL,

  -- « Tonte et ébarbage ».
  "libelle" text NOT NULL,

  -- Croissant. Des trous sont normaux : ils évitent de réécrire toute la fiche
  -- pour insérer une ligne.
  "ordre" integer NOT NULL,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Deux fois la même prestation donnerait deux cases à cocher pour un seul
-- geste, et le rapport du client afficherait la ligne en double.
--
-- **La contrainte porte sur le libellé SEUL, pas sur (famille, libellé)** : la
-- même tonte rangée dans deux familles resterait un doublon aux yeux de celui
-- qui coche. La comparaison indulgente — casse et accents — est faite à
-- l'écriture (`memeLibelle`), pas ici : une contrainte insensible aux accents
-- demanderait une extension que ce dépôt n'installe pas.
CREATE UNIQUE INDEX "prestations_entretien_libelle_uk"
  ON "prestations_entretien" ("entreprise_id", lower("libelle"));

CREATE INDEX "prestations_entretien_ordre_idx"
  ON "prestations_entretien" ("entreprise_id", "ordre");

ALTER TABLE "prestations_entretien" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prestations_entretien" FORCE ROW LEVEL SECURITY;

CREATE POLICY "prestations_entretien_isolation" ON "prestations_entretien"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "prestations_entretien" TO atlas_app;
