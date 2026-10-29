# La batterie d'intégration du 28 octobre 2026

Sa demande, la nuit du 28 au 29 : vérifier le prompt d'une session qui
n'arrivait pas à jouer la batterie des planches « pas sur `main` », parce que
*« la batterie s'est coupée deux fois toute seule, bizarrement, ça n'est jamais
arrivé »*, puis *« une fois vert tu peux fusionner, tu es autonome »*.

## Ce que le prompt affirmait, et ce qui était vrai

| Affirmation du prompt | Verdict | Ce qui le fonde |
|---|---|---|
| La branche `claude/integration-planches-28-octobre` existe | **faux ailleurs que chez elle** : jamais poussée, elle n'existait que dans le conteneur de l'autre session | `git ls-remote origin` ; le journal de la session « Dernière correction » ne porte aucun `git push` |
| Terminés n'est pas sur `main` | **faux** : `37b60127` est sur `main` depuis le 25 octobre | `git merge-base --is-ancestor 37b60127 origin/main` |
| Salarié absent C n'est pas sur `main` | **vrai** (`lot/salarie-absent-c`, 1 commit) | |
| Le lot banque, renuméroté 0153 | **vrai** (`claude/banque-lecture-dossier-complet`, 3 commits, migration expand seule) | |
| Points médians et tirets (`3f3071e3`) | **vrai** (`lot/points-et-tirets`) | |
| Payé par (bouts ronds), Vos clients (rond « Tout ») | **codés, mais sur deux branches LOCALES de l'autre session**, jamais poussées : `claude/paye-par-bouts-ronds` (2ceda082), `claude/tout-cocher-au-dessus-de-a` (9ebeb010). Elle refuse de les pousser sans son accord, et elle a raison | son journal ; ma demande du 28 octobre, 23 h 27 |
| Les conflits de documentation gardent la version de `main` | **refait autrement** : les deux côtés sont gardés. Effacer le paragraphe d'un lot laisse son code sans son pourquoi | |
| « Coupée à 30 minutes » | **faux** : voir plus bas | |

## Pourquoi la batterie s'est coupée deux fois

**Ni le délai de 30 minutes, ni « Stop tout », ni la mémoire, ni le disque.**
La session lançait la batterie par `nohup … &` dans une commande ordinaire :
l'outil ne la suivait pas (`tasks: []`). Son tour fini, le conteneur s'est
mis en veille, et la batterie est morte avec lui, au bout de 7 puis 5 minutes.
Le journal le montre : « Allocating sandbox » à 20 h 06, puis un nouveau
démarrage 25 secondes après la dernière ligne de la deuxième batterie.

**Et une troisième cause, que personne n'avait vue** : sur ces postes, toutes
les suites navigateur tombaient. Le dépôt cherche Chromium à
`/opt/pw-browsers/chromium-1194`, qui n'existe plus ici (c'est `chromium-1243`,
lien stable `/opt/pw-browsers/chromium`). Même jouée jusqu'au bout, sa batterie
aurait rendu 88 suites rouges sans aucun défaut du produit.

**Ce qui marche** : une tâche d'arrière-plan suivie par l'outil (2 heures
autorisées), et `PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium
CHROMIUM_PATH=/opt/pw-browsers/chromium`. Trois batteries sont allées au bout
cette nuit ainsi.

## Les défauts que la batterie a trouvés dans les lots

| Défaut | D'où il venait | Correction |
|---|---|---|
| Rejouer une dictée créait un **second arbre** sur le chantier | le lot des tirets a fait passer le libellé enrichi de « base — précisions » à « base (précisions) » ; le rapprochement coupait le dernier caractère pour trouver son préfixe, et ne reconnaissait plus rien, ni le neuf ni l'ancien déjà en base | la source dit elle-même comment commence un libellé enrichi, sous ses deux formes (`debutsDUnLibelleEnrichi`) ; le découpage disparaît. Test rouge puis vert, deux cas |
| Un « bouton carré » dans la piste Salarié absent | c'est la forme de sa planche C : une case transparente sous un curseur à 10 px | exception nommée, bornée à `data-atlas="piste-quand"` ; un autre bouton carré du fichier fait toujours rougir (vérifié) |
| La suite de la grille des prix attendait 45 s | elle cherchait encore l'ancien nom à tirets de la case | la suite suit son nom sans tiret (§5 bis : on ne remet pas le tiret) |

## Les chiffres

| Contrôle | Résultat |
|---|---|
| Types, lint, construction, mémoire du dépôt | verts |
| Suites base de données | **535 / 535** |
| Suites navigateur | **200 / 202** |
| Connexion derrière un proxy | verte |
| Les deux rouges navigateur (`test-poser-une-date-e2e`, `test-le-client-s-est-trompe-e2e`) | **rouges à l'identique sur `main`** (`verifier-rouge-prealable.ts`) : ce lot n'en est pas la cause, la fusion était ouverte. Elles dépendent de la date, en fin de mois (`TODO.md`) |
| La feuille « Salarié absent ? », regardée à 390 px | conforme à la planche C ; la première case dit « Absent » au premier appui ; rien ne déborde |
| **Sur `main`** | **`58cdac65..5d9c8d13`**, le 29 octobre vers 2 h 50 ; le garde-fou l'a laissée passer |

## Ce qui a été dit cette nuit et qui était faux

- J'ai d'abord écrit que la branche d'intégration « n'existait que dans le conteneur de l'autre session » sans savoir si Payé par et Vos clients étaient perdus : ils ne le sont pas, ils attendent sur deux branches locales.
- La première batterie de cette session a été arrêtée exprès à mi-course : ses suites navigateur tombaient toutes faute de Chromium, son verdict ne valait rien. La deuxième a trouvé la suite de la grille des prix ; la troisième, complète, est celle qui a ouvert `main`.

## Ce qui reste, et qui tranche

| | Qui |
|---|---|
| Pousser `claude/paye-par-bouts-ronds` et `claude/tout-cocher-au-dessus-de-a` : écrire « oui, pousse les deux branches » dans la session « Dernière correction » | lui |
| Leur batterie, puis `main` (Payé par touche l'argent : niveau 3) | une session, après |
| Le chemin de Chromium en dur dans le dépôt | un lot d'outillage |
| Les deux suites qui tombent en fin de mois | un lot de décor |
