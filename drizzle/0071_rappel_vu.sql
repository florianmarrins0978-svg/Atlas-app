-- « J'AI VU » SUR TOUS LES RAPPELS, ET PAS SEULEMENT SUR LES RÉPONSES DE CLIENT.
--
-- Sa demande du 30 août 2026, capture à l'appui — la carte « Devis sans
-- réponse » ne portait que « Ouvrir le chantier » : « pour chaque notification
-- je dois pouvoir cliquer sur vu pour les faire disparaître ; pourquoi
-- certaines n'ont pas cette fonction ? Mets la fonction pour toutes. »
--
-- CE QUI EXISTAIT, ET POURQUOI CELA NE SUFFISAIT PAS. Une réponse de client
-- s'acquitte en base (`envois_devis.vue_at`). Un rappel, lui, n'était calculé
-- qu'à la lecture : il n'avait rien où poser un acquittement, et le masquer à
-- l'écran ne survivait pas au rechargement. Refuser le geste faute d'endroit où
-- l'écrire, c'était laisser sa pile de rappels grossir sans qu'il puisse la
-- ranger.
--
-- CE QUE « VU » VEUT DIRE ICI, ET LA NUANCE COMPTE : le rappel se tait, il ne
-- meurt pas. Il revient au bout du délai réglé pour son genre si la situation
-- n'a pas bougé — sept jours pour un devis sans réponse, quatre pour un
-- chantier sans devis. Un rappel effacé pour toujours ferait exactement ce que
-- ces rappels existent pour éviter : perdre un chantier de vue. Et pour ne plus
-- jamais le voir, l'interrupteur est dans « Réglages › Notifications ».
--
-- LA FACTURE IMPAYÉE N'ENTRE PAS DANS CETTE TABLE, et c'est délibéré : elle a
-- déjà son moteur de silence depuis le 16 août (`chantiers.rappel_facture_
-- repousse_le`, migration 0051). Deux endroits pour une même idée finiraient
-- par se contredire — le premier des pièges que ce dépôt s'interdit. Son bouton
-- prend le même mot que les autres, il garde sa mécanique.
--
-- LA CIBLE EST TOUJOURS UN CHANTIER pour ces trois genres-là : la clé étrangère
-- fait donc le ménage toute seule quand un chantier disparaît pour de bon. Sans
-- elle, la table garderait des acquittements orphelins qui feraient taire, un
-- jour, un rappel d'un chantier recréé sous le même identifiant.
CREATE TABLE "rappels_vus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL REFERENCES "chantiers"("id") ON DELETE CASCADE,
  -- Le genre est contraint EN BASE : une valeur inventée ferait taire un rappel
  -- que personne ne saurait rallumer, et le défaut ne se verrait qu'à l'usage.
  "genre" text NOT NULL CHECK ("genre" IN (
    'chantier-sans-devis', 'devis-sans-reponse', 'chantier-non-facture'
  )),
  "vu_le" timestamptz NOT NULL DEFAULT now()
);

-- UN SEUL ACQUITTEMENT PAR RAPPEL, et le dernier écrase le précédent : deux
-- lignes pour un même rappel donneraient deux dates de réveil, et la plus
-- ancienne le ferait revenir alors qu'il vient d'être acquitté.
CREATE UNIQUE INDEX "rappels_vus_cible_idx"
  ON "rappels_vus" ("entreprise_id", "genre", "chantier_id");

ALTER TABLE "rappels_vus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rappels_vus" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rappels_vus_isolation" ON "rappels_vus"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "rappels_vus" TO atlas_app;

COMMENT ON TABLE "rappels_vus" IS
  'Les rappels que le patron a acquittés d''un « J''ai vu ». Le rappel se tait le temps de son délai réglé, puis revient si la situation n''a pas bougé.';
