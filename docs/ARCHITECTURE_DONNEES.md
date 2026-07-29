# Atlas — Architecture de la couche de données réelle (v2)

Version 2, intégrant les corrections demandées sur la v1. Aucun code n'a été modifié pour produire ce document.

## 1. Base de données et ORM

**PostgreSQL** via **Prisma**, hébergé sur **Neon** (branching par environnement). Inchangé depuis la v1 — ce choix n'est pas remis en cause par vos corrections.

## 2. Schéma conceptuel complet

```
User (table gérée par Auth.js — voir §8/9)
  id, email (unique), name, email_verified, image, created_at

Account (Auth.js — liaison OAuth, ex. Google)
  id, user_id → User, provider, provider_account_id, ...

VerificationToken (Auth.js — jetons de lien magique)
  identifier, token, expires

utilisateurs   -- extension de User avec nos champs propres
  id (= User.id), nom, created_at, updated_at

entreprises
  id, nom, siret, adresse, telephone, email, iban,
  created_at, updated_at, deleted_at

membres_entreprise                -- remplace utilisateur.entreprise_id (correction 1)
  id, entreprise_id → entreprises, utilisateur_id → utilisateurs,
  role ("proprietaire" | "membre"), created_at
  UNIQUE (entreprise_id, utilisateur_id)

clients
  id, entreprise_id → entreprises, nom, telephone, adresse, email?,
  created_at, updated_at, deleted_at, created_by → utilisateurs

chantiers
  id, entreprise_id → entreprises,
  client_id → clients NULLABLE,                  -- correction 2
  nom, adresse_chantier,
  informations_verifiees_at timestamptz?,          -- correction 3 : jalons datés
  prix_valide_at timestamptz?,
  devis_genere_at timestamptz?,
  devis_envoye_at timestamptz?,
  date_planifiee date?,                            -- non-null = "planifié"
  created_at, updated_at, deleted_at,
  created_by → utilisateurs, updated_by → utilisateurs
  UNIQUE (id, entreprise_id)                       -- support des FK composites (§6)

prestations
  id, entreprise_id → entreprises, chantier_id → chantiers,
  libelle, ordre, created_at, updated_at

materiel
  id, entreprise_id → entreprises, chantier_id → chantiers,
  libelle, ordre, created_at, updated_at

notes_vocales
  id, entreprise_id → entreprises, chantier_id → chantiers (unique),
  storage_key, mime_type, taille_octets, nom_original, checksum,   -- correction 10
  duree_secondes, transcription text?,
  created_at, updated_at

photos
  id, entreprise_id → entreprises, chantier_id → chantiers,
  storage_key, mime_type, taille_octets, nom_original, checksum,
  ordre, created_at, created_by → utilisateurs, deleted_at

tarifs
  id, entreprise_id → entreprises, intitule, prix Decimal(10,2), unite?,
  created_at, updated_at, deleted_at

lignes_prix                        -- lignes de travail éditables (écran Prix)
  id, entreprise_id → entreprises, chantier_id → chantiers,
  libelle, montant Decimal(10,2), ordre,
  created_at, updated_at

devis                              -- correction 5 : plusieurs versions par chantier
  id, entreprise_id → entreprises, chantier_id → chantiers,
  numero_version int,
  statut ("brouillon" | "envoye"),
  total_ht Decimal(10,2), taux_tva Decimal(4,3), total_ttc Decimal(10,2),
  pdf_storage_key?, pdf_checksum?,
  created_at, created_by → utilisateurs,
  envoye_le timestamptz?
  UNIQUE (chantier_id, numero_version)

lignes_devis                       -- instantané immuable, propre à une version de devis
  id, devis_id → devis,
  libelle, quantite Decimal(10,2), prix_unitaire Decimal(10,2), montant Decimal(10,2),
  ordre
```

## 3. Contraintes d'unicité et d'intégrité

