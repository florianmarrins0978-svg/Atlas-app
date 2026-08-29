-- UNE PREUVE NE PEUT NAÎTRE QUE D'UN MOT DE PASSE JUSTE — et c'est le MOTEUR
-- qui le tient, plus seulement la discipline du code.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUI A ÉTÉ MESURÉ, ET QUI A FAIT ÉCRIRE CE FICHIER (25 août 2026).**
--
-- La migration 0065 accordait `INSERT, UPDATE` à `atlas_app`. Sous ce rôle, en
-- SQL direct, on obtenait ceci :
--
--     INSERT INTO preuves_authentification (utilisateur_id, session_id, methode)
--     SELECT id, 'session-forgee', 'cle-appareil' FROM users LIMIT 1;
--     → INSERT 0 1
--
--     UPDATE preuves_authentification SET prouve_le = now();
--     → toutes les preuves rajeunies
--
-- Autrement dit, la propriété annoncée — *« seule une authentification réelle
-- peut créer une preuve »* — **ne tenait que par l'absence d'injection SQL**.
-- C'est exactement la faiblesse que M9 a refermée pour les condensats, et il n'y
-- avait aucune raison de l'accepter ici.
--
-- Pire : `methode` pouvait être écrite à `'cle-appareil'` alors qu'aucune
-- vérification WebAuthn n'existe encore. Un journal qui ment est pire qu'un
-- journal absent.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUI CHANGE, ET RIEN DE PLUS.**
--
-- | `INSERT`, `UPDATE` | **retirés** à `atlas_app` |
-- | `SELECT` | gardé — la garde doit lire. Savoir que quelqu'un s'est prouvé n'accorde rien |
-- | `DELETE` | gardé — effacer une preuve ne fait que RETIRER des droits |
--
-- Une preuve ne s'écrit donc plus que par la fonction ci-dessous, qui vérifie le
-- mot de passe **avant** d'écrire, dans la même instruction.
--
-- **`methode` est écrite par la fonction, jamais reçue.** Tant qu'aucun chemin
-- WebAuthn n'existe, aucune preuve ne peut prétendre en venir.

CREATE OR REPLACE FUNCTION public.poser_preuve_par_mot_de_passe(
  p_utilisateur uuid,
  p_session text,
  p_mot_de_passe text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
BEGIN
  -- **Le mot de passe d'abord.** La vérification passe par la fonction de M9,
  -- qui ne rend jamais le condensat.
  IF NOT public.verifier_mot_de_passe_de(p_utilisateur, p_mot_de_passe) THEN
    RETURN false;
  END IF;

  -- Une session vide n'est pas une session : sans identité, une preuve
  -- appartiendrait à tout le monde.
  IF p_session IS NULL OR btrim(p_session) = '' THEN
    RAISE EXCEPTION 'session absente';
  END IF;

  INSERT INTO public.preuves_authentification (utilisateur_id, session_id, prouve_le, methode)
  VALUES (p_utilisateur, p_session, now(), 'mot-de-passe')
  ON CONFLICT (utilisateur_id, session_id)
  DO UPDATE SET prouve_le = now(), methode = 'mot-de-passe';

  RETURN true;
END
$fn$;

-- `PUBLIC` reçoit `EXECUTE` par défaut sur toute fonction neuve : on le retire
-- AVANT d'accorder, sans quoi tout rôle de la base pourrait éprouver des mots de
-- passe par ce chemin.
REVOKE ALL ON FUNCTION public.poser_preuve_par_mot_de_passe(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poser_preuve_par_mot_de_passe(uuid, text, text) TO atlas_app;

REVOKE INSERT, UPDATE ON public.preuves_authentification FROM atlas_app;
