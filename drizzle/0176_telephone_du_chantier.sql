-- LE TÉLÉPHONE D'UN CHANTIER SANS FICHE CLIENT (sa demande du 8 novembre 2026,
-- planche `appli/soignee/planning-sans-fiche.html`, son « 1, c'est OK »).
--
-- Sa demande : un client facturé ailleurs (Unipros) qu'il veut sur son planning,
-- noté par « Autre chose » : « on note le nom du client, et en dessous son
-- adresse, son numéro de téléphone ». Puis : « est-ce que ça va pas créer de
-- fiches clients ? » Non : « Autre chose » pose un chantier SANS client
-- (`poserDuTempsAction`). L'adresse y avait déjà sa place (`adresse_chantier`),
-- le téléphone non : « Appeler le client » ne lisait que la fiche client.
--
-- **La règle de lecture vit à un seul endroit** (`listerChantiersPourPlanning`) :
-- le numéro de la fiche client s'il y en a une, sinon celui du chantier.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne nullable,
-- aucune ligne existante relue ni écrite. Rien à éprouver sur une base habitée,
-- rien à voir sous FORCE RLS. Un code d'avant servi sur ce schéma l'ignore.

ALTER TABLE "chantiers" ADD COLUMN IF NOT EXISTS "telephone" text;
