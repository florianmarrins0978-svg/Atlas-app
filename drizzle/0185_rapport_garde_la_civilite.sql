-- LE RETOUR D'INTERVENTION GARDE LA CIVILITÉ DU CLIENT.
--
-- Sa demande du 19 novembre 2026, « il faut corriger ça » : Mme Lefèvre
-- recevait un retour d'intervention adressé à « Mr. Lefèvre ». À l'envoi, le
-- rapport figeait le nom du client (`client_nom`, migration 0055), jamais sa
-- civilité ; le PDF, qui ne la connaissait pas, retombait sur la civilité par
-- défaut (`avecCivilite`, « Mr. »).
--
-- La civilité se fige désormais avec le nom, au même instant
-- (`figerPassage`) : un rapport parti ne change plus, ni son nom ni la façon
-- de s'adresser au client.
--
-- **Les rapports déjà partis la reçoivent ici**, lue sur la fiche du client.
-- C'est la civilité que le PDF aurait dû porter ; laissée vide, elle
-- continuerait d'imprimer « Mr. » devant chaque cliente servie avant ce jour.
-- Un rapport dont le client a disparu, ou n'a pas de civilité, reste NULL :
-- rien ne s'invente (`docs/AGENT.md` §3).
--
-- **FORCE RLS** (`.claude/rules/migrations.md`) : `passages_entretien` et
-- `clients` sont sous RLS forcée, et `atlas_owner` n'a pas BYPASSRLS. Sans
-- contexte, l'UPDATE toucherait zéro ligne sans un mot. On boucle donc par
-- entreprise en posant son contexte (modèle : 0037), et l'on COMPTE.
--
-- Expand seul côté schéma : une colonne NULL. Le code d'avant l'ignore.

ALTER TABLE "passages_entretien" ADD COLUMN IF NOT EXISTS "client_civilite" text;

DO $$
DECLARE
  ent record;
  touches integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    UPDATE passages_entretien p
    SET client_civilite = c.civilite
    FROM clients c
    WHERE c.id = p.client_id
      AND p.envoye_le IS NOT NULL
      AND p.client_civilite IS NULL
      AND c.civilite IS NOT NULL;

    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Rapports partis qui reçoivent la civilité de leur client : %', total;
END $$;
