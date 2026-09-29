-- Le modèle de fiche d'entretien, posé d'office sur les comptes d'avant.
--
-- **Sa demande du 29 septembre 2026** : *« mon modèle doit déjà être là par
-- défaut, et ils la modifieront s'ils le souhaitent »*. Un compte neuf le reçoit
-- à sa création (`creerEntreprise`). Cette migration le pose sur les comptes
-- qui existaient déjà et dont la fiche est VIDE, et sur eux seuls : une fiche
-- composée ne se touche pas. Ce qu'il y a retiré, il l'a retiré, et le bouton
-- « Remettre le modèle Atlas » le ramène s'il le veut (sa réponse « B »).
--
-- **Le modèle est recopié de `MODELE_FOURNI` (`src/lib/prestations-entretien.ts`)
-- tel qu'il est ce jour-là**, dans son ordre : une migration fige ce qu'elle
-- pose. `scripts/test-migration-0112-base-habitee.ts` compare les deux.
--
-- **FORCE ROW LEVEL SECURITY, encore** (`.claude/rules/migrations.md`) :
-- `atlas_owner` n'a pas BYPASSRLS, et sans contexte il ne voit aucune ligne de
-- `prestations_entretien`. Un « s'il n'y a rien » écrit sans contexte croirait
-- toutes les fiches vides, et la politique refuserait l'écriture. On boucle
-- donc sur les entreprises en posant le contexte de chacune, et l'on COMPTE ce
-- qui a été posé.

DO $$
DECLARE
  ent record;
  deja integer;
  posees integer;
  comptes integer := 0;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    SELECT count(*) INTO deja FROM prestations_entretien WHERE entreprise_id = ent.id;
    IF deja > 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO prestations_entretien (entreprise_id, famille, libelle, ordre)
    SELECT ent.id, m.famille, m.libelle, m.ordre
    FROM (VALUES
      ('Pelouse', 'Tonte et ébarbage', 10),
      ('Pelouse', 'Traitement pelouse', 20),
      ('Pelouse', 'Scarification', 30),
      ('Pelouse', 'Engrais', 40),
      ('Tailles', 'Taille arbuste automne', 50),
      ('Tailles', 'Taille arbuste printemps', 60),
      ('Tailles', 'Taille de haie automne', 70),
      ('Tailles', 'Taille de haie printemps', 80),
      ('Tailles', 'Taille des rosiers', 90),
      ('Massifs', 'Bêchage', 100),
      ('Massifs', 'Bordures massifs', 110),
      ('Massifs', 'Griffage massifs', 120),
      ('Massifs', 'Désherbage massifs', 130),
      ('Massifs', 'Coupe des fleurs fanées', 140),
      ('Propreté', 'Nettoyage pied de haies', 150),
      ('Propreté', 'Désherbant allée', 160),
      ('Propreté', 'Lierre, liseron, liane', 170),
      ('Propreté', 'Démoussage voirie', 180),
      ('Propreté', 'Ramassage des feuilles', 190),
      ('Propreté', 'Évacuation des déchets', 200)
    ) AS m(famille, libelle, ordre);

    GET DIAGNOSTICS posees = ROW_COUNT;
    total := total + posees;
    comptes := comptes + 1;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Modèle de fiche posé sur % compte(s), % ligne(s)', comptes, total;
END $$;
