-- SUPPRIMER UN CLIENT : L'EFFACEMENT PEUT RETIRER UN DEVIS ENVOYÉ, LA MAIN NON.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Sa décision du 27 août 2026**, devant la planche `supprimer-un-client.html` :
-- *« je pense la C ; lorsqu'un client a des documents il faut mettre la phrase de
-- prévention, et une phrase disant avez-vous sauvegardé ses documents autre part
-- — et s'il dit oui il peut supprimer quand même »*.
--
-- **Ce qui l'en empêchait.** `effacerClient` levait dès que le client avait reçu
-- un devis : le déclencheur `trg_devis_immuable` (migration 0001) interdit de
-- supprimer un devis `envoye`, et l'effacement tentait de détruire tous ceux qui
-- ne sont pas liés à une acceptation. La fonction ne marchait donc que pour un
-- client qui n'a jamais rien reçu — c'est-à-dire presque jamais.
--
-- **Et le déclencheur avait raison de refuser.** Un devis parti fait foi ; le
-- laisser modifier ou disparaître sur un geste ordinaire viderait la pièce de
-- sa valeur. Ce que ce fichier ouvre est une porte NOMMÉE, et une seule :
-- l'effacement d'un client, demandé explicitement, confirmé à l'écran.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **L'EXCEPTION NE VAUT QUE POUR `DELETE`, JAMAIS POUR `UPDATE`.**
--
-- C'est la distinction qui garde l'invariant : un devis parti reste **immuable**
-- — personne, dans aucun contexte, ne peut en changer une ligne ou un prix.
-- Ce que l'effacement obtient, c'est de le faire DISPARAÎTRE avec le reste du
-- dossier, ce qui est exactement ce que le droit à l'effacement recouvre pour
-- une pièce qui n'engage rien (`src/server/retention.ts` : « un devis non
-- accepté n'engage rien et s'efface »).
--
-- **Ce qui ne passe PAS par cette porte, et n'y passera jamais :**
--
--   · une facture émise — `factures_chantier_entreprise_fk` est en RESTRICT, et
--     le Code de commerce L123-22 impose dix ans. La base refuse, et c'est bien ;
--   · un devis ACCEPTÉ — il vaut engagement, et `effacerClient` le met de côté
--     avant même d'essayer.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Pourquoi un réglage de session plutôt qu'un rôle ou une colonne.**
--
-- `set_config(..., true)` vit le temps de la TRANSACTION et meurt avec elle :
-- une exception, un `ROLLBACK`, une connexion rendue au pool, et la porte est
-- refermée sans que personne ait à y penser. Une colonne « autorisé à effacer »
-- resterait posée ; un rôle dédié demanderait un second jeu d'identifiants sur
-- une machine qui n'en a pas besoin.
--
-- C'est le même mécanisme que le contexte d'entreprise (`with-entreprise.ts`),
-- et il est éprouvé de la même façon : `scripts/test-effacement-client.ts` vérifie
-- qu'un devis envoyé résiste HORS de l'effacement — sans quoi cette migration
-- aurait ouvert la porte à tout le monde.

CREATE OR REPLACE FUNCTION empecher_modification_devis_envoye() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut = 'envoye'
       AND coalesce(current_setting('atlas.effacement_client', true), '') <> 'oui' THEN
      RAISE EXCEPTION 'Un devis envoyé ne peut pas être supprimé (id=%)', OLD.id;
    END IF;
    RETURN OLD;
  ELSE
    -- **Aucune exception ici, et c'est le cœur du sujet.** Un devis parti ne se
    -- modifie dans aucun contexte : c'est ce qui fait qu'il fait foi.
    IF OLD.statut = 'envoye' THEN
      RAISE EXCEPTION 'Un devis envoyé est immuable (id=%)', OLD.id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Les lignes suivent leur devis en cascade : sans la même porte, la suppression
-- du devis tomberait sur le déclencheur des lignes, une ligne plus bas.
CREATE OR REPLACE FUNCTION empecher_modification_lignes_devis_envoye() RETURNS trigger AS $$
DECLARE
  v_statut text;
  v_devis_id uuid;
BEGIN
  v_devis_id := COALESCE(NEW.devis_id, OLD.devis_id);
  SELECT statut INTO v_statut FROM devis WHERE id = v_devis_id;
  IF v_statut = 'envoye'
     AND NOT (TG_OP = 'DELETE'
              AND coalesce(current_setting('atlas.effacement_client', true), '') = 'oui') THEN
    RAISE EXCEPTION 'Impossible de modifier les lignes d''un devis envoyé (devis_id=%)', v_devis_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
