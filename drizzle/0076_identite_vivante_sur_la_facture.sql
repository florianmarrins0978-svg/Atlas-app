-- L'IDENTITÉ QUE PORTE LA FACTURE VIENT DE L'ENTREPRISE, PLUS DU DEVIS
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Sa question du 8 septembre 2026, et elle a trouvé un vrai défaut :**
-- *« lorsque l'utilisateur modifie son IBAN dans ses réglages ou le nom de sa
-- société, les infos se modifient automatiquement dans le lien que recevra le
-- client ? »* — puis : *« ne fais pas de pansement de code, je veux que tu
-- corriges le problème à la racine. »*
--
-- La réponse était **non**, et la racine était plus haut que la page : une
-- facture recopiait l'identité **du devis** (`instantaneDuDevis`), figée le jour
-- où le devis avait été fait. Un devis de janvier facturé en juin partait donc
-- avec l'IBAN de janvier. Si l'artisan avait changé de banque entre-temps, son
-- client virait l'argent sur un compte fermé — sur une facture toute neuve.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUI CHANGE, ET POURQUOI CE N'EST PAS UN AFFAIBLISSEMENT DU FIGEAGE.**
--
-- Une facture reste figée : le PDF servi au client est le fichier ARCHIVÉ à
-- l'arrêt, jamais un document reconstruit (`factures/[jeton]/pdf/route.ts`), et
-- ce lot n'y touche pas. Ce qui change, c'est l'INSTANT du figeage :
--
--   · le CLIENT et les PRIX viennent du devis — c'est ce qui a été accepté ;
--   · l'ÉMETTEUR vient de l'entreprise, lu au moment où la facture est créée.
--
-- Une facture n'est pas une copie du devis : c'est une pièce neuve, émise
-- aujourd'hui, qui doit porter l'identité d'aujourd'hui. Le régime de TVA
-- suivait déjà exactement cette règle depuis la migration 0039 — « lu sur
-- l'entreprise et non sur le devis » — et le délai de paiement aussi. Ce lot ne
-- fait que l'étendre à ce qui restait en arrière : le nom, l'adresse, le SIRET,
-- le téléphone, l'e-mail, l'IBAN et les trois mentions légales.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **LA COLONNE NEUVE : à qui le chèque est libellé.**
--
-- `entreprises.titulaire_compte` existe depuis longtemps, précisément parce
-- qu'un compte peut être ouvert à un autre nom que l'enseigne — le schéma le dit
-- déjà : « un IBAN à un nom différent de l'entreprise inquiète au lieu de
-- rassurer ». Il n'était figé nulle part. Sans lui, un chèque libellé à
-- l'enseigne quand le compte est au nom propre se fait refuser au guichet.
--
-- Il se fige comme le reste, au même instant, pour que la page du client et le
-- PDF archivé disent la même chose — deux pièces du même envoi qui se
-- contrediraient sur le nom à écrire coûteraient un chèque perdu.
--
-- **NULL veut dire « pas de titulaire distinct »**, et l'ordre du chèque retombe
-- alors sur le nom de l'entreprise. C'est la règle de `src/lib/modalites-paiement.ts`,
-- écrite une seule fois et appelée par la page comme par le PDF.
--
-- **Les factures antérieures ne sont pas rattrapées**, et c'est délibéré : leur
-- PDF est parti chez un client, avec ce qu'il portait ce jour-là. Le rattraper
-- ferait mentir la page sur ce que le client a en main.

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS entreprise_titulaire_compte text;

COMMENT ON COLUMN factures.entreprise_titulaire_compte IS
  'Le titulaire du compte, figé à la création de la facture (migration 0076). NULL = aucun titulaire distinct, l''ordre du chèque est le nom de l''entreprise.';

COMMENT ON COLUMN factures.entreprise_iban IS
  'L''IBAN figé à la création de la facture, lu sur l''ENTREPRISE (migration 0076) — plus recopié du devis, qui pouvait dater de plusieurs mois.';

-- Aucun GRANT à poser : `factures` porte déjà SELECT/INSERT/UPDATE pour
-- atlas_app au niveau de la table (migration 0018), et non colonne par colonne.
