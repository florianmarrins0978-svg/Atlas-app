-- MOT DE PASSE OUBLIÉ : le code par e-mail, puis le nouveau mot de passe.
--
-- Sa demande du 24 septembre 2026 : *« si un utilisateur a oublié son mot de
-- passe il ne pourra jamais le récupérer ou le changer ? Il faut mettre cette
-- fonction ! »* Son choix, le même jour, devant `appli/mot-de-passe-oublie.html` :
-- un CODE, comme à la création du compte, pas un lien.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **POURQUOI UNE TABLE À PART, ET PAS `codes_verification_email`.** Une ligne
-- dans cette dernière veut dire « compte en attente » : c'est sa présence qui
-- ferme la porte (0091). Y poser un code de réinitialisation enfermerait un
-- compte vérifié derrière `/verifier-email`. Les colonnes sont les mêmes, et les
-- RÈGLES aussi (`src/lib/code-verification.ts`, une seule rédaction) ; seul le
-- sens de la ligne diffère.
--
-- **DEUX TEMPS, DEUX PREUVES.** Le code juste ne change rien : il donne un
-- JETON (32 octets tirés au hasard, `jeton_empreinte` en garde le SHA-256), qui
-- vaut un quart d'heure et sert UNE fois, à poser le nouveau mot de passe. Le
-- code, lui, meurt à l'instant où le jeton naît.
CREATE TABLE "codes_mot_de_passe" (
  "utilisateur_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "empreinte" text NOT NULL,
  "expire_le" timestamptz NOT NULL,
  "essais" integer NOT NULL DEFAULT 0,
  "envois" integer NOT NULL DEFAULT 1,
  "dernier_envoi" timestamptz NOT NULL DEFAULT now(),
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "jeton_empreinte" text,
  "jeton_expire_le" timestamptz
);

-- Liée à une PERSONNE, avant toute session : le contexte est
-- `app.utilisateur_id`, comme `codes_verification_email`.
ALTER TABLE "codes_mot_de_passe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "codes_mot_de_passe" FORCE ROW LEVEL SECURITY;

CREATE POLICY "codes_mot_de_passe_isolation" ON "codes_mot_de_passe"
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)
  WITH CHECK ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "codes_mot_de_passe" TO atlas_app;

-- ─────────────────────────────────────────────────────────────────────────────
-- POSER LE NOUVEAU CONDENSAT, SUR PRÉSENTATION DU JETON.
--
-- `atlas_app` n'a pas le droit d'écrire `users.password_hash` (0064), et c'est
-- ce qui empêche une requête fautive de poser un condensat connu sur le compte
-- du patron. `changer_mot_de_passe` exige l'ANCIEN mot de passe ; celle-ci
-- exige un JETON VIVANT dans `codes_mot_de_passe`, et le consomme.
--
-- **CE QUE CELA NE FERME PAS, dit franchement.** Qui peut exécuter plusieurs
-- instructions sous `atlas_app` peut écrire lui-même une ligne et son jeton,
-- puis appeler cette fonction ; il pourrait aussi bien changer `users.email`
-- (droit accordé par 0064) et demander un code. Aucun « mot de passe oublié »
-- n'y échappe : l'application doit pouvoir envoyer le code, donc le connaître.
-- Ce qui reste fermé, c'est la voie d'UNE seule écriture sur `users`.
--
-- Le contexte est posé DANS la fonction : elle tourne sous `atlas_owner`, qui
-- n'a pas `BYPASSRLS`, et sous FORCE RLS il ne verrait aucune ligne — le
-- `DELETE` toucherait zéro ligne sans erreur, et la fonction répondrait
-- toujours « non » (`.claude/rules/migrations.md`).
CREATE OR REPLACE FUNCTION public.reinitialiser_mot_de_passe(
  p_utilisateur uuid,
  p_jeton_empreinte text,
  p_nouveau_condensat text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  n integer;
BEGIN
  IF p_nouveau_condensat IS NULL OR p_nouveau_condensat NOT LIKE '$2%' OR length(p_nouveau_condensat) < 55 THEN
    RAISE EXCEPTION 'condensat invalide';
  END IF;
  IF p_jeton_empreinte IS NULL OR length(p_jeton_empreinte) <> 64 THEN
    RETURN false;
  END IF;
  PERFORM set_config('app.utilisateur_id', p_utilisateur::text, true);
  DELETE FROM public.codes_mot_de_passe c
   WHERE c.utilisateur_id = p_utilisateur
     AND c.jeton_empreinte = p_jeton_empreinte
     AND c.jeton_expire_le > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RETURN false;
  END IF;
  UPDATE public.users
     SET password_hash = p_nouveau_condensat,
         updated_at = now()
   WHERE id = p_utilisateur;
  RETURN true;
END
$fn$;

REVOKE ALL ON FUNCTION public.reinitialiser_mot_de_passe(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reinitialiser_mot_de_passe(uuid, text, text) TO atlas_app;
