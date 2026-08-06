-- Ce que le patron a RETENU comme prix — sa mémoire, pas nos propositions.
--
-- **Le manque que ça comble, dans ses mots :** *« si l'appli n'a aucune
-- mémoire, comment l'IA va enregistrer et se souvenir ? Pour s'améliorer elle a
-- besoin de mémoire. »* Chaque devis repartait de zéro : il corrigeait, l'agent
-- oubliait.
--
-- **Pourquoi une table de plus alors qu'`historique_prix` existe.** Celle-ci
-- est rattachée à `catalogue_prestations`, un catalogue PARTAGÉ par toutes les
-- sociétés et repéré par un nom canonique. Elle ne sait donc pas distinguer un
-- abattage au pied d'un démontage avec rétention — les deux seules choses qui
-- font passer le même chêne de 600 à 1 400 €. Une mémoire incapable de cette
-- distinction rappellerait un prix faux de 800 € avec l'autorité de
-- l'expérience. (`historique_prix` reste en place : elle sert le chiffrage par
-- catalogue, et n'était de toute façon jamais alimentée par l'application.)
--
-- **Une ligne par ligne de devis, jamais une de plus.** Le patron corrige un
-- prix champ par champ, à chaque fois qu'il quitte une case : compter chaque
-- frappe polluerait la mémoire de valeurs intermédiaires — un 1, puis un 10,
-- puis un 100 en allant vers 1 000. La contrainte d'unicité sur la ligne fait
-- que seule sa dernière décision subsiste.

-- Prérequis : la clé composite qui interdit de désigner la ligne d'une AUTRE
-- société. Même convention que `chantiers_id_entreprise_uk` — la RLS protège
-- déjà la lecture, cette contrainte protège l'intégrité, et les deux ne se
-- remplacent pas : une clé étrangère mal posée survivrait à toute politique.
ALTER TABLE "lignes_prix"
  ADD CONSTRAINT "lignes_prix_id_entreprise_uk" UNIQUE ("id", "entreprise_id");

CREATE TABLE "lecons_prix" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- La ligne de devis d'où vient l'observation. C'est elle qui garantit
  -- « une leçon par ligne », et qui fait disparaître la leçon si la ligne
  -- est retirée : un prix que le patron a effacé n'est pas un prix qu'il a
  -- retenu.
  "ligne_prix_id" uuid NOT NULL,
  -- Clé de rapprochement construite par src/lib/lecons-prix.ts
  -- (« abattage|retention|d70 »). Volontairement du texte : la règle qui la
  -- fabrique vit dans une fonction pure, éprouvable sans base.
  "signature" text NOT NULL,
  -- Le libellé tel que le patron l'a écrit, pour que le rappel lui parle.
  -- Six mois plus tard, « abattage|retention|d70 » ne lui dirait rien.
  "libelle" text NOT NULL,
  "prix" numeric(10, 2) NOT NULL,
  "chantier_id" uuid NOT NULL,
  "constate_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "lecons_prix_ligne_uk" UNIQUE ("ligne_prix_id"),
  -- Un prix nul n'est pas une leçon : c'est une ligne pas encore remplie.
  -- L'enregistrer ferait rappeler « la dernière fois : 0 € ».
  CONSTRAINT "lecons_prix_positif" CHECK ("prix" > 0),
  CONSTRAINT "lecons_prix_ligne_entreprise_fk"
    FOREIGN KEY ("ligne_prix_id", "entreprise_id")
    REFERENCES "lignes_prix"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "lecons_prix_chantier_entreprise_fk"
    FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE CASCADE
);

-- L'index qui porte la lecture : « qu'ai-je facturé pour ce genre de travail ? »,
-- le plus récent d'abord.
CREATE INDEX "lecons_prix_recherche_idx"
  ON "lecons_prix" ("entreprise_id", "signature", "constate_le" DESC);

ALTER TABLE "lecons_prix" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lecons_prix" FORCE ROW LEVEL SECURITY;

CREATE POLICY "lecons_prix_isolation" ON "lecons_prix"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "lecons_prix" TO atlas_app;
