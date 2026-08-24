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
- **Aucune couleur écrite en clair dans un écran.** Sept chartes cohabitent,
  dont **deux sombres** : sur Nuit et Sylve, l'accent est CLAIR et le fond est
  SOMBRE — les pôles s'inversent. Un `#faf9f5` posé sur `colors.rust` est donc
  juste cinq fois sur sept, et illisible deux fois. C'est exactement ce que le
  patron a signalé le 22 août 2026 : *« le mode nuit est illisible »*. Ce qui
  s'écrit à la place : `surPlein` pour ce qu'on pose SUR un aplat,
  `voile(colors.ink, α)` pour un voile, et les jetons pour les signaux
  (`ARCHITECTURE.md` §160). En dix secondes :
  `npx tsx scripts/test-chartes-lisibles.ts`.

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
2. un lien l'ajoute à **`appli/essais.html`** ;
2 bis. **ON LUI DONNE L'ADRESSE ENTIÈRE, jamais tronquée.** Payé le 24 août
   2026 : la planche était en ligne, publiée et vérifiée — et il a répondu
   *« je t'ai demandé des maquettes dynamiques en .html pour que je puisse
   avoir un visuel avant de choisir !!!! »*, parce qu'on lui avait écrit
   `…github.io/Atlas-app/essais.html`. **Des points de suspension, ça ne se
   tape pas sur un téléphone.** L'adresse complète, et celle de la planche
   elle-même plutôt que celle du sommaire :
   `https://florianmarrins0978-svg.github.io/Atlas-app/<la-planche>.html`.
   C'est la quatrième fois qu'une adresse lui coûte un aller-retour, et les
   quatre fois le code était juste ;
3. rien d'autre à faire pour qu'elle soit vérifiée en ligne : depuis le
   20 août 2026, `pages.yml` **déduit sa liste des liens d'`essais.html`** —
   une liste tenue à la main s'oubliait à chaque page neuve, et l'oubli ne se
   voyait pas. Ce qu'on lui donne à cliquer est exactement ce qu'on vérifie ;
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

## 4 ter. L'ARROSAGE N'A PAS LE DROIT À L'ERREUR

**Sa consigne du 22 août 2026, et elle prime sur l'envie de livrer :** *« cet
outil n'a pas le droit à l'erreur, parce qu'énormément d'utilisateurs vont s'en
servir. Si jamais il se trompe dans les calculs et que les réseaux d'arrosage ne
se lèvent pas, moi je vais être dans la merde. »*

**Ce que cela change concrètement.** Ailleurs dans ce produit, une erreur se
corrige : un devis se rectifie, une facture s'annule, un planning se déplace. Un
réseau d'arrosage est **enterré**. Le défaut ne se voit qu'en juillet, sur un
gazon jauni, chez un client qui a déjà payé — et c'est le paysagiste qui rouvre
la tranchée à ses frais.

**Trois règles qui en découlent, et qui ne se négocient pas :**

1. **Aucune valeur d'arrosage ne se devine.** Un chiffre sans source relevée ne
   rentre pas dans le calcul : il se demande, ou le calcul refuse de conclure.
   « Plausible » n'est pas une source.
2. **Se tromper vers le SÛR — et le sûr, c'est MOINS D'ARROSEURS PAR RÉSEAU.**

   **Cette règle a d'abord été écrite à l'envers, et c'est lui qui l'a
   redressée le 22 août 2026 :** *« un arroseur de trop fait que le réseau ne
   peut pas se lever ! »* Elle disait « retenir l'hypothèse qui pose un
   arroseur de plus » — une formule qui, appliquée à un RÉSEAU, produit
   exactement la panne qu'elle prétend éviter : une tête de plus sur une vanne,
   c'est du débit en plus sur la même conduite, donc de la pression en moins,
   donc des turbines qui sortent à moitié.

   La bonne formulation, et il n'y en a qu'une :

   | Devant un doute | Ce qu'on retient |
   |---|---|
   | combien d'arroseurs sur **une vanne** | **le moins**, quitte à ouvrir une vanne de plus |
   | combien de **réseaux** | **le plus** |
   | une perte de charge inconnue | **la plus forte** |
   | une portée inconnue | **la plus courte** |

   Une vanne de plus coûte une électrovanne et une voie de programmateur. Un
   réseau qui ne se lève pas coûte le chantier.

   **ET CETTE PRUDENCE NE S'APPLIQUE QU'AUX INCONNUES.** Sa précision du
   22 août, dans la foulée : *« faut pas pour autant qu'il retire un arroseur,
   il faut qu'il me calcule le nombre juste »*.

   | | |
   |---|---|
   | ce qui se **calcule** — la couverture d'une zone, le débit d'une buse, les pertes | **exact**, sans marge ajoutée |
   | ce qu'on **ignore** — une valeur non relevée, une longueur non saisie | prudent, dans le sens ci-dessus |

   Retirer un arroseur « pour être tranquille » n'est pas de la prudence : c'est
   un trou d'arrosage, et il se voit en juillet exactement comme la panne qu'on
   voulait éviter. La marge se prend sur ce qu'on ne sait pas, jamais sur ce
   qu'on sait.
