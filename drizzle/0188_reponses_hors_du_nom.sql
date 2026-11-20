-- Ses réponses à la grille quittent le nom du travail (`ARCHITECTURE.md` §594).
--
-- **Son « ok » du 20 novembre 2026**, après sa question : *« on a empilé des
-- règles sur des règles »*. Jusque-là, ses réponses d'« Avant de chiffrer »
-- étaient collées au libellé de la prestation, « Abattage d'un chêne
-- (abattage entre 10 et 20 m, ⌀ 80 cm) », puis reconnues, puis effacées de la
-- désignation. Le code ne les écrit plus ; celles d'avant reviennent ici à leur
-- nom, celui qu'il a dicté.
--
-- =========================================================================
-- Ce qu'elle retire, et rien d'autre
-- =========================================================================
--
-- Seulement ce que l'ancien code ajoutait : à la fin du libellé, après le nom
-- tel qu'il était au moment de la question (`precisions_chantier.libelle_prestation`),
-- « (réponses) » ou, avant le 28 octobre 2026, « — réponses ». Et **chaque
-- morceau** de ce qui est retiré doit être une de SES réponses enregistrées
-- pour ce travail (`lisible`) : « Haie (tout genre) (800 ml) », une quantité
-- recollée, ou une parenthèse qu'il a tapée, ne bougent pas. Ses réponses ne se
-- perdent pas : elles vivent dans `methode` et `caracteristiques`, et dans
-- `precisions_chantier`.
--
-- =========================================================================
-- La RLS forcée (la leçon de 0087)
-- =========================================================================
--
-- `prestations` et `precisions_chantier` sont sous FORCE ROW LEVEL SECURITY, et
-- le rôle qui migre n'a pas BYPASSRLS : sans contexte, l'UPDATE ne toucherait
-- rien, sans un mot. On boucle par entreprise (modèle 0037), et l'on compte.
-- Éprouvée sur une base habitée : `scripts/test-migration-0188-base-habitee.ts`.

DO $$
DECLARE
  ent record;
  touches integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    WITH bases AS (
      SELECT DISTINCT chantier_id, btrim(libelle_prestation) AS nom
      FROM precisions_chantier
      WHERE btrim(libelle_prestation) <> ''
    ),
    candidates AS (
      SELECT p.id, b.nom, b.chantier_id,
             CASE
               WHEN lower(left(btrim(p.libelle), length(b.nom) + 2)) = lower(b.nom) || ' ('
                    AND right(btrim(p.libelle), 1) = ')'
                 THEN substr(btrim(p.libelle), length(b.nom) + 3, length(btrim(p.libelle)) - length(b.nom) - 3)
               WHEN lower(left(btrim(p.libelle), length(b.nom) + 3)) = lower(b.nom) || ' — '
                 THEN substr(btrim(p.libelle), length(b.nom) + 4)
             END AS ajout
      FROM prestations p
      JOIN bases b ON b.chantier_id = p.chantier_id
    ),
    -- Le plus long nom d'abord : « Abattage d'un chêne » l'emporte sur
    -- « Abattage » quand les deux ont été questionnés sur le même chantier.
    retenues AS (
      SELECT DISTINCT ON (c.id) c.id, c.nom
      FROM candidates c
      WHERE c.ajout IS NOT NULL
        AND btrim(c.ajout) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(string_to_array(c.ajout, ', ')) AS morceau
          WHERE lower(btrim(morceau)) NOT IN (
            SELECT lower(btrim(q.lisible))
            FROM precisions_chantier q
            WHERE q.chantier_id = c.chantier_id
              AND lower(btrim(q.libelle_prestation)) = lower(c.nom)
          )
        )
      ORDER BY c.id, length(c.nom) DESC
    )
    UPDATE prestations p
    SET libelle = left(btrim(p.libelle), length(r.nom)),
        updated_at = now()
    FROM retenues r
    WHERE p.id = r.id;

    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Prestations rendues à leur nom, sans leurs réponses : %', total;
END $$;
