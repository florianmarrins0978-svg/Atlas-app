# Atlas — Lot Sauvegarde et Restauration : clôture

*29 août 2026. Document autonome, à transmettre tel quel.*

---

## En cinq lignes

1. Atlas **n'est hébergé nulle part** aujourd'hui : aucune donnée d'artisan n'est
   perdue, et ce lot prépare le jour du déploiement.
2. L'hébergeur est tranché : **Scaleway**.
3. **Scaleway n'a pas de restauration au point dans le temps** pour PostgreSQL.
   Le RPO réel sera de **1 heure**, pas 15 minutes.
4. **Six outils** ont été écrits et éprouvés ; la chaîne complète *sauvegarde →
   restauration isolée → contrôles → détection des cas dégradés* a été parcourue.
5. Un audit du lot a trouvé **trois défauts, dont un qui rendait tout le
   dispositif inapplicable chez Scaleway**. Corrigés et mesurés.

**Verdict : PRÊT À IMPLÉMENTER.** Deux décisions restent au patron.

---

# 1. Ce qu'Atlas garde, et où

**64 tables** dans PostgreSQL, et **onze colonnes** qui portent la clé d'un
fichier rangé dans le stockage objet.

| | Où |
|---|---|
| utilisateurs, entreprises, clients, chantiers, devis, factures, planning, tarifs, paramètres, apprentissage de l'IA | **PostgreSQL** |
| photos, notes vocales, PDF de devis et de factures, logo, tickets de caisse, photos de diagnostic | **stockage objet** — la base ne garde que la clé |
| compteurs de limitation de débit | **Redis** — rien qui appartienne à un artisan |
| mot de passe iCloud, secret Google d'un artisan | PostgreSQL, **chiffrés** |

**Conséquence directe :** une seule chose est à sauvegarder pour de bon —
**PostgreSQL + le stockage objet**. Redis n'a rien à restaurer, et le dire
économise du temps et de l'argent.

## Le point que personne n'aurait deviné

Les secrets d'agenda sont chiffrés avec une clé **dérivée d'`AUTH_SECRET`**.

> **Une base restaurée sans le même `AUTH_SECRET` rend ces champs
> définitivement illisibles — et aucune erreur ne le signale au moment où l'on
> croit avoir réussi.**

`AUTH_SECRET` n'est donc pas seulement un secret d'application : **c'est un
secret de restauration**, à conserver séparément et à **versionner**.

---

# 2. Ce que Scaleway sait faire — vérifié dans la source officielle

La documentation de Scaleway n'est pas joignable depuis l'environnement de
travail, mais **son code source est public sur GitHub** et a été lu directement.

## PostgreSQL géré

| | |
|---|---|
| Sauvegardes automatiques | oui, actives par défaut |
| Fréquence par défaut | 1 par jour |
| Rétention par défaut | 7 jours, modifiable |
| Restauration vers une base **neuve** | oui |
| Export téléchargeable | oui |
| **Restauration au point dans le temps (PITR)** | **NON** — absente de la documentation ; une demande publique existe depuis avril 2024 |

**Un piège de configuration, non rattrapable après création :**

| Volume | Sauvegarde | Téléchargeable |
|---|---|---|
| **Local Storage** | *backups* | **oui** |
| Block Storage | *snapshots* | **non** |

Pouvoir télécharger une sauvegarde est le seul moyen d'en garder une copie hors
de Scaleway.

## Stockage objet

Versionnage, **Object Lock** (modèle WORM), chiffrement au repos, règles de
cycle de vie. Deux modes d'immutabilité :

- **Compliance** — personne ne peut supprimer avant l'échéance, **pas même le
  propriétaire du compte** ;
- **Governance** — protège de tout le monde **sauf** de qui détient la
  permission de contournement.

⚠ Une fois Object Lock activé sur un compartiment, **on ne peut plus le
désactiver**.

## Redis géré

Des instantanés existent, mais Scaleway prévient que *« le mécanisme de
persistance ne garantit pas la récupération des données en cas d'incident »*.
Sans importance ici : **Redis n'est pas à sauvegarder**.

