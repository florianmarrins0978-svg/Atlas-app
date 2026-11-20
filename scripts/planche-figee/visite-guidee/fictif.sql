-- Données toutes inventées (sa consigne du 20 novembre) : numéros de la tranche de fiction de l'ARCEP, domaine réservé example.com.
update clients set telephone = case nom when 'M. Bernard' then '06 39 98 00 11' when 'Mme Costa' then '06 39 98 00 22' when 'M. Faucher' then '06 39 98 00 33' when 'Mme Aubry' then '06 39 98 00 44' else telephone end;
update entreprises set telephone='02 61 91 00 00', email='contact@example.com';
-- Le jeu de démonstration écrit la civilité dans le nom (« Mme Costa ») : un devis
-- repris de la fiche l'imprimait deux fois, « Mme Mme Costa ». La civilité va à sa place.
update clients set civilite = case when nom like 'Mme %' then 'mme' else 'mr' end, nom = regexp_replace(nom, '^(Mme|M\.) ', '') where nom ~ '^(Mme|M\.) ';
