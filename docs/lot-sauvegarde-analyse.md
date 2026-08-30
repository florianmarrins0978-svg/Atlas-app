# Atlas — sauvegarde et restauration : l'analyse avant tout code

*27 août 2026. Aucun code écrit, aucun fichier du produit modifié.*

---

## Ce qu'il faut savoir avant de lire

Trois choses, et elles commandent tout le reste.

**1. Atlas n'est hébergé nulle part.** L'application ne tourne aujourd'hui que
sur le banc d'essai — un espace de travail GitHub qui s'éteint tout seul. Il n'y
a ni serveur de production, ni base de production, ni fichiers de production.
**Il n'y a donc rien à sauvegarder aujourd'hui, et rien de perdu.** Ce lot
prépare le jour du déploiement ; il ne répare pas une situation en cours.

**2. La seule chose qui existe et qui pourrait se perdre, c'est le banc.** La
base du banc vit DANS le conteneur. Si l'espace est supprimé, tout ce qui y a été
saisi disparaît. Un script existe déjà pour l'en sortir
(`scripts/sauvegarder-banc.sh`), né le jour où j'ai conseillé au patron de
supprimer son espace et où il a répondu, avec raison : *« ça va effacer tout ce
qu'il y a en mémoire »*.

**3. Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde.** C'est
le point du brief avec lequel je suis le plus d'accord, et c'est celui qui coûte
le plus cher à ignorer. Tout ce qui suit est organisé autour de ça.

---

# 1. Ce qu'Atlas possède aujourd'hui

## 1.1 Les données, et où elles vivent — prouvé, pas supposé

**64 tables** dans PostgreSQL. Voici les catégories que le brief demande, avec le
lieu réel de chacune.

| Catégorie | Où c'est | Preuve |
|---|---|---|
| **Utilisateurs** | PostgreSQL — `users` | `schema.ts:33` |
| **Entreprises** | PostgreSQL — `entreprises`, `membres_entreprise`, `entreprise_compteurs` | `schema.ts:88, 481, 459` |
| **Clients** | PostgreSQL — `clients` | `schema.ts:520` |
| **Chantiers** | PostgreSQL — `chantiers`, `prestations`, `materiel`, `precisions_chantier` | `schema.ts:558, 656, 677, 1191` |
| **Devis** | PostgreSQL — `devis`, `lignes_devis`, `envois_devis` · **le PDF, lui, est un fichier** | `schema.ts:857, 963, 1298` |
| **Factures** | PostgreSQL — `factures`, `lignes_facture`, `paiements_facture`, `envois_factures` · **le PDF est un fichier** | `schema.ts:1408, 1533, 1513, 1564` |
| **Planning** | PostgreSQL — `equipes`, `equipes_du_chantier`, `absences_equipe` | `schema.ts:363, 398, 438` |
| **Tarifs** | PostgreSQL — `tarifs`, `lignes_prix`, `grille_prix`, `tranches_grille`, `natures_grille`, `historique_prix` | `schema.ts:775, 792, 1664, 1712, 1747, 1063` |
| **Paramètres** | PostgreSQL — `parametres_chiffrage`, colonnes d'`entreprises` | `schema.ts:1085, 88` |
| **Données IA / apprentissage** | PostgreSQL — `lecons_prix`, `corrections_dictee`, `termes_metier`, `mots_catalogue`, `documents`, `fragments_documents`, `propositions_ia` | `schema.ts:826, 1629, 1602, 1034, 1105, 1123, 1218` |
| **Photos** | **stockage objet (S3)** — la ligne en base porte seulement la clé | `photos.storage_key`, `schema.ts:744` |
| **Notes vocales** | **stockage objet (S3)** pour l'audio · la transcription est en base | `notes_vocales.storage_key`, `schema.ts:710` |
| **PDF de devis et factures** | **stockage objet (S3)** | `devis.pdf_storage_key`, `factures.pdf_storage_key` |
| **Logo de l'entreprise** | **stockage objet (S3)** | `entreprises.logo_storage_key` |
| **Tickets de caisse (TVA)** | **stockage objet (S3)** | `achats_tva.photo_cle` |
| **Photos de diagnostic végétal** | **stockage objet (S3)** | `photos_diagnostic.storage_key` |
| **Fiches phytosanitaires** | PostgreSQL + images en **stockage objet** | `fiches_phyto`, `images_phyto.storage_key` |
| **Secrets et identifiants** | PostgreSQL, **chiffrés** — voir §1.3 | `agendas_externes`, `accounts` |
| **Files de purge** | PostgreSQL — `fichiers_a_purger`, `audios_a_purger`, `photos_diagnostic_a_purger` | `schema.ts:767, 1380, 2341` |
| **Limitation de débit, compteurs** | **Redis** | `src/server/rate-limit/redis.ts` |
| **Preuves d'authentification récente** | PostgreSQL — `preuves_authentification` | `schema.ts:2425` |
| **Clés Face ID** | PostgreSQL — `cles_appareil` (clé **publique** seulement) | `schema.ts:2387` |