- `membres_entreprise` : `UNIQUE (entreprise_id, utilisateur_id)` — un utilisateur n'a qu'une seule appartenance par entreprise.
- `chantiers.client_id` nullable, `ON DELETE SET NULL` (un chantier n'est jamais supprimé si son client l'est).
- `devis` : `UNIQUE (chantier_id, numero_version)` — versions strictement croissantes par chantier.
- `notes_vocales` : une seule ligne par chantier (`UNIQUE (chantier_id)`) — remplacer une note écrase la ligne existante, pas d'historique dans un premier temps.
- Colonnes monétaires : **exclusivement `Decimal`** (mappé sur `NUMERIC` en Postgres), jamais `Float` — correction 4. Concerne `tarifs.prix`, `lignes_prix.montant`, `devis.total_ht/total_ttc/taux_tva`, `lignes_devis.montant/prix_unitaire`.

### Cohérence `entreprise_id` avec les relations parentes (correction 6)

Chaque table métier conserve `entreprise_id` en plus de sa clé étrangère vers son parent (`chantier_id`, `client_id`...), pour simplifier les requêtes RLS — mais rien n'empêche nativement une incohérence (une ligne pointant vers un chantier d'une autre entreprise) sans contrainte dédiée. Solution : **clé étrangère composite**, motif standard PostgreSQL :

```sql
-- Le parent expose une clé unique composite (id, entreprise_id)
ALTER TABLE chantiers ADD CONSTRAINT chantiers_id_entreprise_uk UNIQUE (id, entreprise_id);

-- L'enfant référence cette paire, jamais seulement l'id
ALTER TABLE photos
  ADD CONSTRAINT photos_chantier_entreprise_fk
  FOREIGN KEY (chantier_id, entreprise_id)
  REFERENCES chantiers (id, entreprise_id);
```

Résultat : il devient **structurellement impossible** en base d'insérer une photo, une prestation, une ligne de prix ou un devis avec un `entreprise_id` différent de celui du chantier parent — la contrainte rejette l'insertion, indépendamment de tout bug applicatif.

Limite technique à noter : Prisma ne modélise pas nativement les FK composites vers une clé unique non-primaire. Le schéma Prisma déclarera la relation classique sur `id` ; ces contraintes composites seront ajoutées via une migration SQL manuelle (`prisma migrate dev --create-only` puis édition du fichier de migration généré). Même principe appliqué à `chantiers → clients`, et à toutes les tables enfants de `chantiers` (`prestations`, `materiel`, `notes_vocales`, `lignes_prix`, `devis`).

## 4. Index principaux

```
membres_entreprise   (entreprise_id, utilisateur_id) UNIQUE
clients              (entreprise_id, deleted_at)
                     (entreprise_id, nom)
chantiers            (entreprise_id, deleted_at)
                     (entreprise_id, client_id)
                     (entreprise_id, date_planifiee)   -- écran Planning
tarifs               (entreprise_id, deleted_at)
devis                (chantier_id, numero_version) UNIQUE
                     (entreprise_id, statut)
photos, prestations, materiel, lignes_prix
                     (entreprise_id, chantier_id)
```

## 5. Stratégie d'authentification (correction 8)

**Lien magique par email en méthode principale**, Google OAuth en complément optionnel. Aucune authentification par mot de passe maison tant qu'une décision dédiée ne l'exige pas explicitement.

- Provider Auth.js `Email` (lien magique), envoi via un service transactionnel (Resend).
- Provider Auth.js `Google` en complément, même configuration, aucun stockage de mot de passe dans les deux cas.
- **Stratégie de session : JWT**, pas de session en base — plus simple en environnement serverless (pas de table `Session` à gérer, pas de nettoyage de sessions expirées).
- Le JWT porte `utilisateur_id` ; l'`entreprise_id` actif est résolu à chaque requête via `membres_entreprise` (utile dès qu'un utilisateur pourra appartenir à plusieurs entreprises).

## 6. Tables techniques requises par Auth.js (correction 9)

Avec la stratégie JWT + adaptateur Prisma pour la persistance des comptes/jetons :

