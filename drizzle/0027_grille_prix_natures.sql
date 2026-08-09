-- Une grille par nature de travail, et non plus une seule pour la fente.
--
-- **Décidé avec le patron le 8 août 2026**, en réponse à deux questions posées
-- la veille au soir :
--
--   - *« La taille de haie doit-elle avoir sa propre ligne ? »* → **oui, avec
--     une grille au mètre linéaire**, comme la fente ;
--   - *« L'abattage mérite-t-il la même grille ? »* → **oui, technique ×
--     diamètre**.
--
-- La table de la migration 0026 ne connaissait que le fendage, jusque dans son
-- nom. Trois tables auraient imposé trois écrans, trois dépôts et trois façons
-- de se tromper ; une colonne suffit, et la mécanique reste unique — c'est elle
-- qui garantit qu'aucune case ne s'invente, quelle que soit la nature.
--
-- **Renommée plutôt que dupliquée.** `grille_fendage` porterait sinon un nom
-- menteur dès aujourd'hui, et c'est exactement ce que `CLAUDE.md` §1 reproche à
-- une documentation périmée : on s'y fie encore. PostgreSQL fait suivre les
-- contraintes, les index et la politique d'isolation ; on ne renomme ici que ce
-- qui resterait faux à la lecture.

ALTER TABLE "grille_fendage" RENAME TO "grille_prix";

ALTER INDEX "grille_fendage_cellule_uk" RENAME TO "grille_prix_cellule_uk";
ALTER TABLE "grille_prix" RENAME CONSTRAINT "grille_fendage_positif" TO "grille_prix_positif";
ALTER POLICY "grille_fendage_isolation" ON "grille_prix" RENAME TO "grille_prix_isolation";

-- La nature du travail que cette case chiffre.
--
-- `fendage` par défaut : les cases déjà posées le sont toutes, et leur en
-- attribuer une autre reviendrait à déplacer un prix que le patron a décidé.
--
-- Chaque nature a ses propres axes, définis dans `src/lib/grille-prix.ts` —
-- fonctions pures, discutables sans lire une requête :
--
--   fendage  : hauteur × diamètre     (48 cases)
--   abattage : technique × diamètre   (24 cases)
--   haie     : une seule case, au ml  (1 case)
ALTER TABLE "grille_prix"
  ADD COLUMN "nature" text NOT NULL DEFAULT 'fendage'
    CHECK ("nature" IN ('fendage', 'abattage', 'haie'));

-- L'unicité porte désormais sur la NATURE aussi : `d40` peut exister pour deux
-- natures sans que l'une écrase l'autre. Sans ce changement, poser un prix
-- d'abattage effacerait silencieusement un prix de fendage de même clé.
ALTER TABLE "grille_prix" DROP CONSTRAINT "grille_prix_cellule_uk";
ALTER TABLE "grille_prix"
  ADD CONSTRAINT "grille_prix_cellule_uk" UNIQUE ("entreprise_id", "nature", "cellule");
