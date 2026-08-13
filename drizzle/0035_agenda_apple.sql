-- L'agenda iCloud : le lire, et y écrire.
--
-- **Sa demande du 12 août 2026**, capture du Calendrier d'Apple à l'appui :
-- *« je peux connecter ce calendrier à mon appli ? »* — puis, aux deux
-- questions posées : le compte derrière la vitrine est **iCloud**, et il veut
-- **les deux sens**.
--
-- =========================================================================
-- Pourquoi la colonne `fournisseur` existait déjà, et ce qu'elle attendait
-- =========================================================================
--
-- La migration 0032 l'avait posée avec un seul fournisseur autorisé, en
-- écrivant : « la colonne existe pour que le jour où un artisan tient son
-- agenda ailleurs, la question ne rouvre pas la table ». Ce jour est arrivé.
-- Rien à restructurer : une contrainte s'élargit, quatre colonnes s'ajoutent.
--
-- =========================================================================
-- Pourquoi un mot de passe, là où Google a des jetons
-- =========================================================================
--
-- Parce qu'Apple n'offre AUCUN équivalent au bouton « accepter » de Google
-- pour l'agenda : « Se connecter avec Apple » ne rend qu'une identité, jamais
-- le calendrier. Le seul chemin praticable est CalDAV avec un mot de passe
-- spécifique à l'app, que l'artisan génère sur son compte Apple.
--
-- **Ce mot de passe ouvre TOUT l'iCloud** — mail, contacts, fichiers — et pas
-- seulement l'agenda : Apple ne sait pas le restreindre à un service. Il est
-- donc chiffré avant écriture (`src/server/agenda/secret-au-repos.ts`), comme
-- les jetons Google et pour la même raison — la RLS protège d'un autre
-- artisan, pas d'une sauvegarde recopiée. Et l'écran le dit AVANT de le faire
-- taper : prévenir après la frappe, c'est prévenir trop tard.
--
-- =========================================================================
-- Ce que cette table ne contient toujours PAS
-- =========================================================================
--
-- Aucun événement, aucun intitulé, aucune heure. Atlas interroge l'agenda au
-- moment où il en a besoin et n'en garde rien. Ce qui s'ajoute ici, ce sont
-- des ADRESSES d'agendas — pas leur contenu.

ALTER TABLE "agendas_externes"
  DROP CONSTRAINT IF EXISTS "agendas_externes_fournisseur_check";

-- Le nom exact de la contrainte posée en 0032 dépend de PostgreSQL, qui la
-- baptise « <table>_<colonne>_check ». On la retire par son nom déduit
-- ci-dessus, puis on repose la nôtre, nommée explicitement — pour qu'une
-- prochaine migration n'ait plus à deviner.
ALTER TABLE "agendas_externes"
  ADD CONSTRAINT "agendas_externes_fournisseur_connu"
  CHECK ("fournisseur" IN ('google', 'apple'));

-- Le mot de passe spécifique à l'app, CHIFFRÉ. Voir l'en-tête.
ALTER TABLE "agendas_externes"
  ADD COLUMN IF NOT EXISTS "mot_de_passe" text;

-- Les agendas qu'Atlas LIT, par leur adresse CalDAV.
--
-- Plusieurs, parce qu'un compte iCloud en porte plusieurs — « Perso »,
-- « Travail », « Famille » — et qu'être pris le mardi matin ne dépend pas de
-- l'agenda où le rendez-vous a été noté. Le vide vaut « tous ceux qu'on a
-- trouvés » : c'est le comportement utile pour quelqu'un qui vient de relier
-- son compte et n'a rien choisi.
ALTER TABLE "agendas_externes"
  ADD COLUMN IF NOT EXISTS "agendas_lus" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- L'agenda où Atlas ÉCRIT ses chantiers, et son nom pour l'écran.
--
-- Un seul : écrire le même chantier dans deux agendas produirait deux
-- rendez-vous là où l'artisan en attend un.
ALTER TABLE "agendas_externes"
  ADD COLUMN IF NOT EXISTS "calendrier_ecriture" text;
ALTER TABLE "agendas_externes"
  ADD COLUMN IF NOT EXISTS "calendrier_ecriture_nom" text;

-- **ÉTEINT par défaut, et ce n'est pas une prudence de façade.** Écrire dans
-- l'agenda personnel de quelqu'un est une décision qui lui appartient. Un
-- réglage allumé d'office la lui prendrait — et il découvrirait ses chantiers
-- dans son calendrier familial sans avoir rien demandé.
ALTER TABLE "agendas_externes"
  ADD COLUMN IF NOT EXISTS "ecriture_active" boolean NOT NULL DEFAULT false;

-- Quand Atlas a écrit dans l'agenda pour la dernière fois, et si ça s'est mal
-- passé. Même raison que `derniere_erreur` pour la lecture : une écriture qui
-- a cessé de fonctionner doit se VOIR, sinon l'artisan croit ses chantiers
-- dans son téléphone alors qu'ils n'y sont plus.
ALTER TABLE "agendas_externes"
  ADD COLUMN IF NOT EXISTS "derniere_ecriture_at" timestamptz;
ALTER TABLE "agendas_externes"
  ADD COLUMN IF NOT EXISTS "derniere_erreur_ecriture" text;
