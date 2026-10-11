-- LE CHEF D'ÉQUIPE, ET SES GARS.
--
-- Sa demande du 27 septembre 2026, planche
-- `appli/rappels-par-role-et-organigramme.html` : *« il faut pouvoir nommer un
-- chef d'équipe »*, puis *« un gars ne peut avoir qu'un seul chef »* et *« le
-- chef ne voit rien de plus »* : c'est un titre sur l'organigramme, pas un rôle.
--
-- **Pourquoi deux colonnes, et pas une.** Aucun groupe de personnes n'existait
-- (une « équipe » n'est qu'une capacité, `entreprises.nombre_equipes`, et les
-- gars sont les lignes d'`equipes`, migration 0067). `est_chef` dit qui porte
-- le titre ; `chef_id` dit sous qui est un gars. Déduire le titre de « a des
-- gars » ferait disparaître un chef le jour où son dernier gars change de chef.
--
-- **Le chef se cherche DANS LA MÊME ENTREPRISE, et la base le tient** : la clé
-- étrangère porte `entreprise_id`, comme celle des créneaux sur les chantiers.
-- Un identifiant venu d'une autre entreprise est refusé par PostgreSQL, pas
-- seulement par le code.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : deux colonnes, l'une
-- nullable, l'autre à défaut `false`, une contrainte d'unicité sur un couple
-- dont la clé primaire est déjà unique. Aucune ligne existante n'est réécrite,
-- aucun UPDATE sous FORCE RLS. L'ancien code les ignore.

ALTER TABLE "equipes"
  ADD CONSTRAINT "equipes_id_entreprise_uk" UNIQUE ("id", "entreprise_id");

ALTER TABLE "equipes" ADD COLUMN "est_chef" boolean NOT NULL DEFAULT false;
ALTER TABLE "equipes" ADD COLUMN "chef_id" uuid;

-- `SET NULL ("chef_id")` seul : l'entreprise d'un gars ne s'efface jamais avec
-- son chef.
ALTER TABLE "equipes"
  ADD CONSTRAINT "equipes_chef_fk"
  FOREIGN KEY ("chef_id", "entreprise_id")
  REFERENCES "equipes" ("id", "entreprise_id")
  ON DELETE SET NULL ("chef_id");

-- On n'est pas son propre chef.
ALTER TABLE "equipes"
  ADD CONSTRAINT "equipes_pas_son_propre_chef" CHECK ("chef_id" IS NULL OR "chef_id" <> "id");
