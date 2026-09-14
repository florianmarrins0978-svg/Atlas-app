-- L'adresse e-mail d'un compte créé par la porte se vérifie AVANT d'entrer.
--
-- Sa demande du 14 septembre 2026 : *« j'ai réussi à me connecter avec une
-- adresse fausse qui n'existe pas ! […] il faut mettre une sécurité avec un
-- numéro envoyé par email à rentrer pour pouvoir valider son compte »*.
--
-- **UNE LIGNE ICI = UN COMPTE EN ATTENTE.** C'est la présence de la ligne qui
-- ferme la porte (`GardeVerificationEmail`), pas la colonne `users.email_verified`
-- laissée vide : les comptes qui existent déjà — les siens, ses salariés, ceux
-- venus de Google ou d'Apple — n'ont pas de ligne, et rien ne change pour eux.
-- Seul un compte NEUF, créé par la porte, en reçoit une, et elle disparaît
-- quand le code est entré (et `email_verified` prend alors sa date).
--
-- **Jamais le code en clair.** `empreinte` est un HMAC du code avec le secret
-- de session : une base lue par-dessus l'épaule ne donne pas les codes en
-- cours. Six chiffres se devinent en un million d'essais ; `essais` en laisse
-- cinq, puis le code est mort et il faut le renvoyer.
CREATE TABLE "codes_verification_email" (
  "utilisateur_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "empreinte" text NOT NULL,
  "expire_le" timestamptz NOT NULL,
  "essais" integer NOT NULL DEFAULT 0,
  -- Combien de codes sont partis, et quand le dernier : « Renvoyer » se borne
  -- ici, en base — un compteur en mémoire s'oublie au redémarrage du serveur.
  "envois" integer NOT NULL DEFAULT 1,
  "dernier_envoi" timestamptz NOT NULL DEFAULT now(),
  "cree_le" timestamptz NOT NULL DEFAULT now()
);

-- Donnée personnelle, liée à une PERSONNE et recueillie avant toute entreprise :
-- le contexte est `app.utilisateur_id`, exactement comme les acceptations des
-- documents légaux (migration 0014).
ALTER TABLE "codes_verification_email" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "codes_verification_email" FORCE ROW LEVEL SECURITY;

CREATE POLICY "codes_verification_email_isolation" ON "codes_verification_email"
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)
  WITH CHECK ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);

-- DELETE est nécessaire : la ligne s'efface quand le code est entré. Ce n'est
-- pas une preuve à conserver, c'est une porte à refermer.
GRANT SELECT, INSERT, UPDATE, DELETE ON "codes_verification_email" TO atlas_app;
