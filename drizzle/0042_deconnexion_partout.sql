-- « Me déconnecter partout » : la seule colonne qu'il fallait.
--
-- Dessiné le 14 août 2026 (`maquettes/atlas-reglages-moi.html`, écran 3), codé
-- le même jour après sa réponse — « A » : le bouton plutôt que la liste des
-- appareils.
--
-- POURQUOI UNE DATE, ET PAS UNE TABLE DE SESSIONS. Atlas ne garde aucune
-- session en base : `src/auth.ts` pose `session: {strategy: "jwt"}`, et tout
-- tient dans un jeton signé chez l'artisan. Il n'y a donc rien à supprimer pour
-- fermer une session — mais on peut REFUSER les jetons émis avant un instant
-- donné, ce qui revient au même et ne coûte qu'une colonne. La liste des
-- appareils, elle, exigerait la table entière : c'est la proposition B, écartée
-- ce jour-là et pas pour toujours (`TODO.md` §0 octovicies).
--
-- NULLE VEUT DIRE « JAMAIS DEMANDÉ », et tous les jetons valent. Poser une date
-- d'origine à la création aurait déconnecté tout le monde à la migration.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS jetons_valides_depuis timestamptz;

COMMENT ON COLUMN users.jetons_valides_depuis IS
  'Tout jeton émis AVANT cet instant est refusé (« me déconnecter partout »). NULL : jamais demandé.';
