-- Deux natures de plus : le dessouchage et l'enlèvement des grumes.
--
-- **Sa réponse du 8 août 2026**, à la question laissée ouverte dans
-- `TODO.md` §0 quinquies — « autre chose se détache-t-il : dessouchage,
-- évacuation seule, enlèvement des grumes ? » :
--
--   « Le dessouchage oui. Et les grumes aussi. »
--
-- Deux sur trois, et le troisième compte autant : **l'évacuation seule ne se
-- détache PAS**. Elle reste sur la ligne principale avec l'abattage et le
-- broyage, exactement comme sur son devis de référence du 5 août. Ce qui se
-- détache, ce sont les GRUMES — le bois d'œuvre qu'un client peut vouloir
-- garder, vendre, ou faire enlever à part.
--
-- Les axes de chaque nature vivent dans `src/lib/grille-prix.ts` :
--
--   fendage     : hauteur × diamètre     (48 cases)
--   abattage    : technique × diamètre   (24 cases)
--   haie        : une case, au ml        (1 case)
--   dessouchage : diamètre               (8 cases)
--   grumes      : une case, au forfait   (1 case)
--
-- **Le dessouchage se chiffre au diamètre**, et rien d'autre : c'est la taille
-- de la souche qui décide du travail, jamais la hauteur de l'arbre qui n'est
-- plus là. On réemploie les mêmes tranches que l'abattage — ce sont les mêmes
-- troncs.
--
-- **Les grumes n'ont qu'une case, et c'est une réserve assumée.** Le patron n'a
-- pas dit à quoi elles se chiffrent : au mètre cube, à la tonne, au voyage de
-- camion, ou au forfait. Lui inventer un axe serait exactement ce que
-- `docs/AGENT.md` §3 interdit. Une case unique retient donc ce qu'il facture, et
-- le jour où il donne l'unité, une migration ajoute l'axe sans rien perdre.

ALTER TABLE "grille_prix" DROP CONSTRAINT IF EXISTS "grille_prix_nature_check";

-- Le nom de la contrainte n'a pas été choisi à la création (0027) : PostgreSQL
-- l'a dérivé de la colonne. On la retrouve par le catalogue plutôt que de
-- deviner, sinon la migration échoue sur une base où le nom diffère.
DO $$
DECLARE nom text;
BEGIN
  SELECT conname INTO nom
    FROM pg_constraint
   WHERE conrelid = 'grille_prix'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%nature%';
  IF nom IS NOT NULL THEN
    EXECUTE format('ALTER TABLE grille_prix DROP CONSTRAINT %I', nom);
  END IF;
END $$;

ALTER TABLE "grille_prix"
  ADD CONSTRAINT "grille_prix_nature_check"
  CHECK ("nature" IN ('fendage', 'abattage', 'haie', 'dessouchage', 'grumes'));
