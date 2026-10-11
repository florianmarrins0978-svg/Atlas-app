# Migration 0087 — correction du 13 septembre 2026

*Rapport de la correction demandée après le diagnostic
(`docs/diagnostic-trois-ecrans.md`). Rien n'est fusionné sur `main` à ce stade.*

---

## Cause exacte

`diagnostics` vit sous **FORCE ROW LEVEL SECURITY**, et le rôle qui applique les
migrations (`atlas_owner`) n'a pas le droit de la traverser — c'est délibéré, et
la CI le vérifie. **Sans contexte d'entreprise, il ne voit AUCUNE ligne.**

Les trois `UPDATE` de conversion de la migration 0087 ne touchaient donc rien :
zéro ligne mise à jour, aucune erreur, en silence. La contrainte ajoutée juste
après, elle, est vérifiée par PostgreSQL sur **toutes** les lignes, RLS ou pas.
Elle trouvait les lignes non converties, et refusait :

```
échec : check constraint "diagnostics_refus_complet_ck"
        of relation "diagnostics" is violated by some row
```

Le script de migration annule alors le fichier entier et s'arrête : **0088, 0089
et 0090 n'ont jamais été tentées.** Le code servi lisait
`entreprises.conditions_generales` (0090) sur une base restée en 0086.

> **Ce défaut dépasse 0087.** Toute migration de ce dépôt qui écrit des DONNÉES
> sur une table sous FORCE RLS est inopérante de la même façon. 0087 est la
> seule à s'en être aperçue, parce qu'elle vérifie son propre travail par une
> contrainte ; les autres échouent sans le dire.

## Correction appliquée — cinq lignes de SQL

```sql
ALTER TABLE "diagnostics" NO FORCE ROW LEVEL SECURITY;   -- le propriétaire voit sa table

UPDATE "diagnostics" SET "panne" = 'Motif non enregistré.'
 WHERE "statut" = 'inconclusif' AND "refus" IS NULL AND "panne" IS NULL;

ALTER TABLE "diagnostics" FORCE ROW LEVEL SECURITY;      -- la garde est rendue
```

| | |
|---|---|
| la contrainte | **non touchée**, ni affaiblie, ni retirée |
| l'isolation entre entreprises | **intacte** : `atlas_app` reste soumis à la politique, seul le propriétaire voit sa table, et le temps d'une transaction |
| en cas d'échec en cours de route | la transaction est annulée, donc le `FORCE` revient de lui-même |
| la ligne sans phrase | reçoit ce qui est vrai. **Aucune clé de refus inventée** : on ne saurait pas laquelle choisir |

Le commentaire de la migration, qui affirmait de ces lignes « il n'en existe
pas », est corrigé noir sur blanc : c'était une supposition, jamais confrontée à
une vraie base.

## Test ajouté

`scripts/test-migration-0087-base-habitee.ts` — il joue le **vrai** fichier de
migration sur une table peuplée, **sous FORCE RLS**.

| | |
|---|---|
| **avant** la correction | ❌ `check constraint "diagnostics_refus_complet_ck" … is violated by some row` |
| **après** | ✅ huit contrôles verts |

Parmi eux : les lignes sont toutes là, la phrase connue retrouve sa clé, la ligne
sans phrase reste lisible sans clé inventée, **la garde RLS est remise**, et la
contrainte refuse toujours ce qu'elle doit refuser.

> **Sa première version ne portait pas la RLS.** Elle est passée au vert sur une
> correction qui ne réparait rien. Corrigée, elle est redevenue rouge — et c'est
> ce qui a fait trouver la vraie cause.

## Migrations 0087 à 0090, sur une base HABITÉE

```
faites : 4 migration(s) rattrapée(s)
```

