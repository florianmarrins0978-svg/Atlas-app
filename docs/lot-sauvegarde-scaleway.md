# Atlas — sauvegarde et restauration chez Scaleway

*27 août 2026. L'hébergeur est tranché : **Scaleway**. Ce document remplace la
partie « où héberger » de `docs/lot-sauvegarde-analyse.md` ; tout le reste de ce
rapport-là reste valable et n'est pas répété ici.*

> ## ⚠ Document dépassé sur deux points — lire `docs/lot-sauvegarde-cloture.md`
>
> L'audit du 29 août 2026 a corrigé deux choses **fausses** ci-dessous. La
> numérotation `SCW-…` de ce document n'est plus la bonne non plus : celle qui
> fait foi est dans le document de clôture.
>
> | Ce qui est écrit ici | Ce qui est vrai |
> |---|---|
> | **§4 et SCW-06** : la copie logique « doit se faire avec un rôle **superutilisateur** » | **Faux, et inapplicable chez Scaleway**, qui n'en donne aucun. Il faut un rôle dédié `atlas_sauvegarde` sans privilèges, des politiques de lecture, et `--enable-row-security` |
> | **SCW-15** : la copie logique horaire est « obligatoire **si** Block Storage » | Elle est **obligatoire dans tous les cas** — c'est elle qui porte le RPO d'une heure, quel que soit le volume |
>
> Le reste — capacités de Scaleway, absence de PITR, Object Lock, `AUTH_SECRET` —
> reste exact.

---

## L'essentiel, en cinq lignes

1. **Scaleway N'A PAS de restauration au point dans le temps** pour PostgreSQL.
   L'objectif de perdre au plus 15 minutes **n'est pas atteignable** tel quel.
   Le RPO réel est de **24 heures** avec les sauvegardes seules — et de
   **1 heure** avec l'ajout décrit au §4, qui reste simple.
2. Tout le reste de ce qu'il faut existe chez Scaleway, et bien : versionnage,
   immutabilité, chiffrement, restauration vers une base neuve.
3. **Cinq outils ont été écrits, éprouvés, et joués pour de vrai** — dont deux
   qui ont attrapé un défaut réel pendant leur propre mise au point.
4. Un de ces outils, dans sa première version, **a cassé une protection de
   sécurité**. La batterie l'a vu. C'est écrit au §7.
5. **Verdict : PRÊT À IMPLÉMENTER**, avec deux décisions à prendre — et une
   seule qui change quelque chose au résultat.

---

# 1. Ce que Scaleway sait faire — vérifié, pas supposé

Le brief demandait de ne rien inventer. La documentation officielle de Scaleway
n'est **pas joignable** depuis cet environnement (le mandataire réseau la
refuse), mais son **code source est public sur GitHub** et il a été lu
directement. Chaque ligne ci-dessous vient de là.

## 1.1 PostgreSQL géré

| Capacité | Réponse | Source |
|---|---|---|
| Sauvegardes automatiques | **oui**, activées par défaut à la création | `docs-content`, macro `autobackups` |
| Fréquence par défaut | **1 par jour** | idem |
| Rétention par défaut | **7 jours**, modifiable après création | idem |
| Rétention maximale | **à confirmer dans la console** — la documentation ne donne aucune borne | — |
| Restauration vers une base NEUVE | **oui**, c'est une option de l'écran de restauration | `manage-backups.mdx` |
| Export téléchargeable | **oui**, « Prepare export » puis « Download » | idem |
| **PITR (point dans le temps)** | **NON.** Aucune mention dans la page des concepts, la FAQ ni celle des sauvegardes. Une demande de fonctionnalité publique existe depuis avril 2024 | `feature-request.scaleway.com/posts/882` |
| Durée d'une restauration | *« peut prendre plusieurs heures »* pour une grosse base | `manage-backups.mdx` |

**Un piège de configuration à connaître avant de créer l'instance** — et il n'est
pas rattrapable ensuite sans tout refaire :

| Type de volume | Ce que fait la sauvegarde automatique | Peut-on télécharger un fichier ? |
|---|---|---|
| **Local Storage** | des *backups* (copie logique) | **oui** |
| **Block Storage** | des *snapshots* (copie du volume) | **non** — le snapshot restaure vers une nouvelle instance, il ne se télécharge pas |

