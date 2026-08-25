-- ─────────────────────────────────────────────────────────────────────────────
-- LE CONDENSAT DU MOT DE PASSE SORT DE PORTÉE DU RÔLE APPLICATIF — constat M9.
--
-- **LA PROPRIÉTÉ TENUE, et c'est la seule qui compte :**
--
--   > Une erreur future dans une requête métier ne suffit plus à exposer les
--   > condensats de tous les utilisateurs. `atlas_app` ne peut plus les lire,
--   > même en SQL direct — mais il peut toujours demander à la base de vérifier
--   > UN mot de passe, sans jamais en recevoir le condensat.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **POURQUOI PAS UNE RLS PAR ENTREPRISE SUR `users`.** Un utilisateur n'est
-- rattaché à une entreprise qu'APRÈS s'être identifié : la connexion se fait
-- sans le moindre contexte. Une politique par `entreprise_id` rendrait donc la
-- connexion impossible. Ce n'est pas le bon outil pour cette table.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE CE FICHIER, et qui a failli le tuer.**
--
-- `pgcrypto` ne relit que les condensats préfixés `$2a$`. `bcryptjs`, lui, écrit
-- `$2b$` : la première version de cette fonction rendait donc **faux sur le bon
-- mot de passe**, ce qui aurait fermé la porte à tout le monde.
--
-- Les deux préfixes désignent le même algorithme ; `$2b$` corrige un défaut de
-- l'original sur les mots de passe très longs. Restait à savoir si les deux
-- moteurs se comportent pareil, **puisqu'Atlas n'impose aucune longueur
-- maximale**. Mesuré des deux côtés, au positif ET au négatif :
--
-- | Cas | pgcrypto (`$2a$`) | bcryptjs (`$2b$`) |
-- |---|---|---|
-- | court, accents, emoji | accepte le bon, refuse le mauvais | identique |
-- | 255, 256, 300 octets | accepte le bon, **accepte aussi un mauvais** | **identique** |
--
-- La seconde ligne n'est pas une faiblesse de `pgcrypto` : **bcrypt tronque à
-- 72 octets**, et `bcryptjs` fait exactement la même chose aujourd'hui. Les deux
-- moteurs sont équivalents ; ce fichier ne change donc rien à ce qui est accepté.
--
-- *(Cette troncature est une faiblesse ancienne d'Atlas — au-delà de 72 octets,
-- une phrase de passe n'apporte plus rien. Elle est notée dans `TODO.md` ; la
-- corriger changerait l'algorithme, donc invaliderait tous les mots de passe.)*
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUI VERROUILLE LES FONCTIONS, point par point.**
--
-- | Exigence | Comment elle est tenue |
-- |---|---|
-- | propriétaire | `atlas_owner` — les migrations tournent sous lui, et c'est lui qui possède `users` |
-- | `EXECUTE` | `REVOKE ALL … FROM PUBLIC` **d'abord** : PostgreSQL accorde `EXECUTE` à `PUBLIC` par défaut sur toute fonction neuve |
-- | `search_path` | épinglé (`pg_catalog, public`), donc insensible à celui de l'appelant |
-- | qualifications | tout est qualifié : `public.users`, `public.crypt` |
-- | entrées/sorties | on donne un mot de passe, on reçoit un identifiant ou un booléen. **Aucune signature ne rend un condensat** |
-- | objets de confiance | `atlas_app` n'a **aucun** droit de créer dans `public` (vérifié : `has_schema_privilege` = faux). Il ne peut donc ni remplacer `public.crypt`, ni masquer `public.users` |

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. Vérifier un mot de passe à la CONNEXION ──────────────────────────────
--
-- Rend l'identifiant, jamais autre chose. `STABLE` et non `IMMUTABLE` : elle lit
-- une table.
CREATE OR REPLACE FUNCTION public.verifier_mot_de_passe(p_email text, p_mot_de_passe text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
  SELECT u.id
    FROM public.users u
   WHERE u.email = p_email
     -- Un compte sans mot de passe (créé pour un futur fournisseur externe) n'a
     -- rien à vérifier. Le `LIKE` écarte aussi tout condensat qui ne serait pas
     -- du bcrypt : `crypt` lèverait une erreur au lieu de refuser.
     AND u.password_hash LIKE '$2%'
     AND public.crypt(p_mot_de_passe, overlay(u.password_hash placing '2a' from 2 for 2))
       = overlay(u.password_hash placing '2a' from 2 for 2)
   LIMIT 1
$fn$;

-- ─── 2. Vérifier le mot de passe d'un utilisateur CONNU ──────────────────────
--
-- Sert au changement de mot de passe, qui doit pouvoir refuser « votre mot de
-- passe actuel n'est pas celui-là » AVANT de juger le nouveau.
CREATE OR REPLACE FUNCTION public.verifier_mot_de_passe_de(p_utilisateur uuid, p_mot_de_passe text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = p_utilisateur
       AND u.password_hash LIKE '$2%'
       AND public.crypt(p_mot_de_passe, overlay(u.password_hash placing '2a' from 2 for 2))
         = overlay(u.password_hash placing '2a' from 2 for 2)
  )
$fn$;

-- ─── 3. Écrire un nouveau condensat ──────────────────────────────────────────
--
-- **L'ANCIEN MOT DE PASSE EST REDEMANDÉ ICI, et ce n'est pas une redite.** Sans
-- lui, cette fonction serait une porte : qui peut l'appeler pourrait poser le
-- condensat de son choix sur le compte de son choix, puis entrer. Le coût est
-- une vérification bcrypt de plus, sur un geste qu'on fait deux fois par an.
--
-- Le condensat est calculé par l'application (`bcryptjs`, coût 10) et non ici :
-- deux façons d'engendrer un condensat finiraient par diverger, et c'est
-- l'application qui porte déjà la règle du coût.
CREATE OR REPLACE FUNCTION public.changer_mot_de_passe(
  p_utilisateur uuid,
  p_ancien text,
  p_nouveau_condensat text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
BEGIN
  IF NOT public.verifier_mot_de_passe_de(p_utilisateur, p_ancien) THEN
    RETURN false;
  END IF;
  -- Le condensat reçu doit ressembler à du bcrypt : sans ce contrôle, un appel
  -- détourné pourrait poser une chaîne vide, et `verifier_mot_de_passe` la
  -- rejetterait alors pour toujours — un compte muré, sans message.
  IF p_nouveau_condensat IS NULL OR p_nouveau_condensat NOT LIKE '$2%' OR length(p_nouveau_condensat) < 55 THEN
    RAISE EXCEPTION 'condensat invalide';
  END IF;
  UPDATE public.users
     SET password_hash = p_nouveau_condensat,
         updated_at = now()
   WHERE id = p_utilisateur;
  RETURN true;
END
$fn$;

-- ─── 4. Qui a le droit d'appeler ─────────────────────────────────────────────
--
-- `REVOKE … FROM PUBLIC` d'abord : sans lui, tout rôle de la base pourrait
-- appeler ces fonctions, y compris ceux qu'on ajouterait demain.
REVOKE ALL ON FUNCTION public.verifier_mot_de_passe(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verifier_mot_de_passe_de(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.changer_mot_de_passe(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verifier_mot_de_passe(text, text) TO atlas_app;
GRANT EXECUTE ON FUNCTION public.verifier_mot_de_passe_de(uuid, text) TO atlas_app;
GRANT EXECUTE ON FUNCTION public.changer_mot_de_passe(uuid, text, text) TO atlas_app;

-- ─── 5. RETIRER LE CONDENSAT À `atlas_app` ───────────────────────────────────
--
-- **Un `REVOKE` de colonne ne suffirait pas, et c'est le piège de cette
-- migration.** `atlas_app` détient `SELECT` au niveau de la TABLE ; en
-- PostgreSQL, un retrait de colonne ne se soustrait pas d'un droit de table. Il
-- faut donc retirer le droit de table, puis le rendre colonne par colonne.
--
-- **`UPDATE` compte autant que `SELECT`.** Sans son retrait, une injection
-- pourrait poser un condensat connu sur un compte et entrer avec — sans jamais
-- avoir lu quoi que ce soit.
--
-- `INSERT` est borné pour la même raison : créer un utilisateur avec un
-- condensat choisi reviendrait au même.
REVOKE SELECT, INSERT, UPDATE ON public.users FROM atlas_app;

GRANT SELECT (id, email, nom, email_verified, image, jetons_valides_depuis, charte, created_at, updated_at)
  ON public.users TO atlas_app;
GRANT INSERT (id, email, nom, email_verified, image, jetons_valides_depuis, charte, created_at, updated_at)
  ON public.users TO atlas_app;
GRANT UPDATE (email, nom, email_verified, image, jetons_valides_depuis, charte, updated_at)
  ON public.users TO atlas_app;
