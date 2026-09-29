-- LE MESSAGE DU DEVIS SUIT CE QUE L'ENVOI A FIXÉ.
--
-- Sa demande du 29 septembre 2026 : *« vérifie vraiment que si je décoche la
-- possibilité de laisser le client me proposer une date, le message qu'il voit
-- ne contient pas la mention : si aucune des dates proposées… »*. Il la
-- contenait : la phrase était écrite dans son texte, et aucun code ne savait
-- qu'elle dépendait de la case. Puis sa décision, planche
-- `appli/lien-valable-45-jours.html`, A : dire sous le lien jusqu'à quand il
-- répond, et qu'ensuite il faudra appeler.
--
-- Le message PAR DÉFAUT change dans le code (`MESSAGES_PAR_DEFAUT`) : une
-- entreprise qui n'a rien écrit (`message_client` nul) le reçoit sans rien
-- faire. Cette migration porte la même chose dans les messages qu'il a DÉJÀ
-- réécrits, sans toucher à ses mots :
--
--   1. la phrase « autre date », si elle y est MOT POUR MOT, devient
--      `[autre-date]`, qu'Atlas pose ou retire selon la case ;
--   2. `[validite]` se pose sous le premier `[lien]`, sur sa propre ligne,
--      s'il n'y est pas déjà. Elle est obligatoire pour un devis
--      (`refusDuMessage`).
--
-- **Ce qu'elle ne fait pas, et le dit** : une phrase « autre date »
-- REFORMULÉE par lui ne se reconnaît pas ; elle reste, et elle est à lui. Un
-- message trop long pour recevoir `[validite]` sans dépasser la borne de 2 000
-- caractères (0062) est laissé tel quel : l'écran des réglages le refusera à
-- son prochain enregistrement, en disant pourquoi. Les deux se comptent
-- ci-dessous.
--
-- `entreprises` n'est pas sous RLS : le propriétaire voit toutes les lignes.
-- Les comptes le prouvent quand même, plutôt que de le supposer
-- (`.claude/rules/migrations.md`).

DO $$
DECLARE
  phrase constant text := ' Et si aucune des dates proposées ne vous convient, vous pouvez en proposer une autre.';
  avec_phrase integer;
  sans_duree integer;
  trop_longs integer;
BEGIN
  UPDATE entreprises
  SET message_client = replace(message_client, phrase, '[autre-date]')
  WHERE message_client IS NOT NULL
    AND position(phrase in message_client) > 0;
  GET DIAGNOSTICS avec_phrase = ROW_COUNT;

  UPDATE entreprises
  SET message_client = regexp_replace(message_client, '\[lien\]', E'[lien]\n\n[validite]')
  WHERE message_client IS NOT NULL
    AND position('[validite]' in message_client) = 0
    AND position('[lien]' in message_client) > 0
    AND length(message_client) + length(E'\n\n[validite]') <= 2000;
  GET DIAGNOSTICS sans_duree = ROW_COUNT;

  SELECT count(*) INTO trop_longs
  FROM entreprises
  WHERE message_client IS NOT NULL
    AND position('[validite]' in message_client) = 0;

  RAISE NOTICE '0115 : % message(s) avec la phrase « autre date » rendue à la case, % reçu(s) la durée du lien, % laissé(s) sans durée (trop longs ou sans lien).',
    avec_phrase, sans_duree, trop_longs;
END $$;
