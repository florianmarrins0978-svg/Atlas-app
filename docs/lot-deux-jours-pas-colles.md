# Deux jours qui ne se touchent pas — verdict du lot

*18 septembre 2026. Le lot est sur `main` (`f203ac8`).*

---

## Ce qui est dans l'application

Sa question du 17 septembre : *« un chantier de deux jours, je veux lui proposer
le premier jour le 18 et on vient finir le chantier le 22 — comment je
fais ? »* C'était impossible : les deux dates du calendrier étaient deux choix,
et la date retenue devenait un bloc d'un seul tenant.

| Le geste | Ce qu'il fait |
|---|---|
| un appui sur un jour libre | pose le **premier jour**, et le chantier se remplit **d'affilée** derrière |
| un appui sur un jour **du chantier** | l'**efface**, sans rien décaler d'une case ; l'appui suivant le remet où il veut |
| l'interrupteur « Vous proposez deux dates » | ouvre une seconde proposition, en or ; la cliente choisit |
| ce que la cliente lit | les jours du chantier **en toutes lettres**, plus une date de départ seule |

---

## Ce qui a été corrigé en le portant sur `main`

La batterie entière a tourné au vert — **niveau 3**, parce que le lot porte une
migration, le schéma et le devis. Elle a rendu **deux rouges**, tous deux à
traiter :

| Le rouge | Ce que c'était | Ce qui a été fait |
|---|---|---|
| `test-boutons-pleins` | deux aplats neufs non déclarés : l'interrupteur « Vous proposez deux dates » et le chiffre entouré d'un jour proposé | déclarés comme **états** — on ne les appuie pas pour agir |
| `test-poser-une-date-e2e` | le contrôle cherchait son jour d'accueil à **trois jours calendaires** du départ | il demande désormais ses jours au produit (`joursDuBloc`) |

### Le piège du vendredi — et il ne venait pas de ce lot

Parti d'un vendredi, un bloc de quatre demi-journées occupe le vendredi **et le
lundi** — exactement ce que « trois jours calendaires » désigne. Le contrôle
déplaçait donc le chantier **sur lui-même** ; le serveur refusait à juste titre
(« Ce chantier occupe déjà ce moment-là. »), et l'échec accusait « Déplacer ».

**Vert du mardi au jeudi, rouge le vendredi.** Il dormait là depuis un moment et
aurait coûté une batterie sur deux à n'importe quelle session, un jour par
semaine. Corrigé à la racine : le montage n'a plus sa façon à lui de compter les
jours ouvrés.

---

## Ce qui a été dit et qui était faux

Le rapport de la session qui tenait ce lot annonçait que la preuve exigée avant
`main` **ne pouvait pas être obtenue**. C'était vrai de sa machine, pas du lot :

| Ce qu'elle nommait | Ce que c'était |
|---|---|
| Docker s'arrête tout seul | son PC — la batterie a tourné ici sans aucun Docker |
| 19 suites d'outillage rouges | Windows, pas le produit |
| `main` avance pendant la mesure | corrigé le 17 septembre (`ARCHITECTURE.md` §380) |
| la connexion derrière un proxy tombe | son PC saturé — verte ici, en une minute |

Aucun des quatre ne touchait son code, et son code était juste.

---

## Les chiffres

| | |
|---|---|
| niveau calculé sur le diff | **3** — migration `0095`, `src/server/db/schema.ts`, le devis |
| batterie entière | toutes les étapes vertes, connexion derrière un proxy comprise |
| rouges au verdict final | **0** |
| commits portés sur `main` | `2b2f76d`, `5a23330`, `f203ac8` |

---

## Ce qui reste ouvert

**Les 19 suites d'outillage rouges sur son PC Windows** (`TODO.md`). Elles ne
disent rien du produit : elles réclament `bash`, `ps -o`, `gh`, des ports
d'essai — des outils que Windows n'a pas. Aujourd'hui elles rougissent ; elles
devraient **refuser de conclure**, ce qui n'est pas la même chose.

Tant que ce n'est pas fait, chaque lot mesuré depuis son PC paie une demi-heure
à prouver, une par une, qu'elles étaient déjà rouges.

**Qui peut le faire :** une session lancée depuis son espace Windows — pas
depuis un conteneur Linux, où le défaut ne se reproduit pas.