C'est décisif pour nous : **pouvoir télécharger une sauvegarde est le seul moyen
d'en garder une copie hors de Scaleway.** Sans elle, perdre le compte Scaleway,
c'est tout perdre — sauvegardes comprises. Voir la décision 1 du §9.

## 1.2 Stockage objet

| Capacité | Réponse |
|---|---|
| Versionnage | **oui**, et c'est le préalable à tout le reste |
| **Object Lock** (immutabilité) | **oui**, modèle WORM |
| Mode **Compliance** | personne ne peut supprimer avant l'échéance — **pas même le propriétaire du compte**. La durée ne peut pas être raccourcie |
| Mode **Governance** | protège de tout le monde **sauf** de qui détient la permission de contournement (`x-amz-bypass-governance-retention`) |
| *Legal hold* | interrupteur indépendant, sans date de fin |
| Chiffrement au repos | **oui** |
| Règles de cycle de vie | **oui** — purge automatique des vieilles versions |
| Point d'attention | **une fois Object Lock activé sur un compartiment, on ne peut plus le désactiver, ni suspendre le versionnage** |

## 1.3 Redis géré

Des instantanés existent, mais la documentation de Scaleway prévient elle-même
que *« le mécanisme de persistance ne garantit pas la récupération des données
en cas d'incident »*.

**Et ça n'a aucune importance pour Atlas.** Redis n'y porte que des compteurs de
limitation de débit — « cette adresse a tenté trois connexions dans le quart
d'heure ». Rien qui appartienne à un artisan. **Redis n'est pas à sauvegarder**,
et le dire évite d'y consacrer du temps et de l'argent.

---

# 2. Ce qui change dans mon rapport précédent, et pourquoi

Le brief demandait de ne pas revenir en arrière sans raison, et d'expliquer
chaque changement. Il y en a **deux**.

## 2.1 Le RPO de 15 minutes tombe. **Je ne le prétendrai pas.**

Mon rapport précédent recommandait un RPO ≤ 15 minutes, en écrivant que ce
serait « gratuit avec un PostgreSQL géré qui fait du PITR ». **La condition
n'est pas remplie chez Scaleway.** Sans restauration au point dans le temps, la
seule granularité est celle des sauvegardes.

| Ce qu'on met en place | RPO réellement atteint |
|---|---|
| sauvegardes Scaleway seules, 1/jour | **24 heures** |
| sauvegardes Scaleway, fréquence portée au maximum | à confirmer dans la console |
| **+ une copie logique horaire vers un compartiment verrouillé** (§4) | **1 heure** |

**Ce qu'il faudrait pour faire mieux**, et je ne le recommande pas aujourd'hui :
gérer PostgreSQL nous-mêmes sur une machine, avec l'archivage des journaux de
transactions. On gagnerait la minute près, et on perdrait la tranquillité —
c'est-à-dire exactement ce qu'on est venu chercher chez un hébergeur géré.

**Mon avis, et c'est une recommandation, pas une contrainte :** pour un artisan
qui saisit ses chantiers dans la journée, **une heure est le bon compromis**.
Perdre une heure de saisie se rattrape ; perdre une journée ne se rattrape pas.

## 2.2 La seconde copie n'est plus optionnelle. Elle devient le cœur du dispositif.

Mon rapport précédent la recommandait « pour la base seulement ». Deux faits
découverts depuis la renforcent :

- les sauvegardes de Scaleway vivent **dans Scaleway**, pas dans un compartiment
  qu'on choisit — une demande de fonctionnalité publique le réclame encore ;
- avec Block Storage, elles ne sont **pas téléchargeables**.

Donc : sans copie indépendante, **perdre le compte Scaleway (litige, erreur de
facturation, compromission) fait tout perdre d'un coup, sauvegardes comprises.**
C'est le scénario 7 du premier rapport, et il est réel.

---

# 3. Qui fait quoi

