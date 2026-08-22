# Règles permanentes du dépôt

Ce fichier est lu au début de **chaque** conversation. Ce qui n'y figure pas —
ou dans les documents qu'il désigne — n'existe pas : aucune décision ne doit
reposer sur le souvenir d'un échange précédent.

@AGENTS.md

---

## 1. Reprendre le travail : la première chose à faire

Avant d'écrire une ligne de code dans une nouvelle conversation, dans cet ordre :

1. **Lire** `HANDOVER.md`, `PROJECT_STATE.md`, `TODO.md`, `ARCHITECTURE.md`.
2. **Lire** `docs/AGENT.md` (le produit), `docs/A-FAIRE.md` (ce qui bloque) et
   `docs/QUESTIONS.md` (ce qui a déjà été tranché, et pourquoi).
3. **Regarder le dépôt lui-même** : `git log --oneline -20`, `git status`,
   `ls drizzle/` pour la dernière migration appliquée.
4. **Confronter les deux.** Si la documentation et le code divergent, le **code
   fait foi** — et la documentation se corrige immédiatement, avant toute autre
   chose. Une documentation périmée est pire qu'absente : on s'y fie encore.

Ne jamais demander au patron de rappeler ce qui a été fait. C'est le rôle de ces
fichiers, et leur défaillance est une défaillance du dépôt, pas de sa mémoire.

## 1 bis. « Ça ne marche pas » : REGARDER sa machine avant de lui parler

**Règle née de la nuit du 11 au 12 août 2026, et elle vaut pour toutes les
sessions.** Le patron écrit *« ça ne marche pas »*. Quatre allers-retours ont
suivi, à formuler des hypothèses sur une machine qu'on ne voyait pas — un
service de transcription absent, une mauvaise branche, un mot de passe : **toutes
fausses**. Pendant ce temps, sa machine savait tout, et c'est lui qui recopiait
des terminaux depuis un téléphone.

Son espace **publie désormais son état** sur une fiche GitHub au titre fixe —
`TITRE_FICHE` dans `scripts/rapporter-espace.mjs` —, réécrite à l'allumage puis
tous les quarts d'heure par le veilleur. Elle porte le commit récupéré, le
commit réellement **servi** (ce n'est pas le même, et ce malentendu a coûté deux
heures), l'état des services et la fin du journal de démarrage.

**Devant une plainte de ce genre, dans cet ordre :**

1. **lire la fiche** — sa date d'abord, et elle tranche à elle seule : le
   veilleur la réécrit **tous les quarts d'heure** tant que l'espace tourne.
   Plus de vingt minutes sans réécriture, ce n'est pas le serveur qui est en
   panne, c'est **l'espace qui est arrêté** — inutile de chercher dans le
   produit, il n'y a plus personne pour le servir. Et lire **à quel moment**
   elle a été écrite : « à l'allumage », un serveur muet est normal ; « par le
   veilleur », c'est une vraie panne ;

   **Cette règle a été FAUSSE du 12 au 16 août 2026, et elle a coûté une
   soirée.** La publication vivait au bas de la boucle de surveillance — une
   boucle qui cesse d'avancer dès qu'elle appelle `npm run banc`, lequel ne rend
   la main qu'à la mort du serveur suivant. La fiche se figeait donc **à
   l'instant précis où le veilleur se mettait au travail**, c'est-à-dire au seul
   moment où l'on a besoin de la lire, et sa propre règle envoyait alors
   rallumer une machine qui tournait. Corrigé le 16 août : la publication vit
   dans un processus séparé, que rien de la surveillance ne peut endormir
   (`scripts/test-fiche-pendant-relance.ts`, qui sait rougir contre l'ancienne
   version). **Conséquence pratique tant qu'un espace n'a pas redémarré depuis :
   il porte encore l'ancien veilleur, et sa fiche peut mentir. Devant une fiche
   figée, regarder d'abord si le commit qu'elle annonce est antérieur à cette
   correction ;**
2. n'avancer une hypothèse qu'ensuite, et la dire comme telle ;
3. si un geste sur sa machine est nécessaire, lui faire lancer **`claude`** dans
   son espace plutôt que de lui dicter dix commandes. L'agent y a accès, pas
   nous.

**Cette consigne ne dépend plus de la mémoire de personne.** Elle se lisait au
début d'une conversation et s'oubliait au bout de trois heures — or c'est au
bout de trois heures qu'il signale une panne. `.claude/settings.json` branche
donc `scripts/rappel-panne.mjs` sur chaque message reçu : dès qu'une tournure
comme « ça ne marche pas » apparaît, le rappel ci-dessus est remis sous les yeux
de la session, **quelle qu'elle soit** — il en fait tourner trois ou quatre en
parallèle, et aucune n'a lu les autres.

Le déclencheur **n'interdit rien et ne bloque rien** : il ajoute du contexte.
Devant le moindre doute il se tait, et c'est délibéré : un rappel qui parle à
tort s'apprend à être ignoré, et l'on perd alors le garde-fou sans s'en
apercevoir. Ses tournures sont relevées de ses vrais messages, jamais inventées
(`scripts/test-rappel-panne.ts`).

**Ce qui est refusé, et ne doit pas être rouvert :** donner à une session le
pouvoir d'exécuter des commandes chez lui. Une boucle qui lirait des ordres dans
le dépôt serait une porte dérobée sur une machine qui porte ses identifiants
GitHub et ses clés d'IA. Le canal est à sens unique — il publie, on lit.

