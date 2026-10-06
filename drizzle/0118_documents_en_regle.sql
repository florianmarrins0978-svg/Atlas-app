-- LE DEVIS ET LA FACTURE EN RÈGLE — ses choix du 3 octobre 2026
-- (`appli/documents-en-regle-a-choisir.html`, `docs/lot-mentions-facture-devis.md`).
--
-- Expand seul. Aucune ligne existante n'est réécrite, aucune contrainte n'est
-- posée sur des données déjà là : l'ancien code ignore ces colonnes, et une
-- base habitée ne peut rien y refuser (.claude/rules/migrations.md,
-- .claude/rules/deployment-safety.md).
--
-- 1. `devis.entreprise_regime_tva` : le régime figé sur le devis, comme sur la
--    facture (0039). Le devis d'un compte en franchise partait sans
--    « TVA non applicable, art. 293 B du CGI » ; il la lit désormais sur ce
--    qu'il a figé. NUL sur les devis d'avant : `sousFranchise` se rabat sur le
--    taux, ce que faisait déjà la facture.
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_regime_tva" text;

-- 2. `factures.date_travaux` : la date de la prestation, mention obligatoire
--    quand elle diffère de la date de la facture (CGI, ann. II, 242 nonies A).
--    Choix 6A : Atlas la remplit d'après le planning, il peut la changer.
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "date_travaux" date;

-- 3. L'autoliquidation de la sous-traitance du bâtiment (CGI, 283-2 nonies) :
--    la facture part sans TVA, avec la mention, et le numéro de TVA du donneur
--    d'ordre (242 nonies A, I-4°). Le défaut `false` est la facture de tous
--    les jours : une ligne insérée par l'ancien code reste ce qu'elle était.
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "autoliquidation" boolean NOT NULL DEFAULT false;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "client_numero_tva" text;
--    Les taux d'avant la bascule, pour les rendre tels quels quand il
--    l'enlève : une ligne à 10 % redevient à 10 %, pas au taux du document.
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "taux_avant_autoliquidation" jsonb;

-- 4. `clients.numero_tva` : choix 5B, le numéro de l'entreprise cliente est
--    retenu sur sa fiche, et reste modifiable sur chaque facture.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "numero_tva" text;
