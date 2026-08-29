# Lot Sauvegarde — audit et corrections avant implémentation

*29 août 2026. Revue hostile du lot livré le 27, à sa demande.*

---

## En une ligne

**Le rapport du 27 août contenait une erreur qui aurait rendu la sauvegarde
IMPOSSIBLE chez Scaleway, et l'outil livré aurait accepté une sauvegarde
amputée de 28 % sans rien dire.** Les deux sont corrigés et éprouvés.

---

# 1. Ce qui a été CONSERVÉ

L'architecture tient. Rien n'a été refait par préférence.

| | |
|---|---|
| Pas de système de sauvegarde dans Next.js | conservé — c'est juste |
| Restauration d'abord isolée, jamais par-dessus la production | conservé |
| Redis non sauvegardé | conservé — il ne porte que des compteurs |
| `AUTH_SECRET` = secret de restauration | conservé, et c'est le constat le plus précieux du lot |
| Les onze colonnes portant une clé de fichier | conservé |
| Le gel par `default_transaction_read_only` | conservé — vérifié à nouveau, il ne touche aucun droit |
| RPO d'une heure par copie logique horaire | conservé |
| Governance sur les fichiers / Compliance sur les sauvegardes | conservé |

---

# 2. LE DÉFAUT CAPITAL — la sauvegarde était impossible chez Scaleway

## Ce que le rapport du 27 disait

> « Une sauvegarde de la base d'Atlas ne peut être prise QUE par un rôle
> superutilisateur. »

C'était **exact comme mesure** et **faux comme conclusion** : un PostgreSQL
géré, chez Scaleway comme ailleurs, **ne donne aucun superutilisateur**.

Le rapport recommandait donc une architecture dans laquelle
**personne n'aurait jamais pu sauvegarder Atlas.** Aucun de mes outils ne
tournait sans superutilisateur ; tous auraient refusé de démarrer en production.

## La parade, mesurée

Trois éléments, dont aucun ne demande de privilège spécial :

1. un rôle dédié `atlas_sauvegarde`, **ni superutilisateur ni BYPASSRLS** ;
2. une politique de lecture posée **par le propriétaire des tables** :
   `CREATE POLICY sauvegarde_lit_tout ON <table> FOR SELECT TO atlas_sauvegarde USING (true)` ;
3. l'option `--enable-row-security` sur `pg_dump`.

Mesuré sur le banc, même base, même jour :

| | code | lignes copiées |
|---|---|---|
| superutilisateur (référence) | 0 | **189** |
| `atlas_sauvegarde` **sans** politique | 1 | 0 — refuse |
| `atlas_sauvegarde` **avec** politique + `--enable-row-security` | 0 | **189** |

**La sauvegarde d'Atlas est donc possible chez Scaleway.** Le script porte ce
chemin sous `ATLAS_SAUVEGARDE_RLS=1`.

---

# 3. LE SECOND DÉFAUT — l'outil aurait gardé une sauvegarde amputée

## Le piège

`--enable-row-security` rend `pg_dump` **obéissant** : il ne refuse plus, il
copie ce que le rôle a le droit de voir. Sans la politique de l'étape 2 :

| | |
|---|---|
| code de sortie | **0** |
| taille du fichier | **223 Ko** |
| lignes copiées | **136 sur 189** — **28 % de données manquantes** |

**Aucun de mes garde-fous ne l'attrapait** : ni le code de sortie, ni la taille,
ni « au moins une ligne de données ». La sauvegarde du banc, telle que livrée le
27, aurait gardé ce fichier et annoncé un succès.

## La correction, et le faux vert qu'elle a d'abord produit

Premier réflexe : comparer les comptes du fichier à ceux de la base.
**Ça ne marchait pas**, et l'essai négatif l'a montré tout de suite — le script
interrogeait la base **avec le même rôle borgne** qui avait fait la copie. 136
dans le fichier, 136 vus en base : « tout concorde ». *Un aveugle qui se compare
à lui-même conclut toujours qu'il voit tout.*

La bonne correction vérifie **la condition, pas la conséquence** : avant de
compter quoi que ce soit, le contrôle demande à PostgreSQL si ce rôle peut
réellement tout voir — soit qu'il traverse la RLS, soit que **chaque** table
sous RLS lui accorde une politique de lecture complète. Sinon il refuse, et il
**nomme les tables** en cause.

Éprouvé : politique retirée de deux tables sur quarante-deux → le contrôle
refuse et écrit « chantiers, clients ». Fichier effacé.

---

# 4. LE TROISIÈME DÉFAUT — un mot de passe de la CI codé en dur

`eprouver-restauration.ts` ouvrait ses connexions applicatives avec
`atlas_app:atlas_app_ci_pw`. Sur le banc, ça marche. Ailleurs, les trois
contrôles qui dépendent du rôle applicatif — isolation, droits, M9 — auraient
échoué sur une **connexion refusée**, en accusant la restauration d'un défaut
qui n'existe pas.

Corrigé : les identifiants viennent de `DATABASE_URL`, et le script **refuse de
conclure** si elle manque plutôt que de compter un contrôle non joué.

---

