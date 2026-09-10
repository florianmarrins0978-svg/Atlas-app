-- ═══════════════════════════════════════════════════════════════════════════
-- OÙ UN CHANTIER EST POSÉ — sa demande du 10 septembre 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ses mots, devant la planche `appli/liberer-une-demi-journee.html` : *« je
-- clique sur le matin, il devient vert et le matin du vendredi devient libre, et
-- une demi-journée de Mr Julien [sort] ; à la place on ajoute un chantier comme
-- d'habitude, et la demi-journée retirée peut être replacée. »* Puis, une fois
-- la planche essayée : *« la planche 1 est bonne, tu peux la coder. »*
--
-- ─── POURQUOI UNE TABLE, ET PAS UNE COLONNE DE PLUS ────────────────────────
--
-- Un chantier disait jusqu'ici OÙ il est posé avec trois colonnes :
-- `date_planifiee`, `creneau_debut`, `duree_demi_journees`. Elles ne savent
-- décrire qu'un bloc **d'un seul tenant** : « deux jours à partir du vendredi
-- après-midi ». Libérer une demi-journée au milieu casse cette forme — il n'y a
-- aucun endroit pour écrire « le vendredi après-midi et le mardi matin, mais
-- pas le vendredi matin ».
--
-- Une colonne de plus ne l'aurait pas dit non plus : ce n'est pas une valeur
-- qui manque, c'est un ENSEMBLE. Une ligne par demi-journée le dit exactement,
-- et rien d'autre ne le dit.
--
-- ─── CE QUE CHAQUE COLONNE VEUT DIRE, ET CE QUI NE CHANGE PAS ──────────────
--
-- `duree_demi_journees` garde son sens : **ce que le chantier DEMANDE**, lu de
-- la dictée ou du devis. Cette table dit **où il est POSÉ**. Les deux se
-- comparent, et leur écart est exactement ce que le patron voit dans « Sans
-- date » : *« la demi-journée de Mr Julien qui a été retirée peut être
-- replacée »* — une demi-journée demandée qui n'est posée nulle part.
--
-- `date_planifiee` et `creneau_debut` restent le PREMIER créneau, et rien de
-- plus. Ils sont donc DÉRIVÉS de cette table dès qu'elle porte des lignes ; une
-- seule fonction les réécrit (`chantiers.ts`), pour qu'ils ne puissent pas
-- diverger d'elle.
--
-- ─── PAS DE RECOPIE DU PASSÉ, ET C'EST DÉLIBÉRÉ ────────────────────────────
--
-- Les chantiers déjà posés n'ont aucune ligne ici, et n'en auront que le jour
-- où on les touche. **Sans ligne, un chantier vaut ce qu'il valait** : le bloc
-- d'un seul tenant que ses trois colonnes décrivent, calculé comme avant
-- (`creneauxDuChantier`). Le lire autrement, c'est libérer d'un coup des
-- demi-journées déjà prises et proposer à un client un jour qui ne l'est pas.
--
-- Recopier l'existant aurait demandé de réécrire ici, en SQL, la règle qui
-- saute les week-ends — une seconde implémentation de ce que `disponibilites.ts`
-- tient déjà, et le §3 de `CLAUDE.md` l'interdit pour cette raison exacte.

CREATE TABLE IF NOT EXISTS "creneaux_chantier" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL REFERENCES "chantiers"("id") ON DELETE CASCADE,

  "jour" date NOT NULL,
  -- Le même vocabulaire que `creneau_debut` depuis la migration 0019 : deux
  -- valeurs, et une troisième serait un troisième mot pour la même chose.
  "demi" text NOT NULL,

  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "creneaux_chantier_demi_connue" CHECK ("demi" IN ('matin', 'apres_midi'))
);

-- **Deux fois la même demi-journée pour un chantier n'a aucun sens**, et
-- l'écrire deux fois lui ferait occuper deux places : un double appui, deux
-- onglets, une reprise de connexion suffisent.
CREATE UNIQUE INDEX IF NOT EXISTS "creneaux_chantier_unique"
  ON "creneaux_chantier" ("chantier_id", "jour", "demi");

-- La question que l'écran pose tout le temps : « qui occupe cette semaine ? ».
CREATE INDEX IF NOT EXISTS "creneaux_chantier_entreprise_jour_idx"
  ON "creneaux_chantier" ("entreprise_id", "jour");

ALTER TABLE "creneaux_chantier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creneaux_chantier" FORCE ROW LEVEL SECURITY;
CREATE POLICY "creneaux_chantier_isolation" ON "creneaux_chantier"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

COMMENT ON TABLE "creneaux_chantier" IS
  'Où un chantier est POSÉ, une ligne par demi-journée (10 septembre 2026). '
  'duree_demi_journees dit ce qu''il DEMANDE ; l''écart entre les deux est ce '
  'qui attend une place. Aucune ligne : le chantier vaut son bloc d''un seul '
  'tenant, comme avant cette table.';
