-- POUR MON COMPTABLE — un virement reçu se règle dans sa carte du dossier.
--
-- Sa remarque du 25 octobre 2026 : *« le dernier ticket, je peux pas le
-- valider parce que je dois le valider sur la première page, sauf que la
-- notification n'apparaît pas. Donc je peux pas verrouiller mon dossier. »*
-- L'accueil ne questionne que les virements qu'une facture d'Atlas explique
-- (`questionsDesVirements`) : un virement reçu sans facture du même montant
-- restait « à justifier » pour toujours, et le dossier ne s'arrêtait plus.
--
-- Ses choix sur `appli/soignee/termines-comptable.html` : choisir la facture
-- d'Atlas (même payée en partie), joindre une facture faite HORS d'Atlas
-- (photo ou PDF), ou dire ce que c'est (cinq réponses à lui).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : trois colonnes
-- nullables, et trois contraintes ÉLARGIES. L'ancien code n'écrit que des
-- valeurs que les nouvelles contraintes acceptent encore.
--
-- **Aucune ligne n'est réécrite** : ni `UPDATE`, ni conversion. La table est
-- sous FORCE RLS (0142), mais un `ADD CONSTRAINT … CHECK` se vérifie sur TOUTES
-- les lignes sans regarder la RLS (`.claude/rules/migrations.md`) : ce qui est
-- vérifié ci-dessous l'est donc pour de bon, sur la base habitée.
--
-- **Pourquoi elles ne peuvent pas échouer sur une base habitée** : la
-- justification et le motif acceptent tout ce qu'ils acceptaient ; la
-- cohérence, plus stricte, ne juge que les écritures nouvelles (NOT VALID,
-- ci-dessous). Éprouvé par `scripts/test-migration-0148-base-habitee.ts`.

ALTER TABLE "mouvements_bancaires"
  -- La facture faite hors d'Atlas : son fichier dans le stockage, sa forme, et
  -- le total LU dessus (jamais calculé). Vides pour toute autre justification.
  ADD COLUMN IF NOT EXISTS "piece_cle" text,
  ADD COLUMN IF NOT EXISTS "piece_nature" text
    CONSTRAINT "mouvements_bancaires_piece_nature_check"
    CHECK ("piece_nature" IS NULL OR "piece_nature" IN ('photo', 'pdf')),
  ADD COLUMN IF NOT EXISTS "piece_total" numeric(12, 2);

ALTER TABLE "mouvements_bancaires"
  DROP CONSTRAINT IF EXISTS "mouvements_bancaires_justification_check",
  ADD CONSTRAINT "mouvements_bancaires_justification_check"
    CHECK ("justification" IS NULL OR "justification" IN ('ticket', 'facture', 'ticket_perdu', 'motif', 'facture_hors_atlas'));

-- Les cinq réponses d'un virement reçu rejoignent les six d'un virement
-- envoyé. `pret` et `perso` servent aux deux sens ; le sens se vérifie dans
-- le dépôt, qui lit la ligne dans la même transaction.
ALTER TABLE "mouvements_bancaires"
  DROP CONSTRAINT IF EXISTS "mouvements_bancaires_motif_check",
  ADD CONSTRAINT "mouvements_bancaires_motif_check"
    CHECK ("motif" IS NULL OR "motif" IN (
      'fournisseur', 'salaire', 'loyer', 'impots', 'pret', 'perso',
      'remboursement', 'aide', 'entre_comptes'
    ));

-- Ce que dit la justification, la ligne le porte : une facture hors d'Atlas
-- sans fichier serait une ligne qui se croit justifiée et ne montre rien au
-- comptable.
--
-- **Le trou de 0143, refermé ici.** Sa dernière branche, `"justification" IN
-- (…)`, vaut INCONNU quand la justification est vide ; et une contrainte qui
-- vaut inconnu PASSE. Une ligne « à justifier » qui portait un ticket, une
-- facture ou un motif entrait donc sans être refusée (relevé le 26 octobre 2026
-- par `test-migration-0148-base-habitee.ts`). Chaque branche se dit désormais
-- vraie ou fausse, jamais inconnue (`IS NOT DISTINCT FROM`, `IS NOT NULL`).
--
-- **NOT VALID, et c'est délibéré.** Plus stricte que celle qu'elle remplace,
-- elle pourrait trouver sur une base habitée une ligne ancienne qui ne la tient
-- pas, et la migration échouerait : la panne de 0087. NOT VALID la fait tenir
-- pour toute écriture NOUVELLE, sans juger les lignes d'hier ; elle se valide
-- plus tard, une fois ces lignes regardées (`TODO.md`).
ALTER TABLE "mouvements_bancaires"
  DROP CONSTRAINT IF EXISTS "mouvements_bancaires_justification_coherente",
  ADD CONSTRAINT "mouvements_bancaires_justification_coherente" CHECK (
    ("justification" IS NULL AND "achat_id" IS NULL AND "facture_recue_id" IS NULL AND "motif" IS NULL AND "piece_cle" IS NULL)
    OR ("justification" IS NOT DISTINCT FROM 'motif' AND "motif" IS NOT NULL)
    OR ("justification" IS NOT DISTINCT FROM 'facture_hors_atlas' AND "piece_cle" IS NOT NULL AND "piece_nature" IS NOT NULL)
    OR ("justification" IS NOT NULL AND "justification" IN ('ticket', 'facture', 'ticket_perdu'))
  ) NOT VALID;
