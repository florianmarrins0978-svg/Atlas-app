-- CE QU'ON A DÉJÀ DIT AU CLIENT, POUR NE PAS LE REDIRE
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Tranché par lui le 8 septembre 2026**, maquette à l'appui
-- (`appli/changer-d-iban.html`) : *« oui je le veux »*.
--
-- Quand l'artisan change d'IBAN, les factures **déjà envoyées et non réglées**
-- gardent l'ancien : leur PDF est le fichier archivé que le client a dans son
-- téléphone, et il ne se réécrit pas. Atlas ne les corrige donc pas — il
-- propose de **prévenir**, avec un message tout écrit.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **POURQUOI UNE COLONNE, ET PAS SEULEMENT UNE LISTE CALCULÉE.**
--
-- La liste des factures à signaler se déduit très bien sans rien stocker :
-- celles qui attendent un règlement et dont l'IBAN figé diffère de l'actuel.
-- Mais elle ne saurait pas s'arrêter. L'artisan prévient ses trois clients, et
-- l'alerte les redemande le lendemain, et le surlendemain — jusqu'au paiement.
--
-- C'est exactement l'avertissement qui parle à tort (`CLAUDE.md` §4 ter) : il
-- s'apprend à être ignoré, et le jour où il a raison, on ne le lit plus. La
-- maquette qu'il a validée promet d'ailleurs le contraire — *« l'alerte reste
-- tant que vous n'avez pas prévenu »* —, et une promesse d'écran se tient.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **ON RANGE L'IBAN ANNONCÉ, PAS UNE DATE NI UN OUI/NON.**
--
-- Un drapeau « prévenu » serait faux au deuxième changement de banque : il
-- resterait levé, et le client ne serait jamais averti du second compte. Une
-- date poserait la même question sans y répondre — prévenu, oui, mais de quoi ?
--
-- En rangeant **l'IBAN dont on l'a prévenu**, la question se referme d'elle-même
-- à chaque fois : si ce n'est pas celui d'aujourd'hui, il reste à prévenir. Rien
-- à remettre à zéro, aucun cas particulier à écrire.
--
-- Rangé **nu** — sans espace, en majuscules (`ibanSansEspace`) : « FR76 3000 »
-- et « fr763000 » sont le même compte, et les comparer tels quels ferait
-- prévenir tout le monde pour une espace de saisie.
--
-- **NULL = jamais signalée**, ce qui est le cas de toutes les factures
-- existantes : elles n'ont donc rien perdu, et l'alerte les prendra normalement
-- si leur IBAN a changé.

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS iban_signale text;

COMMENT ON COLUMN factures.iban_signale IS
  'L''IBAN (nu) dont le client a été prévenu pour CETTE facture (migration 0078). NULL = jamais signalée. Différent de l''IBAN actuel = il reste à prévenir.';

-- Aucun GRANT à poser : `factures` porte déjà SELECT/INSERT/UPDATE pour
-- atlas_app au niveau de la table (migration 0018), et non colonne par colonne.
