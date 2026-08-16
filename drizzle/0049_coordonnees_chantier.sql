-- Les coordonnées d'un chantier, pour savoir lequel est proche de lequel.
--
-- **Pourquoi elles n'existaient pas.** L'adresse d'un chantier est du texte
-- libre, et c'est délibéré : on ne va pas empêcher de créer un chantier faute
-- d'un numéro de rue. Mais « ce chantier est à dix kilomètres de l'autre » n'est
-- alors calculable par rien.
--
-- **Elles ne coûtent presque rien à obtenir** : la Base Adresse Nationale les
-- rend déjà à chaque frappe, dans la réponse que `lireSuggestions` lit — et qui
-- ne gardait que le libellé. Le reste partait à la poubelle.
--
-- **NULL est un état normal, pas une anomalie**, et il le restera : une adresse
-- tapée à la main hors de la liste, un lieu-dit sans numéro, un chantier créé
-- avant cette migration. L'appariement doit savoir le dire plutôt que se taire.
--
-- `numeric(9,6)` : six décimales valent une dizaine de centimètres, très
-- au-delà de ce qu'un trajet en camion demande. `double precision` aurait
-- introduit des écarts d'arrondi entre deux lectures de la même valeur.
ALTER TABLE chantiers
  ADD COLUMN latitude numeric(9, 6),
  ADD COLUMN longitude numeric(9, 6);

-- Ce qui a servi à les obtenir, pour ne pas les croire éternelles : le jour où
-- le patron corrige l'adresse, des coordonnées posées sur l'ancienne seraient
-- pires que pas de coordonnées du tout.
ALTER TABLE chantiers
  ADD COLUMN adresse_situee text;

COMMENT ON COLUMN chantiers.adresse_situee IS
  'L''adresse EXACTE qui a produit latitude/longitude. Si elle diffère de adresse_chantier, les coordonnées sont périmées et doivent être refaites.';
