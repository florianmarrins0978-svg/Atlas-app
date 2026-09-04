# Le devis, de la dictée à l'écran du client — verdict

*Lot du 3 septembre 2026. Périmètre : les quatre surfaces du devis. Ni
l'arrosage, ni le planning, ni la facture — sauf pour dire ce que le devis leur
casse.*

---

## En cinq lignes

Trois défauts réparés, un mesuré et laissé à votre arbitrage, une planche à
regarder. Le compteur « (96 s) » a une explication, trouvée dans le code et non
supposée : l'écran d'attente ne savait reconnaître qu'une seule des six issues
de la chaîne. L'envoi écrivait en deux temps sans filet, et son refus accusait
une journée prise là où la date était simplement passée. Un bouton s'éteignait
sans un mot chez vous, alors que la même règle était tenue chez votre client.

**La planche à regarder, adresse entière :**
https://florianmarrins0978-svg.github.io/Atlas-app/ecran-de-son-client.html

---

## 1. « Atlas prépare toujours votre devis… (96 s) » — expliqué, pas deviné

**Verdict : défaut réel, réparé. La cause était dans le code, pas dans une
hypothèse sur votre machine.**

Le fichier qui le prouve : [`src/lib/attente-devis.ts`](../src/lib/attente-devis.ts),
[`src/app/api/chantiers/[chantierId]/devis-pret/route.ts`](../src/app/api/chantiers/%5BchantierId%5D/devis-pret/route.ts).

### Ce que votre capture prouvait déjà

Ce compteur n'est atteignable que par **une seule voie** : le rattrapage écrit
le 12 août, celui qui se déclenche quand la réponse du serveur **se perd**
(`DevisDepuisDictee.tsx`, le `catch`). Votre capture ne dit donc pas que la
chaîne a bouclé : elle dit que sa réponse n'est jamais revenue jusqu'à votre
téléphone.

### Le vrai défaut, et il rendait la panne inévitable

Ce rattrapage n'avait qu'un seul signal de réussite : « le devis est écrit ».
Or la chaîne s'arrête **légitimement sans écrire de devis** dans cinq de ses six
issues (`devis-depuis-dictee.ts`) :

| Issue | Un devis est-il écrit ? |
|---|---|
| dictée non transcrite | non |
| transcription simulée | non |
| brouillon corrigé à la main | non |
| échec | non |
| **arrêt d'avant-chiffrage** — vos deux questions à 800 € | **non** |
| devis préparé | oui |

Réponse perdue **plus** arrêt d'avant-chiffrage — le cas le plus fréquent d'une
vraie dictée d'arbre — donnait une attente qui **ne pouvait jamais aboutir** :
cinq minutes de compteur, puis « la préparation n'a pas abouti », devant un
serveur qui avait fini son travail et vous attendait avec ses questions.

### Un second défaut, découvert en le réparant

Le témoin lu était `devis_genere_at`. Il est posé par `getOuCreerDevisBrouillon`
— que **la page du devis appelle elle-même en s'ouvrant**. Sur cette page-là,
l'attente répondait donc « prêt » avant que la dictée ait produit la moindre
ligne, et vous ramenait sur une feuille vide.

L'écran, lui, décidait déjà sur le **nombre de lignes**
(`devis-a-preparer.ts`) : deux lectures d'une même question, dont une fausse.
Il n'en reste qu'une, et c'est celle de l'écran.

### Ce qui a changé

- l'attente rapporte l'arrêt d'avant-chiffrage et **l'écran le montre** :
  répondre termine le devis sans relire la dictée, donc sans rappeler le modèle
  ni renuméroter les questions ;
- le témoin est le nombre de lignes, plus une date qu'une page pose elle-même ;
- `questionsRestantes` est **exportée** plutôt que recopiée : la liste que la
  chaîne pose et celle que l'attente annonce ne peuvent pas diverger.
- un défaut voisin, trouvé en chemin : sur la page du devis, répondre aux
  questions faisait un `push` vers l'adresse courante — qui ne rejoue pas le
  rendu serveur. Vous répondiez, et vous restiez devant la feuille vide que vous
  veniez de remplir.

