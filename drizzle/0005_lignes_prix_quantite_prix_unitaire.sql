ALTER TABLE "lignes_prix" ADD COLUMN "quantite" numeric(10, 2) DEFAULT '1' NOT NULL;
ALTER TABLE "lignes_prix" ADD COLUMN "prix_unitaire" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "lignes_prix" ADD COLUMN "unite" text;
ALTER TABLE "lignes_prix" ADD CONSTRAINT lignes_prix_quantite_non_negative CHECK (quantite >= 0);
ALTER TABLE "lignes_prix" ADD CONSTRAINT lignes_prix_prix_unitaire_non_negatif CHECK (prix_unitaire >= 0);