**Ce qui n'est nulle part ailleurs :** aucun service externe ne détient de donnée
métier d'Atlas. Les fournisseurs d'IA reçoivent des dictées et des photos pour les
traiter, mais ne sont pas une source de vérité.

## 1.2 Redis : ce qu'il porte, et pourquoi il n'a PAS besoin d'être sauvegardé

Redis ne contient que des compteurs de limitation de débit — « cette adresse a
tenté trois connexions dans le quart d'heure ». **Rien qui appartienne à un
artisan.** Perdre Redis remet des compteurs à zéro ; il n'y a rien à restaurer.

C'est une bonne nouvelle, et elle mérite d'être dite : **une seule chose est à
sauvegarder pour de bon, c'est PostgreSQL + le stockage objet.**

## 1.3 Les secrets — le point que le brief ne pouvait pas connaître

Deux secrets d'artisan vivent en base, **chiffrés au repos** :

- le mot de passe d'application iCloud (`agendas_externes.mot_de_passe`) — il
  ouvre **tout l'iCloud** de l'artisan, mail et fichiers compris, parce qu'Apple
  ne sait pas le restreindre ;
- le secret d'application Google (`agendas_externes.client_secret`).

**Et voici ce qui change tout pour la restauration :** la clé de chiffrement est
**dérivée d'`AUTH_SECRET`** (`src/server/agenda/secret-au-repos.ts`).

> **Conséquence : une sauvegarde de la base restaurée sans le MÊME `AUTH_SECRET`
> rend ces champs définitivement illisibles.** La base serait là, complète,
> et ces raccordements d'agenda seraient morts sans qu'aucune erreur ne le dise
> au moment de la restauration.

`AUTH_SECRET` n'est donc pas seulement un secret d'application : **c'est un
secret de restauration**, au même titre que la sauvegarde elle-même. Il devra
être sauvegardé, séparément, et versionné — si on le change un jour, les anciennes
sauvegardes ne se déchiffrent plus.

C'est le premier point que j'ajoute au brief.

## 1.4 Ce qui existe déjà et qui sert

| Ce qui existe | Ce que ça vaut pour ce lot |
|---|---|
| `scripts/sauvegarder-banc.sh` | sort la base du banc dans un fichier téléchargeable. **Il sait déjà qu'il faut le rôle superutilisateur** — voir §3.1 |
| `/api/mes-donnees` | **un export complet par entreprise, base ET fichiers, en ZIP.** Gardé par la preuve d'identité récente (M11). C'est déjà une brique de restauration sélective |
| Files de purge avec délai de grâce | un fichier remplacé n'est pas effacé tout de suite : 24 h de sursis (`fichiers_a_purger`) |
| Migrations transactionnelles | `run-migrations.ts` enveloppe chaque fichier dans `BEGIN`/`COMMIT`/`ROLLBACK` : une migration qui **plante** ne laisse pas la base à moitié modifiée |
| Garde-fou du seed | le jeu de démonstration refuse de s'exécuter là où effacer aurait des conséquences |

---

# 2. Ce qui n'est actuellement pas sauvegardé

**Tout.** Il n'existe aucune sauvegarde automatique, d'aucune sorte, nulle part.

Mais la formulation exacte compte, pour ne pas alarmer à tort :

| | |
|---|---|
| Données d'artisans réels perdues aujourd'hui | **aucune** — Atlas n'est pas déployé |
| Données du banc d'essai | **à la merci de la suppression de l'espace**, sauf à lancer le script à la main |
| Le jour du déploiement | **rien n'est prêt** : c'est ce lot qui doit le rendre prêt AVANT le premier vrai client |