| Vérification | Résultat |
|---|---|
| les quatre migrations enregistrées | ✅ 0087, 0088, 0089, 0090 |
| `entreprises.conditions_generales` | ✅ présente |
| `devis.conditions_generales` · `devis.main_doeuvre_ht` | ✅ présentes |
| table `acomptes_devis` (0088) | ✅ présente |
| `diagnostics.refus` et `.panne` | ✅ présentes |
| données avant / après | ✅ 1 entreprise, 1 utilisateur, 1 membre, 1 diagnostic — **même identifiant** |
| garde RLS | ✅ `rowsecurity=true force=true`, et le rôle propriétaire ne voit plus rien sans contexte |

## Les écrans

Même base, même parcours, connecté :

| | avant | après |
|---|---|---|
| Chantiers · Paysage · Tarifs · Clients · Catalogue | ✅ | ✅ |
| **Planning · Terminés · Réglages** | ❌ | ✅ |

Erreurs `conditions_generales` dans le journal du serveur pendant le parcours :
**3 avant, 0 après.**

## Fichiers modifiés

| | |
|---|---|
| `drizzle/0087_diagnostic_refus_par_cle.sql` | la correction |
| `scripts/test-migration-0087-base-habitee.ts` | le test de non-régression |
| `scripts/_raison-migration.mjs` · `scripts/test-raison-migration.ts` | la raison de l'échec, assainie |
| `scripts/diagnostiquer-espace.mjs` | la fiche la publie |
| `ARCHITECTURE.md` · `CHANGELOG.md` · `HANDOVER.md` · `PROJECT_STATE.md` | la mémoire du dépôt |

## Aucun changement hors périmètre

| | |
|---|---|
| fichiers de `src/` modifiés | **0** |
| veilleur qui migre toutes les 15 minutes | **0** — retiré de la branche par un revert explicite |
| écran Réglages (lecture d'une seule colonne) | **0** |
| refactorings, nettoyages | **aucun** |

Batterie : types, lint, mémoire, 370/370 en base, connexion derrière le proxy
verts. 15 rouges navigateur : les mêmes qu'avant ce travail, déjà relevés sur
`main` le soir même par une autre session.

## La raison de l'échec, publiée sans rien exposer

La fiche annonçait que la base était en retard, sans dire ce qu'elle refusait.
Elle le dit désormais :

```
Base             : EN RETARD DE 4 — 0087, 0088, 0089, 0090
La base refuse   : des lignes déjà en base refusent la contrainte
                   « diagnostics_refus_complet_ck » de la table « diagnostics »
```

**Rien du message d'origine ne sort.** Le module ne censure pas : il reconnaît
la FORME de l'échec et écrit sa propre phrase, où ne passent que des noms de
contraintes et de tables. Une forme inconnue ne publie rien du message. Éprouvé
contre des messages portant une adresse e-mail, un mot de passe, une clé d'IA et
le nom d'un client : aucun ne traverse.

---

## Ce qui reste, et qui attend une décision

**Le mécanisme sûr demandé** — *migration vérifiée → nouvelle version servie ;
échec → ancienne version conservée* — n'est pas codé. Proposition :

Aujourd'hui le démarrage fait : *code neuf → dépendances → migrations →
construction → bascule*, et la bascule ne regarde pas si les migrations ont
réussi. Il suffit de **conditionner la construction** :

| Migrations | Ce qui se passe |
|---|---|
| réussies | la version neuve se construit et prend le relais — comme aujourd'hui |
| **échouées** | **on ne construit pas**. La version bâtie précédente continue de servir, et elle correspond à l'ancienne base : rien ne tombe |

Un seul contrôle, au démarrage, sans processus périodique.

Deux compléments nécessaires :

- **l'espace le dit** : la fiche annonce « version neuve en attente : la base a
  refusé », avec la raison assainie déjà livrée ici ;
- **la limite à connaître** : si le serveur meurt et repart en mode lent, il sert
  le disque — donc le code neuf sur l'ancienne base. Il faudrait que le veilleur
  refuse ce cas, ou que l'écran l'annonce.
