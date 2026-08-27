# Prochaines tâches

Par ordre de priorité. Une tâche terminée se **barre** avec sa date plutôt que
de disparaître : savoir qu'elle a été traitée évite de la rouvrir.

Ce fichier porte le travail de **développement**. Ce qui bloque et n'avancera
pas en codant est dans `docs/A-FAIRE.md` — tenu pour le patron, dans son
langage, et rien n'y entre sans son accord.

---

## Dictée → devis : ce que l'audit du 26 août a trouvé

### Un dossier pour ChatGPT à chaque étape

**Sa consigne du 26 août 2026 :** *« Je vais tout montrer à ChatGPT, donc fais-moi
des dossiers que je peux lui copier-coller à chaque fois. »*

`docs/pour-chatgpt/` — un fichier numéroté par étape, autonome (ChatGPT n'a pas
le dépôt), qui se termine par des questions dont au moins une lui demande de nous
contredire. La convention tient dans `docs/pour-chatgpt/README.md`.

**Ce ne sont pas des documents de mémoire** : ce sont des instantanés, ils ne se
tiennent pas à jour et ne se corrigent pas après coup. Un verdict qui se révèle
faux est repris **dans le dossier suivant**, noir sur blanc (`CLAUDE.md` §2 bis).
Les tenir à jour recréerait la règle en double que `CLAUDE.md` §3 interdit.

### ⏰ À LUI RAPPELER : la liste complète des travaux qu'il vend

**Sa réponse du 27 août 2026 :** *« Oui j'en vend mais attend on créera une
liste complète ensuite si tu le veux faudra que tu me le rappelle. »*

Il vend donc bien de la **plantation** et de la **clôture** — deux natures qui
n'existent **nulle part** dans le dépôt : ni dans `src/lib/lignes-vendables.ts`, ni
dans `src/lib/prix-attribuable.ts`, ni dans `src/lib/lecons-prix.ts`. Le vocabulaire
réellement présent se limite à : abattage, élagage, haie, dessouchage, fendage,
grumes, broyage, évacuation, billonnage.

**Ce n'est pas une tâche pour lui : c'est une dette de notre côté.** Il a
demandé qu'on le relance, pas qu'on lui laisse le soin d'y penser. Une session
qui reprend ce chantier commence donc par le lui redemander — en lui montrant la
liste ci-dessus, pour qu'il ait juste à dire ce qui manque.

**Ce qui reste bloqué tant qu'elle n'existe pas.** Les trois consommateurs
ci-dessus continuent de deviner la nature par expressions régulières sur le
libellé, alors que la colonne `prestations.nature` existe depuis le lot B
(2026-08-27). On ne peut pas la brancher sur une liste inventée : une nature
absente de la liste ferait retomber le travail dans le fourre-tout `principal`
(P3), c'est-à-dire sur la ligne d'abattage — exactement le défaut que l'audit a
mesuré. **Ne pas inventer les natures manquantes** (`CLAUDE.md` §4 : « inventer
une prestation » est interdit) ; les lui demander.

### ✅ La correction complète est faite — 27 août 2026

**Sa consigne du 27 août :** *« Je ne veux plus découper cette correction en une
succession de micro-lots nécessitant ma validation. Tu as l'autonomie technique
pour terminer la correction complète. »*

Fait, en une passe. Le détail complet est dans `ARCHITECTURE.md` §191 ; le
dossier à retransmettre est `docs/pour-chatgpt/07-correction-complete.md`.

| | État |
|---|---|
| **P0** — arrêter la pollution de la grille | ✅ 26 août, et porté sur les colonnes le 27 |
| **P1** — porter la quantité jusqu'au bout | ✅ elle atteint enfin le CALCUL, pas seulement la base |
| **P2** — donner un sens à « comparable » | ✅ signature V2, à côté de la V1 jamais réécrite |
| **P3** — casser le fourre-tout `principal` | ✅ référentiel des natures ; une nature inconnue garde sa ligne |
| **P4** — dire pourquoi une ligne est à 0 € | ✅ elle n'est plus à 0 € : elle est « à chiffrer » |
| **P5** — ne plus tronquer en silence | ✅ `stop_reason` lu, forme vérifiée, plafond relevé |
| **P6** — vocabulaire au transcripteur | ⛔ hors périmètre (sa décision) ; la branche catalogue reste ouverte |

**UNE SUITE NAVIGATEUR ENCORE ROUGE, ET ELLE N'EST PAS DE CE LOT.**
`test-reste-equipes-e2e.ts`, second cas : *« 1 date(s) retenues au lieu de deux :
rien à comparer »*. **Prouvé antérieur** : la suite échoue à l'identique sur
`ed8f074`, avant la première ligne du lot dictée → devis.

Ce qui a été établi, pour ne pas repartir de zéro :

* les deux jours d'essai sont bien dans le même mois (30 et 31 août) — ce n'est
  donc pas le passage de mois de `caseDuJour` ;
* **avant même le second clic, DEUX dates sont déjà retenues** : la case du
  30 août, plus deux boutons « proposée » hors calendrier. Le troisième clic
  bute donc sur le plafond de deux dates, et l'une saute ;
* c'est la **quatrième** version de ce cas à rougir sur du code juste (les trois
  premières sont racontées dans le fichier). Le produit n'est pas en cause.

Une correction a été tentée puis **retirée** : faire choisir deux jours du même
mois ne suffit pas, et livrer une modification de contrôle non éprouvée est pire
que le rouge lui-même.

**✅ ~~Une suite navigateur rouge, antérieure à ce lot~~ — réparée le 27 août 2026.**
`test-carte-reponse-mene-au-geste-e2e.ts` prenait le dernier jour libre du
calendrier pour jouer « le client accepte sur une AUTRE date ». Ce jour tombait
parfois pile sur l'une des dates proposées : l'acceptation n'était alors plus une
contre-proposition, et `notificationsPatron` ne produit volontairement aucune
carte dans ce cas. **Le contrôle accusait le produit d'un défaut qui n'existait
pas.** Il choisit désormais un jour distinct des dates proposées, et refuse de
conclure s'il n'en trouve aucun.

**Ce qui reste ouvert, et pourquoi :**

- **La question métier des unités de comptage.** « Dessouchage de DEUX souches
  de 60 cm » : le prix de grille est celui d'UNE souche. Multiplier serait
  inventer un prix, ne pas multiplier facture une souche pour deux. Le
  comportement d'aujourd'hui est conservé et **l'écran pose la question** ;
  c'est à lui de trancher.
- **L'écran de correction d'une mesure.** Le chemin serveur existe et il est
  éprouvé (`corrigerMesurePrestation`) ; la planche attend sa réponse :
  `https://florianmarrins0978-svg.github.io/Atlas-app/corriger-une-mesure.html`
- **La branche catalogue morte** (`chiffrerChantier` appelé sans
  `motCleCatalogue`) : les mots qu'il range dans *Réglages → Catalogue* n'ont
  toujours aucun effet sur ses devis dictés. À brancher, ou à supprimer et le
  dire.
- **Ce qui n'a pas pu être éprouvé ici, faute de clé** : ce que le modèle rend
  vraiment pour `nature` et `espece`, Whisper, et le `stop_reason` réel. Le §15
  du dossier 07 les liste, et le §16 donne le seul test à jouer sur son espace.

---

### Le plan ajusté après cartographie (26 août 2026)

**Historique — ce qui suit décrit l'état d'AVANT la correction du 27 août.**
Conservé parce que le chemin explique les décisions ; ce qui fait foi
aujourd'hui, c'est le tableau ci-dessus.

`docs/audit-dictee-devis-cartographie.md`. Les suites A→H sont écrites et
rouges ; la batterie complète est à 247/249, et les deux échecs sont elles.

**Ce qui a changé par rapport au plan d'hier :**

- **P6 « vocabulaire au transcripteur » est RETIRÉ** — le patron l'a mis hors
  périmètre : *« ne modifie ni Whisper ni les paramètres de transcription dans
  ce lot »*. La seconde moitié de P6 (la branche catalogue) reste ouverte, mais
  **elle n'est pas morte** : `src/server/ai/tools/calculer-chiffrage.ts` la fait vivre pour
  l'assistant. Seule la dictée ne l'appelle pas.
- **P1 se dédouble.** La migration peut partir seule ; la quantité écrite sur la
  ligne ne peut PAS partir sans nettoyer le libellé le même jour, sinon la
  feuille de chantier affiche « Haie (tout genre) (800 ml) — 800 »
  (`tachesDuChantier`, `devis.ts` l. 584).
- **H commence par l'interface, pas par le plafond.** `stop_reason` est jeté par
  le fournisseur Anthropic ; `ResultatLLM` ne porte que `{ succes, texte }`.
  Relever `max_tokens` sans porter la marque de coupure ne ferait que déplacer
  le silence.

**Six migrations additives**, aucune destructive : M1/M2 (modèle métier sur
`prestations`), M3 (`prestation_id` sur `lignes_prix` — le lien manquant),
M4 (état « non chiffré »), M5 (`unite` sur `lignes_devis`), M6 (`signature_v2`
**à côté** de la V1, jamais à la place).

**Une question ouverte pour le patron** (§6 du document) : rendre le prix
nullable toucherait `lignes_facture`, donc la facturation, qu'il a mise hors
périmètre. Un drapeau sur `lignes_prix` seule y reste. À trancher avant M4.

**Le seuil de comparabilité ne sera pas inventé.** Rien dans le dépôt ne
justifie un ×2 ou un ×5 ; ce que les données permettent, ce sont des critères
éliminatoires. Le facteur d'écart sur la quantité demande de regarder ses vrais
devis — à signaler plutôt qu'à fixer au jugé.

Lecture seule, **aucun code écrit** — le patron a demandé de ne rien corriger
avant son feu vert. Le détail complet, fichiers et numéros de ligne, est dans
`docs/audit-dictee-devis.md`. Ce qui suit est la liste de travail qui en sort,
dans l'ordre où il faudra la prendre.

**✅ ~~P0 — arrêter la pollution de la grille et de la mémoire de prix~~ — fait le 26 août 2026** (`src/lib/prix-attribuable.ts`, `docs/pour-chatgpt/03-lot-A-p0.md`). Batterie 248/250, aucune régression. Ce qui suit décrit le défaut tel qu'il était :
`apprendrePrixGrille` (`services/apprendre-grille.ts:51`) et `retenirLecon`
classent une ligne au **premier mot de métier reconnu**. Or la ligne principale
d'un devis dicté porte souvent DEUX prestations (« Tonte de la pelouse (1200 m²)
\nÉrable — démontage en rétention ») : le motif `ABATTAGE` répond, et le prix du
lot entier part dans la case abattage × rétention × ⌀ de sa grille. Il revient
ensuite tout seul sur chaque démontage, avec l'autorité de l'expérience, et rien
ne le dit à l'écran. **Ne rien enseigner depuis une ligne qui porte plus d'une
nature.** Fonction pure, quelques lignes, aucune migration — et le contrôle doit
savoir rougir contre la version d'aujourd'hui.

**P1 — porter la quantité jusqu'au bout.** Le modèle rend correctement
`quantite: "800"` / `unite: "ml"` ; `libelleAvecQuantite`
(`ai/services/brouillon-service.ts:169`) les **recolle au libellé** parce que la
table `prestations` (`schema.ts:627`) n'a qu'une colonne de texte. Puis
`ajouterLignePrix` (`repositories/lignes-prix.ts:35`) écrit `quantite: "1"` en
dur. Le « QTÉ = 1 » qu'il voit n'est pas une décision de forfait : c'est une
colonne jamais renseignée sur ce chemin. Colonnes `quantite`/`unite` sur
`prestations`, écriture jusqu'à `lignes_prix` — **migration additive**.

**P2 — donner un sens à « comparable ».** `signatureLecon`
(`lib/lecons-prix.ts:84`) construit une clé de trois jetons — nature | technique
| tranche de diamètre — comparée par **égalité de chaîne exacte** en SQL. Ni
espèce, ni quantité, ni unité, ni grandeur : 50 ml et 800 ml de haie ont la même
clé, d'où les « 15 chantiers comparables ». Ajouter l'espèce et l'ordre de
grandeur, refuser le rappel au-delà d'un facteur d'écart — sa règle déjà écrite
dans le module : *mieux vaut aucun rappel qu'un rappel faux*.
**Attention : les clés sont STOCKÉES dans `lecons_prix.signature`.** Changer leur
format sans migration orpheline toute sa mémoire de prix.

**P3 — casser le fourre-tout `principal`** (`lib/lignes-vendables.ts:170`). Cinq
cases seulement : haie, fendage, dessouchage, grumes, et `principal` qui ramasse
tout le reste — tonte, plantation, désherbage, clôture. Le découpage a été conçu
pour *détacher* ce qu'un client peut refuser, pas pour *distinguer* deux travaux
sans rapport. Une nature par prestation, une ligne par nature.

**P4 — dire sur le devis pourquoi une ligne est à 0 €.** Quand `repartir` rend
`null` (`proposition-prix.ts:533`), toutes les détachables sont forcées à `"0"`
et l'explication reste sur l'écran Prix, dans `donneesManquantes` — jamais sur le
devis qu'il regarde. Même raisonnement que `CLAUDE.md` §4 ter pour l'arrosage :
une réserve tue vaut un mensonge. Signaler aussi un prix proposé très éloigné du
seul comparable connu (550 € en mémoire, 840 € proposés, et rien ne le dit).

**P5 — ne plus tronquer les longues dictées en silence.**
`providers/llm/anthropic.ts:178` borne l'extraction à `max_tokens: 1024`, pour
une sortie qui grandit avec le nombre de prestations. Coupée en plein JSON, elle
bascule sur `lireLitteralement` **sans qu'aucune trace ne distingue ce cas d'une
panne de clé**. Relever le plafond, et journaliser la troncature.

**P6 — le vocabulaire au transcripteur, et la branche catalogue morte.**
`whisper-1` est appelé sans le moindre terme de métier
(`providers/transcription/openai.ts:22`), alors que `termes_metier` part déjà au
modèle d'extraction. Et `chiffrerChantier` est appelé **sans `motCleCatalogue`**
(`chiffrage/proposition-prix.ts:336`) : `rechercherCartes` et `historique_prix`
ne sont donc jamais consultés depuis la dictée — les mots qu'il range dans
*Réglages → Catalogue* n'ont aucun effet sur ses devis dictés. La brancher, ou la
supprimer et le dire ; un chemin mort qui a l'air vivant coûte plus cher qu'un
chemin absent.

**Les contrôles à écrire AVANT de corriger** sont listés au §13 du document —
tous rouges aujourd'hui, tous écrits sur une règle et jamais sur un libellé
d'écran (`CLAUDE.md` §5 bis).

**Ce qu'une correction peut casser**, et qui ne se devine pas : les clés de
`lecons_prix` (stockées), les formats `⌀ 45 cm` et `12 m de haut` que
`mesures-arbre.ts` **relit** pour trouver la case de la grille, les identifiants
`<sujet>#<rang>` persistés dans `precisions_chantier`, le report des précisions
qui retrouve une prestation par le début de son libellé, et l'ordre des natures
qui doit rester le même dans `apprendre-grille.ts` et `lignes-vendables.ts`.
Le §12 du document les détaille.

## ✅ ~~Le format des numéros de devis et de factures~~ — fait le 26 août 2026

~~Sa demande du 26 août : « dans la catégorie facture il faut rajouter le format
de numéro ». Cinq formats au choix, le compteur qui repart au 1ᵉʳ janvier, et
surtout le millésime qui n'est plus écrit en dur.~~ `ARCHITECTURE.md` §189.

**Ce qui reste ouvert, et qui n'est pas ce lot :** le numéro de la première
facture d'une entreprise qui reprendrait une suite existante. Aujourd'hui elle
repart de 1 ; un artisan qui migre depuis un autre logiciel voudra continuer à
0148. Il ne l'a pas demandé, et rien ne presse — mais le jour où il le
demandera, c'est une colonne de départ sur `entreprise_compteurs`, pas un
nouveau format.

## L'agent : ce qu'il ne sait pas encore faire

**FAIT le 26 août 2026** pour l'essentiel (`ARCHITECTURE.md` §188). Ce qui reste
ouvert, et qu'il faudra sans doute lui demander :

- **Des gestes non couverts** : composer la fiche d'entretien, régler les
  documents (validité, acompte, mentions), gérer les absences d'équipe, lancer
  un plan d'arrosage, créer un client SANS chantier, supprimer un chantier ou un
  tarif. Chacun est une entrée de plus dans `TypeActionProposee` et un `case`
  dans `appliquerPropositionsAction` — le patron est posé.
- **Le filtre de périmètre attrape le cas franc, pas la totalité.** Une question
  du dehors sans marque connue passe au modèle, qui a la consigne. S'il signale
  une réponse hors-sujet, c'est une marque à ajouter dans `MARQUES_DU_DEHORS` —
  **jamais** un mot ambigu, et jamais au prix d'un faux positif.
- **La formulation d'un vrai modèle n'a pas été vue ici** (aucune clé) : la
  chaîne entière est éprouvée par le fournisseur `dev`. À regarder sur son
  espace, en lui demandant trois ou quatre gestes.

---

## ⏳ `test-envoi-client-e2e.ts` — deux cas rouges, et ce n'est PAS une régression

**Le 26 août 2026**, dans la batterie du lot « rôles et accès » :

    ❌ le patron ne propose jamais plus de deux dates
       pas assez de jours acceptables (1)
    ❌ SANS RIEN TOUCHER, la cliente peut proposer un jour
       pas assez de jours libres au calendrier (1)

**Vérifié avant de conclure, et dans cet ordre** — c'est ce qui compte ici, le
reste n'est qu'une hypothèse :

1. **rejouée seule**, sur l'arbre du lot : rouge à l'identique (donc pas la
   charge de la batterie, contrairement à `test-lecons-prix-e2e`) ;
2. **rejouée seule après un jeu de démonstration NEUF** (base vidée, `seed.ts`
   rejoué) : rouge à l'identique (donc pas une pollution laissée par les suites
   précédentes) ;
3. **rejouée seule sur `origin/main`**, sans une ligne du lot : **rouge à
   l'identique**. C'est la seule des trois qui tranche.

**Ce n'est donc pas ce lot**, et le dire noir sur blanc évite qu'une prochaine
session le cherche là où il n'est pas. Ce qui reste à faire, c'est de comprendre
pourquoi le jeu de démonstration ne laisse plus qu'**un** jour libre là où ces
deux cas en demandent deux : le calendrier du seed s'est-il rempli, ou la règle
de capacité a-t-elle changé ? Le message dit le symptôme, pas la cause.

**Ce que ça ne bloque pas :** rien du produit. Ces deux cas éprouvent que le
client peut proposer une date — le refus vient d'un calendrier trop plein dans
les DONNÉES d'essai, pas d'un écran cassé.

**Et un TROISIÈME contrôle dépend de la charge**, trouvé le même jour :
`test-reduction-devis-e2e.ts`, sur *« un appui rend le prix plein TOUT DE SUITE,
avant toute écriture »* — rouge en batterie, **vert rejoué seul**. Il lit l'écran
juste après un appui, avant que l'action serveur n'ait répondu : sous cent
suites, la réponse arrive avant la lecture et le cas s'inverse.

Avec `test-lecons-prix-e2e` (§ plus bas) et la suite du veilleur, cela fait
**quatre** contrôles qui rougissent au hasard de la machine. C'est le vrai sujet,
et il grossit : un rouge qui tombe au hasard apprend à ignorer le rouge, et l'on
perd alors tout ce qu'il surveille. Ce qu'il faut : attendre un SIGNAL — la
réponse du serveur, un attribut qui change — jamais un instant.

---

## ~~« Donner un accès » : sa réponse attendue, A ou B~~ — **RÉPONDU ET CODÉ le 26 août 2026**

**Sa réponse : « B, tu peux coder ».** L'écran vit à `/reglages/equipe/nouveau`,
la liste ne porte plus de formulaire, le mot de passe s'écrit deux fois avec un
œil sur chacune, et le rôle choisi est teinté au lieu d'être un aplat plein.
Détail dans `CHANGELOG.md`. Ce qui suit est gardé pour le chemin.

Planche : **https://florianmarrins0978-svg.github.io/Atlas-app/donner-un-acces.html**

Ses trois reproches du 26 août 2026 sur l'écran livré le matin (l'œil et la
double saisie du mot de passe, le bouton noir confondu avec la pastille de rôle,
la démarcation avec son propre compte). Les deux propositions ne diffèrent que
sur la SÉPARATION : **A** une carte posée sur la liste, **B** un écran à lui
seul. Le reste — œil, double saisie, rôle teinté au lieu de noir — est commun
aux deux et ne se rediscute pas : il vient de décisions déjà prises.

**Rien n'est codé tant qu'il n'a pas répondu.** L'écran de production porte
encore le défaut qu'il a photographié.

## Un commercial doit LIRE les tarifs sans pouvoir les changer

*Né du lot « rôles et accès » du 25 août 2026, et laissé ouvert délibérément.*

La règle est du patron, le 13 août : *« il lit les tarifs, il ne les change
pas »*. Elle n'est **pas** tenue aujourd'hui : `/reglages/tarifs` et
`/reglages/prix` refusent tout compte qui n'est pas patron, exactement comme
avant le lot. Un commercial ne voit donc pas les grilles qu'il est censé
employer pour chiffrer.

**Ce que ça demande, et pourquoi ça n'a pas été fait dans la foulée :** rendre
ces deux écrans *lisibles sans être modifiables* est un travail d'ÉCRAN — que
devient un champ de prix qu'on ne peut pas toucher, que devient le bouton
« ajouter une ligne », que lit-on à la place. Cela se dessine avant de se coder
(`CLAUDE.md` §3 bis), et cela se montre au patron.

**Ce qui n'est PAS en jeu :** l'écriture est déjà fermée côté serveur. Les
actions de tarifs et de grille portent `exigerProprietaire` depuis le 23 août —
ouvrir la lecture ne rouvrira rien.

## Trois suites navigateur rougissent SOUS LA BATTERIE et passent seules

**Constaté le 26 août 2026**, sur deux batteries complètes de suite :
`test-fiche-chantier-e2e`, `test-lecons-prix-e2e` et `test-planning-vers-facture-e2e`
tombent en batterie et rendent **toutes trois 100 % vert rejouées seules** —
vérifié une par une. Ce n'est jamais la même qui tombe d'une batterie à l'autre.

C'est la première des deux causes écrites en tête de `HANDOVER.md` : un délai
plutôt qu'un signal. Sous les cent douze suites, cette machine met plus
longtemps que le délai posé — quinze secondes pour un écran, trente puis
soixante pour une action serveur.

**Ce que ça coûte, et pourquoi ce n'est pas rien :** une batterie qu'on prend
l'habitude de voir rouge cesse d'être lue, et le jour où elle attrape un vrai
défaut, personne ne la croit.

**Ce qu'il faudrait, pour qui reprend :** remplacer ces attentes par un signal
(la réponse du serveur, la classe posée par le composant) plutôt que d'allonger
les délais un à un — allonger ne fait que repousser le seuil, et la machine
suivante sera plus lente encore.

---

## `test-fiche-pendant-relance.ts` rougit sur `main`, et ce n'est pas ce lot

**Constaté le 25 août 2026.** La batterie complète rend `232/233` : seule
`scripts/test-fiche-pendant-relance.ts` tombe, sur son deuxième cas —
*« le veilleur est bien bloqué à relancer — sans quoi la suite ne prouve rien »*,
avec la phrase *« le veilleur n'a jamais tenté de relance : le montage ne
reproduit pas le cas réel »*.

**Elle tombe à l'identique sur `origin/main`**, éprouvé dans un arbre de travail
séparé au commit `77e0073` — ce n'est donc pas une régression du lot des flèches,
et c'est écrit ici plutôt que tenu sous silence : une batterie qu'on prend l'habitude de voir
rouge cesse d'être lue.

**Ce qu'elle défend, et pourquoi ça compte** (`CLAUDE.md` §1 bis) : la fiche
d'état de son espace doit continuer d'être publiée PENDANT que le veilleur
relance le serveur. Le premier cas passe ; c'est le **montage** de la suite qui
ne parvient plus à mettre le veilleur en situation de relance. Une suite dont le
montage ne reproduit plus le cas réel rend un vert qui ne prouve rien — c'est
exactement ce que son deuxième cas refuse, et il a raison de refuser.

À reprendre par qui touche au veilleur : la suite est juste, c'est son décor qui
a vieilli.

---

## Le mode d'emploi de l'assistant : le tenir vivant

**FAIT le 25 août 2026** pour l'essentiel (`ARCHITECTURE.md` §180). Ce qui reste,
et qui ne se règle pas en une fois :

- **Les fiches couvrent les écrans principaux, pas encore chaque recoin.**
  Manquent notamment : le détail de l'écran Réglages → Devis & factures (chaque
  réglage un par un), les mesures de la grille de prix, l'écran d'abonnement, et
  la fiche du diagnostic végétal une fois la photo prise. Chaque ajout se prouve
  contre le code, comme les autres.
- **La formulation d'un vrai modèle n'a pas été vue ici** (aucune clé) : la
  chaîne entière est éprouvée par le fournisseur `dev`. À regarder sur son
  espace, en lui posant trois ou quatre « comment je fais pour… ».
- **Quand il signale un geste faux, c'est une fiche à corriger**, pas une
  consigne à ajouter au modèle.

---

## ~~Photographier son devis / sa facture pour en reprendre l'allure~~ — FAIT le 25 août 2026

**FAIT.** L'écran Réglages → Documents porte désormais, en tête de « L'allure de
mes devis », deux boutons *Photographier mon devis / ma facture* (appareil photo
**ou** photothèque). La lecture vit dans `src/server/ai/services/lire-allure-devis.ts`
(même patron que `lire-ticket.ts`), l'action `reprendreAllurePhotoAction` fusionne
le lu dans l'allure et les conditions déjà en base, et l'écran montre ce qui a été
repris et sa réserve. La photo est nettoyée de ses métadonnées comme le logo.

**Reste NON vérifié ici, et il faut le dire :** l'appel réel au fournisseur de
vision demande une clé, absente de cet environnement. La fonction PURE de lecture
est éprouvée (`scripts/test-lecture-allure-devis.ts`, 0 échec) ; **la lecture d'un
vrai devis se prouve sur son espace, avec sa clé, comme la dictée.**

<details><summary>Contexte d'origine</summary>

**Sa demande :** *« faut également que l'utilisateur puisse prendre la photo de
son devis et que l'outil recopie trait pour trait son devis, pareil pour sa
facture »* — venue juste après *« on comprend rien, trop compliqué pour modifier,
faut simplifier tout ça »* sur l'écran Réglages → Documents (allure + message).

**Ce que ça remplace, et pourquoi c'est une simplification.** Aujourd'hui il
règle à la main le logo, la typographie, la couleur et le message (un écran de
près de 1000 lignes qu'il trouve illisible). L'idée : il photographie un de ses
devis existants, et l'appli **en tire l'allure** pour ses futurs documents — le
long réglage manuel disparaît derrière un seul bouton.

**Franchise à tenir, dite le 25 août :** « trait pour trait » à l'identique n'est
ni faisable ni souhaitable — une photo n'est pas modifiable, et l'appli doit
produire un vrai PDF propre (bon lien, bons montants). Ce qu'on reproduit, c'est
l'**allure** et les **mentions**, pas une copie pixel.

**Ce qu'il a tranché (25 août)**, sur trois choix proposés :

| L'appli reprend de la photo | Retenu ? |
|---|---|
| l'allure : logo, couleurs, police, mise en page | **oui** |
| les mentions : conditions de paiement, mentions légales, politesse | **oui** |
| les lignes et les prix de ce devis-là | **non** |

**Précisions du 25 août (sur la maquette) :** l'entrée doit proposer
**l'appareil photo OU la photothèque** — son devis est parfois déjà une photo
dans sa galerie. Et **« régler à la main » a été retiré** : il a demandé à quoi
ça servait, et si la photo fait tout, la porte de secours ne sert plus.

| | |
|---|---|
| ce qu'il faut | un écran « Photographier mon devis » (appareil photo **ou** photothèque), la lecture par l'IA vision (le même patron que `lire-ticket.ts` et le croquis d'arrosage), et l'écriture du résultat dans l'allure (`allure-documents.ts`) et les conditions (`conditions-documents.ts`) déjà en base |
| qui peut le faire | moi — c'est du code, la brique vision existe |
| d'abord | **la maquette** (§3 bis), qu'il a demandée avant tout code |
| pas vérifiable ici | la lecture d'image réelle demande une clé de vision, absente de cet environnement — à jouer sur son espace |

</details>

---

## Le devis et la facture n'ont pas encore le refus d'adresse locale (24 août 2026)

## ~~Le devis et la facture n'ont pas encore le refus d'adresse locale~~ (fait le 24 août 2026)

Le lien envoyé au client prenait l'adresse du navigateur qui l'avait fabriqué —
et son client a reçu une page morte sur `localhost` (`ARCHITECTURE.md` §169).

**Ce qui est fait pour les quatre écrans** : l'adresse se calcule au même
endroit, et `ATLAS_URL_PUBLIQUE` la commande quand elle est posée.

**Réglé le même soir, sur sa réponse « oui tu peux le faire ».** Les cinq
gestes qui envoient un lien à un client portent le refus — fiche de chantier
(envoi et rapport rouvert), devis parti, message tout prêt de la facture, envoi
de la facture, envoi depuis le devis complet.

Ce qui reste vrai et mérite d'être su : le refus arrive APRÈS l'enregistrement,
partout. Un devis envoyé reste envoyé, une facture arrêtée reste arrêtée — on ne
défait pas une écriture comptable pour une histoire d'adresse.

---

## ⚠ Six numéros de section en DOUBLE dans `ARCHITECTURE.md` (25 août 2026)

`## 125`, `## 134`, `## 135`, `## 136`, `## 164`, `## 165` désignent chacun
**deux sections différentes**. Constaté sur `main` nu, sans modification locale :
ce n'est la faute d'aucun lot en cours.

**Ce que ça coûte :** un renvoi « `ARCHITECTURE.md` §164 » écrit dans le code ne
désigne plus rien de sûr — et c'est par ces renvois qu'on retrouve le POURQUOI
d'une décision. Le dépôt en compte des dizaines.

**Pourquoi ce n'est pas corrigé ici :** renuméroter suppose de reprendre tous les
renvois qui pointent dessus, dans un fichier où trois ou quatre sessions écrivent
en même temps. Fait au milieu de leurs lots, cela produirait des conflits sur
chacun et des renvois faux partout.

**À faire d'un coup, par une session qui n'a que ça à faire** : renuméroter les
six seconds, corriger les renvois, et poser un contrôle qui refuse un numéro
déjà pris — sans quoi la même dérive recommence dès la semaine suivante.


## ⚠ `verifier-maquette-message-et-allure` est ROUGE sur main (24 août 2026)

```
❌ Les planches du 23 août ne tiennent pas :
   • le fond de départ est rgb(250, 249, 245) au lieu du crème d'aujourd'hui
   • le retour ne rend pas le crème : rgb(250, 249, 245)
```

**Ce n'est pas une régression d'un lot en cours** : vérifié dépôt propre, sans
aucune modification locale — il tombe déjà. Il porte sur les planches
« Mon message au client » et « Allure bleutée », livrées par une autre session le
23 août.

**Laissé à la session qui les a écrites**, qui saura si c'est le contrôle ou la
planche qui a raison. Signalé ici plutôt que corrigé au jugé : toucher à l'allure
d'une planche qu'on n'a pas dessinée, c'est risquer de défaire un choix du patron
qu'on ne connaît pas.


## ~~Supprimer une fiche en cours, et retrouver où la fiche se compose~~ (fait le 24 août 2026)

Ses deux phrases du jour. Les deux sont livrées — `ARCHITECTURE.md` §168.

**Ce qui reste ouvert, et qui n'est PAS un oubli :** un rapport déjà envoyé ne
se supprime toujours pas, et c'est une décision, pas une lacune. Son lien vit
chez le client. Le jour où il demandera de pouvoir en retirer un, la question à
lui poser n'est pas « peut-on ? » mais **« que doit lire le client qui rouvre
son SMS ? »** — une page morte, ou une page qui dit que le rapport a été
retiré. Le second demande une colonne ; le premier ne demande rien et ment.

---

## ⚠ `ARCHITECTURE.md` porte SIX paragraphes pour trois numéros (23 août 2026)

Trois numéros sont pris deux fois, et cela existe déjà sur `main` — ce n'est
donc pas une fusion à rattraper, c'est un état à corriger une fois :

| N° | Le premier | Le second |
|---|---|---|
| **134** | Chercher un client : la règle vit hors de l'écran | Le troisième document : une option dans le moteur |
| **135** | Un écran atteint depuis deux endroits | Le diagnostic végétal : le modèle observe, la base décide |
| **136** | Deux constructions au démarrage | « Choisir la date » : l'écran du milieu disparaît |

C'est exactement ce que `CLAUDE.md` §6 B annonce : *« son numéro n'est pas
réservé »*, six sessions écrivent en parallèle, et deux d'entre elles ont pris
le même à quelques heures d'écart. La règle dit de renuméroter **le sien** — mais
ici les deux sont sur `main` depuis, et plus aucune n'est « la sienne ».

**Ce qu'il faut faire, et pourquoi ce n'est pas urgent :** renuméroter le second
jeu à la suite du dernier paragraphe existant, et corriger les renvois qui le
citent (`grep -n '§13[456]'`). Un renvoi vers « §135 » ne dit aujourd'hui pas
lequel des deux — c'est une gêne à la relecture, pas un défaut de produit.

**Ce qu'il ne faut PAS faire : le corriger au milieu d'un autre lot.** Toucher
onze mille lignes d'`ARCHITECTURE.md` pendant que cinq sessions y ajoutent des
paragraphes fabrique exactement les conflits que le §6 décrit. À faire seul, et
poussé aussitôt.

## ⚠ `ss` ne rend RIEN dans cet environnement — un port se mesure autrement (23 août 2026)

**Payé trois batteries d'affilée ce soir**, chacune tombée sur un
« Port 3000 déjà utilisé » alors que le port venait d'être déclaré libre.

`ss -lptn` ne rend **aucune ligne** ici : le conteneur n'a pas le droit de
rattacher une socket à son processus. La commande sort donc vide, sans erreur
et sans code de retour fâché — exactement le piège que le dépôt nomme
lui-même : **« un contrôle qui mesure ZÉRO ne mesure rien, et il est pire
qu'absent »** (`CLAUDE.md` §5). Trois fois de suite, « le port est libre » n'a
rien affirmé du tout.

Le vrai coupable était un serveur de captures lancé par cette session
même — `next dev -p 3000`, PID 3438, et son enfant `next-server` 3450.

**Ce qui mesure vraiment, ici :**

```bash
fuser -n tcp 3000            # rend les PID qui tiennent le port
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/   # 000 = personne
```

`fuser` nomme le processus, `curl` dit ce qu'un client voit. Les deux ensemble
tranchent ; `ss` seul ne tranche rien. Et devant un port occupé, chercher
**ses propres serveurs** avant de soupçonner la machine : une capture d'écran
prise plus tôt dans la session laisse un `next dev` derrière elle.
## Face ID — ~~à coder~~ **fait le 24 août 2026** (planche 94, réponse **B**)

Migration 0063, règles pures, second fournisseur `Credentials`, porte et écran
d'activation. Parcouru en navigateur (`test-face-id-e2e.ts`).
`ARCHITECTURE.md` §163.

**Ce qui reste, et qui ne dépend plus de nous :**

- **poser `ATLAS_RP_ID` le jour du déploiement** — sans elle, Atlas refuse
  d'enregistrer une clé en production (et le dit dans son journal). C'est
  volontaire : deviner le domaine depuis un en-tête que le client écrit serait
  la faute que le lot 1 vient de fermer sur `x-forwarded-for` ;
- **le faire essayer sur SON iPhone.** Rien ici ne peut le remplacer : la suite
  emploie l'appareil simulé de Chrome, qui exerce la vraie implémentation du
  navigateur mais pas la puce d'Apple ni la fenêtre d'iOS.

---

## Le type AUDIO n'est pas vérifié — signalé le 24 août 2026, non traité

Trouvé en dressant le tableau transversal des téléversements du lot 2B. Les
images voient leur **signature** vérifiée depuis ce lot ; les dictées, non : un
fichier annoncé `audio/webm` qui n'en est pas serait rangé.

**Ce qui borne la portée :** le type servi est dérivé de la clé (liste blanche,
jamais rien d'exécutable) et `nosniff` couvre toutes les routes. Ce qui reste
possible est de ranger un fichier inerte sous une extension audio.

**Non traité à dessein** : hors de M3 (aucune métadonnée d'image) et de M6
(aucune question de mémoire), et l'on n'ouvre pas un lot sans qu'il soit demandé.

---

## Audit de sécurité : ~~le lot 2~~ **fait le 24 août 2026**, et les suivants

Le **lot 1 est fait** — C1, E1, E2, E3, M7, M8 (`ARCHITECTURE.md` §162). Le
**lot 2 aussi** — M1 à M5, plus le croquis d'arrosage (`ARCHITECTURE.md` §165) ;
M6 n'avait pas lieu d'être. Ce qui suit vient du même audit et attend son tour.
Rien ici n'est théorique : chaque point a été constaté dans le code.

### Avant d'ouvrir Atlas à d'autres artisans

- **Sauvegardes.** Il n'y en a aucune. « Télécharger mes données » est un export
  manuel pour le patron, pas une sauvegarde. Il faut une sauvegarde automatique
  de PostgreSQL **et** du compartiment objet, plus **une restauration réellement
  jouée une fois** — un contrôle jamais vu réussir ne prouve rien (`AGENTS.md`).
  C'est ce qui rendait E1 grave : il n'y a pas de filet.
- **M11 — la double authentification**, et une session plus courte que trente
  jours (le défaut d'Auth.js s'applique aujourd'hui). Le lot 1 a durci le mot de
  passe et la temporisation ; c'est la marche suivante.

### ~~Les téléversements : quatre chemins, un seul fait bien~~ — **réglé le 24 août 2026**

Les quatre chemins font désormais la même chose (`ARCHITECTURE.md` §165). Les
constats sont barrés ci-dessous plutôt que supprimés : savoir qu'ils ont été
traités évite de les rouvrir.

- ~~**M2 — le type d'image n'est pas contrôlé** sur les photos de chantier
  (`photos-actions.ts`) ni sur les tickets de TVA : `startsWith("image/")`
  accepte `image/svg+xml`, et `/api/fichiers/[...key]` renvoie ce type tel quel.
  Un SVG ouvert en navigation directe exécute son script sur l'origine d'Atlas.
  **Le diagnostic végétal fait déjà tout bien** (`typeImageAccepte` +
  `retirerMetadonnees`) : il n'y a qu'à reprendre.~~
- ~~**M3 — les photos de chantier gardent leurs métadonnées**, coordonnées GPS
  comprises — donc l'adresse du domicile d'un client. Celles du diagnostic sont
  nettoyées, avec un commentaire qui explique pourquoi. Même correction.~~
- ~~**M1 — traversée de chemin** : `local-storage.ts` n'assainit pas le dossier
  alors que `s3-storage.ts` le fait, et le dossier contient un `chantierId` venu
  d'une action serveur. Vérifié : `../../../../tmp/x` sort de `.storage`. Le
  stockage local étant refusé en production, cela vise le banc — mais la clé
  ainsi fabriquée part ensuite dans l'archive ZIP de l'export.~~
- ~~**M4 — `lireLeCroquis` (arrosage) n'a aucune limite de débit**, ni liste
  blanche de type, ni retrait de métadonnées — alors que le diagnostic a les
  trois. Chaque appel est une facture chez le fournisseur de vision.~~

  *Nuance retenue le 24 août : le croquis N'EST PAS nettoyé de ses métadonnées.
  C'est un dessin sur une feuille, pas une photo de la maison du client, et il
  n'est jamais rangé — il part au fournisseur puis disparaît. Le type et la
  cadence, eux, sont posés.*

### Robustesse

- ~~**M5 — bombe de décompression** : `inflateRawSync` sans `maxOutputLength` dans
  `lire-classeur.ts`, sur un `.xlsx` téléversé.~~ **Fait le 24 août** — borne à
  32 Mo gonflés, plus une borne sur le nombre d'entrées et sur les décalages lus
  dans l'archive. `test-classeur-bombe.ts` assemble une vraie bombe.
- ~~**M6 — corps de requête non borné** : `/api/notes-vocales/[chantierId]` fait
  `formData()` avant toute vérification de taille, et la limite des actions
  serveur ne s'applique pas aux routes.~~ **Fait le 24 août** — `content-length`
  est lu avant `formData()`, et rend un 413. L'en-tête vient du client : c'est le
  premier rempart, pas le seul (`fichier.size` tranche ensuite).
- **M10 — dépendances** : 11 avis, dont Next lui-même (16.2.12 → 16.3.2) et
  `next-auth` encore en bêta sur le chemin d'authentification.

### Défense en profondeur

- **M9 — `users` n'a aucune RLS**, et `atlas_app` y lit `password_hash`. Le code
  se discipline (toute lecture bornée par `ctx.utilisateurId`), mais rien en base
  ne rattraperait un `where` oublié. Idem pour `audios_a_purger` et
  `photos_diagnostic_a_purger`, qui portent un `entreprise_id` sans politique.
- **M12 — `mettreAJourApplicationAction` n'exige pas le rôle propriétaire** :
  sur le banc, tout salarié peut tirer du code et redémarrer le serveur.
- **F1 à F13** — treize points mineurs, listés dans le rapport d'audit. Les plus
  utiles : **F6** (deux paires de migrations partagent un numéro — à traiter
  avant qu'un conflit réel n'arrive) et **F7** (les droits RGPD d'accès et
  d'effacement sont codés et testés, mais aucun écran ne les appelle).
- **Journal d'audit** : les connexions réussies, les changements de rôle, les
  exports et les effacements ne laissent aucune trace exploitable.

---


## ⏳ `verifier-maquette-message-et-allure.mjs` est rouge, et ce n'est pas l'arrosage

Constaté le 23 août 2026 au soir, sur `main` :

```
❌ Les planches du 23 août ne tiennent pas :
   • le fond de départ est rgb(250, 249, 245) au lieu du crème d'aujourd'hui
   • le retour ne rend pas le crème : rgb(250, 249, 245)
```

**Vérifié rouge AVANT le lot arrosage**, en mettant celui-ci de côté : il n'en
vient pas. Les planches sont `appli/mon-message-au-client.html` et
`appli/allure-de-mes-devis.html`, arrivées avec la branche
`claude/devis-dicte-ecrit-buttons-x7iw0c`.

**Écrit ici plutôt que corrigé au jugé** : le fond attendu est une décision de
cette maquette-là. La deviner ferait passer un contrôle au vert sur la mauvaise
couleur, ce qui est pire que rouge.

---


## ~~Arrosage : l'interface pour discuter le plan~~ — **FAIT le 23 août 2026** (`ARCHITECTURE.md` §167)

Le plan se dessine (`ARCHITECTURE.md` §150). Reste ce qu'il a demandé le 21 :
*« j'ai besoin que si l'utilisateur a besoin de te demander de faire une
modification, qu'il puisse le faire — une petite interface pour qu'il puisse
discuter avec toi »*, avec deux bornes qu'il a posées lui-même :

- **la discussion ne crée jamais un plan** ; elle ne fait que le modifier ;
- **pas de phrases pré-écrites** — *« il faut un endroit où on puisse discuter
  avec toi »*, donc un champ libre.

La maquette validée est `appli/arrosage-discuter.html`. Ce qui reste à trancher
avant de coder : la discussion agit sur les **paramètres** du calcul (marque,
famille d'arroseur, nombre de voies), jamais sur le dessin — un plan retouché à
la main ne se recalculerait plus.

---

## ⚠ « La cliente ne peut pas proposer de jour » — NON REPRODUIT (23 août 2026)

Son signalement : *« je n'ai pas coché la case pour que la cliente ne puisse pas
proposer de jour ; néanmoins elle ne peut quand même pas proposer de jour »*.
Capture à l'appui : deux dates, aucune option pour en proposer une autre.

**Cherché pour de bon, et NON REPRODUIT sur le code du jour.** Ce qui a été
vérifié, une chose après l'autre :

| Vérifié | Résultat |
|---|---|
| l'interrupteur à l'ouverture de la feuille | `true` |
| ce qui part en base sans y toucher, une date | `true`, et la cliente voit « je propose » |
| idem avec DEUX dates, comme sur sa capture | `true`, trois options offertes |
| l'état survit-il à un envoi annulé ? | **non** — il revient à `true` à chaque réouverture |
| un autre chemin crée-t-il un envoi ? | **non** — un seul appelant en production, à `?? true` |

Son envoi porte donc bien « non autorisé », et **seul un appui réel sur
l'interrupteur produit cela**. Deux explications tiennent, et rien ne permet de
trancher d'ici : l'interrupteur a été effleuré (il est juste au-dessus du bouton
d'envoi), ou son banc servait une version d'avant au moment de cet envoi.

**Ce qui a été livré :** le contrôle qui manquait sur SON chemin. Le refus était
éprouvé depuis « Choisir la date », l'autorisation depuis l'ancien écran
seulement — la moitié qui l'intéresse n'était pas tenue. Le nouveau cas a été vu
rouge sur son symptôme exact.

**Ce qui reste à trancher AVEC LUI :** après l'envoi, rien ne lui dit ce que sa
cliente pourra faire. Il l'a découvert en ouvrant le lien, et n'avait aucun moyen
de savoir s'il avait mal visé ou si l'application était en panne. Une maquette
avant de toucher à l'écran (`CLAUDE.md` §3 bis).


## Arrosage : lire les positions sur une vraie photo (23 août 2026)

`lire-croquis.ts` demande maintenant au modèle un repère en mètres, la position
de chaque zone et l'endroit de la nourrice. **Cela n'a été éprouvé sur aucune
photo** — cet environnement n'a pas de clé de vision (`AGENTS.md`). Le premier
essai sur son banc dira si le modèle sait tenir un repère cohérent ; s'il ne le
sait pas, le repli est une saisie à la main des positions, pas un placement
inventé.

---

## ~~Une note sur la feuille de chantier~~ — **TRANCHÉ le 23 août 2026 : A, codée**

Sa réponse à la planche 93 : *« oui prends A »*, et sur le PDF : *« non, elle
peut rester là, car les salariés auront accès au planning ; justement, c'est
pour cela que je voulait le devis sans les prix »*.

**Codé** : colonne `chantiers.note` (migration 0061), cadre toujours ouvert sur
la feuille, enregistrement à la sortie du champ, aucune impression.

**Ce qu'il faut retenir du choix de A**, parce que cela vaut au-delà de ce cas :
la variante B était objectivement plus économe (45 px contre 141 à vide). Il ne
l'a pas écartée sur un goût — il ne l'a **pas vue** sur la capture. Une
invitation discrète qu'on manque sur une image, on la manque aussi sur un
chantier ; c'est un renseignement, pas une distraction de sa part.

---

## ~~L'anneau doré d'aujourd'hui~~ — **TRANCHÉ le 23 août 2026 : on garde**

Sa remarque : *« je ne comprends pas pourquoi le vingt-deux reste sélectionné,
ce n'est pas très clair ; ça doit être un bug, je pense »*. Puis, la planche 92
vue : *« ah, je n'avais pas compris que c'était le jour qu'on est. Peut-être le
laisser. »*

**Rien à coder.** Ce n'était pas un défaut d'affichage mais un code qu'il n'avait
pas appris ; une fois le sens connu, l'anneau ne le gêne plus.

**Ce qu'il faut en retenir, et qui vaut au-delà de ce cas :** le premier réflexe
a été de vouloir corriger l'écran. La vraie question était *« sait-il ce que ce
signe veut dire ? »* — et la planche a servi à le lui apprendre, pas à changer
le produit. **Ne pas rouvrir** sans qu'il le redemande.

La planche 92 (`appli/calendrier-aujourdhui.html`) reste : elle raconte le
chemin, et le prochain qui trouvera deux cases entourées saura pourquoi.

---

## ~~CINQ RÉGLAGES DE DOCUMENTS N'ATTEIGNENT PAS LE DEVIS~~ — **BRANCHÉS le 25 août 2026**

**Il l'a relevé lui-même :** *« les autres qui sont en ON doivent-ils être
visibles sur le devis ? car je ne vois rien, est-ce normal ? »*

**Non. Vérifié dans le code, pas supposé.** Sur les six réglages de
« Réglages → Documents », **un seul atteint le document** :

| Réglage | Sur le devis ? | Par où |
|---|---|---|
| Validité du devis | **oui** | figée sur le devis à sa création (`getOuCreerDevisBrouillon`), imprimée par `devis-pdf.ts` |
| Acompte | non | — |
| Délai de paiement | non | — |
| Moyens de paiement | non | — |
| Rappeler les pénalités | non | — |
| Texte en bas des documents | non | — |

`lignesConditionsDevis` compose bien ces cinq lignes, et **elle n'est appelée que
par l'aperçu de l'écran Réglages**. Ni l'écran du devis, ni son PDF ne la
connaissent. Il règle, il voit l'aperçu, et son client ne reçoit rien.

Ce qu'il voit sur son devis vient d'ailleurs, et c'est ce qui rend le défaut
invisible : « Acompte de 30 % à la signature… » est un **exemple grisé** dans un
champ libre vide (`placeholder`), et « Modalités de paiement / IBAN » vient de
ses coordonnées bancaires.

**SA RÉPONSE, le 25 août : « branche-les »**, avec une question — *« si je
décoche le bouton OFF, ils sont censés disparaître ? »* Oui, et c'est éprouvé.

**Fait.** Migration 0064 : les cinq conditions se figent sur le devis à sa
création, comme la validité. Elles s'impriment sous « NOTES / CONDITIONS »,
**après** ce qu'il a écrit à la main — son champ libre n'est ni remplacé ni
réécrit. Rien sur la feuille de chantier du salarié, qui part sans un prix. Le
détail et le pourquoi sont dans `ARCHITECTURE.md` §177.

**Ce que cela ferme sans qu'il ait eu à trancher :** la planche 60 lui proposait
A (les conditions seules), B (les siennes d'abord) ou C (deux blocs). B a été
codée, et elle **devient** A quand il n'a rien écrit. S'il veut C — deux blocs
séparés d'un filet —, il le dira.

**Ce qui reste ouvert, et qui n'est pas bloquant :** l'ÉCRAN du devis ne montre
toujours pas ces cinq lignes ; il faut ouvrir « Aperçu du PDF » pour les voir.
Les poser à l'écran est un changement d'apparence, donc une maquette d'abord
(`CLAUDE.md` §3 bis).

**Et le commentaire du code affirmait le contraire** — « l'aperçu du bas lit LA
MÊME fonction que le PDF ». Corrigé le 25 août : il dit maintenant ce qui est
vrai. Une documentation périmée est pire qu'absente.

---

## LES SUITES NAVIGATEUR SONT INSTABLES SOUS LA CHARGE DE LA BATTERIE (25 août 2026)

**Le fait, mesuré trois fois plutôt que supposé.** Des suites rougissent dans la
batterie complète — 110 suites d'affilée — et **passent au vert jouées seules**,
sur la même branche ET sur `main` nu. Ce ne sont jamais les mêmes :

| Batterie | Ce qui a rougi | Seule sur ma branche | Seule sur `main` nu |
|---|---|---|---|
| 24 août | `test-periodicite-tva-e2e` | 7/7 vert | 7/7 vert |
| 24 août, `main` nu | `test-ia-02-e2e` | — | (clé IA absente : normal ici) |
| 25 août | `test-facture-au-client-e2e` | vert | vert |
| 25 août | `test-fiche-chantier-e2e` | 14/14 vert | — |

**Ce que cela coûte, et c'est le vrai problème.** La batterie est ce qui autorise
une livraison (`CLAUDE.md` §5). Une batterie qui rougit au hasard force chaque
session à rejouer des suites une par une pour distinguer son propre défaut du
bruit — une demi-heure par lot, et le risque inverse : prendre un VRAI rouge pour
du bruit. Un contrôle qui parle à tort s'apprend à être ignoré, et l'on perd le
garde-fou sans s'en apercevoir.

**CORRECTION DU 25 AOÛT AU SOIR, ET ELLE CHANGE LE DIAGNOSTIC.** Une partie de
ces rouges vient d'une faute de ma part, pas de la batterie : **je lançais des
suites à côté pendant qu'une batterie tournait**, et les deux partagent la MÊME
base d'essai. Chacune appelle `nettoyerBase()` et vide les tables de l'autre en
plein milieu — d'où des écrans sans données, des attentes qui expirent, et des
suites qui passent au vert dès qu'on les rejoue seules.

**La règle qui en sort, et elle n'était écrite nulle part : une seule chose à la
fois sur la base d'essai.** Pas de suite lancée « pour vérifier vite » pendant
qu'une batterie tourne ; pas deux batteries. Le conteneur a une seule base, et
elle n'est pas faite pour deux lecteurs qui la vident.

**UN CONTRÔLE QUI SUPPOSE L'ÉTAT COMMUN ROUGIT SUR DU CODE JUSTE — deux fois
le même soir.** `test-reste-equipes-e2e` a été écrit trois fois : il supposait
d'abord le jour voisin libre, puis que le même jour redevenait libre après
retrait de son propre chantier. Les deux fois, une autre suite avait laissé de
quoi occuper ce jour-là, et **le message accusait l'écran de « parler à tort »
sur un jour où il disait vrai** — le pire des rouges, il envoie corriger du code
juste.

La troisième version ne suppose plus rien : elle lit ce que la base porte
réellement — chantiers ET absences —, le passe par **la règle du produit**, et
exige que l'écran dise exactement ça. Elle fixe la RÈGLE, pas un arrangement
particulier des données (`CLAUDE.md` §5 bis).

**ET LA MÊME FAUTE A ÉTÉ REFAITE LE 25 AOÛT AU SOIR.** Une batterie tournait
pendant que des contrôles de maquette et des captures ouvraient leurs propres
navigateurs. Résultat : `test-lecons-prix-e2e` est tombé sur un délai de 30 s
d'attente de réponse — et il passe seul, sur la même branche, sans rien toucher.
**La règle n'est pas « une seule chose sur la base », c'est « une seule chose sur
la MACHINE »** : un navigateur de plus suffit, même s'il ne lit que des fichiers.

**PREMIÈRE MESURE APRÈS LA CORRECTION, et elle est nette :** une batterie jouée
avec **rien d'autre en train de toucher la base** rend **224/224 en base et
110/110 au navigateur**. Aucun rouge. C'est le premier 110/110 de la journée, et
il désigne la faute ci-dessus plutôt que la machine.

**Ce qui reste à éprouver** : les rouges qui tomberaient encore alors que rien
d'autre ne tourne — s'il en reste. Les symptômes étaient des
délais dépassés (`locator.waitFor: Timeout 30000ms`), ce qui ressemble à une
machine saturée. Deux pistes, dans cet ordre :

1. **le serveur de développement**, qui recompile chaque route à la demande : au
   bout de cent suites, il a compilé toute l'application et travaille dans un
   cache énorme. La batterie pourrait servir une version BÂTIE (`next build` puis
   `next start`), comme le fait déjà `verifier:connexion` — c'est d'ailleurs
   l'étape qui ne rougit jamais ;
2. **la mémoire du conteneur**, à mesurer pendant une batterie avant de conclure.

**Ne pas « réparer » en allongeant les délais** : cela masquerait un vrai défaut
de lenteur le jour où il arrivera, et c'est exactement la faute que ce dépôt a
payée avec les contrôles qui mesurent zéro.

---

## ~~DEUX SUITES NAVIGATEUR ROUGES SUR `main`~~ — **RÉPARÉES le 25 août 2026**

**Vérifié sur `main` nu**, dans un arbre séparé, sans aucun lot par-dessus : les
deux rougissent à l'identique. Elles ne viennent pas de la pastille des dates.

### 1. `test-date-lointaine-e2e.ts` — le contrôle a vieilli, pas l'écran

Il exige `/1 mars/i` et l'écran affiche **« lundi 1er mars 2027 »**. L'écran a
raison : `src/lib/jour.ts` porte la règle en toutes lettres — *« le premier du
mois est le seul ordinal en français : 1er août, jamais 1 août »*. C'est le
contrôle qui n'a pas suivi.

**Le corriger, ce n'est PAS remettre « 1 mars »** : ce serait réclamer une faute
de français. La bonne cible est `/1er mars/i`, ou mieux, la date composée par
`jourLisible()` — une suite qui recopie un format finit toujours par diverger de
la fonction qui l'écrit (`CLAUDE.md` §3).

### 2. `test-deux-dates-calendrier-e2e.ts` — son garde-fou parle

*« Le calendrier n'offre que 2 jour(s) : trop peu pour éprouver. »* Il refuse de
conclure, et c'est exactement ce qu'on lui demande — un contrôle qui mesure zéro
ne mesure rien (`CLAUDE.md` §5). Mais il refuse **tous les jours**, ce qui en
fait un rouge permanent plutôt qu'un garde-fou.

Il lui faut au moins trois jours proposables ; il n'en trouve que deux. À
chercher du côté de la fenêtre de dates offerte au client et du jeu de
démonstration — pas du côté du calendrier lui-même, dont les autres suites
passent.

~~**Aucune des deux n'est corrigée ici, et c'est délibéré**~~ — **les deux l'ont
été le 25 août 2026**, par la session du lot 2B, dont la batterie les avait
trouvées le même jour.

**Ce constat-ci avait raison sur les deux points, et sa cible était la bonne :**
la première passe désormais par `jourLisible()`, la seconde tourne la page du
mois quand celui qui s'affiche n'offre pas trois jours. Rien n'a été touché au
produit. Détail dans `CHANGELOG.md` du 25 août.

---

## `verifier:maquette` est ROUGE sur `main`, et ce n'est pas le mode nuit (23 août 2026)

`scripts/verifier-maquette-message-et-allure.mjs` échoue sur `main` nu, à
l'identique, depuis le commit `5fa4d25` (« Rendre au patron le message qui part
à ses clients ») :

```
• le fond de départ est rgb(250, 249, 245) au lieu du crème d'aujourd'hui
• le retour ne rend pas le crème : rgb(250, 249, 245)
```

Il lit `#faf9f5` — la **plage** — là où il attend `#f5f3ee`, le **crème** de la
page. Les deux se ressemblent à l'œil et ne sont pas la même chose : c'est
typiquement une planche qui a changé de fond sans que son contrôle suive, ou
l'inverse.

**Vérifié sur `main` sans aucun lot par-dessus**, dans un arbre séparé : le
défaut n'appartient à personne d'autre qu'à ce commit-là. Il est noté ici plutôt
que corrigé au passage — élargir un lot de maquette pour réparer celui d'une
autre session, c'est mêler deux changements et masquer les erreurs de chacun.

**Conséquence pratique tant que ce n'est pas réglé :** `npm run verifier:maquette`
s'arrête là et ne joue PAS les contrôles qui suivent dans la chaîne. Ce qui est
en aval passe pour vérifié sans l'avoir été.

---

## Mode nuit : ce que le lot du 22 août ne couvre PAS (22 août 2026)

Le défaut qu'il a signalé est réparé (`ARCHITECTURE.md` §160), et deux contrôles
le tiennent. Ce qui reste dehors, et qu'il faut savoir avant de croire
l'application entièrement lisible en Nuit :

| Ce qui n'est pas éprouvé | Pourquoi |
|---|---|
| **les états qui ne s'ouvrent qu'au doigt** — feuilles, tiroirs, listes déroulantes, champs en cours de saisie | la suite navigateur parcourt des écrans au repos ; ouvrir chaque geste demanderait un scénario par écran |
| **les écrans profonds** — fiche chantier, devis complet, facture, catalogue, arrosage | le parcours porte neuf écrans, pas l'application entière |
| **la pastille d'équipe elle-même**, dans la CI | le jeu de démonstration n'a qu'une équipe et aucun chantier planifié : le cas exact de sa capture ne se rejoue qu'avec deux équipes en base |

Le troisième point est le plus gênant : c'est celui qu'il a signalé, et la suite
le mesurerait s'il y avait de quoi le mesurer. Le corriger demande soit
d'enrichir le jeu de démonstration — qui sert aux quatre-vingts suites de la
batterie —, soit de faire poser un chantier et une seconde équipe par la suite
elle-même, à travers les écrans. La seconde voie est la plus sûre et n'a pas été
prise faute de temps.

**Les pages publiques du client restent volontairement claires** — devis,
facture, fiche d'entretien, documents légaux. Un devis ne part pas en noir chez
le client parce que l'artisan a choisi « Nuit » (`design-tokens.ts`,
`couleursDocument`). Ce n'est pas un manque, c'est une décision, et elle est
tenue.

---

## Arrosage : deux calculs manquent encore, et il ne les a pas commandés (22 août 2026)

Sa question du 22 août — *« quel calcul utilisent-ils pour savoir cela ? »* — a
sorti trois manques du calcul d'arrosage. **Les trois sont faits** — le diamètre du tuyau
(`ARCHITECTURE.md` §144), la buse à la pression du chantier (§145), les pertes du
réseau (§147). Ce qui suit est l'historique, et ce qui reste dehors :

| Ce qui manque | Ce que ça change | Coût |
|---|---|---|
| ~~le débit d'une buse baisse avec la pression~~ | **FAIT le 22 août 2026** — `ARCHITECTURE.md` §145 | |
| ~~les pertes de charge du réseau lui-même~~ | **FAIT le 22 août 2026** — `ARCHITECTURE.md` §147. Reste dehors : le trajet du regard à la première tête, qu'aucune saisie ne donne | |

**Ne pas les coder d'office.** Le second surtout rendrait des plans plus sévères
— donc plus d'arroseurs, donc des devis plus chers — et c'est une décision de
métier, pas de code.

---

## Les suites du devis « à la main » lâchent sous charge (22 août 2026)

**Constaté sur quatre batteries complètes du 22 août**, sur du code qu'aucune
d'elles ne modifiait : `test-devis-complet-e2e.ts` (« Taux enregistré : 20.00 »
au lieu de 10.00) et `test-devis-a-la-main-e2e.ts` (« Montant enregistré :
0.00 » au lieu de 1250.00) rougissent **une batterie sur deux**, chacune à son
tour. **Jouées seules, les deux passent.** Deux batteries sur quatre au vert
complet, sans qu'aucun code de l'éditeur ait bougé entre-temps.

Les deux échouent au même endroit : on écrit dans un champ, on relit la base, et
la valeur n'y est pas encore. L'enregistrement de l'éditeur est différé ; sur un
serveur de développement chargé par soixante suites, l'assertion arrive avant
l'écriture.

**`test-reprise-chantier-e2e.ts` a rejoint la liste le 22 août au soir**, avec
la même signature : *« le total n'est pas montré avant l'envoi. Vu : […] TOTAL
HT 0,00 € »*. Tombée en batterie, verte seule et verte au repassage complet
(103/103) dans la foulée. Trois suites, un seul défaut.

**Ce n'est pas un défaut du produit — c'est un contrôle qui lit trop tôt.** Mais
il coûte cher : il fait douter d'un lot juste, et il apprend à ignorer un rouge.
Le corriger, c'est attendre la trace de l'enregistrement plutôt qu'un délai —
la même leçon que le `networkidle` du 15 août.

**`test-attente-dictee-e2e.ts` a rejoint la liste le 25 août**, avec la même
signature à un détail près : *« l'écran affiche "Aucune coordonnée reconnue dans
ce que vous avez dit" au lieu d'annoncer qu'il rédige »*. Tombée en batterie
(109/110), **verte seule** dans la foulée, sur du code que le lot en cours ne
touchait pas — il ne portait que l'en-tête de l'accueil. Ici encore, l'assertion
arrive avant que le serveur chargé n'ait rendu sa réponse : l'écran en est resté
au message d'échec de la dictée précédente. **Quatre suites, un seul défaut.**

**`test-lecons-prix-e2e.ts` a rejoint la liste**, et elle est la première à
tomber DEUX FOIS — le 25 août, sur deux batteries séparées, chaque fois verte
seule dans la foulée, et sur des lots qui ne touchaient rien de son sujet. Elle
tombe sur une attente de réponse dépassée : même signature que les quatre
autres. **Cinq suites, un seul défaut.**

**MESURE DÉCISIVE DU 25 AOÛT, à garder :** l'étape navigateur a été jouée sur
`main` NU — arbre séparé, aucun commit de session — et elle y rend **107/110**,
trois suites tombées (`test-arrosage-e2e`, `test-facture-impayee-e2e`,
`test-fiche-chantier-e2e`). Le même jour, sur un arbre PORTANT un lot, elle
rendait 109/110, avec à chaque fois **une suite différente**.

**Cette machine ne rend donc pas 110/110, quel que soit le code.** Ce n'est pas
une excuse pour livrer du rouge : c'est un fait à opposer à la prochaine session
qui croira avoir cassé quelque chose, et qui passera une heure à chercher dans
son propre lot. **Le bon geste, devant un rouge navigateur : rejouer la suite
SEULE, puis, si elle passe, rejouer l'étape sur `main` nu.** Un arbre séparé se
monte en deux commandes (`git worktree add`), mais il lui faut de VRAIES
dépendances : un lien symbolique vers `node_modules` fait paniquer Turbopack
(« Symlink [project]/node_modules is invalid »), et l'essai ne prouve alors rien.

**Personne ne l'a encore fait**, et ce n'est pas ce lot-ci qui doit le faire :
c'est écrit ici pour que la prochaine batterie rouge sur ces deux suites ne
relance pas l'enquête depuis zéro.

**Une TROISIÈME suite fait pareil, relevée le 22 août par une autre session :**
`test-reprise-chantier-e2e.ts`, sur *« et l'écran d'arrivée offre l'envoi, sans
étape de plus »* — le devis y est lu à `TOTAL HT 0,00 €`, c'est-à-dire **avant
que ses lignes soient écrites**. Même symptôme, même remède, et **elle passe
seule** elle aussi. Trois suites, un seul motif : elles lisent un montant à
l'écran sans attendre la trace de son enregistrement.

**Une QUATRIÈME, le 23 août :** `test-reduction-devis-e2e.ts`, sur *« écrire 0 %
la retire pour de bon »* — la ligne or survit au zéro, dit-elle, sur un écran
qu'aucun lot ne modifiait. **Verte jouée seule**, elle aussi. Même famille : elle
relit un total après une écriture, sans attendre la trace de l'enregistrement.

**Ce que cela coûte déjà**, et c'est la raison d'écrire ceci : trois sessions
différentes ont mené la même enquête en deux jours, chacune de son côté. La
prochaine batterie rouge sur l'une de ces **quatre** suites se joue **seule**
avant toute autre hypothèse.

**Le remède est connu et tient en une ligne** : attendre la trace de
l'enregistrement plutôt qu'un délai — la même leçon que le `networkidle` du
15 août. Il reste à l'appliquer aux quatre.

## ⚠ `CHANGELOG.md` porte DEUX en-têtes « 2026-08-24 » (25 août 2026)

`CLAUDE.md` §C l'interdit nommément : *« une entrée neuve se glisse sous
l'en-tête du jour qui existe déjà ; on n'en crée jamais un second »*. La règle
existe parce que trois en-têtes du 23 août avaient déjà dû être réunies à la
main.

**Non corrigé ici, et c'est délibéré** : réunir les deux sections déplacerait
quelques centaines de lignes écrites par une autre session, peut-être encore
ouverte. Le faire sous ses doigts lui vaudrait un conflit sur tout le fichier.
**À réunir par la prochaine session qui trouvera le champ libre**, ou par
l'auteur de la seconde en-tête.

## 🔴 `verifier-maquette-message-et-allure.mjs` est ROUGE sur `main` (24 août 2026)

**Constaté en jouant `npm run verifier:maquette` sur un `main` fraîchement
fusionné, sur un lot qui ne touche NI cette planche NI ce contrôle.** Deux
échecs, tous deux sur la même valeur :

```
• le fond de départ est rgb(250, 249, 245) au lieu du crème d'aujourd'hui
• le retour ne rend pas le crème : rgb(250, 249, 245)
```

**Vérifié pré-existant** : le contrôle rougit à l'identique sur `main` seul,
sans aucune de mes modifications. Ce n'est donc pas une régression de ce lot.

`rgb(250, 249, 245)` est `#faf9f5` — la **plage** de l'application
(`colors.card`), pas le **crème du document** `#ece9e1` (`couleursDocument.papier`,
la valeur d'`ALLURE_PAR_DEFAUT.fond`). La planche part donc sur la couleur des
cartes de l'écran au lieu de celle du papier. **C'est exactement la confusion
que `ARCHITECTURE.md` sépare** entre les jetons d'écran et ceux du document :
le patron, lui, verrait une planche annonçant un fond que ses devis n'ont pas.

**Non corrigé ici, et c'est délibéré** : la planche appartient à une autre
session, qui la tient peut-être encore ouverte. La corriger à l'aveugle
risquerait de défaire son travail en cours. **À reprendre par qui l'a écrite**,
ou par la prochaine session si personne ne s'en saisit.

## ~~Voir son devis pendant qu'on le change~~ — **CODÉ le 24 août 2026 : sa proposition B**

Planche 96, trois rangements ; il a répondu **« la B »**. L'aperçu est collé en
tête du bloc « L'allure de mes devis » et suit tout ce qu'on touche. Le détail
est dans `CHANGELOG.md`.

**Une question reste ouverte, et elle est indépendante** : les dix polices
tiennent sur cinq rangées. S'il préfère une seule ligne qui défile de côté,
l'aperçu remonte d'autant — il ne s'est pas prononcé.

**DEUX SESSIONS L'ONT CODÉ LE MÊME JOUR**, et c'est à noter : le 25 août, une
seconde a posé un aperçu collé identique, sans voir celui-ci. Un seul survit — la
place de `main` —, et son ombre suit désormais la charte (`voile`) au lieu d'un
noir écrit en dur, qui ne se voit pas sur les deux chartes sombres.
**Trente secondes de `git branch -r --sort=-committerdate` l'auraient évité**
(`CLAUDE.md` §6-A).

**Le contrôle sait rougir**, et c'est ce qui le rend croyable :
`scripts/test-apercu-colle-e2e.ts` remis en A — l'aperçu simplement remonté en
tête — tombe en nommant A et en citant ce que la planche en disait. A et B ne
diffèrent que pendant le DÉFILEMENT : un contrôle qui n'aurait pas descendu
serait resté vert sur la moitié de réponse qu'il a écartée.

## ⚠ La planche 90 a DÉRIVÉ de l'écran « Terminés » qu'elle référence (23 août 2026)

`src/app/termines/page.tsx` dit d'elle : *« la planche reste la référence — toute
correction de cet écran s'y porte D'ABORD, sinon les deux divergent, et c'est
elle qu'il ouvre sur son téléphone »*. Elle ne l'est plus.

**Ce que l'écran porte et que `appli/termines-simple.html` ignore :**

| L'écran codé | La planche |
|---|---|
| la carte de TVA **en tête**, avec son montant | « Ma TVA à déclarer » en **pied**, sans montant |
| « 1 à facturer · 3 facturés », sans montants, souligné d'un trait | la même phrase **avec ses montants**, sans trait |
| la ligne du mois **sans total** | « ‹ Août 2026 › » **avec son total à droite** |
| les lignes aérées (19 px de marge) | les lignes d'origine |

**Personne ne l'a fait exprès** : la carte de TVA vient de la planche 86, posée
par une autre session, et les retraits du 23 août au soir ont été portés au code
seul — il regardait l'écran, pas la planche. **Ce n'est pas un défaut du
produit**, c'est une référence qui ment, et elle ment dans le sens le plus
coûteux : on la croit à jour.

**Deux issues, et il faut trancher** — remettre la planche à niveau, ou lui
retirer son titre de référence et le dire dans `page.tsx`. Ne pas laisser en
l'état.

## ~~Le temps passé, montré ou non~~ — **CODÉ le 23 août 2026**

Sa demande du 22 août, dessinée en planche 92, puis codée le 23 après ses deux
corrections : *« raccourcis la phrase à "votre client ne le verra pas sur son
compte rendu" »* et *« enlève le 1 h 40 en gris à droite de la sélection de
l'heure »*.

Un interrupteur sur la ligne « Temps passé », colonne `temps_visible`
(migration `0060`), masquage décidé au serveur, empreinte qui scelle ce que le
client a lu. Le détail est dans `CHANGELOG.md`.

**Ce qui reste ouvert, et qui est pour lui** — il ne s'est pas prononcé :

| | |
|---|---|
| **Le réglage de départ** | Codé sur **Visible**, ce que l'application faisait déjà. S'il préfère que chaque fiche parte **Masquée**, c'est le défaut de la colonne à retourner (une migration d'une ligne) |
| **Masquer ou ne rien saisir ?** | Aujourd'hui masquer garde la durée pour lui. S'il voulait pouvoir ne rien saisir du tout, la molette devrait pouvoir revenir à « — », ce qu'elle ne sait pas faire |

## ~~EN ATTENTE DE SA RÉPONSE — deux chantiers le même jour ?~~ — **B CODÉE le 25 août 2026**

Sa colère du 22 août : *« je peux proposer le 24 alors qu'un client a validé le
24 — corrige-moi ça ! Ça ne doit jamais se reproduire, c'est une erreur
gravissime !!!! »*

**Le défaut de code est CORRIGÉ** (voir `CHANGELOG.md` et `HANDOVER.md`) : un
chantier commencé avant la fenêtre et encore en cours dedans n'était compté
nulle part. Trois contrôles le tiennent, vus rouges contre l'ancienne borne.

**Ce qui reste, et qui n'est PAS un défaut :** avec **deux équipes**,
l'application propose un jour où une seule équipe est prise. C'est le
fonctionnement voulu — mais **aucun écran ne le signale**, et rien ne distingue
un jour vide d'un jour à moitié pris.

Planche 88, `appli/envoi-jour-deja-pris.html`. Deux questions posées, pas une :

**SA RÉPONSE, le 25 août : B** — avec une réserve : *« par contre "1 chantier
sur 2" on ne comprend pas très bien, comment on peut faire pour comprendre
mieux ? »*

**Le libellé a donc changé, et il avait raison.** « 1 chantier sur 2 équipes »
compte ce qui est PRIS, alors que ce qu'il décide dépend de ce qui RESTE : il est
en train de proposer une date, et la question est *puis-je encore envoyer
quelqu'un ce jour-là*. D'où **« Reste 1 équipe sur 2 »** — même information,
tournée du côté du geste. La planche 88 porte le nouveau libellé, et un contrôle
interdit aux deux de diverger.

**Codé** sur la liste des dates retenues, dans l'écran d'envoi : c'est le dernier
endroit où il peut retirer une date, et le seul qu'il relit avant de partir. Le
PIRE des deux demi-journées commande — un matin plein et un après-midi libre ne
font pas « une équipe et demie ». Rien ne s'écrit sur un jour entièrement libre,
ni quand il n'a qu'une équipe.

**Sur le fond — interdire ou seulement voir —, il n'a pas répondu en ces
termes**, et choisir B (une mention) plutôt qu'un refus se lit comme
« seulement le voir ». C'est aussi le sens sûr : interdire bloquerait un jour où
il peut réellement envoyer quelqu'un. **S'il veut l'interdiction, il le dira** —
c'est une ligne de plus dans `verifierJourPropose`.

**Sa liste — 24, 25, 26, 27, 28, 31 — était compatible avec les deux causes**,
et rien dans sa capture ne permettait de trancher. Ne pas conclure à sa place :
c'est le nombre d'équipes de SON entreprise qui décide, et il se lit sur son
écran Réglages.

---

## ⚠ EN ATTENTE DE SA RÉPONSE — un devis accepté, invisible (22 août 2026)

Sa panne, capture de la confirmation client à l'appui : *« un devis a été
accepter mais rien n'ai visible sur mon planning »*.

**Ce n'est pas une perte de données, et il faut le dire avant tout le reste.**
`enregistrerReponse` (`src/server/repositories/envois-devis.ts`) écrit
`date_planifiee`, `creneau_debut` et `duree_demi_journees` sur le chantier dans
la **même transaction** que la réponse du client : il n'y a jamais l'une sans
l'autre. Le 24 août portait bien sa barre pleine dans le calendrier.

**Le défaut est l'ouverture de la liste.** `PlanningClient.tsx` ouvre les
planifiés sur la semaine du jour :

```ts
const [lundi, setLundi] = useState<JourIso>(() => lundiDe(aujourdHui));
```

Samedi 22, cette semaine est vide ; l'écran écrit donc **« Aucun chantier posé
cette semaine »** pendant que le chantier attend le lundi 24, trois jours plus
loin. **L'écran lui dit le contraire de ce qui est vrai**, et la seule trace du
contraire est une barre de 3 px dans le mois. Un pas de « › », ou toucher le 24,
et il apparaît — mais rien ne le lui dit.

**Reproduit à l'écran avant de répondre**, jamais supposé : chantier inséré au
24 en base, connexion réelle, capture. C'est ce que `CLAUDE.md` §1 bis exige.

**Rien n'est codé** — sur quelle semaine s'ouvre le planning est un choix
d'apparence (`CLAUDE.md` §3 bis). La planche est
`appli/planning-semaine-ouverte.html` (planche 87) :

| | |
|---|---|
| **A** | ce qu'il a aujourd'hui |
| **B** | s'ouvrir sur la semaine du prochain chantier quand celle du jour est vide |
| **C** | rester sur cette semaine, mais écrire où est le prochain et y emmener |

**Le piège, quand ce sera codé :** ne pas dessiner la liste deux fois. Dans la
planche, les trois variantes partagent **une seule** fonction de peinture et ne
divergent qu'à l'endroit où la semaine est vide — deux dessins pour la même
liste finiraient par ne plus dire pareil (`CLAUDE.md` §3).

---

## ~~⚠ CONSIGNE — « Terminés » : MAQUETTE SEULEMENT~~ — **LEVÉE le 22 août 2026**

Sa consigne du matin — *« ne code rien, je veux des maquettes dynamiques que je
puisse essayer »* — a été levée le soir même : **« je choisis la B avec les
modifications que je viens de te demander »**.

La planche retenue est `appli/termines-simple.html` (planche 90,
proposition B), et **elle reste la référence** : toute correction de
« Terminés » se porte D'ABORD sur elle, comme la planche 84 pour le planning —
sinon les deux divergent, et c'est la planche qu'il ouvre sur son téléphone.

**Ce qui reste vrai après coup :** un écran de « Terminés » se dessine toujours
avant de se coder (`CLAUDE.md` §3 bis).

---

## ~~⚠ CONSIGNE — le planning : MAQUETTE SEULEMENT~~ — **LEVÉE le 21 août 2026**

Sa consigne du 21 août au matin — *« ne code rien, je veux qu'on finisse toute
la page ensemble en maquette dynamique [...] une fois que tout est validé, je te
dirai c'est bon, tu peux coder »* — **a été levée le soir même** :

> *« Maintenant tu peux coder cette version de la maquette ! Ne modifie rien !
> Ne change rien ! Code trait pour trait cette maquette. Prends le temps qu'il
> faut, je veux aucune erreur, aucun défaut ! »*

La planche retenue est `appli/planning-simple.html` (planche 84), essayée deux
soirées durant et corrigée neuf fois. Ce qu'elle a coûté et ce qu'elle a
changé — jusqu'à une migration — est dans `CHANGELOG.md` du 21 août.

**Ce qui reste vrai après coup :** un écran du planning se dessine toujours
avant de se coder (`CLAUDE.md` §3 bis), et la planche 84 reste la référence.
Toute correction du planning se porte D'ABORD sur elle, sinon les deux
divergent — et c'est elle qu'il ouvre sur son téléphone.

### Les planifiés : trois corrections dessinées, EN ATTENTE DE SA RÉPONSE

Ses trois remarques du 22 août, sur la liste des planifiés de l'écran codé.
La planche est `appli/planning-planifies.html` (planche 86), liée depuis
`appli/essais.html`, **et elle se manipule** : il touche un nom, la fiche
s'ouvre sur place ; il retouche, elle se referme.

| Sa remarque | Ce que la planche propose |
|---|---|
| *« À la place de matin, je pense qu'il doit y avoir écrit la durée du chantier [...] parce que ce n'est pas clair quand il y a marqué le matin et l'après-midi »* | la ligne dit « une demi-journée », « une journée », « 3 jours » |
| *« Supprime-moi la notion un chantier en gris. On n'a pas besoin de cette information-là »* | le compte gris disparaît de la fiche du jour |
| *« Sur le premier nom, il faudrait qu'on clique et que ça se transforme en le menu déroulant qu'on a juste en dessous. Pas besoin d'avoir la répétition deux fois »* | la ligne se déplie SUR PLACE ; le jour et le nom ne s'écrivent qu'une fois |

**Le piège à ne pas recopier au moment de coder :** la durée se lit sur
`dureeDemiJournees` du chantier, **jamais** sur le nombre de demi-journées
visibles ce jour-là. Un chantier de trois jours n'en montre que deux sur la
journée qu'on regarde — compter les lignes affichées l'annoncerait « une
journée », et c'est exactement le malentendu qu'il demande de lever. La
première version de la planche est tombée dedans.

**Ce que la durée seule CESSE de dire, et qu'il doit trancher :** sur une
demi-journée, elle ne dit plus si c'est le matin ou l'après-midi — il faut
ouvrir la ligne pour le voir. Un réglage, hors de l'écran, lui laisse comparer
« une demi-journée » et « une demi-journée · matin ».

**Rien n'est codé** (`CLAUDE.md` §3 bis) : sa consigne était *« fabrique-moi la
maquette [...] ne code rien »*.

### ~~Une équipe SANS NOM fait déborder sa ligne de quatre pixels~~ — **TRANCHÉ le 22 août 2026 : on ne change rien**

Trouvé le 21 août 2026 en regardant une capture, et mesuré : sur la fiche du
jour, une ligne de demi-journée aligne la pastille (11 px), le mot (70 px),
l'équipe, « Déplacer » (68 px) et « Retirer » (56 px), séparés de 8 px, dans
324 px.

| Étiquette de l'équipe | Largeur | La ligne |
|---|---|---|
| « Paul », « Julien » — ses équipes nommées | ~63 px | tient |
| « Équipe ? » — aucune équipe choisie, ce que la planche dessine | 75 px | tient (312/324) |
| **« Équipe A » — une équipe existe mais n'a pas de nom** | **91 px** | **déborde de 4 px : « Retirer » passe à la ligne** |

**Pourquoi ce n'est pas corrigé.** Le réparer veut dire retoucher un dessin
qu'il a validé — rétrécir le mot, resserrer l'écart, ou raccourcir l'étiquette
de repli. C'est un choix d'apparence, et un choix d'apparence se dessine avant
de se coder (`CLAUDE.md` §3 bis). La planche 84 ne montre jamais cette
étiquette : elle n'a donc rien tranché.

**Ce qu'il faut lui demander :** ce cas l'intéresse-t-il ? Il arrive à une
entreprise qui a réglé deux équipes sans les nommer. S'il le veut réglé, la
planche décidera comment — et le contrôle
`test-planning-e2e` (« la ligne d'une demi-journée ne se replie jamais ») le
verra passer au vert.

**La planche est dessinée et lui a été donnée** — sa demande du 22 août :
*« oui, fais voir sans rien coder »*. C'est `appli/planning-equipe-sans-nom.html`
(planche 85), liée depuis `appli/essais.html`. Elle montre l'état actuel puis
trois issues, et **elle se mesure elle-même** : chaque ligne interroge le
navigateur et annonce les pixels qui manquent ou qui restent, plutôt que de
porter des chiffres écrits à la main.

| Issue | Ce qu'elle change | Mesuré |
|---|---|---|
| — | aujourd'hui, « Équipe A ＋ » | **il manque 4 px** |
| **A** | l'étiquette ne garde que sa lettre : « A ＋ » | il reste 38 px |
| **B** | le mot passe à « Ap.-m. » — celui que ses boutons de pose emploient déjà | il reste 14 px |
| **C** | l'écran lui propose « Nommer », d'un appui | il reste 13 px |

**SA RÉPONSE, le 22 août 2026 : on ne change rien.** *« On laisse comme c'est là
et on verra bien plus tard. »*

**Ce qui l'a décidé, et c'est utile de le savoir :** la planche se mesurant chez
celui qui l'ouvre, elle lui a répondu elle-même — sur SON téléphone (~430 px de
large), la première ligne annonce **« il reste 29 px »**. Le débordement n'existe
que sur un écran plus étroit, autour de 390 px. Et même là, rien n'est perdu :
« Retirer » passe simplement à la ligne du dessous, toujours atteignable.

**Il a alors demandé si l'application ne pouvait pas se METTRE À L'ÉCHELLE** —
tout rétrécir sur un petit écran pour que le visuel ne change jamais. C'est
faisable, et ça rouvre deux pannes que ce dépôt a déjà payées :

| | Aujourd'hui | Réduit de 13 % (430 → 375 px) | Ce que ça coûte |
|---|---|---|---|
| Texte des champs | 16 px | **14 px** | iOS agrandit la page de lui-même à la mise au point, et l'écran saute sous le doigt (`ARCHITECTURE.md`, « les champs passent de 15 à 16 px ») |
| Zones à toucher | 44 px | **38 px** | on rate le bouton — et il travaille avec des gants |

Devant ces deux chiffres il a tranché : *« si tu me dis que ce que font les
applications, c'est de laisser les pages respirer, dans ces cas-là on laisse
comme c'est là »*.

**NE PAS ROUVRIR CE POINT.** Ni l'étiquette de repli, ni la mise à l'échelle
globale. La planche 85 reste en ligne : elle documente ce qui a été écarté, et
pourquoi. S'il y revient un jour, c'est de là qu'on repart.

---

## Le planning codé : trois choses que la planche ne portait pas

Elles existaient sur l'écran d'avant et **ne figurent pas** sur la planche qu'il
a validée. Elles ont donc été retirées de l'écran — « trait pour trait » — mais
elles ne sont pas perdues : le code serveur est là, et il suffit de le
rebrancher s'il les redemande.

| Ce qui a quitté l'écran | Ce qui reste en place | Ce qu'il faut savoir |
|---|---|---|
| **« Créer la facture »**, dans la feuille du chevron (sa demande du 12 août) | La route et l'écran de facture | Le chemin du planning vers la facture est fermé. **L'autre chemin reste ouvert** : chaque ligne du fil des « Terminés » y mène. Ce n'est donc pas le cul-de-sac du 8 août, mais c'est un appui de plus |
| **« Dans mon agenda »**, la liste de ses rendez-vous extérieurs (9 août) | `periodesOccupeesExterieures`, et l'agenda continue de commander les dates proposées au client | Il ne les LIT plus sur cet écran. Le bandeau qui prévient d'un agenda en panne, lui, est resté |
| **La proposition de chantier voisin** pour combler une demi-journée (13 août) | `src/server/planning/appariement.ts`, intact et toujours éprouvé (`scripts/test-appariement-chantiers.ts`, `scripts/test-appariement-demi-journees.ts`) | Le calcul de distance existe toujours ; seul le bandeau qui l'affichait a été retiré, l'écran retenu n'en portant pas |

**À lui demander**, sans le noyer : veut-il les revoir, et où ? Rien ne presse —
il vient de choisir un écran plus simple, et les remettre sans qu'il le demande
serait défaire ce qu'il a validé.

---

## 🔴 TROIS MIGRATIONS PASSÉES N'ONT RIEN REPRIS — trouvé le 21 août 2026

**Comment on l'a su.** En écrivant la migration 0058, sa reprise de données a
été rejouée sur une base à l'état d'avant, **avec des données dedans**. Elle
recopiait **zéro ligne, sans la moindre erreur** : `chantiers` porte `FORCE ROW
LEVEL SECURITY`, la politique s'applique **même au propriétaire**, et les
migrations tournent sous `atlas_owner` — partout, chez lui comme en CI. Sans
`app.entreprise_id`, une migration ne voit RIEN.

0058 est corrigée (elle boucle par entreprise, comme 0036 et 0037) et
`scripts/test-migrations-sous-rls.ts` garde la porte pour les suivantes.

**Mais le contrôle en a trouvé trois autres, déjà appliquées** — elles ne se
rejoueront jamais, `_migrations` les a enregistrées :

| Migration | Ce qui n'a rien fait | Ce que ça coûte |
|---|---|---|
| `0040_conditions_documents.sql` | `UPDATE devis SET validite_jours = 30` | **Borné.** La ligne « Validité » ne s'imprime pas sur les anciens devis — et ceux qui sont partis sont figés de toute façon |
| `0039_identite_entreprise.sql` | `UPDATE factures SET entreprise_regime_tva = …` | **Borné.** Le PDF se rabat sur le taux, ce que le fichier annonçait déjà. **Et la réparation buterait sur `trg_facture_immuable`**, qui refuse toute écriture sur une facture émise |
| `0045_paiements_et_exigibilite.sql` | La reprise des paiements des factures déjà émises | **RÉEL.** Ces factures ne comptent pas au relevé de TVA **à l'encaissement**. C'est le seul des trois qui appelle une réparation |

**Ce qu'il faut décider, et ce n'est pas à moi de le faire seul :** faut-il une
migration de réparation pour 0045 ? Elle est simple — le même `INSERT`, avec la
boucle par entreprise et un garde `WHERE NOT EXISTS` — mais elle touche à la
COMPTABILITÉ. Une écriture comptable ne se glisse pas dans un lot d'écran.

**À lui poser en une phrase**, et seulement quand il aura le planning en main :
*« des factures émises avant une certaine date ne comptent pas dans le relevé de
TVA à l'encaissement — je répare ? »*

---

## Bloqué par une décision du patron

Rien à coder tant que ces points ne sont pas tranchés. Ne pas les redécouvrir :
ils sont écrits, avec leur coût et leur propriétaire, dans `docs/A-FAIRE.md`.

| | Ce qui débloque | Ce que je fais alors |
|---|---|---|
| 1 | ~~Deux fournisseurs d'IA retenus~~ — **CE POINT NE BLOQUE PLUS RIEN : les clés sont posées chez lui et l'IA tourne** (le patron, 21 août 2026 ; `CLAUDE.md` §1 ter) | Il reste vrai que les quatre autres noms de fournisseurs sont des coquilles vides, et que **sans clé** — c'est-à-dire ici, sur le poste de l'agent — la dictée est recopiée mot à mot (`src/server/ai/lecture-litterale.ts`) : elle va jusqu'au devis chiffré, mais elle ignore qu'un chêne mort s'abat et qu'une haie se taille. Ce qui en dépend se vérifie donc **sur son espace**, jamais ici |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | ~~Fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y en aura pas** | Rien de bloqué. Le devis part de la messagerie du patron (`ARCHITECTURE.md` §13). Ne restent suspendus qu'aux conforts : relance automatique, accusé de réception, code SMS |
| 6 | Outil comptable choisi — le patron n'en a **aucun** au 2026-08-08 | Brancher son API : envoyer client, lignes, montants, taux et période, récupérer le numéro et le document émis. Quelques jours. **Rien à écrire avant le choix** — chaque outil a son API, ce serait du code à jeter. Ce qui n'est PAS en jeu : qu'Atlas n'émette pas légalement est définitif (`docs/AGENT.md` §6) |

---

## ~~🔴 `test-reduction-devis-e2e.ts` est ROUGE SUR `main`~~ — **TROUVÉ le 20 août 2026**

**La cause n'était pas dans l'affichage de la remise, mais dans la SAISIE des
lignes** — c'est-à-dire dans le montage de la suite, et non dans le produit.

La boucle qui écrit les trois lignes du devis comptait 500 ms après avoir
demandé une ligne neuve, puis visait `nth(count - 1)`. Sous charge, la ligne
n'était pas encore rendue : `count - 1` désignait alors la **précédente**, et
l'écrasait. Une ligne disparaissait du devis, le total tombait de 870 à 180 ou
420 selon celle qui sautait — d'où le `'180.00' !== '870.00'` relevé, et d'où
le nombre variable de cas qui tombaient.

Le contrôle accusait donc la remise, qui n'y était pour rien.

**Le remède, déjà employé quatre fois dans ce lot :** attendre que la ligne
EXISTE, puis relire jusqu'à voir le devis complet — **attendre ce qu'on affirme,
jamais une durée** (`test-prix-e2e.ts`, même motif).

Rejouée sur l'arbre fusionné, serveur réchauffé : **11 cas sur 11 au vert.**

**Ce qu'il faut en retenir, et qui vaut plus que le correctif :** le journal du
serveur n'aurait rien dit ici — le serveur faisait exactement ce qu'on lui
demandait. Le défaut était dans ce que la suite lui demandait.

---

## ⏳ `test-fiche-pendant-relance.ts` tombe quand la machine est chargée

**Le 20 août 2026.** La suite rend :

    ✗ le veilleur est bien bloqué à relancer — sans quoi la suite ne prouve rien
      le veilleur n'a jamais tenté de relance : le montage ne reproduit pas le cas réel

**Ce n'est pas le produit qui tombe, c'est le MONTAGE de la suite** — et elle le
dit elle-même, ce qui est à son honneur : elle refuse de conclure au vert sur un
cas qu'elle n'a pas su reproduire. Elle lance un vrai serveur et attend qu'un
veilleur le relance ; sur une machine occupée, la fenêtre ne s'ouvre pas.

Vérifié : elle tombe **aussi sans le lot du diagnostic végétal** (travail mis de
côté, suite rejouée), et elle était **verte** dans la batterie complète jouée une
heure plus tôt sur le même arbre. C'est donc la charge, pas le code.

**À faire quand on y reviendra :** lui donner plus de temps, ou lui faire
attendre un signal du veilleur plutôt qu'un délai. Un contrôle qui dépend de la
charge de la machine finit par être ignoré.

---

## ⏳ `test-fiche-client-e2e.ts` rougit sous charge — deux occurrences, deux causes possibles

**Le 20 août 2026**, sur une batterie parmi trois jouées d'affilée, trois cas de
cette suite sont tombés ensemble :

    ✗ chaque colonne porte ses PDF, du plus récent au plus ancien
    ✗ les dates s'écrivent toutes de la même façon
    ✗ rien ne déborde — la colonne la plus étroite fait 0 px

**« 0 px » est le tell : les colonnes étaient VIDES.** La fiche n'avait aucun
document à montrer, et les trois contrôles se sont plaints chacun à sa façon de
la même absence. Jouée seule, et rejouée en batterie ensuite, la suite est
verte : la cause est donc dans **ce que les suites précédentes laissent en
base**, pas dans l'écran.

**Pourquoi ça compte plus qu'un rouge de passage.** Un contrôle qui échoue au
hasard apprend à ignorer le rouge, et l'on perd alors tout ce qu'il surveille.
Celui-ci est neuf (posé le même jour, par une autre conversation) et il garde la
refonte que le patron vient de demander.

**Ce qu'il faudrait :** que la suite crée elle-même les documents dont elle a
besoin, au lieu de compter sur ceux qu'une suite d'avant a produits — ou qu'elle
refuse de conclure sur une colonne vide, plutôt que de mesurer zéro pixel
(`CLAUDE.md` §5). Non reproduit ici : à confirmer avant de corriger.

### Deuxième occurrence, le 23 août 2026 — et elle désigne AUTRE CHOSE

Trois cas sont retombés dans une batterie complète, mais **pas les mêmes**, et
le message change tout :

    ✗ elle porte son nom, et les informations sous le nom
      le nom du client manque :
      ATLAS
      Chargement…
      CHANTIERS PLANNING TERMINÉS PAYSAGE RÉGLAGES

**« Chargement… », c'est l'écran qui n'a pas fini de se rendre** — pas une base
vide. La lecture de 20 août (« les colonnes étaient VIDES, une suite d'avant n'a
rien laissé ») ne couvre donc pas ce cas-ci : ici la page n'a simplement pas eu
le temps. Les deux occurrences n'ont peut-être pas la même cause, et **traiter
la seconde avec l'explication de la première ferait chercher au mauvais
endroit** — ce que ce dépôt paie régulièrement.

**Vérifié avant de conclure**, comme pour `test-lecons-prix-e2e.ts` :

- le lot en cours ne touche **rien** de ce chemin (photo d'une fiche phyto,
  script de capture, documents) — `git diff --name-only` le dit ;
- rejouée **seule** juste après : **13 cas sur 13 au vert** ;
- 105 des 106 suites de la même batterie sont vertes.

**Ce qu'il faudrait, et c'est le même remède que pour `test-prix-e2e.ts` :**
attendre **ce qu'on affirme** — le nom du client à l'écran — plutôt que la fin
d'un chargement réseau. `networkidle` ne dit rien du rendu, et une machine
chargée fait le reste.

---

## ⏳ `test-lecons-prix-e2e.ts` a tenu 30 s puis lâché — une seule fois

**Le 20 août 2026**, dans une batterie complète jouée juste après une fusion de
`main` :

    ❌ page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"

**Vérifié avant de conclure**, et c'est ce qui compte ici :

- elle était **verte** dans la batterie complète jouée une heure plus tôt, sur le
  même lot, avant la fusion ;
- **ni la suite ni le code qu'elle éprouve** ne figurent dans ce que `main` a
  apporté (`git diff --name-only`, aucun fichier `lecon`) ;
- **rejouée seule** sur l'arbre fusionné, elle est verte.

Le faisceau désigne donc la charge — cent trois suites sur un seul serveur de
développement — et non une régression. **Mais c'est le troisième contrôle de ce
dépôt qui dépend de la charge de la machine**, et c'est cela le vrai sujet : un
rouge qui tombe au hasard apprend à ignorer le rouge, et l'on perd tout ce qu'il
surveille.

**Ce qu'il faudrait :** attendre la réponse sur un signal plutôt qu'un délai
fixe, ou porter ce délai bien au-delà de ce qu'une machine chargée demande. Le
délai de 30 s est celui de Playwright par défaut, jamais choisi.

## 🌿 Diagnostic végétal — le module tourne, il lui manque des FICHES

Le code est fait et éprouvé (`ARCHITECTURE.md` §135). Ce qui reste ne se code
pas : ce sont des données à recopier de sources officielles.

| | Ce qui reste | Qui peut le faire |
|---|---|---|
| 1 | ~~**Lancer la récolte des sources**~~ — fait le 20 août : 9 documents récoltés, **3 fiches réelles écrites** (fomès des résineux, les deux anthracnoses), chaîne éprouvée de bout en bout. **Reste ~47 fiches.** Ce qui limite n'est pas la saisie mais le TYPE de document : il faut des **fiches-type**, pas des bilans régionaux | moi, à partir des documents publics, avec relecture avant passage en `validee` |
| 1 bis | **TRANCHER LA LICENCE D'INRAE (Ephytia)** — `http://ephytia.inra.fr`. C'est la source la plus riche en descriptions de symptômes, donc celle qui permettrait d'écrire vite. Son texte n'est pas rapatrié tant que sa réutilisation n'est pas établie : recopier sans licence est un risque qui ne se voit qu'à la mise en demeure. Même question pour le CNPF | le patron, ou un courriel à l'organisme |
| 2 | **Éprouver l'appel réel de vision sur le banc**, avec de vraies photos. Non vérifiable **ici** — le poste de l'agent n'a pas de clé ; **chez lui, elles sont posées et l'IA tourne** (`CLAUDE.md` §1 ter) | à jouer sur son espace ; il envoie une capture du résultat |

**IL L'A CONFIRMÉ LE 21 AOÛT 2026, et cela déplace la priorité de ce lot.**
Après avoir fait écrire que ses clés sont posées, il ajoute : *« également, tu
vas t'en servir pour les maladies »*. Le diagnostic végétal n'est donc pas une
piste à explorer : **c'est un usage qu'il attend**, au même titre que l'arrosage
et le ticket de caisse.

Ce qui en découle, et qui ne demande aucune décision de sa part :

- **l'écran existe et la chaîne est branchée** (`src/app/paysage/diagnostic/`,
  `src/lib/diagnostic-vegetal.ts`). `VISION_PROVIDER` retombe sur le fournisseur
  de rédaction quand il n'est pas posé : sa clé Anthropic suffit donc, sans
  réglage de plus ;
- **ce qui manque est la BIBLIOTHÈQUE, pas le moteur** : trois fiches réelles
  sur la cinquantaine visée (point 1 ci-dessus). Un diagnostic ne peut rien
  reconnaître qui n'y figure pas — et c'est ce qui limite l'usage réel, pas le
  modèle ;
- **et personne n'a encore vu le résultat sur une vraie photo.** C'est le point
  2, et il ne se joue que chez lui.
| 3 | Renseigner les `confusions_phyto` entre fiches proches — c'est **elles** qui permettent la demande de photo complémentaire. **Commencé le 20 août** : les deux anthracnoses sont reliées, et la relance photo est éprouvée sur des fiches réelles. Reste à le faire pour chaque paire proche du lot à venir | avec le lot de fiches |
| 4 | Régler les seuils (`SEUIL_PLANCHER`, `ECART_NET`, plafonds de confiance) sur de vraies photos et de vraies fiches. Les valeurs actuelles sont un point de départ **assumé**, nommé et éprouvé — pas mesuré | après le premier lot |
| 4 bis | **Mesurer ce que la règle « hôte d'abord » coûte en pratique** (20 août). Sans essence identifiée, Atlas ne conclut plus du tout. C'est voulu, mais personne n'a encore vu combien de photos réelles échouent à l'identification — c'est la première chose à regarder quand la clé de vision tournera sur le banc | le patron pose sa clé, je regarde |
| 5 | Ajouter le fournisseur de vision au registre des sous-traitants (`docs/RGPD.md` §3), et décider de la durée de conservation des photos | le patron |
| 6 | Brancher un classement sémantique quand la base dépassera quelques centaines de fiches. L'interface (`ClasseurCandidats`) et son verrou (`appliquerClassement`) existent déjà et sont éprouvés | plus tard, et seulement si le déterministe montre ses limites |

**Ce qui n'est PAS à faire :** inventer des fiches pour que la démonstration
tourne. Le module dit « la base ne contient encore aucune fiche validée », ce
qui est vrai, et c'est le bon état tant que les vraies données ne sont pas là.

---

## ⏳ POURQUOI la construction du démarrage tombe sur le verrou — TOUJOURS non reproduit

**Trois matinées de suite** — 19, 20 et 21 août 2026 — le patron ouvre Atlas et
le trouve lent. Chaque fois, la même ligne sur sa fiche :

    Code SERVI : AUCUNE — la construction a ÉCHOUÉ
    dit: ⨯ Another next build process is already running.

**Ce qui est réparé, et qui tient** (`ARCHITECTURE.md` §133, §136) : le veilleur
ne renonce plus (une tentative par demi-heure, indéfiniment) ; une construction
vivante est **attendue** au lieu d'être tuée ; le détenteur du verrou se trouve
par le fichier `<dist>/lock` et non par un nom de processus.

**CE QUI N'EST TOUJOURS PAS EXPLIQUÉ : pourquoi les deux se rencontrent au point
d'échouer.** Le démarrage en lance deux par nature, et tout est prévu pour
qu'elles ne se marchent pas dessus. Deux hypothèses ont été **éprouvées ici le
21 août, et écartées** :

| Hypothèse | Ce que l'épreuve a rendu |
|---|---|
| Le `sleep 1` de `demarrer.sh` est trop court après le `pkill` | après une seconde, **plus rien** ne tenait le verrou, et la construction suivante partait normalement |
| Un enfant sans le nom « next build » survit et garde le verrou | le seul survivant (`jest-worker/processChild`) **ne tenait pas** le verrou ; la construction suivante partait |

**CE QU'IL FAUT LIRE LA PROCHAINE FOIS, et qui existe depuis le 21 août :** le
témoin d'échec porte désormais une section `verrou tenu par :` avec le **pid et
la ligne de commande** du détenteur, relevés à l'instant du refus — pas plus
tard, quand le coupable a disparu. La fiche du banc la recopie telle quelle.

**Donc : à la prochaine plainte, lire cette section avant toute hypothèse.**
Elle dira si c'est la construction du premier veilleur, celle d'un banc relancé,
ou un processus auquel personne n'a pensé. Trois matinées ont été perdues faute
de ce seul renseignement.

**Et le piège de méthode, payé deux fois en deux jours :** `pkill -f` compare la
ligne de commande ENTIÈRE de chaque processus, **y compris celle du shell qui
joue la commande**. Deux épreuves se sont tuées elles-mêmes parce que le motif
figurait dans leur propre ligne. Les crochets (`[n]ext`) protègent le motif
contre lui-même, pas contre un `echo` qui le contient.

## ⏸ « Trop compliquée » — sa plainte du 19 août 2026, RIEN n'est tranché

**Ses mots, qui valent mieux qu'un résumé :** *« l'application va être trop
compliquée à utiliser, il y a beaucoup trop de mots dans tous les sens. Ce n'est
pas ludique, ce n'est pas pratique, ce n'est pas facile. J'ai voulu créer une
application luxe, mais au final j'ai l'impression que je me suis perdu (…) des
entrepreneurs qui n'ont pas de temps, s'ils passent quinze minutes à essayer de
comprendre comment elle marche, ils ne vont juste pas l'utiliser. Il ne faut pas
oublier qu'il y a des boomers dessus qui ont déjà du mal à utiliser leur
téléphone. »*

**Ce n'est pas la première fois, et c'est ÇA le fait important.** La même chose
a été dite trois fois, chaque fois sur un écran différent, chaque fois traitée
localement :

| Quand | Ses mots | Ce qu'on a fait |
|---|---|---|
| 11 août | *« informations, prix, devis peuvent disparaître »* | trois étapes retirées du tiroir de la fiche |
| 17 août | *« l'utilisateur a besoin d'aller à l'essentiel constamment »* | planches 79 et 80 de l'avoir jetées, la 81 refaite |
| 19 août | ci-dessus | **rien encore** |

Trois corrections ponctuelles, et la plainte revient. Donc le défaut n'est pas
dans un écran : **il est dans le fait que rien n'empêche l'application de
regrossir.** Chaque décision juste ajoute une ligne, un écran, une phrase
d'explication — et personne n'en retire jamais.

**L'état mesuré au 19 août 2026**, à confronter avant de proposer quoi que ce
soit : **54 écrans** (`find src/app -name page.tsx`), **18 rubriques de
réglages**, **5 onglets** en bas.

**Le contresens à ne pas commettre.** Il dit « j'ai voulu faire luxe et je me
suis perdu ». Le luxe n'est pas la cause : le luxe, c'est le vide. Ce qui
encombre l'écran, ce sont les **phrases qui expliquent** — un écran qui a besoin
de se justifier est un écran qui n'est pas clair. Retirer le soin apporté au
dessin ne règlerait rien et coûterait ce qui a été gagné.

**CE QUI EST FAIT : une maquette qui SE SERT.** `appli/moins-de-mots.html` —
Atlas dépouillé, utilisable au pouce : la barre du bas marche, « Créer un
devis » ouvre la fiche client, les champs se remplissent au clavier, le devis
part, « Mes prix » s'ouvre. Un bouton **« Avant »** en haut remet l'écran
d'aujourd'hui sur les trois écrans qui changent. Sans une ligne de JavaScript
(boutons radio et `:checked`), donc ouvrable au téléphone hors ligne. Liée
depuis `appli/essais.html`. `docs/QUESTIONS.md` §23.

Ce qui est retiré, écran par écran :

| Écran | Ce qui part |
|---|---|
| Fiche client | « facultatif » ×5 — **tous** les champs le sont ; la question du canal d'envoi, que l'application devine déjà ; la civilité, qui rentre dans le nom |
| Accueil | le nombre de chantiers et l'ancienneté du devis, écrits **deux fois chacun** ; « Faire le devis », alors que toucher la ligne le fait |
| Réglages | les **treize** phrases d'explication sous les treize titres ; « Intégrations », qui est un mot d'informaticien |
| Le devis | le document entier passe derrière « Voir le document » — il faisait **2,6 hauteurs d'écran** avant d'atteindre « Envoyer » |

**⚠ DEUX VERSIONS ONT RATÉ LA DEMANDE. Ne pas refaire la même erreur.**

1. *« Je t'ai dit de rien coder, seulement une maquette dynamique. »* La
   première arrivait entourée de deux scripts — un qui mesurait l'application,
   un qui recomptait ses nombres. Utiles, hors de `src/`, et **hors sujet** :
   une demande de maquette n'autorise pas l'outillage qui va avec ;
2. *« Une maquette dynamique QUE JE PUISSE UTILISER. »* La deuxième était une
   **planche à regarder** — des écrans avant/après, des flèches, des comptes de
   mots. **Ce n'est pas ça qu'il demande.** Il veut poser le pouce dessus et
   sentir si c'est plus simple. On ne juge pas une application sur une capture ;
   on la juge en s'en servant.

**La règle qui en sort, et qui vaut pour toutes les maquettes :** une maquette,
ici, est un **bout d'application qui marche** — pas une présentation de ce
qu'elle serait. Les autres essayables de `appli/` le sont déjà
(`clients-recherche.html`, `arrosage.html`) : s'en inspirer plutôt que de
réinventer une planche.

**Fusionné sur `main` le 19 août 2026, à sa demande** — il a d'abord dit non,
puis a demandé ce que la fusion changerait à son application. La réponse tenait
en une ligne et vaut d'être gardée : **zéro fichier de `src/` touché**. La
maquette est une page de plus dans `appli/`, à côté du plan d'arrosage et de
« Vos clients » ; son Atlas n'a pas bougé d'un pixel.

**La leçon, et elle vaut pour la prochaine fois :** il n'a pas refusé la fusion,
il ne savait pas ce qu'elle emportait. Annoncer « je fusionne ? » sans dire **ce
que ça change chez lui** lui fait porter un risque qu'il n'a pas les moyens
d'évaluer — et il répond non, ce qui est la bonne réponse à une question mal
posée.

**CE QUI RESTE, ET QUI EST À LUI :** ces trois écrans lui vont-ils ? Rien dans
`src/` tant qu'il n'a pas répondu (`CLAUDE.md` §3 bis).

**CE QUI N'EST PAS PROPOSÉ, EXPRÈS :** relire les autres écrans. Ce serait au
jugé, et c'est l'erreur qu'on cherche à arrêter. Et il faudra se souvenir que
corriger trois écrans de plus ne suffira pas : c'est déjà la troisième fois, et
rien n'empêche l'application de regrossir.

## En attente d'une réponse — le planning

### Sa demande du 19 août, et la planche 84

*« Cette page est beaucoup trop compliquée à comprendre pour les utilisateurs.
Les titres en noir, gras, centrés. Pour les planifiés, mettre les jours de la
semaine en haut — vendredi 21 août plutôt que 21 — avec les clients dessous, et
une flèche à droite et à gauche pour changer de semaine. Et pour le calendrier
au-dessus, propose quelque chose de plus simple, plus visuel : qu'on voie tout
de suite les jours pris, et ceux pris seulement le matin ou l'après-midi. »*

**Rien n'est codé** : `appli/planning-simple.html` s'essaie — les flèches
changent vraiment de semaine, et le calendrier se calcule sur les mêmes
chantiers que la liste. `src/app/planning/` n'a pas bougé.

**Ce qui n'attend pas de réponse** (sa demande est explicite) : titres noirs,
gras, centrés ; jours nommés ; une semaine à la fois avec ses deux flèches.

**LE DESSIN EST CHOISI, le 21 août : c'est A** — deux barres sous le chiffre,
matin dessus, après-midi dessous. Le rond et la barre unique sont retirés de la
planche.

**Deux corrections venues de lui le même jour, et à tenir en codant :**

- **LE MATIN ET L'APRÈS-MIDI SONT INDÉPENDANTS** — sa remarque du 21 août : sur
  un chantier à la journée, « juste Paul le matin, Julien et Paul l'après-midi ».
  La table de liaison porte donc bien la DEMI-JOURNÉE, et jamais une équipe
  attachée au chantier seul ;
- **UN CHANTIER PORTE PLUSIEURS ÉQUIPES** — sa demande du 21 août : « je dois
  pouvoir mettre tout le monde le matin, puis tout le monde l'aprem ». En base,
  ce n'est donc pas une colonne `equipe_id` sur le chantier mais une TABLE DE
  LIAISON (chantier × demi-journée × équipe). Le compte d'occupation porte sur
  les **équipes occupées**, jamais sur le nombre de chantiers ;
- **LA FICHE DU JOUR EST FAITE DE DEMI-JOURNÉES**, chacune portant ses
  chantiers, leur équipe, « Déplacer » et « Retirer ». Une liste unique sous les
  deux demi-journées ne permettait pas d'attribuer depuis l'après-midi — c'est ce
  qu'il a signalé le 21 août. Un chantier à la journée apparaît sous les deux et
  le dit ;
- **UNE BARRE EST FAITE DE PLACES, UNE PAR ÉQUIPE — et une place sans équipe
  est HACHURÉE.** C'est la réponse à sa confusion du 21 août : « les jours
  peuvent être pleins mais les équipes pas choisies ». Le code devra donc porter
  deux notions distinctes : la place occupée (un chantier posé) et l'équipe
  attribuée (qui peut manquer). Les confondre est ce qui le perdait ;
- **l'équipe se CHOISIT dans une liste, et se retire.** Jamais de rotation à
  l'appui : sur dix équipes elle poserait neuf fois une équipe non voulue ;
- **LA BARRE SE REMPLIT — VALIDÉ par lui le 21 août :** *« je suis d'accord
  avec ta méthode pour les dix équipes, la barre elle se remplit petit à petit,
  je trouve que c'est une bonne idée, je valide »*. Ce point est clos : ne pas le
  rouvrir, et ne pas revenir à trois états.

  Sa question du 21 août :
  « comment tu vas faire s'il y a dix équipes ? ». Trois états ne tiennent qu'à
  deux équipes ; à dix, « il reste de la place » couvre une prise comme neuf.
  Chaque demi-journée se peint donc à la part occupée, et « complet » reste un
  aplat foncé — le seul état qui interdit de poser ne se déduit pas d'une
  nuance. **Le code devra lire le nombre réel d'équipes de l'entreprise**, pas
  supposer deux ;
- **la légende MONTRE la position** — une marque remplie en haut à côté de
  « matin », une remplie en bas à côté d'« après-midi ». Aucune phrase
  d'explication ;
- **au-delà de trois noms, la fiche écrit « Julien, Paul +8 »** : dix noms sur
  une ligne de téléphone ne se lisent pas ;
- **« Complet », et les noms — jamais le compte.** Sa question était « comment
  vous faites si l'après-midi j'ai mes deux équipes ? » ; sa correction, dans la
  foulée : « retire deux équipes sur deux, juste complet et le nom des
  équipes » ;
- **rien qui répète ce qu'on sait déjà** : pas de « Cette semaine » sous une
  semaine, pas de « Le mois » sous un mois, pas de « ½ journée » après
  « matin » ;
- **l'équipe se dit dans la fiche du jour**, pas seulement dans la liste du bas.
  Le même chantier ne peut pas dire deux choses selon l'endroit où on le lit.

Trois couleurs seulement, dans les trois : vide = libre, vert pâle = une équipe
sur deux, vert plein = complet. **La phrase « Complet veut dire : vos 2 équipes
sont prises sur cette demi-journée » disparaît** — la couleur le dit.

**LA QUESTION DU MOIS EST TRANCHÉE, le 21 août :** *« je veux un accès au mois ;
ce dont je te parlais pour la semaine, c'était pour les chantiers planifiés »*.
Le calendrier reste donc au MOIS — c'est lui qui sert à poser une date lointaine
(`PlanningClient.tsx`, `JourneeOuvrable`) —, et la semaine ne gouverne que la
liste du bas. La planche a été refaite dans ce sens le jour même.

**LA FEUILLE DE CHANTIER — tranché le 21 août : le devis en PDF, sans les
prix.** Sa question était : PDF du devis sans prix, ou fiche « prestations » sous
le client ? Sa réponse, et c'est la bonne : le PDF. Une fiche saisie à côté
serait une seconde liste de ce qui est à faire, et elle divergerait du devis en
silence.

**Les gestes de la feuille sont ceux de « Y aller », repris tels quels** (sa
demande du 21 août) : l'adresse cliquable, **Maps et Waze — plus « Plans »**,
« Appeler le client », « Copier l'adresse ». Rien d'autre. Le code réutilisera
`src/lib/itineraire.ts` et `FeuilleYAller` plutôt que d'écrire une seconde fois
les mêmes liens.

**LE QUOTA QUI PRÉVIENT SANS INTERDIRE — sa règle du 21 août au soir, et c'est
elle qui tient.** Une équipe = un chantier = une demi-journée. En dessous : « il
reste de la place ». À égalité : « complet ». **Au-delà : une troisième couleur
(l'or), et l'ajout PASSE quand même** — « nous, on prévient juste ». Le
pourcentage ne s'écrit que s'il dépasse. Le code ne devra donc **jamais refuser
un ajout**, et **jamais employer le rouge** pour ça : le rouge dit « erreur »,
pas « regarde ».

**Ce qui précède sur « aucun plafond » reste vrai dans son esprit :** Pas de limite au nombre de chantiers par demi-journée, ni au
nombre d'équipes : « en entretien, les gars restent une heure et enchaînent
quatre ou cinq chantiers ». Le code ne devra donc **jamais refuser un ajout** ni
qualifier un jour de plein. **Reste à choisir comment le mois dit la charge** :
points, équipes dehors, ou chiffres (les trois se comparent dans la planche).

**⚠ Et la question de la même équipe posée deux fois tombe avec le plafond :**
rien n'empêche de poser Paul sur deux chantiers de la même demi-journée, et
c'est désormais ASSUMÉ — deux interventions d'une heure s'enchaînent. Ce qui
reste à trancher est plus petit : faut-il le SIGNALER (« Paul est déjà sur
Auffret ce matin ») ? Paul peut
être sur Leroy et sur Auffret le même après-midi — impossible sur le terrain, et
le compte s'en trouve flatté : deux chantiers, une seule équipe occupée, l'écran
dit « 1 sur 2 » et laisse croire qu'il reste de la place.

Deux façons de le traiter, à lui demander : **barrer l'équipe déjà prise** dans
la liste (elle apparaît, grisée, avec le nom du chantier où elle est), ou la
**laisser cochable et le signaler** (certains découpent une demi-journée en deux
interventions courtes). Ne rien faire n'est pas une option : c'est un compte
faux.

**Trois points à régler avant de coder ça, et deux ne sont pas dans sa phrase :**

1. **Les prix cachés dans les libellés.** Une ligne de devis peut porter son
   prix dans son texte — « forfait 350 € », « remise de 10 % ». Retirer les
   colonnes ne suffit pas : il faut décider ce qu'on fait de ces libellés-là.
2. ~~**Un compte `membre` voit aujourd'hui ce que voit le propriétaire.**~~
   **RÉGLÉ le 25 août 2026** : trois rôles en base, et le refus est au serveur
   (`ARCHITECTURE.md` §180). Un salarié n'ouvre plus ni le devis, ni son PDF, ni
   la fiche du chantier — seulement le planning et sa feuille sans montants.
3. ~~**Par où le salarié entre.**~~ **TRANCHÉ le 25 août 2026 : compte
   nominatif**, créé par le patron dans Réglages → Équipe. Le lien par jeton a
   été écarté pour la raison même qui était notée ici — lui seul permet de dire
   QUI a vu quoi.

**Ce que la maquette ajoute, et qu'il faudra tenir en codant :** toucher un jour
du mois amène la liste sur SA semaine. Sans ce lien, l'écran porterait deux
navigations qui s'ignorent — exactement le genre de page qu'il trouve
incompréhensible.
## ~~Deux maquettes que le patron ne peut pas ouvrir~~ — **RÉGLÉ le 20 août 2026**

`appli/deux-boutons-devis.html` et `appli/en-cours-le-chiffre.html` existent,
sont publiées, sont vérifiées après déploiement — et **aucun lien d'`essais.html`
ne les atteignait**. Or `essais.html` est la seule adresse qu'on lui ait donnée :
autant dire qu'elles n'existaient pas pour lui. **Les deux liens sont posés**, et
les deux pages ont donc quitté la liste tenue à la main de `pages.yml` — la
déduction depuis `essais.html` les couvre. C'est le même défaut que les huit
planches introuvables trouvées par `scripts/fusionner-maquettes.mjs`.

**À faire, par qui reprend leur sujet :** les inscrire dans `appli/essais.html`
si elles ont encore une question ouverte, ou les retirer si leur question est
tranchée. Puis retirer leur mention en dur de `.github/workflows/pages.yml`,
où elles ne sont gardées que pour ne pas perdre une vérification existante.

**Ce qui ne se reproduira plus :** depuis le 20 août, la liste vérifiée après
déploiement **se déduit des liens d'`essais.html`** au lieu d'être tenue à la
main. Deux pages y manquaient ce jour-là, dont `moins-de-mots.html`, écrite la
veille.

---

## ~~L'arrosage simplifié~~ — **CODÉ le 20 août 2026**

`/paysage/arrosage` dans l'application : le piquage, le **kit de mesure
débit / pression (buse 5)** — seau chronométré, bar statique, bar dynamique —,
le croquis photographié et **lu par l'IA**, puis le plan et le détail des
pièces. Au compteur, rien n'est demandé : en Ø25 on a d'office ce qu'il faut.
Ailleurs, le seuil est **2,5 bar en dynamique**. Voir `CHANGELOG.md` et
`PROJECT_STATE.md`.

## Discuter le plan avec Atlas — **maquette à valider, 21 août 2026**

*« Si l'utilisateur a besoin de te demander une modification, qu'il puisse le
faire. Une petite interface pour discuter avec toi — par exemple : tu m'as mis
cinq turbines en 5000, j'aurais préféré des 3500, recalcule-moi le schéma. Ou :
tu m'as mis des VAN 12, est-il possible de mettre de la VAN 15 ? »*

**`appli/arrosage-discuter.html`** — trois échanges essayables : pourquoi deux
réseaux, passer en 15-VAN, préférer des 5004. Le plan se redessine, les pièces
suivent.

**LE POINT D'ARCHITECTURE, ET IL PRIME SUR LE RESTE :** *Atlas ne dessine pas le
plan.* Il lit la demande, **pose un paramètre du calcul** (famille, buse, marque,
nombre de voies), et c'est le calcul déterministe qui refait le schéma et la
liste. Trois droits, pas un de plus : lire le catalogue pour répondre, poser un
paramètre, refuser en expliquant. **Jamais écrire un chiffre absent du
catalogue.**

C'est la leçon du 21 août : laissé libre, il a inventé « 5004 buse 3.0, portée
6 m » — qui n'existe pas — et tout le maillage en dépendait. Une conversation
rend cette dérive **plus** facile, pas moins : on écrit une phrase plausible et
personne ne la recompte. Son contrôle vérifie donc que **toute portée citée
existe au catalogue**, prise par l'autre bout : pas « une bonne valeur est
présente », mais « aucune valeur inventée n'est écrite ».

**Ce qui attend sa réponse :** ~~la pluviométrie entre un coin et un plein
cercle~~ — **tranchée le 23 août 2026** : *« ne prends pas en compte la
pluviométrie »*, elle est sortie de la clé de secteur. Reste « combien de
turbines par voie », auquel le code répond déjà (`decouper()` plafonne une voie
au plus petit de la source et du Ø25) sans qu'il l'ait validé.

---

## Le plan DESSINÉ — **maquette à valider, 21 août 2026**

*« Il manque la photo, le schéma avec les réseaux, et l'implantation des
arroseurs. Les différents réseaux de couleurs. Crée-moi des maquettes dynamiques
en .html, ne code surtout rien. Je veux d'abord voir, analyser, et une fois que
j'aurai validé, on pourra commencer à coder. »*

**`appli/arrosage-plan.html`** — son croquis du 21 août (pelouse en L, 176 m²,
piquage au compteur), le plan tracé à ses cotes, 13 arroseurs répartis en
3 réseaux de couleurs, chacun sous les 1,80 m³/h du compteur. La sélection d'un
réseau se fait sans une ligne de script.

**Rien n'est codé dans l'application tant qu'il n'a pas validé.** Ce qui attend
sa réponse :

| | Ce qui attend | Pourquoi on ne tranche pas à sa place |
|---|---|---|
| 1 | **L'implantation proposée** — maillage de 6 m pour les turbines, 4 m pour les tuyères de l'extension | C'est son métier. Un maillage plus serré arrose mieux et coûte plus cher ; l'arbitrage lui revient |
| 2 | **Le découpage en 3 voies** — gauche, droite, extension | Un autre découpage est possible (par exposition, par horaire). Celui-ci est le plus simple à repérer sur le terrain |
| 3 | **Le tracé des tuyaux** — le tronçon commun traverse la pelouse | Un tracé en périphérie coûte plus de tuyau mais évite de rouvrir le gazon plus tard |

**Repris le 21 août sur ses trois corrections :** la nourrice est dessinée et
tout en part ; les raccords sont comptés par position (10 tés + 3 coudes =
13 arroseurs) ; le choix de marque est à l'écran, Rain Bird par défaut.

**Ce que la maquette a déjà corrigé de sa capture :** deux réseaux portaient le
MÊME nom, tronqué (« Pelouse pas de gazon à gauche … »). Un contrôle refuse
désormais un nom répété ou coupé.

---

**Ce qui reste à coder, et qui n'attend personne :**

- **Rattacher un plan à un chantier.** Rien n'est enregistré aujourd'hui : un
  plan se refait à chaque client, comme un devis. Le jour où il voudra le
  retrouver, ce sera une décision — et une table.
- **Le plan DESSINÉ.** L'écran rend les réseaux et les pièces en listes ; la
  maquette montrait un plan du jardin avec les couleurs et les métrés. C'est ce
  qui manque pour que les deux se ressemblent vraiment.
- **Les photos** : compression à l'envoi et conservation deux ans, décidées le
  17 août, **toujours pas codées**.

---

## ~~La fiche client allégée~~ — **TRANCHÉE ET CODÉE le 20 août 2026**

Trois colonnes (Devis · Fiche chantier · Facture), la dernière prestation en
titre noir gras, le reste retiré. Le PDF de fiche de chantier existe.
Voir `CHANGELOG.md` et `PROJECT_STATE.md` §« Atlas fabrique TROIS documents ».

**Ce qui reste ouvert, et qui est à LUI :**

| | Ce qui attend | Pourquoi on ne tranche pas à sa place |
|---|---|---|
| 1 | **Le reste dû revient-il sur la fiche ?** | Il a dit « tout le reste, tu enlèves ». Le reste dû est parti avec, et se regarde dans Terminés → En attente de paiement. Depuis la fiche d'un client, on ne sait donc plus s'il doit de l'argent |
| 2 | **Le chemin vers un chantier** | « Ses chantiers » était le seul lien d'un client vers un chantier. On ouvre désormais sa fiche en PDF : un document se lit, un écran se modifie |

**Ce qui reste à coder, et qui n'attend personne :**

- **Figer la fiche de chantier le jour où elle s'ENVERRA.** Elle se télécharge
  aujourd'hui, et se régénère à chaque ouverture — c'est voulu : si le patron
  corrige une observation, c'est la version corrigée qu'il veut. Mais ce qui
  part chez un client ne se réécrit pas : il faudra la stocker à l'envoi, comme
  le devis et la facture. C'est écrit dans la route.
- **Les photos** : compression à l'envoi et conservation deux ans, décidées par
  lui le 17 août, **dessinées et non codées** (`appli/clients-recherche.html`).

---

## ~~Les deux boutons du devis~~ — **tranché et codé le 18 août 2026**

Sa demande : *« supprime "je dicterai" et "je l'écris", remplace par un bouton
cliquable "je dicte mon devis" et un autre "j'écris mon devis", en gardant le
chemin »*. Cinq façons lui ont été montrées (`appli/deux-boutons-devis.html`),
**il a retenu la 5, sans les flèches** : deux capsules vertes empilées, à
égalité, « Je dicte mon devis » et « J'écris mon devis ».

**Ce qui a changé dans le produit** (`FormulaireNouveauChantier.tsx`) : la
bascule `BasculePorte` et le bouton `LibelleDeLaPorte` sont retirés ; chaque
bouton porte sa destination. Le geste passe de deux temps (choisir, puis agir)
à un seul.

**Deux conséquences assumées, pas des oublis :**

- **« Créer le chantier » a disparu de l'écran.** C'était le seul endroit qui
  annonçait la création. Les deux boutons créent le chantier avant d'aller où
  ils disent — sinon le devis serait orphelin. Il n'a pas voulu de la ligne qui
  le redisait (proposition 2) ;
- **en reprise, un seul bouton « Enregistrer »**, comme avant. Cet écran sert
  alors à corriger des coordonnées (« RIEN DE PLUS, RIEN DE MOINS », 17 août) :
  lui proposer deux devis pour changer une adresse serait lui poser une question
  qu'il n'a pas. **À revoir s'il dit le contraire.**

**Les 73 suites qui créaient un chantier en cliquant « Créer le chantier »**
visent désormais le repère `[data-atlas="action-dicter"]` — un libellé
n'aurait pas survécu au prochain changement de mot.

---

## ~~Le quinconce~~ — **FAIT le 18 août 2026**

Sa règle, puis son croquis : un couloir à **14** arroseurs alignés se pose à
**7** en quinconce. Le code n'en posait aucun — il ne décalait que les rangées
intérieures, et un couloir n'a que deux rangées de bord.

**Fait :** le quinconce est un damier (i + j pair), et `couvreTout` mesure qu'il
arrose encore tout ; `poser` resserre tant que ce n'est pas vrai. Son couloir
tombe sur 7. Détail et conséquences sur les contrôles : `ARCHITECTURE.md` §127.

**Ce qui reste ouvert, et qu'il faudra lui demander un jour :** sa décision
« la portée ne dépasse jamais la largeur » n'a PAS été câblée. Elle n'a pas été
nécessaire — le damier suffit à retrouver son 7 sans monter en buse —, mais le
choix de buse reste celui d'avant. Si un jour une pose choisit une buse qui
arrose largement à côté, c'est là qu'il faudra la brancher.

---

## ⏳ « Les belles phrases » ne sont pas encore prouvées — 20 août 2026

**Le code est fait, le contrôle est écrit, il n'a pas pu être joué.** Le micro
du devis accepte désormais qu'il RACONTE son chantier plutôt que de corriger des
lignes (`ARCHITECTURE.md` §113, section du 20 août). Mais la rédaction elle-même
est faite par un modèle de langage : ni cet environnement ni la CI n'ont de clé,
et **un contrôle qui mesure zéro est pire qu'absent**.

```bash
npm run verifier:dictee     # depuis son espace, où ses clés sont posées
```

Il envoie sa dictée entière au vrai modèle et vérifie : trois lignes et pas une
de plus, chacune rédigée (pas de « je », pas d'hésitation recopiée), les vingt
mètres linéaires retenus en 20 ml sur la ligne de la haie, aucun prix inventé —
et, en second passage, que ses corrections du 15 août sont toujours comprises.
**Sans clé, il sort en erreur** plutôt que de rendre un vert vide.

**Tant qu'il n'a pas été joué au vert, ne pas écrire ailleurs que la promesse
est tenue.** Ce qui est éprouvé ici, c'est tout ce que le dépôt fait de la
réponse du modèle (mesures, unités, refus d'inventer un prix) et la règle qui
dit ce qui trahit une phrase recopiée — pas la réponse elle-même.

**Si le modèle rend autre chose que trois lignes propres**, l'invite est le seul
endroit à toucher : `systeme()` dans
`src/server/ai/services/retouches-devis-service.ts`, section « Rédiger les
libellés ». Ne pas déplacer la règle vers du code : ce qui décide de « belle
phrase », c'est le modèle, et un nettoyage par expressions régulières après coup
mentirait sur ce qu'il a vraiment compris.

---

## ~~`test-fiche-client-e2e.ts` rouge sur `main`~~ — **réglé le 20 août 2026, par une autre session**

Constaté en fin d'après-midi : deux cas rouges (l'ordre des colonnes, et le
titre de la dernière prestation), **vérifiés rouges sur `origin/main` seul**,
dans un espace de travail à part et sans la moindre modification. Écrit ici
plutôt que corrigé, délibérément : c'était le lot d'une autre session, sans
doute encore en cours, et réécrire son attente pendant qu'elle travaille dessus
aurait tranché une question qui n'était pas la nôtre.

**Elle l'a réglé quelques heures plus tard**, et la batterie suivante est
repartie au vert (102/102 suites navigateur). La ligne reste ici parce que la
conduite, elle, se garde : devant une suite rouge qu'on n'a pas cassée, on
vérifie sur `main` seul, on l'écrit, et on laisse la main à qui tient le lot.

---

## 🔴 SA PAGE DE CONNEXION NE SURVIT PAS À SON BANC — reproduit le 20 août 2026

**Sa plainte, au soir :** *« Je ne peux plus me connecter à l'application. »*
Sa fiche d'état était pourtant intégralement au vert — espace allumé, serveur
qui répond, code servi à jour (`9de6153`) — et `npm run verifier:connexion` se
connectait sans broncher sur ce commit exact, derrière une origine étrangère.

**Ce qui manquait à tous ces contrôles, c'est le TEMPS.** Ils ouvrent la page et
appuient dans la seconde. `scripts/eprouver-connexion-page-vieillie.mts` rejoue
sa séquence — ouvrir `/login`, taper ses identifiants, **laisser le banc se
reconstruire**, puis appuyer — et rend son écran :

```
(aucun POST — le formulaire n'a rien envoyé)
ÉCRAN : ATLAS · Une erreur · Cette page n'a pas pu s'afficher. · Réessayer
```

**Pourquoi cela lui arrive plusieurs fois par soirée.** `scripts/banc.mjs` sert
d'abord `next dev` pour qu'il ait un écran tout de suite, puis **bascule sur la
version bâtie** quand la construction finit — sans compter les mises à jour et
le veilleur. À chaque bascule, les morceaux de code changent de nom. Son onglet,
lui, reste ouvert. La porte d'entrée est l'écran où il stationne le plus
longtemps avant d'agir : c'est celui qui encaisse la bascule.

**Et le rattrapage de `reprise-erreur.ts` ne s'est PAS déclenché.** L'écran a
montré « Cette page n'a pas pu s'afficher », c'est-à-dire la phrase des pannes
ordinaires — pas « la page se recharge ». La reconnaissance se fait sur le
MESSAGE de l'erreur (`estMorceauIntrouvable`), or **en version bâtie React ne
transmet pas ce message** : le rattrapage écrit le 11 août tient en
développement et lâche exactement là où le patron vit.

### Ce qu'il faut faire, et ce qu'il ne faut pas faire

**Ne pas rallonger la liste des motifs** de `reprise-erreur.ts` : on ne peut pas
reconnaître un message qui n'arrive pas. Le remède doit tenir sans message.

**La piste, à éprouver :** l'écran d'erreur demande au serveur **quelle version
il sert** (`src/server/version-executee.ts` la connaît déjà, l'écran Réglages
l'affiche) et la compare à celle inscrite dans la page. Différentes = la page a
vieilli, on recharge une fois ; identiques = c'est une vraie panne, on garde le
message actuel. Cela ne dépend d'aucune formulation de navigateur, et la garde
des cinq minutes reste en place contre la boucle.

**En attendant, ce qu'il doit faire quand ça lui arrive :** recharger la page à
fond, ou fermer l'onglet et rouvrir l'adresse. Ce n'est pas son mot de passe, et
ce n'est pas son espace.

---

## ⏳ « L'application est lente » — 20 août 2026 au soir : ce n'est PAS le produit

**Mesuré, pas supposé.** Sur le code du jour (`71be6d9`), version bâtie, banc
monté comme le sien (`npm run banc`), un navigateur qui se connecte pour de
vrai :

| | |
|---|---|
| connexion → accueil | 890 ms |
| accueil, planning, terminés, réglages, clients, paysage | 670 – 1 110 ms |
| fiche chantier, devis complet | 595 – 690 ms |

La construction de la version rapide a abouti en une minute. **Il n'y a rien à
corriger dans le produit** : ces chiffres sont ceux d'une application rapide.

**Ce que disait sa fiche d'état au même moment**, et c'est là qu'est la panne :

- dernière publication **20:09**, plus rien pendant plus d'une heure. Le publieur
  est un processus séparé qui ne meurt qu'avec le veilleur (`veiller.sh`) : une
  fiche muette une heure dit donc que **le veilleur n'est plus là** ;
- `Code SERVI : 9de6153`, **7 versions de retard** sur `origin/main`.

**L'enchaînement le plus probable**, et il se tient de bout en bout : il touche
« Chercher les dernières corrections » ; sur version bâtie AVEC veilleur, la
règle coupe le serveur pour que le code neuf soit servi
(`src/lib/issue-mise-a-jour.ts`) ; le veilleur relance `npm run banc`, qui sert
`next dev` le temps de bâtir — **c'est là qu'un écran met des dizaines de
secondes à s'ouvrir** (`src/server/etat-banc.ts`, mesuré le 14 août) ; puis le
veilleur meurt, et plus personne ne finit la construction ni ne publie la fiche.
Il reste donc en mode développement, lentement, indéfiniment.

**Le geste qui répare : rallumer l'espace.** Il reconstruit la version rapide et
remet un veilleur.

**Ce qui reste ouvert, et qu'on ne peut pas trancher d'ici :** POURQUOI le
veilleur meurt. Le journal de démarrage n'est délibérément pas publié (dépôt
public), et la fiche ne peut rien dire quand c'est le veilleur qui tombe. La
mémoire relevée à 20:09 — 219 Mo libres, 5,7 Go en cache — n'exclut pas un
manque de mémoire pendant la construction, qui est le moment le plus gourmand.
**Piste à éprouver avant d'y toucher :** faire écrire au veilleur une trace
d'agonie (`trap`), et la publier avec la fiche à l'allumage suivant — sans quoi
la prochaine fois se rediagnostiquera de zéro, exactement comme celle-ci.

---

## ⏸ La fiche client qui dicte le devis — **dessinée le 21 août, il tranche avant qu'on code**

`appli/fiche-client-vocale.html` (adresse : `…github.io/Atlas-app/essais.html`).
**Rien n'est codé**, et rien ne doit l'être avant sa réponse.

**Le dessin des cases est en suspens, et il l'a dit :** *« pour les cases, change
rien, on reste comme on est là »*. Cinq dessins l'attendent sur
`appli/cases-page-entiere.html` — la page entière, relue sous chacun. Ne pas
toucher au dessin des cases de `fiche-client-vocale.html` tant qu'il n'a pas
donné son numéro.

Ce qu'il a déjà tranché, en répondant aux questions posées avant le dessin :

| Question | Sa réponse |
|---|---|
| La fiche chantier (« la page d'après ») | **« On la supprime pour de bon »** |
| Les deux boutons du bas | L'anneau remplace « Je dicte mon devis » ; reste « J'écris mon devis » |
| Le champ téléphone isolé | Retiré. **« Comment lui envoyer son devis ? » reste** |
| L'accueil | Ouvre l'élément là où il en est — devis si le devis est commencé, fiche client si elle est vide. C'est déjà ce que fait `lienDeReprise` |

**Ce qui reste à trancher, et qui bloque le code :** la fiche chantier porte
quatre choses sans autre maison. **La première est réglée le 21 août au soir** —
*« la création de la facture se fera dans la catégorie planning ou terminé »* —
et elle ne coûte rien : les deux chemins existent déjà (la feuille du chevron du
planning depuis sa demande du 12 août, et chaque ligne du fil des terminés).
Vérifié dans le code avant de répondre, plutôt que promis.

**La relecture de la note est réglée aussi**, le même soir : *« on n'a pas besoin
de réécouter la note dictée »*. L'anneau reste un micro, et rien d'autre — une
pièce de moins à porter.

**Les photos d'après coup sont réglées** le même soir : *« fais ça pour le rajout
de la 4e photo du jeudi »* — le carré « + » reste sur la fiche client, et l'on y
revient par **la flèche de retour du devis**, qui mène aujourd'hui à la fiche
chantier (`DevisCompletClient.tsx`, ligne du `<a href={/chantiers/${'{'}id{'}'}}>`) et
devra mener à la fiche client. Aucun geste nouveau.

**Les étapes du chantier ne demandent rien non plus**, vérifié dans le code
plutôt que supposé : chacune a son propre écran (`/informations`, `/prix`,
`/devis-complet`, `/note-vocale`), et la fiche chantier n'en était que la LISTE.
L'accueil mène déjà à la prochaine (`lienDeReprise`).

**Les quatre questions sont réglées, et le code a commencé.**

**Lot 1 — FAIT le 21 août 2026** : la fiche client refaite (plus un seul
« facultatif », le titre « Civilité » retiré, le nom et le numéro sur une ligne,
le numéro qui s'espace à la frappe, l'envoi sous l'adresse). Éprouvé au
navigateur.

**Lot 2 — FAIT le 21 août 2026 au soir**, après sa protestation (*« il manque
trop de choses… tu me la codes trait pour trait »*) : les photos, l'anneau,
« Mon devis → », le bouton unique « Je rédige mon devis », et les cases de la
maquette. Le chantier naît du premier geste — photo ou dictée. Les 73 suites qui
passaient par « Je dicte mon devis » passent par `scripts/_creer-chantier-e2e.ts`.

**Ce qui reste de la liste d'origine :**



1. ~~porter l'anneau et la pellicule sur `chantiers/nouveau`~~ — **fait** ;
2. ~~au second appui de l'anneau, **enregistrer**~~ — **fait** : la note part au
   second appui et le chantier existe dès cet instant ;
2 bis. ~~retrouver un devis **déjà rempli** sans toucher « Mon devis → »~~ —
   **fait le 21 août 2026**, après sa panne de Madame Lucie. La chaîne ne part
   pas au relâchement de l'anneau — il ferme l'application dans la seconde qui
   suit, l'appel partirait avec l'onglet : elle part **à l'arrivée sur le
   devis**, qui est le seul moment où un navigateur est là pour attendre le
   résultat (`src/lib/devis-a-preparer.ts`, `PreparationDictee.tsx`) ;
3. `lienDeReprise` : les étapes « photos » et « note-vocale » ne doivent plus
   viser `/chantiers/[id]` mais la fiche client ;
4. la flèche de retour du devis (`DevisCompletClient.tsx`) : même chose ;
5. retirer l'écran `/chantiers/[id]` et ce qui n'y sert plus.

**Le dessin des cases est tranché** : il a choisi la 4 — « la carte douce » —
et il l'a redit le 21 août au soir. Fond papier, 14 px de rayon, aucun bord,
l'or au doigt posé. C'est ce qui est codé (`.atlas-case`) **et** ce que porte la
maquette : les deux ont été remises d'accord le même jour, l'écart entre elles
étant précisément ce qui lui faisait croire que le code ne suivait pas.

**Huit écarts restent entre l'écran codé et la maquette**, relevés à la mesure
le 21 août au soir et **non tranchés** — il n'a pas encore dit s'il faut les
aligner : « ATLAS » absent du haut, la flèche de retour sur sa propre ligne au
lieu de celle du titre, le nom en 20 px serif au lieu de 16 px sans, les
pastilles Mr/Mme cerclées de vert au lieu d'or, les capsules du canal sans
contour, le canal qui n'apparaît qu'une fois une coordonnée saisie, le carré
photo en trait continu gris au lieu de tirets or, et le bouton principal à
208 px centré au lieu de pleine largeur.

**Deux suites restent rouges, et elles ne sont pas de ce lot :**
`test-fiche-client-e2e` et `test-fiche-chantier-e2e`, toutes deux sur la fiche
client refondue et la fiche d'entretien du Paysage — le lot d'une autre session,
déjà trouvé rouge sur `main` seul l'après-midi même. Jouée seule, la première en
rend quatre. Aucune des deux ne passe par la fiche client de ce lot.

**Ce que le code devra faire, et qui n'est pas qu'un déplacement d'écran :**

- le chantier doit exister **avant** la première photo ou la première dictée —
  sinon la photo n'a nulle part où aller. Aujourd'hui il est créé par les deux
  boutons du bas (`creerPuisAller`) ;
- `lienDeReprise` (`src/lib/chantier-etat.ts`) renvoie les étapes « photos » et
  « note-vocale » vers `/chantiers/[id]`, c'est-à-dire vers l'écran qu'il veut
  supprimer : à rediriger vers la fiche client ;
- l'anneau doit **redevenir lecteur** sur la fiche client quand une note existe,
  comme il le fait aujourd'hui sur la fiche chantier.

---

## À surveiller — non reproduit

### Cinq suites navigateur tombent sur `/prix` — 21 août 2026, PAS le lot en cours

**Ce qui tombe :** `test-brouillon-e2e`, `test-calcul-prix-e2e`,
`test-anneau-vers-devis-e2e`, `test-choisir-la-date-e2e` et quelques voisines,
toutes sur la même marche — une navigation vers `/chantiers/[id]/prix` qui
n'arrive jamais (`page.goto` ou `waitForURL` qui expire).

**Ce n'est pas le lot de la fiche client, et c'est VÉRIFIÉ, pas supposé :** la
même suite a été rejouée seule après `git stash` de toutes les modifications —
elle tombe à l'identique sur le code d'avant.

**Et l'écran, lui, va bien.** Interrogé directement avec une vraie session, sur
un serveur monté à part : `/prix` répond **200 en 107 ms**. Le journal du
serveur d'essai montre par ailleurs `validerInformationsAction` qui **réussit**
(200 en 22 ms) — puis plus aucune requête vers `/prix`. La navigation se perd
donc côté navigateur, pas côté serveur.

**La piste la plus probable, et elle se mesure :** le préchauffage du serveur
d'essai annonce « 2 écran(s) en échec » et met **376 s** au lieu des 86 s
habituelles. Un écran non préchauffé se compile à la première ouverture, en mode
développement, sur une machine chargée — et dépasse le délai de la suite.

**À reprendre ainsi :** faire dire au préchauffage QUELS écrans échouent (il ne
donne aujourd'hui qu'un compte), plutôt que d'allonger les délais des suites —
un délai qu'on allonge cache la lenteur au lieu de la montrer.

---


### `test-pastille-equipe-e2e.ts` est tombée une fois — 20 août

Pendant la batterie du 20 août, un seul cas rouge : *« Depuis la feuille du
chevron aussi, l'équipe se retire »*. **Rejouée seule sur la même base : les
neuf cas passent.** Rien n'a été corrigé, parce que rien de reproductible n'a
été trouvé — et le lot en cours ne touche ni au planning ni aux équipes.

Même piste que la suite du 18 août ci-dessous : les suites navigateur partagent
une base semée une seule fois. Si elle retombe, chercher quelle suite touche aux
équipes de démonstration avant elle, plutôt que de la rejouer en croyant que ça
suffit.


### `test-devis-doublon-e2e.ts` est tombé une fois, et une seule — 18 août

**Écrit comme NON REPRODUIT, pas comme corrigé.** Pendant la batterie du
18 août, la suite s'est arrêtée sur son propre garde-fou : *« Aucune
proposition de prix n'a pu être calculée : ce contrôle n'a rien éprouvé.
Vérifier les tarifs de démonstration. »* Elle cherche un tarif « Dépose
carrelage », qui existe bien dans `src/server/db/seed.ts`.

**Rejouée seule sur une base fraîche : verte. Rejouée dans la batterie
entière (99 suites) : verte.** Rien n'a été corrigé — il n'y avait rien à
corriger de visible. La piste la plus probable est une suite antérieure du même
passage qui consomme ou modifie ce tarif : les 99 suites partagent une base
semée **une seule fois** au début.

**Si elle retombe :** ne pas la rejouer en croyant que ça suffit. Chercher
quelle suite touche aux tarifs de démonstration avant elle, et lui faire semer
son propre tarif plutôt que d'emprunter celui du jeu commun. Une suite qui
dépend de l'état laissé par une autre finit toujours par rougir dans un ordre
donné — et jamais seule, ce qui la rend introuvable.

**Ce qui est déjà bien fait, et qu'il ne faut pas défaire :** son garde-fou.
Sans lui, elle aurait rendu du vert sans avoir rien éprouvé — le piège du
15 août. C'est lui qui a rendu la panne visible.

---

## Ce que je peux faire seul

### 0 duotricies. ~~« Choisir la date »~~ — **CODÉE le 20 août 2026 (A, et la 2)**

**Sa demande, trois captures à l'appui :** *« Le bouton envoyer au client, tu vas
me le modifier par Choisir la date […] sous forme de bouton vert comme tous les
autres […] j'arrive directement sur la page où je peux choisir la date […] on
supprime la page qui est entre les deux […] et l'aperçu en PDF, tu me le mets en
dessous. Et je ne veux pas de flèche. »*

Planche : `docs/maquettes/82-choisir-la-date.html`.

**Ce qui est vérifié dans le code, et qui rend la chose petite :** le calendrier
vit dans une FEUILLE (`src/app/chantiers/[id]/export/EnvoiAuClient.tsx`), pas dans une page — elle
s'ouvre par-dessus l'écran récapitulatif. La monter sur le devis, c'est l'ouvrir
plus tôt : elle ne demande que `chantierId`, `devisId` et `clientNom`, tous trois
présents sur `devis-complet`.

**Il a tranché : « A et la 2 ».** L'aperçu reste un lien discret ; l'écran du
milieu ne s'ouvre plus avant l'envoi — l'adresse renvoie au devis tant que rien
n'est parti, et sa face récapitulative est supprimée pour de bon.

**FAIT.** Le geste vit sur `devis-complet` ; `/export` ne rend plus que l'écran
du devis parti. Éprouvé par `scripts/test-choisir-la-date-e2e.ts`, vu rouge en
réintercalant l'écran du milieu. Vingt-six suites ont dû suivre — puis onze de
plus, que la batterie complète a fait rougir alors que deux suites jouées seules
étaient vertes. L'une d'elles a trouvé un vrai défaut : rechargé, l'écran d'après
l'envoi reprenait « Devis prêt pour … » indéfiniment. Corrigé.
`ARCHITECTURE.md` §136.

### ~~0 duotricies bis. `test-fiche-pendant-relance` est ROUGE~~ — **C'ÉTAIT MOI**

**Écrit le 20 août 2026, et faux dès la première ligne.** J'avais consigné cette
suite comme « rouge indépendamment du lot », avec pour preuve qu'elle échouait
aussi sur son propre commit d'introduction. La conclusion était fausse, et le
dépôt portait déjà la bonne explication : **`TODO.md` 0 trigies quater**, écrite
le 17 août par une autre session, qui décrit exactement ce piège.

`veiller.sh` ne se déclare « serveur mort » que si
`pgrep -f '[n]ext(-server| dev| start)'` ne trouve rien. Or `pgrep -f` compare la
**ligne de commande entière de tout processus de la machine**. J'ai lancé mes
batteries par une commande qui commençait par
`pgrep -af "next dev|next-server" … | xargs kill` — un ménage des serveurs
orphelins. **Ce shell-là vit pendant toute la batterie, et sa ligne de commande
contient littéralement les motifs surveillés.** Le veilleur voyait donc un
serveur, prenait l'autre branche, et n'écrivait jamais le message attendu.

**La preuve :** rejouée depuis un script qui ne nomme aucun de ces motifs, et
sans serveur orphelin vivant, la suite rend **3 cas sur 3 au vert**.

**Ce que ça coûte, et pourquoi ce point reste écrit plutôt que supprimé :**
j'ai consigné une hypothèse comme un fait, et je l'ai dite au patron. Une
hypothèse rangée dans les tâches se relit ensuite comme un constat — c'est
précisément l'avertissement que porte 0 trigies quater, et je ne l'avais pas lu
avant d'écrire.

**Faire le ménage des serveurs dans un appel SÉPARÉ**, qui se termine avant la
batterie. C'est la seule chose à retenir pour la prochaine fois.

### 0 duotricies ter. Reconstruire tout seul quand du code neuf arrive

Posé le 21 août 2026, après *« j'ai encore l'ancienne version »*.

L'écran **dit** maintenant la vérité (§139) : quand du code plus récent attend
d'être construit, il l'annonce et donne le geste. **Mais le geste reste le
sien** — arrêter et rouvrir l'espace de travail.

Aujourd'hui, la reconstruction n'est déclenchée toute seule que dans un cas :
version bâtie **et** veilleur vivant, où le bouton coupe le serveur et laisse le
veilleur reconstruire. Sans veilleur, on se contente de le lui dire.

**La question à trancher :** le bouton doit-il savoir reconstruire lui-même,
sans dépendre du veilleur ? C'est faisable — un processus détaché qui bâtit puis
remplace le serveur — mais cela veut dire couper son application pendant une ou
deux minutes sur un geste qu'il n'a pas explicitement demandé. Le mot du bouton
devrait alors changer : « Chercher les dernières corrections » ne prévient pas
qu'on va éteindre.

**Qui peut le faire :** une session, une fois qu'il aura dit s'il préfère un
bouton qui coupe ou un bouton qui prévient. Ne pas trancher à sa place : c'est
son application pendant ses heures de travail.

### 0 quinquadragies. ⏸ L'AVOIR — dessiné le 17 août, **il choisit avant qu'on code**

Sa demande : *« si jamais on facture un client et qui décide de ne pas nous
payer, il faut avoir la possibilité de créer un avoir »*.

**LA PLANCHE À REGARDER EST LA 81**, `docs/maquettes/81-simple-il-ne-paie-pas.html`
— un lien sur la facture, une question, deux réponses, quatre écrans. Les 79 et
80 ont été **jugées trop compliquées par lui** (*« l'utilisateur a besoin d'aller
à l'essentiel constamment »*) : elles restent comme raisonnement, pas comme
proposition. Rien dans `src/`.

**CE QU'IL FAUT AVOIR COMPRIS AVANT DE CODER QUOI QUE CE SOIT.** Un avoir et un
impayé ne sont pas la même chose :

| | Ce que ça fait | Peut-il encore réclamer ? |
|---|---|---|
| **Avoir** | annule tout ou partie de la facture | **non, plus jamais** |
| **Facture perdue** (créance irrécouvrable) | la facture reste entière, le rappel se tait | **oui** |

Ce qu'il a décrit — un client qui refuse de payer — relève du **second**. Bâtir
seulement l'avoir, c'est lui donner un geste qui le désarme, sans avertissement.

**Une seule réponse à attendre de lui : la 81 lui va-t-elle ?** Le choix
d'arrangement et le choix de forme ont été retirés — c'était précisément la
complication qu'il a refusée. Si elle lui va, la forme du document est celle de
la 80-A : une pièce à part, avec sa propre série de numéros.

**Ce que le code devra lever, et ce n'est pas anodin :**

- `factures_chantier_uk` n'accepte **qu'une facture par chantier** — un avoir
  demande sa table, ou la levée de cette contrainte ;
- `attribuerNumeroFacture` n'a **qu'un compteur**
  (`entreprise_compteurs.prochain_numero_facture`) : une série d'avoirs demande
  le sien, sinon la suite des factures aura des trous ;
- `resteDu` (`src/lib/exigibilite-tva.ts`) ne connaît que les règlements. Tant
  qu'il ignore les avoirs, la fiche client et le rappel d'impayé réclameront une
  somme annulée ;
- une facture émise **ne se modifie jamais** : la correction est toujours une
  seconde pièce.

**Ce qui NE bouge pas, et qu'il est inutile de bâtir :** son relevé de TVA. Elle
est exigible au paiement (§110) — une facture jamais payée n'y est jamais
entrée. Aucune récupération, aucune démarche.

**Deux questions posées sur la planche, sans réponse :** faut-il qu'Atlas
prépare une **mise en demeure** avant de renoncer ? et le cas du client qui
**paie après** qu'on a déclaré la facture perdue (le règlement se note
normalement, rien n'est définitif — mais ça reste à confirmer avec lui).

### ~~0 quadragies bis. « Adresse non renseignée » ouvre l'écran du chantier~~ — **FAIT le 17 août 2026**

*Dessiné, corrigé par lui, puis codé le même jour.* `ARCHITECTURE.md` §124.

La mention devient un lien vers `/chantiers/[id]/coordonnees` — l'écran de
création rouvert, prérempli, qui enregistre au lieu de créer. Le nom du chantier
se recalcule, sinon la ligne dirait « Chantier du … » pour toujours.

**LA LEÇON DE CE LOT, ET ELLE VAUT AU-DELÀ DE LUI.** Une première planche a
dessiné une « fiche client » de toutes pièces ; il a répondu : *« je ne suis pas
sûr que tu aies bien compris […] rien de plus, rien de moins »*. **Devant une
demande qui touche à un écran, chercher d'abord SI L'ÉCRAN EXISTE** — sa seconde
photo le montrait.

Ce qui avait égaré : le code annonce lui-même qu'il manque une fiche client
(*« faute d'écran de fiche client »*, `DevisCompletClient.tsx`). C'est vrai, et
ce n'était pas sa demande. **Un manque réel du produit n'autorise pas à le
combler dans le lot d'à côté.**

**Et la fiche client, elle, est arrivée par une autre porte le même jour**
(`ARCHITECTURE.md` §121) : elle MONTRE ce que l'application sait d'un client.
Les deux écrans ne se confondent pas — celui-ci corrige les coordonnées d'un
chantier. C'est la meilleure preuve que la fiche inventée au premier essai aurait
été un troisième écran de trop.

### 0 quaterquadragies AB. Où vivent les outils métier — TRANCHÉ le 17 août

**Sa question :** *« L'idée c'est de créer des outils comme celui-là pour les
paysagistes ; après je ferai la même chose pour les terrasses bois. Une
nouvelle catégorie paysage ? Ou on range ça dans les réglages ? »*
**Sa décision : un cinquième onglet, nommé « Paysage ».** Le raisonnement complet, et
ce qui a été écarté, est dans `ARCHITECTURE.md` §125.

**⚠ CE QUE ÇA COÛTE, MESURÉ ET NON SUPPOSÉ** (planche 76) : à cinq colonnes sur
un écran de 360 px, la colonne tombe à 71,6 px et **« CHANTIERS » en demande
78,8 — il déborde de 7,2 px**. Deux variantes sont donc à écarter d'office :
poser le cinquième onglet sans rien changer (A), et resserrer l'espacement (B,
qui ne tient que de 1,3 px — un changement de police entre téléphones, et le
défaut réapparaît **chez lui seulement**).

Restent **C** (lettre à 8,5 px) et **D** (une icône au-dessus du mot). **D
revient sur sa décision du 10 août** — il avait retiré les icônes parce
qu'elles répétaient les mots ; à cinq colonnes elles rendent un autre service,
viser sans lire. C'est recevable, mais **c'est à lui de le dire**.

**~~1. Lui faire choisir~~ — FAIT : il a pris C**, la lettre à 8,5 px
(espacement 0,14em), sans icône. Sa décision du 10 août — pas de pictogrammes —
tient donc à cinq onglets aussi.

**~~2. Poser l'onglet~~ — FAIT.** `AtlasBottomNav.tsx` : `ONGLETS` gagne
« Outils », la grille passe en `grid-cols-5`, et **la largeur du trait d'or
suit** (`/ 5`) — elle était écrite en dur, et l'oublier aurait laissé le trait
à cheval sur deux colonnes.

**~~3. Le contrôle qui mesure~~ — FAIT** : `scripts/test-barre-basse-e2e.ts`.
Il mesure la boîte du NŒUD DE TEXTE (une plage), pas celle du lien — un lien
de grille remplit sa colonne quoi qu'il porte, sa largeur ne dirait rien. Il
exige **6 px de marge minimum**, précisément pour refuser la variante B et son
faux confort de 1,3 px. Et il refuse de conclure sur une barre absente.

**~~4. L'écran derrière l'onglet~~ — FAIT** : `src/app/paysage/page.tsx`. **Il
dit la vérité, et c'est tout son sujet** : l'outil d'arrosage n'est PAS dans
l'application, c'est une page publiée à part. La ligne porte « À l'essai » au
lieu d'un chevron, et ouvre la page dehors — plutôt que de promettre un écran
interne qui n'existe pas. La terrasse bois porte « Bientôt », sans lien.

**5. RESTE À FAIRE — rattacher un plan à un chantier après coup.** C'est le
revers de l'accès sans chantier qu'il a voulu : un plan fait en visite de devis
doit pouvoir rejoindre son client, sinon on le cherchera six mois plus tard.
Rien n'est encore posé pour ça.

---

### 0 quaterquadragies AA. Le parcours COMPLET, dicté par lui le 17 août 2026

**C'est la cible du produit, dans son ordre à lui.** Tout ce qui précède
(catalogue, pose, nourrice, réseau latéral) sont des pièces de ce parcours ;
ceci est le parcours. À relire avant de décider quoi coder ensuite — plusieurs
morceaux existent déjà, et les confondre ferait refaire ce qui est fait.

| # | Ce qu'il décrit | État au 17 août |
|---|---|---|
| 1 | **Il choisit son piquage** : après compteur d'eau, ou sur un robinet extérieur | **FAIT** (`#compteur`) |
| 2 | **Au compteur, la ville délivre ≥ 3 bar** — valeur connue, appliquée d'office aux calculs | **FAIT** (bascule à 3 bar) |
| 3 | **Au robinet, il donne la pression DYNAMIQUE ET STATIQUE** | **PAS FAIT** — un seul champ `pression` aujourd'hui, et surtout : *ce qu'on FAIT de l'écart entre les deux n'est pas su* |
| 4 | **Une case pour joindre une PHOTO** d'une zone avec ses métrés | **FAIT le 17 août** — la section 2 EST le croquis. La photo se joint, s'affiche, survit au rechargement. La LECTURE des cotes reste impossible ici (page statique), et l'écran le dit |
| 5 | À partir de la photo et des métrés, **estimer les réseaux** (« deux réseaux d'arroseurs, un de goutte-à-goutte ») | Le découpage existe (`decouper`) à partir des zones SAISIES, pas d'une photo |
| 6 | **Les mètres linéaires de PEHD Ø25 ou Ø32**, choisis selon les distances, le débit des arroseurs et la pression saisie | **DÉBLOQUÉ ET FAIT le 17 août** — sa règle est arrivée, voir ci-dessous. La LONGUEUR reste à mesurer, le DIAMÈTRE se calcule |
| 7 | **La liste exacte des pièces à commander** | **FAIT** — buses, corps par famille, SBE, PEBD, réseau latéral, nourrice |
| 8 | **Un plan avec les réseaux en COULEURS** (réseau 1 bleu, 2 vert, 3 jaune…) | **FAIT le 17 août** — voir ci-dessous, et ça a demandé plus qu'une couleur |
| 9 | **Le regard placé sur le plan**, « bien souvent caché, donc on le met dans les massifs » | **PAS FAIT** — voir le blocage ci-dessous |
| 10 | **Le total à ses prix**, une fois son registre rempli | **FAIT** (`arrosage-tarifs.html`) |

**⚠ DEUX BLOCAGES DE STRUCTURE, à ne pas contourner par une invention.**

1. **La photo ne peut pas être LUE par cette page.** `appli/` est publié en
   pages statiques (`pages.yml`) : pas de serveur, pas de modèle d'IA. Joindre
   une photo et l'afficher à côté du plan est faisable ; en tirer des cotes
   automatiquement ne l'est pas ici. L'application Next.js, elle, sait déjà
   recevoir une photo et interroger un modèle (`src/server/ai/`) — **c'est là
   que ce morceau devra vivre**, ou alors la page devra parler à un service.
   Ne pas promettre la lecture automatique depuis la page essayable.
2. **Le plan d'ensemble n'existe pas, et le regard n'a donc nulle part où se
   poser.** Aujourd'hui chaque zone est dessinée SEULE : l'outil ne sait pas où
   la pelouse est par rapport au massif. « Mettre le regard dans les massifs »
   suppose un plan du jardin entier, avec les zones les unes par rapport aux
   autres — c'est-à-dire exactement ce que le croquis photographié apporterait.
   **Placer le regard « quelque part » avant cela serait inventer un jardin.**

**✅ IL A REVU L'OUTIL ÉCRAN PAR ÉCRAN — 17 août au soir, et deux sections
changent.** Sa consigne, mot pour mot : *« Tu supprimes la 3, et la 2 ça doit
être la photo du croquis qu'on ajoute. »*

| Avant | Après |
|---|---|
| 1 · Le point d'eau | inchangé |
| 2 · Les zones | **2 · Le croquis** — la photo d'abord, les zones dessous, à corriger en la regardant |
| 3 · Le découpage en secteurs | **supprimée** |
| 4 · Le plan | **supprimée elle aussi**, une heure plus tard — voir ci-dessous |
| 5 · La liste | 3 · La liste |

**Ce qui est parti avec la section 3, et qu'il faut savoir pour le lui rendre
s'il le redemande :** le tableau des secteurs, les durées d'arrosage, le cycle
total (« départ 3 h 00, fin 6 h 14 ») et **le sélecteur de saison**. Le CALCUL,
lui, tourne toujours — c'est lui qui donne les couleurs du plan, le nombre
d'électrovannes et la fiche de nourrice. Seul l'écran a disparu.

**La photo est REDIMENSIONNÉE avant d'être gardée (1400 px, JPEG 0,75), et ce
n'est pas du confort :** une photo de téléphone pèse 3 à 8 Mo, `localStorage`
en accepte ~5 pour TOUT le jardin. Gardée telle quelle, elle ferait sauter la
sauvegarde entière — et c'est le jardin qui disparaîtrait au rechargement, pas
seulement l'image. Si l'enregistrement échoue quand même, on **remet l'état
d'avant et on le dit**, plutôt que d'afficher une photo qui ne survivra pas.

**ET LE PLAN A SUIVI, dans la foulée : *« je ne comprends pas à quoi sert le
3 ? »*, puis « enlevez-le ».** Il ne s'en servait pas. Ce plan-là dessinait
chaque zone SÉPARÉMENT, en rectangles abstraits — utile pour vérifier un
compte (c'est lui qui a montré l'arroseur en trop du quinconce), mais ce n'est
pas le plan qu'il veut : le sien, c'est la planche 75, avec le terrain entier,
le regard et les tuyaux. Un écran intermédiaire qui ne sert qu'au développeur
n'a rien à faire sous ses yeux.

**Ce qui reste donc à l'écran : trois sections.** Le point d'eau, le croquis,
la liste. **Et ce qui tourne toujours dessous, invisible :** la pose
(`pointsDeLaPose`), le découpage (`decouper`), l'affectation des arroseurs aux
vannes (`reseauDuPoint`) — sans quoi ni le nombre d'électrovannes, ni la fiche
de nourrice, ni les tés du réseau latéral ne seraient justes. **Le coloriage
par réseau, lui, n'existe plus** : il vivait dans le plan. Il reviendra avec
le vrai plan d'ensemble.

**⚠ LES CONTRÔLES QUI LISAIENT LA SECTION 3 ONT ÉTÉ REPORTÉS SUR LE CALCUL**
(`decouper()`), pas supprimés : aucun secteur au-dessus du robinet, les durées
qui baissent en avril, le découpage qui ne recâble pas. C'est la même leçon que
le matin — **un contrôle garde une règle, pas un écran.** Et trois gardes
nouvelles sur le croquis, éprouvées à l'envers : la photo s'affiche, survit au
rechargement, se retire, et l'écran ANNONCE qu'il ne lit pas encore les cotes.

**✅ LA CIBLE EST MAINTENANT ESSAYABLE — `appli/arrosage-croquis.html`, 18 août.**

Sa demande : *« une fois que j'ai envoyé la photo de mon jardin avec les
mesures, il y a le petit encart où on peut choisir la marque. Tout ce qu'il y a
en dessous, tu peux le supprimer. Et une fois que tu as lu les mesures avec
l'IA, tu me fais le plan en couleur avec les différents réseaux, contenant la
nourrice, les PE en pointillés, les arroseurs représentés par des ronds, et tu
me fais la liste des pièces à acheter [...] Avant de coder quoi que ce soit,
crée-moi une maquette dynamique que je puisse essayer, pas de photos en .html. »*

- **Un seul écran de saisie** : la photo et la marque. Rien d'autre, comme il l'a
  demandé.
- **Le plan** : un réseau une couleur, PE en pointillés, arroseurs en ronds,
  nourrice dans son regard, massifs en bandes à la couleur de leur vanne —
  **dripline non tracée**, sa consigne.
- **Les pièces en casiers** : les arroseurs, le goutte-à-goutte, la nourrice, le
  réseau enterré, la tête de réseau, le tuyau PE. Un bandeau dit d'un coup
  combien de réseaux, quel arroseur, quel diamètre d'amenée.
- **Ce qui est SIMULÉ, et la page le dit en rouge** : la lecture de la photo —
  une page statique n'a pas de serveur. Trois jardins d'exemple tiennent lieu de
  lecture. Le plan et la liste, eux, sont vraiment calculés sur son catalogue.

**Ce qui reste à trancher avec lui** — à ne pas deviner :
la longueur d'une couronne de PE (comptée à 50 m, marqué *à confirmer* : c'est
le conditionnement de son fournisseur, pas une donnée du catalogue), la longueur
des antennes vers les réseaux (elle dépend du tracé sur le terrain — inventée,
elle se paie à la pose), et la pression nominale de son PEHD, qui décide du
verdict Ø25/Ø32.

**LA CIBLE EST DESSINÉE — planche `75-le-plan-comme-le-sien.html`, 17 août.**
Il a envoyé la photo d'un **plan d'exécution professionnel** : échelle 1/100e,
légende (DRIPLINE, Turbine 3504, Tube PE.H.D, Électrovanne 9 V), symboles,
diamètres Ø16 et Ø25 cotés le long des tuyaux, robinet repéré. Sa demande :
*« Lorsqu'on te donne un croquis comme celui-là, tu rentres toutes les infos
comme sur la photo […] tu me fais ça en couleur, tu sépares les réseaux, chaque
réseau d'une couleur différente. C'est là où je veux arriver au final. »*

**Ce que la planche fixe, et qu'il faut lui faire valider avant d'écrire quoi
que ce soit** (règle du §3 bis — une planche se corrige en dix minutes, un
moteur de plan en deux jours) :

| | |
|---|---|
| Symboles | cercle = arroseur, nœud papillon = électrovanne, tireté = PEHD, ⊕ = robinet — les siens |
| Couleurs | une par réseau, **jusque dans le regard** : chaque électrovanne porte la couleur de sa vanne |
| Dripline | **NON TRACÉE** — sa consigne : *« juste la dripline, ça tu ne le mets pas »*. Lu comme : sa vanne reste, son tracé au sol disparaît. **À confirmer d'un mot** |
| Regard | posé **dans le massif**, caché, comme il le fait |
| Cotes | côtés de la pelouse et diamètres, le long des tuyaux comme sur sa photo |

**CE QUI MANQUE POUR LE CODER, ET C'EST UNE SEULE CHOSE : un jardin
D'ENSEMBLE.** Tout ce qui est chiffré sur cette planche, l'outil le calcule
déjà — les onze têtes, le quinconce, les couronnes, la coupe en deux vannes,
la liste entière. Ce qu'il ignore, c'est **où les zones sont les unes par
rapport aux autres** : il connaît des zones, pas un terrain. Sans cela, ni le
regard, ni les tuyaux, ni le robinet n'ont d'endroit où se poser.

**Deux façons de le lui donner, et c'est la question suivante :** il place ses
zones lui-même sur un quadrillage (faisable tout de suite, quelques gestes),
ou il photographie le croquis et on le lit (plus proche de son geste, mais la
page publiée ne sait pas lire une photo — il faut passer par l'application).

**Un piège de dessin payé sur cette planche, et il vaut au-delà d'elle :** le
contour de la pelouse était un second `<rect class="gazon" fill="none">` posé
APRÈS les couronnes. **Une règle CSS l'emporte sur un attribut de présentation
SVG** — `fill="none"` était donc ignoré, le rectangle repeignait la pelouse en
opaque, et le plan s'affichait proprement SANS la seule chose qu'il doit
montrer : le recouvrement. Vu sur la capture, par rien d'autre.

**Ce qui est donc faisable tout de suite, sans rien inventer :** les couleurs
par réseau sur les plans de zone existants (#8, fait), et la case photo comme
PIÈCE JOINTE montrée à côté du plan (#4 partiel, pas encore fait).

**#8 EST FAIT — et il a fallu réparer le découpage pour l'obtenir.** Colorier
supposait de savoir QUEL ARROSEUR EST SUR QUELLE VANNE : `decouper()` ne le
savait pas. Il comptait « il faut 4 secteurs » en divisant le débit total en
parts égales, sans jamais désigner les arroseurs de chacun. Trois choses ont
donc changé, et les deux dernières corrigent de vrais défauts :

1. **`decouper()` rend `reseauDuPoint`** — le numéro de vanne de chaque tête,
   et le plan colorie d'après CETTE liste, jamais un second calcul à côté
   (§3 ; c'est cette divergence-là qui avait produit l'arroseur en trop du
   quinconce).
2. **La coupe suit l'ORDRE DE POSE et reste d'un seul tenant.** Une vanne
   dessert une bande continue, jamais un arroseur sur deux — une coupe
   alternée donnerait le même compte et un plan impossible à poser.
3. **Le débit annoncé d'un secteur est celui de SES arroseurs.** Les parts
   égales étaient une fiction : sur la pelouse arrière, la coupe réelle donne
   0,80 et 0,96 m³/h, pas deux fois 0,88. L'écran annonçait un chiffre que le
   plan démentait.

**Deux pièges rencontrés là-dedans, à ne pas réintroduire :**

- **Couper seulement entre RANGÉES ne marche pas.** La rangée du milieu de la
  pelouse avant boit 1,77 m³/h à elle seule, au-dessus de la limite de 1,53 :
  insécable, elle fabriquait un secteur en dépassement. On coupe donc **au
  point près**, dans l'ordre de pose — une longue rangée alimentée par deux
  vannes, une à chaque bout, est ce qu'on pose tous les jours.
- **Remplir jusqu'à la limite déséquilibre.** Le premier remplissage donnait
  9 têtes sur une vanne et 2 sur l'autre : juste au sens du débit, absurde au
  sens du chantier. On calcule donc d'abord COMBIEN de vannes il faut, puis on
  répartit autour de cette moyenne, la limite ne servant plus que de garde-fou.

Les couleurs commencent par les siennes (bleu, vert, jaune) et bouclent
au-delà de huit ; **le NUMÉRO reste écrit à côté de la pastille**, pour que le
plan se lise aussi quand on distingue mal deux teintes.

**✅ SA RÈGLE DU Ø25 / Ø32 — 17 août, et elle débloque #6.** *« Du compteur au
regard : Ø25 par défaut. Passer en Ø32 UNIQUEMENT si le calcul hydraulique
démontre que le Ø25 est insuffisant. »* Le Ø32 doit donc se MÉRITER : il coûte
plus cher et se pose moins bien.

Le calcul est celui de Hazen-Williams (C = 150 pour le PE lisse), sur le débit
du **plus gros secteur** — les vannes s'ouvrent l'une après l'autre, jamais
ensemble, c'est tout l'objet du découpage ; prendre la somme
surdimensionnerait chaque chantier. Le verdict tombe quand la pression restant
au regard passe sous celle à laquelle les buses posées sont données au
catalogue. Sur le jardin d'exemple : 30 m → Ø25 (perte 0,27 bar) ; 150 m → Ø32.

**⚠ CE QUE CE CALCUL NE CONTIENT PAS, et l'écran le dit :** les pertes des
antennes, des raccords, de l'électrovanne, du disconnecteur. Un « le Ø25
suffit » est donc un PLANCHER, pas une garantie — ce qu'il tranche sûrement,
c'est l'inverse. **Et les diamètres INTÉRIEURS sont `provisoire`** : ils
dépendent de la pression nominale du tube (PN6/PN10/PN16), qu'il n'a pas
précisée, et se tromper de gamme fausse le verdict dans le sens dangereux.
Ce sont ceux du PN10. À lui confirmer.

**✅ LES TUYÈRES SONT POUR LES PETITS ESPACES — sa règle du 17 août, et elle
corrige un seuil FAUX de moitié.** *« Les tuyères, on s'en sert uniquement pour
les petits espaces : inférieur à 3,50 m, 4 m grand max. Sinon on passe en 3504
ou plus gros. Un carré de douze par dix, c'est que des arroseurs, pas de
tuyères. Les tuyères, c'est un carré de trois par trois, ou un long couloir de
dix mètres sur deux de large. »*

Le seuil était à **8 m**, il est à **4**. Ce n'est pas un détail : une pelouse
de 12 × 8 partait en tuyères, donc en pluviométrie triple, beaucoup plus de
têtes et beaucoup plus de débit — des secteurs en plus et une facture sans
rapport. **C'est le PETIT CÔTÉ qui décide, et lui seul** : ses deux exemples le
disent, le couloir de 10 × 2 prend des tuyères malgré ses 10 m de long.
Un repli vers les tuyères au-delà de 4 m est désormais **interdit** : si aucune
turbine ne pave, l'écran le dit plutôt que de rendre un plan posable et faux.

**Le jardin d'exemple a dû changer avec cette règle** : ses deux pelouses
étaient forcées en tuyères pour montrer une bascule, ce que sa règle interdit
maintenant. Elles passent sur « au mieux », et **son couloir de 10 × 2 m entre
dans le jardin** pour que les tuyères restent montrées là où elles ont leur
place. Un écran d'accueil qui viole la règle qu'il vient de donner enseigne le
contraire de ce qu'il a dit.

**⚠ ET UN DÉFAUT QUE CETTE RÈGLE A RÉVÉLÉ, VU SUR LE PLAN ET PAR AUCUN TEST :
deux pluviométries sous une même vanne.** La clé de groupe ne portait que le
TYPE ('turbine'/'tuyère') : tant que les deux pelouses étaient l'une en
turbines et l'autre en tuyères, elles ne se rencontraient jamais. Le jour où
sa règle les a mises toutes deux en turbines, elles se sont retrouvées sur la
même vanne avec **5,9 et 6,1 mm/h** — et c'est le plan, en les coloriant de la
même couleur, qui l'a montré. La pluviométrie entre donc dans la clé de
groupe : sa règle « ça ne se mélange jamais », appliquée à la lettre.

> **~~Renversé le 23 août 2026~~ par le patron lui-même** — *« ne prends pas en
> compte la pluviométrie »*. Elle est sortie de la clé de groupe : deux buses
> différentes peuvent désormais partager une vanne, avec des mm/h différents
> pour une même durée d'ouverture, et **c'est lui qui arbitre à l'arrosage**.
> Le MATÉRIEL, lui, sépare toujours (`ARCHITECTURE.md` §151). Le récit ci-dessus
> est conservé pour qu'on ne rouvre pas la question en croyant l'inventer.

**Ce que ça lui coûte, et il faut le lui dire :** une vanne de plus quand deux
zones portent des buses différentes, même de 3 % d'écart. C'est le sens
prudent — jamais de sous-arrosage — mais s'il juge que quelques pour cent se
tolèrent, la clé se relâche en une ligne.

---

### 0 quaterquadragies. Le plan d'arrosage — **DEUX CHOIX TRANCHÉS, une maquette essayable**

**Tranché le 17 août 2026 :**

| Question | Sa réponse |
|---|---|
| Par où il entre son jardin | **B** — les zones qu'il mesure, Atlas pose le matériel |
| Ce qui sort du plan | **la LISTE du matériel**, pas un devis |
| La forme des maquettes | **essayables**, pas des images : *« je veux que tu code rien, d'abord des maquettes dynamiques en .html que je puisse essayer »* |

**Ses mots sur la sortie, qui valent mieux qu'un résumé :** *« il faut simplement
créer le plan et la liste du matos à acheter, ensuite moi j'envoie à mes
fournisseurs, ils me font un devis, puis je repasse par le circuit normal de
l'application pour rédiger le devis et l'envoyer à mes clients. »*

**Conséquence tenue à la lettre : AUCUN PRIX dans cet outil.** Ni total, ni
estimation. Atlas ne chiffre rien qu'un fournisseur n'ait chiffré. Le devis
client emprunte le parcours qui existe déjà.

**La page essayable : `appli/arrosage.html`**, publiée avec l'appli, donc
ouvrable au téléphone. Elle est dans `appli/` et non dans `docs/maquettes/`
parce que c'est le seul dossier PUBLIÉ du dépôt : les planches y sont sans
JavaScript, et il demande à essayer. Gardée par `appli/tests/e2e.js`, jouée
avant publication **et contre le site en ligne**.

**⚠ RIEN N'ENTRE DANS LE CATALOGUE AVANT SES RÉPONSES — sa consigne du
17 août 2026 :** *« avant d'enregistrer quoi que ce soit dans la base de
données, tu me poses toutes les questions nécessaires dont tu as besoin pour
bien comprendre […] et surtout tu me dis que tu as compris. Moi je connais le
métier par cœur, donc ça va être moi ton chef d'orchestre. »*

**L'objectif, dans ses mots :** *« construire l'outil de mes rêves, que les
utilisateurs qui ne connaissent rien en arrosage, à partir d'un plan, tu puisses
leur sortir exactement tout le matos dont ils vont avoir besoin : le nombre
d'arroseurs, le nombre de tuyères, mais également le nombre de mètres linéaires
de goutte-à-goutte. »* Ce n'est donc PAS un outil d'expert : la personne devant
l'écran ne sait rien du métier, et tout ce qui demande un jugement doit être
tranché par la règle qu'il aura donnée, pas par une case à cocher de plus.

**LES QUESTIONS POSÉES LE 17 AOÛT, et l'état de ses réponses.** Ne pas les
reposer si elles sont déjà répondues plus bas ; ne rien enregistrer sur celles
qui ne le sont pas.

| # | Question | Sa réponse |
|---|---|---|
| 1 | Le « recouvrement d'au moins 80 % » : écart entre deux arroseurs = 80 % de la portée ? | *en attente* |
| 2 | Pose en carré ou en quinconce (triangle) ? | *en attente* |
| 3 | Portée et débit donnés à quelle pression ? | *en attente* |
| 4 | Corps + buse, ou corps seul ? Le débit annoncé est-il celui du cercle entier ? | *en attente* |
| 5 | À partir de quelle largeur passe-t-on de tuyères à turbines ? | *en attente* |
| 6 | Jusqu'à quel % du débit du robinet charge-t-on un secteur ? | *en attente* |
| 7 | Ne jamais mélanger turbines/tuyères, ni arroseurs/goutte-à-goutte : confirmé ? | *en attente* |
| 8 | Massif : combien de lignes de gaine ? Haie : une ou deux ? Potager : au rang ? | *en attente* |
| 9 | Le diamètre de tuyau suit-il une règle (débit du secteur) ou est-ce au cas par cas ? | *en attente* |
| 10 | Une grande nourrice ou deux petites au-delà d'une certaine taille ? | *en attente* |
| 11 | Le croquis du client : rectangles simples, ou formes libres avec obstacles ? | *en attente* |
| 12 | L'utilisateur qui ne connaît rien saura-t-il mesurer son débit ? Faut-il une valeur par défaut ? | *en attente* |
| 13 | Le choix de marque vaut-il aussi pour le **goutte-à-goutte** et le **reste du matériel** (vannes, programmateur, nourrice), ou seulement pour les arroseurs et tuyères ? | *en attente* |
| 14 | Quelles marques mettre dans le bandeau en plus de **Rain Bird** et **Toro** ? | *en attente* |
| 15 | Le choix de buse : je prends **la plus grande qui tienne dans le petit côté** (donc le moins d'arroseurs). C'est bien votre règle ? | *en attente* |
| 16 | La **8-VAN** annonce 0,16 m³/h à 90°, soit plus que la 10-VAN (0,14) qui porte pourtant plus loin. Coquille du catalogue, ou valeur juste ? | *en attente* |
| 17 | Les buses sont données **à 2 bar**. Que faire quand l'installation tourne à 3 : autre tableau, ou correction ? | *en attente* |
| 18 | ~~Les corps escamotables~~ — **REÇUS le 17 août** : Rain Bird série 1800 (RT1802-1832, 4 hauteurs × 3 options), Hunter Pro-Spray/I-Spray (7 réf.). Voir ci-dessous |

**SES RÉPONSES DÉTAILLÉES DU 17 AOÛT — LE MÉTIER, PAR LUI.** Tout ce qui suit
est appliqué dans `appli/arrosage.html`. Ne pas le redéduire, ne pas l'assouplir.

| # | Sa règle | Où c'est |
|---|---|---|
| 5 | **« 80 % minimum entre chaque arroseur. Portée 5 m : distance ~5,50 m, 6 m max, 5 m étant la perfection. Jamais moins. En dessous de 5 m, 4 m, 3 m : JAMAIS. »** Donc écart ∈ [portée ; 1,2 × portée]. L'outil faisait exactement l'inverse (0,8 × portée) | `ECART_MAX_FACTEUR`, `paveSelonSaRegle` |
| 6 | **Quinconce au-delà de 4 arroseurs, carré en dessous. « Les derniers arroseurs doivent toujours être dans les coins »** — pourtour régulier, seules les rangées intérieures se décalent | `QUINCONCE_AU_DELA_DE`, `dessinerPlans` |
| 7 | Il enverra **un tableau portée × distance** : l'écart viendra alors du catalogue, pas d'un facteur | à venir |
| 8 | **85 % du débit par secteur : confirmé** | `MARGE` |
| 9 | **« Ça ne se mélange jamais »** — ~~ni deux pluviométries~~ (retiré par lui le 23 août 2026), ni deux familles | `decouper()` |
| 10 | **Massifs : lignes tous les 80 cm. Potager : 70 cm. Haies : une ou deux lignes, À DEMANDER à l'utilisateur** | `TYPES`, forme `nappe` |
**LES RÉPONSES DU 17 AOÛT (deuxième tour, formulaire à cocher) :**

| Question | Sa réponse |
|---|---|
| Comment poser les R-VAN (deux références par taille) | *« La R-VAN s'utilise lorsqu'on a moins de débit/pression que recommandé — privilégier les 360°. »* Rien à seuil numérique donné : **non câblé** dans le calcul, resté en note. Il précise n'avoir jamais utilisé de R-VAN lui-même |
| Corps par défaut | **10 cm, sans option** — voir plus haut, câblé |
| Buses en jet plat, R-VAN, MP Rotator : lesquelles comptent | *« Ce que j'utilise le plus sont les VAN […] les MP Rotator, plus chers, aspect différent, haut de gamme, à présenter tel quel, l'utilisateur choisira. »* VAN reste la référence par défaut. MP Rotator : présentés comme un choix à part une fois ses portées/débits reçus — **aucune spécification technique n'était sur la photo**, rien à enregistrer encore |

**CE QUI N'A PAS EU DE RÉPONSE DIRECTE, à redemander sans insister :** les
buses en jet plat (bordures rectangulaires) — sa réponse a porté sur la
hiérarchie VAN / R-VAN / MP Rotator sans trancher ce point précis.

| 12 | Une grande nourrice ou deux petites : **« question à poser à l'utilisateur, il décidera »** | à faire |
| 13 | Le croquis client sera **les deux** — carré simple, ou avec obstacles, courbes, arbre au milieu. **« Je vais te donner les clés »** | à venir |
| 14 | **L'utilisateur dit s'il se repique juste après le compteur** (le meilleur cas : la ville délivre ≥ 3 bar, c'est du sûr). Sinon **on lui explique quoi faire** pour avoir les bonnes infos | champ `compteur` |
| 15 | Le choix de marque vaut **aussi pour les électrovannes**, pas pour le reste | `suitLaMarque` |
| 16 | D'autres marques viendront **au fil des photos** | — |
| 17 | **« À 2 bar ou 3 bar c'est quasiment les mêmes valeurs »** — aucune correction de pression à faire | — |
| 18 | Les **corps escamotables** arrivent | `CATALOGUE.corps`, vide |

**LE RÉSEAU LATÉRAL — sa planche manuscrite, 17 août 2026 : la tuyauterie
ENTRE les arroseurs d'un même secteur, jamais couverte avant (tout portait sur
un arroseur isolé).** Trois positions le long d'une ligne PE25 : DÉPART et
MILIEU (le même té : 90° taraudé 25×3/4"×25) ; FIN (un coude taraudé 25×3/4",
puisque rien ne continue) ; et JONCTION (un té 90° 25×25×25, non taraudé — un
coude de tuyauterie qui n'alimente rien à cet endroit).

**Ce qui a été calculé sans attendre, parce que ça ne dépend PAS du tracé :**
chaque arroseur porte en réalité **DEUX SBE**, pas un — celui du bas (toujours
3/4", sur le raccord de tuyauterie) et celui du haut (au diamètre du corps,
déjà compté). Le SBE du bas était absent de la liste ; il y est maintenant.
Et « environ 2 m de PEBD rigide Ø16 » par arroseur, compté (`totalArroseurs × 2`).

**✅ LE TRACÉ EST TRANCHÉ ET CALCULÉ — 17 août, planche `73-le-trace-du-tuyau.html`.**
Posée en dessin sur sa demande (*« fais-moi un croquis pour cette question que
je te réponde correctement »*) : deux tracés du même secteur (3 rangées de
4 arroseurs), à toucher pour comparer. Sa réponse : **B**, plusieurs lignes
parallèles depuis un tronc au regard — **avec une correction essentielle** :

> *« C'est le B, sauf que la jonction […] ressemble à un té […] un coude avec
> un tuyau, le tuyau on peut le courber pour former le coude. Chose qu'on ne
> peut pas faire lorsque c'est un té, puisqu'on est obligé de couper pour
> mettre un té et remettre un bout de tuyau au milieu. »*

Autrement dit : **une jonction (té 25×25×25) à chaque rangée où le tronc
CONTINUE** au-delà (il faut couper le tuyau pour insérer le té) — **mais RIEN
à la toute DERNIÈRE rangée** : le tronc s'y arrête en se courbant, sans pièce
à couper. Pour un secteur de `ny` rangées : `ny − 1` jonctions, jamais `ny`.

**Câblé dans `listeMateriel()` (`appli/arrosage.html`), plus besoin d'écarter
ces pièces.** Par secteur : `nombre − ny` tés de ligne (départ + milieux),
`ny` coudes de fin, `max(0, ny − 1)` jonctions — `ny` et `nombre` viennent
directement de `poser()` (déjà calculés pour la couverture). Vérifié sur le
jardin d'exemple (18×12 m, quinconce) : nx=4, ny=3, 11 points → 8 tés,
3 coudes, 2 jonctions. `essai-arrosage-detaille.cjs` (32/32) et `tests/e2e.js`
(90/90) au vert après le câblage.

**Et la règle GÉNÉRALE derrière, donnée en croquis le même jour :** compter
les **portions de tuyau** qui se rejoignent en un point. **Deux → coude**
(le tuyau se courbe, aucune pièce). **Trois → té/jonction** (on coupe le
tuyau pour insérer la pièce). Départ/Milieu (3 portions), Fin (2), jonction
du tronc (3 tant qu'une rangée suit, 2 à la dernière) en découlent tous —
à reprendre telle quelle pour tout futur point de raccordement plutôt que
de redemander un cas par cas.

**✅ ET IL A ÉPROUVÉ LA RÈGLE SUR UN TRACÉ LIBRE — planche `74-ou-sont-les-tes.html`,
17 août.** *« Combien de té ? Où sont-ils ? Marque-les d'un point jaune ! »*
sur un croquis à lui : six arroseurs **répartis n'importe comment** autour du
regard, courbes, branches inégales — **pas une grille**. C'était un contrôle,
pas une demande de dessin : une règle qui ne tiendrait que sur une grille ne
vaudrait rien sur un chantier réel.

**Elle tient, et elle se résume à un nombre : `N − 1`.** Un réseau part d'UNE
ligne au regard et doit finir sur `N` bouts ; chaque té coupe une ligne en
deux, donc ajoute un bout. D'où `N − 1` tés, **quelle que soit la forme du
terrain et quel que soit l'ordre dans lequel le tuyau relie les arroseurs**.
Six arroseurs → cinq tés, marqués et numérotés sur la planche.

**Ce que ce contrôle prouve sur le code, et c'est la vraie prise :** l'outil
compte sur une grille `(nombre − ny)` tés de ligne + `(ny − 1)` jonctions —
**dont la somme vaut exactement `nombre − 1`**. Les deux comptages, l'un par
la grille et l'autre par la topologie, tombent sur le même nombre : la formule
de `listeMateriel()` **n'était donc pas un cas particulier de la grille**, elle
vaut aussi sur un tracé libre. Rien à corriger dans le code — mais désormais on
sait *pourquoi* elle est juste, et non plus seulement qu'elle l'est sur
l'exemple.

**Et la règle est GARDÉE, par son invariant plutôt que par des nombres**
(`essai-arrosage-detaille.cjs`) : le contrôle vérifie
`tés + jonctions === arroseurs − réseaux` et `tés + coudes === arroseurs`,
pas « 8 tés sur ce jardin-là » — un compte figé serait périmé au prochain
catalogue, l'invariant non. **Éprouvé à l'envers avant d'être gardé** : posé
à `ny` jonctions au lieu de `ny − 1` (l'erreur exacte que sa correction
visait), il rougit ; posé à `nombre` tés au lieu de `nombre − ny`, les deux
contrôles rougissent. Remis droit, 35/35 au vert.

**LA NOURRICE SE MODIFIE QUAND UNE VOIE PART EN GOUTTE-À-GOUTTE — sa règle du
17 août.** *« À ne pas oublier : lorsqu'un réseau est pour du goutte-à-goutte,
quelques modifications s'appliquent […] tout le reste ne doit pas être
modifié, que ce soit pour une voie ou six — respecte la règle des pièces que
je t'ai envoyée. »* Par voie en goutte-à-goutte : l'électrovanne 100 DV 1"
**MM** standard de la fiche cède la place à une électrovanne 100 DV 1" **FF**,
plus un régulateur de pression FF 3/4", plus deux mamelons réduits MM
1"-3/4" et un mamelon fileté MM 1". Les autres voies de la même fiche, elles,
gardent EXACTEMENT les pièces qu'il a transcrites — rien n'est retouché
au-delà des voies concernées.

`CATALOGUE.ficheNourrice(n, combienGoutte)` fait cette bascule : elle part de
la fiche de base à `n` voies, réduit l'électrovanne MM du nombre de voies
goutte-à-goutte, ajoute les pièces FF, puis fusionne les lignes de même
référence (le mamelon réduit de la fiche de base et celui ajouté par la
bascule ne doivent faire qu'UNE ligne, pas deux — piège trouvé et corrigé
avant publication : la liste affichait « 2 u » deux fois plutôt que « 4 u »
une fois). `arrosage.html` compte les voies goutte-à-goutte du jardin
(`combienGoutteAGoutte`) et passe ce nombre partout où une fiche de nourrice
est lue — liste au fournisseur, panneau nourrice, texte envoyé aux
fournisseurs.

**LES SIX FICHES DE NOURRICE SONT ARRIVÉES — de 1 à 6 voies, 17 août.**
*« Voici toutes les pièces pour la nourrice, ce qui se trouve dans le regard
d'arrosage. »* `CATALOGUE.nourrices[1..6]` porte désormais les vraies pièces
— clarinettes, coudes, unions, électrovannes Rain Bird 100 DV, regards
(rectangle 12", jumbo RG17106, jumbo 5/6 voies), programmateurs BL-IP,
connexions étanches. Un catalogue de pièces dédupliqué (`piecesNourrice`) les
porte une seule fois, référencé par chaque fiche — retaper « Électrovanne
100 DV » six fois aurait fini par diverger.

**Elles REMPLACENT les lignes génériques**, plutôt que de s'ajouter à côté :
« Électrovannes 24 V », « Regards de vannes », « Programmateur X voies »
disparaissent dès qu'une fiche existe pour le nombre de secteurs — remplacées
par ses vraies références, dans la liste chiffrable ET dans le registre de
prix. Ce qui reste toujours, quelle que soit la fiche : réducteur de pression
et sonde de pluie — des pièces de tête de réseau, jamais dans un regard.

**Le DISCONNECTEUR n'y est plus — sa décision du 18 août :** *« le
disconnecteur, tu peux le supprimer à tout jamais, je n'en mets jamais. »* La
liste sert à commander ce qu'IL pose. Ne pas le remettre au motif qu'un réseau
raccordé à l'eau potable en demande un : c'est juste en général, et ce n'est
pas sa pratique. Deux contrôles gardent son absence (`essai-arrosage-detaille`,
`e2e.js`), retournés plutôt que supprimés pour que la question ne se rouvre
pas. L'entrée reste au catalogue, inutilisée.

**Ce qui n'est PAS dans ses fiches, et n'a pas été ajouté en silence :** aucun
disconnecteur ni réducteur listé dans le regard — cohérent avec leur position
en tête de réseau. **La redite de la fiche 6 voies est CONFIRMÉE, pas une coquille — 17 août.**
Sa réponse : *« oui c'est voulu, c'est comme ça que se constitue une nourrice
6 voies. »* Même clarinette « 4 vannes » que la fiche 5, plus un Té 1'' MMF en
plus. Ne pas y toucher.

**LES COUDES SBE REMPLACENT LA « CROSSE » GÉNÉRIQUE — 17 août.** *« Sous les
arroseurs il faut obligatoirement des coudes SBE, choisis-les en fonction des
diamètres, un à chaque fois par arroseur. »* Deux références (`CATALOGUE.coudes`) :
OD501 (SBE 050, 16×1/2") et OD502 (SBE 075, 16×3/4"). Le choix suit le
**taraudage du corps posé**, pas une case cochée à part — chaque corps porte
désormais son `filetage` ('1/2' ou '3/4'), relevé sur les photos. L'ancienne
ligne « Crosse de raccordement », un espace réservé jamais raccordé à rien de
réel, a disparu.

**LE PLAN AVAIT UN ARROSEUR EN TROP — trouvé par lui, sur une capture cerclée
en rouge, le 17 août.** Le quinconce DÉPLAÇAIT les arroseurs sans jamais en
retirer un : même nombre qu'une grille carrée, juste décalés, ce qui entassait
deux têtes d'un côté et laissait un trou de l'autre. Corrigé : une rangée
décalée porte désormais UN ARROSEUR DE MOINS que la rangée alignée, posé entre
chaque paire de la rangée voisine. Sur le jardin d'exemple (18×12 m, buse
18-VAN) : 12 → 11. **Le plan et le calcul partagent maintenant la MÊME liste de
points** (`pointsDeLaPose`), pour que les deux ne puissent plus diverger comme
ils l'avaient fait — règle du §3 du dépôt, appliquée après coup.

**✅ LES SIX FAMILLES DE TURBINES SE POSENT — débloqué le 17 août par sa
réponse sur le débit.** Hunter PGP-ADJ, PGP Ultra, I 20-04 Ultra ; Rain Bird
5000 Plus, 3504 ; Hunter SRM-04, PGJ ; Toro Mini 8 — corps ET buses.

**CE QUI BLOQUAIT :** une seule valeur de débit par numéro de buse, aucune
répartition par angle (contrairement aux tuyères VAN/SRS dont le tableau donne
90°/180°/270°/360°). `busesDe` exige les trois angles, donc aucune turbine
n'était choisie. **Sa réponse tranche, et il a fallu trois formulations pour
la lui poser correctement** — les deux premières parlaient d'« angle », et il
répondait sur le PLACEMENT (coin/bord/milieu), qui était déjà juste :

> *« Les débits, portées qui sont dans le tableau sont donnés pour les
> arroseurs en 360 degrés ; c'est les mêmes données que pour 90 ou 180
> degrés. »*

**Donc : le chiffre du tableau vaut à tous les arcs — on n'a jamais eu à
diviser.** Un passage documenté dans `arrosage-catalogue.js` recopie le 360°
sur le 90° et le 180° des turbines, et **de rien d'autre** : les tuyères
gardent leurs valeurs par angle, qui sont réellement différentes (6-VAN :
0,27 à 90°, 0,32 à 360° — jamais proportionnelles). Physiquement cela se tient :
une turbine projette un filet par un orifice fixe qui balaie l'arc, alors
qu'une tuyère projette un éventail dont la largeur change avec l'arc.

**Ce que ça change sur le jardin d'exemple :** la pelouse arrière passe en
turbines 3504, son débit tombe de 3,4 à 1,76 m³/h, et le jardin passe de
**10 secteurs à 7**.

**LA LEÇON DE MÉTHODE, ET ELLE VAUT POUR TOUTES LES QUESTIONS À LUI POSER.**
Une question qui reste sans réponse deux fois n'est pas mal comprise : elle
est mal posée. « Le débit à 90° » se lisait comme « quand met-on du 90° » —
sujet qu'il maîtrise et qui était déjà réglé. La formulation qui a marché
nommait la SOURCE (« sur vos tableaux, il n'y a qu'un seul chiffre ») et non
le concept. **Montrer ce qu'on a relevé de ses photos, et lui demander ce qui
manque** — c'est ce tableau de trois colonnes qui a débloqué en un message ce
que deux formulaires n'avaient pas obtenu.

**⚠ ET UN DÉFAUT QUE CE DÉBLOCAGE A CRÉÉ, TROUVÉ SUR UNE CAPTURE ET PAR AUCUN
TEST.** Les turbines posées, la liste comptait toujours **un corps de TUYÈRE
pour tous les arroseurs** — 22 corps 1800 et 22 SBE 1/2" là où 11 arroseurs
étaient des turbines (corps 3504, et 3/4" sur les grosses séries). Les 39
contrôles étaient verts : aucun ne regardait le corps par famille. **C'est la
sixième fois dans ce dépôt qu'un défaut sort d'une image et d'aucun test**
(§5). Corrigé : `listeMateriel()` compte désormais le corps **par famille**,
et le SBE du haut **par diamètre de corps** — un jardin mixte porte donc les
deux diamètres, chacun pour sa part.

**Le corps d'une turbine ne se CHOISIT pas**, contrairement à celui d'une
tuyère (son sélecteur, « 10 cm sans option ») : la buse 0,75 du 3504 ne va que
dans un corps 3504. `CATALOGUE.corpsDeLaBuse` fait l'appariement en lisant la
référence (`RA3504-B075` → `RA3504`), et **un contrôle exige que chaque buse
de turbine posable trouve son corps** — sans quoi une convention de référence
cassée à la prochaine transcription ferait manquer un corps en silence, et le
chantier s'arrêterait à la pose. Le deuxième sélecteur de corps (pour qu'il
choisisse hauteur et options des turbines comme il le fait des tuyères) reste
à faire — mais plus rien n'est faux en attendant.

**LES BUSES MPR (5000 Plus, RBA2195-97) n'ont AUCUN débit sur la photo** — juste
un rayon et un prix. Elles sont « matched precipitation rate » (le même débit
au mm/h quel que soit l'arc, 90° à 360°), ce qui réglerait élégamment le
problème des R-VAN si leur débit était connu — mais il ne l'est pas encore.

**CINQ NOUVELLES PHOTOS REÇUES LE 17 AOÛT — ce qui est entré, et ce qui ne l'est PAS.**

| Reçu | Entré comment |
|---|---|
| Corps Rain Bird 1800 (RT1802 → RT1832) | Dans `CATALOGUE.corps` — 4 hauteurs (5/10/15/30 cm) × options (aucune, SAM, SAM-PRS) |
| Corps Hunter Pro-Spray / I-Spray | Dans `CATALOGUE.corps` — mêmes 4 hauteurs, I-Spray = régulateur intégré |
| Buses Hunter SRS (7A à 17A) | Dans `CATALOGUE.buses`, même forme que les VAN — **Hunter est maintenant une marque active**, pas seulement listée |
| Buses Rain Bird R-VAN (14/18/24) | Entrées, mais **NON choisies automatiquement** — voir ci-dessous, c'est le vrai sujet |
| Buses bande (SST/RCS/LCS, SS-530…) | **Pas entrées.** Zone rectangulaire, pas une couronne — tout le calcul de cette page suppose des cercles. Un cas à part, pas encore posé |
| Buses MP Rotator (NA23xx, TBT10xxx) | **Pas entrées.** Aucune portée ni débit sur la photo — juste réf et prix. Sans ces deux nombres, une entrée calculerait faux |

**⚠ LA VRAIE DÉCOUVERTE : LES R-VAN SE VENDENT EN DEUX RÉFÉRENCES, PAS UNE.**
Les VAN (p. 8) tiennent en une seule référence par taille, réglable de 90° à
360°. Les R-VAN (p. 9 bis) sont **deux produits physiques différents** : une
version réglable 45°-270° (jamais 360°), une version fixe 360° (jamais autre
chose). Le tableau le montre par ses « X ».

Une buse qui n'a QUE le 360° ne peut pas se poser dans un coin ni sur un bord —
elle arroserait chez le voisin. Une buse qui n'a QUE 45°-270° ne peut pas couvrir
l'intérieur. **Aucune des deux n'est donc choisie automatiquement** par le
calcul (`busesDe` exige les trois angles 90/180/360 sur une seule référence) ;
les deux restent visibles dans son registre de prix. Poser une pelouse avec des
R-VAN suppose de mélanger les deux références selon la position — un
pavage à deux références que l'outil ne fait pas encore.

**LE CHOIX DU CORPS EST TRANCHÉ le 17 août :** *« 10 cm sans option, mais
proposer à chaque fois les autres en expliquant ce qu'il apporte — l'utilisateur
décidera. »* Un sélecteur dédié (`#corps`), une phrase par option (hauteur : ce
qu'elle convient à faucher ; SAM : évite les fuites en point bas sur une pente ;
PRS : utile si la pression varie), défaut au 10 cm sans option, réversible.
Câblé dans la liste au fournisseur, un corps par arroseur posé — quand un a été
enregistré pour la marque courante.

**CE QUE SA RÈGLE D'ÉCART A RÉVÉLÉ, ET QUI N'ÉTAIT PAS VISIBLE AVANT :** le
choix de buse doit OBÉIR à la règle, pas être corrigé après coup. Une turbine de
9 m de portée ne pave pas une pelouse de 12 m de large — deux rangées feraient
12 m d'écart (au-delà de sa limite), trois en feraient 6 (sous la portée, ce
qu'il interdit). L'outil prend donc, de la plus grande à la plus petite, **la
première buse qui pave les deux côtés selon sa règle**. Il ne reste d'alerte que
sur les zones réellement impossibles.

**SES RÉPONSES DU 17 AOÛT (formulaire à cocher — c'est la forme qu'il demande,
pas des questions en vrac dans un message) :**

| Question | Sa réponse |
|---|---|
| Quel modèle pour la suite | **Sonnet pour rentrer le catalogue, Opus pour le calcul et les contrôles.** Le catalogue, c'est de la transcription ; une règle de calcul mal comprise se découvre sur le chantier |
| Le recouvrement de 80 % | **« Non, autre chose » — MA LECTURE EST FAUSSE, il l'expliquera.** L'écran l'annonce désormais comme provisoire : sans cela il essaierait l'outil sur une règle qu'il a écartée, et tout ce qui en découle porterait l'erreur sans qu'elle se voie |
| Carré ou quinconce | **« Ça dépend de la forme du terrain »** — il donnera selon quoi |
| Le choix de buse | **« Selon la largeur, avec mes seuils »** — il donnera les tranches (ex. jusqu'à 3 m → 8-VAN, de 3 à 5 m → 12-VAN…) |

**CE QUE ÇA COMMANDE, ET C'EST UNE LEÇON DE MÉTHODE :** trois réponses sur
quatre sont « je vais t'expliquer ». **Ne rien figer d'ici là** — ni la pose, ni
le choix de buse. Ce qui tourne aujourd'hui est un échafaudage qui porte la
mention « provisoire » à l'écran, et cette mention se retire seulement quand sa
règle est posée.

**ET SA CONTRAINTE DE CONSOMMATION, du même échange :** *« mon utilisation se
console super vite »*. Ce qui a coûté le plus n'est pas le modèle mais la
**batterie complète jouée deux fois** pour un lot qui ne touche pas `src/`. Un
lot qui ne modifie que `appli/` et `docs/` se vérifie par sa propre suite
(`appli/tests/e2e.js`) et par `appli/tests/essai-arrosage-detaille.cjs` — la
batterie complète reste due dès qu'une ligne de `src/` bouge. Lui faire envoyer
ses photos **par paquets** plutôt qu'une par une, pour la même raison.

**LE CHOIX DE MARQUE — fait le 17 août.** Bandeau déroulant, **Rain Bird par
défaut**, Toro ensuite ; `CATALOGUE.marques` s'allonge d'une ligne. **Aucune
valeur générique n'est attribuée à une marque** : l'écran dit « aucun modèle
Rain Bird enregistré » et le répète sur chaque zone. Une zone retient un TYPE
(turbine/tuyère) et non une référence, pour qu'une bascule de marque ne vide pas
ses zones.

**⚠ LE CATALOGUE EST LA PROCHAINE ÉTAPE, ET IL EST À LUI.** Le 17 août :
*« plusieurs choses sont fausses »*, puis : *« je vais t'envoyer des photos avec
certains arroseurs, leur portée, et ça tu vas l'intégrer dans une base de
données pour cet outil […] et on va également faire ça pour tout le matériel »*.

`appli/arrosage-catalogue.js` est cette base. **Chaque entrée porte une
`source`** : `'patron'` (relevée de ses photos, de ses devis fournisseurs) ou
`'provisoire'` (valeur générique, mise là pour que l'outil tourne). L'écran
affiche le compte de ce qui reste provisoire — onze au 17 août. **Ne jamais
faire passer une valeur provisoire pour acquise** : une portée fausse fait
acheter le mauvais nombre d'arroseurs, et c'est lui qui revient poser les
manquants.

**Ce qu'il faut relever de chaque photo d'arroseur**, et l'absence d'un seul de
ces éléments rend l'entrée inutilisable : marque et référence, portée EN
MÈTRES **et à quelle pression**, débit à cette même pression, angle, et la
pluviométrie si la fiche la donne. Portée et pression vont ensemble — une
portée relevée à 3 bars ne vaut rien sur une installation à 2.

**PAS DE PLAFOND À SIX VOIES — sa réponse du 17 août : « oui tu peux prévoir
au-delà de 6 ».** `CATALOGUE.nourrices` est un dictionnaire ouvert :
`nourrices[12]` se pose comme `nourrices[1]`, sans toucher au code. L'écran dit
aussi **quelles fiches sont déjà enregistrées**, pour qu'il ne refasse pas une
fiche donnée la veille.

**ET UNE QUESTION QUI RESTE, à ne pas trancher à sa place :** au-delà d'une
certaine taille, pose-t-il **une** nourrice de douze voies ou **deux** de six ?
Les deux se font. Doubler la fiche de six pour en fabriquer une de douze serait
exactement l'invention que ce fichier interdit — l'écran pose la question et
attend.

**LES NOURRICES — sa deuxième demande, et ce n'est pas du matériel mais un
ASSEMBLAGE.** Ses mots : *« pour réaliser une nourrice de une voie, on utilise
ça, ça, ça. Toi ça tu vas l'enregistrer, et comme ça quand par tes calculs tu
verras qu'on a besoin d'une voie, tu reprendras toute cette fiche. Ensuite je
vais faire la même chose pour deux, trois, quatre, cinq et six voies. »*
`CATALOGUE.nourrices` les attend, **vide et volontairement vide** : tant qu'une
fiche manque, l'écran l'annonce au lieu de composer une nourrice de son cru. Une
nourrice inventée, c'est un chantier arrêté à la pose faute d'un té.

**LE RECOUVREMENT — sa règle, et ma lecture est à confirmer d'un mot.** Il a dit
*« il faut un recouvrement d'au moins quatre-vingt pour cent »*. Lu comme :
**écart entre deux arroseurs = 80 % de la portée** (à 100 %, c'est la pose
tête-bêche). C'est réglable à l'écran, et **l'écart en mètres y est écrit** —
« portée 9 m → un tous les 7,20 m » — pour qu'il corrige d'un coup d'œil plutôt
que de nous croire sur parole.

**Ce que le passage à 80 % a montré tout de suite** : le jardin d'exemple passe
de 8 à **9 secteurs**, et la pelouse avant demande 24 tuyères. C'est au-dessus
des six voies dont il prévoit les fiches — signe que les valeurs génériques
d'arroseurs sont trop faibles, et que ses vraies références changeront ce
nombre. À revoir dès que son catalogue sera renseigné.

**Le croquis photographié — sa cible, et elle n'est pas pour tout de suite.**
*« Le client te fait un petit croquis sur un bout de papier d'un carré de dix
par dix, il te le prend en photo et il te l'envoie. »* L'application sait déjà
recevoir des photos et interroger un modèle (`src/server/ai/`) ; il n'y a rien
à inventer côté plomberie. Mais **rien ne sera lu d'un croquis avant que le
catalogue soit juste** : deviner des cotes sur une photo avec un catalogue faux
donnerait un plan faux avec deux causes possibles au lieu d'une.

**Ce qui reste à trancher, et il l'a proposé lui-même :** il a des devis
fournisseurs à joindre. Ils serviront au **catalogue de matériel** (désignations,
références, conditionnements), pas aux prix. Rien n'est à coder avant de les
avoir vus.

**Les prix : la voie trouvée, et elle évite tout scraping.** Chausson laisse
télécharger le **tarif négocié du client en Excel ou CSV** depuis son compte, et
Atlas sait déjà importer un tarif Excel/CSV (`src/app/reglages/ImportTarifs.tsx`
+ `src/lib/import-tarifs.ts`). Ses prix à lui, pas des prix publics. Les deux
sites fournisseurs sont par ailleurs **refusés par le mandataire réseau** ici.

### 0 quaterquadragies bis. Le plan d'arrosage — le raisonnement des trois planches

**Sa demande du 17 août 2026 :** *« j'ai besoin qu'on crée un outil pour les
paysagistes pour réaliser des plans d'arrosage automatique. »*

Terrain neuf, donc trois planches et **aucune ligne de `src/`** (`CLAUDE.md`
§3 bis) : `docs/maquettes/69-le-plan-darrosage.html`,
`70-le-debit-ne-se-partage-pas.html`, `71-ce-qui-sort-du-plan.html`.

**Deux questions attendent sa réponse, et aucune n'est du rangement :**

| Ce qu'il choisit | Les trois possibles |
|---|---|
| **Par où il entre son jardin** | **A** la feuille (il saisit tout, Atlas additionne) · **B** les zones (il mesure, Atlas pose le matériel, découpe et calcule les durées) · **C** le plan dessiné |
| **Par quelle sortie on commence** | **A** le devis · **B** la carte de programmation du coffret · **C** le plan remis au client |

**Ce que je recommande, écrit sur les planches :** **B, puis A** — les zones
d'abord parce que c'est la seule entrée qui rend du temps de bureau, et le devis
d'abord parce qu'il entre dans le parcours qui existe déjà (devis → envoi →
acceptation → facture) sans aucune plomberie nouvelle. Le plan dessiné se pose
PAR-DESSUS le calcul, jamais à sa place.

**CE QUI N'EST PAS À CHOISIR — ce sont des conséquences du métier :**

- **Le débit se mesure au seau**, il ne se suppose pas. Un plan bâti sur un débit
  supposé s'écroule à la mise en eau, et c'est le paysagiste qui revient
  gratuitement.
- **Un seul MATÉRIEL par secteur.** La vanne ouvre son secteur entier pour la
  même durée : turbines (11 mm/h) et tuyères (38 mm/h) ensemble, c'est trois
  fois trop d'eau d'un côté, quoi qu'on règle. **Un seul rythme par secteur**
  pour la même raison. *(La pluviométrie, elle, ne sépare plus deux vannes
  depuis sa décision du 23 août 2026 : deux turbines de buses différentes
  peuvent se retrouver ensemble.)*
- **Aucun prix inventé** (§4 du dépôt) : la nomenclature sort avec ses
  quantités, le prix vient de « Mes prix », et ce qui n'y est pas part vide et
  signalé.
- **Rien ne part tout seul.** Le mot « automatique » désigne l'arrosage, pas
  l'expédition (`docs/A-FAIRE.md` §5, tranché le 3 août).

**Ce qui reste HORS du calcul, et qu'il faut lui dire plutôt que laisser
croire :** les pertes de charge et le dimensionnement des tuyaux. Sans effet sur
un jardin de pavillon en PE 32 ; déterminants sur une longue ligne.

**Ce que ça touche quand ce sera codé :** le devis existe déjà (lignes,
quantités, unités, TVA, envoi, acceptation) — la nomenclature s'y verse, elle
n'a pas de parcours à elle. L'entretien de l'arrosage (mise en route au
printemps, hivernage à l'automne) rejoint la **fiche d'entretien** : deux lignes
de plus dans le modèle, pas un quatrième parcours.

**Ne pas retoucher les planches à la main** : elles sont engendrées d'une seule
source (`scripts/engendrer-maquette-arrosage.mjs`) et tous leurs nombres sont
calculés. Contrôle : `scripts/verifier-maquette-arrosage.mjs`, dans
`npm run verifier:maquette`.

### 0 triquadragies bis. `test-fiche-chantier-e2e` tombe SOUS CHARGE, comme les autres

Constaté deux fois le 21 août 2026, sur deux batteries d'affilée :

    ✗ Cocher tient : l'écran ET la base
      les coches ne sont pas arrivées en base

**Jouée seule, elle passe** — 11 cas, 0 échec, vérifié les deux fois. C'est donc
la même famille que `test-facture-impayee-e2e` et `test-fiche-pendant-relance` :
une écriture part au doigt levé, la suite n'attend pas qu'elle arrive, et sous
la charge de quatre-vingts suites elle mesure la base avant l'écriture.

**Le remède est connu et déjà appliqué ailleurs** (§ « attendre ce qu'on
affirme, jamais une durée ») : relire jusqu'à voir ce qu'on affirme, laisser
l'appel PARTIR avant de recharger, et surtout **assener le bon coupable** quand
il n'arrive jamais — sans quoi le rouge tombe trois cas plus loin, sur un écran
innocent.

**Qui peut le faire :** n'importe quelle session qui touche à cette fiche. Ce
n'est pas urgent pour le produit ; c'est urgent pour la batterie, qu'un rouge
au hasard finit par rendre inutile.

### 0 triquadragies. `test-facture-impayee-e2e` tombe SOUS CHARGE, pas seule

*Constaté le 16 août 2026 en jouant la batterie complète d'un autre lot.*

```
❌ « Plus tard » fait taire le rappel, et la date part en base
   rien n'est écrit en base : le geste n'a pas porté
```

**Elle passe au vert jouée seule**, immédiatement après. Ce n'est donc pas le
produit : c'est un geste dont on lit la trace en base **avant que l'action
serveur ait répondu** — sous quatre-vingt-onze suites, la réponse arrive plus
tard qu'à vide.

**C'est le même piège que celui payé le même jour sur `test-fiche-client-e2e`** :
attendre l'écran, ou un délai fixe, c'est mesurer ce qu'on vient de taper.
La parade y a été de **relire la base en boucle jusqu'à ce qu'elle ait reçu**,
plutôt que d'attendre un nombre de millisecondes.

**Ce lot appartient à la session qui a posé le rappel des impayés** (`228572a`).
Écrit ici pour qu'elle ne reparte pas de zéro, et pour que personne ne conclue
au hasard.


### 0 unquadragies. ~~Montrer ce que l'application sait déjà d'un client~~ — **CODÉE le 16 août 2026 (fiche B)**

### 0 quattuorquadragies. ~~Le « petit moins » du prix accordé~~ — **CODÉ le 17 août 2026 (proposition B)**

*`docs/maquettes/68-retirer-le-prix-accorde.html`, écrite le 17 août 2026 —
24 contrôles, sur SES chiffres (1 850,00 € HT, 5 %). Rien n'est codé pour le
geste : `CLAUDE.md` §3 bis.*

**Sa demande, le 17 août 2026 :** *« Tout comme on ajoute une ligne avec un petit
plus, il faudrait qu'on ait un petit moins pour supprimer la ligne de la
réduction. »*

| | Ce que ça fait | Ce que ça coûte |
|---|---|---|
| **A — glisser la ligne** | Le geste unique de l'application depuis le 10 août : la ligne découvre « Retirer », le tiroir « Annuler » dessous | Rien à inventer. Mais c'est un **total**, pas une ligne du tableau : rien d'autre ne glisse dans ce bloc, et un geste qu'on ne soupçonne pas n'existe pas — c'est exactement ce qu'il vient de vivre |
| **B — le petit « − » en face** | Ce qu'il a demandé, mot pour mot : un rond de 26 px devant le libellé, en or | Un bouton dans le bloc des totaux, le seul endroit du devis qui n'en portait aucun. Et le « + » ajoute une ligne AU TABLEAU quand ce « − » retire un TOTAL : lisible, mais pas symétrique |
| **C — la ligne du bas bascule** | « + Prix accordé au client » devient « − Retirer le prix accordé » dès qu'il y en a une. Un seul endroit à connaître | Presque rien : la ligne existe déjà, elle change de mot. Mais le geste est sous le total TTC, pas en face de la remise |

**Il a choisi B** le 17 août, contre ma préférence pour C. C'est codé : un rond
de 26 px devant le libellé, le même tiroir « Annuler » que les lignes, et le
prix plein affiché dès l'appui. `ARCHITECTURE.md` §120.

*Ce qui suit reste pour mémoire du raisonnement.*

**Ce qui est DÉJÀ réparé, et ne l'attend pas** (`ARCHITECTURE.md` §120) : écrire
0 % retire la remise pour de bon, et la dictée aussi.

### 0 unquadragies. Montrer ce que l'application sait déjà d'un client


**Sa question du 16 août 2026**, photo d'un « graphe de connaissances » à
l'appui : *« tu peux m'expliquer et me dire si ça peut me servir pour mon
appli ? »*

**La réponse a été NON, deux fois, et il faut la garder** pour ne pas la
reprendre : comme mémoire de travail, le dépôt la tient déjà (`CLAUDE.md`,
`HANDOVER.md`…), et un graphe à côté serait une seconde vérité ; comme fonction,
ses données sont déjà reliées dans une base SQL, qui répond mieux qu'un graphe.

**Ce qu'il restait à en prendre, et qu'il a demandé de dessiner :** l'application
SAIT qu'un client est venu quatre fois, qu'il a payé 2 460 € et en doit 740,
qu'on lui fait toujours de l'élagage — **et elle ne le montre nulle part.**

Planche : `docs/maquettes/66-ce-que-je-sais-du-client.html`, éprouvée par
`scripts/verifier-maquette-fiche-client.mjs`. **Rien n'est codé** (`CLAUDE.md`
§3 bis).

| | Ce que ça montre | Ce que ça coûte |
|---|---|---|
| **A** | un encart sous le nom du client, dans la fiche du chantier | le moins de tout : aucun écran neuf. Mais on ne peut pas chercher un client |
| **B** | une vraie fiche client, atteinte en touchant son nom | un écran de plus, sans toucher à la barre du bas |
| **C** | un onglet « Clients » : la liste + la fiche | **un cinquième onglet**, et deux écrans au lieu d'un. Le seul qui réponde à « qui me doit de l'argent ? » |

**IL N'EXISTE AUCUN ÉCRAN CLIENT AUJOURD'HUI** — vérifié : quatre onglets, et le
nom d'un client ne mène nulle part. `listerClients` existe dans le dépôt et
n'est appelé par aucun écran.

**Tout est calculable, rien n'est à inventer** : `chantiers.client_id`,
`factures` + `paiements_facture`, `lignes_prix` pour les prestations qui
reviennent, `lecons_prix` pour les prix pratiqués.

**Livré** : `src/lib/fiche-client.ts`, `src/server/repositories/fiche-client.ts`,
`src/app/clients/[id]/page.tsx`, atteinte depuis le tiroir de la fiche du
chantier. Les deux chiffres sont montrés — facturé, et reste dû. Détail :
`ARCHITECTURE.md` §121.

---

### 0 duoquadragies. ~~Un client n'était jamais réutilisé~~ — **TRANCHÉ ET CODÉ le 17 août 2026**

`creerClient` insérait **toujours** : deux chantiers pour « M. Martins »
faisaient deux fiches, et la fiche client annonçait « 1 chantier » à vie.

**Le patron a écarté le chemin « proposer »** — *« non justement, il ne faut
pas »* — et demandé le rapprochement **automatique** : *« si je crée un
nouveau chantier, mais que c'est monsieur Martins et qu'on a déjà une fiche
client monsieur Martins, [il faut que] le devis, la facture s'ajoute à la fiche
client de monsieur Martins qui est déjà créé. »*

Le risque qu'il portait — fusionner deux homonymes — est borné par une règle :
**une coordonnée qui contredit interdit le rapprochement**. Deux « Martins »
aux téléphones différents restent deux fiches. `src/lib/rapprochement-client.ts`,
`ARCHITECTURE.md` §122.

**CE QUI RESTE OUVERT, ET QU'IL FAUDRA LUI POSER UN JOUR :** deux homonymes que
**rien** ne distingue (aucun téléphone, aucun e-mail des deux côtés) sont
rapprochés, et **rien ne permet de les reséparer**. Il n'existe aucun geste
« ce chantier n'est pas ce client-là ». À dessiner le jour où le cas se
présente — pas avant : une commande de démixage jamais utilisée coûterait plus
cher à tenir qu'à attendre.

### 0 quadragies. ~~Le rappel « facture impayée »~~ — CODÉ le 16 août 2026

*Dessiné (`maquettes/atlas-rappel-facture-impayee.html`, cinq écrans), tranché,
puis codé le même jour : « oui c'est bon, code le ».*

Ce qu'il demandait est en place : le **« A plus B »** (échéance = envoi + le
délai de paiement réglé, ou le jour de l'envoi sinon), le **reste dû** avec son
total quand un acompte est arrivé, l'extinction **automatique** dès que le
règlement est enregistré, et les **trois rythmes** en pastilles avec « Plus
tard » pour seul moteur.

Migration `drizzle/0050_rappel_facture_impayee.sql`, règles pures dans
`src/lib/rappels.ts`, `ARCHITECTURE.md` §118. Éprouvé par `test-rappels.ts`,
`test-rappels-db.ts` et `test-facture-impayee-e2e.ts`, photographié par
`scripts/capture-facture-impayee.mts`.

**Ce que ce lot apprend, et qui vaut au-delà de lui :**

- la date de report vit sur le **chantier**, pas sur la facture —
  `trg_facture_immuable` refuse toute écriture sur une facture émise, et
  l'affaiblir pour une commodité d'écran aurait été le contournement que
  `CLAUDE.md` §4 interdit ;
- **la valeur d'un `<input>` ne figure PAS dans `innerText`.** Un contrôle qui
  cherchait « 1 jours » dans le texte de la page ne pouvait jamais le trouver :
  vert sur l'écran fautif, il ne mesurait rien. Cinquième fois que ce dépôt paie
  un contrôle qui mesure zéro ;
- **une capture ment aussi.** `fullPage` a photographié le milieu du cadre qui
  défile, sans une seule carte, pendant que le contrôle lisait le DOM et se
  déclarait vert. Et un montage écrit `WHERE id = NULL` sans se plaindre :
  vérifier le `rowCount` de toute écriture de montage.

### 0 trigies quater. `test-fiche-pendant-relance` : le rouge venait de CELUI QUI L'OBSERVAIT

**Vu le 17 août 2026**, et d'abord mal expliqué — ce point a été écrit une
première fois sous le titre « rougit sous charge », ce qui était **faux**. La
correction est ici parce qu'une hypothèse consignée dans les tâches se lit
ensuite comme un fait (`TODO.md` 0 tricies nonies bis).

**Le symptôme :** son deuxième cas — *« le veilleur est bien bloqué à relancer »*
— rouge dans la batterie complète, vert rejoué seul. Quatre fois de suite.

**LA CAUSE, MESURÉE.** `veiller.sh` ne se déclare « serveur mort » que si
`pgrep -f '[n]ext(-server| dev| start)'` ne trouve **rien**. Or `pgrep -f`
compare la **ligne de commande entière de tout processus de la machine**. Les
batteries rouges avaient été lancées par une commande qui commençait par
`pgrep -af "next-server|next dev" | xargs kill` — un ménage des serveurs
orphelins. **Ce shell-là reste vivant pendant toute la batterie, et sa ligne de
commande contient littéralement « next-server » et « next dev ».** Le veilleur
voyait donc un serveur, prenait l'autre branche, et n'écrivait jamais le message
que la suite attend.

**La preuve tient en deux lignes de journal :** la batterie lancée SANS ce
préfixe (`batterie19`) a la suite au vert ; les quatre suivantes, avec, au rouge.

**CE QUE ÇA APPREND, ET CE N'EST PAS UNE ANECDOTE :**

- **`pgrep -f` attrape l'observateur.** Toute commande de diagnostic qui NOMME
  un motif surveillé par le produit devient elle-même ce qu'elle cherche. Faire
  le ménage des serveurs dans un appel SÉPARÉ, qui se termine avant la batterie.
- **Un rouge reproductible n'est pas forcément un défaut du code.** Celui-ci
  l'était quatre fois d'affilée, et « sous charge » était une explication
  plausible, cohérente, et fausse. Deux voisines de ce fichier rougissent
  vraiment sous charge : la ressemblance est précisément ce qui a fait mal
  deviner.

**Rien n'est à corriger dans le produit ni dans la suite.** Elle a raison de
refuser de conclure quand son montage n'a pas reproduit le cas — c'est ce qui a
permis de le voir.

### 0 quinvicies octies. ~~Ses maquettes étaient HORS LIGNE depuis dix heures~~ — **RÉPARÉ le 23 août 2026**

**Sa plainte, en cinq mots :** *« Les pages ne s'ouvrent pas. »* Et elles ne
s'ouvraient pas : la publication GitHub Pages échouait depuis 10 h 50, donc le
site servait encore la version du matin — sans les deux planches qu'on venait de
lui demander d'ouvrir.

**DEUX défauts, tous deux nés du lot d'arrosage, et le second était INVISIBLE.**

| | Ce qui rougissait | Pourquoi |
|---|---|---|
| `test:arrosage` | *« aucune vanne ne mélange deux pluviométries »* | il réclamait **la règle qu'il a retirée le 23 août** — *« ne prends pas en compte la pluviométrie »*. Un contrôle qui exige ce que le patron a fait enlever (`CLAUDE.md` §5 bis) |
| `test:croquis` | *« aucun arroseur n'est laissé sans tuyau »* | un vrai défaut de plan : le tracé se faisait **zone par zone**, donc un réseau qui ne posait qu'une tête dans une zone n'avait aucun tuyau |

**Le second n'a jamais été vu par la CI**, et c'est le point à retenir : l'étape
enchaînait les quatre suites sous `set -e`, si bien qu'elle s'arrêtait à la
première. Dix heures de publication barrée, un défaut réparé, et un autre qui
attendait derrière. `pages.yml` joue désormais les quatre et les rapporte
toutes.

**Ce que le défaut du croquis touchait, et ce qu'il ne touchait pas.** Il vivait
dans la maquette (`appli/arrosage-croquis.html`), pas dans le produit :
`plan-dessine.ts` trace depuis l'entrée du terrain vers **chaque** arroseur, il
n'a jamais eu ce trou. Vérifié avant de conclure, pas supposé.

**Corrigé en traçant le réseau ENTIER, pas zone par zone** : un réseau est une
vanne, son tuyau visite toutes ses têtes où qu'elles soient, et le départ se
mesure depuis le regard — sa règle du 21 août. Regardé à l'écran sur les trois
jardins d'exemple, pas seulement compté.

### 0 quinvicies septies. Son message au client et l'allure de ses devis — **LES DEUX SONT CODÉS** (23 et 24 août 2026)

**SES RÉPONSES DU 23 AOÛT AU SOIR, sur le message :** *« Message client A. Liens
obligatoire. Et message pour tous. »*

| | Tranché |
|---|---|
| Où il se règle | **A** — dans « Devis & factures », en dernier bloc |
| Le lien | **obligatoire** : Atlas REFUSE d'enregistrer un message sans lui, il ne se contente pas de prévenir |
| Combien de messages | **un seul, pour les trois documents** |

**RESTE UN POINT, ET UN SEUL** — il l'a demandé en images : *« pas compris,
montre des exemples »*. Un texte unique se heurte à ce que le milieu du message
n'est pas le même selon ce qui part. La planche montre les deux façons, avec
les trois téléphones côte à côte :

- **façon 1** — une pastille `[document]` : il écrit le bonjour, la formule et
  la signature ; Atlas pose la phrase juste — « votre devis, choisissez votre
  date », « votre facture n° F2026-0008, à régler avant le 21 septembre », « le
  compte rendu de mon passage ». Rien n'est perdu ;
- **façon 2** — le même texte mot pour mot : sa facture dit alors *« Voici votre
  devis… choisir votre date d'intervention »*, et l'échéance disparaît.

**La planche a dû être REFAITE pour qu'il puisse choisir.** Sa première version
affichait « [document] » en clair dans les bulles de la façon 2 : cela ne
montrait rien qu'un écran cassé, au lieu de sa facture parlant d'un devis. Un
contrôle le tient désormais (`verifier-maquette-message-et-allure.mjs`, éprouvé
rouge sur ce défaut précis).

**IL A RÉPONDU « FAÇON 1 », ET C'EST CODÉ** (`ARCHITECTURE.md` §161) : colonne
`entreprises.message_client`, bloc dans « Devis & factures », refus du message
sans lien à l'écran ET au serveur, aperçu des trois documents, et le gabarit
descend jusqu'aux trois écrans d'envoi. Éprouvé de bout en bout —
`test-message-au-client-e2e.ts` va des réglages jusqu'à l'adresse `sms:`.

**Ce qui a changé dans ce que ses clients reçoivent, et qu'il faut savoir :** la
phrase du devis tenait en deux morceaux, de part et d'autre du lien ; un seul
emplacement ne peut pas porter les deux. Elles sont réunies avant le lien. Idem
pour l'échéance de la facture.

**Reste ouvert sur le message :** rien.

**SES RÉPONSES DU 23 AOÛT AU SOIR, sur l'allure :** *« Allure des devis B, juste
pour devis facture. Fais-en une dizaine. Le fond teinté fais-le modifiable et
choisiront s'ils le gardent ou s'ils mettent autre chose ; les réglages actuels
doivent être par défaut. »*

| | Tranché |
|---|---|
| Où ça se règle | **B** — un bloc dans « Devis & factures », pas de rubrique de plus |
| Sur quoi ça porte | **le devis et la facture SEULEMENT.** La feuille de chantier et le compte rendu d'entretien gardent leur allure |
| Typographies | **dix**, la première étant celle d'aujourd'hui |
| Fond de page | **modifiable — n'importe quelle couleur**, pas une liste de trois |
| Le départ | **ses réglages d'aujourd'hui** : crème, or, police de l'appareil |

**C'EST CODÉ, le 24 août 2026** (`ARCHITECTURE.md` §164) : migration
`0063_allure_documents.sql`, bloc dans « Devis & factures », dix typographies,
deux nuanciers libres, un logo — et le devis comme la facture les portent.

**Ce que ça a coûté, et qu'il faut savoir :**

| | |
|---|---|
| les polices | dans le dépôt, **réduites une fois pour toutes** au latin (3,9 Mo → 570 ko) et embarquées **entières** — le découpeur de `pdf-lib` perd des caractères en silence |
| un devis habillé | **40 à 60 ko**, contre 5 ko sans typographie choisie |
| l'écran | sert les **mêmes fichiers** que le PDF, par `/api/polices/[fichier]` — jamais Google Fonts |

**Reste ouvert sur l'allure :** rien de bloquant. Deux points de confort, à lui
demander seulement s'il les évoque — le logo ne sort pas encore sur la **page
publique** du devis (elle n'est pas un PDF, c'est un autre chemin), et le
compte rendu d'entretien garde son allure, ce qu'il a demandé.

**Deux leçons d'outillage, payées ici :**

- **un contrôle ne doit pas accuser une panne de réseau.** Le mandataire de
  l'agent refuse `fonts.googleapis.com` : le contrôle rougissait sur « Failed to
  load resource », c'est-à-dire sur la planche, pour une panne qui n'est pas la
  sienne. Il ignore désormais ce seul domaine et rapporte toutes les autres
  ressources manquantes. Le choix des dix reste mesurable sans elles : on
  compare les **piles déclarées**, pas les glyphes rendus ;
- **un contrôle qui PLANTE n'accuse personne.** En retirant une typographie pour
  l'éprouver, le clic sur la dixième a levé une exception et le rapport n'a
  jamais été écrit — une pile d'appels au lieu de « neuf au lieu de dix ». Tout
  le corps est sous filet : une panne devient un souci comme un autre, et le
  verdict s'écrit toujours.


**Sa demande du 23 août 2026**, en deux morceaux : *« y a-t-il un endroit dans
les réglages où l'utilisateur peut rédiger ce message automatique ? S'il n'y en
a pas, il faut en créer un. Et il faudrait également que l'utilisateur puisse
avoir un endroit dédié à la modification de son devis. S'il veut rajouter son
logo, changer la typographie, changer le fond de page. »*

**CHERCHÉ AVANT DE RÉPONDRE** (`CLAUDE.md` §5 ter), et les deux manquent
vraiment :

| | Ce qui existe | Ce qui manque |
|---|---|---|
| **le message** | `src/lib/message-client.ts` — écrit en dur, le même pour tous | aucun réglage, nulle part |
| **l'allure du devis** | « Apparence » règle les couleurs de **l'application** ; « Devis & factures » règle validité, acompte, délai, mentions | le logo (aucune colonne au schéma), la typographie, le fond de page |

**Les deux planches, qu'il doit ouvrir avant qu'on code :**

- `appli/mon-message-au-client.html` — deux endroits où le poser, puis l'écran :
  le cadre s'écrit, le téléphone dessous rend le SMS que reçoit vraiment le
  client. Trois pastilles posent `[client]`, `[lien]`, `[entreprise]` **sous le
  curseur**. Effacer le lien le **dit**, sans le remettre en douce.
- `appli/allure-de-mes-devis.html` — logo, trois typographies, trois fonds,
  quatre accents, et le devis se repeint à l'instant.

**Le texte de la planche est RECOPIÉ du code qui l'envoie**, et un contrôle le
tient (`scripts/verifier-maquette-message-et-allure.mjs`) : une planche qui
montrerait un autre message lui ferait juger un texte que ses clients ne
reçoivent pas — c'est le malentendu même qu'il vient corriger. Le contrôle sait
rougir : éprouvé sur un mot changé, l'alerte du lien retirée, le jeton posé à la
fin, et le fond figé.

**CE QU'IL DOIT TRANCHER**, et rien ne se code avant :

| | La question |
|---|---|
| 1 | le message : dans « Devis & factures », ou une rubrique « Mes messages » ? |
| 2 | le lien est-il **obligatoire** — Atlas refuse-t-il un message sans lui ? |
| 3 | un message par document, ou un seul pour tout ? |
| 4 | l'allure : rubrique à part, ou bloc dans « Devis & factures » ? |
| 5 | l'allure vaut-elle pour **tous** les documents, ou le devis seul ? |
| 6 | trois typographies suffisent-elles ? |
| 7 | garde-t-on le **fond teinté** ? Il s'imprime, donc il coûte de l'encre à chacun de ses clients |

**Ce qui restera scellé quoi qu'il choisisse**, et la planche le dit : mentions
obligatoires, disposition des colonnes, ordre des totaux. Un devis mal posé
n'est pas un devis moins joli, c'est un devis qu'on peut lui contester.

### ~~0 trigies septies. Deux suites de calendrier tombent EN FIN DE MOIS~~ — **RÉPARÉES le 25 août 2026**
### 0 trigies nonies. Le format des numéros est FIGÉ À 2026 — **et ce n'est pas qu'un réglage manquant**

**Sa demande du 26 août 2026**, capture d'une autre application à l'appui :
*« dans la catégorie facture il faut rajouter le format de numéro, c'est
obligatoire il me semble »*.

**CHERCHÉ AVANT DE RÉPONDRE** (`CLAUDE.md` §5 ter), et ce qu'on a trouvé est
pire que ce qu'il demandait :

| | |
|---|---|
| ce qu'il croyait obligatoire | **le format ne l'est pas.** Ce que la loi exige, c'est une suite chronologique **sans trou ni doublon** — Atlas la tient déjà, par un compteur atomique par entreprise |
| ce que personne n'avait vu | **le millésime est écrit en dur** : `` `2026-${…}` `` dans `devis.ts`, `` `F2026-${…}` `` dans `factures.ts`. **En janvier 2027, ses factures diront encore 2026** |

**Le défaut a une DATE, et elle approche.** Il ne se verra pas d'ici là : le
code est juste tant qu'on est en 2026. C'est exactement le genre de chose qu'une
suite ne voit pas non plus — elle tourne aujourd'hui.

**La planche est en ligne** (`appli/format-de-numero.html`), avec cinq formats
qu'il essaie du doigt et trois questions au bas. **Rien n'est codé** tant qu'il
n'a pas répondu (`CLAUDE.md` §3 bis).

**Ce qu'il faudra tenir en codant, et qui n'est pas évident :**

- **changer de format en cours d'année casse la suite** — c'est la seule vraie
  contrainte légale du réglage, et elle est dite à l'écran, pas seulement ici ;
- **un numéro déjà envoyé ne se réécrit jamais** : il est sur la facture du
  client et dans sa comptabilité. Le changement ne vaut que pour les suivants ;
- **le compteur doit repartir à 1 au 1ᵉʳ janvier** si l'année figure dans le
  format — sinon `2027-0149` succède à `2026-0148`, ce qui se lit mal ;
- **la suite des devis et celle des factures restent distinctes** : les mêler
  rendrait illisible la numérotation continue qu'attend un contrôle.

### 0 trigies octies. ~~Le brouillon confirmé ne se corrigeait plus~~ — **RÉPARÉ le 25 août 2026**

Ses trois notes — déchets, contraintes d'accès, remarques — n'ont aucune autre
case dans l'application, et le brouillon confirmé les figeait. Elles s'écrivent
de nouveau ; les copies de ce qui vit ailleurs (prestations, matériel, durée,
équipe) quittent l'encart. `ARCHITECTURE.md` §171.

**Ce qui reste à surveiller, et qui n'est pas mesurable ici :** la consigne
donnée au modèle exige désormais des réserves de six mots. **Aucune clé d'IA sur
ce poste** — ça se juge sur son espace, à la première dictée (`CLAUDE.md`
§1 ter). L'écran, lui, plafonne à cinq lignes quoi que le modèle rende, et c'est
éprouvé (`test-brouillon-reserves.ts`).

### 0 trigies septies. Deux suites de calendrier tombent EN FIN DE MOIS — **CONSTATÉ le 25 août 2026, PAS RÉPARÉ**

**Elles rougissent sur `main`, sans aucun changement**, et elles bloquent la
livraison de toutes les sessions tant qu'on est en fin de mois. Vérifié : même
rouge, au même endroit, sur `origin/main` seul.

| Suite | Ce qu'elle rend | Pourquoi |
|---|---|---|
| `test-deux-dates-calendrier-e2e` | « Le calendrier n'offre que 2 jour(s) : trop peu pour éprouver » | elle ne lit que **le mois affiché**. Le 25 août, le délai minimal écarté, il ne reste que le 28 et le 31. Elle n'a jamais su tourner la page du mois |
| `test-date-lointaine-e2e` | « Le client ne voit pas la date proposée (« 1 mars ») » | ~~au-delà de la fenêtre du client~~ — **ce diagnostic était FAUX**, voir ci-dessous |

**LA SECONDE LIGNE ÉTAIT FAUSSE, ET IL FAUT LE DIRE.** La date n'était pas hors
fenêtre : le client la voyait parfaitement. L'écran écrivait **« lundi 1er mars
2027 »** — le seul ordinal du français, porté par `src/lib/jour.ts` — et la suite
cherchait « 1 mars ». Elle **redisait la règle d'écriture** au lieu d'employer la
fonction qui la rend, ce que `CLAUDE.md` §3 interdit.

*La preuve : passée par `jourLisible()`, sans une ligne changée au produit, elle
affiche « ✓ le client la voit sur sa page, en toutes lettres ». Aucune fenêtre
n'a été élargie.*

**Ce qu'il faut regarder, et personne ne l'a fait :**

- ~~la première est un défaut de la SUITE~~ — **juste, et fait** : elle tourne
  désormais la page du mois quand celui qui s'affiche n'offre pas trois jours.
  Rien n'a changé au produit ;
- ~~**la seconde est peut-être un vrai défaut du PRODUIT**~~ — **non, et c'est
  vérifié** : la date proposée à six mois arrive chez le client et s'y affiche.
  Ce qui suit reste néanmoins une bonne question à lui poser, indépendamment de
  ce rouge-là. Ce n'est plus un point bloquant.

  *Rédaction d'origine, conservée :* et c'est pour cela
  qu'elle ne doit pas être « réparée » à la légère. Elle garde exactement le
  piège que son propre commentaire nomme : *« une date validée à l'envoi puis
  refusée à la lecture, parce que la fenêtre du client ne la couvre pas »*. Le
  patron peut proposer à dix-huit mois (`HORIZON_PATRON_JOURS`), le client ne
  voit qu'une fenêtre plus courte (`fenetrePourDates`). **La question à trancher
  avec lui** : un client doit-il pouvoir retenir une date que son artisan lui a
  proposée à six mois ? Si oui, la fenêtre du client doit s'ouvrir autour de
  cette date — la marge existe déjà dans le code, elle ne suffit visiblement
  pas.

**Ce que ça ne doit PAS devenir :** une raison de repousser la vérification à
septembre. Le premier du mois, les deux repasseront au vert toutes seules — et
le défaut, lui, sera toujours là.

### 0 trigies sexies. Deux suites navigateur rougissent encore sous charge — **CONSTATÉ le 24 août 2026, PAS RÉPARÉ**

**Écrit parce que le silence coûterait l'enquête une seconde fois.** Ce n'est
pas une réparation annoncée : c'est un constat, et il n'a pas été corrigé.

| Suite | Ce qu'elle rend | Où |
|---|---|---|
| `test-facture-au-client-e2e` | « L'écran laisse croire que la facture est partie » | sur la branche du lot de l'allure, **deux fois sur trois** |
| `test-tva-au-paiement-e2e` | `waitForFunction: Timeout 15000ms exceeded` sur l'acompte | sur **`main`**, sans aucun changement |
| `test-periodicite-tva-e2e` | « "Tous les trimestres" n'a pas été enregistré » après trois rechargements | sur la branche du lot 2 de sécurité, **une fois sur une** |

**La troisième s'ajoute le 24 août 2026, et elle confirme la lecture ci-dessus.**
Le lot de sécurité ne touche ni la périodicité ni l'écran « Mon entreprise » —
sa seule ligne dans `src/app/reglages/actions.ts` vit à l'intérieur de
`analyserFichierTarifsAction`, que cette suite n'appelle jamais. Jouée seule :
7/7. **Trois suites, trois branches, trois symptômes différents** — c'est bien
la charge.

Et celle-ci porte un indice de plus : son propre commentaire dit qu'elle
recharge **trois fois** en laissant du temps à l'action, précisément parce que
le défaut avait déjà été vu le 13 août. Trois chances ne suffisent plus. La
piste est donc la même que pour les deux autres — on attend une valeur à
l'écran sur une montre, au lieu d'attendre que la base ait bougé.

**Et ATTENTION à ne pas confondre deux rouges dans cette même suite.** Le
24 août au soir, elle a rougi une seconde fois — sur un autre cas, et pour une
tout autre raison : elle **exigeait la phrase grise** que le patron venait de
faire retirer de l'écran de la facture. Ce rouge-là n'avait rien d'instable, et
il a été corrigé en visant plus profond (`CLAUDE.md` §5 bis). Le premier, lui,
tient toujours.

**Les deux sont VERTES jouées seules**, et c'est la question qui tranche
(§ ci-dessous). Surtout : **ce ne sont pas les mêmes** d'une branche à l'autre.
Un lot qui ne touche ni la facture ni la TVA ne peut pas faire tomber l'une
pendant que l'autre tombe sur `main` : c'est la charge, pas le code.

**Ce qu'il faudra regarder**, et personne ne l'a fait :

- `test-facture-au-client` lit l'écran **après** avoir attendu « arrêtée ». Or
  l'écran d'après porte un jeton, donc la phrase « votre client ne l'a pas
  encore reçue » **disparaît**. Le contrôle semble donc dépendre du fait que
  `router.refresh()` n'a pas encore atterri : ce serait une course écrite dans
  la suite elle-même, pas dans le produit. À vérifier avant de toucher quoi que
  ce soit ;
- `test-tva-au-paiement` attend une valeur à l'écran par `waitForFunction` :
  c'est exactement le mal des cinq suites d'à côté (0 trigies quinquies), et le
  remède est connu — **relire la base en boucle**, jamais l'écran sur une montre.

**Ce que ça ne doit PAS devenir :** une raison de rejouer la batterie jusqu'à ce
qu'elle passe. Une suite qui rougit une fois sur trois barre la publication une
fois sur trois, et c'est déjà arrivé (`CLAUDE.md` §5).

### 0 trigies quinquies. ~~Cinq suites du devis rougissaient une batterie sur deux~~ — **RÉPARÉES le 23 août 2026**

**Quatre l'étaient pour la même raison, et la cinquième pour une autre.** C'est
cette distinction qui a coûté l'enquête, et qui vaut d'être écrite : leur
symptôme était identique — un montant lu trop tôt —, leur cause ne l'était pas.

| | Le mal | La parade |
|---|---|---|
| `test-devis-complet`, `test-devis-a-la-main`, `test-reduction-devis`, `test-reprise-chantier` | un `waitForTimeout` fixe : l'enregistrement partait au serveur pendant ce délai, qui suffisait à vide et manquait sous quatre-vingt-dix suites | relire la base **en boucle jusqu'à la valeur**, avec une borne qui sait abandonner (`80a12bc`) |
| `test-devis-depuis-dictee` | **rien à voir avec la charge : elle rougissait AUSSI jouée seule** | elle visait un écran qui n'existe plus |

**LE PIÈGE DE LA CINQUIÈME, ET IL RESSERVIRA.** Elle ouvrait
`/chantiers/{id}/export` et cherchait « taille de haie » dans le texte de la
page. Deux raisons de n'y jamais arriver, **toutes deux nées le 20 août**
(`c9abb50`, la suppression de l'écran intermédiaire) :

1. **`/export` RENVOIE sur `/devis-complet`** tant que le devis n'est pas parti.
   Une suite qui n'envoie rien — et celle-ci vérifie précisément que *rien n'est
   parti au client* — n'atteint donc jamais cet écran ;
2. **sur le devis, la désignation vit dans un `<input>`.** La valeur d'un champ
   ne fait pas partie du texte de la page : `innerText` ne la voit pas, et
   aucune attente, si longue soit-elle, ne la fera apparaître.

Le contrôle accusait donc la dictée pour un parcours qui avait changé sous lui.
Il vise désormais ce que le client recevra **vraiment** : `lignes_devis` —
l'instantané figé à l'impression, pas les lignes de prix encore corrigeables —
relu sous l'aperçu PDF. Éprouvé rouge sur un libellé absent, et son message
montre ce que le devis porte (`CLAUDE.md` §5 bis : on adapte le contrôle, on ne
rétablit pas l'écran retiré).

**Ce que ça apprend :** devant un rouge, la première question n'est pas *« est-ce
la charge ? »* mais *« rougit-elle jouée seule ? »*. Trente secondes de réponse,
et elles séparent deux enquêtes qui n'ont rien en commun.

**ET UNE SIXIÈME LEÇON, PAYÉE PAR MON PROPRE CORRECTIF.** `test-reprise-chantier`
est retombée à la batterie suivante, sur la garde que je venais de lui poser :
elle relisait le **total affiché** pour prouver que le prix était enregistré. Or
l'écran des prix montre le montant qu'on vient de taper **avant** que le serveur
ait répondu. Sous une batterie entière, la garde lisait donc « 1 200,00 € » sur
une base encore vide, se déclarait satisfaite, et l'écran d'arrivée — rendu par
le serveur, lui — affichait 0,00 € deux cas plus loin et se faisait accuser.

**Lire l'écran pour prouver un enregistrement, c'est mesurer ce qu'on vient de
taper.** La garde interroge désormais `lignes_prix`. Éprouvée rouge en tapant un
prix nul : elle nomme le total réellement en base, et accuse le prix, pas
l'écran d'arrivée.

### 0 trigies ter. ~~`test-reduction-devis-e2e` rougit sous charge, pas toute seule~~ — **RÉPARÉE le 23 août 2026** (`80a12bc`, et le point ci-dessus)

**Vu le 16 août 2026**, sur la batterie qui suivait la fusion de son lot. Le
dernier de ses six cas — *« elle se retire, et le devis revient à son prix
plein »* — a lu **870,00 €** là où il attendait **1 044,00 €**, et « après
remise » était encore à l'écran.

**Mesuré, pas supposé :** rejouée seule dans la foulée, sur le même code et la
même base, la suite passe ses six cas. Ce n'est donc pas une règle fausse.

**Le mécanisme, lisible dans la suite elle-même** (`scripts/test-reduction-devis-e2e.ts`,
vers la ligne 156) : elle vide le champ, appuie sur Tab, attend **une seconde
fixe**, puis **recharge**. L'enregistrement part au serveur pendant cette
seconde ; sous une batterie de quatre-vingt-dix suites, il ne l'a pas toujours
finie, et le rechargement rend la page d'avant. C'est la même famille que
`test-devis-parti-signet` juste en dessous : un délai fixe qui suffit à vide et
plus sous charge.

**Ce qu'il faudrait, et c'est à la session qui tient ce lot :** attendre la
RÉPONSE de l'enregistrement plutôt qu'une seconde — c'est ce qui a réparé
`test-unite-tarif-e2e` le 16 août. Un délai plus long ne ferait que déplacer le
seuil.

**Ce lot-ci n'y touche pas**, et il faut le dire : le rappel d'impayé ne passe
nulle part près des totaux d'un devis. Corriger la suite d'un autre à sa place
ferait deux sessions écrivant le même fichier au même moment.

### 0 septvicies. La fiche d'entretien — **TOUT EST TRANCHÉ**, reste à coder

**Ses décisions des 16 août 2026**, toutes prises sur maquettes :

| Question | Sa réponse |
|---|---|
| Le geste sur le chantier | **B** — rangée par familles, avec le compte « 1/4 » |
| Ce que voit le client | **B** — seulement ce qui a été fait |
| Le temps passé | une **molette**, pas un clavier — et **la A**, celle du téléphone |
| Où la fiche se compose | dans les **Réglages**, « Ma fiche d'entretien » |
| Une fiche ou plusieurs | **UN SEUL MODÈLE**, pré-rempli à chaque envoi |

**Ses mots sur la dernière, qui valent mieux qu'un résumé :** *« ça sera un
modèle à chaque fois qu'on pré-remplira et qu'on enverra aux clients. Donc au
final, chaque client aura sa fiche parce que ça ne sera jamais la même — d'un
client à un autre on ne fait pas la même prestation — mais il n'y aura qu'une
seule fiche. »*

**LA LECTURE RETENUE — confirmée le 17 août par « Fait la C », et CORRIGÉE une
fois codée.** Rien n'est rangé par client : à chaque passage, la fiche part du
modèle, s'ajuste, et devient celle de ce client. Le pré-remplissage devait se
faire d'après SON DERNIER PASSAGE — c'est ce qui était écrit ici, et **c'était
faux dans les deux sens** :

  · les lignes *présentes* du dernier passage ne convergent jamais (au premier
    passage la fiche porte le modèle entier) ;
  · les lignes *cochées* du seul dernier passage font disparaître une taille de
    haie d'automne dès le passage de mars.

Le repli lit donc **tout ce que ce client a déjà pris**, rapports envoyés
confondus. Trouvé par le contrôle avant d'atteindre le patron.
`ARCHITECTURE.md` §128.

**PAS DE SIGNATURE — décidé le 16 août 2026, et à ne pas rouvrir par bonne
volonté.** Sur SA capture de l'autre application, les deux signatures étaient
« Non signé ». Le client est absent onze fois sur douze : il travaille pendant
qu'on entretient son jardin. Un champ vide fait passer chaque rapport pour un
document inachevé, et la capture au doigt coûtait une journée (zone de dessin,
stockage, écran verrouillé quand il tend son téléphone, conservation RGPD,
survie hors réseau) pour un geste fait une fois sur vingt.

**Ce qui prouve le passage à leur place, et qui existe déjà** : la date, l'heure,
le temps passé, et l'EMPREINTE du contenu exact (`empreinteDevis`, le mécanisme
de l'acceptation d'un devis). À prévoir en plus : un bouton **« J'ai bien reçu »**
sur la page du client — un accusé horodaté, pas une signature.

**L'ENVOI : exactement celui du devis.** Sa confirmation du 16 août. Attention au
mot « automatique » : **rien ne part tout seul**, et ce n'est pas une limite
technique — c'est sa décision du 3 août (`docs/A-FAIRE.md` §5). Atlas prépare le
message avec le lien, ouvre SA messagerie, et c'est lui qui appuie. Un envoi
réellement automatique demanderait un prestataire sous contrat.

**Les invariants posés, à ne pas rouvrir :**

- **un rapport déjà envoyé ne change plus JAMAIS** quand le modèle change : il
  est signé et parti chez le client. C'est l'erreur qui ne se rattrape pas ;
- le retrait d'une ligne est **réversible** (règle du 10 août) ;
- ce qui n'est pas coché **n'est pas une faute** — aucun rouge ;
- « Vrai »/« Faux » ne sortent jamais vers le client ;
- l'envoi emprunte le chemin qui porte déjà devis et factures.

**OÙ LA FICHE VIT — tranché le 17 août 2026, contre ma recommandation.** Pas
depuis le planning : **dans l'onglet « Paysage »**, à côté de l'arrosage et de
la terrasse bois. Sa raison, qui est la sienne du matin même : un outil doit
s'ouvrir SANS client, sinon il ne sert pas en visite. Le client vient au moment
d'envoyer, par un pont vers la fiche client (existante depuis le 16 août).

**LA QUESTION EST TRANCHÉE — « Fait la C », le 17 août 2026**
(`docs/maquettes/77-la-fiche-dans-paysage.html`). Le client se nomme à tout
moment, et la fiche se replie sur ses prestations dès qu'il est connu, **sans
perdre une coche**. Codé le 18 août : `ARCHITECTURE.md` §128.

**L'ordre de construction, quand ça démarre** — c'est un troisième parcours, pas
une case à ajouter :

1. ~~le **modèle** en base~~ — **FAIT le 16 août** : table `prestations_entretien`
   (migration `0051`), dépôt `src/server/repositories/prestations-entretien.ts`,
   règles pures dans `src/lib/prestations-entretien.ts`, suite
   `scripts/test-prestations-entretien.ts` ;
2. ~~son **écran de Réglages**~~ — **FAIT le 16 août** : Réglages → Fiche
   d'entretien (`src/app/reglages/fiche-entretien/`), retrait réversible,
   suite `scripts/test-fiche-entretien-e2e.ts` ;
3. ~~le **passage** : la fiche pré-remplie, cochée, le temps à la molette~~ —
   **FAIT le 18 août** : tables `passages_entretien` et `lignes_passage`
   (migration `0055`), règles pures dans `src/lib/passage-entretien.ts`, dépôt
   `src/server/repositories/passages-entretien.ts`, écrans
   `src/app/paysage/fiche/`, suites `scripts/test-passage-entretien.ts` et
   `scripts/test-fiche-chantier-e2e.ts` ;
4. ~~le **rapport** : la page publique, l'envoi~~ — **FAIT le 18 août** :
   `/entretien/[jeton]`, lecture par jeton sous politique dédiée, message
   préparé dans SA messagerie. **Restent deux conforts, non faits :** le PDF du
   rapport, et le bouton **« J'ai bien reçu »** horodaté sur la page du client
   — un accusé, pas une signature ;
4. ~~les signatures~~ — **RETIRÉES le 16 août 2026**, voir ci-dessous.

Planches : `docs/maquettes/62-la-fiche-dentretien.html`,
`63-le-rapport-au-client.html`, `64-composer-sa-fiche.html`,
`65-choisir-l-heure.html`.

### 0 trigies bis. `test-devis-parti-signet` a rougi une fois sur deux batteries — instable sous charge

**Vu le 16 août 2026**, sur une batterie complète : la suite attendait le total
« 840,00 € » et a **dépassé son délai**. Ce n'est donc pas une valeur fausse —
les contrôles qui la précèdent dans la même suite étaient verts, et le numéro du
devis était bien affiché.

**Ce qui a été éliminé, mesuré et non supposé :**

- elle **passe seule** ;
- elle **passe enchaînée derrière `test-devis-complet`**, qui écrit un taux de
  TVA à 10 % — le premier soupçon, puisque 700 € HT font 840 € à 20 % et 770 € à
  10 % ;
- la batterie complète rejouée juste après : **86/86**, le rouge ne revient pas.

**Ce que ça laisse :** un écran lent à rendre pendant qu'une batterie occupe la
machine. Le `waitForSelector` de cette assertion n'a pas de délai propre, là où
ses voisines en portent un de 20 s.

**À faire, et ce n'est pas urgent :** lui donner un délai explicite, comme ses
voisines. Ne PAS la déclarer instable en la retirant — un contrôle qu'on
neutralise est un contrôle perdu, et celui-ci tient la pièce maîtresse d'un
écran que le patron a dessiné lui-même.


### 0 septvicies. La fiche d'entretien — **DEUX MAQUETTES POSÉES, sa décision attendue**

**Sa réponse du 16 août 2026 : « B et B »**, plus deux ajouts.

| Tranché | Ce qu'il a choisi |
|---|---|
| Le geste sur le chantier | **B** — rangée par familles, avec le compte « 1/4 » |
| Ce que voit le client | **B** — seulement ce qui a été fait |
| Le temps passé | **une molette**, pas un clavier (`65-choisir-l-heure.html`) — trois gestes proposés, le mien recommandé est la molette Atlas |
| Où se compose la fiche | dans les **Réglages**, « Ma fiche d'entretien » — modèle fourni, modifiable |

**LES DEUX SONT TRANCHÉES le 25 août 2026**, une fois les planches enfin
publiées — elles vivaient dans `docs/maquettes/`, que `pages.yml` ne publie pas,
et l'on attendait depuis le 16 août un choix qu'il n'avait pas les moyens de
faire.

| Sa réponse du 25 août | Ce que ça ferme |
|---|---|
| **« Planche une, la A »** | **une seule liste**, tenue dans les Réglages, pré-remplie à chaque envoi. Rien n'est rangé par client |
| **« Planche 2, la molette, mais avec d'un côté les heures qu'on peut bouger et de l'autre les minutes qu'on peut bouger séparément »** | **rien à coder : c'était DÉJÀ le cas** — voir ci-dessous |

**SA DEMANDE DÉCRIVAIT CE QUI EXISTAIT DÉJÀ, et c'est lui qui l'a vu :** *« la
molette a déjà été codée, vérifie »*. Vérifié — `MoletteDuree`
(`src/app/paysage/fiche/[id]/FicheChantierClient.tsx`) pose **deux listes
natives, les heures à gauche, les minutes à droite**, chacune au doigt, au pas de
cinq minutes. C'est la proposition A, codée le 16 août.

**La faute est de mon côté, et elle se répète :** une planche a été dessinée sans
chercher d'abord ce que le dépôt faisait déjà. C'est la même que la planche 56
— décrire un écran qui existe — et l'inverse du 20 août, où l'on avait déclaré
impossible un travail à moitié fait (`CLAUDE.md` §5 ter : *chercher avant
d'affirmer, dans les deux sens*). Trente secondes de `grep -rn molette src/`
l'auraient évité.

**TRANCHÉ le 25 août 2026 : « je garde celle qui est présente. »** Les molettes
natives du téléphone restent, et **rien n'est à coder**. La question ne portait
plus que sur l'apparence — le geste était identique dans les deux cas.

Le sujet est clos : **ne pas le rouvrir** sans qu'il le redemande.

**Ce que la D aurait changé — gardé pour mémoire, elle n'a pas été retenue.** D'un seul tenant, la molette
compte cinquante-trois crans de 0 h 00 à 4 h 00 : aller de 0 h 05 à 3 h 30
demande quarante et un crans, donc plusieurs élans du pouce. Séparées, la même
valeur se pose en deux gestes courts. Et c'est le geste de la molette de son
iPhone, qu'il connaît déjà — ce qui était l'argument de la A, retenue le 16 août
puis remplacée par celle-ci.

**Ce que ça coûte, et c'est dit sur la planche :** deux gestes au lieu d'un. Sur
une durée ronde — « deux heures » —, la C se posait d'un seul élan.

**RIEN N'EST CODÉ**, et c'est la règle : la planche se regarde d'abord
(`CLAUDE.md` §3 bis). Ce qui reste à faire est du développement ordinaire — la
molette, la liste des prestations, l'écran des Réglages.

**Ce qui restait à trancher, et qui l'est maintenant :**

**a) La molette** — la native du téléphone (gratuite, ressemble à un
formulaire), les quarts d'heure (un appui, mais imprécise), ou la molette Atlas
(la seule qui ressemble à l'application ; compter une demi-journée, accessibilité
comprise). Recommandation écrite dans la planche : la molette Atlas.

**b) CE QUI RESTE À TRANCHER, et ce n'est pas du rangement** (planche
`docs/maquettes/64-composer-sa-fiche.html`) :

> **Une seule fiche pour tous ses clients, ou un modèle puis une fiche par
> client ?**

Une fiche unique se tient en un endroit, mais chaque client voit les vingt
lignes — y compris celles qu'il ne paie pas, et c'est le chantier qui les fait
défiler. Une fiche par client est ce que le contrat décrit vraiment, au prix
d'un geste de plus à la signature.

**Ce qui n'est pas à trancher, et qui est déjà écrit dans les planches :**

- **un rapport déjà envoyé ne change plus jamais** — retirer une ligne du modèle
  en octobre ne touche pas aux rapports de juillet, qui sont signés et partis.
  C'est l'erreur qui ne se rattrape pas ;
- le retrait d'une ligne est **réversible** (règle du 10 août) ;
- la liste vient du contrat, ce qui n'est pas coché n'est pas une faute, et
  l'envoi emprunte le chemin qui porte déjà devis et factures.

**Ce que ce parcours suppose, s'il est retenu** : un contrat (la liste due), des
passages récurrents, un rapport par passage. C'est un troisième parcours à côté
du devis → facture, pas une case à ajouter.

### 0 quadragies ter. ~~« Le nouveau chantier fait le plus gros et en gras »~~ — **CODÉ le 16 août 2026 (A · les capitales, gros, très gras)**

**Sa demande du 16 août 2026**, capture de l'écran Chantiers à l'appui : *« Le
nouveau chantier fait le plus gros et en gras. »*

**Rien n'est codé** — sa règle du 11 août (`CLAUDE.md` §3 bis). La planche est
`docs/maquettes/67-le-nouveau-chantier-plus-gros.html` : trois formes (les
capitales grossies, la serif du titre, toute la largeur), trois tailles, trois
graisses, et **le témoin d'aujourd'hui figé à côté** — 9 px / 500 / rond de
38 px, les valeurs de `globals.css`.

**Son choix, la planche en main : « les capitales, gros et très gras ».** Porté
le jour même — 13 px, graisse 800, interlettrage 0,22 em, rond de 42 px, signe
inchangé à 20 (`src/app/globals.css`). `docs/maquettes/24-le-bouton-retenu.html`
porte désormais un bandeau qui dit que ses mesures de libellé sont périmées et
renvoie à la 67 : c'est lui qui avait resserré cet endroit le 11 août, et laisser
les deux se contredire aurait fait croire la mauvaise à la session suivante.

**Ce qui n'a PAS bougé, et qu'il ne faut pas « harmoniser » par erreur :** l'onde
à 1,42 fois le rond, les trois tours freinés en 560 ms, les onze grains et leur
portée, l'écart de 13 px entre le mot et le rond, la demi-seconde avant la
feuille.

**Ce qui est déjà su, et qu'il ne faut pas redécouvrir :** le cran « le plus
gros » (17 px en capitales, 26 px en serif) est **le plus gros qui tienne sans
couper le mot** sur un écran de 360 px — 284 px pour 308 disponibles. Au-delà,
« Nouveau chantier » finit en « … ».
`scripts/verifier-maquette-nouveau-chantier.mjs` le tient sur la planche, et
`scripts/test-bouton-nouveau-chantier-e2e.ts` le tient **dans l'application** :
il mesure le mot à 360 px et refuse aussi bien un retour au libellé minuscule
(≥ 12 px, ≥ 700) qu'une coupure en « … ».

### 0 quadragies bis. ~~La fiche du banc se figeait quand le veilleur travaillait~~ — **CORRIGÉ le 16 août 2026**

Trouvé en cherchant pourquoi il n'arrivait plus à ouvrir l'application. La
publication vivait dans la boucle de surveillance, qui s'arrête d'avancer dès
qu'elle appelle `npm run banc`. Elle vit désormais à côté
(`scripts/test-fiche-pendant-relance.ts`, qui sait rougir).

**Ce qui RESTE à faire, et qui n'est pas corrigé :** on ne sait toujours pas
pourquoi son serveur ne répondait pas le 16 août à 17 h 06. La fiche s'est tue
avant de le dire. **Ne pas écrire que cette panne-là est réparée** — seul
l'aveuglement l'est. Si elle revient, la fiche saura enfin la raconter.

**Le correctif est CONFIRMÉ sur sa machine :** fiche du 16 août 18 h 32,
« Écrite : par le veilleur, au quart d'heure » — la première publication
périodique jamais observée chez lui.

### 0 quadragies quater. ~~POURQUOI sa construction échoue~~ — **TROUVÉ le 16 août 2026**

`demarrer.sh` tuait `next-server`, `next dev` et `next start` avant de relancer
le veilleur, **mais pas `next build`**. La construction lancée par le premier
veilleur survivait donc, orpheline, en gardant le verrou du système ; celle du
second tombait sur « already running », rendait 1, et le banc repliait en mode
développement. À chaque allumage qui récupère du code — d'où trois redémarrages
sans effet. `build` est entré dans le motif
(`scripts/test-verrou-construction.ts`).

**CONFIRMÉ CHEZ LUI le 16 août 2026 au soir**, et c'est ce qui clôt le sujet :
correctif poussé, un redémarrage, et sa réponse — *« elle est rapide »*. La
construction aboutit donc bien sur sa machine une fois qu'on cesse de lui en
orpheliner une. **La piste « ne pas bâtir pendant qu'on sert » est écartée : ce
n'était pas une question de ressources.** Ne pas la rouvrir sans une mesure qui
la justifie.

### 0 quadragies ter. Une PAGE BLANCHE sur son banc n'est presque jamais une panne

**Payé le 16 août 2026 au soir.** Il redémarre, l'application s'ouvre sur du
blanc, il écrit « corrige-moi ça ». Rien n'était cassé : la page de connexion
s'affichait parfaitement sur son commit exact, et la construction réussissait.

**Ce qui se passait vraiment**, et la fiche le disait en une ligne :

    Code SERVI : aucune version bâtie — le banc sert le mode développement

Tant que `.next-batie` n'existe pas, chaque écran se compile **à l'ouverture**
— 30 à 100 secondes (`scripts/banc.mjs`) — et le mandataire de GitHub renonce au
bout d'une minute. Le blanc est cet intervalle, rien d'autre. Il se dissipe seul
dès que la construction retombe, ou en rechargeant une minute plus tard : la
compilation continue côté serveur même quand le navigateur a renoncé.

**Donc, devant « page blanche » : lire la ligne « Code SERVI » AVANT tout.**
« aucune version bâtie » + « serveur : répond » = il est dans la fenêtre de
construction, il n'y a rien à réparer. Chercher un défaut de produit là-dedans,
c'est ce qui a consommé la soirée.

**Ce qui reste à faire, et qui n'est pas fait :** pendant cette fenêtre, il n'a
aucun moyen de savoir qu'il doit attendre — il voit du blanc, comme devant une
panne. Une page d'attente qui dirait « Atlas se prépare, deux minutes » vaudrait
mieux que le blanc. **À dessiner avant de coder** (`CLAUDE.md` §3 bis) et à lui
montrer : ce n'est pas à nous de décider qu'il veut un écran de plus.

### 0 quadragies. ~~La réduction accordée au client~~ — **CODÉE le 16 août 2026 (B + « Prix accordé au client »)**

**Sa demande du 16 août 2026 :** *« si jamais un client me demande une
réduction, [pouvoir] lui demander "fais cinq pour cent sur le montant du devis"
et il ajoute une petite ligne réduction ou prix accordé au client — cinq pour
cent, ou dix, ou quinze. C'est moi qui choisis le nombre de pourcentage. »*

**Rien de tel n'existe dans le produit** : aucune remise, nulle part — vérifié.

**Son choix : « sous le total et prix accordé au client »** — l'arrangement B,
le plus cher des trois, choisi en connaissance de cause. Livré :
`src/lib/reduction-devis.ts`, migration 0048, les deux PDF, l'écran du devis, et
une sixième retouche dictée. Détail : `ARCHITECTURE.md` §116.

**CE QUI RESTE, et qui n'est pas rien :**

1. **Le geste n'a pas été parcouru à la VOIX**, faute de service de
   transcription et de modèle ici — comme tout le micro du devis (§0 trigies).
   Ce qui est éprouvé : la règle, le PDF, le parcours devis → facture → relevé
   de TVA, et l'écran. Le raccord voix → réduction, non.
2. **Ses deux questions de la planche restent sans réponse**, et ne bloquent
   rien : un **montant** au lieu d'un pourcentage (« fais-moi 50 € »), et si la
   remise doit aussi apparaître sur la **facture PDF** autrement que par ses
   totaux — aujourd'hui elle y est, au même endroit que sur le devis.
3. **La ligne « + Prix accordé au client » n'a pas été demandée.** Elle a été
   ajoutée parce que sans elle une remise dictée par erreur ne se retirerait
   pas, et qu'une installation sans clé d'IA ne saurait pas en poser. À retirer
   s'il n'en veut pas.

| | Où elle se pose | Ce que ça coûte |
|---|---|---|
| **A** | une ligne du tableau, montant négatif | **presque rien** : une ligne voyage seule jusqu'à la facture, au relevé de TVA et à l'export comptable — tout ce chemin est déjà bâti pour les lignes |
| **B** | un bloc sous le total, avec « HT après remise » | **une colonne de plus** dans le devis, la facture, et tout ce qui les recopie. Chaque endroit oublié est un montant faux |
| **C** | le prix barré à côté du nouveau | même coût que B, et le vocabulaire de la promotion sur un document qui engage |

Et un second choix, indépendant : le **mot** — « Réduction » ou « Prix accordé
au client ». Il a proposé les deux.

**CE QUI N'EST PAS À CHOISIR, et qui ne se rouvre pas :**

- **la réduction s'applique sur le HT, la TVA se calcule après.** Sur le TTC,
  elle rendrait une TVA fausse sur un document qui finit dans une déclaration ;
- **elle suit jusqu'à la facture** (`factures.ts` recopie lignes et totaux du
  devis). Accordée sur le devis et absente de la facture, elle ferait payer au
  client le prix qu'on venait de lui retirer ;
- **aucun taux « habituel » ne s'invente** : 5, 10, 15, c'est lui qui le dit.

**Deux questions posées dans la planche, sans réponse et qui ne bloquent pas :**
un **montant** au lieu d'un pourcentage (« fais-moi 50 € ») — pas dans sa
demande, donc pas ajouté ; et un **bouton** sur l'écran du devis en plus de la
voix.


### 0 novivicies. ~~Le devis qui tarde~~ — **CODÉ le 16 août 2026 (B, 4 jours, « Chantier sans devis »)**

*Planche : `docs/maquettes/56-le-devis-qui-tarde.html`. Code : `src/lib/rappels.ts`,
`src/server/repositories/rappels.ts`, `src/app/reglages/notifications/`,
`src/app/Notifications.tsx`, migration `drizzle/0046_rappel_chantier_sans_devis.sql`.
Détail et raisons : `ARCHITECTURE.md` §112.*

**Sa demande du 14 août :** *« un rappel lorsque le chantier a été ouvert mais le
devis n'a pas été envoyé […] comme la Mme Félicie, vue il y a quatorze jours,
aucun devis envoyé »*. **Ses quatre décisions, toutes appliquées :** *« la B et
4 »*, *« le G »*, *« le B »* (le ton, reposé capture à l'appui), *« fait la B »*
(le rang).

**LA PLACE GARANTIE : TRANCHÉE ET CODÉE** (16 août, *« ok alors fait le »*,
après deux photos). Les rappels passant devant, cinq d'entre eux masquaient
toutes les réponses de clients — la batterie l'avait dit en rougissant avant que
l'image ne le montre. Son choix B tient : la **première** place reste au rappel,
c'est la **dernière place visible** qui revient à une réponse, et seulement s'il
en existe. Règle pure dans `src/lib/ordre-notifications.ts`, éprouvée sur les cas
limites et sur les 108 combinaisons — aucune carte perdue ni dupliquée.

**Plus aucun point n'attend son avis sur ce lot.**

**Trois leçons de ce lot, à ne pas repayer :**

1. **Chercher ce qui existe AVANT de dessiner.** La planche a décrit deux fois un
   monde disparu — un écran déjà dessiné le 13, un délai déjà codé le 14. Les
   planches de l'application vivent dans `maquettes/`, celles des décisions dans
   `docs/maquettes/`, et le code est un troisième endroit.
2. **Une confusion entre deux libellés n'existe qu'en contexte.** Montrer une
   ligne seule ne prouve rien : c'est côte à côte avec sa VOISINE qu'elle se
   juge. D'où la règle tenue par `test-devis-qui-tarde-e2e` — deux réglages
   voisins ne commencent pas par le même mot —, plus étroite qu'un « toutes les
   paires » qui refuserait un choix qu'il a fait en connaissance de cause.
3. **Photographier plutôt que décrire, et sur la BONNE scène.** Deux
   descriptions que je lui avais données étaient fausses, et l'image l'a dit :
   sa carte ne passe derrière qu'à partir de DEUX réponses en attente, et
   « montrer trois cartes » met la troisième sous le bord de l'écran.
   `scripts/capture-rang-trois-cas.sh` monte la scène minimale et rend le code
   même en cas d'échec.

### 0 novovicies. ~~La TVA au PAIEMENT~~ — **CODÉE le 16 août 2026**

*Fait : `ARCHITECTURE.md` §111. Ce qui suit reste pour mémoire du raisonnement.*

**Ce qui reste, et qui n'est pas technique :** confirmer son régime auprès de son
comptable (`docs/A-FAIRE.md` §12). Le défaut posé est `encaissements`, celui de
la loi ; s'il a opté pour les débits, un appui suffit à le rétablir.

**Ce qui reste à coder :** le rapprochement bancaire qu'il a choisi
(`docs/A-FAIRE.md` §13) — il attend un prestataire agréé, donc un contrat.

#### Le raisonnement d'origine

*`maquettes/atlas-tva-au-paiement.html`, le 14 août 2026 — deux écrans, 28
contrôles. Sa question : `docs/QUESTIONS.md` §20.*

**Ce que ça corrige, et ce n'est pas un confort.** `releveTvaCollectee` prend
toutes les factures `emise` à leur **date d'émission**. Pour une prestation de
services, la TVA est exigible **à l'encaissement** (CGI art. 269-2-c) ; les
débits sont une **option** qu'il n'a probablement jamais demandée. L'application
lui fait donc avancer la TVA d'un client qui n'a pas payé.

**Ce qui se code dès qu'il a la réponse de son comptable :**

| Quoi | Ce qu'il faut |
|---|---|
| **Paiements d'une facture** | une table `paiements_facture` — date, montant, moyen. Acomptes compris : un règlement partiel n'encaisse qu'une part de la TVA |
| **Le relevé calculé dessus** | `releveTvaCollectee` prend la date du PAIEMENT, plus celle de l'émission |
| **Le réglage des deux régimes** | `entreprises.tva_exigibilite` : `encaissements` (défaut) ou `debits` |
| **Ce qui attend, annoncé** | l'écran dit combien de TVA attend son paiement — une facture absente en silence se lit comme un oubli |

**Comment Atlas saura qu'il a été payé** — sa question du 14 août, et son choix :
**la banque** (`maquettes/atlas-banque-rapprochement.html`, 28 contrôles).

| Quoi | Ce qu'il faut |
|---|---|
| **Virements lus** | un prestataire agréé DSP2 — contrat et coût à décider, `docs/A-FAIRE.md` §13 |
| **Le rapprochement PROPOSÉ** | montant exact + nom approchant + fenêtre de dates. une règle pure, éprouvable sans banque, à écrire dans `src/lib/` |
| **Jamais automatique** | un virement collé à la mauvaise facture met la TVA dans le mauvais trimestre. Atlas propose, le patron confirme |
| **Les 90 jours** | l'accès se coupe (règle européenne). Prévenir une semaine avant, et retomber sur la saisie à la main |

**La saisie à la main se code sans attendre la banque** — c'est elle qui reste
quand l'accès dort, et elle ne dépend d'aucun contrat.

**Ce qui BLOQUE**, et qui n'est pas technique : sous quel régime il est. Inscrit
dans `docs/A-FAIRE.md` §12 — son comptable le sait en une phrase.

**Ce qu'on ne codera pas tant qu'il n'a pas tranché :** deviner son régime. Le
poser au hasard ferait déclarer trop tôt ou trop tard, et c'est l'administration
qui arbitrerait.

### 0 undetricies. L'absence d'une équipe — DESSINÉE le 14 août 2026, en attente de son choix
### 0 tricies nonies. ~~`test-pastille-equipe-e2e` est ROUGE sur `main`~~ — **RÉGLÉ le 16 août 2026**

**La cause n'était ni le code ni `.first()` : c'était le CALENDRIER.** La suite
visait « aujourd'hui + 20 jours » et supposait un jour ouvré. Le 16 août, cela
tombait sur le **samedi 5 septembre** : le panneau affichait « Jamais proposé »,
aucun bouton « Poser » n'existait — comportement voulu — et la suite rougissait
sans qu'aucun code n'ait bougé. Constaté à la sonde, en lisant le panneau :
`sansDate` n'était pas vide, il en comptait cinq.

Elle avance désormais au premier jour ouvré. **Une suite qui échoue selon le
jour de la semaine s'apprend à être ignorée** — et c'est ce garde-fou-là qu'on
perd, pas seulement dix minutes.

*Le constat d'origine est gardé ci-dessous : il dit bien ce qui avait été
écarté, et la piste `.first()` reste juste dans son principe — elle n'était
simplement pas la cause ici.*

**Et une seconde fragilité, corrigée par-dessus le 16 août :** le contrôle
cliquait `[data-atlas="sans-date"]` **avec `.first()`**, alors que le jeu de
démonstration porte d'autres chantiers sans date et que les sections
précédentes de la même suite en posent. Il vise désormais le chantier **par son
nom**, horodaté donc unique. Ce n'était pas la cause du rouge — la leur l'a
élucidée — mais c'était bien une loterie.

**Le jour visé part maintenant à six mois** plutôt qu'à vingt jours, toujours
ramené au premier jour ouvré par `estWeekEndIso` : à trois semaines, on tombe
dans la plage où les autres suites posent leurs chantiers, la journée s'annonce
« pleine », et le panneau ne rend alors **aucun bouton** — le même symptôme, une
autre cause. Le contrôle lit désormais le panneau AVANT de conclure : une
journée pleine se dit en toutes lettres au lieu d'accuser le bouton.

### 0 tricies nonies bis. Deviner une cause coûte plus cher que la regarder

*Écrit le 16 août 2026, en marge du correctif de `test-pastille-equipe-e2e`.*

Devant cette suite rouge, j'ai inscrit ici un diagnostic tiré d'une
**ressemblance** avec un défaut voisin — « la suite désigne le premier chantier
sans date plutôt que le sien ». C'était faux, et cela a failli envoyer la
session suivante corriger ce qui n'était pas cassé.

**Un seul relevé de l'état réel de la page a suffi à trancher** : « Samedi
5 septembre — Jamais proposé » était écrit dans le corps de la page. La cause
était le calendrier, pas le sélecteur.

**La règle qui en sort, et elle vaut au-delà de ce cas :** devant un contrôle
rouge, relever ce que la page DIT avant d'écrire une cause. Une hypothèse
consignée dans les tâches se lit ensuite comme un fait.


### ~~0 tricies octies. Marquer une facture PAYÉE~~ — **FAIT les 15 et 16 août 2026**

*Écrit le 14 août en codant « Notifications », quand rien dans Atlas
n'enregistrait qu'une facture était réglée. Le manque bloquait alors trois
familles d'alertes de la planche.*

**Le geste existe** : « Terminés › TVA › En attente de paiement », avec « Payée »
d'un doigt et « Noter un règlement » pour un acompte (migration 0045,
`paiements_facture`, codé par une autre session).

**Et la première des trois alertes bloquées est codée** : « Facture impayée »,
le 16 août (`ARCHITECTURE.md` §118). Les deux autres restent ouvertes, et elles
ne sont plus impossibles — seulement pas demandées :

| Ce qui reste | Ce qu'il faudrait |
|---|---|
| « Facture à échéance dans trois jours » | Un rappel AVANT l'échéance, symétrique de l'actuel |
| « Client à relancer » | Se poser sur le client plutôt que sur la facture |

### 0 duodetricies quater. La couleur de la barre du navigateur ne suit pas la charte

`themeColor` vaut toujours le crème dans les métadonnées : sur « Nuit », la
barre d'adresse de l'iPhone reste claire au-dessus d'un écran noir. Ce n'est pas
dans le rendu de la page — c'est une métadonnée, et elle ne connaît pas la
personne connectée. Il faut la produire depuis `generateViewport`, ce qui ajoute
une lecture de base à chaque page : à peser avant de le faire.

### ~~0 duodetricies ter. Apparence : le mode sombre OU l'accent~~ — **FAIT le 14 août 2026**

Ni l'un ni l'autre séparément : **les sept chartes**, dont deux sombres
(`ARCHITECTURE.md` §114). Le mode sombre qu'il demandait EST Nuit et Sylve.

**Ce qu'il ne faut pas rouvrir :** un interrupteur « sombre » à côté du choix de
charte. Les deux se contrediraient à la première combinaison — « Nuit » avec le
sombre éteint ne veut rien dire.

### ~~0 duodetricies ter (d'origine). Apparence : le mode sombre OU l'accent, à trancher~~

L'écran existe et ne règle rien, délibérément (`ARCHITECTURE.md` §108). Les
deux chantiers possibles, et leur coût :

| | Ce que ça demande |
|---|---|
| **Mode sombre** | Un second jeu de jetons, et **chaque écran repris un à un**. C'est ce qu'il avait envoyé le 14 août : sa planche d'origine était sombre |
| **Accent au choix** | `colors.rust` et `colors.or` sont écrits en clair dans plus de trois cents endroits, en style en ligne. Il faut les faire passer par une variable CSS — un balayage de toute l'application, à faire et à éprouver d'un coup |

**Ne pas poser d'interrupteur en attendant.** Sa phrase sur la planche : *« on le
touche, rien ne bouge, et on croit à une panne »*.

### 0 tervicies. ~~Apparier deux demi-journées par la proximité~~ — **CODÉ le 16 août 2026, par la route**

**Sa demande du 13 août 2026** : quand une demi-journée est prise et l'autre
libre, que le planning propose le chantier en attente **le plus proche**. Son
choix du 16 : la composition **2** de la maquette (le bandeau sous la journée),
**avec plusieurs propositions comme la 3**, et **par la route**.

**La question juridique est tranchée** (`docs/A-FAIRE.md` point 11, barré) : le
service d'itinéraire de l'IGN accepte sans clé ni compte, répond en 186 ms, et
le vol d'oiseau se trompe de ×1,33 à ×1,56 — assez pour inverser un classement.
Mesuré, pas supposé : `.github/workflows/itineraire.yml`.

**Livré :** migration `0049` (coordonnées + `adresse_situee`), rattrapage
automatique au fil des ouvertures du planning, règles pures dans
`src/lib/appariement-demi-journees.ts`, appel IGN dans
`src/server/itineraire/geoplateforme.ts`, bandeau dans
un bandeau sous la journée dépareillée — retiré de l'écran le 21 août 2026 avec
la refonte du planning, le calcul restant en place. Détail et pourquoi :
`ARCHITECTURE.md` §117.

**Ce qui RESTE, et n'est pas dans ce lot :**

- **la proposition 4 de la maquette** — proposer au moment où l'on pose la date,
  et non seulement sur le planning. Les deux ne se disputent pas ; elle attend
  son geste ;
- **un seul trou proposé à la fois.** À plusieurs équipes, plusieurs
  demi-journées dépareillées peuvent coexister. Trois bandeaux sous une même
  journée seraient illisibles ; on complète le premier, le suivant apparaît. À
  rouvrir seulement s'il le demande ;
- **la commune affichée est déduite de l'adresse** (`communeApprochee`), pas
  lue de la Base Adresse Nationale. Se tromper coûte une ligne un peu longue,
  jamais une mauvaise décision. Une colonne de plus serait à tenir à jour à
  chaque correction d'adresse.


### 0 quatervicies. Des suites navigateur tombent en batterie et passent seules

**Constaté le 16 août 2026.** En batterie : *« le serveur de banc n'a jamais
répondu »* après trois minutes d'attente. Rejoué seul dans la foulée, sans rien
changer : **six contrôles au vert**.

**Ce que ça n'est pas.** Un défaut du produit : cette suite éprouve un écran qui
ne s'affiche que sur le banc d'essai, et l'écran répond très bien.

**Ce que c'est probablement.** Elle démarre un **second** `next dev` — le sien,
avec son propre dossier de construction — pendant que celui de la batterie
tourne déjà, et pendant qu'un navigateur est ouvert. Deux compilations Next.js
concurrentes sur cette machine dépassent les trois minutes qu'elle s'accorde.

**Ce qu'il ne faut PAS faire :** allonger le délai jusqu'à ce que ça passe. Un
contrôle qui attend dix minutes ne dit plus rien de ce qu'il mesure. La piste
juste est de **réutiliser le serveur de la batterie** avec le profil banc plutôt
que d'en lancer un second, ou de la jouer avant que le navigateur ne démarre.

**Tant que ce n'est pas fait, l'attitude est simple :** un rouge de cette suite
en batterie se rejoue seul avant d'être cru — et cette phrase-là est ce qui
manquait le 16 août, où il a fallu la découvrir.

**Elle n'est pas seule, et c'est ce qui compte.** Le même jour,
`test-pastille-equipe-e2e` est tombée en batterie sur *« Depuis la feuille du
chevron aussi, l'équipe se retire — le montage de ce cas n'a pas pris »*, puis a
donné **neuf contrôles au vert** rejouée seule, sans une ligne modifiée. Deux
suites différentes, un seul symptôme : la machine est saturée en fin de
batterie, et un montage qui attend un écran finit par renoncer.

**Donc la règle est générale, pas propre au banc :** un rouge isolé en fin de
batterie navigateur se rejoue seul **avant** d'ouvrir une enquête. Ce qui reste
rouge seul est un défaut ; ce qui passe seul est une saturation, et c'est la
batterie qu'il faut réparer, pas le produit. Ne pas confondre les deux a coûté
une soirée le 16 août.

**Et ne pas s'en satisfaire.** « Ça passe seul » n'est pas un état acceptable à
demeure : une batterie qui ment une fois sur dix finit par être crue quand elle
dit vrai. La piste ci-dessus — un seul serveur Next partagé — vaut pour les deux.


### 0 duovicies. `/chantiers/<id>/facture` ne répond plus en fin de batterie

### 0 undetricies. ~~L'absence d'une équipe~~ — **CODÉE le 14 août 2026 (proposition A)**


**Sa question :** *« Comment on fait si jamais il y a une équipe qui doit partir
en déplacement pour cinq jours ? »* Réponse complète dans `docs/QUESTIONS.md`
§19 ; trois propositions dans `docs/maquettes/55`.

**Ce qui existe déjà, et qu'il ne faut pas refaire :** si TOUTE l'entreprise
part, l'agenda Google relié suffit — une période de plusieurs jours occupe
toutes les demi-journées qu'elle traverse. **Rien à coder pour ce cas-là.**

**Ce qui manque :** une absence datée **par équipe**. L'agenda bloque tout le
monde — délibérément, `fusionnerOccupationExterne` pose l'occupation au niveau
du nombre d'équipes parce qu'Atlas ne peut pas deviner si une équipe sait partir
sans le patron — et le nombre d'équipes est un nombre **sans dates**.

**Il a retenu la A** — sous les noms, dans Réglages → Équipe. Les deux autres
restent dessinées : (B) un appui long sur un jour du planning, (C) une ligne de
déplacement posée comme un chantier. Si l'usage montre que le geste tombe au
mauvais endroit, le chemin est tracé.

**FAIT.** `drizzle/0044_absences_equipe.sql`, `src/lib/absences-equipe.ts`,
`src/server/repositories/absences-equipe.ts`, `src/app/reglages/AbsencesEquipe.tsx`.
Une absence est traitée comme une **occupation** — elle prend la place qu'un
chantier aurait prise — ce qui la fait entrer dans les quatre calculs de
capacité sans changer une seule signature. Éprouvée à trois niveaux :
`test-absences-equipe.ts` (25 cas purs), `test-absences-equipe-repo.ts`
(isolation, sous `atlas_app`), `test-absence-equipe-e2e.ts` (du doigt jusqu'au
calendrier, vu rouge quand on retire la réparation). `ARCHITECTURE.md` §109.

### 0 undetricies ter. ~~La page « toutes les maquettes » a pris du retard, en silence~~ — **le contrôle demandé existe (15 août 2026)**

**Ce que cette entrée demandait, le 14 août :** *« un contrôle qui refuse une
planche présente sur le disque et absente de la liste […]. Le rattrapage des six
se fait alors une fois, et le trou ne se rouvre plus. »* C'est écrit, et le
rattrapage est fait — détail et éprouvage en **§0 tricies septies**.

**Une seule chose a changé par rapport à ce qui était demandé, et elle compte :**
le contrôle n'exige pas d'être dans la page unique, mais **dans l'une des deux
portes**. La page unique est une *sélection* — elle laisse dehors les planches
qui se manipulent, dont `43-l-attente-a-lessai`, qui ne vaut que seule ; le
sommaire est le *catalogue*. Exiger les deux aurait fait rougir des choix
délibérés, et un contrôle qui accuse à tort finit contourné.

**Et l'entrée avait raison de ne pas rattraper à la main** : les titres écrits
ici pour `47-ou-mettre-l-assistant` et `53-le-mot-juste-sans-la-date` sont tirés
de leurs propres en-têtes, pas inventés.

### 0 undetricies bis. L'équipe d'un chantier est une étiquette, pas une contrainte

**Trouvé le 14 août 2026 en répondant à la question ci-dessus, et pas signalé
par lui.** `compterOccupation` compte les chantiers par demi-journée et compare
ce total au nombre d'équipes ; il ne regarde **jamais** `equipeId`. Deux
chantiers le même matin, tous les deux sur « Équipe 1 » : Atlas les accepte sans
rien dire.

Sans conséquence tant que le patron répartit lui-même. **Faux dès qu'une équipe
est absente** — d'où le lien avec le point précédent.

**Pourquoi ce n'est PAS dans le même lot :** le régler oblige à choisir l'équipe
**avant** de proposer une date au client, donc à toucher au parcours du devis
(trois arrêts, `docs/AGENT.md`). C'est un chantier à part, et il n'a de sens que
si le télescopage se produit vraiment. **Question posée au patron le 14 août,
sans réponse à ce jour.**

### 0 octovicies. ~~Mon compte et Connexion~~ — **CODÉS le 14 août 2026 (« A A »)**

Les deux écrans existent : `/reglages/compte` et `/reglages/connexion`
(`ARCHITECTURE.md` §107). **Ses deux réponses ont été appliquées** — pas de
téléphone dans le compte, pas de liste d'appareils dans la connexion, et les
deux mots retirés des libellés du sommaire.

**Trois choses à ne PAS rouvrir sans qu'il le demande :**

| | |
|---|---|
| Le champ **téléphone** du compte | Réponse « A ». Rien ne l'appellerait : le numéro du client est celui de l'entreprise |
| La **liste des appareils** | Réponse « A ». Il faudrait une table de sessions ; le geste utile — « me déconnecter partout » — existe et suffit |
| L'**œil à la place** de la confirmation | Il veut **les deux**. L'œil se touche après coup ; la confirmation attrape la faute au moment où elle se fait |

**Ce qui reste ouvert, et qui attend autre chose que du code :** l'e-mail ne se
change pas. Il faudrait d'abord un moyen de vérifier la nouvelle adresse — donc
un canal d'envoi, qui n'existe pas et dont il a dit qu'il n'y en aurait pas. À
rouvrir le jour où un parcours d'inscription existera.

**Un défaut antérieur vu sur la capture — ~~et réglé le même jour par une autre
session~~.** La bulle de l'assistant recouvrait le bord droit du bouton
d'enregistrement, sur cet écran comme sur « Mon entreprise ». Elle a quitté le
coin flottant pour l'en-tête (`ARCHITECTURE.md` §106, proposition B). **Rien à
faire ici**, et surtout rien à contourner : la cause n'était pas la place de mon
bouton, c'était un élément `fixed` — cinq écrans avaient déjà été déplacés cet
été pour l'éviter.

### 0 duodetricies. ~~L'assistant flottant recouvrait les écrans~~ — **réglé le 13 août 2026 (proposition B)**

*« L'onglet de l'assistant est hyper mal placé »*, puis *« la B mais de la même
couleur qu'elle est déjà »*. Le bouton a quitté le coin flottant pour l'en-tête,
en gardant son vert pin plein. `ARCHITECTURE.md` §106.

**Quatre choses à ne pas défaire :**

1. **Il ne doit plus jamais être `fixed`.** C'est la cause, pas la position :
   cinq écrans ont été déplacés cet été pour éviter cette bulle.
2. **Il reste À CÔTÉ DU TITRE, pas sur une ligne à lui.** Une ligne propre
   ajoute 72 px en tête de chaque écran et repousse la dernière semaine du
   planning sous la barre — essayé, mesuré, défait.
3. **La couleur ne vient pas du composant qui le porte** : `colors.rust` plein,
   icône blanche, c'est sa demande explicite.
4. **`useAssistant()` rend `null` hors du fournisseur** au lieu de lever :
   `EnTeteEcran` sert onze écrans, et une page hors gabarit ne doit pas tomber
   pour un bouton d'agrément.

### 0 duodetricies bis. La dernière semaine du planning déborde de onze pixels sous la barre

**Trouvé le 13 août 2026 en mesurant autre chose**, et **antérieur** à ce
travail : la dernière case du mois finit à 626 px quand la barre du bas commence
à 615. Onze pixels de la ligne « 31 » passent dessous — elle reste lisible, et le
planning défile, mais elle n'est pas entièrement là.

**Non traité, et signalé plutôt que corrigé en passant** : ce n'est pas ce qu'il
a demandé, la correction touche la hauteur réservée du calendrier, et un
contrôle qui l'aurait attrapé aurait accusé le déplacement de l'assistant — ce
qui n'est pas le coupable.

### 0 trigies. ~~Dicter dans le devis~~ — **CODÉ le 15 août 2026 (proposition A)**

Sa demande du 15 août 2026, capture du devis à l'appui : *« rajoute-moi un petit
dictaphone en haut à droite comme il y a pour les infos clients [...] pour
pouvoir dicter à l'intérieur du devis s'il y a des choses à reprendre ou à
modifier. »* Puis son vocabulaire — supprimer une ligne par son rang ou par son
nom, changer un prix, en ajouter une, corriger une faute — et sa phrase :
*« Je vais pouvoir lui parler comme ça et qu'elle comprenne. »*

**Livré** : `src/lib/retouches-devis.ts` (la règle),
`src/server/ai/services/retouches-devis-service.ts` (le modèle),
`src/app/chantiers/[id]/devis-complet/DicterDansLeDevis.tsx` (l'écran). Détail : `ARCHITECTURE.md`
§113, `CHANGELOG.md` du 15 août.

**CE QUI RESTE, et qui n'est pas un détail :**

1. **La feuille remplie n'a jamais été parcourue de bout en bout.** Cet
   environnement n'a ni transcription ni modèle : la chaîne voix → feuille n'est
   éprouvée qu'en morceaux (27 cas sans navigateur, 5 au navigateur). Le premier
   essai réel sera le sien, ou celui d'une machine avec une clé. **Le lui dire
   plutôt que de le laisser croire éprouvé.**
2. ~~Sa question de la planche 54~~ — **TRANCHÉE le 16 août 2026 : NON.**
   Il avait d'abord répondu « oui il peut néanmoins », puis s'est repris dans le
   message suivant : *« je veux que la note, elle ne remplace que les lignes de
   [devis] et rien d'autre, comme c'était déjà avant — on ne touche pas aux
   conditions. »* **C'est l'état actuel du code, et il ne bouge pas.**

   **Rien n'avait été codé entre les deux réponses**, et c'est précisément ce
   que le §3 bis protège : la première réponse aurait fait écrire un sixième
   type de retouche qu'il aurait fallu défaire douze heures plus tard. Ne pas
   rouvrir sans qu'il le demande.
3. **Aucune vérification côté serveur qu'un devis figé refuse les retouches.**
   L'écran retire le micro dès l'envoi, et c'est la seule barrière — exactement
   comme pour les autres champs de cet écran, qui n'en ont jamais eu d'autre. À
   corriger pour tous en même temps, pas pour celui-ci seul.

### 0 novemvicies. ~~L'équipe n'était pas applicable~~ — **la pastille CODÉE le 14 août 2026 (geste A)**

Sa remarque du 13 août 2026 : *« appliquer une équipe à un chantier n'est pas
intuitif »*. Elle était fondée : `planifierChantier` était alors le **seul**
chemin qui écrivait `equipeId` — six gestes pour changer une lettre, à commencer
par « Déplacer », un mot qui annonce une **date**.

**Deux choses ont été livrées le 14 août, par deux sessions :**

| | |
|---|---|
| la ligne « Équipe » dans la feuille du chevron (geste B) | par une autre session |
| **la pastille sur la ligne du planning** (geste A) — son choix | ce lot |

**Ce que la pastille règle, et que la feuille ne réglait pas :** un chantier
**sans** équipe le dit enfin — « Équipe&nbsp;? » en or pointillé. Jusque-là la
ligne n'écrivait rien du tout, et rien ne signalait qu'il en manquait une.

**Trois conséquences assumées, écrites pour ne pas être défaites par surprise :**

1. **« Déplacer » a quitté la ligne pour la feuille du chevron.** À 390 px la
   ligne ne peut porter le nom, l'occupation, l'équipe, « Déplacer » et le
   chevron — c'est le NOM qui aurait rétréci. Le geste n'est pas perdu : le
   supprimer aurait refermé la seule façon de changer une date, et le planning
   a déjà été un cul-de-sac une fois (8 août).
2. **`changerEquipeChantier` accepte `null` : l'équipe se RETIRE.** C'était
   impossible par tout chemin jusqu'à ce jour — `planifierChantier` ignore le
   cas en silence, et le geste neuf exigeait un rang. « Personne pour
   l'instant » figure sur l'écran qu'il a retenu ; le montrer sans pouvoir
   l'exécuter aurait été livrer un bouton mort.
3. **Retirer ne se refuse jamais pour occupation** : libérer une place n'en
   prend aucune, et refuser enfermerait le patron dans son erreur.
4. **Les DEUX chemins savent retirer** — la pastille et la feuille du chevron.
   Le second l'a gagné le soir même, sur sa question : le laisser manquer aurait
   donné deux portes et deux réponses, et celui qui prend la seconde en conclut
   que c'est impossible.

**Geste C — CODÉ le 14 août 2026**, à sa demande (« tu peux faire la C ») : au
moment de **poser**, les équipes sont devenues des **cases côte à côte**, et le
bouton reste à l'écran, éteint, en disant « Choisissez d'abord ». Il ne comblait
aucun trou — le choix existait — mais il ne ressemblait pas à un choix, et c'est
le geste qu'il fait à chaque nouveau chantier.

**Et le défaut de fond n'est PAS refermé :** à la **pose**, le serveur revalide
le compte de la demi-journée (`occupation < nombreEquipes`), jamais l'identité
de l'équipe demandée. Le chemin du changement, lui, la vérifie pour de bon
(`EquipeIndisponible`). Deux chemins qui protègent différemment la même chose
finissent par diverger — inatteignable par l'écran aujourd'hui, qui éteint les
lignes prises.

### 0 novemvicies bis. ~~La ligne du planning disait « matin » quoi qu'il arrive~~ — **CODÉ le 2026-08-14**

Sa capture du 13 août 2026 : *« pourquoi sous le chantier il y a marqué matin ?
Cela laisse à penser que juste le matin est bloqué alors que c'est la journée. »*

Il avait raison. `libelleQuand()` écrivait `creneauDebut`, la demi-journée de
**départ**, jamais ce que le chantier occupe — et `DUREE_PAR_DEFAUT_DEMI_JOURNEES`
valant **2**, le cas le plus courant du produit était celui qui mentait.

**Ce qui n'était PAS en cause, et n'a donc pas bougé :** `compterOccupation()`
parcourait déjà la durée. Les pastilles du calendrier et la réservation ont
toujours compté juste. **Aucune donnée touchée, aucune migration.**

**Ses mots, arrêtés en deux temps sur maquette** (`docs/maquettes/51` puis `49`) :
*« La A »*, *« matin, après-midi ou les deux, mais pas la date »*, puis *« Je
veux journée et du 21 au 25 »*.

| Ce que le chantier prend | Ce que la ligne dit |
|---|---|
| une demi-journée | « matin » · « après-midi » |
| une journée entière | « journée » |
| plus d'un jour | « du 21 au 25 août » — le week-end sauté, comme la réservation |
| à cheval sur deux mois | « du 31 août au 2 septembre » |

Écrit dans `libelleOccupation()` (`src/server/disponibilites.ts`), **fonction
pure** : elle demande à `creneauxDuChantier` ce qui est occupé plutôt que de
refaire l'arithmétique, sans quoi l'écran et la réservation finiraient par se
contredire un vendredi. Éprouvée par `scripts/test-libelle-occupation.ts`, et
**le contrôle a été vu rouge** contre l'ancien comportement avant d'être livré.

**La date tombe sur la LISTE, pas dans la feuille du chevron**, et c'est
délibéré : sa consigne (*« elle est déjà présente juste au-dessus »*) vaut du
panneau du jour, titré « Lundi 17 août ». Dans la feuille, elle n'est écrite
nulle part ailleurs — l'en retirer laisserait un chantier sans jour.
`Occupation.porteLaDate` empêche le doublon « 21 août · du 21 au 25 août ».

**Reste à lui confirmer :** que la date ait disparu de la liste **sans qu'il
l'ait redemandé explicitement après avoir vu les deux versions côte à côte**.
Un mot de lui la ramène.

### 0 novemvicies ter. L'icône installée est un A, et personne ne l'avait vu

Trouvé le 13 août 2026 en dessinant les planches du nom (ci-dessous), pas
cherché : `public/icone-source.svg` est **un A** — « un A bâti comme un chevron
de charpente », dit son propre en-tête, posé comme provisoire et jamais
remplacé. Elle est de surcroît restée en **terre cuite `#C0621F`**, la couleur
d'avant la charte vert pin du 3 août.

Deux conséquences, et elles ne dépendent pas l'une de l'autre :

- **Si un autre nom est retenu**, l'icône devient fausse — un A sur l'écran
  d'accueil d'un outil qui ne s'appelle plus Atlas. Ce serait le seul des quatre
  fichiers à reprendre qui demande un **dessin**, pas un remplacement de mot.
- **Même si le nom ne change pas**, elle est hors charte depuis dix jours.

Le remplacement est mécanique : un fichier, puis `npm run icones` régénère les
PNG. Ce qui manque est la décision de dessin. Les planches 45 proposent le
**sceau de la porte** — rose des vents dans son rond d'or sur crème —, ce qui
ferait de la porte et de l'écran d'accueil la même image. **Rien n'est décidé.**

### 0 novemvicies quater. Trois noms proposés — Gunzi, Goonzi, Gunzy

**⚠ MIS EN ATTENTE PAR LE PATRON, le 16 août 2026 :** *« Oublie le mot
Gunzy, on s'en fout pour l'instant, on verra ça plus tard. »* **Ne plus le lui
reposer** — c'est lui qui rouvrira. Les trois planches restent où elles sont.

Sa demande du 13 août : *« fais-moi une maquette avec comme nom Gunzi à la place
d'Atlas. Ne code rien. »*, puis les deux autres noms. Trois planches identiques
au mot près, avec un passage de l'une à l'autre en tête :
`docs/maquettes/50-le-nom-{gunzi,goonzi,gunzy}.html`.

**Rien n'est codé, et c'est la consigne** (`CLAUDE.md` §3 bis). Ce qu'il faudra
toucher le jour où un nom est arrêté, pour ne pas le rechercher :

| Où | Quoi |
|---|---|
| `src/components/atlas/MarqueAtlas.tsx` | `MotAtlas` — le mot sous le sceau |
| `public/manifest.json` | `name` et `short_name` — l'écran d'accueil |
| `src/app/layout.tsx` | le titre de l'onglet et la carte de partage |
| `public/icone-source.svg` | l'icône, qui est un A — voir ci-dessus |
| `src/server/documents-legaux/versions.ts` | les CGU citent le nom, et **une version acceptée ne se modifie jamais** : renommer y fait naître une version de plus, à réaccepter |

**Ce que la planche a établi, et qui n'était pas su :** le nom ne se voit qu'à
**trois endroits** dans tout le produit, et **le client de l'artisan ne le voit
nulle part** — ni la page publique d'un devis, ni celle d'une facture, ni leurs
PDF ne portent de marque (vérifié fichier par fichier). Renommer ne demande donc
de prévenir personne. Le seul coût qui grandit avec le temps est celui des CGU :
nul aujourd'hui, puisque personne n'a encore accepté la `canevas-1`.

Les largeurs sont **mesurées à l'écran**, pas estimées : ATLAS et GUNZI font
97 px, GUNZY 105, GOONZI 118. Cinq lettres ne veut pas dire la même largeur.
### ~~0 octovicies (d'origine). Mon compte et Connexion : dessinés, avec DEUX QUESTIONS~~


*`maquettes/atlas-reglages-moi.html`, le 14 août 2026 — quatre écrans, 53
contrôles. **Les onze autres rubriques du sommaire ont leur planche ; c'étaient
les deux dernières.***

**Ce qui se code dès son accord, sans rien décider :**

| Écran | Ce qu'il porte | Ce qu'il faut |
|---|---|---|
| **Mon compte** | Nom, e-mail, initiales | Rien à créer : `users.nom` et `users.email` existent |
| **Connexion** | Changer son mot de passe | Rien à créer : `users.password_hash` existe, haché |

**Ce qu'il a tranché le 14 août 2026, et qui n'est plus discutable :** *« il faut
pouvoir confirmer son mdp 2× avant de le changer et met le petit œil à côté pour
afficher ou non le mdp »*. Ma première planche proposait l'œil **à la place** de
la seconde saisie ; il veut **les deux**, et il a raison : l'œil se touche après
coup, la confirmation attrape la faute au moment où elle se fait.

L'œil est sur **les trois champs** — une confirmation qu'on ne peut pas relire ne
confirme rien. Il est **gris**, et bronze une fois ouvert : un pictogramme plein
au bord d'un champ se lirait comme un bouton d'envoi, et le seul plein de
l'écran doit rester « Changer mon mot de passe ».

**Et DEUX QUESTIONS, parce que le sommaire promet ce qui n'existe pas :**

| | La promesse | Le fait | Les deux réponses |
|---|---|---|---|
| **1** | « Nom, e-mail et **téléphone** » | `users` n'a pas de colonne téléphone, et rien n'appellerait ce numéro : ni SMS ni e-mail sortant (tranché le 4 août) | **A** retirer le mot du libellé · **B** créer la colonne |
| **2** | « Mot de passe et **appareils** » | `src/auth.ts` pose `session: {strategy: "jwt"}` — **aucune session n'est en base**, il n'y a rien à lister | **A** juste « me déconnecter partout » (une colonne) · **B** la vraie liste (une table, 2-3 jours) |

**Ne pas dessiner d'appareils en attendant.** Une liste plausible — « iPhone ·
il y a 2 h » — se valide en dix secondes et le défaut n'apparaît qu'au moment de
coder. Le contrôle de la planche l'interdit explicitement, et il sait rougir.

### 0 novemvicies quinquies. ~~« Le nombre de jour en doré »~~ — **CODÉ le 15 août 2026**

**Sa réponse finale : « je veux journée et toute la ligne. Tu peux coder. »**
La ligne du planning porte désormais la date, le moment de départ et la durée,
toute en or — `ARCHITECTURE.md` §111. Ce qui suit reste écrit parce que le
chemin importe : la question qu'il a posée n'avait pas la réponse qu'elle
supposait, et c'est la fouille de l'historique qui l'a montré.

**Ce qui reste ouvert, et lui seul le tranchera à l'usage :** la ligne ne dit
plus quand un chantier long **finit**. « du 21 au 25 août » a été remplacé par
« matin · 3 jours », et les week-ends sautés interdisent de recalculer la fin de
tête. Sa place, si elle lui manque, est la **feuille du chevron** — qui a la
largeur que la ligne n'a pas. Ne pas la remettre sur la ligne sans le lui
demander : elle en avait été retirée pour faire tenir le nombre de jours.

*Le patron, le 15 août 2026, capture du planning à l'appui : « Avant il y avait
le Nombre de jour en doré et je sais plus quoi, où c'est passé ? »*

**L'historique a été fouillé, toutes branches, avant de lui répondre.** Aucun
nombre de jours n'a jamais été écrit **en or** dans `src/`. Trois choses en
approchent, et ne pas les confondre fait gagner l'aller-retour :

| Ce qui a existé | Où | Quand c'est parti |
|---|---|---|
| « matin, 2 jours » — **en gris** (`creneauLisible`) | la ligne du planning | `064d413`, 10 août |
| « Créer la facture » — **en or**, mais ce n'est pas un nombre | la même ligne | `026e7ba`, 12 août, vers `FeuilleYAller` |
| « occupe : vendredi 21, lundi 24, mardi 25 » — **un nombre de jours en or** | `docs/maquettes/51`, envoyée le 14 août | jamais codé ; le pied de la planche le disait |

**La troisième est la plus probable** : il a manipulé cette planche la veille, et
une maquette dorée se confond avec l'application.

Ce qui est en or à cet endroit de l'écran, et qui l'est toujours : le chiffre du
jour dans le calendrier — aujourd'hui, et le jour ouvert —, les pastilles sous
les quantièmes, le chevron de la ligne, « À poser », et le pointillé
d'« Équipe ? » quand elle manque. **La date tombée le 15 août, elle, était
grise** (`colors.muted`). Et `#c2a05f` / `#8f7130` n'ont jamais existé dans
`src/` : ce sont les bronzes des vieilles maquettes « Origine ».

**Trois lots ont touché cette ligne en deux jours**, ce qui explique qu'il ne
s'y retrouve plus, et il faut les lui rappeler avant de conclure quoi que ce
soit : la date est tombée (maquette 53), « Déplacer » a quitté la ligne pour la
feuille du chevron (maquette 52), la pastille d'équipe est arrivée à sa place.

**Rien n'est codé, et ce n'est pas un oubli** (`CLAUDE.md` §3 bis) :
`docs/maquettes/58-le-nombre-de-jours-en-or.html` lui a montré **quatre
écritures de la même ligne** — A telle qu'elle est, B la date qui revient, C la
durée en or, D les deux en or.

**IL A CHOISI LA D, ET IL L'A AUGMENTÉE** — sa réponse du 15 août : *« je veux
le 54 la D mais il doit y avoir le nombre de jour, le matin, l'après-midi et la
journée comme infos possible »*. La ligne portera donc **trois** choses : la
date, le moment de départ, le nombre de jours.
`docs/maquettes/59-la-ligne-qui-dit-tout.html` les montre sur les **cinq** cas
du produit, et pose les **deux dernières questions** :

| | La question | Les deux réponses |
|---|---|---|
| **1** | le chantier d'une journée pleine | **A** « 14 août · journée » · **B** « 14 août · matin · 1 journée » (le départ, puis la durée — comme les quatre autres lignes) |
| **2** | ce qui est en or | **A** toute la phrase · **B** le seul nombre de jours |

**ET LE VOCABULAIRE NE S'INVENTE PAS : « journée », jamais « jour ».** La liste
`DUREES` (`src/lib/durees-chantier.ts`) dit « ½ journée », « 1 journée », puis
« 3 jours » — **et le dit depuis le 4 août 2026, sur une correction du patron,
capture à l'appui**. La première planche a quand même écrit « ½ jour », et il a
dû reprendre la même chose une seconde fois : *« 1/2 journée pas jour ! »*.

Le contrôle **lit désormais `DUREES` dans le dépôt** et refuse tout libellé qui
n'en vient pas — il ne recopie pas la liste, qui dériverait. Absent le fichier,
il le dit et **échoue** plutôt que de verdir en silence. Une règle déjà écrite et
enfreinte deux fois n'est pas une règle : c'est un contrôle qui manque.

**ET UN INVARIANT À NE PAS PERDRE EN CODANT.** « matin » ne doit **jamais** être
écrit sans son nombre de jours : seul, il redit exactement ce qu'il a signalé le
13 août — *« ça laisse à penser que juste le matin est bloqué alors que c'est la
journée »*. C'est le nombre accolé qui le rend honnête. Le contrôle de la
planche le garde déjà, et **la suite du code devra le garder aussi** : ce n'est
pas une préférence d'écriture, c'est la réparation d'un défaut qu'il a trouvé.

**Ne pas deviner à sa place, et ne pas coder les quatre « pour qu'il essaie ».**
C'est exactement ce qui a été refusé le 11 août.

Le contrôle de la planche existe et **a été vu rouge trois fois** avant d'être
livré (`scripts/verifier-maquette-nombre-de-jours.mjs`) : or retiré, bascule
morte, nom trop long — chacun nomme le bon coupable.

### 0 octovicies bis. ~~L'écran du catalogue~~ — CODÉ le 17 août 2026

*Deux captures, trois jours d'écart, la même question : « À quoi sert cette page
?? On peut rien modifier rajouter ». Il a choisi **« Réparer + mes mots »**, puis
l'arrangement **B** de `docs/maquettes/72-mes-mots-au-catalogue.html`. Livré le
jour même : `ARCHITECTURE.md` §122, migration 0052.*

**Ce qui est fait :** ses mots s'accrochent aux entrées d'Atlas (`mots_catalogue`,
isolée par RLS — le catalogue partagé n'est pas touché) ; il crée ses propres
entrées ; il retire ses mots ; la flèche de retour existe ; la phrase morte
« Aucun prix encore constaté » est retirée ; « Synonymes »/« Variantes »
deviennent « Aussi appelé » ; l'écran est passé à la charte.

**CE QUI RESTE, et c'est une DÉCISION, pas du code :**

1. **Faut-il remettre un prix sur ces cartes ?** La question est posée au bas de
   la planche 72 et n'a pas de réponse. `lecons_prix` range par nature de
   chantier (`abattage|demontage_retention|d70`), pas par mot de catalogue : un
   rapprochement approximatif afficherait un prix d'abattage sous « Élagage » —
   pire que la phrase retirée, qui au moins n'inventait rien. Deux réponses
   possibles : rien du tout (l'état actuel), ou la ligne **uniquement** quand la
   nature correspond exactement.
2. ~~**Le catalogue doit-il s'auto-alimenter ?**~~ — **FAIT le 17 août.** Atlas
   propose de retenir un mot entendu **quand il sait à quoi il se rapporte** —
   sa condition, mot pour mot. Deux boutons sur l'écran du catalogue ; le « non »
   est retenu pour toujours (migration 0053), et écrire le mot à la main le
   relève. Le vocabulaire commun, lui, n'est jamais touché (`ARCHITECTURE.md`
   §123).

### 0 quinvicies bis. Faire ARRIVER les conditions jusqu'au devis

**⚠ IL L'A VU LUI-MÊME, le 16 août 2026** — et c'est la troisième fois qu'un
défaut de ce dépôt se trouve en regardant l'écran plutôt qu'en lisant un
contrôle : *« dans les réglages, lorsqu'on coche le bouton on/off pour les
formalités de devis, rien n'apparaît sur le devis, c'est normal ? »*

**Non. Et l'écran lui PROMET le contraire** : le bloc « Ce que votre devis dira »
liste les conditions choisies, ligne à ligne. C'est un aperçu de quelque chose
qui n'arrive jamais. Un écran qui décrit un document qu'il ne produit pas est
pire qu'un écran muet — il fait envoyer un devis en croyant qu'il porte un
acompte.

**Ce qui monte au devis, mesuré et non supposé :** la validité, et elle seule
(`snapshotEnTete` dans `devis.ts`, puis `devis-pdf.ts`). Les cinq autres
n'apparaissent nulle part — ni à l'écran, ni au PDF.

**Il a dit « Oui répare » le 16 août.** La planche est posée :
`docs/maquettes/60-les-conditions-sur-le-devis.html`, éprouvée par
`scripts/verifier-maquette-conditions-devis.mjs`. **Rien n'est codé tant qu'il
n'a pas désigné son arrangement** (`CLAUDE.md` §3 bis) — ce n'est pas une
précaution de style : le bloc « Notes / conditions » est un champ LIBRE qu'il a
peut-être rempli à la main, et son texte d'invite propose justement « Acompte de
30 % à la signature ». Se tromper d'arrangement, c'est soit effacer sa saisie,
soit écrire l'acompte deux fois sur un devis qui part chez un client.

| | Ce que ça fait | Ce que ça coûte |
|---|---|---|
| **A** | les conditions **remplacent** le bloc de notes | son texte écrit à la main **disparaît** |
| **B** | son texte en tête, les conditions dessous, séparées d'un filet | un acompte tapé à la main apparaîtra **deux fois** |
| **C** | deux blocs : « Notes » et « Conditions » | un bloc de plus, le devis s'allonge ; même doublon qu'en B |

**Une question posée dans la planche, sans réponse et qui ne bloque pas :** les
conditions doivent-elles aussi descendre sur la **facture** ? Aujourd'hui elle
ne porte que ses mentions légales obligatoires.


`ARCHITECTURE.md` §102 : la rubrique « Devis & factures » règle six conditions,
mais **seule la validité s'imprime**. L'acompte, le délai de paiement, les
moyens de paiement, le rappel des pénalités et le texte de pied sont
enregistrés et montrés en aperçu — ils n'atteignent pas encore le document.

**Ce qu'il faut faire, et l'ordre compte :** les figer dans le devis comme la
validité (`devis.validite_jours`), PUIS les composer dans le bloc « NOTES /
CONDITIONS ». Les lire au moment de composer le PDF réécrirait les conditions
d'un devis déjà parti.

**Le piège à ne pas rouvrir :** `devis.conditions_paiement` porte déjà un texte
que le patron peut écrire à la main. Le remplacer d'office effacerait sa saisie ;
les deux doivent cohabiter.


- **Le champ de prix d'une grille fait 14 px, et iOS agrandit alors la page.**
  Relevé le 14 août 2026 en regardant l'écran « Mes prix » sur un iPhone 13 : le
  champ du montant (`Champ`, `GrillesPrixClient`) est le seul de l'application
  sous les 16 px. Le passer à 16 élargit la colonne — donc ça touche l'allure
  d'un écran qu'il n'a pas demandé de changer, et ça se dessine avant
  (`CLAUDE.md` §3 bis).

### 0 quatervicies novies. NE PAS recoder le blocage de l'envoi sans SIRET

Décidé par le patron le matin du 14 août 2026, codé, montré — puis **retiré le
même jour à sa demande** : *« rien de plus, rien de moins »* (`ARCHITECTURE.md`
§97). Les réglages alimentent le devis ; ils ne commandent pas l'écran d'envoi.

**Cette ligne existe pour empêcher qu'on le refasse.** Un devis part aujourd'hui
sans SIRET si le patron n'en a pas saisi, et rien ne l'en avertit : ce n'est pas
un oubli, c'est un risque qu'il assume, l'argument lui ayant été donné.

### 0 quatervicies octies. ~~CODER le sommaire des réglages~~ — fait le 2026-08-14

Le sommaire est en place (`ARCHITECTURE.md` §96), en filets et dans la charte,
et tout ce qui s'empilait sur l'écran est parti dans sa rubrique.

**Ce qui reste sous « Bientôt », et qui est du vrai travail** — six rubriques :
mon compte, notifications, connexion, apparence, l'équipe au sens des COMPTES
(§88), et « Devis & factures » (les conditions, la numérotation et les mentions
sont encore écrites en dur, §91). Elles se voient à l'écran, marquées, et ne
mentent pas.

**Et le cloisonnement n'est posé QUE là.** Les réglages refusent un membre ;
les chantiers, les devis et les factures lui montrent encore tous les montants.
Ne pas lire la §96 comme si le sujet était clos.

### 0 tricies septies. ~~La page qui rassemble les maquettes a décroché~~ — **contrôlé depuis le 15 août 2026**

**C'était plus grave que ce qui était écrit ici.** L'entrée disait « les 41, 42
et 43 n'y sont pas » et concluait « sans conséquence pour le patron : les
planches s'ouvrent une par une, et c'est ainsi qu'elles lui sont envoyées ».

En mesurant plutôt qu'en supposant, **six maquettes** — 38, 39, 41, 42, 43 et
46 — n'étaient inscrites **ni dans la page unique, ni au sommaire**. Ce n'était
donc pas la comparaison qui se perdait : c'était le seul chemin qui y menait.
Elles n'existaient que pour qui connaissait leur nom de fichier.

**Ce qui l'a laissé passer :** le compte affiché. « 36 maquettes fusionnées »
reste parfaitement plausible quand il en manque six.

**Le contrôle vit maintenant dans `fusionner-maquettes.mjs`**, joué à chaque
régénération, et il refuse trois états :

- une maquette sur le disque **qu'aucune des deux portes n'atteint** — l'exigence
  porte sur leur réunion, pas sur chacune : la page unique est une *sélection*
  (elle laisse dehors les planches qui se manipulent), le sommaire est le
  *catalogue* ;
- un **lien mort** dans le sommaire — le défaut d'origine de ce dossier, trouvé
  par le patron en cliquant ;
- un **numéro porté deux fois**. Il les désigne par leur chiffre — « fais la
  34 » — et cinq numéros l'étaient déjà (33, 34, 35, 36, 37). Ces cinq-là sont
  tolérés **nommément** : les renuméroter casserait les renvois déjà écrits.
  **Le 50 aussi, et volontairement** : Gunzi, Goonzi et Gunzy sont la même
  planche sous trois noms, et les séparer les rendrait incomparables. Tout
  nouveau doublon rougit.

Éprouvé en le confrontant aux trois états : une maquette orpheline, un doublon
de numéro, un `href` vers un fichier absent. Il les nomme un par un.

**Et il a servi deux fois dans l'heure qui a suivi.** En fusionnant `main`, il a
nommé deux planches de plus tombées dans le même trou — `47-ou-mettre-l-assistant`
et `53-le-mot-juste-sans-la-date` — inscrites au sommaire dans la foulée. C'est
lui, aussi, qui a fait renommer cette planche-ci **deux fois** : le 46 était pris
par `46-pendant-que-ca-batit`, puis le 47 par `47-ou-mettre-l-assistant`. Elle
porte le **56**.

**Avant d'écrire une nouvelle planche, jouer `node scripts/fusionner-maquettes.mjs`**
: il donne le prochain numéro libre en refusant le doublon, plutôt que de le
laisser découvrir à la fusion suivante.

### 0 tricies sexies. ~~Un conflit non refermé était arrivé sur `main`~~ — **contrôlé depuis le 13 août 2026**

**Constaté en refusionnant :** `ARCHITECTURE.md` portait **trois marqueurs de
conflit** sur `main` — une session avait poussé une fusion sans la refermer.

**Pourquoi personne ne l'a vu, et c'est le cœur du sujet.** Ni les types, ni le
lint, ni les suites ne lisent les fichiers de mémoire, et la documentation se
consulte surtout par recherche : on tombe sur le passage qu'on cherche, pas sur
les marqueurs vingt lignes plus haut. Le fichier avait l'air complet — il portait
même **les deux versions** du passage, sans que rien ne dise laquelle fait foi.
C'est le pire état pour une mémoire : plus trompeur qu'une section absente.

**`verifier:memoire` les refuse désormais**, et nomme le fichier, le marqueur et
sa ligne. Éprouvé en réintroduisant l'état exact qui était passé.

**Deux sessions l'ont écrit le même jour, sans se voir** — c'est le sujet de
`CLAUDE.md` §6 en action. Celui qui est resté est **celui qui était déjà sur
`main`** : il gère en plus un faux positif que l'autre ignorait (`=======` seul
est un soulignement Markdown parfaitement légitime, et ne compte que s'il
accompagne un vrai marqueur). Le second a été retiré plutôt qu'empilé : deux
contrôles pour la même chose finissent par diverger, et l'on ne sait plus lequel
fait foi.

Le doublon de section qu'il avait entraîné est défait au passage : deux `## 81`
coexistaient (la civilité, l'en-tête du SMS). La première garde son numéro,
la seconde devient `## 82` — aucun renvoi ne la visait, vérifié avant de renommer.

### 0 sexvicies. Faire confirmer par le patron que le numéro n'est plus un lien d'appel

**Livré le 13 août 2026, non éprouvé ici, et ça ne peut pas l'être.** Le numéro
du devis et celui de la facture s'écrivent désormais de façon qu'un détecteur
d'Apple n'y voie plus un téléphone (`ARCHITECTURE.md` §81). Cet environnement
n'a que Chromium, qui n'a jamais fait cette détection : les suites vérifient que
le texte aplati ne contient plus de suite de chiffres appelable, pas ce
qu'iOS en fera.

**Ce qu'il faut lui demander**, une fois le lot sur `main` : rouvrir le lien de
son devis **depuis ses SMS** — pas depuis Safari, le chemin compte — et dire si
« Hydration failed » revient, et si le numéro reste un texte ordinaire sous le
doigt. Sans cette réponse, ce défaut n'est pas clos : c'est la deuxième
tentative sur le même, et la première paraissait juste elle aussi.

### 0 quatervicies. Les réglages : les dix rubriques sont dessinées, rien n'est codé

**Le plan est dessiné et attend son accord** — `maquettes/atlas-reglages-plan.html`
(`ARCHITECTURE.md` §86). Les deux niveaux, les quatre rôles et la forme de
l'interrupteur y sont tranchés ; **aucune rubrique n'y est ouverte**.

Ordre convenu, qui suit ses quatre priorités du 13 août 2026 :

| Lot | Rubrique | Ce qu'elle porte | État |
|---|---|---|---|
| 1 | **Le plan** | Deux niveaux, trois rôles, l'interrupteur | **dessiné le 13 août — attend son accord** |
| 2 | Identité de l'entreprise | Nom, adresse, SIRET/SIREN, TVA, IBAN | **dessiné le 13 août** (`ARCHITECTURE.md` §87) |
| 3 | Équipe et rôles | Qui a accès, et à quoi | **dessiné et validé le 13 août** (`ARCHITECTURE.md` §88) |
| 4 | Tarifs & catalogue | Prestations, main-d'œuvre, matériel | **dessiné le 13 août** (`ARCHITECTURE.md` §89) |
| 5 | Documents | Conditions, acompte, logo, texte de bas de page | **dessiné le 13 août** (`ARCHITECTURE.md` §91) |
| 6 | Notifications | Huit familles d'alertes, canal par canal | **dessiné le 13 août** (`ARCHITECTURE.md` §92) — **rien n'est envoyé aujourd'hui** |
| 7 | Le reste | Atlas IA, intégrations, apparence, abonnement, sécurité | **dessiné le 13 août** (`ARCHITECTURE.md` §93) |

**La charte, depuis le 13 août :** *« toujours en respectant le style de l'appli
ultra luxe et très moderne »*. `atlas-reglages-plan.html` recopie les jetons de
`src/lib/design-tokens.ts`, et son contrôle lit le fichier de jetons pour les
comparer — un écart rougit en nommant le jeton. **Les neuf planches antérieures
gardent l'ancien nuancier** (crème `#edece6`, bronze `#8f7130`) : les reprendre
d'un coup mêlerait un changement d'identité à un changement mécanique sur des
écrans déjà validés. Elles passent à la charte **quand leur sujet est rouvert**,
pas avant (`ARCHITECTURE.md` §86).

**LE PREMIER JOUR D'UN ARTISAN — le point le plus lourd de la série.** Sa
remarque du 13 août 2026 : *« quand l'application sera commercialisée, le devis
sera vierge, et c'est avec ces informations-là qu'il devra se remplir
automatiquement ».* Six faits vérifiés, qui s'enchaînent (`ARCHITECTURE.md`
§81) :

| | Ce qui est constaté | Ce qu'il faut écrire |
|---|---|---|
| 1 | `seed.ts` pose « Atelier Démo » **complet, IBAN compris** — son banc ne montre jamais l'état vierge | un jeu de départ qui sache démarrer à vide |
| 2 | **Aucun parcours d'inscription** : `creerEntreprise` n'est appelé que par le seed et les tests | la création d'entreprise, depuis l'application |
| 3 | ~~L'identité ne s'écrit que depuis le devis à la main~~ — **fait le 13 août 2026** : `/reglages/identite` | ~~les champs d'identité dans les réglages~~ |
| 4 | **Rien ne vérifie l'identité avant l'envoi** d'un devis | un garde-fou à l'envoi, pas à la rédaction |
| 5 | `src/app/chantiers/[id]/export/page.tsx` écrit `entrepriseNom ?? "Votre entreprise"` | un manque se signale, il ne se maquille pas |
| 6 | Le devis **fige** l'identité à sa création (`devis.ts`) — c'est juste, mais muet | l'avertissement : corriger vaut pour les **prochains** devis |

**Tant que 2, 3 et 4 ne sont pas faits, Atlas ne peut pas être confié à un
artisan** : son premier document partirait irrégulier, sans un mot.

**Trois manques révélés en dessinant le lot 2, et qui sont du CODE, pas du
dessin** (`ARCHITECTURE.md` §81) :

- ~~le régime de TVA est deviné~~ — **fait le 13 août 2026** (migration 0039,
  `ARCHITECTURE.md` §94) : il se déclare, il est figé dans la facture, et le
  repli sur le taux demeure pour les factures antérieures ;
- **le numéro de TVA intracommunautaire** existe en base et se saisit depuis le
  13 août — **mais rien ne l'imprime encore**. *Réserve : les mentions
  obligatoires n'ont pas pu être vérifiées à leur source d'ici. À faire
  confirmer avant de le poser sur le document ;*
- **le téléphone et l'e-mail ne s'impriment nulle part** : le bloc ÉMETTEUR de
  `document-commun.ts` porte le nom, l'adresse et le SIRET, rien d'autre. Le
  client n'a aucun moyen d'appeler l'artisan depuis son devis.

Manquent aussi en base, et la maquette les montre : **forme juridique** et
**titulaire du compte**.

**LE DEUXIÈME CERVEAU : CE QUI NE RETIENT RIEN.** Direction posée le 13 août
2026 (`ARCHITECTURE.md` §90, `docs/QUESTIONS.md` §17). Ce qui apprend déjà est
bien alimenté — `lecons_prix`, les cinq grilles, la base documentaire. Ce qui
manque, par ordre de poids :

| | Ce qui n'est pas retenu | Le moment qui existe déjà pour le demander |
|---|---|---|
| 1 | **Le temps réel d'un chantier** — aucune colonne nulle part. Atlas ignore donc si ses estimations de durée sont justes, alors que **c'est la durée qui fait le prix** quand aucun tarif ne correspond | la clôture d'un chantier (`src/app/termines/`) |
| 2 | Les coûts de chiffrage, figés aux valeurs d'usine | l'écran « Mes coûts », dessiné mais pas codé |
| 3 | Les délais de paiement réels | l'encaissement d'une facture |
| 4 | Ce qu'un client refuse ou fait corriger | l'état existe déjà (`src/lib/etat-envoi.ts`) |

**La règle avant de coder l'un d'eux :** ne pas demander « quelle table ? » mais
**« qui l'écrit, et à quel moment ? »**. `historique_prix` était lue et jamais
écrite — une mémoire que personne n'alimente est du décor.

**LE RÉGLAGE QUI AGIT SANS EXISTER À L'ÉCRAN**, trouvé le 13 août en répondant
à sa question sur l'IA : `parametres_chiffrage` porte **cinq valeurs par
entreprise** — 200 €/jour l'ouvrier, 280 € le chef, 35 € le déplacement, 20 % de
marge, 20 % de TVA — et **aucun écran ne permet de les changer**. Elles décident
du prix proposé dès qu'aucun tarif ne correspond. Un artisan dont l'ouvrier coûte
260 € verra des prix trop bas sans savoir pourquoi (`ARCHITECTURE.md` §89).

**Ce que le lot 4 ajoute à cette liste :** `tarifs` n'a **aucune colonne de
famille** — prestations, main-d'œuvre et matériel n'existent pas —, et rien ne
signale un tarif **sans unité**, alors qu'un prix sans unité n'est pas un prix.
(Les tranches des grilles, elles, se règlent depuis le 14 août —
`ARCHITECTURE.md` §105.)
(L'unité, elle, se **choisit** depuis le 14 août au lieu de se taper —
`ARCHITECTURE.md` §101 — mais rien ne signale encore celle qui manque.)
Les cinq grilles n'affichent pas **combien de prix elles ont appris**, ni la
phrase qui dit qu'une grille vide n'est pas une panne (`ARCHITECTURE.md` §89).

**Ce qui n'est PAS acquis, et ne doit pas être codé sur la foi de la maquette :**

- **le rôle « commercial » n'existe nulle part.** `membres_entreprise.role` ne
  connaît que `proprietaire` et `membre` ; `docs/QUESTIONS.md` §10 décrit
  l'éditeur, le patron et le salarié. L'ajouter suppose une migration **et**
  une décision, pas seulement un écran ;
- **le cloisonnement par rôle est aujourd'hui inexistant** côté serveur, et le
  lot 3 l'a mesuré : `exigerProprietaire` protège **vingt-trois points
  d'écriture**, mais `getRole` n'est appelé dans **aucun écran** — rien ne filtre
  la LECTURE. Un « membre » voit tous les prix, tous les devis, tous les
  montants. `QUESTIONS.md` §10 exige que la donnée ne SORTE pas du serveur :
  c'est le vrai coût de ce lot, et il est dans les dépôts, pas dans l'affichage ;
- **aucun parcours d'invitation n'existe** : `membres-entreprise.ts` sait
  ajouter et retirer un membre, aucun écran ne l'appelle, et rien n'envoie
  d'invitation. Un patron ne peut donner aucun accès aujourd'hui ;
- ~~la question du 7 août sur la portée du salarié~~ — **tranchée le 13 août
  2026** : accès à tout par défaut, et le patron restreint **personne par
  personne** à ses seuls chantiers. Le rôle « commercial » est validé tel que
  dessiné. Il faut donc une colonne de portée sur `membres_entreprise`, en plus
  du quatrième rôle (`docs/QUESTIONS.md` §10) ;
- **le logo sur le devis n'existe pas** : `document-commun.ts` ne pose aucune
  image. `pdf-lib` sait incorporer un PNG — c'est un lot court. ~~À dire au
  patron avant de dessiner le lot 5~~ : **dit et dessiné le 13 août**, et
  « remplacer le devis par le sien » est **refusé avec sa raison** à l'écran
  (`ARCHITECTURE.md` §91) ;
- **les conditions sont aujourd'hui en dur** : « 30 jours » dans
  `devis-pdf.ts`, la mention légale dans `facture-pdf.ts`, et un seul champ
  libre `conditionsPaiement`. Les rendre réglables demande une table, pas un
  champ de plus.

---

### 0 unvicies. Le chevron de retour, dernier bouton hors charte

### 0 tricies. ~~Les trois points de la dictée~~ — **CODÉ le 13 août 2026 (proposition C)**

**Sa demande du 13 août 2026**, capture de l'écran « Un chantier » à l'appui :
*« une fois qu'on a appuyé sur le dictaphone, on ne sait pas ce qui se passe.
Les trois petits points sont fixes […] on ne sait pas si ça bug ou non. Si les
trois petits points se mettent en mouvement et font des vagues pour dire que
c'est en train de rédiger, là, on sait qu'il se passe quelque chose. »*

**Ce n'est pas une animation qui s'est arrêtée.** C'est le caractère « … », un
seul glyphe posé tel quel — `DicterCoordonnees.tsx:114`. Il n'y a rien qui
puisse bouger : trois points séparés sont à écrire pour qu'une vague existe.

**Deux choses aggravent l'attente**, qu'il n'a pas nommées mais qui tiennent au
même instant, et qui comptent peut-être plus que la vague :

1. le bouton passe à `opacity: 0.5` — le vocabulaire d'un bouton **éteint**,
   pas d'un bouton qui travaille ;
2. **aucune phrase ne s'affiche.** L'écran parle quand il écoute (« J'écoute —
   touchez pour arrêter. ») et quand il a fini (« 1 information reprise… »), et
   il se tait exactement pendant le seul moment où l'on se demande s'il est en
   panne. Les mots disent ce qu'aucune animation ne dira.

**Deux planches, et c'est la seconde qui tranche :**

| | Fichier | Ce qu'elle sert |
|---|---|---|
| 42 | `docs/maquettes/42-les-trois-points-qui-attendent.html` | Les cinq gestes côte à côte, et l'exposé du défaut. Doublée d'images animées (`docs/maquettes/images/`), pour la conversation |
| **43** | `docs/maquettes/43-l-attente-a-lessai.html` | **Celle qu'il manipule** — il appuie sur le micro, arrête, les points bougent. Sa demande du 13 août : *« juste des points que je puisse cliquer dessus […] pour voir comment ça rend »*. Engendrée par `scripts/engendrer-maquette-sequence.mjs` |

Les cinq attentes : A la vague (4 px), B la vague ample (7 px), **C le souffle**,
D le point qui court, E l'anneau qui tourne. **Il a répondu « code la C »** le
13 août — les quatre autres restent dans les planches, à reprendre de là si le
sujet se rouvre plutôt qu'à redessiner.

**Ce qui a été porté dans l'application :**

| | Fait | Où |
|---|---|---|
| 1 | Le geste, partagé | `src/components/atlas/PointsQuiSoufflent.tsx` |
| 2 | Les mesures (0,72 → 1,5 ; 1,25 s ; décalages 0,16 et 0,32) | `globals.css`, `.atlas-souffle` |
| 3 | L'écran | `src/app/chantiers/nouveau/DicterCoordonnees.tsx` |
| 4 | La suite qui le tient | `scripts/test-attente-dictee-e2e.ts` |

**Quatre choses à ne pas défaire**, chacune payée par un vrai défaut :

1. **Le geste vit dans un composant, pas dans l'écran.** Une attente recopiée
   divergerait comme les boutons peints à la main l'ont fait deux fois
   (`ARCHITECTURE.md` §66 et §73).
2. **Le bouton ne redevient PAS à demi effacé.** C'était la moitié du défaut :
   le vocabulaire d'un bouton éteint. Il reste hors d'atteinte (`disabled`) —
   ne pas le rendre pressable, un second appui lancerait une seconde dictée.
3. **La phrase reste.** C'est la seule des trois moitiés qui parvienne à qui n'a
   pas les yeux sur l'écran (`role="status"`), et probablement la plus utile.
4. **Sous « mouvement réduit », les points respirent encore.** Tout couper
   rendrait le défaut d'origine à qui a activé ce réglage.

**La suite RALENTIT le serveur de trois secondes**, sinon elle courrait plus vite
que l'attente et passerait au vert sans avoir rien regardé. Elle a été confrontée
au défaut d'origine : les quatre points rougissent, chacun **en nommant son
coupable** — et c'est le second jet, le premier sortait un « Timeout » sur un
sélecteur, ce qui envoie lire le contrôle au lieu de l'écran.

### 0 tricies ter. ~~La même attente immobile sur le bouton d'ajout de photo~~ — **fait le 13 août 2026**

Signalé en passant, puis tranché par lui le jour même : *« oui souffle aussi pour
la photo »*. `Pellicule.tsx` portait le même caractère « … » immobile que la
dictée, à la lettre près — donc le même défaut. Il prend le même composant, et
les points y sont **or** et non vert : ils héritent de `currentColor`, donc de la
couleur du bouton qui les porte. Le libellé annonce l'envoi pendant l'envoi, au
lieu de continuer à proposer d'ajouter.

**Un piège d'outillage payé ici, et qui resservira à toute suite qui RALENTIT le
serveur :** router une adresse dans Playwright **désactive le cache HTTP de toute
la page**, pas seulement des requêtes visées. La visionneuse repartait donc du
réseau pour une image déjà affichée, son `<img>` n'avait pas fini de charger, sa
boîte faisait zéro pixel — et l'échec accusait la visionneuse, qui n'y était pour
rien. Deux règles en sortent :

1. **relâcher la route dès la mesure faite** (`page.unroute`) ;
2. **la relâcher APRÈS que l'envoi soit terminé** — la couper en vol laisse un
   appel à moitié traité, et Playwright répond « Route is already handled! », une
   erreur qui n'apprend rien sur ce qu'on éprouve.

Trouvé en **affichant les images présentes** plutôt qu'en supposant : elles
étaient là, toutes les deux, au bon endroit.

**Trois choses à savoir avant d'y toucher :**

1. **Une image fixe ne peut pas montrer un mouvement.**
   `scripts/animer-maquette-points.mjs` fabrique un GIF par proposition, sans
   ffmpeg (absent d'ici) — et il relit ce qu'il vient d'écrire, parce qu'au
   premier jet il annonçait « ✓ » sur une image FIXE : `pageHeight` passé à côté
   de `raw` au lieu de dedans est ignoré **en silence**. Un script qui ne relit
   pas sa sortie certifie exactement le défaut qu'il répare.
2. **Le contrôle mesure une VAGUE, pas un mouvement.**
   `scripts/verifier-maquette-points.mjs` exige un déphasage entre le premier et
   le troisième point : trois points qui montent **ensemble** bougent de 4 px,
   passeraient tout contrôle d'amplitude, et ne feraient aucune vague. Éprouvé
   en cassant les délais — il rougit en nommant A.
3. **L'avant sert de témoin, dans les trois outils.** Il doit rester immobile
   **et à demi effacé** — le montrer à pleine encre le ferait paraître moins
   mauvais qu'il n'est, et fausserait la comparaison en sa faveur. S'il bouge,
   c'est la mesure qui ment. Le GIF le prouve tout seul : l'encodeur fusionne
   les images identiques, et l'avant se réduit à **une seule**.
4. **La 41 se PARCOURT, elle ne se constate pas.**
   `scripts/verifier-maquette-sequence.mjs` joue les deux appuis puis
   « Recommencer », sur les six. Un parcours à moitié joué ne prouve que la
   moitié qu'on joue. Deux pièges y sont écrits : le bouton d'arrêt **bat**,
   donc Playwright refuse d'appuyer dessus (`{ force: true }`, même famille que
   `locator.screenshot()`) ; et le retour du résultat est **décoché par
   défaut**, sans quoi on jugerait cinq gestes sur quatre secondes chacun.

### 0 tricies quater. ~~L'attente qui s'éternise~~ — **faite le 13 août 2026**

Sa réponse à la question laissée ouverte : *« oui fait ça »*. Une vague qui
souffle depuis trente secondes redevient une vague qui ne dit rien.

**Trois temps**, dans `src/lib/attente-longue.ts` — fonction pure, éprouvée sans
navigateur :

| | Ce que l'écran dit | Pourquoi ce moment-là |
|---|---|---|
| 0 s | « Atlas rédige… » | la chaîne prend deux à dix secondes |
| 12 s | « C'est plus long que d'habitude. » | au-delà de la bande normale, sans être soupçonneux |
| 45 s | « Pas de réponse. Réessayez. » + le micro revient | assez long pour qu'une chaîne lente aboutisse |

**Trois choses à ne pas défaire :**

1. **Renoncer n'interrompt PAS l'appel.** S'il répond enfin, les champs vides se
   remplissent. Le couper obligerait à tout redicter alors que la réponse était
   peut-être à une seconde.
2. **Une réponse en retard ne touche l'écran que si elle est encore attendue**
   (`tour` dans `DicterCoordonnees`). Sans ce garde-fou, la première dictée, en
   revenant, remettait l'écran au repos **au milieu du nouvel enregistrement**.
3. **L'étape se calcule sur le temps ÉCOULÉ**, jamais posée en dur : un téléphone
   qui s'endort étire ses minuteries, et le réveil des douze secondes peut tomber
   à la cinquantième — il faut alors rendre la main, pas dire « c'est un peu
   long ».

**LE DÉFAUT À RETENIR, et il ne se voyait qu'à la capture.** La première phrase
des douze secondes faisait cent caractères. Dans la colonne de 190 px, elle
prenait toute la largeur et **cassait « Un chantier » en deux lignes**, en plein
milieu de l'attente. Mesuré ensuite dans la vraie page, sur son écran de 390 px :
31 caractères font 163 px et tiennent sur une ligne, 33 en font 181 et passent à
deux.

Deux contrôles en sont nés, et le second existe parce que le premier a dormi :

- un **plafond de 31 caractères**, sans navigateur, qui rougit à l'écriture de la
  phrase. Posé d'abord à 60, il laissait passer la phrase de l'abandon — *un
  plafond trop généreux est un contrôle qui dort* ;
- le **nombre de lignes du titre**, mesuré à l'écran **dans les deux états**.
  Posé au seul état des douze secondes, il n'a rien vu de l'abandon : un contrôle
  posé à un seul endroit d'un parcours n'éprouve que cet endroit-là.

### 0 tricies quinquies. Le message de fin de dictée casse le titre, lui aussi

**Trouvé le 13 août 2026 en mesurant les phrases d'attente**, et **antérieur à ce
travail** : « 1 information reprise — relisez avant de créer. » fait 47 caractères
et 184 px — donc deux lignes, donc « Un chantier » cassé en deux. À chaque dictée
réussie.

**Non touché, et c'est délibéré** : c'est une phrase que le patron voit depuis
des jours sans s'en plaindre, et la raccourcir change ce qu'elle lui dit. À lui
de trancher. Une piste s'il le veut : « 3 informations reprises — relisez. »
(35 caractères), ou déplacer la ligne sous l'en-tête, où elle aurait toute la
largeur.

### 0 tricies bis. Les contrôles de maquette ne sont joués par personne

`scripts/verifier-maquette-*.mjs` (pastille, logo, bascule, bouton de la facture,
et désormais les points) ne sont appelés **ni par la batterie, ni par la CI** :
ils se lancent à la main. Un contrôle que personne ne joue est un contrôle qui
n'existe pas — il rougira le jour où plus personne ne saura pourquoi.

Non fait d'office : les brancher allonge `verifier:avant-livraison` de plusieurs
minutes pour éprouver des pages qui ne partent pas en production. Le bon endroit
est vraisemblablement la CI, sur les seuls fichiers touchés.

### ~~0 sexvicies. Le chemin vers le devis modifiable~~ — **choisi et codé le 13 août 2026**

**Sa décision, après avoir vu les cinq :** *« le modifier en or à droite du mot
devis est parfait, code celui-là »* — la proposition B. C'est fait,
`ARCHITECTURE.md` §104. Ce qui suit est gardé parce que le raisonnement, lui,
resservira.

**Sa capture du 13 août 2026, 21 h 00 :** *« J'ai un devis sur le feu. En
cliquant sur Mme Félicie, voilà où j'arrive, mais si je veux modifier mon devis
avant de l'envoyer, je peux pas. Fais en sorte qu'en cliquant sur le mot devis
en haut à gauche j'arrive sur la page de mon devis pour la modifier. Crée-moi
des visuels avant de coder, et il faut que ce soit intuitif. »*

**Le manque est réel, et vérifié dans le code.** `ExportClient` n'offre
« Modifier mon devis » que sur `EcranDevisParti`, c'est-à-dire APRÈS l'envoi.
Avant — au moment précis où l'on corrige — aucun chemin ne mène à
`/chantiers/<id>/devis-complet` depuis cet écran.

**Cinq propositions dessinées**, `docs/maquettes/45-modifier-son-devis.html` :

| | Où le geste se pose | Ce qu'elle vaut |
|---|---|---|
| A | Le mot « Devis » devient la porte — **son idée** | Zéro place. Mais un titre qui est secrètement un lien ne s'annonce pas : dessinée avec un crayon et un filet doré, sans quoi personne ne devine |
| B | « Modifier » en face du titre | Se lit sans deviner, place jusque-là vide |
| C | « Modifier » sur la carte des lignes | **On touche ce qu'on veut changer** — c'est là que l'œil est quand un prix cloche |
| D | À côté de « Aperçu du PDF » | Aucune place nouvelle : relire et corriger côte à côte |
| E | La carte des lignes entière, chevron doré | La cible la plus large ; un peu de mobilier en plus |

**Rien n'est codé.** `CLAUDE.md` §3 bis : une demande d'apparence se dessine
avant de se coder. **Il reste à en désigner une.**

**Ce qu'elle coûtera, une fois choisie** : un `<Link>` dans `ExportClient`, sur
la branche d'AVANT l'envoi uniquement — après, le devis ne se modifie plus, il
se *reprend*, et c'est un autre geste (`ARCHITECTURE.md` §66). Plus une suite
qui vérifie que le chemin existe avant l'envoi et **pas** après. Une heure.

### 0 quinvicies. Le chevron de retour, dernier bouton hors charte

<!-- Renuméroté le 13 août 2026 : « 0 unvicies » désignait DÉJÀ le raccordement
     de l'agenda iCloud, plus bas, et `HANDOVER.md` le vise sous ce numéro. Deux
     sessions avaient posé le même. C'est l'aîné qui garde le sien — la règle du
     HANDOVER, « celle qui est déjà là garde son numéro ». Aucun renvoi ne
     visait celui-ci. -->
### 0 quattuorvicies. ~~Le corps de la fiche montre encore un chantier neuf~~ — **CLOS le 13 août : « ne touche pas au centre »**

**Trouvé en corrigeant son défaut du 13 août** (`ARCHITECTURE.md` §98), et
laissé ouvert exprès. L'état dit maintenant « Devis prêt à envoyer » et l'étape
suivante « Envoyer le devis au client » — mais **le centre de l'écran affiche
toujours l'anneau de dictée** et « Appuyez et décrivez le chantier », sur un
chantier dont le devis est écrit.

**Il a tranché le jour même : « non non, mais ne touche pas au centre en fait.
Tu n'as pas compris ma requête ».** Ce qu'il voulait était ailleurs — que la
liste le ramène à l'écran où il s'est arrêté (`ARCHITECTURE.md` §98), et c'est
fait. La maquette `maquettes/atlas-centre-de-la-fiche.html` reste au placard :
elle n'a rien changé dans `src/`, et elle raconte le chemin.

**Ne pas rouvrir ce point sans qu'il le demande.**

Ce qui est déjà su, et qui cadre le dessin : l'étape suivante ne vit que dans le
tiroir, replié par défaut. Un chantier avancé devrait probablement porter son
geste au centre, là où l'anneau se trouve — mais c'est lui qui tranche.

### 0 septvicies. Cinq boutons carrés, hors des écrans du patron — à trancher

**Trouvé le 13 août 2026**, en réparant le contrôle des boutons arrondis : son
motif ne regardait ni les `<Link>`, ni les rayons NOMMÉS de Tailwind. Réparé, il
dénonce **six** boutons. Un seul était celui que le patron signalait (« Créer la
facture »), corrigé le jour même. Les cinq autres n'ont jamais été arbitrés :

- ~~`src/app/devis/[jeton]/formulaire.tsx` — accepter, demander une correction,
  refuser~~ et ~~`src/app/factures/[jeton]/page.tsx` — le téléchargement du
  PDF~~ : **tranché par le patron le 13 août 2026**, capture des deux écrans à
  l'appui. « Oui » : ses clients voient la capsule eux aussi. Les couleurs
  propres à ces écrans restent — c'est l'identité qui devait rester distincte,
  pas la forme du geste ;
- `src/components/ScreenHeader.tsx` — le chevron de retour, 32 × 32 en
  `rounded-md`. **Seul point restant.** Une icône encadrée, pas un bouton
  d'action : l'arrondir entièrement en ferait une pastille ronde, ce qui n'a
  été demandé nulle part. Question posée le 13 août, sans réponse à ce jour.

Ils sont **déclarés comme exceptions nommées** dans
`scripts/test-boutons-arrondis.ts`, chacune avec sa raison : un bouton NEUF écrit
carré ailleurs fait toujours rougir le contrôle.

**Répondu le 13 août 2026 :** la capsule descend jusqu'à son client. Reste le
chevron, sur lequel il ne s'est pas prononcé — et qui n'est pas un bouton
d'action, d'où l'hésitation.


### 0 quinvicies. Deux migrations portent le même numéro — à ranger avant que ça morde

**Constaté le 13 août 2026, en fusionnant.** `drizzle/` contient deux `0035` et
deux `0036` :

```
0035_agenda_apple.sql          0036_achats_tva.sql
0035_periodicite_tva.sql       0036_monsieur_plutot_que_chez.sql
```

Nées de sessions parallèles qui ont pris le numéro suivant chacune de leur côté.

**Ce n'est pas cassé aujourd'hui**, et il faut le dire aussi : le lanceur trie
sur le nom de fichier ENTIER, donc l'ordre est déterministe, et ces quatre-là
touchent des tables différentes. Toutes se sont appliquées.

**Ce qui mordra un jour :** deux migrations de même numéro qui toucheraient la
même table s'appliqueraient dans un ordre décidé par l'alphabet du libellé —
« achats » avant « monsieur » — et non par celui où elles ont été écrites. Une
conversation qui lit `ls drizzle/ | tail -1` pour trouver « la dernière » se
trompera aussi.

**Ce qu'on ne fait pas :** renuméroter. Ces fichiers sont **déjà appliqués**,
ici et peut-être sur son banc ; un fichier renommé serait rejoué de zéro.

**Ce qui reste à faire :** un contrôle qui refuse deux migrations de même
numéro, pour que la prochaine collision se voie à l'écriture et non six mois
plus tard. Une demi-heure. Qui peut le faire : n'importe quelle conversation.

### 0 tervicies. ~~`test-planning-vers-facture-e2e` échoue par intermittence~~ — **CAUSE TROUVÉE ET CORRIGÉE le 13 août 2026**

**Constaté le 13 août 2026, en éprouvant autre chose.** Le dernier cas de cette
suite — *« clôturé AVANT sa date : il quitte le planning pour les terminés »* —
échoue **par intermittence** sur `page.goto` au bout de 45 s, tantôt sur
`/termines`, tantôt sur `/planning`. Sur **six exécutions** ce jour-là : quatre
rouges, deux vertes.

**Et « le serveur est chargé » n'explique plus.** `ouvrir()` fait déjà DEUX
tentatives de 45 s : la page reste donc muette **plus de quatre-vingt-dix
secondes**, alors qu'elle répond en 333 ms mesurées hors batterie. Ce n'est pas
de la lenteur, c'est un blocage. Piste non écartée, faute de l'avoir creusée :
l'épuisement du bassin de connexions (`poolMax`) en fin de batterie — cette
suite bâtit sept chantiers avec devis et PDF, et c'est la plus lourde du lot.

**Ce n'est PAS la civilité** : vérifié en remisant toutes les modifications du
jour et en rejouant la suite sur `main` intact — même échec, au même endroit.
Le défaut lui est antérieur.

**Et son message n'explique pas tout.** Il affirme : *« C'est le serveur de
développement qui n'a pas suivi, pas l'écran : il répond en quelques centaines
de millisecondes hors batterie »*. Or **la suite a aussi échoué jouée seule**,
sans aucune autre en parallèle — la charge de la batterie ne suffit donc pas à
l'expliquer. Un message qui donne une cause certaine là où elle ne l'est pas
envoie chercher au mauvais endroit (`AGENTS.md`).

**LA CAUSE, et elle donne raison à cette fiche sur toute la ligne.** Ce n'était
ni ce cas-là, ni la charge : `run-e2e-tests.ts` recueillait la sortie du serveur
par un **tuyau**, drainé par son propre processus — lequel lance chaque suite
avec `spawnSync`, **qui bloque sa boucle d'événements**. Pendant une suite,
personne ne vidait le tuyau ; à 64 Ko, le serveur se bloquait **en écriture** et
cessait de répondre. Le dépassement tombait alors sur l'écran suivant, au
hasard : `/planning` une fois, `/termines` la fois d'avant.

**C'est exactement pourquoi elle échouait aussi jouée seule** — l'observation de
cette fiche, celle que le message d'origine ne pouvait pas expliquer. Et
pourquoi elle passait toujours lancée à la main : le serveur écrit alors dans un
terminal, que personne ne bloque.

La sortie va désormais dans un fichier, par descripteur passé à l'enfant.
Mesuré des deux côtés : rouge 3 fois sur 3 avec le tuyau, vert avec le fichier,
à code applicatif identique.

### ~~0 duovicies. La civilité du client~~ — **tranchée et codée le 13 août 2026**

**Sa décision, le soir même :** *« Tu as raison, il faut intégrer une case
monsieur-madame. Mais je veux que ça soit sous la forme Mr Mme, en cliquable, on
choisit au-dessus du nom. »* C'est fait — deux pastilles à la création et sur
l'écran du devis, `ARCHITECTURE.md` §81.

**Ce qui reste ouvert, et qu'il faudra lui poser un jour :** une civilité choisie
de travers **ne se corrige plus** après la création. Les pastilles avaient été
posées sur l'écran du devis pour cela ; il les y a fait retirer le jour même —
*« il ne faut pas qu'il y ait les pastilles cliquables sur le devis »* — et il a
raison sur le fond : cet écran est le document, pas la fiche. Il manque donc un
**écran de fiche client**, qui n'existe nulle part aujourd'hui. Tant qu'il ne le
demande pas, on ne l'invente pas. Qui peut le faire : lui.

**Et un second point ouvert :** il n'y a que deux pastilles. Une société se dit donc en n'en touchant aucune — l'application
reconnaît alors « SARL », « SCI », « Mairie »… et se tait. Cela suffit
aujourd'hui : ses clients sont des particuliers. **À rouvrir le jour où il
facture des entreprises**, où une troisième pastille dirait la chose au lieu de
la laisser deviner. Qui peut le faire : lui.

*Ce qui suit est gardé parce que le raisonnement resservira le jour de cette
question-là.*

### ~~0 duovicies bis. La civilité du client — l'arbitrage d'origine~~

Le 13 août 2026, il a demandé que le devis dise « Mr. Martins » et non « Chez
Martins ». C'est **fait**, écran et message tout prêt compris
(`ARCHITECTURE.md` §77). Mais la fiche client ne porte **aucun champ de
civilité** : « Mr. » est un défaut posé sur tout nom qui n'en annonce pas
d'autre.

**Ce que ça veut dire concrètement, et pourquoi ça ne peut pas rester ainsi
indéfiniment :** une cliente saisie « Roux » verra « Mr. Roux » sur son devis,
**et le message qui part chez elle dira « Bonjour Mr. Roux »**. L'application sait déjà se taire devant « Mme Roux » ou « SARL Untel » —
ces deux cas sont couverts — mais elle ne devine pas un patronyme nu.

| | Piste | Ce que ça vaut |
|---|---|---|
| a | **Un choix à la création du client** : trois pastilles — Mr., Mme, ni l'un ni l'autre (société). Un appui. | La seule qui dise la vérité. Coûte une colonne, une migration, et trois pastilles sur un écran déjà chargé. |
| b | Laisser le patron écrire « Mme Roux » lui-même dans le nom | Gratuit, marche déjà — mais il faut qu'il y pense à chaque fois, et un oubli part chez la cliente. |
| c | Ne rien mettre du tout et revenir au nom nu | Annule sa demande du 13 août. |

**Qui peut le faire : lui seul.** C'est un arbitrage de produit, pas un choix
technique — et rien ne sera ajouté sans son accord (`CLAUDE.md` §4).

*(La seconde question — le message qui part chez le client — a été tranchée le
soir même : il dit désormais « Bonjour Mr. Martins ». C'est ce que ses clients
lisent, et c'est donc là que l'erreur de civilité se verra en premier.)*

### ~~0 octodecies. Le message du devis figé désignait une porte invisible~~ — **codé le 2026-08-13 (proposition A)**

**Rien n'est codé** (`CLAUDE.md` §3 bis). Le patron, le 13 août, capture à
l'appui : *« le message dit de consulter la case devis mais aucune case devis
existe »*, et il demande un avis — créer la case, ou retirer le message ?

**Ce qui est vrai, vérifié dans le code :** l'écran Devis existe bien
(`/chantiers/[id]/export`, `chantier-etat.ts` le pose comme étape « Devis »),
mais il vit dans le **tiroir** de la fiche, et **aucune porte n'y mène depuis
`devis-complet`** — où le message s'affiche. De plus, **deux écrans s'appellent
« Devis »** de son point de vue : celui qu'il regarde, et celui où l'on corrige.

`docs/maquettes/40-le-message-du-devis-fige.html` — témoin + trois façons :

| | Ce que c'est | Ce que ça coûte |
|---|---|---|
| A | le message devient la porte (lien sous la phrase) | rien — la retouche la plus courte |
| B | un vrai bouton en capsule | il attire l'œil avant le devis qu'on vient lire |
| C | plus de message du tout | le jour où il touche un prix, rien ne se passe et rien ne le dit |

**Mon avis, donné et assumé : A.** Ne PAS créer de nouvelle case — l'écran
existe, et lui donner un second accès permanent ferait deux portes vers la même
pièce, ce qu'on vient d'éviter sur l'écran du devis.

**Les mots ne sont pas tranchés** : « Le corriger et le renvoyer », « Corriger
ce devis », « Reprendre le devis ». Ils lui appartiennent.
### 0 duovicies. ~~`/chantiers/<id>/facture` ne répond plus en fin de batterie~~ **élucidé le 13 août 2026**

**Ce n'était ni la base, ni le pool, ni l'écran.** Le contrôle « clôturé AVANT
sa date » de `test-planning-vers-facture-e2e.ts` échouait **trois fois sur
cinq** en batterie complète et passait **7/7 joué seul**.

| Piste | Comment elle a été écartée |
|---|---|
| `networkidle` attendait un silence qui n'arrive jamais | Remplacé par `domcontentloaded` — **sans effet** |
| Simple lenteur | Délai porté à 120 s — **dépassé aussi** |
| Verrou en base | Guetteur sur `pg_stat_activity` : **aucune** requête bloquée. Deux transactions arrêtées dès leur `begin`, PostgreSQL attendant que l'application lui reparle |
| Pool de connexions saturé | Relevé à l'instant même : **2 connexions, 1 libre, 0 en attente** |

**Ce que la sonde posée dans la page a montré :** elle lit la session, le
chantier et la facture existante en **193 ms**, puis le premier `await` suivant
prend **44 920 ms** — et repart **à la milliseconde où le navigateur
abandonne**. Le serveur de DÉVELOPPEMENT met ce rendu en attente jusqu'à ce que
le client s'en aille.

**Ce que ça ne concerne pas :** le banc du patron sert une version **bâtie**, où
ce comportement n'existe pas. Aucun défaut de produit ici.

**Corrigé** en appliquant à cette navigation le `ouvrir()` qui vivait déjà plus
haut dans le fichier, écrit pour exactement cette raison : il retente une fois,
et nomme le vrai coupable s'il échoue encore.

### 0 unvicies. La feuille d'envoi montre deux boutons pleins à la fois

**Sa capture du 13 août 2026**, sur un devis dont le client demandait une
correction : « Ouvrir le SMS tout prêt » et « Corriger et renvoyer », l'un sous
l'autre, tous deux pleins. *« Il faut qu'il y ait juste qu'un seul bouton. »*

**Le second n'est pas un doublon, et c'est ce qui rend l'arbitrage réel :**
`ExportClient` le rend dès que `etatEnvoi` vaut `retourne`, `a_corriger` ou
`caduc` — et **c'est le seul endroit d'Atlas où naît une version corrigée**. La
carte du chantier dit « Corriger le devis » et mène ici
(`src/lib/suite-de-la-reponse.ts`, qui explique pourquoi elle ne reprend pas à
sa place). Le retirer purement et simplement supprime la correction.

**Le vrai défaut est ailleurs** : après un envoi réussi, `etatEnvoi` n'est pas
recalculé — l'écran reste sur l'état d'avant et propose de corriger un devis
qu'on vient de corriger et d'envoyer.

**Deux autres demandes, elles, ne se discutent pas :** « Copier le lien » quitte
la rangée des trois actions, et « Plutôt par e-mail → » passe du gris 13 px à
l'or, en gras, un peu plus gros.

**Maquette `docs/maquettes/44-la-feuille-denvoi.html`** — deux lectures (A : le
bouton quitte la page ; B : un seul bouton par moment) montrées dans les DEUX
moments, plus trois dosages de la ligne dorée. **En attente de sa lettre et de
son numéro. Rien n'est posé dans `src/`.**


### 0 unvicies. ~~Relier l'agenda iCloud~~ — **codé le 12 août 2026**, reste à éprouver chez lui

**Sa question du 12 août 2026**, capture du Calendrier d'Apple à l'appui : *« je
peux connecter ce calendrier à mon appli ? »* Réponses obtenues : le compte
derrière la vitrine est **iCloud**, et il veut **les deux sens** — Atlas lit ses
rendez-vous, Atlas y écrit ses chantiers.

**Codé, éprouvé pour tout ce qui décide, et pas au-delà** — le détail et le
pourquoi sont dans `ARCHITECTURE.md` §75, la réponse en langage courant dans
`docs/QUESTIONS.md` §14.

| | Fait | Où |
|---|---|---|
| 1 | Migration : `fournisseur IN ('google','apple')`, mot de passe chiffré, agendas lus, calendrier d'écriture | `drizzle/0035_agenda_apple.sql` |
| 2 | CalDAV : découverte, `calendar-query`, `PUT`, `DELETE` | `src/server/agenda/apple.ts` |
| 3 | Lecture et écriture de l'iCalendar | `src/lib/ics.ts`, `src/lib/caldav.ts` |
| 4 | L'écran, d'après la maquette | `src/app/reglages/agenda/AgendaAppleClient.tsx` |
| 5 | Les chantiers montent et redescendent avec le planning | `src/server/repositories/agenda-apple.ts` |

**CE QUI RESTE, et qui ne peut pas être fait ici :** aucun échange réel avec
iCloud n'a eu lieu — le réseau refuse `caldav.icloud.com` (essayé le 12 août,
connexion refusée). Restent à éprouver **sur son banc**, avec un vrai mot de
passe pour les apps : la découverte des agendas, la lecture, le dépôt, le
retrait. **Ne pas annoncer le raccordement comme éprouvé avant.**

**Ce qui se cassera en premier, si quelque chose casse**, et par où commencer :

1. **la découverte** — iCloud redirige de `caldav.icloud.com` vers le serveur du
   compte ; les redirections sont suivies à la main pour que `PROPFIND` ne
   devienne pas `GET` ;
2. **la double authentification** — sans elle, Apple n'émet pas de mot de passe
   pour les apps, et le refus arrive en 401 comme un mot de passe faux ;
3. **le dépôt** — un agenda partagé en lecture seule est déjà écarté de la
   liste, mais un serveur qui n'annonce pas ses privilèges est supposé
   inscriptible : le refus n'arriverait alors qu'au `PUT`.

Ce que le patron verra dans les trois cas : la phrase d'Apple, telle quelle, sur
l'écran des réglages. C'est voulu — une erreur reformulée envoie chercher au
mauvais endroit.

### 0 vicies. Le badge de Next recouvre son onglet « Chantiers »

**Mesuré le 12 août 2026**, en cherchant pourquoi la CI virait au rouge six
fois de suite sur `test-rien-de-recouvert-e2e.ts`.

Le badge de développement de Next — celui qui affiche « 1 Issue », et par lequel
le patron a trouvé l'erreur d'hydratation de Safari — se pose **en bas à
gauche**, exactement sur l'onglet « CHANTIERS » (mesuré : l'onglet occupe
x 14→105, y 632→654 ; le badge, 56 px dans le coin, le recouvre). Il
n'apparaît que lorsqu'il a quelque chose à signaler — d'où une CI rouge par
intermittence, et une suite verte ici où rien n'était signalé.

**La suite l'écarte désormais nommément** : ce badge n'existe pas dans la
version bâtie, et un contrôle qui échoue au hasard apprend à ignorer le rouge.
Le témoin vérifie qu'un vrai recouvrement est toujours attrapé.

**Mais chez lui, le problème est réel** : son banc sert le mode développement,
donc le badge est sur son écran, sur sa navigation.

Trois pistes, aucune tranchée — et aucune bonne telle quelle :

- le **déplacer** (`devIndicators: { position }`) : les deux coins du bas sont
  pris par la barre d'onglets, et sur l'accueil les deux coins du haut portent
  déjà un bouton. Mesuré, pas supposé ;
- l'**éteindre** (`devIndicators: false`) : on perdrait le « 1 Issue » — or
  c'est par lui qu'il a signalé la panne de Safari. Mauvais échange ;
- faire **servir une version bâtie** à son banc, où le badge n'existe pas. C'est
  probablement la bonne réponse, et elle dépasse ce point.

### 0 quindecies. ~~La ligne « Planifiés » porte un geste de trop~~ — **réglé le 12 août 2026**

Vu en capture en posant le chevron : la ligne portait trois gestes et un nom sur
390 px, et c'est le nom qui cédait — « Chez M. Bernard » s'affichait
« Chez M. Be… ».

**Il a tranché le jour même**, en regardant la capture : *« il faut que le créer
la facture, tu le mettes dans le chevron. Il faut cliquer sur le chevron, la
page s'ouvre avec le GPS et tout machin, et là tu mets créer la facture. »*
« Créer la facture » est donc passé dans la feuille ; la ligne ne garde que le
nom, la date, « Déplacer » et le chevron. Le nom passe d'environ 110 px à plus
de 250. `ARCHITECTURE.md` §70.

### 0 quaterdecies bis. ~~Un chantier sans adresse n'a plus de chemin pour la saisir~~ — **réglé le 13 août 2026**

Il a tranché sur maquette (`docs/maquettes/34`, variante B) : *« ça, c'est au cas
où la fiche entière n'a pas été rentrée. Dans ce cas-là, tu peux faire ça, mais
avec le bouton, tu le mets arrondi. »*

Un bouton **« Saisir l'adresse »** en pastille creuse, qui n'apparaît que sans
adresse et mène au devis complet — seul écran où elle s'édite.
`ARCHITECTURE.md` §70.

### 0 nonies. ~~L'écran de connexion est resté dans l'ancienne identité~~ **fait le 12 août 2026**

**Vu en capture le 12 août 2026**, en vérifiant que les boutons arrondis
n'avaient rien cassé. `src/app/login/page.tsx` n'a jamais été repris par la
refonte du 10 août :

- son bouton est en **terre cuite `#B5502F`**, couleur abandonnée le 3 août
  quand l'application est passée à Arborea — écrite en dur, hors
  `design-tokens.ts` ;
- carte blanche, bordures grises, aucune serif de titre, aucun jeton de la
  charte.

**C'est le PREMIER écran qu'il voit**, et le seul qui ne ressemble pas à Atlas.
Même remarque pour `src/app/documents-legaux/formulaire.tsx`, qui porte la même
couleur en dur.

**Fait le 12 août 2026** : maquettes 32, 33 et 34, puis `src/app/login/page.tsx`.
Reste `src/app/documents-legaux/formulaire.tsx`, qui porte la même terre cuite en
dur et n'a pas été repris — il échappe au parcours pour la même raison que la
porte (`ARCHITECTURE.md` §71).

**Il a choisi, et demandé une suite le 12 août 2026 au soir :** la proposition 4
**sans son titre ni sa sous-ligne**, avec **le sceau et ATLAS du modèle 3**, plus
**une animation de la marque d'une demi-seconde à l'entrée**. Six animations lui
sont proposées dans `docs/maquettes/36-le-logo-qui-sanime.html` — **en attente de
son numéro**. Rien n'est encore posé.

**Il a retenu « le tour » le 12 août au soir**, et demandé d'autres gravures
dans le rond d'or : huit motifs dans
`docs/maquettes/37-le-motif-du-sceau.html` — **son numéro est attendu**.
L'écran, le rond et l'animation n'y bougent plus ; seul le tracé change.

**Ce qu'il faudra trancher avec lui au moment de coder** (écrit sur la maquette) :
la demi-seconde est un **plancher**, pas la durée de l'attente. Le serveur répond
quand il répond ; l'animation ne doit ni être coupée en son milieu, ni se figer
si la réponse tarde. Les propositions 3, 4 et 6 bouclent d'elles-mêmes ; les 1, 2
et 5 se dessinent d'un bout à l'autre et demandent une décision explicite.

**Maquette livrée le 12 août 2026 — `docs/maquettes/35-l-ecran-de-connexion.html`**
(« oui, fais-moi une maquette avant/après »). L'avant reproduit, puis quatre
après : la carte gardée, sans carte, le sceau, la ligne d'imprimé. **En attente
de son choix — `src/` n'a pas été touché.**

**Et un défaut de plus, trouvé en dessinant :** les champs sont écrits en
**15 px**, alors que `styleChampPlage` impose 16 px depuis le 10 août précisément
parce qu'**en dessous, iOS agrandit la page dès qu'un champ prend le focus**. Il
tape son adresse et l'écran lui saute au visage. Ce défaut-là ne dépend d'aucune
proposition : il se corrige avec celle qu'il retiendra. Même remarque pour le
refus de connexion, peint en `text-red-600` (rouge de Tailwind) au lieu du
`colors.alert` de la charte.

### 0 octies. Les actions principales encore dessinées à la main

**Trouvé le 12 août 2026, parce que le patron l'a vu avant nous.** La feuille
d'envoi du devis dessinait son bouton sur place ; la capsule ne l'avait donc
jamais atteinte. Corrigé pour le parcours d'envoi (`EnvoiAuClient`,
`TransmettreAuClient`).

**Restent, repérées mais NON converties :** `DevisDepuisDictee`,
`BrouillonSection` (informations), `PropositionPrixSection` (prix), et les
écrans de réglages (agenda, vocabulaire, import de tarifs). Chacune est un
`<button>` peint en `colors.rust` au lieu d'un `PrimaryButton`.

**Pourquoi ce n'est pas fait d'office :** sa règle du 11 août — *« montre-moi
avant de faire, plutôt que de faire pour revenir en arrière »*. Il faut donc lui
montrer ces écrans avant/après, puis convertir. `scripts/capture-bouton-partout.mjs`
sait le faire pour les écrans qui ont une ADRESSE ; les feuilles qui montent sur
un geste demandent d'ouvrir le tiroir — c'est ce qui manque au script, et c'est
exactement le trou par lequel ce défaut est passé.

### ~~0 quindecies. Un serveur fantôme sur le port 3000, et la batterie accusait le prix~~ — **corrigé le 11 août 2026**

**Vu sur une batterie qui venait de passer entièrement au vert.** La même
commande, rejouée sur le même code, a donné deux rouges :

| Ce qu'on lisait | Ce que c'était |
|---|---|
| `test-prix-e2e` : `'0.00' == '34.50'` | un enregistrement qui n'a pas eu le temps de partir — l'occupant du port compilait |
| `❌ Le port 3000 est déjà pris.` | la vraie cause, mais annoncée **en dernier**, deux étapes trop tard |

**La cause, établie et non supposée.** Une sentinelle a noté ce qui tournait au
moment où le serveur apparaissait : parent déjà mort (`ppid = 1`), aucune suite
en cours, `/tmp/atlas-banc.pid` à la même minute. Ce n'était donc **pas** une
suite oublieuse — l'hypothèse écrite d'abord, et fausse — mais
`verifier-connexion-avec-serveur.mts`, qui lance `npm run banc` puis tue son
groupe dès la connexion éprouvée.

Pourquoi le serveur survivait : `banc.mjs` **sert d'abord et bâtit ensuite**, et
ses gestionnaires de `SIGTERM` vivaient en **fin de fichier**, c'est-à-dire après
la construction. Entre le lancement du serveur et leur installation, il
s'écoulait plusieurs minutes ; un signal reçu dans cette fenêtre tuait le script
net, et le serveur — **détaché**, pour d'excellentes raisons — survivait,
accroché au port. Un gardien juste, arrivé en retard.

**Corrigé en deux endroits :**

1. `scripts/banc.mjs` — les gardiens sont posés **ligne suivante après le
   lancement**, avant toute attente.
2. `scripts/run-e2e-tests.ts` — la batterie **refuse** désormais un port déjà
   pris, au lieu de se rabattre en silence sur l'occupant. C'était le plus grave
   : cinquante suites avaient travaillé, une fois, sur un serveur qu'elle
   n'avait pas lancé, **sans un mot**.

**Éprouvé, dans les deux sens** (`test-prechauffage.ts`, section « deux serveurs
ne se battent plus pour le port ») :

- gardiens remis en fin de fichier → rouge, en nommant la fenêtre ;
- garde neutralisée d'un `if (false && …)` → rouge. La première version du
  contrôle cherchait le nom de la fonction et restait verte : **un contrôle qui
  se contente de trouver un mot ne protège que du mot** ;
- et en vrai : le script de connexion rejoué rend le port (`000`), là où il
  laissait un serveur ; la batterie navigateur, lancée sur un port occupé,
  s'arrête en une seconde avec le remède à taper.

### ~~0 sexdecies. Des suites dépassent leur délai en batterie et font rejouer 25 minutes~~ — **CAUSE TROUVÉE le 2026-08-12**

**Quatre faux rouges dans la journée, sur trois suites sans rapport** —
« clôturé AVANT sa date » (deux fois), « Créer la facture », puis « un appui
dicte, un second enregistre ». Chacune diagnostiquait la même chose et avait
raison — le serveur de développement n'avait pas suivi — et chacune passait au
vert jouée seule. Coût : une batterie complète rejouée à chaque fois.

**Ce n'était pas la machine** : 13 Go libres, charge à 1,2. C'était le
préchauffage de `run-e2e-tests.ts`, et il avait deux défauts qui n'en font
qu'un :

1. **il tournait sans session.** Un appel anonyme sur `/termines` est renvoyé
   vers `/login` par le middleware : la route visée n'est jamais rendue, donc
   jamais compilée. Il ne préchauffait que `/login` — et faisait croire au
   contraire ;
2. **sa liste était incomplète.** `/termines`, justement, n'y figurait pas.

**Les deux venaient d'une deuxième implémentation.** `scripts/prechauffer.mjs`
sait ouvrir une session et parcourir la liste complète, écrans de chantier
compris — c'est ce que le banc d'essai fait depuis toujours. La batterie avait
sa propre version naïve. Deux copies de la même idée finissent toujours par
diverger, et c'est la plus faible qui servait ici.

La batterie emprunte désormais le même préchauffage que le banc.

**Ce qui reste à surveiller :** si un faux rouge de ce genre revient malgré le
préchauffage, ne pas allonger les délais — cela cacherait un écran devenu lent
au lieu de le dire. Mesurer d'abord quel écran, et pourquoi.

### 0 quaterdecies. Deux maquettes `/design` décrivent un écran supprimé

**Né le 11 août 2026**, en supprimant `/chantiers/[id]/photos` (`ARCHITECTURE.md`
§60). Restent derrière lui :

- `src/app/design/photos/page.tsx` — la maquette d'un écran qui n'existe plus ;
- `src/app/design/hub/page.tsx` — un lien `/chantiers/1/photos` désormais mort
  (tous les liens de cette maquette le sont déjà : elle vise un chantier « 1 »
  imaginaire) ;
- le tableau du §4 bis de `docs/INTEGRER-ORIGINE.md`, qui cite le fichier
  supprimé — mais ce document raconte un **état daté**, et le réécrire
  falsifierait ce qu'on savait ce jour-là.

**Volontairement pas touché dans le même lot** : ces maquettes ne sont ni des
écrans du produit ni de la mémoire, et le patron avait demandé qu'on ne corrige
pas ce qui n'était pas demandé. À trancher : les supprimer, ou les marquer
« maquette historique ».

### ~~0. « Impossible d'enregistrer la note »~~ — **CAUSE TROUVÉE ET REPRODUITE le 2026-08-12**
### ~~0 septdecies. L'écran du devis parti~~ — **codé et éprouvé le 2026-08-12**

*« Code le 5 »* — le signet d'or. `ExportClient.tsx`, `TransmettreAuClient.tsx`,
`src/lib/numero-lisible.ts`, `scripts/test-devis-parti-signet-e2e.ts`. Les mesures
viennent de `docs/maquettes/34-le-devis-sur-sa-base.html` : **les reprendre de là**
si on y retouche, jamais de mémoire.

**Cinq choses à ne pas défaire, chacune payée par un défaut réel :**

1. **`atlas-ecran` sur la page, pas de hauteur écrite à la main.** Deux
   tentatives ont débordé avant — un en-tête « mesuré » à 232 px, puis
   `min-h-screen` + `pb-16` qui comptait deux fois la barre du bas
   (`main.atlas-contenu` la réserve déjà). 100 px, puis 68.
2. **L'avertissement de « Modifier mon devis ».** Rouvrir un devis parti crée une
   version mais **n'annule pas l'envoi** : le client voit toujours celle qu'il a
   reçue et peut l'accepter au prix d'avant. Refuser ne doit créer AUCUNE version.
3. **Le voile de la feuille est `aria-hidden`** — sinon deux boutons s'appellent
   « Annuler », et qui ne voit pas l'écran en entend deux.
4. **La bascule de canal reste.** Elle manquait à mes cinq maquettes ; la livrer
   ainsi aurait défait sa demande du 4 août.
5. **`numeroLisible` refuse de grouper ce qu'elle ne reconnaît pas.** Un numéro
   étranger découpé par paires aurait l'air juste sans l'être — pire que rien sur
   une ligne dont le seul rôle est la vérification.

**Ce qui reste ouvert, et n'a pas été tranché :** le rayon du bouton. Tout est au
rayon d'aujourd'hui (4 px). La bande de comparaison — 4, 8, 12, pilule — est au
bas de `docs/maquettes/33-le-devis-parti-allege.html`. Son choix vaudra pour
**vingt-sept écrans** (`PrimaryButton`) : ne pas le poser sur ce seul écran.

*Ce qui suit est l'énoncé d'origine, gardé parce qu'il porte la mesure.*

### ~~0 septdecies bis. L'énoncé~~ — le CONTENU arrêté par lui le 12 août

**Arrêté par lui le 12 août** — c'est acquis, ne pas le rediscuter :

- ne garder que **le nom du devis et le total** ;
- **retirer les lignes de prestations** ;
- un lien **« Modifier mon devis »** sous le total, qui ramène au devis ;
- « Télécharger le PDF », « Copier le lien », « Partager » **en encre foncée**,
  visiblement cliquables.

`docs/maquettes/34-le-devis-sur-sa-base.html` : sa base au mot près, plus quatre
mises en page du même contenu (sans carte · dans le titre · actions empilées ·
signet d'or). **Rien n'est codé** tant qu'il n'a pas donné un numéro.

**Trois points ouverts, à ne pas trancher seul :**

1. **Reprendre un devis déjà parti crée une nouvelle version** et rend l'ancien
   lien caduc. Faut-il le prévenir au clic sur « Modifier mon devis » ? Une
   phrase courte, une seule fois, est proposée — pas décidée.
2. **« Partager autrement (WhatsApp… ) » ne tient pas** à trois sur une ligne. Il
   devient « Partager », ou les trois s'empilent (idée 4). Son choix.
3. **Le rayon du bouton reste sans réponse** (bande de la maquette 33 : 4, 8, 12,
   pilule). Tout est dessiné à 4 px pour ne rien présumer.

### ~~0 sexdecies. L'écran du devis parti : quatre maquettes~~ — **dépassée le 2026-08-12 par la 26**

*Gardée parce qu'elle porte la mesure d'origine : onze blocs, 382 px de trop.*

**Rien n'est codé, et rien ne doit l'être avant qu'il ait désigné une lettre**
(`CLAUDE.md` §3 bis). Il a demandé la maquette explicitement : *« fabrique-moi la
maquette et montre-la-moi avant de coder quoi que ce soit »*.

`docs/maquettes/33-le-devis-parti-allege.html`. Mesuré : l'écran porte **onze
blocs** et déborde de **382 px** sur sa dalle.

| | Blocs | Ce qu'elle retranche | Ce qu'elle coûte |
|---|---|---|---|
| A | 6 | l'adresse illisible, la phrase en double, la carte Chantier/Client | il ne relit plus l'adresse à l'œil |
| B | 4 | la carte d'état, montée dans le titre | un appui pour les autres canaux |
| C | 5 | le devis replié derrière une ligne | un appui pour le détail |
| D | 3 | tout sauf le montant et le geste | rien du devis sans un appui |

**Trois choses que la maquette propose et qui ne sont PAS acquises :** « il y a
2 jours » (la date d'envoi est en base, jamais affichée) ; le libellé qui passe
d'« Ouvrir le SMS tout prêt » à « Relancer par SMS » une fois le devis parti ; et
le numéro écrit espacé plutôt que collé.

**Et le rayon du bouton, qui se choisit en même temps.** Il a dit *« le bouton
est toujours carré »*. Vérifié : il est **déjà au rayon des cartes** (4 px,
`radius.card`, posé le 10 août à sa demande). Ce n'est pas un oubli — c'est que
sur un aplat vert foncé, 4 px ne se voient pas. La bande du bas de la maquette
montre 4 / 8 / 12 / pilule. **Son choix vaudra pour vingt-sept écrans**
(`PrimaryButton`) : ne pas le poser sur ce seul écran, deux formes de bouton
dans la même application est précisément ce qui vient d'être démêlé.

### ~~0 quindecies bis. « Le mail n'est pas parti »~~ — **ce n'était pas un défaut, 2026-08-12**

**Ne pas rouvrir, et surtout ne rien « réparer ».** Signalé comme une panne —
*« lorsque le mail est parti je n'ai pas de message qui prouve qu'il est bien
parti, la page reste figée »* — puis démenti par lui-même dans la foulée :
*« en fait le mail n'était pas parti […] il y avait une faute sur l'adresse
mail »*.

Sa messagerie s'est bien ouverte ; l'adresse du destinataire était fausse.
Vérifié avant de conclure : la CSP ne régit pas la navigation `mailto:`
(`next.config.ts`), et l'adresse construite pour son cas exact fait
574 caractères — très en deçà de toute limite. `useRetourDeMessagerie` n'a donc
pas renvoyé à l'accueil pour la seule bonne raison : **il n'est jamais parti de
la page**.

### 0. Si « Impossible d'enregistrer la note » revient : lire la phrase, ne pas la deviner
**Ouvert le 11 août 2026, et volontairement laissé ouvert.** Le patron a signalé
ce message ; il n'a **pas pu être reproduit ici** — la dictée passe avec un micro
simulé, en développement comme sur la version bâtie derrière une origine
étrangère. Ce qui a été corrigé, c'est le silence : l'écran nommait le refus
« Impossible… Réessayez » quelle qu'en fût la cause, et rien n'était journalisé.

**Le 12 août, le patron a rapporté la phrase — et elle accusait le mauvais
coupable.** Il a lu *« L'enregistrement n'a pas pu être transmis — la connexion
a été interrompue »*. C'était la branche `catch` de l'écran, c'est-à-dire la
seule catégorie que le correctif de la veille avait laissée muette : les refus
ATTENDUS étaient devenus bavards, les pannes IMPRÉVUES continuaient de lever.
**Le correctif était à moitié fait, et la moitié manquante était exactement
celle qui se produisait.**

Pire que muet : cette phrase désignait le réseau alors que l'aller-retour avait
peut-être très bien eu lieu. Elle envoyait chercher au mauvais endroit.

Deux choses ont changé le 12 août :

1. **L'action ne lève plus rien.** Toute panne rend une phrase qui **nomme le
   maillon** — session, cadence, lecture, stockage, base (`src/lib/panne-note-vocale.ts`).
   Le disque plein, le droit d'écriture refusé et le service absent ont leur
   propre phrase, parce qu'ils appellent chacun un geste différent.
2. **L'écran ne conclut plus, il demande.** Quand l'appel lui-même échoue, il
   interroge le serveur avant de parler (`src/lib/diagnostic-liaison.ts`) :
   s'il répond, ce n'était pas la connexion mais une **page vieillie** — le cas
   le plus probable sur ce banc, où l'espace se reconstruit et où les actions
   changent d'identifiant sous une page déjà ouverte.

**Puis la cause a été trouvée, le 12 août, en reproduisant son parcours plutôt
qu'en raisonnant dessus.** Une action serveur porte un identifiant fabriqué à la
construction ; son banc se met à jour tout seul ; une page restée ouverte appelle
un identifiant disparu, et l'envoi échoue sans atteindre le serveur.
`scripts/eprouver-page-vieillie.mts` le rejoue : code d'avant, `500` et le
message du patron mot pour mot. L'enregistrement passe désormais par une URL
(`ARCHITECTURE.md`, `HANDOVER.md`).

**Ce qui reste utile si une panne d'un autre ordre survient :** les phrases
ci-dessous désignent chacune un endroit différent, et aucune ne demande de
deviner.

| Ce qu'il lit | Ce que ça désigne |
|---|---|
| « (étape : session) » | sa session a expiré — recharger et se reconnecter |
| « (étape : stockage) », disque plein | l'espace de travail n'a plus de place |
| « (étape : cadence) » ou un service qui ne répond pas | Redis absent — l'espace est à relancer |
| « (étape : base) » | la fiche n'a pas pu être mise à jour — le journal porte le détail |
| « cette page a été ouverte avant la dernière mise à jour » | il suffit de recharger |
| « le serveur est injoignable depuis ce téléphone » | c'est bien le réseau, cette fois |

**Ne rien supposer avant d'avoir la phrase** : trois diagnostics à distance ont
déjà coûté un aller-retour chacun.

**Ce qui n'est toujours pas fait, et qui coûte à chaque échec :** la note captée
est **perdue** quand l'envoi échoue — il faut tout redicter. La garder en local
(IndexedDB) et la reproposer au retour serait le vrai confort ; ce n'est pas
fait, et ce n'est pas un détail pour quelqu'un qui dicte debout sur un chantier.


### ~~0 bis. Si le fil accroche ENCORE chez le patron : le masque, sur iOS~~ — **close le 2026-08-11 par le patron lui-même**

**Ouvert puis refermé le même soir, et c'est le refermer qui compte.** Le
saccadé avait pour cause `scroll-snap-stop: always`, retiré ; la mesure
(`scripts/mesurer-fluidite-fil.mts`) mettait le masque en dégradé et l'animation
d'opacité hors de cause — mais elle avait mesuré **Chromium sans tête sur cette
machine**, pas Safari sur son iPhone, et elle ne pouvait pas produire l'élan d'un
vrai doigt. Ce point restait donc ouvert par honnêteté, pas par doute.

**Le patron a tranché, sur son téléphone :** *« la fluidité de l'iPhone, ça
aussi, ça a été corrigé. »* Le retrait de l'accroche suffisait ; le masque
n'était pour rien dans la plainte.

**Ce qu'il faut en retenir, et pourquoi ce point reste écrit plutôt que
supprimé :** le `mask-image` de `.atlas-fil-defile` est **hors de cause, vérifié
sur le vrai appareil**. Quelqu'un finira par le soupçonner — c'est le suspect
qui vient à l'esprit dès qu'on parle de défilement qui accroche sur iOS. Le
déplacer coûterait du travail et du risque pour rien. Le correctif de repli
reste décrit ci-dessous **au cas où une plainte NOUVELLE apparaîtrait**, pas
pour celle-ci, qui est réglée.

Repli, si et seulement si le sujet revient : **déplacer le fondu sur
`.atlas-ecran`**, en deux dégradés posés PAR-DESSUS (couleur `--card`,
`pointer-events: none`), plutôt qu'en masque SUR le cadre qui défile. Deux
précautions alors : les dégradés se placent aux bords de la zone qui défile, pas
du cadre (l'en-tête n'est pas dedans), et une capture avant/après doit être
identique — sinon on aura échangé un défaut contre un autre.

### ~~0 septies. Les deux portes de la création~~ — **close le 2026-08-11**

Il a choisi, maquettes en main : la **bascule « le trait qui glisse »**
(`docs/maquettes/26-la-bascule-affinee.html`, déclinaison 1) et le bouton **« la
capsule »** (`docs/maquettes/28-le-bouton.html`, proposition 5). Les deux sont en
place sur l'écran de création, et « Je l'écris » mène à la page du devis entier
avec le client déjà en en-tête. Le raisonnement complet est dans
`ARCHITECTURE.md` §64.

**Tranché le 11 août au soir : « partout ».** La capsule est la seule forme
d'action principale de l'application, sur les dix-sept écrans, et la variante
rectangulaire a été retirée. Elle lui a été montrée **sur ses vrais écrans avant
d'être posée** — sa règle : « montre-moi avant de faire, plutôt que de faire pour
revenir en arrière ». `scripts/capture-bouton-partout.mjs` refait la planche.

### ~~0 ter. Les suites navigateur mesuraient un écran que personne ne possède~~ — **close le 2026-08-11**

**Trouvé le 11 août 2026, et le patron l'a payé.** Les suites posaient un cadre
de 393 × 852. La hauteur **utile** d'un vrai iPhone 13, barre du navigateur
déduite, est de 390 × **664** (`devices["iPhone 13"]` de Playwright). Sur ce
cadre trop haut, un contrôle de chevauchement passait au vert alors que, sur son
téléphone, la bulle de l'assistant recouvrait « ou rédiger le devis à la main ».

**Fait.** L'écran vit désormais dans `ECRAN_DU_PATRON` (`scripts/e2e-browser.ts`)
et toutes les suites en héritent ; deux tolérances écrites à la main sont tombées
avec (« 400 px » de débordement toléré sur un écran de 393 ; une grille cadrée à
393 au lieu de 390).

**Ce que ça a trouvé : rien.** 46/47, l'unique rouge étant un dépassement de
délai du serveur de développement. Il fallait quand même le faire — un contrôle
qui mesure un écran inventé ne prouve rien, vert ou rouge — mais le dire tel
quel : le cadre honnête n'a révélé aucun défaut caché.

**Ce qui manquait vraiment**, et qui existe maintenant :
`scripts/test-rien-de-recouvert-e2e.ts`, qui cherche sur quatorze écrans ce que
le doigt n'atteint pas. Un seul écran vérifiait cela auparavant, pour un seul
bouton.

### ~~0 quater. Le bandeau d'alerte est coupé en haut, à l'arrivée sur l'accueil~~ — **tranché le 2026-08-11 : on laisse tel quel**

**Le patron, après avoir vu le raisonnement :** *« Dans ce cas-là, laisse tel
quel. »* Ne pas rouvrir ce point sans lui : ce n'est pas un défaut oublié, c'est
un arbitrage rendu. Le raisonnement qui l'a emporté est conservé ci-dessous —
c'est lui qui évitera de le refaire.

**Vu en regardant les captures de la perle, le 11 août 2026 — aucune suite ne le
disait.** À l'ouverture de « Vos chantiers », le fil est déjà défilé de 61 px :
le navigateur pose la liste sur son premier point d'accroche, qui centre le
premier chantier. Le bandeau « CORRECTION DEMANDÉE », qui vit **dans** la liste,
perd donc sa première ligne — et il n'existe aucune position de repos où on la
revoie : forcer le défilement à zéro y ramène.

Ce n'est **pas** une conséquence du travail sur la perle : mesuré avant, c'était
déjà 61 px.

L'arbitrage, et pourquoi il ne se tranche pas en codant : les deux moitiés ne
peuvent pas être vraies ensemble.

| Choix | Ce qu'on gagne | Ce qu'on perd |
|---|---|---|
| **Laisser tel quel** (retenu) | la perle désigne un chantier dès l'ouverture | le bandeau perd sa ligne de capitales — son nom, sa phrase et ses deux boutons restent entiers |
| Ajouter un point d'accroche en haut | le bandeau entier | on arrive sur une liste où la perle ne désigne rien, à **chaque** ouverture |

Un repère abîmé à chaque ouverture coûte plus cher qu'une ligne de capitales
coupée : c'est ce qui a emporté la décision.

### ~~0 bis. Une session périmée~~ — **close le 2026-08-10, test compris**

`GET /api/session-perimee` efface les cookies et renvoie à la connexion ;
`GardeDocumentsLegaux` (layout racine) et `getCurrentCtx` y mènent.
`scripts/test-session-perimee-e2e.ts` le tient en cinq contrôles, dont un
parcours dans un vrai navigateur, JavaScript coupé.

**Trois défauts que ce test a trouvés, et qu'il faut connaître avant de toucher
à ce coin du code** (le détail est dans `CHANGELOG.md` du 2026-08-10) :

1. Une redirection lancée depuis une **page** ne peut pas être un 307 : elle
   rend sous la frontière de `src/app/loading.tsx`, où l'enveloppe est déjà
   partie. Next.js répond alors 200, et le renvoi est joué en JavaScript. Tout
   contrôle d'accès qui doit valoir sans JavaScript vit dans le **layout**.
2. `NextResponse.redirect` fabrique une adresse absolue depuis `request.url`,
   c'est-à-dire l'adresse d'**écoute** (`0.0.0.0`). Derrière le relais du
   patron, elle ne mène nulle part. Renvoyer relatif.
3. « Compte disparu » et « compte sans entreprise » ne se traitent pas pareil :
   effacer la session du second l'enfermerait dans une boucle
   connexion → effacement → connexion.

#### La forme d'origine du défaut, pour mémoire

**Constaté chez le patron le 10 août 2026, sur son banc.** Son navigateur
portait la session d'un compte de démonstration supprimé par un nouveau seed.
Le cookie restait valide, `auth()` rendait donc un `utilisateurId` — et
`resoudreEntrepriseId` levait `AucuneEntrepriseError`, qui n'est **attrapée
nulle part** (`src/server/session-ctx.ts`). Résultat : toutes les pages en 500,
et un écran qui ne dit rien de ce qu'il faut faire.

**Ce qu'il faut, et pourquoi ce n'est pas une ligne de code :** une session
valide sans adhésion doit ramener à l'écran de connexion, **et la session doit
être révoquée** — sinon la page de connexion renvoie vers l'accueil, qui
renvoie vers la connexion, en boucle. `getCurrentCtx` sert aussi les actions
serveur et les routes d'API : le remède doit valoir pour les trois, sans
affaiblir l'isolation. À écrire avec un test qui reproduit la panne : session
signée d'un utilisateur sans adhésion.

**En attendant**, le contournement est écrit dans `docs/ESSAYER.md` : ouvrir en
navigation privée, ou rejouer le seed.


### 0. Le banc d'essai tient debout — ~~à faire~~ **fait le 9 août 2026**

Veilleur qui relance le serveur mort, préchauffage de seize écrans, garde contre
un second serveur, et construction possible sans les secrets de production.
`ARCHITECTURE.md` §43 et §44.

**Ce qui reste sur ce sujet, et que je dois encore faire :**

- **Le chemin de MISE À JOUR n'est toujours pas éprouvé par la CI.** Elle bâtit
  un banc neuf à chaque fois ; le défaut des migrations du 9 août est passé par
  ce trou, et un autre y passera. Il faut un banc qui existe déjà, qui reçoit du
  code neuf, migrations comprises.
- ~~**Le navigateur d'essai manque au conteneur.**~~ — **réglé le 2026-08-12.**
  Il s'installe dans la commande du workflow (`npx playwright install --with-deps
  chromium`), et non dans l'image : l'espace du patron ne porte pas trois cents
  mégaoctets dont il ne se sert jamais, la machine de GitHub les paie une fois
  par exécution. Ce qui l'a débloqué : `.devcontainer/verifier.sh` **se connecte
  désormais pour de vrai** sur le banc, derrière une origine étrangère — le
  contrôle qui manquait quand le patron a écrit « je n'arrive pas à me
  connecter ».
- **Les PDF et la dictée ne sont pas mesurés** — le premier exige un vrai
  stockage, la seconde un appel facturé. Dit plutôt que supposé.


### 0. La sauvegarde des données — À FAIRE, dans cet ordre

**Décidé avec le patron le 5 août 2026.** Il a demandé explicitement que ce
point soit écrit : *« oublie pas de le faire, note-le, enregistre-le ! »*

| | Quoi | Quand | État |
|---|---|---|---|
| **a** | ~~**Bouton « Télécharger mes données »** dans Réglages. Un fichier arrive sur son téléphone. Aucun terminal, aucun compte, aucune dépendance.~~ | | **fait le 2026-08-05** |
| **b** | **Sauvegarde automatique**, sans qu'il ait à y penser. | **Dès que l'hébergement est choisi** (point 3 de `docs/A-FAIRE.md`) | bloqué |

**(a) est livré.** Un ZIP contenant les vingt-trois tables de l'entreprise, ses
photos, ses enregistrements et ses PDF, plus un mode d'emploi qui dit ce que le
fichier contient de sensible. Les choix et ce qu'ils écartent sont dans
`ARCHITECTURE.md` §26 ; le code dans `src/server/repositories/export-entreprise.ts`,
`src/app/api/mes-donnees/route.ts` et `src/lib/archive-zip.ts`.

**Ce qui le garde honnête, et qu'il ne faut pas défaire :**
`test-export-entreprise.ts` interroge `information_schema` et **échoue si une
table portant un `entreprise_id` n'est pas exportée**. Une table ajoutée demain
et oubliée disparaîtrait sinon des sauvegardes sans un bruit. En ajouter une
sans l'exporter fera rougir la batterie — c'est voulu.

**Pourquoi (b) ne peut pas se faire maintenant, et il faut le redire à chaque
fois que la question revient :** une sauvegarde automatique doit déposer son
fichier quelque part.

- **Pas dans le dépôt** : il est public. Y écrire une base contenant les noms et
  adresses des clients serait une fuite, pas une sauvegarde.
- **Pas sur le disque de l'espace de travail** : c'est précisément ce dont on
  cherche à se protéger, puisqu'il disparaît avec l'espace.
- **Il faut donc une destination extérieure** — celle de l'hébergeur, ou un
  stockage objet que le patron n'a pas encore.

**Ce que (a) débloque :** il pourra nourrir la mémoire de l'agent sans craindre
de tout perdre au passage en ligne. C'est la condition qu'il a posée lui-même
pour commencer — voir `docs/A-FAIRE.md` §1 bis.

**Ne pas confondre avec l'export RGPD existant.**
`src/server/repositories/donnees-client.ts` exporte les données **d'un client**,
pour répondre à une demande d'accès. Ce qu'il faut ici est l'inverse : **toutes
les données de l'entreprise**, pour les emporter ailleurs.

### 0 ter. L'agent demande ce qui coûte de l'argent — ~~à faire~~ **fait le 6 août 2026**

**Choisi par le patron en QCM le 6 août 2026**, devant la mémoire des
corrections et l'entretien de départ : *« Les questions qui coûtent de
l'argent. »* Et la règle, confirmée le même jour : *« il demande si ça change le
prix, il signale sinon »* (`docs/EXEMPLE-DICTEE.md` §7).

L'agent s'arrête désormais **avant de chiffrer** quand il manque ce qui fait le
prix. Sur la dictée du chêne mort : la technique et le diamètre, absents de la
note, et qui font passer l'abattage de 600 à 1 400 €.

| Où | Quoi |
|---|---|
| `src/lib/questions-chiffrage.ts` | Les règles du métier, pures — ce qu'on demande **et ce qu'on tait** |
| `drizzle/0022_precisions_chantier.sql` | Ses réponses, qui survivent à une relecture de la dictée |
| `src/server/services/devis-depuis-dictee.ts` | L'arrêt, et la reprise **sans rappeler le modèle** |

**Ce que ça ne fait PAS — à ne pas croire acquis.** La réponse est enregistrée
et s'écrit sur la prestation ; **elle ne change pas encore le montant**. C'est la
règle du patron lui-même (`EXEMPLE-DICTEE.md` §9c) : tant qu'aucun rapport n'a
été observé entre les techniques et les prix, l'agent demande le prix plutôt que
d'en fabriquer un. Il manque la mémoire, pas la question.

**Ce qui le débloquerait**, dans l'ordre : (a) puis (c) ci-dessous. Dès qu'il
existe deux devis d'abattage avec leur technique, le rapport se calcule et le
montant peut se proposer — arrondi à la dizaine d'euros HT (`§9b`), et présenté
comme un **rappel** de la dernière fois, jamais comme un calcul non sourcé.

### 0 quater. La mémoire des corrections — ~~à faire~~ **faite le 6 août 2026**

**Choisi par le patron le 6 août 2026**, devant l'entretien de départ et les
photos. Ce qu'il chiffre sur un devis est désormais retenu, et lui revient sur
le chantier comparable suivant.

**Ce que ça a révélé :** `historique_prix` existait, était lue par le chiffrage
— et **n'était jamais écrite par l'application**. Seuls les tests l'alimentaient.
Une mémoire que personne ne remplit n'est pas une mémoire.

| Où | Quoi |
|---|---|
| `src/lib/lecons-prix.ts` | Ce qui se rapproche, ce qui ne se rapproche **pas**, et le rappel |
| `src/lib/arrondi-prix.ts` | « En HT on fait des prix ronds » (§9b), enfin appliqué |
| `drizzle/0023_lecons_prix.sql` | Une leçon par ligne de devis, jamais une de plus |
| `devis-complet` | Le rappel sous la ligne, et « Reprendre ce prix » |

**Pourquoi une table de plus plutôt qu'`historique_prix`.** Celle-ci s'appuie
sur `catalogue_prestations`, catalogue **partagé** repéré par nom canonique :
elle ne sait pas distinguer un abattage au pied d'un démontage avec rétention —
les deux seules choses qui font passer le même chêne de 600 à 1 400 €. Une
mémoire aveugle à cette distinction rappellerait un prix faux de 800 € avec
l'autorité de l'expérience.

**Trois garde-fous à ne pas défaire :**

- **Un rappel, jamais un calcul** (`EXEMPLE-DICTEE.md` §9c). La phrase dit d'où
  vient le chiffre et de quel chantier. Rien ne s'applique tout seul.
- **Le rapprochement se trompe dans le bon sens.** Les diamètres sont groupés
  par tranche de dix centimètres, au plus proche ; une frontière subsiste, et
  elle fait **manquer** un rappel, jamais en fabriquer un faux. Élargir le
  rapprochement échangerait un manque contre une erreur.
- **L'apprentissage ne gêne jamais le travail.** Une ligne dont on ne sait rien
  tirer s'enregistre quand même.

**Ce qui reste ouvert :** le rapport entre techniques (×1,67, ×2,33 — §9a),
qui demande plusieurs devis comparables. La mémoire l'accumule désormais ; la
règle se calculera quand il y aura de quoi.

### 0 quinquies. Lignes vendables et grille de fendage — ~~à faire~~ **fait le 8 août 2026**

Ce qui est en place, et qu'il ne faut pas refaire :

- le découpage en lignes vendables (`src/lib/lignes-vendables.ts`), avec le
  billonnage compris dans l'abattage ;
- la grille de fendage hauteur × diamètre, 8 × 6 cases, née vide, remplie à la
  main **et** par ses devis (`src/lib/grille-prix.ts`).

Détail des choix : `ARCHITECTURE.md` §29.

**Ce qui reste ouvert, et qu'il faut lui demander plutôt que de trancher seul :**

| | Question | Pourquoi ça presse un peu |
|---|---|---|
| a | **Les tranches lui conviennent-elles ?** 8 diamètres × 6 hauteurs, bornes hautes incluses. | Changer les bornes plus tard rend introuvables les prix déjà rangés. C'est facile aujourd'hui, coûteux après trente devis. |
| b | **L'abattage mérite-t-il la même grille ?** Il se chiffre déjà à la technique et au diamètre, mais sans liste que le patron puisse voir et compléter. | Question posée le 8 août, restée sans réponse. |
| c | **La taille de haie devrait-elle avoir sa propre ligne ?** Son devis de référence du 5 août en compte trois — haie 350 €, abattage 600 €, fendage 300 € — quand l'application en produit deux. | Séparer la haie du chêne demanderait de répartir un tarif global entre eux, c'est-à-dire d'inventer deux prix. La fente a le droit à sa ligne parce qu'elle a une grille ; la haie n'en a pas encore. |
| d | **Autre chose que la fente se détache-t-il ?** Le dessouchage, l'évacuation seule, l'enlèvement des grumes. | Aujourd'hui la fente est le seul cas connu — parce que c'est le seul qu'il ait décrit. |

**Et une limite à connaître avant de promettre quoi que ce soit :** seuls les
devis **nés d'une dictée** nourrissent `corrections_dictee`. Un devis écrit
entièrement à la main n'apprend rien sur la façon de LIRE une dictée — c'est
délibéré (il n'y a pas d'écart à mesurer), mais cela veut dire que sa phrase
*« je fais plein de devis et dans un mois tu sauras les remplir tout seul »* ne
vaut que pour les devis dictés. La grille de fendage, elle, se remplit dans les
deux cas.

### 0 sexies. Le PDF d'une liste de prix — à trancher avec le patron

L'import d'une liste de prix accepte **Excel et CSV** (`ARCHITECTURE.md` §31).
Le **PDF est refusé**, avec un message qui donne la sortie : « Ouvrez la liste
dans Excel puis Enregistrer sous → CSV ».

**Pourquoi refusé plutôt que deviné.** Un PDF est une image de tableau : plus de
colonnes, seulement des morceaux de texte à des coordonnées, souvent dans un
encodage propre au document. Un prix lu de travers arrive sur le devis d'un
client — c'est précisément ce que `docs/AGENT.md` §3 interdit.

**Question posée le 8 août, et tranchée : « le tableur suffit ».** Le sujet est
donc clos, et ce point ne se rouvre que s'il change d'avis. Les deux pistes sont
gardées ci-dessous pour qu'on n'ait pas à les réinventer ce jour-là.

| | Piste | Ce que ça vaut |
|---|---|---|
| a | Faire lire le PDF par le modèle déjà branché, et lui faire valider l'aperçu comme aujourd'hui | Marche sur les PDF scannés comme sur les autres. Coûte des jetons, et demande d'envoyer le fichier chez un sous-traitant — donc l'accord du patron (`docs/A-FAIRE.md` point 2) |
| b | Extraire la couche texte à la main (flux `Tj`/`TJ`, positions `Td`/`Tm`) | Sans dépendance ni réseau, mais muet sur un PDF scanné, et fragile sur les encodages de sous-ensembles de polices |

### 0 nonies. Le calendrier, des deux côtés — ~~à faire~~ **fait le 9 août 2026**

Le client ne peut plus choisir un jour déjà pris : il est barré et ne répond
pas. Le patron a le même calendrier, jusqu'à dix-huit mois. `ARCHITECTURE.md`
§36.

**À savoir avant d'y toucher** : le composant ne décide de rien, tout vient de
`src/lib/calendrier.ts`. Et l'ordre des raisons dans `etatDuJour` n'est pas
indifférent — un jour hors fenêtre ne doit JAMAIS se dire « déjà pris » chez le
client, sinon la page laisse filtrer le planning du patron.

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « tu peux aller jusqu'à
douze mois d'occupation ».** Son calendrier barre donc ses journées complètes sur
365 jours. Au-delà, c'est toujours le serveur qui refuse après coup, et un
contrôle tient cette borne pour qu'on ne l'élargisse pas sans le décider.

**Ce que voit le client n'a pas bougé** — deux nombres, deux personnes. Ne jamais
les réunir « pour simplifier » : `HORIZON_OCCUPATION_PATRON_JOURS` est à lui,
`FENETRE_PROPOSITION_JOURS` est à son client.

### 0 octies. Ce qui se détache d'un chantier — ~~à trancher~~ **tranché le 8 août 2026**

Question posée : « autre chose se détache-t-il — dessouchage, évacuation seule,
enlèvement des grumes ? » Sa réponse : **« le dessouchage oui, et les grumes
aussi »**. L'évacuation seule reste donc avec l'abattage et le broyage.

Fait : cinq natures de grille, trois formes, 82 cases (`ARCHITECTURE.md` §35).

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « à la tonne ».** La case
porte un prix unitaire, multiplié par le tonnage lu dans la dictée. L'ancien
forfait a été **effacé** et non converti (migration 0029) : on ne sait pas
combien pesait le chantier qui l'avait produit.

La réserve, écrite à l'écran plutôt que dans un commentaire, aura tenu moins de
vingt-quatre heures. À imiter : une question posée là où le patron la lit se
répond ; enfouie dans le code, elle attend qu'un devis sorte faux.

### 0 septies. Du planning à la facture — ~~à faire~~ **fait le 8 août 2026**

Le patron ne pouvait pas atteindre le devis d'un chantier planifié : toucher sa
carte n'ouvrait qu'un sélecteur de date. La chaîne facture → TVA existait
pourtant en entier — elle était seulement injoignable depuis son écran.

Fait : la carte mène au chantier, porte « Fin de chantier », et garde le
changement de date sur un lien à part. Plus deux défauts de rangement corrigés à
la racine, et un libellé de facture qui n'était plus coupé.

**Ce qu'il faut savoir avant d'y toucher** — `ARCHITECTURE.md` §33 :

- La règle de rangement vit dans `src/lib/onglet-chantier.ts` et **nulle part
  ailleurs**. Trois portes selon la donnée disponible ; **ne jamais la recopier
  dans un écran**, c'est exactement ce qui a produit les deux défauts.
- Aucune barrière de date sur « Fin de chantier », et c'est délibéré depuis le
  3 août : c'est le patron qui sait quand un chantier est fait.

**Ce qui reste ouvert, et qu'il faudra lui demander** : un chantier passé au
planning n'affiche rien tant qu'il n'est pas clôturé. Faut-il un rappel — « ce
chantier était prévu hier » — sur l'écran d'accueil ? Aujourd'hui il bascule
silencieusement dans « Terminés », ce qui est correct mais discret.

### 0 decies. La nouvelle direction graphique — en attente de son choix

Le 9 août au soir, le patron a trouvé l'écran refait « trop application créée
en 2013 » et demandé quelque chose de **minimaliste et luxueux**, en s'appuyant
sur `aman.com`. Huit maquettes ont suivi ; il a retenu la mise en page **« la
colonne »** — la date à gauche, le chantier à droite — et gardé **trois** de ses
déclinaisons : le repère, en plages, l'action au pouce.

**Rien n'est codé.** L'application porte toujours la reproduction de sa première
capture (`ARCHITECTURE.md` §46). Il n'a pas encore désigné laquelle des trois.

Tout est dans `docs/maquettes/`, et d'un coup dans
`docs/maquettes/toutes-les-maquettes.html` — engendrée, jamais éditée à la
main : `node scripts/fusionner-maquettes.mjs`, puis
`node scripts/verifier-maquettes-page-unique.mjs`.

Ce que la bascule coûtera, quand il aura choisi : la charte de
`src/lib/design-tokens.ts` change de fond en comble (ivoire au lieu du gris-vert,
encre au lieu du vert pin pour l'action, bronze au lieu de l'or), et **tous** les
écrans suivent — pas seulement Chantiers. À ne pas entamer écran par écran.

### ~~0 quindecies. Le bouton était codé mais PAS chez lui~~ — **fusionné dans `main` le 2026-08-11, sur son accord**

**C'était le seul point qui le séparait de son bouton, et il n'était pas
technique.** Il a répondu *« fusionne dans main »* : c'est fait (`6059641`), et
son espace le prendra au prochain allumage — ou tout de suite par « Chercher les
dernières corrections ».

*Ce qui suit est gardé parce que le piège, lui, resservira.*

Le 11 août au soir : *« la modification du bouton nouveau chantier n'est pas
effectuée. Corrige ça. Et pourtant, j'ai la nouvelle dernière mise à jour, celle
de dix-neuf heures et quelques. »* Les deux moitiés de la phrase étaient vraies.

- Le bouton vit sur `claude/nouveau-chantier-button-design-2vuu9h`.
- Son espace de travail suit **`main`** — `.devcontainer/mettre-a-jour.sh` fait
  un `git merge --ff-only origin/<branche courante>`, à chaque allumage et
  derrière le bouton « Chercher les dernières corrections ». **Les deux suivent
  la branche courante.** Aucun des deux n'ira jamais chercher ailleurs.
- `main` n'a jamais reçu ce travail, et avançait en parallèle ce soir-là
  (19:02, 19:11, 19:13, 19:37). D'où sa « mise à jour de dix-neuf heures ».

**Ce qu'il a fallu faire, et qui n'appartenait pas à l'agent :** fusionner la
branche dans `main` — **fait le 2026-08-11, sur son accord explicite**
(`6059641`, en avance rapide, `main` fusionné dans la branche juste avant).

**Ne pas contourner en lui demandant de changer de branche** : ce serait des
commandes git tapées au doigt sur six pouces, ce que tout ce dépôt s'emploie à
lui épargner (`.devcontainer/demarrer.sh`).

**Ce qui, lui, a été corrigé sans attendre :** la ligne « Version » de Réglages
nomme désormais la **branche** suivie, et le bandeau du terminal ne l'annonce
plus périmée. Un espace en retard d'une branche se voit maintenant sur une
capture, sans avoir à poser la question — c'est précisément ce à quoi cette
ligne servait, et ce qu'elle n'a pas su faire ce soir-là.

### ~~0 terdecies. L'action « Nouveau chantier »~~ — **close le 2026-08-11, codée et éprouvée**

Le 11 août 2026, capture à l'appui : *« j'aime pas le gros bouton nouveau
chantier […] ce gros bouton en plein milieu, ça ne fait pas très luxe »*. Le
reste de l'écran lui convient — c'est **l'aplat vert seul** qui est en cause.

**Treize** remplaçants sont dessinés, en trois tournées — et l'un d'eux est
maintenant à moitié choisi : **le sceau clair** (maquette 16, deuxième
habillage), *« j'aime beaucoup la deuxième »*. Puis il a écarté le sceau
lui-même — *« le fond blanc me dérange »* — et demandé de l'innovation, pas une
variante. `docs/maquettes/18-six-matieres.html` répond sur deux axes : **des
matières** (laque, or brossé, cire, encre vivante, ou pas de disque du tout) et
**deux ouvertures où le bouton devient la page** au lieu de faire monter une
feuille.

**FAIT.** Le bouton est dans l'application depuis le 11 août au soir :
`src/app/EcranChantiers.tsx` et `src/app/globals.css`. Éprouvé par
`scripts/test-bouton-nouveau-chantier-e2e.ts` (la demi-seconde, le double appui,
le mouvement réduit), regardé par
`scripts/capture-bouton-nouveau-chantier.mts` (attente, geste, feuille). 108
suites base et 49 suites navigateur au vert, connexion réelle comprise.

**Ce qui a été retenu, pour mémoire :** C'est
`docs/maquettes/24-le-bouton-retenu.html` : **« Nouveau chantier » écrit, le
rond d'un cheveu qui bat à sa droite**, et à l'appui **trois tours avec onze
grains d'or**, puis la feuille une demi-seconde plus tard. Toutes les mesures
sont dans le tableau au bas de cette maquette — les reprendre telles quelles.

Il reste à **le coder** : le bloc `<Link>` de `EcranChantiers.tsx`, une
trentaine de lignes de `globals.css`, le délai avant l'ouverture de la feuille,
une suite qui mesure la demi-seconde et une capture. Une demi-journée. Deux
choses à ne pas oublier : l'appui doit s'enfoncer tout de suite (140 ms), et un
second appui pendant le tour doit être ignoré, sans quoi deux chantiers naissent
au lieu d'un.

**L'historique du choix (pour ne pas rouvrir ce qui est clos) :** C'est **l'anneau d'un cheveu avec
son « + »**, qui doit **tourner à fond puis ouvrir la page**. Sa place a été
tranchée juste après : **au centre**, à l'endroit qu'occupait l'aplat vert — et
non en haut à droite comme il l'avait d'abord montré — avec **un petit trait de
chaque côté, qui s'écarte à l'appui**. La dernière tournée ajoute **le mot** au geste
(`docs/maquettes/23-le-mot-et-le-rond-qui-bat.html`) : « Nouveau chantier »
écrit, le rond qui bat en attendant le doigt, et au clic le tour et la
poussière — sept dispositions du libellé. **Huit** autres déclinaisons du tour
seul restent dans `docs/maquettes/22-le-rond-entre-deux-traits.html` — dont deux qui reprennent
l'anneau de la note vocale (un cercle dehors, un cercle dedans), et une qui met
les crans de la dictée à la place des traits ; il ne reste qu'à en
désigner une, et le tour franc suffirait. (La version en haut à droite reste
dans la maquette 21, si jamais il y revenait.)

**Ce que coûtera la bascule, une fois la déclinaison choisie** : le bloc
`<Link>` de `EcranChantiers.tsx` devient un anneau posé dans l'en-tête (grille à
deux colonnes, aligné sur la ligne de base du titre), plus une trentaine de
lignes de `globals.css` pour le tour, plus le délai avant l'ouverture de la
feuille. Une demi-journée. Deux choses à ne pas oublier : l'appui doit s'enfoncer
tout de suite (140 ms), et un second appui pendant le tour doit être ignoré,
sans quoi deux chantiers naissent au lieu d'un.

**L'ancien squelette (rond plein au milieu, explosion, agrandissement) n'est plus
d'actualité** : il est resté une soirée. Ne pas le ressortir — maquette 20.

**Le squelette était arrêté par lui le 11 août en fin d'après-midi** : un rond plein avec un
« + », une explosion de débris à l'appui, et le rond qui s'agrandit jusqu'à
devenir la page. Six gerbes sont à l'essai dans
`docs/maquettes/20-le-rond-qui-eclate.html` ; il ne reste qu'à en désigner une.

La maquette 18 a été jugée trop démonstrative — *« tu as primé sur l'originalité
au détriment de l'élégance »*. `docs/maquettes/19-six-gestes-tenus.html` revient
donc à la retenue : plus de gerbe, plus de matière imitée, une seule chose qui
bouge à la fois.

**Ce qu'il faudra prévoir si une matière est retenue :** la teinte de laque
(#10150f → #263025) n'existe pas dans `src/lib/design-tokens.ts`, et l'ouverture
par agrandissement du disque n'est pas la transition actuelle — c'est un
changement de `FormulaireNouveauChantier` en feuille, pas seulement du bouton.
Compter une journée plutôt qu'une demi. La première
(`docs/maquettes/14-le-geste-nouveau-chantier.html`) amincit le bouton : le
filet qui se trace, le sceau, le premier brin, le cartouche gravé, la pastille
au pouce, la légende sur le trait. Elle n'a pas convaincu — *« je ne suis pas
encore hyper convaincu »* — et le pourquoi vaut d'être retenu : **six façons
d'amincir un bouton ne font qu'une idée**. La seconde
(`docs/maquettes/15-encore-six-gestes.html`) change donc de nature à chaque
fois : la ligne du registre, le titre qui porte l'action, la marque
d'imprimeur, le cinquième onglet, tirer pour ouvrir, le signet sur la tranche.
La troisième vient de lui : il a décrit le geste lui-même — *« une sorte de
pastille un peu ronde »*, qui *« se mette à tourner super vite »*, *« dégage
comme une sorte d'onde ou de petits fragments »*, et ouvre la feuille *« au bout
d'une demi-seconde »*. Elle est dessinée, et **pressable**, dans
`docs/maquettes/16-la-pastille-qui-tourne.html` — trois habillages, plus une
version sous le pouce.

**Rien n'est codé** tant qu'il n'a pas désigné le sien. Le 11 août, la pastille
avait été portée d'un coup dans l'application ; il l'a arrêté net — *« crée-moi
une maquette avant de changer quoi que ce soit »* — et le changement a été
défait. La règle est désormais dans `CLAUDE.md` §3 bis.

**Ce que coûtera la pastille, le jour où il la choisit** (mesuré, puis défait) :
le bloc `<Link>` de `EcranChantiers.tsx`, une trentaine de lignes de
`globals.css` pour le tour, l'onde et les éclats, une variable `--or` dans la
palette, une suite qui mesure la demi-seconde, et un script de capture. Une
demi-journée, sans surprise connue. Deux points à ne pas oublier : l'appui doit
s'enfoncer **tout de suite** (140 ms) sinon la demi-seconde passe pour une
panne, et un second appui pendant le geste doit être ignoré, sans quoi deux
chantiers naissent au lieu d'un.

Ce que coûtera la bascule, une fois le choix fait : **un seul endroit**, le
bloc `<Link>` de `src/app/EcranChantiers.tsx` (lignes 151-167). Vérifié plutôt
que supposé : les suites navigateur atteignent `/chantiers/nouveau` **par son
adresse**, aucune ne cherche le libellé — changer la présentation n'en casse
donc aucune, et **c'est justement le risque** : rien ne se plaindra si l'action
devient introuvable au doigt. Prendre une capture (`CLAUDE.md` §5) et rejouer
`test-rien-de-recouvert-e2e` — la suite qui mesure ce que le mobilier fixe
recouvre, et la seule qui verrait le défaut de la proposition E.

**Trois réserves à ne pas perdre.** La pastille flottante (E) entre en conflit
avec la bulle de l'assistant, qui occupe déjà ce coin — la maquette le montre
plutôt qu'elle ne le tait. Le cinquième onglet (J) **supprime** cette bulle :
c'est une décision à prendre avec lui, pas un détail de mise en page. Et le
geste de traction (K) ne doit jamais partir seul : un geste caché est élégant le
premier jour et coûteux le trentième, quand un remplaçant prend le téléphone.

### 0 duodecies. `test-devis-papier-e2e` échoue sur le banc local

`TypeError: Cannot read properties of undefined (reading 'id')` — la suite
cherche une ligne dans `devis` pour son chantier et n'en trouve aucune.

**Ce n'est PAS la refonte** : vérifié en remisant les modifications et en
rejouant la suite sur le code d'avant — même échec, à la même ligne. Le défaut
lui est antérieur. Reste à savoir s'il tient au harnais (`run-e2e-tests` monte
son propre serveur et son propre jeu de données) ou à la suite elle-même. À
reproduire d'abord par `npm run test:e2e` complet avant de conclure.

### 0 bis. L'agent qui apprend — LA SUITE, demandée explicitement

**Consigne du patron, le 6 août 2026, après la fusion de la mémoire des
corrections :** *« Ok, garde ça en mémoire et on fera ça après. N'oublie pas de
le faire. »*

C'est donc **le prochain travail**, pas une liste d'idées. Une conversation qui
reprend à froid enchaîne sur (b), puis (c), puis (d) — sans reposer la question.
C'est la deuxième fois qu'il demande expressément qu'un point soit consigné
plutôt que retenu (la première : la sauvegarde, §0) ; le lui faire répéter une
troisième serait une défaillance de ce fichier.

Le tapis roulant (dictée → devis, d'un seul geste) est en place, l'arrêt
d'avant-chiffrage aussi (§0 ter), et la mémoire des corrections également
(§0 quater). Reste, dans l'ordre décidé avec lui le 5 août 2026 :

| | Quoi | Pourquoi maintenant |
|---|---|---|
| a | ~~**Mémoire des corrections.**~~ **Fait le 6 août 2026** — voir §0 quater. | |
| a bis | ~~**Le découpage des lignes, et la grille de fendage.**~~ **Fait le 8 août 2026** — voir §0 quinquies. | |
| b | **Entretien de départ.** Il n'a aucun ancien devis à donner en référence — c'est donc l'agent qui l'interroge une fois et écrit ses règles. | Sans ça, l'agent démarre en ne sachant rien et apprend aux frais du patron. |
| c | **Écart devis / facture.** Les données existent déjà des deux côtés. | La meilleure leçon qui soit : ce qui avait été mal estimé s'y voit tout seul. |
| d | **Photos ↔ prix.** Conserver le lien entre les photos d'un chantier et le devis qui a suivi. | Objectif du patron : « à force de comparer les photos des arbres et les devis, il devra proposer un prix juste ». Impossible aujourd'hui — mais **l'accumulation doit commencer maintenant**, sinon dans six mois il n'y aura toujours rien à apprendre. |

**Et un cinquième point, né du lot du 6 août :** le **rapport entre techniques**
(×1,67, ×2,33 — `docs/EXEMPLE-DICTEE.md` §9a). Il ne s'écrit pas en dur : c'est
une moyenne mobile, recalculée sur les devis réellement faits. Il ne peut donc
exister qu'à partir de plusieurs chantiers comparables — `lecons_prix` les
accumule depuis le 6 août. **À reprendre quand la mémoire est fournie**, pas
avant : un rapport tiré d'une seule observation serait une règle inventée.

**Réserve levée le 5 août 2026.** Un prix déduit d'une photo est une estimation,
ce que `docs/AGENT.md` §3 interdisait. Le patron a tranché : *« rien ne sera
jamais envoyé sans vérification du patron, ça restera qu'une proposition. »* La
règle est assouplie — l'estimation est permise **à condition d'être signalée
comme telle**, et c'est l'arrêt 1 qui porte la garantie. Voir `AGENT.md` §3.

**Et une contrainte de fond, soulevée par le patron le même jour :** *« si
l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ? »* Il a
raison, et ça conditionne (a) à (d). L'application a bien une mémoire — une base
PostgreSQL sur volume persistant — mais **celle du banc d'essai meurt avec
l'espace de travail**, qui est jetable par construction. Tout ce qui s'apprend
ne sera durable qu'une fois l'hébergement choisi (point 3 de `A-FAIRE.md`).
Construire l'apprentissage sur le banc reste utile pour l'éprouver ; ce qui s'y
accumule ne doit pas être présenté comme conservé.


### 1. Agenda Google — au choix de chaque artisan

> **Fait le 9 août 2026, sauf les identifiants.** L'écran « Mon agenda », le
> stockage chiffré, la fusion dans la disponibilité et les deux chemins du
> client sont écrits et éprouvés (`ARCHITECTURE.md` §39). **Ce qui reste tient
> en une chose, et elle n'est pas codable** : les identifiants OAuth, que seul
> le patron peut créer (`docs/A-FAIRE.md` §7). Tant qu'ils manquent, l'écran
> l'annonce et ne propose aucun bouton.
>
> **Et ce qui n'a pas pu être éprouvé ici** : l'aller-retour réel avec Google —
> autorisation, échange du code, renouvellement du jeton. Trois appels HTTP, pas
> davantage : tout ce qui décide en a été sorti exprès. À vérifier chez lui, le
> jour où les identifiants existent.

**Partiellement bloqué.** La connexion du compte demande des identifiants OAuth
que le patron doit créer ; le reste est codable. Le point bloquant est détaillé
dans `docs/A-FAIRE.md` §7.

Aujourd'hui, les jours libres se déduisent des seuls chantiers planifiés dans
Atlas (`src/server/disponibilites.ts`). Un patron qui tient son agenda ailleurs
verra donc proposer des jours où il est déjà pris — et c'est le client qui
choisira ce jour-là.

**Décision du patron, le 9 août 2026** — *« ce qui serait bien, c'est que
l'utilisateur puisse, s'il le souhaite ou non, connecter son planning à son
agenda Google »* — et elle contraint la conception :

- **C'est un choix par artisan, pas un réglage de l'application.** Chacun relie
  son agenda ou ne le relie pas. Celui qui ne relie rien garde exactement
  l'Atlas d'aujourd'hui : pas d'écran en plus, pas de compte à créer, aucun
  chemin de code nouveau à traverser.
- **Le jeton de raccordement appartient à l'entreprise**, donc il vit en base
  sous RLS, comme tout le reste — jamais dans une variable d'environnement
  partagée, qui vaudrait pour tout le monde à la fois.
- **Atlas ne lit que les créneaux occupés.** Jamais l'intitulé, jamais les
  participants. Un agenda personnel porte les rendez-vous médicaux et les
  vacances de la famille ; Atlas n'en a pas besoin pour savoir qu'une journée
  est prise. Même règle qu'à la page du client, qui reçoit des dates et rien
  d'autre (`docs/AGENT.md` §2.2 bis).
- **Une seule fonction de disponibilité**, jamais deux. La fusion des créneaux
  Google et des chantiers Atlas se fait *dans* `src/server/disponibilites.ts`.
  Un second calcul à côté finirait par diverger du premier — c'est exactement le
  défaut qui a produit, le 9 août, un chantier rangé dans deux onglets à la fois
  (`ARCHITECTURE.md` §33).

À faire une fois les identifiants disponibles : le bouton « Relier mon agenda »
dans les réglages, le raccordement du compte, la lecture des créneaux sur la
fenêtre de proposition, la fusion ci-dessus, et l'écriture de l'intervention
après acceptation.

**Ce qui ne pourra pas être éprouvé ici :** sans compte Google raccordé, aucun
contrôle local ne parcourt le vrai chemin. La partie fusion, elle, est une
fonction pure et s'éprouve entièrement (`CLAUDE.md` §5).

### 2. Code SMS en renfort de l'acceptation

L'acceptation conserve déjà l'empreinte du PDF, l'horodatage, l'adresse IP et le
canal (`docs/AGENT.md` §5, ligne « Acceptation tracée »). Ce qui manque est un
code à usage unique envoyé au client au moment où il accepte.

**Sans objet en l'état** : le patron a écarté tout fournisseur d'envoi
(`ARCHITECTURE.md` §13), et un code qu'il devrait transmettre lui-même
n'apporterait rien. À rouvrir seulement si un fournisseur est un jour souscrit.

### 3. Relance automatique d'un devis sans réponse

L'état « à relancer » existe, s'affiche, et le lien reste proposé pour un renvoi
manuel. **Sans objet en l'état**, pour la même raison qu'au point 2 : la relance
part de la messagerie du patron, comme l'envoi.

### 4. L'assistant répond en JSON brut

Interrogé « Comment a été envoyé le devis ? », il a répondu :
`D'après LireDevis, voici ce que j'ai trouvé : {"existe":true,"numeroCommercial":"2026-0003",…}`.
Le patron n'a pas à lire du JSON. L'assistant doit répondre en français, ou dire
qu'il ne sait pas — et jamais recracher la sortie d'un outil telle quelle.

### 5. ~~Les équipes nommées~~ — fait le 10 août 2026

**Demandé par le patron le 10 août** : *« il faut que dans le fichier réglages
on puisse mettre le nom des équipes — soit équipe A équipe B, soit des noms et
prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas qu'il y
ait quand même écrit équipe A équipe B. »*

Table `equipes` (`nom` **nullable**), colonne `chantiers.equipe_id`, et une
seule fonction pure qui décide du libellé (`src/lib/equipes.ts`). Le planning se
lit désormais au mois, avec une ligne par équipe sous chaque demi-journée.
Détail et pièges dans `ARCHITECTURE.md` §51 et §52.

**Ce qui n'a PAS bougé, et qu'il ne faut pas « corriger » :**

- **`entreprises.nombre_equipes` fait toujours autorité sur le NOMBRE.** La
  table ne porte que des noms. Un `COUNT(*)` ferait dépendre le calcul des
  disponibilités de lignes qu'aucun écran n'oblige à créer.
- **Aucun nom n'est écrit en base au moment de l'insertion.** Le repli
  « Équipe A » est un affichage — l'écrire en donnée le rendrait indiscernable
  d'un nom choisi, et un retour à une seule équipe le ferait parler.

Écarté aussi, et volontairement : les **heures réelles** (« la demi-journée
suffit ») et la **capacité en hommes** — `taille_equipe` est du texte libre, il
faudrait le fiabiliser avant d'en faire une contrainte. Voir `ARCHITECTURE.md`
§22 pour les arbitrages.

### 5 bis. ~~« Terminés » et le parcours de facturation~~ — fait le 10 août 2026

Le §6 quinquies de `docs/INTEGRER-ORIGINE.md` : l'écran devient un **fil par
mois**, l'encart « à facturer » se pose **dans le mois** plutôt qu'à côté, et le
relevé de TVA cesse d'être un pavé pour devenir une ligne au pied.
`ARCHITECTURE.md` §53.

**Trois décisions du patron, prises le 10 août et à ne pas rouvrir :**

1. **« Fin de chantier » devient « Créer la facture »**, sur les trois écrans
   qui portaient le mot (fiche, planning, écran de facture). Le nom dit
   désormais ce que la touche fabrique.
2. **Une facture à 0,00 € s'affiche telle quelle**, sans mention ni
   avertissement. Il en a une dans ses données réelles (F2026-0001) : un
   montant nul se lit, il ne se commente pas.
3. **La bulle de l'assistant s'écarte du bandeau** — elle venait toucher la
   dernière ligne de l'écran.

**Ce qui a été vérifié et qui n'était PAS un défaut :** `listerChantiersTermines`
compte bien un chantier du 20 comme terminé **le 21**, jamais le 20 à minuit
(`ongletDepuisJalons` : `datePlanifiee < aujourdHui`). La journée entière reste
au planning — c'est de là que le patron clôture en rentrant.

### 7 bis. ~~Le retrait, partout~~ — fait le 10 août 2026

Le cinquième choix du patron sur les maquettes : « le tiroir des retirés »,
appliqué aux **huit** endroits qui suppriment (le recensement de
`docs/INTEGRER-ORIGINE.md` §4 bis en annonçait sept — le planning manquait).
Détail et pièges dans `ARCHITECTURE.md` §48.

**Ce qui reste de la fiche `docs/INTEGRER-ORIGINE.md` :** son §6, l'ouverture
de « Nouveau chantier » — et il porte un point de PRODUIT non tranché, à poser
au patron avant de coder : cet écran est aujourd'hui une page avec sa flèche de
retour, quand l'ouverture retenue raconte une feuille modale.

**Deux choses laissées telles quelles, et dites plutôt que tues :**

- **Les maquettes `/design/prix`** montrent encore l'ancienne croix nue et le
  bandeau flottant (`AnimatedRow`, `UndoToast`, qui ne servent plus qu'à
  elles). Elles sont découplées du produit depuis le 1er août ; les reprendre
  ou les retirer reste à décider, mais elles contredisent l'application.
- **Le geste en diagonale n'a pas pu être éprouvé ici** : le glissement
  horizontal du texte et l'accroche verticale du fil ne portent pas sur le même
  axe, mais un pouce, lui, bouge en biais. Un navigateur piloté ne le
  reproduit pas — à essayer sur un vrai téléphone.

### 7 ter. ~~L'anneau muet et la pellicule~~ — fait le 10 août 2026, au soir

Le §6 bis de `docs/INTEGRER-ORIGINE.md` : sur la fiche chantier, un **anneau
muet** remplace la ligne « Note vocale » comme accès direct — on le touche, la
note se lit ; on le pousse vers le haut, « Retirer » se découvre. Les photos
deviennent une **pellicule** dans le tiroir du bas, case « + » en tête, et la
ligne « Photos · 6 photos » disparaît. Détail et pièges dans
`ARCHITECTURE.md` §49.

**L'en-tête de la fiche ne bouge pas — ~~à trancher~~ TRANCHÉ le 10 août 2026.**

La maquette `atlas-note-vocale.html` raconte en plus de l'anneau une **scène**
entière : grand titre serif, phrase de situation (« Intervention prévue vendredi
15 août »), à la place de l'en-tête commun. La question lui a été posée en
image ; sa réponse : **« N'y touche pas. »**

**Ne pas la rouvrir en découvrant l'écart avec la maquette.** L'écart est connu
et voulu. `EnTeteEcran` est **une seule pièce partagée** par la fiche, le
planning, les terminés, les réglages et les six écrans d'étape : la refaire
pour la seule fiche désaccorderait cet écran de tous les autres, et la refaire
partout serait un lot en soi, touchant l'accueil — que le patron a arrêté et
qu'il ne veut pas revoir.

Si le sujet revient, c'est **lui** qui le rouvre, et alors c'est « partout »
ou rien.

### ~~9. La ligne sous le nom, dans la liste des chantiers~~ — **tranché et codé le 13 août 2026 : le D, avec la date d'envoi**

**Le patron, le 13 août 2026 :** *« le devis a été envoyé et il n'a toujours pas
eu de réponse […] tu marques quelque chose du style devis envoyé, attente de
réponse, je te laisse libre de choisir et de proposer des alternatives si tu
penses qu'il faudrait rajouter d'autres informations à ce niveau-là. »*

**Il a retenu D**, en remplaçant le délai par la date : « DEVIS ENVOYÉ · SANS
RÉPONSE » en or, et dessous « Envoyé le jeudi 13 août. » La règle vit dans
`ligneEtatChantier` (`src/lib/chantier-etat.ts`), éprouvée sans base ni
navigateur. `ARCHITECTURE.md` §79.

**Les quatre autres restent dans la planche** — `docs/maquettes/41-la-ligne-sous-le-nom.html`,
engendrée par `scripts/engendrer-maquette-ligne-chantier.mts`. Si le sujet se
rouvre, repartir de là :

| | Libellé | Ce qu'elle apprend |
|---|---|---|
| A | « Devis envoyé · en attente de réponse » | ses mots, au plus court |
| B | « Envoyé il y a 3 jours · sans réponse » | **le délai — la seule chose qui décide une relance** |
| C | « Envoyé le 10 août · valable jusqu'au 24 » | quand le devis cessera d'être ouvrable |
| D | deux lignes, la seconde en clair | ce qu'il y a à faire, en toutes lettres |
| E | avec le montant | lequel rappeler en premier |

**Ce qui contraint le choix, et qui a été MESURÉ sur l'écran** (`ARCHITECTURE.md`
§78) : le libellé actuel tient sur une ligne à 430 px — la largeur de son
téléphone — et déborde à 390. A et B tiennent chez lui ; C et E débordent
partout.

**Deux points à lui redire quand il tranchera :**

- la mention « sans photo » n'a plus d'utilité une fois le devis parti : elle
  disparaît dans toutes les propositions ;
- l'or est réservé à ce qui **attend un geste de lui**. Un devis parti sans
  réponse n'attend rien de lui, d'où le gris. **D est la seule qui rouvre ce
  choix**, et c'est délibéré.

E est la seule qui coûte une sous-requête de plus (le montant n'est pas chargé
par l'écran d'accueil).

### 8. L'écran Facture — trois manques signalés par le patron le 10 août 2026

Constatés par lui sur son banc, capture à l'appui. Aucun n'est corrigé.

1. **Impossible d'enregistrer la facture.** Sous « Voir la facture en PDF », il
   veut **un petit lien pour la télécharger** sur son téléphone ou son
   ordinateur. Aujourd'hui il ne peut que l'ouvrir. Un `<a download>` vers la
   route du PDF suffit, avec un nom de fichier qui porte le numéro de facture —
   « F2026-0001.pdf », pas « facture.pdf » : il en aura des centaines.
2. **« Ouvrir le SMS tout prêt » est carré**, alors qu'il le veut **ovale comme
   tous les autres**. À éclaircir avant de coder : depuis le 10 août tous les
   boutons sont à 5 px de rayon (`radius.button`). Lui montrer deux variantes
   plutôt que deviner — et si c'est bien un bouton en gélule qu'il veut,
   **c'est la charte entière qui change**, pas ce bouton-là.
3. **On ne propose que le SMS.** Il veut pouvoir **envoyer la facture par
   e-mail**. `composerMessageFacture` et `lienTransmission` savent déjà faire
   les deux (`src/lib/message-client.ts`, canal `"email"`) : c'est l'écran de
   la facture qui n'offre pas le choix. Voir comment l'écran du devis propose
   SMS **ou** e-mail, et faire pareil.

Le troisième est le plus important : une facture qu'on ne peut pas envoyer par
courriel, c'est un client sur deux qu'on ne peut pas facturer.
Constatés par lui sur son banc, capture à l'appui.

**⚠ Ce point avait été consigné sur `claude/migrate-app-atlas-zz31ac` et n'a
jamais rejoint `main`** : cette branche est restée deux commits derrière une
après-midi de travail, et le point était donc invisible de toute conversation
qui lisait `TODO.md`. Il a fallu qu'il le redemande. **La leçon est celle de
`CLAUDE.md` §6 : rien n'est livré tant que ce n'est pas sur `main`** — pas même
une ligne de mémoire.

1. ~~**Impossible d'enregistrer la facture.**~~ — **fait le 12 août 2026.**
   Sous « Voir la facture en PDF », un lien « Télécharger (F2026-0001.pdf) ».
   Le nom porte le numéro — il en aura des centaines — et dit « brouillon »
   tant que la facture n'est pas arrêtée. **C'est le SERVEUR qui range le
   fichier** (`Content-Disposition: attachment` sur `?telecharger=1`) : le seul
   attribut `download` du lien est ignoré par certaines versions d'iOS, et le
   PDF s'ouvrait alors dans un onglet sans rien enregistrer.
2. ~~**« Ouvrir le SMS tout prêt » est carré**, alors qu'il le veut **ovale
   comme tous les autres**.~~ — **tranché et codé le 12 août 2026 : « code la
   A », la capsule.** Le bouton passe par `PrimaryButton`, jamais par un dessin
   recopié sur place : c'est le défaut même qu'on répare (§0 octies), et le
   repeindre à la main le ferait revenir au prochain changement de charte.

   **Deux réglages facultatifs ont été ajoutés à `PrimaryButton`**, sans
   toucher au dessin : `onClick` est désormais honoré sur la variante `href`
   (elle le perdait en silence — le départ vers la messagerie n'aurait plus été
   retenu), et `repere` pose un `data-atlas` pour que les suites désignent ce
   lien autrement que par son texte.

   *Les planches restent, elles racontent le chemin :*

   - `docs/maquettes/38-le-bouton-de-la-facture.html` — deux dessins immobiles :
     **A**, la capsule exacte des dix-sept autres écrans ; **B**, la même
     capsule cernée d'un filet ;
   - `docs/maquettes/39-le-bouton-de-la-facture-a-lessai.html` — **cinq gestes
     qui se pressent pour de vrai**, demandés le 12 août : *« plusieurs versions
     cliquables et dynamiques […] une appli hyper luxe et moderne »*. A la
     capsule nue, B la lueur qui traverse la laque, C le cachet qui tourne et
     sème l'or, D l'encre qui remplit, E le trait qui s'ouvre. Éprouvée au doigt
     par `scripts/verifier-maquette-bouton-facture.mjs`.

   **Il a retenu A**, la capsule nue — la retenue, encore une fois, comme à
   chaque tournée depuis le 11 août. Les quatre gestes écartés (la lueur, le
   cachet, l'encre, le trait) restent dans la maquette : s'il rouvre le sujet,
   c'est là qu'il faut repartir, et non les redessiner.

   **Ce qu'il faut lui dire, et qui a changé depuis sa demande :** le 10 août,
   tous les boutons étaient à 5 px de rayon et « ovale » aurait voulu dire
   changer la charte entière. Le 11 août au soir il a choisi la capsule, et
   « partout » — ce bouton-là est simplement passé au travers, parce qu'il est
   **peint à la main dans l'écran** (`TODO.md` §0 octies, même défaut que la
   feuille d'envoi du devis). **Choisir A ne rouvre donc aucune décision.**

   *Une capsule pleine largeur avait été dessinée d'abord : mesurée, elle est
   indiscernable de A — le libellé remplit la carte à deux pixels près. Deux
   dessins identiques ne font pas un choix, d'où le changement d'axe.*
3. ~~**On ne propose que le SMS.**~~ — **fait le 12 août 2026, et c'était le
   plus grave.** Une facture qu'on ne peut pas envoyer par courriel, c'est un
   client sur deux qu'on ne peut pas facturer. L'écran offre désormais les deux
   voies (`src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx`), et **la coordonnée manquante se
   saisit sur place** — il n'existe aucun écran de fiche client où l'envoyer.
   `ARCHITECTURE.md` §73.

### 7. Finir la refonte — l'ordre, les pièges, les valeurs

**Ce point existe pour qu'une conversation neuve puisse reprendre le travail
sans rien redemander.** Le CSS n'est pas recopié ici : il est dans la maquette
publiée, `docs/maquettes/13-le-fil-quatre-couleurs.html`, qui est du HTML pur —
ouvrez-la, lisez la feuille de style, elle fait foi pour le dessin.

#### L'ordre, et où l'on en est

| | Écran | État |
|---|---|---|
| — | Accueil, Planning, Terminés, Réglages, relevé de TVA | **fait** le 10 août 2026 |
| — | Fiche chantier, entièrement | **fait** |
| — | En-tête + boutons des six écrans d'étape | **fait**, par remplacement de motif |
| — | Corps de Photos | **fait** |
| ~~1~~ | ~~Corps de **Note vocale**~~ | **fait** le 10 août 2026 |
| ~~2~~ | ~~Corps d'**Informations** puis de **Prix**~~ | **fait** le 10 août 2026 |
| — | Fiche chantier : **l'anneau muet** et **la pellicule** | **fait** le 10 août 2026, au soir |
| **3** | Corps de **Devis**, **Export**, **Facture** | à faire |

**Ce que l'étape 2 a appris, et qui sert à l'étape 3.**

- **Les deux voix sont désormais des jetons** : `libelleCaps` et
  `texteSituation` dans `src/lib/design-tokens.ts`. Ne plus les retaper à la
  main. `smallCaps`, l'ancienne voix, ne sert plus qu'aux maquettes
  `/design/*` — un écran qui l'importe encore n'est pas refait.
- **L'écran Informations n'était pas dans « les six »** : son en-tête avait été
  oublié le 10 août au matin, et il est passé à `EnTeteEcran` avec son corps.
  Vérifier que **Transcription** ne dort pas dans le même angle mort.
- **Une action en capitales prend deux fois la place.** « Voir la
  transcription » à droite du titre repliait le nom du chantier sur deux
  lignes ; une flèche de plus faisait passer « Aller jusqu'au devis d'un seul
  geste » à deux lignes, la flèche seule sur la seconde. Mesurer avant, ou
  déplacer l'action.
- **Une plage occupe la largeur ; une action en toutes lettres s'aligne à
  gauche.** Sans `self-start`, un bouton texte s'étire et se centre tout seul.
- **`innerText` rend le texte TEL QU'IL S'AFFICHE.** Trois contrôles cherchaient
  « Prix Calculé » ou « Déjà au détail » ; les capitales les ont cassés sans
  qu'aucun défaut n'existe. Le réflexe utile : avant de corriger le produit,
  regarder si le contrôle lit du rendu ou de la donnée.
- **Prendre la capture d'abord, et à deux endroits** :
  `npx tsx scripts/capture-etape.mts <dossier> <chantierId> <étape…>` écrit le
  haut ET le bas de chaque écran. Les deux défauts réels de l'étape 2 — une
  croix hors de l'écran, la bulle sur le bouton — n'étaient visibles que là.
- **Le jeu de démonstration ne pose ni brouillon ni dictée analysable ici** :
  pour regarder un écran plein, insérer soi-même une ligne dans
  `brouillons_informations`. Sans cela on juge un écran vide.

Il n'y a plus de motif commun à remplacer : chacun a sa structure, donc plus de
codemod possible. C'est du cas par cas, **et chaque écran se regarde en capture
avant d'être déclaré fait** — trois défauts réels de cette refonte n'ont été
trouvés que là (`CLAUDE.md` §5).

#### Les valeurs de la grammaire

Elles ne s'inventent pas écran par écran : elles viennent des trois pièces
partagées — `EnTeteEcran`, `PrimaryButton`, `src/lib/design-tokens.ts`.

| Quoi | Valeur |
|---|---|
| Marge horizontale | **26 px** partout (`px-[26px]`), jamais 24 |
| Rayon | **4 px** pour une plage, **5 px** pour une action. Rien au-delà |
| Ombre | **aucune** (`cardShadow` vaut `"none"`) |
| Titre d'écran | serif, **36 px**, `letter-spacing: -0.018em` |
| Nom d'un chantier, intitulé d'étape | serif, **19 px** |
| Libellé, état, action secondaire | capitales, **9,5 px**, `letter-spacing: 0.28em` |
| Texte de situation (adresse, meta) | **11,5 px**, en `colors.muted` |
| Séparateur | un cheveu d'1 px, `colors.line` |
| Couleur d'attente | l'or, **et uniquement sur ce qui réclame un geste du patron** |

#### Les pièges, tous rencontrés une fois

1. **`npm run banc` ne rebâtit que si le commit a changé.** Tant que le travail
   n'est pas commité, il ressert la version d'avant : on mesure du code qui
   n'est pas sur le disque. `rm .next/atlas-version-batie.txt` force le rebâti.
2. **`npm test` abîme le jeu de démonstration.** Après la batterie, la connexion
   `demo@atlas.local` échoue jusqu'à un nouveau
   `DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed`.
3. **Un bandeau posé dans l'en-tête écrase la liste.** Tout ce qui peut
   apparaître (notifications, annonces) va DANS la zone qui défile.
4. **`CarteGlissante` repeint ce qui est dessous** : sa couche porte le fond de
   la page. Un trait dessiné sous une liste glissante disparaît — le dessiner
   ligne par ligne.
5. **`position: sticky` est borné par le PARENT**, pas par le conteneur qui
   défile. Un élément collant enfermé dans un `div` d'une ligne ne colle que sur
   cette ligne : utiliser un fragment.
6. **Une feuille en `absolute` passe SOUS le bandeau et la bulle**, tous deux
   fixés. Une feuille modale se pose en `fixed`, au-dessus de `z-40`.
7. **Le navigateur d'essai** : `chromium.launch({ executablePath:
   "/opt/pw-browsers/chromium" })`, sinon Playwright réclame une installation
   qui est pourtant là (voir §0).

#### Les deux réserves — ce qui ne doit PAS suivre

- **Les maquettes `/design/*`** : découplées du produit depuis le 1er août,
  elles ne sont pas des écrans du patron.
- **Les pages que le CLIENT reçoit** — `devis/[jeton]`, `factures/[jeton]`, et
  le PDF. Un devis n'est pas un écran : c'est la pièce que le client garde,
  imprime et signe, et le patron a choisi sa terre cuite le 3 août **en
  connaissance de cause**, puis l'a maintenue.

**~~Question ouverte~~ — tranchée par le patron le 10 août 2026 :** *« il faut
que toutes les écritures de l'appli changent de police, on harmonise le tout. »*
Le devis et la facture suivent donc l'écran, et il n'y a plus d'exception de
typographie nulle part.

**Et la couleur suit aussi**, tranchée dans la foulée : *« oui, harmonise aussi
le devis »*. La terre cuite disparaît, l'accent des documents devient l'or.
`couleursDocument` reste néanmoins un jeton à part — papier et encre d'une
pièce imprimée ne suivront pas forcément un futur écran sombre.

Le **PDF**, lui, n'a jamais chargé Playfair ni Inter : il embarque Times et
Helvetica, les polices standard du format — il était déjà d'accord avec ce que
l'écran est devenu.

### 6. Rien ne mène le patron d'un écran au suivant

**Le tronçon principal est réglé** (2026-08-04) : depuis la transcription, un
seul appui va jusqu'au devis chiffré. Restent les marches d'à côté — après une
photo, après un tarif enregistré, après une facture émise, rien n'indique où
l'on va. Un écran qui ne dit pas la suite se lit comme une application en panne,
et c'est déjà arrivé.

---

## Terminé

- ~~La TVA n'entre au relevé qu'au paiement, avec l'endroit où les factures attendent~~ — 2026-08-16
- ~~Ajouter et retirer des cases : tranches, façons d'abattre et travaux se règlent~~ — 2026-08-14
- ~~L'unité d'un tarif se choisit dans un bandeau déroulant, sans fermer la case~~ — 2026-08-14
- ~~Reprendre l'application Arborea sans le site vitrine, et la publier~~ — 2026-07-31
- ~~Vérifier le site publié à son adresse publique~~ — 2026-07-31
- ~~Cadrer l'agent (`docs/AGENT.md`) et la conformité (`docs/RGPD.md`)~~ — 2026-08-01
- ~~Acceptation des documents légaux avec empreinte~~ — 2026-08-01
- ~~Page publique de réponse du client, jeton, expiration, contre-proposition~~ — 2026-08-01
- ~~Purge de l'audio, export et effacement d'un client~~ — 2026-08-01
- ~~Envoi du devis au client, canal recueilli à la création~~ — 2026-08-01
- ~~Onglet « Terminés », fin de chantier, facture, relevé de TVA~~ — 2026-08-01
- ~~Suivi du devis parti : cinq états, notification, reprise~~ — 2026-08-01
- ~~Mémoire permanente du dépôt (ces fichiers)~~ — 2026-08-01
- ~~Caducité distincte du refus, et remontée à l'accueil~~ — 2026-08-01
- ~~Compteur d'accueil : ne plus compter les chantiers facturés~~ — 2026-08-01
- ~~Découpler les maquettes `/design/*` du type de statut vivant~~ — 2026-08-01
- ~~Le devis PDF reprend le modèle d'Arborea, et se pagine~~ — 2026-08-03
- ~~`test-reglages-e2e.ts` : attendre l'enregistrement, pas un délai fixe~~ — 2026-08-03
- ~~Document PDF pour la facture, sur le moteur partagé avec le devis~~ — 2026-08-03
- ~~Le devis à 0 € : bouton grisé, marche à suivre, et refus côté serveur~~ — 2026-08-03
- ~~Navigation : la barre du bas reste (décidé) ; l'action principale prend la carte d'Arborea~~ — 2026-08-03
- ~~La dictée arrivait amputée à l'écran : découpage, durée, vocabulaire, déchets~~ — 2026-08-03
- ~~Écrire le devis soi-même depuis l'écran Informations~~ — 2026-08-03
- ~~Le devis doublait au retour arrière du navigateur (4 017,60 € au lieu de 2 008,80 €)~~ — 2026-08-03
- ~~« Fin de chantier » injoignable sur un chantier planifié~~ — 2026-08-03
- ~~Planifier en demi-journées, et compter les équipes (le client ne voit que la date)~~ — 2026-08-03
- ~~Le client peut demander une correction, et son message parvient au patron~~ — 2026-08-03
- ~~La durée du chantier se choisit à la molette (½ journée à 100 jours)~~ — 2026-08-03
- ~~La durée dictée n'entrait pas dans la planification : un chantier de 2 jours n'en bloquait qu'un~~ — 2026-08-03
- ~~Le SMS s'ouvrait sans destinataire ; le canal se change désormais, et la coordonnée manquante se saisit sur place~~ — 2026-08-04
- ~~De la dictée au devis en un seul geste, et plus aucun écran mort quand le fournisseur répond à côté~~ — 2026-08-04
- ~~L'espace d'essai récupère le code neuf à chaque allumage, et l'application annonce sa version~~ — 2026-08-04
- ~~La date des documents s'écrit jour/mois/année~~ — 2026-08-04
- ~~La bande des durées est aussi sur l'écran Informations, là où il la cherchait~~ — 2026-08-04
- ~~Rédiger le devis entièrement à la main, depuis la fiche du chantier~~ — 2026-08-04
- ~~Retirer la case « Nom du chantier » : plus rien n'est obligatoire à la création~~ — 2026-08-05
- ~~« Rédiger à la main » ouvre le devis ENTIER, à l'image du modèle, et il reste dans Atlas~~ — 2026-08-05
- [x] ~~**Le calendrier n'offre que 2 jours sur une base fraîchement montée.**~~
  Réglé le 24 août 2026 par une autre session, dans l'heure — les deux suites
  (`test-deux-dates-calendrier-e2e`, `test-date-lointaine-e2e`) passent après
  fusion. **Ce qui reste à en retenir** : elles étaient vertes deux heures plus
  tôt sur la même version, et rouges sur une base neuve. Un contrôle qui dépend
  de l'âge de la base accuse au hasard — c'est la même leçon que l'instabilité
  notée juste au-dessus.
- [ ] **La batterie rougit sur des suites DIFFÉRENTES à chaque exécution**, et
  chacune passe seule sur le même code. Relevé le 24 août 2026, trois
  exécutions d'affilée : d'abord `test-planning-vers-facture-e2e` (un texte
  attendu qui n'apparaît pas), puis `test-fiche-chantier-e2e` et
  `test-prix-e2e` (un prix lu à `0.00` au lieu de `34.50`). **Rejouées seules,
  les trois sont vertes.** Ce n'est donc pas le produit : c'est l'interférence
  entre suites — le lanceur partage UN serveur et UNE base entre toutes.
  Écarté au passage : le gel d'horloge de `test-allure-pdf` ne peut pas fuir,
  chaque suite est lancée par `spawnSync` dans son propre processus.
  **Pourquoi ça compte plus qu'un agacement** : un rouge qui tombe au hasard
  s'apprend à être ignoré, et le jour où il dit vrai personne ne le croit —
  c'est exactement ce qui a coûté une soirée avec `test:arrosage`. *(24 août 2026)*
- [ ] **Rendre la composition d'un PDF reproductible.** `pdf-lib` grave l'instant
  de fabrication dans chaque document : deux compositions du même devis ne
  rendent pas les mêmes octets. La suite le contourne en figeant l'horloge
  (`aLaMemeSeconde`, `scripts/test-allure-pdf.ts`), mais le produit reste
  non déterministe — un même devis renvoyé n'est jamais identique au précédent.
  Corriger demande de toucher le composeur, donc les documents du patron :
  à faire dans un lot qui les regarde, pas en passant. *(24 août 2026)*
