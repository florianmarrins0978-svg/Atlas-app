-- L'EXEMPLAIRE ACQUITTÉ D'UNE FACTURE DÉJÀ PARTIE — sa demande du 23 octobre
-- 2026 (`appli/facture-acquittee.html`) : l'assurance du client veut la même
-- facture, même numéro, avec la mention acquittée.
--
-- La facture émise ne bouge pas (trigger d'immuabilité, et la loi) : son PDF
-- archivé reste celui du premier envoi. L'exemplaire acquitté est un SECOND
-- fichier, rangé sur le lien qui le transmet. Un lien sans ce fichier sert la
-- facture d'origine, comme avant.
--
-- Expand seul : trois colonnes nulles, que l'ancien code ignore. Aucune ligne
-- existante n'est réécrite, la FORCE RLS de la table n'a rien à voir passer
-- (.claude/rules/migrations.md, .claude/rules/deployment-safety.md).
ALTER TABLE envois_factures ADD COLUMN IF NOT EXISTS pdf_storage_key text;
-- La date imprimée sur le tampon, « Acquittée le … » : la page du client la
-- montre à la place de l'échéance.
ALTER TABLE envois_factures ADD COLUMN IF NOT EXISTS acquittee_le date;
-- Les règlements que l'exemplaire imprime. Un même lien ne resert que si
-- rien n'a changé depuis ; sinon le fichier mentirait sur les montants versés.
ALTER TABLE envois_factures ADD COLUMN IF NOT EXISTS empreinte_reglements text;
