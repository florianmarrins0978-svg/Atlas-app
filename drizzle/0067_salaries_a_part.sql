-- LES SALARIÉS SE COMPTENT À PART DES ÉQUIPES
--
-- **Sa demande du 26 août 2026, éprouvée sur maquette avant d'être codée**
-- (`appli/salaries-et-equipes.html`, planche 97 — il a répondu **A**) :
--
--   *« Il faut avoir un curseur + ou − qui définit le nombre de salariés que
--     possède l'entreprise et pouvoir affilier des noms. Ceux-là permettront
--     d'ajouter ces noms au chantier, et plus les équipes A ou B. Néanmoins les
--     équipes doivent toujours servir à définir le niveau de remplissage du
--     planning : 2 équipes = 2 chantiers par jour, comme avant, ça ne bouge
--     pas. »*
--
-- Puis, sur le choix de la A :
--
--   *« Il ne faut pas changer la méthode d'affiliation des gars sur les
--     chantiers — juste, au lieu que ce soit les équipes, ce sera les noms
--     qu'on affilie. On garde la même façon de faire. »*
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QU'UN SEUL NOMBRE FAISAIT, ET QU'IL FAIT DE TROP
--
-- `entreprises.nombre_equipes` portait DEUX responsabilités :
--
--   1. la capacité du planning — deux équipes, deux chantiers par jour ;
--   2. combien de NOMS se règlent et s'affilient à un chantier.
--
-- Les deux n'ont aucune raison de coïncider : un paysagiste peut avoir quatre
-- salariés et ne mener qu'un chantier à la fois, et l'inverse existe aussi.
-- Tant qu'un seul chiffre les portait, régler l'un déréglait l'autre en
-- silence.
--
-- Cette migration ne fait donc qu'UNE chose : elle donne au second usage son
-- propre compteur. Le premier ne bouge pas d'un pouce — c'est sa consigne.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI AUCUNE TABLE N'EST CRÉÉE NI RENOMMÉE
--
-- La tentation était d'ouvrir une table `salaries`. Elle aurait fabriqué une
-- SECONDE liste de gens à côté de celle qui existe — c'est-à-dire deux vérités
-- sur qui travaille dans l'entreprise (`CLAUDE.md` §3), et la migration de
-- l'une vers l'autre à écrire.
--
-- Or la table `equipes` porte déjà exactement cela : un rang, un nom facultatif,
-- et c'est elle que `equipes_du_chantier` relie à une demi-journée. Le patron y
-- écrit des prénoms depuis le 10 août 2026 — *« soit équipe A équipe B, soit
-- l'utilisateur pourra mettre des noms et prénoms »*. Ces lignes SONT les gars.
--
-- **Ce qui change est donc leur compteur, pas leur nature**, et la façon de les
-- affilier ne bouge pas — ce qu'il a demandé mot pour mot.
--
-- ⚠ **DETTE ASSUMÉE, ÉCRITE ICI POUR QU'ELLE NE SE DEVINE PAS.** La table
-- s'appelle encore `equipes` alors qu'elle porte les salariés, et
-- `entreprises.nombre_equipes` porte, lui, la vraie capacité. Le renommage
-- (`equipes` → `salaries`, `equipes_du_chantier` → `salaries_du_chantier`)
-- touche vingt-trois fichiers de `src/`, quarante-quatre scripts de contrôle,
-- les politiques RLS et les contraintes : c'est un lot à lui seul, et le mêler
-- à un changement de comportement mettrait en risque une application qu'il
-- utilise tous les jours (sa consigne du 24 août : *« ne fais rien qui peut
-- endommager l'appli »*). Il est inscrit dans `TODO.md`.
-- ═══════════════════════════════════════════════════════════════════════════

-- **Défaut, zéro — et pas un.** Un artisan seul n'a personne à affilier : lui
-- proposer une case « Salarié 1 » à cocher sur chaque demi-journée serait lui
-- inventer une organisation qu'il n'a pas, exactement ce que `libelleEquipe`
-- évitait déjà à une seule équipe.
ALTER TABLE "entreprises"
  ADD COLUMN "nombre_salaries" integer NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA REPRISE DE L'EXISTANT — personne ne doit rien perdre
--
-- Trois choses doivent survivre à cette migration, et la troisième est la plus
-- facile à oublier :
--
--   · les NOMS déjà écrits (« Julien », « Antoine ») restent réglables ;
--   · les affiliations déjà posées sur des chantiers restent visibles ;
--   · **le planning continue de se remplir exactement pareil.** C'est là que se
--     joue sa consigne : le nouveau compteur part du nombre d'équipes, si bien
--     que le premier jour tout est identique au dernier jour d'avant.
--
-- Le compteur reprend donc le PLUS GRAND de :
--   · `nombre_equipes` — ce qu'il voyait s'afficher jusqu'ici ;
--   · le rang le plus haut réellement nommé — un nom écrit puis mis hors du
--     compteur ne doit pas disparaître de l'écran au premier chargement.
--
-- ───────────────────────────────────────────────────────────────────────────
-- **ELLE BOUCLE PAR ENTREPRISE, ET CE N'EST PAS UN ORNEMENT.**
--
-- **`equipes` porte `FORCE ROW LEVEL SECURITY`** — vérifié dans la base, pas
-- supposé (`pg_class.relforcerowsecurity`) : la politique s'applique même au
-- propriétaire de la table, et les migrations tournent justement sous
-- `atlas_owner` (`CLAUDE.md` §5). Un `UPDATE entreprises … FROM equipes` écrit
-- d'un seul trait lirait donc ZÉRO nom, sans la moindre erreur — et le défaut
-- serait silencieux : les compteurs repris trop bas, des noms déjà écrits
-- devenus inaccessibles, et rien pour le dire.
--
-- `entreprises`, elle, n'a aucune RLS (vérifié de même) : c'est bien la lecture
-- des ÉQUIPES qui impose la boucle, pas l'écriture du compteur.
--
-- C'est la mécanique des migrations 0036, 0037 et 0058, et pour la même raison.
-- Le `RAISE NOTICE` final n'est pas décoratif : une reprise qui ne reprend rien
-- doit se voir dans le journal, pas se deviner.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  ent record;
  hautNomme integer;
  valeur integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id, nombre_equipes FROM entreprises LOOP
    -- `true` : le réglage vaut pour la transaction seule. La migration ne
    -- laisse donc aucun contexte derrière elle.
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    SELECT COALESCE(MAX(rang), 0) INTO hautNomme
      FROM "equipes"
     WHERE "entreprise_id" = ent.id
       AND "nom" IS NOT NULL
       AND btrim("nom") <> '';

    -- **Un artisan SEUL reste à zéro, et c'est la ligne qui évite la
    -- régression.** À une seule équipe, `libelleEquipe` ne rendait déjà rien et
    -- aucune case n'était proposée sur les demi-journées. Reprendre
    -- `nombre_equipes = 1` en « 1 salarié » lui ferait apparaître du jour au
    -- lendemain une case « Salarié 1 » à cocher sur chaque matin et chaque
    -- après-midi — une organisation qu'il n'a pas, et qu'il n'a pas demandée.
    valeur := GREATEST(
      CASE WHEN COALESCE(ent.nombre_equipes, 0) > 1 THEN ent.nombre_equipes ELSE 0 END,
      hautNomme
    );

    UPDATE "entreprises" SET "nombre_salaries" = valeur WHERE "id" = ent.id;
    total := total + 1;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Compteur de salariés repris pour % entreprise(s)', total;
END $$;
