# Atlas — « Quel diamètre fait la souche ? » : un arbitrage entre deux de ses propres consignes

**30 août 2026, au soir.** Un seul mot changé dans une question posée à
l'utilisateur, et l'essentiel de ce dossier porte sur *pourquoi il ne fallait pas
le changer sans écrire pourquoi*.

---

## 1. Ce qu'il a demandé, mot pour mot

> « Claude, un seul ajustement avant le nouveau test réel. Pour un dessouchage
> dont le diamètre est réellement inconnu, je confirme ma demande la plus
> récente : la question doit être : « Quel diamètre fait la souche ? » et non
> simplement : « Quel diamètre ? » — je préfère cette formulation parce qu'elle
> indique immédiatement de quelle mesure on parle, et évite la confusion
> constatée. Pour un abattage, conserve : « Quel diamètre fait le tronc ? »
> Ne change rien d'autre. Ne touche ni aux règles de détection du diamètre, ni à
> Whisper, ni aux prix, ni à la mémoire, ni à l'architecture. Ajoute uniquement
> le test de non-régression de ces deux formulations. »

---

## 2. Le piège : la formulation qu'il fait retirer venait de lui aussi

C'est le point qui compte, et c'est celui qu'un exécutant aurait manqué.

`main` portait « Quel diamètre ? », sans nommer l'objet. Ce n'était pas une
paresse d'implémentation : **c'était une consigne antérieure du patron**, codée
par une autre session, avec sa raison écrite en commentaire :

> la dictée disait « deux souches », la question en disait une. Accorder au
> nombre supposerait de le compter — un travail de plus pour un mot de moins.

Et une suite de contrôle **défendait activement** cette règle :

```ts
cas("une question ne parle ni au singulier ni au pluriel", () => {
  for (const q of questionsAvantChiffrage(DICTEE_DU_PATRON)) {
    assert.doesNotMatch(q.question, /\b(la souche|le tronc|l'arbre|de haie)\b/i, …);
  }
});
```

Autrement dit : appliquer sa demande du soir **faisait rougir un contrôle écrit
pour tenir sa demande de la veille**. Les deux venaient de lui.

### Ce qui a tranché

Il donne lui-même la raison, et elle est plus forte que la précédente : sur son
téléphone, pendant le test réel, « Quel diamètre ? » **ne disait pas de quoi**.
La ligne de prestation était au-dessus, mais il n'a pas levé les yeux — il a cru
qu'on l'interrogeait sur l'érable d'à côté, qui figurait aussi dans la dictée.

| | ce qu'elle coûte | ce qu'elle gagne |
|---|---|---|
| « Quel diamètre ? » | on ne sait pas de quoi on parle sans lire le titre | s'accorde au pluriel comme au singulier |
| « Quel diamètre fait la souche ? » | un singulier quand il en a dicté deux | se comprend seule |

**Il a choisi la seconde en connaissance du coût.** Le pluriel reste écarté :
accorder au nombre supposerait de le compter, pour un mot.

---

## 3. Le code, verbatim

`src/lib/questions-chiffrage.ts` — une ligne de logique, et vingt de commentaire
qui sont le vrai livrable :

