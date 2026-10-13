-- CE QUI SE RÉCUPÈRE — sa demande du 13 octobre 2026
-- (`appli/tva-ticket-carburant.html`).
--
-- « Chaque entrée et chaque sortie doit être notée, mais si c'est une catégorie
-- où il ne récupère pas la TVA, elle ne doit pas être comptabilisée. » Jusqu'ici
-- tout achat comptait en entier : un hôtel faisait baisser la TVA à payer.
--
-- `tva_deductible` GARDE SON SENS, « ce qui compte » : le total, le relevé et
-- la calculette n'ont pas à changer. Ce qui s'ajoute, c'est ce qui permet de le
-- calculer : la nature, le véhicule ou le repas, ses preuves, et la TVA écrite
-- sur le ticket, désormais distincte de la part récupérée.
--
-- EXPAND SEUL, AUCUNE DONNÉE RÉÉCRITE. Une ligne sans nature est un achat
-- d'avant ce jour : elle reste comptée comme elle l'était, et l'ancien code
-- ignore ces colonnes (.claude/rules/deployment-safety.md). Aucun UPDATE, donc
-- rien à prouver sous FORCE RLS (.claude/rules/migrations.md). Les CHECK ne
-- portent que sur les colonnes neuves, toutes nulles sur les lignes existantes :
-- ils ne peuvent refuser aucune ligne d'une base habitée.
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "nature" text
  CHECK ("nature" IN ('carburant', 'materiel', 'repas', 'hotel', 'transport', 'autre'));
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "vehicule" text
  CHECK ("vehicule" IN ('utilitaire', 'voiture'));
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "repas" text
  CHECK ("repas" IN ('affaires', 'perso'));
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "avec_qui" text;
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "pourquoi" text;
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "justificatif" boolean;
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "tva_ticket" numeric(12, 2)
  CHECK ("tva_ticket" >= 0);
