# Trois écrans par terre — diagnostic du 13 septembre 2026

*Aucune correction n'a été faite. Ce document est le diagnostic demandé avant
d'y toucher.*

---

## En une phrase

**L'application n'est pas cassée : la base de l'espace de travail est restée
quatre migrations en arrière du code qu'il sert**, parce que la migration 0087
refuse de s'appliquer sur une base qui contient déjà des données.

---

## 1. Ce qui a été reproduit, dans les mêmes conditions

La fiche publiée par l'espace à 19 h 11 donne l'état réel :

```
Code récupéré    : de4f1c9
Code SERVI       : 3c5bda7
Base             : EN RETARD DE 4 — 0087, 0088, 0089, 0090
```

Une base arrêtée à la migration 0086 a été montée, le code de `main` servi
par-dessus, et les écrans parcourus dans un navigateur, connecté :

| Code servi | Planning | Terminés | Réglages | Chantiers · Paysage · Tarifs · Clients · Catalogue |
|---|---|---|---|---|
| `07f6f0d` — ce matin | ✅ | ✅ | ✅ | ✅ |
| `3c5bda7` — 16 h 01, **avant les lots de l'après-midi** | ❌ | ❌ | ❌ | ✅ |
| `de4f1c9` — version actuelle | ❌ | ❌ | ❌ | ✅ |

Même base dans les trois cas. Seul le code change.

## 2. La référence affichée à l'écran (3833697705)

**Non retrouvée, et elle ne peut pas l'être à distance.** C'est un identifiant
opaque que Next.js substitue au message d'erreur ; le journal de l'espace n'est
délibérément pas publié sur la fiche, parce que le dépôt est public.

Le message a été reproduit à la place :

```
column "conditions_generales" does not exist
```

## 3. Les trois pages, et ce qu'elles ont en commun

**Planning · Terminés · Réglages.**

« Tarifs indisponibles » est le titre de l'écran d'erreur de **Réglages** — un
intitulé resté de l'époque où cet écran *était* les tarifs. Il envoie chercher
au mauvais endroit ; les tarifs eux-mêmes fonctionnent.

Ces trois écrans, et eux seuls, appellent `getEntreprise`, qui lit l'entreprise
**entière** — les 44 colonnes du schéma, dont `conditions_generales`. Les cinq
autres écrans ne lisent jamais l'entreprise : ils tiennent debout.

## 4. Ce qui a basculé aujourd'hui

| | |
|---|---|
| `983cfba` — 10 h 58 | « Coder la planche B du devis » : migration **0090**, qui ajoute `conditions_generales`. À partir de ce commit, le code exige une base migrée |
| lots de 17 h 11 et 18 h 26 | **hors de cause** : le tableau du §1 le montre, `3c5bda7` les précède et tombe déjà |

## 5. Pourquoi la base est bloquée

Le script de migration s'arrête au premier échec, en annulant le fichier entier.
Rejoué sur une base à 0086 :

```
échec : check constraint "diagnostics_refus_complet_ck"
        of relation "diagnostics" is violated by some row
```

La migration **0087** ajoute une contrainte que viole toute ligne de
`diagnostics` au statut `inconclusif` ne portant pas de phrase de refus. Son
commentaire affirme « il n'en existe pas » — une supposition, jamais vérifiée
contre une vraie base. 0088, 0089 et 0090 n'ont donc **jamais été tentées**.

> **Reproduit, pas observé sur l'espace.** Le confirmer demande la ligne
> `migrations : échec : …` du journal de démarrage, qui n'est pas publiée.

Tout le reste a été écarté : RLS, rôles, contexte entreprise, mandataire,
variables d'environnement. La même base sous le code de ce matin sert les six
pages sans une erreur.

## 6. Pourquoi les vérifications sont passées

La batterie applique les migrations **avant** de mesurer. La CI aussi. Le cas
« code neuf sur base en retard » n'est joué nulle part : le code a été éprouvé
contre un schéma toujours à jour, donc jamais contre celui de l'espace.

## 7. Le trou exact dans la couverture

1. **Aucune migration n'est éprouvée sur une base HABITÉE.** Elles tournent sur
   une base vide, où une contrainte ne peut pas être violée par des lignes
   existantes. 0087 était donc verte partout et infranchissable en vrai.
2. **Rien ne confronte le schéma attendu au schéma réel.** L'écart se découvre
   par un écran mort et un numéro à six chiffres.

## 8. Correction minimale proposée

| | |
|---|---|
| **a** | dans 0087, renseigner les lignes `inconclusif` sans phrase **avant** d'ajouter la contrainte — une instruction SQL. Débloque 0088 → 0090 en cascade |
| **b** | publier sur la fiche la raison du dernier échec de migration — une ligne, sans quoi le prochain diagnostic se refera à l'aveugle |

Rien d'autre : ni refactoring, ni nettoyage.

**Ordre retenu :** test de non-régression qui applique 0087 sur une base
habitée → il échoue → correction (a) → test vert → les six pages vérifiées sur
l'espace réel.

---

## Ce qui attend, non livré

Un lot est prêt sur la branche de session, **volontairement pas fusionné** :

- le veilleur mesure l'écart code/base tous les quarts d'heure et applique ce
  qui manque — la réparation ne dépend alors plus d'un geste ;
- l'écran des Réglages ne lit plus que le **nom** de l'entreprise au lieu de ses
  44 colonnes : c'est lui qui porte le bouton de réparation, et il tombait de la
  panne qu'il sert à diagnostiquer.

Il ne corrige pas 0087. Il ne partira qu'après accord.