| | Ce qui lui revient |
|---|---|
| **Scaleway PostgreSQL géré** | sauvegardes quotidiennes automatiques, rétention, restauration vers une base neuve, chiffrement |
| **Scaleway Object Storage** | versionnage, Object Lock, chiffrement, cycle de vie, **et** l'accueil de notre copie logique |
| **Scaleway Redis géré** | rien à sauvegarder — assumé, écrit, et c'est une économie |
| **L'hébergement de l'application** | rien à sauvegarder : le serveur ne stocke aucune donnée. Il se redéploie |
| **Scaleway Secret Manager** | garder `AUTH_SECRET` **et ses versions** — voir §5 |
| **Atlas** | **seulement ce que rien d'autre ne peut faire** : cinq outils, §6 |

---

# 4. La copie logique horaire — le seul ajout, et il est modeste

Un `pg_dump` par heure, déposé dans un compartiment verrouillé.

**Ce n'est pas « un système de sauvegarde maison ».** C'est la commande standard
de PostgreSQL, lancée par le planificateur de l'hébergeur — Scaleway documente
lui-même ce montage avec ses *Serverless Jobs* et son interface en ligne de
commande. Ce qu'on ne fait pas : écrire du code de sauvegarde dans Next.js.

Ce qu'elle apporte, et qui ne se remplace pas :

| | |
|---|---|
| **RPO d'une heure** au lieu de 24 | la seule façon d'y arriver sans PITR |
| une copie **hors de la mécanique Scaleway**, dans un compartiment qu'on choisit | protège du scénario 7 |
| un fichier **téléchargeable**, donc emportable ailleurs | protège de la perte du compte |
| verrouillée en mode **Compliance** | même un administrateur compromis ne l'efface pas |

**Et elle doit se faire avec un rôle superutilisateur.** C'est mesuré, pas
supposé : `atlas_app` **et** `atlas_owner` font échouer `pg_dump`, parce que
34 tables sont en `FORCE ROW LEVEL SECURITY` — laquelle s'applique **même au
propriétaire des tables**.

---

# 5. `AUTH_SECRET`, et la rotation

Rappel du premier rapport, qui ne bouge pas : les mots de passe iCloud et les
secrets Google des artisans sont chiffrés avec une clé **dérivée d'`AUTH_SECRET`**.
Une base restaurée sans le même `AUTH_SECRET` rend ces champs **définitivement
illisibles, sans qu'aucune erreur ne le signale**.

**Scaleway Secret Manager convient**, et pour une raison précise : *« chaque fois
que vous mettez à jour un secret, nous en conservons une nouvelle version »*.
C'est exactement ce dont on a besoin.

**La règle de rotation, et elle ne se négocie pas :**

> Une sauvegarde prise le jour J doit être restaurable avec l'`AUTH_SECRET` en
> vigueur le jour J. **On ne supprime donc JAMAIS une version d'`AUTH_SECRET`
> tant qu'une sauvegarde de cette époque existe encore.**

Concrètement : rétention des sauvegardes 30 jours ⇒ on garde les versions du
secret **au moins 30 jours** après leur remplacement. Et la version en vigueur
porte sa date, pour qu'on sache laquelle essayer.

**Le contrôle qui empêche l'oubli existe** : `eprouver-restauration.ts` déchiffre
un vrai secret d'agenda de la sauvegarde. Il a été **vu vert avec la bonne clé et
rouge avec une autre** (§7). C'est le seul moyen de découvrir le problème avant
d'en avoir besoin.

---

# 6. Ce qui a été codé — et pourquoi rien de plus

Cinq outils. Aucun ne double ce que Scaleway sait faire.

| Outil | Ce qu'il fait | Pourquoi Scaleway ne peut pas |
|---|---|---|
| `src/lib/objets-stockes.ts` | déclare les **11 colonnes** qui portent la clé d'un fichier | connaissance propre à Atlas |
| `scripts/test-objets-stockes.ts` | relit `schema.ts` et **refuse toute colonne oubliée** | une liste à la main meurt en silence |
| `scripts/verifier-coherence-fichiers.ts` | compare base ↔ stockage, dans les deux sens | il faut connaître les 11 colonnes |
| `scripts/eprouver-restauration.ts` | restaure dans une base **isolée** et vérifie **9 propriétés** | Scaleway sait restaurer ; il ne sait pas si Atlas tient dessus |
| `scripts/geler-les-ecritures.sh` | passe l'application en lecture seule le temps d'une restauration | — |
| `scripts/sauvegarder-banc.sh` | **durci** : compte les lignes de données | voir §7 |

