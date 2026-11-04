-- LE DÉTAIL SOUS LA LIGNE DU DEVIS : sa planche du 4 novembre 2026
-- (`appli/soignee/devis-detail-ligne.html`), tous ses choix du même jour.
--
-- Sa question, devant son devis du frêne : « j'ai parlé de rétention, de
-- suppression de bois mort, d'allègement, de rétention de grosses
-- charpentières allant vers le voisin. Pourquoi tout ça n'a pas été écrit dans
-- la ligne élagage d'un frêne ? » La dictée le lisait ; rien ne le gardait.
-- Cette colonne garde la façon de faire de chaque travail dicté, en une
-- phrase, pour qu'elle s'écrive sous le nom de la ligne qui le vend
-- (`src/lib/detail-de-la-ligne.ts`).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne vide
-- ajoutée, aucune ligne réécrite, donc rien à prouver sous FORCE RLS. L'ancien
-- code l'ignore. Les prestations d'avant restent NULL : leur détail ne s'est
-- jamais gardé, et il ne s'invente pas.

ALTER TABLE "prestations" ADD COLUMN IF NOT EXISTS "detail" text
  CHECK ("detail" IS NULL OR length("detail") <= 300);