## 1 ter. L'IA EST BRANCHÉE CHEZ LUI — ne plus jamais dire le contraire

**Sa consigne du 21 août 2026, et il a fallu qu'il la répète :** *« il y a une
clé IA, il y a Anthropic, elles sont connectées, les deux clés. Enregistre-le
vraiment dans le dossier, histoire que quand j'ouvre une nouvelle session, tu
sois au courant que la clé Anthropic est active et que tu t'en sers déjà pour
faire beaucoup de choses, notamment pour l'arrosage automatique, analyser la
photo. »*

**Ce qu'il faut tenir pour acquis, dès la première minute d'une session :**

| | |
|---|---|
| **Son espace de travail** | Les clés sont posées. L'IA tourne pour de bon : la dictée est transcrite, les devis rédigés, les photos regardées (arrosage, diagnostic végétal, ticket de caisse) |
| **L'environnement de l'agent** | Aucune clé, et le mandataire refuse les fournisseurs. C'est CE poste-ci qui est démuni, pas le produit |

**La faute à ne plus commettre.** Dire « ce n'est pas possible, il n'y a pas de
clé », ou livrer un travail en le présentant comme non éprouvable : c'est
confondre *cette machine* avec *la sienne*. Le 20 août il a déjà dû corriger la
même erreur d'un autre bord — *« tu peux le faire, il y a déjà l'IA dans
l'application »* (§5 ter). La formule juste n'est jamais « impossible », c'est :
**« pas vérifiable ICI ; à jouer sur ton espace »**, avec la commande.

**Comment le VÉRIFIER plutôt que le supposer**, quand la question compte :

```bash
npm run verifier:ia            # sur son espace : dit quels fournisseurs répondent
npm run verifier:ia -- --reseau   # et les appelle vraiment
```

L'écran **Réglages** dit la même chose sans terminal, et c'est ce qu'on lui
demande en cas de doute — une capture, pas une commande.

**Ce qui NE change pas pour autant.** Un contrôle joué ici sans clé ne prouve
rien de la rédaction ni de la lecture d'image : ce qui en dépend se vérifie sur
son espace (`npm run verifier:dictee` en est l'exemple, et il refuse de rendre
un vert sans clé). Et la batterie de livraison coupe délibérément les clés
(`SANS_CLES_IA` dans `verifier-avant-livraison.ts`) : une batterie jouée chez lui
ne doit pas envoyer ses dictées d'essai chez le fournisseur, ni les lui faire
payer.

## 2. Tenir la mémoire à jour, sans qu'on le demande

Après **chaque lot de travail important** — une fonctionnalité, une migration,
une décision d'architecture, un défaut corrigé qui apprend quelque chose — mettre
à jour les fichiers concernés **dans le même commit que le code**. Séparer les
deux, c'est produire une documentation qui décrit une version qui n'existe plus.

| Fichier | Ce qu'il porte | Quand le toucher |
|---|---|---|
| `CLAUDE.md` | Règles permanentes, conventions, contraintes | Quand une règle de travail change |
| `PROJECT_STATE.md` | Ce qui est fait, en cours, restant | Après chaque lot |
| `ARCHITECTURE.md` | Décisions structurantes **et leur pourquoi** | Quand une décision est prise ou révisée |
| `HANDOVER.md` | De quoi reprendre le travail à froid | Après chaque lot |
| `CHANGELOG.md` | Historique des changements qui comptent | Après chaque lot |
| `TODO.md` | Prochaines tâches, par priorité | Dès qu'une tâche naît ou meurt |

**Règle du transfert.** Si une information est apparue dans la conversation et
n'existe nulle part dans le dépôt, elle est écrite **avant** de poursuivre. Le
critère n'est pas « est-ce intéressant » mais : *une nouvelle conversation
prendrait-elle une mauvaise décision faute de le savoir ?*

Deux documents échappent à cette automaticité, et c'est délibéré :
`docs/QUESTIONS.md` et `docs/A-FAIRE.md` sont **tenus pour le patron**, dans son
langage. Rien n'y entre sans son accord explicite (voir `AGENTS.md`).

## 3. Comment on écrit le code ici

- **Le français partout** : noms de fonctions, de variables, de tables,
  commentaires, messages d'erreur, libellés. Un `withEntreprise`, pas un
  `withCompany`. C'est cohérent de bout en bout, y compris en base.
- **Les commentaires disent pourquoi, jamais quoi.** Un commentaire qui
  paraphrase la ligne suivante est du bruit. Un commentaire qui explique le
  piège évité, ou la solution écartée, vaut une heure de relecture.
- **Aucune fonction de dépôt n'appelle `db` directement.** Tout passe par
  `withEntreprise(utilisateurId, entrepriseId, fn)` — c'est ce qui pose le
  contexte d'isolation. Une requête hors de ce cadre ne renvoie rien,
  *silencieusement*.
- **Les règles métier vivent dans des fonctions pures**, dans `src/lib/`,
  testables sans base. Un écran ne décide de rien : il affiche le résultat.
- **Jamais de règle dupliquée entre l'affichage et la vérification.** La même
  fonction sert à construire un écran et à revalider ce qu'il renvoie — deux
  implémentations finissent toujours par diverger.

## 3 ter. Lui répondre court

**Sa consigne du 14 août 2026, en un mot : « Moins ».** Elle est arrivée après
une réponse de trente lignes qui expliquait un retrait de code.