**Le contrôle sait rougir** : confronté à l'ancienne version, il tombe sur
« L'ARRÊT D'AVANT-CHIFFRAGE LA FAIT ABOUTIR » et sur elle seule (vérifié).

**Ce qui n'est PAS affirmé.** La panne n'a toujours pas été reproduite ici : ce
qui est réparé, c'est l'impossibilité d'en sortir. Si la réponse se perd encore
sur votre espace, l'écran vous montrera désormais où en est le travail au lieu
de compter.

---

## 2. L'envoi écrivait en deux temps, sans filet

**Verdict : défaut réel, réparé — et le refus mentait sur la cause.**

Le fichier qui le fonde :
[`src/app/chantiers/[id]/export/actions.ts`](../src/app/chantiers/%5Bid%5D/export/actions.ts),
[`src/lib/dates-envoi.ts`](../src/lib/dates-envoi.ts).

`envoyerDevis` fige le devis pour de bon — statut « envoyé », PDF archivé,
numéro consommé, document immuable — **puis** le lien du client se crée. Quand
la seconde moitié refusait une date, la première avait déjà eu lieu : le devis
était parti pour l'application et **n'existait nulle part pour le client**. En
rouvrant, vous lisiez « Ce devis est parti chez votre client : il ne se modifie
plus » — faux, sur une pièce qui ne se réécrit pas.

Et la phrase du refus disait *« Une des dates proposées n'est plus libre »*,
alors que l'occupation d'une journée ne refuse plus rien depuis votre règle du
23 août. Le seul motif restant est la fenêtre : une date **passée**, ou au-delà
de dix-huit mois. Vous cherchiez une autre date libre pour un jour qui n'avait
jamais été pris.

**Trois réparations :**

1. les dates sont validées **avant** que quoi que ce soit soit figé — le seul
   refus que le dépôt sache encore opposer ne peut plus surprendre un devis
   déjà parti ;
2. la phrase nomme le bon coupable et le geste qui débloque — « cette date est
   déjà passée […] choisissez un jour à venir », ou « dépasse dix-huit mois […]
   un jour plus proche » ;
3. l'écran ne dit plus « parti chez votre client » sans l'avoir vérifié : il
   demande si un lien existe réellement pour **ce devis-là**
   (`unLienExistePourLeDevis`), et écrit sinon « figé, mais aucun lien n'est
   parti », avec « Reprendre et envoyer ».

**Une règle, deux appelants** : l'action et le dépôt appellent la même fonction.
La suite qui l'éprouvait n'utilisait qu'une date à −30 jours et ne regardait
jamais la phrase ; `scripts/test-dates-envoi.ts` regarde les deux bords et
refuse le mot « libre ».

---

## 3. Un bouton éteint sans un mot — chez vous, pas chez votre client

**Verdict : défaut réel, réparé.**

Le fichier :
[`src/app/chantiers/[id]/export/EnvoiAuClient.tsx`](../src/app/chantiers/%5Bid%5D/export/EnvoiAuClient.tsx).

Sur l'écran de votre client, vous aviez fait retirer le bouton éteint : *« il
n'est plus éteint, et il ne porte plus sa phrase grise »*. Sur **votre** écran
d'envoi, l'inverse : « Envoyer le devis » s'éteignait dès qu'aucune date n'était
retenue, sans un mot.

Pire : la phrase existait — « Proposez au moins une date d'intervention » — et
elle était **inatteignable**. Un bouton désactivé n'appelle jamais la fonction
qui la pose. Elle n'a donc jamais pu s'afficher depuis qu'elle a été écrite.

Cela arrive pour de bon : agenda plein ou chantier long — aucun jour n'est
présélectionné —, ou quand vous décochez votre seule date.

Le bouton répond désormais, et c'est sa réponse qui dit ce qui manque.

---

## 4. L'écran de votre client débordait — vous avez tranché, c'est codé