**La ligne à ne pas franchir : ne pas mettre un artisan en production tant que ce
lot n'est pas fait.** Un artisan qui saisit trois mois de chantiers dans une
application sans sauvegarde, c'est trois mois qu'on lui fera perdre.

---

# 3. Les risques actuels — scénario par scénario

Le brief en demande sept. Voici ce que chacun donnerait **aujourd'hui**, puis ce
qu'il donnerait **avec la cible du §4**.

| Scénario | Aujourd'hui | Avec la cible |
|---|---|---|
| **1. Perte complète de PostgreSQL** | **tout perdu** : clients, chantiers, devis, factures, tarifs, apprentissage de l'IA. Les fichiers survivraient, mais **orphelins** — des photos sans chantier, des PDF sans facture | restauration au point dans le temps, perte ≤ 15 min |
| **2. Suppression accidentelle de données** | irréversible pour ce qui n'est pas en file de purge | restauration à l'instant d'avant la fausse manœuvre, dans une base isolée, puis réinjection ciblée |
| **3. Migration SQL destructive** | une migration qui **plante** est annulée (transaction). Une migration qui **réussit** et qui était fausse — un `DROP COLUMN` de trop — est **définitive** | restauration au point juste avant la migration |
| **4. Perte du stockage de fichiers** | **photos, audios, PDF perdus.** Les devis et factures se **régénèrent** depuis la base ; les photos et les audios, **non** | versionnage du compartiment + seconde copie |
| **5. Perte du serveur applicatif** | **aucune donnée perdue** — le serveur ne stocke rien. Il faut le redéployer, c'est tout | idem, redéploiement automatique |
| **6. Compromission d'un compte administrateur** | l'attaquant a la base ET les fichiers. **Et il pourrait supprimer les sauvegardes** s'il les atteint avec les mêmes identifiants | voir §6 : les sauvegardes doivent être hors de sa portée |
| **7. La sauvegarde elle-même supprimée ou corrompue** | sans objet — il n'y en a pas | c'est le scénario que la seconde copie et l'immutabilité couvrent |

### Ce qui se régénère et ce qui ne se régénère pas

C'est une distinction utile et peu coûteuse :

| | |
|---|---|
| **Se régénère depuis la base** | PDF de devis, PDF de factures — ils sont fabriqués à partir des lignes stockées |
| **Ne se régénère JAMAIS** | photos de chantier, notes vocales non transcrites, tickets de caisse, logo, photos de diagnostic |

Autrement dit : le stockage objet contient une part **irremplaçable** (les
photos) et une part **reconstructible** (les PDF). Si un jour il faut arbitrer un
coût, c'est là que ça se joue.

---

# 4. L'architecture de sauvegarde recommandée

## 4.0 La règle qui commande tout — et une preuve

> **Une sauvegarde de la base d'Atlas ne peut être prise QUE par un rôle
> superutilisateur. Prise autrement, elle est vide.**

Ce n'est pas une opinion. Mesuré sur la base de cette session, sans contexte
d'entreprise posé :

| Rôle | Ce qu'il voit dans `clients` | Ce que fait `pg_dump` |
|---|---|---|
| `atlas_app` | **0 ligne** | **échoue**, code 1 |
| `atlas_owner` (propriétaire des tables) | **0 ligne** | **échoue**, code 1 |
| `postgres` (superutilisateur) | 4 lignes | réussit, code 0 |

La raison : **34 tables portent `FORCE ROW LEVEL SECURITY`** — la règle
d'isolation entre entreprises s'applique *même au propriétaire des tables*.
C'est exactement ce qui rend Atlas sûr, et c'est ce qui rend sa sauvegarde
particulière.

**Correction d'une hypothèse que j'avais posée en commençant :** je m'attendais à
ce qu'une sauvegarde prise sous le mauvais rôle produise **silencieusement** un
fichier vide. La mesure dit mieux que ça — PostgreSQL **refuse** :

```
pg_dump: error: query failed: ERROR: query would be affected by
row-level security policy for table "clients"
```

C'est une bonne nouvelle, et je préfère l'écrire que de garder mon hypothèse
alarmiste. **Mais le danger n'a pas disparu**, il a changé de forme : le fichier
déjà commencé (867 octets) reste sur le disque, avec un en-tête parfaitement
crédible. Une chaîne de sauvegarde qui **ne regarde pas le code de sortie**
garderait ce fichier et croirait avoir sauvegardé.

