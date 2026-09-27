-- LA TÊTE DES GARS, À CÔTÉ DE LEUR NOM.
--
-- Sa demande du 27 septembre 2026 : *« dans le compte des salariés, mettre la
-- possibilité de mettre la tête des gars en photo »*. Planche
-- `appli/photo-des-salaries.html`, proposition B retenue : une fiche par
-- salarié, la photo en grand, prendre, choisir, retirer.
--
-- **La photo vit dans le stockage, la base garde sa clef** : le chemin du logo
-- (`entreprises.logo_storage_key`). `equipes` porte les salariés malgré son nom
-- (migration 0067).
--
-- **CHACUN POSE LA SIENNE** — sa précision du même soir : *« chaque personne
-- doit pouvoir mettre et changer sa photo de profil »*, et ses deux réponses :
--   · le patron relie UNE FOIS chaque compte à son nom de salarié
--     (`membres_entreprise.salarie_id`) ; la photo d'un compte relié EST celle
--     de sa ligne, une seule vérité, qu'il la pose ou que le patron la pose ;
--   · un compte qui n'est pas un gars de chantier (patron, commercial,
--     facturation) garde la sienne sur son adhésion
--     (`membres_entreprise.photo_storage_key`), visible dans « Qui a accès ».
--
-- **`salarie_id` n'est pas `equipe_id`.** `equipe_id` dit ce qu'une personne
-- VOIT du planning, et il est NULL pour qui voit tout (0065) : s'en servir pour
-- dire QUI elle est aurait laissé sans nom tout salarié qui voit tout.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : des colonnes
-- nullables, aucune ligne existante touchée, aucun UPDATE sous FORCE RLS. Un
-- salarié sans photo est l'état normal, et l'ancien code l'ignore.

ALTER TABLE "equipes" ADD COLUMN "photo_storage_key" text;

ALTER TABLE "membres_entreprise"
  ADD COLUMN "salarie_id" uuid REFERENCES "equipes"("id") ON DELETE SET NULL,
  ADD COLUMN "photo_storage_key" text;

-- Un nom ne se relie qu'à un seul compte : deux comptes « Kévin » poseraient
-- chacun sa photo sur la même ligne, et la dernière effacerait l'autre.
CREATE UNIQUE INDEX "membres_entreprise_salarie_uk"
  ON "membres_entreprise" ("salarie_id") WHERE "salarie_id" IS NOT NULL;