3. **Ce qui n'est pas calculé se DIT à l'écran.** Pas dans le dépôt, pas dans un
   commentaire : sous le plan, là où il le lit. Une réserve tue vaut un mensonge
   — parce qu'un plan silencieux est cru complet.

**Et l'inverse est vrai aussi :** un avertissement qui parle à tort s'apprend à
être ignoré, et l'on perd le garde-fou sans s'en apercevoir. Une réserve se pose
là où le calcul est réellement muet, nulle part ailleurs.

## 4 bis. Tout schéma d'arrosage obéit à sa planche du 17 août

**SANS CROQUIS COMPLET, AUCUN PLAN.** Sa règle du 21 août 2026, et elle passe
avant tout le reste de cette section : *« l'outil doit fonctionner avec un plan
avec toutes les métrés, l'emplacement du piquage et l'endroit définitif de la
nourrice — sans ça il ne doit rien proposer »*.

Trois éléments, tous obligatoires :

| | Sans lui |
|---|---|
| **les métrés** | on ne sait pas combien d'arroseurs, ni où |
| **le piquage** | on ne sait pas quel débit, ni s'il faut couper une ligne |
| **l'endroit DÉFINITIF de la nourrice** | on ne sait ni d'où partent les lignes, ni où creuser |

Il en manque un : on **retire** le plan et l'on dit lequel manque. On ne le grise
pas — un plan affiché en pâle se photographie et se pose quand même.

**LA NOURRICE SE PLACE PAR LUI, JAMAIS PAR L'OUTIL.** Sa règle du 21 août :
*« c'est l'utilisateur qui placera la nourrice où il veut »*. Elle n'est ni
calculée, ni déduite, ni proposée d'office : elle est **lue** sur le croquis.
L'IA qui lit la photo la cherche ; si elle ne la trouve pas, elle refuse et le
dit — elle ne la pose pas au piquage « pour dépanner ».

Ce n'est pas une question de politesse : l'endroit du regard dépend de ce que
lui seul sait — un point d'eau existant, un passage de voiture, un massif qu'on
ne rouvre pas, l'accès pour l'hivernage. Un outil qui le placerait ferait creuser
au mauvais endroit, et une tranchée ne se déplace pas.

**Informer n'est pas proposer.** S'il demande ce que change tel ou tel
emplacement, on répond avec des chiffres — l'amenée s'allonge, les lignes
raccourcissent. On ne dit jamais où le mettre.

**LE MOINS DE VANNES D'ABORD, LE MOINS D'ARROSEURS ENSUITE — sa colère du
23 août 2026 :** *« cinq réseaux pour ça ??????? »*, devant 208 m² de pelouse.
On ne choisit plus la plus grande buse qui pave : on choisit celle qui demande
le moins de vannes, et l'on départage sur le nombre d'arroseurs. Neuf arroseurs
se posent une fois ; une vanne coûte une électrovanne, une station de
programmateur, sa tranchée et son créneau d'arrosage.

**Et le quinconce ne se resserre JAMAIS sous la portée** — sa règle du 17 août.
Quand le damier ne couvre pas à cet écart-là, on garde la grille alignée. Le
resserrement sans plancher disqualifiait la seule pose qui tenait sur une vanne.