**Verdict : défaut réel, mesuré, puis corrigé par votre réponse — le 4 septembre.**

Trois formes vous ont été soumises sur planche. Votre réponse : *« J'aime bien
la À la feuille »*. Le calendrier monte du bas, par-dessus, et la page derrière
garde exactement la hauteur qu'elle avait.

| état | avant | après |
|---|---|---|
| replié | 664 px | 664 px |
| **calendrier ouvert** | **990 px** | **664 px** |
| « Je ne donne pas suite » finit à | 963 px | 602 px |

**Et le contrôle ouvre enfin la feuille qu'il annonçait** : il ne mesurait que
l'état replié. Il a gagné au passage ce que personne ne vérifiait — qu'une date
RETENUE survive à la fermeture. Sans lui, une feuille qui viderait tout en se
refermant aurait passé le reste en beauté et perdu la date de votre client.

**Votre règle du 26 août tient, par un autre geste.** Le calendrier couvre le
bouton : on ne le rappuie plus pour le décocher, on referme la feuille — et le
choix se défait. Le contrôle a suivi la règle, pas la mise en page.

### Ce qui RESTE, avec le chiffre

Quand votre client retient une date à **moins de quatorze jours**, la case de
rétractation apparaît — 125 px — et la page fait **790 px** pour 664 d'écran.
Le pire cas est donc passé de 1 148 à 790, et le cas courant tient.

Deux façons d'y arriver, et les deux sont des arbitrages, pas des évidences :

| | ce que ça coûte |
|---|---|
| descendre la case DANS la feuille | mieux placée — elle parle de cette date-là — mais hors de vue au moment où il appuie sur « J'accepte ce devis », et c'est un consentement légal qui doit être exprès |
| replier la liste des dates une fois une date retenue | 60 à 70 px : insuffisant seul |

**Je ne tranche pas à votre place.** Dites-moi, ou laissez en l'état : 790 px
veut dire 126 px de défilement dans ce seul cas.

---

## 4 bis. Ce que la planche elle-même a coûté — deux fautes à moi

**« Rien ne change quand je clique sur A B C »** — vous aviez raison. Mon
gestionnaire refermait le calendrier à chaque changement de choix : refermés,
les quatre états rendaient exactement le même écran, et la planche ne montrait
rien de ce qu'elle demandait de comparer. Reproduit à son adresse, avec votre
geste, puis corrigé.

**Et le cadre annonçait « 390 × 664 pour de vrai »** en faisant 346 px de large
sur un écran de 390 : les marges le rognaient. Une phrase fausse à l'endroit
exact où vous alliez la lire.

Votre règle du 31 août tient tant que la contre-proposition reste repliée. Dès
qu'elle s'ouvre, mesuré sur votre écran de 390 × 664
(`scripts/mesurer-pli-devis-client.mts`) :

| état | hauteur de page | « Je ne donne pas suite » finit à |
|---|---|---|
| replié | 664 px | 602 px — tient |
| calendrier ouvert | **990 px** | **963 px** |
| + case de rétractation | **1 148 px** | **1 121 px** |

Vos trois issues passent donc sous le pli **à l'instant précis où le client
cherche une autre date** — c'est-à-dire au moment où ce parcours évite
l'aller-retour téléphonique.

**Pourquoi ce n'est pas corrigé :** ce qui doit céder sur 664 px est votre
arbitrage, pas une décision de code. Trois façons vous sont proposées, toutes
mesurées comme tenant dans l'écran, sur la planche ci-dessus.

**Et la suite qui l'éprouvait annonçait cette mesure sans la faire.** Son
commentaire disait « et la contre-proposition ouverte » ; elle ne l'ouvrait
jamais. Elle dit désormais exactement ce qu'elle mesure, et porte les trois
chiffres ci-dessus pour que personne ne les redécouvre.

---

## 5. Sa page et son PDF ne portent pas la même identité

**Verdict : constat réel. NON corrigé — une question vous est posée.**

