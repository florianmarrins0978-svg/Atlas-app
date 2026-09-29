-- LES COULEURS DU PLANNING — rien, incomplet, complet, au-delà.
--
-- Sa demande du 29 septembre 2026 : pouvoir modifier ces quatre couleurs
-- depuis le planning. Planche `appli/couleurs-du-planning.html`, et ses deux
-- réponses : « tout l'entreprise », puis « met la même chose que pour les
-- couleurs des devis » — un nuancier libre, comme `doc_fond` et `doc_accent`
-- (migration 0063).
--
-- **NULL veut dire « comme aujourd'hui »** : la couleur de l'apparence choisie
-- (`src/lib/chartes.ts`). Écrire le vert pâle d'origine à la création d'une
-- entreprise la figerait sur la valeur du jour, et elle ne suivrait plus une
-- apparence sombre.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : quatre colonnes
-- nullables, aucune ligne existante touchée, aucun UPDATE sous FORCE RLS.
-- L'ancien code les ignore.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS planning_rien text,
  ADD COLUMN IF NOT EXISTS planning_incomplet text,
  ADD COLUMN IF NOT EXISTS planning_complet text,
  ADD COLUMN IF NOT EXISTS planning_au_dela text;

-- La forme est celle que rend un nuancier, comme pour l'allure des documents :
-- une valeur mal écrite finirait telle quelle dans une variable CSS.
ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_planning_rien_forme;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_planning_rien_forme
  CHECK (planning_rien IS NULL OR planning_rien ~ '^#[0-9a-f]{6}$');

ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_planning_incomplet_forme;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_planning_incomplet_forme
  CHECK (planning_incomplet IS NULL OR planning_incomplet ~ '^#[0-9a-f]{6}$');

ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_planning_complet_forme;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_planning_complet_forme
  CHECK (planning_complet IS NULL OR planning_complet ~ '^#[0-9a-f]{6}$');

ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_planning_au_dela_forme;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_planning_au_dela_forme
  CHECK (planning_au_dela IS NULL OR planning_au_dela ~ '^#[0-9a-f]{6}$');
