-- UN SIRET QUE LE REGISTRE N'A PAS CONFIRMÉ NE PART SUR AUCUNE PIÈCE — sa règle
-- du 23 novembre 2026 : *« il ne faut pas le bloquer ; il ne faut pas non plus
-- qu'il puisse créer des comptes gratuits à tire-larigot »*. Sa planche :
-- `appli/soignee/essai-par-entreprise.html` (« Inconnu », « Mon entreprise
-- vient d'être créée »).
--
-- Le compte se crée et l'essai démarre quoi que dise le registre ; seuls les
-- devis et les factures attendent sa confirmation (`manquesDeLEmetteur`,
-- `src/lib/mentions-manquantes.ts`). Une entreprise toute neuve attend un jour
-- ou deux que l'Insee la publie ; un numéro inventé n'envoie jamais rien.
--
-- **Vrai seulement pour un SIRET tapé APRÈS ce jour**, et c'est le sens du
-- défaut à `false` : aucune entreprise existante ne se voit arrêter ses devis
-- pour un registre qu'on ne lui avait jamais demandé. EXPAND SEUL : une colonne,
-- une valeur par défaut, aucune ligne réécrite ; l'ancien code l'ignore.
-- `entreprises` n'est pas sous RLS, et `atlas_app` y a déjà ses droits de
-- table (aucune liste de colonnes à compléter).
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS siret_a_confirmer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.entreprises.siret_a_confirmer IS
  'Vrai tant que le registre des entreprises n''a pas confirmé le SIRET tapé : aucun devis ni aucune facture ne part. Revérifié à chaque envoi.';