---

# 3. LE DÉFAUT QUI A FAILLI TOUT COÛTER

## Ce que la première version du lot affirmait

> « Une sauvegarde d'Atlas ne peut être prise QUE par un rôle superutilisateur. »

**Exact comme mesure. Faux comme conclusion** : un PostgreSQL géré — Scaleway
comme tout autre — **ne donne aucun superutilisateur**.

Le lot recommandait donc une architecture dans laquelle **personne n'aurait
jamais pu sauvegarder Atlas.** Tous les outils auraient refusé de démarrer en
production.

## Pourquoi c'est particulier à Atlas

**34 tables portent `FORCE ROW LEVEL SECURITY`** — la règle d'isolation entre
entreprises s'applique **même au propriétaire des tables**. C'est exactement ce
qui rend Atlas sûr, et c'est ce qui rend sa sauvegarde difficile.

Mesuré, sans contexte d'entreprise posé :

| Rôle | Lignes vues dans `clients` | `pg_dump` |
|---|---|---|
| `atlas_app` | **0** | échoue |
| `atlas_owner` (propriétaire) | **0** | échoue |
| superutilisateur | 4 | réussit |

## La parade — aucun privilège spécial requis

1. un rôle dédié `atlas_sauvegarde`, **ni superutilisateur ni BYPASSRLS** ;
2. une politique de lecture posée **par le propriétaire des tables** :
   `CREATE POLICY sauvegarde_lit_tout ON <table> FOR SELECT TO atlas_sauvegarde USING (true)` ;
3. l'option `--enable-row-security` sur `pg_dump`.

| | code | lignes copiées |
|---|---|---|
| superutilisateur (référence) | 0 | **189** |
| `atlas_sauvegarde` **sans** politique | 1 | refuse |
| `atlas_sauvegarde` **avec** politique | 0 | **189** |

**La sauvegarde d'Atlas est donc possible chez Scaleway.**

---

# 4. LE SECOND DÉFAUT — la sauvegarde qui ment

## Le piège

`--enable-row-security` rend `pg_dump` **obéissant** : il ne refuse plus, il
copie ce que le rôle a le droit de voir. Sans la politique :

| | |
|---|---|
| code de sortie | **0** |
| taille | **223 Ko** |
| lignes | **136 sur 189** — **28 % manquantes** |

Ni le code de sortie, ni la taille, ni « au moins une ligne de données » ne
l'attrapent. **L'outil livré aurait gardé ce fichier et annoncé un succès.**

## La correction — et le faux vert qu'elle a d'abord produit

Premier réflexe : comparer les comptes du fichier à ceux de la base. **Ça ne
marchait pas** — le script interrogeait la base **avec le même rôle borgne** qui
avait fait la copie. 136 dans le fichier, 136 vus en base : « tout concorde ».

> *Un aveugle qui se compare à lui-même conclut toujours qu'il voit tout.*

La bonne correction vérifie **la condition, pas la conséquence** : avant de
compter quoi que ce soit, le contrôle demande à PostgreSQL si ce rôle peut
réellement tout voir. Sinon il refuse, et il **nomme les tables** en cause.

---

# 5. Les six outils

Aucun ne double ce que Scaleway sait faire.

| Outil | Ce qu'il fait |
|---|---|
| `src/lib/objets-stockes.ts` | déclare les **11 colonnes** portant une clé de fichier |
| `scripts/test-objets-stockes.ts` | relit le schéma et **refuse toute colonne oubliée** |
| `scripts/verifier-coherence-fichiers.ts` | compare base ↔ stockage, dans les deux sens |
| `scripts/eprouver-restauration.ts` | restaure dans une base **isolée** et vérifie **9 propriétés** |
| `scripts/_compter-lignes-sauvegarde.sh` | confronte la sauvegarde à la base, table par table |
| `scripts/geler-les-ecritures.sh` | passe l'application en lecture seule |
| `scripts/sauvegarder-banc.sh` | **durci** — comptes, migrations, chemin sans superutilisateur |