> **Exigence non négociable : la chaîne de sauvegarde doit vérifier le code de
> sortie ET compter les lignes. « Le fichier existe » n'est pas une preuve.**
> C'est la règle du dépôt appliquée aux sauvegardes : un contrôle qui mesure zéro
> ne mesure rien.

## 4.1 Répartition A / B / C / D, comme le brief la demande

Je suis d'accord avec son principe : **utiliser les mécanismes de l'hébergeur
plutôt que réinventer une sauvegarde dans Next.js.** Ce qui suit le respecte.

### D — Ce que l'HÉBERGEUR doit gérer *(le plus gros, et c'est voulu)*

| | |
|---|---|
| Sauvegardes PostgreSQL automatiques, quotidiennes, **chiffrées** | oui |
| **PITR** — restauration à la minute près | oui, **si l'hébergeur le propose** (voir §10, décision 1) |
| Rétention **30 jours** | oui |
| Sauvegardes stockées **ailleurs** que le serveur de base | oui |
| Alerte si une sauvegarde échoue | oui |

### C — Ce que le STOCKAGE OBJET doit gérer

| | |
|---|---|
| **Versionnage activé** | oui — c'est ce qui rend un fichier supprimé récupérable |
| **Chiffrement au repos** | oui |
| **Verrou d'objet / immutabilité** sur 30 jours | **oui, et c'est le point qui protège du scénario 6** |
| Règle de cycle de vie qui purge les vieilles versions | oui, à 30 jours |
| **Réplication vers un second compartiment**, autre compte | recommandé — voir §10, décision 3 |

### B — Ce que POSTGRESQL doit gérer

| | |
|---|---|
| `FORCE ROW LEVEL SECURITY` | **déjà en place**, 34 tables |
| Un rôle dédié à la sauvegarde | à créer le jour du déploiement — voir §6 |
| Les fonctions `SECURITY DEFINER` de M9 | **déjà en place** — et elles doivent être restaurées avec leur propriétaire, voir §5.2 |

### A — Ce qu'ATLAS doit gérer dans son CODE

Volontairement **peu**, et rien qui ressemble à un système de sauvegarde maison :

| | Pourquoi |
|---|---|
| **Un contrôle de cohérence base ↔ fichiers** | personne d'autre ne peut le faire : il faut connaître les 11 colonnes qui portent une clé d'objet. Il liste les clés référencées en base qui n'existent pas dans le stockage, et l'inverse |
| **Une commande de restauration d'essai** | monte une base isolée depuis une sauvegarde, y rejoue les contrôles d'isolation, et **refuse de conclure si elle compte zéro ligne** |
| **`/api/mes-donnees` existe déjà** | export complet par entreprise, base et fichiers. À garder, et à documenter comme filet de dernier recours |
| **Rien d'autre** | pas de tâche Next.js qui écrit des sauvegardes, pas de planificateur maison. C'est le travail de l'hébergeur, et il le fait mieux |

## 4.2 Ce que je ne retiens pas du brief, et pourquoi

**« Rétention d'au moins 30 jours ».** D'accord pour les sauvegardes — mais il
faut dire ce que ça ne couvre pas, sinon on croit être en règle et on ne l'est
pas.

> Le code d'Atlas conserve déjà les **factures 10 ans** (Code de commerce
> L123-22) et les **devis acceptés 5 ans** — c'est écrit dans
> `src/server/retention.ts`, et l'effacement d'un client refuse de les toucher.

**Une sauvegarde de 30 jours ne remplit pas une obligation de 10 ans, et n'a pas
à le faire.** Ce sont deux choses différentes :

| | |
|---|---|
| **La conservation légale** (10 ans) | assurée par **la base vivante**, qui refuse d'effacer ces pièces |
| **La sauvegarde** (30 jours) | assure qu'on puisse **récupérer cette base** si elle est perdue |

Conclusion : 30 jours est le bon chiffre, **à condition d'avoir compris que
c'est la base vivante qui porte les dix ans**. Si un jour la base était perdue
au-delà de la fenêtre de 30 jours, l'obligation légale serait rompue — d'où
l'importance de la seconde copie du §4.1.

Je **n'ajoute pas** d'archive à 10 ans : ce serait disproportionné pour Atlas
aujourd'hui, et le brief demande explicitement de ne pas sur-dimensionner.

