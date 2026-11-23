-- LA VISITE GUIDÉE, PROPOSÉE UNE SEULE FOIS — sa décision du 23 novembre 2026.
--
-- Sa planche du même jour (`appli/vente/cause-2-inscription.html`, l'étape
-- « L'appli ») : sur l'accueil, une carte « La visite guidée » avec « Faire la
-- visite » ou « Non merci ». Sa réponse : *« oui, une seule fois au premier
-- accueil ; et qu'il puisse, s'il ne veut pas la faire, enlever le bouton »*.
-- Faite ou refusée, elle ne revient plus.
--
-- SUR `users`, ET PAS DANS LE NAVIGATEUR, pour la raison de la migration 0163 :
-- gardée sur le téléphone, la marque se perdrait au premier nettoyage et la
-- carte reviendrait sur son PC. Par COMPTE : chaque personne de l'équipe la
-- voit une fois.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne
-- ajoutée, nullable, aucune ligne réécrite. L'ancien code l'ignore ; NULL se
-- lit « pas encore proposée jusqu'au bout ». `users` ne porte aucune politique
-- RLS (la table d'authentification) : rien à prouver sur des lignes.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS visite_guidee_vue_le timestamptz;

-- LES DROITS, COLONNE PAR COLONNE (migration 0064 : `atlas_app` ne lit ni
-- n'écrit `users` qu'aux colonnes nommées). Sans ces deux lignes, la colonne
-- existe et l'application reçoit « permission denied for table users »,
-- comme l'a montré `test-aide-note-devis-db.ts` pour la 0163.
GRANT SELECT (visite_guidee_vue_le) ON public.users TO atlas_app;
GRANT UPDATE (visite_guidee_vue_le) ON public.users TO atlas_app;

COMMENT ON COLUMN users.visite_guidee_vue_le IS
  'Quand la carte de la visite guidée a été suivie ou refusée sur l''accueil. NULL : jamais.';
