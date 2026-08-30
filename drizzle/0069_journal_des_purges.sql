-- SAVOIR QUAND LA PURGE A RÉELLEMENT TOURNÉ POUR LA DERNIÈRE FOIS.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- **LE DÉFAUT QUE CETTE TABLE FERME** — audit final du 29 août 2026, point
-- bloquant n° 1.
--
-- `/api/cron/purge-fichiers` existe, elle est authentifiée, et elle marche.
-- **Rien ne l'appelait**, et surtout : rien ne permettait de s'en apercevoir.
--
-- C'est ce second point qui est grave. Une purge qui ne tourne pas ne se
-- signale pas : il n'y a pas d'erreur, pas de page rouge, pas de ralentissement.
-- Les audios de dictée s'accumulent, les photos de diagnostic échues restent,
-- les fichiers en attente ne partent jamais — et tout a l'air normal. On ne le
-- découvrirait qu'en cherchant autre chose, des mois plus tard.
--
-- C'est exactement le défaut de la fiche d'espace figée (`CLAUDE.md` §1 bis) :
-- un garde-fou qu'on croit en place et qui dort.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- **POURQUOI UNE LIGNE PAR EXÉCUTION, ET NON UN SEUL HORODATAGE.**
--
-- Un unique champ « dernière purge » répondrait à « est-ce qu'elle tourne ? »
-- mais pas à « depuis quand a-t-elle cessé ? », ni à « combien a-t-elle purgé
-- la dernière fois ? ». Or c'est la seconde question qu'on se pose le jour où
-- l'on découvre le problème, et elle décide de ce qu'il faut réparer.
--
-- La table reste petite : la purge élague son propre journal (voir la fonction
-- appelée par la route), et une ligne par heure pendant un an tient dans
-- quelques milliers de lignes.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- **ELLE N'EST PAS CLOISONNÉE PAR ENTREPRISE, ET C'EST VOULU.**
--
-- La purge est une opération de maintenance globale : elle traverse toutes les
-- entreprises, et son journal n'appartient à aucune. Il ne porte d'ailleurs
-- **aucune donnée d'artisan** — des dates et des compteurs, rien d'autre.
--
-- C'est le même raisonnement que les files `audios_a_purger` et
-- `photos_diagnostic_a_purger`, et `scripts/test-toute-table-est-cloisonnee.ts`
-- ne la réclamera pas : elle ne porte pas de colonne `entreprise_id`.

CREATE TABLE IF NOT EXISTS "executions_purge" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- **L'instant de FIN, et seulement en cas de SUCCÈS.** Une purge qui échoue
  -- n'écrit rien : sans quoi l'horodatage dirait « tout va bien » pendant que
  -- rien n'est purgé — un faux vert, et le pire de tous puisqu'il rassure.
  "terminee_le" timestamptz NOT NULL DEFAULT now(),
  "fichiers_purges" integer NOT NULL DEFAULT 0,
  "audios_purges" integer NOT NULL DEFAULT 0,
  "photos_purgees" integer NOT NULL DEFAULT 0,
  "preuves_purgees" integer NOT NULL DEFAULT 0
);

-- La seule question qu'on pose à cette table : « quand la dernière ? ».
CREATE INDEX IF NOT EXISTS "executions_purge_terminee_le_idx"
  ON "executions_purge" ("terminee_le" DESC);

-- Le rôle applicatif écrit son exécution et lit la dernière. Il n'a pas besoin
-- de `UPDATE` : une exécution passée ne se corrige pas, elle s'ajoute.
GRANT SELECT, INSERT, DELETE ON "executions_purge" TO "atlas_app";