Il lit sur un téléphone, souvent entre deux chantiers. Ce qu'il veut savoir :
**ce qui est fait, ce qui reste, ce qu'il doit décider.** Le raisonnement, les
précautions et les raisons vont dans le dépôt — c'est à cela qu'il sert.

Quelques lignes suffisent. Un tableau vaut mieux qu'un paragraphe. Une capture
vaut mieux qu'une description. S'il veut le détail, il le demande.

**Durci le 16 août 2026, et il faut l'entendre littéralement :** *« fais ce
qu'il faut pour que ça fonctionne sans m'expliquer parce que je comprends
rien »*. C'était après une soirée de panne où chaque message lui détaillait le
mécanisme — verrous, motifs de `pkill`, processus orphelins.

**Ce que cela veut dire, concrètement :**

- devant une panne, **réparer et dire ce qu'il doit faire**, rien d'autre. Une
  ligne : « c'est poussé, redémarre ton espace » ;
- **aucun mécanisme** dans la réponse. Ni cause, ni tableau de diagnostic, ni
  ce qu'on a écarté. Tout cela va dans `CHANGELOG.md` et `ARCHITECTURE.md`, qui
  existent précisément pour ça ;
- **ne pas lui faire porter le diagnostic.** Lui demander de coller une commande
  est un aveu d'échec, pas une étape — la fiche existe pour éviter ça ;
- il redemandera s'il veut savoir. Il l'a déjà fait, et il le refera.

Ce n'est pas de l'incompétence de sa part : c'est un artisan qui veut une
application qui marche. Lui expliquer un verrou de compilation, c'est lui faire
payer une seconde fois une panne qu'il subit déjà.

## 3 bis. La maquette d'abord, le code ensuite

**Règle posée par le patron le 11 août 2026**, après qu'une demande de geste
— « une pastille qui tourne » — a été portée d'un coup dans la maquette **et**
dans l'application : *« crée-moi une maquette avant de changer quoi que ce
soit »*.

Une demande d'apparence ou de geste se dessine, se montre, et **ne touche à
`src/` qu'une fois choisie**. Ce n'est pas une précaution de style : le code
écrit avant l'accord doit être défait si l'accord ne vient pas, et il encombre
la relecture de tout ce qui n'a pas été retenu. La maquette, elle, reste — même
écartée, elle raconte le chemin.

Ce qui ne compte PAS comme une exception : « c'est tout petit », « ça se
défait facilement », « il pourra ainsi l'essayer en vrai ». S'il veut l'essayer
en vrai, il le dira.

**Et une maquette qu'il doit REGARDER vit dans `appli/`, jamais seulement dans
`docs/maquettes/`.** Trouvé le 19 août 2026 : `.github/workflows/pages.yml` ne
publie **que** le dossier `appli/`. Une planche laissée dans `docs/maquettes/`
n'a donc aucune adresse — il ne peut pas l'ouvrir depuis son téléphone, et l'on
attend une réponse qu'il n'a pas les moyens de donner. *(La planche 81, posée le
17 août et toujours sans réponse, est dans ce cas : à vérifier avant de conclure
qu'il ne s'est pas prononcé.)*

Concrètement, pour toute planche dont on attend un choix :

1. le fichier va dans **`appli/`** ;
2. un lien l'ajoute à **`appli/essais.html`** — c'est l'adresse qu'on lui donne ;
3. son nom entre dans la **liste vérifiée en ligne** de `pages.yml`, sans quoi
   rien ne prouve qu'elle répond ;
4. `docs/maquettes/index.html` la référence par `../../appli/…`, comme les
   autres essayables.

## 4. Ce qu'on ne fait jamais

- **Affaiblir la RLS pour se simplifier la vie.** Une opération de maintenance
  qui n'a pas de contexte d'entreprise passe par une file de travail portant
  l'entreprise concernée (voir `audios_a_purger`), jamais par un contournement.
- **Inventer un prix, une donnée client, une prestation.** Voir `docs/AGENT.md`
  §3 : un champ sans source fiable reste vide et signalé.
- **Envoyer, valider ou facturer sans un geste du patron.** Les arrêts du
  parcours sont décidés, pas optionnels.
- **Marquer une tâche terminée sans l'avoir vérifiée.** Voir §5.

## 4 bis. Tout schéma d'arrosage obéit à sa planche du 17 août

Règle posée le 21 août 2026, et qu'il veut **valable partout** : *« sers-t'en
pour tous les schémas, il fonctionnera partout, ça doit être la règle »*.

**Tout part de la nourrice.** *« Règle indiscutable ! »* Un plan où l'on voit le
compteur et des traits qui commencent dans le vide n'est pas un plan : il ne se
pose pas sur le terrain. La nourrice se **dessine**, avec ses vannes, et chaque
ligne en part.

**CE QU'ON MINIMISE, C'EST LA TRANCHÉE — PAS LE TUYAU.** Sa règle du 21 août,
et elle prime sur tout le reste du tracé : *« le trait jaune, c'est une tranchée.
C'est une équipe qui va devoir creuser la terre. Donc l'idée, c'est de faire le
moins de tranchée possible. Si on peut réutiliser une tranchée déjà faite et
juste faire une petite antenne — un mètre par exemple — pour aller chercher
l'arroseur, c'est moins éprouvant que de faire tout le tour. »*

