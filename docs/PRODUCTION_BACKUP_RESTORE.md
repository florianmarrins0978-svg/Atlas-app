# Sauvegarde et restauration — Atlas (production)

Ce document ne prétend PAS que des sauvegardes automatiques sont déjà activées.
Aucune preuve de configuration externe n'existe dans ce dépôt : tout ce qui
suit est à mettre en place sur l'infrastructure de production, en dehors de
ce code.

## 1. Hypothèse de fournisseur

**[À COMPLÉTER PAR L'ÉQUIPE INFRASTRUCTURE]** — ce document suppose une base
PostgreSQL managée (ex. RDS, Neon, Supabase, Cloud SQL). Remplacer cette
section par le fournisseur réellement choisi avant le premier déploiement.

## 2. Sauvegardes automatiques — configuration requise (externe au dépôt)

- Activer les sauvegardes automatiques quotidiennes du fournisseur choisi.
- **Fréquence minimale** : 1 sauvegarde complète par jour.
- **Rétention cible** : 14 jours glissants minimum ; 30 jours recommandé pour
  une première année de production.
- **Point-in-time recovery (PITR)** : à activer si le fournisseur le propose
  (permet une restauration à une seconde près, pas seulement au dernier
  snapshot quotidien) — fortement recommandé dès que le volume de données
  client le justifie.

**Aucune de ces options n'est configurée par ce dépôt.** Elles doivent être
activées manuellement dans la console du fournisseur avant le premier
déploiement en production.

## 3. Sauvegarde manuelle avant migration

Avant toute migration en production (`drizzle/000X_*.sql`) :

1. Déclencher une sauvegarde à la demande via l'outil du fournisseur
   (ex. `pg_dump` vers un stockage objet séparé, ou snapshot managé).
2. Vérifier que la sauvegarde est bien terminée et horodatée avant de lancer
   la migration.
3. Ne jamais appliquer une migration en production sans cette sauvegarde
   récente, même pour une migration jugée "sûre" (additive).

Commande de référence (à adapter à l'environnement réel) :

**Important — vérifié lors d'un exercice réel de sauvegarde/restauration (voir
historique) :** exécuter `pg_dump` avec la chaîne de connexion applicative
(`DATABASE_URL`, rôle `atlas_owner`) **échoue** sur les tables à
`FORCE ROW LEVEL SECURITY` — le propriétaire d'une table reste soumis à RLS
tant que `FORCE` est actif, et `atlas_owner` n'a pas l'attribut `BYPASSRLS`.
La sauvegarde doit être effectuée soit par le mécanisme de sauvegarde interne
du fournisseur managé (qui opère généralement au niveau du stockage/WAL, en
dehors de toute connexion applicative), soit avec un rôle dédié disposant de
`BYPASSRLS`, jamais avec le rôle `atlas_app`/`atlas_owner` utilisé par
l'application elle-même.

```bash
# Ne fonctionne PAS avec le rôle applicatif (échoue sur les tables RLS) :
# pg_dump "$DATABASE_URL" --format=custom --file=backup.dump

# Fonctionne : rôle disposant de BYPASSRLS (ou sauvegarde native du fournisseur managé)
pg_dump --format=custom --file="backup-pre-migration-$(date +%Y%m%d-%H%M%S).dump" \
  -h <hote> -U <role_avec_bypassrls> -d <base>
```

## 4. Procédure de restauration

**Ne jamais restaurer directement par-dessus la base de production.**
La restauration se fait systématiquement dans une base séparée, distincte de
la base de production, jusqu'à vérification complète.

1. Provisionner une base PostgreSQL temporaire distincte (même version majeure
   que la production).
2. Restaurer la sauvegarde choisie dans cette base temporaire :
   ```bash
   pg_restore --dbname="$DATABASE_URL_TEMPORAIRE" backup-XXX.dump
   ```
3. Ne basculer le trafic applicatif vers la base restaurée qu'après avoir
   complété la section 5 ci-dessous.

## 5. Vérification après restauration

Avant de considérer une restauration valide :

- Comparer le nombre de lignes des tables critiques (`entreprises`,
  `chantiers`, `devis`, `lignes_devis`) entre la base restaurée et le dernier
  état connu.
- Vérifier qu'au moins un devis envoyé (`statut = 'envoye'`) est bien présent
  et que ses lignes sont intactes (immuabilité).
- Vérifier que les politiques RLS sont toujours actives (`FORCE ROW LEVEL
  SECURITY`) sur les tables concernées — une restauration depuis un dump ne
  doit jamais désactiver silencieusement RLS.
- Faire exécuter la suite de tests de ce dépôt (`scripts/`) contre la base
  restaurée avant toute bascule de trafic.

## 6. Responsabilité et fréquence de test de restauration

- **Responsable** : **[À COMPLÉTER — nommer une personne ou un rôle, ex.
  "l'ingénieur d'astreinte du mois" ou "le responsable infrastructure"]**.
- **Fréquence de test de restauration** : au minimum une restauration test
  complète (sections 4 et 5) tous les trimestres, et systématiquement après
  tout changement de fournisseur ou de version majeure de PostgreSQL.

## 7. Interdiction formelle

**Ne jamais tester une restauration directement sur la base de production.**
Toute restauration, y compris à des fins de test, se fait dans une base
séparée et jetable.

## 8. Journal des exercices de restauration effectués

| Date | Environnement | Résultat | Anomalie détectée |
|---|---|---|---|
| 2026-07-29 | Sandbox de développement (base `atlas_dev`) | ✅ Réussi — comptes de lignes identiques avant/après, RLS (`relrowsecurity`/`relforcerowsecurity`) intact, comportement fail-closed reconfirmé sans contexte défini | `pg_dump` via le rôle applicatif échoue sur les tables RLS (voir §3, corrigé dans ce document) |
| 2026-07-29 (2e exercice, après ajout des tables d'authentification/propositions IA) | Sandbox de développement (base `atlas_dev`) | ✅ Réussi — comptes identiques, RLS intact sur 5 tables incluant `propositions_ia` (ajoutée depuis le premier exercice), fail-closed reconfirmé sur `membres_entreprise`, table `_migrations` restaurée correctement (13/13 reconnues à jour par `scripts/run-migrations.ts` sans réappliquer quoi que ce soit) | Aucune — la correction du premier exercice (rôle `BYPASSRLS`) suffit |

**Le prochain exercice doit être effectué contre un environnement de staging réel dès qu'il existe**, avec le mécanisme de sauvegarde effectivement utilisé en production (pas `pg_dump` manuel), pour confirmer que la procédure fonctionne aussi avec l'outillage réel du fournisseur managé.


---

# Stratégie de migration

## Principes déjà appliqués dans ce dépôt

- **Migrations additives par défaut** : toutes les migrations existantes
  (`drizzle/0000` à `drizzle/0011`) ajoutent des tables/colonnes/contraintes
  sans jamais supprimer de colonne ou de table existante — vérifié : aucune
  occurrence de `DROP COLUMN` ni `DROP TABLE` dans l'historique actuel.
- **Expand-and-contract pour les changements incompatibles** : si un futur
  changement nécessite de renommer ou retirer une colonne utilisée par du
  code en production, procéder en trois migrations séparées et déployées
  indépendamment :
  1. **Expand** — ajouter la nouvelle colonne/structure, remplir en
     parallèle de l'ancienne.
  2. **Bascule applicative** — déployer le code qui lit/écrit uniquement la
     nouvelle structure.
  3. **Contract** — une fois la bascule confirmée stable, retirer l'ancienne
     colonne dans une migration séparée et ultérieure.
- **Corrections par migration supplémentaire (roll-forward)**, jamais par
  réécriture d'une migration déjà appliquée en production — une migration
  déployée est immuable ; toute correction passe par une nouvelle migration.

## Compatibilité application/base pendant un déploiement

- Le code applicatif déployé doit toujours rester compatible avec le schéma
  de la version N-1 pendant la fenêtre de déploiement (déploiements progressifs
  possibles) — c'est la raison d'être de l'expand-and-contract ci-dessus.
- Une migration additive peut être appliquée avant, pendant ou après le
  déploiement du code qui l'utilise, sans interruption de service.

## Conditions de rollback applicatif sûr

- Un rollback du code applicatif seul (sans rollback de migration) est sûr
  tant que la migration la plus récente était purement additive (le code
  précédent ignore simplement les nouvelles colonnes/tables).
- Un rollback n'est **pas** sûr si la migration la plus récente a modifié le
  comportement d'une contrainte, d'un trigger, ou d'une colonne déjà lue/
  écrite par le code précédent — dans ce cas, revenir en arrière nécessite
  une migration corrective dédiée (roll-forward), jamais un rollback de base
  de données en production.