**UN CROQUIS À MAIN LEVÉE SE LIT QUAND MÊME — sa correction du 23 août 2026 :**
*« les utilisateurs ne vont pas s'amuser à faire des croquis à l'échelle à
chaque fois ; là, il y a tous les métrés »*. **Les cotes commandent, le dessin
ne fait qu'ordonner.** Ne jamais refuser un plan parce que le dessin n'est pas
proportionné : le placer d'après ses cotes et le DIRE en réserve.

La sévérité reste sur le **trajet du regard** — lui entre dans le calcul de
pression, et un chiffre faux y coûte un plan faux. Une pelouse placée de travers
se voit à l'œil ; une pression fausse ne se voit qu'en juillet.

**Et l'agencement n'est pas l'un des trois éléments obligatoires.** Métrés,
piquage, nourrice : ceux-là retirent le plan. Un agencement illisible ne retire
que le DESSIN — le plan sort, et l'on dit pourquoi il n'est pas dessiné.

**LA PLUVIOMÉTRIE NE SÉPARE PAS DEUX VANNES — sa décision du 23 août 2026 :**
*« ne prends pas en compte la pluviométrie »*. Elle était dans la clé de secteur
depuis le 17 août, mise par lui (« ça ne se mélange jamais ») ; il l'a retirée le
23. **Ne pas la remettre** : deux turbines de buses différentes partagent
désormais une vanne, avec des millimètres/heure différents pour une même durée
d'ouverture, et c'est lui qui arbitre à l'arrosage.

**Ce qui sépare, en revanche, c'est le MATÉRIEL.** Une turbine et une tuyère ne
s'ouvrent jamais ensemble : l'une verse environ trois fois plus vite. Cette
règle-là n'a pas bougé.

**LES PIÈCES SE COMPTENT EN « 13x », PAS EN « 13 u »** — même jour. L'unité reste
dans les données : elle distingue une pièce qu'on compte d'un tuyau qu'on mesure,
et « 80x de PE Ø25 » ne se commande pas. Une seule fonction l'écrit
(`quantiteEcrite`), pour l'application comme pour la page publiée.

**L'AVERTISSEMENT SE LIT AVANT DE PHOTOGRAPHIER**, en gras, **au-dessus** du
croquis : *« votre croquis doit impérativement contenir les métrés, l'endroit
définitif de la nourrice, et l'endroit où le piquage se fait »*. Placé en
dessous, il se lirait après l'envoi d'une photo incomplète — donc trop tard, et
il faudrait retourner au jardin.

**PAS DE PHRASES PRÉ-ÉCRITES DANS L'APPLICATION.** Sa remarque du 21 août :
*« il ne faut pas mettre les phrases pré-écrites, mais il faut un endroit où on
puisse discuter avec toi »*. Un champ libre, rien d'autre. Des suggestions
toutes faites bornent ce qu'on ose demander — et ce qu'il a à dire ne tient
jamais dans trois boutons. Elles n'existent dans les maquettes que parce
qu'aucune ne porte de JavaScript, et cela doit s'y **écrire** pour qu'on ne les
recopie pas en codant.

**ET LA DISCUSSION NE CRÉE JAMAIS UN PLAN.** *« Elle peut seulement modifier, ou
recréer si un croquis avec tous les bons éléments aux bons endroits a été
fourni. »* C'est la tentation exacte d'une conversation : on répond en comblant
ce qui manque, parce qu'une phrase se complète plus facilement qu'un dessin. Un
plan tracé sur une nourrice supposée fait creuser au mauvais endroit — et une
tranchée ne se déplace pas.

**Un manquement à noter, du 21 août :** le plan de son jardin a été tracé avec
une nourrice que J'AI placée, son croquis ne la portant pas. Il aurait dû être
refusé.



Règle posée le 21 août 2026, et qu'il veut **valable partout** : *« sers-t'en
pour tous les schémas, il fonctionnera partout, ça doit être la règle »*.

**Tout part de la nourrice.** *« Règle indiscutable ! »* Un plan où l'on voit le
compteur et des traits qui commencent dans le vide n'est pas un plan : il ne se
pose pas sur le terrain. La nourrice se **dessine**, avec ses vannes, et chaque
ligne en part.

