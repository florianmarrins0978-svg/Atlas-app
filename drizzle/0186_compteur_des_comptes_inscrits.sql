-- LE COMPTEUR DES NUMÉROS DES COMPTES NÉS PAR L'INSCRIPTION.
--
-- Sa question du 19 novembre 2026 : *« et les nouveaux comptes ne peuvent pas
-- faire de devis ???? »*, puis « corrige ça maintenant ». Un compte créé par la
-- porte d'inscription (`creerSonCompte`) n'avait pas de ligne dans
-- `entreprise_compteurs` : son premier devis tombait (« Cannot read properties
-- of undefined (reading 'numero') »), comme sa première facture et son premier
-- avoir, qui prennent leur numéro au même endroit. Le code pose désormais le
-- compteur à toute entreprise neuve (`poserLEntrepriseNeuve`) ; cette
-- migration le pose à celles qui sont nées sans.
--
-- **Commencer à 1 est juste pour elles** : sans compteur, aucune n'a jamais pu
-- numéroter un devis, une facture ou un avoir, et aucun réglage ne fixe un
-- numéro de départ. Les valeurs par défaut de la table (numéro 1, année en
-- cours) sont exactement celles qu'un compte neuf reçoit.
--
-- **FORCE RLS** (`.claude/rules/migrations.md`) : `entreprise_compteurs` est
-- sous RLS forcée et `atlas_owner` n'a pas BYPASSRLS. Sans contexte, le
-- NOT EXISTS ne verrait aucune ligne et l'INSERT serait refusé. On boucle donc
-- par entreprise en posant son contexte (modèle : 0037), et l'on COMPTE.
-- `entreprises` n'est pas sous RLS : la boucle les voit toutes.
--
-- Une entreprise qui a déjà son compteur n'est pas touchée (ON CONFLICT DO
-- NOTHING) : ses numéros continuent là où ils en sont.

DO $$
DECLARE
  ent record;
  poses integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    INSERT INTO entreprise_compteurs (entreprise_id)
    VALUES (ent.id)
    ON CONFLICT (entreprise_id) DO NOTHING;

    GET DIAGNOSTICS poses = ROW_COUNT;
    total := total + poses;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Entreprises qui reçoivent enfin leur compteur de numéros : %', total;
END $$;