**Deux tuyaux qui suivent le même chemin n'occupent qu'UNE tranchée.** Le mètre
de tuyau se paie une fois ; le mètre de tranchée se paie en heures d'homme, et
en gazon rouvert. Un réseau a donc raison de **rallonger son tuyau** pour rester
dans une saignée déjà ouverte.

Ce qu'il faut chercher, dans cet ordre :

1. une **tranchée principale** que plusieurs réseaux empruntent ;
2. des **antennes courtes** qui s'y greffent pour desservir un arroseur isolé ;
3. jamais un contournement complet quand un mètre d'antenne suffit.

**On CHERCHE les deux économies à la fois** — le tuyau et la tranchée. *« Il faut
combiner économie de ml de tuyau et réutiliser une tranchée. »* Et quand les deux
solutions se valent : **la tranchée l'emporte**, *« car c'est moins fatigant »*.
Un mètre de tuyau se pose ; un mètre de tranchée se creuse, se remblaie, et se
voit encore dans le gazon l'été suivant.

**ON TRAVERSE LE MOINS POSSIBLE LE JARDIN DANS SA LARGEUR.** Sa règle du
21 août : *« beaucoup de choses enterrées — pour le réseau jaune j'aurais fait le
tour et non traversé »*. Ce n'est pas une question de mètres mais de **risque** :
au milieu d'un terrain passent des gaines, des drains, une fosse, des racines
qu'on ne verra qu'à la pelle. Le tour se rebouche ; la traversée se retrouve.

On ne rentre donc dans le jardin **que** pour aller chercher un arroseur qui s'y
trouve, et par le plus court. Cela se mesure : le linéaire de tranchée à plus de
2 m d'un bord ne doit pas dépasser ce qu'exigent les arroseurs intérieurs.

Cela se mesure : la tranchée est l'**union** des tracés — ce qui se superpose ne
compte qu'une fois — et se compare à l'arbre couvrant minimal de la nourrice et
des arroseurs, en distance de Manhattan (un tuyau suit les axes). Sur son plan
du 21 août, à longueur de tuyau **égale** (76 ml), faire remonter le troisième
réseau par le bord haut déjà creusé a économisé **10 m de tranchée** — 74 → 64.

**Un tracé ne doit pas revenir sur lui-même** pour rattraper un arroseur déjà
dépassé : mieux vaut un té de jonction et deux branches courtes. Mais ce défaut-
là se juge largement, car rallonger un tuyau pour suivre une tranchée est un bon
calcul, pas un détour.

**Une antenne part du RÉSEAU, pas de la nourrice.** Seul le réseau part du
regard ; ses antennes se greffent sur un point qu'il dessert déjà.

**Les raccords se comptent par POSITION, jamais par arroseur** — sa planche du
17 août, écrite dans `appli/arrosage-catalogue.js` :

| Position sur la ligne | La pièce |
|---|---|
| départ, milieu | Té 90° taraudé 25×3/4"×25 |
| **fin de ligne** | Coude 90° taraudé 25×3/4" |
| jonction sans arroseur | Té 25×25×25, non taraudé |

**D'où le contrôle qui vaut pour tout schéma : `tés + coudes = arroseurs`**, et
`coudes = nombre de lignes`.

**ET IL S'APPLIQUE À CHAQUE RÉSEAU, UN PAR UN — jamais au total.** Sa règle du
21 août : *« il faut que tu l'appliques pour chaque réseau que tu crées »*. Une
vérification faite sur la somme laisse passer exactement ce qu'elle prétend
attraper : un réseau en excès et un autre en manque se **compensent**, le total
tombe juste, et c'est sur le terrain qu'on découvre qu'une voie n'a pas de quoi
raccorder son dernier arroseur.

Le gabarit, à dérouler pour **chaque** réseau créé :

| Ce qu'on compte | Comment |
|---|---|
| arroseurs | ce que le réseau dessert |
| coudes taraudés | **une fin par ligne** du réseau |
| tés taraudés | arroseurs − coudes |
| tés de jonction | les ramifications, qui n'arrosent rien |
| SBE | **2 × arroseurs** : 3/4" en bas, diamètre du corps en haut |
| PEBD Ø16 | 2 m par arroseur |
| PE Ø25 | mesuré sur le tracé, comparé au plus court |

Et ce que le réseau **annonce** doit être ce que le plan **dessine** : si les
deux divergent, l'un des deux ment et rien ne dit lequel au moment de commander. En dessous, des arroseurs ne sont raccordés à rien.
C'est lui qui l'a relevé, au chiffre près, sur un plan qui paraissait juste :
*« il y a quatre arroseurs qui ne sont pas alimentés »*. Aucun test ne le voyait,
parce qu'aucun ne comparait la liste des pièces au tracé.

Et **deux SBE par arroseur** : celui du bas toujours en 3/4" (sur le té ou le
coude), celui du corps au diamètre de la famille — 3/4" turbine, 1/2" tuyère.

**LE PLAN DIT QUEL ARROSEUR, OÙ, ET POURQUOI.** *« Sur le plan, tu dois savoir
me dire où sont les tuyères et pourquoi, et quelle buse tu utilises — pareil pour
les 5004. Il faut que l'utilisateur, en regardant son plan, sache tout de suite
où les réseaux passent, quels arroseurs à quel endroit, et pourquoi. »*

Un plan qui ne montre que des points ne se pose pas : sur le terrain, on ne sait
pas lequel visser où. Donc **la forme porte la famille** (rond : turbine ; carré :
tuyère), le remplissage porte la position sur la ligne, et la légende nomme la
**buse** — « 12-VAN », pas « une tuyère » : on ne commande pas avec le second.

