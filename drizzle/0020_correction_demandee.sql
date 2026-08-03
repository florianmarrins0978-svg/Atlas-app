-- Le client peut demander une correction, et son message parvient au patron.
--
-- **Ce qui n'allait pas.** Le client n'avait que deux issues : accepter, ou ne
-- pas donner suite. Celui qui repère une faute ne veut ni l'une ni l'autre —
-- il veut le même devis, corrigé. Faute de troisième voie, il touchait « Je ne
-- donne pas suite », et le patron lisait « Le client n'a pas donné suite » :
-- un refus, là où il n'y avait qu'une coquille.
--
-- **Et pire.** Le champ « Une précision ? » existait déjà, le client y écrivait
-- (« Le devis comprend une fautes »), c'était enregistré dans
-- `precision_client`… et **aucun écran ne l'affichait**. Le message partait
-- dans le vide. C'est le défaut le plus coûteux des deux : il ne se voit pas.

ALTER TABLE "envois_devis" DROP CONSTRAINT IF EXISTS "envois_devis_reponse_check";

-- Le nom de la contrainte anonyme créée par `text CHECK (...)` en 0015 dépend
-- de PostgreSQL ; on la retrouve par son expression plutôt que par un nom
-- deviné, sans quoi la migration passerait « au vert » sans rien changer.
DO $$
DECLARE nom text;
BEGIN
  SELECT conname INTO nom
  FROM pg_constraint
  WHERE conrelid = 'envois_devis'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%reponse%acceptee%refusee%';
  IF nom IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "envois_devis" DROP CONSTRAINT %I', nom);
  END IF;
END $$;

ALTER TABLE "envois_devis"
  ADD CONSTRAINT "envois_devis_reponse_ck"
  CHECK ("reponse" IS NULL OR "reponse" IN ('acceptee', 'refusee', 'correction'));

-- Une demande de correction sans message ne dit rien au patron : il saurait
-- qu'il y a un problème sans savoir lequel, et devrait rappeler son client —
-- exactement l'aller-retour que ce parcours supprime.
ALTER TABLE "envois_devis"
  ADD CONSTRAINT "envois_devis_correction_motivee_ck"
  CHECK ("reponse" IS DISTINCT FROM 'correction' OR "precision_client" IS NOT NULL);
