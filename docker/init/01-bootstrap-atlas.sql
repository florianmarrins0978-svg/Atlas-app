-- Bootstrap PostgreSQL pour le développement local (Docker).
--
-- Calqué sur scripts/bootstrap-postgres-ci.sql : mêmes rôles, mêmes
-- restrictions. C'est délibéré — un environnement local qui tournerait sous
-- superutilisateur contournerait silencieusement RLS, et l'isolation entre
-- entreprises ne serait jamais réellement éprouvée pendant les essais.
--
-- Exécuté une seule fois, à la création du volume, par l'entrypoint de l'image
-- postgres. Pour le rejouer : docker compose down -v (efface les données).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_owner') THEN
    CREATE ROLE atlas_owner LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  ALTER ROLE atlas_owner NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  ALTER ROLE atlas_owner PASSWORD 'atlas_owner_dev_pw';

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  ALTER ROLE atlas_app NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  ALTER ROLE atlas_app PASSWORD 'atlas_app_dev_pw';
END $$;

-- atlas_owner devient propriétaire de la base : c'est ce qui lui donne le droit
-- de créer les tables du schéma public lors des migrations.
ALTER DATABASE atlas_dev OWNER TO atlas_owner;

GRANT CONNECT ON DATABASE atlas_dev TO atlas_owner;
GRANT CONNECT ON DATABASE atlas_dev TO atlas_app;
GRANT USAGE ON SCHEMA public TO atlas_owner;
GRANT USAGE ON SCHEMA public TO atlas_app;

-- Droits applicatifs sur les tables créées ensuite par atlas_owner. Jamais de
-- TRUNCATE ni de DDL pour atlas_app : même posture qu'en production.
ALTER DEFAULT PRIVILEGES FOR ROLE atlas_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO atlas_app;

ALTER DEFAULT PRIVILEGES FOR ROLE atlas_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO atlas_app;
