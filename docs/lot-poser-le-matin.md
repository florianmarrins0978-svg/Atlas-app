# « Matin » posait toute la journée — ce qui a été corrigé, et pourquoi

**Sa panne, le 9 septembre 2026 :** *« lorsque je clique sur le matin pour
Mr. Julien, ça me met d'office toute la journée. »*

---

## Ce que la machine faisait, mesuré avant de toucher au code

Le chantier de Mr. Julien porte « 2 jours ». En demi-journées, cela fait
**quatre**. Voici ce que chaque bouton écrivait, joué sur les fonctions du dépôt
avant toute correction :

| Le bouton | Ce qu'il écrivait | Ce que ça occupait |
|---|---|---|
| Matin | départ matin, 4 demi-journées | jeudi matin + jeudi après-midi + vendredi entier |
| Ap.-m. | départ après-midi, 4 demi-journées | jeudi après-midi + vendredi + lundi matin |
| **Journée** | **départ matin, 4 demi-journées** | **exactement la même chose que « Matin »** |

**Le calcul était juste.** Quatre demi-journées posées à partir du jeudi matin ne
peuvent pas éviter le jeudi après-midi. Ce qui était faux, c'est la **question**
que l'écran posait.

---

## Verdict, point par point

### 1. « Journée » ne servait à rien sur ce chantier — corrigé

Sur un chantier d'une journée ou moins, les trois boutons choisissent
l'**étendue** : « Matin » réserve une demi-journée, « Journée » en réserve deux.
Au-delà, l'étendue vient de la dictée et les boutons ne choisissent plus que le
**départ**. « Journée » écrivait alors le même état que « Matin » : un bouton
mort.

Il ne s'affiche plus dans ce cas.

### 2. La racine : la règle vivait dans un écran sur trois — corrigé

**C'est le vrai défaut, et il explique pourquoi c'est revenu.** Le 23 août, ce
bouton mort avait déjà été signalé — *« cliquer sur Déplacer ne déplace pas le
chantier »* — et retiré. Mais il l'avait été **dans « Déplacer » seulement**, par
une condition écrite au milieu du rendu.

Or trois endroits de l'écran dessinent ces mêmes boutons :

| Où | La règle y était-elle ? |
|---|---|
| « Déplacer », dans la fiche d'un jour | oui |
| la ligne « Sans date » | **non** |
| « + Ajouter un chantier » | **non** |

Il est entré par « Sans date ». La règle vit maintenant dans `src/lib` et les
trois endroits la lisent — un seul texte, plus une copie.

### 3. La ligne ne disait pas que le chantier durait deux jours — corrigé

Sans la durée écrite à côté, « Matin » se lit « une demi-journée ». Elle
s'affiche désormais **quand les boutons ne la choisissent plus**, et seulement
là : l'écrire aussi sur un chantier d'une demi-journée serait du bruit, et un mot
qui parle à tort s'apprend à être ignoré.

### 4. Un second défaut, que personne n'avait signalé — corrigé

Trouvé en cherchant la racine du premier. L'écran lisait la durée **réservée**
— celle qui n'existe qu'une fois le chantier posé. Sur un chantier pas encore
posé, elle est vide : l'écran croyait donc à **une journée** sur un chantier de
deux, au moment précis où il choisit où le mettre. Le serveur, lui, lisait la
dictée. Deux lectures d'une même durée, à deux endroits.

Une seule fonction y répond maintenant, et « Déplacer » la lit aussi : un
chantier posé avant août 2026 n'a pas de durée réservée, et « Matin » le
raccourcissait en silence par cette porte-là.

---

## Ce qui a été REFUSÉ, et ce que ça aurait coûté

**Faire écrire « une demi-journée » à « Matin » sur un chantier de deux jours.**
C'est la lecture littérale de sa demande, et c'est la seule chose qui aurait fait
disparaître le symptôme entièrement.

Ce que ça aurait coûté : **trois demi-journées de travail effacées de son
planning, sans un mot.** Un chantier vendu deux jours serait devenu une
demi-journée dans le calendrier ; la place aurait été rendue disponible pour un
autre client, et le manque ne se serait vu que le jour du chantier.

À la place, l'écran dit la durée au lieu de promettre un découpage qu'il ne sait
pas faire.

---

## Ce qui reste ouvert, et qui peut le trancher

**Couper un chantier en deux morceaux posés à deux endroits** — jeudi matin,
puis lundi. L'application ne sait poser qu'un bloc continu. C'est une
fonctionnalité, pas un correctif, et **c'est lui qui décide** si elle vaut le
coup. Notée dans `TODO.md`.

---

## Ce qui a été retiré (une correction à la racine remplace, elle n'ajoute pas)

- la condition écrite au milieu du rendu de « Déplacer » ;
- les trois libellés écrits en dur dans la ligne « Sans date » ;
- la déduction de durée recopiée dans le dépôt ;
- le filtre recopié dans le contrôle, qui prouvait qu'UNE ligne était juste au
  lieu de prouver que les trois la portaient.

## Les chiffres de la batterie

| Étape | Verdict |
|---|---|
| types, lint | ✅ |
| mémoire du dépôt | ✅ |
| connexion derrière un proxy | ✅ |
| suites base de données | ❌ 2 rouges — **les deux tombent aussi sur `main` sans mes changements** : le rôle commercial et une adresse ajoutée par le lot « travaux supplémentaires », et les deux exemplaires de `conditions-utilisation.html` qui ont divergé au lot « abonnement » |
| suites navigateur | 114/136 — l'essentiel des rouges tient aux **clés IA absentes sur ce poste** (dictée, lecture de ticket, suggestions d'adresse), ce que `CLAUDE.md` §1 ter décrit |

**Les suites du planning, rejouées une par une :**

| Suite | Verdict |
|---|---|
| `test-planning-jour.ts` (règles pures) | ✅ 0 échec |
| `test-creneaux.ts` | ✅ 0 échec |
| `test-planning-e2e.ts` | ✅ 0 échec |
| `test-poser-une-date-e2e.ts` | ✅ 0 échec, **y compris la nouvelle vérification** |
| `test-salarie-planning-lecture-seule-e2e.ts` | ✅ 0 échec |
| `test-ligne-planning-e2e.ts`, `test-pas-la-ce-jour-e2e.ts` | ❌ 1 chacune — **rejouées sur `main` sans mes changements : elles y échouent à l'identique.** Deux mesures de recouvrement d'écran, antérieures à ce lot |

**À corriger noir sur blanc :** pendant la batterie complète,
`test-poser-une-date-e2e.ts` a rougi deux fois sur un clic intercepté par le
tiroir du bas. Rejouée seule, deux fois, avec ce lot : verte. Ce n'est donc pas
ce lot — mais ce n'est pas non plus « rien » : les deux autres rouges du planning
sont exactement du même genre, et ils existent déjà sur `main`. **L'écran du
planning a une fragilité de recouvrement qui n'est pas traitée ici.**

**Le contrôle sait échouer.** Confronté à la version fautive de `poseOfferte`
— celle qui offre les trois boutons quoi qu'il arrive — il rougit sur les deux
lignes qui visent ce défaut, et nomme le bon coupable.
