-- LES DATES QU'IL A PROPOSÉES EN SACHANT QUE LE JOUR ÉTAIT PLEIN
--
-- Sa règle du 23 août 2026 : « si l'utilisateur juge qu'il peut rajouter un
-- chantier, il doit pouvoir le faire quand même ; nous on a mis un message
-- disant que c'est complet ».
--
-- Elle ne contredit pas celle du 22 août — « je peux proposer le 24 alors qu'un
-- client a validé le 24, ça ne doit JAMAIS se reproduire » —, mais les deux ne
-- tiennent ensemble qu'à une condition : savoir, au moment où le client répond,
-- si le patron avait DÉLIBÉRÉMENT forcé ce jour.
--
--   * il a forcé un jour plein, en le voyant écrit « complet » : son client peut
--     le prendre, c'est sa décision d'artisan ;
--   * il a proposé un jour LIBRE qui s'est rempli depuis : il n'a rien décidé du
--     tout, et le client doit choisir une autre date plutôt que de le mettre en
--     double sans que personne s'en aperçoive.
--
-- Sans cette colonne les deux cas sont indiscernables à la lecture du lien, et
-- l'on doit sacrifier l'une des deux règles.
ALTER TABLE envois_devis
  ADD COLUMN IF NOT EXISTS dates_forcees date[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN envois_devis.dates_forcees IS
  'Les dates proposées alors que la journée était déjà pleine — un choix assumé du patron, pas un oubli. Calculé au serveur à la création de l''envoi, jamais transmis par l''écran.';
