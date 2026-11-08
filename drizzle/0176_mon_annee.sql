-- MON ANNÉE : l'objectif de l'année, et s'il se montre sur Terminés.
--
-- Sa planche du 8 novembre 2026 (`appli/soignee/mon-annee.html`), puis son
-- « tu peux coder ça » du même jour. Deux choses, et rien d'autre :
--
--   · `objectifs_annee` : un objectif PAR ANNÉE CIVILE. Le chiffre
--     d'affaires HT, obligatoire ; le bénéfice, s'il veut le suivre. Une
--     année neuve part sans objectif : rien n'est recopié de l'an dernier,
--     rien ne s'invente (`docs/AGENT.md` §3). Garder les années passées
--     permet un jour de dire « objectif 2025 tenu ou non » sans le lui
--     redemander ;
--
--   · `entreprises.mon_annee_sur_termines` : sa règle, *« il ne faut pas que
--     ça s'affiche de base sur la page Terminés »*. Faux par défaut, donc
--     pour toutes les entreprises existantes : aucune ne voit apparaître une
--     ligne qu'elle n'a pas demandée.
--
--   · `pieces_importees.montant_ht` et `ht_cherche_le` : le HT d'une facture
--     importée. L'import ne lisait que le TTC ; mêlé à du HT, l'an dernier
--     d'un artisan assujetti paraissait plus haut qu'il n'était. Sa question
--     du 8 novembre : *« la limite, comment on peut corriger ce problème ? »*,
--     puis *« tu peux les lire avec l'IA aussi »*. Les factures déjà importées
--     se relisent une fois (`chercherLesHt`), `ht_cherche_le` dit que c'est
--     fait : un HT qui ne se lit pas reste NULL, jamais déduit du TTC.
--
-- **EXPAND SEUL** : une table neuve, trois colonnes neuves (une avec sa valeur
-- par défaut, deux NULL). Aucune ligne existante n'est lue ni réécrite
-- (PostgreSQL pose la valeur par défaut sans réécrire la table) : rien à
-- éprouver sur une base habitée, et le code d'avant, qui ignore tout cela,
-- tourne tel quel dessus.

ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "mon_annee_sur_termines" boolean NOT NULL DEFAULT false;

-- Les droits de `pieces_importees` sont posés sur la table (0136) : ils
-- couvrent ces deux colonnes sans rien redire.
ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "montant_ht" numeric(12, 2);
ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "ht_cherche_le" timestamptz;

CREATE TABLE IF NOT EXISTS "objectifs_annee" (
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "annee" smallint NOT NULL,
  "chiffre_affaires_ht" numeric(12, 2) NOT NULL,
  "benefice" numeric(12, 2),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "objectifs_annee_pk" PRIMARY KEY ("entreprise_id", "annee"),
  -- Les mêmes bornes que `src/lib/mon-annee.ts` (`objectifValide`) : la base
  -- refuse ce que l'écran aurait dû refuser, sans en être la seule garde.
  CONSTRAINT "objectifs_annee_annee_ck" CHECK ("annee" BETWEEN 2000 AND 2100),
  CONSTRAINT "objectifs_annee_ca_ck" CHECK ("chiffre_affaires_ht" > 0),
  CONSTRAINT "objectifs_annee_benefice_ck" CHECK ("benefice" IS NULL OR "benefice" >= 0)
);

-- **Sous RLS** comme le reste : une entreprise ne lit que ses objectifs.
ALTER TABLE "objectifs_annee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "objectifs_annee" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "objectifs_annee_isolation" ON "objectifs_annee";
CREATE POLICY "objectifs_annee_isolation" ON "objectifs_annee"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Les droits par défaut donnent tout à `atlas_app` (0081) : on retire, puis on
-- rend lire, poser et changer. Effacer n'a pas d'usage : un objectif se change.
REVOKE ALL ON "objectifs_annee" FROM atlas_app;
GRANT SELECT, INSERT, UPDATE ON "objectifs_annee" TO atlas_app;