**LE DÉBIT D'UNE TURBINE NE DÉPEND PAS DE SON ARC.** Sa règle du 21 août :
*« les débits à 360° sont les mêmes qu'à 180° et 90° »*. Le jet est un seul
filet qui balaie l'arc réglé — il sort autant d'eau par seconde sur un quart de
cercle que sur le tour entier ; seule la durée passée sur chaque point change.
Un arroseur de coin consomme donc **autant** qu'un plein cercle.

**C'est l'inverse de ce que le dépôt supposait**, et c'est pourquoi il ne l'avait
pas déduit. La déduction plausible — « deux fois moins d'angle, deux fois moins
d'eau » — aurait divisé par quatre le débit d'un coin, et fait poser quatre fois
trop d'arroseurs sur une même voie.

**Et cela ne vaut QUE pour les turbines.** Une buse VAN projette plusieurs filets
simultanés : moins d'arc, moins de filets, moins de débit — ses relevés le
montrent (12-VAN : 0,15 à 90°, 0,30 à 180°, 0,59 à 360°). Pour une tuyère, le
débit se lit par angle.

**80 % DE RECOUVREMENT SUFFIT — pas besoin de 100 %.** Sa règle du 21 août, en
validant la 12-VAN à 3,6 m sur une bande de 4 m. Le recouvrement se lit
`portée ÷ espacement` : deux arroseurs espacés de leur portée exacte se
recouvrent à 100 %, ce qui est confortable et cher. Le seuil est **0,8**, soit
un espacement jusqu'à **1,25 × la portée**. Exiger 100 % partout fait poser des
arroseurs et des raccords que personne ne paie.

**LA TENSION S'ACCORDE, SINON RIEN N'ARROSE.** Sa règle du 21 août :

| Le programmateur | L'électrovanne |
|---|---|
| à pile, **9 V** | **9 V** |
| sur secteur, **220 V** | **24 V** |

Ce n'est pas une préférence mais une condition de fonctionnement : une vanne
24 V pilotée par un boîtier à pile **ne s'ouvre pas**. Le réseau n'arrose pas du
tout, et on ne s'en aperçoit qu'après avoir rebouché. Cette faute ne se voit ni
sur un plan, ni sur un devis. **Tous ses programmateurs sont à pile** — donc
toutes ses vannes sont en 9 V.

**Une valeur « provisoire » qui survit devient un mensonge.** Le catalogue
portait une « Électrovanne 24 V » générique, posée avant qu'il donne ses
références et jamais confrontée à elles. Il a demandé d'où elle sortait : de
nulle part. Quand ses vraies références arrivent, les lignes provisoires qu'elles
remplacent se **corrigent**, elles ne se laissent pas dormir.

**CE QUI COMPTE, C'EST LA PRESSION AU DERNIER ARROSEUR, PAS AU COMPTEUR.** Sa
demande du 22 août 2026 au soir : *« oui corrige la 1 »*. Entre le compteur et
le bout d'une ligne se perdent l'amenée, l'électrovanne, la ligne elle-même,
ses raccords et l'antenne Ø16 — de l'ordre d'un demi à trois quarts de bar sur
un jardin ordinaire. Dimensionner sur la pression du compteur, c'est prêter aux
arroseurs de bout de ligne une portée qu'ils n'ont pas.

**Le débit DÉCROÎT le long de la ligne**, et c'est tout le calcul : entre la
vanne et la première tête passe le débit du réseau entier, puis une tête de
moins à chaque tronçon. Compter le débit total partout surestime la perte de
75 % — assez pour condamner des plans qui tiennent.

**Deux passes, jamais trois.** La pression au bout dépend des débits, qui
dépendent d'elle. On calcule un plan à la pression de la source, on mesure ce
qui se perd, on refait. Une troisième passe remonterait la pression et l'on
tournerait autour de la valeur : s'arrêter à deux garde les pertes des débits
les plus forts, donc le côté sûr.

**LES PLACES SE LISENT SUR LE CROQUIS, EN FRACTION — les mètres se DÉDUISENT.**
Sa demande du 22 août au soir : *« oui fais-le lire les proportions »*, après
que je lui ai dit à tort qu'aucune saisie ne donnait le trajet du regard à la
première tête. *« Il a tous les métrés du terrain, il a juste à calculer. »*

