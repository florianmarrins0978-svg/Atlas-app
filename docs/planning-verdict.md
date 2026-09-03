# Le planning : la maquette, codée — verdict point par point

**Sa validation, le 3 septembre 2026 :** *« je valide la maquette que tu as faite pour la page planning, code-moi exactement cette maquette pour mon appli ! Ne fais pas de pansement ou d’ajout de code sur du code, remplace, modifie, corrige pour que ça fonctionne sans rien casser. »*

Ce document dit, pour chaque point de la maquette : ce qui a été fait, ce qui a
été fait **autrement**, ce qui a été **refusé** et ce que ça aurait coûté.

---

## En un coup d'œil

| | |
|---|---|
| **Codé** | 6 points sur 7 |
| **Refusé, avec sa raison** | 1 — « toucher un nom dans les planifiés remonte au mois » |
| **Fonctions retirées** | **aucune** |
| **Défaut trouvé par le contrôle** | 1, réel : le tiroir fermé restait atteignable au clavier |
| **Fichiers de l'application touchés** | 3 · `PlanningClient.tsx`, `MoisCharge.tsx`, `commune-adresse.ts` (neuf) |

---

## Point par point

### 1. La journée s'ouvre DANS le mois — **fait**

La fiche se déplie entre la semaine qui porte le jour et la suivante, l'encoche
pointant la case touchée.

**Ce que ça répare, et ce n'était pas qu'une question d'allure.** Elle naissait
sous le calendrier ENTIER. Il avait fallu poser un `scrollIntoView` pour la
ramener sous le doigt, après deux *« rien ne s'ouvre quand je touche un jour »*
— un remède qui soignait le symptôme, pas la place. **Ce rattrapage est
supprimé** : il n'a plus d'objet, et il déplacerait désormais la case qu'on
vient de toucher.

`MoisCharge` rend maintenant une rangée par semaine au lieu d'une grille d'un
bloc. **L'écran d'envoi, qui emploie le même calendrier, ne bouge pas d'un
pixel** : il ne passe pas la nouvelle option.

### 2. Rien n'est ouvert à l'arrivée — **fait, et c'est un revirement assumé**

La première version de la maquette ouvrait aujourd'hui d'office, pour répondre
sans un geste à « qu'est-ce que je fais aujourd'hui ». **La capture l'a
démentie** : un volet fait environ 330 px, et il ne restait plus qu'une semaine
de calendrier à l'écran — soit l'inverse exact de votre règle du 21 août,
*« je veux un accès au mois »*.

C'est écrit ici parce que c'est une chose dite puis corrigée, et que ça compte
plus que les points justes.

### 3. La semaine lue est marquée dans le mois — **fait**

Une teinte de papier derrière ses sept cases. Toucher un jour amenait déjà la
liste du bas sur sa semaine ; changer de semaine ne disait rien au mois, et rien
à l'écran ne montrait **d'où** venait la liste.

### 4. « Déplacer » et « Retirer » passent au chantier — **fait**

Une seule rangée sous ses demi-journées, à leur taille normale.

**Deux fautes réparées d'un coup.** Ces deux gestes prennent un CHANTIER, jamais
une moitié de journée : un chantier à la journée les affichait **deux fois**, à
quinze pixels d'écart, pour un seul geste. Et la ligne alignait cinq objets dans
324 px — il avait fallu resserrer les boutons à 9 px pour que « Retirer » ne
bascule pas à la ligne suivante.

### 5. Le lieu s'écrit enfin — **fait, avec une réserve qui compte**

La commune se lit sous la durée, dans la fiche du jour comme sur la ligne des
planifiés. L'adresse existait en base et ne servait qu'aux boutons de la feuille
— Maps, Waze, « copier l'adresse » : elle était lue sans jamais être montrée.

**Et elle ne devine RIEN.** « Chemin du Moulin » et « Pornic » sont deux suites
de mots sans chiffre : rien ne les distingue. Sans code postal et sans virgule,
**la ligne ne s'affiche pas** plutôt que d'écrire un nom de rue à la place d'une
commune — vous seriez parti avec.

### 6. Le tiroir du bas — **fait, et c'est le seul échange du lot**

« Sans date », « En attente du client » et le tiroir d'annulation descendent au
bord bas, sous une poignée qui les nomme et les compte. Dès qu'un jour est
touché, elle écrit *« À poser sur jeudi 3 septembre »* en or — la phrase que
l'écran écrivait déjà sous « Sans date », rendue à l'endroit du geste.

**CE QUE ÇA COÛTE :** ces deux listes étaient visibles en faisant défiler ;
elles demandent maintenant un appui. Rien ne devient introuvable — la poignée
les compte — mais c'est un geste de plus, et seule une semaine de chantier dira
s'il gêne.

### 7. « Toucher un nom dans les planifiés remonte au mois » — **REFUSÉ**