`couleursDocument` existe précisément pour ce qui part chez le client, et son
commentaire dit son rôle : *« le jour où l'application passera au sombre, ce
fichier sera l'endroit où l'on empêchera le devis de partir en noir chez le
client »*. Le PDF y passe, et suit le papier et l'accent que vous réglez.

**La page que votre client ouvre en premier ne passe pas par là.** Elle code
ses couleurs en dur — `#F4EFE8`, `#2F3B2F`, `#B5502F` —, qui ne sont ni celles
du document (`#faf9f5`, or `#B98B47`), ni les vôtres. Le même devis, deux
identités, à une minute d'intervalle. Et le fond que vous choisissez dans
Réglages n'atteint pas cet écran.

C'est un changement d'apparence sur ce que voit votre client : il se dessine
avant de se coder. La planche porte la bascule.

---

## Ce qui a été VÉRIFIÉ et qui tient — pour ne pas le rouvrir

| Invariant | Comment il a été vérifié |
|---|---|
| La page par jeton éprouvée sous le rôle applicatif | `test-facture-jeton-rls.ts` couvre bien `lireParJeton` et `pdfDevisParJeton` du devis, pas seulement la facture |
| « Le devis ne part pas en noir parce qu'il a choisi Nuit » | `layout.tsx` coupe la charte sur `estPageDuClient`, et le middleware couvre `/devis` — lu, pas supposé |

---

## Ce qui a été REFUSÉ, et ce que ça aurait coûté

| Refusé | Ce que ça aurait coûté |
|---|---|
| Deviner une cause au « 96 s » et livrer un correctif | Réparer une panne imaginée. La cause trouvée est dans le code et se démontre ; une hypothèse sur votre machine aurait consommé un aller-retour de plus |
| Découper `DevisCompletClient.tsx` (1 637 lignes) | C'est le fichier qui écrit ce que votre client signe, et chaque bloc porte une panne payée. Le remanier pour sa taille aurait été le geste le plus risqué et le moins visible du lot |
| Corriger le débordement de l'écran client sans vous demander | Décider à votre place ce qui disparaît de la page que voit votre client |
| Changer les couleurs de sa page sans planche | Vous l'avez interdit six fois : une apparence se dessine d'abord |

---

## Ce que je vous ai promis de ne pas rouvrir, et qui n'a pas bougé

Les deux arrêts, l'envoi depuis votre messagerie, l'acceptation en ligne sans
devis signé renvoyé, le devis accepté sans date retenue, l'envoi non bloqué par
un SIRET ou un IBAN manquant, le devis envoyé figé, et les écrans de retour
« refus » et « correction » sans téléchargement.

---

## Ce qui reste ouvert, et qui peut le trancher

| Point | Qui |
|---|---|
| Question 1 de la planche — A, B ou C pour le calendrier du client | **vous** |
| Question 2 de la planche — la page suit-elle les couleurs de votre devis | **vous** |
| La panne du 96 s reproduite sur votre espace | **vous**, au prochain essai : l'écran nommera désormais l'état au lieu de compter |
| Neuf suites rouges hors du devis (banc, veilleur, rôles, port) | une session — mesurées ci-dessous comme antérieures à ce lot |

---

## Les chiffres exacts de la batterie

Jouée sur `atlas_test` — jamais sur `atlas_dev`, que `nettoyerBase()` aurait
vidé.

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | **vert** |
| `npm run lint` | **vert** — 0 erreur, 16 avertissements, tous antérieurs et hors des fichiers touchés |
| `verifier:memoire` | **vert** — 8 fichiers, 3 rappels armés |
| Suites base (`run-all-tests`) | **298 / 307** |
| Suites du devis | **toutes vertes** — aucune des neuf tombées n'est du devis |

**Les neuf rouges ne viennent pas de ce lot, et c'est mesuré, pas affirmé.**
L'arbre a été remis à `HEAD` (`git stash`) et les neuf suites rejouées seules :