## Ce que `eprouver-restauration.ts` contrôle, un par un

1. la base restaurée **n'est pas vide** — refus de conclure sur zéro ;
2. les **volumes** correspondent, table par table ;
3. **toutes les migrations** sont là ;
4. la **RLS est active ET forcée** sur au moins 30 tables ;
5. **deux entreprises ne se voient pas** — éprouvé en fabriquant une voisine
   dans la base d'essai, pas déduit d'un réglage ;
6. `atlas_app` existe et **ne traverse pas** la RLS ;
7. **M9 tient** : l'application ne peut pas lire le condensat du mot de passe ;
8. les fonctions `SECURITY DEFINER` sont là, **avec le bon propriétaire** ;
9. les secrets chiffrés **se déchiffrent encore**.

**Et il refuse de travailler sur une base dont le nom ne dit pas qu'elle est un
essai.** La production ne se restaure jamais par-dessus elle-même.

---

# 7. Ce qui a été éprouvé — et les trois défauts trouvés en chemin

Une sauvegarde non restaurée ne compte pas. Tout ce qui suit a été **joué**, sur
la base du banc.

## Les essais qui ont réussi

| Essai | Résultat |
|---|---|
| Sauvegarde réelle (227 Ko), restaurée dans une base isolée | **9 contrôles verts** |
| Un fichier réel supprimé du stockage | **détecté**, avec sa clé, code de sortie 1 |
| Sauvegarde tentée sous `atlas_owner` | **refusée**, fichier partiel effacé |
| Gel des écritures | insertion refusée, **lecture intacte** (4 clients toujours lus) |
| Le rôle de l'application essaie de se dégeler lui-même | **refusé** |

## Les essais NÉGATIFS — un contrôle qui n'a jamais rougi ne prouve rien

| Essai | Le contrôle a-t-il rougi ? |
|---|---|
| Restauration avec un **autre `AUTH_SECRET`** | **OUI** — « un secret d'artisan ne se déchiffre plus » |
| Sauvegarde amputée du `FORCE ROW LEVEL SECURITY` | **OUI** |
| Sauvegarde tronquée aux 200 premières lignes | **OUI** — 6 contrôles en échec, 0 entreprise |
| Contrôle de cohérence sous un rôle qui ne traverse pas la RLS | **OUI** — il refuse de conclure |
| Base éteinte | **OUI**, et il accuse le serveur, pas les droits |

## Les trois défauts trouvés, dont deux dans mes propres outils

### ❶ Le plus grave : mon gel des écritures **cassait M9**

La première version retirait les droits d'écriture (`REVOKE`) et les rendait au
dégel (`GRANT INSERT, UPDATE, DELETE ON ALL TABLES`).

**La batterie l'a attrapé** : *« le rôle applicatif peut encore ÉCRIRE un
condensat »*. Le mécanisme est contre-intuitif et mérite d'être écrit : M9 retire
à `atlas_app` l'accès à la **colonne** `users.password_hash` ; un `GRANT` sur la
**table entière** écrase cette restriction. Mon dégel rendait donc **plus** que ce
que mon gel avait retiré, et rouvrait en silence la porte que M9 avait fermée.

**Un outil de secours qui affaiblit la sécurité en revenant à la normale est pire
que pas d'outil du tout.** Refait : le gel pose désormais un réglage
(`default_transaction_read_only`) et **ne touche aucun droit**. Vérifié après
coup : M9 debout, **260/260 suites base au vert**.

### ❷ Le contrôle de cohérence rendait un **faux vert**

Sa première version refusait de conclure « si le total des clés vaut zéro ».
Raisonnement qui paraît solide, et qui ne l'est pas : deux tables ne sont pas
cloisonnées par entreprise et rendent des lignes à n'importe quel rôle. Sous
`atlas_app`, il voyait 3 clés sur des dizaines, ne déclenchait pas son garde-fou,
et annonçait « base et stockage cohérents » **en ayant ignoré neuf colonnes sur
onze**.

