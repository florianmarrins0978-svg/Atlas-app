-- Bootstrap PostgreSQL CI pour GitHub Actions
-- Ce script est exécuté par le superutilisateur postgres du conteneur.
-- Il crée atlas_owner et atlas_app avec des attributs stricts, puis configure
-- les droits applicatifs nécessaires pour les tables créées par atlas_owner.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_owner') THEN
    CREATE ROLE atlas_owner LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  ALTER ROLE atlas_owner NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  ALTER ROLE atlas_owner PASSWORD 'atlas_owner_ci_pw';

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  ALTER ROLE atlas_app NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  ALTER ROLE atlas_app PASSWORD 'atlas_app_ci_pw';
END $$;

ALTER DATABASE atlas_test OWNER TO atlas_owner;

GRANT CONNECT ON DATABASE atlas_test TO atlas_owner;
GRANT CONNECT ON DATABASE atlas_test TO atlas_app;
GRANT USAGE ON SCHEMA public TO atlas_app;
GRANT USAGE ON SCHEMA public TO atlas_owner;

ALTER DEFAULT PRIVILEGES FOR ROLE atlas_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO atlas_app;

ALTER DEFAULT PRIVILEGES FOR ROLE atlas_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO atlas_app;