---

# 5. L'architecture de restauration

C'est la partie que le brief appelle la plus importante, et il a raison.

## 5.1 Le principe

> **Une restauration d'essai ne touche JAMAIS la production. Jamais.**

Toute restauration se fait vers une **base neuve, isolée, avec son propre nom et
ses propres identifiants**. La production n'est même pas jointe pendant l'essai.

## 5.2 Le piège propre à Atlas — celui qui ferait échouer une restauration

Une sauvegarde de la base **ne contient pas les rôles**. Les rôles `atlas_app` et
`atlas_owner` vivent au niveau du serveur, pas de la base. Une restauration dans
un serveur neuf où ces rôles n'existent pas :

- fait échouer tous les `GRANT` ;
- laisse les fonctions `SECURITY DEFINER` de **M9** sans le bon propriétaire ;
- **et si on « répare » en donnant tout au superutilisateur, M9 tombe** : le
  condensat du mot de passe redevient lisible par l'application.

> **Autrement dit : une restauration bâclée AFFAIBLIT LA SÉCURITÉ, en silence.**
> C'est ce que la restauration d'essai doit attraper, et c'est pour ça qu'elle
> doit rejouer les contrôles d'isolation, pas seulement compter des lignes.

La procédure doit donc, dans cet ordre : **créer les rôles → restaurer →
vérifier les droits → vérifier l'isolation**.

## 5.3 Les cinq essais que le brief demande

| Essai | Comment on le prouve |
|---|---|
| **Restauration complète vers une base isolée** | la base restaurée répond, et compte le même nombre de lignes que la sauvegarde annonçait |
| **Restauration à une date antérieure** | on choisit un instant, on restaure, on vérifie qu'une donnée créée APRÈS cet instant est bien absente |
| **Récupération d'un fichier supprimé** | on supprime un objet d'essai, on le récupère par le versionnage, on compare son empreinte |
| **Cohérence base ↔ fichiers** | on parcourt les 11 colonnes qui portent une clé, et on vérifie que chaque clé existe dans le stockage. **Zéro écart, ou on ne conclut pas** |
| **Connexion à la base restaurée sans toucher la production** | la base d'essai a ses propres identifiants ; la chaîne d'essai n'a même pas ceux de la production |

**Et un sixième, propre à Atlas, que j'ajoute :**

> **L'isolation entre entreprises tient-elle encore sur la base restaurée ?**
> On crée deux entreprises d'essai, et on vérifie que l'une ne voit rien de
> l'autre. Sans ce contrôle, une restauration qui a perdu les politiques RLS
> passerait pour réussie — et Atlas servirait les données d'un artisan à un autre.

## 5.4 La restauration d'urgence — la marche à suivre

| Étape | Ce qu'on fait | Pourquoi |
|---|---|---|
| **1. Constater** | qu'est-ce qui est perdu, depuis quand, est-ce que ça s'aggrave ? | restaurer trop tôt sur un mauvais diagnostic coûte plus cher que dix minutes de réflexion |
| **2. Geler les écritures** | mettre Atlas en lecture seule, ou l'arrêter | **si on ne gèle pas, on perd tout ce qui s'écrit pendant la restauration**, et on ne saura jamais quoi |
| **3. Choisir le point** | l'instant juste AVANT l'incident | une minute trop tard réintroduit le dégât |
| **4. Restaurer à côté** | base isolée, jamais la production | on peut se tromper de point et recommencer sans rien casser |
| **5. Contrôler** | les six essais du §5.3 | c'est ici qu'on décide si la restauration vaut quelque chose |
| **6. Basculer** | pointer Atlas vers la base restaurée | et **garder l'ancienne base**, ne pas l'effacer — elle peut contenir ce qui manque |
| **7. Réconcilier les fichiers** | les objets créés après le point de restauration sont orphelins | le contrôle de cohérence du §4.1 les liste |

**Ce qu'on ne fait jamais :** restaurer par-dessus la production. Même en
urgence. Même si ça paraît plus rapide. Une restauration ratée par-dessus la
production détruit la seule chose qui restait.

---

# 6. RPO et RTO

**RPO** = combien de données on accepte de perdre.
**RTO** = combien de temps Atlas peut rester éteint.

