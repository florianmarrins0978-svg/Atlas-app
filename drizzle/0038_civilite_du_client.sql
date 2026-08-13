-- La civilité devient une DONNÉE, au lieu d'être devinée.
--
-- **Le patron, le 13 août 2026 :** *« tu as raison, il faut intégrer une case
-- monsieur-madame. Mais je veux que ça soit sous la forme Mr Mme, en cliquable,
-- on choisit au-dessus du nom. »*
--
-- =========================================================================
-- Ce que ça répare, et qui n'était pas un détail
-- =========================================================================
--
-- Depuis ce matin, l'application écrivait « Mr. » devant tout nom qui n'en
-- portait pas déjà un — sur le devis, et surtout dans le message qui part chez
-- le client. C'était un DÉFAUT, pas une donnée : rien ne disait si « Roux »
-- était un homme, une femme ou une société, et une cliente recevait donc
-- « Bonjour Mr. Roux ». La réserve était écrite noir sur blanc dans
-- `src/lib/civilite.ts` et dans `TODO.md` ; il l'a tranchée le soir même.
--
-- =========================================================================
-- Pourquoi la colonne est NULLABLE, et le restera
-- =========================================================================
--
-- Trois états, et non deux :
--
--   'mr'   — il l'a choisi
--   'mme'  — il l'a choisi
--   NULL   — il n'a rien choisi
--
-- **NULL n'est pas « inconnu par erreur » : c'est le cas le plus courant.** Une
-- société n'est ni l'un ni l'autre, et un client saisi à la volée sur un
-- chantier n'a pas toujours eu droit à un appui de plus. Forcer un défaut en
-- base rendrait ce silence indiscernable d'un choix — exactement le piège que
-- `equipes.nom` a déjà appris à éviter (`ARCHITECTURE.md` §51).
--
-- Ce que NULL vaut à l'AFFICHAGE est décidé ailleurs, dans `avecCivilite`, et
-- nulle part ici : la base garde ce qu'il a dit, l'écran décide ce qu'il montre.
--
-- =========================================================================
-- Pourquoi le devis et la facture en gardent une COPIE
-- =========================================================================
--
-- Les deux tables recopient déjà `client_nom`, `client_adresse`,
-- `client_telephone`, `client_email` au moment où le document est établi : un
-- devis est une pièce, il doit dire ce qui a été proposé ce jour-là. La
-- civilité suit la même règle, sans quoi corriger une fiche client réécrirait
-- la façon dont un devis DÉJÀ PARTI s'adresse à son destinataire — ce que le
-- déclencheur `empecher_modification_devis_envoye` interdit par ailleurs.

ALTER TABLE clients  ADD COLUMN IF NOT EXISTS civilite text;
ALTER TABLE devis    ADD COLUMN IF NOT EXISTS client_civilite text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_civilite text;

-- Deux valeurs, et rien d'autre. Une contrainte plutôt qu'un type énuméré :
-- élargir un `CHECK` est une migration d'une ligne, changer un type en est une
-- de dix — et la question « et les sociétés ? » se rouvrira (`TODO.md`).
ALTER TABLE clients  DROP CONSTRAINT IF EXISTS clients_civilite_connue;
ALTER TABLE clients  ADD  CONSTRAINT clients_civilite_connue
  CHECK (civilite IS NULL OR civilite IN ('mr', 'mme'));
ALTER TABLE devis    DROP CONSTRAINT IF EXISTS devis_client_civilite_connue;
ALTER TABLE devis    ADD  CONSTRAINT devis_client_civilite_connue
  CHECK (client_civilite IS NULL OR client_civilite IN ('mr', 'mme'));
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_client_civilite_connue;
ALTER TABLE factures ADD  CONSTRAINT factures_client_civilite_connue
  CHECK (client_civilite IS NULL OR client_civilite IN ('mr', 'mme'));

-- **Aucune reprise des clients existants, et c'est délibéré.** Leur poser
-- « mr » d'office reviendrait à inscrire en base la supposition qu'on vient de
-- retirer, et il n'y aurait plus moyen de distinguer ceux qu'il a vraiment
-- choisis. Ils restent NULL, l'affichage continue de faire ce qu'il faisait
-- ce matin, et il corrige au fil de l'eau depuis l'écran du devis.