Et le **pourquoi** s'écrit, parce qu'un choix qu'on ne comprend pas se refait au
hasard le chantier suivant. Exemple, sur son plan : une bande de 4 m de large
reçoit des tuyères, jamais des turbines — une portée de 6 m y arroserait 2 m
au-delà de la limite, chez le voisin ou sur l'allée.

**UNE LÉGENDE MONTRE, ELLE NE DÉCRIT PAS.** Sa remarque du 21 août : *« on ne
sait pas vraiment à quel endroit tu veux utiliser un coude taraudé, à quel
endroit un té égal ou un té taraudé. Là où tu as marqué plein, à côté tu peux
mettre un rond plein. »* Le symbole se **dessine** à côté du mot, et c'est celui
qui est sur le plan — un « ● » écrit en toutes lettres ne rend ni la nuance
plein/creux, ni la forme.

Et chaque symbole **nomme la pièce** qu'il implique : plein → té taraudé ; creux
→ coude taraudé ; losange → té égal. Sans cela on lit le plan sans savoir quoi
visser. **Toute pièce facturée se voit quelque part sur le plan** — une pièce
commandée qu'on ne sait pas où poser ne sert à rien.

**Ce qui est une règle POUR NOUS ne va pas à l'écran.** *« La phrase sur la
tranchée creusée une fois, tu peux la supprimer. Il faut juste que ça soit une
règle que toi tu conserves, mais l'utilisateur n'a pas besoin de voir ça. »* Nos
raisons de conception restent ici ; l'écran ne porte que ce dont il a besoin pour
poser le chantier.

**RIEN NE SE RÉSUME EN UNE LIGNE SI ÇA SE POSE EN DIX PIÈCES.** Sa question du
21 août : *« où sont les pièces pour la nourrice 3 voies ? »* Elle tenait en
trois lignes — 3 électrovannes, 1 regard, 1 programmateur — qui ne se montent
pas : il manquait la clarinette qui relie les vannes, les unions qui permettent
de démonter, les raccords d'entrée, la vanne de purge pour l'hivernage. **Tout
était déjà relevé** dans `CATALOGUE.nourrices[3]` — un ensemble décrit au
catalogue se recopie, il ne se résume pas.

**Et un récapitulatif se RECALCULE, il ne se recopie pas.** Un écran portait
« 8 tés, 5 coudes » au tableau et « 9 tés + 4 coudes » dans la phrase en dessous :
la phrase, écrite en dur, disait vrai la veille. C'est le pire des cas, parce
qu'on la relit sans méfiance. Deux chiffres qui se contredisent dans le même
écran, c'est toute la liste qu'on cesse de croire.

**Chaque quantité doit pouvoir se RECOMPOSER à la main.** Sa question du
21 août — *« je ne comprends pas d'où sortent tes vingt-deux coudes SBE, ça
correspond à quoi ? »* — portait sur un chiffre JUSTE. Le défaut n'était pas le
calcul mais la ligne : « 22 u Coude SBE 075 » ne dit pas à quoi ils servent. On
recompte, on n'y arrive pas, et c'est toute la liste dont on doute. Une pièce
qui sert à deux endroits se écrit donc en **deux lignes**, chacune nommant sa
position.

## 5. Vérifier : ce qui compte comme « fait »

Rien n'est terminé sans **la batterie complète**, en une commande :

```bash
npm run verifier:avant-livraison
```

Elle enchaîne, dans cet ordre — les contrôles rapides d'abord :

| Étape | Ce qu'elle attrape |
|---|---|
| `typecheck`, `lint` | un appel qui ne correspond plus à sa signature |
| `verifier:memoire` | une documentation qui décrit une version disparue |
| `npm test` | isolation entre entreprises, règles métier, RLS |
| `npm run test:e2e` | le parcours complet, du devis à la facture |
| `verifier:connexion` | **« Invalid Server Actions request. »** |

Elle ne s'arrête pas à la première erreur : savoir que trois choses cassent, et
lesquelles, vaut mieux que de les découvrir une par une.

**Ne jamais la faire passer par `tail`.** Elle écrit son verdict à la fin, mais
le nom de la suite tombée, lui, est écrit au milieu — parmi les cinquante-huit.
Tronquée à ses dernières lignes, elle annonce « 57/58 » sans dire laquelle, et
il ne reste qu'à tout rejouer pour l'apprendre. Rediriger vers un fichier
(`> /tmp/…/batterie.log 2>&1`), puis y chercher. Payé le 12 août 2026.

**La dernière étape mérite son existence.** Toutes les autres interrogent
`127.0.0.1`, où l'en-tête `Origin` et l'hôte coïncident. Le patron, lui, passe
par un proxy où ils diffèrent — et Next.js refuse alors toute action serveur, à
commencer par la connexion. Le défaut était donc invisible partout sauf chez
lui, et il a essayé vingt fois une application qui ne pouvait pas le laisser
entrer. `verifier-connexion.mjs` se connecte pour de bon, dans un navigateur, en
posant délibérément une origine étrangère.

**Ne rien demander au patron tant qu'elle n'est pas au vert.** C'est sa règle,
posée après ces vingt échanges : *« tu essayes, tu fais des batteries de tests
avant de me demander de le faire »*.

Les étapes séparées restent disponibles pour un diagnostic rapide :

