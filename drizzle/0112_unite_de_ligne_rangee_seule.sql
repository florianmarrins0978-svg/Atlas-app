-- L'unité d'une ligne ne porte que la rangée : u, ml, m², m³, kg, h, forfait.
--
-- **Sa règle du 29 septembre 2026 :** *« dans l'unité, il ne peut pas y avoir
-- la mention arbre ; quand je parle d'un arbre, d'un arbuste ou d'une plante,
-- c'est la mention U qui doit apparaître »*, puis *« corrige à la racine »*.
--
-- Le code n'écrit plus que la rangée (`uniteAdmise`, `src/lib/unite-de-ligne.ts`).
-- Cette migration reprend ce qu'il avait écrit AVANT : sans elle, la ligne de
-- sa capture garderait « arbre ».
--
-- =========================================================================
-- Ce qu'elle touche, et ce qu'elle ne touche pas
-- =========================================================================
--
-- Les lignes de TRAVAIL seulement : `lignes_prix`, et les lignes d'un devis ou
-- d'une facture encore en BROUILLON. Un devis envoyé, une facture émise sont
-- partis chez le client : les réécrire changerait un document déjà remis.
--
-- Une forme dite se ramène à la rangée (« m2 » : m², « heure » : h), comme le
-- fait `uniteAdmise`. Tout autre mot devient NULL, qui s'imprime « u »
-- (`uniteDeLaLigne`) : on n'invente pas « u » en base, on retire le mot faux.
--
-- =========================================================================
-- Les trois tables portent FORCE ROW LEVEL SECURITY
-- =========================================================================
--
-- `atlas_owner` n'a pas BYPASSRLS : sans contexte, l'UPDATE toucherait zéro
-- ligne sans un mot (`.claude/rules/migrations.md`, panne du 13 septembre
-- 2026). On boucle donc par entreprise, et l'on compte.

CREATE OR REPLACE FUNCTION pg_temp.unite_admise(brut text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL OR d = '' THEN NULL
    WHEN d ~ '^(u|unit(e|é)s?)$' THEN 'u'
    WHEN d ~ '^(ml|m(e|è)tres? ?lin(e|é)aires?|m ?lin(e|é)aires?)$' THEN 'ml'
    WHEN d ~ '^(m2|m²|m(e|è)tres? ?carr(e|é)s?)$' THEN 'm²'
    WHEN d ~ '^(m3|m³|m(e|è)tres? ?cubes?)$' THEN 'm³'
    WHEN d ~ '^(kg|kilos?|kilogrammes?)$' THEN 'kg'
    WHEN d ~ '^(h|heures?)$' THEN 'h'
    WHEN d ~ '^(forfaits?|au ?forfait)$' THEN 'forfait'
    ELSE NULL
  END
  FROM (SELECT lower(regexp_replace(btrim(brut), '\s+', ' ', 'g')) AS d) s
$$;

DO $$
DECLARE
  ent record;
  touches integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    UPDATE lignes_prix
    SET unite = pg_temp.unite_admise(unite), updated_at = now()
    WHERE unite IS DISTINCT FROM pg_temp.unite_admise(unite);
    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;

    UPDATE lignes_devis l
    SET unite = pg_temp.unite_admise(l.unite)
    FROM devis d
    WHERE d.id = l.devis_id AND d.statut = 'brouillon'
      AND l.unite IS DISTINCT FROM pg_temp.unite_admise(l.unite);
    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;

    UPDATE lignes_facture l
    SET unite = pg_temp.unite_admise(l.unite)
    FROM factures f
    WHERE f.id = l.facture_id AND f.statut = 'brouillon'
      AND l.unite IS DISTINCT FROM pg_temp.unite_admise(l.unite);
    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Unités de ligne ramenées à la rangée : %', total;
END $$;
