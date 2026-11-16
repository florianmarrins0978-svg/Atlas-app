-- La scène de la pub : la même entreprise d'exemple que le site de vente,
-- Les Jardins de Valmorin (commune inventée, numéros impossibles à attribuer).
--
-- Se joue sur une base d'essai tout juste amorcée (npm run db:seed), sous un
-- rôle qui traverse la RLS. Le chantier Lemaire, lui, n'est pas ici : il passe
-- par les vrais boutons, dans tourner.mjs.
BEGIN;

UPDATE entreprises SET
  nom = 'Les Jardins de Valmorin',
  siret = '841 207 395 00027',
  adresse = '4 chemin des Saules, Valmorin',
  telephone = '02 61 91 45 20',
  email = 'contact@jardins-valmorin.fr',
  numero_tva = 'FR31841207395',
  assureur_decennale = 'Val Assurances',
  adresse_assureur_decennale = '3 place du Marché, Valmorin',
  contrat_decennale = 'VA 2026 0418',
  mediateur_nom = 'Médiation des métiers du Val',
  mediateur_coordonnees = '8 rue du Lavoir, Valmorin';

-- Les chantiers de démonstration (salle de bain, toiture) sortent de l'écran.
-- Un devis déjà émis ne s'efface pas : on retire, on ne détruit pas.
UPDATE chantiers SET deleted_at = now() WHERE deleted_at IS NULL;
UPDATE clients SET deleted_at = now() WHERE deleted_at IS NULL;
UPDATE tarifs SET deleted_at = now() WHERE deleted_at IS NULL;

INSERT INTO tarifs (entreprise_id, intitule, prix, unite)
SELECT e.id, t.intitule, t.prix, t.unite
FROM entreprises e,
  (VALUES
    ('Arrachage de haie et évacuation', 18.00, 'ml'),
    ('Décompactage et amendement du sol', 8.50, 'm²'),
    ('Fourniture et plantation de vivaces', 9.50, 'u'),
    ('Paillage en écorce de pin', 6.00, 'm²')
  ) AS t(intitule, prix, unite);

-- Le mois de novembre 2026, déjà habité : un planning vide ne dit rien.
-- Le lundi 16 reste libre, c'est le jour que le client retiendra.
DO $$
DECLARE
  ent uuid;
  cli uuid;
  cha uuid;
  ligne record;
BEGIN
  SELECT id INTO ent FROM entreprises LIMIT 1;
  FOR ligne IN
    SELECT * FROM (VALUES
      ('mme', 'Roussel',  '0611223344', '3 rue du Verger, Valmorin',     DATE '2026-11-03', 'matin',      2),
      ('mr',  'Garnier',  '0622334455', '17 chemin du Lavoir, Valmorin', DATE '2026-11-05', 'matin',      1),
      ('mme', 'Fabre',    '0633445566', '5 impasse des Noyers, Valmorin', DATE '2026-11-09', 'matin',     2),
      ('mr',  'Colin',    '0644556677', '9 rue de la Forge, Valmorin',   DATE '2026-11-12', 'apres_midi', 1),
      ('mme', 'Marchand', '0655667788', '2 place du Marché, Valmorin',   DATE '2026-11-13', 'matin',      2),
      ('mr',  'Leroy',    '0666778899', '14 route du Lac, Valmorin',     DATE '2026-11-17', 'matin',      2),
      ('mme', 'Besson',   '0677889900', '6 allée des Tilleuls, Valmorin', DATE '2026-11-19', 'matin',     1),
      ('mr',  'Aubert',   '0688990011', '30 rue des Vignes, Valmorin',   DATE '2026-11-20', 'matin',      2),
      ('mme', 'Tessier',  '0699001122', '11 chemin des Prés, Valmorin',  DATE '2026-11-24', 'apres_midi', 1),
      ('mr',  'Hamel',    '0610121314', '8 rue du Moulin, Valmorin',     DATE '2026-11-26', 'matin',      2),
      ('mme', 'Picard',   '0615161718', '4 rue des Écoles, Valmorin',    DATE '2026-11-27', 'matin',      1)
    ) AS d(civilite, nom, telephone, adresse, jour, debut, demis)
  LOOP
    INSERT INTO clients (entreprise_id, nom, civilite, telephone, adresse, canal_communication)
      VALUES (ent, ligne.nom, ligne.civilite, ligne.telephone, ligne.adresse, 'sms')
      RETURNING id INTO cli;
    INSERT INTO chantiers (entreprise_id, client_id, nom, adresse_chantier, date_planifiee, creneau_debut, duree_demi_journees)
      VALUES (
        ent, cli,
        CASE ligne.civilite WHEN 'mme' THEN 'Mme ' ELSE 'Mr. ' END || ligne.nom,
        ligne.adresse, ligne.jour, ligne.debut, ligne.demis
      )
      RETURNING id INTO cha;
    INSERT INTO creneaux_chantier (entreprise_id, chantier_id, jour, demi)
      VALUES (ent, cha, ligne.jour, ligne.debut);
    IF ligne.demis = 2 THEN
      INSERT INTO creneaux_chantier (entreprise_id, chantier_id, jour, demi)
        VALUES (ent, cha, ligne.jour, 'apres_midi');
    END IF;
  END LOOP;
END $$;

COMMIT;
