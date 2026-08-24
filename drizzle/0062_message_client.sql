-- SON MESSAGE AU CLIENT — celui qui part avec le devis, la facture, le rapport
--
-- Sa demande du 23 août 2026 : « y a-t-il un endroit dans les réglages où
-- l'utilisateur peut rédiger ce message automatique ? S'il n'y en a pas, il
-- faut en créer un ». Il n'y en avait pas : le texte vivait dans
-- `src/lib/message-client.ts`, identique pour toutes les entreprises.
--
-- **NULL veut dire « celui d'Atlas », et ce n'est pas la même chose que le
-- recopier ici.** Figer le texte par défaut dans la colonne à la création d'une
-- entreprise ferait que le jour où l'on corrige une virgule, les anciennes
-- garderaient l'ancienne version sans que personne ne s'en aperçoive. Une
-- valeur nulle suit le produit ; un texte écrit lui appartient.
--
-- **Un seul message pour ses trois documents**, sa décision du même jour. Ce
-- qui distingue les trois — le numéro de la facture, son échéance, le fait
-- qu'un devis se répond quand une facture se règle — est posé par Atlas à
-- l'endroit où il écrit `[document]`.
--
-- Borné à 2 000 caractères. La borne est ici ET dans `MESSAGE_MAX` : celle-ci
-- protège la base d'un copier-coller, celle-là refuse AVANT d'enregistrer et
-- lui dit pourquoi.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS message_client text;

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_message_client_borne;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_message_client_borne
  CHECK (message_client IS NULL OR length(message_client) <= 2000);

COMMENT ON COLUMN entreprises.message_client IS
  'Le message que le patron a écrit pour ses clients. NULL = celui d''Atlas. Le lien y est obligatoire (refusDuMessage).';