# 5. Le gel des écritures — revérifié, et il tient

Le brief demandait de contrôler qu'il ne peut pas affaiblir M9.

| Éprouvé | Résultat |
|---|---|
| écriture pendant le gel | refusée — `cannot execute INSERT in a read-only transaction` |
| lecture pendant le gel | **intacte** — 4 clients toujours lus |
| dégel | l'écriture revient |
| **M9 après un cycle gel/dégel** | **debout** — `permission denied for table users` |
| le rôle applicatif se dégèle lui-même | refusé |
| batterie complète après le cycle | **260/260** |

Le mécanisme ne touche aucun droit : il pose un réglage, il l'enlève. C'est ce
qui le distingue de la version du 27 au matin, qui cassait M9.

---

# 6. Ce que j'ai réellement exécuté

## Essais normaux

| | |
|---|---|
| Sauvegarde du banc, superutilisateur | 189 lignes, confrontées table par table |
| Sauvegarde du banc, **mode Scaleway** | 189 lignes — identique à la référence |
| Restauration dans une base isolée | **9 contrôles verts** |
| Cohérence base ↔ stockage | 25 clés vérifiées, aucun écart |
| Gel / dégel | écriture bloquée, lecture intacte, M9 debout |

## Essais négatifs — chacun a rougi

| Ce qu'on casse | Le contrôle rougit-il ? |
|---|---|
| sauvegarde sous un rôle sans droit de tout voir | **oui** — refuse, nomme les tables |
| politique retirée de 2 tables sur 42 | **oui** — « chantiers, clients » |
| `pg_dump --schema-only` (176 Ko, code 0, zéro donnée) | **oui** |
| sauvegarde tronquée aux 200 premières lignes | **oui** — 6 contrôles en échec |
| restauration avec un **autre `AUTH_SECRET`** | **oui** — « un secret d'artisan ne se déchiffre plus » |
| `FORCE ROW LEVEL SECURITY` retiré de la sauvegarde | **oui** |
| contrôle de cohérence sous un rôle restreint | **oui** — refuse de conclure |
| base éteinte | **oui**, et il accuse le serveur, pas les droits |
| **le contrôle des comptes lui-même, cassé par une faute de frappe** | **oui** — il refuse désormais de conclure sur zéro table lue |

Ce dernier mérite d'être dit : ma correction a d'abord rendu un vert sur une
mesure qui n'avait pas eu lieu. Le garde-fou qui l'attrape est né de là.

## Batterie

| | |
|---|---|
| types, lint, mémoire du dépôt | vert, 0 erreur |
| suites base | **260/260** |
| suites navigateur | en cours au moment d'écrire — chiffre donné en fin de rapport |

---

# 7. Les limites qui restent

| | |
|---|---|
| **Rétention et fréquence maximales chez Scaleway** | non documentées publiquement — à lire dans la console |
| **Le mode Scaleway n'a pas été joué CONTRE Scaleway** | il l'a été contre un PostgreSQL 16 avec les mêmes contraintes. Le premier essai réel reste à faire le jour du déploiement |
| **Une écriture refusée pendant un gel** reste un message de moteur | hors périmètre, consigné dans `TODO.md` |
| **L'export d'une entreprise** oublie logo et tickets de caisse | hors périmètre, consigné |
| **La copie horaire n'est pas planifiée** | c'est une tâche d'hébergeur, pas de code |

---

# 8. Ce qui change dans la liste Scaleway

Trois points **s'ajoutent**, et ils sont obligatoires :

| | Quoi | Pourquoi | Si on l'oublie |
|---|---|---|---|
| **SCW-06 bis** | créer `atlas_sauvegarde`, **sans** superutilisateur | Scaleway n'en donne pas | on croit pouvoir sauvegarder, et on ne peut pas |
| **SCW-06 ter** | poser la politique `sauvegarde_lit_tout` sur **chaque** table sous RLS | c'est elle qui rend la copie complète | sauvegarde amputée, code 0, sans un mot |
| **SCW-15 bis** | la copie horaire tourne avec `ATLAS_SAUVEGARDE_RLS=1` | sans quoi `pg_dump` refuse | aucune copie horaire |

Et **SCW-06 change de nature** : le rôle de sauvegarde n'est plus « un
superutilisateur dédié » — il n'existe pas chez un hébergeur géré — mais un rôle
ordinaire à qui les politiques donnent la vue complète.

---

# Verdict

## PRÊT À IMPLÉMENTER — et cette fois, réellement applicable chez Scaleway

La chaîne complète a été parcourue : **sauvegarde → restauration isolée →
contrôles Atlas → détection des cas dégradés**, avec neuf essais négatifs qui
rougissent tous.

**Ce que l'audit a rattrapé, et qu'il fallait rattraper :** le lot du 27 août
était éprouvé, vert, et **inapplicable là où il devait servir**. Il reposait sur
un superutilisateur qu'aucun hébergeur géré ne donne, et son garde-fou le plus
important laissait passer précisément la sauvegarde qu'il fallait refuser.

Les décisions ouvertes n'ont pas changé : **Local Storage ou Block Storage**, et
**où va la seconde copie**.
