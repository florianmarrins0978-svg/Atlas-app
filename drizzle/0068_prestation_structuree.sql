-- LA PRESTATION CESSE D'ÊTRE UNE SEULE CHAÎNE DE TEXTE
--
-- **Ce que le patron a lu sur son devis le 26 août 2026**, après avoir dicté
-- depuis son iPhone :
--
--   « Haie (tout genre) (800 ml) »   Qté 1   0 € HT
--
-- Le modèle avait pourtant bien compris : il rendait `quantite: "800"` et
-- `unite: "ml"`. C'est `libelleAvecQuantite` qui les recollait au nom — parce
-- que cette table n'avait **aucune colonne où les poser**. Six informations sur
-- neuf vivaient dans `libelle`, et quatre morceaux de code les en ressortaient
-- ensuite à coups d'expressions régulières.
--
-- ─── Ce que cette migration fait, et surtout ce qu'elle NE fait PAS ─────────
--
-- Elle **ajoute des colonnes vides**. Elle ne réécrit rien, ne remplit rien, ne
-- devine rien. Les anciennes prestations gardent leur libellé intact, y compris
-- le « (800 ml) » qui y est collé : les moteurs de prix le relisent encore, et
-- le leur retirer avant qu'ils sachent lire ces colonnes ferait perdre à une
-- haie son prix au mètre linéaire — sur un devis qui part chez un client.
--
-- **Toutes les colonnes sont donc NULLABLES, y compris les booléens.** Un
-- `NOT NULL DEFAULT false` sur `a_confirmer` aurait affirmé de chaque ancienne
-- prestation qu'elle ne portait aucun doute — ce que personne ne sait. NULL dit
-- « on ne sait pas » ; `false` dit « on a regardé, il n'y en avait pas ». Ce
-- n'est pas la même chose, et c'est exactement la règle du patron : une donnée
-- inconnue reste inconnue.
--
-- ─── Pourquoi `caracteristiques` est un JSONB et non six colonnes ───────────
--
-- Le diamètre et la hauteur gouvernent le prix d'un abattage ; la longueur
-- gouverne celui d'une haie ; le tonnage celui des grumes. Un paysagiste qui
-- planterait chiffrerait au litre de terreau. Une colonne par mesure ferait une
-- table qui s'allonge à chaque métier — et quinze colonnes vides sur seize
-- lignes. Ce qui est mesuré vit donc dans un objet, et ce qui gouverne le prix
-- reste décidé par le code, pas par le schéma.

ALTER TABLE "prestations"
  -- Ce que l'artisan a dit, en chiffres. NULL quand il n'a rien dit — jamais 1
  -- « par défaut » : c'est ce défaut-là qui a mis « Qté 1 » sur ses 800 mètres.
  ADD COLUMN IF NOT EXISTS "quantite" numeric(10, 2),

  -- Son mot à lui, à la lettre : « ml », « m² », « heure », « stère ». Jamais
  -- normalisé à notre convenance — réécrire ses unités changerait ses prix sans
  -- qu'il l'ait demandé (`src/lib/unites-tarif.ts`).
  ADD COLUMN IF NOT EXISTS "unite" text,

  -- Le genre de travail : abattage, haie, fendage… Vide tant que rien de sûr
  -- ne le donne. Le déduire du libellé par expression régulière serait
  -- recopier ici le défaut qu'on répare.
  ADD COLUMN IF NOT EXISTS "nature" text,

  -- L'essence : laurier, érable, thuya. **Elle n'existait NULLE PART** — ni
  -- champ, ni motif, ni colonne — alors qu'elle décide du temps de taille et
  -- du matériel. Elle restera vide tant que la dictée ne la rendra pas.
  ADD COLUMN IF NOT EXISTS "espece" text,

  -- La façon de faire : « démontage avec rétention », « au pied ». Elle EXISTE
  -- déjà comme donnée sûre, dans `precisions_chantier` — c'est sa réponse à
  -- l'arrêt d'avant-chiffrage. On la recopie ici, on ne l'invente pas.
  ADD COLUMN IF NOT EXISTS "methode" text,

  -- Ce qui se mesure : diamètre, hauteur, longueur, tonnage. Alimenté par ses
  -- réponses, jamais par une lecture du libellé.
  ADD COLUMN IF NOT EXISTS "caracteristiques" jsonb,

  -- Le drapeau du modèle : « présent mais incertain ». NULL = on ne sait pas
  -- (toutes les prestations d'avant), false = le modèle a regardé et n'a rien
  -- signalé, true = il hésite.
  ADD COLUMN IF NOT EXISTS "a_confirmer" boolean;

-- Une quantité négative ou nulle n'est pas une quantité : c'est une donnée
-- fausse qui se multiplierait par un prix.
ALTER TABLE "prestations" DROP CONSTRAINT IF EXISTS "prestations_quantite_positive";
ALTER TABLE "prestations"
  ADD CONSTRAINT "prestations_quantite_positive"
  CHECK ("quantite" IS NULL OR "quantite" > 0);

-- **La quantité sans son unité ne veut rien dire.** « 800 » tout seul se lirait
-- 800 mètres, 800 m² ou 800 heures selon qui regarde — et c'est précisément
-- l'ambiguïté qui a produit « Qté 1 » puis un prix faux. Les deux entrent
-- ensemble ou pas du tout.
ALTER TABLE "prestations" DROP CONSTRAINT IF EXISTS "prestations_quantite_avec_unite";
ALTER TABLE "prestations"
  ADD CONSTRAINT "prestations_quantite_avec_unite"
  CHECK (("quantite" IS NULL) = ("unite" IS NULL));

-- Un objet, jamais une liste ni un nombre : les lecteurs y cherchent des clés.
ALTER TABLE "prestations" DROP CONSTRAINT IF EXISTS "prestations_caracteristiques_objet";
ALTER TABLE "prestations"
  ADD CONSTRAINT "prestations_caracteristiques_objet"
  CHECK ("caracteristiques" IS NULL OR jsonb_typeof("caracteristiques") = 'object');

-- **De quoi désigner une prestation SANS pouvoir viser celle d'une autre
-- société.** Même patron que `lignes_prix_id_entreprise_uk` (migration 0023) :
-- la clé étrangère qui vient portera les DEUX colonnes, si bien qu'un
-- identifiant volé chez un autre artisan ne référence rien.
ALTER TABLE "prestations" DROP CONSTRAINT IF EXISTS "prestations_id_entreprise_uk";
ALTER TABLE "prestations"
  ADD CONSTRAINT "prestations_id_entreprise_uk" UNIQUE ("id", "entreprise_id");

COMMENT ON COLUMN "prestations"."quantite" IS
  'Ce que l''artisan a dicté, en chiffres. NULL = il n''a rien dit — jamais 1 par défaut.';
COMMENT ON COLUMN "prestations"."unite" IS
  'Son mot à lui, à la lettre : ml, m², heure, stère. Jamais normalisé à notre convenance.';
COMMENT ON COLUMN "prestations"."caracteristiques" IS
  'Ce qui se mesure et gouverne le prix — diametreCm, hauteurM, longueurMl, tonnageT. Alimenté par ses réponses à l''arrêt, jamais par une relecture du libellé.';
COMMENT ON COLUMN "prestations"."a_confirmer" IS
  'NULL = on ne sait pas (prestations d''avant le 26 août 2026) ; false = le modèle n''a rien signalé ; true = il hésite.';
