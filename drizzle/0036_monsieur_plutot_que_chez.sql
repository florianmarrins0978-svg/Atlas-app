-- « Monsieur Martins », et non plus « Chez Martins ».
--
-- **Le patron, le 13 août 2026, capture de son devis à l'appui :** *« il faut
-- qu'il y ait écrit monsieur Martins et pas chez Martins »*.
--
-- =========================================================================
-- Pourquoi une migration, et pas seulement du code
-- =========================================================================
--
-- `nomDuChantier` (src/lib/nom-chantier.ts) ne s'exécute qu'à LA CRÉATION : le
-- nom est ensuite écrit dans `chantiers.nom` et ne bouge plus. Corriger la
-- fonction seule aurait donc laissé « Chez Martins » en tête de l'écran que le
-- patron a photographié — le défaut qu'il signale serait resté intact sur tous
-- ses chantiers en cours, et n'aurait disparu que sur les suivants.
--
-- =========================================================================
-- POURQUOI CETTE BOUCLE, ET NE JAMAIS LA REMPLACER PAR UN SIMPLE UPDATE
-- =========================================================================
--
-- Première version écrite : un `UPDATE chantiers … FROM clients …` tout simple.
-- Elle s'est appliquée sans erreur, a rapporté un succès, et **n'a rien
-- changé** — vérifié sur quatre chantiers d'épreuve, tous restés « Chez … ».
--
-- `chantiers` et `clients` portent la RLS en mode FORCÉ (`relforcerowsecurity`)
-- avec la politique `tenant_isolation` :
--
--     entreprise_id = NULLIF(current_setting('app.entreprise_id', true), '')::uuid
--
-- Le propriétaire lui-même y est soumis. Sans contexte posé, `current_setting`
-- rend la chaîne vide, le prédicat vaut NULL, et **aucune ligne n'est visible**.
-- L'UPDATE touche zéro ligne, sans un mot : c'est très exactement le piège que
-- `CLAUDE.md` §3 décrit — « une requête hors de ce cadre ne renvoie rien,
-- *silencieusement* ».
--
-- **On ne désactive pas la RLS pour autant** (`CLAUDE.md` §4). On fait ce que
-- le dépôt fait déjà pour les travaux sans contexte : on traite **entreprise
-- par entreprise**, en posant le contexte de chacune. C'est la même mécanique
-- que la file `audios_a_purger`.
--
-- Les migrations précédentes qui modifiaient des données ne touchaient que
-- `termes_metier`, table SANS RLS forcée : rien dans le dépôt n'avait encore
-- rencontré ce cas. C'est écrit ici pour que la prochaine ne le redécouvre pas.
--
-- =========================================================================
-- Ce que cette migration NE touche pas, et c'est l'essentiel
-- =========================================================================
--
-- Elle ne réécrit un nom que s'il vaut **exactement** « Chez » suivi du nom du
-- client rattaché au chantier — c'est-à-dire uniquement les noms que
-- l'application a fabriqués elle-même. Un chantier que le patron a nommé à la
-- main (« Abattage rue des Lilas », « Chez le voisin du maire ») n'entre dans
-- aucune de ces conditions et reste tel quel : sa saisie lui appartient.
--
-- Et la civilité n'est ajoutée que si le nom du client n'en porte pas déjà une,
-- ni de marque de société. C'est la même règle que `src/lib/civilite.ts`, avec
-- la même liste — deux implémentations d'une même règle finissent toujours par
-- diverger (`CLAUDE.md` §3), aussi un contrôle les confronte-t-il l'une à
-- l'autre : `scripts/test-civilite.ts`, cas « la migration et la fonction
-- disent la même chose ».
--
-- Réversible sans perte : le nom se reconstruit du client dans les deux sens.

DO $$
DECLARE
  ent record;
  touches integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    -- `true` : le réglage vaut pour la transaction seule. La migration ne
    -- laisse donc aucun contexte derrière elle.
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    -- **« Chez » disparaît dans les deux cas, et c'est ce qu'il a demandé.**
    -- Un nom nu reçoit la civilité ; un nom qui en porte déjà une, ou une
    -- raison sociale, perd seulement le « Chez » — « Chez Mme Roux » devient
    -- « Mme Roux », jamais « Monsieur Mme Roux ». C'est exactement ce que rend
    -- `avecCivilite` en TypeScript pour un chantier créé aujourd'hui : les
    -- anciens chantiers rejoignent ainsi les nouveaux.
    UPDATE chantiers c
    SET nom = CASE
          WHEN
            -- <predicat-civilite> — extrait tel quel par `scripts/test-civilite.ts`,
            -- qui le confronte à `porteDejaSonAppellation`. NE PAS le recopier
            -- ailleurs ni déplacer ces deux repères.
            lower(split_part(regexp_replace(cl.nom, '^[^[:alnum:]]+', ''), ' ', 1))
              NOT IN ('m', 'm.', 'mr', 'mr.', 'mme', 'mme.', 'mmes', 'mlle', 'mlle.',
                      'melle', 'mm', 'mm.', 'monsieur', 'messieurs', 'madame',
                      'mesdames', 'mademoiselle', 'dr', 'dr.', 'docteur', 'me', 'me.',
                      'maitre', 'maître')
            AND NOT (
              -- Un marqueur de société peut se trouver n'importe où dans la
              -- raison sociale : « Untel SARL » se rencontre autant que
              -- « SARL Untel ».
              lower(cl.nom) ~ '(^|[^[:alnum:]])(sarl|sas|sasu|sa|eurl|sci|scp|snc|ei|eirl|scop|gaec|association|asso|syndic|copropriete|copropriété|mairie|commune|ville|societe|société|entreprise|etablissements|établissements|ets|cabinet|groupe|cie)([^[:alnum:]]|$)'
            )
            -- </predicat-civilite>
          THEN 'Monsieur ' || cl.nom
          ELSE cl.nom
        END,
        updated_at = now()
    FROM clients cl
    WHERE cl.id = c.client_id
      -- Le nom a bien été fabriqué par l'application, mot pour mot. Un nom
      -- donné à la main ne remplit jamais cette condition.
      AND c.nom = 'Chez ' || cl.nom;

    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Chantiers renommés « Monsieur … » : %', total;
END $$;
