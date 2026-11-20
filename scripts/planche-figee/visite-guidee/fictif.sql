-- Données toutes inventées (sa consigne du 20 novembre) : numéros de la tranche de fiction de l'ARCEP, domaine réservé example.com.
update clients set telephone = case nom when 'M. Bernard' then '06 39 98 00 11' when 'Mme Costa' then '06 39 98 00 22' when 'M. Faucher' then '06 39 98 00 33' when 'Mme Aubry' then '06 39 98 00 44' else telephone end;
update entreprises set telephone='02 61 91 00 00', email='contact@example.com';