Corrigé : le droit de traverser la RLS est désormais **demandé à PostgreSQL**,
pas déduit d'un compte.

### ❸ Le contrôle de taille de la sauvegarde du banc laissait passer le vide

L'ancien seuil : « plus de 1 000 octets ». Or `pg_dump --schema-only` produit
**176 780 octets, code de sortie 0, et zéro donnée**. Le fichier a l'air d'une
sauvegarde et n'en est pas une.

Corrigé : on **compte les lignes de données** et on compare le nombre de
migrations à celui de la base vivante.

---

# 8. La procédure de restauration d'urgence

Six situations, une seule marche à suivre.

| Situation | Ce qu'on fait |
|---|---|
| **PostgreSQL perdu** | restaurer la dernière sauvegarde vers une **nouvelle** instance, éprouver, basculer |
| **Migration destructive** | restaurer au point d'avant la migration ; les fichiers ne sont pas touchés |
| **Suppression accidentelle** | restaurer à côté, extraire ce qui manque, réinjecter — **sans** écraser le reste |
| **Fichiers disparus** | récupérer la version précédente par le versionnage du compartiment |
| **Serveur applicatif perdu** | **aucune donnée perdue** : redéployer |
| **Administrateur compromis** | les sauvegardes verrouillées en mode Compliance **ne peuvent pas** être effacées ; changer les identifiants, restaurer depuis elles |

**La marche à suivre, dans l'ordre — et l'ordre compte :**

1. **Constater.** Quoi, depuis quand, est-ce que ça s'aggrave ?
2. **Geler les écritures** — `bash scripts/geler-les-ecritures.sh`.
   Sans ce geste, tout ce qui s'écrit pendant la restauration est perdu, et
   personne ne saura quoi.
3. **Choisir le point** de restauration.
4. **Restaurer à côté**, jamais par-dessus.
5. **Éprouver** — `npx tsx scripts/eprouver-restauration.ts <fichier>`.
   Neuf contrôles. S'ils ne passent pas, **on ne bascule pas.**
6. **Vérifier les fichiers** — `npx tsx scripts/verifier-coherence-fichiers.ts`.
7. **Basculer**, en **gardant l'ancienne base** : elle peut contenir ce qui manque.
8. **Dégeler** — `bash scripts/geler-les-ecritures.sh --degeler`.

---

# 9. Les décisions à prendre

### Décision 1 — **Local Storage ou Block Storage pour le VOLUME DE L'INSTANCE ?** ⚠ à prendre AVANT de créer l'instance

**Cette décision ne porte que sur l'instance PostgreSQL elle-même.** Elle ne dit
rien de l'endroit où sont rangés les fichiers `.sql.gz` de la copie logique : ces
fichiers-là vont dans un **compartiment de stockage objet** (SCW-11 ci-dessous),
et ni *Local Storage* ni *Block Storage* n'est un endroit où l'on range un
fichier.

| | Local Storage | Block Storage |
|---|---|---|
| Sauvegarde automatique | *backups* | *snapshots* |
| **Téléchargeable** | **oui** | **non** |
| Souplesse de taille | moindre | meilleure |

**Ma recommandation : Local Storage**, pour garder la capacité de télécharger une
sauvegarde. C'est ce qui permet d'en garder une copie ailleurs.