Le brief demande de ne pas reprendre ses exemples automatiquement. Voici ce que
je propose **pour Atlas**, avec la raison :

| | Proposition | Pourquoi celle-là |
|---|---|---|
| **RPO** | **≤ 15 minutes** | Un artisan saisit un chantier, dicte un devis, prend des photos. Perdre une matinée, c'est lui faire refaire la matinée — sur un chantier, il ne la refera pas. 15 minutes est le maximum acceptable, et c'est **gratuit** avec un PostgreSQL géré qui fait du PITR |
| **RTO** | **≤ 4 heures** | Atlas n'est pas un service d'urgence. Un artisan qui ne peut pas ouvrir son planning une demi-journée est gêné, pas coulé. Viser une heure coûterait cher en infrastructure pour un gain qu'il ne ressentirait pas |

**Sans PITR** (si l'hébergeur choisi n'en propose pas), le RPO retombe
mécaniquement à **24 heures** — une sauvegarde par nuit. C'est le principal
argument en faveur d'un PostgreSQL géré, et c'est la décision 1 du §10.

---

# 7. Sécurité — qu'un attaquant ne puisse pas tout effacer

Le brief pose la bonne question. Voici la réponse, point par point.

| Exigence | Ce qu'il faut, et pourquoi |
|---|---|
| **Séparation des identifiants** | les identifiants qui écrivent les sauvegardes **ne doivent exister nulle part dans l'application**. Aujourd'hui Atlas connaît `DATABASE_URL` et `STORAGE_S3_*` : quelqu'un qui prend le serveur les a. S'il avait aussi ceux des sauvegardes, il effacerait tout |
| **Droits minimaux** | le compte de sauvegarde **écrit** dans le compartiment de sauvegarde ; il ne peut pas **effacer**. Le compte de restauration **lit** ; il ne peut pas écrire |
| **Immutabilité** | verrou d'objet sur 30 jours : **même un administrateur ne peut pas supprimer une sauvegarde avant l'échéance.** C'est la seule protection qui tient contre quelqu'un qui a pris le compte |
| **Seconde copie, autre compte** | protège du cas où le compte principal entier est perdu ou compromis |
| **Chiffrement** | au repos chez l'hébergeur, et en transit. Pour la sauvegarde de la base, chiffrement **avant** l'envoi si l'hébergeur du stockage n'est pas celui de la base |
| **Journaux** | qui a lancé une restauration, quand, vers quelle base. Une restauration est un geste rare : il doit laisser une trace |
| **Secrets de restauration** | **`AUTH_SECRET` doit être sauvegardé séparément** (§1.3). Sans lui, les raccordements d'agenda sont perdus. Et il doit être **versionné** : si on le change, les anciennes sauvegardes ne se déchiffrent plus |

**Le point le plus important de cette section, en une phrase :**

> Si l'application peut atteindre les sauvegardes, alors quelqu'un qui prend
> l'application peut les effacer — et la sauvegarde n'a jamais existé.

---

# 8. Ce qui devra être configuré chez l'hébergeur

Aucune ligne de code. Ce sont des cases à cocher, le jour du déploiement :

1. sauvegardes PostgreSQL automatiques, **quotidiennes**, chiffrées ;
2. **PITR** activé, fenêtre 7 jours minimum ;
3. rétention des sauvegardes : **30 jours** ;
4. **alerte** si une sauvegarde échoue — par courriel, vers une adresse qu'il lit ;
5. stockage objet : **versionnage activé** ;
6. stockage objet : **verrou d'objet 30 jours** ;
7. stockage objet : cycle de vie qui purge les versions de plus de 30 jours ;
8. **un compte de sauvegarde distinct**, avec ses propres clés, absentes de l'application ;
9. réplication vers un second compartiment, idéalement un autre compte ;
10. `AUTH_SECRET` déposé dans un coffre, **avec sa date**.

---

# 9. Ce qui nécessitera du code Atlas

Peu, et rien qui double l'hébergeur. Trois choses seulement :

| | Ce que ça fait | Pourquoi personne d'autre ne peut le faire |
|---|---|---|
| **Contrôle de cohérence base ↔ fichiers** | liste les clés référencées en base absentes du stockage, et les objets orphelins | il faut connaître les **11 colonnes** qui portent une clé d'objet, et elles sont propres à Atlas |
| **Restauration d'essai** | monte une base isolée, y rejoue l'isolation entre entreprises et les droits de M9, **refuse de conclure sur zéro ligne** | l'hébergeur sait restaurer ; il ne sait pas si **Atlas** fonctionne encore dessus |
| **Mode lecture seule** | pour l'étape 2 de l'urgence | sans lui, on arrête Atlas brutalement, et les écritures en cours sont perdues sans trace |

