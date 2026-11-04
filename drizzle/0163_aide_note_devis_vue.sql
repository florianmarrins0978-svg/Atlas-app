-- LA NOTE DU DEVIS, MONTRÉE UNE SEULE FOIS — sa décision du 4 novembre 2026.
--
-- Sa planche du 3 novembre (`appli/soignee/devis-note-avant-envoi.html`) :
-- quand il touche « Notes / conditions » sur un devis, une fenêtre de huit
-- secondes lui montre la page de son client, la note entourée d'or, là où il
-- la lira. Sa réponse : *« seulement pour le premier devis de chaque
-- utilisateur ; ensuite la fenêtre ne revient plus jamais, c'est juste pour
-- prévenir lors de la première utilisation »*.
--
-- SUR `users`, ET PAS DANS LE NAVIGATEUR. Gardée sur le téléphone, la marque
-- se perdrait au premier nettoyage, et la fenêtre reviendrait sur son PC
-- (« plus jamais »). Par COMPTE, et pas par entreprise : un commercial ou la
-- facturation écrivent aussi des devis, et chacun doit l'avoir vue une fois.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne
-- ajoutée, nullable, aucune ligne réécrite. L'ancien code l'ignore ; NULL se
-- lit « pas encore vue ». `users` ne porte aucune politique RLS (la table
-- d'authentification, `charte-personne.ts`) : rien à prouver sur des lignes.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS aide_note_devis_vue_le timestamptz;

-- LES DROITS, COLONNE PAR COLONNE (migration 0064 : `atlas_app` ne lit ni
-- n'écrit `users` qu'aux colonnes nommées, pour qu'une injection ne puisse
-- jamais toucher au condensat du mot de passe). Sans ces deux lignes, la
-- colonne existe et l'application reçoit « permission denied for table
-- users » : trouvé par `test-aide-note-devis-db.ts`, rouge avant elles.
GRANT SELECT (aide_note_devis_vue_le) ON public.users TO atlas_app;
GRANT UPDATE (aide_note_devis_vue_le) ON public.users TO atlas_app;

COMMENT ON COLUMN users.aide_note_devis_vue_le IS
  'Quand la fenêtre « Ta note : ton client la lira ici » lui a été montrée. NULL : jamais.';
