-- LE DEVIS REPRIS : SES ANCIENS PRIX, LE TARIF DU JOUR PROPOSÉ, ET LA HAUSSE.
--
-- Ses décisions du 26 septembre 2026, sur `appli/augmenter-un-devis-repris.html` :
-- « Dernier devis » reprend l'ancien devis À SES PRIX ; si sa grille a bougé,
-- la page du devis lui demande s'il veut le tarif du jour ; puis il peut
-- augmenter toutes les lignes reprises de 5, 10, 30 % ou d'un taux qu'il tape.
-- Règles pures : `src/lib/hausse-du-devis.ts`.
--
-- **SUR LA LIGNE**, ce qu'il faut pour recalculer sans jamais cumuler :
--   `prix_ancien`  son prix sur l'ancien devis. Présent = ligne reprise et
--                  jamais retouchée ; le premier prix tapé l'efface
--                  (`modifierLignePrix`), et la ligne sort de la hausse ;
--   `prix_grille`  le tarif du jour, quand il diffère de l'ancien prix.
-- **SUR LE CHANTIER**, ses deux réponses :
--   `reprise_grille`  « oui » ou « non » à « Votre grille a changé » ;
--   `hausse_reprise`  le taux appliqué, de 0,1 à 100 %.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : quatre colonnes
-- nulles par défaut. Aucune ligne existante ne change, aucun UPDATE, donc rien
-- à éprouver sur une base habitée ni sous FORCE RLS. Un code ancien servi sur
-- cette base les ignore ; un chantier existant les porte à NULL, ce qui veut
-- dire « pas une reprise » : son écran ne change pas d'un pixel.

ALTER TABLE lignes_prix
  ADD COLUMN IF NOT EXISTS prix_ancien numeric(10, 2),
  ADD COLUMN IF NOT EXISTS prix_grille numeric(10, 2);

ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS reprise_grille text,
  ADD COLUMN IF NOT EXISTS hausse_reprise numeric(4, 1);

-- Deux contraintes de forme, vérifiées sur une colonne entièrement nulle :
-- elles ne peuvent refuser aucune ligne existante.
ALTER TABLE chantiers
  ADD CONSTRAINT chantiers_reprise_grille_ck
    CHECK (reprise_grille IS NULL OR reprise_grille IN ('oui', 'non')),
  ADD CONSTRAINT chantiers_hausse_reprise_ck
    CHECK (hausse_reprise IS NULL OR (hausse_reprise > 0 AND hausse_reprise <= 100));
