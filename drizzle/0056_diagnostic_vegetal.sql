-- Le diagnostic végétal : une photo, une fiche, un résultat.
--
-- **Sa demande du 20 août 2026**, et l'architecture validée le même jour :
-- « un professionnel prend en photo une feuille, une branche, une écorce, un
-- champignon, un arbre ou un arbuste présentant une anomalie, puis obtient
-- automatiquement un diagnostic probable et une conduite à tenir. »
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LE PRINCIPE QUI COMMANDE TOUTE CETTE MIGRATION : LE MODÈLE OBSERVE, LA BASE
-- DÉCIDE.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un modèle à qui l'on demande de nommer une maladie en nommera toujours une —
-- c'est ce qu'il sait faire, et c'est exactement ce qu'il ne faut pas. Le
-- pipeline ne lui demande donc jamais de nommer quoi que ce soit : il lui
-- demande CE QU'IL VOIT, dans un vocabulaire fermé (`src/lib/diagnostic-
-- vegetal.ts`), et c'est du code qui confronte cette observation aux fiches
-- ci-dessous.
--
-- **Conséquence directe sur le schéma :** tout texte affiché au patron sort
-- d'une colonne de `fiches_phyto`. Aucune colonne de `diagnostics` ne porte de
-- prose écrite par un modèle. Une recommandation inventée devient impossible
-- par construction, et non par bonne volonté.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DEUX MONDES QUI NE SE MÉLANGENT JAMAIS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **A. La base phytosanitaire — commune, en lecture seule, SANS RLS.**
--    Un fait phytosanitaire n'appartient à aucune entreprise. Le dupliquer par
--    société multiplierait des milliers de lignes et rendrait le sourçage
--    intenable. Le précédent est `catalogue_prestations` (migration 0007) et
--    `documents_legaux` (0014) : pas d'`entreprise_id`, pas de RLS,
--    `GRANT SELECT` seul. **`atlas_app` ne peut RIEN y écrire** — l'import
--    tourne sous le rôle propriétaire, comme les migrations.
--
-- **B. Ses diagnostics — isolés par RLS, comme tout le reste.**
--    `entreprise_id`, `ENABLE`/`FORCE ROW LEVEL SECURITY`, politique sur
--    `current_setting('app.entreprise_id')`, et tout passe par
--    `withEntreprise`. La file de purge porte l'entreprise, comme
--    `audios_a_purger` (0017) : jamais un contournement de la RLS pour se
--    simplifier la vie (`CLAUDE.md` §4).

-- ═══════════════════════════════════════════════════════════════════════════
-- A. LA BASE PHYTOSANITAIRE COMMUNE
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Les sources ────────────────────────────────────────────────────────────
--
-- Elles précèdent les fiches, et c'est délibéré : **une fiche sans source ne
-- peut pas être validée** (contrainte plus bas). DSF/ministère de
-- l'Agriculture, INRAE, FREDON, Plante & Cité, ONF, Bulletins de Santé du
-- Végétal, et les références scientifiques ou réglementaires reconnues.
--
-- `consultee_le` n'est pas un doublon de `publiee_le` : la première dit quand
-- on a lu, la seconde quand ça a été écrit. Une page d'organisme qui bouge sans
-- changer d'adresse ne se détecte qu'avec les deux.
CREATE TABLE "sources_phyto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiant stable et lisible, désigné par les fichiers d'import.
  -- Jamais renuméroté : c'est ce que citent les fiches.
  "code" text NOT NULL,

  "organisme" text NOT NULL,
  "titre" text NOT NULL,
  "url" text,

  -- officielle | scientifique | technique | reglementaire
  "nature" text NOT NULL,

  "publiee_le" date,
  "consultee_le" date NOT NULL,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "sources_phyto_code_uk" UNIQUE ("code"),
  CONSTRAINT "sources_phyto_nature_ck"
    CHECK ("nature" IN ('officielle', 'scientifique', 'technique', 'reglementaire'))
);

-- ── Les essences ───────────────────────────────────────────────────────────
--
-- Le référentiel des végétaux, séparé des fiches parce qu'une même essence est
-- l'hôte de dizaines de problèmes. Même forme que `catalogue_prestations` : un
-- nom canonique, des synonymes en tableau, la recherche indulgente au-dessus.
--
-- `rang` distingue une espèce d'un genre entier : beaucoup de fiches disent
-- « les chênes » sans préciser l'espèce, et forcer une espèce là où la source
-- n'en donne pas serait inventer.
CREATE TABLE "taxons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL,

  -- « Quercus », « Quercus robur ». Nul si la source ne nomme qu'en français.
  "nom_scientifique" text,
  "nom_commun" text NOT NULL,
  "synonymes" text[] NOT NULL DEFAULT '{}'::text[],

  -- genre | espece | famille | groupe
  "rang" text NOT NULL DEFAULT 'espece',

  -- feuillu | conifere | arbuste | palmier | autre — sert au rapprochement
  -- quand l'essence exacte n'est pas reconnaissable sur la photo.
  "port" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "taxons_code_uk" UNIQUE ("code"),
  CONSTRAINT "taxons_rang_ck" CHECK ("rang" IN ('genre', 'espece', 'famille', 'groupe')),
  CONSTRAINT "taxons_port_ck"
    CHECK ("port" IS NULL OR "port" IN ('feuillu', 'conifere', 'arbuste', 'palmier', 'autre'))
);

CREATE INDEX "taxons_nom_scientifique_idx" ON "taxons" (lower("nom_scientifique"));
CREATE INDEX "taxons_nom_commun_idx" ON "taxons" (lower("nom_commun"));
CREATE INDEX "taxons_synonymes_idx" ON "taxons" USING gin ("synonymes");

-- ── La fiche ───────────────────────────────────────────────────────────────
--
-- Le cœur, et **la seule source des textes affichés**.
--
-- Trois colonnes portent la sécurité de tout le module, et méritent d'être
-- lues avant les autres :
--
--   1. `diagnostic_photo` — une photo peut-elle trancher ? Une fiche
--      « impossible » ne sera JAMAIS rendue comme conclusion, quel que soit son
--      score. C'est ce qui empêche d'affirmer depuis une photo ce qu'une photo
--      ne montre pas.
--   2. `niveau_validation` — seule « validee » est servie. Une fiche en cours
--      de saisie n'atteint jamais un chantier.
--   3. `origine` — 'reelle' ou 'fixture_test'. Voir la contrainte plus bas :
--      une fixture porte un code préfixé, ce qui la rend repérable et
--      supprimable d'une seule requête, et le chemin de lecture applicatif
--      l'écarte par défaut.
--
-- **`impact_mecanique` n'est pas une colonne comme les autres** : dès qu'elle
-- ne vaut pas « aucun », le résultat affiché porte la phrase qui dit qu'une
-- photo ne juge pas la solidité d'un arbre. Cette phrase-là ne vient pas de la
-- fiche mais du code — c'est une règle générale de sécurité, pas un fait
-- phytosanitaire, et elle ne doit pas pouvoir manquer parce qu'une fiche a été
-- mal remplie.
CREATE TABLE "fiches_phyto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- « oidium-chene ». Désigné par les fichiers d'import et par les confusions.
  "code" text NOT NULL,

  "nom_commun" text NOT NULL,
  -- Nul assumé : un stress abiotique n'a pas de nom scientifique. Une donnée
  -- manquante reste manquante (`docs/AGENT.md` §3).
  "nom_scientifique" text,

  -- maladie | champignon_lignivore | champignon_autre | ravageur | carence
  -- | stress_abiotique | degat_mecanique
  "categorie" text NOT NULL,

  "agent_causal" text,
  -- champignon | bacterie | virus | insecte | acarien | nematode | abiotique
  -- | inconnu
  "agent_type" text NOT NULL DEFAULT 'inconnu',

  -- Vocabulaire fermé, partagé mot pour mot avec l'observation rendue par le
  -- modèle (`src/lib/diagnostic-vegetal.ts`). C'est CE partage qui rend le
  -- rapprochement déterministe possible — deux vocabulaires auraient demandé
  -- une traduction, donc une interprétation.
  "parties_atteintes" text[] NOT NULL DEFAULT '{}'::text[],

  -- Mois de 1 à 12. Nuls quand la source ne borne pas la période — on ne
  -- l'invente pas, le rapprochement s'en passe alors.
  "periode_debut_mois" smallint,
  "periode_fin_mois" smallint,

  -- La phrase du résultat, recopiée telle quelle. Jamais reformulée.
  "explication_courte" text NOT NULL,

  -- faible | vigilance | importante — les trois mots de l'écran.
  "gravite" text NOT NULL,

  -- aucun | possible | avere | inconnu
  "impact_mecanique" text NOT NULL DEFAULT 'inconnu',
  "impact_mecanique_note" text,

  -- aucun | irritant | toxique | allergisant | inconnu
  "risque_humain_animal" text NOT NULL DEFAULT 'inconnu',
  "risque_humain_animal_note" text,

  -- aucun | quarantaine | lutte_obligatoire | liste_alerte
  "statut_reglementaire" text NOT NULL DEFAULT 'aucun',
  "reference_reglementaire" text,

  -- possible | indicatif | impossible
  "diagnostic_photo" text NOT NULL,

  -- Les vues qui aident au diagnostic, dans le vocabulaire des parties.
  "photos_utiles" text[] NOT NULL DEFAULT '{}'::text[],

  -- Le « Que faire ? ». Une seule conduite, écrite à la source.
  "conduite_recommandee" text NOT NULL,

  -- Nuls tant qu'une source validée ne les remplit pas. `traitement` ne
  -- s'affiche que dans les détails, avec sa source : recommander un produit
  -- phytosanitaire engage, et l'IA n'en improvise aucun.
  "prevention" text,
  "gestion" text,
  "traitement" text,

  -- brouillon | en_revue | validee
  "niveau_validation" text NOT NULL DEFAULT 'brouillon',

  -- reelle | fixture_test
  "origine" text NOT NULL DEFAULT 'reelle',

  "version" integer NOT NULL DEFAULT 1,
  "sources_a_jour_le" date,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "fiches_phyto_code_uk" UNIQUE ("code"),

  CONSTRAINT "fiches_phyto_categorie_ck" CHECK ("categorie" IN (
    'maladie', 'champignon_lignivore', 'champignon_autre', 'ravageur',
    'carence', 'stress_abiotique', 'degat_mecanique'
  )),
  CONSTRAINT "fiches_phyto_agent_type_ck" CHECK ("agent_type" IN (
    'champignon', 'bacterie', 'virus', 'insecte', 'acarien', 'nematode',
    'abiotique', 'inconnu'
  )),
  CONSTRAINT "fiches_phyto_gravite_ck"
    CHECK ("gravite" IN ('faible', 'vigilance', 'importante')),
  CONSTRAINT "fiches_phyto_impact_mecanique_ck"
    CHECK ("impact_mecanique" IN ('aucun', 'possible', 'avere', 'inconnu')),
  CONSTRAINT "fiches_phyto_risque_ck"
    CHECK ("risque_humain_animal" IN ('aucun', 'irritant', 'toxique', 'allergisant', 'inconnu')),
  CONSTRAINT "fiches_phyto_reglementaire_ck"
    CHECK ("statut_reglementaire" IN ('aucun', 'quarantaine', 'lutte_obligatoire', 'liste_alerte')),
  CONSTRAINT "fiches_phyto_diagnostic_photo_ck"
    CHECK ("diagnostic_photo" IN ('possible', 'indicatif', 'impossible')),
  CONSTRAINT "fiches_phyto_validation_ck"
    CHECK ("niveau_validation" IN ('brouillon', 'en_revue', 'validee')),
  CONSTRAINT "fiches_phyto_origine_ck"
    CHECK ("origine" IN ('reelle', 'fixture_test')),

  -- Les mois, quand ils sont donnés, sont des mois. Une période qui « repart »
  -- en janvier (novembre → mars) est normale et volontairement acceptée : c'est
  -- le code qui sait la lire, pas la contrainte.
  CONSTRAINT "fiches_phyto_periode_ck" CHECK (
    ("periode_debut_mois" IS NULL OR "periode_debut_mois" BETWEEN 1 AND 12)
    AND ("periode_fin_mois" IS NULL OR "periode_fin_mois" BETWEEN 1 AND 12)
  ),

  -- ═══════════════════════════════════════════════════════════════════════
  -- UNE FIXTURE DE TEST NE PEUT PAS SE FAIRE PASSER POUR UNE VRAIE FICHE
  -- ═══════════════════════════════════════════════════════════════════════
  --
  -- Sa consigne du 20 août : « si des données de test sont nécessaires,
  -- utilise des fixtures explicitement identifiées et impossibles à exposer
  -- en production. »
  --
  -- L'équivalence est stricte dans les DEUX sens : une fiche marquée fixture
  -- DOIT porter le préfixe, et une fiche portant le préfixe NE PEUT PAS se
  -- déclarer réelle. Sans la seconde moitié, il suffirait d'une ligne mal
  -- écrite pour qu'une donnée d'essai serve un vrai chantier.
  --
  -- Ce que cela donne concrètement : `DELETE FROM fiches_phyto WHERE origine =
  -- 'fixture_test'` suffit à nettoyer, et la requête de contrôle
  -- `SELECT count(*) FROM fiches_phyto WHERE code LIKE 'zz-test-%'` répond en
  -- une ligne sur une base de production.
  CONSTRAINT "fiches_phyto_fixture_ck" CHECK (
    ("origine" = 'fixture_test') = ("code" LIKE 'zz-test-%')
  )
);

-- Le filtre que le moteur applique à chaque diagnostic : ce qui est servable.
CREATE INDEX "fiches_phyto_servables_idx"
  ON "fiches_phyto" ("categorie")
  WHERE "niveau_validation" = 'validee' AND "origine" = 'reelle';

CREATE INDEX "fiches_phyto_parties_idx" ON "fiches_phyto" USING gin ("parties_atteintes");

-- ── Symptômes et signes ────────────────────────────────────────────────────
--
-- **Une ligne par symptôme, et non un bloc de texte.** C'est sur ces lignes que
-- le rapprochement filtre et score ; noyées dans une prose, elles auraient
-- demandé qu'un modèle les relise à chaque diagnostic — donc qu'il interprète,
-- donc qu'il puisse se tromper au pire endroit.
--
-- La distinction `symptome` / `signe` est celle du métier, et elle compte pour
-- le score : un symptôme est ce que le végétal SUBIT (dessèchement,
-- décoloration), un signe est l'agent LUI-MÊME rendu visible (carpophore,
-- feutrage mycélien, galerie). Un signe vaut bien plus qu'un symptôme, parce
-- qu'un symptôme se partage entre dix causes et qu'un signe en désigne une.
--
-- `poids` dit ce que la source affirme : `cardinal` pour un caractère
-- déterminant, `frequent`, `possible`. Il n'est pas une probabilité — c'est un
-- rang, et le code ne le présente jamais comme un pourcentage.
CREATE TABLE "symptomes_phyto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fiche_id" uuid NOT NULL REFERENCES "fiches_phyto"("id") ON DELETE CASCADE,

  -- symptome | signe
  "nature" text NOT NULL,

  -- Vocabulaire fermé partagé avec l'observation.
  "partie" text NOT NULL,
  "motif" text NOT NULL,
  "couleurs" text[] NOT NULL DEFAULT '{}'::text[],
  "localisations" text[] NOT NULL DEFAULT '{}'::text[],

  -- cardinal | frequent | possible
  "poids" text NOT NULL DEFAULT 'frequent',

  -- Ce que la source en dit, en français. Sert aux détails, jamais au score.
  "libelle" text,

  "ordre" integer NOT NULL DEFAULT 0,

  CONSTRAINT "symptomes_phyto_nature_ck" CHECK ("nature" IN ('symptome', 'signe')),
  CONSTRAINT "symptomes_phyto_poids_ck" CHECK ("poids" IN ('cardinal', 'frequent', 'possible'))
);

CREATE INDEX "symptomes_phyto_fiche_idx" ON "symptomes_phyto" ("fiche_id");
CREATE INDEX "symptomes_phyto_motif_idx" ON "symptomes_phyto" ("partie", "motif");

-- ── Les hôtes ──────────────────────────────────────────────────────────────
--
-- `specificite` porte une information que rien d'autre ne porte : `strict`
-- signifie que la fiche NE PEUT PAS concerner un autre hôte. C'est une
-- exclusion, pas un malus — et c'est ce qui évite de proposer une maladie du
-- platane sur un chêne.
CREATE TABLE "hotes_phyto" (
  "fiche_id" uuid NOT NULL REFERENCES "fiches_phyto"("id") ON DELETE CASCADE,
  "taxon_id" uuid NOT NULL REFERENCES "taxons"("id") ON DELETE RESTRICT,

  -- strict | frequent | occasionnel
  "specificite" text NOT NULL DEFAULT 'frequent',

  PRIMARY KEY ("fiche_id", "taxon_id"),
  CONSTRAINT "hotes_phyto_specificite_ck"
    CHECK ("specificite" IN ('strict', 'frequent', 'occasionnel'))
);

CREATE INDEX "hotes_phyto_taxon_idx" ON "hotes_phyto" ("taxon_id");

-- ── Les confusions ─────────────────────────────────────────────────────────
--
-- **La table qui commande la demande de photo complémentaire.**
--
-- Quand deux hypothèses arrivent au coude à coude, l'écran ne pose pas de
-- question et n'invente pas de consigne : il lit `photo_qui_tranche` sur la
-- ligne qui relie les deux fiches, et affiche exactement ce qui y est écrit —
-- « Photographiez le dessous de la feuille ». Sans ligne, pas de relance : on
-- refuse de conclure plutôt que d'improviser une consigne.
--
-- Le couple est ordonné mais la lecture est symétrique (le code cherche dans
-- les deux sens) : demander à celui qui saisit d'écrire la ligne deux fois
-- garantirait qu'un jour les deux divergent.
CREATE TABLE "confusions_phyto" (
  "fiche_id" uuid NOT NULL REFERENCES "fiches_phyto"("id") ON DELETE CASCADE,
  "fiche_confondue_id" uuid NOT NULL REFERENCES "fiches_phyto"("id") ON DELETE CASCADE,

  -- Ce qui départage, en français, pour les détails.
  "critere_differenciant" text NOT NULL,

  -- La consigne affichée, mot pour mot. Nulle = aucune photo ne tranche, et
  -- alors on ne relance pas.
  "photo_qui_tranche" text,

  -- La partie à photographier, dans le vocabulaire fermé — sert à étiqueter la
  -- photo complémentaire reçue.
  "partie_qui_tranche" text,

  PRIMARY KEY ("fiche_id", "fiche_confondue_id"),
  CONSTRAINT "confusions_phyto_pas_soi_meme" CHECK ("fiche_id" <> "fiche_confondue_id")
);

CREATE INDEX "confusions_phyto_confondue_idx" ON "confusions_phyto" ("fiche_confondue_id");

-- ── Le lien fiche → source, champ par champ ────────────────────────────────
--
-- **`champs` est la colonne qui fait tout l'intérêt de cette table.** Une fiche
-- reliée « en gros » à trois organismes ne dit pas QUI affirme quoi : le jour
-- où la conduite recommandée est contestée, il faut pouvoir désigner la source
-- de CETTE ligne-là, pas la bibliographie entière.
CREATE TABLE "fiches_sources" (
  "fiche_id" uuid NOT NULL REFERENCES "fiches_phyto"("id") ON DELETE CASCADE,
  "source_id" uuid NOT NULL REFERENCES "sources_phyto"("id") ON DELETE RESTRICT,

  -- Les noms de colonnes appuyés par cette source : 'conduite_recommandee',
  -- 'gravite', 'symptomes'… Vide = la source appuie la fiche en général.
  "champs" text[] NOT NULL DEFAULT '{}'::text[],

  PRIMARY KEY ("fiche_id", "source_id")
);

CREATE INDEX "fiches_sources_source_idx" ON "fiches_sources" ("source_id");

-- ── Les images de référence ────────────────────────────────────────────────
--
-- **Sans licence, pas d'affichage** : la colonne est NOT NULL, et c'est le
-- garde-fou. Une photo d'organisme reprise sans droit sur l'écran d'un artisan
-- est un risque qui ne se voit qu'une fois la mise en demeure reçue.
CREATE TABLE "images_phyto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fiche_id" uuid NOT NULL REFERENCES "fiches_phyto"("id") ON DELETE CASCADE,

  -- Rangée dans le stockage d'Atlas, ou pointée chez son organisme. L'une des
  -- deux, jamais aucune.
  "storage_key" text,
  "url" text,

  "licence" text NOT NULL,
  "credit" text NOT NULL,

  -- La partie montrée, dans le vocabulaire fermé.
  "partie" text,
  "legende" text,
  "ordre" integer NOT NULL DEFAULT 0,

  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "images_phyto_source_ck" CHECK ("storage_key" IS NOT NULL OR "url" IS NOT NULL)
);

CREATE INDEX "images_phyto_fiche_idx" ON "images_phyto" ("fiche_id", "ordre");

-- ── Les droits sur la base commune ─────────────────────────────────────────
--
-- Pas de RLS : ces tables ne portent aucune donnée personnelle et sont
-- identiques pour tous les artisans — même raisonnement que
-- `documents_legaux`.
--
-- **`GRANT SELECT` SEUL, et c'est le point de sécurité de ce bloc.** L'import
-- tourne sous le rôle propriétaire, comme les migrations. Une faille dans
-- l'application ne peut donc pas écrire une maladie inventée dans la base
-- commune de tout le monde : il n'y a pas de droit d'écriture à voler.
GRANT SELECT ON "sources_phyto" TO atlas_app;
GRANT SELECT ON "taxons" TO atlas_app;
GRANT SELECT ON "fiches_phyto" TO atlas_app;
GRANT SELECT ON "symptomes_phyto" TO atlas_app;
GRANT SELECT ON "hotes_phyto" TO atlas_app;
GRANT SELECT ON "confusions_phyto" TO atlas_app;
GRANT SELECT ON "fiches_sources" TO atlas_app;
GRANT SELECT ON "images_phyto" TO atlas_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- B. LES DIAGNOSTICS — SES DONNÉES, ISOLÉES PAR RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Le diagnostic ──────────────────────────────────────────────────────────
--
-- **`chantier_id` est NULLABLE, et c'est une décision produit, pas une
-- commodité.** Sa règle du 20 août : « le diagnostic doit fonctionner de
-- manière totalement autonome ; aucun chantier ne doit être nécessaire. »
-- C'est la même objection qu'il avait faite pour le plan d'arrosage
-- (`ARCHITECTURE.md` §125) : un outil qui exige un chantier ne sert pas en
-- visite de devis, quand le client n'existe pas encore. Le rattachement vient
-- après, s'il le veut.
--
-- **`resultat` est FIGÉ.** Ce que le patron a lu ce jour-là ne doit pas changer
-- parce qu'une fiche a été corrigée depuis. Sans ce gel, un diagnostic
-- contesté six mois plus tard deviendrait impossible à relire — et c'est
-- exactement le moment où on en a besoin. Même raisonnement que l'instantané
-- d'un devis envoyé (0015) et du rapport d'entretien (0055).
--
-- **`moteur`, `modele`, `version_base` : la traçabilité.** Trois colonnes qui
-- ne servent jamais à l'écran et qui sauvent une enquête. Sans elles, un
-- diagnostic douteux ne se rattache à rien : ni au fournisseur qui a regardé la
-- photo, ni à l'état de la base ce jour-là.
CREATE TABLE "diagnostics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- Facultatif, et rattachable après coup.
  "chantier_id" uuid,

  -- en_analyse | complement_demande | rendu | inconclusif | echoue
  "statut" text NOT NULL DEFAULT 'en_analyse',

  -- La fiche retenue. `ON DELETE RESTRICT` : une fiche citée par un diagnostic
  -- ne se supprime pas — le résultat figé la nomme, et un renvoi mort serait
  -- pire que la fiche périmée.
  "fiche_id" uuid REFERENCES "fiches_phyto"("id") ON DELETE RESTRICT,

  -- elevee | probable | incertaine — TROIS MOTS, jamais un pourcentage.
  -- Sa règle : « ne pas afficher de faux pourcentages de précision du type
  -- 93 % si le modèle utilisé ne fournit pas une probabilité réellement
  -- calibrée ». Aucun modèle employé ici n'en fournit.
  "confiance" text,

  -- Ce que le modèle a cru voir comme essence, et à quel point. Nul quand la
  -- photo ne le permet pas — auquel cas le rapprochement travaille sans, et la
  -- confiance en tient compte plutôt que de faire comme si.
  "taxon_id" uuid REFERENCES "taxons"("id") ON DELETE SET NULL,
  "essence_confiance" text,

  -- L'observation structurée rendue par le modèle, telle quelle. Aucune prose
  -- affichée n'en sort : elle sert au rapprochement et au diagnostic d'un
  -- diagnostic raté.
  "observation" jsonb,

  -- Le résultat tel qu'il a été montré. Figé.
  "resultat" jsonb,

  -- La consigne de photo complémentaire, recopiée de `confusions_phyto`.
  -- Non nulle uniquement quand `statut = 'complement_demande'`.
  "complement_consigne" text,
  "complement_partie" text,

  -- **UNE SEULE relance, jamais deux.** Sa règle. La colonne existe pour que
  -- l'invariant soit vérifiable en base et pas seulement dans le code.
  "complements_demandes" smallint NOT NULL DEFAULT 0,

  -- Traçabilité.
  "moteur" text,
  "modele" text,
  "version_base" text,

  -- Ce qui a empêché de conclure, en français, pour l'écran. Vient d'une liste
  -- fermée du code — jamais d'un modèle.
  "motif_refus" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "rendu_at" timestamptz,

  CONSTRAINT "diagnostics_statut_ck" CHECK ("statut" IN (
    'en_analyse', 'complement_demande', 'rendu', 'inconclusif', 'echoue'
  )),
  CONSTRAINT "diagnostics_confiance_ck"
    CHECK ("confiance" IS NULL OR "confiance" IN ('elevee', 'probable', 'incertaine')),
  CONSTRAINT "diagnostics_complements_ck"
    CHECK ("complements_demandes" >= 0 AND "complements_demandes" <= 1),

  -- Un diagnostic rendu nomme une fiche et porte une confiance. Sans cette
  -- contrainte, un défaut de code laisserait un résultat « rendu » sans rien à
  -- montrer, et l'écran afficherait un titre vide.
  CONSTRAINT "diagnostics_rendu_complet_ck" CHECK (
    "statut" <> 'rendu' OR ("fiche_id" IS NOT NULL AND "confiance" IS NOT NULL AND "resultat" IS NOT NULL)
  ),

  -- Une demande de complément sans consigne serait une impasse à l'écran :
  -- « prenez une autre photo », sans dire laquelle.
  CONSTRAINT "diagnostics_complement_consigne_ck" CHECK (
    "statut" <> 'complement_demande' OR "complement_consigne" IS NOT NULL
  ),

  -- Le chantier appartient à la même entreprise que le diagnostic — un renvoi
  -- vers le chantier d'une autre société serait une fuite que la RLS seule ne
  -- verrait pas (le diagnostic, lui, est bien isolé).
  --
  -- **`SET NULL (chantier_id)` désigne la colonne, et il le faut :** sans la
  -- liste, PostgreSQL annulerait les DEUX colonnes du renvoi — dont
  -- `entreprise_id`, qui est NOT NULL. La suppression d'un chantier échouerait
  -- alors sur une contrainte, et l'erreur accuserait le diagnostic plutôt que
  -- ce renvoi. (Liste de colonnes : PostgreSQL 15+ ; la CI et le banc sont
  -- en 16.)
  --
  -- Et c'est bien `SET NULL` qu'il faut, non `CASCADE` : un diagnostic est
  -- autonome par décision produit. Rattaché puis le chantier supprimé, il
  -- redevient ce qu'il était — un diagnostic libre, pas une perte.
  CONSTRAINT "diagnostics_chantier_entreprise_fk"
    FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE SET NULL ("chantier_id")
);

CREATE INDEX "diagnostics_entreprise_idx" ON "diagnostics" ("entreprise_id", "created_at" DESC);
CREATE INDEX "diagnostics_chantier_idx" ON "diagnostics" ("entreprise_id", "chantier_id");

ALTER TABLE "diagnostics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostics" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diagnostics_isolation" ON "diagnostics"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "diagnostics" TO atlas_app;

-- ── Les photos du diagnostic ───────────────────────────────────────────────
--
-- **`storage_key` est ANNULABLE**, exactement comme sur `notes_vocales` : la
-- photo se purge et le diagnostic lui survit. Il garde alors son résultat, sa
-- date et sa fiche — ce qui compte —, sans garder l'image d'un jardin.
--
-- **`exif_retire` n'est pas décoratif.** Une photo de jardin porte une maison,
-- parfois un visage, et les coordonnées GPS de chez le client. Les métadonnées
-- sont retirées avant rangement ; la colonne le PROUVE ligne par ligne, ce qui
-- rend le contrôle possible après coup — « est-ce que toutes les photos rangées
-- depuis le 20 août sont nettoyées ? » se répond en une requête.
CREATE TABLE "photos_diagnostic" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "diagnostic_id" uuid NOT NULL REFERENCES "diagnostics"("id") ON DELETE CASCADE,

  "storage_key" text,
  "mime_type" text NOT NULL,
  "taille_octets" integer NOT NULL,
  "checksum" text NOT NULL,

  -- initiale | complement
  "role" text NOT NULL DEFAULT 'initiale',
  -- La partie demandée, quand c'est un complément.
  "partie_demandee" text,

  "exif_retire" boolean NOT NULL DEFAULT false,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "purgee_le" timestamptz,

  CONSTRAINT "photos_diagnostic_role_ck" CHECK ("role" IN ('initiale', 'complement'))
);

CREATE INDEX "photos_diagnostic_diagnostic_idx" ON "photos_diagnostic" ("entreprise_id", "diagnostic_id");

ALTER TABLE "photos_diagnostic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "photos_diagnostic" FORCE ROW LEVEL SECURITY;

CREATE POLICY "photos_diagnostic_isolation" ON "photos_diagnostic"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "photos_diagnostic" TO atlas_app;

-- ── Les hypothèses internes ────────────────────────────────────────────────
--
-- Ce que le moteur a envisagé, avec son score et le détail de ce qui a compté.
-- **Jamais affiché** — sa règle : « le système doit pouvoir produire plusieurs
-- hypothèses en interne, mais ne pas surcharger l'utilisateur. »
--
-- Elles existent pour une seule raison : le jour où un diagnostic se trompe, on
-- doit pouvoir savoir POURQUOI. Sans cette table, il ne resterait que le
-- résultat — c'est-à-dire précisément ce qui est faux, sans rien pour remonter
-- au critère fautif.
CREATE TABLE "hypotheses_diagnostic" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "diagnostic_id" uuid NOT NULL REFERENCES "diagnostics"("id") ON DELETE CASCADE,
  "fiche_id" uuid NOT NULL REFERENCES "fiches_phyto"("id") ON DELETE CASCADE,

  "rang" smallint NOT NULL,
  -- Score interne, entre 0 et 1000 pour rester entier. **Ce n'est PAS une
  -- probabilité**, et il ne sort jamais à l'écran — d'où l'échelle inhabituelle,
  -- qui décourage de l'afficher comme un pourcentage.
  "score" integer NOT NULL,
  -- Les critères qui ont compté, pour la relecture.
  "motifs" jsonb NOT NULL DEFAULT '[]'::jsonb,

  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "hypotheses_diagnostic_uk" UNIQUE ("diagnostic_id", "fiche_id")
);

CREATE INDEX "hypotheses_diagnostic_idx" ON "hypotheses_diagnostic" ("entreprise_id", "diagnostic_id", "rang");

ALTER TABLE "hypotheses_diagnostic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hypotheses_diagnostic" FORCE ROW LEVEL SECURITY;

CREATE POLICY "hypotheses_diagnostic_isolation" ON "hypotheses_diagnostic"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "hypotheses_diagnostic" TO atlas_app;

-- ── La file de purge des photos ────────────────────────────────────────────
--
-- Copie conforme d'`audios_a_purger` (0017), pour la raison qui l'avait fait
-- naître : **une opération de maintenance sans contexte d'entreprise passe par
-- une file qui PORTE l'entreprise, jamais par un contournement de la RLS**
-- (`CLAUDE.md` §4).
--
-- `purger_le` est calculé à l'écriture depuis une politique CONFIGURABLE
-- (`src/lib/retention-diagnostic.ts`), et non gravé ici : sa consigne du
-- 20 août — « ne grave pas une durée arbitraire dans le code ». Une photo
-- rattachée à un chantier suit la règle du dossier chantier, qui peut différer.
CREATE TABLE "photos_diagnostic_a_purger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "photo_id" uuid NOT NULL REFERENCES "photos_diagnostic"("id") ON DELETE CASCADE,
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "purger_le" timestamptz NOT NULL,
  "mis_en_file_le" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "photos_diagnostic_a_purger_uk" UNIQUE ("photo_id")
);

CREATE INDEX "photos_diagnostic_a_purger_echeance_idx" ON "photos_diagnostic_a_purger" ("purger_le");

GRANT SELECT, INSERT, UPDATE, DELETE ON "photos_diagnostic_a_purger" TO atlas_app;