## Ce que la restauration d'essai contrôle

1. la base **n'est pas vide** — refus de conclure sur zéro ;
2. les **volumes** correspondent, table par table ;
3. **toutes les migrations** sont là ;
4. la **RLS est active ET forcée** sur au moins 30 tables ;
5. **deux entreprises ne se voient pas** — éprouvé en fabriquant une voisine
   dans la base d'essai ;
6. `atlas_app` existe et **ne traverse pas** la RLS ;
7. **M9 tient** : l'application ne peut pas lire le condensat du mot de passe ;
8. les fonctions `SECURITY DEFINER` sont là, **avec le bon propriétaire** ;
9. les secrets chiffrés **se déchiffrent encore**.

Il **refuse de travailler** sur une base dont le nom ne dit pas qu'elle est un
essai : la production ne se restaure jamais par-dessus elle-même.

---

# 6. Le gel des écritures

C'est le **premier geste** d'une restauration d'urgence : sans lui, tout ce qui
s'écrit pendant la restauration est perdu, et personne ne sait quoi.

**Il ne touche AUCUN droit** — il pose un réglage (`default_transaction_read_only`)
sur le rôle de l'application, et l'enlève.

> **La première version faisait autrement, et elle CASSAIT M9.** Elle retirait
> les droits d'écriture puis les rendait par un `GRANT … ON ALL TABLES` — or un
> droit de **table** écrase la restriction de **colonne** que M9 pose sur
> `password_hash`. Le dégel rendait plus que ce que le gel avait retiré. La
> batterie l'a attrapé : *« le rôle applicatif peut encore ÉCRIRE un condensat »*.
>
> **Un outil de secours qui affaiblit la sécurité en revenant à la normale est
> pire que pas d'outil du tout.**

Éprouvé : écriture refusée, lecture intacte, dégel propre, **M9 debout après le
cycle**, et le rôle applicatif ne peut pas se dégeler lui-même.

---

# 7. La restauration d'urgence

| Situation | Ce qu'on fait |
|---|---|
| **PostgreSQL perdu** | restaurer vers une **nouvelle** instance, éprouver, basculer |
| **Migration destructive** | restaurer au point d'avant ; les fichiers ne bougent pas |
| **Suppression accidentelle** | restaurer à côté, extraire, réinjecter |
| **Fichiers disparus** | récupérer la version précédente par le versionnage |
| **Serveur applicatif perdu** | **aucune donnée perdue** : redéployer |
| **Administrateur compromis** | les sauvegardes en mode Compliance **ne peuvent pas** être effacées |

**La marche à suivre, et l'ordre compte :**

1. constater ;
2. **geler les écritures** ;
3. choisir le point de restauration ;
4. **restaurer à côté**, jamais par-dessus ;
5. **éprouver** — neuf contrôles ; s'ils ne passent pas, **on ne bascule pas** ;
6. vérifier la cohérence base ↔ fichiers ;
7. basculer en **gardant l'ancienne base** ;
8. dégeler.

---

# 8. RPO et RTO

| | Proposition | Pourquoi |
|---|---|---|
| **RPO** | **1 heure** | Scaleway n'a pas de PITR. Sans la copie horaire, ce serait 24 h. Perdre une heure de saisie se rattrape ; perdre une journée, non |
| **RTO** | **4 heures** | Atlas n'est pas un service d'urgence. Viser une heure coûterait cher pour un gain que l'artisan ne ressentirait pas |

**Je ne prétends pas atteindre 15 minutes.** C'était la recommandation initiale,
et elle supposait un PITR que Scaleway n'offre pas.

---

# 9. Sauvegarde, immutabilité, RGPD, conservation légale

Quatre choses différentes — et c'est ce qui justifie **Governance d'un côté,
Compliance de l'autre** :

