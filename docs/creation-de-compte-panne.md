# « Je peux toujours pas créer de compte »

**13 septembre 2026.** Ce qui a été trouvé, ce qui a été corrigé, et ce qui
reste ouvert.

---

## Ce que vous avez vu

Après avoir répondu aux seize questions et appuyé sur « Créer mon compte » :

> **Une erreur** — Cette page n'a pas pu s'afficher. Référence : 3285538552

---

## Ce qui se passait

**La panne a été reproduite à l'identique**, ici, dans un vrai navigateur : sur
une base à laquelle il manque une migration, le parcours rend **exactement**
cet écran-là.

| | |
|---|---|
| l'écriture en base échoue | une seule ligne refusée, et tout le reste est annulé |
| l'erreur remonte jusqu'à l'écran | elle y est remplacée par un numéro |
| rien n'est enregistré nulle part | ni vous ni nous ne pouvions savoir pourquoi |

**Le vrai défaut n'était pas la création de compte : c'était le silence.** Le
numéro affiché ne mène à rien, et le journal reste sur votre machine, où
personne ne va le lire.

---

## Ce qui a changé

**1. La panne se dit, en français, à l'écran.** Plus d'écran d'erreur : le
refus s'affiche sous la question, là où s'affiche déjà « Cette adresse a déjà
un compte ».

**2. Quand c'est votre espace qui est en retard sur sa base, c'est écrit :**

> Votre espace n'est pas à jour avec sa base. Rallumez-le depuis
> github.com/codespaces. (base : 23514)

Le geste proposé ne touche **à aucune de vos données** — jamais reconstruire,
jamais supprimer, jamais réamorcer. Le petit code entre parenthèses n'apparaît
que sur votre espace : il nous dit, sur une simple capture, ce que la base a
refusé.

**3. Le parcours est enfin éprouvé de bout en bout.** Une machine répond
désormais aux seize questions dans un vrai navigateur, vérifie que le compte,
l'entreprise et l'essai de quinze jours sont bien écrits, puis retire une
migration pour exiger que la panne soit **dite** et non plus tue.

C'est ce qui manquait : la règle était vérifiée, l'écriture aussi, mais
personne n'avait jamais fait le geste en entier.

---

## Ce qui n'a pas pu être vérifié, et il faut le dire

**Ce qui tombe sur VOTRE machine n'a pas pu être lu.** Le journal de votre
espace n'est publié nulle part, et votre fiche d'état n'avait pas été réécrite
entre 10 h 31 et 18 h 07 — alors que vous utilisiez l'application à 17 h 43.

La cause la plus probable reste une **base en retard sur le code servi** :
votre espace annonçait six versions de retard au moment de votre capture. Il a
redémarré depuis, et il sert maintenant la dernière version.

**Donc : réessayez.** Si l'écran d'erreur revient, envoyez la capture — elle
portera ce que la base a refusé, et il n'y aura plus à chercher.

---

## « Arrête le rafistolage, va à la racine »

Vous avez raison, et c'est ce qui a été fait ensuite. Ce qui précède rendait la
panne **visible** ; ça ne la réparait pas.

**1. Le seul chemin éprouvé était le plus lisse.** Le parcours joué pour
reproduire votre panne remplissait toutes les cases avec des valeurs propres.
En essayant les autres façons de remplir — trente-sept —, un vrai défaut est
sorti : **un capital trop grand faisait tomber la création du compte entière**,
pour une case facultative. La limite de ce que la base peut porter vit
maintenant dans la règle elle-même, celle qui décide pour l'écran comme pour
l'enregistrement.

**2. Votre machine savait, et ne le disait à personne.** Votre fiche d'état
publiait la version du code, jamais l'état de votre base — or les deux sont
indépendants : « tout concorde » peut être vrai pendant qu'il manque deux
migrations, et c'est alors l'enregistrement qui tombe.

**C'est réglé, et pas par nous :** une autre session y travaillait en même
temps et l'a livré le même soir, plus loin que la fiche — jusqu'à l'écran des
**Réglages**, là où vous allez demander « est-ce que j'ai les corrections ? ».
Votre base s'y rattrape aussi à chaque allumage. Ce qui avait été écrit ici en
parallèle a été **jeté** : deux façons de lire une même chose finissent
toujours par se contredire.

---

## Ce qui reste ouvert

| Ce qui manque | Qui |
|---|---|
| ~~rien ne compare votre base au code servi~~ | **fait** — par le lot voisin du même soir : fiche, écran Réglages, et rattrapage à l'allumage |
| la RAISON d'un échec de migration reste dans un journal non publié : on voit le résultat, pas la cause | nous, au prochain lot qui touche l'espace |
| **les autres écrans tombent encore sur « Une erreur »** quand la base refuse. Seule la création de compte parle aujourd'hui | nous, au fil de ce qu'on touche |
| **quinze vérifications sont rouges sur la version en ligne**, sans rapport avec ce lot (fiche client, fiche d'entretien, dictée). Vérifié : elles l'étaient déjà avant | à traiter, lot à part |

---

## Les chiffres

| | |
|---|---|
| types, style, mémoire du dépôt | vert |
| suites base de données | 368 sur 368 |
| suites navigateur | 137 sur 152 — les 15 rouges sont **antérieures à ce lot**, vérifiées sans lui |
| connexion derrière un proxy | vert |
| migration | aucune |
