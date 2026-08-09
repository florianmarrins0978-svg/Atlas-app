-- La grille de prix du fendage — hauteur de l'arbre × diamètre du tronc.
--
-- **Demandée par le patron, le 8 août 2026 :** *« pour la fente ils devraient
-- demander la hauteur de l'arbre et son diamètre, et on crée une liste de prix
-- en fonction de la hauteur et du diamètre, comme ça il n'invente rien. »* Puis,
-- devant une première grille à 3 × 3 : *« par contre il faut faire plus de
-- tranche. »* Elle en compte donc 8 × 6 = 48 (voir `src/lib/grille-fendage.ts`,
-- qui porte les bornes et les explique).
--
-- **Par entreprise, et isolée comme le reste.** Ce sont ses prix de vente : les
-- partager comme `termes_metier` reviendrait à donner ses tarifs à ses
-- concurrents le jour où l'application part chez d'autres artisans. La
-- distinction est celle posée avec lui dans `docs/QUESTIONS.md` §10 — le
-- vocabulaire du métier se partage, les prix jamais.
--
-- **Elle naît VIDE, et c'est tout l'intérêt.** Aucun prix n'est semé ici. Une
-- case vide est une question posée au patron ; une case pré-remplie au jugé
-- serait un prix inventé sur le devis d'un client (`docs/AGENT.md` §3). Elle se
-- remplit de deux façons : à la main depuis les réglages, et toute seule quand
-- il écrit un prix de fendage sur un devis dont la hauteur et le diamètre sont
-- connus.
--
-- **Pourquoi une table de plus alors que `lecons_prix` existe** (migration 0023).
-- Celle-là retient ce qu'il a retenu, chantier par chantier, et sert de rappel.
-- Elle ne se remplit donc que par l'usage, et elle ne s'affiche pas : il ne peut
-- pas y poser un prix à l'avance, ni voir d'un coup d'œil ce qui manque. Or
-- c'est exactement ce qu'il a demandé — une **liste** de prix, qu'il regarde et
-- qu'il complète. Les deux ne se contredisent pas : la grille fait autorité pour
-- le fendage, `lecons_prix` continue de rappeler le reste.

CREATE TABLE "grille_fendage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- La case, `h10|d40`. Volontairement du texte, et volontairement fabriqué par
  -- une fonction pure (`celluleFendage`) : les bornes se relisent, se discutent
  -- et s'éprouvent sans base. Les clés, elles, ne changent jamais — la mémoire
  -- en dépend.
  "cellule" text NOT NULL,

  -- Prix HT du fendage pour cette case, tel que le patron l'a décidé.
  "prix" numeric(10, 2) NOT NULL,

  -- D'où vient ce prix : `saisi` (il l'a posé lui-même dans les réglages) ou
  -- `devis` (il l'a écrit sur un devis réel). La distinction n'est pas
  -- décorative : elle permet de lui montrer ce qu'il a réellement pratiqué,
  -- par opposition à ce qu'il avait prévu — et elle évitera d'écraser une
  -- décision par une observation le jour où l'on voudra les départager.
  "origine" text NOT NULL DEFAULT 'saisi' CHECK ("origine" IN ('saisi', 'devis')),

  "constate_le" timestamptz NOT NULL DEFAULT now(),

  -- Une seule valeur par case : c'est une grille, pas un historique. Le patron
  -- corrige un prix champ par champ, et garder chaque frappe remplirait la
  -- mémoire d'états intermédiaires — le piège déjà rencontré avec `lecons_prix`.
  CONSTRAINT "grille_fendage_cellule_uk" UNIQUE ("entreprise_id", "cellule"),

  -- Un prix nul n'est pas une décision : c'est une case pas encore remplie.
  -- L'enregistrer ferait proposer « 0 € » avec l'autorité de sa grille.
  CONSTRAINT "grille_fendage_positif" CHECK ("prix" > 0)
);

ALTER TABLE "grille_fendage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grille_fendage" FORCE ROW LEVEL SECURITY;

CREATE POLICY "grille_fendage_isolation" ON "grille_fendage"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "grille_fendage" TO atlas_app;

-- =========================================================================
-- La règle de découpage, corrigée d'après ses propres mots
-- =========================================================================
--
-- La migration 0025 posait la règle « chaque ligne doit pouvoir se vendre
-- seule », avec pour exemples détachables « la fente, l'évacuation, le
-- dessouchage ». Le patron a tranché autrement le 7 août 2026, en toutes
-- lettres : *« l'abattage, le broyage et l'évacuation, c'est sur une ligne, et
-- la fente, ça doit être séparé. »*
--
-- Laisser l'ancien exemple aurait envoyé au modèle une consigne que le code
-- contredit — et c'est le modèle qui rédige le devis. Deux versions d'une même
-- règle finissent toujours par diverger (`CLAUDE.md` §3) ; celle-ci diverge dès
-- le premier jour.
UPDATE "termes_metier"
   SET "consigne" = 'Ne jamais ventiler un prix global au prorata du temps passé. L''abattage, le broyage et l''évacuation vont ENSEMBLE sur une seule ligne : le client ne les détache pas l''un de l''autre. La fente du bois, elle, fait sa propre ligne — il peut la refuser, ou la confier à un autre. Alléger la ligne principale et charger la ligne détachable, de façon que chacune tienne debout seule. Le total reste le même ; c''est la répartition qui protège les deux cas.',
       "updated_at" = now()
 WHERE lower("intitule") = lower('Chaque ligne doit pouvoir se vendre seule');

-- Le billonnage, et pourquoi il ne fait pas de ligne. Énoncé une fois pour
-- toutes, ici, parce que le modèle s'est trompé dessus deux fois : il créait
-- une quatrième ligne « coupe en 50 » là où le devis du patron n'en compte que
-- trois (`docs/EXEMPLE-DICTEE.md`, 5 août 2026).
INSERT INTO "termes_metier" ("nature", "intitule", "definition", "consigne", "ordre") VALUES
(
  'mot',
  'Billonnage',
  'Couper en tronçons le tronc d''un arbre déjà abattu — « on le coupe en 50 », « débité en bûches de 50 ». C''est la fin du geste d''abattre, pas un chantier qu''on commande séparément.',
  'Ne jamais en faire une ligne de devis quand un abattage figure dans la même dictée : le billonnage est compris dans l''abattage. Sans abattage dicté, en revanche, c''est bien une prestation à part entière. À ne pas confondre avec la fente, qui se vend seule.',
  1
)
ON CONFLICT (lower("intitule")) DO NOTHING;