Le modèle rend des places entre 0 et 1 — il voit qu'une pelouse occupe le tiers
gauche, pas qu'elle est à douze mètres. **L'échelle sort des cotes déjà lues** :
16 m sur 0,40 du croquis font 40 m par unité. On retient la **médiane** des
estimations, jamais la moyenne, et **on refuse de conclure** au-delà du double
d'écart entre zones — un croquis pas à l'échelle ne rend pas une distance
moyenne, il rend une réserve.

**Ce qui reste non compté se dit à l'écran** : quand la nourrice n'est pas
dessinée, le trajet ne se calcule pas — et il ne se suppose pas davantage. La
pression annoncée est alors un plafond.

**UN RÉSEAU EST PLAFONNÉ PAR SON TUYAU, PAS SEULEMENT PAR LE COMPTEUR.** Sa
déduction du 22 août 2026 : *« en diamètre vingt-cinq c'est 1,76 m³/h, donc dans
tous les cas le calcul doit se faire là-dessus, peu importe qu'on ait 2 ou
1,80 »*. Toutes ses lignes de réseau sont en Ø25 — c'est le diamètre de tous ses
raccords. La limite d'un réseau est donc **le plus petit** de :

| | |
|---|---|
| ce que la source donne | débit au seau × 0,85 |
| ce que le tuyau passe | **1,76 m³/h en Ø25** |

**Ce défaut était invisible chez lui** : son compteur donne 1,80, donc la source
a toujours commandé. Il serait apparu chez le premier utilisateur mieux
alimenté. Une règle éprouvée sur un seul chantier n'est pas une règle éprouvée.

**UNE BUSE SE CALCULE À LA PRESSION DU CHANTIER, PAS À CELLE DU CATALOGUE.**
Ses catalogues ne donnent qu'une valeur par buse, à une pression de référence
(2,5 bar pour ses turbines Rain Bird, 2 bar pour ses tuyères VAN). Les prendre
telles quelles met un arroseur de trop par réseau dès que le chantier est en
dessous.

| | La loi | Son statut | Sens |
|---|---|---|---|
| **débit** | `Q ∝ √P` — Torricelli | **physique** | les deux sens |
| **portée** | `R ∝ P^(1/3)` | **estimation** | **vers le bas seulement** |

**La portée ne se gonfle JAMAIS.** L'exposant vient des tables des
constructeurs, pas de ses relevés à lui : au-dessus de la pression de
référence, on garde la portée du catalogue. Espacer les arroseurs sur un chiffre
supposé fabrique un trou d'arrosage qu'on ne voit qu'en juillet ; réduire coûte
au pire une vanne de plus. **Et une portée réduite se DIT à l'écran** — c'est
une estimation, pas un fait.

**LE DIAMÈTRE DU TUYAU SE CALCULE, ET SUR DEUX CRITÈRES — jamais un seul.**
Sa demande du 22 août 2026 : *« passé un certain nombre de mètres linéaires, il
faut passer du PEHD Ø25 à celui en Ø32 ; j'aimerais que mon outil arrosage
puisse faire la même chose »*. Ses fournisseurs savent le lui dire ; c'est un
calcul, pas un tour de main.

| Ce qui impose le Ø32 | La règle | Le chiffre |
|---|---|---|
| **le débit** — l'eau va trop vite | vitesse ≤ 1,5 m/s | Ø25 : **1,76 m³/h** · Ø32 : **2,91** |
| **la longueur** — la perte mange la marge | Hazen-Williams, retournée | dépend du débit et du budget |

**Le piège, et il était dans le dépôt.** Le calcul ne regardait QUE la perte de
charge. Or un tuyau court n'en perd presque aucune : sur ce seul critère, **un
Ø25 « passe » à n'importe quel débit pourvu qu'il soit assez court**. C'est
faux — au-delà de 1,5 m/s l'eau cogne, le coup de bélier fatigue les
électrovannes, et le bruit s'entend dans la maison. Le critère de vitesse est
donc entré, et c'est lui qui donne les débits maximaux que les fournisseurs
annoncent par diamètre.

**Ce chiffre recoupe SA mesure**, et c'est ce qui permet de le croire : au seau,
sur son compteur en Ø25, il a relevé 1,80 m³/h ; la formule en donne 1,76. Le
tuyau ne laissait pas passer davantage.