| Suite | Sur `HEAD`, sans le lot |
|---|---|
| `test-fiche-pendant-relance` | déjà rouge |
| `test-mise-a-jour-role-db` | déjà rouge |
| `test-ouvrir-port` | déjà rouge |
| `test-relance-construction` | déjà rouge |
| `test-roles-capacites-db` | déjà rouge |
| `test-salarie-planning-lecture-seule-db` | déjà rouge |
| `test-seed-conserve-identifiants` | déjà rouge |
| `test-verrou-construction` | déjà rouge |
| `db-tests` | **verte seule**, avec ET sans le lot — sa chute en batterie est un **interblocage** de base (`DeadLockReport`), un effet de la course entre suites, pas du devis |

Suites neuves ou complétées par ce lot : `test-attente-devis` (11 tests, dont
trois neufs), `test-dates-envoi` (9 tests, neuf).

### Les suites navigateur

| Suite | Résultat |
|---|---|
| `test-devis-depuis-dictee-e2e` — la chaîne, le cœur de ce lot | **verte** |
| `test-devis-qui-tarde-e2e` — l'écran d'attente | **verte** |
| `test-envoi-client-e2e` — l'envoi, dates comprises | **verte** |
| `test-devis-complet-e2e` — l'écran où vous validez | **verte** |
| `test-anneau-vers-devis-e2e` | **verte** |
| `test-dicter-dans-le-devis-e2e` | **verte** |
| `test-devis-a-la-main-e2e` | **verte** |
| `test-devis-client-e2e` — l'écran de votre client | **instable** : verte, puis rouge, puis verte sur le MÊME code |

L'instable ne l'est que sur son premier contrôle — « un jeton inconnu ne
révèle rien » —, qui est le tout premier appel à cette page et tombe donc sur
sa compilation à la demande. **Ce lot ne touche aucun fichier de cette page**
(`git status src/app/devis` : rien). Le contrôle du pli, lui, est vert aux trois
tours.

**Et la batterie navigateur COMPLÈTE n'a pas pu être rendue depuis ce poste.**
Le serveur d'essai meurt en cours de route — deux fois, à la 81ᵉ suite puis à
la 3ᵉ, sans rien écrire dans son journal. Le dépôt connaît déjà ce genre de
limite (`TODO.md` : « la batterie e2e complète ne tient pas dans le
conteneur »). Les huit suites ci-dessus ont donc été jouées **une par une**,
chacune avec son propre serveur et sa propre base amorcée.

---

## Ce que j'ai dit et qui s'est révélé FAUX

**Un premier passage de la batterie navigateur a rendu vingt-quatre suites
rouges. Aucune ne l'était à cause du produit : la faute était la mienne.**

J'avais branché les suites sur le rôle `atlas_owner`. Or les tables portent
**FORCE ROW LEVEL SECURITY** : un propriétaire qui n'est pas superutilisateur
y reste soumis. Les suites, qui inspectent la base pour vérifier ce qu'elles
affirment, ne voyaient donc **aucune ligne** — d'où des cascades du genre
« impossible de lire `entreprise_id` » ou « aucun client avec un devis parti
dans le jeu de démonstration », qui accusaient le produit.

`CLAUDE.md` §5 le disait déjà, noir sur blanc : pour `test:e2e`, un rôle qui
**traverse** la RLS — le superutilisateur `postgres`. Je ne l'ai pas suivi.
Rejouées avec le bon rôle, les suites du devis sont vertes.

**Ce que ça a coûté**, et pourquoi c'est écrit ici : une heure, et failli
faire chercher un défaut dans du code juste. C'est exactement la faute que ce
dépôt paie en boucle — un environnement de vérification qui diffère du vrai ne
vérifie pas ce qu'on croit.

---

## Ce que j'ai regardé, en image

L'écran du devis figé **sans lien parti** — l'état que le point 2 rend enfin
honnête — a été atteint pour de bon et photographié : le bandeau dit « Ce devis
a été figé, mais aucun lien n'est parti : votre client n'a rien reçu », et la
porte dessous dit « Reprendre et envoyer ». Aucune suite ne l'atteignait ; il a
fallu fabriquer l'état à la main (`capturer-devis`, jeté après usage).

