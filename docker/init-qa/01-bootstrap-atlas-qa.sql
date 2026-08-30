-- Bootstrap PostgreSQL de l'établi de qualification.
--
-- Copie de `docker/init/01-bootstrap-atlas.sql`, à un mot près : la base
-- s'appelle `atlas_qa`. Le fichier d'origine écrit `atlas_dev` en dur dans son
-- `ALTER DATABASE`, et un `ALTER DATABASE atlas_dev` joué sur un cluster qui ne
-- porte que `atlas_qa` échoue à l'init — le conteneur démarre alors avec une
-- base dont `atlas_owner` n'est PAS propriétaire, et les migrations meurent sur
-- un « permission denied for schema public » qui envoie chercher au mauvais
-- endroit (`CLAUDE.md` §5).
--
-- Les mots de passe diffèrent de ceux du développement (`_qa_pw`), pour qu'une
-- adresse recopiée d'un terminal à l'autre ne puisse pas s'ouvrir sur l'autre
-- environnement.
--
-- Exécuté une seule fois, à la création du volume. Pour le rejouer :
--   docker compose -f docker-compose.qa.yml down -v

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_owner') THEN
    CREATE ROLE atlas_owner LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  ALTER ROLE atlas_owner NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  ALTER ROLE atlas_owner PASSWORD 'atlas_owner_qa_pw';

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  ALTER ROLE atlas_app NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  ALTER ROLE atlas_app PASSWORD 'atlas_app_qa_pw';
END $$;

-- atlas_owner devient propriétaire de la base : c'est ce qui lui donne le droit
-- de créer les tables du schéma public lors des migrations.
ALTER DATABASE atlas_qa OWNER TO atlas_owner;

GRANT CONNECT ON DATABASE atlas_qa TO atlas_owner;
GRANT CONNECT ON DATABASE atlas_qa TO atlas_app;
GRANT USAGE ON SCHEMA public TO atlas_owner;
GRANT USAGE ON SCHEMA public TO atlas_app;

-- Droits applicatifs sur les tables créées ensuite par atlas_owner. Jamais de
-- TRUNCATE ni de DDL pour atlas_app : même posture qu'en production.
ALTER DEFAULT PRIVILEGES FOR ROLE atlas_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO atlas_app;

ALTER DEFAULT PRIVILEGES FOR ROLE atlas_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO atlas_app;
