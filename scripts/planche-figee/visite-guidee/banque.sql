-- Appel : psql -v num=<numéro de la facture de M. Lefèvre> -f banque.sql
-- Une banque de démonstration, tout inventé : la liaison (lue à l'instant, donc aucun appel au prestataire) et un mois de lignes.
\set ent '(select id from entreprises limit 1)'
delete from virements_recus; delete from mouvements_bancaires; delete from liaisons_bancaires;
insert into liaisons_bancaires (entreprise_id, session_id, comptes, banque, accord_jusqu_au, lu_le, historique_jours)
values (:ent, 'demo-session', array['demo-compte'], 'Banque Démo', now() + interval '170 days', now(), 365);
insert into mouvements_bancaires (entreprise_id, cle, jour, montant, sens, contrepartie, libelle, justification, motif, relie_par, justifie_le) values
 (:ent,'m01','2026-11-02',450.00,'sortie','SCI Les Ateliers','PRLV SCI LES ATELIERS LOYER DEPOT','motif','loyer','patron',now()),
 (:ent,'m02','2026-11-04',186.00,'sortie','Pépinière des Saules','CB PEPINIERE DES SAULES',null,null,null,null),
 (:ent,'m03','2026-11-06',64.90,'sortie','Mutuelle Artisans Démo','PRLV ASSURANCE PRO',null,null,null,null),
 (:ent,'m04','2026-11-13',1116.00,'entree','Remise de chèque','REMISE CHEQUE 0004512',null,null,null,null),
 (:ent,'m05','2026-11-12',38.50,'sortie','Quincaillerie du Port','CB QUINCAILLERIE DU PORT',null,null,null,null),
 (:ent,'m06','2026-11-15',312.00,'sortie','URSSAF','PRLV URSSAF COTISATIONS','motif','impots','patron',now()),
 (:ent,'m07','2026-11-17',72.40,'sortie','Station du Rond-Point','CB STATION DU ROND POINT',null,null,null,null),
 (:ent,'m08','2026-11-20',924.00,'entree','M. Lefèvre','VIR M LEFEVRE ' || :'num',null,null,null,null);
insert into virements_recus (entreprise_id, cle, jour, montant, payeur, libelle, etat)
values (:ent, 'm08', '2026-11-20', 924.00, 'M. Lefèvre', 'VIR M LEFEVRE ' || :'num', 'nouveau');
