-- DÉFAIRE UNE ACCEPTATION — son choix 3 du 7 octobre 2026
-- (`appli/devis-accepte-par-erreur.html`).
--
-- Un client accepte un devis par erreur et appelle. Le patron dit « le client
-- s'est trompé » : soit il veut une autre date (le devis repart en attente,
-- le même lien redevient répondable), soit il ne veut plus du devis (noté
-- refusé). Dans les deux cas, le chantier quitte le planning.
--
-- **L'acceptation effacée se GARDE ici.** Remettre `envois_devis` en attente
-- vide sa réponse, sa date, l'adresse et l'appareil du clic : la seule preuve
-- qu'un accord a existé. Un accord de devis a valeur de preuve (`chantiers.ts`,
-- `supprimerChantier`) ; le défaire sans trace serait le perdre pour de bon le
-- jour où l'erreur était celle du patron, pas celle du client.
--
-- Expand seul : une table neuve, aucune ligne existante touchée, aucune
-- contrainte posée sur une table habitée. Le code d'avant l'ignore.
CREATE TABLE IF NOT EXISTS "acceptations_defaites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "envoi_id" uuid NOT NULL REFERENCES "envois_devis"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,

  -- Ce que le patron a décidé : une autre date, ou plus de devis.
  "vers" text NOT NULL,

  -- L'acceptation telle qu'elle était, recopiée avant d'être effacée.
  "repondu_at" timestamptz NOT NULL,
  "date_retenue" date,
  "jours_retenus" jsonb,
  "demarrage_anticipe" boolean NOT NULL,
  "accord_sur_papier" boolean NOT NULL,
  "adresse_ip" text,
  "agent_utilisateur" text,

  -- Qui l'a défaite, et quand. Sans clé étrangère vers le compte : c'est une
  -- trace, elle doit survivre à son départ (comme `accord_papier_par`, 0122).
  "defaite_par" uuid NOT NULL,
  "defaite_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "acceptations_defaites_vers_connu" CHECK ("vers" IN ('attente', 'refusee'))
);

CREATE INDEX IF NOT EXISTS "acceptations_defaites_entreprise_envoi_idx"
  ON "acceptations_defaites" ("entreprise_id", "envoi_id");

ALTER TABLE "acceptations_defaites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "acceptations_defaites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "acceptations_defaites_isolation" ON "acceptations_defaites"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- **Une trace s'écrit et se lit ; elle ne se réécrit ni ne s'efface.**
-- `ALTER DEFAULT PRIVILEGES` donne à `atlas_app` les quatre droits sur toute
-- table neuve (voir 0081) : on lui retire donc les deux qui effaceraient la
-- preuve. Les cascades (envoi, entreprise effacés) passent toujours : elles
-- s'exécutent avec les droits du propriétaire de la table.
REVOKE UPDATE, DELETE ON "acceptations_defaites" FROM atlas_app;

COMMENT ON TABLE "acceptations_defaites" IS
  'Une acceptation de devis que le patron a défaite (7 octobre 2026) : ce que '
  'le client avait accepté, recopié avant d''être effacé de envois_devis.';
