-- « Mr. Martins », et non « Monsieur Martins ».
--
-- **Le patron, le 13 août 2026, après avoir vu le mot en entier à l'écran :**
-- *« Mr. Martins, pas Monsieur. »* C'est sa forme, sur ses documents. L'usage
-- français écrirait « M. » ; c'est lui qui signe les devis.
--
-- =========================================================================
-- Pourquoi une SECONDE migration, et pas une correction de la 0036
-- =========================================================================
--
-- La 0036 est **déjà appliquée** — ici, et sur son banc dès qu'il l'aura pris.
-- Une migration jouée ne se réécrit pas : le lanceur ne la rejouerait pas, et
-- les bases où elle est passée garderaient « Monsieur » pour toujours pendant
-- que le code dirait « Mr. ». Deux vérités, et personne pour trancher.
--
-- Les deux ordres fonctionnent : sur une base neuve, 0036 écrit « Monsieur X »
-- puis 0037 le reprend ; sur une base à jour, 0037 seule s'applique.
--
-- =========================================================================
-- La RLS forcée, encore — la leçon de la 0036 vaut ici mot pour mot
-- =========================================================================
--
-- `chantiers` et `clients` portent la RLS en mode FORCÉ, le propriétaire y
-- compris. Sans `app.entreprise_id` posé, aucune ligne n'est visible et
-- l'UPDATE passe dans le vide **sans un mot** (`ARCHITECTURE.md` §77). On
-- boucle donc sur les entreprises en posant le contexte de chacune, et on ne
-- désactive jamais la RLS (`CLAUDE.md` §4).
--
-- =========================================================================
-- Ce qu'elle ne touche pas
-- =========================================================================
--
-- Uniquement les noms valant **exactement** « Monsieur » suivi du nom du client
-- rattaché — c'est-à-dire ceux que la 0036 a écrits. Un chantier nommé à la
-- main « Monsieur Bricolage » n'appartient à aucun client de ce nom et reste
-- intact.

DO $$
DECLARE
  ent record;
  touches integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    UPDATE chantiers c
    SET nom = 'Mr. ' || cl.nom,
        updated_at = now()
    FROM clients cl
    WHERE cl.id = c.client_id
      AND c.nom = 'Monsieur ' || cl.nom;

    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Chantiers passés de « Monsieur » à « Mr. » : %', total;
END $$;
