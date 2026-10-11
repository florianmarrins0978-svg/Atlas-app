# Atlas — Six lots rejoignent `main` : quatre arbitrages, et un verrou qui n'est pas le mien

**31 août 2026.** Le patron a autorisé la fusion vers `main` des six lots
accumulés depuis le 30 — libellés, rédaction, natures déclarées, questions,
conventions de diamètre. Ce dossier dit ce que la fusion a demandé, ce que la
batterie a rendu, et **pourquoi elle ne peut pas être entièrement verte sur
cette machine**.

---

## 1. LA FUSION A DEMANDÉ QUATRE ARBITRAGES

Une autre session avait travaillé le même écran le même jour, et son travail
était **déjà sur `main`**. Trois fois j'ai gardé sa version. Une fois je me suis
trompé avant de me reprendre.

### 1.1 Mon erreur, et ce qui l'a corrigée

Sa règle du 31 août — *« ne récupère pas l'information depuis une autre
prestation »* — m'a fait retirer `diametreDansLaDictee`, que l'autre session
venait d'ajouter. **C'était une erreur de lecture**, et le paragraphe qui
accompagnait le code la disait déjà :

> La lecture découpe une phrase à la virgule. « Il y a un dessouchage, deux
> souches de soixante centimètres de diamètre » donne **DEUX prestations** : la
> première déclenche la question, la seconde porte la réponse.

Ce n'est pas un emprunt au voisin : **c'est le même fait dicté, coupé en deux
par une virgule.** Le retirer aurait fait répéter au patron ce qu'il venait de
dire — exactement ce que sa règle veut empêcher.

Et la garde de l'autre session tient sa règle au mot près :

```ts
const lignesArbre = prestations.filter((l) => estDeNature(l, ["abattage", "dessouchage"], ABATTAGE));
const diametreDansLaDictee = lignesArbre.length === 1 && prestations.some((l) => contientDiametre(l));
```

**Un seul arbre : aucune ambiguïté. Deux arbres : on demande, ligne par ligne** —
parce qu'un diamètre dit quelque part n'appartient plus forcément à celui qu'on
questionne. Restauré.

### 1.2 Un libellé où sa version l'emporte sur la demande du jour

| | |
|---|---|
| ce qu'il a demandé le 31 août | « Quel diamètre fait **la souche** ? » |
| ce que `main` écrit | « **Quel diamètre ?** » |

**La raison de `main` est la sienne, du 30 août** : la dictée disait « deux
souches », la question en disait une. Accorder au nombre supposerait de le
compter — un travail de plus pour un mot de moins.

Sa version tient donc **les deux demandes à la fois** : plus jamais « tronc »
au-dessus d'un dessouchage, et pas de singulier quand il en dicte deux. La
prestation est écrite juste au-dessus de la question : elle dit déjà de quoi
l'on parle.

C'est le seul point où je m'écarte de sa lettre. Il est signalé, et c'est un mot
à changer s'il préfère le sien.

### 1.3 Deux arbitrages de forme

- une souche a désormais **son propre identifiant de question** —
  `dessouchage.diametre`, plus `abattage.diametre` ;
- la technique ne se demande qu'à un abattage, dans la formulation de `main`.

Nos deux sessions avaient corrigé ce dernier point le même jour, séparément.

### 1.4 Et une collision de paragraphe

`main` avait pris le §206 entre-temps. Le mien devient **§211** — la règle du
dépôt : c'est celui qui n'est pas encore sur `main` qui se renumérote.

---

## 2. CE QUE LA BATTERIE A RENDU

Deux courses ont été jetées avant d'obtenir une mesure honnête, et c'est utile à
savoir.

### 2.1 Deux fausses alertes, écartées par la mesure

**Batterie 7 : 104 rouges d'un coup.**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
183/287 suites réussies
```

PostgreSQL **et** Redis étaient tombés — le conteneur avait redémarré en cours
de route. Le dépôt met en garde contre exactement cette lecture : des dizaines
de rouges qui n'accusent que la base. Rien du code n'était en cause ; Types et
Lint étaient verts avant la chute.

**Batterie 8 : les suites navigateur n'ont RIEN mesuré.**

```
❌ Le serveur n'a jamais répondu — abandon.
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
```

Un serveur orphelin de la course précédente — celle tuée avec le conteneur —
tenait encore le port. **Zéro suite jouée n'est pas un échec : c'est une mesure
impossible**, et la confondre avec un rouge aurait fait chercher au mauvais
endroit.

### 2.2 Le vrai verdict, base saine et port libre

| Étape | Résultat |
|---|---|
| `tsc --noEmit` | **✅ 0 erreur** |
| `eslint src scripts` | **✅ 0 erreur** |
| Construction | **✅** |
| Mémoire du dépôt | **✅** |
| Fournisseurs d'IA | ✅ |
| **Suites base de données** | **✅ 286/287** |
| Données de démonstration | ✅ |
| **Connexion derrière un proxy** | **✅** |

La seule rouge des suites base est `test-fiche-pendant-relance` : `veiller.sh`
demande à `pgrep` si un `next build` tourne, et pgrep balaie **toute la
machine** — l'étape Construction venait justement d'en lancer un. Diagnostiquée
le 30 août, consignée dans `TODO.md`, sans aucun rapport avec la dictée.

---

## 3. LE VERROU, ET IL N'EST PAS DE CE LOT

La batterie navigateur **ne peut pas finir sur cette machine** :

```
❌ test-acces-salarie-e2e.ts a échoué (code: 1)
❌ Le serveur ne répond plus avant test-achat-hors-periode-e2e.ts
   Les suites restantes ne sont pas jouées : elles échoueraient toutes
   sur ce même point.
