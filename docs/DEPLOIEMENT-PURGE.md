# Brancher la purge, le jour du déploiement

*29 août 2026. À dérouler chez l'hébergeur — rien de tout ceci ne se fait dans
le dépôt.*

---

## Pourquoi ce document existe

`/api/cron/purge-fichiers` existe, elle est authentifiée, elle fonctionne — et
**rien ne l'appelle**. Tant que c'est le cas, aucun audio de dictée n'est
effacé, aucune photo de diagnostic échue, aucun fichier en attente. Toutes les
durées de conservation annoncées dans `docs/RGPD.md` sont des promesses vides.

**Le grave n'est pas l'oubli — c'est le silence.** Une purge qui ne tourne pas
ne se signale pas : aucune erreur, aucun écran rouge, aucun ralentissement. On
ne s'en apercevrait qu'en cherchant autre chose, des mois plus tard.

Le lot de clôture a rendu l'état **lisible** (§3 ci-dessous). Il reste à le
rendre **vrai**, et cela se fait chez l'hébergeur.

---

## 1. Ce qu'Atlas fait, et ce qu'il ne fera jamais

| | |
|---|---|
| **Atlas fait** | le ménage, quand on l'appelle ; il refuse tout appel sans le bon secret ; il journalise chaque exécution réussie ; il dit à toute heure si le ménage se fait encore |
| **Atlas ne fait pas** | **planifier**. Aucun minuteur interne, aucune boucle, aucun `setInterval` |

**Et ce n'est pas un manque.** Un minuteur interne mourrait avec le processus —
un redéploiement, un redémarrage, une instance qui bascule — **sans que personne
ne le sache**. Ce serait le défaut qu'on répare, déplacé d'un cran et rendu plus
difficile à voir. Les planificateurs des hébergeurs, eux, savent alerter quand
une exécution échoue ou n'a pas lieu.

---

## 2. Ce qu'il faut brancher

### 2.1 Le planificateur

**Chez Scaleway : un *Serverless Job* avec un déclencheur *cron*.** C'est le
mécanisme prévu pour cela, et il porte son propre journal d'exécutions et ses
propres alertes — deux choses qu'il ne faut surtout pas réécrire.

Ce que le travail doit exécuter, et rien de plus :

```
curl --fail --silent --show-error \
  -X POST "$ATLAS_URL_PUBLIQUE/api/cron/purge-fichiers" \
  -H "x-cron-secret: $CRON_SECRET"
```

| | |
|---|---|
| **Rythme** | **une fois par jour** suffit |
| **`--fail`** | **indispensable.** Sans lui, `curl` rend 0 sur un 401 comme sur un 500 : le travail serait vert, la purge refusée, et le planificateur n'alerterait jamais |
| **Secret** | `CRON_SECRET`, celui d'Atlas. Un secret Scaleway, jamais une variable en clair dans la définition du travail |

**Pourquoi une fois par jour et pas une fois par heure.** Les durées de
conservation se comptent en jours — sept pour un audio, quatre-vingt-dix pour
une photo de diagnostic, vingt-quatre heures pour un fichier orphelin. Purger
plus souvent n'avance rien et multiplie les appels. Un retard d'un jour ne fait
dépasser aucune durée annoncée.

### 2.2 La surveillance

Le planificateur alerte quand **son** travail échoue. Il n'alerte pas quand le
travail a été **débranché**, supprimé, ou quand son déclencheur a été désactivé
par mégarde. C'est précisément le cas qui nous occupe — et c'est le plus
probable.

**Poser donc une sonde HTTP sur :**

```
GET $ATLAS_URL_PUBLIQUE/api/health/purge
```

| Réponse | Ce que ça veut dire |
|---|---|
| **200** | le ménage se fait |
| **503** | **aucune purge réussie depuis plus de 48 h** — ou jamais aucune |

Le code HTTP est le signal : n'importe quelle sonde sait le lire sans qu'on lui
apprenne à lire du JSON. Le corps de la réponse est là pour l'humain qui vient
regarder après l'alerte — il porte la date de la dernière purge réussie et une
phrase en français qui dit quoi faire.

**Rythme conseillé : une fois par heure.** Le seuil étant à 48 h, rien ne presse.

---

## 3. Ce que le lot de clôture a déjà fait

Pour que la liste ci-dessus ne se relise pas comme du travail restant à écrire.

| | |
|---|---|
| **`executions_purge`** | une ligne par exécution **réussie** — date et compteurs. La purge élague son propre journal au-delà de 90 jours |
| **L'écriture est dans le `try`** | jamais dans un `finally`. Un horodatage posé malgré l'échec dirait « le ménage se fait » pendant que rien n'est purgé : c'est le faux vert le plus dangereux, celui qui rassure. `scripts/test-journal-purge-db.ts` le provoque pour de bon — il retire à `atlas_app` le droit d'écrire, appelle la purge, et vérifie que rien n'est noté |
| **`/api/health/purge`** | 200 / 503, et la date. Ouverte, comme les autres sondes : elle ne rend aucune donnée d'artisan |
| **Séparée de `/api/health/ready`** | délibérément. Faire rougir « ready » pour une purge en retard **mettrait Atlas hors service** : un artisan ne pourrait plus ouvrir ses chantiers parce que des audios de la semaine dernière traînent |
| **Seuil à 48 h** | il mesure la **panne**, pas la ponctualité. Une purge qui saute pendant un redéploiement n'est pas un incident, et une alerte qui parle pour ça s'apprend à être ignorée |

---

## 4. Vérifier que c'est branché, le jour même

Dans cet ordre. Les trois prennent deux minutes.

1. **Lancer le travail à la main** depuis la console de l'hébergeur. Il doit
   finir en succès.
2. **Interroger la sonde** : `GET /api/health/purge` doit rendre **200**, avec
   une `derniere_purge_reussie` à l'instant.
3. **Éprouver le refus** : le même appel de purge **sans** l'en-tête de secret
   doit rendre **401**. Si un jour il rend 200, le secret n'est pas posé et la
   route est ouverte à tout l'internet.

**Le troisième contrôle est le seul qui puisse mal tourner en silence** : les
deux premiers échouent bruyamment, celui-là non.

---

## 5. Ce que ce document ne couvre pas

- **La conservation des journaux** (`RETENTION.journauxJours`, 180 jours). Les
  journaux d'Atlas partent sur la sortie standard : c'est l'hébergeur qui les
  garde et les expire. **Aucun code d'Atlas ne l'applique, et c'est normal** —
  chercher à purger ce qu'on ne détient pas n'aurait aucun sens. La durée est à
  poser dans la configuration de journalisation de Scaleway.
- **La fermeture d'un compte** (`RETENTION.compteFermeJours`, 30 jours). Ce
  chemin **n'existe pas** dans le produit : ni écran, ni fonction. La durée
  décrit une opération qui n'est pas codée, et elle est marquée comme telle dans
  `src/server/retention.ts`. À écrire ou à retirer — c'est dans `TODO.md`.
- **Les sauvegardes.** Elles ont leur propre document
  (`docs/lot-sauvegarde-cloture.md`) et leur propre liste `SCW-01` à `SCW-23`.
  Une purge n'est pas une sauvegarde : l'une efface ce qui a expiré, l'autre
  garde ce qui compte.
