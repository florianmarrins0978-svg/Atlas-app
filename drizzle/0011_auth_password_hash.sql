ALTER TABLE "users" ADD COLUMN "password_hash" text;

-- Aucune donnée à migrer : la colonne est nullable, aucun utilisateur
-- existant n'est affecté. Le rôle ("proprietaire"/"membre") existe déjà sur
-- membres_entreprise depuis le schéma initial et est déjà assigné
-- correctement par creerEntreprise() (le créateur reçoit "proprietaire") —
-- aucune migration de données n'est nécessaire pour l'autorisation.