**Et une chose à ne PAS coder** : un système de sauvegarde dans Next.js. Le brief
le dit et je suis d'accord — ce serait une seconde implémentation d'un mécanisme
que l'hébergeur fait mieux, et le dépôt interdit déjà les règles en double.

---

# 10. Les décisions que TU dois prendre

Cinq, et une seule bloque vraiment.

### Décision 1 — **Où Atlas sera-t-il hébergé ?** ⛔ BLOQUANTE

Tout le reste en dépend. Trois familles, avec ce qu'elles coûtent en tranquillité :

| | PITR | Sauvegardes | Ce que ça demande de toi |
|---|---|---|---|
| **PostgreSQL géré** *(recommandé)* | oui, à la minute | automatiques, incluses | quelques cases à cocher |
| PostgreSQL sur un serveur loué | à monter soi-même | à monter soi-même | de la maintenance, tous les mois |
| Base « gratuite » d'un petit fournisseur | souvent non | souvent limitées | **à écarter** : c'est là qu'on perd des données |

**Ma recommandation : un PostgreSQL géré.** C'est ce qui rend le RPO de 15
minutes atteignable sans rien coder, et c'est ce que le brief demande — s'appuyer
sur l'hébergeur.

### Décision 2 — Le stockage des fichiers, chez qui ?

Il faut du **S3 avec versionnage et verrou d'objet**. Beaucoup de fournisseurs le
font. Le choix peut suivre la décision 1 (même fournisseur = plus simple), ou
être délibérément différent (fournisseur différent = plus résistant à la perte
d'un compte).

### Décision 3 — Une seconde copie chez un autre fournisseur : oui ou non ?

| | |
|---|---|
| **Oui** | résiste à la perte du compte principal, à une facture impayée, à un fournisseur qui ferme |
| **Non** | moins cher, moins à surveiller |

**Ma recommandation : oui**, mais seulement pour la base — pas pour les fichiers
au début. La base est petite et irremplaçable ; les fichiers sont volumineux et
partiellement reconstructibles.

### Décision 4 — Qui détient les secrets de restauration ?

`AUTH_SECRET` et les identifiants du compte de sauvegarde ne doivent **pas** être
seulement dans l'application. Où les mets-tu ? Un gestionnaire de mots de passe
t'appartenant est la réponse la plus simple.

### Décision 5 — À quelle fréquence éprouve-t-on la restauration ?

Une sauvegarde jamais restaurée n'est pas une sauvegarde. Je propose : **une
restauration d'essai complète tous les trois mois**, et systématiquement **après
toute migration importante**.

---

# Verdict

## DÉCISION MANQUANTE

Et une seule, la **décision 1 : où Atlas sera-t-il hébergé.**

Ce n'est pas une formalité qu'on peut contourner : le brief demande lui-même de
ne pas choisir un fournisseur tant que l'hébergement n'est pas décidé, et il a
raison. Sans cette réponse :

- on ne sait pas si le PITR existe, donc le RPO est indécidable (15 min ou 24 h) ;
- on ne sait pas quelles cases cocher ;
- et on écrirait du code de sauvegarde maison « en attendant », c'est-à-dire
  exactement ce qu'il ne faut pas faire.

**Ce qui peut avancer sans attendre ta réponse** — et que je peux faire dès que
tu le dis :

1. le **contrôle de cohérence base ↔ fichiers** : il ne dépend d'aucun hébergeur ;
2. la **restauration d'essai** jouée sur le banc, avec la vraie procédure, pour
   qu'elle soit éprouvée avant d'en avoir besoin ;
3. une **sauvegarde du banc plus sûre** : aujourd'hui elle se lance à la main, et
   ce qui se lance à la main ne se lance pas.

**Un point d'urgence, indépendant de tout le reste :** ne mets aucun artisan réel
sur Atlas tant que les points 1 à 10 du §8 ne sont pas cochés. C'est la seule
chose de ce rapport qui ne peut pas attendre une décision d'architecture.
