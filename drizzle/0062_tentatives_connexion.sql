-- LE COMPTEUR D'ÉCHECS DE CONNEXION — et pourquoi il vit EN BASE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Ce qu'il répare.** L'audit du 23 août 2026 (constat C1) : rien n'empêchait
-- réellement de deviner un mot de passe. Trois défauts se composaient —
--
--   1. le seuil « par visiteur » se calait sur `x-forwarded-for`, un en-tête que
--      celui qui frappe écrit lui-même : il suffisait de le changer à chaque
--      essai pour repartir d'un compteur neuf ;
--   2. le garde-fou de second rang laissait passer 300 essais par quart d'heure
--      et par compte, soit 28 800 par jour, indéfiniment ;
--   3. **et tout cela s'effaçait dès que Redis tombait** : `verifierLimite`
--      laisse passer quand son magasin ne répond pas (décision du 12 août, prise
--      pour ne pas enfermer le patron dehors — et elle reste juste ailleurs).
--
-- Le troisième point commande les deux autres : une protection qui vit
-- uniquement dans Redis n'existe pas les jours où Redis n'existe pas. D'où
-- cette table. **Le compteur par compte ne dépend plus d'aucun service annexe :**
-- il est là tant que la base est là, c'est-à-dire tant que l'application sert.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Pourquoi une EMPREINTE et pas l'adresse e-mail.**
--
-- Un attaquant peut faire naître une ligne ici en tapant n'importe quelle
-- adresse. Écrire l'adresse en clair, ce serait donc laisser constituer, dans
-- une table qu'aucune politique d'isolation ne couvre, une liste d'adresses
-- qu'on n'a jamais choisi de garder. L'empreinte SHA-256 suffit au comptage —
-- on ne cherche jamais « qui », seulement « combien de fois cette même saisie ».
--
-- Conséquence assumée : cette table ne se lit pas à l'œil nu pour du
-- diagnostic. Le journal, lui, nomme l'adresse (`login/actions.ts`).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Pourquoi PAS de politique d'isolation par entreprise.**
--
-- Comme `users`, cette table précède l'entreprise : au moment où l'on compte un
-- échec, on ne sait pas encore qui est en face — c'est justement la question.
-- Il n'y a donc aucun `entreprise_id` à poser, et prétendre le contraire
-- ferait croire à un cloisonnement qui n'existe pas ici (`CLAUDE.md` §4).
-- Ce qui la protège : elle n'est lue et écrite que par une seule fonction, et
-- toujours par empreinte exacte — jamais parcourue.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Ce que la temporisation NE fait pas : bloquer un compte pour de bon.**
--
-- Le blocage est plafonné (quinze minutes) et s'oublie de lui-même au bout
-- d'une heure sans nouvel échec. Sans ce plafond, il suffirait de taper trois
-- fois à côté sur l'adresse d'un artisan pour l'empêcher d'entrer chez lui : on
-- aurait remplacé une porte trop faible par une porte murée, et c'est le
-- propriétaire qui paierait.

CREATE TABLE IF NOT EXISTS "tentatives_connexion" (
  -- SHA-256 de l'adresse normalisée (minuscules, sans espaces autour), en
  -- hexadécimal : 64 caractères, longueur fixe, aucune donnée personnelle.
  "empreinte" text PRIMARY KEY,
  -- Échecs CONSÉCUTIFS. Une connexion réussie efface la ligne.
  "echecs" integer NOT NULL DEFAULT 0,
  "dernier_echec_at" timestamptz NOT NULL DEFAULT now(),
  -- Jusqu'à quand la saisie est refusée d'avance. NULL tant qu'on est sous le
  -- seuil : les premiers essais ne coûtent rien, ce sont ceux d'une personne
  -- qui cherche son mot de passe.
  "bloque_jusqua" timestamptz,
  CONSTRAINT "tentatives_connexion_echecs_positifs" CHECK ("echecs" >= 0)
);

-- Pour le ménage : les lignes qu'aucun échec n'a touchées depuis longtemps ne
-- servent plus à rien, et rien ne doit laisser cette table grossir sans fin —
-- n'importe qui peut y faire naître une ligne en tapant une adresse au hasard.
CREATE INDEX IF NOT EXISTS "tentatives_connexion_dernier_echec_idx"
  ON "tentatives_connexion" ("dernier_echec_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON "tentatives_connexion" TO atlas_app;

COMMENT ON TABLE "tentatives_connexion" IS
  'Échecs de connexion consécutifs par empreinte d''adresse — la seule protection contre le bourrage qui survive à une panne de Redis (audit C1, 23 août 2026).';