**Et l'outil dit le SEUIL, pas seulement le verdict.** « Le Ø25 tient jusqu'à
73 m à ce débit » se compare au mètre ruban avant de creuser ; un oui/non sur
une longueur saisie oblige à la ressaisir trois fois pour trouver la bascule.
Quand le débit interdit le Ø25, le seuil vaut **zéro**, jamais un nombre de
mètres qu'on croirait.

**LA PRESSION NE DONNE PAS LE DÉBIT, ET LE DÉBIT NE DONNE PAS LA PRESSION.**
Les deux se calculent, mais séparément : le débit vient du diamètre (vitesse ×
section) ou du seau chronométré ; la pression dit ce qui arrivera aux arroseurs
une fois les pertes retirées. Les confondre met trop d'arroseurs sur un réseau.

**SE PIQUER AU COMPTEUR, C'EST COUPER UNE LIGNE EN SERVICE.** Sa précision du
21 août : *« le compteur, c'est une ligne directe qui part vers la maison ; on va
devoir la couper et mettre un té égal à cet endroit-là »*. Donc **dès que le
piquage est au compteur, un té égal 25×25×25 entre dans les pièces d'amenée** —
celles qui vont du compteur à la nourrice.

C'est une pièce qu'aucun calcul de réseau ne produit : elle ne dépend ni des
arroseurs, ni des voies, ni du débit, mais du **point de piquage** seul. Elle
manquait donc, et elle aurait manqué sur chaque plan. L'oublier, c'est un
aller-retour au magasin avec la tranchée ouverte.

**Trois zones, jamais mélangées** : ce qui va du **compteur à la nourrice**, ce
qui est **dans le regard**, ce qui part **au jardin**. Les confondre a déjà fait
compter un coude du regard comme une fin de ligne d'arroseur.

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
trouve, et par le plus court. **Le tour vaut mieux que la coupe, même à longueur
égale** — son exemple du 21 août : sur une bande de 8 × 4, faire le tour par
haut-gauche → haut-droite → bas-droite → bas-gauche coûte exactement autant que
de la couper en deux, et ne creuse que le long des bords.

**Le critère est géométrique, pas métrique.** Une première version comptait la
tranchée à plus de 2 m d'un bord : dans une bande de 4 m de large, le milieu est
à 2 m des deux bords, donc aucune traversée n'y était **jamais** détectée — le
contrôle dormait exactement là où il fallait qu'il parle. La bonne question est :
*ce segment part-il d'un bord pour arriver sur un bord en passant par
l'intérieur ?* Si oui, c'est une coupe, et le tour existe toujours. Un segment
qui va chercher un arroseur du milieu n'arrive sur aucun bord : ce n'en est pas
une.

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

**UNE LÉGENDE SE VÉRIFIE CONTRE LE CATALOGUE ET CONTRE LA COMMANDE.** Payé le
22 août 2026, et c'est lui qui l'a relevé : *« il m'a déjà donné 4 arroseurs en
5004 buse 3 sur un seul réseau avec 3 bar et du Ø25 — est-ce correct ? »* Ça ne
l'était pas (2,84 m³/h pour un Ø25 qui en passe 1,76), **mais le plan ne posait
pas de 5004** : la légende, elle, était restée sur le matériel de la première
version de la planche, et son contrôle **exigeait ce libellé en dur**. La
légende ne pouvait donc plus être corrigée sans faire rougir la batterie.

Trois choses doivent s'accorder, et un contrôle doit les confronter :

| | |
|---|---|
| le nom de la buse | **exactement** celui du catalogue |
| la portée annoncée | celle du catalogue, pas une valeur ronde |
| le matériel cité | celui que **la liste des pièces facture** |

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

**PAS DE GRAS DANS UNE LISTE DE PIÈCES.** Sa demande du 21 août. Une liste de
commande se lit ligne à ligne : y appuyer des mots hiérarchise ce qui n'a pas à
l'être, et attire l'œil sur la moitié d'une désignation. Le gras sert dans une
explication, pas dans un tableau où chaque ligne compte autant que la suivante.

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

**Un écran qu'on ne peut pas atteindre ici se rend quand même.** Le plan
d'arrosage demande une photo de croquis et une clé de vision, que cet
environnement n'a pas : `scripts/capture-plan-arrosage.ts` rend donc le seul
composant du dessin, avec les données que le calcul produit vraiment.

```bash
npx tsx scripts/capture-plan-arrosage.ts /tmp/captures
```