```bash
npx tsc --noEmit && npm run lint
npm test              # suites base de données
npm run test:e2e      # suites navigateur (démarre son propre serveur)
npm run verifier:connexion  # connexion réelle derrière un proxy
```

Variables nécessaires en local (identiques à la CI, voir
`.github/workflows/ci.yml`) :

```
DATABASE_URL=postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test
DATABASE_ADMIN_URL=postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test
AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000
# Pour test:e2e, un rôle qui traverse RLS (les suites inspectent la base) :
DATABASE_URL=postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test
CRON_SECRET=ci-placeholder-cron-secret-0000000000
REDIS_URL=redis://localhost:6379
```

**Les suites navigateur ne voient pas les défauts d'isolation.** Elles démarrent
leur serveur sous un rôle qui **traverse la RLS**, parce qu'elles inspectent la
base pour vérifier ce qu'elles affirment. Un chemin public par jeton — la page
du devis, celle de la facture, leurs PDF — éprouvé *uniquement* au navigateur
n'est donc pas éprouvé de ce point de vue : **il lui faut une suite base, sous
`atlas_app`**. Le 8 août 2026, le lien de facture et le téléchargement du devis
étaient morts en production pendant que la suite navigateur correspondante était
verte (`ARCHITECTURE.md` §34).

**Et surtout : regarder l'écran.** Trois défauts réels de ce projet — une barre
de navigation sur la page publique du client, l'ordre des totaux d'une facture,
une pile de notifications qui repoussait tout le contenu hors de l'écran — ont
été trouvés en regardant une capture, jamais par un test vert. Prendre une
capture des écrans touchés fait partie du travail, pas de la finition.

### Parcourir soi-même ce qu'on transmet

Un mode d'emploi, une commande, un environnement : **rien ne se donne au patron
sans avoir été parcouru en entier**, du premier geste au dernier. Compiler n'est
pas fonctionner ; « le script ne plante pas » ne dit rien de l'expérience de
celui qui le suit.

Trois échecs d'affilée l'ont montré, tous sur l'outillage et jamais sur le
produit : un mode d'emploi décrivant du code encore sur une branche, une adresse
ouverte avant que le serveur puisse servir, un port fermé qui rendait la page
blanche depuis un téléphone. À chaque fois, c'est **le patron** qui a fait le
test — et trois fois de suite, c'est trois fois de trop.

**Un contrôle doit savoir échouer.** Le vérifier en le confrontant à l'état
dégradé qu'il prétend détecter : une base vide, un fichier absent, un service
arrêté. Un contrôle jamais vu rouge ne prouve rien.

**Et son message doit désigner le bon coupable.** « relation "users" does not
exist » quand c'est la base entière qui n'est pas montée envoie chercher au
mauvais endroit — une erreur qui accuse à tort coûte plus cher que pas d'erreur
du tout.

**Un contrôle qui mesure ZÉRO ne mesure rien — et il est pire qu'absent.**
Payé le 15 août 2026. Une suite navigateur comparait la largeur d'un texte à
celle de sa boîte pour dire si un nom était coupé. Elle mesurait la page après
`domcontentloaded` : la feuille de style n'était pas appliquée, le `<span>`
restait en ligne, et les deux largeurs valaient **0**. `0 − 0 = 0` : « rien
n'est coupé », en vert, sur un écran où trois noms l'étaient.

La batterie entière était verte. C'est **la capture, regardée**, qui a montré
les « … » — la quatrième fois dans ce dépôt qu'un défaut sort d'une image et
d'aucun test.

Donc, dès qu'un contrôle compare des dimensions : attendre la mise en page
(`networkidle`), et **refuser de conclure sur une boîte de zéro pixel** plutôt
que de rendre un vert qui ne prouve rien. La même règle vaut pour un compte de
zéro élément, un fichier vide, une réponse sans corps : l'absence de matière à
mesurer n'est pas un succès, c'est une mesure impossible.

### Monter la base ici : une commande

```bash
source scripts/monter-base-locale.sh   # cluster, rôles, Redis, migrations
npm test
```

**Corrigé le 2026-08-05, contre ce que le dépôt affirmait.** Docker manque bien,
mais les binaires PostgreSQL 16 (`/usr/lib/postgresql/16/bin`) et `redis-server`
sont installés. `initdb` refuse de tourner en `root` — le script emprunte le
compte `postgres` du système. Les migrations tournent sous le rôle
**propriétaire** : `atlas_app` n'a aucun droit de DDL, et l'oublier produit un
« permission denied for schema public » qui envoie chercher au mauvais endroit.

**Et l'inverse est pire, parce qu'il RÉUSSIT.** Migrer avec le rôle `postgres`
— un raccourci tentant, puisqu'il traverse la RLS et qu'on l'a déjà sous la main
pour les suites navigateur — ne se plaint de rien : les tables se créent,
appartenant à `postgres`, et les `GRANT` de la migration passent. Le défaut
n'apparaît qu'**à la suite suivante, ailleurs**, sous la forme d'un « permission
denied for table … » sur une table qu'on n'a pas touchée. Cinquante suites
rouges d'un coup, et l'erreur désigne la table plutôt que la migration qui l'a
mal créée. Payé le 13 août 2026.

**Donc : toujours `DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:migrate`**, ce
que fait déjà `monter-base-locale.sh`. En cas de doute, la question qui tranche :

```bash
psql … -tAc "SELECT tablename FROM pg_tables
             WHERE schemaname='public' AND tableowner <> 'atlas_owner';"
```

