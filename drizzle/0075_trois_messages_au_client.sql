-- TROIS MESSAGES AU CLIENT — un par document, et non plus un seul pour trois.
--
-- Sa décision du 7 septembre 2026, en deux temps. D'abord : « en fait il faut
-- faire deux messages par défaut, un pour devis et un pour facture ». Puis,
-- une fois le TROISIÈME document retrouvé — le compte rendu de passage part
-- avec ce même modèle (`composerMessageEntretien`) — : « dans ce cas faut faire
-- 3 messages par défaut et garder le système un seul mot change ».
--
-- CE QUE ÇA CHANGE, ET POURQUOI ÇA NE POUVAIT PAS RESTER EN L'ÉTAT.
--
-- La migration 0062 posait « un seul message pour ses trois documents », et ce
-- qui les distinguait — le numéro, l'échéance, le fait qu'un devis se répond
-- quand une facture se règle — était écrit par Atlas à l'endroit du `[document]`.
-- Cette phrase-là ne lui appartenait donc pas : c'était le seul morceau de son
-- message qu'il ne pouvait pas toucher, et c'est exactement celui qu'il voulait
-- écrire.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LE PIÈGE DE CETTE MIGRATION, ET IL EST SÉRIEUX : `[document]` CHANGE DE SENS.
--
-- Avant : `[document]` = LA PHRASE ENTIÈRE (« Voici votre devis. Vous pouvez le
-- consulter et choisir votre date… »).
-- Après  : `[document]` = LE MOT SEUL (« devis », « facture », « compte rendu »).
--
-- Un message déjà enregistré porte donc un `[document]` au sens ancien. Rendu
-- avec le nouveau, il partirait chez le client réduit à un mot nu :
--
--     Bonjour Mme Larousse,
--
--     devis
--
--     https://…
--
-- D'où l'UPDATE ci-dessous, qui réécrit la phrase EN CLAIR dans son texte —
-- mot pour mot celle de `phraseDuDocument` d'avant ce lot, et qui devient dès
-- lors modifiable comme le reste. Sans lui, la migration serait silencieuse et
-- le défaut n'apparaîtrait qu'au premier devis envoyé, chez un client.
--
-- L'ANCIENNE VALEUR DEVIENT CELLE DU DEVIS. C'est ce qui a été dit au patron :
-- son texte n'est pas perdu. Les deux colonnes neuves partent nulles — donc sur
-- le message d'Atlas, comme toute entreprise qui n'a rien écrit.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS message_client_facture text,
  ADD COLUMN IF NOT EXISTS message_client_passage text;

-- La même borne que sur `message_client` (0062) : elle protège la base d'un
-- copier-coller, pendant que `MESSAGE_MAX` refuse avant d'enregistrer et dit
-- pourquoi.
ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_message_client_facture_borne;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_message_client_facture_borne
  CHECK (message_client_facture IS NULL OR length(message_client_facture) <= 2000);

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_message_client_passage_borne;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_message_client_passage_borne
  CHECK (message_client_passage IS NULL OR length(message_client_passage) <= 2000);

-- La phrase du devis, telle qu'elle partait avant ce lot. Elle est recopiée ici
-- et non calculée : une migration ne lit pas le code de l'application, et ce
-- texte doit rester celui du jour où elle tourne, quoi qu'il devienne ensuite.
UPDATE entreprises
SET message_client = replace(
  message_client,
  '[document]',
  'Voici votre [document]. Vous pouvez le consulter et choisir votre date d''intervention. Et si aucune des dates proposées ne vous convient, vous pouvez en proposer une autre. Tout se fait sur cette page :'
)
WHERE message_client IS NOT NULL
  AND position('[document]' in message_client) > 0;

COMMENT ON COLUMN entreprises.message_client IS
  'Le message qui part avec le DEVIS. Nul = celui d''Atlas. Depuis 0075, [document] n''y pose plus que le mot « devis » : la phrase, elle, est dans le texte et lui appartient.';
COMMENT ON COLUMN entreprises.message_client_facture IS
  'Le message qui part avec la FACTURE. Nul = celui d''Atlas. [numero] et [echeance] s''y remplissent seuls, et l''échéance emporte ses mots quand il n''y en a pas.';
COMMENT ON COLUMN entreprises.message_client_passage IS
  'Le message qui part avec le COMPTE RENDU de passage. Nul = celui d''Atlas.';
