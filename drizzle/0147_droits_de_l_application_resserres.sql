-- AUDIT DE SÉCURITÉ DU 25 OCTOBRE 2026, E9 : retirer à l'application les droits
-- qu'elle n'emploie pas.
--
-- `atlas_app`, le rôle que tous les artisans partagent, recevait par les
-- privilèges par défaut le DML complet sur toute table. Trois de ces droits ne
-- servent à aucun geste du produit, et chacun ouvrait un dégât :
--
--   · `_migrations` en écriture : une ligne insérée fait sauter une migration
--     de sécurité au prochain démarrage, sans erreur ;
--   · `documents_legaux` en écriture : les conditions générales de TOUS les
--     artisans réécrites d'un coup (elles ne s'écrivent que par migration) ;
--   · `entreprises` en suppression : une entreprise effacée en cascade sur
--     soixante-dix tables, que la RLS ne retient pas.
--
-- Il faudrait d'abord une injection SQL ou un geste mal filtré : c'est
-- précisément ce que ce retrait rend inoffensif.
--
-- **Aucune ligne n'est touchée** : seuls des droits changent, sans question de
-- RLS. La lecture reste (l'écran Réglages lit `_migrations`, tout le monde lit
-- ses documents). Rejouable : retirer un droit déjà absent ne lève rien.
REVOKE INSERT, UPDATE, DELETE ON "_migrations" FROM atlas_app;
REVOKE INSERT, UPDATE, DELETE ON "documents_legaux" FROM atlas_app;
REVOKE DELETE ON "entreprises" FROM atlas_app;