Une seule ligne de réponse, et la base a dérivé.

Croire l'inverse a coûté cher : « c'est la CI qui vérifiera » a été dit trois
fois alors que la CI n'avait jamais tourné.

### Ce qui ne peut pas être éprouvé ici doit l'être ailleurs

Cet environnement n'a **ni démon Docker, ni GitHub CLI**, et son mandataire
réseau refuse `github.io`, `api.github.com` et la documentation GitHub. Ne pas
contourner : déplacer la vérification là où elle est possible.

Deux précédents, à imiter plutôt qu'à réinventer :

- `.github/workflows/pages.yml` interroge le site **à son adresse publique**
  après déploiement, puisque l'agent ne peut pas la joindre.
- `.github/workflows/banc-essai.yml` monte l'espace de travail complet et s'en
  sert, puisque l'agent n'a pas Docker.

Quand ni l'un ni l'autre n'est possible, **le dire** plutôt que de laisser croire
à une vérification qui n'a pas eu lieu.

## 4 bis. Une maquette qui montre du matériel le prend dans le catalogue

**Payé le 20 août 2026, sur sa question :** *« les pièces que tu as utilisées
pour l'exemple sont choisies au hasard ? »* — et la réponse était **oui** pour
une partie d'entre elles. La maquette d'arrosage annonçait « Turbines, portée
5 m · 0,30 m³/h », des « colliers de prise en charge », un « filtre à tamis » et
un « clapet anti-retour ». Aucune de ces pièces n'existe.

Le dépôt tient pourtant `appli/arrosage-catalogue.js`, où **chaque entrée porte
sa source** — `'patron'` (relevée de ses photos, de ses devis Aqua Plus) ou
`'provisoire'`. Un arroseur dont on croit la portée fausse fait acheter le
mauvais nombre d'arroseurs, et c'est le paysagiste qui revient poser les
manquants.

**La règle, donc :**

- **Aucun matériel inventé dans une maquette.** Les libellés se recopient
  **mot pour mot** du catalogue : c'est ce qu'il portera chez son fournisseur, et
  une virgule de plus rend la référence introuvable.
- **Les chiffres viennent du calcul, pas de la tête.** `appli/arrosage-calcul.js`
  existe et tourne : on le pilote (Playwright suffit) et on écrit ce qu'il rend.
  Refaire le calcul à la main dans une maquette, c'est une seconde
  implémentation qui divergera (§3).
- **Ce qui ne se devine pas reste vide et le dit.** Les longueurs de tuyau
  dépendent du chemin réel dans le jardin : le calcul répond « à mesurer », et la
  maquette doit répondre pareil. Un plan qui chiffre ce que la liste dit ignorer
  se contredit lui-même — et c'est le chiffre du plan qu'on recopie sur un devis.
- **La source se montre.** Ce qui est encore `provisoire` est signalé comme tel,
  jamais présenté comme acquis.

**Le contrôle qui tient tout ça**
(`scripts/verifier-maquette-arrosage-simple.mjs`) compare chaque libellé au
catalogue **à l'identique**. Sa première version acceptait une inclusion : le
catalogue portant une entrée générique nommée « Turbine », l'invention
« Turbine portée 5 m » la contenait et passait au vert. **Un contrôle trop
tolérant ne prouve rien** — celui-là a été trouvé en le confrontant à
l'invention même qu'il devait bannir.

## 5 bis. Un contrôle ne doit pas réclamer ce que le patron a fait retirer

**Payé le 20 août 2026.** Il a demandé de vider la fiche d'un client — *« tout
le reste, tu enlèves, c'est du trop »*. Une suite d'un autre lot lisait le
compte « 2 chantiers » sur cet écran pour prouver que deux chantiers avaient été
rapprochés sous un seul client. Le compte parti, elle a rougi — sur du code
juste, et pour une demande exaucée.

**Ce qu'une suite doit fixer, c'est la RÈGLE, pas la façon dont un écran la
montre.** Le rapprochement se prouve aussi bien — mieux — en vérifiant que les
deux chantiers ouvrent la MÊME adresse de fiche : cela ne dépend d'aucun libellé
et survivra au prochain remaniement.

Avant d'écrire une assertion sur un texte d'écran, se demander : *si le patron
faisait retirer ce mot demain, ce contrôle défendrait-il encore quelque chose ?*
Si la réponse est non, viser plus profond — une adresse, un identifiant, un
compte en base.

**Et la réciproque, qui vaut autant :** quand une suite rougit après un retrait
qu'il a demandé, on **adapte le contrôle**, on ne remet pas le libellé. Écrire
une suite qui réclame ce qu'il a fait enlever, c'est rendre son écran impossible
à changer.

## 5 ter. Avant de dire « l'application ne sait pas faire ça », chercher

**Payé le 20 août 2026, et cela a failli coûter une fonctionnalité.** Devant
« lire les métrés sur une photo de croquis », il a été répondu au patron que
c'était impossible : *« cela demande une IA qui regarde une image, et aucun
contrat n'est signé »*. Il a corrigé — *« tu peux le faire, il y a déjà l'IA
dans l'application, Anthropic et OpenAI »* —, et il avait raison.

`src/server/ai/services/lire-ticket.ts` fait **déjà** lire un ticket de caisse
photographié : consigne système, image envoyée au fournisseur, réponse JSON,
fonction pure qui la relit, éprouvée sans clé. Lire un croquis, c'est le même
patron. Ce n'était pas un mur, c'était une pièce à écrire.