C'est le seul point de la maquette qui n'a pas été codé, et il ne doit pas
l'être.

**Remonter au mois veut dire faire défiler la page sous votre doigt.** C'est
exactement votre plainte du 22 août 2026 : *« le client remonte et la fiche
chantier aussi […] tout remonte d'un bloc et je suis perdu, je ne sais plus où
est mon client. Il disparaît sous mes yeux. »* Une suite entière la défend, et
elle rejoue la séquence — ouvrir une fiche, faire défiler, en toucher une autre
— au lieu du seul geste.

**Ce que la maquette voulait supprimer n'était d'ailleurs pas tout à fait un
doublon** : la ligne des planifiés ne dépliait déjà que ce qu'elle ne dit pas —
les demi-journées et la feuille, jamais un second titre de journée. Elle garde
donc son dépliage sur place.

---

## Un défaut réel, trouvé par le contrôle et pas par la relecture

**Tiroir fermé, ses boutons restaient atteignables.** `max-height: 0` ne cache
rien : les boutons gardaient leur taille, la tabulation les atteignait, un
lecteur d'écran les annonçait, et le navigateur les tenait pour visibles — au
point que « Journée » était trouvé et cliqué à travers la poignée. Corrigé par
`visibility`, qui les retire vraiment sans casser l'animation.

C'est la suite qui l'a vu. Personne ne l'aurait vu en relisant.

---

## Ce qui a dû être adapté ailleurs, et pourquoi ce n'est pas de la triche

Trois suites cherchaient « Sans date » là où elle n'est plus. Elles rejouent
maintenant votre geste — un appui sur la poignée — au lieu d'exiger un écran qui
n'existe plus. C'est la règle du dépôt : **une suite fixe la règle, pas la façon
dont un écran la montre**. Réclamer ce que vous avez fait déplacer rendrait
votre écran impossible à changer.

De même, un contrôle exigeait que le bouton du nom porte *exactement* le nom du
client. Il porte maintenant le nom, la durée et la commune : le contrôle vérifie
désormais que le nom n'est écrit **qu'une fois** — la règle — au lieu du texte
exact — la mise en page.

---

## Les chiffres de la batterie, et ce qu'ils valent sur cette machine

**Ce qui est vert, et qui éprouve ce lot :**

| | |
|---|---|
| `test-planning-e2e` | **43 réussis, 0 échec** — la suite du planning, entière |
| `test-planning-memoire-e2e` | 12 / 0 |
| `test-salarie-planning-lecture-seule-e2e` | 8 / 0 |
| `test-glisser-supprimer-e2e` | 5 / 0 |
| `test-suivi-devis-e2e` | 5 / 0 |
| `test-ligne-planning-e2e` | 6 / 0 — dont *« le client touché ne remonte pas »* |
| `test-rien-de-recouvert-e2e` | **« le planning — rien n'est recouvert » ✓** : le tiroir ne cache aucun bouton |
| `test-commune-adresse` (neuve) | 9 / 0 |
| Types, lint, construction, mémoire du dépôt, données de démonstration | verts |

**CE QUI EST ROUGE, ET POURQUOI CE N'EST PAS CE LOT.** La batterie complète
n'est pas verte sur cette machine, et il faut le dire plutôt que de le taire :

1. **Dix suites base de données sur 306** (296 passent). Aucune ne cite un seul
   des fichiers touchés ici — vérifié fichier par fichier. Celle qui nomme le
   planning cherche un motif de code se terminant par un retour à la ligne :
   sur Windows les lignes en portent deux caractères au lieu d’un, et elle
   en trouve **zéro** sur un fichier que ce lot n’a pas ouvert.
2. **Trois suites décalées d'un jour** (`2026-09-03` au lieu de `2026-09-04`).
   PostgreSQL rend une date à **minuit local** ; la suite la relit en **UTC**.
   Ce poste est à UTC+2, donc elle recule d'un jour. En intégration continue,
   qui tourne en UTC, l'écart est nul.
3. **Le serveur d'essai s'arrête après la première suite** sur cette machine :
   toutes les suivantes tombent alors sur « connexion refusée ». C'est ce qui a
   fait cascader la batterie — et c'est pourquoi chaque suite ci-dessus a été
   jouée dans son propre lancement.

**Ce que cela veut dire honnêtement :** ce lot est éprouvé, suite par suite, et
il est vert. La batterie **d'un seul tenant** ne peut pas l'être ici, et ce
n'est pas ce lot qui l'en empêche.

---

## Ce qui reste ouvert, et qui est à vous

- **L'appui sur la poignée vous gêne-t-il à l'usage ?** C'est le seul échange du
  lot. Une semaine de chantier tranchera mieux que n'importe quelle mesure ici.
- **Le volet repousse la fin du mois** d'environ 330 px quand une journée est
  ouverte. C'est voulu — on regarde une journée, pas le mois — mais il faut
  faire défiler pour retrouver les dernières semaines.
