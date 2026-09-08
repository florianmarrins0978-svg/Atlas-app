# Prévenir ses clients quand l'IBAN change

**8 septembre 2026.** Document de retour : un verdict par point, ce qui a été
fait autrement, ce qui a été refusé, les chiffres, et ce qui reste.

---

## En cinq lignes

1. Quand l'IBAN change, les factures **déjà envoyées et non réglées** gardent
   l'ancien — et le client risque de virer sur un compte fermé.
2. Atlas ne les réécrit pas : il **prévient**, et écrit le message.
3. **Sa question a corrigé ma proposition** : « où je retrouve l'écran ? » —
   nulle part. D'où **trois** endroits, et non deux au choix.
4. Ce qu'on range, c'est **l'IBAN annoncé**, pas un « prévenu ».
5. Le mur rencontré — l'immuabilité d'une facture émise — avait raison, et il
   s'ouvre d'**une seule colonne**.

---

## 1. Ce qu'il a demandé, et ce qui a été livré

| Sa demande | Verdict | Le fichier |
|---|---|---|
| prévenir des factures parties avec l'ancien IBAN | **fait** | `src/server/repositories/factures.ts` — `facturesAvecAncienIban` |
| le message écrit par Atlas | **fait** | `src/lib/modalites-paiement.ts` — `messageNouvelIban` |
| **trois** endroits | **fait** | `src/components/atlas/AlerteAncienIban.tsx`, employé trois fois |
| rien quand aucune facture n'est concernée | **fait** | la pièce rend `null` — ni « 0 facture », ni coche verte |

### Les trois endroits, et ce qui les distingue

| Où | Ce qu'il y fait |
|---|---|
| **Réglages → Identité**, sous le champ | c'est là que ça **vit**, tant qu'il n'a pas prévenu |
| **En attente de paiement** | une marque par ligne, là où il va **déjà** voir qui n'a pas payé |
| **L'écran du jour du changement** | s'ouvre une fois. Il ne barre rien : « Plus tard » le referme, et les deux autres restent |

---

## 2. CE QUE SA QUESTION A CORRIGÉ

> *« Si on choisit la B et que je décide de les relancer plus tard, où je dois
> aller pour retrouver l'écran B ? »*

**Nulle part.** Je lui avais proposé « A ou B » — l'encart sous le champ, ou un
écran qui s'ouvre. Avec B seul, « Plus tard » ne menait à rien : il aurait fallu
**rechanger d'IBAN** pour revoir l'écran.

B n'est donc pas une alternative à A : **il en a besoin**. C'est ce qui a produit
les trois endroits, et c'est lui qui l'a vu — pas moi.

---

## 3. Ce qui a été fait autrement que dans la maquette

### « Prévenir les 3 » a été retiré, et c'est assumé

La maquette portait un bouton qui promettait de prévenir tout le monde d'un
coup. **Le coder aurait menti** : chaque message part dans la messagerie de
l'artisan, une conversation à la fois. Un bouton unique en aurait ouvert **une**
et laissé croire que les trois étaient parties.

Un geste par client, et l'on voit ce qui reste.

### Une trace de ce qui a été signalé — ce que la maquette promettait

La planche disait : *« l'alerte reste tant que vous n'avez pas prévenu »*. Sans
rien stocker, elle n'aurait pas su s'arrêter : l'artisan prévient ses trois
clients, et l'alerte les redemande le lendemain, jusqu'au paiement. **C'est
exactement l'avertissement qui parle à tort** — il s'apprend à être ignoré, et le
jour où il a raison, on ne le lit plus (`CLAUDE.md` §4 ter).

**On range l'IBAN annoncé, pas un drapeau** (migration 0078). Un « prévenu »
booléen serait resté levé au changement de banque suivant, et ce client-là
n'aurait jamais su où virer. En rangeant l'IBAN, la question se referme
d'elle-même : s'il ne vaut pas celui d'aujourd'hui, il reste à prévenir.

### Le signalement est noté quand il OUVRE le message

Atlas ne voit pas partir un SMS : il ouvre la messagerie, et la suite appartient
à l'artisan. Attendre une preuve qu'on n'aura jamais laisserait l'alerte
réclamer indéfiniment. Ce qu'on note, c'est le geste — et il est honnête de ne
pas prétendre davantage.

---

## 4. LE MUR RENCONTRÉ, ET IL AVAIT RAISON

`trg_facture_immuable` (migration 0018) refuse **toute** écriture sur une facture
émise. C'est ce qui garantit que le relevé de TVA — qui n'est pas une table, mais
un calcul sur les factures émises — ne peut pas diverger de ce qui a été facturé.
La colonne du signalement s'y est heurtée, et c'est ce qu'on attend d'une
protection.

**Il s'ouvre d'une seule colonne** (migration 0079), et la comparaison se fait en
JSON :

```sql
IF (to_jsonb(NEW) - 'iban_signale') IS DISTINCT FROM (to_jsonb(OLD) - 'iban_signale')
```

Écrire « toutes les autres colonnes doivent être égales » à la main aurait donné
une liste, et une liste vieillit : la colonne ajoutée demain n'y serait pas, donc
**silencieusement modifiable** sur une facture émise. Ici, toute colonne future
est protégée sans que personne ait à y penser.

**Une suite le fixe** : « LE TROU FAIT UNE SEULE COLONNE DE LARGE » essaie de
réécrire l'IBAN figé d'une facture émise, et vérifie que le refus vient bien de
ce garde-fou.

**Ce qui a été écarté :** une table à part, sur le modèle de `paiements_facture`
— qui existe justement pour que noter un règlement ne touche pas la facture. Elle
aurait évité de rouvrir le trigger, au prix d'une table, d'une politique
d'isolation, de droits et d'une jointure sur une lecture qui sert déjà deux
écrans. Pour un seul texte que rien ne calcule, la dépense n'était pas juste — et
le garde-fou ci-dessus rend l'ouverture plus étroite que la table ne l'aurait
été.

---

## 5. Les chiffres

| | |
|---|---|
| `typecheck` | vert |
| `lint` | **0 erreur** |
| `verifier:memoire` | vert |
| `test-modalites-paiement` (pur) | **20 / 20**, dont 6 neufs |
| `test-facture-reprend-le-devis-db` (base) | **23 / 23**, dont 8 neufs |
| `test-couches` | aucune remontée de couche |
| `test-pas-de-code-mort` | aucun fichier mort |
| `test-pas-de-pansement` | **aucun pansement : ce lot corrige à la racine** |
| **les trois écrans, regardés** | captures sur de vraies données, à 390 px |

### Ce que les captures ont attrapé, et qu'aucun test ne voyait

Dans l'encart des réglages, la date se coupait en deux — « émise le 8 /
septembre » — parce que le nom, le montant et le bouton se partageaient 390 px.
Réorganisé en deux lignes. **Vu sur l'image, jamais par une suite** : c'est la
cinquième fois dans ce dépôt.

---

## 6. Ce qui reste ouvert

| Quoi | Qui tranche |
|---|---|
| Rien sur cette fonctionnalité | — |
| Les suites d'outillage rouges (port, préchauffage, relance de construction) | une session dédiée à l'atelier |
| Les deux suites de rôles | la session qui a refait l'identité du compte |

**Ce qu'Atlas ne fera pas, et il faut le redire :** réécrire une facture déjà
partie. Le client a le PDF dans son téléphone, et le changer sous ses yeux ferait
mentir la page. Ce qui est proposé, c'est de **prévenir**.
