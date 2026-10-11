-- CE QU'IL A DÉJÀ OUVERT — la pastille des retours non lus
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Sa demande du 9 septembre 2026**, capture à l'appui : *« lorsqu'il y a un
-- retour d'intervention que le patron n'a pas vu, il faut que le nombre qui
-- s'affiche soit celui-là, et pas combien il y en a à l'intérieur. Et il faut
-- qu'on puisse distinguer du premier coup d'œil ceux pas ouverts — comme pour
-- les SMS sur notre téléphone, mettre une pastille de couleur à côté de ceux
-- que le patron n'a pas ouverts. »*
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **POURQUOI UNE TABLE, ET PAS UNE COLONNE `vu_le` SUR LE RETOUR.**
--
-- Une colonne dirait « ce retour a été vu », sans dire PAR QUI. Or `/termines`
-- est ouvert au propriétaire ET au rôle facturation : la première personne qui
-- ouvre effacerait la pastille de l'autre. Le patron regarderait son téléphone
-- le soir, ne verrait rien à lire, et le retour lui serait passé sous le nez
-- parce que quelqu'un d'autre l'avait ouvert le matin.
--
-- Une ligne par LECTEUR répond exactement à ce qu'il demande — « ceux que LE
-- PATRON n'a pas ouverts » — et coûte une jointure.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **ELLE NE PORTE AUCUNE DATE DE PURGE**, comme les trois tables du lot : un
-- retour se garde longtemps, et la trace de sa lecture avec lui. Elle disparaît
-- avec le retour (`ON DELETE CASCADE`) ou avec l'utilisateur qui l'a lue.

CREATE TABLE "retours_intervention_vus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "retour_id" uuid NOT NULL REFERENCES "retours_intervention"("id") ON DELETE CASCADE,
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "vu_le" timestamptz NOT NULL DEFAULT now()
);

-- **Une seule lecture par personne et par retour.** Il rouvre le même retour
-- trois fois dans la soirée : c'est la même lecture, pas trois. Sans cette
-- unicité, la table grossirait d'une ligne par appui et le compte des non-lus
-- resterait juste — mais la table, elle, deviendrait un journal que personne
-- n'a demandé.
CREATE UNIQUE INDEX "retours_intervention_vus_uk"
  ON "retours_intervention_vus" ("retour_id", "utilisateur_id");

-- La question posée à chaque ouverture de l'écran : « lesquels n'ai-je pas
-- lus ? ». Elle part de MOI, pas du retour.
CREATE INDEX "retours_intervention_vus_par_lecteur_idx"
  ON "retours_intervention_vus" ("utilisateur_id", "retour_id");

ALTER TABLE "retours_intervention_vus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retours_intervention_vus" FORCE ROW LEVEL SECURITY;
CREATE POLICY "retours_intervention_vus_isolation" ON "retours_intervention_vus"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "retours_intervention_vus" TO atlas_app;
