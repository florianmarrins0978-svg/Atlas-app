-- POUR MON COMPTABLE, LOT 2 — ce qui justifie chaque ligne du relevé.
-- Ses choix des 23 et 24 octobre 2026 sur `appli/pour-mon-comptable.html` :
-- le Check up relie seul un ticket quand un seul tombe juste (défaisable),
-- demande quand il y en a deux, prévient quand il n'y en a aucun ; une ligne
-- peut être validée « ticket perdu » (sa TVA ne se déduit pas) ; un virement
-- envoyé se justifie par une facture, ou par sa nature (un salaire, un loyer).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : des colonnes
-- nullables sur une table née au lot 1, une contrainte d'unicité sur une clé
-- déjà unique. **Aucune ligne n'est réécrite** : ni `UPDATE`, ni conversion.
--
-- **La contrainte ajoutée à `achats_tva` ne peut pas échouer sur une base
-- habitée** : `id` est déjà la clé primaire, donc le couple (`id`,
-- `entreprise_id`) est unique pour toute ligne qui existe. PostgreSQL la
-- vérifie sans regarder la RLS, et n'y trouvera rien à refuser. Elle sert
-- à la clé double ci-dessous : un ticket d'une autre entreprise ne peut pas
-- justifier une ligne, même tapé à la main.

ALTER TABLE "achats_tva"
  ADD CONSTRAINT "achats_tva_id_entreprise_uk" UNIQUE ("id", "entreprise_id");

ALTER TABLE "mouvements_bancaires"
  -- Vide : la ligne attend sa pièce.
  ADD COLUMN IF NOT EXISTS "justification" text
    CONSTRAINT "mouvements_bancaires_justification_check"
    CHECK ("justification" IS NULL OR "justification" IN ('ticket', 'facture', 'ticket_perdu', 'motif')),
  ADD COLUMN IF NOT EXISTS "achat_id" uuid,
  ADD COLUMN IF NOT EXISTS "facture_recue_id" uuid,
  ADD COLUMN IF NOT EXISTS "motif" text
    CONSTRAINT "mouvements_bancaires_motif_check"
    CHECK ("motif" IS NULL OR "motif" IN ('fournisseur', 'salaire', 'loyer', 'impots', 'pret', 'perso')),
  -- Qui a relié : Atlas au Check up, ou le patron. Un lien d'Atlas se montre
  -- comme tel, pour qu'il sache qu'il peut le défaire.
  ADD COLUMN IF NOT EXISTS "relie_par" text
    CONSTRAINT "mouvements_bancaires_relie_par_check"
    CHECK ("relie_par" IS NULL OR "relie_par" IN ('atlas', 'patron')),
  ADD COLUMN IF NOT EXISTS "justifie_le" timestamptz;

-- **La pièce de la MÊME entreprise**, par la clé double. Un ticket ou une
-- facture retirés délient la ligne, qui revient « à justifier ».
ALTER TABLE "mouvements_bancaires"
  ADD CONSTRAINT "mouvements_bancaires_achat_fk" FOREIGN KEY ("achat_id", "entreprise_id")
    REFERENCES "achats_tva"("id", "entreprise_id") ON DELETE SET NULL ("achat_id"),
  ADD CONSTRAINT "mouvements_bancaires_facture_recue_fk" FOREIGN KEY ("facture_recue_id", "entreprise_id")
    REFERENCES "devis_recus"("id", "entreprise_id") ON DELETE SET NULL ("facture_recue_id");

-- Ce que dit la justification, la ligne le porte : un motif sans motif serait
-- une ligne qui se croit justifiée et ne dit pas par quoi.
--
-- **Le ticket et la facture ne sont PAS exigés ici, et c'est voulu.** Une pièce
-- effacée délie sa ligne (`ON DELETE SET NULL`) sans toucher `justification` ;
-- l'exiger ferait REFUSER l'effacement du ticket. Une ligne « ticket » sans
-- ticket se lit donc « à justifier » (`repositories/pour-mon-comptable.ts`).
ALTER TABLE "mouvements_bancaires"
  ADD CONSTRAINT "mouvements_bancaires_justification_coherente" CHECK (
    ("justification" IS NULL AND "achat_id" IS NULL AND "facture_recue_id" IS NULL AND "motif" IS NULL)
    OR ("justification" = 'motif' AND "motif" IS NOT NULL)
    OR ("justification" IN ('ticket', 'facture', 'ticket_perdu'))
  );

-- Un ticket ne justifie qu'une seule ligne : relié deux fois, il ferait
-- compter deux fois la même dépense au comptable.
CREATE UNIQUE INDEX IF NOT EXISTS "mouvements_bancaires_achat_uk"
  ON "mouvements_bancaires" ("entreprise_id", "achat_id") WHERE "achat_id" IS NOT NULL;
