-- Le troisième rappel : un chantier ouvert dont AUCUN devis n'est parti.
--
-- Le patron, le 14 août 2026 : « il faudrait créer un rappel lorsque le chantier
-- a été ouvert mais le devis n'a pas été envoyé […] si aucun devis n'est parti
-- sous deux, trois, quatre, cinq, six jours, me mettre une notification —
-- comme la Mme Félicie, vue il y a quatorze jours, aucun devis envoyé ».
--
-- POURQUOI CE N'EST PAS COUVERT PAR « DEVIS SANS RÉPONSE » (0043). Celui-là
-- part d'un envoi (`envois_devis.envoye_at`) : il ne peut rien dire d'un devis
-- qui n'est jamais parti, puisqu'il n'existe aucune ligne d'envoi à interroger.
-- Le sien se lit sur le chantier lui-même — `created_at` et `devis_envoye_at`.
--
-- QUATRE JOURS, ET C'EST LUI QUI LES A CHOISIS le 16 août 2026, au milieu de
-- ses « deux à six ». Allumé d'origine, comme les deux autres : un rappel éteint
-- au départ n'est jamais découvert.
--
-- NULL VEUT DIRE « ÉTEINT », comme pour les deux autres colonnes — pas de
-- colonne « actif » à côté du nombre, deux champs pour une idée se contredisent.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS rappel_chantier_sans_devis_jours integer DEFAULT 4;

-- Les entreprises déjà créées n'ont pas de valeur : le DEFAULT ne s'applique
-- qu'aux lignes futures. Sans ce rattrapage, le rappel serait éteint pour tout
-- le monde sauf les nouveaux — et personne ne saurait pourquoi.
UPDATE entreprises SET rappel_chantier_sans_devis_jours = 4
  WHERE rappel_chantier_sans_devis_jours IS NULL;