- `User` — devient notre table `utilisateurs` (étendue avec `nom`, cf. §2).
- `Account` — liaison des comptes OAuth (Google).
- `VerificationToken` — jetons de lien magique à usage unique, expirants.
- `Session` **non nécessaire** (stratégie JWT, pas de session persistée en base).

## 7. Stratégie RLS détaillée (correction 7)

- **Contexte d'entreprise fixé par transaction, jamais par connexion** : chaque appel de repository ouvre une transaction et exécute `SET LOCAL app.entreprise_id = '<uuid>'` comme première instruction. `SET LOCAL` limite la portée à la transaction courante — indispensable avec des connexions mutualisées (pooling Neon/PgBouncer), pour qu'aucun contexte ne puisse fuiter vers une requête suivante réutilisant la même connexion physique.
- **`FORCE ROW LEVEL SECURITY`** sur chaque table métier, pas seulement `ENABLE` — sans `FORCE`, les politiques RLS ne s'appliquent pas au rôle propriétaire de la table, un piège classique qui rendrait la protection inopérante pour le rôle utilisé par les migrations s'il servait aussi à l'exécution.
- **Rôle applicatif dédié, sans `BYPASSRLS`** : l'application se connecte via un rôle Postgres (`app_user`) distinct du rôle propriétaire/migrateur, sans droit `BYPASSRLS` ni superutilisateur. Les migrations s'exécutent avec un rôle privilégié séparé, jamais utilisé à l'exécution.

Exemple de politique :

```sql
ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantiers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON chantiers
  USING (entreprise_id = current_setting('app.entreprise_id', true)::uuid);
```

Wrapper applicatif (illustratif) :

