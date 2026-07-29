CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "chantiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"client_id" uuid,
	"nom" text NOT NULL,
	"adresse_chantier" text,
	"informations_verifiees_at" timestamp with time zone,
	"prix_valide_at" timestamp with time zone,
	"devis_genere_at" timestamp with time zone,
	"devis_envoye_at" timestamp with time zone,
	"date_planifiee" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chantiers_id_entreprise_uk" UNIQUE("id","entreprise_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"telephone" text,
	"adresse" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	CONSTRAINT "clients_id_entreprise_uk" UNIQUE("id","entreprise_id")
);
--> statement-breakpoint
CREATE TABLE "devis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"chantier_id" uuid NOT NULL,
	"numero_commercial" text NOT NULL,
	"numero_version" integer NOT NULL,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"entreprise_nom" text NOT NULL,
	"entreprise_adresse" text,
	"entreprise_siret" text,
	"entreprise_email" text,
	"entreprise_telephone" text,
	"entreprise_iban" text,
	"client_nom" text,
	"client_adresse" text,
	"client_telephone" text,
	"client_email" text,
	"adresse_chantier" text,
	"date_emission" date NOT NULL,
	"date_validite" date,
	"conditions_paiement" text,
	"devise" char(3) DEFAULT 'EUR' NOT NULL,
	"taux_tva" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"total_ht" numeric(10, 2) NOT NULL,
	"total_tva" numeric(10, 2) NOT NULL,
	"total_ttc" numeric(10, 2) NOT NULL,
	"pdf_storage_key" text,
	"pdf_checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"envoye_le" timestamp with time zone,
	CONSTRAINT "devis_id_entreprise_uk" UNIQUE("id","entreprise_id"),
	CONSTRAINT "devis_chantier_version_uk" UNIQUE("chantier_id","numero_version"),
	CONSTRAINT "devis_entreprise_numero_version_uk" UNIQUE("entreprise_id","numero_commercial","numero_version")
);
--> statement-breakpoint
CREATE TABLE "entreprise_compteurs" (
	"entreprise_id" uuid PRIMARY KEY NOT NULL,
	"prochain_numero_devis" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entreprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"siret" text,
	"adresse" text,
	"telephone" text,
	"email" text,
	"iban" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fichiers_a_purger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"mis_en_file_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lignes_devis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"devis_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"quantite" numeric(10, 2) DEFAULT '1' NOT NULL,
	"prix_unitaire" numeric(10, 2) NOT NULL,
	"montant" numeric(10, 2) NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lignes_prix" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"chantier_id" uuid NOT NULL,
	"libelle" text DEFAULT '' NOT NULL,
	"montant" numeric(10, 2) DEFAULT '0' NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materiel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"chantier_id" uuid NOT NULL,
	"libelle" text DEFAULT '' NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membres_entreprise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"role" text DEFAULT 'membre' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membres_entreprise_uk" UNIQUE("entreprise_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "notes_vocales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"chantier_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"taille_octets" integer NOT NULL,
	"nom_original" text,
	"checksum" text NOT NULL,
	"duree_secondes" integer,
	"transcription" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_vocales_chantier_uk" UNIQUE("chantier_id")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"chantier_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"taille_octets" integer NOT NULL,
	"nom_original" text,
	"checksum" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"chantier_id" uuid NOT NULL,
	"libelle" text DEFAULT '' NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarifs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"intitule" text NOT NULL,
	"prix" numeric(10, 2) NOT NULL,
	"unite" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nom" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_client_entreprise_fk" FOREIGN KEY ("client_id","entreprise_id") REFERENCES "public"."clients"("id","entreprise_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_chantier_entreprise_fk" FOREIGN KEY ("chantier_id","entreprise_id") REFERENCES "public"."chantiers"("id","entreprise_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entreprise_compteurs" ADD CONSTRAINT "entreprise_compteurs_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_devis_entreprise_fk" FOREIGN KEY ("devis_id","entreprise_id") REFERENCES "public"."devis"("id","entreprise_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_prix" ADD CONSTRAINT "lignes_prix_chantier_entreprise_fk" FOREIGN KEY ("chantier_id","entreprise_id") REFERENCES "public"."chantiers"("id","entreprise_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materiel" ADD CONSTRAINT "materiel_chantier_entreprise_fk" FOREIGN KEY ("chantier_id","entreprise_id") REFERENCES "public"."chantiers"("id","entreprise_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membres_entreprise" ADD CONSTRAINT "membres_entreprise_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membres_entreprise" ADD CONSTRAINT "membres_entreprise_utilisateur_id_users_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_vocales" ADD CONSTRAINT "notes_vocales_chantier_entreprise_fk" FOREIGN KEY ("chantier_id","entreprise_id") REFERENCES "public"."chantiers"("id","entreprise_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_chantier_entreprise_fk" FOREIGN KEY ("chantier_id","entreprise_id") REFERENCES "public"."chantiers"("id","entreprise_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_chantier_entreprise_fk" FOREIGN KEY ("chantier_id","entreprise_id") REFERENCES "public"."chantiers"("id","entreprise_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifs" ADD CONSTRAINT "tarifs_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chantiers_entreprise_deleted_idx" ON "chantiers" USING btree ("entreprise_id","deleted_at");--> statement-breakpoint
CREATE INDEX "chantiers_entreprise_client_idx" ON "chantiers" USING btree ("entreprise_id","client_id");--> statement-breakpoint
CREATE INDEX "chantiers_entreprise_date_planifiee_idx" ON "chantiers" USING btree ("entreprise_id","date_planifiee");--> statement-breakpoint
CREATE INDEX "clients_entreprise_deleted_idx" ON "clients" USING btree ("entreprise_id","deleted_at");--> statement-breakpoint
CREATE INDEX "clients_entreprise_nom_idx" ON "clients" USING btree ("entreprise_id","nom");--> statement-breakpoint
CREATE INDEX "devis_entreprise_statut_idx" ON "devis" USING btree ("entreprise_id","statut");--> statement-breakpoint
CREATE INDEX "lignes_devis_devis_idx" ON "lignes_devis" USING btree ("devis_id");--> statement-breakpoint
CREATE INDEX "lignes_prix_entreprise_chantier_idx" ON "lignes_prix" USING btree ("entreprise_id","chantier_id");--> statement-breakpoint
CREATE INDEX "materiel_entreprise_chantier_idx" ON "materiel" USING btree ("entreprise_id","chantier_id");--> statement-breakpoint
CREATE INDEX "notes_vocales_entreprise_idx" ON "notes_vocales" USING btree ("entreprise_id");--> statement-breakpoint
CREATE INDEX "photos_entreprise_chantier_idx" ON "photos" USING btree ("entreprise_id","chantier_id");--> statement-breakpoint
CREATE INDEX "prestations_entreprise_chantier_idx" ON "prestations" USING btree ("entreprise_id","chantier_id");--> statement-breakpoint
CREATE INDEX "tarifs_entreprise_deleted_idx" ON "tarifs" USING btree ("entreprise_id","deleted_at");