| | Durée | Peut-on effacer avant ? |
|---|---|---|
| **Sauvegarde** | 30 jours | oui, à l'échéance |
| **Immutabilité** | 30 jours | sauvegardes : **non** (Compliance) · fichiers : **oui, avec la permission** (Governance) |
| **Effacement RGPD** | à la demande | **oui** — d'où Governance sur les fichiers |
| **Conservation légale** | factures **10 ans**, devis acceptés **5 ans** | **non**, et le code le refuse déjà |

**Le point à ne pas confondre :** ce sont **les 10 ans de la base vivante** qui
portent l'obligation légale, pas les 30 jours de sauvegarde. La sauvegarde
protège la base ; elle ne la remplace pas.

---

# 10. Tout ce qui a été exécuté

## Essais normaux

| | |
|---|---|
| Sauvegarde du banc, superutilisateur | 189 lignes, confrontées table par table |
| Sauvegarde du banc, **mode sans superutilisateur** | 189 lignes — identique |
| Restauration dans une base isolée | **9 contrôles verts** |
| Cohérence base ↔ stockage | 25 clés, aucun écart |
| Gel / dégel | écriture bloquée, lecture intacte, M9 debout |

## Essais négatifs — chacun a rougi

| Ce qu'on casse | Rougit ? |
|---|---|
| rôle sans droit de tout voir | **oui** — refuse et nomme les tables |
| politique retirée de 2 tables sur 42 | **oui** — « chantiers, clients » |
| `pg_dump --schema-only` (176 Ko, code 0, zéro donnée) | **oui** |
| sauvegarde tronquée | **oui** — 6 contrôles en échec |
| **autre `AUTH_SECRET`** | **oui** — « un secret d'artisan ne se déchiffre plus » |
| `FORCE ROW LEVEL SECURITY` retiré | **oui** |
| cohérence sous un rôle restreint | **oui** — refuse de conclure |
| base éteinte | **oui**, et accuse le serveur, pas les droits |
| **le contrôle des comptes cassé par une faute de frappe** | **oui** — il refuse de conclure sur zéro table lue |

## Batterie

| | |
|---|---|
| types, lint, mémoire du dépôt | vert, **0 erreur** |
| suites base | **260/260** |
| suites navigateur | **115/115**, aucune non jouée |
| connexion derrière un proxy | **vert** |

---

# 11. La liste Scaleway, à dérouler le jour de l'infrastructure

| | Quoi | Valeur | Si on l'oublie | Avant le 1er client ? |
|---|---|---|---|---|
| **SCW-01** | instance PostgreSQL gérée | PG 16+, **Local Storage** | — | **OUI** |
| **SCW-02** | autobackup actif | par défaut | **tout perdu au 1er incident** | **OUI** |
| **SCW-03** | rétention à **30 jours** | 30 (défaut 7) | un dégât vu au retour de vacances est irrécupérable | **OUI** |
| **SCW-04** | fréquence au maximum offert | à lire en console | RPO à 24 h | recommandé |
| **SCW-05** | rôles `atlas_owner` et `atlas_app` | `atlas_app` **NOBYPASSRLS** | **un artisan verrait les clients d'un autre** | **OUI** |
| **SCW-06** | rôle `atlas_sauvegarde`, **sans** superutilisateur | identifiants séparés | on croit pouvoir sauvegarder, et on ne peut pas | **OUI** |
| **SCW-07** | politique `sauvegarde_lit_tout` sur **chaque** table sous RLS | — | sauvegarde amputée, code 0, sans un mot | **OUI** |
| **SCW-08** | compartiment des **fichiers** | `atlas-fichiers` | — | **OUI** |
| **SCW-09** | versionnage dessus | activé | une photo remplacée est perdue | **OUI** |
| **SCW-10** | Object Lock **Governance**, 30 j | Governance | soit rien n'est protégé, soit on ne peut plus effacer légalement | **OUI** |
| **SCW-11** | cycle de vie : purger > 30 j | 30 j | facture qui enfle | recommandé |
| **SCW-12** | compartiment des **sauvegardes**, autre projet | `atlas-sauvegardes` | un administrateur compromis efface tout | **OUI** |
| **SCW-13** | Object Lock **Compliance**, 30 j | Compliance | la sauvegarde reste effaçable | **OUI** |
| **SCW-14** | clé d'accès **écriture seule** | sans suppression | une clé volée efface l'historique | **OUI** |
| **SCW-15** | clé d'accès **lecture seule** pour restaurer | séparée | — | recommandé |
| **SCW-16** | **copie logique horaire**, avec `ATLAS_SAUVEGARDE_RLS=1` | toutes les heures | RPO à 24 h au lieu de 1 h | **OUI** |
| **SCW-17** | `AUTH_SECRET` dans Secret Manager | avec sa date | agendas illisibles **en silence** | **OUI** |
| **SCW-18** | règle de rotation : ne jamais supprimer une version < 30 j | — | une vieille sauvegarde devient inutilisable | **OUI** |
| **SCW-19** | instance Redis gérée | la plus petite | Atlas refuse de démarrer | **OUI** |
| **SCW-20** | **ne PAS** sauvegarder Redis | — | argent et temps dépensés pour rien | — |
| **SCW-21** | alerte d'échec de sauvegarde | adresse réellement lue | on le découvre le jour de l'incident | **OUI** |
| **SCW-22** | restauration d'essai complète | avant le 1er client, puis tous les 3 mois | on découvre le défaut au pire moment | **OUI** |
| **SCW-23** | poser `ATLAS_RP_ID` et `ATLAS_PROXY_SAUTS` | dette existante | Face ID refuse de s'enregistrer | **OUI** |

