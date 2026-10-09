-- LA MENTION DU RÉPERTOIRE DES MÉTIERS — son choix B du 9 octobre 2026
-- (`appli/numero-rm.html`).
--
-- Aucun texte trouvé ne dit ce qu'un artisan écrit à côté de son SIREN depuis
-- que le registre national (RNE, 2023) a remplacé le répertoire des métiers
-- (`docs/check-up-legal-documents.md`, « à confirmer »). Plutôt que d'imprimer
-- une mention devinée, un champ libre et facultatif dans Mon entreprise :
-- rempli, il s'imprime tel qu'écrit après le SIRET, sur la même ligne ; vide,
-- rien ne change.
--
-- Figé sur le devis et la facture comme le SIRET (0094, 0076) : une pièce garde
-- ce qu'elle portait le jour où elle est partie.
--
-- Expand seul, aucune donnée réécrite : personne ne l'a encore saisie, les
-- pièces parties sont immuables (trigger), un brouillon la prend à sa prochaine
-- régénération. Aucune contrainte : l'ancien code ignore ces colonnes
-- (.claude/rules/deployment-safety.md).
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "numero_rm" text;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_numero_rm" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_numero_rm" text;