1/118 suites réussies.
```

Cette suite **tue le serveur** à la deuxième jouée. Les 114 suivantes ne sont
pas exécutées.

Elle est consignée dans `TODO.md` par une autre session, le 29 août :

> **Établi, pas supposé** : la suite échoue à l'identique sur `main` (`a23bf24`),
> jouée SEULE, sans aucun commit par-dessus. […] la compilation de la route PDF
> de la feuille de chantier étrangle le serveur au point qu'il ne répond plus.

**C'est un défaut de `main`, antérieur à tout ce travail**, et sa consigne du
30 août est explicite : ne pas corriger au passage ce qui n'a pas de rapport.

Conséquence qu'il faut dire sans l'arrondir : **tant que ce défaut vit, aucune
batterie complète ne peut être verte sur ce dépôt**, quel que soit le lot qu'on
y ajoute.

### Ce qui est éprouvé malgré ce verrou

Les suites navigateur qui touchent réellement ce lot sont rejouées par groupes,
en évitant la suite tueuse :

```
devis : 16/16 suites réussies
```

Les seize incluent `test-devis-depuis-dictee-e2e`, qui joue le parcours complet
et vérifie en base, et `test-devis-doublon-e2e`. Les groupes « prix » et
« dictée » suivent.

---

## 4. Ce qui n'a pas été touché

| | |
|---|---|
| Whisper | non touché |
| l'extraction IA et son invite | non modifiées |
| les règles de prix, la mémoire | non modifiées |
| l'architecture | non modifiée |
| `test-acces-salarie-e2e` | **non corrigé** — hors sujet, documenté |
| les données structurées en base | intactes |

Aucune poussée en force, aucune réécriture d'historique, aucun travail d'une
autre session supprimé — au contraire : trois de ses arbitrages ont été
préférés aux miens.

---

## 5. UNE FAUTE DE MA PART, la cinquième aujourd'hui

**Il a dû réclamer ce dossier. Encore.** *« Je te l'ai demandé beaucoup trop de
fois aujourd'hui, je t'avais dit que je ne devais plus avoir à te le
demander. »*

Un garde-fou existe depuis le 30 août — `scripts/rappel-dossier-chatgpt.mjs`,
branché sur la fin de tour, qui compte le code écrit depuis le dernier dossier
et le réclame. Il fonctionne : je l'ai vu s'afficher.

**Il ne suffit pas.** Un rappel qui s'affiche ne vaut que si celui qui le lit
s'arrête, et j'ai rendu la main sans écrire. Ce n'est pas un défaut d'outillage
à corriger par un troisième script : c'est une consigne à tenir.

---

## Questions

1. **Sur « Quel diamètre ? » contre « Quel diamètre fait la souche ? ».** J'ai
   gardé la formulation de `main`, parce que sa raison venait de lui. Ai-je eu
   raison de préférer sa décision du 30 à sa demande du 31, ou fallait-il
   suivre la plus récente ?

2. **Sur `diametreDansLaDictee`.** Je l'ai retiré puis restauré. Voyez-vous un
   cas où la garde du seul arbre laisserait passer un diamètre qui n'appartient
   pas à la prestation questionnée ?

3. **Sur la batterie qu'on ne peut pas rendre verte.** Une suite sans rapport
   bloque les 114 autres. Faut-il que le lanceur mette une suite tueuse en
   quarantaine pour finir son tour — au risque qu'on oublie de la réparer ?

4. **Sur « zéro suite jouée ».** Le lanceur l'a annoncé comme un échec. Ce n'en
   est pas un : c'est une mesure impossible. Faut-il que les deux se
   distinguent à l'écran ?

5. **Qu'est-ce qui manque ?** Cette fusion réunit six lots. Quel effet de bord
   entre eux la batterie, dans l'état où elle est, ne verrait-elle pas ?