**Dix-huit points sont obligatoires avant le premier client.** Aucun ne demande
de code : ce sont des cases à cocher.

---

# 12. Ce qui reste ouvert

| Point | Qui tranche |
|---|---|
| Rétention et fréquence **maximales** chez Scaleway | à lire en console — non documentées publiquement |
| Le mode sans superutilisateur n'a pas été joué **contre Scaleway** | éprouvé contre un PG 16 aux mêmes contraintes ; premier essai réel au déploiement |
| Une écriture refusée pendant un gel reste un **message de moteur** | nous, hors de ce lot |
| L'export d'une entreprise oublie **logo et tickets de caisse** | nous, hors de ce lot — c'est de la portabilité RGPD |
| Un refus de rôle sort en **500** au lieu de **403** sur `/api/mes-donnees` | nous, lot suivant |
| `npm audit` : 4 alertes modérées | aucune action — dépendance de développement |

---

# 13. Les décisions du patron

### Décision 1 — **Local Storage ou Block Storage ?** ⚠ avant de créer l'instance

Elle décide si une sauvegarde est **téléchargeable**, donc si on peut en garder
une copie hors de Scaleway.
**Recommandation : Local Storage.**

Si Block Storage est préféré pour la souplesse, la copie logique horaire
(SCW-16) devient **obligatoire** au lieu de recommandée.

### Décision 2 — **Où va la seconde copie ?**

| | |
|---|---|
| autre projet Scaleway | simple ; protège de l'erreur humaine et de l'administrateur compromis |
| autre fournisseur | protège en plus de la perte du compte Scaleway |

**Recommandation : autre projet Scaleway pour commencer.**

---

# Verdict

## PRÊT À IMPLÉMENTER

La chaîne complète a été parcourue — **sauvegarde → restauration isolée →
contrôles Atlas → détection des cas dégradés** — avec neuf essais négatifs qui
rougissent tous, et une batterie entièrement verte.

**Ce que l'audit a rattrapé :** le lot était éprouvé, vert, et **inapplicable là
où il devait servir**. Il reposait sur un superutilisateur qu'aucun hébergeur
géré ne donne, et son garde-fou le plus important laissait passer précisément la
sauvegarde qu'il fallait refuser.

**Le point d'urgence, indépendant de tout le reste :** aucun artisan réel sur
Atlas tant que les dix-huit points obligatoires du §11 ne sont pas cochés.