**Si tu préfères Block Storage** pour la souplesse, ce n'est pas bloquant : la
copie logique horaire du §4 remplit ce rôle. *(Elle est de toute façon
obligatoire — voir l'avertissement en tête de document.)*

### Décision 2 — La seconde copie va-t-elle **hors de Scaleway** ?

| | |
|---|---|
| **Dans un autre compartiment Scaleway, autre projet** | simple, protège de l'erreur humaine et de l'administrateur compromis |
| **Chez un autre fournisseur** | protège en plus de la perte du compte Scaleway et d'un litige de facturation |

**Ma recommandation : commencer dans un autre projet Scaleway**, avec des
identifiants séparés. C'est 80 % du bénéfice pour 20 % de la complexité. La copie
hors-Scaleway peut venir plus tard, quand il y aura de vrais clients.

---

# 10. La liste Scaleway, à dérouler le jour de l'infrastructure

Chaque point : **pourquoi**, **valeur**, **ce qui arrive si on l'oublie**, et
**avant le premier client ou non**.

| | Quoi | Valeur | Pourquoi | Si on l'oublie | Obligatoire ? |
|---|---|---|---|---|---|
| **SCW-01** | Créer l'instance PostgreSQL gérée | version 16+, **Local Storage** (décision 1) | c'est la base | — | **OUI** |
| **SCW-02** | Vérifier que l'autobackup est actif | activé par défaut | sans lui, rien n'est sauvegardé | **tout est perdu au premier incident** | **OUI** |
| **SCW-03** | Porter la rétention à **30 jours** | 30 (défaut : 7) | 7 jours ne couvrent pas des vacances | un dégât découvert au retour est irrécupérable | **OUI** |
| **SCW-04** | Porter la fréquence au maximum offert | à lire dans la console | chaque palier réduit ce qu'on perd | RPO à 24 h | recommandé |
| **SCW-05** | Créer les rôles `atlas_owner` et `atlas_app` | `atlas_app` : **NOBYPASSRLS**, non superutilisateur | c'est l'isolation entre artisans | **un artisan verrait les clients d'un autre** | **OUI** |
| **SCW-06** | Créer un rôle **dédié à la sauvegarde**, superutilisateur | identifiants séparés | `pg_dump` échoue sous tout autre rôle — mesuré | sauvegardes impossibles | **OUI** |
| **SCW-07** | Créer le compartiment des **fichiers** | `atlas-fichiers` | photos, PDF, dictées | — | **OUI** |
| **SCW-08** | Activer le **versionnage** dessus | activé | un fichier écrasé reste récupérable | une photo remplacée est perdue | **OUI** |
| **SCW-09** | Object Lock **Governance**, 30 jours | Governance — **pas Compliance** | protège de l'effacement accidentel **tout en laissant** honorer une demande d'effacement RGPD | soit rien n'est protégé, soit on ne peut plus effacer légalement | **OUI** |
| **SCW-10** | Cycle de vie : purger les versions > 30 jours | 30 jours | sinon on paie éternellement | facture qui enfle | recommandé |
| **SCW-11** | Créer le compartiment des **sauvegardes** | `atlas-sauvegardes`, **autre projet** | il ne doit pas tomber avec le reste | un administrateur compromis efface tout | **OUI** |
| **SCW-12** | Object Lock **Compliance**, 30 jours | Compliance — **cette fois oui** | **personne**, pas même le propriétaire, ne peut effacer avant l'échéance | le scénario 7 redevient possible | **OUI** |
| **SCW-13** | Clé d'accès **écriture seule** pour la sauvegarde | pas de droit de suppression | une clé volée ne peut pas effacer l'historique | — | **OUI** |
| **SCW-14** | Clé d'accès **lecture seule** pour la restauration | séparée de la précédente | on ne restaure pas avec la clé qui écrit | — | recommandé |
| **SCW-15** | Planifier la **copie logique horaire** (§4) | toutes les heures, rôle SCW-06 | fait passer le RPO de 24 h à 1 h | on perd jusqu'à une journée | **OUI** si Block Storage, sinon fortement recommandé |
| **SCW-16** | Déposer `AUTH_SECRET` dans **Secret Manager** | avec sa date | sans lui, les agendas des artisans deviennent illisibles **en silence** | données présentes et inutilisables | **OUI** |
| **SCW-17** | Écrire la règle de rotation | ne jamais supprimer une version < 30 j | une vieille sauvegarde ne doit pas devenir inutilisable | restauration muette et incomplète | **OUI** |
| **SCW-18** | Créer l'instance **Redis gérée** | la plus petite | limitation de débit partagée entre instances | Atlas refuse de démarrer en production | **OUI** |
| **SCW-19** | **Ne PAS** sauvegarder Redis | — | il ne porte aucune donnée d'artisan | de l'argent et du temps dépensés pour rien | — |
| **SCW-20** | Brancher l'**alerte d'échec de sauvegarde** | vers une adresse réellement lue | une sauvegarde qui échoue en silence n'existe pas | on le découvre le jour de l'incident | **OUI** |
| **SCW-21** | Jouer une **restauration d'essai complète** | avant le premier client, puis tous les 3 mois | une sauvegarde non restaurée ne compte pas | on découvre le défaut au pire moment | **OUI** |
| **SCW-22** | Poser `ATLAS_RP_ID` et `ATLAS_PROXY_SAUTS` | (dette existante, `PROJECT_STATE.md`) | Face ID et les seuils par source | Face ID refuse de s'enregistrer | **OUI** |

**Quatorze points sont obligatoires avant le premier client.** Aucun ne demande
de code : ce sont des cases à cocher.

---

# 11. Sauvegarde, immutabilité, RGPD, conservation légale — quatre choses différentes

Le brief demandait de ne pas rendre les fichiers indéfiniment ineffaçables. La
distinction est faite, et c'est elle qui justifie **Governance d'un côté,
Compliance de l'autre** :

| | Ce que c'est | Durée | Peut-on effacer avant ? |
|---|---|---|---|
| **Sauvegarde** | pouvoir revenir en arrière | 30 jours | oui, à l'échéance |
| **Immutabilité** | empêcher un effacement malveillant | 30 jours | **compartiment des sauvegardes : non** (Compliance) · **compartiment des fichiers : oui, avec la permission** (Governance) |
| **Effacement RGPD** | un client demande que ses données partent | à la demande | **oui** — d'où Governance sur les fichiers |
| **Conservation légale** | factures **10 ans**, devis acceptés **5 ans** | des années | **non**, et le code le refuse déjà (`src/server/retention.ts`) |

**Le point à ne pas confondre**, déjà écrit dans le premier rapport et toujours
vrai : ce sont **les 10 ans de la base vivante** qui portent l'obligation légale,
pas les 30 jours de sauvegarde. La sauvegarde protège la base ; elle ne la
remplace pas.

Et une conséquence pratique de Governance sur les fichiers : un effacement RGPD
demande une **permission de contournement**, donc un geste délibéré et tracé. Ce
n'est pas une gêne, c'est la preuve qu'on ne l'a pas fait par accident.

---

# 12. Ce qui reste ouvert

| Point | Qui tranche |
|---|---|
| **Rétention maximale** des sauvegardes chez Scaleway | à lire dans la console le jour J — la documentation ne la donne pas |
| **Fréquence maximale** des sauvegardes automatiques | idem |
| Une écriture refusée pendant un gel remonte comme une **erreur technique**, pas comme une phrase compréhensible | nous, hors de ce lot — acceptable pour une urgence rare et annoncée |
| L'**export d'une entreprise** n'emporte ni son **logo** ni les **photos de ses tickets de caisse**, alors que les lignes `achats_tva` partent | nous, hors de ce lot — c'est de la portabilité RGPD, pas de la sauvegarde. Écrit dans `TODO.md` |
| Un refus de rôle sort en **500** au lieu de **403** sur `/api/mes-donnees` | nous, lot suivant (déjà consigné) |
| **La tempête Turbopack** qui tue le serveur de la batterie | non diagnostiquée, intermittente (déjà consignée) |

---

# Verdict

## PRÊT À IMPLÉMENTER

Les outils sont écrits, éprouvés, et joués pour de vrai — y compris dans leurs
cas d'échec. La liste Scaleway est prête à dérouler.

**Deux décisions t'appartiennent**, et une seule change le résultat :

1. **Local Storage ou Block Storage** — à prendre avant de créer l'instance,
   parce qu'elle décide si une sauvegarde est téléchargeable. *Recommandation :
   Local Storage.*
2. **Où va la seconde copie** — autre projet Scaleway, ou autre fournisseur.
   *Recommandation : autre projet Scaleway pour commencer.*

**Ce qui ne dépend d'aucune décision, et qui est acquis :** le RPO réel sera de
**1 heure**, pas 15 minutes. Scaleway n'offre pas la restauration au point dans
le temps, et je préfère te le dire que te laisser croire l'inverse.

**Et le point d'urgence, inchangé :** aucun artisan réel sur Atlas tant que les
quatorze points obligatoires du §10 ne sont pas cochés.
