-- UN ESSAI PAR ENTREPRISE, RECONNUE À SON SIREN — sa décision du 23 novembre 2026.
--
-- Sa question : *« quelqu'un crée un compte pour les 15 jours, quitte, et en
-- recrée un avec une autre adresse : est-ce qu'on ne ferait pas un truc avec
-- le SIRET ? »*, puis *« on part sur le SIREN comme tu as dit »*, et sur la carte
-- de paiement : *« il faut que ça soit simplement le numéro de SIREN qui
-- bloque »*. Sa planche : `appli/soignee/essai-par-entreprise.html`.
--
-- LE SIREN, PAS LE SIRET : un déménagement change le SIRET (les cinq derniers
-- chiffres), jamais le SIREN. Et ON NE BLOQUE JAMAIS LE COMPTE : un SIRET est
-- public, sur chaque devis ; bloquer laisserait n'importe qui priver un
-- concurrent de son essai. Le compte se crée ; l'essai, lui, est déjà pris.
--
-- ─── 1. La table : les SIREN qui ont eu leur essai ───────────────────────────
--
-- Aucune donnée d'entreprise n'y est lisible par l'appli : `atlas_app` n'a AUCUN
-- droit sur la table, il ne fait que poser une question à une fonction
-- (`prendre_essai_du_siren`, `essai_du_siren_deja_pris`), qui ne rend qu'un oui
-- ou un non. Une injection ne pourrait donc jamais en tirer la liste des SIREN
-- des clients de Cause. C'est le modèle de la migration 0064 (le mot de passe).
--
-- **DEUX VERROUS, ET NON UN** : `atlas_app` n'a aucun droit sur la table, ET
-- elle est sous FORCE ROW LEVEL SECURITY, avec une seule politique, pour son
-- propriétaire (`atlas_owner`, sous lequel tournent les deux fonctions). Un droit
-- donné par erreur demain à `atlas_app` ne lui ouvrirait donc encore aucune
-- ligne. Elle n'est pas cloisonnée par entreprise, et c'est le but : elle sert
-- justement à reconnaître une entreprise d'une autre
-- (`test-toute-table-est-cloisonnee.ts` la voit cloisonnée, et elle l'est).
--
-- **Pas de clé étrangère vers `entreprises`** : la ligne doit survivre à
-- l'entreprise effacée, sans quoi supprimer son compte rendrait l'essai.
-- Garder un SIREN après l'effacement est une donnée personnelle pour un
-- entrepreneur individuel : sa durée et sa mention dans la politique de
-- confidentialité attendent le juriste (`TODO.md`).
CREATE TABLE IF NOT EXISTS public.essais_par_siren (
  siren text PRIMARY KEY CHECK (siren ~ '^[0-9]{9}$'),
  entreprise_id uuid NOT NULL,
  pris_le timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.essais_par_siren FROM PUBLIC;
-- **Et de `atlas_app` NOMMÉMENT** : les droits par défaut de la base lui donnent
-- la lecture de toute table neuve (vu sur la base d'essai le 23 novembre 2026 :
-- `SELECT count(*)` répondait sous `atlas_app`). Sans cette ligne, la table
-- des SIREN de tous les clients se lisait de l'appli.
REVOKE ALL ON public.essais_par_siren FROM atlas_app;
ALTER TABLE public.essais_par_siren ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essais_par_siren FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS essais_par_siren_proprietaire ON public.essais_par_siren;
CREATE POLICY essais_par_siren_proprietaire ON public.essais_par_siren
  TO atlas_owner USING (true) WITH CHECK (true);

-- ─── 2. Prendre l'essai d'un SIREN, pour une entreprise ─────────────────────
--
-- Vrai si l'essai revient à cette entreprise : le SIREN était libre (il est
-- pris maintenant), ou c'est déjà le sien (il retape son propre SIRET). Faux
-- si une AUTRE entreprise l'a eu. Un seul aller-retour, sans course possible :
-- l'insertion et la lecture se font dans la même instruction.
CREATE OR REPLACE FUNCTION public.prendre_essai_du_siren(p_siren text, p_entreprise uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  titulaire uuid;
BEGIN
  -- Rien à reconnaître sans SIREN : l'essai suit son cours, comme sans SIRET.
  IF p_siren IS NULL OR p_siren !~ '^[0-9]{9}$' OR p_entreprise IS NULL THEN
    RETURN true;
  END IF;
  INSERT INTO public.essais_par_siren (siren, entreprise_id)
       VALUES (p_siren, p_entreprise)
  ON CONFLICT (siren) DO NOTHING;
  SELECT e.entreprise_id INTO titulaire FROM public.essais_par_siren e WHERE e.siren = p_siren;
  RETURN titulaire = p_entreprise;
END
$fn$;

-- ─── 3. Le demander AVANT que le compte existe ──────────────────────────────
--
-- Sur la question du SIRET, à la création du compte : *« Votre entreprise a déjà
-- eu ses 15 jours d'essai »* se dit avant « Créer mon compte ». Ne rend qu'un oui
-- ou un non, et ne prend rien.
CREATE OR REPLACE FUNCTION public.essai_du_siren_deja_pris(p_siren text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.essais_par_siren e WHERE e.siren = p_siren)
$fn$;

-- `REVOKE … FROM PUBLIC` d'abord : PostgreSQL accorde `EXECUTE` à `PUBLIC` sur
-- toute fonction neuve (migration 0064).
REVOKE ALL ON FUNCTION public.prendre_essai_du_siren(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.essai_du_siren_deja_pris(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prendre_essai_du_siren(text, uuid) TO atlas_app;
GRANT EXECUTE ON FUNCTION public.essai_du_siren_deja_pris(text) TO atlas_app;

-- ─── 4. L'abonnement dit POURQUOI l'essai est fini ──────────────────────────
--
-- Un essai refusé à la création se pose « fini » tout de suite ; sans cette
-- colonne, le ruban dirait « Essai terminé », comme au seizième jour, alors que
-- sa planche dit « Essai déjà utilisé par votre entreprise ». EXPAND SEUL : une
-- colonne, une valeur par défaut, aucune ligne réécrite ; l'ancien code
-- l'ignore.
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS essai_deja_pris boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.essais_par_siren IS
  'Les SIREN qui ont eu leur essai gratuit, et l''entreprise qui l''a eu. Lu par prendre_essai_du_siren et essai_du_siren_deja_pris, jamais par atlas_app.';