**La question à se poser n'est jamais « est-ce possible ? » mais « qui, dans ce
dépôt, fait déjà quelque chose d'approchant ? »** Un `grep` de trente secondes
sur `image`, `vision`, `base64` l'aurait donné.

C'est la même faute que la planche 56, dans l'autre sens : celle-là décrivait un
écran déjà fait, celle-ci déclarait impossible un travail déjà à moitié fait.
**Chercher avant d'affirmer, dans les deux sens.**

## 6. Git

- Branche de développement : celle que la conversation désigne. Elle change à
  chaque session — ne pas se fier à un nom écrit ici, qui serait faux le
  lendemain.
- Messages de commit **en français**, à l'impératif, expliquant **pourquoi** le
  changement existe et ce qu'il évite. Le diff dit déjà quoi.
- Ne jamais pousser sur une autre branche sans accord explicite.
- Ne jamais ouvrir de *pull request* sans demande explicite.

### Rien n'est livré tant que ce n'est pas sur `main`

**Payé deux fois, la seconde le 11 août 2026.** Un lot complet — code, suites,
documentation, batterie au vert — a été poussé sur sa branche de session, et le
patron a répondu : *« les modifications ne me sont pas parvenues »*. Elles
étaient bien poussées. Elles n'étaient nulle part où il regarde.

Son banc d'essai ne sait faire qu'une chose (`.devcontainer/mettre-a-jour.sh`) :
à chaque allumage, il avance **sa propre branche** en ligne droite
(`--ff-only`). Une branche qu'il ne suit pas ne lui arrivera **jamais**, quoi
qu'on y pousse — et il n'aura pas le moindre message pour le lui dire.

**Donc : un lot n'est terminé qu'une fois sur `main`.** Le pousser sur sa
branche est une étape, pas une livraison. Demander l'accord (§6 ci-dessus), puis
fusionner et pousser — sans quoi il éprouve une version d'avant en croyant
éprouver la nouvelle.

**Pour savoir ce que son banc exécute vraiment**, ne pas le lui faire deviner :
l'écran **Réglages** affiche la version servie (date · numéro de commit,
`src/server/version-executee.ts`). Une capture répond à la question sans qu'on
ait à la poser.

### Plusieurs sessions écrivent sur `main` en même temps

**Sa consigne du 11 août 2026 :** *« souvent j'ai deux ou trois sessions qui
tournent et qui modifient en même temps plusieurs choses sur l'appli, fais
attention à ça »*.

Trois règles qui en découlent, et qui ne se négocient pas :

1. **Jamais de poussée en force sur `main`.** Un refus pour « non
   *fast-forward* » n'est pas un obstacle à contourner : c'est le garde-fou qui
   vient d'empêcher d'effacer le travail d'une autre session.
2. **Refusionner avant de pousser**, toujours : `git fetch origin main`, puis
   fusionner. Le code arrivé entre-temps n'est pas le sien, et rien ne dit qu'il
   s'accorde au nôtre. C'est ainsi qu'a été trouvée la §59 publiée en double le
   11 août.
3. **Fusionner juste avant de pousser, pas la veille.** Entre la vérification et
   la poussée, `main` a pu bouger encore. Vérifier une dernière fois.

**Après une fusion, rejouer la batterie SEULEMENT si le code arrivé touche ce
qu'on vient de faire.** Sa décision du 13 août 2026 : *« seulement quand le code
touche »*.

**Pourquoi elle a été prise, et ce qu'elle corrige.** Ce soir-là, un écran fini
et vérifié a mis des heures à parvenir jusqu'à lui — non pas par difficulté,
mais par une course : `main` a bougé **cinq fois** pendant la vérification (30,
puis 4, 11, 20 commits), et chaque fusion relançait une batterie de dix minutes
que la fusion suivante périmait aussitôt. Rejouer soixante suites pour du code
qui touche une autre partie de l'application, c'est payer dix minutes pour ne
rien apprendre — et faire attendre le patron pour rien.

**Ce qui compte comme « ça touche », et la liste n'est pas au jugé :**

| Le code arrivé… | Alors |
|---|---|
| touche un fichier que ce lot modifie aussi | **batterie complète** |
| ajoute une **migration** (`drizzle/*.sql`) | **batterie complète**, et l'appliquer d'abord — sans quoi elle rend des dizaines de rouges qui n'accusent que la base (payé le 13 août : 160 rouges d'un coup) |
| touche une **pièce partagée** — `design-tokens.ts`, `PrimaryButton`, `EnTeteEcran`, `globals.css`, `layout.tsx`, `middleware.ts` | **batterie complète** : ces fichiers-là touchent tous les écrans |
| touche les suites ou l'outillage que ce lot emploie | **batterie complète** |
| ne touche rien de tout cela | `typecheck`, `lint`, `verifier:memoire`, **plus les suites du domaine concerné** — et l'on pousse |

**Ce que cela ne relâche PAS.** La batterie complète reste obligatoire **avant
la première poussée d'un lot**, sur son propre code : c'est la règle du §5, et
elle n'a pas bougé d'un pouce. Cette exception ne vaut que pour les fusions
successives d'un lot **déjà éprouvé au vert**.

**Et le doute tranche vers la batterie.** Une fusion qui ne se lit pas en un
coup d'œil — un conflit résolu à la main, un fichier qu'on ne reconnaît pas —
se rejoue en entier. Dix minutes coûtent moins cher qu'une régression chez lui.