```ts
if (!contientDiametre(ligne) && !diametreDansLaDictee) {
  questions.push({
    id: `${souche ? "dessouchage" : "abattage"}.diametre#${rang}`,
    libellePrestation: libelle,
    // **LA QUESTION NOMME SA MESURE — et c'est LUI qui a tranché entre
    // ses deux décisions, le soir du test téléphone.**
    //
    // ─── L'ARBITRAGE, à ne pas renverser sans lui ────────────────────
    //
    // Deux de ses propres consignes s'opposaient ici, et une session qui
    // n'en connaîtrait qu'une remettrait l'autre :
    //
    // | ce qu'il a demandé | pourquoi | quand |
    // |---|---|---|
    // | « Quel diamètre ? », sans nommer | la dictée disait « deux souches », la question en disait une | d'abord |
    // | « Quel diamètre fait la souche ? » | sur son téléphone, « Quel diamètre ? » sous un titre ne disait pas DE QUOI | **ensuite, et c'est elle qui tient** |
    //
    // **Il a choisi la seconde, en connaissance de la première.**
    question: souche ? "Quel diamètre fait la souche ?" : "Quel diamètre fait le tronc ?",
    options: null,
    unite: "cm",
  });
}
```

Le booléen `souche` n'est pas nouveau : il existait déjà et servait exactement à
ça — ne jamais écrire « tronc » au-dessus d'un dessouchage.

---

## 4. Le contrôle qui s'opposait : réécrit, pas supprimé

Un contrôle qu'on efface ne défend plus rien **et ne dit pas pourquoi il a
disparu**. Celui de `main` a donc été retourné, sa règle d'origine gardée en
toutes lettres à l'intérieur :

```ts
cas("la question du DIAMÈTRE nomme sa mesure ; les autres ne nomment rien", () => {
  // **CE CONTRÔLE A ÉTÉ RENVERSÉ PAR LUI, le soir du test téléphone**, et sa
  // version d'avant est gardée ici en toutes lettres pour qu'on sache ce
  // qu'on remplace :
  //
  //   « une question ne parle ni au singulier ni au pluriel » — parce que la
  //   dictée disait « deux souches » et que la question en disait une.
  //
  // Le coût qu'il accepte est ce singulier ; le reste de la règle tient
  // toujours : aucune AUTRE question ne nomme son objet.
  for (const q of questionsAvantChiffrage(DICTEE_DU_PATRON)) {
    if (q.id.includes("diametre")) {
      assert.match(q.question, /^Quel diamètre fait (la souche|le tronc) \?$/, …);
      continue;
    }
    assert.doesNotMatch(q.question, /\b(la souche|le tronc|l'arbre|de haie)\b/i, …);
  }
});
```

Noter l'exception : **elle est étroite**. Seule la question du diamètre nomme son
objet ; toutes les autres (hauteur de haie, longueur, accès…) restent muettes,
comme il l'avait demandé.

### Les trois contrôles de non-régression ajoutés

1. `LA QUESTION NOMME SA MESURE` — abattage → « le tronc », dessouchage → « la souche », à l'égalité stricte.
2. `le mot « tronc » n'apparaît JAMAIS au-dessus d'un dessouchage` — sur trois libellés (« Dessouchage », « Dessouchage de deux souches », « Rognage de souche »).
3. `le pluriel dicté ne change pas la question — il a accepté ce coût` — une souche et deux souches donnent la même phrase, avec la raison écrite au-dessus.

---

## 5. Ce qui a été mesuré

```
npx tsx scripts/test-questions-chiffrage.ts
✅ Toutes les vérifications passent.        (63 cas)

npx tsc --noEmit                            → 0 erreur
npm run lint                                → 0 error, 16 warnings (préexistants)
npm run verifier:memoire                    → ✅ 8 fichiers, 3 rappels armés
```

Et les trois formulations lues directement à la sortie de la fonction :

```
Dessouchage de deux souches    → « Quel diamètre fait la souche ? »
Dessouchage                    → « Quel diamètre fait la souche ? »
Abattage d'un chêne            → « Quel diamètre fait le tronc ? »
```

**Ce qui n'a PAS été mesuré, et il faut le dire :** la batterie complète
(`npm run verifier:avant-livraison`) ne peut pas être verte sur ce dépôt — voir
§7.

---

## 6. Une date fausse relevée au passage, et non propagée

Les commentaires de ce lot datent le travail du **« 31 août 2026 »**. Les commits
portent le **30**. C'est une erreur introduite plus tôt dans la session, répandue
sur huit fichiers et cinq dossiers.

Elle n'a pas été corrigée partout : cela sortirait du cadre qu'il a fixé
(« ne change rien d'autre ») et toucherait des commentaires écrits par une autre
session. Mais elle n'a pas été **propagée** non plus : les commentaires neufs
s'ancrent sur l'événement — *le test téléphone* — plutôt que sur un jour, et la
divergence est signalée dans le code et dans `CHANGELOG.md`.

C'est la règle du dépôt sur les dossiers : un instantané ne se corrige pas, le
suivant dit noir sur blanc ce que le précédent avait de faux.

---

## 7. Ce qui reste ouvert — et le verrou qui n'est pas de nous

**`test-acces-salarie-e2e` tue le serveur de développement à la deuxième suite
navigateur.** C'est un défaut de `main`, documenté depuis le 29 août, antérieur à
ce lot. Conséquence : les 114 suites suivantes ne se jouent pas, et **aucune
batterie complète ne peut être verte sur ce dépôt** tant qu'il n'est pas réglé.

Ce qui a été mesuré à la place : **les 16 suites navigateur du domaine devis sont
vertes, 16/16.**

Le patron m'a interdit de corriger des défauts sans rapport découverts au passage.
La décision lui revient donc :

- fusionner en l'état — le lot est éprouvé, le verrou existait avant lui ;
- ou traiter d'abord `test-acces-salarie-e2e`, ce qui sort du cadre fixé.

**Et le test qui compte n'a toujours pas eu lieu :** `npm run verifier:chaine-dictee`
avec de vraies clés IA, sur son espace. Cet environnement n'a pas de clé — rien
de ce qui dépend de Whisper ou de la rédaction IA n'est prouvé ici.

---

## 8. Questions pour toi, ChatGPT

1. **Contredis-moi sur le point central.** J'ai réécrit un contrôle existant
   plutôt que de le supprimer, en gardant sa règle abrogée en commentaire à
   l'intérieur. Est-ce que ce n'est pas un contrôle qui ment sur son propre nom —
   il s'appelle « nomme sa mesure » mais contient encore la règle inverse ? Un
   second contrôle séparé serait-il plus honnête ?

2. **Le singulier.** « Quel diamètre fait la souche ? » quand il en a dicté deux :
   il a accepté ce coût, mais est-ce qu'une formulation tient les deux exigences à
   la fois sans compter — par exemple « Diamètre de la souche ? », qui nomme sans
   conjuguer ? Et est-ce que ce serait une amélioration ou une désobéissance à une
   demande explicite ?

3. **L'exception étroite.** Seule la question du diamètre nomme son objet ; les
   autres restent muettes. Est-ce une incohérence qui se paiera au prochain test
   téléphone — « Quelle hauteur ? » posera exactement le même problème — ou est-ce
   que la retenue est bonne tant qu'il ne l'a pas constaté ?

4. **La date.** J'ai choisi d'ancrer les commentaires neufs sur un événement
   (« le test téléphone ») plutôt que de corriger huit fichiers ou d'écrire une
   date que je sais fausse. Trois options, j'ai pris la troisième. Laquelle
   aurais-tu prise, et qu'est-ce que la mienne coûte à six mois ?

5. **Le verrou.** Un lot éprouvé sur son domaine, bloqué par un défaut préexistant
   d'une autre partie de l'application, et une interdiction explicite de corriger
   ce qui est hors cadre. Fusionner ou attendre ?
