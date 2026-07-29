-- Problème résolu : getCurrentCtx() doit résoudre entrepriseId à partir du
-- SEUL utilisateurId authentifié, mais la politique RLS existante sur
-- membres_entreprise exige déjà app.entreprise_id — qui n'est pas encore
-- connu à ce stade précis (c'est justement ce qu'on cherche à déterminer).
--
-- Solution minimale et sûre : une politique SELECT supplémentaire, scopée par
-- utilisateur (jamais par entreprise), qui autorise un utilisateur à lire
-- UNIQUEMENT ses propres lignes d'adhésion — jamais celles d'un autre
-- utilisateur. Les politiques RLS de type PERMISSIVE (par défaut) sont
-- combinées en OR : cette politique s'ajoute à celle déjà existante, elle ne
-- la remplace pas et ne l'affaiblit pas.

CREATE POLICY "membres_entreprise_lecture_propre" ON "membres_entreprise"
  FOR SELECT
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);
