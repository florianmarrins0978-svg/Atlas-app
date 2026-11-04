-- LA COORDONNÉE TAPÉE POUR L'ENVOI D'UNE FACTURE DONT LE CLIENT EST SUPPRIMÉ.
--
-- Sa demande du 3 novembre 2026, capture à l'appui : « J'ai supprimé le client,
-- mais je ne l'ai pas encore facturé. Donc là, je ne peux plus lui envoyer la
-- facture. […] il faut que je puisse écrire les coordonnées pour lui envoyer la
-- facture. » Son choix : « Pour cet envoi seulement ». Rien ne s'écrit sur la
-- fiche supprimée (`effacerClient` l'a vidée de ses coordonnées).
--
-- POURQUOI UNE COLONNE. Pour un client vivant, l'adresse ou le numéro vers
-- lequel la facture part est sur sa fiche. Pour un client supprimé, ce qu'il
-- tape n'existerait nulle part ailleurs que dans sa messagerie : la trace de
-- l'envoi dirait « parti par e-mail » sans dire à qui, et c'est la question que
-- pose un client qui dit ne jamais l'avoir reçue. La ligne de l'envoi porte
-- déjà le canal, l'ouverture et l'accusé : la coordonnée y vit à côté.
--
-- NULLE pour tout envoi qui n'est pas parti vers une coordonnée tapée : Atlas
-- ne l'a pas notée. Un canal corrigé ensuite la remet à nul, car elle était
-- celle de l'autre canal (`corrigerCanalEnvoiFacture`).
--
-- Expand seul : une colonne vide et facultative, aucune ligne existante
-- réécrite (rien à prouver sous FORCE RLS, migration 0024), aucune contrainte.
-- La ligne de l'envoi est déjà isolée par entreprise : la coordonnée d'une
-- entreprise est invisible d'une autre sans politique de plus. Le code d'avant
-- l'ignore.
ALTER TABLE "envois_factures"
  ADD COLUMN IF NOT EXISTS "destinataire" text;

COMMENT ON COLUMN "envois_factures"."destinataire" IS
  'L''adresse e-mail ou le numéro tapé pour CET envoi, quand le client était supprimé. Nulle : Atlas ne l''a pas notée.';
