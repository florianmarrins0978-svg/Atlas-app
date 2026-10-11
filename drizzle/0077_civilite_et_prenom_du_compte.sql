-- LE COMPTE A UNE CIVILITÉ ET UN PRÉNOM
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Sa demande du 8 septembre 2026**, en regardant la planche de la porte et
-- une capture de Qonto : *« et l'identité comme sur la photo avec Mr. Madame
-- nom prénom ? (également une info à rajouter dans les réglages également) »*
-- — puis, devant le coût annoncé de trois colonnes neuves : *« oui fais-le »*.
--
-- Il avait raison de le pressentir : `users` ne portait **qu'un seul champ**,
-- `nom`, et aucune civilité. La civilité existait déjà dans le produit, mais
-- seulement sur les CLIENTS de l'artisan (migration 0038) — jamais sur
-- l'artisan lui-même.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUE `nom` DEVIENT, ET POURQUOI ON NE TOUCHE PAS AUX LIGNES EXISTANTES.**
--
-- `nom` devient le NOM DE FAMILLE, et `prenom` s'ajoute à côté. Les comptes
-- déjà créés portent dans `nom` un nom complet — « Anne Amiot » — parce que
-- c'était la seule case disponible.
--
-- **On ne les découpe pas**, et c'est délibéré : « Jean-Pierre de La Fontaine »
-- ne se coupe pas en deux par un espace, et un découpage automatique
-- fabriquerait des prénoms faux sur des comptes qui fonctionnent. Une ligne
-- ancienne garde donc son nom complet dans `nom`, `prenom` reste NULL, et
-- l'affichage retombe exactement sur ce qu'il montrait hier
-- (`src/lib/identite-personne.ts`). Celui qui veut séparer les deux le fera
-- lui-même dans « Mon compte », en dix secondes et en connaissance de cause.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **LE PIÈGE DE CETTE TABLE, ET IL AURAIT COÛTÉ UNE SOIRÉE.**
--
-- `users` est la seule table du dépôt dont les droits sont accordés **colonne
-- par colonne** : la migration 0064 a retiré `SELECT` et `UPDATE` au rôle
-- applicatif pour l'empêcher de lire `password_hash`, puis les a rendus
-- colonne par colonne.
--
-- Conséquence : **une colonne neuve n'est PAS lisible par `atlas_app`**, même
-- si la table lui est ouverte. Sans les deux `GRANT` ci-dessous, la lecture du
-- compte échouerait sur un « permission denied for table users » qui désigne
-- la TABLE — donc au mauvais endroit — et l'on chercherait du côté de la RLS,
-- qui n'a rien à voir.
--
-- C'est écrit ici parce que la prochaine colonne de `users` tombera dans le
-- même piège.

ALTER TABLE users ADD COLUMN IF NOT EXISTS civilite text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom text;

-- Le même couple de valeurs que les clients (migration 0038), et la même
-- raison de le contraindre en base : `src/lib/civilite.ts` est la seule à
-- décider ce qu'elles valent à l'écran, et un troisième code y entrerait sans
-- que personne ne sache l'afficher.
--
-- **Un `CHECK` plutôt qu'un type énuméré** : élargir un `CHECK` est une
-- migration d'une ligne, changer un type en est une autre affaire.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_civilite_connue;
ALTER TABLE users ADD  CONSTRAINT users_civilite_connue
  CHECK (civilite IS NULL OR civilite IN ('mr', 'mme'));

-- LES DROITS, COLONNE PAR COLONNE (voir plus haut).
GRANT SELECT (civilite, prenom) ON public.users TO atlas_app;
GRANT UPDATE (civilite, prenom) ON public.users TO atlas_app;

COMMENT ON COLUMN users.civilite IS
  'La civilité de la personne : ''mr'', ''mme'', ou NULL quand elle ne l''a pas dite (migration 0077). Mêmes codes que clients.civilite.';

COMMENT ON COLUMN users.prenom IS
  'Le prénom, séparé du nom de famille (migration 0077). NULL sur les comptes antérieurs, dont le champ `nom` porte alors le nom complet — jamais découpé automatiquement.';

COMMENT ON COLUMN users.nom IS
  'Le nom de famille depuis la migration 0077. Sur les comptes antérieurs, il porte encore le nom complet : `prenom` est alors NULL et l''affichage retombe dessus.';