Il a attrapé, le 23 août 2026, quatre défauts qu'aucun test ne voyait — dont
deux qui ne se montrent **qu'à partir de trois réseaux** : deux tuyaux d'une même
tranchée dessinaient le même trait, et la tranchée avait la couleur du troisième
réseau. La maquette validée n'en portait que deux. *Une règle éprouvée sur un
seul cas n'est pas éprouvée.*

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
4. **NE PAS ATTENDRE LES AUTRES SESSIONS.** Sa consigne du 23 août 2026 —
   *« si vous savez qu'il y a plusieurs sessions qui tournent, organisez-vous
   les gars »* — après une soirée où un lot vert a refusionné trois fois sans
   jamais atteindre `main`.

   **Attendre est un blocage, pas une politesse :** ce soir-là, six sessions
   tournaient sur l'application, chacune verte et prête. Si chacune attend que
   les autres aient fini, aucune ne pousse jamais. Ce qui raccourcit vraiment
   la course, c'est de **pousser dans la minute qui suit le vert** — la fenêtre
   où `main` peut bouger se compte alors en secondes, pas en dizaines de
   minutes.

   Et le tableau ci-dessous n'est pas une formalité à cocher : rejouer soixante
   suites parce qu'une autre session a touché le même fichier, alors qu'elle
   travaillait à l'autre bout, c'est repayer dix minutes pour n'apprendre rien
   — et laisser `main` bouger encore pendant ce temps.

**Après une fusion, rejouer la batterie SEULEMENT si le code arrivé touche ce
qu'on vient de faire.** Sa décision du 13 août 2026 : *« seulement quand le code
touche »*.

#### Ce que la soirée du 23 août a coûté, et qui n'était écrit nulle part

**Sa consigne :** *« il y a six sessions qui tournent en même temps ; donc
organisez-vous, vous êtes la même application »*. Ce qui suit ne remplace pas
les règles ci-dessus : il s'ajoute, parce que ces trois-là ont été payées en
temps ce soir-là et que rien ne les disait.

**A. REGARDER LES AUTRES BRANCHES AVANT D'OUVRIR UN LOT.** Le même après-midi,
deux sessions ont codé **la même chose** — lire les places des zones sur le
croquis. Une des deux implémentations a été jetée, et il s'en est fallu de peu
qu'il reste deux façons de lire un croquis, ce que le §3 interdit. Trente
secondes suffisent :

```bash
git branch -r --sort=-committerdate | head            # qui a bougé récemment
git log -1 --format='%ar · %s' origin/claude/<branche>
```

Si une branche touche le même coin de l'application, lire son dernier commit
**avant** d'écrire. On ne demande la permission à personne — on évite de payer
deux fois.

**B. UN PARAGRAPHE NEUF D'`ARCHITECTURE.md` S'AJOUTE À LA FIN, JAMAIS AU
MILIEU** — et son numéro n'est pas réservé. Ce soir-là, §147 et §148 ont été
pris deux fois le même jour : quatre renumérotations, à quatre fusions. Pire, un
§149 écrit ailleurs était **recollé à chaque fusion**, parce que les deux
historiques ne le plaçaient pas au même endroit.

| Ce qu'on trouve à la fusion | Ce qu'on fait |
|---|---|
| deux paragraphes portant le même numéro | renuméroter **le sien** — celui qui n'est pas encore sur `main` |
| le même paragraphe à deux endroits | garder **la place de `main`**, y reporter son ajout, supprimer l'autre |

La seconde ligne est la seule qui arrête le doublon : tant qu'on garde sa propre
place, chaque fusion le recrée.

**C. UNE SEULE EN-TÊTE DE DATE DANS `CHANGELOG.md`.** Trois « `## 2026-08-23` »
ont dû être réunis à la main ce soir-là. Une entrée neuve se glisse **sous
l'en-tête du jour qui existe déjà** ; on n'en crée jamais un second.

**Et ce qui N'EST PAS partagé, contre l'intuition :** la machine. Chaque session
a son propre conteneur — sa base, son Redis, son port 3000. Un serveur orphelin
qui tient le port 3000 est **le sien**, jamais celui d'à côté : le chercher chez
les autres fait perdre le temps qu'on croyait gagner. Le seul bien commun, c'est
`main`.

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
