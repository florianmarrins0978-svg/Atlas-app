-- Les achats du patron, et la TVA qu'il peut déduire.
--
-- **Sa demande du 2026-08-12 :** *« je veux également qu'on puisse intégrer la
-- TVA due, donc les essences, les tronçonneuses, tout ce que tu disais. Et pour
-- ça j'avais pensé également à un petit scanner en ouvrant l'appareil photo :
-- on passe les tickets gazoil devant, il les scanne et les intègre
-- automatiquement. »*
--
-- Retenu sur maquette (`docs/maquettes/37`), après quatre corrections de sa
-- main. Jusqu'ici l'application ne connaissait que la TVA collectée : elle ne
-- pouvait pas répondre à la seule question qui l'intéresse — combien reste-t-il
-- à payer.
--
-- =========================================================================
-- Ce que cette table N'EST PAS : une comptabilité
-- =========================================================================
--
-- Elle ne porte pas les achats du patron. Elle porte **la TVA de ses achats,
-- telle qu'il l'a confirmée**. La nuance décide de tout le reste :
--
--   · pas de catégorie de dépense, pas de rapprochement bancaire, pas de plan
--     comptable — Atlas prépare un relevé, il ne tient pas les comptes
--     (`docs/AGENT.md` §6, acté le 31 juillet) ;
--   · **aucune règle de déductibilité n'est encodée ici.** Ce qui est
--     déductible dépend de la dépense et du véhicule ; Atlas n'a pas de source
--     pour en juger. Il additionne ce que le patron confirme, et son comptable
--     fait le tri (`CLAUDE.md` §4).
--
-- =========================================================================
-- Pourquoi `tva_deductible` est le SEUL montant obligatoire
-- =========================================================================
--
-- Un ticket de station n'affiche pas toujours son total hors taxes, ni même son
-- taux ; certains n'affichent qu'une ligne « TVA 3,20 € ». Exiger le total
-- reviendrait à **refuser l'achat plutôt qu'à l'enregistrer incomplet** — et un
-- achat refusé est un achat perdu, donc une TVA que le patron ne récupérera
-- pas.
--
-- `total_ttc` et `taux_tva` restent donc nullables : utiles, jamais exigés.
--
-- =========================================================================
-- `saisie` : par où l'achat est entré, et pourquoi ça compte
-- =========================================================================
--
-- 'scan' ou 'main'. Ce n'est pas de la statistique : le jour où une lecture
-- automatique se révélera fautive sur un type de ticket, il faudra pouvoir
-- retrouver **ce qui est venu de la machine** sans toucher à ce que le patron a
-- écrit lui-même. Sans cette colonne, les deux seraient indiscernables.
--
-- **Dans les deux cas, la valeur enregistrée est celle qu'il a CONFIRMÉE.**
-- Un ticket thermique pâlit, se froisse et sort du fond d'une poche : la
-- lecture se trompera. L'écran montre ce qu'il a lu, le patron corrige d'un
-- doigt, et c'est sa valeur qui descend ici. Rien n'entre sans son geste — même
-- règle que les arrêts du parcours (`docs/AGENT.md` §2).
--
-- =========================================================================
-- La photo du ticket
-- =========================================================================
--
-- `photo_cle` désigne le fichier dans le stockage, comme les photos de chantier.
-- Nullable : un achat écrit à la main n'en a pas.
--
-- **Elle ne dispense pas de garder le papier.** Scanner ne remplace pas
-- l'original aux yeux de l'administration, sauf procédure de numérisation
-- formelle. C'est écrit à l'écran plutôt que supposé.

CREATE TABLE "achats_tva" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- La date de l'achat, jamais celle de la saisie : c'est elle qui range la
  -- ligne dans une période de TVA. Un ticket de juillet scanné en septembre
  -- appartient à juillet.
  "date_achat" date NOT NULL,

  "fournisseur" text NOT NULL,

  -- Utiles, jamais exigés — voir plus haut.
  "total_ttc" numeric(12, 2),
  "taux_tva" numeric(5, 2),

  -- Le seul chiffre qui compte pour le relevé. Peut être zéro (un achat sans
  -- TVA récupérable que le patron veut tout de même garder en trace), jamais
  -- négatif : une TVA déductible négative n'existe pas, c'est un avoir, et un
  -- avoir se saisit ailleurs.
  "tva_deductible" numeric(12, 2) NOT NULL CHECK ("tva_deductible" >= 0),

  "photo_cle" text,

  "saisie" text NOT NULL CHECK ("saisie" IN ('scan', 'main')),

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  -- Retrait réversible, comme partout ailleurs : un achat effacé par erreur se
  -- rattrape, et le tiroir d'annulation en dépend (`ARCHITECTURE.md` §48).
  "deleted_at" timestamptz,
  "created_by" uuid REFERENCES "users"("id")
);

-- Le relevé interroge toujours « les achats de cette entreprise, entre ces deux
-- dates ». C'est exactement cet index.
CREATE INDEX "achats_tva_periode_idx"
  ON "achats_tva" ("entreprise_id", "date_achat")
  WHERE "deleted_at" IS NULL;

ALTER TABLE "achats_tva" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "achats_tva" FORCE ROW LEVEL SECURITY;

CREATE POLICY "achats_tva_isolation" ON "achats_tva"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "achats_tva" TO atlas_app;
