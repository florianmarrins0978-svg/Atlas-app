-- RETIRER DE LA LISTE N'EST PAS SUPPRIMER.
--
-- Sa règle du 29 septembre 2026 : *« si l'utilisateur veut les retirer de la
-- liste des chantiers en cours, il doit pouvoir en les slidant sur le côté,
-- mais ça ne doit pas impacter le lien cliquable envoyé au client ! Il doit
-- quand même pouvoir l'ouvrir »*.
--
-- Jusque-là, glisser la ligne d'un devis envoyé SUPPRIMAIT le chantier. Le
-- lien s'ouvrait encore, mais une acceptation arrivée ensuite posait le
-- chantier au planning en le laissant supprimé : ni planning, ni
-- notification. La réponse du client se perdait sans un mot.
--
-- Ce qui est chez le client sans réponse (un devis envoyé, un contrat envoyé)
-- se RETIRE de la liste : l'heure du retrait est posée ici, et la ligne
-- revient dès que le client répond (ou qu'un nouvel envoi part). Le reste se
-- supprime comme avant.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : deux colonnes
-- nullables, aucune ligne existante touchée, aucun UPDATE sous FORCE RLS.
-- NULL est l'état normal, et l'ancien code l'ignore.

ALTER TABLE "chantiers" ADD COLUMN "retire_de_la_liste_at" timestamptz;

ALTER TABLE "contrats_entretien" ADD COLUMN "retire_de_la_liste_at" timestamptz;
