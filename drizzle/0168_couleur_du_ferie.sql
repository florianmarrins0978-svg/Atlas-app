-- LA COULEUR DES JOURS FÉRIÉS, RÉGLABLE (sa réponse du 6 novembre 2026 :
-- « réglable »), à côté des quatre couleurs du planning (migration 0113).
--
-- NULL : le bleu de l'apparence (`carteBleuFond`), qui suit la charte choisie.
-- Écrire ce bleu le figerait, et il ne suivrait plus Nuit ni Sylve.
--
-- **EXPAND SEUL** : une colonne nullable, sans défaut ; aucune ligne existante
-- n'est relue ni écrite, un code d'avant l'ignore.

ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS planning_ferie text;

ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_planning_ferie_forme;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_planning_ferie_forme
  CHECK (planning_ferie IS NULL OR planning_ferie ~ '^#[0-9a-f]{6}$');