```ts
async function withEntreprise<T>(entrepriseId: string, fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.entreprise_id = ${entrepriseId}`;
    return fn(tx);
  });
}
```

- **Tests automatisés d'isolation interentreprises** : suite dédiée (hors Playwright, exécution directe contre la base de test) qui seed deux entreprises A et B, puis vérifie systématiquement, pour chaque table métier :
  - qu'une requête sous le contexte A retourne 0 ligne appartenant à B ;
  - qu'une tentative d'écriture (insertion/mise à jour) référençant un `chantier_id`/`client_id` de B échoue sous le contexte A (grâce aux contraintes composites du §3, en plus de RLS) ;
  - exécutée en CI à chaque modification de `prisma/` ou `src/server/repositories/`.

## 8. Cycle de vie d'un devis (correction 5)

1. Le patron déclenche « Préparer le devis » : une ligne `devis` est créée, `numero_version = 1`, `statut = "brouillon"`, avec une copie figée des `lignes_prix` du chantier au moment T dans `lignes_devis`. `chantiers.devis_genere_at` est renseigné (uniquement s'il était vide — reflète la première génération, jamais réécrit ensuite).
2. Tant que `statut = "brouillon"`, le devis peut être régénéré (nouvelles lignes recopiées depuis `lignes_prix`) sans changer de version.
3. À l'envoi, `statut` passe à `"envoye"`, `envoye_le` est renseigné, un PDF est généré et son `pdf_storage_key` enregistré. **À partir de cet instant, `lignes_devis`, les montants et le PDF de cette version ne sont plus jamais modifiés** — c'est un instantané immuable, indépendant de toute modification ultérieure de `lignes_prix` sur le chantier. `chantiers.devis_envoye_at` est renseigné (première fois uniquement).
4. Si le client demande une modification après envoi, le patron ajuste les `lignes_prix` du chantier puis génère un **nouveau devis**, `numero_version = 2`, à nouveau en `"brouillon"` — l'historique complet des versions envoyées reste consultable, jamais altéré.
5. `getNextAction()` ne s'intéresse qu'aux jalons du chantier (`devis_genere_at`, `devis_envoye_at`) — il ignore combien de versions existent réellement ; consulter l'historique des devis est une action secondaire, pas l'action principale.

## 9. Cycle de vie des fichiers (photos, note vocale)

- Upload : le client obtient une URL de dépôt signée à courte durée (générée côté serveur, jamais stockée), dépose le fichier directement dans le bucket, puis confirme au serveur qui enregistre `storage_key`, `mime_type`, `taille_octets`, `nom_original`, `checksum` (correction 10) — jamais l'URL elle-même.
- Lecture (afficher une photo, réécouter une note) : le serveur vérifie l'appartenance à l'entreprise de l'utilisateur, puis génère une URL signée de lecture à expiration courte (quelques minutes), jamais mise en cache côté client au-delà de sa durée de vie.
- Suppression (photo) : marquée `deleted_at`, le fichier physique est purgé du bucket par une tâche différée (pas de suppression irréversible immédiate, cohérent avec le principe déjà établi d'`UndoToast`/confirmation avant perte définitive).
- Remplacement (note vocale) : nouvel upload, ancienne clé de stockage purgée après confirmation, ligne `notes_vocales` mise à jour en place (une seule ligne par chantier).

## 10. Colonnes d'audit et de traçabilité (correction 11)

Toutes les tables métier : `created_at`, `updated_at`. Archivage (`deleted_at`) sur `clients`, `chantiers`, `tarifs`, `photos` — pas sur les instantanés immuables (`lignes_devis`) ni les tables de jonction (`membres_entreprise`). `created_by`/`updated_by` (→ `utilisateurs`) sur les objets sensibles : `chantiers`, `devis`, `tarifs`, `clients`.

## 11. Plan de migration depuis les données simulées

1. Écrire le schéma Prisma ci-dessus, première migration, puis migration SQL manuelle pour les FK composites (§3).
2. Script de seed reconstituant les données actuelles de `mock-data.ts` comme de vraies lignes, rattachées à une entreprise et un utilisateur de démonstration, avec jalons datés cohérents (ex. un chantier « à vérifier » a `informations_verifiees_at = null`).
3. Créer la couche `src/server/repositories/*.ts`, chaque fonction acceptant un contexte d'entreprise et passant par `withEntreprise()` (§7).
4. `getNextAction()` et `getPlanificationEtat()` sont adaptés pour lire les jalons datés au lieu des booléens (signature de sortie inchangée) — les écrans qui les consomment n'ont rien à changer.
5. Migration écran par écran, même méthode qu'aujourd'hui (petite étape, test, validation) ; `mock-data.ts` ne sert plus qu'au seed et aux tests une fois tous les écrans réels migrés.

## 12. Estimation des coûts (corrigée)

| Poste | Détail |
|---|---|
| **Neon (Postgres)** | Tarification **à l'usage**, pas un forfait fixe : temps de calcul actif (le compute se met en veille automatiquement) + stockage au Go. Palier gratuit couvrant largement le développement et une mise en route ; au-delà, facturation à la consommation réelle (typiquement quelques dollars à quelques dizaines de dollars/mois pour un usage mono-entreprise, variable selon l'activité). |
| **Cloudflare R2** | Palier gratuit : 10 Go de stockage, 1M d'opérations Classe A (écritures), 10M d'opérations Classe B (lectures) par mois. Au-delà : stockage ~0,015 $/Go/mois, Classe A ~4,50 $/million d'opérations, Classe B ~0,36 $/million — **aucun frais de sortie (egress) dans tous les cas**, contrairement à S3. |
| **Auth.js** | Gratuit (open source). |
| **Email transactionnel (Resend)** | Palier gratuit ~3000 emails/mois, quelques dollars/mois au-delà. |
| **Hébergement (Vercel)** | Le palier **Hobby est réservé à un usage personnel/non commercial** selon les conditions d'utilisation de Vercel — **non utilisable en production commerciale**. Un plan **Pro** (~20 $/mois/membre) est à prévoir dès la mise en production réelle, indépendamment du volume d'usage. |

Estimation réaliste en démarrage commercial (1 à quelques entreprises clientes) : **20 à 50 $/mois** (dominé par l'hébergement Pro obligatoire), hors coûts d'IA/transcription à chiffrer à l'étape correspondante.

---

Aucune implémentation n'a été commencée. J'attends votre validation de cette version 2 avant d'écrire le moindre code.
