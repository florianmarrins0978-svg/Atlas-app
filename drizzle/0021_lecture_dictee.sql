-- D'où vient un brouillon : compris par un modèle, ou recopié mot à mot.
--
-- Sans cette colonne, la provenance ne survivait pas au rechargement de la
-- page : le patron voyait la mention « lu mot à mot » juste après la
-- génération, puis plus rien — et relisait une recopie en la prenant pour une
-- analyse. Une information qui disparaît au premier rechargement est pire
-- qu'absente : on croit l'avoir vue.
--
-- Par défaut 'modele' : les brouillons existants ont bien été produits par le
-- chemin normal. Aucun d'eux ne doit être marqué à tort comme une recopie.
ALTER TABLE "brouillons_informations"
  ADD COLUMN IF NOT EXISTS "lecture" text NOT NULL DEFAULT 'modele';

ALTER TABLE "brouillons_informations"
  ADD CONSTRAINT "brouillons_informations_lecture_ck"
  CHECK ("lecture" IN ('modele', 'litterale'));
